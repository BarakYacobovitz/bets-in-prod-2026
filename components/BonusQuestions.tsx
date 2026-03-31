"use client";
import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../app/firebase";
import { getFlagUrl } from "../app/utils/flags"; // 🎌 ייבוא פונקציית הדגלים!

export default function BonusQuestions({ userId, tournamentState: propTournamentState, groups }: any) {
  const allTeams = groups ? Object.values(groups).flat().sort() : [];

  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any>({});
  const [realBonusAnswers, setRealBonusAnswers] = useState<any>({});
  const [tournamentState, setTournamentState] = useState<number>(propTournamentState || 0);
  
  const [bonusCategory, setBonusCategory] = useState<string>("TOURNAMENT");
  const [knockoutRound, setKnockoutRound] = useState<string>("ALL");
  
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isLoading, setIsLoading] = useState(true);
  const [isRandomizing, setIsRandomizing] = useState(false);

  const [spyModalQuestion, setSpyModalQuestion] = useState<any | null>(null);
  const [spyData, setSpyData] = useState<any[]>([]);
  const [isLoadingSpy, setIsLoadingSpy] = useState(false);

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
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const isQuestionLocked = (q: any) => {
    // ---- תיקון זמן לשאלת הפתעה (נעילה) ----
    if (q.isSurprise) {
      if (!q.closeTime) return false;
      const now = new Date();
      const closeTime = new Date(q.closeTime);
      if (now >= closeTime) return true; // עברנו את שעת הסגירה
      return false; // כל עוד לא הגענו, השאלה פתוחה
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
    // ---- תיקון זמן לשאלת הפתעה (חשיפה) ----
    if (q.isSurprise) {
      if (!q.openTime) return false;
      const now = new Date();
      const openTime = new Date(q.openTime);
      if (now < openTime) return false; // מוקדם מדי, תסתיר
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

  // ---- הסינון החכם שמעלים שאלות שלא אמורות להיראות ----
  const filteredQuestions = questions.filter(q => {
    if (!isQuestionVisible(q)) return false; // חותך החוצה שאלות שמוסתרות בגלל זמנים או שלב
    
    if (q.phase !== bonusCategory) return false;
    if (bonusCategory === "KNOCKOUT") return q.round === knockoutRound;
    return true;
  });

  const handleRandomizeCategory = async () => {
    if (!confirm("להגריל תשובות אקראיות לכל השאלות הפתוחות בקטגוריה זו?")) return;
    setIsRandomizing(true);
    try {
      const newAnswers = { ...answers };
      let hasChanges = false;
      
      filteredQuestions.forEach(q => {
        // התיקון: נגריל רק אם השאלה גלויה ולא נעולה
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
    setIsLoadingSpy(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const usersMap: any = {};
      usersSnap.forEach(doc => { usersMap[doc.id] = doc.data().name || "שחקן לא ידוע"; });

      const allBonusSnap = await getDocs(collection(db, "predictions_bonus"));
      const gathered: any[] = [];
      allBonusSnap.forEach(doc => {
        const data = doc.data();
        const ans = data.answers?.[q.id];
        if (ans) {
          const userIdDoc = doc.id;
          gathered.push({
            userId: userIdDoc,
            userName: usersMap[userIdDoc] || "משתמש",
            answer: ans,
            points: checkAnswerPoints(q, ans)
          });
        }
      });
      gathered.sort((a, b) => a.userName.localeCompare(b.userName));
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
  const activeSurpriseQs = surpriseQuestions.filter(q => !isQuestionLocked(q));
  const lockedSurpriseQs = surpriseQuestions.filter(q => isQuestionLocked(q));

  const renderQuestionCard = (q: any) => {
    const locked = isQuestionLocked(q);
    const truth = realBonusAnswers[q.id];
    const hasTruth = !!truth;
    const myPoints = checkAnswerPoints(q, answers[q.id]);
    const isMissing = !locked && (!answers[q.id] || answers[q.id].trim() === "");

    let cardStyle = "bg-slate-800 p-6 rounded-3xl border-t-4 border-l border-r border-b border-slate-700 relative transition-all duration-300 ";
    let statusBadge = null;

    if (hasTruth) {
      cardStyle += myPoints && myPoints > 0 ? "border-t-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)]" : "border-t-slate-500 opacity-90 grayscale-[10%]";
      statusBadge = <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg border border-emerald-500/30">✅ נבדק</span>;
    } else if (locked) {
      cardStyle += "opacity-80 grayscale-[30%] border-t-slate-500";
      statusBadge = <span className="text-xs bg-slate-900/80 text-slate-400 px-2 py-1 rounded-lg border border-slate-700">🔒 נעול</span>;
    } else if (isMissing) {
      cardStyle += "border-t-amber-500 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:scale-[1.02] bg-slate-800/90";
      statusBadge = <span className="text-xs font-bold bg-amber-500/10 text-amber-400 px-3 py-1.5 rounded-lg border border-amber-500/50 animate-pulse shadow-sm">⚠️ חסר ניחוש!</span>;
    } else {
      cardStyle += "border-t-blue-500 hover:scale-[1.02]";
      statusBadge = <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded-lg border border-blue-500/30 shadow-sm">✍️ נשמר</span>;
    }

    const weightLabel = q.weight === "DOUBLE" ? "🔥 דאבל" : q.weight === "SURPRISE" ? "🎁 הפתעה" : "🎯 רגיל";
    const weightClass = q.weight === "DOUBLE" ? "bg-rose-500/10 text-rose-400 border-rose-500/30" : q.weight === "SURPRISE" ? "bg-purple-500/10 text-purple-400 border-purple-500/30" : "bg-blue-500/10 text-blue-400 border-blue-500/30";

    const inputBaseStyle = "w-full p-3 rounded-xl border outline-none text-center font-bold transition-colors shadow-inner flex-1";
    const inputStateStyle = locked 
      ? "bg-slate-900/50 text-slate-400 border-slate-700 cursor-not-allowed" 
      : isMissing 
        ? "bg-slate-950 text-white border-amber-500/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-500" 
        : "bg-slate-900 text-white border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
    const combinedInputStyle = `${inputBaseStyle} ${inputStateStyle}`;

    return (
      <div key={q.id} className={cardStyle}>
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs font-bold px-2 py-1 rounded-lg bg-slate-900 text-slate-300 border border-slate-700 shadow-sm">{q.points} נק'</span>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${weightClass}`}>{weightLabel}</span>
            {statusBadge}
          </div>
          {hasTruth && myPoints !== null && (
            <div className={`px-3 py-1 rounded-lg text-sm font-black shadow-sm ${myPoints > 0 ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-900 text-slate-500 border border-slate-700"}`}>
              {myPoints > 0 ? `🎯 +${myPoints}` : "0"}
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-start gap-2 mb-2">
           <h3 className="text-lg font-bold text-white leading-snug">{q.label}</h3>
           {!locked && (
              <button onClick={() => handleRandomizeSingleQuestion(q)} title="הגרל תשובה" className="text-xl hover:scale-125 transition-transform active:scale-90 opacity-70 hover:opacity-100 shrink-0">
                🎲
              </button>
           )}
        </div>

        {q.liveStatus && (
          <div className="mb-4 bg-slate-950/50 border border-slate-700/50 p-3 rounded-xl flex items-center gap-3 shadow-inner">
             <div className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
             </div>
             <span className="text-slate-300 text-sm font-medium"><strong className="text-rose-400 font-bold">לייב:</strong> {q.liveStatus}</span>
          </div>
        )}

        <div className="mb-4 mt-4 flex items-center gap-3">
          {getFlagUrl(answers[q.id]) && (
            <div className="shrink-0 bg-slate-900 border border-slate-600 p-2.5 rounded-xl shadow-inner flex items-center justify-center h-[50px] w-[60px]">
              <img src={getFlagUrl(answers[q.id])!} className="w-8 h-5.5 object-cover rounded-sm shadow-sm" alt="flag" />
            </div>
          )}
          <div className="flex-1 w-full">
            {q.answerType === "ALL_TEAMS" && (
              <select value={answers[q.id] || ""} disabled={locked} onChange={e => handleChange(q.id, e.target.value)} className={`h-[50px] ${combinedInputStyle}`}>
                <option value="">-- בחר נבחרת --</option>{allTeams.map((t: string) => <option key={t} value={t}>{t}</option>)}{(q.customOptions || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            )}
            {(q.answerType === "MULTIPLE_CHOICE" || q.answerType === "TEAM_SUBSET") && (
              <select value={answers[q.id] || ""} disabled={locked} onChange={e => handleChange(q.id, e.target.value)} className={`h-[50px] ${combinedInputStyle}`}>
                <option value="">-- בחר תשובה --</option>{(q.customOptions || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            )}
            {(q.answerType === "OPEN_TEXT" || q.answerType === "PLAYER") && (
              <div className="relative w-full h-[50px]">
                <input type="text" list={`list-${q.id}`} value={answers[q.id] || ""} disabled={locked} onChange={e => handleChange(q.id, e.target.value)} placeholder={locked ? "" : "התחל להקליד לחיפוש..."} className={`h-full ${combinedInputStyle}`} />
                {q.customOptions && (
                  <datalist id={`list-${q.id}`}>
                    {(answers[q.id] || "").length > 0 && ((Array.isArray(q.customOptions) ? q.customOptions : (typeof q.customOptions === 'string' ? q.customOptions.split(',') : [])).map((opt: string, i: number) => <option key={i} value={opt.trim()} />))}
                  </datalist>
                )}
              </div>
            )}
            {q.answerType === "NUMERIC" && (
               <input type="number" value={answers[q.id] || ""} disabled={locked} onChange={e => handleChange(q.id, e.target.value)} placeholder={locked ? "" : "הכנס מספר..."} className={`h-[50px] ${combinedInputStyle}`} />
            )}
          </div>
        </div>
        
        {hasTruth && (
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700 mt-4 text-center shadow-inner flex flex-col items-center">
            <span className="text-xs text-slate-500 block mb-2">התשובה הנכונה בפועל:</span>
            <div className="text-emerald-400 font-bold flex flex-wrap justify-center gap-2">
              {Array.isArray(truth) 
                ? truth.map((ans, i) => (
                    <span key={i} className="flex items-center gap-1.5 bg-emerald-900/20 px-2 py-1 rounded-md border border-emerald-500/20">
                      {getFlagUrl(ans) && <img src={getFlagUrl(ans)!} className="w-4 h-3 object-cover rounded-sm" alt="flag" />}
                      {ans}{i < truth.length - 1 ? "" : ""}
                    </span>
                  ))
                : (
                    <span className="flex items-center gap-1.5 bg-emerald-900/20 px-3 py-1 rounded-md border border-emerald-500/20 text-lg">
                      {getFlagUrl(truth) && <img src={getFlagUrl(truth)!} className="w-5 h-3.5 object-cover rounded-sm" alt="flag" />}
                      {truth}
                    </span>
                  )
              }
            </div>
          </div>
        )}
        
        {locked && (
          <button onClick={() => handleOpenSpy(q)} className="w-full mt-4 py-3 rounded-xl font-bold text-sm transition-all border flex items-center justify-center gap-2 bg-slate-900 text-slate-400 hover:text-white border-slate-700 hover:bg-slate-800 shadow-sm">
            <span>👁️</span> מי ניחש מה? (ריגול)
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-800 pb-6">
         <div>
           <h2 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">שאלות בונוס</h2>
           {openCount > 0 ? (
             <div className="mt-3 flex items-center gap-3">
               <span className="text-slate-400 text-sm font-bold bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                 הושלמו: {answeredCount}/{openCount}
               </span>
               <div className="w-32 h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700 shadow-inner">
                 <div className={`h-full transition-all duration-500 ${isAllAnswered ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${progressPercent}%` }}></div>
               </div>
               {isAllAnswered && <span className="text-emerald-400 text-sm font-bold">✓ מוכן</span>}
             </div>
           ) : (
             <div className="mt-3 text-slate-400 text-sm font-bold bg-slate-900 px-3 py-1 rounded-lg border border-slate-800 inline-block">
               אין שאלות פתוחות בשלב זה
             </div>
           )}
         </div>
         
         <div className="flex items-center gap-4 w-full md:w-auto justify-end">
            {filteredQuestions.some(q => !isQuestionLocked(q)) && (
               <button 
                  onClick={handleRandomizeCategory} 
                  disabled={isRandomizing}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-bold py-2 px-4 rounded-xl border border-slate-600 flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
               >
                 <span className="text-xl">🎲</span> {isRandomizing ? "מגריל..." : "הגרל שאלות פתוחות"}
               </button>
            )}
            <div className="h-6">
               {saveStatus === "saving" && <span className="text-amber-400 text-sm animate-pulse font-bold">⏳ שומר...</span>}
               {saveStatus === "saved" && <span className="text-emerald-400 text-sm font-bold">✓ נשמר</span>}
            </div>
         </div>
      </div>

      <div className="flex overflow-x-auto gap-3 mb-4 pb-2 custom-scrollbar">
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
              className={`px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all border ${
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
        <div className="flex overflow-x-auto gap-2 mb-8 pb-2 custom-scrollbar bg-slate-900/50 p-2 rounded-2xl border border-slate-800/50">
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
              className={`px-4 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-sm border ${
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
      
      {bonusCategory !== "KNOCKOUT" && <div className="mb-8"></div>}

      {filteredQuestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-900/50 rounded-3xl border border-dashed border-slate-700">
          <span className="text-5xl block mb-4">🤷‍♂️</span>
          <span className="text-slate-400 font-bold text-xl text-center">אין כרגע שאלות פתוחות בקטגוריה זו.</span>
        </div>
      ) : (
        <div className="space-y-12">
         {filteredQuestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-900/50 rounded-3xl border border-dashed border-slate-700">
          <span className="text-5xl block mb-4">🤷‍♂️</span>
          <span className="text-slate-400 font-bold text-xl text-center">אין כרגע שאלות פתוחות בקטגוריה זו.</span>
        </div>
      ) : (
        <div className="space-y-12">
          
          {/* התיקון: העברנו את ההפתעות להיות הבלוק הראשון! */}
{/* התיקון: הפתעות חיות ובועטות מקבלות את הבמה המרכזית (סגול זוהר וקופץ) */}
          {activeSurpriseQs.length > 0 && (
            <div className="bg-purple-900/10 p-6 rounded-3xl border border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.1)]">
              <h3 className="text-2xl font-black text-purple-400 mb-6 flex items-center gap-2 border-b-2 border-purple-500/30 pb-3">
                <span className="animate-bounce">🎁</span> שאלת הפתעה (לזמן מוגבל!)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {activeSurpriseQs.map(renderQuestionCard)}
              </div>
            </div>
          )}

          {regularQuestions.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-blue-400 mb-6 flex items-center gap-2 border-b border-slate-800 pb-3">
                <span>🎯</span> שאלות רגילות
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {regularQuestions.map(renderQuestionCard)}
              </div>
            </div>
          )}

          {doubleQuestions.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-rose-400 mb-6 flex items-center gap-2 border-b border-slate-800 pb-3">
                <span>🔥</span> שאלות דאבל-בונוס (ניקוד כפול!)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {doubleQuestions.map(renderQuestionCard)}
              </div>
            </div>
          )}
                    {/* שאלות הפתעה שנגמרו יוצגו בשקט וברגוע */}
          {lockedSurpriseQs.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-slate-400 mb-6 flex items-center gap-2 border-b border-slate-800 pb-3 opacity-80">
                <span>🎁</span> שאלות הפתעה שהסתיימו
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {lockedSurpriseQs.map(renderQuestionCard)}
              </div>
            </div>
          )}
          
        </div>
      )}
        </div>
      )}

      {spyModalQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl relative">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><span>🕵️‍♂️</span> ריגול בונוס</h3>
              <button onClick={() => setSpyModalQuestion(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors font-bold">✕</button>
            </div>

            <div className="bg-slate-800/80 p-4 rounded-xl mb-6 border border-slate-700/50 text-center shadow-inner">
              <h4 className="text-blue-300 font-bold mb-3">{spyModalQuestion.label}</h4>
              {realBonusAnswers[spyModalQuestion.id] && (
                 <div className="text-sm bg-emerald-900/20 text-emerald-400 px-4 py-2 rounded-lg border border-emerald-500/30 inline-block font-bold">
                   תשובה נכונה: 
                   <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                     {Array.isArray(realBonusAnswers[spyModalQuestion.id]) 
                        ? realBonusAnswers[spyModalQuestion.id].map((ans: string, i: number, arr: any[]) => (
                            <span key={i} className="flex items-center gap-1">
                              {getFlagUrl(ans) && <img src={getFlagUrl(ans)!} className="w-4 h-3 object-cover rounded-sm" alt="flag" />}
                              {ans}{i < arr.length - 1 ? " / " : ""}
                            </span>
                          ))
                        : (
                          <span className="flex items-center gap-1.5">
                            {getFlagUrl(realBonusAnswers[spyModalQuestion.id]) && <img src={getFlagUrl(realBonusAnswers[spyModalQuestion.id])!} className="w-4 h-3 object-cover rounded-sm" alt="flag" />}
                            {realBonusAnswers[spyModalQuestion.id]}
                          </span>
                        )
                     }
                   </div>
                 </div>
              )}
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
              {isLoadingSpy ? (
                <div className="flex justify-center py-8 text-blue-400 animate-pulse font-bold">סורק נתונים... ⏳</div>
              ) : spyData.length === 0 ? (
                <div className="text-center text-slate-500 py-8">אף אחד לא ענה על השאלה הזו</div>
              ) : (
                <div className="space-y-2">
                  {spyData.map((data, idx) => (
                    <div key={idx} className={`flex justify-between items-center p-3 rounded-xl border transition-all ${data.userId === userId ? "bg-blue-900/10 border-blue-500/30" : "bg-slate-800 border-slate-700 hover:bg-slate-700"}`}>
                      <div className="font-medium text-white flex items-center gap-2">
                        {data.userName}
                        {data.userId === userId && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase">אתה</span>}
                      </div>
                      <div className="flex items-center gap-3">
                         <div className={`font-bold text-sm px-3 py-1.5 rounded-lg border shadow-sm flex items-center gap-1.5 ${data.points > 0 ? "bg-emerald-900/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]" : "bg-slate-900 text-slate-300 border-slate-600"}`}>
                           {getFlagUrl(data.answer) && <img src={getFlagUrl(data.answer)!} className="w-4 h-3 object-cover rounded-sm" alt="flag" />}
                           {data.answer}
                         </div>
                         {data.points !== null && (
                           <div className={`text-xs font-black w-12 text-center ${data.points > 0 ? "text-emerald-400" : "text-slate-600"}`}>
                             {data.points > 0 ? `+${data.points}` : "0"}
                           </div>
                         )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}