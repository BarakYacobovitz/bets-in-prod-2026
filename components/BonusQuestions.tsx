"use client";
import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../app/firebase";
import { getFlagUrl } from "../app/utils/flags";

export default function BonusQuestions({ userId, tournamentState: propTournamentState, groups }: any) {
  const allTeams = groups ? Object.values(groups).flat().sort() : [];

  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any>({});
  const [realBonusAnswers, setRealBonusAnswers] = useState<any>({});
  const [tournamentState, setTournamentState] = useState<number>(propTournamentState || 0);
  
  const [bonusCategory, setBonusCategory] = useState<string>("TOURNAMENT");
  const [knockoutRound, setKnockoutRound] = useState<string>("ALL");
  const [weightTab, setWeightTab] = useState<string>("REGULAR");
  
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isLoading, setIsLoading] = useState(true);
  const [isRandomizing, setIsRandomizing] = useState(false);

  const [spyModalQuestion, setSpyModalQuestion] = useState<any | null>(null);
  const [spyData, setSpyData] = useState<any[]>([]);
  const [isLoadingSpy, setIsLoadingSpy] = useState(false);

  const [spySearchQuery, setSpySearchQuery] = useState("");
  const [spyFilter, setSpyFilter] = useState<"ALL" | "CORRECT" | "INCORRECT">("ALL");

  const isLoaded = useRef(false);
  const isUserAction = useRef(false);

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
        if (rSnap.exists()) setRealBonusAnswers(rSnap.data().answers || {});

      } catch (e) { console.error(e); } 
      finally { isLoaded.current = true; setIsLoading(false); }
    };
    if (userId) fetchData();
  }, [userId]);

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
    if (q.isSurprise) {
      if (!q.closeTime) return false;
      const now = new Date();
      const closeTime = new Date(q.closeTime);
      if (now >= closeTime) return true; 
      return false; 
    }

    const state = tournamentState;
    if (state === 0) return false;
    if (q.phase === "TOURNAMENT" || q.phase === "GROUPS") return state >= 1;
    if (q.phase === "KNOCKOUT") {
      if (q.round === "ALL" || q.round === "R32") return state >= 5;
      if (q.round === "R16") return state >= 7;
      if (q.round === "QF") return state >= 9;
      if (q.round === "SF") return state >= 11;
      if (q.round === "FINAL") return state >= 13;
    }
    return false;
  };

  const isQuestionVisible = (q: any) => {
    if (q.isSurprise) {
      if (!q.openTime) return false;
      const now = new Date();
      const openTime = new Date(q.openTime);
      if (now < openTime) return false; 
    }

    const state = tournamentState;
    if (q.phase === "KNOCKOUT") {
      if (state < 4) return false;
      if (q.round === "ALL" || q.round === "R32") return state >= 4;
      if (q.round === "R16") return state >= 6;
      if (q.round === "QF") return state >= 8;
      if (q.round === "SF") return state >= 10;
      if (q.round === "FINAL") return state >= 12;
    }
    return true;
  };

  const checkAnswerPoints = (q: any, userAnswer: string) => {
    const truth = realBonusAnswers[q.id];
    if (!truth || !userAnswer) return null;
    const truthArray = Array.isArray(truth) ? truth : [truth];
    const isCorrect = truthArray.some((t: string) => t.toString().trim() === userAnswer.toString().trim());
    return isCorrect ? q.points : 0;
  };

  const handleRandomizeSingleQuestion = (q: any) => {
    if (isQuestionLocked(q)) return;
    let ans = "";
    if (q.answerType === "ALL_TEAMS") {
      const opts = [...allTeams, ...(q.customOptions || [])];
      if (opts.length > 0) ans = opts[Math.floor(Math.random() * opts.length)];
    } else if (q.answerType === "MULTIPLE_CHOICE" || q.answerType === "TEAM_SUBSET") {
      const opts = q.customOptions || [];
      if (opts.length > 0) ans = opts[Math.floor(Math.random() * opts.length)];
    } else if (q.answerType === "OPEN_TEXT" || q.answerType === "PLAYER") {
      let opts: string[] = [];
      if (Array.isArray(q.customOptions) && q.customOptions.length > 0) opts = q.customOptions;
      else if (typeof q.customOptions === 'string' && q.customOptions.trim() !== "") opts = q.customOptions.split(',').map((s: string) => s.trim());
      if (opts.length === 0) opts = ["ליונל מסי", "קיליאן אמבפה", "ארלינג האלאנד", "ויניסיוס ג'וניור", "קווין דה בריינה", "ג'וד בלינגהאם", "הארי קיין"];
      ans = opts[Math.floor(Math.random() * opts.length)];
    } else if (q.answerType === "NUMERIC") {
      ans = Math.floor(Math.random() * 20).toString();
    }
    
    if (ans) handleChange(q.id, ans);
  };

  const filteredQuestions = questions.filter(q => {
    if (!isQuestionVisible(q)) return false; 
    if (q.phase !== bonusCategory) return false;
    if (bonusCategory === "KNOCKOUT") return q.round === knockoutRound;
    return true;
  });

  // ניהול חכם של טאב המשקל: אם עוברים קטגוריה ואין בה את הסוג הנוכחי, קופץ אוטומטית לסוג הקיים
  useEffect(() => {
    const weights = new Set(filteredQuestions.map(q => q.weight));
    if (weights.size > 0 && !weights.has(weightTab)) {
      if (weights.has("REGULAR")) setWeightTab("REGULAR");
      else if (weights.has("DOUBLE")) setWeightTab("DOUBLE");
      else if (weights.has("SURPRISE")) setWeightTab("SURPRISE");
    }
  }, [filteredQuestions, weightTab]);

  const handleRandomizeCategory = async () => {
    if (!confirm("להגריל תשובות אקראיות לכל השאלות הפתוחות בקטגוריה זו?")) return;
    setIsRandomizing(true);
    try {
      const newAnswers = { ...answers };
      let hasChanges = false;
      
      filteredQuestions.forEach(q => {
        if (!isQuestionLocked(q) && isQuestionVisible(q)) {
          let ans = "";
          if (q.answerType === "ALL_TEAMS") {
            const opts = [...allTeams, ...(q.customOptions || [])];
            if (opts.length > 0) ans = opts[Math.floor(Math.random() * opts.length)];
          } else if (q.answerType === "MULTIPLE_CHOICE" || q.answerType === "TEAM_SUBSET") {
            const opts = q.customOptions || [];
            if (opts.length > 0) ans = opts[Math.floor(Math.random() * opts.length)];
          } else if (q.answerType === "OPEN_TEXT" || q.answerType === "PLAYER") {
            let opts: string[] = [];
            if (Array.isArray(q.customOptions) && q.customOptions.length > 0) opts = q.customOptions;
            else if (typeof q.customOptions === 'string' && q.customOptions.trim() !== "") opts = q.customOptions.split(',').map((s: string) => s.trim());
            if (opts.length === 0) opts = ["ליונל מסי", "קיליאן אמבפה", "ארלינג האלאנד", "ויניסיוס ג'וניור", "קווין דה בריינה", "ג'וד בלינגהאם", "הארי קיין"];
            ans = opts[Math.floor(Math.random() * opts.length)];
          } else if (q.answerType === "NUMERIC") {
            ans = Math.floor(Math.random() * 20).toString();
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

  if (isLoading) return <div className="text-center text-blue-400 animate-pulse mt-12 font-bold text-xl">טוען שאלות בונוס... ⚽</div>;
  
  const totalOpenQuestions = questions.filter(q => isQuestionVisible(q) && !isQuestionLocked(q));
  const openCount = totalOpenQuestions.length;
  const answeredCount = totalOpenQuestions.filter(q => answers[q.id] && answers[q.id].toString().trim() !== "").length;
  const progressPercent = openCount > 0 ? Math.round((answeredCount / openCount) * 100) : 0;
  const isAllAnswered = openCount > 0 && answeredCount === openCount;

  const sortGroup = (arr: any[]) => {
    return arr.sort((a, b) => {
      const aLocked = isQuestionLocked(a);
      const bLocked = isQuestionLocked(b);
      if (aLocked !== bLocked) return aLocked ? 1 : -1;
      return a.id.localeCompare(b.id);
    });
  };

  const regularQuestions = sortGroup(filteredQuestions.filter(q => q.weight === "REGULAR"));
  const doubleQuestions = sortGroup(filteredQuestions.filter(q => q.weight === "DOUBLE"));
  const surpriseQuestions = sortGroup(filteredQuestions.filter(q => q.weight === "SURPRISE"));

  // Questions to show based on active weight tab
  const activeQuestionsList = weightTab === "REGULAR" ? regularQuestions : weightTab === "DOUBLE" ? doubleQuestions : surpriseQuestions;

  const renderQuestionCard = (q: any) => {
    const locked = isQuestionLocked(q);
    const truth = realBonusAnswers[q.id];
    const hasTruth = !!truth;
    const myPoints = checkAnswerPoints(q, answers[q.id]);
    const isMissing = !locked && (!answers[q.id] || answers[q.id].trim() === "");

    let cardStyle = "w-full flex flex-col bg-gradient-to-br from-slate-800 to-slate-900 p-4 sm:p-5 rounded-2xl border-t-4 border border-slate-700/80 relative transition-all duration-300 shadow-xl ";
    let statusBadge = null;

    if (hasTruth) {
      cardStyle += myPoints && myPoints > 0 ? "border-t-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)]" : "border-t-slate-500 opacity-90 grayscale-[10%]";
      statusBadge = <span className="text-[10px] uppercase font-black tracking-wide bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg border border-emerald-500/30">✅ נבדק</span>;
    } else if (locked) {
      cardStyle += "opacity-80 grayscale-[30%] border-t-slate-500";
      statusBadge = <span className="text-[10px] uppercase font-black tracking-wide bg-slate-900/80 text-slate-400 px-2 py-1 rounded-lg border border-slate-700">🔒 נעול</span>;
    } else if (isMissing) {
      cardStyle += "border-t-amber-500 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:-translate-y-1 bg-slate-800/90";
      statusBadge = <span className="text-[10px] uppercase font-black tracking-wide bg-amber-500/10 text-amber-400 px-2 py-1 rounded-lg border border-amber-500/50 animate-pulse shadow-sm">⚠️ חסר ניחוש!</span>;
    } else {
      cardStyle += "border-t-blue-500 hover:-translate-y-1";
      statusBadge = <span className="text-[10px] uppercase font-black tracking-wide bg-blue-500/10 text-blue-400 px-2 py-1 rounded-lg border border-blue-500/30 shadow-sm">✍️ נשמר</span>;
    }

    const weightLabel = q.weight === "DOUBLE" ? "🔥 דאבל" : q.weight === "SURPRISE" ? "🎁 הפתעה" : "🎯 רגיל";
    const weightClass = q.weight === "DOUBLE" ? "bg-rose-500/10 text-rose-400 border-rose-500/30" : q.weight === "SURPRISE" ? "bg-purple-500/10 text-purple-400 border-purple-500/30" : "bg-blue-500/10 text-blue-400 border-blue-500/30";

    const inputBaseStyle = "w-full p-2.5 rounded-xl border outline-none text-center font-bold text-sm md:text-base transition-colors shadow-inner flex-1";
    const inputStateStyle = locked 
      ? "bg-slate-900/50 text-slate-400 border-slate-700 cursor-not-allowed" 
      : isMissing 
        ? "bg-slate-950 text-white border-amber-500/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-500" 
        : "bg-slate-900 text-white border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
    const combinedInputStyle = `${inputBaseStyle} ${inputStateStyle}`;

    return (
      <div key={q.id} className={cardStyle}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex gap-1.5 items-center flex-wrap">
            <span className="text-[10px] font-black tracking-wider px-2 py-1 rounded-lg bg-slate-950 text-slate-300 border border-slate-700 shadow-sm">{q.points} נק'</span>
            <span className={`text-[10px] font-black tracking-wider px-2 py-1 rounded-lg border ${weightClass}`}>{weightLabel}</span>
            {statusBadge}
          </div>
          {hasTruth && myPoints !== null && (
            <div className={`px-2.5 py-1 rounded-lg text-xs font-black shadow-sm border ${myPoints > 0 ? "bg-emerald-900/40 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.3)]" : "bg-slate-900 text-slate-500 border-slate-700"}`}>
              {myPoints > 0 ? `🎯 +${myPoints}` : "0 נק'"}
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-start gap-2 mb-4">
           <h3 className="text-sm md:text-base font-bold text-white leading-snug">{q.label}</h3>
           {!locked && (
              <button onClick={() => handleRandomizeSingleQuestion(q)} title="הגרל תשובה" className="text-base hover:rotate-12 transition-transform active:scale-90 opacity-70 hover:opacity-100 shrink-0">
                🎲
              </button>
           )}
        </div>

        {q.liveStatus && (
          <div className="mb-4 bg-slate-950/50 border border-slate-700/50 p-2.5 rounded-xl flex items-center gap-2.5 shadow-inner">
             <div className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
             </div>
             <span className="text-slate-300 text-xs md:text-sm font-medium"><strong className="text-rose-400 font-bold">לייב:</strong> {q.liveStatus}</span>
          </div>
        )}

        <div className="mb-4 flex items-center gap-2.5">
          {getFlagUrl(answers[q.id]) && (
            <div className="shrink-0 bg-slate-950 border border-slate-700 p-2 rounded-xl shadow-inner flex items-center justify-center h-[46px] w-[54px]">
              <img src={getFlagUrl(answers[q.id])!} className="w-7 h-5 object-cover rounded-sm shadow-sm" alt="flag" />
            </div>
          )}
          <div className="flex-1 w-full min-w-0">
            {q.answerType === "ALL_TEAMS" && (
              <select value={answers[q.id] || ""} disabled={locked} onChange={e => handleChange(q.id, e.target.value)} className={`h-[46px] ${combinedInputStyle}`}>
                <option value="">-- בחר נבחרת --</option>{allTeams.map((t: string) => <option key={t} value={t}>{t}</option>)}{(q.customOptions || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            )}
            {(q.answerType === "MULTIPLE_CHOICE" || q.answerType === "TEAM_SUBSET") && (
              <select value={answers[q.id] || ""} disabled={locked} onChange={e => handleChange(q.id, e.target.value)} className={`h-[46px] ${combinedInputStyle}`}>
                <option value="">-- בחר תשובה --</option>{(q.customOptions || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            )}
            {(q.answerType === "OPEN_TEXT" || q.answerType === "PLAYER") && (
              <div className="relative w-full h-[46px]">
                <input type="text" list={`list-${q.id}`} value={answers[q.id] || ""} disabled={locked} onChange={e => handleChange(q.id, e.target.value)} placeholder={locked ? "" : "התחל להקליד..."} className={`h-full ${combinedInputStyle}`} />
                {q.customOptions && (
                  <datalist id={`list-${q.id}`}>
                    {(answers[q.id] || "").length > 0 && ((Array.isArray(q.customOptions) ? q.customOptions : (typeof q.customOptions === 'string' ? q.customOptions.split(',') : [])).map((opt: string, i: number) => <option key={i} value={opt.trim()} />))}
                  </datalist>
                )}
              </div>
            )}
            {q.answerType === "NUMERIC" && (
               <input type="number" value={answers[q.id] || ""} disabled={locked} onChange={e => handleChange(q.id, e.target.value)} placeholder={locked ? "" : "הכנס מספר..."} className={`h-[46px] ${combinedInputStyle}`} />
            )}
          </div>
        </div>
        
        <div className="flex-1"></div>
        
        <div className="mt-auto flex flex-col gap-2.5">
          {hasTruth && (
            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-700 text-center shadow-inner flex flex-col items-center">
              <span className="text-[9px] text-slate-500 block mb-1.5 font-black uppercase tracking-wider">אמת בפועל:</span>
              <div className="text-emerald-400 font-bold text-sm flex flex-wrap justify-center gap-1.5">
                {Array.isArray(truth) 
                  ? truth.map((ans, i) => (
                      <span key={i} className="flex items-center gap-1.5 bg-emerald-900/20 px-2 py-1 rounded-md border border-emerald-500/20">
                        {getFlagUrl(ans) && <img src={getFlagUrl(ans)!} className="w-3.5 h-2.5 object-cover rounded-sm" alt="flag" />}
                        {ans}{i < truth.length - 1 ? "" : ""}
                      </span>
                    ))
                  : (
                      <span className="flex items-center gap-1.5 bg-emerald-900/20 px-3 py-1 rounded-md border border-emerald-500/20 text-sm">
                        {getFlagUrl(truth) && <img src={getFlagUrl(truth)!} className="w-4 h-3 object-cover rounded-sm" alt="flag" />}
                        {truth}
                      </span>
                    )
                }
              </div>
            </div>
          )}
          
          {locked && (
            <button onClick={() => handleOpenSpy(q)} className="w-full py-2.5 rounded-xl font-black text-[13px] transition-all border flex items-center justify-center gap-2 bg-slate-900 text-slate-400 hover:text-white border-slate-700 hover:bg-slate-800 hover:border-slate-500 shadow-sm active:scale-95">
              <span className="text-base">🕵️‍♂️</span> הצג ניחושי חברים
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full animate-fade-in-up pb-8">
      
      <div className="sticky top-[72px] md:top-[88px] z-40 bg-slate-950/85 backdrop-blur-xl p-4 md:p-5 rounded-3xl border border-slate-700 shadow-[0_10px_30px_rgba(0,0,0,0.6)] mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all">
         <div className="w-full md:w-auto">
           <h2 className="text-xl md:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 flex items-center gap-2">
              <span>⭐</span> משימות בונוס
           </h2>
           {openCount > 0 ? (
             <div className="mt-2 flex items-center gap-3">
               <span className="text-slate-400 text-xs md:text-sm font-bold bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                 הושלמו: {answeredCount}/{openCount}
               </span>
               <div className="w-24 md:w-32 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700 shadow-inner">
                 <div className={`h-full transition-all duration-500 ${isAllAnswered ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${progressPercent}%` }}></div>
               </div>
               {isAllAnswered && <span className="text-emerald-400 text-xs md:text-sm font-bold">✓ מוכן</span>}
             </div>
           ) : (
             <div className="mt-2 text-slate-400 text-[11px] font-bold bg-slate-900 px-3 py-1 rounded-lg border border-slate-800 inline-block">
               אין שאלות פתוחות בשלב זה
             </div>
           )}
         </div>
         
         <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {filteredQuestions.some(q => !isQuestionLocked(q)) && (
               <button 
                  onClick={handleRandomizeCategory} 
                  disabled={isRandomizing}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] md:text-sm font-bold py-2 px-3 rounded-xl border border-slate-600 flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50 active:scale-95"
               >
                 <span className="text-base">🎲</span> {isRandomizing ? "מגריל..." : "הגרל פתוחות"}
               </button>
            )}
            <div className="h-6 flex items-center">
               {saveStatus === "saving" && <span className="text-amber-400 text-[10px] animate-pulse font-bold tracking-widest">⏳ שומר...</span>}
               {saveStatus === "saved" && <span className="text-emerald-400 text-[10px] font-bold tracking-widest">✓ נשמר</span>}
            </div>
         </div>
      </div>

      <div className="flex overflow-x-auto gap-2 md:gap-3 mb-4 pb-2 custom-scrollbar">
        {[
          { id: "TOURNAMENT", label: "🏆 טורניר" },
          { id: "GROUPS", label: "⚽ שלב הבתים" },
          { id: "KNOCKOUT", label: "🔥 נוק-אאוט" }
        ].map(tab => {
          if (tab.id === "KNOCKOUT" && tournamentState < 4) return null;
          return (
            <button 
              key={tab.id} 
              onClick={() => { 
                setBonusCategory(tab.id); 
                if (tab.id === "KNOCKOUT") {
                  const available = [
                    { id: "ALL", label: "כללי", minState: 0 },
                    { id: "R32", label: "32 הגדולות", minState: 4 },
                    { id: "R16", label: "שמינית גמר", minState: 6 },
                    { id: "QF", label: "רבע גמר", minState: 8 },
                    { id: "SF", label: "חצי גמר", minState: 10 },
                    { id: "FINAL", label: "גמר", minState: 12 }
                  ].filter(t => tournamentState >= t.minState);
                  if (available.length > 0) setKnockoutRound(available[available.length - 1].id);
                }
              }} 
              className={`px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl font-black whitespace-nowrap transition-all border text-xs md:text-sm ${
                bonusCategory === tab.id 
                  ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/25" 
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-blue-300"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {bonusCategory === "KNOCKOUT" && (
        <div className="flex overflow-x-auto gap-2 mb-6 pb-2 custom-scrollbar bg-slate-900/50 p-2 rounded-2xl border border-slate-800/50 max-w-fit">
          {[
            { id: "ALL", label: "כללי (כל הנוק-אאוט)", minState: 0 },
            { id: "R32", label: "32 הגדולות", minState: 4 },
            { id: "R16", label: "שמינית גמר", minState: 6 },
            { id: "QF", label: "רבע גמר", minState: 8 },
            { id: "SF", label: "חצי גמר", minState: 10 },
            { id: "FINAL", label: "גמר", minState: 12 }
          ].filter(t => tournamentState >= t.minState).map(subTab => (
            <button
              key={subTab.id}
              onClick={() => setKnockoutRound(subTab.id)}
              className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-all text-[11px] border ${
                knockoutRound === subTab.id
                  ? "bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/20"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white"
              }`}
            >
              {subTab.label}
            </button>
          ))}
        </div>
      )}

      {/* --- תת-טאבים חדשים ומהודרים לסוג השאלה (במקום גלילה ארוכה) --- */}
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

      {/* --- תצוגת הגריד המודרנית --- */}
      {filteredQuestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-900/50 rounded-3xl border border-dashed border-slate-700">
          <span className="text-5xl block mb-4 opacity-50">🤷‍♂️</span>
          <span className="text-slate-400 font-bold text-lg md:text-xl text-center">אין כרגע שאלות פתוחות בקטגוריה זו.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
           {activeQuestionsList.map(q => renderQuestionCard(q))}
        </div>
      )}

      {/* חלון הריגול */}
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

            {hasSpyTruth && (
              <div className="grid grid-cols-3 gap-2 mb-4 shrink-0">
                <button onClick={() => setSpyFilter("ALL")} className={`py-2 px-1 rounded-xl text-[10px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1 ${spyFilter === "ALL" ? "bg-slate-700 text-white border-slate-500 shadow-sm" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"}`}>
                  הכל ({spyData.length})
                </button>
                <button onClick={() => setSpyFilter("CORRECT")} className={`py-2 px-1 rounded-xl text-[10px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1.5 ${spyFilter === "CORRECT" ? "bg-emerald-900/40 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.15)]" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"}`}>
                  ✅ פגעו ({spyStats.correct})
                </button>
                <button onClick={() => setSpyFilter("INCORRECT")} className={`py-2 px-1 rounded-xl text-[10px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1.5 ${spyFilter === "INCORRECT" ? "bg-rose-900/40 text-rose-400 border-rose-500/50 shadow-[0_0_10px_rgba(225,29,72,0.1)]" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"}`}>
                  ❌ נפלו ({spyStats.incorrect})
                </button>
              </div>
            )}

            <div className="overflow-y-auto custom-scrollbar flex-1 pl-2 md:pl-4 pr-1 pb-2">
              {isLoadingSpy ? (
                <div className="flex justify-center py-8 text-blue-400 animate-pulse font-black tracking-wide">טוען נתונים מהשטח... ⏳</div>
              ) : filteredSpyData.length === 0 ? (
                <div className="text-center text-slate-500 py-8 font-bold">לא נמצאו ניחושים שמתאימים לחיפוש.</div>
              ) : (
                <div className="space-y-2.5">
                  {filteredSpyData.map((data, idx) => {
                    
                    let itemStyle = "px-3 py-2.5 rounded-xl border transition-all ";
                    if (hasSpyTruth) {
                      if (data.points && data.points > 0) itemStyle += "bg-emerald-900/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]";
                      else itemStyle += "bg-rose-900/10 border-rose-500/20 opacity-80";
                    } else {
                      itemStyle += data.userId === userId ? "bg-blue-900/10 border-blue-500/30" : "bg-slate-900/50 border-slate-800 hover:bg-slate-800";
                    }

                    return (
                      <div key={idx} className={itemStyle}>
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
                              <span className="text-[13px] sm:text-sm truncate max-w-[120px] sm:max-w-[160px]">{data.userName}</span>
                              {data.userId === userId && <span className="text-[8px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase">אתה</span>}
                            </div>
                            <div className="text-[9px] font-bold text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-700/50 shrink-0">
                              סה״כ: <span className="text-amber-400">{data.userTotalPoints}</span>
                            </div>
                        </div>
                        
                        <div className="flex justify-between items-center bg-slate-950/40 px-2.5 py-2 rounded-lg border border-slate-700/50 shadow-inner">
                           <div className={`font-bold text-[11px] sm:text-xs flex items-center gap-1.5 ${data.points && data.points > 0 ? "text-emerald-400" : "text-slate-300"}`}>
                             {getFlagUrl(data.answer) ? <img src={getFlagUrl(data.answer)!} className="w-4 h-3 object-cover rounded-sm shadow-sm" alt="flag" /> : <span className="text-sm">📝</span>}
                             <span className="truncate max-w-[150px] sm:max-w-[200px]">{data.answer}</span>
                           </div>
                           {hasSpyTruth && (
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