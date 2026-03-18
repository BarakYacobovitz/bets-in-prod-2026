"use client";
import { useState, useEffect, useRef } from "react";
import MatchCard from "./MatchCard";
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "../app/firebase";

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

export default function GroupsView({ matches, groups, userId, tournamentState }) {
  const groupNames = Object.keys(groups).sort();
  const [activeGroup, setActiveGroup] = useState(groupNames[0] || "A");
  const [deadlines, setDeadlines] = useState<any>({});
  
  const [qualifiers, setQualifiers] = useState<any>({});
  const [realQualifiers, setRealQualifiers] = useState<any>({}); 
  
  const [userMatchPredictions, setUserMatchPredictions] = useState<any>({});
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
    setQualifiers(prev => {
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
    const gMatches = matches.filter(m => m.group === gName);
    if (gMatches.length === 0) return 0;
    const predictedMatches = gMatches.filter(m => userMatchPredictions[m.id]).length;
    const hasFirst = qualifiers[gName]?.first ? 1 : 0;
    const hasSecond = qualifiers[gName]?.second ? 1 : 0;
    const totalTasks = gMatches.length + 2; 
    const completedTasks = predictedMatches + hasFirst + hasSecond;
    return Math.round((completedTasks / totalTasks) * 100);
  };

  const activeMatches = matches.filter(m => m.group === activeGroup);
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
    setIsLoadingSpy(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const usersMap: any = {};
      usersSnap.forEach(doc => { usersMap[doc.id] = doc.data().name || "שחקן לא ידוע"; });

      const qSnap = await getDocs(collection(db, "predictions_qualifiers"));
      const gathered: any[] = [];
      const realGrp = realQualifiers[activeGroup];

      qSnap.forEach(doc => {
        const data = doc.data().groups?.[activeGroup];
        if (data && (data.first || data.second)) {
          gathered.push({
            userId: doc.id,
            userName: usersMap[doc.id] || "משתמש",
            first: data.first || "-",
            second: data.second || "-",
            points: calculateGroupQualifiersPoints(data, realGrp)
          });
        }
      });
      gathered.sort((a, b) => a.userName.localeCompare(b.userName));
      setSpyData(gathered);
    } catch (e) { console.error(e); } 
    finally { setIsLoadingSpy(false); }
  };

  // 🎲 פונקציית הגרלת בית שלם
  const handleRandomizeGroup = async () => {
    if (!confirm(`להגריל תוצאות אקראיות לכל משחקי בית ${activeGroup} (שעדיין פתוחים)?`)) return;
    setIsRandomizing(true);
    try {
       // הגרלת משחקים פתוחים
       const batchPromises = activeMatches.map(async (m) => {
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

       // הגרלת עולות מהבית
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
      <div className="space-y-4 pt-6 border-t border-slate-800/50">
        <div className="flex flex-col md:flex-row justify-between items-center bg-slate-800/30 p-3 rounded-xl border border-slate-700/50 gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-slate-300">{title}</h3>
            {isLocked ? (
              <span className="bg-rose-500/10 text-rose-400 text-xs px-2 py-1 rounded font-bold border border-rose-500/30">🔒 נעול</span>
            ) : (
              <span className="bg-amber-500/10 text-amber-500 text-xs px-2 py-1 rounded font-bold border border-amber-500/30 flex items-center gap-1">
                ⏳ ננעל: <CountdownTimer targetDateStr={lockTimeStr} />
              </span>
            )}
          </div>
          <div className={`text-sm font-bold px-3 py-1.5 rounded-lg border flex items-center gap-2 transition-colors duration-300 ${isComplete ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"}`}>
            <span>הושלם {predictedCount}/{totalCount}</span>
            {isComplete && <span>✓</span>}
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {matchdayMatches.map(match => <MatchCard key={match.id} match={match} userId={userId} tournamentState={tournamentState} />)}
        </div>
      </div>
    );
  };

  const myQualPoints = calculateGroupQualifiersPoints(qualifiers[activeGroup], realQualifiers[activeGroup]);

  return (
    <div className="flex flex-col md:flex-row gap-8 w-full animate-fade-in-up">
      <div className="w-full md:w-64 shrink-0">
        <div className="bg-slate-900 rounded-3xl p-4 border border-slate-800 md:sticky md:top-24 shadow-xl">
          <h3 className="text-xl font-bold text-white mb-4 px-2 border-b border-slate-800 pb-2">בחירת בית</h3>
          <div className="flex flex-row md:flex-col gap-3 overflow-x-auto md:overflow-visible custom-scrollbar pb-2 md:pb-0">
            {groupNames.map(g => {
              const progress = getGroupProgress(g);
              const isComplete = progress === 100;
              return (
                <button
                  key={g}
                  onClick={() => setActiveGroup(g)}
                  className={`relative flex flex-col items-start p-4 rounded-xl font-bold transition-all min-w-[140px] md:min-w-0 overflow-hidden ${activeGroup === g ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"}`}
                >
                  <div className={`absolute top-0 right-0 h-full opacity-20 transition-all duration-500 ${isComplete ? "bg-emerald-400" : "bg-blue-400"}`} style={{ width: `${progress}%` }} />
                  <div className="flex justify-between items-center w-full relative z-10">
                    <span className="text-lg">בית {g}</span>
                    {isComplete && <span className="text-emerald-400">✓</span>}
                  </div>
                  <div className="text-xs font-normal mt-1 relative z-10 opacity-70">הושלם {progress}%</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4 gap-4">
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">משחקי בית {activeGroup}</h2>
          
          <div className="flex items-center gap-4">
            {/* כפתור הגרלת הבית */}
            {tournamentState < 3 && (
               <button 
                  onClick={handleRandomizeGroup} 
                  disabled={isRandomizing}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-bold py-2 px-4 rounded-xl border border-slate-600 flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
               >
                 <span className="text-xl">🎲</span> {isRandomizing ? "מגריל..." : "הגרל בית"}
               </button>
            )}
            <div className="h-6">
              {saveStatus === "saving" && <span className="text-amber-400 text-sm animate-pulse">⏳ שומר...</span>}
              {saveStatus === "saved" && <span className="text-emerald-400 text-sm">✓ נשמר</span>}
            </div>
          </div>
        </div>

        {renderMatchday("מחזור 1", activeMatches.filter(m => (m.matchday || 1) === 1), tournamentState >= 1, 1)}
        {renderMatchday("מחזור 2", activeMatches.filter(m => m.matchday === 2), tournamentState >= 2, 2)}
        {renderMatchday("מחזור 3", activeMatches.filter(m => m.matchday === 3), tournamentState >= 3, 3)}

        <div className={`mt-12 bg-slate-800 p-4 md:p-6 rounded-3xl border-t-4 border-t-emerald-500 border-l border-r border-b border-slate-700 shadow-xl relative overflow-hidden transition-all ${isQualifiersLocked && myQualPoints === null ? "opacity-80 grayscale-[10%]" : ""}`}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-2xl font-bold text-emerald-400 mb-1">מי יעפיל מבית {activeGroup}?</h3>
              <p className="text-slate-400 text-sm mb-6">בחר נבחרת למקום הראשון ואחת למקום השני. {isQualifiersLocked ? "" : <span className="text-rose-400">(ננעל בשריקת הפתיחה!)</span>}</p>
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
            {activeTeams.map(team => {
              const isFirst = qualifiers[activeGroup]?.first === team;
              const isSecond = qualifiers[activeGroup]?.second === team;
              
              const realFirst = realQualifiers[activeGroup]?.first;
              const realSecond = realQualifiers[activeGroup]?.second;
              let teamFeedback = null;

              if (realFirst || realSecond) {
                if (isFirst && realFirst === team) teamFeedback = <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded border border-emerald-500/30">+15 נק' (מקום מדויק)</span>;
                else if (isFirst && realSecond === team) teamFeedback = <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded border border-purple-500/30">+7 נק' (מקום הפוך)</span>;
                else if (isSecond && realSecond === team) teamFeedback = <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded border border-emerald-500/30">+15 נק' (מקום מדויק)</span>;
                else if (isSecond && realFirst === team) teamFeedback = <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded border border-purple-500/30">+7 נק' (מקום הפוך)</span>;
                else if (realFirst === team || realSecond === team) teamFeedback = <span className="text-xs bg-slate-900 text-slate-500 px-2 py-1 rounded border border-slate-700">עלתה בפועל</span>;
              }
              
              return (
                <div key={team} className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-3 p-3 md:p-4 rounded-xl border transition-all ${isFirst ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : isSecond ? 'bg-slate-300/10 border-slate-300/50 shadow-sm' : 'bg-slate-900/50 border-slate-700'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold text-lg md:text-xl ${isFirst ? 'text-amber-400' : isSecond ? 'text-slate-300' : 'text-white'}`}>{team}</span>
                    {teamFeedback}
                  </div>
                  
                  <div className="flex gap-2 w-full md:w-auto">
                    <button disabled={isQualifiersLocked} onClick={() => handleQualifierSelect(activeGroup, team, 'first')} className={`flex-1 md:flex-none px-3 py-2 text-xs md:text-sm font-bold rounded-lg border transition-all ${isQualifiersLocked ? 'cursor-not-allowed opacity-60' : ''} ${isFirst ? 'bg-amber-500 text-slate-900 border-amber-500 shadow-md' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-amber-500/50 hover:text-amber-400'}`}>🥇 מקום 1</button>
                    <button disabled={isQualifiersLocked} onClick={() => handleQualifierSelect(activeGroup, team, 'second')} className={`flex-1 md:flex-none px-3 py-2 text-xs md:text-sm font-bold rounded-lg border transition-all ${isQualifiersLocked ? 'cursor-not-allowed opacity-60' : ''} ${isSecond ? 'bg-slate-300 text-slate-900 border-slate-300 shadow-md' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-300/50 hover:text-slate-300'}`}>🥈 מקום 2</button>
                  </div>
                </div>
              );
            })}
          </div>

          {isQualifiersLocked && (
            <div className="mt-6 border-t border-slate-700/50 pt-4">
              <button onClick={handleOpenSpy} className="w-full py-3 rounded-xl font-bold text-sm transition-all border flex items-center justify-center gap-2 bg-slate-900 text-slate-400 hover:text-white border-slate-700 hover:bg-slate-800">
                <span>👁️</span> ריגול: מי ניחש אילו עולות בבית {activeGroup}?
              </button>
            </div>
          )}
        </div>

      </div>

      {showSpyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl relative">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><span>🕵️‍♂️</span> ריגול עולות: בית {activeGroup}</h3>
              <button onClick={() => setShowSpyModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors font-bold">✕</button>
            </div>

            {realQualifiers[activeGroup] && (realQualifiers[activeGroup].first || realQualifiers[activeGroup].second) && (
               <div className="bg-emerald-900/20 border border-emerald-500/30 p-3 rounded-xl mb-4 text-center">
                 <div className="text-xs text-emerald-400 mb-1 font-bold">תוצאות אמת:</div>
                 <div className="text-sm text-white">🥇 {realQualifiers[activeGroup].first || "-"} | 🥈 {realQualifiers[activeGroup].second || "-"}</div>
               </div>
            )}

            <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
              {isLoadingSpy ? (
                <div className="flex justify-center py-8 text-blue-400 animate-pulse font-bold">טוען ניחושים... ⏳</div>
              ) : spyData.length === 0 ? (
                <div className="text-center text-slate-500 py-8">אף אחד לא מילא ניחוש לבית זה</div>
              ) : (
                <div className="space-y-2">
                  {spyData.map((data, idx) => (
                    <div key={idx} className={`flex flex-col p-3 rounded-xl border transition-all ${data.userId === userId ? "bg-blue-900/10 border-blue-500/30" : "bg-slate-800 border-slate-700"}`}>
                      <div className="flex justify-between items-center mb-2">
                         <div className="font-medium text-white flex items-center gap-2">
                           {data.userName}
                           {data.userId === userId && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase">אתה</span>}
                         </div>
                         {data.points !== null && (
                           <div className={`text-xs font-black px-2 py-1 rounded ${data.points > 0 ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "bg-slate-900 text-slate-500 border border-slate-700"}`}>
                             {data.points > 0 ? `+${data.points} נק'` : "0 נק'"}
                           </div>
                         )}
                      </div>
                      <div className="flex gap-2 text-sm">
                         <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded flex-1 text-center">🥇 {data.first}</span>
                         <span className="bg-slate-300/10 text-slate-300 border border-slate-400/20 px-2 py-1 rounded flex-1 text-center">🥈 {data.second}</span>
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