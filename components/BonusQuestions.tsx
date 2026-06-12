"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { doc, getDoc, setDoc, collection, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "../app/firebase";
import { getFlagUrl } from "../app/utils/flags";
import AutocompleteInput from "./AutocompleteInput";
import { TOP_PLAYERS_NAMES, getPlayerInfo } from "../app/utils/players";
import toast from "react-hot-toast";

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
const CLUB_ICONS: Record<string, string> = {
  "ריאל מדריד": "/real_madrid_footballteam_18009.png",
  "ברצלונה": "/fc_barcelona_footballteam_18015.png",
  "מנצ'סטר סיטי": "/manchester_city_17974.png",
  "ארסנל": "/arsenal_17995.png",
  "באיירן מינכן": "/Bayern_Munchen_icon-icons.com_75868.png",
  "פריז סן ז'רמן": "/france_paris-saint-germain.football-logos.cc.svg"

};

const TEAM_EMOJIS: Record<string, string> = {
  "מקסיקו": "🇲🇽", "דרום אפריקה": "🇿🇦", "קוריאה הדרומית": "🇰🇷", "צ'כיה": "🇨🇿",
  "קנדה": "🇨🇦", "בוסניה": "🇧🇦", "קטר": "🇶🇦", "שווייץ": "🇨🇭",
  "ברזיל": "🇧🇷", "מרוקו": "🇲🇦", "האיטי": "🇭🇹", "סקוטלנד": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "ארה\"ב": "🇺🇸", "פרגוואי": "🇵🇾", "אוסטרליה": "🇦🇺", "טורקיה": "🇹🇷",
  "גרמניה": "🇩🇪", "קוראסאו": "🇨🇼", "חוף השנהב": "🇨🇮", "אקוודור": "🇪🇨",
  "הולנד": "🇳🇱", "יפן": "🇯🇵", "שוודיה": "🇸🇪", "תוניסיה": "🇹🇳",
  "בלגיה": "🇧🇪", "מצרים": "🇪🇬", "איראן": "🇮🇷", "ניו זילנד": "🇳🇿",
  "ספרד": "🇪🇸", "כף ורדה": "🇨🇻", "סעודיה": "🇸🇦", "אורוגוואי": "🇺🇾",
  "צרפת": "🇫🇷", "סנגל": "🇸🇳", "עיראק": "🇮🇶", "נורווגיה": "🇳🇴",
  "ארגנטינה": "🇦🇷", "אלג'יריה": "🇩🇿", "אוסטריה": "🇦🇹", "ירדן": "🇯🇴",
  "פורטוגל": "🇵🇹", "קונגו": "🇨🇬", "אוזבקיסטן": "🇺🇿", "קולומביה": "🇨🇴",
  "אנגליה": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "קרואטיה": "🇭🇷", "גאנה": "🇬🇭", "פנמה": "🇵🇦"
};

export default function BonusQuestions({ userId, tournamentState: propTournamentState, groups }: any) {
  let extractedTeams: string[] = [];
  if (groups) {
    Object.values(groups).forEach((g: any) => {
      if (g instanceof Set) {
        g.forEach((val) => {
          if (typeof val === 'string') extractedTeams.push(val);
        });
      } else if (Array.isArray(g)) {
        g.forEach((val) => {
          if (typeof val === 'string') extractedTeams.push(val);
        });
      }
    });
  }
  const allTeams = Array.from(new Set(extractedTeams)).filter(t => t.trim() !== "").sort();
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any>({});
  
  const [realBonusData, setRealBonusData] = useState<any>({});
  const [realBonusAnswers, setRealBonusAnswers] = useState<any>({});
  
  const [tournamentState, setTournamentState] = useState<number>(propTournamentState || 0);
  // 1. הוספת האזנה חיה לסטטוס הטורניר
  const [localTournamentState, setLocalTournamentState] = useState(tournamentState);

    useEffect(() => {
        const unsubSys = onSnapshot(doc(db, "settings", "system"), (docSnap) => {
        if (docSnap.exists()) {
           setLocalTournamentState(Number(docSnap.data().tournamentState) || 0);
        }
  });
  return () => unsubSys();
}, []);
  const [bonusCategory, setBonusCategory] = useState<string>("TOURNAMENT");
  const [knockoutRound, setKnockoutRound] = useState<string>("ALL");
  const [weightTab, setWeightTab] = useState<string>("REGULAR");
  
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isLoading, setIsLoading] = useState(true);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [spyModalQuestion, setSpyModalQuestion] = useState<any | null>(null);
  const [spyData, setSpyData] = useState<any[]>([]);
  const [isLoadingSpy, setIsLoadingSpy] = useState(false);

  const [spySearchQuery, setSpySearchQuery] = useState("");
  const [spyFilter, setSpyFilter] = useState<"ALL" | "CORRECT" | "INCORRECT">("ALL");

  const isLoaded = useRef(false);
  const isUserAction = useRef(false);
  const hasAutoNavigated = useRef(false); 

  const [nowMs, setNowMs] = useState(Date.now());
  const [allMatches, setAllMatches] = useState<any[]>([]);

  useEffect(() => {
  const fetchMatches = async () => {
    const mSnap = await getDocs(collection(db, "matches"));
    setAllMatches(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };
  fetchMatches();
}, []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent;
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
        setIsMobile(true);
      }
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const qSnap = await getDoc(doc(db, "settings", "bonus_questions"));
        if (qSnap.exists()) setQuestions(qSnap.data().questions || []);

        const aSnap = await getDoc(doc(db, "predictions_bonus", userId));
        if (aSnap.exists()) setAnswers(aSnap.data().answers || {});

        const tSnap = await getDoc(doc(db, "settings", "system"));
        if (tSnap.exists()) setTournamentState(Number(tSnap.data().tournamentState) || 0);

        const rSnap = await getDoc(doc(db, "admin_results", "bonus"));
        if (rSnap.exists()) {
           setRealBonusData(rSnap.data());
           setRealBonusAnswers(rSnap.data().answers || {});
        }

      } catch (e) { console.error(e); } 
      finally { isLoaded.current = true; setIsLoading(false); }
    };
    if (userId) fetchData();
  }, [userId]);

  useEffect(() => {
    if (questions.length === 0) return;

    const targetBonusId = sessionStorage.getItem("scrollToBonus");
    if (targetBonusId) {
      const targetQuestion = questions.find(q => q.id === targetBonusId);
      if (targetQuestion) {
         setBonusCategory(targetQuestion.phase || "TOURNAMENT");
         if (targetQuestion.phase === "KNOCKOUT") setKnockoutRound(targetQuestion.knockoutRound || "ALL");
         
         if (targetQuestion.isSurprise) setWeightTab("SURPRISE");
         else if (targetQuestion.isDouble) setWeightTab("DOUBLE");
         else setWeightTab("REGULAR");
      }
      setTimeout(() => {
        const el = document.getElementById(`bonus-${targetBonusId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        sessionStorage.removeItem("scrollToBonus");
      }, 500);
      hasAutoNavigated.current = true;
      return;
    }
    
    if (!hasAutoNavigated.current) {
       const activeSurprise = questions.find(q => {
          if (!q.isSurprise || !q.openTime || !q.closeTime) return false;
          const open = parseDateTimeLocal(q.openTime);
          const close = parseDateTimeLocal(q.closeTime);
          return nowMs >= open && nowMs <= close && (!answers[q.id] || String(answers[q.id]).trim() === "");
       });
       
       if (activeSurprise) {
          setBonusCategory(activeSurprise.phase || "TOURNAMENT");
          if (activeSurprise.phase === "KNOCKOUT") {
             setKnockoutRound(activeSurprise.knockoutRound || "ALL");
          }
          setWeightTab("SURPRISE");
       }
       hasAutoNavigated.current = true;
    }
  }, [questions, answers, nowMs]);

  useEffect(() => {
    if (!isLoaded.current || !isUserAction.current) return;
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        await setDoc(doc(db, "predictions_bonus", userId), { answers, updatedAt: new Date() }, { merge: true });
        setSaveStatus("saved");
        isUserAction.current = false;
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (e) { setSaveStatus("idle"); }
    }, 800);
    return () => clearTimeout(timer);
  }, [answers, userId]);

  const handleChange = (qId: string, val: string) => {
    isUserAction.current = true;
    setAnswers((prev: any) => ({ ...prev, [qId]: val }));
  };

  const isQuestionLocked = (q: any) => {
    if (realBonusData.locked?.[q.id]) return true; 
    if (realBonusAnswers[q.id] && realBonusAnswers[q.id].length > 0) return true; 

    if (q.isSurprise) {
      if (!q.openTime || !q.closeTime) return false;
      const open = parseDateTimeLocal(q.openTime);
      const close = parseDateTimeLocal(q.closeTime);
      return nowMs < open || nowMs > close; 
    }

    const state = localTournamentState;
    if (state === 0) return false;
    if (q.phase === "TOURNAMENT" || q.phase === "GROUPS") return state >= 1;
    if (q.phase === "KNOCKOUT") {
if (!q.knockoutRound || q.knockoutRound === "" || q.knockoutRound === "ALL" || q.knockoutRound.includes("כללי") || q.knockoutRound === "32 הגדולות") return state >= 5;      if (q.knockoutRound === "שמינית גמר") return state >= 7;
      if (q.knockoutRound === "רבע גמר") return state >= 9;
      if (q.knockoutRound === "חצי גמר") return state >= 11;
      // הסרנו מכאן את מקום שלישי
      if (q.knockoutRound === "גמר") return state >= 13;
    }
    return false;
  };

  const checkAnswerPoints = (q: any, userAnswer: string) => {
    const truth = realBonusAnswers[q.id];
    if (!truth || !userAnswer) return null;
    const truthArray = Array.isArray(truth) ? truth : [truth];
    
  if (q.isProximity && q.answerType === "NUMBER_PURE") {
    const truthNum = Number(truthArray[0]);
    const ansNum = Number(userAnswer);
    if (!isNaN(truthNum) && !isNaN(ansNum)) {
      const diff = Math.abs(truthNum - ansNum);
      if (diff === 0) return 50;
      if (diff <= 5) return 40;
      if (diff <= 10) return 30;
      if (diff <= 15) return 20;
      if (diff <= 20) return 10;
      return 0;
    }
  }
    const isCorrect = truthArray.some((t: string) => t.toString().trim() === userAnswer.toString().trim());
    return isCorrect ? q.points : 0;
  };

  const handleRandomizeSingle = (q: any) => {
    if (isQuestionLocked(q)) return;
    
    let ans = "";
    const currentAnswerType = q.answerType || "TEAM";

    if (currentAnswerType === "TEAM") {
       let opts = q.specificTeams ? q.specificTeams.split(",").map((s:string)=>s.trim()).filter(Boolean) : allTeams;
       if (opts.length === 0) opts = allTeams;
       if (q.hasNoneOption) opts.push("אף נבחרת");
       if (q.hasAllOption) opts.push("כל הנבחרות");
       ans = opts[Math.floor(Math.random() * opts.length)];
       
    } else if (currentAnswerType === "MATCH") {
       // שליפת משחק אקראי מתוך מאגר המשחקים הטעון
       const relevantMatches = allMatches.filter(m => {
          if (q.phase === "GROUPS") return m.stage !== "KNOCKOUT";
          if (q.phase === "KNOCKOUT") {
              return m.stage === "KNOCKOUT" && (!q.knockoutRound || q.knockoutRound === "ALL" || m.roundName === q.knockoutRound);
          }
          return true; 
       });
       
       if (relevantMatches.length > 0) {
          const randM = relevantMatches[Math.floor(Math.random() * relevantMatches.length)];
          ans = `${randM.homeTeam} - ${randM.awayTeam}`;
       }
       
    } else if (["CUSTOM", "CLUB"].includes(currentAnswerType)) {
       // כאן הסרנו את המילה "MATCH" כדי שלא תתנגש!
       const opts = q.possibleOptions ? q.possibleOptions.split(",").map((s:string)=>s.trim()).filter(Boolean) : [];
       if (opts.length > 0) ans = opts[Math.floor(Math.random() * opts.length)];

    } else if (currentAnswerType === "PLAYER") {
       ans = TOP_PLAYERS_NAMES[Math.floor(Math.random() * TOP_PLAYERS_NAMES.length)];

    } else if (currentAnswerType === "NUMBER_PURE" || currentAnswerType === "NUMBER_MINUTE") {
       ans = Math.floor(Math.random() * 15 + 1).toString();
    }
    
    if (ans) {
      isUserAction.current = true;
      setAnswers((prev: any) => ({ ...prev, [q.id]: ans }));
      toast.success(`הוגרלה תשובה! 🎲`, { id: `rand_${q.id}` });
      setTimeout(() => toast.dismiss(`rand_${q.id}`), 2000); // חיסול ממוקד לאייפון
    } else {
      // אם אין משחקים רלוונטיים עדיין, נקפיץ שגיאה כדי שתדע
      toast.error(`לא מצאתי אופציות להגרלה`, { id: `rand_${q.id}` });
      setTimeout(() => toast.dismiss(`rand_${q.id}`), 2000); // חיסול ממוקד לאייפון
    }
  };

  const handleRandomizeCategory = () => {
    toast((t) => (
      <div className="flex flex-col gap-3 text-right" dir="rtl">
        <span className="font-bold text-slate-800 text-sm">
          האם להגריל תשובות לכל השאלות בטאב זה? <br/>
          <span className="text-xs text-rose-600 font-bold">(שים לב: פעולה זו תדרוס ניחושים קיימים!)</span>
        </span>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              // 1. מעיפים את שאלת האישור מיד
              toast.dismiss(t.id);
              
              // 2. השהיית ניתוק-המגע הקריטית של אפל
              setTimeout(async () => {
                setIsRandomizing(true);
                toast.loading("מגריל ושומר במסד הנתונים...", { id: "randomizeBonus" });
                
                try {
                  const newAnswers = { ...answers };
                  let hasChanges = false;
                  
                  // שימוש במערך השאלות המסונן התקין במקום במשתנה שלא היה קיים
                  filteredQuestions.forEach(q => {
                    if (!isQuestionLocked(q)) {
                      let ans = "";
                      const currentAnswerType = q.answerType || "TEAM";

                      if (currentAnswerType === "TEAM") {
                         let opts = q.specificTeams ? q.specificTeams.split(",").map((s:string)=>s.trim()).filter(Boolean) : allTeams;
                         if (opts.length === 0) opts = allTeams;
                         if (q.hasNoneOption) opts.push("אף נבחרת");
                         if (q.hasAllOption) opts.push("כל הנבחרות");
                         ans = opts[Math.floor(Math.random() * opts.length)];
                         
                      } else if (currentAnswerType === "MATCH") {
                         const relevantMatches = allMatches.filter(m => {
                            if (q.phase === "GROUPS") return m.stage !== "KNOCKOUT";
                            if (q.phase === "KNOCKOUT") {
                                return m.stage === "KNOCKOUT" && (!q.knockoutRound || q.knockoutRound === "ALL" || m.roundName === q.knockoutRound);
                            }
                            return true; 
                         });
                         if (relevantMatches.length > 0) {
                            const randM = relevantMatches[Math.floor(Math.random() * relevantMatches.length)];
                            ans = `${randM.homeTeam} - ${randM.awayTeam}`;
                         }
                         
                      } else if (["CUSTOM", "CLUB"].includes(currentAnswerType)) {
                         const opts = q.possibleOptions ? q.possibleOptions.split(",").map((s:string)=>s.trim()).filter(Boolean) : [];
                         if (opts.length > 0) ans = opts[Math.floor(Math.random() * opts.length)];

                      } else if (currentAnswerType === "PLAYER") {
                         ans = TOP_PLAYERS_NAMES[Math.floor(Math.random() * TOP_PLAYERS_NAMES.length)];

                      } else if (currentAnswerType === "NUMBER_PURE" || currentAnswerType === "NUMBER_MINUTE") {
                         ans = Math.floor(Math.random() * 15 + 1).toString();
                      }
                      
                      if (ans) {
                        newAnswers[q.id] = ans;
                        hasChanges = true;
                      }
                    }
                  });

                  if (hasChanges) {
                    setAnswers(newAnswers);
                    await setDoc(doc(db, "predictions_bonus", userId), { answers: newAnswers, updatedAt: new Date() }, { merge: true });
                    toast.success("הוגרלו ונשמרו תשובות בהצלחה 🎲", { id: "randomizeBonus" });
                    setTimeout(() => toast.dismiss("randomizeBonus"), 2500); // כפיית מחיקה לאייפון
                  } else {
                    toast.error("אין שאלות פתוחות להגרלה", { id: "randomizeBonus" });
                    setTimeout(() => toast.dismiss("randomizeBonus"), 2500); // כפיית מחיקה לאייפון
                  }
                } catch(e) { 
                  console.error(e); 
                  toast.error("שגיאה בשמירת ההגרלה", { id: "randomizeBonus" });
                  setTimeout(() => toast.dismiss("randomizeBonus"), 2500); // כפיית מחיקה לאייפון
                } 
                finally { setIsRandomizing(false); }
              }, 100); // <-- סיום ה-setTimeout הקצרצר
            }} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
          >
            כן, דרוס והגרל
          </button>
          <button 
            onClick={() => toast.dismiss(t.id)} 
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold"
          >
            ביטול
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const filteredQuestions = questions.filter(q => {
    if (q.phase !== bonusCategory) return false;
    if (bonusCategory === "KNOCKOUT") {
       // התיקון: מזהים את כל הוריאציות של שאלות "כללי" ומשייכים אותן לטאב ALL
       const qRound = (!q.knockoutRound || q.knockoutRound === "" || q.knockoutRound === "ALL" || q.knockoutRound.includes("כללי")) ? "ALL" : q.knockoutRound;
       if (qRound !== knockoutRound) return false;
    }
    return true;
  });
const regularQuestions = filteredQuestions.filter(q => !q.isDouble && !q.isSurprise);
  const doubleQuestions = filteredQuestions.filter(q => q.isDouble && !q.isSurprise);
  const surpriseQuestions = filteredQuestions.filter(q => q.isSurprise);
// --- חישוב מדדי התקדמות (Progress Bars) ---
  const getActiveKnockoutRound = () => {
    const state = localTournamentState;
    if (state < 5) return "32 הגדולות";
    if (state >= 5 && state < 7) return "שמינית גמר";
    if (state >= 7 && state < 9) return "רבע גמר";
    if (state >= 9 && state < 11) return "חצי גמר";
    return "גמר";
  };

  const activeKnockoutRound = getActiveKnockoutRound();

  const progressStats = useMemo(() => {
    const stats = {
      TOURNAMENT: { total: 0, answered: 0 },
      GROUPS: { total: 0, answered: 0 },
      KNOCKOUT: { total: 0, answered: 0 }
    };

    const isAnswered = (qId: string) => !!answers[qId] && String(answers[qId]).trim() !== "";

    questions.forEach(q => {
      // לא סופרים שאלות הפתעה במד ההתקדמות הרגיל כי הן לא תמיד זמינות
      if (q.isSurprise) return; 

      const answered = isAnswered(q.id) ? 1 : 0;
      
      if (q.phase === "TOURNAMENT") {
        stats.TOURNAMENT.total++;
        stats.TOURNAMENT.answered += answered;
      } else if (q.phase === "GROUPS") {
        stats.GROUPS.total++;
        stats.GROUPS.answered += answered;
      } else if (q.phase === "KNOCKOUT") {
        const qRound = (!q.knockoutRound || q.knockoutRound === "" || q.knockoutRound === "ALL" || q.knockoutRound.includes("כללי")) ? "ALL" : q.knockoutRound;
        
        // הלוגיקה שביקשת: שאלות כלליות + השלב הספציפי שבו אנו נמצאים
        if (qRound === "ALL" || qRound === activeKnockoutRound) {
          stats.KNOCKOUT.total++;
          stats.KNOCKOUT.answered += answered;
        }
      }
    });

    return stats;
  }, [questions, answers, activeKnockoutRound]);
  // פונקציית עזר שמרנדרת כרטיסיית שאלה בודדת - עברה "דיאטה" קלה כדי לחסוך מקום בגלילה
  const renderQuestionCard = (q: any) => {
    const locked = isQuestionLocked(q);
    // הגנה קפדנית: מוודא שיש ערך ממשי ולא רק מערך ריק
    const hasTruth = realBonusAnswers[q.id] && (Array.isArray(realBonusAnswers[q.id]) ? realBonusAnswers[q.id].length > 0 : String(realBonusAnswers[q.id]).trim() !== "");
    const hasLeading = realBonusData.leading?.[q.id] && (Array.isArray(realBonusData.leading[q.id]) ? realBonusData.leading[q.id].length > 0 : String(realBonusData.leading[q.id]).trim() !== "");
    
    const myPoints = checkAnswerPoints(q, answers[q.id]);
    
    const openMs = q.openTime ? parseDateTimeLocal(q.openTime) : 0;
    const isWaitingToOpen = q.isSurprise && nowMs < openMs;

    let cardStyle = "bg-slate-900 border-slate-700";
    let shadowStyle = "shadow-md";
    
    if (q.isSurprise) {
      cardStyle = "bg-purple-900/20 border-purple-500/50";
      shadowStyle = "shadow-[0_0_15px_rgba(168,85,247,0.15)]";
    } else if (q.isDouble) {
      cardStyle = "bg-rose-900/20 border-rose-500/50";
      shadowStyle = "shadow-[0_0_15px_rgba(225,29,72,0.15)]";
    }
    
    if (locked) {
       cardStyle = "bg-slate-900 border-slate-700 opacity-80 grayscale-[20%]";
       shadowStyle = "shadow-sm";
    }
    
    if (isWaitingToOpen) {
       cardStyle = "bg-slate-900 border-purple-500/50 opacity-90";
    }

    const currentAnswerType = q.answerType || "TEAM";

    return (
      <div key={q.id} id={`bonus-${q.id}`} className={`${cardStyle} p-4 md:p-5 rounded-2xl border ${shadowStyle} flex flex-col h-full transition-all duration-300`}>
         
         <div className="flex justify-between items-start mb-3 gap-3">
            <div className="flex flex-col gap-1.5">
              {!isWaitingToOpen && (
                <div className="flex flex-wrap gap-1.5">
                <span className="text-xs md:text-sm font-black text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg w-fit border border-slate-800 shadow-sm flex items-center gap-1.5">
                     קופה: <span className={`${q.isDouble ? "text-rose-400" : "text-amber-400"} text-sm md:text-base drop-shadow-sm`}>
                     {q.isProximity ? "עד 50" : q.points} נק'
                     </span>
                </span>
                {q.isProximity && (
                <span className="text-[10px] font-black text-orange-400 bg-orange-950/30 px-2 py-0.5 rounded w-fit border border-orange-500/50">
                🤪 בעל הבית השתגע
               </span>
               )}
             {q.isDouble && <span className="text-[10px] font-black text-rose-400 bg-rose-950/30 px-2 py-0.5 rounded border border-rose-500/30">🔥 Double</span>}
              </div>
              )}
              
              {isWaitingToOpen && (
                 <span className="text-[10px] font-black text-purple-400 bg-purple-900/50 px-2 py-0.5 rounded w-fit border border-purple-500/50 flex items-center gap-1">
                    🎁 הפתעה בדרך!
                 </span>
              )}
            </div>
            
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="flex gap-1.5">
                 {!locked && !isWaitingToOpen && (
                    <button 
                      onClick={() => handleRandomizeSingle(q)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-md transition-all active:scale-95 border border-slate-600"
                      title="הגרל תשובה לשאלה זו"
                    >
                      🎲
                    </button>
                 )}
                 {q.isSurprise && !isWaitingToOpen && <span className="bg-purple-600 w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-md" title="שאלת הפתעה!">🎁</span>}
                 {q.isDouble && !q.isSurprise && <span className="bg-rose-600 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-md text-white" title="ניקוד כפול!">X2</span>}
              </div>
              {hasTruth && myPoints !== null && !isWaitingToOpen && (
                 <span className={`px-2 py-0.5 rounded text-[10px] font-black shadow-sm border ${myPoints > 0 ? "bg-emerald-900/40 text-emerald-400 border-emerald-500/50" : "bg-rose-950/50 text-rose-400 border-rose-500/40"}`}>
                   {myPoints > 0 ? `🎯 +${myPoints} נק'` : "0 נק'"}
                 </span>
              )}
            </div>
         </div>
         
         <h3 className="text-white font-bold text-base md:text-lg leading-snug mb-2">
           {isWaitingToOpen ? "שאלת הפתעה סודית..." : q.label}
         </h3>
         
         {hasLeading && !locked && !isWaitingToOpen && (
            <div className="text-[10px] font-bold text-amber-400 bg-amber-950/30 px-2 py-1 rounded-lg border border-amber-500/20 mb-3 inline-flex items-center gap-1.5 w-fit">
               <span className="animate-pulse">👑 מובילה כרגע:</span> 
               {Array.isArray(realBonusData.leading[q.id]) ? realBonusData.leading[q.id].join(', ') : realBonusData.leading[q.id]}
            </div>
         )}

         <div className="mt-8 pt-3 flex flex-col">
            {isWaitingToOpen ? (
               <div className="bg-slate-950/80 border border-slate-700 p-4 rounded-xl text-center shadow-inner">
                  <span className="text-3xl block mb-2 opacity-80 animate-bounce">🎁</span>
                  <h4 className="text-purple-400 font-bold text-sm mb-1">השאלה תיחשף בקרוב!</h4>
                  <p className="text-slate-400 text-[10px]">הכינו את הניחושים שלכם.</p>
               </div>
            ) : currentAnswerType === "TEAM" ? (() => {
               const teamOpts = q.specificTeams ? q.specificTeams.split(",").map((s:string)=>s.trim()).filter(Boolean) : [];
               const finalOpts = teamOpts.length > 0 ? teamOpts : allTeams;
               const extras = [];
               if (q.hasNoneOption) extras.push("אף נבחרת");
               if (q.hasAllOption) extras.push("כל הנבחרות");
               
               const totalOptionsCount = finalOpts.length + extras.length;
               if (teamOpts.length > 0 && totalOptionsCount <= 8) {
                  const allOpts = [...extras, ...finalOpts];
                  return (
                     <div className="flex flex-col gap-1.5">
                        {allOpts.map((opt: string) => (
                           <button
                              key={opt}
                              onClick={() => !locked && handleChange(q.id, opt)}
                              disabled={locked}
                              className={`w-full py-2.5 px-3 rounded-xl font-bold text-sm text-right transition-all flex items-center gap-3 ${answers[q.id] === opt ? "bg-amber-600/20 text-amber-400 border border-amber-500 shadow-md" : "bg-slate-950 text-slate-400 border border-slate-700 hover:bg-slate-800"} ${locked && answers[q.id] !== opt ? "opacity-50 cursor-not-allowed" : ""}`}
                           >
                              <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${answers[q.id] === opt ? "border-amber-400" : "border-slate-500"}`}>
                                {answers[q.id] === opt && <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>}
                              </div>
                              {getFlagUrl(opt) && <img src={getFlagUrl(opt)!} className="w-5 h-3.5 object-cover rounded-sm shadow-sm" alt="flag" />}
                              <span className="truncate">{opt}</span>
                           </button>
                        ))}
                     </div>
                  );
               }

               return (
                  <div className="relative">
                     <AutocompleteInput
                        value={answers[q.id] || ""}
                        onChange={(val: string) => handleChange(q.id, val)}
                        placeholder="בחר או הקלד נבחרת..."
                        suggestions={[...extras, ...finalOpts]}
                        disabled={locked}
                        showAllOnFocus={true}
                        getFlag={(val) => getFlagUrl(val)}
                        customClassName={`w-full px-4 py-3 pl-10 rounded-xl font-bold text-sm outline-none transition-all shadow-inner ${locked ? "bg-slate-900/50 text-slate-400 border-slate-700 cursor-not-allowed" : (!answers[q.id] || answers[q.id].trim()==="") ? "bg-slate-950 text-white border-amber-500/80 focus:border-amber-400" : "bg-slate-900 text-white border-slate-600 focus:border-blue-500"}`}
                     />
                     {answers[q.id] && getFlagUrl(answers[q.id]) && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                           <img src={getFlagUrl(answers[q.id])!} className="w-5 h-3.5 object-cover rounded-sm shadow-sm" alt="flag" />
                        </div>
                     )}
                  </div>
               );
            })() : ["CUSTOM", "CLUB"].includes(currentAnswerType) ? (() => {
               const opts = q.possibleOptions ? q.possibleOptions.split(",").map((s:string)=>s.trim()).filter(Boolean) : [];
               
               // הגנה: אם לא הוזנו אופציות, נציג שורת טקסט חופשית מותאמת אישית
               if (opts.length === 0) {
                  return (
                     <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg pointer-events-none drop-shadow-sm">{currentAnswerType === "CLUB" ? "🛡️" : "📝"}</span>
                        <input
                           type="text"
                           value={answers[q.id] || ""}
                           onChange={e => handleChange(q.id, e.target.value)}
                           disabled={locked}
                           placeholder={currentAnswerType === "CLUB" ? "הקלד שם קבוצה..." : "הקלד תשובה..."}
                           className={`w-full px-4 py-3 pl-10 rounded-xl font-bold text-sm outline-none transition-all shadow-inner ${locked ? "bg-slate-900/50 text-slate-400 border-slate-700 cursor-not-allowed" : (!answers[q.id] || answers[q.id].trim()==="") ? "bg-slate-950 text-white border-amber-500/80 focus:border-amber-400" : "bg-slate-900 text-white border-slate-600 focus:border-blue-500"}`}
                        />
                     </div>
                  );
               }

               return (
                  <div className="grid grid-cols-1 gap-2">
                     {opts.map((opt: string) => {
                        const isSelected = answers[q.id] === opt;
                        const clubIcon = typeof CLUB_ICONS !== 'undefined' ? CLUB_ICONS[opt] : null;

                        return (
                           <button
                              key={opt}
                              onClick={() => !locked && handleChange(q.id, opt)}
                              disabled={locked}
                              className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-right transition-all flex items-center gap-3 ${isSelected ? "bg-amber-600/20 text-amber-400 border border-amber-500 shadow-md" : "bg-slate-950 text-slate-400 border border-slate-700 hover:bg-slate-800"} ${locked && !isSelected ? "opacity-50 cursor-not-allowed" : ""}`}
                           >
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? "border-amber-400" : "border-slate-500"}`}>
                                {isSelected && <div className="w-2 h-2 bg-amber-400 rounded-full"></div>}
                              </div>

                              {clubIcon ? (
                                 <img src={clubIcon} className="w-6 h-6 object-contain drop-shadow-sm" alt={opt} />
                              ) : getFlagUrl(opt) ? (
                                 <img src={getFlagUrl(opt)!} className="w-5 h-3.5 object-cover rounded-sm shadow-sm" alt="flag" />
                              ) : (
                                 <span className="text-lg opacity-60">{currentAnswerType === "CLUB" ? "🛡️" : "📝"}</span>
                              )}

                              <span className="truncate">{opt}</span>
                           </button>
                        );
                     })}
                  </div>
               );

               })() : currentAnswerType === "MATCH" ? (() => {
               // סינון המשחקים לפי השלב המוגדר לשאלה
               const relevantMatches = allMatches.filter(m => {
                  if (q.phase === "GROUPS") return m.stage !== "KNOCKOUT";
                  if (q.phase === "KNOCKOUT") {
                      return m.stage === "KNOCKOUT" && (q.knockoutRound === "ALL" || m.roundName === q.knockoutRound);
                  }
                  return true; 
               });

               // הפיכת רשימת המשחקים למערך של מחרוזות עבור ה-Autocomplete
               const matchSuggestions = relevantMatches.map(m => `${m.homeTeam} - ${m.awayTeam}`);

               return (
                  <div className="relative">
                     <AutocompleteInput
                        value={answers[q.id] || ""}
                        onChange={(val: string) => handleChange(q.id, val)}
                        placeholder="חפש משחק (למשל: מקסיקו)..."
                        suggestions={matchSuggestions}
                        disabled={locked}
                        showAllOnFocus={true}
                        customClassName={`w-full px-4 py-3 pl-10 rounded-xl font-bold text-sm outline-none transition-all shadow-inner ${locked ? "bg-slate-900/50 text-slate-400 border-slate-700 cursor-not-allowed" : (!answers[q.id] || answers[q.id].trim()==="") ? "bg-slate-950 text-white border-amber-500/80 focus:border-amber-400" : "bg-slate-900 text-white border-slate-600 focus:border-blue-500"}`}
                     />
                     <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-lg">
                        🏟️
                     </div>
                  </div>
               );
            })() : currentAnswerType === "NUMBER_PURE" ? (
               <input
                 type="number"
                 value={answers[q.id] || ""}
                 onChange={e => handleChange(q.id, e.target.value)}
                 disabled={locked}
                 placeholder="הזן מספר..."
                 className={`w-full px-4 py-3 rounded-xl font-bold text-center text-sm outline-none transition-all shadow-inner ${locked ? "bg-slate-900/50 text-slate-400 border-slate-700 cursor-not-allowed" : (!answers[q.id] || answers[q.id].trim()==="") ? "bg-slate-950 text-white border-amber-500/80 focus:border-amber-400" : "bg-slate-900 text-white border-slate-600 focus:border-blue-500"}`}
               />
            ) : currentAnswerType === "NUMBER_MINUTE" ? (
               <input
                 type="text"
                 value={answers[q.id] || ""}
                 onChange={e => handleChange(q.id, e.target.value)}
                 disabled={locked}
                 placeholder="למשל: 45+3"
                 dir="ltr"
                 className={`w-full px-4 py-3 rounded-xl font-bold text-center text-sm outline-none transition-all shadow-inner ${locked ? "bg-slate-900/50 text-slate-400 border-slate-700 cursor-not-allowed" : (!answers[q.id] || answers[q.id].trim()==="") ? "bg-slate-950 text-white border-amber-500/80 focus:border-amber-400" : "bg-slate-900 text-white border-slate-600 focus:border-blue-500"}`}
               />
            ) : currentAnswerType === "PLAYER" ? (() => {
               const pInfo = getPlayerInfo(answers[q.id]);
               return (
                  <div className="relative">
                     <AutocompleteInput
                        value={answers[q.id] || ""}
                        onChange={(val: string) => handleChange(q.id, val)}
                        placeholder="הקלד או בחר שם שחקן..."
                        suggestions={TOP_PLAYERS_NAMES}
                        disabled={locked}
                        getFlag={(val) => {
                           const info = getPlayerInfo(val);
                           return info ? getFlagUrl(info.country) : null;
                        }}
                        getSubtitle={(val) => getPlayerInfo(val)?.country}
                        customClassName={`w-full px-4 py-3 rounded-xl font-bold text-sm outline-none transition-all shadow-inner ${locked ? "bg-slate-900/50 text-slate-400 border-slate-700 cursor-not-allowed" : (!answers[q.id] || answers[q.id].trim()==="") ? "bg-slate-950 text-white border-amber-500/80 focus:border-amber-400" : "bg-slate-900 text-white border-slate-600 focus:border-blue-500"}`}
                     />
                     {pInfo && (
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-slate-200 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-600 shadow-md">
                           {getFlagUrl(pInfo.country) && <img src={getFlagUrl(pInfo.country)!} className="w-3.5 h-2.5 object-cover rounded-sm shadow-sm" alt="flag" />}
                           {pInfo.country}
                        </div>
                     )}
                  </div>
               );
            })() : (
               <input
                 type="text"
                 value={answers[q.id] || ""}
                 onChange={e => handleChange(q.id, e.target.value)}
                 disabled={locked}
                 placeholder="הקלד תשובה חופשית..."
                 className={`w-full px-4 py-3 rounded-xl font-bold text-sm outline-none transition-all shadow-inner ${locked ? "bg-slate-900/50 text-slate-400 border-slate-700 cursor-not-allowed" : (!answers[q.id] || answers[q.id].trim()==="") ? "bg-slate-950 text-white border-amber-500/80 focus:border-amber-400" : "bg-slate-900 text-white border-slate-600 focus:border-blue-500"}`}
               />
            )}
         </div>

         {hasTruth && !isWaitingToOpen && (
           <div className="mt-3 bg-slate-950/80 p-2 rounded-xl border border-slate-700 text-center shadow-inner flex flex-col items-center">
             <span className="text-[9px] text-slate-500 block mb-1 font-black uppercase tracking-wider">אמת בפועל:</span>
             <div className="text-emerald-400 font-bold text-xs flex flex-wrap justify-center gap-1">
                {Array.isArray(realBonusAnswers[q.id]) 
                  ? realBonusAnswers[q.id].map((ans:string, i:number) => {
                      const pInfo = currentAnswerType === "PLAYER" ? getPlayerInfo(ans) : null;
                      return (
                      <span key={i} className="flex items-center gap-1 bg-emerald-900/20 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        {getFlagUrl(ans) && <img src={getFlagUrl(ans)!} className="w-3 h-2 object-cover rounded-sm" alt="flag" />}
                        <span>{ans} {pInfo && <span className="text-emerald-500/70 text-[9px] pr-1">({pInfo.country})</span>}</span>
                      </span>
                    )})
                  : (() => {
                      const ans = realBonusAnswers[q.id];
                      const pInfo = currentAnswerType === "PLAYER" ? getPlayerInfo(ans) : null;
                      return (
                      <span className="flex items-center gap-1 bg-emerald-900/20 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                        {getFlagUrl(ans) && <img src={getFlagUrl(ans)!} className="w-3.5 h-2.5 object-cover rounded-sm" alt="flag" />}
                        <span>{ans} {pInfo && <span className="text-emerald-500/70 text-[10px] pr-1">({pInfo.country})</span>}</span>
                      </span>
                    )})()
                }
             </div>
           </div>
         )}
         
         {locked && !isWaitingToOpen && (
          <button onClick={() => handleOpenSpy(q)} className="mt-3 w-full py-2 rounded-xl font-black text-xs transition-all border flex items-center justify-center gap-1.5 bg-slate-900 text-slate-400 hover:text-white border-slate-700 hover:bg-slate-800 shadow-sm active:scale-95">
            <span className="text-sm">🕵️‍♂️</span> הצג ניחושי חברים
          </button>
          )}
      </div>
    );
  };

  return (
    <>
{/* ========================================== */}
      {/* 1. טאבים ראשיים - חכמים (עם מדי התקדמות) */}
      {/* ========================================== */}
      <div className="flex overflow-x-auto custom-scrollbar gap-2 mb-6 pb-2 mt-2 bg-slate-900/50 p-2 rounded-2xl border border-slate-800 max-w-3xl mx-auto md:justify-center">
         
         {/* ---- טאב: כל הטורניר ---- */}
         <button 
           onClick={() => { setBonusCategory("TOURNAMENT"); setKnockoutRound("ALL"); }} 
           className={`flex flex-col flex-1 items-center justify-center gap-2 min-w-[120px] px-2 py-2.5 rounded-xl font-black whitespace-nowrap transition-all text-sm ${bonusCategory === "TOURNAMENT" ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20" : "bg-slate-950/50 text-slate-400 hover:bg-slate-800 hover:text-amber-400 border border-slate-800"}`}
         >
           <div className="flex items-center justify-center gap-1.5">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
               <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
             </svg>
             <span>כל הטורניר</span>
             {tournamentState >= 1 && (
               <span className="opacity-70 bg-slate-950/20 p-1 rounded-md mr-1 border border-slate-900/10">
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
               </span>
             )}
           </div>
           
           <div className="w-full max-w-[100px] flex flex-col gap-1 items-center">
             <div className={`w-full h-1.5 rounded-full overflow-hidden shadow-inner ${bonusCategory === "TOURNAMENT" ? "bg-amber-900/20" : "bg-slate-900"}`}>
                <div 
                  className={`h-full transition-all duration-700 ${progressStats.TOURNAMENT.answered === progressStats.TOURNAMENT.total && progressStats.TOURNAMENT.total > 0 ? (bonusCategory === "TOURNAMENT" ? 'bg-slate-900' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]') : (bonusCategory === "TOURNAMENT" ? 'bg-slate-800' : 'bg-amber-500')}`}
                  style={{ width: `${progressStats.TOURNAMENT.total > 0 ? (progressStats.TOURNAMENT.answered / progressStats.TOURNAMENT.total) * 100 : 0}%` }}
                ></div>
             </div>
             <span className={`text-[9px] font-mono tracking-widest ${bonusCategory === "TOURNAMENT" ? "text-slate-800 font-bold" : "text-slate-500"}`}>
               {progressStats.TOURNAMENT.answered}/{progressStats.TOURNAMENT.total}
             </span>
           </div>
         </button>

         {/* ---- טאב: שלב הבתים ---- */}
         <button 
           onClick={() => { setBonusCategory("GROUPS"); setKnockoutRound("ALL"); }} 
           className={`flex flex-col flex-1 items-center justify-center gap-2 min-w-[120px] px-2 py-2.5 rounded-xl font-black whitespace-nowrap transition-all text-sm ${bonusCategory === "GROUPS" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-slate-950/50 text-slate-400 hover:bg-slate-800 hover:text-blue-400 border border-slate-800"}`}
         >
           <div className="flex items-center justify-center gap-1.5">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
               <rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>
             </svg>
             <span>שלב הבתים</span>
             {tournamentState >= 1 && (
               <span className="opacity-70 bg-slate-950/20 p-1 rounded-md mr-1 border border-slate-900/10">
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
               </span>
             )}
           </div>

           <div className="w-full max-w-[100px] flex flex-col gap-1 items-center">
             <div className={`w-full h-1.5 rounded-full overflow-hidden shadow-inner ${bonusCategory === "GROUPS" ? "bg-blue-900/40" : "bg-slate-900"}`}>
                <div 
                  className={`h-full transition-all duration-700 ${progressStats.GROUPS.answered === progressStats.GROUPS.total && progressStats.GROUPS.total > 0 ? (bonusCategory === "GROUPS" ? 'bg-white' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]') : (bonusCategory === "GROUPS" ? 'bg-blue-200' : 'bg-blue-500')}`}
                  style={{ width: `${progressStats.GROUPS.total > 0 ? (progressStats.GROUPS.answered / progressStats.GROUPS.total) * 100 : 0}%` }}
                ></div>
             </div>
             <span className={`text-[9px] font-mono tracking-widest ${bonusCategory === "GROUPS" ? "text-blue-100 font-bold" : "text-slate-500"}`}>
               {progressStats.GROUPS.answered}/{progressStats.GROUPS.total}
             </span>
           </div>
         </button>

         {/* ---- טאב: נוק-אאוט ---- */}
         {tournamentState >= 4 && (
           <button 
             onClick={() => setBonusCategory("KNOCKOUT")} 
             className={`flex flex-col flex-1 items-center justify-center gap-2 min-w-[120px] px-2 py-2.5 rounded-xl font-black whitespace-nowrap transition-all text-sm ${bonusCategory === "KNOCKOUT" ? "bg-pink-600 text-white shadow-lg shadow-pink-500/20" : "bg-slate-950/50 text-slate-400 hover:bg-slate-800 hover:text-pink-400 border border-slate-800"}`}
           >
             <div className="flex items-center justify-center gap-1.5">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                 <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/>
               </svg>
               <span>נוק-אאוט</span>
             </div>

             <div className="w-full max-w-[100px] flex flex-col gap-1 items-center">
               <div className={`w-full h-1.5 rounded-full overflow-hidden shadow-inner ${bonusCategory === "KNOCKOUT" ? "bg-pink-900/40" : "bg-slate-900"}`}>
                  <div 
                    className={`h-full transition-all duration-700 ${progressStats.KNOCKOUT.answered === progressStats.KNOCKOUT.total && progressStats.KNOCKOUT.total > 0 ? (bonusCategory === "KNOCKOUT" ? 'bg-white' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]') : (bonusCategory === "KNOCKOUT" ? 'bg-pink-200' : 'bg-pink-500')}`}
                    style={{ width: `${progressStats.KNOCKOUT.total > 0 ? (progressStats.KNOCKOUT.answered / progressStats.KNOCKOUT.total) * 100 : 0}%` }}
                  ></div>
               </div>
               <span className={`text-[9px] font-mono tracking-widest ${bonusCategory === "KNOCKOUT" ? "text-pink-100 font-bold" : "text-slate-500"}`}>
                 {progressStats.KNOCKOUT.answered}/{progressStats.KNOCKOUT.total}
               </span>
             </div>
           </button>
         )}
      </div>

      {/* ========================================== */}
      {/* 2. תת-תפריט סבבי נוק-אאוט */}
      {/* ========================================== */}
      {bonusCategory === "KNOCKOUT" && (
        <div className="flex overflow-x-auto gap-2 mb-6 pb-2 custom-scrollbar bg-slate-900/50 p-2 rounded-2xl border border-slate-800 max-w-4xl mx-auto md:justify-center">
          {[
            { id: "ALL", label: "כללי", visible: 4, locked: 5 },
            { id: "32 הגדולות", label: "32 הגדולות", visible: 4, locked: 5 },
            { id: "שמינית גמר", label: "שמינית גמר", visible: 6, locked: 7 },
            { id: "רבע גמר", label: "רבע גמר", visible: 8, locked: 9 },
            { id: "חצי גמר", label: "חצי גמר", visible: 10, locked: 11 },
            { id: "גמר", label: "גמר", visible: 12, locked: 13 }
          ].map(subTab => {
            if (tournamentState < subTab.visible) return null;
            const isLocked = tournamentState >= subTab.locked;

            return (
              <button
                key={subTab.id}
                onClick={() => setKnockoutRound(subTab.id)}
                className={`px-4 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-sm flex items-center justify-center gap-2 ${
                  knockoutRound === subTab.id
                    ? "bg-pink-600 text-white shadow-lg shadow-pink-500/20"
                    : "text-slate-400 hover:bg-slate-800 hover:text-pink-400"
                }`}
              >
                <span>{subTab.label}</span>
                {isLocked && (
                  <span className="opacity-70 bg-slate-950/30 p-1 rounded-md border border-slate-900/20">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
         <div className="h-6 flex items-center">
            {saveStatus === "saving" && <span className="text-amber-400 text-xs animate-pulse font-bold tracking-widest">⏳ שומר...</span>}
            {saveStatus === "saved" && <span className="text-emerald-400 text-xs font-bold tracking-widest">✓ נשמר</span>}
         </div>
         
         {/* כפתור הגרלה - עכשיו מגריל את כל השאלות שמוצגות בעמוד! */}
         {filteredQuestions.some(q => !isQuestionLocked(q)) && (
            <button 
              onClick={handleRandomizeCategory}
              disabled={isRandomizing} 
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold py-1.5 px-3 rounded-lg border border-slate-600 flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50 active:scale-95"
            >
              <span className="text-sm">🎲</span> {isRandomizing ? "מגריל..." : "הגרל הכל בעמוד זה"}
            </button>
         )}
      </div>

      {filteredQuestions.length === 0 ? (
         <div className="text-center py-16 bg-slate-900/50 rounded-3xl border border-dashed border-slate-700 text-slate-500 font-bold text-lg">
            אין שאלות בקטגוריה זו.
         </div>
      ) : (
         /* ========================================== */
         /* ה-Timeline UI החדש!                        */
         /* ========================================== */
         <div className="relative border-r-[3px] border-slate-800/80 pr-5 md:pr-8 mr-1 md:mr-2 space-y-10">
            
            {regularQuestions.length > 0 && (
               <div className="relative">
                  {/* העיגול (Node) של ה-Timeline */}
                  <div className="absolute -right-[27px] md:-right-[39px] top-1.5 w-4 h-4 bg-blue-500 rounded-full ring-4 ring-slate-950 shadow-[0_0_10px_rgba(59,130,246,0.5)] z-10"></div>
                  
                  <div className="mb-4">
                     <h3 className="text-lg md:text-xl font-black text-blue-400 flex items-center gap-2">
                       <span>🎯</span> שאלות רגילות
                     </h3>
                     <p className="text-slate-400 text-xs font-medium mt-1">שאלות הלחם והחמאה של הטורניר.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {regularQuestions.map((q, index) => (
                     <div 
                       key={q.id} 
                       id={index === 0 ? "first-bonus-card" : undefined} 
                       className="w-full h-full"
                      >
                     {renderQuestionCard(q)}
                       </div>
                     ))}
                    </div>
               </div>
            )}

            {doubleQuestions.length > 0 && (
               <div className="relative">
                  {/* העיגול הפועם של דאבל */}
                  <div className="absolute -right-[27px] md:-right-[39px] top-1.5 w-4 h-4 bg-rose-500 rounded-full ring-4 ring-slate-950 shadow-[0_0_15px_rgba(225,29,72,0.8)] z-10">
                     <div className="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-75"></div>
                  </div>
                  
                  <div className="mb-4">
                     <h3 className="text-lg md:text-xl font-black text-rose-400 flex items-center gap-2 drop-shadow-md">
                       <span>🔥</span> שאלות דאבל (Double)
                     </h3>
                     <p className="text-slate-400 text-xs font-medium mt-1">סיכון כפול, תגמול כפול. זה הזמן להמר בגדול!</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {doubleQuestions.map(q => renderQuestionCard(q))}
                  </div>
               </div>
            )}

            {surpriseQuestions.length > 0 && (
               <div className="relative">
                  {/* העיגול המסתורי של הפתעות */}
                  <div className="absolute -right-[27px] md:-right-[39px] top-1.5 w-4 h-4 bg-purple-500 rounded-full ring-4 ring-slate-950 shadow-[0_0_15px_rgba(168,85,247,0.8)] z-10"></div>
                  
                  <div className="mb-4">
                     <h3 className="text-lg md:text-xl font-black text-purple-400 flex items-center gap-2 drop-shadow-md">
                       <span>🎁</span> שאלות הפתעה
                     </h3>
                     <p className="text-slate-400 text-xs font-medium mt-1">שאלות סודיות שנפתחות לזמן מוגבל בלבד. ענה מהר לפני שיינעלו!</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {surpriseQuestions.map(q => renderQuestionCard(q))}
                  </div>
               </div>
            )}

         </div>
      )}
      {spyModalQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-fade-in-up" dir="rtl">
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 p-5 md:p-6 rounded-3xl w-full max-w-md md:max-w-[600px] md:min-w-[400px] min-h-[500px] h-[85vh] md:h-[650px] md:max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden md:resize">            
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-700/50 shrink-0">
              <h3 className="text-xl font-black text-white flex items-center gap-2"><span>🕵️‍♂️</span> ריגול בונוס</h3>
              <button onClick={() => setSpyModalQuestion(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors font-bold border border-slate-700">✕</button>
            </div>

            <div className="bg-slate-900 rounded-2xl mb-4 border border-slate-700/50 p-4 text-center shadow-inner shrink-0">
              <h4 className="text-blue-300 font-bold text-sm md:text-base mb-3">{spyModalQuestion.label}</h4>
              {realBonusAnswers[spyModalQuestion.id] && (
                 <div className="text-xs md:text-sm bg-emerald-900/20 text-emerald-400 px-4 py-2 rounded-xl border border-emerald-500/30 inline-block font-black tracking-wide">
                   תשובת אמת: 
                   <div className="flex flex-wrap justify-center gap-1.5 mt-1.5">
                    {Array.isArray(realBonusAnswers[spyModalQuestion.id]) 
                      ? realBonusAnswers[spyModalQuestion.id].map((ans: string, i: number, arr: any[]) => {
                          const pInfo = spyModalQuestion.answerType === "PLAYER" ? getPlayerInfo(ans) : null;
                          return (
                          <span key={i} className="flex items-center gap-1">
                            {getFlagUrl(ans) && <img src={getFlagUrl(ans)!} className="w-4 h-3 object-cover rounded-sm" alt="flag" />}
                            <span>{ans} {pInfo && <span className="text-emerald-500/70 text-[10px] pr-1">({pInfo.country})</span>}</span>
                            {i < arr.length - 1 ? " / " : ""}
                          </span>
                        )})
                      : (() => {
                          const ans = realBonusAnswers[spyModalQuestion.id];
                          const pInfo = spyModalQuestion.answerType === "PLAYER" ? getPlayerInfo(ans) : null;
                          return (
                          <span className="flex items-center gap-1.5">
                            {getFlagUrl(ans) && <img src={getFlagUrl(ans)!} className="w-4 h-3 object-cover rounded-sm shadow-sm" alt="flag" />}
                            <span>{ans} {pInfo && <span className="text-emerald-500/70 text-xs pr-1">({pInfo.country})</span>}</span>
                          </span>
                        )})()
                    }
                  </div>
                 </div>
              )}
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

            {realBonusAnswers[spyModalQuestion.id] && (
              <div className="grid grid-cols-3 gap-2 mb-4 shrink-0">
                <button onClick={() => setSpyFilter("ALL")} className={`py-2 px-1 rounded-xl text-[10px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1 ${spyFilter === "ALL" ? "bg-slate-700 text-white border-slate-500 shadow-sm" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"}`}>
                  הכל ({spyData.length})
                </button>
                <button onClick={() => setSpyFilter("CORRECT")} className={`py-2 px-1 rounded-xl text-[10px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1.5 ${spyFilter === "CORRECT" ? "bg-emerald-900/40 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.15)]" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"}`}>
                  ✅ פגעו ({spyData.filter(d => d.points > 0).length})
                </button>
                <button onClick={() => setSpyFilter("INCORRECT")} className={`py-2 px-1 rounded-xl text-[10px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1.5 ${spyFilter === "INCORRECT" ? "bg-rose-900/40 text-rose-400 border-rose-500/50 shadow-[0_0_10px_rgba(225,29,72,0.1)]" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"}`}>
                  ❌ נפלו ({spyData.filter(d => !d.points || d.points === 0).length})
                </button>
              </div>
            )}

            <div className="overflow-y-auto custom-scrollbar flex-1 pl-2 md:pl-4 pr-1 pb-2">
              {isLoadingSpy ? (
                <div className="flex justify-center py-8 text-blue-400 animate-pulse font-black tracking-wide">טוען נתונים מהשטח... ⏳</div>
              ) : spyData.filter(d => d.userName.toLowerCase().includes(spySearchQuery.toLowerCase())).length === 0 ? (
                <div className="text-center text-slate-500 py-8 font-bold">לא נמצאו ניחושים שמתאימים לחיפוש.</div>
              ) : (
                <div className="space-y-2.5">
                  {spyData.filter(d => d.userName.toLowerCase().includes(spySearchQuery.toLowerCase())).map((data, idx) => {
                    
                    let itemStyle = "px-3 py-2.5 rounded-xl border transition-all ";
                    if (realBonusAnswers[spyModalQuestion.id]) {
                      if (data.points && data.points > 0) itemStyle += "bg-emerald-900/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]";
                      else itemStyle += "bg-rose-900/10 border-rose-500/20 opacity-80";
                    } else {
                      itemStyle += data.userId === userId ? "bg-blue-900/10 border-blue-500/30" : "bg-slate-900/50 border-slate-800 hover:bg-slate-800";
                    }

                    return (
                      <div key={idx} className={itemStyle}>
                        <div className="flex justify-between items-center mb-2">
                            <div className="font-bold text-slate-200 flex items-center gap-2">
                              <span className="text-[13px] sm:text-sm truncate max-w-[120px] sm:max-w-[160px]">{data.userName}</span>
                              {data.userId === userId && <span className="text-[8px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase">אתה</span>}
                            </div>
                            <div className="text-[9px] font-bold text-slate-400">
                              סה״כ: <span className="text-amber-400">{data.userTotalPoints}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center bg-slate-950/40 px-2.5 py-2 rounded-lg border border-slate-700/50 shadow-inner">
                           <div className={`font-bold text-[11px] sm:text-xs flex items-center gap-1.5 ${data.points && data.points > 0 ? "text-emerald-400" : "text-slate-300"}`}>
                            {getFlagUrl(data.answer) ? <img src={getFlagUrl(data.answer)!} className="w-4 h-3 object-cover rounded-sm shadow-sm" alt="flag" /> : <span className="text-sm">📝</span>}
                            <span className="truncate max-w-[150px] sm:max-w-[200px]">
                              {data.answer}
                              {spyModalQuestion.answerType === "PLAYER" && getPlayerInfo(data.answer) && (
                                <span className={`pr-1 text-[10px] ${data.points && data.points > 0 ? "text-emerald-600" : "text-slate-500"}`}>
                                  ({getPlayerInfo(data.answer)?.country})
                                </span>
                              )}
                            </span>
                          </div>
                           {realBonusAnswers[spyModalQuestion.id] && (
                             <div className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${data.points && data.points > 0 ? "bg-emerald-900/40 text-emerald-400 border-emerald-500/40" : "bg-rose-950/50 text-rose-400 border-rose-500/40"}`}>
                               {data.points && data.points > 0 ? `+${data.points}` : "0 נק'"}
                             </div>
                           )}
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
      {/* קרדיט לאייקונים של הקבוצות */}
      <div className="mt-8 pb-4 text-center text-slate-500 text-[10px] tracking-wide">
        Icons by Giannis Zographos on <a href="https://icon-icons.com/authors/66-giannis-zographos" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors underline decoration-blue-500/50 underline-offset-2">Icon-Icons.com</a>
      </div>
    </>
  );
}
