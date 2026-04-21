"use client";
import React, { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function JsonGeneratorPage() {
  const [roundName, setRoundName] = useState("32 הגדולות");
  const [defaultDate, setDefaultDate] = useState("");
  
  const [matches, setMatches] = useState([
    { _tempId: Date.now(), homeTeam: "", awayTeam: "", matchDate: "", time: "21:00" }
  ]);

  const STAGES = ["32 הגדולות", "שמינית גמר", "רבע גמר", "חצי גמר", "גמר", "מקום שלישי"];

  const handleAddMatch = () => {
    setMatches([...matches, { _tempId: Date.now(), homeTeam: "", awayTeam: "", matchDate: defaultDate, time: "21:00" }]);
  };

  const handleRemoveMatch = (idToRemove: number) => {
    setMatches(matches.filter(m => m._tempId !== idToRemove));
  };

  const handleUpdateMatch = (id: number, field: string, value: string) => {
    setMatches(matches.map(m => m._tempId === id ? { ...m, [field]: value } : m));
  };

  const generateJson = () => {
    // ממירים את הרשימה לפורמט שה-DB מצפה לקבל
    const output = matches.map((m, index) => {
      // יצירת ID ייחודי ונקי (למשל: ko_32_1)
      const cleanRound = roundName.includes("32") ? "32" : roundName.includes("16") || roundName.includes("שמינית") ? "16" : roundName.includes("רבע") ? "8" : roundName.includes("חצי") ? "4" : "final";
      const matchId = `ko_${cleanRound}_${Date.now().toString().slice(-4)}_${index + 1}`;
      
      // סידור התאריך לפורמט DD/MM/YYYY HH:MM
      let finalDate = "";
      if (m.matchDate) {
         const [year, month, day] = m.matchDate.split("-");
         finalDate = `${day}/${month}/${year} ${m.time}`;
      }

      return {
        id: matchId,
        homeTeam: m.homeTeam.trim() || "קבוצה 1",
        awayTeam: m.awayTeam.trim() || "קבוצה 2",
        matchDate: finalDate,
        stage: "KNOCKOUT",
        roundName: roundName,
        isFinished: false
      };
    });

    return JSON.stringify(output, null, 2);
  };

  const copyToClipboard = () => {
    const jsonStr = generateJson();
    navigator.clipboard.writeText(jsonStr);
    toast.success("הקוד הועתק! אפשר להדביק בקובץ או ישר באדמין 📋");
  };

  const downloadJsonFile = () => {
    const jsonStr = generateJson();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `matches_${roundName}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("הקובץ הורד למחשב! 💾");
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-10 text-slate-200 font-sans" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
          <div>
             <h1 className="text-3xl font-black text-blue-400 flex items-center gap-3">
               <span>⚙️</span> מחולל משחקי נוק-אאוט (JSON)
             </h1>
             <p className="text-slate-400 mt-2 text-sm">הזן את המשחקים, הורד את הקובץ, וייבא אותו דרך טאב "משחקים" באדמין.</p>
          </div>
          <Link href="/admin" className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold transition-colors border border-slate-700">
            חזור לאדמין 🔙
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* צד ימין - הטופס */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-lg">
              <h2 className="text-xl font-bold text-white mb-6 border-b border-slate-800 pb-3">הגדרות שלב</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs font-bold mb-2">לאיזה שלב המשחקים שייכים?</label>
                  <select value={roundName} onChange={e => setRoundName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500">
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-bold mb-2">תאריך ברירת מחדל (לנוחות)</label>
                  <input type="date" value={defaultDate} onChange={e => setDefaultDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500 cursor-pointer" dir="ltr" />
                </div>
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-lg">
              <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-3">
                <h2 className="text-xl font-bold text-white">רשימת המשחקים ({matches.length})</h2>
                <button onClick={handleAddMatch} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-md">
                  ➕ הוסף משחק
                </button>
              </div>

              <div className="space-y-4">
                {matches.map((m, idx) => (
                  <div key={m._tempId} className="flex flex-wrap md:flex-nowrap items-center gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 group hover:border-slate-600 transition-colors">
                    <div className="w-8 text-center text-slate-600 font-black">{idx + 1}.</div>
                    <input type="text" placeholder="קבוצת בית" value={m.homeTeam} onChange={e => handleUpdateMatch(m._tempId, "homeTeam", e.target.value)} className="flex-1 min-w-[120px] bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-blue-500 text-sm text-center" />
                    <span className="text-slate-600 font-black">VS</span>
                    <input type="text" placeholder="קבוצת חוץ" value={m.awayTeam} onChange={e => handleUpdateMatch(m._tempId, "awayTeam", e.target.value)} className="flex-1 min-w-[120px] bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-blue-500 text-sm text-center" />
                    
                    <input type="date" value={m.matchDate} onChange={e => handleUpdateMatch(m._tempId, "matchDate", e.target.value)} className="w-[130px] bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-blue-500 text-sm" dir="ltr" />
                    <input type="time" value={m.time} onChange={e => handleUpdateMatch(m._tempId, "time", e.target.value)} className="w-[90px] bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-blue-500 text-sm" dir="ltr" />
                    
                    <button onClick={() => handleRemoveMatch(m._tempId)} className="w-10 h-10 flex items-center justify-center bg-rose-900/30 hover:bg-rose-600 text-rose-500 hover:text-white rounded-lg border border-rose-500/30 transition-colors shrink-0" title="הסר משחק">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* צד שמאל - תצוגה מקדימה וייצוא */}
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-lg flex flex-col h-full lg:sticky lg:top-8">
            <h2 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-2"><span>👀</span> תצוגה מקדימה (Live)</h2>
            <textarea 
              readOnly 
              value={generateJson()} 
              className="flex-1 w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-emerald-400 font-mono text-xs outline-none resize-none custom-scrollbar mb-6 min-h-[300px]"
              dir="ltr"
            />
            
            <div className="space-y-3 shrink-0">
               <button onClick={copyToClipboard} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 rounded-xl border border-slate-600 transition-colors shadow-sm flex justify-center items-center gap-2">
                 📋 העתק טקסט
               </button>
               <button onClick={downloadJsonFile} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-95 flex justify-center items-center gap-2 text-lg">
                 ⬇️ הורד קובץ .json
               </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}