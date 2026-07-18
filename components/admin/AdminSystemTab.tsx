"use client";
import React from "react";

export default function AdminSystemTab({
  tournamentState,
  setTournamentState,
  activeDeadline,
  setActiveDeadline,
  savingId,
  isCalculating,
  handleSaveTournamentState,
  handleSaveDeadline,
  handleFactoryReset,
  feedbackOpen,
  setFeedbackOpen
}: any) {
  
  const TIMELINE_STATES = [
    { val: 0, label: "0. טרום טורניר", desc: "הכל פתוח לניחוש. שום דבר לא נעול." },
    { val: 1, label: "1. שריקת הפתיחה (מחזור 1)", desc: "🔒 ננעלים: מחזור 1, עולות מבתים ושאלות בונוס כלליות." },
    { val: 2, label: "2. תחילת מחזור 2", desc: "🔒 ננעלים: משחקי מחזור 2." },
    { val: 3, label: "3. תחילת מחזור 3", desc: "🔒 ננעלים: משחקי מחזור 3 (סיום בתים)." },
    { val: 4, label: "4. חשיפת 32 הגדולות", desc: "👁️ נחשפים: משחקים ושאלות בונוס ל-32." },
    { val: 5, label: "5. סגירת 32 הגדולות", desc: "🔒 ננעלים: כל הניחושים ל-32 הגדולות." },
    { val: 6, label: "6. חשיפת שמינית", desc: "👁️ נחשפים: משחקים ושאלות לשמינית גמר." },
    { val: 7, label: "7. סגירת שמינית", desc: "🔒 ננעלים: כל הניחושים לשמינית." },
    { val: 8, label: "8. חשיפת רבע", desc: "👁️ נחשפים: משחקים ושאלות לרבע גמר." },
    { val: 9, label: "9. סגירת רבע", desc: "🔒 ננעלים: כל הניחושים לרבע גמר." },
    { val: 10, label: "10. חשיפת חצי", desc: "👁️ נחשפים: משחקים ושאלות לחצי גמר." },
    { val: 11, label: "11. סגירת חצי", desc: "🔒 ננעלים: כל הניחושים לחצי גמר." },
    { val: 12, label: "12. חשיפת גמר", desc: "👁️ נחשפים: משחקים לגמר." },
    { val: 13, label: "13. סגירת גמר", desc: "🔒 ננעלים: גמר ומקום שלישי. הניחושים נחשפים במטריקס." },
    { val: 14, label: "14. סיום טורניר", desc: "🏆 הטורניר הסתיים רשמית!" }
  ];

  const STAGE_OPTIONS = [
    { id: "1", label: "מחזור 1 (ותחילת מונדיאל)" },
    { id: "2", label: "מחזור 2" },
    { id: "3", label: "מחזור 3" },
    { id: "ko32", label: "32 הגדולות" },
    { id: "ko16", label: "שמינית גמר" },
    { id: "ko8", label: "רבע גמר" },
    { id: "ko4", label: "חצי גמר" },
    { id: "ko2", label: "הגמר הגדול" }
  ];

  return (
    <div className="space-y-8 animate-fade-in-up">
      
      {/* אזור שעון עצר מרכזי */}
      <div className="bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-2 h-full bg-amber-500"></div>
        <h3 className="text-xl font-black text-white mb-2 flex items-center gap-2"><span>⏱️</span> שעון עצר גלובלי (Global Countdown)</h3>
        <p className="text-slate-400 text-sm mb-6">
          הגדר את השעון היחיד שיופיע בראש האפליקציה ויספור לאחור עבור המשתמשים. 
          כאשר הזמן תם, השעון יציג "הזמן תם" עד שתשנה את הסטטוס להלן.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <label className="block text-slate-400 text-xs font-bold mb-3">לאיזה שלב השעון סופר?</label>
            <select 
               value={activeDeadline?.stage || "1"}
               onChange={(e) => setActiveDeadline({ ...activeDeadline, stage: e.target.value })}
               className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-sm outline-none focus:border-amber-500"
            >
               {STAGE_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
            </select>
          </div>
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <label className="block text-slate-400 text-xs font-bold mb-3">תאריך ושעת סיום (נעילה)</label>
            <input 
              type="datetime-local" 
              value={activeDeadline?.time || ""} 
              onChange={(e) => setActiveDeadline({ ...activeDeadline, time: e.target.value })} 
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-sm outline-none focus:border-amber-500" 
              dir="ltr"
            />
          </div>
        </div>
        
        <button onClick={handleSaveDeadline} className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-black text-lg rounded-xl transition-all shadow-md active:scale-95 flex justify-center items-center gap-2">
           {savingId === "deadlines" ? "שומר..." : "💾 הפעל שעון עצר באתר"}
        </button>
      </div>

      {/* אזור ניהול סטטוס הטורניר */}
      <div className="bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-2 h-full bg-blue-500"></div>
        <h3 className="text-xl font-black text-white mb-2 flex items-center gap-2"><span>🚦</span> שליטה בסטטוס הטורניר (Time & Space)</h3>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed max-w-3xl">
          קובע אילו משחקים נעולים להימור ואילו נחשפים כעת בלוח. לחץ על השלב בו אנו נמצאים כעת.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {TIMELINE_STATES.map((st) => (
            <button
              key={st.val}
              onClick={() => setTournamentState(st.val)}
              className={`p-4 rounded-2xl text-right transition-all border group relative ${
                tournamentState === st.val 
                  ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                  : 'bg-slate-950 border-slate-800 hover:bg-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                 <span className={`font-black text-lg ${tournamentState === st.val ? 'text-blue-400' : 'text-slate-300 group-hover:text-white'}`}>
                   {st.label}
                 </span>
                 {tournamentState === st.val && <span className="flex h-3 w-3"><span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span></span>}
              </div>
              <p className={`text-xs ${tournamentState === st.val ? 'text-blue-300/80' : 'text-slate-500'}`}>{st.desc}</p>
            </button>
          ))}
        </div>
        
        {/* Toggle feedback survey manually */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 flex justify-between items-center mb-6">
          <div>
            <h4 className="text-white font-bold text-sm">פתיחה ידנית של סקר שביעות הרצון 💬</h4>
            <p className="text-slate-500 text-xs mt-1">פתיחת שאלון המשוב לכל המשתמשים באופן ידני (לצורכי בדיקה או להקדמת המועד).</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={feedbackOpen} 
              onChange={(e) => setFeedbackOpen(e.target.checked)}
              className="sr-only peer" 
            />
            <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:bg-blue-400 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-600 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600/20 border border-slate-700"></div>
          </label>
        </div>

        <button 
          onClick={handleSaveTournamentState} 
          disabled={isCalculating}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed border border-blue-400 text-white font-black text-lg rounded-xl transition-all shadow-lg active:scale-95 flex justify-center items-center gap-2"
        >
          {savingId === "state" ? <span className="animate-pulse">מעדכן מערכות...</span> : "שמור סטטוס טורניר 💾"}
        </button>
      </div>

      <div className="bg-rose-900/20 p-4 md:p-6 rounded-2xl border border-rose-500/50 relative z-10 mt-12 overflow-hidden group">
        <h3 className="text-xl font-black text-rose-500 mb-2 flex items-center gap-2 relative z-10"><span>⚠️</span> אזור סכנה (Danger Zone)</h3>
        <p className="text-rose-300 text-xs md:text-sm mb-4 relative z-10 font-bold">מחיקת כל המידע במסד הנתונים. פעולה זו אינה הפיכה.</p>
        <button onClick={handleFactoryReset} className="relative z-10 bg-rose-600 hover:bg-rose-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-md">איפוס מפעל מלא (מחיקת הכל) 🚨</button>
      </div>

    </div>
  );
}