"use client";
import { useState, useEffect, useRef } from "react";
import { doc, setDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "../app/firebase";

export default function MatchCard({ match, userId, tournamentState = 0 }: { match: any, userId: string, tournamentState?: number }) {
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [qualifier, setQualifier] = useState("");
  
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isLoading, setIsLoading] = useState(true);

  const [showSpyModal, setShowSpyModal] = useState(false);
  const [spyData, setSpyData] = useState<any[]>([]);
  const [isLoadingSpy, setIsLoadingSpy] = useState(false);

  const [now, setNow] = useState(new Date());

  const isUserAction = useRef(false);
  const isLoaded = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // שליפת הניחוש בזמן אמת
  useEffect(() => {
    if (!userId || !match.id) return;
    const collectionName = match.stage === "KNOCKOUT" ? "predictions_knockout" : "predictions_matches";
    const docRef = doc(db, collectionName, `${userId}_${match.id}`);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (!isUserAction.current) {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setHomeScore(data.predictedHomeScore !== undefined ? String(data.predictedHomeScore) : "");
          setAwayScore(data.predictedAwayScore !== undefined ? String(data.predictedAwayScore) : "");
          setQualifier(data.qualifier || "");
        }
      }
      isLoaded.current = true;
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId, match.id, match.stage]);

  // שמירה אוטומטית - הוצאנו מכאן את אוטומציית המעפילה כדי שלא תדרוס אותך!
  useEffect(() => {
    if (!isLoaded.current || !isUserAction.current) return;

    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        const collectionName = match.stage === "KNOCKOUT" ? "predictions_knockout" : "predictions_matches";
        const docRef = doc(db, collectionName, `${userId}_${match.id}`);
        const payload: any = { 
          userId, 
          matchId: match.id, 
          predictedHomeScore: homeScore, 
          predictedAwayScore: awayScore, 
          updatedAt: new Date() 
        };
        if (match.stage === "KNOCKOUT") { 
          payload.qualifier = qualifier; 
          payload.roundName = match.roundName; 
        } else { 
          payload.groupId = match.group; 
        }
        
        await setDoc(docRef, payload, { merge: true });
        setSaveStatus("saved");
        isUserAction.current = false;
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch(e) { 
        setSaveStatus("idle"); 
        isUserAction.current = false;
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [homeScore, awayScore, qualifier, userId, match]);

  // לוגיקת האוטומציה של המעפילה - עכשיו רצה רק כשמשנים תוצאה
  const updateDefaultQualifier = (hScore: string, aScore: string) => {
    if (hScore === "" || aScore === "") return;
    const h = Number(hScore);
    const a = Number(aScore);
    
    if (h > a) {
      setQualifier(match.homeTeam); 
    } else if (a > h) {
      setQualifier(match.awayTeam); 
    } else {
      setQualifier(""); 
    }
  };

  const parseMatchDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const [datePart, timePart] = dateStr.split(" ");
    if (!datePart || !timePart) return new Date();
    const [day, month, year] = datePart.split("/");
    const [hours, minutes] = timePart.split(":");
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes));
  };

  const matchDateObj = parseMatchDate(match.matchDate);
  const timeSinceStartMs = now.getTime() - matchDateObj.getTime();
  const duration150Mins = 150 * 60 * 1000;
  
  const isLive = timeSinceStartMs >= 0 && timeSinceStartMs < duration150Mins && !match.isFinished;
  const isWaitingForResult = timeSinceStartMs >= duration150Mins && !match.isFinished;

  let isManualLocked = false;
  let isHidden = false;
  const currentState = Number(tournamentState) || 0;

  if (match.stage !== "KNOCKOUT") {
    const md = Number(match.matchday) || 1; 
    if (md === 1 && currentState >= 1) isManualLocked = true;
    if (md === 2 && currentState >= 2) isManualLocked = true;
    if (md === 3 && currentState >= 3) isManualLocked = true;
  } else {
    if (match.roundName === "32 הגדולות") { if (currentState < 4) isHidden = true; if (currentState >= 5) isManualLocked = true; } 
    else if (match.roundName === "שמינית גמר") { if (currentState < 6) isHidden = true; if (currentState >= 7) isManualLocked = true; } 
    else if (match.roundName === "רבע גמר") { if (currentState < 8) isHidden = true; if (currentState >= 9) isManualLocked = true; } 
    else if (match.roundName === "חצי גמר") { if (currentState < 10) isHidden = true; if (currentState >= 11) isManualLocked = true; } 
    else if (match.roundName === "גמר") { if (currentState < 12) isHidden = true; if (currentState >= 13) isManualLocked = true; }
  }

  const isLocked = isManualLocked || match.isFinished;
  const isMissingPrediction = !isLocked && (homeScore === "" || awayScore === "" || (match.stage === "KNOCKOUT" && qualifier === ""));

  const getSmartDateText = () => {
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const checkDate = new Date(matchDateObj); checkDate.setHours(0, 0, 0, 0);
    const timeString = match.matchDate.split(" ")[1];

    if (checkDate.getTime() === today.getTime()) return `היום ב-${timeString}`;
    if (checkDate.getTime() === tomorrow.getTime()) return `מחר ב-${timeString}`;
    return `${match.matchDate.split(" ")[0]} ב-${timeString}`;
  };

  const calculateMatchPoints = (predH: string, predA: string, predQ: string) => {
    if (!match.isFinished || predH === "" || predA === "") return null;
    let pts = 0; const rH = Number(match.realHomeScore); const rA = Number(match.realAwayScore); const pH = Number(predH); const pA = Number(predA);
    if (Math.sign(pH - pA) === Math.sign(rH - rA)) { pts += 5; if (pH === rH && pA === rA) pts += 10; }
    if (match.stage === "KNOCKOUT" && predQ === match.realQualifier && predQ !== "") {
      const qMap: any = { "32 הגדולות": 5, "שמינית גמר": 10, "רבע גמר": 15, "חצי גמר": 20, "גמר": 25 }; pts += (qMap[match.roundName] || 0);
    }
    return pts;
  };

  const getPointsBadge = (points: number | null) => {
    if (points === null) return null;
    if (points === 0) return <span className="bg-slate-800 text-slate-500 px-3 py-1.5 rounded-lg text-xs font-black shadow-inner border border-slate-700">0 נק'</span>;
    if (points === 5) return <span className="bg-blue-900/40 text-blue-400 border border-blue-500/40 px-3 py-1.5 rounded-lg text-xs font-black shadow-sm">+5 נק'</span>;
    if (points >= 15) return <span className="bg-emerald-900/40 text-emerald-400 border border-emerald-500/50 px-3 py-1.5 rounded-lg text-xs font-black shadow-[0_0_12px_rgba(16,185,129,0.3)]">🎯 +{points} נק'</span>;
    return <span className="bg-purple-900/40 text-purple-400 border border-purple-500/40 px-3 py-1.5 rounded-lg text-xs font-black shadow-sm">+{points} נק'</span>;
  };

  const handleRandomize = () => {
    if (isLocked) return;
    const h = Math.floor(Math.random() * 4);
    const a = Math.floor(Math.random() * 4);
    isUserAction.current = true;
    setHomeScore(h.toString());
    setAwayScore(a.toString());

    if (match.stage === "KNOCKOUT") {
      if (h > a) setQualifier(match.homeTeam);
      else if (a > h) setQualifier(match.awayTeam);
      else setQualifier(Math.random() > 0.5 ? match.homeTeam : match.awayTeam);
    }
  };

  const handleOpenSpyModal = async () => {
    setShowSpyModal(true);
    if (spyData.length > 0) return;
    setIsLoadingSpy(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const usersMap: any = {}; usersSnap.forEach(doc => { usersMap[doc.id] = doc.data().name || "שחקן לא ידוע"; });
      const collectionName = match.stage === "KNOCKOUT" ? "predictions_knockout" : "predictions_matches";
      const q = query(collection(db, collectionName), where("matchId", "==", match.id));
      const predictionsSnap = await getDocs(q);
      const gatheredData: any[] = [];
      predictionsSnap.forEach(doc => {
        const data = doc.data();
        if (data.predictedHomeScore !== "" && data.predictedAwayScore !== "") {
          gatheredData.push({ userId: data.userId, userName: usersMap[data.userId] || "משתמש", home: data.predictedHomeScore, away: data.predictedAwayScore, qualifier: data.qualifier || "", points: calculateMatchPoints(data.predictedHomeScore, data.predictedAwayScore, data.qualifier || "") });
        }
      });
      gatheredData.sort((a, b) => a.userName.localeCompare(b.userName));
      setSpyData(gatheredData);
    } catch (error) { console.error("שגיאה בריגול:", error); } finally { setIsLoadingSpy(false); }
  };

  if (isHidden || isLoading) return null;

  const isKnockout = match.stage === "KNOCKOUT";
  const themeColor = isKnockout ? "purple" : "blue";
  const myPoints = calculateMatchPoints(homeScore, awayScore, qualifier);

  let cardStyle = `bg-gradient-to-br from-slate-800 to-slate-900 border-t-4 border border-t-${themeColor}-500 border-slate-700/80 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300`;
  let statusBadge = null;

  if (match.isFinished) {
    cardStyle = "bg-slate-900/90 border border-slate-700 opacity-80 grayscale-[30%] shadow-none";
    statusBadge = <div className="px-4 py-1.5 rounded-full text-[11px] uppercase tracking-wide font-black flex items-center gap-2 bg-slate-950 text-slate-500 border border-slate-800">🏁 סיום</div>;
  } else if (isLive) {
    cardStyle = "bg-gradient-to-br from-slate-800 to-slate-900 border border-rose-500 shadow-[0_0_25px_rgba(225,29,72,0.15)]";
    statusBadge = <div className="px-4 py-1.5 rounded-full text-[11px] uppercase tracking-wider font-black flex items-center gap-2 bg-rose-500/10 text-rose-400 border border-rose-500/50 shadow-[0_0_10px_rgba(225,29,72,0.3)]"><span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span> LIVE</div>;
  } else if (isWaitingForResult) {
    cardStyle = "bg-gradient-to-br from-slate-800 to-slate-900 border border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.1)] opacity-95";
    statusBadge = <div className="px-4 py-1.5 rounded-full text-[11px] uppercase tracking-wide font-black flex items-center gap-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/50"><span className="animate-pulse">⏳</span> ממתין לסיום</div>;
  } else if (isLocked) { 
    cardStyle = "bg-slate-900 border border-slate-700 opacity-90";
    statusBadge = <div className="px-4 py-1.5 rounded-full text-[11px] uppercase tracking-wide font-black flex items-center gap-2 bg-slate-950 text-slate-400 border border-slate-700">🔒 נעול</div>;
  } else if (isMissingPrediction) {
    cardStyle = "bg-gradient-to-br from-slate-800 to-slate-900 border border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.1)] hover:-translate-y-1 transition-all duration-300";
    statusBadge = <div className="px-4 py-1.5 rounded-full text-[11px] uppercase tracking-wide font-black flex items-center gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/50"><span className="animate-pulse">⚠️</span> חסר ניחוש</div>;
  } else {
    statusBadge = <div className="px-4 py-1.5 rounded-full text-[11px] uppercase tracking-wide font-black flex items-center gap-2 bg-slate-800 text-slate-300 border border-slate-600">✍️ פתוח להצבעה</div>;
  }

  const numberInputClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  return (
    <>
      <div className={`rounded-2xl p-5 sm:p-7 w-full max-w-lg mx-auto relative ${cardStyle}`} dir="rtl">
        
        {/* הפינה השמאלית העליונה - כפתור ההגרלה */}
        <div className="absolute top-4 left-4 z-10">
          {match.isFinished ? (
            getPointsBadge(myPoints)
          ) : !isLocked ? (
            <button 
              type="button"
              onClick={handleRandomize} 
              title="ניחוש אקראי" 
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 border border-slate-700 hover:border-slate-500 hover:bg-slate-700/80 rounded-lg text-slate-400 hover:text-white transition-all shadow-sm group active:scale-95"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider">אקראי</span>
              <span className="text-sm group-hover:rotate-12 transition-transform">🎲</span>
            </button>
          ) : null}
        </div>

        {/* תווית השלב */}
        <div className="absolute top-4 right-4 z-10"><span className={`text-[10px] uppercase font-black tracking-wider px-2.5 py-1.5 rounded-lg bg-${themeColor}-500/10 text-${themeColor}-400 border border-${themeColor}-500/20`}>{isKnockout ? match.roundName : `בית ${match.group}`}</span></div>

        {/* סטטוס ותאריך */}
        <div className="flex flex-col justify-center items-center mt-3 mb-6 gap-2">
           <div className="text-xs font-bold text-slate-400 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-800">🕒 {getSmartDateText()}</div>
           {statusBadge}
        </div>

        {/* אזור התוצאות */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 mb-6 mt-2">
          
          <div className="flex justify-end">
            <span className="text-xl sm:text-2xl font-black text-slate-100 break-words leading-tight text-left">
              {match.homeTeam}
            </span>
          </div>
          
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <div className="flex flex-col items-center">
               <input 
                 type="number" min="0" disabled={isLocked} 
                 className={`w-14 h-16 sm:w-16 sm:h-18 text-center text-3xl sm:text-4xl font-black rounded-xl border-2 focus:outline-none transition-all ${numberInputClass} ${isLocked ? "bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed" : isMissingPrediction ? "bg-slate-900 border-amber-500/50 text-white shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]" : `bg-slate-800 border-slate-600 text-white focus:border-${themeColor}-500 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]`} ${match.isFinished && homeScore === String(match.realHomeScore) ? "border-emerald-500/50 text-emerald-400 bg-emerald-900/20" : ""}`} 
                 value={homeScore} 
                 onChange={(e) => { 
                   isUserAction.current = true; 
                   setHomeScore(e.target.value); 
                   if(isKnockout) updateDefaultQualifier(e.target.value, awayScore);
                 }} 
                 placeholder="-" 
               />
            </div>
            
            <div className="flex flex-col items-center justify-center">
               <span className="text-3xl sm:text-4xl font-black text-slate-600 leading-none pb-1">:</span>
            </div>

            <div className="flex flex-col items-center">
               <input 
                 type="number" min="0" disabled={isLocked} 
                 className={`w-14 h-16 sm:w-16 sm:h-18 text-center text-3xl sm:text-4xl font-black rounded-xl border-2 focus:outline-none transition-all ${numberInputClass} ${isLocked ? "bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed" : isMissingPrediction ? "bg-slate-900 border-amber-500/50 text-white shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]" : `bg-slate-800 border-slate-600 text-white focus:border-${themeColor}-500 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]`} ${match.isFinished && awayScore === String(match.realAwayScore) ? "border-emerald-500/50 text-emerald-400 bg-emerald-900/20" : ""}`} 
                 value={awayScore} 
                 onChange={(e) => { 
                   isUserAction.current = true; 
                   setAwayScore(e.target.value); 
                   if(isKnockout) updateDefaultQualifier(homeScore, e.target.value);
                 }} 
                 placeholder="-" 
               />
            </div>
          </div>

          <div className="flex justify-start">
            <span className="text-xl sm:text-2xl font-black text-slate-100 break-words leading-tight text-right">
              {match.awayTeam}
            </span>
          </div>
          
        </div>
        
        {match.isFinished && (
            <div className="flex justify-center gap-12 mt-1 mb-4">
              <span className="text-[11px] font-black text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/20 shadow-sm">אמת: {match.realHomeScore}</span>
              <span className="text-[11px] font-black text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/20 shadow-sm">אמת: {match.realAwayScore}</span>
            </div>
        )}

        {/* --- בחירת עולה בשלבי נוקאאוט (כפתורים במקום SELECT!) --- */}
        {isKnockout && (
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700/50 mb-2 shadow-inner relative">
            {match.isFinished && match.realQualifier && (<div className="absolute top-2 left-3 text-[10px] text-emerald-400 font-black tracking-wide bg-emerald-900/20 px-2 py-0.5 rounded">העפילה: {match.realQualifier}</div>)}
            <label className="block text-slate-400 text-[11px] uppercase tracking-wider mb-3 font-black text-center">
              מי תעלה לשלב הבא?
            </label>
            
            <div className="flex gap-3">
              <button
                type="button" 
                disabled={isLocked}
                onClick={() => { isUserAction.current = true; setQualifier(match.homeTeam); }}
                className={`flex-1 py-3 rounded-xl font-black text-sm transition-all border-2 flex items-center justify-center ${
                  isLocked ? "cursor-not-allowed opacity-70" : "cursor-pointer active:scale-95 hover:border-slate-500"
                } ${
                  qualifier === match.homeTeam
                    ? "bg-purple-600 text-white border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                    : isMissingPrediction && qualifier === "" 
                    ? "bg-slate-900 text-slate-400 border-amber-500/40"
                    : "bg-slate-900 text-slate-400 border-slate-700"
                }`}
              >
                {match.homeTeam}
              </button>

              <button
                type="button" 
                disabled={isLocked}
                onClick={() => { isUserAction.current = true; setQualifier(match.awayTeam); }}
                className={`flex-1 py-3 rounded-xl font-black text-sm transition-all border-2 flex items-center justify-center ${
                  isLocked ? "cursor-not-allowed opacity-70" : "cursor-pointer active:scale-95 hover:border-slate-500"
                } ${
                  qualifier === match.awayTeam
                    ? "bg-purple-600 text-white border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                    : isMissingPrediction && qualifier === "" 
                    ? "bg-slate-900 text-slate-400 border-amber-500/40"
                    : "bg-slate-900 text-slate-400 border-slate-700"
                }`}
              >
                {match.awayTeam}
              </button>
            </div>
            
            {/* אזהרת הגידור */}
            {qualifier !== "" && homeScore !== "" && awayScore !== "" && (
               ((Number(homeScore) > Number(awayScore) && qualifier === match.awayTeam) || 
                (Number(awayScore) > Number(homeScore) && qualifier === match.homeTeam)) && (
                  <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center shadow-inner">
                    <p className="text-amber-400 text-[11px] font-black uppercase tracking-wide flex items-center justify-center gap-1.5">
                      <span className="animate-pulse text-sm">⚠️</span> פיצול: המעפילה סותרת את התוצאה
                    </p>
                  </div>
               )
            )}
          </div>
        )}

        {/* חיווי שמירה */}
        <div className="mt-4 h-4 flex justify-center items-center text-[11px] font-black tracking-wider uppercase">
          {saveStatus === "saving" && <span className="text-amber-400/80 animate-pulse">⏳ מבצע שמירה...</span>}
          {saveStatus === "saved" && <span className="text-emerald-400">✓ נשמר בהצלחה</span>}
        </div>

        {/* כפתור ריגול */}
        {isLocked && (
          <div className="mt-5 border-t border-slate-700/50 pt-4">
            <button onClick={handleOpenSpyModal} className={`w-full py-3 rounded-xl font-black text-sm transition-all border-2 flex items-center justify-center gap-2 shadow-sm ${showSpyModal ? "bg-blue-900/20 text-blue-400 border-blue-500/30" : "bg-slate-900 text-slate-400 hover:text-white border-slate-700 hover:bg-slate-800 hover:border-slate-500"}`}>
              <span className="text-lg">🕵️‍♂️</span> הצג את ניחושי החברים
            </button>
          </div>
        )}
      </div>

      {/* מודל ריגול (Spy Modal) */}
      {showSpyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md" dir="rtl">
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 p-6 rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl relative">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-700/50">
                <h3 className="text-xl font-black text-white flex items-center gap-2"><span>🕵️‍♂️</span> חדר בקרה</h3>
                <button onClick={() => setShowSpyModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors font-black border border-slate-700 hover:border-rose-500/30">✕</button>
            </div>
            
            <div className="bg-slate-900 rounded-2xl mb-5 border border-slate-700/50 overflow-hidden shadow-inner">
               <div className="bg-slate-800/80 p-2 text-center text-[10px] text-blue-400 font-black uppercase tracking-widest">{isKnockout ? match.roundName : `מחזור ${Number(match.matchday) || 1}`}</div>
               <div className="p-4 flex justify-between items-center text-sm font-bold text-slate-300">
                 <div className="flex flex-col items-center flex-1"><span className="text-xl font-black text-white mb-1 tracking-tight">{match.homeTeam}</span>{match.isFinished && <span className="text-emerald-400 text-[10px] uppercase font-black bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/20">אמת: {match.realHomeScore}</span>}</div>
                 <span className="text-slate-600 px-2 font-black text-xl">VS</span>
                 <div className="flex flex-col items-center flex-1"><span className="text-xl font-black text-white mb-1 tracking-tight">{match.awayTeam}</span>{match.isFinished && <span className="text-emerald-400 text-[10px] uppercase font-black bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/20">אמת: {match.realAwayScore}</span>}</div>
               </div>
            </div>
            
            <div className="overflow-y-auto custom-scrollbar flex-1 pr-1">
              {isLoadingSpy ? (<div className="flex justify-center py-8 text-blue-400 animate-pulse font-black tracking-wide">טוען נתונים מהשטח... ⏳</div>) : spyData.length === 0 ? (<div className="text-center text-slate-500 py-8 font-bold">דממה... אף אחד לא ניחש את המשחק הזה.</div>) : (
                <div className="space-y-2.5">
                  {spyData.map((data, idx) => (
                    <div key={idx} className={`p-4 rounded-xl border-2 transition-all ${data.userId === userId ? "bg-blue-900/10 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.1)]" : "bg-slate-900/50 border-slate-800 hover:bg-slate-800"}`}>
                      <div className="flex justify-between items-center mb-3">
                          <div className="font-bold text-slate-200 flex items-center gap-2">{data.userName}{data.userId === userId && <span className="text-[9px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded shadow-sm">אתה</span>}</div>
                          {getPointsBadge(data.points)}
                      </div>
                      <div className="flex justify-center items-center gap-5">
                          <div className="flex flex-col items-center"><span className="text-2xl font-black text-white bg-slate-950 border border-slate-700 w-12 h-12 flex items-center justify-center rounded-xl shadow-inner">{data.home}</span></div>
                          <div className="text-slate-600 font-black">:</div>
                          <div className="flex flex-col items-center"><span className="text-2xl font-black text-white bg-slate-950 border border-slate-700 w-12 h-12 flex items-center justify-center rounded-xl shadow-inner">{data.away}</span></div>
                      </div>
                      {isKnockout && data.qualifier && (<div className="mt-3 text-center"><span className="text-[10px] bg-purple-500/10 text-purple-300 px-3 py-1 rounded-md border border-purple-500/20 font-bold uppercase tracking-wide">הימר שיעפילו: {data.qualifier}</span></div>)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}