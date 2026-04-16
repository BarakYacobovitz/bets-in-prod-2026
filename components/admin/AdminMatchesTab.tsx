"use client";
import React, { useState, useEffect } from "react";
import { getFlagUrl } from "../../app/utils/flags";

export default function AdminMatchesTab({
  matches,
  isCalculating,
  handleDeleteAllMatches,
  handleFileUpload,
  fileInputRef,
  handleSaveMatch,
  handleClearMatch,
  handleUpdateMatchday,
  handleUpdateMatchDate,
  groupsList,
  savingId
}: any) {
  
  const [adminMatchGroup, setAdminMatchGroup] = useState<string>("ALL");
  const [adminSearchTerm, setAdminSearchTerm] = useState<string>("");
  const [adminKnockoutViewMode, setAdminKnockoutViewMode] = useState<"LIST" | "BRACKET">("LIST");
  const [quickFilter, setQuickFilter] = useState<"ALL" | "TODAY" | "MISSING">("ALL");
  
  // מעקב אחרי משחקים שנשמרו הרגע כדי לתת חיווי ירוק מגניב
  const [recentlySavedIds, setRecentlySavedIds] = useState<string[]>([]);

  const adminGroupList = ["ALL", ...groupsList, "KNOCKOUT"];
  const currentAdminGroupIndex = adminGroupList.indexOf(adminMatchGroup);
  
  const handlePrevAdminGroup = () => setAdminMatchGroup(adminGroupList[currentAdminGroupIndex === 0 ? adminGroupList.length - 1 : currentAdminGroupIndex - 1]);
  const handleNextAdminGroup = () => setAdminMatchGroup(adminGroupList[currentAdminGroupIndex === adminGroupList.length - 1 ? 0 : currentAdminGroupIndex + 1]);

  // פונקציית עזר לתאריכים (מונעת קריסות)
  const isMatchToday = (dateStr: string) => {
     if (!dateStr || typeof dateStr !== 'string') return false;
     try {
       const [d] = dateStr.split(" ");
       const [day, month, year] = (d || "").split("/");
       const today = new Date();
       return today.getDate() === Number(day) && today.getMonth() === Number(month) - 1 && today.getFullYear() === Number(year);
     } catch { return false; }
  };

  const isMatchMissingResult = (match: any) => {
     if (match.isFinished) return false;
     if (!match.matchDate || typeof match.matchDate !== 'string') return false;
     try {
       const parts = match.matchDate.split(" ");
       const [day, month, year] = (parts[0] || "").split("/");
       const [h, m] = (parts[1] || "00:00").split(":");
       const matchTime = new Date(Number(year), Number(month) - 1, Number(day), Number(h), Number(m)).getTime();
       // אם המשחק התחיל לפני שעתיים ועדיין אין תוצאה
       return (new Date().getTime() - matchTime) > (1000 * 60 * 120); 
     } catch { return false; }
  };

  const filteredMatches = matches.filter((m: any) => {
    // 1. סינון טקסט (חיפוש)
    if (adminSearchTerm && !m.homeTeam.includes(adminSearchTerm) && !m.awayTeam.includes(adminSearchTerm)) return false;
    
    // 2. סינון לפי קבוצת הטאבים המקורית (בית A/B/C)
    if (adminMatchGroup === "KNOCKOUT" && m.stage !== "KNOCKOUT") return false;
    if (adminMatchGroup !== "ALL" && adminMatchGroup !== "KNOCKOUT" && m.group !== adminMatchGroup) return false;

    // 3. סינונים מהירים (היום / חסרה תוצאה)
    if (quickFilter === "TODAY" && !isMatchToday(m.matchDate)) return false;
    if (quickFilter === "MISSING" && !isMatchMissingResult(m)) return false;

    return true;
  });

  const onSaveWithFeedback = async (matchId: string, home: number, away: number, qual: string) => {
     await handleSaveMatch(matchId, home, away, qual);
     setRecentlySavedIds(prev => [...prev, matchId]);
     setTimeout(() => {
        setRecentlySavedIds(prev => prev.filter(id => id !== matchId));
     }, 3000); // אחרי 3 שניות הכפתור יחזור לקדמותו
  };

  return (
    <div className="space-y-6 animate-fade-in-up w-full">
      
      {/* כפתורי סינון מהירים וחיפוש */}
      <div className="bg-slate-800 p-4 sm:p-6 rounded-3xl border border-slate-700 shadow-xl w-full">
        <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2"><span>🔍</span> איתור וסינון משחקים</h2>
        
        <div className="flex flex-col md:flex-row gap-4">
           {/* החיפוש החופשי */}
           <input 
              type="text" 
              placeholder="חפש נבחרת..." 
              value={adminSearchTerm} 
              onChange={(e) => setAdminSearchTerm(e.target.value)} 
              className="w-full md:w-1/3 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-colors"
           />
           
           {/* כפתורי ה"Quick Filters" */}
           <div className="flex-1 flex gap-2 overflow-x-auto custom-scrollbar pb-2 md:pb-0 snap-x">
             <button onClick={() => setQuickFilter("ALL")} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 snap-center ${quickFilter === "ALL" ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-700'}`}>
                🌐 הכל
             </button>
             <button onClick={() => setQuickFilter("TODAY")} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 snap-center ${quickFilter === "TODAY" ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-700'}`}>
                📅 משחקי היום
             </button>
             <button onClick={() => setQuickFilter("MISSING")} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 snap-center ${quickFilter === "MISSING" ? 'bg-rose-600 text-white shadow-md' : 'bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-700'}`}>
                ⚠️ חסרה תוצאה
             </button>
           </div>
        </div>

        {/* ניווט בין הבתים (נשאר בשביל סדר בעין) */}
        <div className="flex items-center justify-between bg-slate-900 p-2 rounded-2xl border border-slate-700/50 w-full mt-4">
          <button onClick={handlePrevAdminGroup} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors text-lg active:scale-95 border border-slate-600">▶</button>
          <div className="font-black text-white text-base sm:text-lg tracking-wide">{adminMatchGroup === "ALL" ? "כל הבתים והמשחקים" : adminMatchGroup === "KNOCKOUT" ? "שלבי הנוק-אאוט" : `בית ${adminMatchGroup}`}</div>
          <button onClick={handleNextAdminGroup} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors text-lg active:scale-95 border border-slate-600">◀</button>
        </div>
      </div>

      {adminMatchGroup === "KNOCKOUT" && (
        <div className="flex justify-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700 w-fit mx-auto shadow-inner">
          <button onClick={() => setAdminKnockoutViewMode("LIST")} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${adminKnockoutViewMode === "LIST" ? "bg-slate-600 text-white shadow" : "text-slate-400 hover:text-white"}`}>רשימה</button>
          <button onClick={() => setAdminKnockoutViewMode("BRACKET")} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${adminKnockoutViewMode === "BRACKET" ? "bg-slate-600 text-white shadow" : "text-slate-400 hover:text-white"}`}>עץ (Bracket)</button>
        </div>
      )}

      {/* תצוגת רשימת המשחקים */}
      {(adminMatchGroup !== "KNOCKOUT" || adminKnockoutViewMode === "LIST") ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
          {filteredMatches.length === 0 ? (
             <div className="col-span-full text-center py-10 text-slate-500 font-bold text-lg">לא נמצאו משחקים תואמים לסינון.</div>
          ) : (
             filteredMatches.map((m: any) => (
               <AdminMatchRow 
                 key={m.id} 
                 match={m} 
                 isSaving={savingId === m.id} 
                 justSaved={recentlySavedIds.includes(m.id)}
                 onSave={onSaveWithFeedback} 
                 onClear={handleClearMatch} 
                 onUpdateDate={handleUpdateMatchDate} 
                 onUpdateMatchday={handleUpdateMatchday} 
               />
             ))
          )}
        </div>
      ) : (
        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-700 overflow-x-auto shadow-inner w-full min-h-[500px]">
           <div className="text-center text-slate-500 font-bold mt-20">
              [תצוגת עץ נוקאאוט - כרגע רק רשימה נתמכת בעדכון תוצאות מהיר]
              <br/><br/>אנא עבוד ממצב "רשימה" לעדכון תוצאות קל יותר.
           </div>
        </div>
      )}

      <div className="bg-rose-900/20 p-6 rounded-3xl border border-rose-500/50 w-full mt-8 shadow-xl">
        <h3 className="text-xl font-black text-rose-500 mb-4 flex items-center gap-2"><span>⚠️</span> ניהול מסד משחקים נמוך (Low Level)</h3>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex-1 bg-slate-950 border border-slate-800 p-4 rounded-2xl w-full">
            <label className="block text-slate-400 text-xs font-bold mb-2">ייבוא משחקים מקובץ JSON</label>
            <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileUpload} className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 transition-colors file:cursor-pointer" />
          </div>
          <div className="flex-1 w-full sm:w-auto h-full flex items-end">
            <button onClick={handleDeleteAllMatches} className="w-full h-full min-h-[64px] bg-slate-900 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/30 px-6 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-md">
              <span>🗑️</span> מחק הכל
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminMatchRow({ match, isSaving, justSaved, onSave, onClear, onUpdateDate, onUpdateMatchday }: { match: any, isSaving: boolean, justSaved: boolean, onSave: any, onClear: any, onUpdateDate: any, onUpdateMatchday: any }) {
  const [homeInput, setHomeInput] = useState(match.realHomeScore ?? "");
  const [awayInput, setAwayInput] = useState(match.realAwayScore ?? "");
  const [qualifierInput, setQualifierInput] = useState(match.realQualifier ?? "");
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [timeInput, setTimeInput] = useState(match.matchDate || "");
  const [isEditingMatchday, setIsEditingMatchday] = useState(false);
  const [matchdayInput, setMatchdayInput] = useState(match.matchday || "");

  const isKnockout = match.stage === "KNOCKOUT";

  const handleSaveTime = () => { onUpdateDate(match.id, timeInput); setIsEditingTime(false); };
  const handleSaveMatchday = () => { onUpdateMatchday(match.id, matchdayInput); setIsEditingMatchday(false); };

  return (
    <div className={`bg-slate-900 p-4 sm:p-5 rounded-3xl border transition-all duration-300 shadow-lg relative overflow-hidden flex flex-col h-full ${justSaved ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] bg-emerald-900/10' : match.isFinished ? 'border-slate-700 opacity-90' : 'border-slate-600 hover:border-blue-500/50'}`}>
      
      {justSaved && <div className="absolute top-2 left-2 text-emerald-400 font-black text-xs animate-bounce">✓ עודכן!</div>}
      
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-[10px] sm:text-xs font-black bg-blue-900/30 text-blue-400 px-2 sm:px-2.5 py-1 rounded-lg border border-blue-500/20 whitespace-nowrap">ID: {match.id.substring(0, 4)}...</span>
        </div>
        <div className="flex gap-2">
          {isEditingMatchday ? (
            <div className="flex items-center gap-1 bg-slate-950 rounded-lg p-1 border border-slate-700"><input type="number" value={matchdayInput} onChange={e => setMatchdayInput(e.target.value)} className="w-10 sm:w-12 bg-transparent text-white text-center text-xs outline-none" /><button onClick={handleSaveMatchday} className="text-emerald-400 text-xs px-2 hover:bg-slate-800 rounded">✓</button></div>
          ) : (
            <button onClick={() => setIsEditingMatchday(true)} className="text-[10px] sm:text-xs font-black bg-slate-800 text-slate-300 hover:bg-slate-700 px-2 sm:px-2.5 py-1 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors whitespace-nowrap">מחזור {match.matchday}</button>
          )}
          {isEditingTime ? (
            <div className="flex items-center gap-1 bg-slate-950 rounded-lg p-1 border border-slate-700"><input type="text" value={timeInput} onChange={e => setTimeInput(e.target.value)} className="w-24 sm:w-32 bg-transparent text-white text-center text-xs outline-none" dir="ltr" /><button onClick={handleSaveTime} className="text-emerald-400 text-xs px-2 hover:bg-slate-800 rounded">✓</button></div>
          ) : (
            <button onClick={() => setIsEditingTime(true)} className="text-[10px] sm:text-xs font-black bg-slate-800 text-slate-300 hover:bg-slate-700 px-2 sm:px-2.5 py-1 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors whitespace-nowrap">{match.matchDate}</button>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center bg-slate-950 p-3 sm:p-4 rounded-2xl border border-slate-800 shadow-inner mb-4 flex-1">
        <div className="flex flex-col items-center flex-1 w-1/3 text-center gap-2">
          {getFlagUrl(match.homeTeam) ? <img src={getFlagUrl(match.homeTeam)!} className="w-6 h-4 sm:w-8 sm:h-5 object-cover rounded shadow-sm" alt="flag" /> : <span className="text-lg">🏳️</span>}
          <span className="font-bold text-white text-[11px] sm:text-sm leading-tight px-1 max-w-full break-words">{match.homeTeam}</span>
        </div>
        
        <div className="flex items-center gap-2 mx-2">
          <input type="number" value={homeInput} onChange={e => setHomeInput(e.target.value)} className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-900 border border-slate-700 rounded-xl text-center text-white font-black text-lg sm:text-xl outline-none focus:border-blue-500 focus:bg-slate-800 transition-colors" placeholder="-" />
          <span className="text-slate-600 font-black text-sm">:</span>
          <input type="number" value={awayInput} onChange={e => setAwayInput(e.target.value)} className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-900 border border-slate-700 rounded-xl text-center text-white font-black text-lg sm:text-xl outline-none focus:border-blue-500 focus:bg-slate-800 transition-colors" placeholder="-" />
        </div>

        <div className="flex flex-col items-center flex-1 w-1/3 text-center gap-2">
          {getFlagUrl(match.awayTeam) ? <img src={getFlagUrl(match.awayTeam)!} className="w-6 h-4 sm:w-8 sm:h-5 object-cover rounded shadow-sm" alt="flag" /> : <span className="text-lg">🏳️</span>}
          <span className="font-bold text-white text-[11px] sm:text-sm leading-tight px-1 max-w-full break-words">{match.awayTeam}</span>
        </div>
      </div>

      {isKnockout && (
        <div className="mb-4 bg-slate-950 p-3 rounded-2xl border border-slate-800">
          <label className="block text-center text-[10px] sm:text-xs text-slate-400 font-bold mb-2">מי העפילה לשלב הבא? (חובה לסמן)</label>
          <div className="flex gap-2">
            <button onClick={() => setQualifierInput(match.homeTeam)} className={`flex-1 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all border ${qualifierInput === match.homeTeam ? "bg-emerald-600/20 text-emerald-400 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800"}`}>
              {match.homeTeam}
            </button>
            <button onClick={() => setQualifierInput(match.awayTeam)} className={`flex-1 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all border ${qualifierInput === match.awayTeam ? "bg-emerald-600/20 text-emerald-400 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800"}`}>
              {match.awayTeam}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        <button type="button" onClick={() => onSave(match.id, parseInt(homeInput), parseInt(awayInput), qualifierInput)} disabled={isSaving || homeInput === "" || awayInput === "" || (isKnockout && qualifierInput === "")} className={`flex-1 py-2 sm:py-2.5 rounded-xl font-black text-[10px] sm:text-xs transition-all shadow-md flex items-center justify-center gap-1.5 ${justSaved ? "bg-emerald-500 text-white border border-emerald-400" : isSaving ? "bg-slate-600 text-slate-300" : match.isFinished ? "bg-slate-800 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500 hover:bg-slate-700" : "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500"} disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`}>
          {justSaved ? "✓ נשמר" : isSaving ? "⏳..." : match.isFinished ? "עדכן תוצאה" : "💾 שמור תוצאה"}
        </button>
        {match.isFinished && (
          <button type="button" onClick={() => { onClear(match.id); setHomeInput(""); setAwayInput(""); setQualifierInput(""); }} disabled={isSaving} className="w-10 sm:w-12 h-8 sm:h-auto flex-shrink-0 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-rose-900 text-rose-500 hover:text-rose-400 border border-slate-700 hover:border-rose-500 transition-all active:scale-95 disabled:opacity-50" title="אפס תוצאה">
             ✕
          </button>
        )}
      </div>
    </div>
  );
}