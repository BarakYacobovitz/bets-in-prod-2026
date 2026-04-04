"use client";
import { useState, useEffect, useRef } from "react";
import MatchCard from "./MatchCard";
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "../app/firebase";
import { getFlagUrl } from "../app/utils/flags";

const CountdownTimer = ({ targetDateStr }: { targetDateStr: string | undefined }) => {
  const [timeLeft, setTimeLeft] = useState("מחשב...");

  useEffect(() => {
    if (!targetDateStr) {
       setTimeLeft("טרם נקבע מועד");
       return;
    }
    let safeDateStr = targetDateStr;
    if (safeDateStr.includes('T') && safeDateStr.split(':').length === 2) {
      safeDateStr += ":00";
    }
    const targetDate = new Date(safeDateStr);
    if (isNaN(targetDate.getTime())) {
       setTimeLeft("טרם נקבע מועד");
       return;
    }

    const updateTimer = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft("הזמן תם! ממתין לנעילה...");
      } else {
         const d = Math.floor(diff / (1000 * 60 * 60 * 24));
         const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
         const m = Math.floor((diff / 1000 / 60) % 60);
         const s = Math.floor((diff / 1000) % 60);
         if (d > 0) setTimeLeft(`בעוד ${d} ימים ו-${h} שעות`);
         else setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    };

    updateTimer(); 
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetDateStr]);

  return <span className="font-mono text-amber-400 tracking-widest">{timeLeft}</span>;
};

export default function GroupsView({ matches, groups, userId, tournamentState }: any) {
  const groupNames = Object.keys(groups).sort();
  const [activeGroup, setActiveGroup] = useState(groupNames[0] || "A");
  const [viewMode, setViewMode] = useState<"MATCHES" | "QUALIFIERS">("MATCHES");
  
  const [deadlines, setDeadlines] = useState<any>({});
  
  const [qualifiers, setQualifiers] = useState<any>({});
  const [realQualifiers, setRealQualifiers] = useState<any>({}); 
  
  const [userMatchPredictions, setUserMatchPredictions] = useState<any>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isRandomizing, setIsRandomizing] = useState(false);
  
  const [showSpyModal, setShowSpyModal] = useState(false);
  const [spyData, setSpyData] = useState<any[]>([]);
  const [isLoadingSpy, setIsLoadingSpy] = useState(false);

  // --- סטייטים חדשים לריגול ---
  const [spySearchQuery, setSpySearchQuery] = useState("");
  const [spyFilter, setSpyFilter] = useState<"ALL" | "EXACT" | "PARTIAL" | "MISS">("ALL");

  const isLoaded = useRef(false);
  const isUserAction = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const qSnap = await getDoc(doc(db, "predictions_qualifiers", userId));
        if (qSnap.exists()) setQualifiers(qSnap.data().groups || {});
        
        const rSnap = await getDoc(doc(db, "admin_results", "qualifiers"));
        if (rSnap.exists()) setRealQualifiers(rSnap.data().results || {});

      } catch (e) { console.error(e); } 
      finally { isLoaded.current = true; }
    };
    
    if (userId) {
      fetchData();
      const unsubSys = onSnapshot(doc(db, "settings", "system"), (docSnap) => {
        if (docSnap.exists()) setDeadlines(docSnap.data().deadlines || {});
      });
      const qMatches = query(collection(db, "predictions_matches"), where("userId", "==", userId));
      const unsubscribe = onSnapshot(qMatches, (snapshot) => {
        const matchPreds: any = {};
        snapshot.forEach(document => {
           const data = document.data();
           if (data.predictedHomeScore !== "" && data.predictedAwayScore !== "") {
               matchPreds[data.matchId] = true;
           }
        });
        setUserMatchPredictions(matchPreds);
      });

      return () => { unsubscribe(); unsubSys(); }; 
    }
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
      } catch (e) { setSaveStatus("idle"); }
    }, 800);
    return () => clearTimeout(timer);
  }, [qualifiers, userId]);

  const handleQualifierSelect = (groupName: string, selectedTeam: string, place: 'first' | 'second') => {
    isUserAction.current = true;
    setQualifiers((prev: any) => {
      const currentGroup = prev[groupName] || { first: "", second: "" };
      const newGroup = { ...currentGroup };
      if (place === 'first') {
        if (newGroup.first === selectedTeam) newGroup.first = ""; 
        else { newGroup.first = selectedTeam; if (newGroup.second === selectedTeam) newGroup.second = ""; }
      } else {
        if (newGroup.second === selectedTeam) newGroup.second = ""; 
        else { newGroup.second = selectedTeam; if (newGroup.first === selectedTeam) newGroup.first = ""; }
      }
      return { ...prev, [groupName]: newGroup };
    });
  };

  const getGroupProgress = (gName: string) => {
    const gMatches = matches.filter((m: any) => m.group === gName);
    if (gMatches.length === 0) return 0;
    const predictedMatches = gMatches.filter((m: any) => userMatchPredictions[m.id]).length;
    const hasFirst = qualifiers[gName]?.first ? 1 : 0;
    const hasSecond = qualifiers[gName]?.second ? 1 : 0;
    const totalTasks = gMatches.length + 2; 
    const completedTasks = predictedMatches + hasFirst + hasSecond;
    return Math.round((completedTasks / totalTasks) * 100);
  };

  const currentIndex = groupNames.indexOf(activeGroup);
  const handlePrevGroup = () => {
    const prevIndex = currentIndex === 0 ? groupNames.length - 1 : currentIndex - 1;
    setActiveGroup(groupNames[prevIndex]);
    setViewMode("MATCHES");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleNextGroup = () => {
    const nextIndex = currentIndex === groupNames.length - 1 ? 0 : currentIndex + 1;
    setActiveGroup(groupNames[nextIndex]);
    setViewMode("MATCHES");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeMatches = matches.filter((m: any) => m.group === activeGroup);
  const activeTeams = groups[activeGroup] ? Array.from(groups[activeGroup]) : [];
  const isQualifiersLocked = tournamentState >= 1;

  const calculateGroupQualifiersPoints = (userGrp: any, realGrp: any) => {
    if (!realGrp || (!realGrp.first && !realGrp.second)) return null;
    let points = 0;
    if (userGrp?.first) {
      if (userGrp.first === realGrp.first) points += 15;
      else if (userGrp.first === realGrp.second) points += 7;
    }
    if (userGrp?.second) {
      if (userGrp.second === realGrp.second) points += 15;
      else if (userGrp.second === realGrp.first) points += 7;
    }
    return points;
  };

  const handleOpenSpy = async () => {
    setShowSpyModal(true);
    setSpySearchQuery("");
    setSpyFilter("ALL");
    setIsLoadingSpy(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers: any[] = [];
      usersSnap.forEach(doc => allUsers.push({ id: doc.id, ...doc.data() }));

      // חישוב המיקום (Rank) הכללי של כל משתמש
      allUsers.sort((a, b) => (Number(b.totalPoints) || 0) - (Number(a.totalPoints) || 0));
      let currentRank = 1;
      const usersMap: any = {}; 
      allUsers.forEach((u, i) => {
        if (i > 0 && (Number(u.totalPoints) || 0) < (Number(allUsers[i - 1].totalPoints) || 0)) {
          currentRank = i + 1;
        }
        usersMap[u.id] = {
          name: u.name || "שחקן לא ידוע",
          totalPoints: Number(u.totalPoints) || 0,
          rank: currentRank 
        }; 
      });

      const qSnap = await getDocs(collection(db, "predictions_qualifiers"));
      const gathered: any[] = [];
      const realGrp = realQualifiers[activeGroup];

      qSnap.forEach(doc => {
        const data = doc.data().groups?.[activeGroup];
        if (data && (data.first || data.second)) {
          gathered.push({
            userId: doc.id,
            userName: usersMap[doc.id]?.name || "משתמש",
            userTotalPoints: usersMap[doc.id]?.totalPoints || 0,
            userRank: usersMap[doc.id]?.rank || 999,
            first: data.first || "-",
            second: data.second || "-",
            points: calculateGroupQualifiersPoints(data, realGrp)
          });
        }
      });
      gathered.sort((a, b) => b.userTotalPoints - a.userTotalPoints);
      setSpyData(gathered);
    } catch (e) { console.error(e); } 
    finally { setIsLoadingSpy(false); }
  };

  const handleRandomizeGroup = async () => {
    if (!confirm(`להגריל תוצאות אקראיות לכל משחקי בית ${activeGroup} (שעדיין פתוחים)?`)) return;
    setIsRandomizing(true);
    try {
       const batchPromises = activeMatches.map(async (m: any) => {
          const md = Number(m.matchday) || 1;
          let locked = false;
          if (md === 1 && tournamentState >= 1) locked = true;
          if (md === 2 && tournamentState >= 2) locked = true;
          if (md === 3 && tournamentState >= 3) locked = true;

          if (!locked) {
             const pHome = Math.floor(Math.random() * 4).toString();
             const pAway = Math.floor(Math.random() * 4).toString();
             const docRef = doc(db, "predictions_matches", `${userId}_${m.id}`);
             return setDoc(docRef, { userId, matchId: m.id, groupId: m.group, predictedHomeScore: pHome, predictedAwayScore: pAway, updatedAt: new Date() }, { merge: true });
          }
       });
       await Promise.all(batchPromises);

       if (!isQualifiersLocked && activeTeams.length >= 2) {
          const shuffled = [...activeTeams].sort(() => 0.5 - Math.random());
          const newQuals = { ...qualifiers, [activeGroup]: { first: shuffled[0], second: shuffled[1] } };
          setQualifiers(newQuals);
          await setDoc(doc(db, "predictions_qualifiers", userId), { groups: newQuals, updatedAt: new Date() }, { merge: true });
       }
    } catch(e) { console.error(e); }
    finally { setIsRandomizing(false); }
  };

  const renderMatchday = (title: string, matchdayMatches: any[], isLocked: boolean, dayIndex: number) => {
    if (matchdayMatches.length === 0) return null;
    const predictedCount = matchdayMatches.filter(m => userMatchPredictions[m.id]).length;
    const totalCount = matchdayMatches.length;
    const isComplete = predictedCount === totalCount && totalCount > 0;
    const dlKey = `md${dayIndex}`;
    const lockTimeStr = deadlines[dlKey];

    return (
      <div className="space-y-4 pt-4 mb-8">
        <div className="flex justify-between items-center bg-slate-800/30 p-2.5 rounded-xl border border-slate-700/50">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-300">{title}</h3>
            {isLocked ? (
              <span className="bg-rose-500/10 text-rose-400 text-[10px] px-1.5 py-0.5 rounded font-bold border border-rose-500/30">🔒 נעול</span>
            ) : (
              <span className="text-amber-500 text-[10px] font-bold">
                ⏳ ננעל: <CountdownTimer targetDateStr={lockTimeStr} />
              </span>
            )}
          </div>
          <div className={`text-xs font-bold px-2 py-1 rounded-md border transition-colors duration-300 ${isComplete ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-slate-900 text-slate-400 border-slate-700"}`}>
            {predictedCount}/{totalCount}
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {matchdayMatches.map(match => <MatchCard key={match.id} match={match} userId={userId} tournamentState={tournamentState} />)}
        </div>
      </div>
    );
  };

  const myQualPoints = calculateGroupQualifiersPoints(qualifiers[activeGroup], realQualifiers[activeGroup]);

  // --- סינון וריגול ---
  const hasTruth = !!(realQualifiers[activeGroup]?.first || realQualifiers[activeGroup]?.second);
  const spyStats = { exact: 0, partial: 0, miss: 0 };
  
  if (hasTruth) {
    spyData.forEach(d => {
      if (d.points === 30) spyStats.exact++; // בול בשתיהן (15+15)
      else if (d.points && d.points > 0) spyStats.partial++;
      else spyStats.miss++;
    });
  }

  const filteredSpyData = spyData.filter(d => {
    if (!d.userName.toLowerCase().includes(spySearchQuery.toLowerCase())) return false;
    if (hasTruth && spyFilter !== "ALL") {
      if (spyFilter === "EXACT" && d.points !== 30) return false;
      if (spyFilter === "PARTIAL" && (!d.points || d.points === 30 || d.points === 0)) return false;
      if (spyFilter === "MISS" && d.points && d.points > 0) return false;
    }
    return true;
  });

  return (
    <div className="w-full animate-fade-in-up pb-8">
      
      {/* 1. ניווט חצים וכותרת הבית */}
      <div className="flex flex-col items-center mb-6 gap-4 w-full">
         <div className="flex items-center justify-between w-full max-w-sm mx-auto bg-slate-900/80 p-2 rounded-2xl border border-slate-800 shadow-md backdrop-blur-md">
            <button onClick={handlePrevGroup} className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 active:scale-95">
               <span className="text-xl leading-none">▶</span>
            </button>
            <div className="flex flex-col items-center justify-center flex-1">
               <h2 className="text-3xl font-black text-white flex items-center gap-2">
                 בית {activeGroup}
               </h2>
               {getGroupProgress(activeGroup) === 100 ? (
                  <span className="text-[11px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold border border-emerald-500/30 shadow-sm mt-1">✓ הושלם</span>
               ) : (
                  <span className="text-[11px] text-slate-400 font-bold mt-1">הושלם {getGroupProgress(activeGroup)}%</span>
               )}
            </div>
            <button onClick={handleNextGroup} className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 active:scale-95">
               <span className="text-xl leading-none">◀</span>
            </button>
         </div>

         <div className="flex items-center justify-center gap-4">
            {tournamentState < 3 && viewMode === "MATCHES" && (
               <button 
                  onClick={handleRandomizeGroup} 
                  disabled={isRandomizing}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-1.5 px-3 rounded-lg border border-slate-600 flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
               >
                 <span>🎲</span> הגרל הכל
               </button>
            )}
            <div className="h-5 flex items-center">
              {saveStatus === "saving" && <span className="text-amber-400 text-xs font-bold">⏳ שומר...</span>}
              {saveStatus === "saved" && <span className="text-emerald-400 text-xs font-bold">✓ נשמר</span>}
            </div>
         </div>
      </div>

      {/* 2. המתג המרכזי: משחקים vs עולות */}
      <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 mb-8 max-w-sm mx-auto shadow-inner">
         <button 
           onClick={() => setViewMode("MATCHES")} 
           className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${viewMode === "MATCHES" ? "bg-blue-600 text-white shadow-md transform scale-[1.02]" : "text-slate-400 hover:text-white"}`}
         >
           <span>⚽</span> משחקים
         </button>
         <button 
           onClick={() => setViewMode("QUALIFIERS")} 
           className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${viewMode === "QUALIFIERS" ? "bg-purple-600 text-white shadow-md transform scale-[1.02]" : "text-slate-400 hover:text-white"}`}
         >
           <span>🥇</span> מי תעפיל?
         </button>
      </div>
      
      {viewMode === "MATCHES" && (
         <div className="animate-fade-in-up">
            {renderMatchday("מחזור 1", activeMatches.filter((m: any) => (m.matchday || 1) === 1), tournamentState >= 1, 1)}
            {renderMatchday("מחזור 2", activeMatches.filter((m: any) => m.matchday === 2), tournamentState >= 2, 2)}
            {renderMatchday("מחזור 3", activeMatches.filter((m: any) => m.matchday === 3), tournamentState >= 3, 3)}
            
            <div className="mt-8 pt-6 border-t border-slate-800/50 flex justify-center">
               <button 
                 onClick={() => {
                   window.scrollTo({ top: 0, behavior: 'smooth' });
                   setViewMode("QUALIFIERS");
                 }} 
                 className="bg-purple-900/30 hover:bg-purple-600 text-purple-300 hover:text-white px-6 py-3 rounded-xl font-bold transition-colors border border-purple-500/30 flex items-center gap-2 active:scale-95"
               >
                 המשך לבחירת העולות מבית {activeGroup} <span>➡️</span>
               </button>
            </div>
         </div>
      )}

      {viewMode === "QUALIFIERS" && (
         <div className={`bg-slate-800 p-6 rounded-3xl border-t-4 border-t-purple-500 border border-slate-700 shadow-xl relative overflow-hidden transition-all animate-fade-in-up ${isQualifiersLocked && myQualPoints === null ? "opacity-80 grayscale-[10%]" : ""}`}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-2xl font-bold text-white mb-1">דירוג סופי בבית {activeGroup}</h3>
              <p className="text-slate-400 text-sm mb-6">בחר את זהות המעפילות מהבית. {isQualifiersLocked ? "" : <span className="text-rose-400">(ננעל בשריקת הפתיחה)</span>}</p>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              {isQualifiersLocked && myQualPoints === null && <span className="bg-rose-500/10 text-rose-400 text-xs font-bold px-3 py-1.5 rounded-full border border-rose-500/30 shadow-sm">🔒 נעול</span>}
              {myQualPoints !== null && (
                 <div className={`px-4 py-2 rounded-xl text-sm font-black border shadow-lg ${myQualPoints > 0 ? "bg-purple-600/20 text-purple-400 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]" : "bg-slate-900 text-slate-500 border-slate-700"}`}>
                   {myQualPoints > 0 ? `🎯 סה"כ ניקוד: +${myQualPoints}` : "0 נקודות"}
                 </div>
              )}
            </div>
          </div>
          
          <div className="space-y-3">
            {activeTeams.map((team: any) => {
              const isFirst = qualifiers[activeGroup]?.first === team;
              const isSecond = qualifiers[activeGroup]?.second === team;
              
              const realFirst = realQualifiers[activeGroup]?.first;
              const realSecond = realQualifiers[activeGroup]?.second;
              let teamFeedback = null;

              if (realFirst || realSecond) {
                if (isFirst && realFirst === team) teamFeedback = <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">+15 נק'</span>;
                else if (isFirst && realSecond === team) teamFeedback = <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded border border-purple-500/30">+7 נק'</span>;
                else if (isSecond && realSecond === team) teamFeedback = <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">+15 נק'</span>;
                else if (isSecond && realFirst === team) teamFeedback = <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded border border-purple-500/30">+7 נק'</span>;
                else if (realFirst === team || realSecond === team) teamFeedback = <span className="text-[10px] bg-slate-900 text-slate-500 px-2 py-0.5 rounded border border-slate-700">עלתה</span>;
              }
              
              return (
                <div key={team} className={`flex justify-between items-center p-3 rounded-xl border transition-all ${isFirst ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : isSecond ? 'bg-slate-300/10 border-slate-300/50 shadow-sm' : 'bg-slate-900/50 border-slate-700'}`}>
                  
                  <div className="flex items-center gap-2.5">
                    {getFlagUrl(team) ? <img src={getFlagUrl(team)!} className="w-5 h-3.5 object-cover rounded-sm shadow-sm" alt="flag" /> : <span>🏳️</span>}
                    <span className={`font-bold text-base ${isFirst ? 'text-amber-400' : isSecond ? 'text-slate-300' : 'text-white'}`}>{team}</span>
                    {teamFeedback}
                  </div>
                  
                  <div className="flex gap-1.5 shrink-0">
                    <button disabled={isQualifiersLocked} onClick={() => handleQualifierSelect(activeGroup, team, 'first')} className={`px-2 py-1.5 text-[11px] font-bold rounded-lg border transition-all ${isQualifiersLocked ? 'cursor-not-allowed opacity-60' : ''} ${isFirst ? 'bg-amber-500 text-slate-900 border-amber-500 shadow-md' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-amber-500/50 hover:text-amber-400'}`}>🥇 ראשון</button>
                    <button disabled={isQualifiersLocked} onClick={() => handleQualifierSelect(activeGroup, team, 'second')} className={`px-2 py-1.5 text-[11px] font-bold rounded-lg border transition-all ${isQualifiersLocked ? 'cursor-not-allowed opacity-60' : ''} ${isSecond ? 'bg-slate-300 text-slate-900 border-slate-300 shadow-md' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-300/50 hover:text-slate-300'}`}>🥈 שני</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 border-t border-slate-700/50 pt-4 flex flex-col md:flex-row justify-between gap-4">
             {isQualifiersLocked && (
               <button onClick={handleOpenSpy} className="flex-1 py-3 rounded-xl font-bold text-sm transition-all border flex items-center justify-center gap-2 bg-slate-900 text-slate-400 hover:text-white border-slate-700 hover:bg-slate-800">
                 <span>👁️</span> ריגול בית {activeGroup}
               </button>
             )}
             <button onClick={handleNextGroup} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold text-sm transition-all shadow-md flex justify-center items-center gap-2 active:scale-95">
               המשך לבית הבא <span>➡️</span>
             </button>
          </div>
        </div>
      )}

      {/* פופ-אפ הריגול המשודרג! */}
      {showSpyModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 p-5 md:p-6 rounded-3xl w-full max-w-md md:max-w-[600px] md:min-w-[400px] min-h-[500px] h-[85vh] md:h-[650px] md:max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden md:resize">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-800 shrink-0">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><span>🕵️‍♂️</span> ריגול עולות: בית {activeGroup}</h3>
              <button onClick={() => setShowSpyModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors font-bold border border-slate-700">✕</button>
            </div>

            {hasTruth && (
               <div className="bg-emerald-900/20 border border-emerald-500/30 p-3 rounded-xl mb-4 text-center shrink-0">
                 <div className="text-xs text-emerald-400 mb-1 font-bold">תוצאות אמת:</div>
                 <div className="text-sm text-white flex justify-center items-center gap-4 mt-2">
                   <span className="flex items-center gap-1.5">🥇 {getFlagUrl(realQualifiers[activeGroup].first) ? <img src={getFlagUrl(realQualifiers[activeGroup].first)!} className="w-4 h-3 object-cover rounded-sm" alt="flag"/> : ""} {realQualifiers[activeGroup].first || "-"}</span>
                   <span className="text-slate-600">|</span>
                   <span className="flex items-center gap-1.5">🥈 {getFlagUrl(realQualifiers[activeGroup].second) ? <img src={getFlagUrl(realQualifiers[activeGroup].second)!} className="w-4 h-3 object-cover rounded-sm" alt="flag"/> : ""} {realQualifiers[activeGroup].second || "-"}</span>
                 </div>
               </div>
            )}

            <div className="mb-4 shrink-0">
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
                <input 
                  type="text" 
                  placeholder="חפש חבר לליגה..." 
                  value={spySearchQuery}
                  onChange={(e) => setSpySearchQuery(e.target.value)}
                  className="w-full bg-slate-950 text-white placeholder-slate-500 rounded-xl py-2.5 pr-10 pl-4 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all shadow-inner"
                />
              </div>
            </div>

            {hasTruth && (
              <div className="grid grid-cols-2 md:flex md:justify-center gap-2 mb-4 shrink-0">
                <button onClick={() => setSpyFilter("ALL")} className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1 ${spyFilter === "ALL" ? "bg-slate-700 text-white border-slate-500 shadow-sm" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"}`}>
                  הכל ({spyData.length})
                </button>
                <button onClick={() => setSpyFilter("EXACT")} className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1.5 ${spyFilter === "EXACT" ? "bg-emerald-900/40 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.15)]" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"}`}>
                  🎯 בול כפול ({spyStats.exact})
                </button>
                <button onClick={() => setSpyFilter("PARTIAL")} className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1.5 ${spyFilter === "PARTIAL" ? "bg-amber-900/40 text-amber-400 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.1)]" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"}`}>
                  ✅ חלקי ({spyStats.partial})
                </button>
                <button onClick={() => setSpyFilter("MISS")} className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1.5 ${spyFilter === "MISS" ? "bg-rose-900/40 text-rose-400 border-rose-500/50 shadow-[0_0_10px_rgba(225,29,72,0.1)]" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"}`}>
                  ❌ נפילה ({spyStats.miss})
                </button>
              </div>
            )}

            <div className="overflow-y-auto custom-scrollbar flex-1 pl-2 md:pl-4 pr-1 pb-2">
              {isLoadingSpy ? (
                <div className="flex justify-center py-8 text-blue-400 animate-pulse font-bold">טוען ניחושים... ⏳</div>
              ) : filteredSpyData.length === 0 ? (
                <div className="text-center text-slate-500 py-8">לא נמצאו תוצאות לחיפוש זה.</div>
              ) : (
                <div className="space-y-3">
                  {filteredSpyData.map((data, idx) => {
                    let itemStyle = "flex flex-col p-3 rounded-xl border transition-all ";
                    if (hasTruth) {
                      if (data.points === 30) itemStyle += "bg-emerald-900/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]";
                      else if (data.points && data.points > 0) itemStyle += "bg-amber-900/10 border-amber-500/30";
                      else itemStyle += "bg-rose-900/10 border-rose-500/20 opacity-80";
                    } else {
                      itemStyle += data.userId === userId ? "bg-blue-900/10 border-blue-500/30" : "bg-slate-800 border-slate-700 hover:bg-slate-700";
                    }

                    return (
                      <div key={idx} className={itemStyle}>
                        <div className="flex justify-between items-center mb-2">
                           <div className="font-bold text-slate-200 flex items-center gap-2.5">
                             <div className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black border shrink-0 ${
                                data.userRank === 1 ? "bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.3)]" :
                                data.userRank === 2 ? "bg-slate-400/20 text-slate-300 border-slate-400/50 shadow-[0_0_8px_rgba(148,163,184,0.2)]" :
                                data.userRank === 3 ? "bg-orange-700/30 text-orange-400 border-orange-500/40 shadow-[0_0_8px_rgba(249,115,22,0.2)]" :
                                "bg-slate-600 text-white border-slate-500 shadow-sm"
                              }`}>
                                {data.userRank || "-"}
                              </div>
                             <span className="truncate max-w-[120px] sm:max-w-[160px]">{data.userName}</span>
                             {data.userId === userId && <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase">אתה</span>}
                           </div>
                           <div className="text-[10px] font-bold text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-700/50 shrink-0">
                             סה״כ: <span className="text-amber-400">{data.userTotalPoints} נק'</span>
                           </div>
                        </div>
                        <div className="flex gap-2 text-sm mt-1">
                           <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1.5 rounded flex-1 flex items-center justify-center gap-1.5">
                             🥇 {getFlagUrl(data.first) ? <img src={getFlagUrl(data.first)!} className="w-4 h-3 object-cover rounded-sm" alt="flag"/> : ""} {data.first}
                           </span>
                           <span className="bg-slate-300/10 text-slate-300 border border-slate-400/20 px-2 py-1.5 rounded flex-1 flex items-center justify-center gap-1.5">
                             🥈 {getFlagUrl(data.second) ? <img src={getFlagUrl(data.second)!} className="w-4 h-3 object-cover rounded-sm" alt="flag"/> : ""} {data.second}
                           </span>
                        </div>
                        {hasTruth && data.points !== null && (
                          <div className="mt-2 flex justify-center">
                             <div className={`text-xs font-black px-2 py-1 rounded ${data.points === 30 ? "bg-emerald-900/40 text-emerald-400 border border-emerald-500/50" : data.points > 0 ? "bg-amber-900/40 text-amber-400 border border-amber-500/50" : "bg-rose-950/50 text-rose-400 border border-rose-500/40"}`}>
                               {data.points > 0 ? `+${data.points} נק'` : "0 נק'"}
                             </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}