"use client";
import { useState, useEffect, useRef } from "react";
import { doc, getDoc, collection, onSnapshot, getDocs, query, where, updateDoc } from "firebase/firestore";
import { db } from "../app/firebase";
import { getFlagUrl } from "../app/utils/flags"; 
import toast from "react-hot-toast";
import Link from "next/link";
import { getPlayerInfo, PLAYERS_DATA } from "../app/utils/players";
import FinalePodiumModal from "./FinalePodiumModal"; 
import WrappedModal from "./WrappedModal";

const MASCOTS = [
  { id: "trump", name: "דונלד", image: "/donaldIcon.png", quotes: ["ניחוש ענק. כולם אומרים שזה הניחוש הכי טוב שהם ראו. פייק ניוז מי שאומר אחרת!", "אנחנו נבנה פער ענק בטבלה, והחברים ישלמו על זה יהיה מאוד נייס!", "המונדיאל באמריקה יהיה הכי huge אי פעם. נקודה. גם הניקוד שלך בסדר.", "אני ניצחתי בטבלת הגילוי הנאות, כולם יודעים את זה. גנבו לי נקודות!"] },
  { id: "mexican", name: "חואן", image: "/maxicanIcon.png", quotes: ["איי קראמבה! איזה ניחוש חריף הבאת פה אמיגו! 🌶️", "ואמוס! תביא ירוק במטריצה ויוצאים לפיאסטה עד הבוקר! 🪅", "הכדורגל שלנו במקסיקו הכי שמח, אבל הניחושים שלך... איי איי איי.", "אל תהיה לוקו, תבדוק טוב טוב את הפצועים לפני שאתה שם תוצאה."] },
  { id: "canadian", name: "בוב", image: "/candianIcon.png", quotes: ["סליחה שאני מפריע, אה, אבל נראה לי שהניחוש שלך קצת קפוא. 🍁", "קח קפה, שים סירופ מייפל ובוא נראה קצת סוקר, אה? ☕", "הוקי קרח זה הספורט האמיתי, אבל מונדיאל בקנדה זה גם נחמד, סליחה על ההתלהבות.", "אל תשכח להיות מנומס ליריב שלך כשתעקוף אותו בטבלה, אה?"] }
];

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

const isMatchInCurrentActivePhase = (m: any, state: number) => {
  const s = Number(state) || 0;
  if (m.stage !== "KNOCKOUT") {
     const md = Number(m.matchday) || 1;
     if (s === 0 && md === 1) return true;
     if (s === 1 && md === 2) return true;
     if (s === 2 && md === 3) return true;
     return false;
  } else {
     if (s === 4 && m.roundName === "32 הגדולות") return true;
     if (s === 6 && m.roundName === "שמינית גמר") return true;
     if (s === 8 && m.roundName === "רבע גמר") return true;
     if (s === 10 && m.roundName === "חצי גמר") return true;
     if (s === 12 && (m.roundName === "גמר" || m.roundName === "מקום שלישי")) return true;
     return false;
  }
};

const getPhaseName = (state: number) => {
  const s = Number(state) || 0;
  switch(s) {
    case 0: return "מחזור 1";
    case 1: return "מחזור 2";
    case 2: return "מחזור 3";
    case 4: return "32 הגדולות";
    case 6: return "שמינית הגמר";
    case 8: return "רבע הגמר";
    case 10: return "חצי הגמר";
    case 12: return "משחקי הגמר";
    default: return "השלב הנוכחי";
  }
};

export default function Dashboard({ userId, userName, setActiveTab, setPredictionTab, tournamentState: initialTournamentState }: any) {
  const [userStats, setUserStats] = useState<any>({ points: 0, rank: 0, koPoints: 0, koRank: 0, hasPaid: false, prevPoints: 0, prevRank: 0, prevKoRank: 0, nemesisId: null });
  const [leaderboardInfo, setLeaderboardInfo] = useState({ totalUsers: 0 });
  const [dailyMessage, setDailyMessage] = useState("");
  const [dailyMediaUrl, setDailyMediaUrl] = useState("");
  const [dailySubtext, setDailySubtext] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [allUsersList, setAllUsersList] = useState<any[]>([]);
  const [nemesisData, setNemesisData] = useState<any>(null);
  const [nemesisInput, setNemesisInput] = useState<string>("");
  const [isSavingNemesis, setIsSavingNemesis] = useState(false);
  const [myLeagues, setMyLeagues] = useState<any[]>([]);
  const [timelineTab, setTimelineTab] = useState<"TODAY" | "YESTERDAY">("TODAY");
  const [pointsFeed, setPointsFeed] = useState<any[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [showFullHistory, setShowFullHistory] = useState(false);
  
  const [missingTasksList, setMissingTasksList] = useState<any[]>([]);
  const [activeDeadlineTime, setActiveDeadlineTime] = useState<number | null>(null);
  
  const [todayTargets, setTodayTargets] = useState<any[]>([]);
  const [todayMatches, setTodayMatches] = useState<any[]>([]);
  const [activeBannerMode, setActiveBannerMode] = useState<"MATCHES" | "BONUS" | "RADAR">("MATCHES");
  const [todayMatchIndex, setTodayMatchIndex] = useState(0);
  const [todayBonusIndex, setTodayBonusIndex] = useState(0);
  const [spyModalMatch, setSpyModalMatch] = useState<any | null>(null);
  const [spyData, setSpyData] = useState<any[]>([]);
  const [isLoadingSpy, setIsLoadingSpy] = useState(false);
  const [spySearchQuery, setSpySearchQuery] = useState("");
  const [spyFilter, setSpyFilter] = useState<"ALL" | "EXACT" | "DIRECTION" | "MISS">("ALL");
  const [showMagazineModal, setShowMagazineModal] = useState(false);
  const [showRealStandingsModal, setShowRealStandingsModal] = useState(false);
  const [realBonusFull, setRealBonusFull] = useState<any>({ answers: {}, blacklist: {}, locked: {}, leading: {} });
  const [userBonusAnswersState, setUserBonusAnswersState] = useState<any>({});
  const [bonusQuestionsList, setBonusQuestionsList] = useState<any[]>([]);
  const [mascotQuote, setMascotQuote] = useState<{mascot: any, quote: string} | null>(null);
  const [showMascot, setShowMascot] = useState(false);
  const [prizes, setPrizes] = useState<any>(null);
  const [showPodiumState, setShowPodiumState] = useState(true);

  const [nowMs, setNowMs] = useState(Date.now());
  const [liveBonusQs, setLiveBonusQs] = useState<any[]>([]);
  const [liveBonusAns, setLiveBonusAns] = useState<any>({});
  const [activeSurpriseAlert, setActiveSurpriseAlert] = useState<number>(0);
  const [showWrappedModal, setShowWrappedModal] = useState(false);
  // הפיכת המנעול ל"חי" ומגיב בזמן אמת לשינויים באדמין
  const [tournamentState, setTournamentState] = useState(initialTournamentState || 0);

  useEffect(() => {
    const unsubSys = onSnapshot(doc(db, "settings", "system"), (docSnap) => {
      if (docSnap.exists()) {
        setTournamentState(Number(docSnap.data().tournamentState) || 0);
      }
    });
    return () => unsubSys();
  }, []);
  // הריפרנס שיעזור לנו למנוע מהטאבים לקפוץ כל 30 שניות
  const isBannerInit = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubDeadlines = onSnapshot(doc(db, "settings", "deadlines"), (snap) => {
      if (snap.exists() && snap.data().activeDeadline?.time) {
        setActiveDeadlineTime(parseDateTimeLocal(snap.data().activeDeadline.time)); 
      } else {
        setActiveDeadlineTime(null);
      }
    });
    return () => unsubDeadlines();
  }, []);

  useEffect(() => {
     const unsub1 = onSnapshot(doc(db, "settings", "bonus_questions"), (snap) => {
        if(snap.exists()) setLiveBonusQs(snap.data().questions || []);
     });
     return () => unsub1();
  }, []);

  useEffect(() => {
     if(!userId) return;
     const unsub2 = onSnapshot(doc(db, "predictions_bonus", userId), (snap) => {
        if(snap.exists()) setLiveBonusAns(snap.data().answers || {});
     });
     return () => unsub2();
  }, [userId]);

  useEffect(() => {
     let surpriseCount = 0;
     liveBonusQs.forEach((q: any) => {
        if (q.isSurprise && q.openTime && q.closeTime) {
           const openMs = parseDateTimeLocal(q.openTime);
           const closeMs = parseDateTimeLocal(q.closeTime);
           if (nowMs >= openMs && nowMs <= closeMs) {
              const ans = liveBonusAns[q.id];
              if (!ans || String(ans).trim() === "") surpriseCount++;
           }
        }
     });
     setActiveSurpriseAlert(surpriseCount);
  }, [liveBonusQs, liveBonusAns, nowMs]);

  const checkIsMatchLocked = (m: any, state: number) => {
    const s = Number(state) || 0;
    if (m.stage !== "KNOCKOUT") {
      const md = Number(m.matchday) || 1;
      return (md === 1 && s >= 1) || (md === 2 && s >= 2) || (md === 3 && s >= 3);
    } else {
      if (m.roundName === "32 הגדולות" && s >= 5) return true;
      if (m.roundName === "שמינית גמר" && s >= 7) return true;
      if (m.roundName === "רבע גמר" && s >= 9) return true;
      if (m.roundName === "חצי גמר" && s >= 11) return true;
      if (m.roundName === "גמר" || m.roundName === "מקום שלישי") return s >= 13;
      return false;
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
       const lastMascotTime = sessionStorage.getItem("lastMascotShowTime");
       const now = new Date().getTime();
       const cooldownMs = 15 * 60 * 1000; 
       if (!lastMascotTime || (now - Number(lastMascotTime) > cooldownMs)) {
           if (Math.random() < 0.3) { 
              const randomMascot = MASCOTS[Math.floor(Math.random() * MASCOTS.length)];
              const randomQuote = randomMascot.quotes[Math.floor(Math.random() * randomMascot.quotes.length)];
              setMascotQuote({ mascot: randomMascot, quote: randomQuote });
              setShowMascot(true);
              sessionStorage.setItem("lastMascotShowTime", now.toString());
              setTimeout(() => setShowMascot(false), 8000);
            }
       }
    }, 2000); 
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!userId) return;

    const unsubscribeUsers = onSnapshot(collection(db, "users"), (usersSnap) => {
      const allUsers: any[] = [];
      usersSnap.forEach(doc => allUsers.push({ id: doc.id, ...doc.data() }));
      
      allUsers.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
      let currRank = 1;
      allUsers.forEach((u, i) => {
         if (i > 0 && (u.totalPoints || 0) < (allUsers[i-1].totalPoints || 0)) currRank = i + 1;
         u.displayRank = currRank;
      });

      allUsers.sort((a, b) => (b.knockoutPoints || 0) - (a.knockoutPoints || 0));
      currRank = 1;
      allUsers.forEach((u, i) => {
         if (i > 0 && (u.knockoutPoints || 0) < (allUsers[i-1].knockoutPoints || 0)) currRank = i + 1;
         u.displayKoRank = currRank;
      });

      setAllUsersList(allUsers);
      
      const myData = allUsers.find(u => u.id === userId);
      if (myData) {
        setUserStats({
          points: myData.totalPoints || 0,
          rank: myData.displayRank || 0,
          koPoints: myData.knockoutPoints || 0,
          koRank: myData.displayKoRank || 0,
          hasPaid: myData.hasPaid || false,
          prevPoints: myData.previousTotalPoints ?? (myData.totalPoints || 0),
          prevRank: myData.previousRankGeneral ?? myData.displayRank,
          prevKoRank: myData.previousRankKnockout ?? myData.displayKoRank,
          nemesisId: myData.nemesisId || null
        });
        setLeaderboardInfo({ totalUsers: allUsers.length });

        if (myData.nemesisId) {
           const nData = allUsers.find(u => u.id === myData.nemesisId);
           setNemesisData(nData || null);
        } else {
           setNemesisData(null);
        }
      }
      setIsLoading(false);
    });

    const qLeagues = query(collection(db, "mini_leagues"), where("members", "array-contains", userId));
    const unsubscribeLeagues = onSnapshot(qLeagues, (snap) => {
        const leagues: any[] = [];
        snap.forEach(doc => leagues.push({ id: doc.id, ...doc.data() }));
        setMyLeagues(leagues);
    });

    const unsubscribeDash = onSnapshot(doc(db, "settings", "dashboard"), (dashSnap) => {
      if (dashSnap.exists()) {
        if (dashSnap.data().dailyMessage !== undefined) setDailyMessage(dashSnap.data().dailyMessage);
        if (dashSnap.data().dailyMediaUrl !== undefined) setDailyMediaUrl(dashSnap.data().dailyMediaUrl);
        if (dashSnap.data().dailySubtext !== undefined) setDailySubtext(dashSnap.data().dailySubtext);
      }
      
    });
    const unsubscribePrizes = onSnapshot(doc(db, "settings", "prizes"), (snap) => {
      if (snap.exists()) setPrizes(snap.data());
    });

    return () => {
       unsubscribeUsers();
       unsubscribeLeagues();
       unsubscribeDash();
    };
  }, [userId]);

  const handleSaveNemesis = async () => {
    if (!nemesisInput) return toast.error("יש לבחור יריב מהרשימה!");
    setIsSavingNemesis(true);
    try {
      await updateDoc(doc(db, "users", userId), { nemesisId: nemesisInput });
      toast.success("יריב נבחר בהצלחה! שיהיה קרב הוגן ⚔️");
    } catch (e) { toast.error("שגיאה בשמירת היריב."); } 
    finally { setIsSavingNemesis(false); }
  };

  const handleClearNemesis = () => {
  toast((t) => (
    <div className="flex flex-col gap-3 text-right" dir="rtl">
      <span className="font-bold text-slate-800">בטוח שאתה רוצה לבטל את היריבות?</span>
      <div className="flex gap-2">
        <button onClick={async () => {
          toast.dismiss(t.id);
          try {
            await updateDoc(doc(db, "users", userId), { nemesisId: null });
            setNemesisInput("");
            toast.success("היריבות בוטלה. שלום חברות!");
          } catch (e) { toast.error("שגיאה בביטול יריב."); }
        }} className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">כן, בטל</button>
        <button onClick={() => toast.dismiss(t.id)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">לא, התחרטתי</button>
      </div>
    </div>
  ), { duration: Infinity });
};

  useEffect(() => {
    if (!userId) return;
    
    const fetchFeedAndRadar = async () => {
      try {
        const feed: any[] = [];
        const parseDate = (str: string) => {
          if(!str || typeof str !== 'string') return 0;
          try {
             const parts = str.split(" ");
             const dParts = (parts[0] || "").split("/");
             const tParts = (parts[1] || "00:00").split(":");
             const day = dParts[0] || "1";
             const month = dParts[1] || "1";
             const year = dParts[2] || "2026";
             const h = tParts[0] || "0";
             const m = tParts[1] || "0";
             return new Date(Number(year), Number(month)-1, Number(day), Number(h), Number(m)).getTime();
          } catch { return 0; }
        };

        const mSnap = await getDocs(collection(db, "matches"));
        const matches = mSnap.docs.map(d=>({id: d.id, ...d.data()}));
        const rQualSnap = await getDoc(doc(db, "admin_results", "qualifiers")); const realQuals = rQualSnap.exists() ? rQualSnap.data().results : {};
        const rThirdSnap = await getDoc(doc(db, "admin_results", "third_place")); const realThird = rThirdSnap.exists() ? rThirdSnap.data().teams : [];
        
        const rBonusSnap = await getDoc(doc(db, "admin_results", "bonus"));
        const rBonusData = rBonusSnap.exists() ? rBonusSnap.data() : { answers: {}, blacklist: {}, locked: {}, leading: {} };
        const realBonusAnswers = rBonusData.answers || {};
        
        setRealBonusFull(rBonusData);

        const bqSnap = await getDoc(doc(db, "settings", "bonus_questions")); 
        const bonusQuestions = bqSnap.exists() ? bqSnap.data().questions : [];
        setBonusQuestionsList(bonusQuestions);

        const pbSnap = await getDoc(doc(db, "predictions_bonus", userId));
        const userBonusAnswers = pbSnap.exists() ? pbSnap.data().answers || {} : {};
        setUserBonusAnswersState(userBonusAnswers);

        const pmSnap = await getDocs(query(collection(db, "predictions_matches"), where("userId", "==", userId)));
        const pkSnap = await getDocs(query(collection(db, "predictions_knockout"), where("userId", "==", userId)));
        const userMatchPreds: any = {};
        pmSnap.forEach(d => { userMatchPreds[d.data().matchId] = d.data(); });
        pkSnap.forEach(d => { userMatchPreds[d.data().matchId] = d.data(); });

        const pqSnap = await getDoc(doc(db, "predictions_qualifiers", userId));
        const userQualsData = pqSnap.exists() ? pqSnap.data().groups || {} : {};

        const ptSnap = await getDoc(doc(db, "predictions_third_place", userId));
        const userThirdData = ptSnap.exists() ? ptSnap.data().teams || [] : [];

        const today = new Date();
        const targets: any[] = [];
        const tMatches: any[] = [];
        const todayTeams = new Set<string>();
        
        const currentMissingList: any[] = [];
        
        matches.forEach(m => {
           if (m.matchDate && typeof m.matchDate === 'string') {
              const parts = m.matchDate.split(" ");
              const d = parts[0] || "";
              const t = parts[1] || "";
              const dParts = d.split("/");
              if(dParts.length === 3) {
                 const [day, month, year] = dParts;
                 if (today.getDate() === Number(day) && today.getMonth() === Number(month) - 1 && today.getFullYear() === Number(year)) {
                    todayTeams.add(m.homeTeam);
                    todayTeams.add(m.awayTeam);
                    const pred = userMatchPreds[m.id];
                    tMatches.push({ ...m, time: t, userPrediction: pred || null });
                 }
              }
           }
           
           if (!m.isFinished && isMatchInCurrentActivePhase(m, tournamentState)) {
              const pred = userMatchPreds[m.id];
              if (!pred || pred.predictedHomeScore === "" || pred.predictedAwayScore === "" || (m.stage === "KNOCKOUT" && !pred.qualifier)) {
                 currentMissingList.push({
                    type: 'MATCH',
                    id: m.id,
                    title: `משחק: ${m.homeTeam} נגד ${m.awayTeam}`,
                    stage: m.stage,
                    matchday: m.matchday,
                    group: m.group,
                    tab: m.stage === "KNOCKOUT" ? "KNOCKOUT" : "MATCHES"
                 });
              }
           }
        });

        if (tournamentState === 0) {
           const uniqueGroups = Array.from(new Set(matches.filter(m => m.stage !== "KNOCKOUT").map(m => m.group))).filter(Boolean).sort();
           uniqueGroups.forEach(g => {
              const gPred = userQualsData[g as string];
              if (!gPred || !gPred.first || !gPred.second) {
                 currentMissingList.push({
                    type: 'QUALIFIER',
                    title: `עולות מבית ${g}`,
                    group: g,
                    tab: 'MATCHES',
                    subTab: 'QUALIFIERS'
                 });
              }
           });

           const validThird = userThirdData.filter((t: string) => t.trim() !== "");
           if (validThird.length < 8) {
              currentMissingList.push({
                 type: 'THIRD_PLACE',
                 title: `מעפילות ממקום 3 (${8 - validThird.length} חסרות)`,
                 tab: 'THIRD_PLACE'
              });
           }
        }

        const isQuestionLockedLocal = (q: any) => {
          if (rBonusData.locked?.[q.id]) return true;
          if (q.isSurprise) {
            if (!q.openTime || !q.closeTime) return false;
            const open = parseDateTimeLocal(q.openTime);
            const close = parseDateTimeLocal(q.closeTime);
            return nowMs < open || nowMs > close; 
          }
          const state = tournamentState;
          if (state === 0) return false;
          if (q.phase === "TOURNAMENT" || q.phase === "GROUPS") return state >= 1;
          if (q.phase === "KNOCKOUT") {
            if (!q.knockoutRound || q.knockoutRound === "" || q.knockoutRound === "ALL" || q.knockoutRound.includes("כללי") || q.knockoutRound === "32 הגדולות") return state >= 5;
            if (q.knockoutRound === "שמינית גמר") return state >= 7;
            if (q.knockoutRound === "רבע גמר") return state >= 9;
            if (q.knockoutRound === "חצי גמר") return state >= 11;
            if (q.knockoutRound === "גמר" || q.knockoutRound === "מקום שלישי") return state >= 13;
          }
          return false;
        };

        bonusQuestionsList.forEach((q: any) => {
           if (!isQuestionLockedLocal(q)) {
              const ans = userBonusAnswers[q.id];
              if (!ans || String(ans).trim() === "") {
                 currentMissingList.push({
                    type: 'BONUS',
                    id: q.id,
                    title: `שאלת בונוס: ${q.label}`,
                    tab: 'BONUS'
                 });
              }
           }
        });
        
        setMissingTasksList(currentMissingList);

        const noneKeywords = ["אף נבחרת", "אף אחת", "אין", "none"];
        
        if (todayTeams.size > 0) {
           for (const [qId, uAns] of Object.entries(userBonusAnswers)) {
              const ansStr = String(uAns).trim();
              if (!ansStr) continue;

              const truthArray = realBonusAnswers[qId] ? (Array.isArray(realBonusAnswers[qId]) ? realBonusAnswers[qId] : [realBonusAnswers[qId]]) : [];
              const blacklistArray = rBonusData.blacklist?.[qId] ? (Array.isArray(rBonusData.blacklist[qId]) ? rBonusData.blacklist[qId] : [rBonusData.blacklist[qId]]) : [];

              if (truthArray.includes(ansStr)) continue;
              if (noneKeywords.includes(ansStr) && truthArray.length > 0) continue;
              if (blacklistArray.includes(ansStr)) continue;
              if (rBonusData.locked?.[qId] && !truthArray.includes(ansStr)) continue;

              const q = bonusQuestions.find((q:any) => q.id === qId);
              if (!q) continue;
              const playerInfo = getPlayerInfo(ansStr);
              if (todayTeams.has(ansStr)) {
                  targets.push({ type: "TEAM", team: ansStr, questionLabel: q.label || q.question, points: q.points, isSurvival: false });
               }
               else if (playerInfo && todayTeams.has(playerInfo.country)) {
                     targets.push({ 
                         type: "PLAYER", 
                         name: playerInfo.name, 
                         team: playerInfo.country, 
                         club: playerInfo.club,
                        league: playerInfo.league,
                        questionLabel: q.label || q.question,
                        points: q.points
                      });
               }
               else if (q.answerType === "CUSTOM") {
                  const relevantPlayer = PLAYERS_DATA.find(p => 
                        (p.club === ansStr || p.league === ansStr) && todayTeams.has(p.country)
                   );
                   if (relevantPlayer) {
                        targets.push({
                        type: "CONTEXTUAL_ALERT",
                        name: relevantPlayer.name,
                        team: relevantPlayer.country,
                        context: ansStr, 
                        questionLabel: q.label,
                        points: q.points
                      });
                      }
               }
              else if (noneKeywords.includes(ansStr) && todayTeams.size > 0) {
                 targets.push({ team: "אף נבחרת", questionLabel: q.label, points: q.points, isSurvival: true });
              }
           }
        }
        
        setTodayMatches(tMatches);
        setTodayTargets(targets);
        
        // תיקון קפיצת הטאבים (UI Fix)
        if (!isBannerInit.current) {
            if (tMatches.length > 0) setActiveBannerMode("MATCHES");
            else if (targets.length > 0) setActiveBannerMode("BONUS");
            else setActiveBannerMode("RADAR");
            isBannerInit.current = true;
        } else {
            setActiveBannerMode(prev => {
                if (prev === "MATCHES" && tMatches.length === 0) return targets.length > 0 ? "BONUS" : "RADAR";
                if (prev === "BONUS" && targets.length === 0) return tMatches.length > 0 ? "MATCHES" : "RADAR";
                return prev;
            });
            setTodayMatchIndex(prev => tMatches.length === 0 ? 0 : Math.min(prev, tMatches.length - 1));
            setTodayBonusIndex(prev => targets.length === 0 ? 0 : Math.min(prev, targets.length - 1));
        }

        pmSnap.forEach(d => {
          const data = d.data(); const match = matches.find((m:any) => m.id === data.matchId);
          if(match && match.isFinished) {
            const pH = Number(data.predictedHomeScore); const pA = Number(data.predictedAwayScore);
            const rH = Number(match.realHomeScore); const rA = Number(match.realAwayScore);
            if(!isNaN(pH) && !isNaN(pA) && !isNaN(rH) && !isNaN(rA)) {
              if(Math.sign(pH-pA) === Math.sign(rH-rA)) {
                const exact = (pH===rH && pA===rA);
                feed.push({ id: `gm_${match.id}`, matchId: match.id, matchday: match.matchday, icon: exact ? '🎯' : '✅', title: `${match.homeTeam} נגד ${match.awayTeam}`, desc: exact ? `פגיעה בול! (${pH}-${pA})` : `כיוון נכון`, points: exact ? 15 : 5, ts: parseDate(match.matchDate) });
              }
            }
          }
        });

        pkSnap.forEach(d => {
          const data = d.data(); const match = matches.find((m:any) => m.id === data.matchId);
          if(match && match.isFinished) {
            const pH = Number(data.predictedHomeScore); const pA = Number(data.predictedAwayScore);
            const rH = Number(match.realHomeScore); const rA = Number(match.realAwayScore);
            if(!isNaN(pH) && !isNaN(pA) && !isNaN(rH) && !isNaN(rA)) {
              if(Math.sign(pH-pA) === Math.sign(rH-rA)) {
                const exact = (pH===rH && pA===rA);
                feed.push({ id: `ko_${match.id}`, matchId: match.id, roundName: match.roundName, icon: exact ? '🎯' : '✅', title: `${match.homeTeam} נגד ${match.awayTeam}`, desc: exact ? `בול בנוק-אאוט! (${pH}-${pA})` : `כיוון בנוק-אאוט`, points: exact ? 15 : 5, ts: parseDate(match.matchDate) });
              }
            }
            if(data.qualifier && data.qualifier === match.realQualifier) {
               const qMap:any = { "32 הגדולות": 5, "שמינית גמר": 10, "רבע גמר": 15, "חצי גמר": 20, "גמר": 25 };
               feed.push({ id: `qko_${match.id}`, matchId: match.id, roundName: match.roundName, icon: '🔥', title: `${data.qualifier}`, desc: `ניחוש העפלה (${match.roundName})`, points: qMap[match.roundName] || 0, ts: parseDate(match.matchDate) + 1 });
            }
          }
        });

        for(const [g, preds] of Object.entries<any>(userQualsData)) {
            const rG = realQuals[g];
            if(rG) {
               if(preds.first === rG.first && preds.first) feed.push({ id: `q1_${g}`, icon: '🥇', title: `${preds.first} עולה מבית ${g}`, desc: `פגיעה מדויקת - מקום 1`, points: 15, ts: Infinity });
               else if(preds.first === rG.second && preds.first) feed.push({ id: `q1s_${g}`, icon: '🥈', title: `${preds.first} עולה מבית ${g}`, desc: `עלתה בפועל מהמקום ה-2`, points: 7, ts: Infinity });
               if(preds.second === rG.second && preds.second) feed.push({ id: `q2_${g}`, icon: '🥇', title: `${preds.second} עולה מבית ${g}`, desc: `פגיעה מדויקת - מקום 2`, points: 15, ts: Infinity });
               else if(preds.second === rG.first && preds.second) feed.push({ id: `q2s_${g}`, icon: '🥈', title: `${preds.second} עולה מבית ${g}`, desc: `עלתה בפועל מהמקום ה-1`, points: 7, ts: Infinity });
            }
        }

        userThirdData.forEach((t:string, i:number) => {
            if(t && realThird.includes(t)) feed.push({ id: `t3_${i}`, icon: '🥉', title: `${t}`, desc: `צדקת! העפילה לשמינית ממקום 3`, points: 10, ts: Infinity });
        });

        if(Object.keys(realBonusAnswers).length > 0) {
            bonusQuestions.forEach((q:any) => {
               const truth = realBonusAnswers[q.id]; const uAns = userBonusAnswers[q.id];
          if(truth && uAns) {
               const tArr = Array.isArray(truth) ? truth : [truth];
              const normalize = (s: any) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
             if(tArr.some((t:any) => normalize(t) === normalize(uAns))) {
                 feed.push({ id: `b_${q.id}`, qId: q.id, icon: '🎁', title: q.label, desc: `שאלת בונוס (${uAns})`, points: Number(q.points)||0, ts: Infinity });
              }
          }
        });
      }

        feed.sort((a,b) => b.ts - a.ts);
        setPointsFeed(feed);
      } catch(e) { console.error(e); } finally { setIsFeedLoading(false); }
    };
    fetchFeedAndRadar();
    const surpriseInterval = setInterval(fetchFeedAndRadar, 30000); 
    return () => clearInterval(surpriseInterval);
  }, [userId, tournamentState]);

  const calculateMatchPoints = (predH: string, predA: string, predQ: string, rH: number, rA: number, rQ: string, match: any) => {
    if (!match.isFinished || predH === "" || predA === "") return null;
    let pts = 0; const pH = Number(predH); const pA = Number(predA);
    if (Math.sign(pH - pA) === Math.sign(rH - rA)) { pts += 5; if (pH === rH && pA === rA) pts += 10; }
    if (match.stage === "KNOCKOUT" && predQ === rQ && predQ !== "") {
      const qMap: any = { "32 הגדולות": 5, "שמינית גמר": 10, "רבע גמר": 15, "חצי גמר": 20, "גמר": 25 }; pts += (qMap[match.roundName] || 0);
    }
    return pts;
  };

  const handleOpenSpyForMatch = async (match: any) => {
    setSpyModalMatch(match);
    setSpySearchQuery("");
    setSpyFilter("ALL");
    setIsLoadingSpy(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers: any[] = [];
      usersSnap.forEach(doc => allUsers.push({ id: doc.id, ...doc.data() }));

      allUsers.sort((a, b) => (Number(b.totalPoints) || 0) - (Number(a.totalPoints) || 0));
      let currentRank = 1;
      const usersMap: any = {}; 
      allUsers.forEach((u, i) => {
        if (i > 0 && (Number(u.totalPoints) || 0) < (Number(allUsers[i - 1].totalPoints) || 0)) {
          currentRank = i + 1;
        }
        usersMap[u.id] = {
          name: u.name || "שחקן לא ידוע",
          totalPoints: Number(u.totalPoints) || 0,
          rank: currentRank 
        }; 
      });

      const collectionName = match.stage === "KNOCKOUT" ? "predictions_knockout" : "predictions_matches";
      const q = query(collection(db, collectionName), where("matchId", "==", match.id));
      const snap = await getDocs(q);
      const gathered: any[] = [];
      
      snap.forEach(doc => {
        const d = doc.data();
        if (d.predictedHomeScore !== "" && d.predictedAwayScore !== "") {
          gathered.push({ 
            ...d, 
            userName: usersMap[d.userId]?.name || "משתמש",
            userTotalPoints: usersMap[d.userId]?.totalPoints || 0,
            userRank: usersMap[d.userId]?.rank || 999,
            points: calculateMatchPoints(d.predictedHomeScore, d.predictedAwayScore, d.qualifier || "", Number(match.realHomeScore), Number(match.realAwayScore), match.realQualifier, match)
          });
        }
      });
      
      gathered.sort((a, b) => b.userTotalPoints - a.userTotalPoints);
      setSpyData(gathered);
    } catch (e) { console.error(e); }
    finally { setIsLoadingSpy(false); }
  };

  const avgPoints = allUsersList.length > 0 ? Math.round(allUsersList.reduce((sum, u) => sum + (Number(u.totalPoints) || 0), 0) / allUsersList.length) : 0;
  
  const getRecentFeedItems = () => {
    const ptsDiff = userStats.points - userStats.prevPoints;
    if (ptsDiff <= 0) return [];
    const recent = [];
    let currentSum = 0;
    for (const item of pointsFeed) {
      if (currentSum < ptsDiff) {
        recent.push(item);
        currentSum += item.points;
      } else { break; }
    }
    return recent;
  };

  const displayFeed = showFullHistory ? pointsFeed : getRecentFeedItems();
  
  const ptsDiff = userStats.points - userStats.prevPoints;
  const rankDiff = (userStats.prevRank > 0 && userStats.rank > 0) ? userStats.prevRank - userStats.rank : 0;
  const koRankDiff = (userStats.prevKoRank > 0 && userStats.koRank > 0) ? userStats.prevKoRank - userStats.koRank : 0;
  
  const topUser = [...allUsersList].sort((a, b) => (Number(b.totalPoints) || 0) - (Number(a.totalPoints) || 0))[0];
  const currentLeader = (topUser && topUser.name) ? topUser.name.split(' ')[0] : "אין";
  
  const topKoUser = [...allUsersList].sort((a, b) => (Number(b.knockoutPoints) || 0) - (Number(a.knockoutPoints) || 0))[0];
  const currentKoLeader = (topKoUser && topKoUser.name) ? topKoUser.name.split(' ')[0] : "אין";

  const myDataInfo = allUsersList.find(u => u.id === userId);
  const safeUserName = myDataInfo?.name ? myDataInfo.name.split(" ")[0] : "אלוף";
  const nemesisFirstName = (nemesisData && nemesisData.name) ? nemesisData.name.split(" ")[0] : "";
  const totalPrizesPool = prizes ? (Number(prizes.main1||0) + Number(prizes.main2||0) + Number(prizes.main3||0) + Number(prizes.main4||0) + Number(prizes.ko1||0) + Number(prizes.ko2||0)) : 0;

  const userLeaguesData = myLeagues.map(league => {
     const leagueUsers = allUsersList.filter(u => league.members?.includes(u.id));
     leagueUsers.sort((a,b) => (b.totalPoints || 0) - (a.totalPoints || 0));
     const myIndex = leagueUsers.findIndex(u => u.id === userId);
     return {
        id: league.id,
        name: league.name,
        rank: myIndex !== -1 ? myIndex + 1 : "-"
     };
  });

  const handlePrevMatch = () => setTodayMatchIndex(i => (i === 0 ? todayMatches.length - 1 : i - 1));
  const handleNextMatch = () => setTodayMatchIndex(i => (i === todayMatches.length - 1 ? 0 : i + 1));
  const handlePrevBonus = () => setTodayBonusIndex(i => (i === 0 ? todayTargets.length - 1 : i - 1));
  const handleNextBonus = () => setTodayBonusIndex(i => (i === todayTargets.length - 1 ? 0 : i + 1));

  const getPointsBadge = (points: number | null) => {
    if (points === null) return null;
    if (points === 0) return <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 bg-rose-950/50 text-rose-400 border border-rose-500/40 px-2 py-1 rounded text-[10px] font-black shadow-sm">0 נק'</span>;
    if (points > 0 && points < 15) return <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 bg-amber-900/40 text-amber-400 border border-amber-500/50 px-2 py-1 rounded text-[10px] font-black shadow-sm">+{points} נק'</span>;
    if (points >= 15) return <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 bg-emerald-900/40 text-emerald-400 border border-emerald-500/50 px-2 py-1 rounded text-[10px] font-black shadow-[0_0_10px_rgba(16,185,129,0.2)]">🎯 +{points} נק'</span>;
    return <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 bg-blue-900/40 text-blue-400 border border-blue-500/40 px-2 py-1 rounded text-[10px] font-black shadow-sm">+{points} נק'</span>;
  };

  if (isLoading) return <div className="flex justify-center items-center h-64"><div className="animate-spin text-5xl text-blue-500">⚽</div></div>;
// --- לוגיקת סיום הטורניר ופודיום ההכתרה ---
  if (tournamentState >= 13 && showPodiumState && allUsersList.length > 0) {
    // פונקציית חישוב פרסים כולל תיקו (זהה ל-Leaderboard)
    const getPrizeForRank = (rank: number, board: "GENERAL" | "KNOCKOUT", usersArr: any[]) => {
      if (!prizes) return 0;
      const winnersAtThisRank = usersArr.filter(u => board === "GENERAL" ? u.displayRank === rank : u.displayKoRank === rank);
      const count = winnersAtThisRank.length;
      if (count === 0) return 0;

      const getRaw = (r: number) => {
        if (board === "GENERAL") return Number(prizes[`main${r}`] || 0);
        return Number(prizes[`ko${r}`] || 0);
      };

      let totalPool = 0;
      for (let i = 0; i < count; i++) totalPool += getRaw(rank + i);
      return Math.floor(totalPool / count);
    };

    // בניית טבלה 1 (ראשית - 4 מקומות)
    const sortedGeneral = [...allUsersList].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
    const winnersTable1 = sortedGeneral.slice(0, 4).map(u => ({
      name: u.name,
      points: u.totalPoints,
      prize: getPrizeForRank(u.displayRank, "GENERAL", sortedGeneral)
    }));

    // בניית טבלה 2 (נוקאאוט - 2 מקומות)
    const sortedKo = [...allUsersList].sort((a, b) => (b.knockoutPoints || 0) - (a.knockoutPoints || 0));
    const winnersTable2 = sortedKo.slice(0, 2).map(u => ({
      name: u.name,
      points: u.knockoutPoints,
      prize: getPrizeForRank(u.displayKoRank, "KNOCKOUT", sortedKo)
    }));

    return (
      <FinalePodiumModal 
        winnersTable1={winnersTable1} 
        winnersTable2={winnersTable2} 
        onClose={() => setShowPodiumState(false)} 
      />
    );
  }
  // --- סוף לוגיקת הכתרה ---
  const isMatchesMode = activeBannerMode === "MATCHES";
  const currentDisplayedMatch = todayMatches[todayMatchIndex];
  const currentDisplayedBonus = todayTargets[todayBonusIndex];

  const spyStats = { exact: 0, direction: 0, miss: 0 };
  if (spyModalMatch && spyModalMatch.isFinished) {
    spyData.forEach(d => {
      const pH = Number(d.predictedHomeScore); const pA = Number(d.predictedAwayScore);
      const rH = Number(spyModalMatch.realHomeScore); const rA = Number(spyModalMatch.realAwayScore);
      if (pH === rH && pA === rA) spyStats.exact++;
      else if (Math.sign(pH - pA) === Math.sign(rH - rA)) spyStats.direction++;
      else spyStats.miss++;
    });
  }

  const filteredSpyData = spyData.filter(d => {
    if (!d.userName.toLowerCase().includes(spySearchQuery.toLowerCase())) return false;
    if (spyModalMatch && spyModalMatch.isFinished && spyFilter !== "ALL") {
      const pH = Number(d.predictedHomeScore); const pA = Number(d.predictedAwayScore);
      const rH = Number(spyModalMatch.realHomeScore); const rA = Number(spyModalMatch.realAwayScore);
      const isExact = (pH === rH && pA === rA);
      const isDirection = (!isExact && Math.sign(pH - pA) === Math.sign(rH - rA));
      if (spyFilter === "EXACT" && !isExact) return false;
      if (spyFilter === "DIRECTION" && !isDirection) return false;
      if (spyFilter === "MISS" && (isExact || isDirection)) return false;
    }
    return true;
  });

  let urgencyLevel = "NORMAL";
  let bannerStyle = "bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 border-amber-300 shadow-[0_0_40px_rgba(245,158,11,0.6)]";
  let urgencyTitle = "משחקים מחכים לניחוש שלך!";
  let urgencyIcon = "⚠️";
  
  if (activeDeadlineTime) {
     const hoursLeft = (activeDeadlineTime - nowMs) / (1000 * 60 * 60);
     if (hoursLeft > 0 && hoursLeft <= 4) {
       urgencyLevel = "CRITICAL";
       bannerStyle = "bg-gradient-to-r from-rose-600 via-red-600 to-rose-600 border-rose-300 shadow-[0_0_40px_rgba(225,29,72,0.6)] animate-pulse";
       urgencyTitle = "הדד-ליין נושף בעורף! שעות אחרונות לנעילה!";
       urgencyIcon = "🚨";
     } else if (hoursLeft > 4 && hoursLeft <= 24) {
       urgencyLevel = "HIGH";
       bannerStyle = "bg-gradient-to-r from-orange-600 via-red-500 to-orange-600 border-orange-300 shadow-[0_0_40px_rgba(249,115,22,0.6)]";
       urgencyTitle = "הזמן אוזל! פחות מ-24 שעות לנעילה";
       urgencyIcon = "⏳";
     }
  }

  const missingMatchesCount = missingTasksList.filter(t => t.type === 'MATCH').length;
  const missingQualsCount = missingTasksList.filter(t => t.type === 'QUALIFIER').length;
  const missingThirdCount = missingTasksList.filter(t => t.type === 'THIRD_PLACE').length;
  const missingBonusCount = missingTasksList.filter(t => t.type === 'BONUS').length;

  const summaryParts = [];
  if (missingMatchesCount > 0) summaryParts.push(`**${missingMatchesCount} משחקים**`);
  if (missingQualsCount > 0) summaryParts.push(`**עולות מ-${missingQualsCount} בתים**`);
  if (missingThirdCount > 0) summaryParts.push(`**מעפילות ממקום 3**`);
  if (missingBonusCount > 0) summaryParts.push(`**${missingBonusCount} שאלות בונוס**`);

  let summaryText = "";
  if (summaryParts.length === 1) summaryText = summaryParts[0];
  else if (summaryParts.length === 2) summaryText = `${summaryParts[0]} ו-${summaryParts[1]}`;
  else if (summaryParts.length > 2) {
     const last = summaryParts.pop();
     summaryText = `${summaryParts.join(", ")} ו-${last}`;
  }

  const handleTaskClick = () => {
      const firstTask = missingTasksList[0];
      if (!firstTask) return;
      
      if (firstTask.type === 'MATCH') {
          if (firstTask.stage !== "KNOCKOUT") {
              sessionStorage.setItem("targetMatchday", firstTask.matchday || "1");
              sessionStorage.setItem("targetGroup", firstTask.group);
              sessionStorage.setItem("groupsViewMode", "MATCHES");
          }
          sessionStorage.setItem("scrollToMatch", firstTask.id);
      } else if (firstTask.type === 'QUALIFIER') {
          sessionStorage.setItem("targetGroup", firstTask.group);
          sessionStorage.setItem("groupsViewMode", "QUALIFIERS");
      } else if (firstTask.type === 'BONUS') {
          sessionStorage.setItem("scrollToBonus", firstTask.id);
      }
      
      setActiveTab("PREDICTIONS");
      if(setPredictionTab) setPredictionTab(firstTask.tab);
      window.scrollTo({top:0, behavior:'smooth'});
  };

  return (
    
    <div className="w-full space-y-8 animate-fade-in-up pb-8 relative">
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes eyeBlink {
          0%, 90%, 100% { transform: scaleY(1); }
          92% { transform: scaleY(0.1); }
          94% { transform: scaleY(1); }
          96% { transform: scaleY(0.1); }
          98% { transform: scaleY(1); }
        }
        .animate-eye-blink {
          display: inline-block;
          animation: eyeBlink 4s infinite;
          transform-origin: center;
        }

        /* ⬇️ האנימציות שעודכנו לירידה איטית ודרמטית ⬇️ */
        @keyframes lowerJumbotron {
          0% { transform: translateY(-100vh); opacity: 0; }
          60% { transform: translateY(-40%); opacity: 1; }
          80% { transform: translateY(-52%); }
          100% { transform: translateY(-50%); }
        }
        .animate-jumbotron-right {
          /* שונה ל-3.5 שניות */
          animation: lowerJumbotron 3.5s cubic-bezier(0.25, 1, 0.5, 1) forwards; 
        }
        .animate-jumbotron-left {
          /* שונה ל-3.5 שניות עם דיליי (השהייה) של 0.8 שניות */
          animation: lowerJumbotron 3.5s cubic-bezier(0.25, 1, 0.5, 1) 0.8s both; 
        }
          @keyframes slowZoom {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        .animate-slow-zoom {
          animation: slowZoom 25s ease-in-out infinite;
        }
          /* סגנון לבועות דיבור חלקות */
        .speech-bubble {
          position: absolute;
          background: #1e293b; /* slate-800 */
          color: white;
          border-radius: 12px;
          padding: 8px 12px;
          border: 2px solid #475569; /* slate-600 */
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
          font-weight: 800;
          white-space: nowrap;
          transform-origin: center;
          transition: all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
          pointer-events: none;
          z-index: 50;
        }
        /* הזנב של הבועה (בסגנון Tailwind) */
        .speech-bubble::after {
          content: '';
          position: absolute;
          width: 0; h: 0;
          border-left: 10px solid transparent;
          border-right: 10px solid transparent;
          border-top: 10px solid #475569;
          bottom: -11px; left: 50%;
          transform: translateX(-50%);
        }
      `}} />


{/* ========================================================= */}
      {/* עיצוב איצטדיון: מסכי ענק רחבים (Jumbotrons) + דמויות מציצות */}
      {/* ========================================================= */}
      
      {/* מסך ימני (USA, MEX, CAN) */}
      <div className="hidden xl:flex fixed right-[1%] 2xl:right-[2%] top-1/2 z-0 flex-col items-center opacity-70 hover:opacity-100 transition-opacity duration-500 drop-shadow-[0_25px_40px_rgba(0,0,0,0.9)] animate-jumbotron-right">
         {/* שני כבלים לתלייה */}
         <div className="flex gap-20 2xl:gap-32 relative z-10 pointer-events-none">
            <div className="w-2.5 h-16 bg-gradient-to-b from-slate-950 to-slate-800 shadow-inner"></div>
            <div className="w-2.5 h-16 bg-gradient-to-b from-slate-950 to-slate-800 shadow-inner"></div>
         </div>
         
         {/* קבוצת המסך והמציצים (חייב להיות z-20 ו-pointer-events-auto) */}
         <div className="relative z-20 pointer-events-auto">
           
           {/* --- דמות 1: טראמפ (USA) --- */}
           <div className="absolute -top-10 right-8 w-16 h-16 group/trump z-0 cursor-pointer">
             {/* בועת דיבור: טראמפ */}
             <div className="speech-bubble -top-12 left-1/2 opacity-0 scale-0 group-hover/trump:opacity-100 group-hover/trump:scale-100 text-[10px] whitespace-nowrap">
               "Fake News! אני מקום ראשון!"
             </div>
             <img src="/donaldIcon-removebg.png" className="absolute inset-0 w-full h-full object-contain drop-shadow-xl hover:-translate-y-4 hover:rotate-6 transition-all duration-300" alt="Trump" />
           </div>

           {/* --- דמות 2: מקסיקני --- */}
           <div className="absolute top-1/2 -left-12 -translate-y-1/2 w-16 h-16 group/mexican z-0 cursor-pointer">
             {/* בועת דיבור: מקסיקני (פונה ימינה) */}
             <div className="speech-bubble -top-10 -right-36 opacity-0 scale-0 group-hover/mexican:opacity-100 group-hover/mexican:scale-100 text-[10px]">
               "Jajaja! המנצח לוקח טקילה!"
             </div>
             <img src="/maxicanIcon-removebg.png" className="absolute inset-0 w-full h-full object-contain drop-shadow-xl hover:translate-x-4 hover:-rotate-12 transition-all duration-300" alt="Mexican" />
           </div>

           {/* --- דמות 3: קנדי --- */}
           <div className="absolute bottom-1 w-16 h-16 group/canadian z-0 cursor-pointer left-8">
             {/* בועת דיבור: קנדי */}
             <div className="speech-bubble -bottom-14 left-1/2 opacity-0 scale-0 group-hover/canadian:opacity-100 group-hover/canadian:scale-100 text-[9px] -translate-x-1/2">
                <span className="speech-bubble::after" style={{borderTop:'none', borderBottom:'10px solid #475569', top:'-11px', bottom:'auto'}}></span>
                "סליחה, אבל אני הולך לעקוף אותך. Eh?"
             </div>
             <img src="/canadianIcon-removebg.png" className="absolute inset-0 w-full h-full object-contain drop-shadow-xl hover:translate-y-4 hover:rotate-6 transition-all duration-300" alt="Canadian" />
           </div>
           
           {/* הקורה העליונה */}
           <div className="w-[310px] 2xl:w-[410px] h-3 bg-slate-800 rounded-t-md border-t-2 border-slate-600 mx-auto relative z-10"></div>
           
           {/* גוף המסך הרחב */}
           <div className="w-[330px] 2xl:w-[430px] rounded-b-2xl bg-slate-950 border-4 md:border-[6px] border-slate-800 p-2 shadow-inner relative z-10">
             <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-black/80 px-2 py-0.5 rounded text-[8px] 2xl:text-[10px] font-black text-rose-500 tracking-widest border border-rose-500/30">
               <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span> LIVE
             </div>

             <div className="relative w-full aspect-video bg-black rounded-sm overflow-hidden border border-slate-700/80 shadow-[inset_0_0_25px_rgba(0,0,0,1)]">
                <img src="/worldcup-bg.png" className="absolute inset-0 w-full h-full object-contain opacity-80 animate-slow-zoom origin-center" alt="World Cup" />
                <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay" style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.15) 1px, transparent 1px)', backgroundSize: '3px 3px' }}></div>
                <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.9)]"></div>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 z-10 pointer-events-auto">
                  <h1 className="text-2xl 2xl:text-3xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] tracking-tight italic">
                    BETS IN PROD 2026
                  </h1>
                </div>
             </div>
           </div>
         </div>

         {/* דגלונים באיכות גבוהה */}
         <div className="flex gap-8 2xl:gap-12 justify-center -mt-1 relative z-30 pointer-events-auto">
            {["ארה\"ב", "מקסיקו", "קנדה"].map((country) => (
               <div key={country} title={country} className="w-10 h-16 2xl:w-12 2xl:h-20 drop-shadow-[0_10px_8px_rgba(0,0,0,0.8)] group hover:drop-shadow-[0_15px_12px_rgba(0,0,0,0.9)] hover:scale-110 hover:rotate-3 transition-all duration-300 origin-top cursor-pointer border border-t border-black/40">
                  <div className="w-full h-full relative" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 75%, 50% 100%, 0 75%)' }}>
                    <img src={getFlagUrl(country)!} className="absolute inset-0 w-full h-full object-cover saturate-[1.1]" alt={country} />
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/60 mix-blend-overlay"></div>
                    <div className="absolute inset-0 shadow-[inset_0_2px_8px_rgba(0,0,0,0.7)] border-t border-black/40"></div>
                  </div>
               </div>
            ))}
         </div>
      </div>

      {/* מסך שמאלי (USA, MEX, CAN - מציצים שונה) */}
      <div className="hidden xl:flex fixed left-[1%] 2xl:left-[2%] top-1/2 z-0 flex-col items-center opacity-70 hover:opacity-100 transition-opacity duration-500 drop-shadow-[0_25px_40px_rgba(0,0,0,0.9)] animate-jumbotron-left">
         {/* שני כבלים לתלייה */}
         <div className="flex gap-20 2xl:gap-32 relative z-10 pointer-events-none">
            <div className="w-2.5 h-16 bg-gradient-to-b from-slate-950 to-slate-800 shadow-inner"></div>
            <div className="w-2.5 h-16 bg-gradient-to-b from-slate-950 to-slate-800 shadow-inner"></div>
         </div>
         
         {/* קבוצת המסך והמציצים */}
         <div className="relative z-20 pointer-events-auto">
           
           {/* --- דמות 1: טראמפ (USA - מציץ משמאל) --- */}
           <div className="absolute -top-10 left-8 w-16 h-16 group/trump-l z-0 cursor-pointer">
             <div className="speech-bubble -top-12 left-1/2 -translate-x-1/2 opacity-0 scale-0 group-hover/trump-l:opacity-100 group-hover/trump-l:scale-100 text-[10px]">
               "עוד בול אחד שלי וזה ניצחון מוחץ!"
             </div>
             <img src="/donaldIcon-removebg.png" className="absolute inset-0 w-full h-full object-contain drop-shadow-xl hover:-translate-y-4 hover:-rotate-6 transition-all duration-300" alt="Trump" />
           </div>

           {/* --- דמות 2: מקסיקני (מציץ מלמטה ימינה) --- */}
           <div className="absolute -bottom-8 right-8 w-16 h-16 group/mexican-r z-0 cursor-pointer">
             <div className="speech-bubble -top-10 -left-12 opacity-0 scale-0 group-hover/mexican-r:opacity-100 group-hover/mexican-r:scale-100 text-[10px]">
               "אייייי! איזה ניחוש של הטאקו!"
             </div>
             <img src="/mexicanIcon-removebg.png" className="absolute inset-0 w-full h-full object-contain drop-shadow-xl hover:translate-y-4 hover:rotate-12 transition-all duration-300" alt="Mexican" />
           </div>

           {/* --- דמות 3: קנדי (מציץ מלמעלה ימינה) --- */}
           <div className="absolute top-12 -right-12 w-16 h-16 group/canadian-t z-0 cursor-pointer">
             <div className="speech-bubble -top-10 -right-20 opacity-0 scale-0 group-hover/canadian-t:opacity-100 group-hover/canadian-t:scale-100 text-[10px]">
                "ניחוש בול של ההוקי!🏒"
             </div>
             <img src="/candianIcon-removebg.png" className="absolute inset-0 w-full h-full object-contain drop-shadow-xl hover:translate-x-4 hover:-rotate-6 transition-all duration-300" alt="Canadian" />
           </div>
           
           {/* הקורה העליונה */}
           <div className="w-[310px] 2xl:w-[410px] h-3 bg-slate-800 rounded-t-md border-t-2 border-slate-600 mx-auto relative z-10"></div>
           
           {/* גוף המסך הרחב */}
           <div className="w-[330px] 2xl:w-[430px] rounded-b-2xl bg-slate-950 border-4 md:border-[6px] border-slate-800 p-2 shadow-inner relative z-10">
             <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-black/80 px-2 py-0.5 rounded text-[8px] 2xl:text-[10px] font-black text-rose-500 tracking-widest border border-rose-500/30">
               <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span> LIVE
             </div>

             <div className="relative w-full aspect-video bg-black rounded-sm overflow-hidden border border-slate-700/80 shadow-[inset_0_0_25px_rgba(0,0,0,1)]">
                <img src="/worldcup-bg.png" className="absolute inset-0 w-full h-full object-contain opacity-80 animate-slow-zoom origin-center" alt="World Cup" />
                <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay" style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.15) 1px, transparent 1px)', backgroundSize: '3px 3px' }}></div>
                <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.9)]"></div>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 z-10 pointer-events-auto">
                  <h1 className="text-2xl 2xl:text-3xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] tracking-tight italic">
                    BETS IN PROD 2026
                  </h1>
                </div>
             </div>
           </div>
         </div>

         {/* דגלונים באיכות גבוהה */}
         <div className="flex gap-8 2xl:gap-12 justify-center -mt-1 relative z-30 pointer-events-auto">
            {["ארה\"ב", "מקסיקו", "קנדה"].map((country) => (
               <div key={country} title={country} className="w-10 h-16 2xl:w-12 2xl:h-20 drop-shadow-[0_10px_8px_rgba(0,0,0,0.8)] group hover:drop-shadow-[0_15px_12px_rgba(0,0,0,0.9)] hover:scale-110 hover:-rotate-3 transition-all duration-300 origin-top cursor-pointer border border-t border-black/40">
                  <div className="w-full h-full relative" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 75%, 50% 100%, 0 75%)' }}>
                    <img src={getFlagUrl(country)!} className="absolute inset-0 w-full h-full object-cover saturate-[1.1]" alt={country} />
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/60 mix-blend-overlay"></div>
                    <div className="absolute inset-0 shadow-[inset_0_2px_8px_rgba(0,0,0,0.7)] border-t border-black/40"></div>
                  </div>
               </div>
            ))}
         </div>
      </div>

      {/* ========================================================= */}
      {/* ========================================================= */}
      {/* 🎈 קמעות פופ-אפ */}
      <div className={`fixed bottom-4 left-4 md:left-8 z-[100] transition-all duration-700 transform ${showMascot ? 'translate-y-0 opacity-100' : 'translate-y-32 opacity-0 pointer-events-none'} flex items-end gap-3`} dir="ltr">
         <div className="bg-slate-50 text-slate-900 p-4 rounded-2xl rounded-bl-none shadow-[0_10px_25px_rgba(0,0,0,0.5)] max-w-[220px] md:max-w-[280px] relative border-2 border-slate-300" dir="rtl">
            <button onClick={() => setShowMascot(false)} className="absolute top-1 right-2 text-slate-400 hover:text-rose-500 font-black text-xs p-1">✕</button>
            <p className="text-sm font-bold leading-tight pt-2">{mascotQuote?.quote}</p>
         </div>
         <div className="relative shrink-0">
            <img src={mascotQuote?.mascot.image} alt={mascotQuote?.mascot.name} className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-slate-800 shadow-2xl object-cover bg-white" />
         </div>
      </div>

      {/* 🚨 אזהרת דדליין ומשימות חסרות */}
      {missingTasksList.length > 0 && (
         <div className={`${bannerStyle} p-6 rounded-3xl border relative overflow-hidden transition-all duration-500`}>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-30"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-right">
               <div>
                  <h2 className="text-2xl md:text-3xl font-black text-white mb-2 flex items-center justify-center md:justify-start gap-3 drop-shadow-md">
                     <span className={urgencyLevel === "CRITICAL" ? "animate-bounce" : "animate-pulse"}>{urgencyIcon}</span> {urgencyTitle}
                  </h2>
                  <p className="text-white/90 font-medium text-base md:text-lg leading-snug">
                     מתוך {getPhaseName(tournamentState)}, ישנם <span dangerouslySetInnerHTML={{__html: summaryText.replace(/\*\*/g, '')}}></span> שפתוחים כרגע לניחושים וטרם הוזנו.
                     <br />
                     <span className="text-sm font-bold opacity-90 mt-1 block">
                        לדוגמה: {missingTasksList[0].title}
                     </span>
                  </p>
               </div>
               <button onClick={handleTaskClick} 
                 className={`bg-white font-black px-8 py-4 rounded-xl text-lg shadow-xl hover:-translate-y-1 transition-transform w-full md:w-auto flex-shrink-0 ${urgencyLevel === "CRITICAL" ? "text-rose-700" : "text-amber-700"}`}
               >
                  קח אותי למשימה! 🏃‍♂️
               </button>
            </div>
         </div>
      )}

      {/* 🎁 באנר שאלת הפתעה */}
      {activeSurpriseAlert > 0 && (
         <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 p-6 rounded-3xl border border-purple-300 shadow-[0_0_40px_rgba(168,85,247,0.6)] relative overflow-hidden animate-pulse">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-30"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-right">
               <div>
                  <h2 className="text-3xl font-black text-white mb-2 flex items-center justify-center md:justify-start gap-3 drop-shadow-md">
                     <span className="animate-bounce">🎁</span> שאלת הפתעה באוויר!
                  </h2>
                  <p className="text-white/90 font-medium text-lg leading-snug">
                     האדמין פתח עכשיו <strong>{activeSurpriseAlert} שאלות הפתעה</strong> לזמן מוגבל מאוד!<br/>כנס מהר לענות עליהן לפני שהשעון ייגמר.
                  </p>
               </div>
               <button onClick={() => { setActiveTab("PREDICTIONS"); if(setPredictionTab) setPredictionTab("BONUS"); window.scrollTo({top:0, behavior:'smooth'}); }} className="bg-white text-purple-700 hover:bg-slate-100 font-black px-8 py-4 rounded-xl text-lg shadow-xl hover:-translate-y-1 transition-transform w-full md:w-auto flex-shrink-0">
                  לקחת אותי לבונוסים! 🏃‍♂️
               </button>
            </div>
         </div>
      )}

      {/* מרכז השליטה האישי המפוצל */}
      <div className="flex md:grid md:grid-cols-2 items-stretch overflow-x-auto snap-x snap-mandatory md:overflow-visible gap-4 md:gap-8 pb-4 md:pb-0 custom-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
         
         <div className="w-[90%] md:w-auto shrink-0 snap-center rounded-3xl p-6 shadow-2xl relative overflow-hidden bg-slate-900 border border-slate-700 flex flex-col min-h-full">
            <img src="tunnel.png" alt="Bets in Prod Tunnel" className="absolute inset-0 w-full h-full object-cover z-0 opacity-40 transition-all duration-1000 pointer-events-none" />
            <div className="absolute inset-0 z-0 bg-gradient-to-l from-slate-950/90 via-slate-900/60 to-slate-950/90 pointer-events-none"></div>
            
            <div className="relative z-10 text-right mb-6">
               <h1 className="text-3xl md:text-4xl font-black text-white flex items-center justify-center md:justify-start gap-2 mb-2" dir="rtl">
                  <span>אהלן, {safeUserName}!</span>
                  <span className="origin-bottom-right">👋</span>
               </h1>
               <p className="text-slate-300 text-sm font-medium drop-shadow-lg">ברוך הבא לחדר ההלבשה. הנה המצב שלך כרגע:</p>
            </div>
            {tournamentState >= 4 && (
       <button 
    onClick={() => setShowWrappedModal(true)}
    className="relative z-10 w-full mb-6 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 p-1 rounded-2xl group cursor-pointer hover:scale-[1.02] transition-transform shadow-lg"
  >
    <div className="bg-slate-950/80 backdrop-blur-sm rounded-xl px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-3xl animate-bounce">🎬</span>
        <div className="text-right">
          <div className="font-black text-white">הסיכום האישי שלך זמין!</div>
          <div className="text-xs text-pink-300 font-bold">איך היית בשלב הבתים? כנס לגלות 👉</div>
        </div>
      </div>
    </div>
  </button>
)}

            <div className={`grid gap-3 relative z-10 w-full mb-6 ${tournamentState >= 4 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div 
                  onClick={() => {
                     sessionStorage.setItem("targetBoard", "GENERAL");
                     setActiveTab("LEADERBOARD");
                  }}
                  className="bg-gradient-to-br from-amber-500/20 to-amber-900/40 backdrop-blur-md p-3 rounded-2xl border border-amber-500/50 text-center shadow-[0_0_20px_rgba(245,158,11,0.15)] cursor-pointer hover:border-amber-400 hover:scale-[1.02] transition-all group relative flex flex-col justify-between"
               >
                  {/* הילת זהב ברקע (z-0 כדי לא להפריע לטקסט) */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-24 bg-amber-400/20 rounded-full blur-2xl pointer-events-none z-0"></div>

                  {ptsDiff > 0 && <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-black text-white bg-gradient-to-r from-blue-600 to-blue-400 px-2 py-0.5 rounded-lg border border-blue-300 shadow-lg transform rotate-3 animate-pulse whitespace-nowrap z-20">+{ptsDiff} היום!</div>}
                  
                  <div className="text-amber-200/70 text-[10px] font-black uppercase mb-3 relative z-10 transition-colors">דירוג כללי</div>
                  
                  <div className="flex justify-around items-center mb-3 px-4 relative z-10">
                     <div className="flex flex-col items-center">
                        <span className="text-2xl md:text-3xl font-black text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)] leading-none">{userStats.points}</span>
                        <span className="text-[9px] text-amber-200/60 font-bold mt-1.5">נקודות</span>
                     </div>
                     <div className="w-px h-8 bg-amber-500/30"></div>
                     <div className="flex flex-col items-center">
                        <span className="text-2xl md:text-3xl font-black text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)] leading-none">{userStats.rank > 0 ? userStats.rank : "-"}</span>
                        <span className="text-[9px] text-amber-200/60 font-bold mt-1.5">מיקום</span>
                     </div>
                  </div>
                  
                  <div className="mt-auto flex justify-center items-center min-h-[22px] relative z-10">
                    {rankDiff > 0 && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">▲ עלית {rankDiff}</span>}
                    {rankDiff < 0 && <span className="text-[9px] font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/30">▼ ירדת {Math.abs(rankDiff)}</span>}
                    {rankDiff === 0 && <span className="text-[9px] font-bold text-amber-200/80 bg-amber-900/40 px-2 py-0.5 rounded border border-amber-500/40 shadow-sm">- ללא שינוי</span>}
                  </div>
               </div>
               
               {tournamentState >= 4 && (
                  <div 
                     onClick={() => {
                        sessionStorage.setItem("targetBoard", "KNOCKOUT");
                        setActiveTab("LEADERBOARD");
                     }}
                     className="bg-emerald-900/20 backdrop-blur-md p-3 rounded-2xl border border-emerald-500/30 text-center shadow-xl cursor-pointer hover:bg-emerald-900/40 hover:border-emerald-400 hover:scale-[1.02] transition-all group relative flex flex-col justify-between"
                  >
                     <div className="text-emerald-500 text-[10px] font-black uppercase mb-3 group-hover:text-emerald-300 transition-colors">דירוג נוקאאוט</div>
                     
                     <div className="flex justify-around items-center mb-3 px-4">
                        <div className="flex flex-col items-center">
                           <span className="text-2xl md:text-3xl font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)] leading-none">{userStats.koPoints}</span>
                           <span className="text-[9px] text-emerald-400/70 font-bold mt-1.5">נקודות</span>
                        </div>
                        <div className="w-px h-8 bg-emerald-500/30"></div>
                        <div className="flex flex-col items-center">
                           <span className="text-2xl md:text-3xl font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)] leading-none">{userStats.koRank > 0 ? userStats.koRank : "-"}</span>
                           <span className="text-[9px] text-emerald-400/70 font-bold mt-1.5">מיקום</span>
                        </div>
                     </div>

                     <div className="mt-auto flex justify-center items-center min-h-[22px]">
                        {koRankDiff > 0 && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">▲ עלית {koRankDiff}</span>}
                        {koRankDiff < 0 && <span className="text-[9px] font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/30">▼ ירדת {Math.abs(koRankDiff)}</span>}
                        {koRankDiff === 0 && <span className="text-[9px] font-bold text-emerald-200 bg-emerald-800/50 px-2 py-0.5 rounded border border-emerald-500/30">🏆 שלב ההכרעות</span>}
                     </div>
                  </div>
               )}
            </div>

            <div className={`grid gap-3 relative z-10 w-full mb-5 ${tournamentState >= 4 ? 'grid-cols-2' : 'grid-cols-1'}`}>
               <div 
                  onClick={() => {
                     sessionStorage.setItem("targetBoard", "GENERAL");
                     setActiveTab("LEADERBOARD");
                  }}
                  className="bg-gradient-to-br from-amber-500/20 to-amber-900/40 p-4 rounded-2xl border border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)] relative overflow-hidden flex flex-col items-center justify-center text-center gap-1 cursor-pointer hover:scale-[1.02] hover:border-amber-400 transition-all"
               >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-24 bg-amber-400/20 rounded-full blur-2xl pointer-events-none"></div>
                  <div className="text-3xl md:text-4xl drop-shadow-[0_0_15px_rgba(251,191,36,0.8)] relative z-10 mb-1 animate-pulse">⚽</div>
                  <span className="text-[10px] text-amber-200/70 font-black uppercase tracking-widest relative z-10 leading-tight">כדור הזהב <br/>(מקום 1)</span>
                  <span className="text-base md:text-lg font-black text-amber-400 relative z-10 w-full px-2 mt-1 leading-none">
                     <span className="block truncate">{currentLeader}</span>
                     <span className="block text-[11px] md:text-xs text-amber-200/60 font-normal mt-1">({allUsersList.sort((a,b)=>(b.totalPoints||0)-(a.totalPoints||0))[0]?.totalPoints || 0} נק')</span>
                  </span>
               </div>

               {tournamentState >= 4 && (
                 <div 
                    onClick={() => {
                       sessionStorage.setItem("targetBoard", "KNOCKOUT");
                       setActiveTab("LEADERBOARD");
                    }}
                    className="bg-gradient-to-br from-emerald-500/20 to-emerald-900/40 p-4 rounded-2xl border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] relative overflow-hidden flex flex-col items-center justify-center text-center gap-1 cursor-pointer hover:scale-[1.02] hover:border-emerald-400 transition-all"
                 >
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-24 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none"></div>
                    <div className="text-3xl md:text-4xl drop-shadow-[0_0_15px_rgba(16,185,129,0.8)] relative z-10 mb-1 animate-pulse">👟</div>
                    <span className="text-[10px] text-emerald-200/70 font-black uppercase tracking-widest relative z-10 leading-tight">נעל הזהב <br/>(נוקאאוט)</span>
                    <span className="text-base md:text-lg font-black text-emerald-400 relative z-10 w-full px-2 mt-1 leading-none">
                       <span className="block truncate">{currentKoLeader}</span>
                       <span className="block text-[11px] md:text-xs text-emerald-200/60 font-normal mt-1">({allUsersList.sort((a,b)=>(b.knockoutPoints||0)-(a.knockoutPoints||0))[0]?.knockoutPoints || 0} נק')</span>
                    </span>
                 </div>
               )}
            </div>

            <div className="relative z-10 w-full mb-6">
               <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2.5 px-1 flex items-center gap-1.5">
                  <span>🏟️</span> הליגות שלי
               </div>
               <div className="flex gap-2.5 overflow-x-auto custom-scrollbar pb-2 snap-x snap-mandatory">
                 {userLeaguesData.length === 0 ? (
                    <div 
                       onClick={() => {
                          sessionStorage.setItem("targetBoard", "LEAGUES");
                          sessionStorage.removeItem("targetLeagueId");
                          setActiveTab("LEADERBOARD");
                       }} 
                       className="min-w-[140px] flex-1 bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/30 backdrop-blur-sm text-center shrink-0 snap-center flex flex-col justify-center cursor-pointer hover:bg-indigo-500/20 transition-all border-dashed group"
                    >
                       <div className="text-xl mb-1 group-hover:scale-110 transition-transform">➕</div>
                       <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">הוסף ליגה פרטית</div>
                    </div>
                 ) : (
                   <>
                     {userLeaguesData.map(league => (
                        <div 
                           key={league.id} 
                           onClick={() => {
                             sessionStorage.setItem("targetBoard", "LEAGUES");
                             sessionStorage.setItem("targetLeagueId", league.id);
                             setActiveTab("LEADERBOARD");
                           }}
                           className="min-w-[120px] flex-1 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/80 backdrop-blur-sm text-center shrink-0 snap-center flex flex-col justify-center transition-all hover:bg-slate-700 hover:border-blue-500/50 cursor-pointer shadow-sm group"
                        >
                           <div className="text-[11px] text-slate-300 font-black mb-1.5 truncate px-1 group-hover:text-white transition-colors" title={league.name}>{league.name}</div>
                           <div className="text-[11px] font-bold text-blue-400 truncate bg-blue-950/40 rounded-md py-0.5 px-2 inline-block mx-auto border border-blue-900/50">מקום {league.rank}</div>
                        </div>
                     ))}
                     <div 
                        onClick={() => {
                           sessionStorage.setItem("targetBoard", "LEAGUES");
                           sessionStorage.removeItem("targetLeagueId");
                           setActiveTab("LEADERBOARD");
                        }} 
                        className="min-w-[70px] bg-slate-800/30 p-2 rounded-xl border border-slate-700 backdrop-blur-sm text-center shrink-0 snap-center flex flex-col justify-center cursor-pointer hover:bg-slate-700/80 transition-all border-dashed group"
                     >
                        <div className="text-lg mb-0.5 group-hover:scale-110 transition-transform opacity-70">⚙️</div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">נהל</div>
                     </div>
                   </>
                 )}
               </div>
            </div>

            <div className="relative z-10 w-full mb-4 pt-4 border-t border-slate-700/50 mt-auto">
               {!nemesisData ? (
                 <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 gap-3 backdrop-blur-sm">
                    <div className="text-xs font-bold text-slate-300 flex items-center gap-2"><span>🎯</span> בחר יריב למעקב:</div>
                    <div className="flex w-full sm:w-auto gap-2">
                      <select 
                        value={nemesisInput} onChange={(e) => setNemesisInput(e.target.value)}
                        className="bg-slate-950 text-white p-2 rounded-lg border border-slate-700 text-xs outline-none focus:border-rose-500 flex-1"
                      >
                        <option value="">משתתפי הליגה...</option>
                        {allUsersList.filter(u => u.id !== userId).map(u => (<option key={u.id} value={u.id}>{u.name}</option>))}
                      </select>
                      <button onClick={handleSaveNemesis} disabled={isSavingNemesis || !nemesisInput} className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors shadow-sm">
                        {isSavingNemesis ? "..." : "קרב!"}
                      </button>
                    </div>
                 </div>
               ) : (
                 <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 relative backdrop-blur-sm shadow-inner">
                    <button onClick={handleClearNemesis} className="absolute top-2 left-2 text-slate-500 hover:text-rose-400 text-xs font-bold p-1">✕</button>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">ראש בראש</div>
                    
                    <div className="flex justify-between items-center px-4 gap-4">
                       <div className="flex flex-col items-center">
                          <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-black mb-1">אתה</span>
                          <span className="text-base font-black text-blue-400 leading-none">{userStats.points}</span>
                       </div>
                       
                       <div className="flex-1 flex flex-col justify-center">
                          {(() => {
                             const myPts = userStats.points; const enemyPts = nemesisData.totalPoints || 0;
                             const total = myPts + enemyPts || 1; const myPercent = (myPts === 0 && enemyPts === 0) ? 50 : Math.round((myPts / total) * 100);
                             const diff = myPts - enemyPts;
                             return (
                               <>
                                 <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden flex border border-slate-700/50">
                                    <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${myPercent}%` }}></div>
                                    <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${100 - myPercent}%` }}></div>
                                 </div>
                                 <div className="text-center mt-1.5 text-[9px] text-slate-400 font-bold">
                                   {diff > 0 ? `מוביל ב-${diff}` : diff < 0 ? `בפיגור ${Math.abs(diff)}` : "שוויון!"}
                                 </div>
                               </>
                             );
                          })()}
                       </div>
                       
                       <div className="flex flex-col items-center">
                          <span className="text-[9px] bg-rose-600 text-white px-1.5 py-0.5 rounded font-black mb-1 truncate max-w-[60px]">{nemesisFirstName}</span>
                          <span className="text-base font-black text-rose-400 leading-none">{nemesisData.totalPoints || 0}</span>
                       </div>
                    </div>
                 </div>
               )}
            </div>

            <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-700/50 relative z-10 text-center">
              <div className="flex-1"><div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">קופת פרסים</div><div className="text-sm font-black text-emerald-400">₪{totalPrizesPool}</div></div>
              <div className="w-px h-6 bg-slate-700/50"></div>
              <div className="flex-1"><div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">משתתפים</div><div className="text-sm font-black text-emerald-400">{leaderboardInfo.totalUsers}</div></div>
              <div className="w-px h-6 bg-slate-700/50"></div>
              <div className="flex-1"><div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">ממוצע קהל</div><div className="text-sm font-black text-emerald-400">{avgPoints}</div></div>
            </div>
         </div>

         <div className="w-[90%] md:w-auto shrink-0 snap-center flex flex-col gap-4 md:gap-6 h-full">
            <div 
               onClick={() => setShowMagazineModal(true)}
               className="bg-slate-900 rounded-3xl p-6 shadow-xl relative overflow-hidden border border-slate-700 group cursor-pointer flex flex-col hover:border-blue-500/50 transition-all duration-300 flex-1"
            >
               <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-emerald-900/10 z-0"></div>
               <div className="absolute -bottom-10 -left-10 text-9xl opacity-5 transform -rotate-12 pointer-events-none group-hover:scale-110 transition-transform duration-500">📰</div>
               <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-blue-400 to-emerald-500"></div>

               <div className="relative z-10 flex justify-between items-start mb-4 shrink-0">
                  <div className="bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 backdrop-blur-sm text-slate-400 text-xs font-bold">
                     {new Date().toLocaleDateString('he-IL')}
                  </div>
                  <div className="text-3xl drop-shadow-md">📰</div>
               </div>

               {dailyMediaUrl && (
                  <div className="relative z-10 mb-5 w-full h-48 md:h-56 rounded-xl overflow-hidden border border-slate-700/50 shadow-inner bg-slate-950/80 flex items-center justify-center shrink-0">
                     {dailyMediaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null ? (
                        <img src={dailyMediaUrl} alt="Magazine Cover" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                     ) : (
                        <video src={dailyMediaUrl} autoPlay loop muted playsInline className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
                     )}
                  </div>
               )}

               <div className="relative z-10 flex-1 flex flex-col">
                  <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-2 shrink-0">המהדורה המרכזית</h2>
                  
                  <div 
                     className="text-slate-300 text-sm font-medium leading-relaxed mb-6 line-clamp-5 flex-1 whitespace-pre-wrap [&_b]:text-amber-400 [&_strong]:text-amber-400 [&_mark]:px-1.5 [&_mark]:rounded [&_mark.yellow]:bg-amber-500/20 [&_mark.yellow]:text-amber-300 [&_mark.green]:bg-emerald-500/20 [&_mark.green]:text-emerald-300 [&_mark.red]:bg-rose-500/20 [&_mark.red]:text-rose-400 [&_a]:text-cyan-400 [&_a]:underline"
                     dangerouslySetInnerHTML={{ __html: dailySubtext || "אין עדכונים מיוחדים הבוקר. שווה לעקוב במהלך היום!" }} 
                  />
                  
                  <button className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 w-full rounded-xl border border-slate-600 transition-colors flex justify-center items-center gap-2 text-sm shadow-md group-hover:bg-blue-600 group-hover:border-blue-500 shrink-0 mt-auto">
                     קרא את המהדורה המלאה <span>👈</span>
                  </button>
               </div>
            </div>

            <Link href="/matrix" className="w-full flex flex-col md:flex-row items-center justify-between bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 hover:from-blue-900/30 hover:to-slate-800 border-2 border-slate-700 hover:border-blue-500/50 p-5 md:p-6 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.4)] transition-all active:scale-[0.98] group relative overflow-hidden shrink-0">
               <div className="absolute top-0 right-0 w-2 h-full bg-blue-500"></div>
               <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-20"></div>
               
               <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 relative z-10 w-full md:w-auto text-center md:text-right mb-4 md:mb-0">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-950 rounded-2xl flex items-center justify-center border border-slate-700 shadow-inner group-hover:scale-110 group-hover:border-blue-500/50 transition-all shrink-0">
                     <span className="animate-eye-blink text-3xl md:text-4xl drop-shadow-lg">👁️</span>
                  </div>
                  <div className="flex flex-col">
                     <span className="font-black text-white text-xl md:text-2xl mb-1 tracking-wide">טבלת הגילוי הנאות</span>
                     <span className="text-xs md:text-sm text-slate-400 font-medium">מי ניחש מה? כנסו לראות.</span>
                  </div>
               </div>
               
               <div className="w-full md:w-auto flex justify-center md:justify-end relative z-10">
                  <div className="bg-blue-600 text-white px-6 md:px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-3 group-hover:bg-blue-500 transition-colors shadow-lg w-full md:w-auto">
                     לכניסה <span className="text-xl">👉</span>
                  </div>
               </div>
            </Link>
         </div>

      </div>

      <div className="bg-slate-900 rounded-3xl border border-slate-700 shadow-xl flex flex-col lg:h-[600px] overflow-hidden relative z-10">
         <div className="flex lg:hidden bg-slate-950 border-b border-slate-700 shrink-0">
            <button onClick={() => setTimelineTab("TODAY")} className={`flex-1 py-4 text-sm font-bold transition-all ${timelineTab === "TODAY" ? "bg-slate-800 text-white border-b-2 border-blue-500" : "text-slate-500 hover:bg-slate-900"}`}>📅 צפוי היום</button>
            <button onClick={() => setTimelineTab("YESTERDAY")} className={`flex-1 py-4 text-sm font-bold transition-all ${timelineTab === "YESTERDAY" ? "bg-slate-800 text-white border-b-2 border-emerald-500" : "text-slate-500 hover:bg-slate-900"}`}>🧾 היה אתמול</button>
         </div>

         <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-800">
            <div className={`${timelineTab === "YESTERDAY" ? "flex" : "hidden"} lg:flex flex-col w-full lg:w-1/2 h-full bg-slate-800/50 lg:border-l border-slate-700`}>
               <div className="hidden lg:flex bg-slate-900/80 px-6 h-20 border-b border-slate-700 justify-between items-center z-10 shadow-sm shrink-0">
                 <h2 className="text-xl font-black text-white flex items-center gap-2"><span>🧾</span> מה היה לנו אתמול?</h2>
                 <div className="flex gap-2">
                   <button onClick={() => setShowRealStandingsModal(true)} className="text-[11px] text-emerald-400 font-bold bg-emerald-900/20 hover:bg-emerald-900/40 px-3 py-2 rounded transition-colors border border-emerald-500/30 whitespace-nowrap flex items-center gap-1.5 shadow-sm active:scale-95"><span className="text-sm">🌍</span> תמונת מצב בתים</button>
                   <button onClick={() => setShowFullHistory(!showFullHistory)} className="text-[11px] text-blue-400 font-bold bg-blue-900/20 hover:bg-blue-900/40 px-3 py-2 rounded transition-colors border border-blue-500/30 whitespace-nowrap shadow-sm active:scale-95">{showFullHistory ? "הצג רק חדשים" : "היסטוריה מלאה"}</button>
                 </div>
               </div>
               
               <div className="flex lg:hidden bg-slate-800 px-4 sm:px-6 py-4 border-b border-slate-700 justify-between items-center z-10 shadow-sm shrink-0 gap-2">
                  <div className="text-sm font-bold text-slate-300">נקודות שנכנסו:</div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setShowRealStandingsModal(true)} className="text-[10px] text-emerald-400 font-bold bg-emerald-900/20 hover:bg-emerald-900/40 px-2.5 py-1.5 rounded transition-colors border border-emerald-500/30 whitespace-nowrap flex items-center gap-1 shadow-sm active:scale-95"><span className="text-sm">🌍</span> תמונת מצב בתים</button>
                    <button onClick={() => setShowFullHistory(!showFullHistory)} className="text-[10px] text-blue-400 font-bold bg-blue-900/20 hover:bg-blue-900/40 px-2.5 py-1.5 rounded transition-colors border border-blue-500/30 whitespace-nowrap shadow-sm active:scale-95">{showFullHistory ? "רק חדשים" : "הכל"}</button>
                  </div>
               </div>
               
               <div className="overflow-y-auto custom-scrollbar flex-1 p-4 md:p-6 space-y-3 bg-slate-900/30">
                  {isFeedLoading ? <div className="text-center py-12 text-slate-500 animate-pulse font-bold text-sm">שולף קבלות...</div> : displayFeed.length === 0 ? <div className="flex flex-col items-center justify-center py-16 opacity-50 h-full"><span className="text-4xl mb-3">🕸️</span><span className="text-slate-400 text-sm font-bold">הקופה ריקה בינתיים.</span></div> : (!showFullHistory && ptsDiff <= 0) ? <div className="flex flex-col items-center justify-center py-16 text-center px-4 h-full"><span className="text-5xl mb-4 opacity-80">📭</span><span className="text-slate-300 font-bold text-lg mb-2">לא נרשמו הכנסות חדשות</span><p className="text-slate-500 text-sm mb-4 leading-relaxed">אל תדאג, המשחקים הבאים מעבר לפינה.</p><button onClick={() => setShowFullHistory(true)} className="text-blue-400 text-sm font-bold underline hover:text-blue-300">הצג את כל הקבלות שאספתי</button></div> : displayFeed.map((item, idx) => {
                    const handleFeedClick = () => {
                      if (item.id.startsWith("gm_")) { 
                         sessionStorage.setItem("targetMatchday", item.matchday || "1");
                         sessionStorage.setItem("scrollToMatch", item.matchId);
                         setActiveTab("PREDICTIONS"); if(setPredictionTab) setPredictionTab("MATCHES");
                      }
                      else if (item.id.startsWith("ko_") || item.id.startsWith("qko_")) { 
                         sessionStorage.setItem("scrollToMatch", item.matchId);
                         setActiveTab("PREDICTIONS"); if(setPredictionTab) setPredictionTab("KNOCKOUT");
                      }
                      else if (item.id.startsWith("q1_") || item.id.startsWith("q2_")) { 
                         setActiveTab("PREDICTIONS"); if(setPredictionTab) setPredictionTab("QUALIFIERS");
                      }
                      else if (item.id.startsWith("t3_")) { 
                         setActiveTab("PREDICTIONS"); if(setPredictionTab) setPredictionTab("THIRD_PLACE");
                      }
                      else if (item.id.startsWith("b_")) { 
                         sessionStorage.setItem("scrollToBonus", item.qId);
                         setActiveTab("PREDICTIONS"); if(setPredictionTab) setPredictionTab("BONUS");
                      }
                    };

                    return (
                      <div key={idx} onClick={handleFeedClick} className="flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700 hover:border-blue-500 hover:bg-slate-700/50 cursor-pointer transition-all group shadow-sm max-w-xl mx-auto w-full active:scale-95">
                         <div className="flex items-center gap-3 md:gap-4">
                            <div className="text-2xl md:text-3xl bg-slate-900 w-12 h-12 flex items-center justify-center rounded-xl shadow-inner shrink-0 group-hover:scale-110 transition-transform">{item.icon}</div>
                            <div><div className="text-white font-bold text-sm md:text-base leading-tight group-hover:text-blue-300 transition-colors">{item.title}</div><div className="text-[11px] md:text-xs text-slate-400 mt-1 font-medium bg-slate-900 inline-block px-2 py-0.5 rounded">{item.desc}</div></div>
                         </div>
                         <div className="text-emerald-400 font-black text-lg md:text-xl bg-emerald-950/30 px-4 py-2 rounded-lg border border-emerald-500/20 shrink-0">+{item.points}</div>
                      </div>
                    );
                  })}
               </div>
            </div>

            <div className={`${timelineTab === "TODAY" ? "flex" : "hidden"} lg:flex flex-col w-full lg:w-1/2 h-full bg-slate-800`}>
               <div className="hidden lg:flex bg-slate-900/80 px-6 h-20 border-b border-slate-700 justify-between items-center z-10 shadow-sm shrink-0">
                 <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 flex items-center gap-2"><span>📅</span> מה צפוי היום?</h2>
                 <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-700/50 shadow-inner">
                   {todayMatches.length > 0 && <button onClick={() => { setActiveBannerMode("MATCHES"); setTodayMatchIndex(0); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isMatchesMode ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}>⚽ משחקים</button>}
                   {todayTargets.length > 0 && <button onClick={() => { setActiveBannerMode("BONUS"); setTodayBonusIndex(0); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeBannerMode === "BONUS" ? "bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}>🎯 מטרות</button>}
                   <button onClick={() => setActiveBannerMode("RADAR")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${activeBannerMode === "RADAR" ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}>🎁 קופת הבונוסים</button>
                 </div>
               </div>

               <div className="flex lg:hidden bg-slate-950 px-4 py-3 border-b border-slate-800 shrink-0 justify-center w-full">
                  <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-700/50 shadow-inner w-full max-w-sm">
                    {todayMatches.length > 0 && <button onClick={() => { setActiveBannerMode("MATCHES"); setTodayMatchIndex(0); }} className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition-all ${isMatchesMode ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}>⚽ משחקים</button>}
                    {todayTargets.length > 0 && <button onClick={() => { setActiveBannerMode("BONUS"); setTodayBonusIndex(0); }} className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition-all ${activeBannerMode === "BONUS" ? "bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}>🎯 מטרות</button>}
                    <button onClick={() => setActiveBannerMode("RADAR")} className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${activeBannerMode === "RADAR" ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}>🎁 בונוסים</button>
                  </div>
               </div>

               <div className="flex-1 p-4 md:p-6 flex flex-col justify-center items-center relative overflow-y-auto">
                  {(todayMatches.length === 0 && todayTargets.length === 0 && activeBannerMode !== "RADAR") ? (
                    <div className="text-center py-10">
                      <div className="text-5xl mb-4 opacity-50">😴</div>
                      <h3 className="text-xl font-bold text-slate-300 mb-2">שקט היום על הדשא</h3>
                      <p className="text-slate-500 text-sm max-w-sm mx-auto">אין משחקים או נבחרות מהבונוסים שלך שמשחקות היום.</p>
                      <button onClick={() => setActiveBannerMode("RADAR")} className="mt-4 text-purple-400 font-bold underline hover:text-purple-300">פתח את קופת הבונוסים המלאה</button>
                    </div>
                  ) : activeBannerMode === "RADAR" ? (
                    <div className="w-full max-w-md mx-auto flex flex-col h-full animate-fade-in-up">
                      <div className="text-center mb-4 shrink-0 bg-slate-950 p-3 rounded-2xl border border-slate-700 shadow-inner">
                        <p className="text-slate-400 text-xs font-bold leading-relaxed">
                          מעקב לייב אחרי מצב שאלות הבונוס שלך לכל אורך הטורניר.<br/>
                          <span className="text-emerald-400">✅ פגעת</span> | <span className="text-amber-400">👑 מוביל</span> | <span className="text-blue-400">🔵 פתוח</span> | <span className="text-rose-400">❌ נפסל</span>
                        </p>
                      </div>
                      
                      <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 space-y-3 pb-2 max-h-[380px] lg:max-h-full">
                        {bonusQuestionsList.length === 0 ? (
                          <div className="text-slate-500 text-center py-8 text-sm font-bold">אין שאלות בונוס במערכת.</div>
                        ) : (
                          bonusQuestionsList.map(q => {
                            const uAns = userBonusAnswersState[q.id];
                            if (!uAns || String(uAns).trim() === "") return null; 

                            const ansStr = String(uAns).trim();
                            const isWinner = realBonusFull.answers?.[q.id]?.includes(ansStr);
                            const isLeading = realBonusFull.leading?.[q.id]?.includes(ansStr);
                            const isLocked = realBonusFull.locked?.[q.id];
                            const isLoser = realBonusFull.blacklist?.[q.id]?.includes(ansStr) || (isLocked && !isWinner);

                            let bgColor = "bg-blue-900/10 border-blue-500/30 hover:bg-blue-900/20";
                            let icon = "🔵";
                            let statusText = "במשחק / פתוח";
                            let textColor = "text-blue-400";

                            if (isWinner) {
                              bgColor = "bg-emerald-900/20 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]";
                              icon = "✅";
                              statusText = "פגיעה בול!";
                              textColor = "text-emerald-400";
                            } else if (isLeading) {
                              bgColor = "bg-amber-900/20 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]";
                              icon = "👑";
                              statusText = "מוביל כרגע";
                              textColor = "text-amber-400";
                            } else if (isLoser) {
                              bgColor = "bg-rose-900/10 border-rose-500/20 opacity-60 grayscale-[30%]";
                              icon = "❌";
                              statusText = "אבוד (נפסל או ננעל)";
                              textColor = "text-rose-400";
                            }

                            return (
                              <div key={q.id} className={`p-4 rounded-xl border transition-all ${bgColor}`}>
                                <div className="flex justify-between items-start mb-2 gap-2">
                                  <span className="text-slate-300 text-xs font-bold leading-tight flex-1">{q.label}</span>
                                  <span className="text-[10px] font-black text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 shrink-0">{q.points} נק'</span>
                                </div>
                                <div className="flex justify-between items-end mt-3">
                                  <div className="flex items-center gap-2">
                                    {getFlagUrl(ansStr) ? <img src={getFlagUrl(ansStr)!} className={`w-6 h-4 object-cover rounded-sm shadow-sm ${isLoser ? 'opacity-50' : ''}`} alt="flag" /> : <span className="text-lg drop-shadow-md">{icon}</span>}
                                    <span className={`font-black text-sm md:text-base ${textColor} ${isLoser ? 'line-through decoration-rose-500/50' : ''}`}>{ansStr}</span>
                                  </div>
                                  <div className={`text-[10px] font-bold ${textColor} ${isLeading && !isWinner ? 'animate-pulse' : ''}`}>{statusText}</div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : isMatchesMode ? (
                    todayMatches.length > 0 && (
                      <div className="w-full max-w-md mx-auto flex flex-col items-center animate-fade-in-up">
                         <div className="flex items-center justify-between w-full bg-slate-950 p-2 rounded-2xl border border-slate-800 mb-6 shadow-inner shrink-0">
                            <button onClick={handlePrevMatch} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 active:scale-95 text-lg">▶</button>
                            <div className="text-sm font-bold text-slate-400">משחק {todayMatchIndex + 1} מתוך {todayMatches.length}</div>
                            <button onClick={handleNextMatch} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 active:scale-95 text-lg">◀</button>
                         </div>

                         {currentDisplayedMatch && (() => {
                            const m = currentDisplayedMatch;
                            const hasPrediction = m.userPrediction && m.userPrediction.predictedHomeScore !== "" && m.userPrediction.predictedAwayScore !== "";
                            const locked = checkIsMatchLocked(m, tournamentState);
                            
                            return (
                              <div className={`w-full relative mt-3 md:mt-4 bg-slate-900 p-6 md:p-8 rounded-3xl border transition-all shadow-xl flex flex-col shrink-0 ${hasPrediction ? "border-blue-500/30" : "border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]"}`}>
                                    {Number(m.matchday) === 3 && m.stage !== "KNOCKOUT" && (
                                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-rose-600 to-red-500 text-white text-[11px] md:text-xs font-black px-5 py-1.5 rounded-full shadow-lg border border-rose-400/50 whitespace-nowrap flex items-center gap-1.5 z-10">                                 <span className="animate-pulse">🔥</span> מחזור הכרעה
                                 </div>
                               )}
                                 
                                 <div className="text-blue-400 text-xs font-bold mb-6 flex justify-between items-center">
                                   <span className="bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">🕒 {m.time}</span>
                                   <span className="bg-blue-900/30 px-3 py-1 rounded-lg border border-blue-500/20">{m.stage === "KNOCKOUT" ? m.roundName : `בית ${m.group}`}</span>
                                 </div>
                                 
                                 <div className="flex justify-between items-center text-white font-bold text-lg mb-6 bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-inner">
                                   <span className="flex-1 flex flex-col items-center gap-2 text-center" title={m.homeTeam}>
                                      {getFlagUrl(m.homeTeam) ? <img src={getFlagUrl(m.homeTeam)!} className="w-8 h-5 object-cover rounded shadow-sm" alt="flag" /> : "🏳️"} 
                                      <span className="truncate max-w-[80px] text-sm md:text-base">{m.homeTeam}</span>
                                   </span>
                                   <span className="text-slate-600 text-sm mx-2 font-black">VS</span>
                                   <span className="flex-1 flex flex-col items-center gap-2 text-center" title={m.awayTeam}>
                                      {getFlagUrl(m.awayTeam) ? <img src={getFlagUrl(m.awayTeam)!} className="w-8 h-5 object-cover rounded shadow-sm" alt="flag" /> : "🏳️"}
                                      <span className="truncate max-w-[80px] text-sm md:text-base">{m.awayTeam}</span>
                                   </span>
                                 </div>

                                 <div className="mt-auto border-t border-slate-700/50 pt-5">
                                   {hasPrediction ? (
                                      <div className="flex flex-col gap-3">
                                         <div className="text-sm font-black text-emerald-400 bg-emerald-900/20 py-3 rounded-xl border border-emerald-500/30 text-center shadow-sm">
                                           הניחוש שלך: {m.userPrediction.predictedHomeScore} - {m.userPrediction.predictedAwayScore}
                                         </div>
                                         {locked ? (
                                           <button onClick={() => handleOpenSpyForMatch(m)} className="w-full text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 py-3 rounded-xl border border-slate-600 text-center shadow-sm flex justify-center items-center gap-2 transition-all">
                                              <span className="text-base">👁️</span> הצג ניחושי חברים (ריגול)
                                           </button>
                                         ) : (
                                           <button onClick={() => { setActiveTab("PREDICTIONS"); if(setPredictionTab) setPredictionTab(m.stage === "KNOCKOUT" ? "KNOCKOUT" : "MATCHES"); }} className="w-full text-xs font-bold text-blue-300 bg-blue-900/20 hover:bg-blue-900/40 py-3 rounded-xl border border-blue-500/30 text-center shadow-sm flex justify-center items-center gap-2 transition-all">
                                              <span className="text-base">✍️</span> עדכן את הניחוש שלך
                                           </button>
                                         )}
                                      </div>
                                   ) : (
                                      <button onClick={() => { setActiveTab("PREDICTIONS"); if(setPredictionTab) setPredictionTab(m.stage === "KNOCKOUT" ? "KNOCKOUT" : "MATCHES"); }} className="w-full text-sm font-bold text-slate-900 bg-amber-500 hover:bg-amber-400 py-3 rounded-xl text-center shadow-md transition-transform active:scale-95 animate-pulse">
                                        הזן ניחוש למשחק זה! ⚠️
                                      </button>
                                   )}
                                 </div>
                              </div>
                            );
                         })()}
                      </div>
                    )
                  ) : (
                    todayTargets.length > 0 && (
                      <div className="w-full max-w-md mx-auto flex flex-col items-center animate-fade-in-up">
                         <div className="flex items-center justify-between w-full bg-slate-950 p-2 rounded-2xl border border-slate-800 mb-6 shadow-inner shrink-0">
                            <button onClick={handlePrevBonus} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 active:scale-95 text-lg">▶</button>
                            <div className="text-sm font-bold text-slate-400">מטרה {todayBonusIndex + 1} מתוך {todayTargets.length}</div>
                            <button onClick={handleNextBonus} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 active:scale-95 text-lg">◀</button>
                         </div>

                         {currentDisplayedBonus && (() => {
                            const target = currentDisplayedBonus;
                            return (
                              <div className="w-full bg-slate-900 p-6 md:p-8 rounded-3xl border border-rose-500/30 shadow-xl flex flex-col text-center shrink-0">
                                 {target.type === "PLAYER" ? (
                              <div className="flex items-center gap-4 bg-slate-800/90 p-4 md:p-5 rounded-2xl border border-blue-500/30 shadow-lg relative overflow-hidden transition-all hover:border-blue-500/50">
                              <div className="absolute top-0 right-0 w-24 h-full bg-blue-500/10 skew-x-12"></div>
                              <div className="relative z-10 shrink-0">
                                    {getFlagUrl(target.team) ? (
                              <div className="relative">
                              <img src={getFlagUrl(target.team)!} className="w-14 h-14 object-cover rounded-full border-2 border-slate-600 shadow-md" alt="flag" />
                              <span className="absolute -bottom-2 -right-2 bg-slate-900 border border-slate-700 rounded-full w-6 h-6 flex items-center justify-center text-xs">🏃‍♂️</span>
                             </div>
                         ) : (
                              <span className="text-4xl drop-shadow-md">🏃‍♂️</span>
                              )}
                             </div>
                             <div className="relative z-10 text-right">
                                     <h4 className="text-white font-bold text-base md:text-lg leading-tight mb-1">
                                     דע לך ש<span className="text-blue-400">{target.name}</span> עולה למגרש!
                                    </h4>
                                    <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
                                        משחק היום עם נבחרת <strong className="text-white">{target.team}</strong>. <br/>
                                        הזדמנות לניקוד בשאלת: <span className="text-amber-400 font-bold">"{target.questionLabel}"</span>.
                                    </p>
                                 </div>
                                 </div>
                                 ) : target.type === "CONTEXTUAL_ALERT" ? (
                                   <div className="flex items-center gap-4 bg-slate-800/90 p-5 rounded-2xl border border-amber-500/30 relative overflow-hidden transition-all shadow-lg text-right">
                                   <div className="absolute top-0 right-0 w-2 h-full bg-amber-500"></div>
                                   <div className="relative z-10 shrink-0">
                                   <div className="relative">
                                   {getFlagUrl(target.team) ? (
                                   <img src={getFlagUrl(target.team)!} className="w-14 h-14 object-cover rounded-full border-2 border-slate-600 shadow-md" alt="flag" />
                                 ) : (
                                   <span className="text-4xl drop-shadow-md">🏃‍♂️</span>
                                  )}
                                    <span className="absolute -bottom-2 -right-2 bg-slate-900 border border-slate-700 rounded-full w-7 h-7 flex items-center justify-center text-xs">⭐</span>
                                  </div>
                               </div>
                              <div className="relative z-10 text-right">
                                 <h4 className="text-white font-bold text-base md:text-lg leading-tight mb-1">
                                      הזדמנות לנקודות עבור <span className="text-amber-400">{target.context}</span>!
                                 </h4>
                                 <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
                                     היום עולה למגרש <strong className="text-white">{target.name}</strong> שמייצג את {target.context} שסימנת בשאלה: <br/>
                                 <span className="text-slate-400 italic mt-1 inline-block">"{target.questionLabel}"</span>
                                </p>
                               </div>
                             </div>
                          ) : target.isSurvival ? (
                                    <>
                                      <div className="text-5xl mb-4 drop-shadow-md">🛡️</div>
                                      <h3 className="text-xl md:text-2xl font-bold text-emerald-400 mb-3">משחק הישרדות!</h3>
                                      <p className="text-sm text-slate-300 leading-relaxed mb-8">
                                        הימרת שזה <strong className="text-rose-400">לא</strong> יקרה לאף נבחרת.<br/>תחזיק אצבעות גם במשחקי היום: <br/>
                                        <strong className="text-white bg-slate-950 px-4 py-2 rounded-xl mt-4 inline-block text-xs border border-slate-700 shadow-inner">"{target.questionLabel}"</strong>
                                      </p>
                                    </>
                                 ) : (
                                    <>
                                      <div className="flex justify-center mb-4">
                                        {getFlagUrl(target.team) ? <img src={getFlagUrl(target.team)!} className="w-16 h-10 object-cover rounded shadow-md" alt="flag" /> : <span className="text-5xl text-rose-400">🏳️</span>}
                                      </div>
                                      <h3 className="text-xl md:text-2xl font-bold text-white mb-3"><span className="text-rose-400">{target.team}</span> עולה לדשא!</h3>
                                      <p className="text-sm text-slate-300 leading-relaxed mb-8">
                                        הרווחת נקודות אם היא תקיים היום את התנאי: <br/>
                                        <strong className="text-white bg-slate-950 px-4 py-2 rounded-xl mt-4 inline-block text-xs border border-slate-700 shadow-inner">"{target.questionLabel}"</strong>
                                      </p>
                                    </>
                                 )}
                                 <div className="mt-auto">
                                   <div className={`text-white px-6 py-4 rounded-xl text-lg font-black shadow-md drop-shadow-md w-full ${target.isSurvival ? "bg-gradient-to-r from-emerald-600 to-teal-500" : "bg-gradient-to-r from-rose-600 to-orange-500"}`}>
                                      קופה אפשרית: +{Number(target.points) || 0} נק'
                                   </div>
                                 </div>
                              </div>
                            );
                         })()}
                      </div>
                    )
                  )}
               </div>
            </div>
         </div>
      </div>

      {/* מודאלים נקיים */}
      {showMagazineModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fade-in-up" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 p-6 md:p-8 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-blue-400 to-emerald-500"></div>
            
            <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-4 pr-4">
              <div>
                <h3 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 flex items-center gap-3">
                   <span className="text-white drop-shadow-md">📰</span> המהדורה המרכזית
                </h3>
                <div className="text-slate-500 text-sm font-medium mt-1">
                   {new Date().toLocaleDateString('he-IL')}
                </div>
              </div>
              <button onClick={() => setShowMagazineModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors font-black text-lg border border-slate-700">✕</button>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 pr-4 pb-4">
                 {dailyMediaUrl && (
                    <div className="w-full rounded-2xl overflow-hidden mb-6 border border-slate-800 shadow-lg">
                       {dailyMediaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null ? (
                          <img src={dailyMediaUrl} alt="Magazine Cover" className="w-full max-h-[300px] md:max-h-[400px] object-contain mx-auto" />
                       ) : (
                          <video src={dailyMediaUrl} autoPlay loop muted playsInline controls className="w-full max-h-[300px] md:max-h-[400px] object-contain mx-auto" />
                       )}
                    </div>
                 )}

                 {dailySubtext && (
                    <div 
                      className="text-slate-300 text-base md:text-lg leading-relaxed mb-6 font-medium whitespace-pre-wrap italic border-r-4 border-slate-600 pr-4 [&_b]:text-amber-400 [&_strong]:text-amber-400 [&_mark]:px-1.5 [&_mark]:rounded [&_mark.yellow]:bg-amber-500/20 [&_mark.yellow]:text-amber-300 [&_mark.green]:bg-emerald-500/20 [&_mark.green]:text-emerald-300 [&_mark.red]:bg-rose-500/20 [&_mark.red]:text-rose-400 [&_a]:text-cyan-400 [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: dailySubtext }}
                    />
                 )}

                 <div className="text-slate-200 text-base md:text-lg leading-relaxed whitespace-pre-wrap
                                 [&_div]:w-full
                                 [&_b]:text-amber-400 [&_strong]:text-amber-400
                                 [&_i]:text-slate-400 [&_u]:underline [&_u]:decoration-blue-400 [&_u]:underline-offset-4
                                 [&_h1]:text-2xl md:[&_h1]:text-3xl [&_h1]:font-black [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:text-transparent [&_h1]:bg-clip-text [&_h1]:bg-gradient-to-r [&_h1]:from-blue-400 [&_h1]:to-emerald-400
                                 [&_h2]:text-xl md:[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-blue-300
                                 [&_h3]:text-lg md:[&_h3]:text-xl [&_h3]:font-bold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-emerald-300
                                 [&_h4]:text-base md:[&_h4]:text-lg [&_h4]:font-bold [&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:text-slate-300
                                 [&_mark]:px-1.5 [&_mark]:rounded [&_mark]:font-bold
                                 [&_mark.yellow]:!bg-amber-500/20 [&_mark.yellow]:!text-amber-300
                                 [&_mark.green]:!bg-emerald-500/20 [&_mark.green]:!text-emerald-300
                                 [&_mark.blue]:!bg-blue-500/20 [&_mark.blue]:!text-blue-300
                                 [&_mark.red]:!bg-rose-500/20 [&_mark.red]:!text-rose-400
                                 [&_blockquote]:border-r-4 [&_blockquote]:border-emerald-500 [&_blockquote]:bg-slate-800/50 [&_blockquote]:p-5 [&_blockquote]:rounded-l-2xl [&_blockquote]:my-6 [&_blockquote]:italic [&_blockquote]:text-slate-300
                                 [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-2 [&_ul]:my-4 [&_ul]:text-slate-300
                                 [&_hr]:border-slate-700 [&_hr]:my-8
                                 [&_img]:inline-block [&_img]:rounded-2xl [&_img]:shadow-lg [&_img]:my-6 [&_img]:max-h-[300px] md:[&_img]:max-h-[400px] [&_img]:w-auto [&_img]:max-w-full [&_img]:object-contain [&_img]:border [&_img]:border-slate-700
                                 [&_a]:text-cyan-400 [&_a]:underline hover:[&_a]:text-cyan-300" 
                      dangerouslySetInnerHTML={{ __html: dailyMessage || "הודעות הנהלה, עדכונים חמים, וכל מה שצריך לדעת כדי לא להישאר מאחור." }} 
                 />
            </div>
            
            <div className="pt-4 mt-2 border-t border-slate-800 flex justify-end">
               <button onClick={() => setShowMagazineModal(false)} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl font-bold transition-colors border border-slate-600">
                  סגור
               </button>
            </div>
          </div>
        </div>
      )}

      {showRealStandingsModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-2 md:p-4 backdrop-blur-md animate-fade-in-up" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 p-2 md:p-6 rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl relative overflow-hidden md:resize">
            
            <div className="flex justify-between items-center mb-4 px-2 pt-2 md:px-0 md:pt-0 border-b border-slate-800 pb-4 shrink-0">
              <div>
                <h3 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
                   <span>🌍</span> תמונת מצב בתים (LIVE)
                </h3>
              </div>
              <button onClick={() => setShowRealStandingsModal(false)} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors font-black text-lg border border-slate-700">✕</button>
            </div>

            <div className="flex-1 w-full bg-slate-900 rounded-xl overflow-hidden shadow-inner flex flex-col">
               <iframe 
                 id="sofa-standings-embed-undefined-58210" 
                 width="100%" 
                 height="100%" 
                 src="https://widgets.sofascore.com/embed/unique-tournament/16/season/58210/multiple-standings?widgetTitle=FIFA+World+Cup&showCompetitionLogo=true&widgetTheme=dark" 
                 frameBorder="0" 
                 scrolling="yes"
                 className="w-full flex-1"
               ></iframe>

            </div>
            
          </div>
        </div>
      )}

      {spyModalMatch && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-fade-in-up" dir="rtl">
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 p-5 md:p-6 rounded-3xl w-full max-w-md md:max-w-[600px] md:min-w-[400px] min-h-[500px] h-[85vh] md:h-[650px] md:max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden md:resize">
            
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-700/50 shrink-0">
                <h3 className="text-xl font-black text-white flex items-center gap-2"><span>🕵️‍♂️</span> חדר בקרה</h3>
                <button onClick={() => setSpyModalMatch(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors font-black border border-slate-700 hover:border-rose-500/30">✕</button>
            </div>
            
            <div className="bg-slate-900 rounded-2xl mb-4 border border-slate-700/50 overflow-hidden shadow-inner shrink-0">
               <div className="bg-slate-800/80 p-2 text-center text-[10px] text-blue-400 font-black uppercase tracking-widest">{spyModalMatch.stage === "KNOCKOUT" ? spyModalMatch.roundName : `מחזור ${Number(spyModalMatch.matchday) || 1}`}</div>
               <div className="p-4 flex justify-between items-center text-sm font-bold text-slate-300 gap-2">
                 <div className="flex flex-col items-center flex-1 w-2/5 text-center">
                   <span className="text-sm sm:text-base font-black text-white mb-1 tracking-tight flex flex-wrap items-center justify-center gap-1.5 w-full leading-snug">
                     {getFlagUrl(spyModalMatch.homeTeam) ? <img src={getFlagUrl(spyModalMatch.homeTeam)!} className="w-6 h-4 object-cover rounded-sm shadow-sm" alt="flag" /> : <span>🏳️</span>}
                     {spyModalMatch.homeTeam}
                   </span>
                   {spyModalMatch.isFinished && <span className="text-emerald-400 text-[10px] uppercase font-black bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/20 mt-1">אמת: {spyModalMatch.realHomeScore}</span>}
                 </div>
                 <span className="text-slate-600 px-1 font-black text-lg">VS</span>
                 <div className="flex flex-col items-center flex-1 w-2/5 text-center">
                   <span className="text-sm sm:text-base font-black text-white mb-1 tracking-tight flex flex-wrap items-center justify-center gap-1.5 w-full leading-snug">
                     {spyModalMatch.awayTeam}
                     {getFlagUrl(spyModalMatch.awayTeam) ? <img src={getFlagUrl(spyModalMatch.awayTeam)!} className="w-6 h-4 object-cover rounded-sm shadow-sm" alt="flag" /> : <span>🏳️</span>}
                   </span>
                   {spyModalMatch.isFinished && <span className="text-emerald-400 text-[10px] uppercase font-black bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/20 mt-1">אמת: {spyModalMatch.realAwayScore}</span>}
                 </div>
               </div>
            </div>

            <div className="mb-4 shrink-0">
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
                <input 
                  type="text" 
                  placeholder="חפש חבר לליגה..." 
                  value={spySearchQuery}
                  onChange={(e) => setSpySearchQuery(e.target.value)}
                  className="w-full bg-slate-950 text-white placeholder-slate-500 rounded-xl py-2.5 pr-10 pl-4 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all shadow-inner"
                />
              </div>
            </div>

            {spyModalMatch && spyModalMatch.isFinished && (() => {
              const spyStats = { exact: 0, direction: 0, miss: 0 };
              spyData.forEach(d => {
                const pH = Number(d.predictedHomeScore); const pA = Number(d.predictedAwayScore);
                const rH = Number(spyModalMatch.realHomeScore); const rA = Number(spyModalMatch.realAwayScore);
                if (pH === rH && pA === rA) spyStats.exact++;
                else if (Math.sign(pH - pA) === Math.sign(rH - rA)) spyStats.direction++;
                else spyStats.miss++;
              });

              return (
                <div className="grid grid-cols-2 md:flex md:justify-center gap-2 mb-4 shrink-0">
                  <button onClick={() => setSpyFilter("ALL")} className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1 ${spyFilter === "ALL" ? "bg-slate-700 text-white border-slate-500 shadow-sm" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"}`}>
                    הכל ({spyData.length})
                  </button>
                  <button onClick={() => setSpyFilter("EXACT")} className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1.5 ${spyFilter === "EXACT" ? "bg-emerald-900/40 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.15)]" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"}`}>
                    🎯 בול ({spyStats.exact})
                  </button>
                  <button onClick={() => setSpyFilter("DIRECTION")} className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1.5 ${spyFilter === "DIRECTION" ? "bg-amber-900/40 text-amber-400 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.1)]" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"}`}>
                    ✅ כיוון ({spyStats.direction})
                  </button>
                  <button onClick={() => setSpyFilter("MISS")} className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1.5 ${spyFilter === "MISS" ? "bg-rose-900/40 text-rose-400 border-rose-500/50 shadow-[0_0_10px_rgba(225,29,72,0.1)]" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"}`}>
                    ❌ נפילה ({spyStats.miss})
                  </button>
                </div>
              );
            })()}
            
            <div className="overflow-y-auto custom-scrollbar flex-1 pl-2 md:pl-4 pr-1 pb-2">
              {isLoadingSpy ? (<div className="flex justify-center py-8 text-blue-400 animate-pulse font-black tracking-wide">טוען נתונים מהשטח... ⏳</div>) : filteredSpyData.length === 0 ? (<div className="text-center text-slate-500 py-8 font-bold">לא נמצאו ניחושים שמתאימים לחיפוש.</div>) : (
                <div className="space-y-2">
                  {filteredSpyData.map((data, idx) => {
                    
                    let cardStyle = "px-3 py-2.5 rounded-xl border transition-all ";
                    if (spyModalMatch.isFinished) {
                      const pH = Number(data.predictedHomeScore); const pA = Number(data.predictedAwayScore);
                      const rH = Number(spyModalMatch.realHomeScore); const rA = Number(spyModalMatch.realAwayScore);
                      if (pH === rH && pA === rA) cardStyle += "bg-emerald-900/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]";
                      else if (Math.sign(pH - pA) === Math.sign(rH - rA)) cardStyle += "bg-amber-900/10 border-amber-500/30";
                      else cardStyle += "bg-rose-900/10 border-rose-500/20 opacity-80";
                    } else {
                      cardStyle += data.userId === userId ? "bg-blue-900/10 border-blue-500/30" : "bg-slate-900/50 border-slate-800 hover:bg-slate-800";
                    }

                    return (
                      <div key={idx} className={cardStyle}>
                        <div className="flex justify-between items-center mb-2">
                            <div className="font-bold text-slate-200 flex items-center gap-2">
                              <div className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black border shrink-0 ${
                                data.userRank === 1 ? "bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.3)]" :
                                data.userRank === 2 ? "bg-slate-400/20 text-slate-300 border-slate-400/50 shadow-[0_0_8px_rgba(148,163,184,0.2)]" :
                                data.userRank === 3 ? "bg-orange-700/30 text-orange-400 border-orange-500/40 shadow-[0_0_8px_rgba(249,115,22,0.2)]" :
                                "bg-slate-600 text-white border-slate-500 shadow-sm"
                              }`}>
                                {data.userRank || "-"}
                              </div>
                              <span className="text-sm truncate max-w-[110px] sm:max-w-[160px]">{data.userName}</span>
                              {data.userId === userId && <span className="text-[8px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase">אתה</span>}
                            </div>
                            <div className="text-[9px] font-bold text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-700/50 shrink-0">
                              סה״כ: <span className="text-amber-400">{data.userTotalPoints}</span>
                            </div>
                        </div>
                        
                        <div className="flex justify-between items-center">
                            <div className="flex justify-center items-center gap-3 pl-2">
                                <span className="text-lg font-black text-white bg-slate-950 border border-slate-700 w-9 h-9 flex items-center justify-center rounded-lg shadow-inner">{data.predictedHomeScore}</span>
                                <span className="text-slate-600 font-black text-sm">:</span>
                                <span className="text-lg font-black text-white bg-slate-950 border border-slate-700 w-9 h-9 flex items-center justify-center rounded-lg shadow-inner">{data.predictedAwayScore}</span>
                            </div>
                            
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              {spyModalMatch.stage === "KNOCKOUT" && data.qualifier && (
                                <span className="text-[9px] bg-purple-500/10 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/20 font-bold uppercase tracking-wide flex items-center gap-1 w-fit">
                                  {getFlagUrl(data.qualifier) ? <img src={getFlagUrl(data.qualifier)!} className="w-3 h-2 object-cover rounded-sm shadow-sm" alt="flag" /> : <span className="text-[8px]">🏳️</span>}
                                  {data.qualifier}
                                </span>
                              )}
                              
                              {spyModalMatch.isFinished && data.points !== null && (
                                <div>
                                  {getPointsBadge(data.points)}
                                </div>
                              )}
                            </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* --- סעיף 4: הוספת המודאל של ה-Wrapped --- */}
      {showWrappedModal && (
        <WrappedModal 
          onClose={() => setShowWrappedModal(false)}
          userName={userName || safeUserName}
          userStats={userStats}
          allUsersList={allUsersList}
          nemesisData={nemesisData}
        />
      )}
      {/* ----------------------------------------- */}
    </div>
  );
}