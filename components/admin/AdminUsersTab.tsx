"use client";
import React from "react";
import { pdf , PDFDownloadLink } from '@react-pdf/renderer';
import { TicketPDF } from '../TicketPDF'; // עדכן את הנתיב בהתאם למיקום שבו שמרת את הקובץ
import { useState, useEffect } from 'react';
import { DailyMatrixPDF } from '../DailyMatrixPDF'; //
// 🔥 הוספת רכיבי ה-Firestore הנחוצים לכלי החדש
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../../app/firebase"; 
import toast from "react-hot-toast";

interface AdminUsersTabProps {
  usersList: any[];
  setUsersList: React.Dispatch<React.SetStateAction<any[]>>;
  handleUpdateUserDetails: (userId: string, details: { name?: string, phone?: string }) => void;
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
  handleRefreshData: () => void;
  handleExportUserBackup: (userId: string, userName: string) => void; 
  fetchUserPredictionsForPDF: (
    userId: string, 
    targetStage?: string | number
  ) => Promise<{ 
    matches: any[]; 
    qualifiers: any; 
    thirdPlace: any[]; 
    bonus: any; 
  }>;
}

export default function AdminUsersTab({
  usersList,
  setUsersList,
  handleUpdateUserDetails,
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
  handleRefreshData,
  handleExportUserBackup,
  fetchUserPredictionsForPDF
}: AdminUsersTabProps) {

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditingName] = useState("");
  const [editPhone, setEditingPhone] = useState("");

  // 🔥 1. הגדרת ה-States של כלי איתור ואיחוד ניחושים בעייתיים
  const [searchQualifier, setSearchQualifier] = useState("");
  const [replaceQualifier, setReplaceQualifier] = useState("");
  const [foundPredictions, setFoundPredictions] = useState<any[]>([]);
  const [isSearchingKnockout, setIsSearchingKnockout] = useState(false);
  const [isUpdatingKnockout, setIsUpdatingKnockout] = useState(false);

  // 🔥 2. פונקציית חיפוש הניחושים הבעייתיים בקולקציית הנוקאאוט
  // פונקציית חיפוש גמישה וחכמה (Client-side Filter) ללא תלות בהתאמה מדויקת
  const handleSearchBadQualifiers = async () => {
    if (!searchQualifier.trim()) {
      return toast.error("יש להזין ערך לחיפוש!");
    }
    
    setIsSearchingKnockout(true);
    setFoundPredictions([]);
    
    try {
      // שולפים את הרשומות לצורך סינון גמיש בזכרון (מונע בעיות של רווחים שגויים ב-DB)
      const snap = await getDocs(collection(db, "predictions_knockout"));
      
      const usersMap: Record<string, string> = {};
      usersList.forEach(u => { usersMap[u.id] = u.name || "שחקן לא ידוע"; });
      
      const results: any[] = [];
      const searchVal = searchQualifier.trim().toLowerCase();

      snap.forEach(docSnap => {
        const data = docSnap.data();
        const qualifierVal = String(data.qualifier || "").trim().toLowerCase();
        
        // בדיקה גמישה: האם הניחוש של המשתמש מכיל את מה שחיפשת (למשל מכיל "49" או "מנצחת")
        if (qualifierVal.includes(searchVal)) {
          results.push({
            docId: docSnap.id, 
            userId: data.userId,
            userName: usersMap[data.userId] || "משתמש לא ידוע",
            matchId: data.matchId,
            currentValue: data.qualifier
          });
        }
      });
      
      setFoundPredictions(results);
      
      if (results.length === 0) {
        toast.success("לא נמצאו ניחושים תואמים לערך החיפוש. ✨");
      } else {
        toast.success(`נמצאו ${results.length} ניחושים שמתאימים לחיפוש! 🔥`);
      }
    } catch (error) {
      console.error(error);
      toast.error("שגיאה בביצוע החיפוש ב-DB");
    } finally {
      setIsSearchingKnockout(false);
    }
  };

  // 🔥 3. פונקציית העדכון המרוכזת להחלפת הערכים הבעייתיים
  const handleBulkUpdateQualifiers = async () => {
    if (foundPredictions.length === 0) return;
    if (!replaceQualifier.trim()) {
      return toast.error("יש להזין ערך חדש להחלפה!");
    }
    
    setIsUpdatingKnockout(true);
    try {
      let successCount = 0;
      
      for (const pred of foundPredictions) {
        const docRef = doc(db, "predictions_knockout", pred.docId);
        await updateDoc(docRef, {
          qualifier: replaceQualifier.trim()
        });
        successCount++;
      }
      
      toast.success(`העדכון הסתיים! עודכנו בהצלחה ${successCount} ניחושים. 🎉`);
      setFoundPredictions([]); 
      setReplaceQualifier("");
      setSearchQualifier("");
    } catch (error) {
      console.error(error);
      toast.error("שגיאה במהלך העדכון המרוכז ב-DB");
    } finally {
      setIsUpdatingKnockout(false);
    }
  };

  const handleStartEdit = (user: any) => {
    setEditingUserId(user.id);
    setEditingName(user.name || "");
    setEditingPhone(user.phone || "");
  };

  const handleSaveEdit = (userId: string) => {
    handleUpdateUserDetails(userId, { name: editName, phone: editPhone });
    setEditingUserId(null);
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
  };

  const handleGenerateUserTicket = async (user: any) => {
     try {
       toast.loading("מכין את הטופס, שנייה אחת...");
       const data = await fetchUserPredictionsForPDF(user.id, "ALL");
       
       const docProps = {
          userName: user.name || "ללא שם",
          totalPoints: user.totalPoints || 0,
          rank: user.displayRank || "-",
          matches: data.matches,
          qualifiers: data.qualifiers,
          thirdPlace: data.thirdPlace,
          bonus: data.bonus
       };

       const blob = await pdf(<TicketPDF {...docProps} />).toBlob();
       const url = URL.createObjectURL(blob);
       const link = document.createElement('a');
       link.href = url;
       link.download = `BetsInProd_Ticket_${user.name || user.id}.pdf`;
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);
       URL.revokeObjectURL(url);
       toast.dismiss();
       toast.success("הטופס הורד בהצלחה! 📄");
     } catch (e) {
        console.error(e);
        toast.dismiss();
        toast.error("שגיאה בהפקת ה-PDF");
     }
  };

  return (
    <div className="space-y-6">
      
      {/* כרטיס תובנות ואקשן מהיר */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-right">
          <h3 className="text-lg font-black text-white">תובנות קהל ואוטומציה 🤖</h3>
          <p className="text-xs text-slate-400 mt-1">מערכת ה-Insights סורקת את ה-DB ומייצרת פנינים לקבוצת הוואטסאפ.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button 
            onClick={handleCreateAutoInsights}
            className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 text-white text-xs font-black py-2.5 px-4 rounded-xl transition-all shadow-md active:scale-95"
          >
             ✨ גנרט תובנות
          </button>
          <button 
            onClick={handleRefreshData}
            className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2.5 px-4 rounded-xl transition-all"
          >
             🔄 רפרש נתונים
          </button>
        </div>
      </div>

      {autoInsights.length > 0 && (
         <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 space-y-2 text-right">
            <div className="text-xs font-black text-blue-400 tracking-wider uppercase mb-2">תובנות חמות מהשטח 🔥</div>
            <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-2 pl-2">
               {autoInsights.map((text, idx) => (
                  <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center text-xs gap-3">
                     <p className="text-slate-200 font-medium leading-relaxed flex-1">{text}</p>
                     <button 
                        onClick={() => addInsightToMessage(text)}
                        className="bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all shrink-0"
                     >
                        ➕ הוסף להודעה
                     </button>
                  </div>
               ))}
            </div>
         </div>
      )}

      {/* סימולטור שלבים מהיר לאדמין */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
         <div className="text-right w-full md:w-auto">
            <div className="text-sm font-black text-slate-300">🎮 סימולטור שלבים (Sandbox)</div>
            <p className="text-[11px] text-slate-500 mt-0.5">מאפשר להריץ בוטים או סימולציות חכמות על משחקים קרובים.</p>
         </div>
         <div className="flex gap-2 w-full md:w-auto justify-end">
            <button onClick={handleSpawnBotsOnly} className="text-xs font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl transition-all">🤖 זרוק בוטים</button>
            <button onClick={handleSmartSimulation} className="text-xs font-black text-amber-400 bg-amber-950/30 border border-amber-500/20 hover:bg-amber-900/40 px-4 py-2 rounded-xl transition-all shadow-sm">🧠 סימולציה חכמה</button>
         </div>
      </div>

      {/* טבלת המשתמשים המרכזית */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
          <h3 className="text-base font-black text-white text-right">רשימת מנויים ומשתתפים ({usersList.length})</h3>
          <span className="text-[10px] bg-slate-950 text-slate-500 px-2.5 py-1 rounded-md border border-slate-800 font-bold uppercase tracking-wider">Database Live</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 text-xs font-bold">
                <th className="p-4 w-12 text-center">#</th>
                <th className="p-4">שם משתתף</th>
                <th className="p-4">טלפון</th>
                <th className="p-4 text-center w-36">התקדמות מילוי</th> {/* 🔥 עמודה חדשה שהחזרנו */}
                <th className="p-4 text-center w-24">סטטוס תשלום</th>
                <th className="p-4 text-center w-24">ניקוד כללי</th>
                <th className="p-4 text-center w-40">פעולות ניהול</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {usersList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-12 text-slate-500 font-bold animate-pulse">אין משתמשים רשומים במערכת... 🤷‍♂️</td>
                </tr>
              ) : (
                usersList.map((u, index) => {
                  const isEditing = editingUserId === u.id;

                  // 🔥 לוגיקת חישוב התקדמות דינמית בהתאם לדאטה הקיים על אובייקט המשתמש
                  // אם יש לך שדות של כמות ניחושים על ה-User (למשל u.predictionsCount), נשתמש בהם. 
                  // אחרת, נעשה פולבק חכם לפי האם הוא מילא את הטופס הכללי
                  const totalRequiredItems = 64; // כמות המשחקים/בונוסים המשוערת בטורניר
                  const filledItems = u.predictionsCount !== undefined ? u.predictionsCount : (u.totalPoints > 0 ? 64 : 0);
                  const progressPercentage = Math.min(
                    u.progressPercentage !== undefined ? u.progressPercentage : (filledItems / totalRequiredItems) * 100, 
                    100
                  );

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 text-center text-slate-600 font-mono font-bold">{index + 1}</td>
                      <td className="p-4 font-bold text-slate-200">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-xs outline-none w-full"
                          />
                        ) : (
                          <div className="flex flex-col">
                             <span>{u.name || "ללא שם"}</span>
                             <span className="text-[10px] text-slate-500 font-mono mt-0.5 font-normal">{u.id}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-slate-300 font-medium">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editPhone}
                            onChange={(e) => setEditingPhone(e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-xs outline-none w-full"
                          />
                        ) : (
                          u.phone || "-"
                        )}
                      </td>

                      {/* 🔥 החזרת מנוע החוסרים המשוכלל והטולטיפ למגרש! */}
                      <td className="p-4 text-center vertical-middle">
                        <div className="flex flex-col items-center justify-center w-full max-w-[140px] mx-auto gap-1">
                          
                          {/* 1. בר ההתקדמות הוויזואלי (מבוסס על ה-completionRate המקורי של חדר הבקרה) */}
                          <div className="w-full bg-slate-950 border border-slate-800 rounded-full h-2.5 overflow-hidden shadow-inner relative group/bar">
                            <div 
                              className={`h-full transition-all duration-500 rounded-full ${
                                u.completionRate === 100 
                                  ? "bg-gradient-to-r from-emerald-500 to-teal-400" 
                                  : u.completionRate > 50 
                                  ? "bg-blue-500" 
                                  : "bg-amber-500"
                              }`}
                              style={{ width: `${u.completionRate || 0}%` }}
                            ></div>
                          </div>
                          
                          {/* 2. אחוז ההשלמה הכללי */}
                          <span className="text-[11px] text-slate-300 font-mono font-black">
                            {u.completionRate || 0}%
                          </span>

                          {/* 3. מנוע הפירוט הדינמי - מציג בדיוק מה חסר לשחקן מתחת לבר */}
                          {(() => {
                            const missing = u.missingBreakdown;
                            if (!missing) return null;

                            const labels: string[] = [];
                            if (missing.md1 > 0) labels.push(`מחזור 1 (${missing.md1})`);
                            if (missing.md2 > 0) labels.push(`מחזור 2 (${missing.md2})`);
                            if (missing.md3 > 0) labels.push(`מחזור 3 (${missing.md3})`);
                            if (missing.ko > 0) labels.push(`נוקאאוט (${missing.ko})`);
                            if (missing.bonus > 0) labels.push(`בונוסים (${missing.bonus})`);
                            if (missing.quals > 0) labels.push(`עולות מבתים (${missing.quals})`);
                            if (missing.third > 0) labels.push(`8 מקום שלישי`);

                            if (labels.length === 0 || u.completionRate === 100) {
                              return (
                                <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900/30">
                                  🎉 הכל מלא!
                                </span>
                              );
                            }

                            return (
                              <div className="flex flex-col gap-0.5 w-full text-center">
                                <span className="text-[9px] text-rose-400 font-bold bg-rose-950/40 px-1 py-0.5 rounded border border-rose-900/20 max-w-full truncate inline-block" title={labels.join(", ")}>
                                  ⚠️ חסר: {labels[0]} {labels.length > 1 && `+${labels.length - 1}`}
                                </span>
                                {labels.length > 1 && (
                                  <span className="text-[8px] text-slate-500 font-medium">
                                    ({labels.slice(1).join(", ")})
                                  </span>
                                )}
                              </div>
                            );
                          })()}

                        </div>
                      </td>

                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleTogglePayment(u.id, u.hasPaid || false)}
                          className={`px-3 py-1.5 rounded-full text-xs font-black transition-all ${
                            u.hasPaid
                              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 animate-pulse"
                          }`}
                        >
                          {u.hasPaid ? "💰 שולם" : "⚠️ ממתין"}
                        </button>
                      </td>
                      <td className="p-4 text-center text-amber-400 font-black font-mono text-base">
                        {u.totalPoints || 0}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(u.id)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-2.5 py-1.5 rounded transition-all"
                              >
                                שמור
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold px-2.5 py-1.5 rounded transition-all"
                              >
                                ביטול
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleStartEdit(u)}
                                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 w-9 h-9 rounded-lg transition-all flex items-center justify-center text-xs"
                                title="ערוך פרטי שחקן"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleExportPredictions(u.id, u.name || "משתמש")}
                                className="bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/30 w-9 h-9 rounded-lg transition-all flex items-center justify-center text-xs"
                                title="ייצא ניחושים מלאים"
                              >
                                📤
                              </button>
                              <button
                                onClick={() => handleExportUserBackup(u.id, u.name || "משתמש")}
                                className="bg-purple-500/10 hover:bg-purple-500 text-purple-400 hover:text-white border border-purple-500/30 w-9 h-9 rounded-lg transition-all flex items-center justify-center text-xs"
                                title="ייצא גיבוי JSON גולמי"
                              >
                                💾
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name || "ללא שם")}
                            className="bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 w-9 h-9 rounded-lg transition-all flex items-center justify-center"
                            title="מחק משתמש"
                          >
                            🗑️
                          </button>
                          <button
                            onClick={() => handleGenerateUserTicket(u)}
                            className="bg-orange-500/10 hover:bg-orange-500 text-orange-400 hover:text-white border border-orange-500/30 w-9 h-9 rounded-lg transition-all flex items-center justify-center group relative"
                            title="הפק טופס רשמי (PDF)"
                          >
                            <span className="text-lg">📄</span>
                            <div className="absolute bottom-full mb-2 right-0 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 z-10 pointer-events-none">
                              הורד טופס PDF
                            </div>
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

      {/* ========================================================================= */}
      {/* 🔥 4. ממשק המשתמש (UI) של כלי איתור ואיחוד ניחושים בעייתיים בנוקאאוט */}
      {/* ========================================================================= */}
      <div className="mt-12 bg-slate-900 rounded-3xl p-6 border border-slate-700 shadow-2xl text-right animate-fade-in-up" dir="rtl">
        <div className="border-b border-slate-800 pb-4 mb-6 flex items-center gap-3">
          <span className="text-2xl">🕵️‍♂️</span>
          <div>
            <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">כלי איתור ואיחוד ניחושים בעייתיים (נוקאאוט)</h3>
            <p className="text-slate-400 text-xs mt-0.5">סריקה ועדכון ישיר של שדה העולה (qualifier) עבור משתתפים שהזינו ערכים זמניים/שגויים.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-400 pr-1">1. ערך שגוי לחיפוש (לדוגמה: "מנצחת משחק 49"):</label>
            <input 
              type="text"
              placeholder="הזן את הערך המדויק שנשמר..."
              value={searchQualifier}
              onChange={(e) => setSearchQualifier(e.target.value)}
              className="w-full bg-slate-950 text-white placeholder-slate-600 rounded-xl py-3 px-4 border border-slate-800 focus:border-amber-500 outline-none text-sm font-medium shadow-inner transition-all"
            />
          </div>

          <button 
            onClick={handleSearchBadQualifiers}
            disabled={isSearchingKnockout || !searchQualifier}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black py-3 px-6 rounded-xl text-sm transition-all shadow-md active:scale-95 h-[46px]"
          >
            {isSearchingKnockout ? "סורק DB... ⏳" : "🔎 מצא ניחושים בעייתיים"}
          </button>
        </div>

        {/* הצגת רשימת התוצאות שנמצאו ב-DB במידה ויש כאלו */}
        {foundPredictions.length > 0 && (
          <div className="mt-6 bg-slate-950/50 rounded-2xl border border-slate-800/80 p-4 animate-fade-in">
            <h4 className="text-sm font-black text-slate-300 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              נמצאו {foundPredictions.length} רשומות שדורשות תיקון:
            </h4>
            
            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2 mb-6 pl-2">
              {foundPredictions.map((pred, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-mono">[{i+1}]</span>
                    <span className="font-bold text-slate-200">{pred.userName}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800">מזהה משחק: {pred.matchId}</span>
                    <span className="text-rose-400 font-bold bg-rose-950/20 px-2 py-1 rounded border border-rose-900/30">ערך נוכחי: "{pred.currentValue}"</span>
                  </div>
                </div>
              ))}
            </div>

            {/* חלק ב' - הזנת התוצאה הלוגית החדשה וביצוע עדכון מרוכז */}
            <div className="border-t border-slate-800 pt-5 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-emerald-400 pr-1">2. לאיזה ערך תקין תרצה לשנות את התוצאה עבורם?</label>
                <input 
                  type="text"
                  placeholder="הזן את שם הנבחרת האמיתית (לדוגמה: ארגנטינה)..."
                  value={replaceQualifier}
                  onChange={(e) => setReplaceQualifier(e.target.value)}
                  className="w-full bg-slate-950 text-white placeholder-slate-600 rounded-xl py-3 px-4 border border-emerald-900/30 focus:border-emerald-500 outline-none text-sm font-medium shadow-inner transition-all"
                />
              </div>

              <button 
                onClick={handleBulkUpdateQualifiers}
                disabled={isUpdatingKnockout || !replaceQualifier}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black py-3 px-8 rounded-xl text-sm transition-all shadow-lg shadow-emerald-900/20 active:scale-95 h-[46px]"
              >
                {isUpdatingKnockout ? "מעדכן רשומות ב-DB... ⏳" : "💾 בצע החלפה מרוכזת ושמור"}
              </button>
            </div>
          </div>
        )}
      </div>
      {/* ========================================================================= */}

    </div>
  );
}