"use client";
import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../../app/firebase";
import toast from "react-hot-toast";
import { getFlagUrl } from "../../app/utils/flags"; 

export default function ThirdPlaceQualifiers({ groups, userId, tournamentState = 0 }: any) {
  const groupNames = Object.keys(groups).sort();
  // --- סטייטים חדשים לקרוסלת הבתים ---
  const [activeGroup, setActiveGroup] = useState(groupNames[0] || "A");
  
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [userQualifiers, setUserQualifiers] = useState<any>({}); 
  const [realThirdPlace, setRealThirdPlace] = useState<string[]>([]); 
  
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isRandomizing, setIsRandomizing] = useState(false);
  
  const [showSpyModal, setShowSpyModal] = useState(false);
  const [spyData, setSpyData] = useState<any[]>([]);
  const [isLoadingSpy, setIsLoadingSpy] = useState(false);

  const isLoaded = useRef(false);
  const isUserAction = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tSnap = await getDoc(doc(db, "predictions_third_place", userId));
        if (tSnap.exists()) {
          const savedTeams = tSnap.data().teams || [];
          setSelectedTeams(savedTeams.filter((t: string) => t !== "")); 
        }
        
        const qSnap = await getDoc(doc(db, "predictions_qualifiers", userId));
        if (qSnap.exists()) {
          setUserQualifiers(qSnap.data().groups || {});
        }
        
        const rSnap = await getDoc(doc(db, "admin_results", "third_place"));
        if (rSnap.exists()) {
          const rTeams = rSnap.data().teams || [];
          setRealThirdPlace(rTeams.filter((t: string) => t !== ""));
        }
      } catch (e) { console.error(e); }
      finally { isLoaded.current = true; }
    };
    if (userId) fetchData();
  }, [userId]);

  useEffect(() => {
    if (!isLoaded.current || !isUserAction.current) return;
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        const paddedTeams = [...selectedTeams];
        while (paddedTeams.length < 8) paddedTeams.push(""); 
        
        await setDoc(doc(db, "predictions_third_place", userId), { teams: paddedTeams, updatedAt: new Date() }, { merge: true });
        setSaveStatus("saved");
        isUserAction.current = false;
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (e) { setSaveStatus("idle"); }
    }, 800);
    return () => clearTimeout(timer);
  }, [selectedTeams, userId]);

  const checkIsAlreadyAdvanced = (team: string) => {
    for (const group of Object.values(userQualifiers)) {
      const g = group as any;
      if (g.first === team || g.second === team) return true;
    }
    return false;
  };

  const toggleTeam = (team: string, groupName: string) => {
    if (isLocked) return;
    isUserAction.current = true;
    
    if (selectedTeams.includes(team)) {
      setSelectedTeams(prev => prev.filter(t => t !== team));
    } else {
      if (selectedTeams.length >= 8 && !selectedTeams.find(t => Array.from(groups[groupName] as Set<string>).includes(t))) {
        const errId = toast.error("כבר בחרת 8 נבחרות! בטל בחירה קיימת (X בסלוט למעלה) כדי לבחור אחרת.");
        setTimeout(() => toast.dismiss(errId), 3000);
        return;
      }

      if (checkIsAlreadyAdvanced(team)) {
        const warnId = toast('שמנו לב שכבר העלית את הנבחרת הזו ממקום 1/2. זכותך לגדר סיכונים, אבל שים לב!', { 
          icon: '⚠️', 
          style: { background: '#334155', color: '#fbbf24', border: '1px solid #fbbf24' } 
        });
        setTimeout(() => toast.dismiss(warnId), 3500);
      }

      const teamsInThisGroup = Array.from(groups[groupName] as any[]);
      const alreadySelectedFromGroup = selectedTeams.find(t => teamsInThisGroup.includes(t));
      
      if (alreadySelectedFromGroup) {
        setSelectedTeams(prev => [...prev.filter(t => t !== alreadySelectedFromGroup), team]);
      } else {
        setSelectedTeams(prev => [...prev, team]);
      }
    }
  };

  const handleRemoveTeam = (team: string) => {
    if (isLocked) return;
    isUserAction.current = true;
    setSelectedTeams(prev => prev.filter(t => t !== team));
  };

  const isLocked = tournamentState >= 1;

  const handleRandomizeThirdPlace = () => {
    toast((t) => (
      <div className="flex flex-col gap-3 text-right" dir="rtl">
        <span className="font-bold text-slate-800 text-sm">המערכת תבחר עבורך 4 נבחרות אקראיות מתוך הבתים. להמשיך?</span>
        <div className="flex gap-2">
          <button onClick={() => {
            toast.dismiss(t.id);
            setIsRandomizing(true);
            setTimeout(() => {
               const allTeams: string[] = [];
               Object.values(groups).forEach((g: any) => allTeams.push(...g));
               const shuffled = allTeams.sort(() => 0.5 - Math.random());
               const randomFour = shuffled.slice(0, 4);
               setSelectedTeams(randomFour);
               setIsRandomizing(false);
               const successId = toast.success("🎲 הוגרלו 4 נבחרות אקראיות!");
               setTimeout(() => toast.dismiss(successId), 2500); 
            }, 600);
          }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95">כן, הגרל</button>
          <button onClick={() => toast.dismiss(t.id)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">בטל</button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const calculateUserPoints = (userTeams: string[]) => {
    if (realThirdPlace.length === 0) return null;
    let pts = 0;
    userTeams.forEach(t => { if (realThirdPlace.includes(t)) pts += 10; });
    return pts;
  };

  const handleOpenSpy = async () => {
    setShowSpyModal(true);
    setIsLoadingSpy(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const usersMap: any = {};
      usersSnap.forEach(doc => { usersMap[doc.id] = doc.data().name || "שחקן לא ידוע"; });

      const tSnap = await getDocs(collection(db, "predictions_third_place"));
      const gathered: any[] = [];
      tSnap.forEach(doc => {
        const userTeams = (doc.data().teams || []).filter((t: string) => t !== "");
        if (userTeams.length > 0) {
          gathered.push({
            userId: doc.id,
            userName: usersMap[doc.id] || "משתמש",
            teams: userTeams,
            points: calculateUserPoints(userTeams)
          });
        }
      });
      gathered.sort((a, b) => a.userName.localeCompare(b.userName));
      setSpyData(gathered);
    } catch (e) { console.error(e); } 
    finally { setIsLoadingSpy(false); }
  };

  // --- פונקציות ניווט לקרוסלה ---
  const currentIndex = groupNames.indexOf(activeGroup);
  
  const handlePrevGroup = () => {
    const prevIndex = currentIndex === 0 ? groupNames.length - 1 : currentIndex - 1;
    setActiveGroup(groupNames[prevIndex]);
  };
  
  const handleNextGroup = () => {
    const nextIndex = currentIndex === groupNames.length - 1 ? 0 : currentIndex + 1;
    setActiveGroup(groupNames[nextIndex]);
  };

  const myPoints = calculateUserPoints(selectedTeams);

  // בדוק אם כבר נבחרה נבחרת מהבית הנוכחי
  const currentGroupTeams = Array.from(groups[activeGroup] as Set<string> || []);
  const selectedFromActiveGroup = selectedTeams.find(t => currentGroupTeams.includes(t));

  return (
    <div className="w-full animate-fade-in-up">
      
      {/* --- אזור ה"עגלה" (הסלוטים למעלה) --- */}
      <div className="bg-slate-900/80 p-6 md:p-8 rounded-3xl border border-teal-500/30 mb-8 shadow-2xl relative md:sticky md:top-20 z-30 backdrop-blur-md">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <div className="flex-1">
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400 mb-2">
              8 המעפילות מהמקום השלישי
            </h2>
            <p className="text-slate-400 mb-3">בחר את 8 הנבחרות שלדעתך יעפילו לשלב הבא מהמקום השלישי בבית שלהן.</p>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 w-fit">
              <span>💡</span> מותרת רק נבחרת אחת מכל בית
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-3 w-full md:w-auto">
             {myPoints !== null && (
               <div className={`px-5 py-2.5 rounded-2xl border shadow-lg ${myPoints > 0 ? "bg-purple-600/20 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)] text-purple-400" : "bg-slate-800 border-slate-700 text-slate-500"}`}>
                 <span className="font-bold text-sm ml-2">ניקוד:</span>
                 <span className="text-2xl font-black">{myPoints > 0 ? `+${myPoints}` : "0"}</span>
               </div>
             )}
             
             <div className="flex items-center gap-3 w-full justify-end">
               {saveStatus === "saving" && <span className="text-amber-400 text-xs animate-pulse font-bold">⏳ שומר...</span>}
               {saveStatus === "saved" && <span className="text-emerald-400 text-xs font-bold">✓ נשמר</span>}
               
               {!isLocked ? (
                 <button onClick={handleRandomizeThirdPlace} disabled={isRandomizing} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-600 transition-all">
                   🎲 הגרל
                 </button>
               ) : (
                 <span className="bg-rose-500/10 text-rose-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-rose-500/30">
                   🔒 נעול
                 </span>
               )}
             </div>
          </div>
        </div>

        {/* 🏆 8 הסלוטים החזותיים 🏆 */}
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-3 mt-6">
          {Array.from({ length: 8 }).map((_, i) => {
            const team = selectedTeams[i];
            const isWarning = team ? checkIsAlreadyAdvanced(team) : false;

            return (
              <div key={i} className={`relative flex flex-col items-center justify-center p-2 rounded-2xl border-2 transition-all h-28 group ${team ? 'bg-slate-800 border-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.15)] hover:-translate-y-1' : 'bg-slate-950/50 border-slate-700 border-dashed'}`}>
                {team ? (
                  <>
                    {isWarning && (
                      <div className="absolute -top-2 -right-2 bg-slate-900 border border-amber-500 text-amber-400 rounded-full w-6 h-6 flex items-center justify-center text-[10px] font-black shadow-md z-10" title="סתירה: בחרת להעלות אותה גם ממקום 1/2">
                        ⚠️
                      </div>
                    )}
                    
                    {!isLocked && (
                      <button onClick={() => handleRemoveTeam(team)} className="absolute -top-2 -left-2 bg-rose-500 hover:bg-rose-400 rounded-full w-6 h-6 text-white text-[10px] font-black flex items-center justify-center border border-slate-900 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        ✕
                      </button>
                    )}

                    {getFlagUrl(team) ? <img src={getFlagUrl(team)!} className="w-10 h-7 object-cover rounded shadow-md mb-2" alt="flag" /> : <span className="text-2xl mb-1">🏳️</span>}
                    <span className="text-xs font-black text-white text-center leading-tight w-full break-words">{team}</span>
                  </>
                ) : (
                  <span className="text-slate-600 text-3xl font-black opacity-20">{i+1}</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 text-center">
           <span className="text-sm font-bold text-slate-400">
             נבחרו <span className={selectedTeams.length === 8 ? "text-emerald-400" : "text-white"}>{selectedTeams.length}</span> מתוך 8
           </span>
        </div>

        {isLocked && (
          <div className="mt-4 border-t border-slate-700/50 pt-5">
            <button onClick={handleOpenSpy} className="w-full py-3 rounded-xl font-bold text-sm transition-all border flex items-center justify-center gap-2 bg-slate-900 text-slate-400 hover:text-white border-slate-700 hover:bg-slate-800">
              <span>👁️</span> ריגול: מי ניחש מה?
            </button>
          </div>
        )}
      </div>

      {/* --- תוצאות אמת --- */}
      {realThirdPlace.length > 0 && (
         <div className="mb-8 bg-purple-900/20 border border-purple-500/30 p-6 rounded-3xl shadow-inner relative z-10">
           <h3 className="text-purple-400 font-bold mb-4 flex items-center gap-2"><span>🏆</span> העפילו בפועל למקום ה-3 (תוצאות אמת):</h3>
           <div className="flex flex-wrap gap-3">
             {realThirdPlace.map(t => {
               const isHit = selectedTeams.includes(t);
               return (
                 <span key={t} className={`px-4 py-2 rounded-xl text-sm font-bold border flex items-center gap-2 transition-all ${isHit ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)] scale-105" : "bg-slate-800 text-slate-300 border-slate-700"}`}>
                   {getFlagUrl(t) && <img src={getFlagUrl(t)!} className="w-5 h-3.5 object-cover rounded-sm" alt="flag"/>} 
                   {t} 
                   {isHit && <span className="ml-1">🎯 +10</span>}
                 </span>
               );
             })}
           </div>
         </div>
      )}

      {/* --- קרוסלת הבתים לבחירת הנבחרות --- */}
      <div className="max-w-md mx-auto relative z-10">
         
         {/* קונטרולר הבתים (חצים - הכיוונים תוקנו ל-RTL!) */}
         <div className="flex items-center justify-between w-full bg-slate-900/80 p-2 rounded-2xl border border-slate-800 shadow-md backdrop-blur-md mb-6">
            {/* כפתור "הקודם" - ימינה */}
            <button onClick={handlePrevGroup} className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 active:scale-95">
               <span className="text-xl leading-none">▶</span>
            </button>
            
            <div className="flex flex-col items-center justify-center flex-1">
               <h2 className="text-2xl font-black text-white flex items-center gap-2">
                 בית {activeGroup}
               </h2>
               {selectedFromActiveGroup ? (
                  <span className="text-[10px] bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded font-bold border border-teal-500/30 mt-1 flex items-center gap-1">
                    <span>✓</span> נבחרה ({selectedFromActiveGroup})
                  </span>
               ) : (
                  <span className="text-[10px] text-slate-500 font-bold mt-1">לא נבחרה נבחרת מבית זה</span>
               )}
            </div>

            {/* כפתור "הבא" - שמאלה */}
            <button onClick={handleNextGroup} className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 active:scale-95">
               <span className="text-xl leading-none">◀</span>
            </button>
         </div>

         {/* רשימת הנבחרות בבית הפעיל */}
         <div className={`bg-slate-800 rounded-3xl p-5 border transition-all ${selectedFromActiveGroup ? "border-teal-500/50 shadow-[0_0_20px_rgba(20,184,166,0.05)] bg-teal-900/10" : "border-slate-700"} ${isLocked && myPoints === null ? "opacity-80 grayscale-[10%]" : ""}`}>
            <div className="flex flex-col gap-3">
              {currentGroupTeams.map(team => {
                const isSelected = selectedTeams.includes(team);
                const isRealWinner = realThirdPlace.includes(team);
                const hasWarning = checkIsAlreadyAdvanced(team);
                
                let btnStyle = "bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white";
                if (isSelected) btnStyle = "bg-teal-600 text-white border-teal-500 shadow-md transform scale-[1.02]";
                if (isLocked && !isSelected) btnStyle = "bg-slate-900/50 text-slate-500 border-slate-800 cursor-not-allowed";

                return (
                  <button
                    key={team}
                    disabled={isLocked}
                    onClick={() => toggleTeam(team, activeGroup)}
                    className={`py-4 px-5 rounded-2xl font-bold transition-all text-base w-full text-right flex justify-between items-center border ${btnStyle} relative overflow-hidden group`}
                  >
                    <div className="flex items-center gap-3 relative z-10">
                       {getFlagUrl(team) ? <img src={getFlagUrl(team)!} className="w-6 h-4 object-cover rounded-sm shadow-sm" alt="flag"/> : "🏳️"}
                       <span>{team}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 relative z-10">
                      {hasWarning && !isSelected && !isLocked && (
                        <span className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity" title="בחרת אותה במקום 1/2">⚠️ סתירה</span>
                      )}
                      {isRealWinner && <span className="text-[10px] bg-purple-500 text-white px-2 py-0.5 rounded-full shadow-sm">העפילה</span>}
                      {isSelected ? (
                         <span className="w-6 h-6 flex items-center justify-center bg-white/20 rounded-full text-white text-xs">✓</span>
                      ) : !isLocked ? (
                         <span className="w-6 h-6 flex items-center justify-center bg-slate-800 rounded-full text-slate-500 text-lg group-hover:text-white transition-colors">+</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
         </div>
      </div>

      {/* --- חלון הריגול --- */}
      {showSpyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl relative">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><span>🕵️‍♂️</span> ריגול: 8 המעפילות מהמקום השלישי</h3>
              <button onClick={() => setShowSpyModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors font-bold">✕</button>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
              {isLoadingSpy ? (
                <div className="flex justify-center py-8 text-blue-400 animate-pulse font-bold">טוען ניחושים... ⏳</div>
              ) : spyData.length === 0 ? (
                <div className="text-center text-slate-500 py-8">אף אחד לא בחר נבחרות מהמקום השלישי</div>
              ) : (
                <div className="space-y-4">
                  {spyData.map((data, idx) => (
                    <div key={idx} className={`p-4 rounded-xl border transition-all ${data.userId === userId ? "bg-blue-900/10 border-blue-500/30" : "bg-slate-800 border-slate-700"}`}>
                      <div className="flex justify-between items-center mb-3">
                         <div className="font-bold text-white text-lg flex items-center gap-2">
                           {data.userName}
                           {data.userId === userId && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase">אתה</span>}
                         </div>
                         {data.points !== null && (
                           <div className={`text-sm font-black px-3 py-1 rounded-lg border ${data.points > 0 ? "bg-purple-500/20 text-purple-400 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]" : "bg-slate-900 text-slate-500 border-slate-700"}`}>
                             {data.points > 0 ? `+${data.points} נק'` : "0 נק'"}
                           </div>
                         )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                         {data.teams.map((t: string, i: number) => {
                           const isHit = realThirdPlace.includes(t);
                           return (
                             <span key={i} className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${isHit ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-slate-900 text-slate-300 border-slate-600"}`}>
                               {getFlagUrl(t) && <img src={getFlagUrl(t)!} className="w-4 h-3 object-cover rounded-sm" alt="flag"/>} 
                               {t} 
                               {isHit && "🎯"}
                             </span>
                           );
                         })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}