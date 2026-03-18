"use client";
import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../app/firebase";
import toast from "react-hot-toast";

export default function ThirdPlaceQualifiers({ groups, userId, tournamentState = 0 }) {
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
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

  const toggleTeam = (team: string, groupName: string) => {
    if (isLocked) return;
    isUserAction.current = true;
    
    if (selectedTeams.includes(team)) {
      setSelectedTeams(prev => prev.filter(t => t !== team));
    } else {
      if (selectedTeams.length >= 8) {
        toast.error("כבר בחרת 8 נבחרות! בטל בחירה קיימת כדי לבחור אחרת.");
        return;
      }
      const teamsInThisGroup = Array.from(groups[groupName]);
      const alreadySelectedFromGroup = selectedTeams.find(t => teamsInThisGroup.includes(t));
      
      if (alreadySelectedFromGroup) {
        setSelectedTeams(prev => [...prev.filter(t => t !== alreadySelectedFromGroup), team]);
      } else {
        setSelectedTeams(prev => [...prev, team]);
      }
    }
  };

  const isLocked = tournamentState >= 1;

  // 🎲 פונקציית הגרלת 8 המעפילות החכמה
  const handleRandomizeThirdPlace = async () => {
    if (isLocked) return;
    if (!confirm("להגריל 8 נבחרות אקראיות מתוך הבתים השונים?")) return;
    setIsRandomizing(true);
    isUserAction.current = true;
    
    try {
      const allGroupNames = Object.keys(groups);
      // מגרילים 8 בתים מתוך ה-12
      const shuffledGroups = [...allGroupNames].sort(() => 0.5 - Math.random()).slice(0, 8);
      
      const newSelectedTeams: string[] = [];
      shuffledGroups.forEach(gName => {
        const teamsInGroup = Array.from(groups[gName] as Set<string>);
        if (teamsInGroup.length > 0) {
          const randomTeam = teamsInGroup[Math.floor(Math.random() * teamsInGroup.length)];
          newSelectedTeams.push(randomTeam);
        }
      });

      setSelectedTeams(newSelectedTeams);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRandomizing(false);
    }
  };

  const calculateUserPoints = (userTeams: string[]) => {
    if (realThirdPlace.length === 0) return null;
    let pts = 0;
    userTeams.forEach(t => {
      if (realThirdPlace.includes(t)) pts += 10;
    });
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

  const myPoints = calculateUserPoints(selectedTeams);

  return (
    <div className="w-full">
      <div className="bg-slate-900/80 p-8 rounded-3xl border border-teal-500/30 mb-8 shadow-2xl relative">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-4">
          <div className="flex-1">
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400 mb-2">
              8 המעפילות מהמקום השלישי
            </h2>
            <p className="text-slate-400 mb-2">בחר את 8 הנבחרות שלדעתך יעפילו לשלב הבא מהמקום השלישי בבית שלהן.</p>
            <p className="text-amber-400 text-sm font-bold bg-amber-500/10 inline-block px-3 py-1 rounded border border-amber-500/20">שים לב: ניתן לבחור לכל היותר נבחרת אחת מכל בית.</p>
          </div>
          
          <div className="flex items-center gap-6">
            {myPoints !== null && (
              <div className={`text-center px-6 py-3 rounded-2xl border shadow-lg ${myPoints > 0 ? "bg-purple-600/20 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.2)]" : "bg-slate-800 border-slate-700"}`}>
                 <div className="text-sm text-slate-400 font-bold mb-1">ניקוד צבור</div>
                 <div className={`text-3xl font-black ${myPoints > 0 ? "text-purple-400" : "text-slate-500"}`}>{myPoints > 0 ? `+${myPoints}` : "0"}</div>
              </div>
            )}
            <div className="text-center bg-slate-800 p-4 rounded-2xl border border-slate-700">
               <div className="text-4xl font-black text-teal-400">{selectedTeams.length}/8</div>
               <div className="text-xs text-slate-500 mt-1 font-bold uppercase tracking-widest">נבחרו</div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-6">
          {!isLocked && (
            <button 
              onClick={handleRandomizeThirdPlace} 
              disabled={isRandomizing}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold px-5 py-2.5 rounded-xl border border-slate-600 flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
            >
              <span className="text-xl">🎲</span> {isRandomizing ? "מגריל..." : "הגרל 8 מעפילות"}
            </button>
          )}
          {isLocked && (
            <div className="bg-rose-500/10 text-rose-400 text-sm font-bold px-4 py-2.5 rounded-xl border border-rose-500/30">
              🔒 שלב זה נעול לעריכה
            </div>
          )}
          {isLocked && (
            <button onClick={handleOpenSpy} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-5 py-2.5 rounded-xl border border-slate-600 flex items-center gap-2 transition-colors shadow-sm">
              <span>👁️</span> ריגול: מי ניחש מה?
            </button>
          )}
        </div>
        
        <div className="absolute bottom-4 left-6 h-6">
          {saveStatus === "saving" && <span className="text-amber-400 text-sm animate-pulse font-bold">⏳ שומר...</span>}
          {saveStatus === "saved" && <span className="text-emerald-400 text-sm font-bold">✓ נשמר</span>}
        </div>
      </div>

      {realThirdPlace.length > 0 && (
         <div className="mb-8 bg-purple-900/20 border border-purple-500/30 p-6 rounded-3xl">
           <h3 className="text-purple-400 font-bold mb-4">🏆 העפילו בפועל (תוצאות אמת):</h3>
           <div className="flex flex-wrap gap-3">
             {realThirdPlace.map(t => (
                <span key={t} className={`px-4 py-2 rounded-xl text-sm font-bold border ${selectedTeams.includes(t) ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "bg-slate-800 text-slate-300 border-slate-700"}`}>
                  {t} {selectedTeams.includes(t) && "🎯 +10"}
                </span>
             ))}
           </div>
         </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Object.keys(groups).sort().map(groupName => {
          const teams = Array.from(groups[groupName] as Set<string>);
          const selectedInGroup = selectedTeams.find(t => teams.includes(t));
          
          return (
            <div key={groupName} className={`bg-slate-800 rounded-2xl p-5 border transition-all ${selectedInGroup ? "border-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.15)] bg-teal-900/10" : "border-slate-700"} ${isLocked && myPoints === null ? "opacity-80 grayscale-[10%]" : ""}`}>
              <h3 className="text-lg font-bold text-center text-slate-300 mb-4 pb-2 border-b border-slate-700/50">
                בית {groupName}
              </h3>
              <div className="flex flex-col gap-2">
                {teams.map(team => {
                  const isSelected = selectedTeams.includes(team);
                  const isRealWinner = realThirdPlace.includes(team);
                  
                  let btnStyle = "bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white";
                  if (isSelected) btnStyle = "bg-teal-600 text-white border-teal-500 shadow-md";
                  if (isLocked && !isSelected) btnStyle = "bg-slate-900/50 text-slate-500 border-slate-800 cursor-not-allowed";

                  return (
                    <button
                      key={team}
                      disabled={isLocked}
                      onClick={() => toggleTeam(team, groupName)}
                      className={`py-3 px-4 rounded-xl font-bold transition-all text-sm w-full text-right flex justify-between items-center border ${btnStyle} relative overflow-hidden`}
                    >
                      <span className="relative z-10">{team}</span>
                      <div className="flex items-center gap-2 relative z-10">
                        {isRealWinner && <span className="text-[10px] bg-purple-500 text-white px-2 py-0.5 rounded-full shadow-sm">העפילה</span>}
                        {isSelected && <span>✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* מודל ריגול */}
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
                      <div className="flex flex-wrap gap-2">
                         {data.teams.map((t: string, i: number) => {
                           const isHit = realThirdPlace.includes(t);
                           return (
                             <span key={i} className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${isHit ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-slate-900 text-slate-300 border-slate-600"}`}>
                               {t} {isHit && "🎯"}
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