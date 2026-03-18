"use client";
import { useState, useEffect, useRef } from "react";
import { doc, setDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "../app/firebase";

export default function KnockoutMatchCard({ matchId, homeTeam, awayTeam, matchDate, userId, isLocked, roundName }) {
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [qualifier, setQualifier] = useState(""); // המעפילה לשלב הבא
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "locked">("idle");
  
  const isUserAction = useRef(false);
  const isLoaded = useRef(false);

  // 1. שליפת הנתונים בלייב
  useEffect(() => {
    if (!userId || !matchId) return;
    const docRef = doc(db, "predictions_knockout", `${userId}_${matchId}`);
    
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
    });

    return () => unsubscribe();
  }, [userId, matchId]);

  // 2. שמירה אוטומטית 
  useEffect(() => {
    if (isLocked) { setSaveStatus("locked"); return; }
    if (!isLoaded.current || !isUserAction.current) return;
    
    if (homeScore === "" || awayScore === "") {
      setSaveStatus("idle");
      return;
    }

    setSaveStatus("saving");
    const autoSaveTimer = setTimeout(async () => {
      try {
        await setDoc(doc(db, "predictions_knockout", `${userId}_${matchId}`), {
          userId: userId,
          matchId: matchId,
          homeTeam: homeTeam,
          awayTeam: awayTeam,
          roundName: roundName,
          predictedHomeScore: Number(homeScore),
          predictedAwayScore: Number(awayScore),
          qualifier: qualifier, 
          timestamp: new Date()
        }, { merge: true });
        
        setSaveStatus("saved");
        isUserAction.current = false;
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (error) { 
        setSaveStatus("idle"); 
        isUserAction.current = false;
      }
    }, 800);

    return () => clearTimeout(autoSaveTimer);
  }, [homeScore, awayScore, qualifier, matchId, homeTeam, awayTeam, userId, isLocked, roundName]);

  // לוגיקת האוטומציה של המעפילה (מופעלת *רק* כשמשנים תוצאה!)
  const updateDefaultQualifier = (hScore: string, aScore: string) => {
    if (hScore === "" || aScore === "") return;
    const h = Number(hScore);
    const a = Number(aScore);
    
    if (h > a) {
      setQualifier(homeTeam); 
    } else if (a > h) {
      setQualifier(awayTeam); 
    } else {
      setQualifier(""); 
    }
  };

  const handleHomeChange = (val: string) => {
    isUserAction.current = true;
    setHomeScore(val);
    updateDefaultQualifier(val, awayScore); // מפעיל אוטומציה רק כאן
  };

  const handleAwayChange = (val: string) => {
    isUserAction.current = true;
    setAwayScore(val);
    updateDefaultQualifier(homeScore, val); // מפעיל אוטומציה רק כאן
  };

  // פונקציית בחירת מעפילה ידנית (מאפשרת לגדר חופשי מבלי שזה ידרוס)
  const handleQualifierChange = (val: string) => {
    isUserAction.current = true;
    setQualifier(val);
  };

  // 🎲 פונקציית הגרלה
  const handleRandomize = () => {
    if (isLocked) return;
    const h = Math.floor(Math.random() * 4);
    const a = Math.floor(Math.random() * 4);
    isUserAction.current = true;
    setHomeScore(h.toString());
    setAwayScore(a.toString());

    if (h > a) setQualifier(homeTeam);
    else if (a > h) setQualifier(awayTeam);
    else setQualifier(Math.random() > 0.5 ? homeTeam : awayTeam);
  };

  const isMissingPrediction = !isLocked && (homeScore === "" || awayScore === "" || qualifier === "");
  const numberInputClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  return (
    <div className={`rounded-2xl p-5 sm:p-7 w-full max-w-lg mx-auto relative bg-gradient-to-br from-slate-800 to-slate-900 border-t-4 border border-t-purple-500 border-slate-700/80 shadow-xl transition-all duration-300 mb-6 ${
      isLocked ? "opacity-90 grayscale-[15%]" : "hover:shadow-2xl hover:-translate-y-1"
    }`} dir="rtl">
      
      {/* הפינה השמאלית העליונה */}
      <div className="absolute top-4 left-4 z-10">
        {isLocked ? (
           <span title="נעול לעריכה" className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 text-slate-500 border border-slate-800 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-inner">
             🔒 נעול
           </span>
        ) : (
          <button 
            type="button" 
            onClick={handleRandomize} 
            title="ניחוש אקראי" 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 border border-slate-700 hover:border-slate-500 hover:bg-slate-700/80 rounded-lg text-slate-400 hover:text-white transition-all shadow-sm group active:scale-95"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">אקראי</span>
            <span className="text-sm group-hover:rotate-12 transition-transform">🎲</span>
          </button>
        )}
      </div>

      {/* תווית השלב */}
      <div className="absolute top-4 right-4 z-10">
         <span className="text-[10px] uppercase font-black tracking-wider px-2.5 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            {roundName}
         </span>
      </div>

      {/* תאריך */}
      <div className="flex flex-col justify-center items-center mt-3 mb-6 gap-2">
         <div className="text-xs font-bold text-slate-400 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-800">
           🕒 {matchDate} • תוצאה ב-120 דק'
         </div>
      </div>

      {/* אזור התוצאות - GRID נקי מירכאוז */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 mb-6 mt-2">
        <div className="flex justify-end">
          <span className="text-xl sm:text-2xl font-black text-slate-100 break-words leading-tight text-left">
            {homeTeam}
          </span>
        </div>
        
        <div className="flex items-center justify-center gap-3 sm:gap-4">
          <div className="flex flex-col items-center">
             <input 
               type="number" min="0" disabled={isLocked} 
               className={`w-14 h-16 sm:w-16 sm:h-18 text-center text-3xl sm:text-4xl font-black rounded-xl border-2 focus:outline-none transition-all ${numberInputClass} ${isLocked ? "bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed" : isMissingPrediction && homeScore === "" ? "bg-slate-900 border-amber-500/50 text-white shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]" : "bg-slate-800 border-slate-600 text-white focus:border-purple-500 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"}`} 
               value={homeScore} 
               onChange={(e) => handleHomeChange(e.target.value)} 
               placeholder="-" 
             />
          </div>
          
          <div className="flex flex-col items-center justify-center">
             <span className="text-3xl sm:text-4xl font-black text-slate-600 leading-none pb-1">:</span>
          </div>

          <div className="flex flex-col items-center">
             <input 
               type="number" min="0" disabled={isLocked} 
               className={`w-14 h-16 sm:w-16 sm:h-18 text-center text-3xl sm:text-4xl font-black rounded-xl border-2 focus:outline-none transition-all ${numberInputClass} ${isLocked ? "bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed" : isMissingPrediction && awayScore === "" ? "bg-slate-900 border-amber-500/50 text-white shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]" : "bg-slate-800 border-slate-600 text-white focus:border-purple-500 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"}`} 
               value={awayScore} 
               onChange={(e) => handleAwayChange(e.target.value)} 
               placeholder="-" 
             />
          </div>
        </div>

        <div className="flex justify-start">
          <span className="text-xl sm:text-2xl font-black text-slate-100 break-words leading-tight text-right">
            {awayTeam}
          </span>
        </div>
      </div>

      {/* --- אזור בחירת המעפילה - כפתורי Toggle מודרניים במקום Dropdown! --- */}
      <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700/50 mb-2 shadow-inner relative">
        <label className="block text-slate-400 text-[11px] uppercase tracking-wider mb-3 font-black text-center">
          מי תעלה לשלב הבא?
        </label>
        
        <div className="flex gap-3">
          {/* כפתור קבוצת בית */}
          <button
            type="button" 
            disabled={isLocked}
            onClick={() => handleQualifierChange(homeTeam)}
            className={`flex-1 py-3 rounded-xl font-black text-sm transition-all border-2 flex items-center justify-center ${
              isLocked ? "cursor-not-allowed opacity-70" : "cursor-pointer active:scale-95 hover:border-slate-500"
            } ${
              qualifier === homeTeam
                ? "bg-purple-600 text-white border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                : isMissingPrediction && qualifier === "" 
                ? "bg-slate-900 text-slate-400 border-amber-500/40"
                : "bg-slate-900 text-slate-400 border-slate-700"
            }`}
          >
            {homeTeam}
          </button>

          {/* כפתור קבוצת חוץ */}
          <button
            type="button" 
            disabled={isLocked}
            onClick={() => handleQualifierChange(awayTeam)}
            className={`flex-1 py-3 rounded-xl font-black text-sm transition-all border-2 flex items-center justify-center ${
              isLocked ? "cursor-not-allowed opacity-70" : "cursor-pointer active:scale-95 hover:border-slate-500"
            } ${
              qualifier === awayTeam
                ? "bg-purple-600 text-white border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                : isMissingPrediction && qualifier === "" 
                ? "bg-slate-900 text-slate-400 border-amber-500/40"
                : "bg-slate-900 text-slate-400 border-slate-700"
            }`}
          >
            {awayTeam}
          </button>
        </div>
        
        {/* אזהרת הגידור - קופצת ברגע שאתה בוחר בכפתור שהפוך מהתוצאה */}
        {qualifier !== "" && homeScore !== "" && awayScore !== "" && (
           ((Number(homeScore) > Number(awayScore) && qualifier === awayTeam) || 
            (Number(awayScore) > Number(homeScore) && qualifier === homeTeam)) && (
              <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center shadow-inner">
                <p className="text-amber-400 text-[11px] font-black uppercase tracking-wide flex items-center justify-center gap-1.5">
                  <span className="animate-pulse text-sm">⚠️</span> פיצול: המעפילה סותרת את התוצאה
                </p>
              </div>
           )
        )}
      </div>

      {/* אזור חיווי שמירה */}
      <div className="h-6 mt-3 flex justify-center items-center text-[11px] font-black tracking-wider uppercase transition-opacity duration-300">
        {saveStatus === "saving" && <span className="text-amber-400/80 animate-pulse">⏳ שומר נתונים...</span>}
        {saveStatus === "saved" && <span className="text-emerald-400">✓ נשמר בהצלחה</span>}
      </div>
    </div>
  );
}