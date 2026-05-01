"use client";
import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../../app/firebase";
import toast from "react-hot-toast";

const KO_ROUNDS = ["32 הגדולות", "שמינית גמר", "רבע גמר", "חצי גמר", "גמר"];

const ALL_TEAMS = [
  "מקסיקו", "דרום אפריקה", "קוריאה הדרומית", "צ'כיה", "קנדה", "בוסניה", "קטר", "שווייץ",
  "ברזיל", "מרוקו", "האיטי", "סקוטלנד", "ארה\"ב", "פרגוואי", "אוסטרליה", "טורקיה",
  "גרמניה", "קוראסאו", "חוף השנהב", "אקוודור", "הולנד", "יפן", "שוודיה", "תוניסיה",
  "בלגיה", "מצרים", "איראן", "ניו זילנד", "ספרד", "כף ורדה", "סעודיה", "אורוגוואי",
  "צרפת", "סנגל", "עיראק", "נורווגיה", "ארגנטינה", "אלג'יריה", "אוסטריה", "ירדן",
  "פורטוגל", "קונגו", "אוזבקיסטן", "קולומביה", "אנגליה", "קרואטיה", "גאנה", "פנמה"
];

export default function AdminBonusTab() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [resultsData, setResultsData] = useState<any>({ answers: {}, blacklist: {}, leading: {}, locked: {} });
  
  const [usersMap, setUsersMap] = useState<any>({});
  const [allBonusPredictions, setAllBonusPredictions] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<any>(null);
  const [formResults, setFormResults] = useState<any>({ answer: "", blacklist: "", leading: "", locked: false });

  const [filterPhase, setFilterPhase] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterKoRound, setFilterKoRound] = useState<string>("ALL");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const qSnap = await getDoc(doc(db, "settings", "bonus_questions"));
      const rSnap = await getDoc(doc(db, "admin_results", "bonus"));
      
      const loadedQuestions = qSnap.exists() ? qSnap.data().questions || [] : [];
      setQuestions(loadedQuestions);
      
      if (rSnap.exists()) {
        setResultsData(rSnap.data());
      }

      const uSnap = await getDocs(collection(db, "users"));
      const uMap: any = {};
      uSnap.forEach(d => { uMap[d.id] = d.data().name || "משתמש לא ידוע"; });
      setUsersMap(uMap);

      const pbSnap = await getDocs(collection(db, "predictions_bonus"));
      const pbArr: any[] = [];
      pbSnap.forEach(d => {
         pbArr.push({ userId: d.id, answers: d.data().answers || {} });
      });
      setAllBonusPredictions(pbArr);

      if (loadedQuestions.length > 0 && !selectedId) {
        handleSelectQuestion(loadedQuestions[0].id, loadedQuestions, rSnap.exists() ? rSnap.data() : null);
      }
    } catch (e) {
      console.error(e);
      toast.error("שגיאה בטעינת נתוני הבונוס");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectQuestion = (id: string, qList = questions, rData = resultsData) => {
    const q = qList.find(x => x.id === id);
    if (q) {
      setSelectedId(id);
      setFormData({ 
        ...q,
        answerType: q.answerType || "TEAM",
        hasNoneOption: q.hasNoneOption || false,
        hasAllOption: q.hasAllOption || false,
        specificTeams: q.specificTeams || "",
        possibleOptions: q.possibleOptions || "",
        knockoutRound: q.knockoutRound || "ALL"
      });
      
      const truth = rData.answers?.[id] || [];
      const black = rData.blacklist?.[id] || [];
      const lead = rData.leading?.[id] || [];
      
      setFormResults({
        answer: Array.isArray(truth) ? truth.join(", ") : (truth || ""),
        blacklist: Array.isArray(black) ? black.join(", ") : (black || ""),
        leading: Array.isArray(lead) ? lead.join(", ") : (lead || ""),
        locked: rData.locked?.[id] || false
      });
    }
  };

  const handleCreateNew = () => {
    setFilterPhase("ALL");
    setFilterType("ALL");
    setFilterKoRound("ALL");

    const newId = `bq_${Date.now()}`;
    const newQ = {
      id: newId,
      label: "שאלה חדשה...",
      points: 10,
      phase: "TOURNAMENT",
      knockoutRound: "ALL",
      answerType: "TEAM", 
      hasNoneOption: false,
      hasAllOption: false,
      specificTeams: "",
      possibleOptions: "", 
      isSurprise: false,
      isProximity: false,
      isDouble: false,
      openTime: "",
      closeTime: ""
    };
    
    setQuestions([...questions, newQ]);
    setSelectedId(newId);
    setFormData(newQ);
    setFormResults({ answer: "", blacklist: "", leading: "", locked: false });
  };

  const handleDelete = async () => {
    if (!selectedId || !confirm("בטוח שברצונך למחוק שאלה זו? הפעולה בלתי הפיכה!")) return;
    
    setIsSaving(true);
    try {
      const updatedQ = questions.filter(q => q.id !== selectedId);
      await setDoc(doc(db, "settings", "bonus_questions"), { questions: updatedQ }, { merge: true });
      
      const newResults = { ...resultsData };
      if (newResults.answers) delete newResults.answers[selectedId];
      if (newResults.blacklist) delete newResults.blacklist[selectedId];
      if (newResults.leading) delete newResults.leading[selectedId];
      if (newResults.locked) delete newResults.locked[selectedId];
      
      await setDoc(doc(db, "admin_results", "bonus"), newResults);
      
      toast.success("השאלה נמחקה בהצלחה");
      setQuestions(updatedQ);
      setResultsData(newResults);
      
      if (updatedQ.length > 0) handleSelectQuestion(updatedQ[0].id, updatedQ, newResults);
      else { setSelectedId(null); setFormData(null); }
      
    } catch (e) {
      toast.error("שגיאה במחיקת השאלה");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!formData || !selectedId) return;
    setIsSaving(true);
    try {
      const updatedQ = questions.map(q => q.id === selectedId ? formData : q);
      await setDoc(doc(db, "settings", "bonus_questions"), { questions: updatedQ }, { merge: true });
      
      const parseToArray = (str: string) => str.split(",").map(s => s.trim()).filter(s => s);
      
      const newResults = { ...resultsData };
      if (!newResults.answers) newResults.answers = {};
      if (!newResults.blacklist) newResults.blacklist = {};
      if (!newResults.leading) newResults.leading = {};
      if (!newResults.locked) newResults.locked = {};
      
      newResults.answers[selectedId] = parseToArray(formResults.answer);
      newResults.blacklist[selectedId] = parseToArray(formResults.blacklist);
      newResults.leading[selectedId] = parseToArray(formResults.leading);
      newResults.locked[selectedId] = formResults.locked;
      
      await setDoc(doc(db, "admin_results", "bonus"), newResults);
      
      setQuestions(updatedQ);
      setResultsData(newResults);
      toast.success("השאלה והתוצאות נשמרו בהצלחה! 💾");
    } catch (e) {
      toast.error("שגיאה בשמירה");
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSpecificTeam = (team: string) => {
    let currentTeams = formData.specificTeams ? formData.specificTeams.split(",").map((t:string) => t.trim()).filter(Boolean) : [];
    if (currentTeams.includes(team)) {
      currentTeams = currentTeams.filter((t:string) => t !== team);
    } else {
      currentTeams.push(team);
    }
    setFormData({ ...formData, specificTeams: currentTeams.join(", ") });
  };

  // פעולת הטוגל המהירה מהלוח מודיעין
  const toggleQuickAction = (field: 'answer' | 'leading' | 'blacklist', guess: string) => {
    let currentArr = formResults[field] ? formResults[field].split(",").map((s:string) => s.trim()).filter(Boolean) : [];
    if (currentArr.includes(guess)) {
      currentArr = currentArr.filter((s:string) => s !== guess);
    } else {
      currentArr.push(guess);
    }
    setFormResults({ ...formResults, [field]: currentArr.join(", ") });
  };

  const filteredQuestions = questions.filter(q => {
     if (filterPhase !== "ALL" && q.phase !== filterPhase) return false;
     if (filterPhase === "KNOCKOUT" && filterKoRound !== "ALL" && q.knockoutRound !== filterKoRound) return false;
     if (filterType === "SURPRISE" && !q.isSurprise) return false;
     if (filterType === "DOUBLE" && !q.isDouble) return false;
     if (filterType === "REGULAR" && (q.isSurprise || q.isDouble)) return false;
     return true;
  });

  if (isLoading) return <div className="text-center py-10 text-blue-400 font-bold animate-pulse">טוען שאלות בונוס...</div>;

  const currentAnswerType = formData?.answerType || "TEAM";
  const currentSpecificTeamsArray = formData?.specificTeams ? formData.specificTeams.split(",").map((t:string) => t.trim()).filter(Boolean) : [];

  const distribution: any = {};
  let totalGuesses = 0;
  if (selectedId) {
     allBonusPredictions.forEach(p => {
        const guess = p.answers[selectedId];
        if (guess && String(guess).trim() !== "") {
           totalGuesses++;
           const cleanGuess = String(guess).trim();
           if (!distribution[cleanGuess]) distribution[cleanGuess] = 0;
           distribution[cleanGuess]++;
        }
     });
  }
  const sortedDistribution = Object.entries(distribution).sort((a: any, b: any) => b[1] - a[1]);

  const getTypeBadge = (type: string) => {
    switch(type) {
       case "NUMBER_PURE":
       case "NUMBER_MINUTE": return <span className="bg-slate-900 border border-slate-700 text-slate-300 px-2 py-0.5 rounded text-[10px]">🔢 מספר</span>;
       case "PLAYER": return <span className="bg-slate-900 border border-slate-700 text-slate-300 px-2 py-0.5 rounded text-[10px]">👤 שחקן</span>;
       case "CUSTOM": return <span className="bg-slate-900 border border-slate-700 text-slate-300 px-2 py-0.5 rounded text-[10px]">📝 בחירה</span>;
       default: return <span className="bg-slate-900 border border-slate-700 text-slate-300 px-2 py-0.5 rounded text-[10px]">🏳️ נבחרת</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-700 shadow-xl">
        <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">
          <span>🎁</span> ניהול שאלות בונוס
        </h2>

        {/* --- אזור הפילטרים --- */}
        <div className="flex flex-col gap-3 mb-5 bg-slate-950/50 p-3 rounded-2xl border border-slate-800 transition-all">
           <div className="flex flex-col xl:flex-row gap-3">
             <div className="flex-1 flex gap-1 bg-slate-900 p-1.5 rounded-xl border border-slate-700 overflow-x-auto custom-scrollbar snap-x">
               <button onClick={() => { setFilterPhase("ALL"); setFilterKoRound("ALL"); }} className={`flex-1 min-w-[80px] snap-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterPhase === "ALL" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>הכל</button>
               <button onClick={() => { setFilterPhase("TOURNAMENT"); setFilterKoRound("ALL"); }} className={`flex-1 min-w-[80px] snap-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterPhase === "TOURNAMENT" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>כל הטורניר</button>
               <button onClick={() => { setFilterPhase("GROUPS"); setFilterKoRound("ALL"); }} className={`flex-1 min-w-[80px] snap-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterPhase === "GROUPS" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>שלב הבתים</button>
               <button onClick={() => setFilterPhase("KNOCKOUT")} className={`flex-1 min-w-[80px] snap-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterPhase === "KNOCKOUT" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>נוקאאוט</button>
             </div>
             
             <div className="flex-1 flex gap-1 bg-slate-900 p-1.5 rounded-xl border border-slate-700 overflow-x-auto custom-scrollbar snap-x">
               <button onClick={() => setFilterType("ALL")} className={`flex-1 min-w-[80px] snap-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === "ALL" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>הכל</button>
               <button onClick={() => setFilterType("REGULAR")} className={`flex-1 min-w-[80px] snap-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === "REGULAR" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>רגילה</button>
               <button onClick={() => setFilterType("DOUBLE")} className={`flex-1 min-w-[80px] snap-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${filterType === "DOUBLE" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}><span>⭐</span> דאבל</button>
               <button onClick={() => setFilterType("SURPRISE")} className={`flex-1 min-w-[80px] snap-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${filterType === "SURPRISE" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}><span>🎁</span> הפתעה</button>
             </div>
           </div>
           {filterPhase === "KNOCKOUT" && (
             <div className="flex gap-1 bg-indigo-950/40 p-1.5 rounded-xl border border-indigo-500/20 overflow-x-auto custom-scrollbar snap-x animate-fade-in-up">
               <span className="text-indigo-400 text-[10px] font-black uppercase tracking-widest px-3 flex items-center shrink-0">סיבוב:</span>
               <button onClick={() => setFilterKoRound("ALL")} className={`shrink-0 snap-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterKoRound === "ALL" ? "bg-indigo-600 text-white shadow-md" : "text-indigo-400/70 hover:bg-indigo-900/50 hover:text-indigo-300"}`}>כללי</button>
               {KO_ROUNDS.map(round => (
                 <button key={round} onClick={() => setFilterKoRound(round)} className={`shrink-0 snap-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterKoRound === round ? "bg-indigo-600 text-white shadow-md" : "text-indigo-400/70 hover:bg-indigo-900/50 hover:text-indigo-300"}`}>
                   {round}
                 </button>
               ))}
             </div>
           )}
        </div>
        
        {/* --- כרטיסיות --- */}
        <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-3 snap-x">
           <button 
             onClick={handleCreateNew}
             className="min-w-[140px] flex flex-col items-center justify-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 border-dashed rounded-2xl p-4 transition-all snap-center group shrink-0"
           >
             <span className="text-2xl group-hover:scale-110 transition-transform">➕</span>
             <span className="text-xs font-bold">שאלה חדשה</span>
           </button>

           {filteredQuestions.length === 0 ? (
             <div className="flex items-center justify-center min-w-[200px] text-slate-500 text-sm font-bold border border-slate-800 border-dashed rounded-2xl">
               אין שאלות בסינון הזה
             </div>
           ) : (
             filteredQuestions.map((q, idx) => {
               const isSelected = selectedId === q.id;
               return (
                 <button 
                   key={q.id}
                   onClick={() => handleSelectQuestion(q.id)}
                   className={`min-w-[160px] max-w-[220px] flex flex-col justify-between text-right rounded-2xl p-4 transition-all snap-center shrink-0 border shadow-sm relative overflow-hidden ${isSelected ? "bg-blue-600 border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.4)] scale-105 z-10" : "bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-500"}`}
                 >
                   <div className="flex justify-between items-start mb-3 relative z-10 w-full gap-2">
                     <div className="flex flex-col gap-1.5 items-start shrink-0">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${isSelected ? "bg-blue-950/50 text-blue-200" : "bg-slate-950 text-slate-400"}`}>שאלה {questions.findIndex(x => x.id === q.id) + 1}</span>
                        {getTypeBadge(q.answerType || "TEAM")}
                     </div>
                     
                     <div className="flex flex-wrap justify-end gap-1 flex-1">
                       {q.phase === "KNOCKOUT" && q.knockoutRound && q.knockoutRound !== "ALL" && (
                          <span className="text-[8px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1 rounded truncate max-w-full" title={q.knockoutRound}>{q.knockoutRound}</span>
                       )}
                       {q.isDouble && <span className="text-sm drop-shadow-md shrink-0" title="שאלת דאבל">⭐</span>}
                       {q.isSurprise && <span className="text-sm drop-shadow-md shrink-0" title="שאלת הפתעה">🎁</span>}
                     </div>
                   </div>
                   <span className={`text-sm font-bold line-clamp-2 relative z-10 ${isSelected ? "text-white" : "text-slate-300"}`}>{q.label}</span>
                   {isSelected && <div className="absolute -bottom-4 -left-4 text-5xl opacity-10 blur-sm">🎯</div>}
                 </button>
               );
             })
           )}
        </div>
      </div>

      {/* --- אזור תחתון: עריכת השאלה הנבחרת --- */}
      {selectedId && formData ? (
        <div className="bg-slate-800 p-6 md:p-8 rounded-3xl border border-blue-500/30 shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-2 h-full bg-blue-500"></div>
           
           <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
              <h3 className="text-2xl font-black text-blue-400 flex items-center gap-2">✏️ עריכת שאלה</h3>
              <button onClick={handleDelete} className="text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-900/50 px-4 py-2 rounded-xl text-sm font-bold transition-colors border border-rose-500/20">מחק שאלה 🗑️</button>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* עמודה 1: הגדרות בסיס */}
              <div className="space-y-5">
                 <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700 shadow-inner">
                   <h4 className="text-sm font-black text-slate-300 mb-4 flex items-center gap-2">⚙️ הגדרות כלליות</h4>
                   
                   <div className="space-y-4">
                     <div>
                       <label className="block text-slate-400 text-xs font-bold mb-1.5">השאלה שתוצג למשתמש</label>
                       <textarea value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500 resize-none h-20 text-sm leading-relaxed" placeholder="למשל: מי תזכה במונדיאל?" />
                     </div>
                     
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-slate-400 text-xs font-bold mb-1.5">סך כל הנקודות</label>
                          <input type="number" value={formData.points} onChange={e => setFormData({...formData, points: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500 text-sm font-black" />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-xs font-bold mb-1.5">שיוך לשלב מרכזי</label>
                          <select value={formData.phase} onChange={e => setFormData({...formData, phase: e.target.value, knockoutRound: "ALL"})} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500 text-sm">
                             <option className="bg-slate-900 text-white" value="TOURNAMENT">טורניר מלא</option>
                             <option className="bg-slate-900 text-white" value="GROUPS">שלב הבתים</option>
                             <option className="bg-slate-900 text-white" value="KNOCKOUT">נוק-אאוט</option>
                          </select>
                        </div>
                     </div>
                     
                     {formData.phase === "KNOCKOUT" && (
                        <div className="pt-4 border-t border-slate-800 animate-fade-in-up">
                           <label className="block text-indigo-400 text-xs font-bold mb-1.5">שיוך לסיבוב נוקאאוט ספציפי (אופציונלי)</label>
                           <select value={formData.knockoutRound || "ALL"} onChange={e => setFormData({...formData, knockoutRound: e.target.value})} className="w-full bg-indigo-950/20 border border-indigo-500/30 rounded-xl p-3 text-white outline-none focus:border-indigo-500 text-sm">
                              <option className="bg-slate-900 text-white" value="ALL">כללי (ללא שיוך לסיבוב)</option>
                              {KO_ROUNDS.map(r => <option className="bg-slate-900 text-white" key={r} value={r}>{r}</option>)}
                           </select>
                        </div>
                     )}

                     {/* --- בחירת סוג התשובה --- */}
                     <div className="pt-4 border-t border-slate-800 animate-fade-in-up mt-4">
                        <label className="block text-emerald-400 text-xs font-bold mb-1.5">סוג התשובה המצופה מהשחקן</label>
                        <select value={currentAnswerType} onChange={e => setFormData({...formData, answerType: e.target.value})} className="w-full bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 text-white outline-none focus:border-emerald-500 text-sm">
                           <option className="bg-slate-900 text-white" value="TEAM">נבחרת (עם תמיכה בבלונים ובסינון)</option>
                           <option className="bg-slate-900 text-white" value="NUMBER_PURE">מספר טהור (למשל: 40 כרטיסים)</option>
                           <option className="bg-slate-900 text-white" value="NUMBER_MINUTE">דקת משחק (תומך גם בתוספת זמן, למשל 45+3)</option>
                           <option className="bg-slate-900 text-white" value="PLAYER">שם שחקן (עם השלמה אוטומטית למשתמש)</option>
                           <option className="bg-slate-900 text-white" value="CUSTOM">בחירה מותאמת (הקלדת אפשרויות ספציפיות)</option>

                        </select>
                     </div>

                     {/* הגדרות דינמיות בהתאם לסוג התשובה */}
                     {currentAnswerType === "TEAM" && (
                        <div className="pt-4 border-t border-emerald-900/50 mt-4 animate-fade-in-up space-y-4">
                          
                          <div className="flex gap-2">
                             <button onClick={() => setFormData({...formData, hasNoneOption: !formData.hasNoneOption})} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${formData.hasNoneOption ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-950 text-slate-400 border-slate-700 hover:border-emerald-500/50'}`}>
                                🛡️ בלון "אף נבחרת"
                             </button>
                             <button onClick={() => setFormData({...formData, hasAllOption: !formData.hasAllOption})} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${formData.hasAllOption ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-950 text-slate-400 border-slate-700 hover:border-emerald-500/50'}`}>
                                🌍 בלון "כל הנבחרות"
                             </button>
                          </div>

                          <div>
                             <label className="block text-slate-400 text-xs font-bold mb-2">
                                הגבל את התשובה לנבחרות ספציפיות <br/><span className="font-normal text-[10px] text-emerald-400">(אם לא תבחר אף בלון - כל 48 הנבחרות יהיו זמינות לבחירה)</span>
                             </label>
                             <div className="flex flex-wrap gap-1.5 p-3 bg-slate-950 rounded-xl border border-slate-800 max-h-[160px] overflow-y-auto custom-scrollbar">
                                {ALL_TEAMS.map(team => {
                                  const isActive = currentSpecificTeamsArray.includes(team);
                                  return (
                                    <button 
                                      key={team} 
                                      onClick={() => toggleSpecificTeam(team)}
                                      className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all border ${isActive ? 'bg-blue-600 text-white border-blue-500 shadow-sm scale-105' : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'}`}
                                    >
                                      {team}
                                    </button>
                                  );
                                })}
                             </div>
                             
                             {currentSpecificTeamsArray.length === 0 ? (
                                <div className="text-[10px] text-emerald-400 font-bold mt-2">
                                  🌍 כרגע כל 48 הנבחרות זמינות לבחירה.
                                </div>
                             ) : (
                                <div className="text-[10px] text-blue-400 font-bold mt-2">
                                  🎯 נבחרו {currentSpecificTeamsArray.length} נבחרות לשאלה זו.
                                </div>
                             )}
                          </div>

                        </div>
                     )}

                     {currentAnswerType === "CUSTOM" && (
                        <div className="pt-3 border-t border-emerald-900/50 mt-3 animate-fade-in-up">
                          <label className="block text-emerald-400 text-[10px] font-bold mb-1">אפשרויות לבחירה (הפרד בפסיקים)</label>
                          <input type="text" value={formData.possibleOptions || ""} onChange={e => setFormData({...formData, possibleOptions: e.target.value})} className="w-full bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-2.5 text-white outline-none focus:border-emerald-500 text-xs" placeholder="למשל: אמבפה, האלנד, כמות שווה" />
                        </div>
                     )}

                   </div>
                 </div>

                 {/* סוגי שאלות מיוחדות */}
                 <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700 shadow-inner space-y-4">
                    <h4 className="text-sm font-black text-slate-300 mb-2 flex items-center gap-2">✨ סיווג מיוחד</h4>
                    
                    <label className="flex items-center gap-3 cursor-pointer bg-slate-950 p-3 rounded-xl border border-slate-800 hover:border-slate-600 transition-colors">
                      <input type="checkbox" checked={formData.isDouble} onChange={e => setFormData({...formData, isDouble: e.target.checked})} className="w-5 h-5 rounded border-slate-600 text-amber-500 focus:ring-amber-500 bg-slate-900" />
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-amber-400 flex items-center gap-1.5">⭐ שאלת דאבל (סימון בלבד)</span>
                        <span className="text-[10px] text-slate-500 mt-0.5">יש לעדכן את סך הנקודות למעלה בהתאם.</span>
                      </div>
                    </label>

                    <label className={`flex items-center gap-3 cursor-pointer bg-slate-950 p-3 rounded-xl border transition-colors ${formData.isSurprise ? "border-purple-500/50" : "border-slate-800 hover:border-slate-600"}`}>
                      <input type="checkbox" checked={formData.isSurprise} onChange={e => setFormData({...formData, isSurprise: e.target.checked})} className="w-5 h-5 rounded border-slate-600 text-purple-500 focus:ring-purple-500 bg-slate-900" />
                      <span className="text-sm font-black text-purple-300 flex items-center gap-1.5">🎁 שאלת הפתעה מתוזמנת</span>
                    </label>

                    {formData.isSurprise && (
                      <div className="grid grid-cols-2 gap-4 animate-fade-in-up bg-purple-950/20 p-3 rounded-xl border border-purple-500/20 mt-2">
                         <div>
                           <label className="block text-slate-400 text-[10px] font-bold mb-1.5">תאריך פתיחה</label>
                           <input type="datetime-local" value={formData.openTime} onChange={e => setFormData({...formData, openTime: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-purple-500 text-xs" dir="ltr" />
                         </div>
                         <div>
                           <label className="block text-slate-400 text-[10px] font-bold mb-1.5">תאריך סגירה</label>
                           <input type="datetime-local" value={formData.closeTime} onChange={e => setFormData({...formData, closeTime: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-purple-500 text-xs" dir="ltr" />
                         </div>
                      </div>
                    )}

                    {/* --- קוד להוספה מתחת לטוגל של שאלת הפתעה ב- AdminBonusTab.tsx --- */}
                    {currentAnswerType === "NUMBER_PURE" && (
                      <label className={`flex items-center gap-3 cursor-pointer bg-slate-950 p-3 rounded-xl border transition-colors ${formData.isProximity ? "border-orange-500/50" : "border-slate-800 hover:border-slate-600"}`}>
                        <input 
                          type="checkbox" 
                          checked={formData.isProximity} 
                          onChange={e => setFormData({...formData, isProximity: e.target.checked, points: e.target.checked ? 50 : 15})} 
                          className="w-5 h-5 rounded border-slate-600 text-orange-500 focus:ring-orange-500 bg-slate-900" 
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-orange-400 flex items-center gap-1.5">🤪 בעל הבית השתגע (ניקוד לפי קרבה)</span>
                          <span className="text-[10px] text-slate-500 mt-0.5">מעניק אוטומטית 50 לבול, 40 לסטייה של 5, 30 ל-10 וכו&apos;. (הניקוד המקסימלי יעודכן ל-50).</span>
                        </div>
                      </label>
                    )}
                 </div>
              </div>

              {/* עמודה 2: תוצאות ואדמין */}
              <div className="flex flex-col gap-6">
                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700 shadow-inner flex flex-col">
                   <h4 className="text-sm font-black text-amber-400 mb-4 flex items-center gap-2">📊 ניהול תוצאות בפועל (LIVE)</h4>
                   
                   <div className="space-y-5 flex-1">
                     
                     {/* שדה: תשובה נכונה */}
                     <div>
                       <label className="block text-emerald-400 text-xs font-bold mb-1.5 flex flex-col sm:flex-row sm:justify-between gap-1">
                         <span>✅ התשובה הנכונה (מזכה בנקודות)</span>
                         <span className="text-slate-500 font-normal">הפרד בפסיקים במקרה של כמה תשובות</span>
                       </label>
                       <input type="text" value={formResults.answer} onChange={e => setFormResults({...formResults, answer: e.target.value})} className="w-full bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 text-white outline-none focus:border-emerald-500 text-sm" placeholder="התשובה הנכונה..." />
                     </div>

                     {/* שדה: מובילה זמנית */}
                     <div>
                       <label className="block text-amber-400 text-xs font-bold mb-1.5">
                         <span>👑 מובילה זמנית (מסמן סמיילי 👑 בדאשבורד)</span>
                       </label>
                       <input type="text" value={formResults.leading} onChange={e => setFormResults({...formResults, leading: e.target.value})} className="w-full bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 text-white outline-none focus:border-amber-500 text-sm" placeholder="מובילה כרגע..." />
                     </div>

                     {/* שדה: רשימה שחורה */}
                     <div>
                       <label className="block text-rose-400 text-xs font-bold mb-1.5">
                         <span>❌ רשימה שחורה (פוסל את התשובה)</span>
                       </label>
                       <input type="text" value={formResults.blacklist} onChange={e => setFormResults({...formResults, blacklist: e.target.value})} className="w-full bg-rose-950/20 border border-rose-500/30 rounded-xl p-3 text-white outline-none focus:border-rose-500 text-sm" placeholder="תשובות שנפסלו..." />
                     </div>

                     <div className="pt-2 border-t border-slate-800 mt-2">
                       <label className="flex items-center gap-3 cursor-pointer bg-slate-950 p-3 rounded-xl border border-slate-700 hover:border-rose-500/50 transition-colors">
                         <input type="checkbox" checked={formResults.locked} onChange={e => setFormResults({...formResults, locked: e.target.checked})} className="w-5 h-5 rounded border-slate-600 text-rose-500 focus:ring-rose-500 bg-slate-900" />
                         <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-200">🔒 נעילת השאלה לשינויים עתידיים</span>
                            <span className="text-[10px] text-slate-500 mt-0.5">מסמן אוטומטית כ"נפסל" את כל מי שלא ענה את התשובה הנכונה</span>
                         </div>
                       </label>
                     </div>
                   </div>
                </div>

                {/* --- הלוח מודיעין המשודרג (עם כפתורי הוספה מהירים) --- */}
                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700 shadow-inner flex flex-col min-h-[300px]">
                   <div className="flex justify-between items-center mb-4">
                     <h4 className="text-sm font-black text-cyan-400 flex items-center gap-2">👁️ לוח מודיעין ופעולות (התפלגות ניחושים)</h4>
                     <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-700">סה"כ ניחושים: {totalGuesses}</span>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                     {sortedDistribution.length === 0 ? (
                        <div className="text-center text-slate-500 text-xs font-bold py-6">אף אחד עדיין לא ניחש תשובה לשאלה זו.</div>
                     ) : (
                        sortedDistribution.map(([guess, count]: any, i: number) => {
                           const percent = Math.round((count / totalGuesses) * 100);
                           
                           // בדיקה האם הניחוש כבר נמצא באחד השדות (כדי להציג כפתור "לחוץ")
                           const isAns = formResults.answer.split(',').map((s:string)=>s.trim()).includes(guess);
                           const isLead = formResults.leading.split(',').map((s:string)=>s.trim()).includes(guess);
                           const isBlack = formResults.blacklist.split(',').map((s:string)=>s.trim()).includes(guess);

                           return (
                             <div key={i} className="flex flex-col gap-2 bg-slate-950/50 p-3 rounded-lg border border-slate-800 hover:border-cyan-500/30 transition-colors group">
                               <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                                 <span className="truncate max-w-[150px] text-sm">{guess}</span>
                                 <span className="text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">{count} משתמשים ({percent}%)</span>
                               </div>
                               
                               <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                 <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${percent}%` }}></div>
                               </div>

                               {/* שורת הכפתורים המהירים */}
                               <div className="flex gap-1.5 mt-1 pt-2 border-t border-slate-800/50">
                                  <button 
                                    onClick={() => toggleQuickAction('answer', guess)} 
                                    className={`flex-1 rounded py-1.5 text-[10px] font-bold transition-all border ${isAns ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-emerald-950/20 text-emerald-500/70 border-emerald-900/30 hover:bg-emerald-900/50'}`}
                                  >
                                    {isAns ? '✅ נבחר כנכונה' : '✅ הוסף לנכונה'}
                                  </button>
                                  
                                  <button 
                                    onClick={() => toggleQuickAction('leading', guess)} 
                                    className={`flex-1 rounded py-1.5 text-[10px] font-bold transition-all border ${isLead ? 'bg-amber-600 text-white border-amber-500' : 'bg-amber-950/20 text-amber-500/70 border-amber-900/30 hover:bg-amber-900/50'}`}
                                  >
                                    {isLead ? '👑 מובילה עכשיו' : '👑 הוסף למובילה'}
                                  </button>
                                  
                                  <button 
                                    onClick={() => toggleQuickAction('blacklist', guess)} 
                                    className={`flex-1 rounded py-1.5 text-[10px] font-bold transition-all border ${isBlack ? 'bg-rose-600 text-white border-rose-500' : 'bg-rose-950/20 text-rose-500/70 border-rose-900/30 hover:bg-rose-900/50'}`}
                                  >
                                    {isBlack ? '❌ נפסלה הרגע' : '❌ הוסף לשחורה'}
                                  </button>
                               </div>
                             </div>
                           );
                        })
                     )}
                   </div>
                </div>
              </div>
           </div>

           <div className="mt-8 pt-6 border-t border-slate-700 flex justify-end">
              <button 
                 onClick={handleSave} 
                 disabled={isSaving}
                 className="w-full md:w-auto px-10 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 text-lg flex items-center justify-center gap-2"
              >
                 {isSaving ? "שומר..." : "💾 שמור שינויים ותוצאות"}
              </button>
           </div>
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-3xl p-12 text-center text-slate-500">
           <div className="text-5xl mb-4 opacity-50">👆</div>
           <h3 className="text-lg font-bold">בחר שאלה מהרשימה למעלה או צור שאלה חדשה</h3>
        </div>
      )}

    </div>
  );
}