"use client";
import { useState, useEffect, useRef } from "react";
import MatchCard from "./MatchCard";
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "../app/firebase";
import { getFlagUrl } from "../app/utils/flags";
import toast from "react-hot-toast";


export default function GroupsView({ matches, groups, userId, tournamentState }: any) {
  const groupNames = Object.keys(groups).sort();
  
  // פונקציה חכמה שבודקת אם המשתמש נשלח לבית ספציפי מהדשבורד
  // 1. פונקציית אתחול חכמה לבית - יודעת לחלץ את הבית גם מתוך מזהה משחק!
// פונקציה חכמה שבודקת אם המשתמש נשלח לבית ספציפי מהדשבורד
  const getInitialGroup = () => {
    if (typeof window !== "undefined") {
      // 1. עדיפות ראשונה: אם הגענו מפיד מעפילות או פיד משחקים מעודכן
      const targetGroup = sessionStorage.getItem("targetGroup");
      const scrollToMatchId = sessionStorage.getItem("scrollToMatch");
      
      // הגנה: אם לחצנו על משחק בפיד, נוודא שהבית שלו תואם למה שיש במשחק בפועל (עוקף זיכרון מלוכלך)
      if (scrollToMatchId && matches) {
        const targetMatch = matches.find((m: any) => m.id === scrollToMatchId);
        if (targetMatch && targetMatch.group && groupNames.includes(targetMatch.group)) {
          return targetMatch.group;
        }
      }

      if (targetGroup && groupNames.includes(targetGroup)) return targetGroup;
    }
    return groupNames[0] || "A";
  };
  

// 2. פונקציית אתחול חכמה למצב התצוגה (משחקים או מעפילות)
const getInitialViewMode = () => {
  if (typeof window !== "undefined") {
    const savedMode = sessionStorage.getItem("groupsViewMode");
    if (savedMode === "MATCHES" || savedMode === "QUALIFIERS") return savedMode;
  }
  return "MATCHES";
};

// עדכון ה-States שישתמשו בפונקציות החדשות:
const [activeGroup, setActiveGroup] = useState(getInitialGroup());
const [viewMode, setViewMode] = useState<"MATCHES" | "QUALIFIERS">(getInitialViewMode());
useEffect(() => {
  const matchId = sessionStorage.getItem("scrollToMatch");
  if (matchId) {
    // נותנים ל-DOM חלקיק שנייה להתרנדר עם הבית החדש
    setTimeout(() => {
      const element = document.getElementById(`match-${matchId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        
        // מנקים את הסשן כדי שבמעברים הבאים הדף לא יקפוץ סתם
        sessionStorage.removeItem("scrollToMatch");
        sessionStorage.removeItem("targetMatchday");
        sessionStorage.removeItem("targetGroup");
        sessionStorage.removeItem("groupsViewMode");
      }
    }, 400);
  }
}, [activeGroup, viewMode]);
  // הוסף את השורות האלו כאן:
  const [localTournamentState, setLocalTournamentState] = useState(tournamentState);

  useEffect(() => {
    const unsubSys = onSnapshot(doc(db, "settings", "system"), (docSnap) => {
      if (docSnap.exists()) {
        setLocalTournamentState(Number(docSnap.data().tournamentState) || 0);
      }
    });
    return () => unsubSys();
  }, []);
  const [qualifiers, setQualifiers] = useState<any>({});
  const [realQualifiers, setRealQualifiers] = useState<any>({}); 
  
  const [userMatchPredictions, setUserMatchPredictions] = useState<any>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isRandomizing, setIsRandomizing] = useState(false);
  
  const [showSpyModal, setShowSpyModal] = useState(false);
  const [spyData, setSpyData] = useState<any[]>([]);
  const [isLoadingSpy, setIsLoadingSpy] = useState(false);

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
      const qMatches = query(collection(db, "predictions_matches"), where("userId", "==", userId));
      const unsubscribe = onSnapshot(qMatches, (snapshot) => {
        const matchPreds: any = {};
        snapshot.forEach(document => {
           const data = document.data();
           if (data.predictedHomeScore !== "" && data.predictedAwayScore !== "") {
               matchPreds[data.matchId] = data; 
           }
        });
        setUserMatchPredictions(matchPreds);
      });

      return () => { unsubscribe(); }; 
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
  

  // מנגנון הניווט והגלילה החכם שמגיע מהדשבורד!
  useEffect(() => {
    const targetGroup = sessionStorage.getItem("targetGroup");
    if (targetGroup) {
       setActiveGroup(targetGroup);
    }
    
    const viewModeTarget = sessionStorage.getItem("groupsViewMode");
    if (viewModeTarget === "QUALIFIERS" || viewModeTarget === "MATCHES") {
       setViewMode(viewModeTarget as any);
       sessionStorage.removeItem("groupsViewMode");
    }

    const targetMatchId = sessionStorage.getItem("scrollToMatch");
    if (targetMatchId) {
      setTimeout(() => {
        const el = document.getElementById(`match-${targetMatchId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          sessionStorage.removeItem("scrollToMatch");
          sessionStorage.removeItem("targetGroup");
        }
      }, 500); 
    }
  }, []);

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
  const isQualifiersLocked = localTournamentState >= 1;

  const isAnyGroupMatchLocked = activeMatches.some((m: any) => {
    if (m.isFinished) return true;
    const md = Number(m.matchday) || 1;
    if (md === 1 && localTournamentState >= 1) return true;
    if (md === 2 && localTournamentState >= 2) return true;
    if (md === 3 && localTournamentState >= 3) return true;
    return false;
  });
  const canRandomizeGroupMatches = activeMatches.length > 0 && !isAnyGroupMatchLocked;

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

  let currentGroupExact = 0;
  let currentGroupDir = 0;
  let currentGroupMatchPts = 0;
  activeMatches.forEach(m => {
    if (m.isFinished) {
      const pred = userMatchPredictions[m.id];
      if (pred) {
         const pH = Number(pred.predictedHomeScore); const pA = Number(pred.predictedAwayScore);
         const rH = Number(m.realHomeScore); const rA = Number(m.realAwayScore);
         if (pH === rH && pA === rA) { currentGroupExact++; currentGroupMatchPts += 15; }
         else if (Math.sign(pH - pA) === Math.sign(rH - rA)) { currentGroupDir++; currentGroupMatchPts += 5; }
      }
    }
  });

  const handleOpenSpy = async () => {
    setShowSpyModal(true);
    setSpySearchQuery("");
    setSpyFilter("ALL");
    setIsLoadingSpy(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers: any[] = [];
      usersSnap.forEach(doc => allUsers.push({ id: doc.id, ...doc.data() }));

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

  const handleRandomizeGroup = () => {
    toast((t) => (
      <div className="flex flex-col gap-3 text-right" dir="rtl">
        <span className="font-bold text-slate-800 text-sm">
          האם להגריל ניחושים אקראיים לבית {activeGroup}? <br/>
        </span>
        
        <div className="flex gap-2">
          <button 
            onClick={() => {
              // 1. משמידים את שאלת האישור
              toast.dismiss(t.id);
              
              // 2. מנתקים מגע כדי שהאייפון לא ייתקע על ההודעות הבאות
              setTimeout(async () => {
                const groupTeams = groups[activeGroup] || [];

                if (viewMode === "MATCHES") {
                  toast.loading("מגריל ושומר במסד הנתונים...", { id: "randomize" });
                  try {
                    const gMatches = matches.filter((m: any) => m.group === activeGroup);
                    const promises = gMatches.map((m: any) => {
                      const home = Math.floor(Math.random() * 4).toString();
                      const away = Math.floor(Math.random() * 4).toString();
                      
                      return setDoc(doc(db, "predictions_matches", `${userId}_${m.id}`), {
                        userId: userId,
                        matchId: m.id,
                        predictedHomeScore: home,
                        predictedAwayScore: away,
                        updatedAt: new Date()
                      }, { merge: true });
                    });

                    await Promise.all(promises);
                    toast.success(`הוגרלו ונשמרו תוצאות לבית ${activeGroup} 🎲`, { id: "randomize" });
                    setTimeout(() => toast.dismiss("randomize"), 2500); // 👈 כפיית סגירה

                  } catch (e) {
                    console.error(e);
                    toast.error("שגיאה בשמירת ההגרלה", { id: "randomize" });
                    setTimeout(() => toast.dismiss("randomize"), 2500); // 👈 כפיית סגירה
                  }
                } else {
                  isUserAction.current = true; 
                  const shuffled = [...groupTeams].sort(() => 0.5 - Math.random());
                  setQualifiers({
                    ...qualifiers,
                    [activeGroup]: { first: shuffled[0], second: shuffled[1] }
                  });
                  const successId = toast.success(`הוגרלו עולות לבית ${activeGroup} 🎲`);
                  setTimeout(() => toast.dismiss(successId), 2500); // 👈 כפיית סגירה
                }
              }, 100); // 👈 סיום ניתוק המגע
            }} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
          >
            כן, הגרל
          </button>
          
          <button 
            onClick={() => toast.dismiss(t.id)} 
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold"
          >
            ביטול
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const handleRandomizeQualifiers = async () => {
    if (isQualifiersLocked || activeTeams.length < 2) return;
    setIsRandomizing(true);
    isUserAction.current = true;
    try {
       const shuffled = [...activeTeams].sort(() => 0.5 - Math.random());
       const newQuals = { ...qualifiers, [activeGroup]: { first: shuffled[0], second: shuffled[1] } };
       setQualifiers(newQuals);
       await setDoc(doc(db, "predictions_qualifiers", userId), { groups: newQuals, updatedAt: new Date() }, { merge: true });
    } catch(e) { console.error(e); }
    finally { setIsRandomizing(false); }
  };

  const renderMatchday = (title: string, matchdayMatches: any[], isLocked: boolean, dayIndex: number) => {
    if (matchdayMatches.length === 0) return null;
    const predictedCount = matchdayMatches.filter(m => userMatchPredictions[m.id]).length;
    const totalCount = matchdayMatches.length;
    const isComplete = predictedCount === totalCount && totalCount > 0;

    return (
      <div className="space-y-4 pt-1 mb-6">
        <div className="flex justify-between items-center bg-slate-800/30 p-2.5 rounded-xl border border-slate-700/50">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-300">{title}</h3>
            {isLocked ? (
              <span className="bg-rose-500/10 text-rose-400 text-[10px] px-2 py-0.5 rounded font-bold border border-rose-500/30">🔒 נעול לניחושים</span>
            ) : (
              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded font-bold border border-emerald-500/30">✍️ פתוח לניחושים</span>
            )}
          </div>
          <div className={`text-[10px] font-bold px-2 py-1 rounded-md border transition-colors duration-300 ${isComplete ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-slate-900 text-slate-400 border-slate-700"}`}>
            {predictedCount}/{totalCount}
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {matchdayMatches.map((match, index) => (
            <div 
               key={match.id} 
                id={dayIndex === 1 && index === 0 ? "first-match-card" : undefined}
               className="scroll-mt-24"
              >
              <MatchCard match={match} userId={userId} tournamentState={tournamentState} />
         </div>
  ))}
</div>
      </div>
    );
  };

  const myQualPoints = calculateGroupQualifiersPoints(qualifiers[activeGroup], realQualifiers[activeGroup]);
  const hasTruth = !!(realQualifiers[activeGroup]?.first || realQualifiers[activeGroup]?.second);
  const spyStats = { exact: 0, partial: 0, miss: 0 };
  
  if (hasTruth) {
    spyData.forEach(d => {
      if (d.points === 30) spyStats.exact++; 
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
// --- התחלת לוגיקת חישוב טבלת הבית ---
  const groupTableData = (() => {
    const stats: any = {};
    // איתחול כל הנבחרות בבית ב-0
    activeTeams.forEach((team: string) => {
      stats[team] = { name: team, played: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
    });

    // מעבר על המשחקים שנגמרו והזנת נתונים
    activeMatches.forEach((m: any) => {
      if (m.isFinished && m.realHomeScore !== "" && m.realHomeScore !== null) {
        const hTeam = m.homeTeam;
        const aTeam = m.awayTeam;
        const hScore = Number(m.realHomeScore);
        const aScore = Number(m.realAwayScore);

        if (stats[hTeam] && stats[aTeam]) {
          stats[hTeam].played++;
          stats[aTeam].played++;
          stats[hTeam].gf += hScore;
          stats[hTeam].ga += aScore;
          stats[aTeam].gf += aScore;
          stats[aTeam].ga += hScore;

          if (hScore > aScore) {
            stats[hTeam].pts += 3; // ניצחון בית
          } else if (aScore > hScore) {
            stats[aTeam].pts += 3; // ניצחון חוץ
          } else {
            stats[hTeam].pts += 1; // תיקו
            stats[aTeam].pts += 1;
          }
        }
      }
    });

    // חישוב הפרש שערים ומיון (נקודות -> הפרש שערים -> שערי זכות)
    return Object.values(stats)
      .map((t: any) => ({ ...t, gd: t.gf - t.ga }))
      .sort((a: any, b: any) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return b.gf - a.gf;
      });
  })();
  // --- סוף לוגיקת חישוב טבלת הבית ---
  const currentProgress = getGroupProgress(activeGroup);
// --- פונקציה חדשה: חישוב ניקוד מעפילות פרטני לנבחרת בתוך הטבלה ---
  const getTeamQualifierFeedback = (teamName: string) => {
    const userGrp = qualifiers[activeGroup];
    const realGrp = realQualifiers[activeGroup];

    // אם אין עדיין תוצאות אמת לבית הזה - מחזירים ריק
    if (!realGrp || (!realGrp.first && !realGrp.second)) return null;

    const isUserFirst = userGrp?.first === teamName;
    const isUserSecond = userGrp?.second === teamName;
    const isRealFirst = realGrp?.first === teamName;
    const isRealSecond = realGrp?.second === teamName;

    // בול פגיעה (הימור מדויק על המיקום)
    if ((isUserFirst && isRealFirst) || (isUserSecond && isRealSecond)) {
      return { pts: 15, type: 'exact' };
    }
    // פגיעה חלקית (הנבחרת עלתה, אבל במקום השני/הראשון ולא כמו שהמשתמש ניחש)
    if ((isUserFirst && isRealSecond) || (isUserSecond && isRealFirst)) {
      return { pts: 7, type: 'partial' };
    }
    // הנבחרת העפילה, אבל המשתמש לא בחר בה
    if (isRealFirst || isRealSecond) {
      return { pts: 0, type: 'miss' };
    }

    return null; // הנבחרת לא העפילה
  };
  return (
    <div className="w-full animate-fade-in-up pb-8">
      
      <div className="flex flex-col items-center mb-1 w-full">
         <div className="w-full max-w-sm mx-auto bg-slate-900/80 p-3 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-md flex flex-col gap-3">
            
            <div className="flex items-center justify-between w-full">
               <button onClick={handlePrevGroup} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 active:scale-95">
                  <span className="text-xl leading-none">▶</span>
               </button>
               
               <div className="flex flex-col items-center justify-center flex-1 px-2">
                  <h2 className="text-3xl font-black text-white mb-2">בית {activeGroup}</h2>
                
                  {(activeMatches.some(m => m.isFinished) || !!(realQualifiers[activeGroup]?.first || realQualifiers[activeGroup]?.second)) && (
                    <div className="flex gap-2 md:gap-3 text-[11px] md:text-sm font-bold mt-1 bg-slate-950/60 px-3 py-2 rounded-xl border border-amber-500/40 items-center justify-center w-full shadow-md flex-wrap">
                       {activeMatches.some(m => m.isFinished) && (
                         <>
                           <span className="text-emerald-400" title="נקודות מפגיעות בול">🎯 +{currentGroupExact * 15}</span>
                           <span className="text-slate-600">|</span>
                           <span className="text-blue-400" title="נקודות מכיוונים">✅ +{currentGroupDir * 5}</span>
                           {(realQualifiers[activeGroup]?.first || realQualifiers[activeGroup]?.second) && <span className="text-slate-600">|</span>}
                         </>
                       )}
                       {(realQualifiers[activeGroup]?.first || realQualifiers[activeGroup]?.second) && (
                         <>
                           <span className="text-purple-400" title="נקודות מעפילות">🥇 +{myQualPoints || 0}</span>
                           <span className="text-slate-600 hidden sm:inline">|</span>
                         </>
                       )}
                       <span className="text-amber-400 font-black text-sm md:text-base tracking-wider drop-shadow-md w-full sm:w-auto mt-1 sm:mt-0 text-center">
                         סה"כ: {(currentGroupMatchPts || 0) + (myQualPoints || 0)} נק'
                       </span>
                    </div>
                  )}
               </div>
               
               <button onClick={handleNextGroup} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 active:scale-95">
                  <span className="text-xl leading-none">◀</span>
               </button>
            </div>

            {/* מד ההתקדמות החדש של הבית */}
            <div className="w-full bg-slate-950/50 p-3 rounded-xl border border-slate-700/50 shadow-inner mt-1 mb-1">
               <div className="flex justify-between items-end mb-2">
                 <div className="flex flex-col text-right">
                   <span className="text-slate-400 text-[10px] font-black tracking-widest uppercase">סטטוס השלמה</span>
                   <span className="text-white font-bold text-xs">{currentProgress === 100 ? 'הבית הושלם במלואו!' : 'השלם משחקים ועולות'}</span>
                 </div>
                 <span className={`font-black ${currentProgress === 100 ? 'text-emerald-400' : 'text-blue-400'}`}>{currentProgress}%</span>
               </div>
               <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative">
                 <div
                   className={`h-full rounded-full transition-all duration-500 ease-out relative ${currentProgress === 100 ? 'bg-gradient-to-l from-emerald-400 to-emerald-600' : 'bg-gradient-to-l from-blue-400 to-cyan-500'}`}
                   style={{ width: `${currentProgress}%` }}
                 >
                    {currentProgress < 100 && <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite] skew-x-12"></div>}
                 </div>
               </div>
            </div>

            <div className="w-full h-px bg-slate-800/50 mt-1"></div>
              {/* --- טבלת הבית המוטמעת --- */}
<div className="w-full bg-slate-900/60 rounded-xl border border-slate-700/50 p-2.5 mt-2 mb-2 shadow-inner">
  {/* כותרות עמודות */}
  <div className="grid grid-cols-[20px_1fr_55px_30px] gap-2 text-[10px] font-bold text-slate-500 mb-1.5 border-b border-slate-700/50 pb-1.5 px-1">
    <div className="text-center">#</div>
    <div className="text-right pl-1">נבחרת</div>
    <div className="text-center">שערים</div>
    <div className="text-center">נק'</div>
  </div>

  {/* שורות הנתונים */}
  <div className="flex flex-col">
    {groupTableData.map((team: any, index: number) => {
      const isTopTwo = index < 2; // צובע את שתי העולות
      const qualFeedback = getTeamQualifierFeedback(team.name);
      
      // --- זיהוי הניחוש של המשתמש ---
      const userFirst = qualifiers[activeGroup]?.first;
      const userSecond = qualifiers[activeGroup]?.second;
      const isMyFirst = userFirst === team.name;
      const isMySecond = userSecond === team.name;

      return (
        <div key={team.name} className={`grid grid-cols-[20px_1fr_55px_30px] gap-2 items-center py-1.5 border-b border-slate-800/50 last:border-0 px-1 rounded-md transition-colors ${isTopTwo ? 'bg-emerald-900/10' : ''}`}>
          
          <div className={`text-center text-xs font-black ${isTopTwo ? 'text-emerald-400' : 'text-slate-500'}`}>
            {index + 1}
          </div>
          
          <div className="text-right flex items-center gap-1.5 overflow-hidden">
            {getFlagUrl(team.name) && (
              <img src={getFlagUrl(team.name)!} className="w-4 h-3 rounded-sm object-cover shadow-sm opacity-90 shrink-0" alt="flag" />
            )}
            <span className={`text-xs sm:text-sm font-bold truncate ${isTopTwo ? 'text-white' : 'text-slate-300'}`}>
              {team.name}
            </span>

            {/* --- החיווי החדש: הניחוש של המשתמש מוצמד לנבחרת --- */}
            {isMyFirst && (
               <span className="mr-1 shrink-0 text-[9px] font-black bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30" title="ניחשת שתעלה מהמקום הראשון">
                 🥇 1
               </span>
            )}
            {isMySecond && (
               <span className="mr-1 shrink-0 text-[9px] font-black bg-slate-300/10 text-slate-300 px-1.5 py-0.5 rounded border border-slate-400/30" title="ניחשת שתעלה מהמקום השני">
                 🥈 2
               </span>
            )}
            
            {/* --- חיווי הניקוד הסופי (במידה וכבר הוזנו תוצאות אמת ע"י האדמין) --- */}
            {qualFeedback && qualFeedback.pts > 0 && (
              <span className={`mr-1 shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded border ${
                qualFeedback.type === 'exact' 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]' 
                  : 'bg-purple-500/20 text-purple-400 border-purple-500/30'
              }`}>
                +{qualFeedback.pts} נק'
              </span>
            )}
            {qualFeedback && qualFeedback.type === 'miss' && (
               <span className="mr-1 shrink-0 text-[8px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700">
                 עלתה
               </span>
            )}
          </div>
          
          <div className="text-center text-[11px] font-medium text-slate-400 tracking-wider" dir="ltr">
            {team.gf}-{team.ga}
          </div>
          
          <div className={`text-center font-black text-xs sm:text-sm ${isTopTwo ? 'text-emerald-400' : 'text-white'}`}>
            {team.pts}
          </div>
          
        </div>
      );
    })}
  </div>
</div>
{/* --- סוף טבלת הבית --- */}
            <div className="relative flex items-center justify-center w-full px-1 mt-1 min-h-[32px]">
               <div className="absolute right-1">
                   {viewMode === "MATCHES" && canRandomizeGroupMatches && (
                      <button 
                         onClick={handleRandomizeGroup} 
                         disabled={isRandomizing}
                         className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold py-1.5 px-2.5 rounded-xl border border-slate-600 flex items-center gap-1 transition-all shadow-sm active:scale-95"
                      >
                        <span className="text-xs">🎲</span> הגרל
                      </button>
                   )}
                   {viewMode === "QUALIFIERS" && !isQualifiersLocked && (
                      <button 
                         onClick={handleRandomizeQualifiers} 
                         disabled={isRandomizing}
                         className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold py-1.5 px-2.5 rounded-xl border border-slate-600 flex items-center gap-1 transition-all shadow-sm active:scale-95"
                      >
                        <span className="text-xs">🎲</span> הגרל
                      </button>
                   )}
               </div>

               <div id="first-group-qualifiers" className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner z-10">
                  <button id="btn-switch-to-matches"
                    onClick={() => setViewMode("MATCHES")} 
                    className={`px-3 py-1 rounded-lg font-bold text-[10px] transition-all flex items-center gap-1 ${viewMode === "MATCHES" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
                  >
                    <span>⚽</span> משחקים
                  </button>
                  <button id="btn-switch-to-qualifiers" 
                    onClick={() => setViewMode("QUALIFIERS")} 
                    className={`px-3 py-1 rounded-lg font-bold text-[10px] transition-all flex items-center gap-1 ${viewMode === "QUALIFIERS" ? "bg-purple-600 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
                  >
                    <span>🥇</span> מעפילות
                  </button>
               </div>
            </div>
         </div>
         
         <div className="h-3 flex items-center justify-center mt-1">
           {saveStatus === "saving" && <span className="text-amber-400 text-[9px] font-bold animate-pulse">⏳ מבצע שמירה...</span>}
           {saveStatus === "saved" && <span className="text-emerald-400 text-[9px] font-bold">✓ נשמר בהצלחה</span>}
         </div>
      </div>

      {viewMode === "MATCHES" && (
         <div className="animate-fade-in-up">
            {renderMatchday("מחזור 1", activeMatches.filter((m: any) => Number(m.matchday || 1) === 1), tournamentState >= 1, 1)}
            {renderMatchday("מחזור 2", activeMatches.filter((m: any) => Number(m.matchday) === 2), tournamentState >= 2, 2)}
            {renderMatchday("מחזור 3", activeMatches.filter((m: any) => Number(m.matchday) === 3), tournamentState >= 3, 3)}
            
            <div className="mt-6 pt-4 border-t border-slate-800/50 flex justify-center">
               <button 
                 onClick={() => {
                   window.scrollTo({ top: 0, behavior: 'smooth' });
                   setViewMode("QUALIFIERS");
                 }} 
                 className="bg-purple-900/30 hover:bg-purple-600 text-purple-300 hover:text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors border border-purple-500/30 flex items-center gap-2 active:scale-95"
               >
                 המשך לבחירת העולות מבית {activeGroup} <span>➡️</span>
               </button>
            </div>
         </div>
      )}

      {viewMode === "QUALIFIERS" && (
         <div className={`bg-slate-800 p-3 rounded-3xl border-t-4 border-t-purple-500 border border-slate-700 shadow-xl relative overflow-hidden transition-all animate-fade-in-up max-w-sm mx-auto ${isQualifiersLocked && myQualPoints === null ? "opacity-80 grayscale-[10%]" : ""}`}>
          
          <div className="flex justify-between items-center mb-1.5 px-1">
            <div>
              <h3 className="text-lg font-bold text-white leading-none mb-0.5">דירוג סופי</h3>
              <p className="text-slate-400 text-[10px]">בחר את העולות מבית {activeGroup}.</p>
            </div>
            
            <div className="flex flex-col items-end gap-1">
              {isQualifiersLocked && myQualPoints === null && <span className="bg-rose-500/10 text-rose-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-rose-500/30 shadow-sm">🔒 נעול</span>}
              {myQualPoints !== null && (
                 <div className={`px-3 py-1.5 rounded-xl text-xs md:text-sm font-black border shadow-lg ${myQualPoints > 0 ? "bg-purple-900/40 text-purple-400 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]" : "bg-slate-900 text-slate-500 border-slate-700"}`}>
                   {myQualPoints > 0 ? `🎯 סה"כ: +${myQualPoints}` : "0 נק'"}
                 </div>
              )}
            </div>
          </div>
          
          <div className="space-y-1.5">
            {activeTeams.map((team: any) => {
              const isFirst = qualifiers[activeGroup]?.first === team;
              const isSecond = qualifiers[activeGroup]?.second === team;
              
              const realFirst = realQualifiers[activeGroup]?.first;
              const realSecond = realQualifiers[activeGroup]?.second;
              let teamFeedback = null;

              if (realFirst || realSecond) {
                if (isFirst && realFirst === team) teamFeedback = <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">+15 נק'</span>;
                else if (isFirst && realSecond === team) teamFeedback = <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/30">+7 נק'</span>;
                else if (isSecond && realSecond === team) teamFeedback = <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">+15 נק'</span>;
                else if (isSecond && realFirst === team) teamFeedback = <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/30">+7 נק'</span>;
                else if (realFirst === team || realSecond === team) teamFeedback = <span className="text-[9px] bg-slate-900 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700">עלתה</span>;
              }
              
              return (
                <div key={team} className={`flex justify-between items-center px-2.5 py-1.5 rounded-xl border transition-all ${isFirst ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.1)]' : isSecond ? 'bg-slate-300/10 border-slate-300/50 shadow-sm' : 'bg-slate-900/50 border-slate-700'}`}>
                  
                  <div className="flex items-center gap-2">
                    {getFlagUrl(team) ? <img src={getFlagUrl(team)!} className="w-4 h-3 object-cover rounded-sm shadow-sm" alt="flag" /> : <span>🏳️</span>}
                    <span className={`font-bold text-xs sm:text-sm ${isFirst ? 'text-amber-400' : isSecond ? 'text-slate-300' : 'text-white'}`}>{team}</span>
                    {teamFeedback}
                  </div>
                  
                  <div className="flex gap-1.5 shrink-0">
                    <button disabled={isQualifiersLocked} onClick={() => handleQualifierSelect(activeGroup, team, 'first')} className={`px-2 py-1 text-[10px] font-bold rounded-md border transition-all ${isQualifiersLocked ? 'cursor-not-allowed opacity-60' : ''} ${isFirst ? 'bg-amber-500 text-slate-900 border-amber-500 shadow-md' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-amber-500/50 hover:text-amber-400'}`}>🥇 1</button>
                    <button disabled={isQualifiersLocked} onClick={() => handleQualifierSelect(activeGroup, team, 'second')} className={`px-2 py-1 text-[10px] font-bold rounded-md border transition-all ${isQualifiersLocked ? 'cursor-not-allowed opacity-60' : ''} ${isSecond ? 'bg-slate-300 text-slate-900 border-slate-300 shadow-md' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-300/50 hover:text-slate-300'}`}>🥈 2</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2.5 border-t border-slate-700/50 pt-2.5 flex flex-row gap-2">
             {isQualifiersLocked && (
               <button onClick={handleOpenSpy} className="flex-1 py-1.5 rounded-xl font-bold text-[11px] transition-all border flex items-center justify-center gap-1.5 bg-slate-900 text-slate-400 hover:text-white border-slate-700 hover:bg-slate-800">
                 <span>👁️</span> ריגול בית {activeGroup}
               </button>
             )}
             <button onClick={handleNextGroup} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded-xl font-bold text-[11px] transition-all shadow-md flex justify-center items-center gap-1.5 active:scale-95">
               לבית הבא <span>➡️</span>
             </button>
          </div>
        </div>
      )}

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
                <div className="flex justify-center py-8 text-blue-400 animate-pulse font-black tracking-wide">טוען נתונים מהשטח... ⏳</div>
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