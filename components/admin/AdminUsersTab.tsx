"use client";
import React from "react";

interface AdminUsersTabProps {
  usersList: any[];
  setUsersList: React.Dispatch<React.SetStateAction<any[]>>;
  handleUpdateUserName: (userId: string, newName: string) => void;
  handleTogglePayment: (userId: string, currentStatus: boolean) => void;
  handleExportPredictions: (userId: string, userName: string) => void;
  handleDeleteUser: (userId: string, userName: string) => void;
  isCalculating: boolean;
  autoInsights: string[];
  handleCreateAutoInsights: () => void;
  addInsightToMessage: (text: string) => void;
  simStage: string;
  setSimStage: (stage: string) => void;
  handleSpawnBotsOnly: () => void;
  handleSmartSimulation: () => void;
  handleRefreshData: () => void; // הפונקציה החדשה לסנכרון הרענון!
}

export default function AdminUsersTab({
  usersList,
  setUsersList,
  handleUpdateUserName,
  handleTogglePayment,
  handleExportPredictions,
  handleDeleteUser,
  isCalculating,
  autoInsights,
  handleCreateAutoInsights,
  addInsightToMessage,
  simStage,
  setSimStage,
  handleSpawnBotsOnly,
  handleSmartSimulation,
  handleRefreshData
}: AdminUsersTabProps) {
    
// פונקציה משודרגת שבונה הודעה לפי החוסרים הספציפיים
  const sendWhatsAppReminder = (userObj: any) => {
    const firstName = (userObj.name || "").split(" ")[0];
    const mb = userObj.missingBreakdown || {};
    
    const missingList = [];
    if (mb.md1 > 0) missingList.push(`${mb.md1} משחקים במחזור 1`);
    if (mb.md2 > 0) missingList.push(`${mb.md2} משחקים במחזור 2`);
    if (mb.md3 > 0) missingList.push(`${mb.md3} משחקים במחזור 3`);
    if (mb.ko > 0) missingList.push(`${mb.ko} משחקי נוקאאוט`);
    if (mb.quals > 0) missingList.push(`עולות מ-${mb.quals} בתים`);
    if (mb.third > 0) missingList.push(`מעפילות מקום 3`);
    if (mb.bonus > 0) missingList.push(`${mb.bonus} שאלות בונוס`);

    const missingText = missingList.length > 0 ? `\nספציפית חסר לך כרגע:\n- ${missingList.join('\n- ')}\n` : "";

    const message = `אהלן ${firstName}, כאן הנהלת Bets in PROD ⚽\nראיתי שעוד לא סיימת למלא את הניחושים לשלב הנוכחי... הזמן רץ והדד-ליין מתקרב! \n${missingText}\nכנס עכשיו למגרש לפני שיינעל: ${window.location.origin}`;
    const encodedMsg = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMsg}`, "_blank");
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-fade-in-up">
      
      <div className="bg-gradient-to-br from-indigo-900/40 to-slate-800 p-8 rounded-3xl border border-indigo-500/30 shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-700 pb-4">
          <div>
            <h2 className="text-2xl font-black text-indigo-400 flex items-center gap-2">
              <span>🔮</span> מחולל Wall of Fame / Shame
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              המערכת מנתחת את ניחושי הקהל ומחלצת דרמות לטור היומי.
            </p>
          </div>
          <button
            onClick={handleCreateAutoInsights}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center gap-2"
          >
            {autoInsights.length > 0 ? "🔄 רענן תובנות" : "🔍 חלץ תובנות עכשיו"}
          </button>
        </div>

        {autoInsights.length > 0 ? (
          <div className="flex flex-col gap-3">
            {autoInsights.map((insight, idx) => (
              <div key={idx} className="bg-slate-900/80 border border-slate-700 p-4 rounded-2xl flex justify-between items-center gap-4 group hover:border-indigo-500/50 hover:bg-slate-800 transition-colors shadow-sm">
                <span className="text-slate-200 text-sm font-medium leading-relaxed">{insight}</span>
                <button
                  onClick={() => addInsightToMessage(insight)}
                  className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap opacity-0 group-hover:opacity-100 flex items-center gap-1"
                >
                  <span>➕</span> הוסף לטור
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-500 text-sm bg-slate-900/50 p-6 rounded-2xl border border-dashed border-slate-700 text-center">
            אין תובנות זמינות. הרץ סריקה כדי למצוא ניחושים מעניינים.
          </div>
        )}
      </div>

      <div className="bg-slate-800 p-8 rounded-3xl border border-blue-500/30 shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-700 pb-6">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <span>👥</span> ניהול שחקנים ומד התקדמות
            </h2>
            <p className="text-slate-400 text-sm mt-1">עקוב אחרי קצב הניחושים ונהל תשלומים.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            {/* הכפתור החדש לרענון הנתונים! */}
            <button
              onClick={handleRefreshData}
              disabled={isCalculating}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 flex-1 md:flex-none"
            >
              <span>🔄</span> סנכרן נתונים
            </button>
            <button
              onClick={() => handleExportPredictions("ALL", "All")}
              disabled={isCalculating}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 flex-1 md:flex-none"
            >
              <span>⬇️</span> יומן ניחושים
            </button>
          </div>
        </div>

        <div className="bg-purple-900/10 p-5 rounded-2xl border border-purple-500/30 mb-8 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 shadow-inner">
          <div>
            <h3 className="text-purple-400 font-black flex items-center gap-2 mb-1 text-lg"><span>🤖</span> מעבדת סימולציות</h3>
            <p className="text-slate-400 text-sm">הזרק משתמשים פיקטיביים לבדיקת עומסים ולוגיקה.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <select
              value={simStage}
              onChange={(e) => setSimStage(e.target.value)}
              className="bg-slate-950 text-white p-3 rounded-xl border border-purple-500/50 outline-none font-bold text-sm flex-1 xl:flex-none"
            >
              <option value="BOTS_ONLY">🤖 בוטים בלבד (ללא אמת)</option>
              <option value="MD1">סמלץ מחזור 1 (אמת)</option>
              <option value="MD2">סמלץ מחזור 2</option>
              <option value="MD3">סמלץ מחזור 3 + עולות</option>
              <option value="R32">סמלץ 32 הגדולות</option>
              <option value="R16">סמלץ שמינית גמר</option>
              <option value="QF">סמלץ רבע גמר</option>
              <option value="SF">סמלץ חצי גמר</option>
              <option value="FINAL">סמלץ גמר הטורניר</option>
              <option value="ALL">סמלץ טורניר שלם</option>
            </select>
            <button
              onClick={() => (simStage === "BOTS_ONLY" ? handleSpawnBotsOnly() : handleSmartSimulation())}
              disabled={isCalculating}
              className="py-3 px-8 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl transition-all shadow-lg text-sm active:scale-95"
            >
              {isCalculating ? "מריץ... ⏳" : "🧪 הפעל"}
            </button>
          </div>
        </div>

        <div className="w-full overflow-x-auto bg-slate-950 rounded-2xl border border-slate-700 shadow-inner custom-scrollbar">
          <table className="w-full text-right text-slate-300 min-w-[700px]">
            <thead className="text-xs uppercase tracking-widest bg-slate-900/80 text-slate-500 border-b border-slate-800">
              <tr>
                <th className="p-4 font-black">שם משתמש</th>
                <th className="p-4 text-center font-black">התקדמות</th>
                <th className="p-4 text-center font-black">תשלום</th>
                <th className="p-4 text-center font-black">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {usersList.length === 0 ? (
                <tr><td colSpan={4} className="p-12 text-center text-slate-500 font-bold">אין משתמשים רשומים.</td></tr>
              ) : (
                usersList.map((u, idx) => {
                  const progress = u.completionRate || 0;
                  return (
                    <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 min-w-[250px]">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600 text-xs w-4">{idx + 1}.</span>
                          <div className="flex flex-col flex-1">
                            <input
                              type="text"
                              value={u.name || ""}
                              onChange={(e) =>
                                setUsersList(
                                  usersList.map((user) =>
                                    user.id === u.id ? { ...user, name: e.target.value } : user
                                  )
                                )
                              }
                              className="bg-slate-900 border border-slate-700 text-white px-2 py-1 rounded-lg focus:border-blue-500 outline-none text-sm w-full"
                            />
                            <span className="text-[10px] text-slate-500 mt-1 mr-2">{u.email}</span>
                          </div>
                          <button
                            onClick={() => handleUpdateUserName(u.id, u.name)}
                            className="bg-slate-800 hover:bg-blue-600 text-white p-1.5 rounded-lg border border-slate-700 transition-all shrink-0"
                          >
                            💾
                          </button>
                        </div>
                      </td>

                      <td className="p-4 w-56">
  <div className="flex flex-col gap-1.5">
    <div className="flex justify-between items-center px-1">
      <span className={`text-[10px] font-black ${progress === 100 ? "text-emerald-400" : "text-amber-400"}`}>
        {progress}%
      </span>
      {progress < 100 && (
        <span className="text-[9px] bg-rose-500/10 text-rose-400 px-1 rounded border border-rose-500/20 animate-pulse">חסר</span>
      )}
    </div>
    <div className="w-full bg-slate-900 rounded-full h-2 border border-slate-700 overflow-hidden shadow-inner">
      <div
        className={`h-full transition-all duration-1000 ${
          progress === 100 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" :
          progress > 50 ? "bg-amber-500" : "bg-rose-500"
        }`}
        style={{ width: `${progress}%` }}
      ></div>
    </div>
    
    {/* התגיות החדשות שמפרטות מה בדיוק חסר! */}
    {progress < 100 && u.missingBreakdown && (
       <div className="flex flex-wrap gap-1 mt-1 justify-end">
         {u.missingBreakdown.md1 > 0 && <span className="text-[8px] bg-slate-800 text-slate-300 border border-slate-600 px-1 rounded">מחזור 1: {u.missingBreakdown.md1}</span>}
         {u.missingBreakdown.md2 > 0 && <span className="text-[8px] bg-slate-800 text-slate-300 border border-slate-600 px-1 rounded">מחזור 2: {u.missingBreakdown.md2}</span>}
         {u.missingBreakdown.md3 > 0 && <span className="text-[8px] bg-slate-800 text-slate-300 border border-slate-600 px-1 rounded">מחזור 3: {u.missingBreakdown.md3}</span>}
         {u.missingBreakdown.ko > 0 && <span className="text-[8px] bg-purple-900/50 text-purple-300 border border-purple-500/30 px-1 rounded">נוקאאוט: {u.missingBreakdown.ko}</span>}
         {u.missingBreakdown.quals > 0 && <span className="text-[8px] bg-teal-900/50 text-teal-300 border border-teal-500/30 px-1 rounded">עולות מבתים</span>}
         {u.missingBreakdown.third > 0 && <span className="text-[8px] bg-rose-900/50 text-rose-300 border border-rose-500/30 px-1 rounded">מקום 3</span>}
         {u.missingBreakdown.bonus > 0 && <span className="text-[8px] bg-amber-900/50 text-amber-300 border border-amber-500/30 px-1 rounded">בונוס: {u.missingBreakdown.bonus}</span>}
       </div>
    )}
  </div>
</td>

                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleTogglePayment(u.id, u.hasPaid)}
                          className={`px-4 py-1.5 rounded-lg font-bold text-xs w-24 transition-all border ${
                            u.hasPaid
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                          }`}
                        >
                          {u.hasPaid ? "✅ שולם" : "❌ חוב"}
                        </button>
                      </td>

                      <td className="p-4">
                        <div className="flex justify-center gap-2">
                          {progress < 100 && (
                            <button
                              onClick={() => sendWhatsAppReminder(u)}
                              className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 w-9 h-9 rounded-lg transition-all flex items-center justify-center group relative"
                            >
                              <span className="text-lg">💬</span>
                              <div className="absolute bottom-full mb-2 right-0 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 z-10 pointer-events-none">
                                שלח תזכורת חביבה
                              </div>
                            </button>
                          )}
                          <button
                            onClick={() => handleExportPredictions(u.id, u.name || "ללא שם")}
                            className="bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/30 w-9 h-9 rounded-lg transition-all flex items-center justify-center"
                            title="הורד ניחושים"
                          >
                            ⬇️
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name || "ללא שם")}
                            className="bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 w-9 h-9 rounded-lg transition-all flex items-center justify-center"
                            title="מחק משתמש"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}