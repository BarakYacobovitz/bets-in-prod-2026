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

  const adminGroupList = ["ALL", ...groupsList, "KNOCKOUT"];
  const currentAdminGroupIndex = adminGroupList.indexOf(adminMatchGroup);
  
  const handlePrevAdminGroup = () => setAdminMatchGroup(adminGroupList[currentAdminGroupIndex === 0 ? adminGroupList.length - 1 : currentAdminGroupIndex - 1]);
  const handleNextAdminGroup = () => setAdminMatchGroup(adminGroupList[currentAdminGroupIndex === adminGroupList.length - 1 ? 0 : currentAdminGroupIndex + 1]);

  return (
    <div className="space-y-6 animate-fade-in-up w-full">
      <div className="bg-slate-800 p-4 md:p-6 rounded-3xl border border-blue-500/30 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h3 className="text-lg font-bold text-white flex items-center gap-2"><span>📄</span> ניהול משחקים (טעינה ומחיקה)</h3></div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto"> 
           <button onClick={handleDeleteAllMatches} disabled={isCalculating || matches.length === 0} className="w-full sm:w-auto bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg disabled:opacity-50 text-sm">
             {isCalculating ? "מוחק... ⏳" : "🗑️ מחק הכל"}
           </button>
           <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileUpload} className="hidden" id="json-upload" />
           <label htmlFor="json-upload" className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg w-full sm:w-auto text-center text-sm">
             {isCalculating ? "טוען... ⏳" : "📤 טען JSON"}
           </label>
        </div>
      </div>

      <div className="relative w-full max-w-xl mx-auto mt-6">
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl text-slate-500">🔍</span>
        <input 
          type="text" 
          value={adminSearchTerm}
          onChange={(e) => setAdminSearchTerm(e.target.value)}
          placeholder="חפש משחק לפי תאריך (למשל 21/05) או נבחרת..." 
          className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-2xl py-3 pr-12 pl-4 outline-none focus:border-blue-500 transition-colors shadow-inner"
        />
      </div>

      <div className="flex flex-col w-full border-t border-slate-800 pt-6">
        
        <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800 shadow-md backdrop-blur-md max-w-sm mx-auto mb-6 w-full">
           <button onClick={handlePrevAdminGroup} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 active:scale-95 text-lg">▶</button>
           <div className="flex flex-col items-center justify-center flex-1">
              <h2 className="text-xl md:text-2xl font-black text-white text-center">
                {adminMatchGroup === "ALL" ? "🌍 כל המשחקים" : adminMatchGroup === "KNOCKOUT" ? "🔥 נוק-אאוט" : `בית ${adminMatchGroup}`}
              </h2>
           </div>
           <button onClick={handleNextAdminGroup} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 active:scale-95 text-lg">◀</button>
        </div>

        <div className="w-full space-y-6">
          {adminMatchGroup === "ALL" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {matches.filter((m: any) => (m.homeTeam.includes(adminSearchTerm) || m.awayTeam.includes(adminSearchTerm) || (m.matchDate && m.matchDate.includes(adminSearchTerm)))).map((match: any) => <AdminMatchCard key={match.id} match={match} onSave={handleSaveMatch} onClear={handleClearMatch} onUpdateMatchday={handleUpdateMatchday} onUpdateDate={handleUpdateMatchDate} isSaving={savingId === match.id} />)}
                {matches.filter((m: any) => (m.homeTeam.includes(adminSearchTerm) || m.awayTeam.includes(adminSearchTerm) || (m.matchDate && m.matchDate.includes(adminSearchTerm)))).length === 0 && <div className="text-slate-500 font-bold p-8 bg-slate-800/50 rounded-2xl text-center border border-dashed border-slate-700 col-span-full">לא נמצאו משחקים התואמים לחיפוש.</div>}
              </div>
          ) : adminMatchGroup === "KNOCKOUT" ? (
            <>
              <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-full md:w-auto mb-6 max-w-xs mx-auto md:mx-0 shadow-inner">
                  <button onClick={() => setAdminKnockoutViewMode("LIST")} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${adminKnockoutViewMode === "LIST" ? "bg-purple-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}>📄 רשימה</button>
                  <button onClick={() => setAdminKnockoutViewMode("BRACKET")} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${adminKnockoutViewMode === "BRACKET" ? "bg-purple-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}>🌳 עץ טורניר</button>
              </div>

              {adminKnockoutViewMode === "LIST" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {matches.filter((m: any) => m.stage === "KNOCKOUT" && (m.homeTeam.includes(adminSearchTerm) || m.awayTeam.includes(adminSearchTerm) || (m.matchDate && m.matchDate.includes(adminSearchTerm)))).map((match: any) => <AdminMatchCard key={match.id} match={match} onSave={handleSaveMatch} onClear={handleClearMatch} onUpdateMatchday={handleUpdateMatchday} onUpdateDate={handleUpdateMatchDate} isSaving={savingId === match.id} />)}
                    {matches.filter((m: any) => m.stage === "KNOCKOUT").length === 0 && <div className="text-slate-500 font-bold p-8 bg-slate-800/50 rounded-2xl text-center border border-dashed border-slate-700">אין משחקי נוק-אאוט במערכת.</div>}
                  </div>
              ) : (
                  <div className="text-slate-400 p-8 text-center bg-slate-800/30 rounded-2xl border border-slate-700 font-bold">
                     (עץ הטורניר נשמר לקומפוננטה נפרדת. לעריכת משחקים, עבור לתצוגת רשימה או "כל המשחקים" 📄)
                  </div>
              )}
            </>
          ) : (
            <>
              {[1, 2, 3].map(day => {
                const dayMatches = matches.filter((m: any) => m.group === adminMatchGroup && (Number(m.matchday) || 1) === day && (m.homeTeam.includes(adminSearchTerm) || m.awayTeam.includes(adminSearchTerm) || (m.matchDate && m.matchDate.includes(adminSearchTerm))));
                if (dayMatches.length === 0) return null;
                return (
                  <div key={day} className="space-y-3 mb-6 bg-slate-800/30 p-4 rounded-3xl border border-slate-700/50">
                    <h3 className="text-sm font-bold text-slate-400">מחזור {day}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {dayMatches.map((match: any) => <AdminMatchCard key={match.id} match={match} onSave={handleSaveMatch} onClear={handleClearMatch} onUpdateMatchday={handleUpdateMatchday} onUpdateDate={handleUpdateMatchDate} isSaving={savingId === match.id} />)}
                    </div>
                  </div>
                );
              })}
              {matches.filter((m: any) => m.group === adminMatchGroup && (m.homeTeam.includes(adminSearchTerm) || m.awayTeam.includes(adminSearchTerm) || (m.matchDate && m.matchDate.includes(adminSearchTerm)))).length === 0 && (
                  <div className="text-slate-500 font-bold p-8 bg-slate-800/50 rounded-2xl text-center border border-dashed border-slate-700">לא נמצאו משחקים בבית זה.</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// --- קומפוננטת הכרטיס המוקטנת ---
function AdminMatchCard({ match, onSave, onClear, onUpdateMatchday, onUpdateDate, isSaving }: any) {
  const [homeInput, setHomeInput] = useState(match.realHomeScore !== undefined && match.realHomeScore !== null ? String(match.realHomeScore) : "");
  const [awayInput, setAwayInput] = useState(match.realAwayScore !== undefined && match.realAwayScore !== null ? String(match.realAwayScore) : "");
  const [qualifierInput, setQualifierInput] = useState(match.realQualifier || "");
  
  // הסטייט החדש לעריכת התאריך
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [dateInput, setDateInput] = useState(match.matchDate || "");

  useEffect(() => { 
    if (!match.isFinished) { setHomeInput(""); setAwayInput(""); setQualifierInput(""); } 
    else { setHomeInput(match.realHomeScore !== null ? String(match.realHomeScore) : ""); setAwayInput(match.realAwayScore !== null ? String(match.realAwayScore) : ""); setQualifierInput(match.realQualifier || ""); }
    setDateInput(match.matchDate || "");
  }, [match]);

  const isKnockout = match.stage === "KNOCKOUT";
  const themeColor = isKnockout ? "purple" : "blue";

  const updateDefaultQualifier = (hScore: string, aScore: string) => {
    if (hScore === "" || aScore === "") return;
    const h = Number(hScore); const a = Number(aScore);
    if (h > a) setQualifierInput(match.homeTeam);
    else if (a > h) setQualifierInput(match.awayTeam);
    else setQualifierInput("");
  };

  const handleHomeChange = (val: string) => { setHomeInput(val); if(isKnockout) updateDefaultQualifier(val, awayInput); };
  const handleAwayChange = (val: string) => { setAwayInput(val); if(isKnockout) updateDefaultQualifier(homeInput, val); };

  const numberInputClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  return (
    <div className={`bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-3 sm:p-4 shadow-xl border-t-4 border border-t-${themeColor}-500 border-slate-700 w-full max-w-lg mx-auto mb-3 transform transition-all relative ${match.isFinished ? "bg-emerald-900/10 border-emerald-500/30 grayscale-[15%]" : "hover:shadow-xl"}`} dir="rtl">
      
      <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
        <span className={`text-[8px] sm:text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded bg-${themeColor}-500/10 text-${themeColor}-400 border border-${themeColor}-500/20 shadow-sm`}>
          {isKnockout ? match.roundName : `בית ${match.group}`}
        </span>
        {!isKnockout && (
          <select value={match.matchday || 1} onChange={(e) => onUpdateMatchday(match.id, parseInt(e.target.value))} className="bg-slate-950 text-slate-300 font-bold text-[8px] sm:text-[10px] border border-slate-700 rounded px-1 py-0.5 outline-none focus:border-blue-500 cursor-pointer shadow-sm">
            <option value={1}>מחזור 1</option><option value={2}>מחזור 2</option><option value={3}>מחזור 3</option>
          </select>
        )}
        {match.isFinished && <span className="text-emerald-400 text-xs sm:text-sm drop-shadow-md" title="המשחק הסתיים">✅</span>}
      </div>

      <div className="flex flex-col justify-center items-center mt-6 sm:mt-4 mb-3 sm:mb-4">
         <div className="text-[10px] sm:text-xs font-bold text-slate-400 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-700 shadow-inner flex items-center gap-2 transition-all">
           <span>🕒</span>
           {isEditingDate ? (
             <div className="flex items-center gap-2">
               <input 
                 type="text" 
                 value={dateInput} 
                 onChange={(e) => setDateInput(e.target.value)} 
                 className="bg-slate-950 text-white px-2 py-0.5 rounded border border-blue-500 outline-none w-28 text-center text-[10px] sm:text-xs font-mono" 
                 dir="ltr" 
                 placeholder="DD/MM/YYYY HH:MM" 
                 autoFocus
               />
               <button onClick={() => { onUpdateDate(match.id, dateInput); setIsEditingDate(false); }} className="text-emerald-400 hover:text-emerald-300 transition-colors" title="שמור תאריך">💾</button>
               <button onClick={() => { setDateInput(match.matchDate || ""); setIsEditingDate(false); }} className="text-rose-400 hover:text-rose-300 transition-colors" title="ביטול">✕</button>
             </div>
           ) : (
             <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingDate(true)} title="לחץ לעריכת מועד המשחק">
               <span className="group-hover:text-blue-300 transition-colors">{match.matchDate || "טרם הוגדר"} {isKnockout && "• 120 דק'"}</span>
               <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity text-blue-400">✏️</span>
             </div>
           )}
         </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3 mb-3">
        <div className="flex justify-end text-left">
          <span className="text-sm sm:text-lg font-black text-slate-100 break-words leading-tight">{match.homeTeam}</span>
        </div>
        
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <div className="flex flex-col items-center">
             <input type="number" min="0" className={`w-10 h-10 sm:w-12 sm:h-12 text-center text-lg sm:text-xl font-black rounded-lg border focus:outline-none transition-all ${numberInputClass} ${match.isFinished ? "bg-slate-900 border-emerald-500/50 text-emerald-400 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]" : `bg-slate-800 border-slate-600 text-white focus:border-${themeColor}-500 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]`}`} value={homeInput} onChange={(e) => handleHomeChange(e.target.value)} placeholder="-" />
          </div>
          <div className="flex flex-col items-center justify-center"><span className="text-lg sm:text-xl font-black text-slate-600 pb-1">:</span></div>
          <div className="flex flex-col items-center">
             <input type="number" min="0" className={`w-10 h-10 sm:w-12 sm:h-12 text-center text-lg sm:text-xl font-black rounded-lg border focus:outline-none transition-all ${numberInputClass} ${match.isFinished ? "bg-slate-900 border-emerald-500/50 text-emerald-400 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]" : `bg-slate-800 border-slate-600 text-white focus:border-${themeColor}-500 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]`}`} value={awayInput} onChange={(e) => handleAwayChange(e.target.value)} placeholder="-" />
          </div>
        </div>

        <div className="flex justify-start text-right">
          <span className="text-sm sm:text-lg font-black text-slate-100 break-words leading-tight">{match.awayTeam}</span>
        </div>
      </div>

      {isKnockout && (
        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-700/50 mb-3 shadow-inner relative">
          <label className="block text-slate-400 text-[9px] sm:text-[10px] uppercase tracking-wider mb-1.5 font-black text-center">המעפילה?</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setQualifierInput(match.homeTeam)} className={`flex-1 py-1.5 rounded-lg font-black text-[10px] sm:text-xs transition-all border flex items-center justify-center cursor-pointer active:scale-95 hover:border-slate-500 ${qualifierInput === match.homeTeam ? "bg-emerald-600 text-white border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-slate-900 text-slate-400 border-slate-700"}`}>
              {match.homeTeam}
            </button>
            <button type="button" onClick={() => setQualifierInput(match.awayTeam)} className={`flex-1 py-1.5 rounded-lg font-black text-[10px] sm:text-xs transition-all border flex items-center justify-center cursor-pointer active:scale-95 hover:border-slate-500 ${qualifierInput === match.awayTeam ? "bg-emerald-600 text-white border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-slate-900 text-slate-400 border-slate-700"}`}>
              {match.awayTeam}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-1">
        <button type="button" onClick={() => onSave(match.id, parseInt(homeInput), parseInt(awayInput), qualifierInput)} disabled={isSaving || homeInput === "" || awayInput === "" || (isKnockout && qualifierInput === "")} className={`flex-1 py-2 sm:py-2.5 rounded-lg font-black text-[10px] sm:text-xs transition-all shadow-md flex items-center justify-center gap-1.5 ${isSaving ? "bg-slate-600 text-slate-300" : match.isFinished ? "bg-slate-800 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500 hover:bg-slate-700" : `bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500`} disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`}>
          {isSaving ? "⏳..." : match.isFinished ? "עדכן תוצאה" : "💾 שמור וסיים"}
        </button>
        {match.isFinished && (
          <button type="button" onClick={() => onClear(match.id)} disabled={isSaving} className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-black text-[10px] sm:text-xs bg-rose-600/10 text-rose-400 hover:bg-rose-600/20 border border-rose-500/30 hover:border-rose-500/50 transition-all active:scale-95" title="אפס משחק למצב פתוח">
            אפס
          </button>
        )}
      </div>
    </div>
  );
}