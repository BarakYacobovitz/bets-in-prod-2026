"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, query, where, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../app/firebase";

// רכיב קונפטי עצמאי שיופעל רק עבור המקום הראשון! 🎊
const Confetti = () => {
  const [pieces, setPieces] = useState<any[]>([]);
  useEffect(() => {
    const arr = Array.from({ length: 70 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      animationDuration: Math.random() * 3 + 2,
      delay: Math.random() * 2,
      emoji: ['🏆', '🥇', '⚽', '🎉', '💸', '🔥'][Math.floor(Math.random() * 6)]
    }));
    setPieces(arr);
  }, []);
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map(p => (
        <div key={p.id} className="absolute top-[-10%] text-2xl md:text-4xl animate-fall" style={{ left: `${p.left}%`, animationDuration: `${p.animationDuration}s`, animationDelay: `${p.delay}s`, animationIterationCount: 'infinite' }}>
          {p.emoji}
        </div>
      ))}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
        }
        .animate-fall { animation-name: fall; animation-timing-function: linear; }
      `}} />
    </div>
  );
};

export default function Leaderboard() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [generalUsers, setGeneralUsers] = useState<any[]>([]);
  const [knockoutUsers, setKnockoutUsers] = useState<any[]>([]);
  const [activeBoard, setActiveBoard] = useState<"GENERAL" | "KNOCKOUT">("GENERAL");
  const [isLoading, setIsLoading] = useState(true);

  const [spyModalUser, setSpyModalUser] = useState<any | null>(null);
  const [spyPredictions, setSpyPredictions] = useState<any[]>([]);
  const [spyBonusPredictions, setSpyBonusPredictions] = useState<any[]>([]);
  const [spyQualifiers, setSpyQualifiers] = useState<any>({});
  const [spyThirdPlace, setSpyThirdPlace] = useState<string[]>([]);
  const [spyStats, setSpyStats] = useState<any>({});
  const [isLoadingSpy, setIsLoadingSpy] = useState(false);
  const [spyTab, setSpyTab] = useState<"STATS" | "MATCHES" | "QUALIFIERS" | "BONUS">("STATS");
  
  const [spyMatchTab, setSpyMatchTab] = useState<string>("MD1");
  const [spyBonusCategory, setSpyBonusCategory] = useState<string>("TOURNAMENT");
  const [spyBonusKnockoutRound, setSpyBonusKnockoutRound] = useState<string>("ALL");
  
  const [matchesMap, setMatchesMap] = useState<any>({});
  const [bonusQuestionsMap, setBonusQuestionsMap] = useState<any>({});
  const [realBonusAnswers, setRealBonusAnswers] = useState<any>({});
  const [realQualifiers, setRealQualifiers] = useState<any>({});
  const [realThirdPlace, setRealThirdPlace] = useState<string[]>([]);
  const [tournamentState, setTournamentState] = useState<number>(0);

  const [teaser, setTeaser] = useState<string>("");
  const [isFirstPlace, setIsFirstPlace] = useState(false);

  const groupsList = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUserId(user.uid);
    });
    return () => unsubscribe();
  }, []);

  const rankUsers = (usersArr: any[], field: string) => {
    const sorted = [...usersArr].sort((a, b) => (b[field] || 0) - (a[field] || 0));
    let currentRank = 1;
    return sorted.map((u, i) => {
      if (i > 0 && (u[field] || 0) < (sorted[i - 1][field] || 0)) currentRank = i + 1;
      return { ...u, displayRank: currentRank };
    });
  };

  useEffect(() => {
    const fetchLeaderboardData = async () => {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const usersArray: any[] = [];
        usersSnap.forEach((doc) => { usersArray.push({ id: doc.id, ...doc.data() }); });
        
        setGeneralUsers(rankUsers(usersArray, "totalPoints"));
        setKnockoutUsers(rankUsers(usersArray, "knockoutPoints"));

        const matchesSnap = await getDocs(collection(db, "matches"));
        const mMap: any = {};
        matchesSnap.forEach(doc => { mMap[doc.id] = doc.data(); });
        setMatchesMap(mMap);

        const bqSnap = await getDoc(doc(db, "settings", "bonus_questions"));
        const bMap: any = {};
        if (bqSnap.exists()) (bqSnap.data().questions || []).forEach((q: any) => { bMap[q.id] = q; });
        setBonusQuestionsMap(bMap);

        const rbSnap = await getDoc(doc(db, "admin_results", "bonus"));
        if (rbSnap.exists()) setRealBonusAnswers(rbSnap.data().answers || {});

        const rqSnap = await getDoc(doc(db, "admin_results", "qualifiers"));
        if (rqSnap.exists()) setRealQualifiers(rqSnap.data().results || {});

        const rtSnap = await getDoc(doc(db, "admin_results", "third_place"));
        if (rtSnap.exists()) setRealThirdPlace(rtSnap.data().teams || []);

      } catch (error) { console.error("שגיאה:", error); } 
      finally { setIsLoading(false); }
    };

    fetchLeaderboardData();

    const unsubscribeSys = onSnapshot(doc(db, "settings", "system"), (docSnap) => {
      if (docSnap.exists()) {
        const state = Number(docSnap.data().tournamentState) || 0;
        setTournamentState(state);
        if (state < 4 && activeBoard === "KNOCKOUT") setActiveBoard("GENERAL");
      }
    });
    return () => unsubscribeSys();
  }, [activeBoard]);

  useEffect(() => {
    if (!currentUserId || generalUsers.length === 0) return;
    
    const currentList = activeBoard === "GENERAL" ? generalUsers : knockoutUsers;
    const scoreField = activeBoard === "GENERAL" ? "totalPoints" : "knockoutPoints";
    const prevScoreField = activeBoard === "GENERAL" ? "previousTotalPoints" : "previousKnockoutPoints";
    const prevRankField = activeBoard === "GENERAL" ? "previousRankGeneral" : "previousRankKnockout";
    
    const myIndex = currentList.findIndex(u => u.id === currentUserId);
    
    if (myIndex === -1) { setTeaser("עוד לא הופעת בטבלה. איפה הניחושים שלך?"); return; }
    
    const me = currentList[myIndex];
    setIsFirstPlace(me.displayRank === 1);

    if (currentList.length <= 1) { setTeaser("אתה לבד פה! זה הזמן להזמין חברים לטבלה."); return; }

    const myScore = me[scoreField] || 0;
    const myPrevScore = me[prevScoreField] || myScore;
    const myRank = me.displayRank;
    const myPrevRank = me[prevRankField] || myRank;
    
    const rankDiff = myPrevRank - myRank; 
    const ptsDiff = myScore - myPrevScore;
    
    const getRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    let newTeaser = "";

    if (rankDiff > 0) {
       const passedGuy = currentList[myIndex + 1]; 
       const ptsStr = ptsDiff > 0 ? `אספת ${ptsDiff} נק' אתמול ו` : "";
       newTeaser = `בואנה חביבי! ${ptsStr}עלית ${rankDiff} מקומות בדירוג! אתה פשוט חד. ${passedGuy ? `אפילו עקפת את ${passedGuy.name.split(' ')[0]} שהייתה כוכבת רצינית עד עכשיו.` : ''}`;
    } else if (rankDiff < 0) {
       const guyAhead = currentList[myIndex - 1]; 
       newTeaser = `מה נסגר? הכל בסדר בבית? נפלת ${Math.abs(rankDiff)} מקומות ביום אחד... ${guyAhead ? `איך נתת ל-${guyAhead.name.split(' ')[0]} לעקוף אותך ככה בלי לראות אותך ממטר?` : ''}`;
    } else {
       if (me.displayRank === 1) {
         const nextGuy = currentList[myIndex + 1];
         if (nextGuy && nextGuy[scoreField] === myScore) newTeaser = getRandom([`אתה בפסגה, אבל צמוד ל-${nextGuy.name.split(' ')[0]} בדיוק באותו הניקוד! צריך פה שובר שוויון.`, `קרב צמוד! ${nextGuy.name.split(' ')[0]} יושב איתך על אותו כיסא בפסגה. מי ימצמץ ראשון?`]);
         else if (nextGuy) {
           const diff = myScore - (nextGuy[scoreField] || 0);
           newTeaser = getRandom([`מלך הטבלה! 👑 אבל ${nextGuy.name.split(' ')[0]} מחכה למעידה שלך במרחק של ${diff} נק' בלבד.`, `האוויר פסגות עושה לך טוב. רק אל תסתכל אחורה, ${nextGuy.name.split(' ')[0]} בפיגור ${diff} נק' ומכין קאמבק.`]);
         }
       } else if (me.displayRank === 2) {
         const king = currentList[myIndex - 1];
         const diff = (king[scoreField] || 0) - myScore;
         if (diff === 0) newTeaser = `שוויון עם הפסגה! אתה ו-${king.name.split(' ')[0]} נועלים קרניים. ניחוש בול אחד ואתה לוקח את זה.`;
         else newTeaser = getRandom([`הכתר במרחק נגיעה! רק ${diff} נקודות מפרידות בינך לבין ${king.name.split(' ')[0]} שבפסגה.`, `סגנות זה נחמד לצרפתים, אבל אנחנו באנו לקחת גביע. תן איזה הפתעה ותעקוף את ${king.name.split(' ')[0]}! (${diff} נק' פער)`]);
       } else if (myIndex === currentList.length - 1 && currentList.length > 3) {
         const guyAbove = currentList[myIndex - 1];
         const diff = (guyAbove[scoreField] || 0) - myScore;
         newTeaser = getRandom([`נועל הטבלה חביבי... 📉 אפילו בוט רנדומלי עושה יותר מזה. לפחות תעקוף את ${guyAbove.name.split(' ')[0]} (פער ${diff} נק').`, `ראית פעם משחק כדורגל מלא? 😂 אתה צריך ${diff} נקודות רק כדי לא להיות אחרון.`]);
       } else {
         const prevGuy = currentList[myIndex - 1];
         const diff = (prevGuy[scoreField] || 0) - myScore;
         newTeaser = getRandom([`אתה מרחק יריקה מ-${prevGuy.name.split(' ')[0]} שמקדימה אותך ב-${diff} נקודות. תפסיק לשחק בטוח!`, `מגמה חיובית! עוד ${diff} נקודות ואתה שולח את ${prevGuy.name.split(' ')[0]} למטה. כיוון נכון אחד ויש לך את זה.`]);
       }
    }
    setTeaser(newTeaser);
  }, [generalUsers, knockoutUsers, activeBoard, currentUserId]);

  const isMatchLocked = (match: any, state: number) => {
    if (!match) return false;
    const s = Number(state) || 0;
    if (match.stage !== "KNOCKOUT") {
      const md = Number(match.matchday) || 1; 
      if (md === 1 && s >= 1) return true;
      if (md === 2 && s >= 2) return true;
      if (md === 3 && s >= 3) return true;
      return false;
    } else {
      if (match.roundName === "32 הגדולות" && s >= 5) return true;
      if (match.roundName === "שמינית גמר" && s >= 7) return true;
      if (match.roundName === "רבע גמר" && s >= 9) return true;
      if (match.roundName === "חצי גמר" && s >= 11) return true;
      if (match.roundName === "גמר" && s >= 13) return true;
      return false;
    }
  };

  const isBonusLocked = (q: any, state: number) => {
    const s = Number(state) || 0;
    if (s === 0) return false;
    if (q.phase === "TOURNAMENT" || q.phase === "GROUPS") return s >= 1;
    if (q.phase === "KNOCKOUT") {
      return (q.round === "ALL" || q.round === "R32") ? s >= 5 : (q.round === "R16") ? s >= 7 : (q.round === "QF") ? s >= 9 : (q.round === "SF") ? s >= 11 : s >= 13;
    }
    return false;
  };

  const calculateMatchPoints = (match: any, predH: string, predA: string, predQ: string) => {
    if (!match.isFinished || predH === "" || predA === "") return null;
    let pts = 0; const rH = Number(match.realHomeScore); const rA = Number(match.realAwayScore); const pH = Number(predH); const pA = Number(predA);
    if (Math.sign(pH - pA) === Math.sign(rH - rA)) { pts += 5; if (pH === rH && pA === rA) pts += 10; }
    if (match.stage === "KNOCKOUT" && predQ === match.realQualifier && predQ !== "") {
      const qMap: any = { "32 הגדולות": 5, "שמינית גמר": 10, "רבע גמר": 15, "חצי גמר": 20, "גמר": 25 }; pts += (qMap[match.roundName] || 0);
    }
    return pts;
  };

  const calculateBonusPoints = (qId: string, userAnswer: string) => {
    const truth = realBonusAnswers[qId];
    if (!truth || !userAnswer) return null;
    const truthArray = Array.isArray(truth) ? truth : [truth];
    return truthArray.some((t: string) => t.toString().trim() === userAnswer.toString().trim()) ? (bonusQuestionsMap[qId]?.points || 0) : 0;
  };

  const getGroupQualPoints = (group: string, place: 'first' | 'second', predTeam: string) => {
    if (!realQualifiers[group] || !predTeam) return null;
    const real = realQualifiers[group];
    if (place === 'first') {
       if (predTeam === real.first) return 15; if (predTeam === real.second) return 7; if (real.first) return 0; 
    } else {
       if (predTeam === real.second) return 15; if (predTeam === real.first) return 7; if (real.second) return 0;
    }
    return null;
  };

  const getThirdPlacePoints = (predTeam: string) => {
    if (!predTeam || realThirdPlace.filter(t=>t!=="").length === 0) return null;
    if (realThirdPlace.includes(predTeam)) return 10; if (realThirdPlace.filter(t=>t!=="").length === 8) return 0; return null; 
  };

  const getPointsBadge = (points: number | null) => {
    if (points === null) return null;
    if (points === 0) return <span className="bg-slate-700/50 text-slate-400 px-2 py-1 rounded-md text-xs font-bold shadow-sm">0 נק'</span>;
    if (points === 5 || points === 7 || points === 10) return <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-1 rounded-md text-xs font-bold shadow-sm">+{points} נק'</span>;
    if (points >= 15) return <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded-md text-xs font-bold shadow-[0_0_10px_rgba(16,185,129,0.2)]">🎯 +{points} נק'</span>;
    return <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-1 rounded-md text-xs font-bold shadow-sm">+{points} נק'</span>;
  };

  const handleOpenSpy = async (userToSpy: any) => {
    setSpyModalUser(userToSpy); setIsLoadingSpy(true); setSpyPredictions([]); setSpyBonusPredictions([]); setSpyQualifiers({}); setSpyThirdPlace([]); setSpyTab("STATS");
    
    let defaultMatchTab = "MD1";
    if (tournamentState >= 13) defaultMatchTab = "FINAL";
    else if (tournamentState >= 11) defaultMatchTab = "SF";
    else if (tournamentState >= 9) defaultMatchTab = "QF";
    else if (tournamentState >= 7) defaultMatchTab = "R16";
    else if (tournamentState >= 5) defaultMatchTab = "R32";
    else if (tournamentState >= 3) defaultMatchTab = "MD3";
    else if (tournamentState >= 2) defaultMatchTab = "MD2";
    setSpyMatchTab(defaultMatchTab);
    
    setSpyBonusCategory("TOURNAMENT");
    setSpyBonusKnockoutRound("ALL");
    
    let stats = { exactC: 0, exactP: 0, dirC: 0, dirP: 0, koC: 0, koP: 0, bonusC: 0, bonusP: 0, groupC: 0, groupP: 0, thirdC: 0, thirdP: 0 };
    const qMap: any = { "32 הגדולות": 5, "שמינית גמר": 10, "רבע גמר": 15, "חצי גמר": 20, "גמר": 25 };

    try {
      const gatheredMatches: any[] = [];
      const qGroups = query(collection(db, "predictions_matches"), where("userId", "==", userToSpy.id));
      const snapGroups = await getDocs(qGroups);
      snapGroups.forEach(doc => {
        const data = doc.data(); const matchInfo = matchesMap[data.matchId];
        if (matchInfo && data.predictedHomeScore !== "" && isMatchLocked(matchInfo, tournamentState)) {
          gatheredMatches.push({ ...data, matchInfo, points: calculateMatchPoints(matchInfo, data.predictedHomeScore, data.predictedAwayScore, "") });
          if (matchInfo.isFinished) {
            const pH = Number(data.predictedHomeScore); const pA = Number(data.predictedAwayScore);
            const rH = Number(matchInfo.realHomeScore); const rA = Number(matchInfo.realAwayScore);
            if (Math.sign(pH - pA) === Math.sign(rH - rA)) {
               if (pH === rH && pA === rA) { stats.exactC++; stats.exactP += 15; } 
               else { stats.dirC++; stats.dirP += 5; }
            }
          }
        }
      });
      const qKnockout = query(collection(db, "predictions_knockout"), where("userId", "==", userToSpy.id));
      const snapKnockout = await getDocs(qKnockout);
      snapKnockout.forEach(doc => {
        const data = doc.data(); const matchInfo = matchesMap[data.matchId];
        if (matchInfo && data.predictedHomeScore !== "" && isMatchLocked(matchInfo, tournamentState)) {
          gatheredMatches.push({ ...data, matchInfo, points: calculateMatchPoints(matchInfo, data.predictedHomeScore, data.predictedAwayScore, data.qualifier || "") });
          if (matchInfo.isFinished) {
            const pH = Number(data.predictedHomeScore); const pA = Number(data.predictedAwayScore);
            const rH = Number(matchInfo.realHomeScore); const rA = Number(matchInfo.realAwayScore);
            if (Math.sign(pH - pA) === Math.sign(rH - rA)) {
               if (pH === rH && pA === rA) { stats.exactC++; stats.exactP += 15; }
               else { stats.dirC++; stats.dirP += 5; }
            }
            if (data.qualifier === matchInfo.realQualifier && data.qualifier !== "") {
               stats.koC++; stats.koP += (qMap[matchInfo.roundName] || 0);
            }
          }
        }
      });
      gatheredMatches.sort((a, b) => {
        const stageA = a.matchInfo.stage === "KNOCKOUT" ? 1 : 0; const stageB = b.matchInfo.stage === "KNOCKOUT" ? 1 : 0;
        if (stageA !== stageB) return stageA - stageB;
        return (Number(a.matchInfo.matchday) || 1) - (Number(b.matchInfo.matchday) || 1);
      });
      setSpyPredictions(gatheredMatches);

      const gatheredBonuses: any[] = [];
      const bonusSnap = await getDoc(doc(db, "predictions_bonus", userToSpy.id));
      if (bonusSnap.exists()) {
        const userAnswers = bonusSnap.data().answers || {};
        for (const [qId, ans] of Object.entries(userAnswers)) {
          const qInfo = bonusQuestionsMap[qId];
          if (qInfo && isBonusLocked(qInfo, tournamentState)) {
             const pts = calculateBonusPoints(qId, ans as string); gatheredBonuses.push({ qId, question: qInfo, answer: ans, points: pts });
             if (pts && pts > 0) { stats.bonusC++; stats.bonusP += pts; }
          }
        }
      }
      setSpyBonusPredictions(gatheredBonuses);

      if (tournamentState >= 1) {
        const qualSnap = await getDoc(doc(db, "predictions_qualifiers", userToSpy.id));
        if (qualSnap.exists()) {
           const groups = qualSnap.data().groups || {}; setSpyQualifiers(groups);
           for (const [gName, preds] of Object.entries<any>(groups)) {
             const p1 = getGroupQualPoints(gName, 'first', preds.first); const p2 = getGroupQualPoints(gName, 'second', preds.second);
             if (p1 && p1 > 0) { stats.groupC++; stats.groupP += p1; }
             if (p2 && p2 > 0) { stats.groupC++; stats.groupP += p2; }
           }
        }
        const thirdSnap = await getDoc(doc(db, "predictions_third_place", userToSpy.id));
        if (thirdSnap.exists()) {
           const teams = thirdSnap.data().teams || []; setSpyThirdPlace(teams);
           teams.forEach((t: string) => { const p = getThirdPlacePoints(t); if (p && p > 0) { stats.thirdC++; stats.thirdP += p; } });
        }
      }
      setSpyStats(stats);
    } catch (error) { console.error("שגיאה בריגול:", error); } finally { setIsLoadingSpy(false); }
  };

  const getFilteredSpyMatches = () => {
    return spyPredictions.filter(pred => {
      const m = pred.matchInfo;
      if (spyMatchTab === "MD1") return m.stage !== "KNOCKOUT" && (Number(m.matchday) || 1) === 1;
      if (spyMatchTab === "MD2") return m.stage !== "KNOCKOUT" && Number(m.matchday) === 2;
      if (spyMatchTab === "MD3") return m.stage !== "KNOCKOUT" && Number(m.matchday) === 3;
      if (spyMatchTab === "R32") return m.stage === "KNOCKOUT" && m.roundName === "32 הגדולות";
      if (spyMatchTab === "R16") return m.stage === "KNOCKOUT" && m.roundName === "שמינית גמר";
      if (spyMatchTab === "QF") return m.stage === "KNOCKOUT" && m.roundName === "רבע גמר";
      if (spyMatchTab === "SF") return m.stage === "KNOCKOUT" && (m.roundName === "חצי גמר" || m.roundName === "מקום שלישי");
      if (spyMatchTab === "FINAL") return m.stage === "KNOCKOUT" && m.roundName === "גמר";
      return true;
    });
  };

  const getFilteredSpyBonuses = () => {
    return spyBonusPredictions.filter(bPred => {
      const q = bPred.question;
      if (q.phase !== spyBonusCategory) return false;
      if (spyBonusCategory === "KNOCKOUT" && q.round !== spyBonusKnockoutRound) return false;
      return true;
    });
  };

  if (isLoading) return <div className="text-center text-blue-400 animate-pulse font-bold mt-12 text-xl">טוען את טבלת המובילים... ⚽</div>;

  const currentUsers = activeBoard === "GENERAL" ? generalUsers : knockoutUsers;
  
  const goldBallWinner = generalUsers.length > 0 ? generalUsers[0] : null;
  const goldenBootWinner = knockoutUsers.length > 0 ? knockoutUsers[0] : null;

  const podiumFirst = currentUsers[0];
  const podiumSecond = currentUsers[1];
  const podiumThird = currentUsers[2];

  return (
    <div className="w-full max-w-4xl mx-auto pb-12" dir="rtl">
      
      {/* מפעיל את הקונפטי רק אם אתה מקום ראשון! */}
      {isFirstPlace && <Confetti />}

      {/* Teaser אישי ליוזר (משולב למעלה כדי לחסוך מקום בטבלה) */}
      {teaser && (
        <div className="mb-6 bg-slate-900/80 p-5 rounded-2xl border-l-4 border-blue-500 shadow-md flex items-start gap-4">
          <div className="text-3xl mt-1">🎙️</div>
          <div>
            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-1">עמדת השידור</h3>
            <p className="text-slate-200 text-lg font-medium leading-relaxed italic">"{teaser}"</p>
          </div>
        </div>
      )}

      {/* פודיום עולם הכדורגל - 🏆 כדור ו-👟 נעל הזהב! */}
      <div className={`grid grid-cols-1 ${tournamentState >= 4 ? 'md:grid-cols-2' : 'max-w-xl mx-auto'} gap-6 mb-8`}>
         
         {/* כדור הזהב (כללי) */}
         <div className="bg-slate-900 rounded-3xl p-6 md:p-8 border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.15)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/20 rounded-full blur-3xl pointer-events-none transition-transform group-hover:scale-150 duration-700"></div>
            <div className="flex justify-between items-start relative z-10">
               <div>
                  <h2 className="text-amber-400 font-black text-sm uppercase tracking-widest mb-1 flex items-center gap-2">
                    <span className="text-xl">⚽</span> כדור הזהב
                  </h2>
                  <p className="text-slate-400 text-xs mb-4">מוביל הדירוג הכללי</p>
                  {goldBallWinner && goldBallWinner.totalPoints > 0 ? (
                     <>
                        <div className="text-3xl md:text-4xl font-black text-white mb-2 truncate max-w-[200px]" title={goldBallWinner.name}>
                           {goldBallWinner.name?.split(' ')[0]} {goldBallWinner.name?.split(' ')[1]?.charAt(0)}.
                        </div>
                        <div className="inline-block bg-amber-500/20 border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-lg text-sm font-black shadow-inner">
                           {goldBallWinner.totalPoints} נק'
                        </div>
                     </>
                  ) : (
                     <div className="text-slate-500 italic mt-4">התחרות טרם החלה...</div>
                  )}
               </div>
               <div className="text-6xl drop-shadow-2xl group-hover:rotate-12 group-hover:scale-110 transition-transform duration-500">🏆</div>
            </div>
         </div>

         {/* נעל הזהב (נוק-אאוט) - מוסתר בשלב הבתים! */}
         {tournamentState >= 4 && (
             <div className="bg-slate-900 rounded-3xl p-6 md:p-8 border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none transition-transform group-hover:scale-150 duration-700"></div>
                <div className="flex justify-between items-start relative z-10">
                   <div>
                      <h2 className="text-emerald-400 font-black text-sm uppercase tracking-widest mb-1 flex items-center gap-2">
                        <span className="text-xl">👟</span> נעל הזהב
                      </h2>
                      <p className="text-slate-400 text-xs mb-4">מלך הנוק-אאוט</p>
                      {goldenBootWinner && goldenBootWinner.knockoutPoints > 0 ? (
                         <>
                            <div className="text-3xl md:text-4xl font-black text-white mb-2 truncate max-w-[200px]" title={goldenBootWinner.name}>
                               {goldenBootWinner.name?.split(' ')[0]} {goldenBootWinner.name?.split(' ')[1]?.charAt(0)}.
                            </div>
                            <div className="inline-block bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg text-sm font-black shadow-inner">
                               {goldenBootWinner.knockoutPoints} נק'
                            </div>
                         </>
                      ) : (
                         <div className="text-slate-500 italic mt-4">הנוק-אאוט טרם החל...</div>
                      )}
                   </div>
                   <div className="text-6xl drop-shadow-2xl group-hover:scale-110 transition-transform duration-500">🔥</div>
                </div>
             </div>
         )}
      </div>

      {/* טאבים של דירוגים (יופיעו רק כששלב הנוקאאוט נפתח) */}
      {tournamentState >= 4 && (
        <div className="flex gap-2 mb-6 bg-slate-900/50 p-2 rounded-2xl border border-slate-800">
          <button onClick={() => setActiveBoard("GENERAL")} className={`flex-1 py-3 rounded-xl font-black transition-all ${activeBoard === "GENERAL" ? "bg-amber-600 text-slate-900 shadow-lg shadow-amber-500/20" : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"}`}>🏆 דירוג כללי (הכל)</button>
          <button onClick={() => setActiveBoard("KNOCKOUT")} className={`flex-1 py-3 rounded-xl font-black transition-all ${activeBoard === "KNOCKOUT" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"}`}>🔥 מלכי הנוק-אאוט</button>
        </div>
      )}

      {/* אזור הטבלה */}
      <div className="bg-slate-800 pt-10 rounded-3xl border border-slate-700 shadow-2xl relative overflow-hidden flex flex-col">
        <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 ${activeBoard === "GENERAL" ? "bg-amber-500/10" : "bg-emerald-500/10"}`}></div>
        
        <h2 className="text-3xl font-extrabold text-white mb-8 px-6 md:px-10 relative z-10 flex items-center gap-3">
          <span>{activeBoard === "GENERAL" ? "🏆" : "🔥"}</span>
          {activeBoard === "GENERAL" ? "טבלת הדירוג הכללי" : "טבלת שלב הנוק-אאוט"}
        </h2>
        
        {/* פודיום 1-2-3 - התיקון לגובה נמצא כאן: pt-8 במקום h-48 */}
        {currentUsers.length > 0 && (
          <div className="flex justify-center items-end gap-2 md:gap-6 mb-12 relative z-10 px-2 pt-8">
            {podiumSecond && (
              <div className="flex flex-col items-center w-28 md:w-32">
                <div className="text-slate-300 font-bold mb-6 text-center truncate w-full px-1 text-sm md:text-base">{podiumSecond.name?.split(' ')[0]}</div>
                <div className="w-full bg-gradient-to-t from-slate-400 to-slate-300 h-28 md:h-32 rounded-t-lg shadow-lg relative flex flex-col justify-end pb-3 border-t-2 border-slate-200">
                  <span className="text-4xl absolute -top-6 left-1/2 -translate-x-1/2 drop-shadow-md">🥈</span>
                  <span className="text-slate-800 font-black text-2xl text-center">{activeBoard === "GENERAL" ? podiumSecond.totalPoints : podiumSecond.knockoutPoints}</span>
                  <span className="text-slate-700 font-bold text-xs text-center mt-1">מקום {podiumSecond.displayRank}</span>
                </div>
              </div>
            )}
            {podiumFirst && (
              <div className="flex flex-col items-center w-32 md:w-40 z-10">
                <div className="text-amber-400 font-black mb-8 text-center truncate w-full px-1 text-base md:text-lg">{podiumFirst.name?.split(' ')[0]}</div>
                <div className="w-full bg-gradient-to-t from-amber-600 to-amber-400 h-36 md:h-44 rounded-t-lg shadow-[0_0_30px_rgba(251,191,36,0.4)] relative flex flex-col justify-end pb-3 border-t-2 border-amber-200">
                  <span className="text-5xl absolute -top-8 left-1/2 -translate-x-1/2 drop-shadow-lg">🥇</span>
                  <span className="text-amber-950 font-black text-3xl text-center">{activeBoard === "GENERAL" ? podiumFirst.totalPoints : podiumFirst.knockoutPoints}</span>
                  <span className="text-amber-900 font-bold text-xs text-center mt-1">מקום {podiumFirst.displayRank}</span>
                </div>
              </div>
            )}
            {podiumThird && (
              <div className="flex flex-col items-center w-28 md:w-32">
                <div className="text-orange-300 font-bold mb-5 text-center truncate w-full px-1 text-sm md:text-base">{podiumThird.name?.split(' ')[0]}</div>
                <div className="w-full bg-gradient-to-t from-orange-800 to-orange-600 h-20 md:h-24 rounded-t-lg shadow-lg relative flex flex-col justify-end pb-3 border-t-2 border-orange-400">
                  <span className="text-3xl absolute -top-5 left-1/2 -translate-x-1/2 drop-shadow-md">🥉</span>
                  <span className="text-orange-100 font-black text-xl text-center">{activeBoard === "GENERAL" ? podiumThird.totalPoints : podiumThird.knockoutPoints}</span>
                  <span className="text-orange-200 font-bold text-xs text-center mt-1">מקום {podiumThird.displayRank}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="overflow-x-auto relative z-10 bg-slate-900/50 rounded-t-2xl border-t border-slate-700/50">
          <table className="w-full text-right table-fixed">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700/50 bg-slate-800/80 text-sm md:text-base">
                <th className="p-3 md:p-4 font-medium w-16 md:w-20 text-center">מיקום</th>
                <th className="p-3 md:p-4 font-medium">שחקן</th>
                <th className={`p-3 md:p-4 font-medium text-center w-20 md:w-28 ${activeBoard === "GENERAL" ? "text-amber-400" : "text-emerald-400"}`}>נק'</th>
                <th className="p-3 md:p-4 font-medium text-center w-14 md:w-16">פירוט</th>
              </tr>
            </thead>
            <tbody>
              {currentUsers.map((u) => {
                const isTop3 = u.displayRank <= 3;
                const rowBg = u.id === currentUserId ? "bg-blue-900/20 border-blue-500/50 shadow-inner" : 
                              u.displayRank === 1 ? "bg-amber-500/10 border-amber-500/30" : 
                              u.displayRank === 2 ? "bg-slate-300/10 border-slate-300/30" : 
                              u.displayRank === 3 ? "bg-orange-700/10 border-orange-700/30" : "hover:bg-slate-700/30";
                
                const scoreToShow = activeBoard === "GENERAL" ? u.totalPoints : u.knockoutPoints;
                
                const prevR = activeBoard === "GENERAL" ? u.previousRankGeneral : u.previousRankKnockout;
                const trend = prevR ? (prevR - u.displayRank) : 0;
                
                return (
                  <tr key={u.id} className={`border-b border-slate-700/50 transition-colors ${rowBg}`}>
                    <td className="p-3 md:p-4 text-center">
                      <div className="flex justify-center items-center gap-1.5 md:gap-2">
                         <div className="flex flex-col items-center">
                           <span className={`text-xl md:text-2xl font-black ${
                             u.displayRank === 1 ? "text-amber-400" : 
                             u.displayRank === 2 ? "text-slate-300" : 
                             u.displayRank === 3 ? "text-orange-400" : 
                             "text-slate-400"
                           }`}>
                             {u.displayRank}
                           </span>
                           {trend > 0 && <span className="text-emerald-400 text-[11px] font-black tracking-tighter mt-[-2px] flex items-center" title={`עלה ${trend} מקומות`}>▲ {trend}</span>}
                           {trend < 0 && <span className="text-rose-400 text-[11px] font-black tracking-tighter mt-[-2px] flex items-center" title={`ירד ${Math.abs(trend)} מקומות`}>▼ {Math.abs(trend)}</span>}
                           {trend === 0 && prevR && <span className="text-slate-600 text-[11px] font-black mt-[-2px] block">-</span>}
                         </div>
                         {u.displayRank === 1 && <span className="text-lg md:text-xl drop-shadow-md">🥇</span>}
                         {u.displayRank === 2 && <span className="text-lg md:text-xl drop-shadow-md">🥈</span>}
                         {u.displayRank === 3 && <span className="text-lg md:text-xl drop-shadow-md">🥉</span>}
                      </div>
                    </td>
                    <td className="p-3 md:p-4">
                       <div className="font-bold text-white text-sm md:text-base truncate flex items-center gap-2">
                         {u.name || "שחקן לא ידוע"}
                         {u.id === currentUserId && <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">אתה</span>}
                       </div>
                       {!u.hasPaid && <div className="text-[10px] text-rose-400 mt-0.5">טרם שולם</div>}
                    </td>
                    <td className={`p-3 md:p-4 text-center font-black text-lg md:text-xl ${isTop3 ? (activeBoard === "GENERAL" ? "text-amber-400" : "text-emerald-400") : "text-slate-200"}`}>
                      {scoreToShow || 0}
                    </td>
                    <td className="p-3 md:p-4 text-center">
                      <button onClick={() => handleOpenSpy(u)} className="w-8 h-8 md:w-10 md:h-10 mx-auto rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center hover:bg-blue-600/20 hover:border-blue-400 hover:text-blue-400 transition-all text-slate-300 shadow-sm" title="הרכב ניקוד">
                        👁️
                      </button>
                    </td>
                  </tr>
                );
              })}
              {currentUsers.length === 0 && (<tr><td colSpan={4} className="text-center p-8 text-slate-500">עדיין אין נתונים בטבלה.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- חלון הריגול (לא נגעתי בכלום) --- */}
      {spyModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 md:p-4 backdrop-blur-sm" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 p-4 md:p-6 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl relative">
            
            <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-2xl font-black text-white flex items-center gap-2"><span>🕵️‍♂️</span> חקירת משתמש: <span className="text-blue-400">{spyModalUser.name}</span></h3>
                <p className="text-slate-400 text-sm mt-1">מוצגים רק נתונים שכבר ננעלו לעריכה.</p>
              </div>
              <button onClick={() => setSpyModalUser(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-300 transition-colors font-bold shrink-0 text-lg">✕</button>
            </div>

            <div className="flex flex-wrap gap-2 mb-6 bg-slate-800 p-2 rounded-xl border border-slate-700/50">
               <button onClick={() => setSpyTab("STATS")} className={`flex-1 min-w-[80px] py-2 rounded-lg font-bold text-sm transition-all ${spyTab === "STATS" ? "bg-amber-500 text-slate-900 shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-700"}`}>📊 נתונים</button>
               <button onClick={() => setSpyTab("MATCHES")} className={`flex-1 min-w-[80px] py-2 rounded-lg font-bold text-sm transition-all ${spyTab === "MATCHES" ? "bg-blue-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-700"}`}>⚽ משחקים</button>
               <button onClick={() => setSpyTab("QUALIFIERS")} className={`flex-1 min-w-[80px] py-2 rounded-lg font-bold text-sm transition-all ${spyTab === "QUALIFIERS" ? "bg-purple-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-700"}`}>🥇 עולות</button>
               <button onClick={() => setSpyTab("BONUS")} className={`flex-1 min-w-[80px] py-2 rounded-lg font-bold text-sm transition-all ${spyTab === "BONUS" ? "bg-emerald-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-700"}`}>⭐ בונוס</button>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
              {isLoadingSpy ? (
                <div className="flex justify-center py-12 text-blue-400 animate-pulse font-bold text-lg">שואב נתונים מסווגים... ⏳</div>
              ) : spyTab === "STATS" ? (
                <div className="space-y-3 pb-4">
                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl bg-emerald-900/30 p-2 rounded-lg border border-emerald-500/20">🎯</div>
                      <div>
                        <div className="text-slate-200 font-bold">פגיעה בול בתוצאה</div>
                        <div className="text-xs text-slate-500 mt-0.5">{spyStats.exactC} משחקים מדויקים</div>
                      </div>
                    </div>
                    <div className="font-black text-xl text-emerald-400">+{spyStats.exactP}</div>
                  </div>

                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl bg-blue-900/30 p-2 rounded-lg border border-blue-500/20">✅</div>
                      <div>
                        <div className="text-slate-200 font-bold">ניחוש כיוון נכון</div>
                        <div className="text-xs text-slate-500 mt-0.5">{spyStats.dirC} משחקים (ללא בול)</div>
                      </div>
                    </div>
                    <div className="font-black text-xl text-blue-400">+{spyStats.dirP}</div>
                  </div>

                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl bg-amber-900/30 p-2 rounded-lg border border-amber-500/20">🎁</div>
                      <div>
                        <div className="text-slate-200 font-bold">שאלות בונוס</div>
                        <div className="text-xs text-slate-500 mt-0.5">{spyStats.bonusC} תשובות נכונות</div>
                      </div>
                    </div>
                    <div className="font-black text-xl text-amber-400">+{spyStats.bonusP}</div>
                  </div>

                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl bg-purple-900/30 p-2 rounded-lg border border-purple-500/20">🥇</div>
                      <div>
                        <div className="text-slate-200 font-bold">עולות מהבתים</div>
                        <div className="text-xs text-slate-500 mt-0.5">{spyStats.groupC} בחירות מוצלחות</div>
                      </div>
                    </div>
                    <div className="font-black text-xl text-purple-400">+{spyStats.groupP}</div>
                  </div>

                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl bg-orange-900/30 p-2 rounded-lg border border-orange-500/20">🥉</div>
                      <div>
                        <div className="text-slate-200 font-bold">8 המעפילות (מקום 3)</div>
                        <div className="text-xs text-slate-500 mt-0.5">{spyStats.thirdC} מתוך הרשימה</div>
                      </div>
                    </div>
                    <div className="font-black text-xl text-orange-400">+{spyStats.thirdP}</div>
                  </div>

                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl bg-rose-900/30 p-2 rounded-lg border border-rose-500/20">🔥</div>
                      <div>
                        <div className="text-slate-200 font-bold">עולות בנוק-אאוט</div>
                        <div className="text-xs text-slate-500 mt-0.5">{spyStats.koC} נבחרות צלחו שלב</div>
                      </div>
                    </div>
                    <div className="font-black text-xl text-rose-400">+{spyStats.koP}</div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t-2 border-slate-700 border-dashed flex justify-between items-center px-2">
                     <span className="text-slate-400 font-bold">סך הכל נקודות מוכחות:</span>
                     <span className="text-2xl font-black text-white">
                        {spyStats.exactP + spyStats.dirP + spyStats.bonusP + spyStats.groupP + spyStats.thirdP + spyStats.koP}
                     </span>
                  </div>
                </div>
              ) : spyTab === "MATCHES" ? (
                spyPredictions.length === 0 ? (
                  <div className="text-center text-slate-400 py-12 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-lg">אין ניחושי משחקים נעולים.</div>
                ) : (
                  <div className="flex flex-col h-full">
                    <div className="flex overflow-x-auto gap-2 mb-4 pb-2 custom-scrollbar shrink-0 border-b border-slate-800">
                       {[
                          { id: "MD1", label: "מחזור 1", minState: 1 },
                          { id: "MD2", label: "מחזור 2", minState: 2 },
                          { id: "MD3", label: "מחזור 3", minState: 3 },
                          { id: "R32", label: "32 הגדולות", minState: 5 },
                          { id: "R16", label: "שמינית גמר", minState: 7 },
                          { id: "QF", label: "רבע גמר", minState: 9 },
                          { id: "SF", label: "חצי גמר", minState: 11 },
                          { id: "FINAL", label: "גמר", minState: 13 }
                        ].filter(t => tournamentState >= t.minState).map(tab => (
                         <button
                            key={tab.id}
                            onClick={() => setSpyMatchTab(tab.id)}
                            className={`px-4 py-2 rounded-xl font-bold whitespace-nowrap text-xs transition-all ${
                              spyMatchTab === tab.id
                                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                : "bg-slate-900 border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white"
                            }`}
                         >
                            {tab.label}
                         </button>
                       ))}
                    </div>

                    <div className="space-y-4">
                      {getFilteredSpyMatches().length === 0 ? (
                        <div className="text-center text-slate-500 py-8 bg-slate-800/30 rounded-xl border border-slate-700/50 font-bold">
                          לא מולאו ניחושים לסיבוב זה.
                        </div>
                      ) : (
                        getFilteredSpyMatches().map((pred, idx) => {
                          const match = pred.matchInfo; const isKnockout = match.stage === "KNOCKOUT";
                          return (
                            <div key={idx} className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-sm">
                              <div className="flex justify-between items-start mb-4 border-b border-slate-700/50 pb-3">
                                 <span className="text-xs text-blue-300 font-bold tracking-wider uppercase bg-blue-900/20 px-2 py-1 rounded">
                                   {isKnockout ? match.roundName : `בית ${match.group} - מחזור ${Number(match.matchday) || 1}`}
                                 </span>
                                 {getPointsBadge(pred.points)}
                              </div>
                              <div className="flex justify-between items-center text-center">
                                 <div className="flex flex-col items-center w-2/5">
                                    <span className="font-bold text-slate-200 mb-2 text-base leading-tight break-words">{match.homeTeam}</span>
                                    <span className="text-3xl font-black text-white bg-slate-900 border border-slate-600 w-14 h-12 flex items-center justify-center rounded-xl shadow-inner">{pred.predictedHomeScore}</span>
                                    {match.isFinished && <span className="text-xs text-emerald-400 font-bold mt-3 bg-emerald-900/20 px-3 py-1 rounded-md border border-emerald-500/30 whitespace-nowrap">אמת: {match.realHomeScore}</span>}
                                 </div>
                                 <div className="flex flex-col items-center w-1/5 pt-6"><span className="text-slate-500 font-black text-2xl">:</span></div>
                                 <div className="flex flex-col items-center w-2/5">
                                    <span className="font-bold text-slate-200 mb-2 text-base leading-tight break-words">{match.awayTeam}</span>
                                    <span className="text-3xl font-black text-white bg-slate-900 border border-slate-600 w-14 h-12 flex items-center justify-center rounded-xl shadow-inner">{pred.predictedAwayScore}</span>
                                    {match.isFinished && <span className="text-xs text-emerald-400 font-bold mt-3 bg-emerald-900/20 px-3 py-1 rounded-md border border-emerald-500/30 whitespace-nowrap">אמת: {match.realAwayScore}</span>}
                                 </div>
                              </div>
                              {isKnockout && pred.qualifier && (
                                <div className="mt-4 pt-3 border-t border-slate-700/50 text-center">
                                  <span className="text-[11px] font-bold text-purple-300 bg-purple-900/20 px-3 py-1.5 rounded-lg border border-purple-500/30">
                                    הימר שיעפילו: {pred.qualifier}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )
              ) : spyTab === "QUALIFIERS" ? (
                 tournamentState < 1 ? (
                   <div className="text-center text-slate-400 py-12 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-lg">עולות טרם ננעלו (מצב 0).</div>
                 ) : (
                   <div className="space-y-8">
                     <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-sm">
                       <h4 className="text-lg font-bold text-amber-400 mb-4 border-b border-slate-700/50 pb-2">🥉 8 המעפילות (מקום שלישי)</h4>
                       {spyThirdPlace.length === 0 ? <div className="text-slate-500 text-sm mb-4">לא בחר נבחרות.</div> : (
                         <div className="flex flex-wrap gap-2 mb-4">
                           {spyThirdPlace.map((t, i) => {
                             if (!t) return null;
                             const pts = getThirdPlacePoints(t);
                             return (
                               <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold ${pts === 10 ? "bg-emerald-900/20 text-emerald-400 border-emerald-500/30" : pts === 0 ? "bg-rose-900/20 text-rose-400 border-rose-500/30" : "bg-slate-900 text-slate-300 border-slate-600"}`}>
                                 {t} {pts === 10 && "✓"} {pts === 0 && "✕"}
                               </div>
                             );
                           })}
                         </div>
                       )}
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {groupsList.map(g => {
                         const preds = spyQualifiers[g];
                         if (!preds || (!preds.first && !preds.second)) return null;
                         const p1Pts = getGroupQualPoints(g, 'first', preds.first);
                         const p2Pts = getGroupQualPoints(g, 'second', preds.second);

                         return (
                           <div key={g} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                             <div className="text-blue-300 font-bold mb-3 bg-blue-900/20 inline-block px-2 py-1 rounded text-xs">בית {g}</div>
                             <div className="space-y-3">
                               <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-lg border border-slate-700/50">
                                 <span className="text-slate-400 text-sm">מקום 1:</span>
                                 <div className="flex items-center gap-2">
                                   <span className="font-bold text-slate-200">{preds.first || "-"}</span>
                                   {getPointsBadge(p1Pts)}
                                 </div>
                               </div>
                               <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-lg border border-slate-700/50">
                                 <span className="text-slate-400 text-sm">מקום 2:</span>
                                 <div className="flex items-center gap-2">
                                   <span className="font-bold text-slate-200">{preds.second || "-"}</span>
                                   {getPointsBadge(p2Pts)}
                                 </div>
                               </div>
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 )
              ) : (
                spyBonusPredictions.length === 0 ? (
                  <div className="text-center text-slate-400 py-12 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-lg">אין ניחושי בונוס נעולים.</div>
                ) : (
                  <div className="flex flex-col h-full">
                    <div className="flex overflow-x-auto gap-2 mb-4 pb-2 custom-scrollbar shrink-0 border-b border-slate-800">
                      {[
                        { id: "TOURNAMENT", label: "🏆 טורניר" },
                        { id: "GROUPS", label: "⚽ שלב הבתים" },
                        { id: "KNOCKOUT", label: "🔥 נוק-אאוט" }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => {
                            setSpyBonusCategory(tab.id);
                            if (tab.id === "KNOCKOUT") {
                              const available = [
                                { id: "ALL", label: "כללי", minState: 0 },
                                { id: "R32", label: "32 הגדולות", minState: 5 },
                                { id: "R16", label: "שמינית גמר", minState: 7 },
                                { id: "QF", label: "רבע גמר", minState: 9 },
                                { id: "SF", label: "חצי גמר", minState: 11 },
                                { id: "FINAL", label: "גמר", minState: 13 }
                              ].filter(t => tournamentState >= t.minState);
                              if (available.length > 0) setSpyBonusKnockoutRound(available[available.length - 1].id);
                            }
                          }}
                          className={`px-4 py-2 rounded-xl font-bold whitespace-nowrap text-xs transition-all ${
                            spyBonusCategory === tab.id
                              ? "bg-amber-500 text-slate-900 shadow-md"
                              : "bg-slate-900 border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-amber-400"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {spyBonusCategory === "KNOCKOUT" && (
                      <div className="flex overflow-x-auto gap-2 mb-4 pb-2 custom-scrollbar bg-slate-900/50 p-2 rounded-2xl border border-slate-800/50 shrink-0">
                        {[
                          { id: "ALL", label: "כללי", minState: 0 },
                          { id: "R32", label: "32 הגדולות", minState: 5 },
                          { id: "R16", label: "שמינית גמר", minState: 7 },
                          { id: "QF", label: "רבע גמר", minState: 9 },
                          { id: "SF", label: "חצי גמר", minState: 11 },
                          { id: "FINAL", label: "גמר", minState: 13 }
                        ].filter(t => tournamentState >= t.minState).map(subTab => (
                          <button
                            key={subTab.id}
                            onClick={() => setSpyBonusKnockoutRound(subTab.id)}
                            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all text-xs border ${
                              spyBonusKnockoutRound === subTab.id
                                ? "bg-purple-600 text-white border-purple-500 shadow-md"
                                : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white"
                            }`}
                          >
                            {subTab.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="space-y-4">
                      {getFilteredSpyBonuses().length === 0 ? (
                        <div className="text-center text-slate-500 py-8 bg-slate-800/30 rounded-xl border border-slate-700/50 font-bold">
                          אין שאלות בונוס (או שלא מולאו) בקטגוריה זו.
                        </div>
                      ) : (
                        getFilteredSpyBonuses().map((bPred, idx) => (
                          <div key={idx} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm">
                             <div className="flex justify-between items-start mb-4 border-b border-slate-700/50 pb-3">
                               <span className="text-amber-400 font-bold text-base pr-4 leading-snug">{bPred.question.label}</span>
                               <div className="shrink-0">{getPointsBadge(bPred.points)}</div>
                             </div>
                             <div className="mt-4">
                               <div className="text-xs text-slate-400 mb-2">הניחוש שלו:</div>
                               <div className="inline-block px-5 py-2.5 bg-slate-900 text-slate-200 font-bold text-lg rounded-xl border border-slate-600 shadow-inner">
                                 {bPred.answer}
                               </div>
                             </div>
                             {realBonusAnswers[bPred.qId] && (
                               <div className="mt-4 bg-emerald-900/10 p-3 rounded-lg border border-emerald-500/20 flex items-center gap-2">
                                 <span className="text-emerald-400">✅</span>
                                 <span className="text-sm text-emerald-400 font-bold">
                                   תשובה אמת: {Array.isArray(realBonusAnswers[bPred.qId]) ? realBonusAnswers[bPred.qId].join(" / ") : realBonusAnswers[bPred.qId]}
                                 </span>
                               </div>
                             )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}