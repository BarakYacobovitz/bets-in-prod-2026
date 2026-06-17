"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { collection, getDocs, doc, getDoc, query, where, onSnapshot, updateDoc, addDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../app/firebase";
import { getFlagUrl } from "../app/utils/flags"; 
import toast from "react-hot-toast";

// פונקציית עזר לחישובי זמנים לשאלות הפתעה
const parseDateTimeLocal = (dtStr: string) => {
  if (!dtStr) return 0;
  try {
    if (dtStr.includes("T")) {
      const [datePart, timePart] = dtStr.split("T");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hour, minute] = timePart.split(":").map(Number);
      return new Date(year, month - 1, day, hour, minute).getTime();
    }
    return new Date(dtStr).getTime();
  } catch { return 0; }
};

// רכיב קונפטי עצמאי שיופעל רק עבור המקום הראשון עם נקודות! 🎊
const Confetti = () => {
  const [pieces, setPieces] = useState<any[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const arr = Array.from({ length: 70 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      animationDuration: Math.random() * 3 + 2,
      delay: Math.random() * 2,
      emoji: ['🏆', '🥇', '⚽', '🎉', '💸', '🔥'][Math.floor(Math.random() * 6)]
    }));
    setPieces(arr);

    const timer = setTimeout(() => setIsVisible(false), 12000);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map(p => (
        <div key={p.id} className="absolute top-[-10%] text-2xl md:text-4xl animate-fall" style={{ left: `${p.left}%`, animationDuration: `${p.animationDuration}s`, animationDelay: `${p.delay}s`, animationIterationCount: 'infinite' }}>
          {p.emoji}
        </div>
      ))}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
        }
        .animate-fall { animation-name: fall; animation-timing-function: linear; }
      `}} />
    </div>
  );
};

const BROADCAST_QUOTES = {
  GROUP_STAGE_END: [
    "שלב הבתים ננעל! חלקנו נביאים, חלקנו צריכים להחליף מקצוע לניחוש תוצאות בטניס שולחן... 🏓",
    "הבתים נסגרו, הלב נפתח. מי היה מאמין שבלגיה תעשה לנו ככה? (לפחות חלקכם צדקתם) 🇧🇪",
    "הגענו לנוקאאוט! זה הזמן שבו הילדים הולכים לישון והמהמרים האמיתיים מוציאים את המחשבונים 🧮",
    "מי ששרד את הבתים - גיבור. מי שמוביל - חשוד בשימוש בבינה מלאכותית או בקשרים ישירים עם פיפ״א... 👀",
    "הבתים נגמרו. עכשיו כל גול שווה זהב, וכל החמצה שווה דמעות בוואטסאפ הקבוצתי 😢"
  ],
  TOURNAMENT_END: [
    "זהו, תם הטקס! הגביע הונף, הניקוד סופי, והמנצח הולך לחפור לנו על זה ב-4 השנים הקרובות... 🏆",
    "הטורניר נגמר. חלק יצאו עם קופה, חלק יצאו עם תובנות, וכולנו יצאנו עם חוסר רציני בשעות שינה 😴",
    "Bets in PROD נסגר רשמית. הניקוד נקבע, החובות בוואטסאפ נשלחו. נתראה ביורו? ⚽",
    "אלוף הליגה שלנו הוא רשמית ה'בנאדם הכי מעצבן בקבוצה' עד המונדיאל הבא. ברכות! 👑",
    "תודה לכל המהמרים, הנביאים ואלו שסתם ניחשו 0-0 כל הזמן וקיוו לנס. היה מטורף! ✨"
  ],
  REGULAR: [
    "הטבלה לא משקרת, היא פשוט לפעמים קצת אכזרית... 📉",
    "מישהו ראה את המקום הראשון? הוא נעלם באופק... 💨",
    "זוכרים שבתחילת הטורניר כולם חשבו שהם מבינים בכדורגל? זמנים יפים... 🏟️"
  ]
};

export default function Leaderboard() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [generalUsers, setGeneralUsers] = useState<any[]>([]);
  const [knockoutUsers, setKnockoutUsers] = useState<any[]>([]);
  const [activeBoard, setActiveBoard] = useState<"GENERAL" | "KNOCKOUT" | "LEAGUES">("GENERAL");
  const [myLeagues, setMyLeagues] = useState<any[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [isLeagueLoading, setIsLeagueLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredUser, setHoveredUser] = useState<string | null>(null);
  const [isMyRowVisible, setIsMyRowVisible] = useState(true);
  const myRowRef = useRef<HTMLTableRowElement>(null);

  // הגנה מפני Hydration Crash בסלולר!
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  useEffect(() => { setCurrentTimeMs(Date.now()); }, []);

  const [spyModalUser, setSpyModalUser] = useState<any | null>(null);
  const [spyPredictions, setSpyPredictions] = useState<any[]>([]);
  const [spyBonusPredictions, setSpyBonusPredictions] = useState<any[]>([]);
  const [spyQualifiers, setSpyQualifiers] = useState<any>({});
  const [spyThirdPlace, setSpyThirdPlace] = useState<string[]>([]);
  const [spyStats, setSpyStats] = useState<any>({});
  const [isLoadingSpy, setIsLoadingSpy] = useState(false);
  const [spyTab, setSpyTab] = useState<"STATS" | "MATCHES" | "QUALIFIERS" | "BONUS">("STATS");
  
  const [spyMatchTab, setSpyMatchTab] = useState<string>("MD1");
  const [spyBonusCategory, setSpyBonusCategory] = useState<string>("TOURNAMENT");
  const [spyBonusKnockoutRound, setSpyBonusKnockoutRound] = useState<string>("ALL");
  
  const [matchesMap, setMatchesMap] = useState<any>({});
  const [bonusQuestionsMap, setBonusQuestionsMap] = useState<any>({});
  const [realBonusAnswers, setRealBonusAnswers] = useState<any>({});
  const [realQualifiers, setRealQualifiers] = useState<any>({});
  const [realThirdPlace, setRealThirdPlace] = useState<string[]>([]);
  const [tournamentState, setTournamentState] = useState<number>(0);

  const [teaser, setTeaser] = useState<string>("");
  const [prizes, setPrizes] = useState<any>(null);
  const [isFirstPlace, setIsFirstPlace] = useState(false);

  const groupsList = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  const [broadcastQuote, setBroadcastQuote] = useState("");

  useEffect(() => {
    let pool = BROADCAST_QUOTES.REGULAR;
    if (tournamentState >= 4 && tournamentState <= 5) {
      pool = BROADCAST_QUOTES.GROUP_STAGE_END;
    } else if (tournamentState >= 13) {
      pool = BROADCAST_QUOTES.TOURNAMENT_END;
    }
    const randomQuote = pool[Math.floor(Math.random() * pool.length)];
    setBroadcastQuote(randomQuote);
  }, [tournamentState]);

  useEffect(() => {
    const targetBoard = sessionStorage.getItem("targetBoard");
    if (targetBoard === "GENERAL" || targetBoard === "KNOCKOUT" || targetBoard === "LEAGUES") {
      setActiveBoard(targetBoard);
      sessionStorage.removeItem("targetBoard");
    }
    const targetLeagueId = sessionStorage.getItem("targetLeagueId");
    if (targetLeagueId) {
      setActiveBoard("LEAGUES");
      setSelectedLeagueId(targetLeagueId);
      sessionStorage.removeItem("targetLeagueId");
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUserId(user.uid);
    });
    return () => unsubscribe();
  }, []);

  const rankUsers = (usersArr: any[], field: string) => {
    const sorted = [...usersArr].sort((a, b) => {
      const scoreA = a[field] || 0;
      const scoreB = b[field] || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      // שובר שוויון לפי א'-ב' כדי למנוע החלפות פתאומיות בפודיום
      const nameA = a.name || "";
      const nameB = b.name || "";
      return nameA > nameB ? 1 : -1;
    });

    let currentRank = 1;
    return sorted.map((u, i) => {
      if (i > 0 && (u[field] || 0) < (sorted[i - 1][field] || 0)) {
        currentRank = i + 1;
      }
      return { ...u, displayRank: currentRank, absoluteRank: i + 1 };
    });
  };

  useEffect(() => {
    const fetchLeaderboardData = async () => {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const usersArray: any[] = [];
        usersSnap.forEach((doc) => { usersArray.push({ id: doc.id, ...doc.data() }); });
        
        setGeneralUsers(rankUsers(usersArray, "totalPoints"));
        setKnockoutUsers(rankUsers(usersArray, "knockoutPoints"));

        const matchesSnap = await getDocs(collection(db, "matches"));
        const mMap: any = {};
        matchesSnap.forEach(doc => { mMap[doc.id] = doc.data(); });
        setMatchesMap(mMap);

        const bqSnap = await getDoc(doc(db, "settings", "bonus_questions"));
        const bMap: any = {};
        if (bqSnap.exists()) (bqSnap.data().questions || []).forEach((q: any) => { bMap[q.id] = q; });
        setBonusQuestionsMap(bMap);

        const rbSnap = await getDoc(doc(db, "admin_results", "bonus"));
        if (rbSnap.exists()) setRealBonusAnswers(rbSnap.data().answers || {});

        const rqSnap = await getDoc(doc(db, "admin_results", "qualifiers"));
        if (rqSnap.exists()) setRealQualifiers(rqSnap.data().results || {});

        const rtSnap = await getDoc(doc(db, "admin_results", "third_place"));
        if (rtSnap.exists()) setRealThirdPlace(rtSnap.data().teams || []);
        
        const prizesSnap = await getDoc(doc(db, "settings", "prizes"));
        if (prizesSnap.exists()) setPrizes(prizesSnap.data());
      } catch (error) { console.error("שגיאה:", error); } 
      finally { setIsLoading(false); }
    };

    fetchLeaderboardData();

    const unsubscribeSys = onSnapshot(doc(db, "settings", "system"), (docSnap) => {
      if (docSnap.exists()) {
        const state = Number(docSnap.data().tournamentState) || 0;
        setTournamentState(state);
      }
    });
    return () => unsubscribeSys();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    const qLeagues = query(collection(db, "mini_leagues"), where("members", "array-contains", currentUserId));
    const unsubscribeLeagues = onSnapshot(qLeagues, (snap) => {
        const leagues: any[] = [];
        snap.forEach(doc => leagues.push({ id: doc.id, ...doc.data() }));
        setMyLeagues(leagues);
        if (leagues.length > 0 && !selectedLeagueId && !sessionStorage.getItem("targetLeagueId")) {
            setSelectedLeagueId(leagues[0].id);
        }
    });
    return () => unsubscribeLeagues();
  }, [currentUserId]);

  const handleCreateLeague = async () => {
    if (!currentUserId) return;
    const name = prompt("איך קוראים לליגה החדשה שלכם?");
    if (!name || name.trim() === "") return;
    setIsLeagueLoading(true);
    try {
        const pin = Math.random().toString(36).substring(2, 8).toUpperCase(); 
        await addDoc(collection(db, "mini_leagues"), {
            name: name.trim(),
            pin: pin,
            adminId: currentUserId,
            members: [currentUserId],
            createdAt: new Date()
        });
        toast.success(`הליגה '${name}' הוקמה! קוד הצטרפות: ${pin}`, { duration: 6000 });
    } catch(e) { toast.error("שגיאה בהקמת הליגה."); }
    finally { setIsLeagueLoading(false); }
  };

  // -----------------------------------------------------------
  // פונקציית פרסים הוגנת: מפצלת קופה אם יש שוויון (Pool Logic)
  // הפתרון החדש: מבוסס על "מיקום אבסולוטי" (Absolute Rank) כדי למנוע מצב
  // שבו מקום נמוך עוקף בפרס שחקנים שנמצאים בשוויון בפסגה.
  // -----------------------------------------------------------
  const getPrizeForRank = (user: any, board: string, allUsers: any[]) => {
    if (!prizes || !user) return null;
    
    const scoreField = board === "GENERAL" ? "totalPoints" : "knockoutPoints";
    const score = user[scoreField] || 0;
    
    // אם הניקוד 0, אין חלוקת פרסים (מונע באגים בתחילת טורניר)
    if (score === 0) return null;

    // מאתרים את כל השחקנים שיש להם *בדיוק* את אותו הניקוד
    const tiedUsers = allUsers.filter(u => (u[scoreField] || 0) === score);
    const count = tiedUsers.length;
    
    // מחלצים את המשבצת האמיתית (העליונה ביותר) שהקבוצה הזו תופסת בטבלה.
    // אם 7 אנשים חולקים מקום 1, המשבצת העליונה היא 1.
    // האדם הבא (בעל ניקוד נמוך יותר) יהיה כבר במשבצת 8 ולא ב-2!
    const topAbsoluteRank = Math.min(...tiedUsers.map(u => u.absoluteRank));

    const getRaw = (r: number) => {
      if (board === "GENERAL") {
        if (r === 1) return Number(prizes.main1 || 0);
        if (r === 2) return Number(prizes.main2 || 0);
        if (r === 3) return Number(prizes.main3 || 0);
        if (r === 4) return Number(prizes.main4 || 0);
      } else {
        if (r === 1) return Number(prizes.ko1 || 0);
        if (r === 2) return Number(prizes.ko2 || 0);
        if (r === 3) return Number(prizes.ko3 || 0);
      }
      return 0;
    };

    let totalPool = 0;
    // מחברים את כל הפרסים של המשבצות שהקבוצה שואבת
    // לדוגמא: 7 אנשים במקום הראשון ישאבו את משבצות 1,2,3,4,5,6,7
    for (let i = 0; i < count; i++) {
      totalPool += getRaw(topAbsoluteRank + i);
    }
    
    // מחלקים שווה בשווה לכל חברי קבוצת השוויון
    const finalPrize = totalPool / count;
    return finalPrize > 0 ? Math.floor(finalPrize) : null;
  };

  const handleJoinLeague = async () => {
    if (!currentUserId) return;
    const pin = prompt("הכנס קוד הצטרפות (6 תווים):");
    if (!pin || pin.trim() === "") return;
    setIsLeagueLoading(true);
    try {
        const q = query(collection(db, "mini_leagues"), where("pin", "==", pin.trim().toUpperCase()));
        const snap = await getDocs(q);
        if (snap.empty) {
            toast.error("לא נמצאה ליגה עם הקוד הזה.");
            return;
        }
        const leagueDoc = snap.docs[0];
        const leagueData = leagueDoc.data();
        if (leagueData.members.includes(currentUserId)) {
            toast.error("אתה כבר חבר בליגה הזו!");
            return;
        }
        await updateDoc(doc(db, "mini_leagues", leagueDoc.id), { members: arrayUnion(currentUserId) });
        setSelectedLeagueId(leagueDoc.id);
        toast.success(`הצטרפת לליגה '${leagueData.name}' בהצלחה!`);
    } catch(e) { toast.error("שגיאה בהצטרפות לליגה."); }
    finally { setIsLeagueLoading(false); }
  };

  const handleLeaveLeague = async (leagueId: string, leagueName: string) => {
    toast((t) => (
      <div className="flex flex-col gap-3 text-right" dir="rtl">
        <span className="font-bold text-slate-800 text-sm">
          בטוח שברצונך לעזוב את הליגה '{leagueName}'?
        </span>
        <div className="flex gap-2">
          <button 
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await updateDoc(doc(db, "mini_leagues", leagueId), { members: arrayRemove(currentUserId) });
                setSelectedLeagueId(null);
                setActiveBoard("GENERAL");
                setTimeout(() => toast.success("עזבת את הליגה."), 100); 
              } catch (e) {
                setTimeout(() => toast.error("שגיאה בביצוע הפעולה."), 100);
              }
            }} 
            className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-black transition-all active:scale-95"
          >
            כן, עזוב
          </button>
          <button 
            onClick={() => toast.dismiss(t.id)} 
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
          >
            ביטול
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  // שימוש ב-useMemo להגנה מפני לולאת רינדור (ריצודים)
  const currentUsers = useMemo(() => {
    if (activeBoard === "GENERAL") return generalUsers;
    if (activeBoard === "KNOCKOUT") return knockoutUsers;
    if (activeBoard === "LEAGUES") {
       const activeLeague = myLeagues.find(l => l.id === selectedLeagueId);
       if (activeLeague) {
          const filtered = generalUsers.filter(u => activeLeague.members.includes(u.id));
          return rankUsers(filtered, "totalPoints");
       }
    }
    return [];
  }, [activeBoard, generalUsers, knockoutUsers, myLeagues, selectedLeagueId]);

  useEffect(() => {
    if (!currentUserId || currentUsers.length === 0) return;
    
    if (activeBoard === "LEAGUES") {
       const l = myLeagues.find(l => l.id === selectedLeagueId);
       if (l) setTeaser(`ברוך הבא לזירה של "${l.name}"! פה זה המגרש של הגדולים, שחק אותה.`);
       const me = currentUsers.find(u => u.id === currentUserId);
       setIsFirstPlace(me ? me.displayRank === 1 : false);
       return;
    }

    const scoreField = activeBoard === "GENERAL" ? "totalPoints" : "knockoutPoints";
    const prevScoreField = activeBoard === "GENERAL" ? "previousTotalPoints" : "previousKnockoutPoints";
    const prevRankField = activeBoard === "GENERAL" ? "previousRankGeneral" : "previousRankKnockout";
    
    const myIndex = currentUsers.findIndex(u => u.id === currentUserId);
    if (myIndex === -1) { setTeaser("עוד לא הופעת בטבלה. איפה הניחושים שלך?"); return; }
    
    const me = currentUsers[myIndex];
    setIsFirstPlace(me.displayRank === 1);

    if (currentUsers.length <= 1) { setTeaser("אתה לבד פה! זה הזמן להזמין חברים לטבלה."); return; }

    const myScore = me[scoreField] || 0;
    const myPrevScore = me[prevScoreField] || myScore;
    const myRank = me.displayRank;
    const myPrevRank = me[prevRankField] || myRank;
    const myNemesisId = generalUsers.find(u => u.id === currentUserId)?.nemesisId || null;
    const nemesisUser = myNemesisId ? currentUsers.find(u => u.id === myNemesisId) : null;
    
    const rankDiff = myPrevRank - myRank; 
    const ptsDiff = myScore - myPrevScore;
    
    const getRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    let newTeaser = "";

    // עזרים למגדר (זכר/נקבה) - זיהוי לפי השם "מאיה"
    const isFemale = me.name && me.name.includes("מאיה");
    const g = (m: string, f: string) => isFemale ? f : m; // עבור המשתמש הנוכחי (אתה/את)
    
    const isOtherF = (name: string) => name && name.includes("מאיה");
    const o = (name: string, m: string, f: string) => isOtherF(name) ? f : m; // עבור היריב (הוא/היא)

    if (tournamentState >= 13) {
       if (me.displayRank === 1) {
         newTeaser = g(`שריקת הסיום! ${me.name?.split(' ')[0]}, אתה האלוף הבלתי מעורער! תכין מקום בארון לגביע (ולמזומן) 🏆💸`, `שריקת הסיום! ${me.name?.split(' ')[0]}, את האלופה הבלתי מעורערת! תכיני מקום בארון לגביע (ולמזומן) 🏆💸`);
       } else if (me.displayRank <= 3) {
         newTeaser = g(`סוף הטורניר! סיימת על הפודיום במקום ה-${me.displayRank}. מכובד מאוד! (אבל תמיד תזכור מי לקח ראשון 😉)`, `סוף הטורניר! סיימת על הפודיום במקום ה-${me.displayRank}. מכובד מאוד! (אבל תמיד תזכרי מי לקח ראשון 😉)`);
       } else if (nemesisUser && myScore > (nemesisUser[scoreField] || 0)) {
         const nemName = nemesisUser.name?.split(' ')[0];
         newTeaser = `תם הטקס! לא הבאת אליפות, אבל היי - העיקר שהשארת את ${nemName} לאכול אבק בטבלה! 😂`;
       } else {
         newTeaser = `הטורניר ננעל! לא אליפות ולא נעליים, אבל לפחות יש לך 4 שנים להתאמן למונדיאל הבא... 🤡`;
       }
    } 
    else if (tournamentState === 4 || tournamentState === 5) {
       if (me.displayRank === 1) {
         newTeaser = `שלב הבתים ננעל ואתה בפסגה! כולם מחכים לראות אם תקרוס בלחץ של הנוקאאוט או שתלך עד הסוף... 👀`;
       } else if (me.displayRank <= 5) {
         newTeaser = `הבתים מאחורינו ואתה חזק בצמרת, מקום ${me.displayRank}! בנוקאאוט כל נקודה כפולה, זה הזמן לתת גז 🏎️`;
       } else if (nemesisUser && myScore < (nemesisUser[scoreField] || 0)) {
         const nemName = nemesisUser.name?.split(' ')[0];
         newTeaser = `שלב הבתים נגמר ואתה בפיגור אחרי ${nemName}. הנוקאאוט זה טורניר חדש לגמרי, תתעורר על עצמך! ⏰`;
       } else {
         newTeaser = `שלב הבתים הסתיים, וטוב שכך. תמחק את מה שהיה, בנוקאאוט מתחילים לעבוד על באמת! 💪`;
       }
    } 
    else {
      if (rankDiff > 0) {
         const passedGuy = currentUsers[myIndex + 1]; 
         const ptsStr = ptsDiff > 0 ? `אספת ${ptsDiff} נק' אתמול ו` : "";
         const passedName = passedGuy ? passedGuy.name.split(' ')[0] : "כמה חבר'ה";
         
         newTeaser = getRandom([
           g(`בואנה חביבי! ${ptsStr}עלית ${rankDiff} מקומות בדירוג! אתה פשוט חד.`, `פששש! ${ptsStr}עלית ${rankDiff} מקומות בדירוג! את פשוט חדה.`),
           g(`כנראה שהמשחקים בלילה עושים לך רק טוב... אתה לא מפסיק לפגוע וכבר עברת את ${passedName}!`, `כנראה שהמשחקים בלילה עושים לך רק טוב... את לא מפסיקה לפגוע וכבר עברת את ${passedName}!`),
           `איזו עקיפה! השארת להם אבק כמו שהלאנד יעשה לעיראק. עלית ${rankDiff} שלבים!`,
           `עקפת את ${passedName} בסיבוב! איזה בול פגיעה, ממש כמו מסי מול אלג'יריה!`,
           `פצצה לחיבורים! כמו קיין מול קרואטיה, עלית בטבלה!`,
           g(`בנית חומה בטבלה, ממש כמו ההגנה של כף ורדה מול ספרד! עלית ${rankDiff} שלבים.`, `בנית חומה בטבלה, ממש כמו ההגנה של כף ורדה מול ספרד! עלית ${rankDiff} שלבים.`)
         ]);
      } else if (rankDiff < 0) {
         const guyAhead = currentUsers[myIndex - 1]; 
         const aheadName = guyAhead ? guyAhead.name.split(' ')[0] : "מישהו";
         
         newTeaser = getRandom([
           g(`מה נסגר? נפלת ${Math.abs(rankDiff)} מקומות... בואנה, מסי כובש שלושער ואתה לא מסוגל לפגוע בתוצאה מסכנה?`, `מה נסגר? נפלת ${Math.abs(rankDiff)} מקומות... מסי כובש שלושער ואת לא מסוגלת לפגוע בתוצאה מסכנה?`),
           g(`אתה מנחש כמו קורסאו מול גרמניה, פעם אחת פגעת, אבל חוץ מזה אתה כל הזמן חוטף...`, `את מנחשת כמו קורסאו מול גרמניה, פעם אחת פגעת, אבל חוץ מזה את כל הזמן חוטפת...`),
           g(`כנראה שהשעות שינה של המונדיאל לא עושות לך טוב, אחרת איך אתה מסביר את הירידה הזאת? (נפלת ${Math.abs(rankDiff)} מקומות)`, `כנראה שהשעות שינה של המונדיאל לא עושות לך טוב, אחרת איך את מסבירה את הירידה הזאת? (נפלת ${Math.abs(rankDiff)} מקומות)`),
           g(`הגנת על המקום שלך אתמול כמו שברזיל הגנה מול גרמניה ב-7:1... ירדת ${Math.abs(rankDiff)} שלבים.`, `הגנת על המקום שלך אתמול כמו שברזיל הגנה מול גרמניה ב-7:1... ירדת ${Math.abs(rankDiff)} שלבים.`),
           g(`איך נתת ל-${aheadName} לעקוף אותך ככה? נרדמת בשמירה? אפילו ויניסיוס כובש עם עיניים עצומות.`, `איך נתת ל-${aheadName} לעקוף אותך ככה? נרדמת בשמירה? אפילו ויניסיוס כובש עם עיניים עצומות.`)
         ]);
      } else {
         if (me.displayRank === 1) {
           const nextGuy = currentUsers[myIndex + 1];
           if (nextGuy && nextGuy[scoreField] === myScore) {
             const nextName = nextGuy.name.split(' ')[0];
             newTeaser = getRandom([
                `אתה בפסגה, אבל צמוד ל-${nextName} בדיוק באותו הניקוד! צריך פה שובר שוויון.`, 
                `קרב צמוד! ${nextName} ${o(nextName, 'יושב', 'יושבת')} איתך על אותו כיסא בפסגה. מי ימצמץ ראשון?`
             ]);
           }
           else if (nextGuy) {
             const nextName = nextGuy.name.split(' ')[0];
             const diff = myScore - (nextGuy[scoreField] || 0);
             newTeaser = getRandom([
                `מלך הטבלה! 👑 אבל ${nextName} ${o(nextName, 'אורב', 'אורבת')} למעידה שלך במרחק של ${diff} נק' בלבד.`, 
                g(`האוויר פסגות עושה לך טוב. רק אל תסתכל אחורה, ${nextName} בפיגור ${diff} נק' ו${o(nextName, 'מכין', 'מכינה')} קאמבק.`, `האוויר פסגות עושה לך טוב. רק אל תסתכלי אחורה, ${nextName} בפיגור ${diff} נק' ו${o(nextName, 'מכין', 'מכינה')} קאמבק.`)
             ]);
           }
         } else if (me.displayRank === 2) {
           const king = currentUsers[myIndex - 1];
           const kingName = king.name.split(' ')[0];
           const diff = (king[scoreField] || 0) - myScore;
           if (diff === 0) newTeaser = `שוויון עם הפסגה! ${g('אתה', 'את')} ו-${kingName} נועלים קרניים. ניחוש בול אחד ו${g('אתה לוקח', 'את לוקחת')} את זה, סטייל אמבפה מול סנגל!`;
           else newTeaser = getRandom([`הכתר במרחק נגיעה! רק ${diff} נקודות מפרידות בינך לבין ${kingName} שבפסגה.`, g(`סגנות זה נחמד, אבל אנחנו באנו לקחת גביע. תן איזה בול ותעקוף את ${kingName}! (${diff} נק' פער)`, `סגנות זה נחמד, אבל אנחנו באנו לקחת גביע. תני איזה בול ותעקפי את ${kingName}! (${diff} נק' פער)`)]);
         } else if (myIndex === currentUsers.length - 1 && currentUsers.length > 3) {
           const guyAbove = currentUsers[myIndex - 1];
           const aboveName = guyAbove.name.split(' ')[0];
           const diff = (guyAbove[scoreField] || 0) - myScore;
           newTeaser = getRandom([
             `נועל הטבלה חביבי... 📉 אפילו בוט רנדומלי עושה יותר מזה.`, 
             g(`ראית פעם משחק כדורגל מלא? 😂 אתה צריך ${diff} נקודות רק כדי לא להיות אחרון!`, `ראית פעם משחק כדורגל מלא? 😂 את צריכה ${diff} נקודות רק כדי לא להיות אחרונה!`),
             `מסי כובש שלושער בגיל 39 ו${g('אתה לא פוגע', 'את לא פוגעת')} כיוון? לפחות ${g('תעקוף', 'תעקפי')} את ${aboveName}!`
           ]);
         } else {
           const prevGuy = currentUsers[myIndex - 1];
           const prevName = prevGuy.name.split(' ')[0];
           const diff = (prevGuy[scoreField] || 0) - myScore;
           
           if (diff === 0) {
             newTeaser = getRandom([
                `קרב חפירות! ${g('אתה', 'את')} ו-${prevName} בול על אותו ניקוד (${myScore} נק'). מי ייתן גז ראשון?`,
                `צמוד צמוד... ${g('אתה יושב', 'את יושבת')} ל-${prevName} על הזנב עם תיקו בנקודות. ניחוש נכון אחד כמו קיין מול קרואטיה ו${g('אתה עוקף', 'את עוקפת')}!`
             ]);
           } else {
             newTeaser = getRandom([
                g(`אתה מרחק יריקה מ-${prevName} ש${o(prevName, 'מקדים', 'מקדימה')} אותך ב-${diff} נקודות. תפסיק לשחק בטוח!`, `את מרחק יריקה מ-${prevName} ש${o(prevName, 'מקדים', 'מקדימה')} אותך ב-${diff} נקודות. תפסיקי לשחק בטוח!`), 
                `מגמה חיובית! עוד ${diff} נקודות ו${g('אתה שולח', 'את שולחת')} את ${prevName} למטה. חד כתער כמו אמבפה מול סנגל!`,
                `אתה בפיגור של ${diff} נק' מ-${prevName}. תן איזה בול פגיעה סטייל הלאנד מול עיראק ותחזור לעניינים.`
             ]);
           }
         }
      }
    }
    setTeaser(newTeaser);
  }, [currentUsers, activeBoard, currentUserId, tournamentState, generalUsers]);

  useEffect(() => {
    let observer: IntersectionObserver;
    const timer = setTimeout(() => {
      if (!myRowRef.current) return;
      observer = new IntersectionObserver(([entry]) => { setIsMyRowVisible(entry.isIntersecting); }, { threshold: 0 });
      observer.observe(myRowRef.current);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [currentUsers, activeBoard, isLoading]);

  const isMatchLocked = (match: any, state: number) => {
    if (!match) return false;
    const s = Number(state) || 0;
    if (match.stage !== "KNOCKOUT") {
      const md = Number(match.matchday) || 1; 
      if (md === 1 && s >= 1) return true;
      if (md === 2 && s >= 2) return true;
      if (md === 3 && s >= 3) return true;
      return false;
    } else {
      if (match.roundName === "32 הגדולות" && s >= 5) return true;
      if (match.roundName === "שמינית גמר" && s >= 7) return true;
      if (match.roundName === "רבע גמר" && s >= 9) return true;
      if (match.roundName === "חצי גמר" && s >= 11) return true;
      if ((match.roundName === "גמר" || match.roundName === "מקום שלישי") && s >= 13) return true;
      return false;
    }
  };

  const isBonusLocked = (q: any, state: number) => {
    if (q.isSurprise) {
       // שימוש בזמן המקומי ששמור ב-State כדי למנוע קריסה!
       if (!q.openTime || !q.closeTime || currentTimeMs === 0) return false;
       return currentTimeMs > parseDateTimeLocal(q.closeTime); 
    }
    const s = Number(state) || 0;
    if (s === 0) return false;
    if (q.phase === "TOURNAMENT" || q.phase === "GROUPS") return s >= 1;
    if (q.phase === "KNOCKOUT") {
      const kr = q.knockoutRound || "ALL";
      if (kr === "ALL" || kr === "32 הגדולות") return s >= 5;
      if (kr === "שמינית גמר") return s >= 7;
      if (kr === "רבע גמר") return s >= 9;
      if (kr === "חצי גמר") return s >= 11;
      if (kr === "גמר") return s >= 13;
    }
    return false;
  };

  const calculateMatchPoints = (match: any, predH: string, predA: string, predQ: string) => {
    if (!match.isFinished || predH === "" || predA === "" || match.realHomeScore === "" || match.realAwayScore === "" || match.realHomeScore === undefined) return null;
    let pts = 0; 
    const rH = Number(match.realHomeScore); 
    const rA = Number(match.realAwayScore); 
    const pH = Number(predH); 
    const pA = Number(predA);
    if (!isNaN(pH) && !isNaN(pA) && !isNaN(rH) && !isNaN(rA)) {
       if (Math.sign(pH - pA) === Math.sign(rH - rA)) { 
           pts += 5; 
           if (pH === rH && pA === rA) pts += 10; 
       }
    }
    if (match.stage === "KNOCKOUT" && predQ === match.realQualifier && predQ !== "") {
      const qMap: any = { "32 הגדולות": 5, "שמינית גמר": 10, "רבע גמר": 15, "חצי גמר": 20, "גמר": 25, "מקום שלישי": 10 }; 
      pts += (qMap[match.roundName] || 0);
    }
    return pts;
  };

  const calculateBonusPoints = (qId: string, userAnswer: string) => {
    const truth = realBonusAnswers[qId];
    if (!truth || !userAnswer) return null;
    const truthArray = Array.isArray(truth) ? truth : [truth];
    return truthArray.some((t: string) => t.toString().trim() === userAnswer.toString().trim()) ? (bonusQuestionsMap[qId]?.points || 0) : 0;
  };

  const getGroupQualPoints = (group: string, place: 'first' | 'second', predTeam: string) => {
    if (!realQualifiers[group] || !predTeam) return null;
    const real = realQualifiers[group];
    if (place === 'first') {
       if (predTeam === real.first) return 15; if (predTeam === real.second) return 7; if (real.first) return 0; 
    } else {
       if (predTeam === real.second) return 15; if (predTeam === real.first) return 7; if (real.second) return 0;
    }
    return null;
  };

  const getThirdPlacePoints = (predTeam: string) => {
    if (!predTeam || realThirdPlace.filter(t=>t!=="").length === 0) return null;
    if (realThirdPlace.includes(predTeam)) return 10; if (realThirdPlace.filter(t=>t!=="").length === 8) return 0; return null; 
  };

  const getPointsBadge = (points: number | null) => {
    if (points === null) return null;
    if (points === 0) return <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 bg-slate-700/50 text-slate-400 px-2 py-1 rounded-md text-[10px] md:text-xs font-bold shadow-sm">0 נק'</span>;
    if (points === 5 || points === 7 || points === 10) return <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-1 rounded-md text-[10px] md:text-xs font-bold shadow-sm">+{points} נק'</span>;
    if (points >= 15) return <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded-md text-[10px] md:text-xs font-bold shadow-[0_0_10px_rgba(16,185,129,0.2)]">🎯 +{points} נק'</span>;
    return <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-1 rounded-md text-[10px] md:text-xs font-bold shadow-sm">+{points} נק'</span>;
  };

  const handleOpenSpy = async (userToSpy: any) => {
    setSpyModalUser(userToSpy); setIsLoadingSpy(true); setSpyPredictions([]); setSpyBonusPredictions([]); setSpyQualifiers({}); setSpyThirdPlace([]); setSpyTab("STATS");
    
    let defaultMatchTab = "MD1";
    if (tournamentState >= 13) defaultMatchTab = "FINAL";
    else if (tournamentState >= 11) defaultMatchTab = "SF";
    else if (tournamentState >= 9) defaultMatchTab = "QF";
    else if (tournamentState >= 7) defaultMatchTab = "R16";
    else if (tournamentState >= 5) defaultMatchTab = "R32";
    else if (tournamentState >= 3) defaultMatchTab = "MD3";
    else if (tournamentState >= 2) defaultMatchTab = "MD2";
    setSpyMatchTab(defaultMatchTab);
    
    setSpyBonusCategory("TOURNAMENT");
    setSpyBonusKnockoutRound("ALL");
    
    let stats = { exactC: 0, exactP: 0, dirC: 0, dirP: 0, koC: 0, koP: 0, bonusC: 0, bonusP: 0, groupC: 0, groupP: 0, thirdC: 0, thirdP: 0 };
    const qMap: any = { "32 הגדולות": 5, "שמינית גמר": 10, "רבע גמר": 15, "חצי גמר": 20, "גמר": 25, "מקום שלישי": 10 };
    
    try {
      const gatheredMatches: any[] = [];
      const qGroups = query(collection(db, "predictions_matches"), where("userId", "==", userToSpy.id));
      const snapGroups = await getDocs(qGroups);
      snapGroups.forEach(doc => {
        const data = doc.data(); const matchInfo = matchesMap[data.matchId];
        if (matchInfo && data.predictedHomeScore !== "" && (isMatchLocked(matchInfo, tournamentState) || matchInfo.isFinished)) {
          gatheredMatches.push({ ...data, matchInfo, points: calculateMatchPoints(matchInfo, data.predictedHomeScore, data.predictedAwayScore, "") });
          
          if (matchInfo.isFinished && matchInfo.realHomeScore !== "" && matchInfo.realAwayScore !== "") {
            const pH = Number(data.predictedHomeScore); const pA = Number(data.predictedAwayScore);
            const rH = Number(matchInfo.realHomeScore); const rA = Number(matchInfo.realAwayScore);
            if (!isNaN(pH) && !isNaN(pA) && !isNaN(rH) && !isNaN(rA)) {
               if (Math.sign(pH - pA) === Math.sign(rH - rA)) {
                  if (pH === rH && pA === rA) { stats.exactC++; stats.exactP += 15; } 
                  else { stats.dirC++; stats.dirP += 5; }
               }
            }
          }
        }
      });
      const qKnockout = query(collection(db, "predictions_knockout"), where("userId", "==", userToSpy.id));
      const snapKnockout = await getDocs(qKnockout);
      snapKnockout.forEach(doc => {
        const data = doc.data(); const matchInfo = matchesMap[data.matchId];
        if (matchInfo && data.predictedHomeScore !== "" && (isMatchLocked(matchInfo, tournamentState) || matchInfo.isFinished)) {
          gatheredMatches.push({ ...data, matchInfo, points: calculateMatchPoints(matchInfo, data.predictedHomeScore, data.predictedAwayScore, data.qualifier || "") });
          
          if (matchInfo.isFinished && matchInfo.realHomeScore !== "" && matchInfo.realAwayScore !== "") {
            const pH = Number(data.predictedHomeScore); const pA = Number(data.predictedAwayScore);
            const rH = Number(matchInfo.realHomeScore); const rA = Number(matchInfo.realAwayScore);
            if (!isNaN(pH) && !isNaN(pA) && !isNaN(rH) && !isNaN(rA)) {
               if (Math.sign(pH - pA) === Math.sign(rH - rA)) {
                  if (pH === rH && pA === rA) { stats.exactC++; stats.exactP += 15; }
                  else { stats.dirC++; stats.dirP += 5; }
               }
            }
            if (data.qualifier === matchInfo.realQualifier && data.qualifier !== "") {
               stats.koC++; stats.koP += (qMap[matchInfo.roundName] || 0);
            }
          }
        }
      });
      gatheredMatches.sort((a, b) => {
        const stageA = a.matchInfo.stage === "KNOCKOUT" ? 1 : 0; const stageB = b.matchInfo.stage === "KNOCKOUT" ? 1 : 0;
        if (stageA !== stageB) return stageA - stageB;
        return (Number(a.matchInfo.matchday) || 1) - (Number(b.matchInfo.matchday) || 1);
      });
      setSpyPredictions(gatheredMatches);

      const gatheredBonuses: any[] = [];
      const bonusSnap = await getDoc(doc(db, "predictions_bonus", userToSpy.id));
      if (bonusSnap.exists()) {
        const userAnswers = bonusSnap.data().answers || {};
        for (const [qId, ans] of Object.entries(userAnswers)) {
          const qInfo = bonusQuestionsMap[qId];
          if (qInfo && isBonusLocked(qInfo, tournamentState)) {
             const pts = calculateBonusPoints(qId, ans as string); gatheredBonuses.push({ qId, question: qInfo, answer: ans, points: pts });
             if (pts && pts > 0) { stats.bonusC++; stats.bonusP += pts; }
          }
        }
      }
      setSpyBonusPredictions(gatheredBonuses);

      if (tournamentState >= 1) {
        const qualSnap = await getDoc(doc(db, "predictions_qualifiers", userToSpy.id));
        if (qualSnap.exists()) {
           const groups = qualSnap.data().groups || {}; setSpyQualifiers(groups);
           for (const [gName, preds] of Object.entries<any>(groups)) {
             const p1 = getGroupQualPoints(gName, 'first', preds.first); const p2 = getGroupQualPoints(gName, 'second', preds.second);
             if (p1 && p1 > 0) { stats.groupC++; stats.groupP += p1; }
             if (p2 && p2 > 0) { stats.groupC++; stats.groupP += p2; }
           }
        }
        const thirdSnap = await getDoc(doc(db, "predictions_third_place", userToSpy.id));
        if (thirdSnap.exists()) {
           const teams = thirdSnap.data().teams || []; setSpyThirdPlace(teams);
           teams.forEach((t: string) => { const p = getThirdPlacePoints(t); if (p && p > 0) { stats.thirdC++; stats.thirdP += p; } });
        }
      }
      setSpyStats(stats);
    } catch (error) { console.error("שגיאה בריגול:", error); } finally { setIsLoadingSpy(false); }
  };

  const getFilteredSpyMatches = () => {
    return spyPredictions.filter(pred => {
      const m = pred.matchInfo;
      if (spyMatchTab === "MD1") return m.stage !== "KNOCKOUT" && (Number(m.matchday) || 1) === 1;
      if (spyMatchTab === "MD2") return m.stage !== "KNOCKOUT" && Number(m.matchday) === 2;
      if (spyMatchTab === "MD3") return m.stage !== "KNOCKOUT" && Number(m.matchday) === 3;
      if (spyMatchTab === "R32") return m.stage === "KNOCKOUT" && m.roundName === "32 הגדולות";
      if (spyMatchTab === "R16") return m.stage === "KNOCKOUT" && m.roundName === "שמינית גמר";
      if (spyMatchTab === "QF") return m.stage === "KNOCKOUT" && m.roundName === "רבע גמר";
      if (spyMatchTab === "SF") return m.stage === "KNOCKOUT" && m.roundName === "חצי גמר";
      if (spyMatchTab === "FINAL") return m.stage === "KNOCKOUT" && (m.roundName === "גמר" || m.roundName === "מקום שלישי");
      return true;
    });
  };

  const getFilteredSpyBonuses = () => {
    return spyBonusPredictions.filter(bPred => {
      const q = bPred.question;
      if (q.phase !== spyBonusCategory) return false;
      if (spyBonusCategory === "KNOCKOUT") {
         const kr = q.knockoutRound || "ALL";
         if (kr !== spyBonusKnockoutRound) return false;
      }
      return true;
    });
  };

  if (isLoading) return <div className="text-center text-blue-400 animate-pulse font-bold mt-12 text-xl">טוען את טבלת המובילים... ⚽</div>;

  const podiumFirst = currentUsers[0];
  const podiumSecond = currentUsers[1];
  const podiumThird = currentUsers[2];

  const me = currentUsers.find(u => u.id === currentUserId);
  const myNemesisId = generalUsers.find(u => u.id === currentUserId)?.nemesisId || null;
  const nemesisUser = myNemesisId ? currentUsers.find(u => u.id === myNemesisId) : null;
  
  const topUser = currentUsers[0];
  const scoreField = activeBoard === "KNOCKOUT" ? "knockoutPoints" : "totalPoints";

  const myScore = me ? me[scoreField] : 0;
  const topScore = topUser ? topUser[scoreField] : 0;
  const pointsGap = topScore - myScore;

  const nemesisScore = nemesisUser ? nemesisUser[scoreField] : null;
  const nemesisGap = nemesisScore !== null ? myScore - nemesisScore : null;

  return (
    <div className="w-full max-w-4xl mx-auto pb-12" dir="rtl">
      
      {isFirstPlace && tournamentState > 0 && myScore > 0 && <Confetti />}

      <div className="flex overflow-x-auto gap-2 mb-4 pb-2 custom-scrollbar bg-slate-900/50 p-2 rounded-2xl border border-slate-800 max-w-4xl mx-auto md:justify-center">
        <button 
          onClick={() => setActiveBoard("GENERAL")} 
          className={`px-6 py-3 rounded-xl font-black whitespace-nowrap transition-all text-sm flex items-center justify-center gap-2 ${activeBoard === "GENERAL" ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-amber-400"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M22 20H2" /><path d="M8 20V8h8v12" /><path d="M16 20v-8h6v8" /><path d="M2 20v-4h6v4" />
          </svg>
          דירוג כללי
        </button>
        
        {tournamentState >= 4 && (
          <button 
            onClick={() => setActiveBoard("KNOCKOUT")} 
            className={`px-6 py-3 rounded-xl font-black whitespace-nowrap transition-all text-sm flex items-center justify-center gap-2 ${activeBoard === "KNOCKOUT" ? "bg-pink-600 text-white shadow-lg shadow-pink-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-pink-400"}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M14.5 17.5L3 6V3h3l11.5 11.5" /><path d="M13 19l6-6" /><path d="M16 16l4 4" /><path d="M19 21l2-2" /><path d="M6.5 12.5L3 16v3h3l3.5-3.5" /><path d="M21 3v3l-3.5 3.5" /><path d="M18 5l-4 4" />
            </svg>
            נוק-אאוט
          </button>
        )}

        <button id="private-leagues-section"
          onClick={() => setActiveBoard("LEAGUES")} 
          className={`px-6 py-3 rounded-xl font-black whitespace-nowrap transition-all text-sm flex items-center justify-center gap-2 ${activeBoard === "LEAGUES" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-blue-400"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          ליגות פרטיות
        </button>
      </div>

      {prizes && activeBoard !== "LEAGUES" && (
        <div className="bg-slate-900/50 border border-slate-800 p-3 sm:p-4 rounded-2xl mb-6 flex items-center justify-between max-w-sm mx-auto shadow-inner animate-fade-in-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-xl shadow-[0_0_15px_rgba(16,185,129,0.2)] border border-emerald-500/30">💰</div>
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">סך הפרסים בטבלה</div>
              <div className="text-xl font-black text-white leading-none mt-1">
                 {activeBoard === "GENERAL" 
                   ? (Number(prizes.main1||0) + Number(prizes.main2||0) + Number(prizes.main3||0) + Number(prizes.main4||0))
                   : (Number(prizes.ko1||0) + Number(prizes.ko2||0) + Number(prizes.ko3||0))} ₪
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 shadow-sm">שקיפות מלאה</span>
          </div>
        </div>
      )}

      {activeBoard === "LEAGUES" && (
        <div className="mb-6 animate-fade-in-up">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700 shadow-inner">
            <div>
              <h3 className="text-lg font-black text-blue-400">ניהול ליגות פרטיות</h3>
              <p className="text-slate-400 text-xs">הקם ליגה למשרד או הצטרף לליגה קיימת.</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <button onClick={handleCreateLeague} disabled={isLeagueLoading} className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md transition-transform active:scale-95 flex justify-center items-center gap-2">➕ צור ליגה</button>
              <button onClick={handleJoinLeague} disabled={isLeagueLoading} className="flex-1 md:flex-none bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md transition-transform active:scale-95 flex justify-center items-center gap-2">🔗 הצטרף עם קוד</button>
            </div>
          </div>

          {myLeagues.length > 0 && (
             <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 bg-slate-900/30 p-2 rounded-xl border border-slate-800/50">
               <span className="text-slate-500 text-xs font-bold py-2 px-1 flex items-center shrink-0">הליגות שלי:</span>
               {myLeagues.map(l => (
                  <button 
                     key={l.id} 
                     onClick={() => setSelectedLeagueId(l.id)} 
                     className={`px-5 py-2 rounded-lg font-bold whitespace-nowrap transition-all text-sm border shrink-0 ${selectedLeagueId === l.id ? 'bg-blue-600 text-white border-blue-500 shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border-slate-700'}`}
                  >
                     {l.name}
                  </button>
               ))}
             </div>
          )}
        </div>
      )}

      {activeBoard === "LEAGUES" && myLeagues.length === 0 ? (
         <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 text-center mb-8 shadow-xl">
           <div className="text-6xl mb-4 opacity-80">🏟️</div>
           <h3 className="text-xl font-bold text-white mb-2">אין לך ליגות פרטיות</h3>
           <p className="text-slate-400 text-sm max-w-sm mx-auto">
             השתמש בכפתורים למעלה כדי ליצור ליגה חדשה או להצטרף לליגה קיימת עם קוד, ובוא להתחרות מול החברים!
           </p>
         </div>
      ) : tournamentState === 0 ? (
         <div className="bg-slate-800 pt-12 pb-16 px-4 md:px-8 rounded-3xl border border-slate-700 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center text-center">
             <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 bg-amber-500/10"></div>
             
             <div className="text-6xl md:text-7xl drop-shadow-[0_0_20px_rgba(251,191,36,0.6)] mb-6 animate-pulse z-10">🏆</div>
             <h3 className="text-2xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 mb-4 tracking-tight px-4 z-10">
                 כאן תוכלו לראות את הדירוג שלכם בתחרות כשהיא תתחיל...
             </h3>
             <p className="text-slate-400 max-w-lg mx-auto mb-10 z-10 text-sm md:text-base font-medium leading-relaxed">
                 בינתיים, קבלו את נבחרת החלומות שכבר נרשמה, הסדירה תשלום והבטיחה את מקומה בטורניר. הבורדינג כבר בעיצומו! ✈️
             </p>

             <div className="flex flex-wrap justify-center items-center max-w-5xl mx-auto relative z-10 py-16 px-4 gap-x-4 gap-y-10 md:gap-x-8 md:gap-y-14">
                 {generalUsers.filter(u => u.hasPaid).map((user, i) => {
                    const sizeScale = i % 3 === 0 ? "scale-110" : i % 5 === 0 ? "scale-90" : "scale-100";
                    const verticalOffset = i % 4 === 0 ? "-translate-y-8 md:-translate-y-12" : i % 3 === 0 ? "translate-y-6 md:translate-y-10" : i % 2 === 0 ? "-translate-y-3" : "translate-y-4";
                    const animDelay = `${(i * 0.4) % 3}s`;

                    return (
                       <div 
                          key={user.id} 
                          className={`flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-slate-600/50 hover:border-amber-500/80 pl-4 pr-1.5 py-1.5 rounded-full shadow-xl hover:shadow-[0_0_25px_rgba(245,158,11,0.3)] transition-all duration-300 cursor-default hover:z-30 hover:!scale-125 ${sizeScale} ${verticalOffset}`}
                          style={{
                             animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                             animationDelay: animDelay
                          }}
                       >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-sm shadow-inner font-black text-amber-400 border border-slate-600 shrink-0">
                             {user.name ? user.name.charAt(0).toUpperCase() : "👤"}
                          </div>
                          <span className="text-sm font-bold text-slate-200">
                             {user.name?.split(' ')[0]}
                          </span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 p-1 rounded-full border border-emerald-500/30" title="שולם ומאושר">✅</span>
                       </div>
                    );
                 })}
                 {generalUsers.filter(u => u.hasPaid).length === 0 && (
                    <div className="text-slate-500 text-sm font-bold bg-slate-900/50 px-6 py-3 rounded-full border border-slate-800">הלובי ריק כרגע. תהיו הראשונים לתפוס מקום בטיסה! ✈️</div>
                 )}
             </div>
         </div>
      ) : (
         <div className="bg-slate-800 pt-10 rounded-3xl border border-slate-700 shadow-2xl relative overflow-hidden flex flex-col">
           <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 ${activeBoard === "GENERAL" ? "bg-amber-500/10" : activeBoard === "LEAGUES" ? "bg-blue-500/10" : "bg-emerald-500/10"}`}></div>
           
           <div className="flex flex-col md:flex-row justify-between items-center mb-2 px-6 md:px-10 relative z-10">
              <h2 className="text-2xl md:text-3xl font-extrabold text-white text-center md:text-right">
                {activeBoard === "GENERAL" ? "טבלת הדירוג הכללי" : activeBoard === "KNOCKOUT" ? "טבלת שלב הנוק-אאוט" : `ליגה: ${myLeagues.find(l => l.id === selectedLeagueId)?.name || "פרטית"}`}
              </h2>

              {activeBoard === "LEAGUES" && selectedLeagueId && (
                 <div className="flex items-center gap-3 mt-3 md:mt-0 bg-slate-900/50 p-1.5 rounded-xl border border-slate-700/50 shadow-inner">
                    <span className="bg-blue-900/40 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-lg text-sm font-mono tracking-widest flex items-center gap-2" title="קוד הצטרפות לחברים">
                      <span className="text-[10px] text-blue-400/70 font-sans font-bold">קוד:</span> {myLeagues.find(l => l.id === selectedLeagueId)?.pin}
                    </span>
                    <button onClick={() => {
                       const l = myLeagues.find(l => l.id === selectedLeagueId);
                       if(l) handleLeaveLeague(l.id, l.name);
                    }} className="text-xs font-bold text-rose-400 hover:text-white bg-rose-900/20 hover:bg-rose-600 px-3 py-1.5 rounded-lg border border-rose-500/30 transition-colors shadow-sm">
                      🚪 עזוב
                    </button>
                 </div>
              )}
           </div>
           
           {currentUsers.length > 0 && (
             <div className="flex justify-center items-end gap-2 md:gap-6 mb-6 relative z-10 px-2 pt-4">
               
               {/* מקום שני */}
               {podiumSecond && (
                 <div className="flex flex-col items-center w-28 md:w-32">
                   <div className="text-slate-300 font-bold mb-3 text-center truncate w-full px-1 text-sm md:text-base">
                     {podiumSecond.name?.split(' ')[0]}
                   </div>
                   <div className={`w-full bg-gradient-to-t from-slate-400 to-slate-300 pt-3 pb-4 rounded-t-lg shadow-lg relative flex flex-col items-center justify-between border-t-2 ${podiumSecond.id === myNemesisId ? 'border-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.5)]' : 'border-slate-200'} min-h-[130px] md:min-h-[150px]`}>
                     <span className="text-4xl drop-shadow-md mb-2">
                       {podiumSecond.displayRank === 1 ? "🥇" : podiumSecond.displayRank === 2 ? "🥈" : "🥉"}
                     </span>
                     <div className="flex flex-col items-center w-full mt-auto">
                        <span className="text-slate-800 font-black text-2xl text-center leading-none">{podiumSecond[scoreField]}</span>
                        <span className="text-slate-700 font-bold text-[10px] md:text-xs text-center mt-1">מקום {podiumSecond.displayRank}</span>
                        
                        {getPrizeForRank(podiumSecond, activeBoard, currentUsers) ? (
                          <div className="mt-2 bg-slate-500/20 px-2.5 py-1 rounded-full border border-slate-500/30 flex items-center gap-1.5 shadow-sm">
                            <span className="text-[10px]">💰</span>
                            <span className="text-xs font-black text-slate-900">{getPrizeForRank(podiumSecond, activeBoard, currentUsers)} ₪</span>
                          </div>
                        ) : null}
                     </div>
                   </div>
                 </div>
               )}

               {/* מקום ראשון */}
               {podiumFirst && (
                 <div className="flex flex-col items-center w-32 md:w-40 z-10">
                   {activeBoard === "GENERAL" && (
                     <div className="mb-2 flex flex-col items-center justify-center animate-pulse">
                        <span className="text-5xl md:text-6xl drop-shadow-[0_0_20px_rgba(251,191,36,0.9)]">⚽</span>
                        <span className="text-[10px] font-black text-amber-400 tracking-widest uppercase mt-2 bg-amber-900/40 px-2 py-0.5 rounded border border-amber-500/30 shadow-sm">כדור הזהב</span>
                     </div>
                   )}
                   {activeBoard === "KNOCKOUT" && (
                     <div className="mb-2 flex flex-col items-center justify-center animate-pulse">
                        <span className="text-5xl md:text-6xl drop-shadow-[0_0_20px_rgba(16,185,129,0.9)]">👟</span>
                        <span className="text-[10px] font-black text-emerald-400 tracking-widest uppercase mt-2 bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-500/30 shadow-sm">נעל הזהב</span>
                     </div>
                   )}

                   <div className="text-amber-400 font-black mb-3 text-center truncate w-full px-1 text-base md:text-lg">
                     {podiumFirst.name?.split(' ')[0]}
                     </div>
                   <div className={`w-full bg-gradient-to-t from-amber-600 to-amber-400 pt-3 pb-4 rounded-t-lg shadow-[0_0_30px_rgba(251,191,36,0.4)] relative flex flex-col items-center justify-between border-t-2 ${podiumFirst.id === myNemesisId ? 'border-rose-500 shadow-[0_0_20px_rgba(225,29,72,0.8)]' : 'border-amber-200'} min-h-[160px] md:min-h-[180px]`}>
                     <span className="text-5xl drop-shadow-lg mb-2">
                       {podiumFirst.displayRank === 1 ? "🥇" : "🥈"}
                     </span>
                     <div className="flex flex-col items-center w-full mt-auto">
                        <span className="text-amber-950 font-black text-3xl text-center leading-none">{podiumFirst[scoreField]}</span>
                        <span className="text-amber-900 font-bold text-xs text-center mt-1">מקום {podiumFirst.displayRank}</span>
                        
                        {getPrizeForRank(podiumFirst, activeBoard, currentUsers) ? (
                          <div className="mt-2 bg-amber-900/20 px-3 py-1 rounded-full border border-amber-900/30 flex items-center gap-1.5 shadow-sm">
                            <span className="text-[11px]">💰</span>
                            <span className="text-sm font-black text-amber-950">{getPrizeForRank(podiumFirst, activeBoard, currentUsers)} ₪</span>
                          </div>
                        ) : null}
                     </div>
                   </div>
                 </div>
               )}

               {/* מקום שלישי */}
               {podiumThird && (
                 <div className="flex flex-col items-center w-28 md:w-32">
                   <div className="text-orange-300 font-bold mb-3 text-center truncate w-full px-1 text-sm md:text-base">
                     {podiumThird.name?.split(' ')[0]}
                   </div>
                   <div className={`w-full bg-gradient-to-t from-orange-800 to-orange-600 pt-3 pb-4 rounded-t-lg shadow-lg relative flex flex-col items-center justify-between border-t-2 ${podiumThird.id === myNemesisId ? 'border-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.5)]' : 'border-orange-400'} min-h-[110px] md:min-h-[130px]`}>
                     <span className="text-3xl drop-shadow-md mb-2">
                       {podiumThird.displayRank === 1 ? "🥇" : podiumThird.displayRank === 2 ? "🥈" : "🥉"}
                     </span>
                     <div className="flex flex-col items-center w-full mt-auto">
                        <span className="text-orange-100 font-black text-xl text-center leading-none">{podiumThird[scoreField]}</span>
                        <span className="text-orange-200 font-bold text-[10px] md:text-xs text-center mt-1">מקום {podiumThird.displayRank}</span>
                        
                        {getPrizeForRank(podiumThird, activeBoard, currentUsers) ? (
                          <div className="mt-2 bg-orange-950/30 px-2.5 py-1 rounded-full border border-orange-950/40 flex items-center gap-1.5 shadow-sm">
                            <span className="text-[10px]">💰</span>
                            <span className="text-xs font-black text-orange-100">{getPrizeForRank(podiumThird, activeBoard, currentUsers)} ₪</span>
                          </div>
                        ) : null}
                     </div>
                   </div>
                 </div>
               )}
             </div>
           )}

           {teaser && (
             <div className="mb-6 mx-4 md:mx-8 bg-slate-900/60 backdrop-blur-md border border-blue-500/30 p-3 md:p-4 rounded-2xl shadow-inner flex items-center gap-3 md:gap-4 relative z-10 transition-all">
               <div className="text-2xl md:text-3xl shrink-0 animate-pulse drop-shadow-md">🎙️</div>
               <div>
                 <span className="text-[10px] md:text-xs font-bold text-blue-400 uppercase tracking-wider block mb-0.5">עמדת השידור</span>
                 <p className="text-slate-200 text-xs md:text-sm font-medium leading-snug">"{teaser}"</p>
               </div>
             </div>
           )}

           <div className="overflow-x-auto relative z-10 bg-slate-900/50 rounded-t-2xl border-t border-slate-700/50 pb-48 transform-gpu">
             <table className="w-full text-right table-fixed">
               <thead>
                 <tr className="text-slate-400 border-b border-slate-700/50 bg-slate-800/80 text-sm md:text-base">
                   <th className="p-3 md:p-4 font-medium w-16 md:w-20 text-center">מיקום</th>
                   <th className="p-3 md:p-4 font-medium">שחקן</th>
                   <th className={`p-3 md:p-4 font-medium text-center w-28 md:w-32 ${activeBoard === "GENERAL" || activeBoard === "LEAGUES" ? "text-amber-400" : "text-emerald-400"}`}>נק'</th>
                   <th className="p-3 md:p-4 font-medium text-center w-14 md:w-16">פירוט</th>
                 </tr>
               </thead>
               <tbody>
                 {currentUsers.map((u) => {
                   const isTop3 = u.displayRank <= 3;
                   const isMe = u.id === currentUserId;
                   const isNemesis = u.id === myNemesisId;
                   const userPrize = activeBoard !== "LEAGUES" ? getPrizeForRank(u, activeBoard, currentUsers) : null;
                   const rowBg = isMe ? "bg-blue-900/20 border-blue-500/50 shadow-inner" : 
                                 isNemesis ? "bg-rose-900/10 border-rose-500/40 shadow-[inset_0_0_15px_rgba(225,29,72,0.1)] relative z-10" :
                                 u.displayRank === 1 ? "bg-amber-500/10 border-amber-500/30" : 
                                 u.displayRank === 2 ? "bg-slate-300/10 border-slate-300/30" : 
                                 u.displayRank === 3 ? "bg-orange-700/10 border-orange-700/30" : "hover:bg-slate-700/30";
                   
                   const scoreToShow = u[scoreField];
                   const prevR = activeBoard === "GENERAL" ? u.previousRankGeneral : (activeBoard === "KNOCKOUT" ? u.previousRankKnockout : null);
                   const trend = prevR ? (prevR - u.displayRank) : 0;
                   
                   return (
                     <tr key={u.id} ref={isMe ? myRowRef : null} className={`border-b border-slate-700/50 transition-colors ${rowBg}`}>
                       <td className="p-3 md:p-4 text-center">
                         <div className="flex justify-center items-center gap-1.5 md:gap-2">
                            <div className="flex flex-col items-center">
                              <span className={`text-xl md:text-2xl font-black ${
                                u.displayRank === 1 ? "text-amber-400" : 
                                u.displayRank === 2 ? "text-slate-300" : 
                                u.displayRank === 3 ? "text-orange-400" : 
                                "text-slate-400"
                              }`}>
                                {u.displayRank}
                              </span>
                              {trend > 0 && <span className="text-emerald-400 text-[11px] font-black tracking-tighter mt-[-2px] flex items-center" title={`עלה ${trend} מקומות`}>▲ {trend}</span>}
                              {trend < 0 && <span className="text-rose-400 text-[11px] font-black tracking-tighter mt-[-2px] flex items-center" title={`ירד ${Math.abs(trend)} מקומות`}>▼ {Math.abs(trend)}</span>}
                              {trend === 0 && prevR && <span className="text-slate-600 text-[11px] font-black mt-[-2px] block">-</span>}
                            </div>
                         </div>
                       </td>
                       
                      <td className="p-3 md:p-4">
                         <div className="font-bold text-white text-sm md:text-base block">
                             <span className="truncate max-w-[150px] sm:max-w-[200px] block">{u.name || "שחקן לא ידוע"}</span>
                         </div>
                        <div className="flex items-center gap-2 mt-1">
                        {isMe && <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 shadow-sm">אתה</span>}
                        {isNemesis && <span className="bg-rose-600/20 border border-rose-500/50 text-rose-400 text-[9px] px-1.5 py-0.5 rounded tracking-wider shrink-0 flex items-center gap-1 shadow-sm" title="היריב המושבע שלך!"><span>🎯</span> יריב</span>}
                         {!u.hasPaid && <span className="text-[10px] text-rose-400">טרם שולם</span>}
                         
                         {/* 👇 תגית כסף פרימיום חדשה (בצבע זהב-ענבר עם אייקון שטרות) */}
                         {userPrize ? (
                           <span className="bg-[#EAB308]/10 border border-[#EAB308]/30 text-[#EAB308] text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-inner font-black">
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                               <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75m0 11.25v.75m0-12V18m0-12V4.5m0 0A2.25 2.25 0 016 2.25h13.5a2.25 2.25 0 012.25 2.25v13.5a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V4.5m0 0h16.5m-16.5 0V18m0 0H6m0 0l-1.5.75c.191.134.39.26.598.376.81.44 1.77.674 2.802.674 1.033 0 1.993-.233 2.803-.674.207-.116.406-.242.597-.376L9 18h-.3c-1.2 0-2.316-.328-3.266-.889l-.234-.111zM11.25 9.75v1.5m0 0v1.5m0-1.5h1.5m-1.5 0h-1.5" />
                             </svg>
                             {userPrize} ₪
                           </span>
                         ) : null}
                         {/* 👆 סוף התגית */}

                        </div>
                      </td>
                       <td className={`p-3 md:p-4 text-center font-black text-lg md:text-xl ${isTop3 ? (activeBoard === "GENERAL" || activeBoard === "LEAGUES" ? "text-amber-400" : "text-emerald-400") : "text-slate-200"}`}>
                         <div 
                           className="inline-flex items-center justify-center gap-1.5 cursor-help relative group" 
                           onMouseEnter={() => setHoveredUser(u.id)} 
                           onMouseLeave={() => setHoveredUser(null)} 
                           onClick={() => setHoveredUser(hoveredUser === u.id ? null : u.id)}
                         >
                           <span>{scoreToShow || 0}</span>
                           <span className="text-[10px] text-slate-500 group-hover:text-blue-400 transition-colors hidden sm:inline-block">ℹ️</span>
                           
                           {/* הפופ-אפ עכשיו מרונדר רק מתי שצריך! זה יציל את הרינדור במובייל */}
                           {hoveredUser === u.id && (
                             <div className="absolute top-full left-[10px] sm:left-1/2 sm:-translate-x-1/2 mt-3 w-56 bg-slate-900 border border-slate-600 p-4 rounded-2xl shadow-2xl z-50 origin-top animate-fade-in-up">
                                <div className="absolute bottom-full left-[40px] sm:left-1/2 sm:-translate-x-1/2 -mb-[1px] border-[6px] border-transparent border-b-slate-600"></div>
                                <div className="absolute bottom-full left-[40px] sm:left-1/2 sm:-translate-x-1/2 -mb-[2px] border-[5px] border-transparent border-b-slate-900"></div>
                                
                                <div className="text-xs font-black text-slate-300 border-b border-slate-700/50 pb-2 mb-3 text-center tracking-wide">פילוח נקודות</div>
                                
                                {u.breakdown ? (
                                  <div className="space-y-2.5 text-[11px] font-medium">
                                    <div className="flex justify-between items-center"><span className="text-slate-400">⚽ משחקים:</span><span className="font-black text-white bg-slate-800 px-2 py-0.5 rounded">{u.breakdown.matches || 0}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-slate-400">🎁 בונוסים:</span><span className="font-black text-white bg-slate-800 px-2 py-0.5 rounded">{u.breakdown.bonuses || 0}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-slate-400">🥇 עולות מבתים:</span><span className="font-black text-white bg-slate-800 px-2 py-0.5 rounded">{u.breakdown.groups || 0}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-slate-400">🥉 8 המעפילות:</span><span className="font-black text-white bg-slate-800 px-2 py-0.5 rounded">{u.breakdown.thirdPlace || 0}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-slate-400">🔥 נוק-אאוט:</span><span className="font-black text-white bg-slate-800 px-2 py-0.5 rounded">{u.breakdown.knockout || 0}</span></div>
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-slate-400 text-center py-2 leading-relaxed">הפילוח המלא יוצג לאחר חישוב הנקודות הבא באדמין ⏳</div>
                                )}
                             </div>
                           )}
                         </div>
                       </td>
                       <td className="p-3 md:p-4 text-center">
                         <button onClick={() => handleOpenSpy(u)} className="w-8 h-8 md:w-10 md:h-10 mx-auto rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center hover:bg-blue-600/20 hover:border-blue-400 hover:text-blue-400 transition-all text-slate-300 shadow-sm" title="הרכב ניקוד">👁️</button>
                       </td>
                     </tr>
                   );
                 })}
                 {currentUsers.length === 0 && (<tr><td colSpan={4} className="text-center p-8 text-slate-500">עדיין אין נתונים בטבלה.</td></tr>)}
               </tbody>
             </table>
           </div>
         </div>
      )}

      {!isMyRowVisible && me && !spyModalUser && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t-2 border-blue-500 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] pb-4 pt-3 md:py-4 animate-fade-in-up">
          <div className="max-w-4xl mx-auto flex justify-between items-center px-4 md:px-8">
             <div className="flex items-center gap-3 md:gap-4">
                <div className="flex flex-col items-center justify-center bg-slate-800 w-11 h-11 md:w-14 md:h-14 rounded-xl border border-slate-600 shadow-inner">
                   <span className="font-black text-slate-300 text-xl md:text-2xl">{me.displayRank}</span>
                </div>
                <div className="flex flex-col">
                   <div className="font-bold text-white text-base md:text-lg flex items-center gap-2">
                     <span>{me.name?.split(" ")[0]}</span>
                     <span className="bg-blue-600 text-white text-[9px] md:text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider">אתה</span>
                   </div>
                   
                   <div className="flex items-center gap-3">
                       {pointsGap === 0 ? (
                          <div className="text-[10px] md:text-[11px] text-amber-400 font-bold mt-0.5">👑 הפסגה כולה שלך!</div>
                       ) : (
                          <div className="text-[10px] md:text-[11px] text-blue-400 font-bold mt-0.5">פער לפסגה: <span className="font-black" dir="ltr">-{pointsGap}</span></div>
                       )}
                       
                       {nemesisUser && nemesisGap !== null && (
                          <>
                             <span className="text-slate-600 text-[10px] hidden md:inline-block">|</span>
                             <div className={`text-[10px] md:text-[11px] font-bold mt-0.5 ${nemesisGap >= 0 ? 'text-emerald-400' : 'text-rose-400'} hidden md:block`}>
                                🎯 מול {nemesisUser.name?.split(" ")[0]}: <span className="font-black" dir="ltr">{nemesisGap > 0 ? `+${nemesisGap}` : nemesisGap}</span>
                             </div>
                          </>
                       )}
                   </div>
                </div>
             </div>
             
             <div className="flex items-center gap-4 md:gap-6">
                <div className={`font-black text-2xl md:text-3xl ${activeBoard === "GENERAL" || activeBoard === "LEAGUES" ? "text-amber-400" : "text-emerald-400"} drop-shadow-md`}>
                  {myScore}
                </div>
                <button onClick={() => handleOpenSpy(me)} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center hover:bg-blue-600/20 hover:border-blue-400 transition-all text-slate-300 shadow-sm" title="הניחושים שלי">👁️</button>
             </div>
          </div>
        </div>
      )}

      {spyModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 md:p-4 backdrop-blur-sm" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 p-4 md:p-6 rounded-3xl w-full max-w-xl md:max-w-[800px] md:min-w-[500px] max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden">
            
            <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-800 shrink-0">
              <div>
                <h3 className="text-2xl font-black text-white flex items-center gap-2"><span>🕵️‍♂️</span> חקירת משתמש: <span className="text-blue-400">{spyModalUser.name}</span></h3>
                <p className="text-slate-400 text-sm mt-1">מוצגים רק נתונים שכבר ננעלו לעריכה.</p>
              </div>
              <button onClick={() => setSpyModalUser(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-300 transition-colors font-bold shrink-0 text-lg">✕</button>
            </div>

            <div className="flex flex-wrap gap-2 mb-6 bg-slate-800 p-2 rounded-xl border border-slate-700/50 shrink-0">
               <button onClick={() => setSpyTab("STATS")} className={`flex-1 min-w-[80px] py-2 rounded-lg font-bold text-sm transition-all ${spyTab === "STATS" ? "bg-amber-500 text-slate-900 shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-700"}`}>📊 נתונים</button>
               <button onClick={() => setSpyTab("MATCHES")} className={`flex-1 min-w-[80px] py-2 rounded-lg font-bold text-sm transition-all ${spyTab === "MATCHES" ? "bg-blue-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-700"}`}>⚽ משחקים</button>
               <button onClick={() => setSpyTab("QUALIFIERS")} className={`flex-1 min-w-[80px] py-2 rounded-lg font-bold text-sm transition-all ${spyTab === "QUALIFIERS" ? "bg-purple-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-700"}`}>🥇 עולות</button>
               <button onClick={() => setSpyTab("BONUS")} className={`flex-1 min-w-[80px] py-2 rounded-lg font-bold text-sm transition-all ${spyTab === "BONUS" ? "bg-emerald-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-700"}`}>⭐ בונוס</button>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 pr-2 pb-2">
              {isLoadingSpy ? (
                <div className="flex justify-center py-12 text-blue-400 animate-pulse font-bold text-lg">שואב נתונים מסווגים... ⏳</div>
              ) : spyTab === "STATS" ? (
                <div className="space-y-3 pb-4">
                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl bg-emerald-900/30 p-2 rounded-lg border border-emerald-500/20">🎯</div>
                      <div>
                        <div className="text-slate-200 font-bold">פגיעה בול בתוצאה</div>
                        <div className="text-xs text-slate-500 mt-0.5">{spyStats.exactC} משחקים מדויקים</div>
                      </div>
                    </div>
                    <div className="font-black text-xl text-emerald-400">+{spyStats.exactP}</div>
                  </div>

                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl bg-blue-900/30 p-2 rounded-lg border border-blue-500/20">✅</div>
                      <div>
                        <div className="text-slate-200 font-bold">ניחוש כיוון נכון</div>
                        <div className="text-xs text-slate-500 mt-0.5">{spyStats.dirC} משחקים (ללא בול)</div>
                      </div>
                    </div>
                    <div className="font-black text-xl text-blue-400">+{spyStats.dirP}</div>
                  </div>

                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl bg-amber-900/30 p-2 rounded-lg border border-amber-500/20">🎁</div>
                      <div>
                        <div className="text-slate-200 font-bold">שאלות בונוס</div>
                        <div className="text-xs text-slate-500 mt-0.5">{spyStats.bonusC} תשובות נכונות</div>
                      </div>
                    </div>
                    <div className="font-black text-xl text-amber-400">+{spyStats.bonusP}</div>
                  </div>

                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl bg-purple-900/30 p-2 rounded-lg border border-purple-500/20">🥇</div>
                      <div>
                        <div className="text-slate-200 font-bold">עולות מהבתים</div>
                        <div className="text-xs text-slate-500 mt-0.5">{spyStats.groupC} בחירות מוצלחות</div>
                      </div>
                    </div>
                    <div className="font-black text-xl text-purple-400">+{spyStats.groupP}</div>
                  </div>

                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl bg-orange-900/30 p-2 rounded-lg border border-orange-500/20">🥉</div>
                      <div>
                        <div className="text-slate-200 font-bold">8 המעפילות (מקום 3)</div>
                        <div className="text-xs text-slate-500 mt-0.5">{spyStats.thirdC} מתוך הרשימה</div>
                      </div>
                    </div>
                    <div className="font-black text-xl text-orange-400">+{spyStats.thirdP}</div>
                  </div>

                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl bg-rose-900/30 p-2 rounded-lg border border-rose-500/20">🔥</div>
                      <div>
                        <div className="text-slate-200 font-bold">עולות בנוק-אאוט</div>
                        <div className="text-xs text-slate-500 mt-0.5">{spyStats.koC} נבחרות צלחו שלב</div>
                      </div>
                    </div>
                    <div className="font-black text-xl text-rose-400">+{spyStats.koP}</div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t-2 border-slate-700 border-dashed flex justify-between items-center px-2">
                     <span className="text-slate-400 font-bold">סך הכל נקודות מוכחות:</span>
                     <span className="text-2xl font-black text-white">
                        {spyStats.exactP + spyStats.dirP + spyStats.bonusP + spyStats.groupP + spyStats.thirdP + spyStats.koP}
                     </span>
                  </div>
                </div>
              ) : spyTab === "MATCHES" ? (
                spyPredictions.length === 0 ? (
                  <div className="text-center text-slate-400 py-12 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-lg">אין ניחושי משחקים נעולים.</div>
                ) : (
                  <div className="flex flex-col h-full">
                    <div className="flex overflow-x-auto gap-2 mb-4 pb-2 custom-scrollbar shrink-0 border-b border-slate-800">
                       {[
                          { id: "MD1", label: "מחזור 1", minState: 1 },
                          { id: "MD2", label: "מחזור 2", minState: 2 },
                          { id: "MD3", label: "מחזור 3", minState: 3 },
                          { id: "R32", label: "32 הגדולות", minState: 5 },
                          { id: "R16", label: "שמינית גמר", minState: 7 },
                          { id: "QF", label: "רבע גמר", minState: 9 },
                          { id: "SF", label: "חצי גמר", minState: 11 },
                          { id: "FINAL", label: "גמר", minState: 13 }
                        ].filter(t => tournamentState >= t.minState).map(tab => (
                         <button
                            key={tab.id}
                            onClick={() => setSpyMatchTab(tab.id)}
                            className={`px-4 py-2 rounded-xl font-bold whitespace-nowrap text-xs transition-all ${
                              spyMatchTab === tab.id
                                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                : "bg-slate-900 border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white"
                            }`}
                         >
                            {tab.label}
                         </button>
                       ))}
                    </div>

                    <div className="space-y-3">
                      {getFilteredSpyMatches().length === 0 ? (
                        <div className="text-center text-slate-500 py-8 bg-slate-800/30 rounded-xl border border-slate-700/50 font-bold">
                          לא מולאו ניחושים לסיבוב זה.
                        </div>
                      ) : (
                        getFilteredSpyMatches().map((pred, idx) => {
                          const match = pred.matchInfo; const isKnockout = match.stage === "KNOCKOUT";
                          return (
                            <div key={idx} className="px-3 py-3 rounded-xl border bg-slate-800 border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
                              <div className="flex items-center justify-between md:justify-start gap-3 w-full md:w-auto shrink-0">
                                <span className="text-[10px] font-bold text-blue-300 bg-blue-900/20 px-2 py-1 rounded tracking-wider uppercase border border-blue-500/20">
                                   {isKnockout ? match.roundName : `בית ${match.group}`}
                                </span>
                                <div className="md:hidden">{getPointsBadge(pred.points)}</div>
                              </div>
                              
                              <div className="flex items-center justify-center gap-3 flex-1 px-2">
                                 <div className="flex items-center gap-2 flex-1 justify-end">
                                   <span className="text-sm font-bold text-slate-200 truncate max-w-[90px]">{match.homeTeam}</span>
                                   {getFlagUrl(match.homeTeam) && <img src={getFlagUrl(match.homeTeam)!} className="w-5 h-3.5 object-cover rounded-sm shadow-sm" alt="flag" />}
                                   <span className="text-lg font-black text-white bg-slate-950 border border-slate-700 w-9 h-9 flex items-center justify-center rounded-lg shadow-inner shrink-0">{pred.predictedHomeScore}</span>
                                 </div>
                                 <span className="text-slate-600 font-black text-sm shrink-0">:</span>
                                 <div className="flex items-center gap-2 flex-1 justify-start">
                                   <span className="text-lg font-black text-white bg-slate-950 border border-slate-700 w-9 h-9 flex items-center justify-center rounded-lg shadow-inner shrink-0">{pred.predictedAwayScore}</span>
                                   {getFlagUrl(match.awayTeam) && <img src={getFlagUrl(match.awayTeam)!} className="w-5 h-3.5 object-cover rounded-sm shadow-sm" alt="flag" />}
                                   <span className="text-sm font-bold text-slate-200 truncate max-w-[90px]">{match.awayTeam}</span>
                                 </div>
                              </div>
                              
                              <div className="hidden md:flex shrink-0 w-auto min-w-[80px] justify-end">
                                {getPointsBadge(pred.points)}
                              </div>
                              
                              {isKnockout && pred.qualifier && (
                                 <div className="w-full md:w-auto text-center mt-2 md:mt-0 shrink-0">
                                    <span className="text-[10px] bg-purple-500/10 text-purple-300 px-2 py-1 rounded border border-purple-500/20 font-bold uppercase tracking-wide inline-flex items-center justify-center gap-1.5 w-full md:w-auto">
                                      הימר שיעפילו: 
                                      {getFlagUrl(pred.qualifier) && <img src={getFlagUrl(pred.qualifier)!} className="w-4 h-3 object-cover rounded-sm shadow-sm" alt="flag" />}
                                      {pred.qualifier}
                                    </span>
                                 </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )
              ) : spyTab === "QUALIFIERS" ? (
                 tournamentState < 1 ? (
                   <div className="text-center text-slate-400 py-12 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-lg">עולות טרם ננעלו (מצב 0).</div>
                 ) : (
                   <div className="space-y-6 pb-4">
                     <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
                       <h4 className="text-sm md:text-base font-bold text-amber-400 mb-3 border-b border-slate-700/50 pb-2">🥉 8 המעפילות (מקום שלישי)</h4>
                       {spyThirdPlace.length === 0 ? <div className="text-slate-500 text-sm mb-2">לא בחר נבחרות.</div> : (
                         <div className="flex flex-nowrap overflow-x-auto custom-scrollbar pb-2 gap-2">
                           {spyThirdPlace.map((t, i) => {
                             if (!t) return null;
                             const pts = getThirdPlacePoints(t);
                             return (
                               <div key={i} className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${pts === 10 ? "bg-emerald-900/20 text-emerald-400 border-emerald-500/30" : pts === 0 ? "bg-rose-900/20 text-rose-400 border-rose-500/30" : "bg-slate-900 text-slate-300 border-slate-600"}`}>
                                 {getFlagUrl(t) && <img src={getFlagUrl(t)!} className="w-4 h-3 object-cover rounded-sm" alt="flag"/>}
                                 {t} {pts === 10 && "✓"} {pts === 0 && "✕"}
                               </div>
                             );
                           })}
                         </div>
                       )}
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                       {groupsList.map(g => {
                         const preds = spyQualifiers[g];
                         if (!preds || (!preds.first && !preds.second)) return null;
                         const p1Pts = getGroupQualPoints(g, 'first', preds.first);
                         const p2Pts = getGroupQualPoints(g, 'second', preds.second);

                         return (
                           <div key={g} className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex flex-col sm:flex-row sm:items-center gap-3">
                             <div className="text-blue-300 font-bold bg-blue-900/20 px-3 py-1.5 rounded-lg text-xs shrink-0 border border-blue-500/20 text-center sm:w-16">בית {g}</div>
                             <div className="flex-1 flex flex-col gap-2">
                               <div className="flex justify-between items-center bg-slate-900 p-2 rounded-lg border border-slate-700/50">
                                 <div className="flex items-center gap-2">
                                   <span className="text-slate-500 text-[10px] font-bold">1️⃣</span>
                                   {getFlagUrl(preds.first) && <img src={getFlagUrl(preds.first)!} className="w-4 h-3 object-cover rounded-sm" alt="flag"/>}
                                   <span className="font-bold text-slate-200 text-xs">{preds.first || "-"}</span>
                                 </div>
                                 {getPointsBadge(p1Pts)}
                               </div>
                               <div className="flex justify-between items-center bg-slate-900 p-2 rounded-lg border border-slate-700/50">
                                 <div className="flex items-center gap-2">
                                   <span className="text-slate-500 text-[10px] font-bold">2️⃣</span>
                                   {getFlagUrl(preds.second) && <img src={getFlagUrl(preds.second)!} className="w-4 h-3 object-cover rounded-sm" alt="flag"/>}
                                   <span className="font-bold text-slate-200 text-xs">{preds.second || "-"}</span>
                                 </div>
                                 {getPointsBadge(p2Pts)}
                               </div>
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 )
              ) : (
                spyBonusPredictions.length === 0 ? (
                  <div className="text-center text-slate-400 py-12 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-lg">אין ניחושי בונוס נעולים.</div>
                ) : (
                  <div className="flex flex-col h-full">
                    <div className="flex overflow-x-auto gap-2 mb-4 pb-2 custom-scrollbar shrink-0 border-b border-slate-800">
                      {[
                        { id: "TOURNAMENT", label: "🏆 טורניר" },
                        { id: "GROUPS", label: "⚽ שלב הבתים" },
                        ...(tournamentState >= 4 ? [{ id: "KNOCKOUT", label: "🔥 נוק-אאוט" }] : [])
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => {
                            setSpyBonusCategory(tab.id);
                            if (tab.id === "KNOCKOUT") {
                              const available = [
                                { id: "ALL", label: "כללי", minState: 0 },
                                { id: "32 הגדולות", label: "32 הגדולות", minState: 5 },
                                { id: "שמינית גמר", label: "שמינית גמר", minState: 7 },
                                { id: "רבע גמר", label: "רבע גמר", minState: 9 },
                                { id: "חצי גמר", label: "חצי גמר", minState: 11 },
                                { id: "גמר", label: "גמר", minState: 13 }
                              ].filter(t => tournamentState >= t.minState);
                              if (available.length > 0) setSpyBonusKnockoutRound(available[available.length - 1].id);
                            }
                          }}
                          className={`px-4 py-2 rounded-xl font-bold whitespace-nowrap text-xs transition-all ${
                            spyBonusCategory === tab.id
                              ? "bg-amber-500 text-slate-900 shadow-md"
                              : "bg-slate-900 border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-amber-400"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {spyBonusCategory === "KNOCKOUT" && (
                      <div className="flex overflow-x-auto gap-2 mb-4 pb-2 custom-scrollbar bg-slate-900/50 p-2 rounded-2xl border border-slate-800/50 shrink-0">
                        {[
                          { id: "ALL", label: "כללי", minState: 0 },
                          { id: "32 הגדולות", label: "32 הגדולות", minState: 5 },
                          { id: "שמינית גמר", label: "שמינית גמר", minState: 7 },
                          { id: "רבע גמר", label: "רבע גמר", minState: 9 },
                          { id: "חצי גמר", label: "חצי גמר", minState: 11 },
                          { id: "גמר", label: "גמר", minState: 13 }
                        ].filter(t => tournamentState >= t.minState).map(subTab => (
                          <button
                            key={subTab.id}
                            onClick={() => setSpyBonusKnockoutRound(subTab.id)}
                            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all text-xs border ${
                              spyBonusKnockoutRound === subTab.id
                                ? "bg-purple-600 text-white border-purple-500 shadow-md"
                                : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white"
                            }`}
                          >
                            {subTab.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="space-y-3">
                      {getFilteredSpyBonuses().length === 0 ? (
                        <div className="text-center text-slate-500 py-8 bg-slate-800/30 rounded-xl border border-slate-700/50 font-bold">
                          אין שאלות בונוס (או שלא מולאו) בקטגוריה זו.
                        </div>
                      ) : (
                        getFilteredSpyBonuses().map((bPred, idx) => (
                          <div key={idx} className="bg-slate-800 px-4 py-3 rounded-xl border border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                             <div className="flex-1">
                               <div className="text-amber-400 font-bold text-xs md:text-sm leading-snug mb-1.5">{bPred.question.label}</div>
                               <div className="flex items-center gap-2 text-xs">
                                 <span className="text-slate-400">ניחוש:</span>
                                 <span className="bg-slate-900 text-slate-200 font-bold px-2 py-1 rounded-md border border-slate-600 flex items-center gap-1.5">
                                   {getFlagUrl(bPred.answer) && <img src={getFlagUrl(bPred.answer)!} className="w-4 h-3 object-cover rounded-sm" alt="flag" />}
                                   {bPred.answer}
                                 </span>
                               </div>
                             </div>
                             
                             <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto border-t border-slate-700/50 pt-2 md:border-t-0 md:pt-0">
                               {realBonusAnswers[bPred.qId] && (
                                 <div className="bg-emerald-900/10 px-2 py-1 rounded-md border border-emerald-500/20 flex items-center gap-1.5 text-[10px]">
                                   <span className="text-emerald-400">אמת:</span>
                                   <span className="text-emerald-400 font-bold flex items-center gap-1">
                                     {Array.isArray(realBonusAnswers[bPred.qId]) 
                                        ? realBonusAnswers[bPred.qId].map((ans: string, i: number, arr: any[]) => (
                                            <span key={i} className="flex items-center gap-1">
                                              {getFlagUrl(ans) && <img src={getFlagUrl(ans)!} className="w-3 h-2 object-cover rounded-sm" alt="flag" />}
                                              {ans}{i < arr.length - 1 ? " / " : ""}
                                            </span>
                                          ))
                                        : (
                                          <span className="flex items-center gap-1">
                                            {getFlagUrl(realBonusAnswers[bPred.qId]) && <img src={getFlagUrl(realBonusAnswers[bPred.qId])!} className="w-3 h-2 object-cover rounded-sm" alt="flag" />}
                                            {realBonusAnswers[bPred.qId]}
                                          </span>
                                        )
                                     }
                                   </span>
                                 </div>
                               )}
                               <div className="shrink-0 w-auto min-w-[80px] text-left">{getPointsBadge(bPred.points)}</div>
                             </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}