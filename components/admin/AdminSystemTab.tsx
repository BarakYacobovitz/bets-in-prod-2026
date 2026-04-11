"use client";
import React from "react";

export default function AdminSystemTab({
  tournamentState,
  setTournamentState,
  deadlines,
  setDeadlines,
  savingId,
  isCalculating,
  handleSaveTournamentState,
  handleSaveDeadlines,
  handleFactoryReset
}: any) {
  
  // העברנו את המערך הזה פנימה כדי שלא יעמיס על הקובץ הראשי
  const TIMELINE_STATES = [
    { val: 0, label: "0. טרום טורניר", desc: "הכל פתוח לניחוש. שום דבר לא נעול." },
    { val: 1, label: "1. שריקת הפתיחה (מחזור 1)", desc: "🔒 ננעלים: משחקי מחזור 1, עולות מבתים, 8 מעפילות, ושאלות טורניר/בתים." },
    { val: 2, label: "2. תחילת מחזור 2", desc: "🔒 ננעלים: משחקי מחזור 2." },
    { val: 3, label: "3. תחילת מחזור 3", desc: "🔒 ננעלים: משחקי מחזור 3 (שלב הבתים מסתיים למעשה)." },
    { val: 4, label: "4. חשיפת 32 הגדולות", desc: "👁️ נחשפים: משחקים ושאלות בונוס של 32 הגדולות + כל הנוק-אאוט." },
    { val: 5, label: "5. נעילת 32 הגדולות", desc: "🔒 ננעלים: משחקים ושאלות של 32 הגדולות + כל הנוק-אאוט." },
    { val: 6, label: "6. חשיפת שמינית גמר", desc: "👁️ נחשפים: משחקים ושאלות של שמינית הגמר." },
    { val: 7, label: "7. נעילת שמינית גמר", desc: "🔒 ננעלים: משחקים ושאלות של שמינית הגמר." },
    { val: 8, label: "8. חשיפת רבע גמר", desc: "👁️ נחשפים: משחקים ושאלות של רבע הגמר." },
    { val: 9, label: "9. נעילת רבע גמר", desc: "🔒 ננעלים: משחקים ושאלות של רבע הגמר." },
    { val: 10, label: "10. חשיפת חצי גמר", desc: "👁️ נחשפים: משחקים ושאלות של חצי הגמר." },
    { val: 11, label: "11. נעילת חצי גמר", desc: "🔒 ננעלים: משחקים ושאלות של חצי הגמר." },
    { val: 12, label: "12. חשיפת הגמר", desc: "👁️ נחשפים: משחק הגמר ושאלות הגמר." },
    { val: 13, label: "13. נעילת הגמר", desc: "🔒 ננעלים: משחק ושאלות הגמר. הטורניר נגמר!" }
  ];

  return (
    <div className="space-y-8 max-w-3xl mx-auto animate-fade-in-up">
      <div className="bg-slate-800 p-6 md:p-8 rounded-3xl border border-blue-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <h2 className="text-2xl md:text-3xl font-black text-white mb-2 flex items-center gap-3 relative z-10"><span>⏱️</span> ציר הזמן של הטורניר</h2>
        <p className="text-slate-400 text-sm mb-6 relative z-10">שינוי מצב כאן ינעל באופן אוטומטי כרטיסיות למשתמשים ויחשוף שלבים חדשים.</p>
        
        <div className="bg-slate-900/80 backdrop-blur-sm p-4 md:p-6 rounded-2xl border border-slate-700 relative z-10 shadow-inner">
          <h3 className="text-lg font-bold text-slate-300 mb-3">בחר סטטוס נוכחי:</h3>
          <select value={tournamentState} onChange={e => setTournamentState(Number(e.target.value))} className="w-full bg-slate-950 text-blue-400 font-bold text-base md:text-lg p-4 rounded-xl border border-slate-600 focus:border-blue-500 outline-none cursor-pointer mb-4 shadow-sm">
            {TIMELINE_STATES.map(state => <option key={state.val} value={state.val}>{state.label}</option>)}
          </select>
          <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl">
            <h4 className="text-blue-400 font-bold mb-1 text-sm md:text-base">משמעות הסטטוס:</h4>
            <p className="text-slate-300 text-xs md:text-sm font-medium leading-relaxed">{TIMELINE_STATES.find(s => s.val === tournamentState)?.desc}</p>
          </div>
        </div>
        
        <button onClick={handleSaveTournamentState} className="w-full mt-6 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black rounded-xl text-lg transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] relative z-10 active:scale-95">
          {savingId === "system" ? "מעדכן... ⏳" : "💾 שמור מצב טורניר"}
        </button>
        
        <div className="bg-slate-900/80 p-4 md:p-6 rounded-2xl border border-slate-700 relative z-10 mt-8 shadow-inner">
          <h3 className="text-lg md:text-xl font-bold text-white mb-2 flex items-center gap-2"><span>⏳</span> שעוני עצר (מועדי נעילה)</h3>
          <p className="text-slate-400 text-xs md:text-sm mb-4">הגדר כאן מתי יינעלו הניחושים לכל שלב. השעון יציג למשתמשים את השלב הקרוב ביותר.</p>
          
          <h4 className="text-blue-400 font-bold mb-3 text-sm">שלב הבתים</h4>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1"><label className="text-slate-400 text-xs block mb-1.5 font-bold uppercase">מחזור 1 (+עולות)</label><input type="datetime-local" value={deadlines.md1 || ""} onChange={e => setDeadlines({...deadlines, md1: e.target.value})} className="w-full bg-slate-950 text-white p-3 rounded-xl border border-slate-600 outline-none focus:border-blue-500 text-sm" /></div>
            <div className="flex-1"><label className="text-slate-400 text-xs block mb-1.5 font-bold uppercase">מחזור 2</label><input type="datetime-local" value={deadlines.md2 || ""} onChange={e => setDeadlines({...deadlines, md2: e.target.value})} className="w-full bg-slate-950 text-white p-3 rounded-xl border border-slate-600 outline-none focus:border-blue-500 text-sm" /></div>
            <div className="flex-1"><label className="text-slate-400 text-xs block mb-1.5 font-bold uppercase">מחזור 3</label><input type="datetime-local" value={deadlines.md3 || ""} onChange={e => setDeadlines({...deadlines, md3: e.target.value})} className="w-full bg-slate-950 text-white p-3 rounded-xl border border-slate-600 outline-none focus:border-blue-500 text-sm" /></div>
          </div>

          <h4 className="text-purple-400 font-bold mb-3 text-sm border-t border-slate-700/50 pt-4">שלבי הנוק-אאוט (דדליין מתחלף אחד)</h4>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
               <label className="text-slate-400 text-xs block mb-1.5 font-bold uppercase">מועד נעילה לסיבוב הקרוב</label>
               <input type="datetime-local" value={deadlines.knockout || ""} onChange={e => setDeadlines({...deadlines, knockout: e.target.value})} className="w-full bg-slate-950 text-white p-3 rounded-xl border border-slate-600 outline-none focus:border-purple-500 text-sm" />
            </div>
            <div className="flex-1 flex items-center text-slate-400 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800">
               💡 ברגע שהדדליין עובר, השעון למעלה יציג אוטומטית "No More Bets! בהצלחה" למשתמשים, עד שתזין תאריך לשלב הבא.
            </div>
          </div>
          
          <button onClick={handleSaveDeadlines} className="w-full py-3.5 bg-slate-700 hover:bg-slate-600 border border-slate-500 text-white font-bold rounded-xl transition-all shadow-sm active:scale-95">{savingId === "deadlines" ? "שומר..." : "💾 שמור שעוני עצר"}</button>
        </div>

        <div className="bg-rose-900/20 p-4 md:p-6 rounded-2xl border border-rose-500/50 relative z-10 mt-12 overflow-hidden group">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-20 pointer-events-none"></div>
          <h3 className="text-xl font-black text-rose-500 mb-2 flex items-center gap-2 relative z-10"><span>⚠️</span> אזור סכנה (Danger Zone)</h3>
          <p className="text-rose-300 text-xs md:text-sm mb-6 relative z-10">כפתור זה ימחק לחלוטין את כל המשתמשים, ינקה את כל הניחושים, יאפס את תוצאות האמת, ויחזיר את שעון הטורניר ל-0. <strong>המשחקים ושאלות הבונוס לא יימחקו</strong>.</p>
          <button onClick={handleFactoryReset} disabled={isCalculating} className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl transition-all shadow-[0_0_20px_rgba(225,29,72,0.4)] relative z-10 active:scale-95">{isCalculating ? "משמיד נתונים... ⏳" : "🧨 Factory Reset (מחק נתוני משתמשים)"}</button>
        </div>
      </div>
    </div>
  );
}