"use client";
import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../app/firebase";
import { getFlagUrl } from "../app/utils/flags";

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

const TOP_PLAYERS = [
  "ליונל מסי", "קיליאן אמבפה", "ארלינג האלאנד", "ויניסיוס ג'וניור", 
  "ג'וד בלינגהאם", "הארי קיין", "קווין דה בריינה", "פיל פודן", 
  "לאמין ימאל", "רוברט לבנדובסקי", "כריסטיאנו רונאלדו", "ניימאר", 
  "אנטואן גריזמן", "בוקאיו סאקה", "מוחמד סלאח", "ברנרדו סילבה",
  "אדוארדו קמבינגה", "רודרי", "ויקטור אוסימהן", "רפאל ליאאו"
];

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

    const state = tournamentState;
    if (state === 0) return false;
    if (q.phase === "TOURNAMENT" || q.phase === "GROUPS") return state >= 1;
    if (q.phase === "KNOCKOUT") {
      if (q.knockoutRound === "ALL" || q.knockoutRound === "32 הגדולות") return state >= 5;
      if (q.knockoutRound === "שמינית גמר") return state >= 7;
      if (q.knockoutRound === "רבע גמר") return state >= 9;
      if (q.knockoutRound === "חצי גמר") return state >= 11;
      if (q.knockoutRound === "גמר" || q.knockoutRound === "מקום שלישי") return state >= 13;
    }
    return false;
  };

  const checkAnswerPoints = (q: any, userAnswer: string) => {
    const truth = realBonusAnswers[q.id];
    if (!truth || !userAnswer) return null;
    const truthArray = Array.isArray(truth) ? truth : [truth];
    const isCorrect = truthArray.some((t: string) => t.toString().trim() === userAnswer.toString().trim());
    return isCorrect ? q.points : 0;
  };

  const handleRandomizeCategory = async () => {
    if (!confirm("להגריל תשובות אקראיות לכל השאלות הפתוחות בקטגוריה זו?")) return;
    setIsRandomizing(true);
    try {
      const newAnswers = { ...answers };
      let hasChanges = false;
      
      activeQuestionsList.forEach(q => {
        if (!isQuestionLocked(q)) {
          let ans = "";
          const currentAnswerType = q.answerType || "TEAM";

          if (currentAnswerType === "TEAM") {
             let opts = q.specificTeams ? q.specificTeams.split(",").map((s:string)=>s.trim()).filter(Boolean) : allTeams;
             if (opts.length === 0) opts = allTeams;
             if (q.hasNoneOption) opts.push("אף נבחרת");
             if (q.hasAllOption) opts.push("כל הנבחרות");
             ans = opts[Math.floor(Math.random() * opts.length)];
             
          } else if (currentAnswerType === "CUSTOM") {
             const opts = q.possibleOptions ? q.possibleOptions.split(",").map((s:string)=>s.trim()).filter(Boolean) : [];
             if (opts.length > 0) ans = opts[Math.floor(Math.random() * opts.length)];

          } else if (currentAnswerType === "PLAYER") {
             ans = TOP_PLAYERS[Math.floor(Math.random() * TOP_PLAYERS.length)];

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
      }
    } catch(e) { console.error(e); } 
    finally { setIsRandomizing(false); }
  };

  const filteredQuestions = questions.filter(q => {
    if (q.phase !== bonusCategory) return false;
    if (bonusCategory === "KNOCKOUT") {
       if (knockoutRound !== "ALL" && q.knockoutRound && q.knockoutRound !== "ALL" && q.knockoutRound !== knockoutRound) return false;
    }
    return true;
  });

  const regularQuestions = filteredQuestions.filter(q => !q.isDouble && !q.isSurprise);
  const doubleQuestions = filteredQuestions.filter(q => q.isDouble && !q.isSurprise);
  const surpriseQuestions = filteredQuestions.filter(q => q.isSurprise);

  const activeQuestionsList = weightTab === "REGULAR" ? regularQuestions : weightTab === "DOUBLE" ? doubleQuestions : surpriseQuestions;

  useEffect(() => {
    if (activeQuestionsList.length === 0) {
      if (regularQuestions.length > 0) setWeightTab("REGULAR");
      else if (doubleQuestions.length > 0) setWeightTab("DOUBLE");
      else if (surpriseQuestions.length > 0) setWeightTab("SURPRISE");
    }
  }, [regularQuestions.length, doubleQuestions.length, surpriseQuestions.length, activeQuestionsList.length]);

  const handleOpenSpy = async (q: any) => {
    setSpyModalQuestion(q);
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

      const allBonusSnap = await getDocs(collection(db, "predictions_bonus"));
      const gathered: any[] = [];
      allBonusSnap.forEach(doc => {
        const data = doc.data();
        const ans = data.answers?.[q.id];
        if (ans) {
          const userIdDoc = doc.id;
          gathered.push({
            userId: userIdDoc,
            userName: usersMap[userIdDoc]?.name || "משתמש",
            userTotalPoints: usersMap[userIdDoc]?.totalPoints || 0,
            userRank: usersMap[userIdDoc]?.rank || 999,
            answer: ans,
            points: checkAnswerPoints(q, ans)
          });
        }
      });
      gathered.sort((a, b) => b.userTotalPoints - a.userTotalPoints);
      setSpyData(gathered);
    } catch (e) { console.error(e); } 
    finally { setIsLoadingSpy(false); }
  };

  const availableQuestions = questions.filter(q => {
    if (q.isSurprise) {
      const openMs = q.openTime ? parseDateTimeLocal(q.openTime) : 0;
      if (nowMs < openMs) return false;
    }
    if (q.phase === "KNOCKOUT" && tournamentState < 4) {
      return false;
    }
    return true;
  });
  
  const answeredCount = availableQuestions.filter(q => answers[q.id] && String(answers[q.id]).trim() !== "").length;
  const totalAvailableCount = availableQuestions.length;
  const progressPercent = totalAvailableCount > 0 ? Math.round((answeredCount / totalAvailableCount) * 100) : 0;

  if (isLoading) return <div className="text-center text-blue-400 animate-pulse mt-12 font-bold text-xl">טוען שאלות בונוס... ⚽</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full animate-fade-in-up pb-20">
      
      <div className="bg-gradient-to-br from-amber-900/40 to-slate-900 p-6 md:p-8 rounded-3xl border border-amber-500/30 shadow-xl relative overflow-hidden">
         <div className="absolute -top-10 -left-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
         <h2 className="text-2xl md:text-3xl font-black text-amber-400 mb-2 flex items-center gap-3">
            <span className="drop-shadow-md">⭐</span> שאלות בונוס
         </h2>
         <p className="text-slate-400 text-sm md:text-base">הזדמנות לאסוף נקודות נוספות. ענה על השאלות לפני שחלון הזמן ננעל!</p>
      </div>

      {totalAvailableCount > 0 && (
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 shadow-inner">
           <div className="flex justify-between items-end mb-2">
             <div className="flex flex-col">
               <span className="text-slate-400 text-[10px] font-black tracking-widest uppercase">התקדמות בונוסים</span>
               <span className="text-white font-bold text-sm">ענית על <span className="text-amber-400">{answeredCount}</span> מתוך {totalAvailableCount}</span>
             </div>
             <span className="text-amber-400 font-black">{progressPercent}%</span>
           </div>
           <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 relative">
             <div 
               className="h-full bg-gradient-to-l from-amber-400 to-amber-600 rounded-full transition-all duration-500 ease-out relative"
               style={{ width: `${progressPercent}%` }}
             >
                <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite] skew-x-12"></div>
             </div>
           </div>
           {progressPercent === 100 && (
             <div className="text-center mt-2.5 text-[11px] text-emerald-400 font-bold animate-pulse">
               🏆 מדהים! השלמת את כל השאלות שפתוחות כרגע.
             </div>
           )}
        </div>
      )}

      <div className="flex overflow-x-auto custom-scrollbar gap-3 mb-6 pb-2 mt-2">
         {[
           { id: "TOURNAMENT", label: "🏆 כל הטורניר" },
           { id: "GROUPS", label: "⚽ שלב הבתים" },
           { id: "KNOCKOUT", label: "🔥 נוק-אאוט" }
         ].map(tab => {
           if (tab.id === "KNOCKOUT" && tournamentState < 4) return null;
           return (
             <button 
               key={tab.id} 
               onClick={() => { setBonusCategory(tab.id); if(tab.id !== "KNOCKOUT") setKnockoutRound("ALL"); }} 
               className={`px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all border shadow-sm ${
                 bonusCategory === tab.id 
                   ? "bg-amber-500 text-slate-900 border-amber-400" 
                   : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-amber-400"
               }`}
             >
               {tab.label}
             </button>
           );
         })}
      </div>

      {bonusCategory === "KNOCKOUT" && (
        <div className="flex overflow-x-auto gap-2 mb-6 pb-2 custom-scrollbar bg-slate-900/50 p-2 rounded-2xl border border-slate-800/50">
          {[
            { id: "ALL", label: "כללי (כל הנוק-אאוט)" },
            { id: "32 הגדולות", label: "32 הגדולות" },
            { id: "שמינית גמר", label: "שמינית גמר" },
            { id: "רבע גמר", label: "רבע גמר" },
            { id: "חצי גמר", label: "חצי גמר" },
            { id: "גמר", label: "גמר" },
            { id: "מקום שלישי", label: "מקום שלישי" }
          ].map(subTab => (
            <button
              key={subTab.id}
              onClick={() => setKnockoutRound(subTab.id)}
              className={`px-4 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-sm border ${
                knockoutRound === subTab.id
                  ? "bg-purple-600 text-white border-purple-500 shadow-md"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white"
              }`}
            >
              {subTab.label}
            </button>
          ))}
        </div>
      )}

      {filteredQuestions.length > 0 && (
         <div className="flex flex-wrap justify-center gap-2 mb-6 md:mb-8 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/80 w-fit mx-auto shadow-inner backdrop-blur-sm">
            {regularQuestions.length > 0 && (
               <button onClick={() => setWeightTab("REGULAR")} className={`px-4 py-2 rounded-xl text-xs md:text-sm font-black transition-all flex items-center gap-2 ${weightTab === "REGULAR" ? "bg-blue-600 text-white shadow-md border border-blue-500/50" : "text-slate-400 hover:text-white border border-transparent hover:bg-slate-800"}`}>
                 <span>🎯</span> רגילות <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${weightTab === "REGULAR" ? "bg-blue-900/50" : "bg-slate-800"}`}>{regularQuestions.length}</span>
               </button>
            )}
            {doubleQuestions.length > 0 && (
               <button onClick={() => setWeightTab("DOUBLE")} className={`px-4 py-2 rounded-xl text-xs md:text-sm font-black transition-all flex items-center gap-2 ${weightTab === "DOUBLE" ? "bg-rose-600 text-white shadow-md border border-rose-500/50" : "text-slate-400 hover:text-white border border-transparent hover:bg-slate-800"}`}>
                 <span>🔥</span> דאבל <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${weightTab === "DOUBLE" ? "bg-rose-900/50" : "bg-slate-800"}`}>{doubleQuestions.length}</span>
               </button>
            )}
            {surpriseQuestions.length > 0 && (
               <button onClick={() => setWeightTab("SURPRISE")} className={`px-4 py-2 rounded-xl text-xs md:text-sm font-black transition-all flex items-center gap-2 ${weightTab === "SURPRISE" ? "bg-purple-600 text-white shadow-md border border-purple-500/50" : "text-slate-400 hover:text-white border border-transparent hover:bg-slate-800"}`}>
                 <span>🎁</span> הפתעות <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${weightTab === "SURPRISE" ? "bg-purple-900/50" : "bg-slate-800"}`}>{surpriseQuestions.length}</span>
               </button>
            )}
         </div>
      )}

      <div className="flex justify-between items-center mb-4">
         <div className="h-6 flex items-center">
            {saveStatus === "saving" && <span className="text-amber-400 text-xs animate-pulse font-bold tracking-widest">⏳ שומר...</span>}
            {saveStatus === "saved" && <span className="text-emerald-400 text-xs font-bold tracking-widest">✓ נשמר</span>}
         </div>
         {activeQuestionsList.some(q => !isQuestionLocked(q)) && (
            <button onClick={handleRandomizeCategory} disabled={isRandomizing} className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold py-2 px-3 rounded-lg border border-slate-600 flex items-center gap-1 transition-all shadow-sm disabled:opacity-50 active:scale-95">
              <span className="text-base">🎲</span> {isRandomizing ? "מגריל..." : "הגרל חסרים בטאב"}
            </button>
         )}
      </div>

      {activeQuestionsList.length === 0 ? (
         <div className="text-center py-16 bg-slate-900/50 rounded-3xl border border-dashed border-slate-700 text-slate-500 font-bold text-lg">
            אין שאלות בקטגוריה זו.
         </div>
      ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeQuestionsList.map((q) => {
              const locked = isQuestionLocked(q);
              const hasTruth = !!realBonusAnswers[q.id];
              const myPoints = checkAnswerPoints(q, answers[q.id]);
              
              const openMs = q.openTime ? parseDateTimeLocal(q.openTime) : 0;
              const isWaitingToOpen = q.isSurprise && nowMs < openMs;

              let cardStyle = "bg-slate-900 border-slate-700";
              let shadowStyle = "shadow-lg";
              
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
                <div key={q.id} id={`bonus-${q.id}`} className={`${cardStyle} p-6 rounded-3xl border ${shadowStyle} flex flex-col h-full transition-all duration-300`}>
                   
                   <div className="flex justify-between items-start mb-4 gap-4">
                      <div className="flex flex-col gap-1.5">
                        
                        {!isWaitingToOpen && (
                           <span className="text-[10px] font-black text-slate-400 bg-slate-950 px-2 py-1 rounded w-fit border border-slate-800">
                             קופה: <span className={q.isDouble ? "text-rose-400" : "text-amber-400"}>{q.points} נק'</span>
                           </span>
                        )}
                        
                        {isWaitingToOpen && (
                           <span className="text-[10px] font-black text-purple-400 bg-purple-900/50 px-2 py-1 rounded w-fit border border-purple-500/50 flex items-center gap-1">
                              🎁 הפתעה בדרך!
                           </span>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-1.5">
                           {q.isSurprise && !isWaitingToOpen && <span className="bg-purple-600 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-md" title="שאלת הפתעה!">🎁</span>}
                           {q.isDouble && !q.isSurprise && <span className="bg-rose-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow-md text-white" title="ניקוד כפול!">X2</span>}
                        </div>
                        {hasTruth && myPoints !== null && !isWaitingToOpen && (
                           <span className={`px-2 py-1 rounded text-xs font-black shadow-sm border ${myPoints > 0 ? "bg-emerald-900/40 text-emerald-400 border-emerald-500/50" : "bg-rose-950/50 text-rose-400 border-rose-500/40"}`}>
                             {myPoints > 0 ? `🎯 +${myPoints} נק'` : "0 נק'"}
                           </span>
                        )}
                      </div>
                   </div>
                   
                   <h3 className="text-white font-bold text-lg md:text-xl leading-snug mb-2">
                     {isWaitingToOpen ? "שאלת הפתעה סודית..." : q.label}
                   </h3>
                   
                   {realBonusData.leading?.[q.id] && !locked && !isWaitingToOpen && (
                      <div className="text-[10px] font-bold text-amber-400 bg-amber-950/30 px-2.5 py-1.5 rounded-lg border border-amber-500/20 mb-4 inline-flex items-center gap-1.5 w-fit">
                         <span className="animate-pulse">👑 מובילה כרגע:</span> 
                         {Array.isArray(realBonusData.leading[q.id]) ? realBonusData.leading[q.id].join(', ') : realBonusData.leading[q.id]}
                      </div>
                   )}

                   <div className="mt-auto pt-4 flex-1 flex flex-col justify-end">
                      {isWaitingToOpen ? (
                         <div className="bg-slate-950/80 border border-slate-700 p-5 rounded-xl text-center shadow-inner">
                            <span className="text-4xl block mb-2 opacity-80 animate-bounce">🎁</span>
                            <h4 className="text-purple-400 font-bold mb-1">השאלה תיחשף בקרוב!</h4>
                            <p className="text-slate-400 text-xs">הכינו את הניחושים שלכם. שווה לעקוב.</p>
                         </div>
                      ) : currentAnswerType === "TEAM" ? (() => {
                         const teamOpts = q.specificTeams ? q.specificTeams.split(",").map((s:string)=>s.trim()).filter(Boolean) : [];
                         const finalOpts = teamOpts.length > 0 ? teamOpts : allTeams;
                         const extras = [];
                         if (q.hasNoneOption) extras.push("אף נבחרת");
                         if (q.hasAllOption) extras.push("כל הנבחרות");
                         
                         const totalOptionsCount = finalOpts.length + extras.length;
                         if (teamOpts.length > 0 && totalOptionsCount <= 8) {
                            // התיקון לסדר הבועות:
                            const allOpts = [...extras, ...finalOpts];
                            return (
                               <div className="flex flex-col gap-2">
                                  {allOpts.map((opt: string) => (
                                     <button
                                        key={opt}
                                        onClick={() => !locked && handleChange(q.id, opt)}
                                        disabled={locked}
                                        className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-right transition-all flex items-center gap-3 ${answers[q.id] === opt ? "bg-amber-600/20 text-amber-400 border border-amber-500 shadow-md" : "bg-slate-950 text-slate-400 border border-slate-700 hover:bg-slate-800"} ${locked && answers[q.id] !== opt ? "opacity-50 cursor-not-allowed" : ""}`}
                                     >
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${answers[q.id] === opt ? "border-amber-400" : "border-slate-500"}`}>
                                          {answers[q.id] === opt && <div className="w-2 h-2 bg-amber-400 rounded-full"></div>}
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
                               <select
                                  value={answers[q.id] || ""}
                                  onChange={e => handleChange(q.id, e.target.value)}
                                  disabled={locked}
                                  className={`w-full appearance-none px-4 py-3.5 pr-10 rounded-xl font-bold text-sm outline-none transition-all shadow-inner flex-1 ${locked ? "bg-slate-900/50 text-slate-400 border-slate-700 cursor-not-allowed" : (!answers[q.id] || answers[q.id].trim()==="") ? "bg-slate-950 text-white border-amber-500/80 focus:border-amber-400" : "bg-slate-900 text-white border-slate-600 focus:border-blue-500"}`}
                               >
                                  <option value="" className="bg-slate-900">-- בחר נבחרת --</option>
                                  
                                  {/* התיקון לסדר הרשימה הנפתחת */}
                                  {extras.map((t: string) => (
                                     <option className="bg-slate-900 text-amber-400" key={t} value={t}>
                                        {isMobile ? (t === "אף נבחרת" ? "🛡️ " : t === "כל הנבחרות" ? "🌍 " : "") : ""}{t}
                                     </option>
                                  ))}
                                  {extras.length > 0 && <option disabled className="bg-slate-900">──────────</option>}
                                  
                                  {finalOpts.map((t: string) => (
                                     <option className="bg-slate-900 text-white" key={t} value={t}>
                                        {isMobile && TEAM_EMOJIS[t] ? `${TEAM_EMOJIS[t]} ` : ''}{t}
                                     </option>
                                  ))}
                               </select>
                               {answers[q.id] && getFlagUrl(answers[q.id]) && (
                                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                     <img src={getFlagUrl(answers[q.id])!} className="w-5 h-3.5 object-cover rounded-sm shadow-sm" alt="flag" />
                                  </div>
                               )}
                            </div>
                         );
                      })() : currentAnswerType === "CUSTOM" ? (() => {
                         const opts = q.possibleOptions ? q.possibleOptions.split(",").map((s:string)=>s.trim()).filter(Boolean) : [];
                         return (
                            <div className="flex flex-col gap-2">
                               {opts.map((opt: string) => (
                                  <button
                                     key={opt}
                                     onClick={() => !locked && handleChange(q.id, opt)}
                                     disabled={locked}
                                     className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-right transition-all flex items-center gap-3 ${answers[q.id] === opt ? "bg-amber-600/20 text-amber-400 border border-amber-500 shadow-md" : "bg-slate-950 text-slate-400 border border-slate-700 hover:bg-slate-800"} ${locked && answers[q.id] !== opt ? "opacity-50 cursor-not-allowed" : ""}`}
                                  >
                                     <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${answers[q.id] === opt ? "border-amber-400" : "border-slate-500"}`}>
                                       {answers[q.id] === opt && <div className="w-2 h-2 bg-amber-400 rounded-full"></div>}
                                     </div>
                                     <span className="truncate">{opt}</span>
                                  </button>
                               ))}
                            </div>
                         );
                      })() : currentAnswerType === "NUMBER_PURE" ? (
                         <input
                           type="number"
                           value={answers[q.id] || ""}
                           onChange={e => handleChange(q.id, e.target.value)}
                           disabled={locked}
                           placeholder="הזן מספר..."
                           className={`w-full px-4 py-3.5 rounded-xl font-bold text-center text-sm outline-none transition-all shadow-inner ${locked ? "bg-slate-900/50 text-slate-400 border-slate-700 cursor-not-allowed" : (!answers[q.id] || answers[q.id].trim()==="") ? "bg-slate-950 text-white border-amber-500/80 focus:border-amber-400" : "bg-slate-900 text-white border-slate-600 focus:border-blue-500"}`}
                         />
                      ) : currentAnswerType === "NUMBER_MINUTE" ? (
                         <input
                           type="text"
                           value={answers[q.id] || ""}
                           onChange={e => handleChange(q.id, e.target.value)}
                           disabled={locked}
                           placeholder="למשל: 45+3"
                           dir="ltr"
                           className={`w-full px-4 py-3.5 rounded-xl font-bold text-center text-sm outline-none transition-all shadow-inner ${locked ? "bg-slate-900/50 text-slate-400 border-slate-700 cursor-not-allowed" : (!answers[q.id] || answers[q.id].trim()==="") ? "bg-slate-950 text-white border-amber-500/80 focus:border-amber-400" : "bg-slate-900 text-white border-slate-600 focus:border-blue-500"}`}
                         />
                      ) : currentAnswerType === "PLAYER" ? (
                         <div className="relative">
                            <input
                              type="text"
                              list={`players-list-${q.id}`}
                              value={answers[q.id] || ""}
                              onChange={e => handleChange(q.id, e.target.value)}
                              disabled={locked}
                              placeholder="הקלד או בחר שם שחקן..."
                              className={`w-full px-4 py-3.5 rounded-xl font-bold text-sm outline-none transition-all shadow-inner ${locked ? "bg-slate-900/50 text-slate-400 border-slate-700 cursor-not-allowed" : (!answers[q.id] || answers[q.id].trim()==="") ? "bg-slate-950 text-white border-amber-500/80 focus:border-amber-400" : "bg-slate-900 text-white border-slate-600 focus:border-blue-500"}`}
                            />
                            <datalist id={`players-list-${q.id}`}>
                               {TOP_PLAYERS.map(p => <option key={p} value={p} />)}
                            </datalist>
                         </div>
                      ) : (
                         <input
                           type="text"
                           value={answers[q.id] || ""}
                           onChange={e => handleChange(q.id, e.target.value)}
                           disabled={locked}
                           placeholder="הקלד תשובה חופשית..."
                           className={`w-full px-4 py-3.5 rounded-xl font-bold text-sm outline-none transition-all shadow-inner ${locked ? "bg-slate-900/50 text-slate-400 border-slate-700 cursor-not-allowed" : (!answers[q.id] || answers[q.id].trim()==="") ? "bg-slate-950 text-white border-amber-500/80 focus:border-amber-400" : "bg-slate-900 text-white border-slate-600 focus:border-blue-500"}`}
                         />
                      )}
                   </div>

                   {hasTruth && !isWaitingToOpen && (
                     <div className="mt-4 bg-slate-950/80 p-2.5 rounded-xl border border-slate-700 text-center shadow-inner flex flex-col items-center">
                       <span className="text-[9px] text-slate-500 block mb-1.5 font-black uppercase tracking-wider">אמת בפועל:</span>
                       <div className="text-emerald-400 font-bold text-sm flex flex-wrap justify-center gap-1.5">
                         {Array.isArray(realBonusAnswers[q.id]) 
                           ? realBonusAnswers[q.id].map((ans:string, i:number) => (
                               <span key={i} className="flex items-center gap-1.5 bg-emerald-900/20 px-2 py-1 rounded-md border border-emerald-500/20">
                                 {getFlagUrl(ans) && <img src={getFlagUrl(ans)!} className="w-3.5 h-2.5 object-cover rounded-sm" alt="flag" />}
                                 {ans}
                               </span>
                             ))
                           : (
                               <span className="flex items-center gap-1.5 bg-emerald-900/20 px-3 py-1 rounded-md border border-emerald-500/20 text-sm">
                                 {getFlagUrl(realBonusAnswers[q.id]) && <img src={getFlagUrl(realBonusAnswers[q.id])!} className="w-4 h-3 object-cover rounded-sm" alt="flag" />}
                                 {realBonusAnswers[q.id]}
                               </span>
                             )
                         }
                       </div>
                     </div>
                   )}
                   
                   {locked && !hasTruth && !isWaitingToOpen && (
                     <button onClick={() => handleOpenSpy(q)} className="mt-4 w-full py-2.5 rounded-xl font-black text-[13px] transition-all border flex items-center justify-center gap-2 bg-slate-900 text-slate-400 hover:text-white border-slate-700 hover:bg-slate-800 hover:border-slate-500 shadow-sm active:scale-95">
                       <span className="text-base">🕵️‍♂️</span> הצג ניחושי חברים
                     </button>
                   )}
                </div>
              );
            })}
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
                        ? realBonusAnswers[spyModalQuestion.id].map((ans: string, i: number, arr: any[]) => (
                            <span key={i} className="flex items-center gap-1">
                              {getFlagUrl(ans) && <img src={getFlagUrl(ans)!} className="w-4 h-3 object-cover rounded-sm" alt="flag" />}
                              {ans}{i < arr.length - 1 ? " / " : ""}
                            </span>
                          ))
                        : (
                          <span className="flex items-center gap-1.5">
                            {getFlagUrl(realBonusAnswers[spyModalQuestion.id]) && <img src={getFlagUrl(realBonusAnswers[spyModalQuestion.id])!} className="w-4 h-3 object-cover rounded-sm shadow-sm" alt="flag" />}
                            {realBonusAnswers[spyModalQuestion.id]}
                          </span>
                        )
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
                             <span className="truncate max-w-[150px] sm:max-w-[200px]">{data.answer}</span>
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
    </div>
  );
}