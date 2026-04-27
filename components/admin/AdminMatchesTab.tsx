"use client";
import React, { useState, useEffect } from "react";
import { getFlagUrl } from "../../app/utils/flags";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../app/firebase";
import toast from "react-hot-toast";

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
  const [recentlySavedIds, setRecentlySavedIds] = useState<string[]>([]);
  
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);

  const adminGroupList = ["ALL", ...groupsList, "KNOCKOUT"];
  const currentAdminGroupIndex = adminGroupList.indexOf(adminMatchGroup);
  
  const handlePrevAdminGroup = () => setAdminMatchGroup(adminGroupList[currentAdminGroupIndex === 0 ? adminGroupList.length - 1 : currentAdminGroupIndex - 1]);
  const handleNextAdminGroup = () => setAdminMatchGroup(adminGroupList[currentAdminGroupIndex === adminGroupList.length - 1 ? 0 : currentAdminGroupIndex + 1]);

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
       return (new Date().getTime() - matchTime) > (1000 * 60 * 120); 
     } catch { return false; }
  };

  const filteredMatches = matches.filter((m: any) => {
    if (adminSearchTerm && !m.homeTeam.includes(adminSearchTerm) && !m.awayTeam.includes(adminSearchTerm)) return false;
    if (adminMatchGroup === "KNOCKOUT" && m.stage !== "KNOCKOUT") return false;
    if (adminMatchGroup !== "ALL" && adminMatchGroup !== "KNOCKOUT" && m.group !== adminMatchGroup) return false;
    if (quickFilter === "TODAY" && !isMatchToday(m.matchDate)) return false;
    if (quickFilter === "MISSING" && !isMatchMissingResult(m)) return false;
    return true;
  });

  // התיקון: קוראים לפונקציה המקורית מ-page.tsx, ושומרים רק על אפקט ה-UI הלוקאלי!
  const onSaveWithFeedback = async (matchId: string, home: number, away: number, qual: string) => {
     try {
       // קוראים ללוגיקה המרכזית שהעברת כ-prop מבחוץ
       await handleSaveMatch(matchId, home, away, qual);
       
       // מפעילים רק את אפקט ה-"נשמר!" הירוק והיפה שלנו ל-2 שניות
       setRecentlySavedIds(prev => [...prev, matchId]);
       setTimeout(() => {
          setRecentlySavedIds(prev => prev.filter(id => id !== matchId));
       }, 2000); 
       
       // שים לב: הסרנו את window.location.reload()! המסך יתעדכן לבד בזכות page.tsx
     } catch (error) {
       console.error("Error in UI feedback:", error);
     }
  };

  return (
    <div className="space-y-6 animate-fade-in-up w-full relative">
      
      <div className="bg-slate-800 p-4 sm:p-6 rounded-3xl border border-slate-700 shadow-xl w-full">
        <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2"><span>🔍</span> איתור וסינון משחקים</h2>
        
        <div className="flex flex-col md:flex-row gap-4">
           <input 
              type="text" 
              placeholder="חפש נבחרת..." 
              value={adminSearchTerm} 
              onChange={(e) => setAdminSearchTerm(e.target.value)} 
              className="w-full md:w-1/3 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-colors"
           />
           
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

      <div className="bg-rose-900/10 p-6 rounded-3xl border border-rose-500/30 w-full mt-8 shadow-xl">
        <h3 className="text-xl font-black text-rose-400 mb-4 flex items-center gap-2"><span>⚠️</span> ניהול מסד משחקים נמוך (Low Level)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl w-full">
            <label className="block text-slate-400 text-xs font-bold mb-2">ייבוא משחקים מקובץ JSON</label>
            <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileUpload} className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 transition-colors file:cursor-pointer" />
          </div>
          
          <button 
             onClick={() => setShowGeneratorModal(true)} 
             className="h-[74px] bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 px-6 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-md active:scale-95"
          >
             <span className="text-xl">⚡</span> יצירת משחקים מהירה
          </button>
          
          <button 
             onClick={handleDeleteAllMatches} 
             disabled={isCalculating || matches.length === 0} 
             className="h-[74px] bg-slate-900 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/30 px-6 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50 active:scale-95"
          >
            <span className="text-xl">🗑️</span> מחק הכל
          </button>
          
        </div>
      </div>

      {showGeneratorModal && (
        <AdminGeneratorModal onClose={() => setShowGeneratorModal(false)} />
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// קומפוננטת שורת המשחק (עם עריכה מהירה לקבוצות, איצטדיון ולינק לשידור)
// -------------------------------------------------------------------------
function AdminMatchRow({ match, isSaving, justSaved, onSave, onClear, onUpdateDate, onUpdateMatchday }: { match: any, isSaving: boolean, justSaved: boolean, onSave: any, onClear: any, onUpdateDate: any, onUpdateMatchday: any }) {
  const [homeInput, setHomeInput] = useState(match.realHomeScore ?? "");
  const [awayInput, setAwayInput] = useState(match.realAwayScore ?? "");
  const [qualifierInput, setQualifierInput] = useState(match.realQualifier ?? "");
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [timeInput, setTimeInput] = useState(match.matchDate || "");
  const [isEditingMatchday, setIsEditingMatchday] = useState(false);
  const [matchdayInput, setMatchdayInput] = useState(match.matchday || "");

  // הרחבת הסטייט לעריכה המהירה
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [editData, setEditData] = useState({
     homeTeam: match.homeTeam || "",
     awayTeam: match.awayTeam || "",
     stadium: match.stadium || "",
     city: match.city || "",
     broadcastUrl: match.broadcastUrl || ""
  });

  const isKnockout = match.stage === "KNOCKOUT";

  const handleSaveTime = () => { onUpdateDate(match.id, timeInput); setIsEditingTime(false); };
  const handleSaveMatchday = () => { onUpdateMatchday(match.id, matchdayInput); setIsEditingMatchday(false); };

  const onSaveDetails = async () => {
    setIsSavingDetails(true);
    try {
      await updateDoc(doc(db, "matches", match.id), editData);
      toast.success("פרטי המשחק עודכנו. רענן את העמוד כדי לראות.");
      setIsEditingDetails(false);
    } catch (e) {
      toast.error("שגיאה בעדכון פרטי המשחק.");
    } finally {
      setIsSavingDetails(false);
    }
  };

  return (
    <div className={`bg-slate-900 p-4 sm:p-5 rounded-3xl border transition-all duration-300 shadow-lg relative overflow-hidden flex flex-col h-full ${justSaved ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] bg-emerald-900/10' : match.isFinished ? 'border-slate-700 opacity-90' : 'border-slate-600 hover:border-blue-500/50'}`}>
      
      {justSaved && <div className="absolute top-2 left-2 text-emerald-400 font-black text-xs animate-bounce">✓ עודכן!</div>}
      
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-[10px] sm:text-xs font-black bg-blue-900/30 text-blue-400 px-2 sm:px-2.5 py-1 rounded-lg border border-blue-500/20 whitespace-nowrap">ID: {match.id.substring(0, 4)}...</span>
          <button onClick={() => setIsEditingDetails(!isEditingDetails)} className="text-slate-500 hover:text-white transition-colors" title="ערוך פרטי משחק ושידור">✏️</button>
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

      {/* אזור עריכת פרטי המשחק המורחב */}
      {isEditingDetails && (
        <div className="flex flex-col gap-3 bg-slate-950/80 p-4 rounded-xl border border-slate-700 mb-4 shadow-inner">
          <div className="flex items-center gap-2">
             <input type="text" value={editData.homeTeam} onChange={e=>setEditData({...editData, homeTeam: e.target.value})} className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-white text-center text-xs outline-none focus:border-blue-500" placeholder="קבוצת בית" />
             <span className="text-xs font-bold text-slate-500">VS</span>
             <input type="text" value={editData.awayTeam} onChange={e=>setEditData({...editData, awayTeam: e.target.value})} className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-white text-center text-xs outline-none focus:border-blue-500" placeholder="קבוצת חוץ" />
          </div>
          <div className="flex items-center gap-2">
             <input type="text" value={editData.stadium} onChange={e=>setEditData({...editData, stadium: e.target.value})} className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-white text-center text-xs outline-none focus:border-blue-500" placeholder="אצטדיון (למשל: מראקנה)" />
             <input type="text" value={editData.city} onChange={e=>setEditData({...editData, city: e.target.value})} className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-white text-center text-xs outline-none focus:border-blue-500" placeholder="עיר (למשל: מדריד)" />
          </div>
          <input type="url" value={editData.broadcastUrl} onChange={e=>setEditData({...editData, broadcastUrl: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center text-xs outline-none focus:border-blue-500" placeholder="לינק לשידור (https://kan...)" dir="ltr" />
          
          <button onClick={onSaveDetails} disabled={isSavingDetails} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded-lg shadow-sm transition-all disabled:opacity-50 mt-1">
             {isSavingDetails ? "שומר..." : "שמור נתונים מלאים 💾"}
          </button>
        </div>
      )}

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

// -------------------------------------------------------------------------
// המודאל של המחולל (נשאר ללא שינוי, כיוון שהוא משרת את מטרתו)
// -------------------------------------------------------------------------
function AdminGeneratorModal({ onClose }: { onClose: () => void }) {
  const [roundName, setRoundName] = useState("32 הגדולות");
  const [defaultDate, setDefaultDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // הוספנו את השדות החדשים לסטייט הראשוני
  const [matches, setMatches] = useState([
    { _tempId: Date.now(), homeTeam: "", awayTeam: "", matchDate: "", time: "21:00", stadium: "", city: "", broadcastUrl: "" }
  ]);

  const STAGES = ["32 הגדולות", "שמינית גמר", "רבע גמר", "חצי גמר", "גמר", "מקום שלישי"];

  const handleAddMatch = () => {
    setMatches([...matches, { _tempId: Date.now() + matches.length, homeTeam: "", awayTeam: "", matchDate: defaultDate, time: "21:00", stadium: "", city: "", broadcastUrl: "" }]);
  };

  const handleRemoveMatch = (id: number) => {
    if (matches.length > 1) setMatches(matches.filter(m => m._tempId !== id));
  };

  const updateMatch = (id: number, field: string, val: string) => {
    setMatches(matches.map(m => m._tempId === id ? { ...m, [field]: val } : m));
  };

  const handleSubmitToDb = () => {
    const invalidMatch = matches.find(m => !m.homeTeam.trim() || !m.awayTeam.trim());
    if (invalidMatch) {
       toast.error("חובה להזין שמות קבוצות לכל המשחקים!");
       return;
    }

    if (!confirm(`האם להזריק ${matches.length} משחקים ישירות למסד הנתונים?`)) return;
    
    setIsSubmitting(true);
    try {
      for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        const cleanRound = roundName.includes("32") ? "32" : roundName.includes("16") || roundName.includes("שמינית") ? "16" : roundName.includes("רבע") ? "8" : roundName.includes("חצי") ? "4" : "final";
        let formattedDate = "";
        
        if (m.matchDate) {
          const [y, mm, d] = m.matchDate.split("-");
          formattedDate = `${d}/${mm}/${y} ${m.time}`;
        }
        
        // מעבירים את השדות החדשים ל-Firebase
        const matchData = {
          id: `ko_${cleanRound}_${Date.now().toString().slice(-4)}_${i + 1}`,
          homeTeam: m.homeTeam.trim(),
          awayTeam: m.awayTeam.trim(),
          matchDate: formattedDate,
          stage: "KNOCKOUT",
          roundName: roundName,
          isFinished: false,
          stadium: m.stadium.trim(),
          city: m.city.trim(),
          broadcastUrl: m.broadcastUrl.trim()
        };

        await setDoc(doc(db, "matches", matchData.id), matchData, { merge: true });
      }
      
      toast.success("המשחקים נוצרו בהצלחה! מרענן נתונים...");
      setTimeout(() => window.location.reload(), 1500);
      
    } catch (e) {
      console.error(e);
      toast.error("שגיאה בהזרקת הנתונים.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in-up" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
        <div className="absolute top-0 right-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-blue-500"></div>
        <div className="flex justify-between items-center p-6 border-b border-slate-800 shrink-0">
          <div>
            <h3 className="text-xl md:text-2xl font-black text-white flex items-center gap-2"><span>⚡</span> הזרקת משחקים מהירה</h3>
            <p className="text-slate-400 text-xs mt-1">בנה את משחקי הנוק-אאוט ושלח ישירות למערכת.</p>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="w-10 h-10 flex items-center justify-center bg-slate-800 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 rounded-full transition-colors border border-slate-700 font-bold">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
               <label className="block text-slate-400 text-xs font-bold mb-2">לאיזה שלב המשחקים שייכים?</label>
               <select value={roundName} onChange={e => setRoundName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-indigo-500">
                 {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
               </select>
             </div>
             <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
               <label className="block text-slate-400 text-xs font-bold mb-2">תאריך ברירת מחדל לכל המשחקים</label>
               <input type="date" value={defaultDate} onChange={e => setDefaultDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-indigo-500 cursor-pointer" dir="ltr" />
             </div>
           </div>

           <div className="space-y-4">
             {matches.map((m, idx) => (
               <div key={m._tempId} className="flex flex-col gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 group hover:border-slate-600 transition-all shadow-inner">
                 <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
                   <div className="w-6 text-slate-600 font-black text-center text-sm">{idx + 1}.</div>
                   <input type="text" placeholder="קבוצת בית" value={m.homeTeam} onChange={e => updateMatch(m._tempId, "homeTeam", e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-sm text-center outline-none focus:border-indigo-500" />
                   <span className="text-slate-600 font-black text-xs">VS</span>
                   <input type="text" placeholder="קבוצת חוץ" value={m.awayTeam} onChange={e => updateMatch(m._tempId, "awayTeam", e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-sm text-center outline-none focus:border-indigo-500" />
                   <input type="date" value={m.matchDate} onChange={e => updateMatch(m._tempId, "matchDate", e.target.value)} className="w-full md:w-32 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-sm outline-none focus:border-indigo-500" dir="ltr" />
                   <input type="time" value={m.time} onChange={e => updateMatch(m._tempId, "time", e.target.value)} className="w-full md:w-24 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-sm outline-none focus:border-indigo-500" dir="ltr" />
                   <button onClick={() => handleRemoveMatch(m._tempId)} className="w-full md:w-10 h-10 flex items-center justify-center bg-rose-900/20 text-rose-500 hover:bg-rose-600 hover:text-white rounded-xl transition-all border border-rose-500/20 shrink-0">✕</button>
                 </div>
                 {/* שורת אקסטרה לשדות החדשים */}
                 <div className="flex flex-wrap md:flex-nowrap items-center gap-3 pl-0 md:pl-12 pr-0 md:pr-9">
                   <input type="text" placeholder="עיר (למשל: מדריד)" value={m.city} onChange={e => updateMatch(m._tempId, "city", e.target.value)} className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white text-xs outline-none focus:border-indigo-500" />
                   <input type="text" placeholder="אצטדיון (למשל: סנטיאגו ברנבאו)" value={m.stadium} onChange={e => updateMatch(m._tempId, "stadium", e.target.value)} className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white text-xs outline-none focus:border-indigo-500" />
                   <input type="url" placeholder="לינק לשידור" value={m.broadcastUrl} onChange={e => updateMatch(m._tempId, "broadcastUrl", e.target.value)} className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white text-xs outline-none focus:border-indigo-500" dir="ltr" />
                 </div>
               </div>
             ))}
           </div>
           
           <button onClick={handleAddMatch} className="w-full py-4 border-2 border-dashed border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2">
              <span>➕</span> הוסף שורת משחק נוספת
           </button>
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900 shrink-0">
           <button 
              onClick={handleSubmitToDb} disabled={isSubmitting}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
           >
              {isSubmitting ? <span className="animate-pulse">מזריק למסד נתונים... ⏳</span> : <span>🚀 שלח {matches.length} משחקים למערכת</span>}
           </button>
        </div>
      </div>
    </div>
  );
}