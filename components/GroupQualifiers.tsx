"use client";
import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../app/firebase";

export default function GroupQualifiers({ groups, userId, tournamentState = 0 }) {
  const [qualifiers, setQualifiers] = useState<any>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isLoading, setIsLoading] = useState(true);

  const isUserAction = useRef(false);
  const isLoaded = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const qSnap = await getDoc(doc(db, "predictions_qualifiers", userId));
        if (qSnap.exists()) setQualifiers(qSnap.data().groups || {});
      } catch (error) { console.error(error); } 
      finally { isLoaded.current = true; setIsLoading(false); }
    };
    if (userId) fetchData();
  }, [userId]);

  useEffect(() => {
    if (!isLoaded.current || !isUserAction.current) return;
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        await setDoc(doc(db, "predictions_qualifiers", userId), { groups: qualifiers, updatedAt: new Date() }, { merge: true });
        setSaveStatus("saved");
        isUserAction.current = false;
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (error) { setSaveStatus("idle"); }
    }, 800);
    return () => clearTimeout(timer);
  }, [qualifiers, userId]);

  const handleGroupChange = (group: string, place: "first" | "second", value: string) => {
    isUserAction.current = true;
    setQualifiers(prev => ({ ...prev, [group]: { ...prev[group], [place]: value } }));
  };

  if (isLoading) return <div className="text-center text-emerald-400 animate-pulse mt-8 font-bold">טוען...</div>;

  // 🧠 חוק הנעילה של השעון 🧠
  const isLocked = tournamentState >= 1;

  return (
    <div className="w-full mb-12">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold text-white border-b border-slate-700 pb-2">מקומות 1-2 (מכל בית)</h3>
        <div className="h-8 flex items-center text-sm font-medium">
          {saveStatus === "saving" && <span className="text-amber-400 animate-pulse">⏳ שומר...</span>}
          {saveStatus === "saved" && <span className="text-emerald-400">✓ נשמר</span>}
        </div>
      </div>

      {isLocked && (
         <div className="bg-rose-900/20 border border-rose-500/30 p-4 rounded-xl text-rose-300 text-center mb-6 font-bold flex justify-center items-center gap-2 shadow-lg">
           <span>🔒</span> שלב זה נעול להזנה בעקבות תחילת המשחקים.
         </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Object.keys(groups).sort().map(groupName => {
          const teams = groups[groupName];
          return (
            <div key={groupName} className={`bg-slate-800 p-5 rounded-2xl border-t-4 border-t-emerald-500 border-l border-r border-b border-slate-700 shadow-lg ${isLocked ? "opacity-75 grayscale-[20%]" : "hover:scale-[1.02] transition-transform"}`}>
              <div className="flex justify-between items-center mb-4 bg-emerald-500/10 py-1 px-3 rounded-lg">
                <h4 className="font-bold text-emerald-400 text-lg">בית {groupName}</h4>
                {isLocked && <span className="text-xs text-rose-400 font-bold">🔒</span>}
              </div>
              <div className="flex flex-col gap-3">
                <select value={qualifiers[groupName]?.first || ""} disabled={isLocked} onChange={e => handleGroupChange(groupName, "first", e.target.value)} className={`w-full text-white p-3 rounded-xl border outline-none ${isLocked ? "bg-slate-900/50 border-slate-700 text-slate-500 cursor-not-allowed" : "bg-slate-900 border-slate-600 focus:border-emerald-500"}`}>
                  <option value="">-- מקום 1 --</option>{teams.map((t: string) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={qualifiers[groupName]?.second || ""} disabled={isLocked} onChange={e => handleGroupChange(groupName, "second", e.target.value)} className={`w-full text-white p-3 rounded-xl border outline-none ${isLocked ? "bg-slate-900/50 border-slate-700 text-slate-500 cursor-not-allowed" : "bg-slate-900 border-slate-600 focus:border-emerald-500"}`}>
                  <option value="">-- מקום 2 --</option>{teams.map((t: string) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}