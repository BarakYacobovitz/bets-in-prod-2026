"use client";
import { useState, useEffect } from "react";
import { doc, getDoc, collection, onSnapshot, getDocs, query, where, updateDoc, addDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../app/firebase";
import { getFlagUrl } from "../app/utils/flags"; 
import toast from "react-hot-toast";

export default function Dashboard({ userId, userName, setActiveTab, tournamentState }: any) {
  const [userStats, setUserStats] = useState<any>({ points: 0, hasPaid: false, prevPoints: 0, prevRank: 0, nemesisId: null });
  const [leaderboardInfo, setLeaderboardInfo] = useState({ rank: 0, totalUsers: 0 });
  const [dailyMessage, setDailyMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [allUsersList, setAllUsersList] = useState<any[]>([]);
  
  // === סטייטים לזירת הקרב (נמסיס + ליגות) ===
  const [arenaTab, setArenaTab] = useState<"NEMESIS" | "LEAGUES">("NEMESIS");
  
  const [nemesisData, setNemesisData] = useState<any>(null);
  const [nemesisInput, setNemesisInput] = useState<string>("");
  const [isSavingNemesis, setIsSavingNemesis] = useState(false);

  const [myLeagues, setMyLeagues] = useState<any[]>([]);
  const [isLeagueLoading, setIsLeagueActionLoading] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState<any | null>(null);

  const [pointsFeed, setPointsFeed] = useState<any[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [showFullHistory, setShowFullHistory] = useState(false);

  const [missingBonuses, setMissingBonuses] = useState({ count: 0, points: 0, totalOpen: 0 });
  const [activeSurpriseAlert, setActiveSurpriseAlert] = useState<any[]>([]);
  
  const [todayTargets, setTodayTargets] = useState<any[]>([]);
  const [todayMatches, setTodayMatches] = useState<any[]>([]);
  
  const [activeBannerMode, setActiveBannerMode] = useState<"MATCHES" | "BONUS">("MATCHES");

  const kickoffDate = new Date("2026-06-11T20:00:00");

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const difference = kickoffDate.getTime() - now.getTime();
      if (difference > 0) {
        setTimeLeft({
          d: Math.floor(difference / (1000 * 60 * 60 * 24)),
          h: Math.floor((difference / (1000 * 60 * 60)) % 24),
          m: Math.floor((difference / 1000 / 60) % 60)
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (todayMatches.length > 0 && todayTargets.length > 0) {
      const interval = setInterval(() => {
        setActiveBannerMode(prev => prev === "MATCHES" ? "BONUS" : "MATCHES");
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [todayMatches.length, todayTargets.length]);

  const rankUsers = (usersArr: any[], field: string) => {
    const sorted = [...usersArr].sort((a, b) => (b[field] || 0) - (a[field] || 0));
    let currentRank = 1;
    return sorted.map((u, i) => {
      if (i > 0 && (u[field] || 0) < (sorted[i - 1][field] || 0)) currentRank = i + 1;
      return { ...u, displayRank: currentRank };
    });
  };

  const isQuestionLocked = (q: any, state: number) => {
    if (state === 0) return false;
    if (q.phase === "TOURNAMENT" || q.phase === "GROUPS") return state >= 1;
    if (q.phase === "KNOCKOUT") {
      if (q.round === "ALL" || q.round === "R32") return state >= 5;
      if (q.round === "R16") return state >= 7;
      if (q.round === "QF") return state >= 9;
      if (q.round === "SF") return state >= 11;
      if (q.round === "FINAL") return state >= 13;
    }
    return false;
  };

  useEffect(() => {
    if (!userId) return;

    const unsubscribeUsers = onSnapshot(collection(db, "users"), (usersSnap) => {
      const allUsers: any[] = [];
      usersSnap.forEach(doc => allUsers.push({ id: doc.id, ...doc.data() }));
      const rankedUsers = rankUsers(allUsers, "totalPoints");
      setAllUsersList(rankedUsers);
      
      const myData = rankedUsers.find(u => u.id === userId);
      if (myData) {
        setUserStats({
          points: myData.totalPoints || 0,
          hasPaid: myData.hasPaid || false,
          prevPoints: myData.previousTotalPoints ?? (myData.totalPoints || 0),
          prevRank: myData.previousRankGeneral ?? myData.displayRank,
          nemesisId: myData.nemesisId || null
        });
        setLeaderboardInfo({ rank: myData.displayRank, totalUsers: rankedUsers.length });

        if (myData.nemesisId) {
           const nData = rankedUsers.find(u => u.id === myData.nemesisId);
           setNemesisData(nData || null);
        } else {
           setNemesisData(null);
        }
      }
      setIsLoading(false);
    });

    const qLeagues = query(collection(db, "mini_leagues"), where("members", "array-contains", userId));
    const unsubscribeLeagues = onSnapshot(qLeagues, (snap) => {
        const leagues: any[] = [];
        snap.forEach(doc => leagues.push({ id: doc.id, ...doc.data() }));
        setMyLeagues(leagues);
    });

    const unsubscribeDash = onSnapshot(doc(db, "settings", "dashboard"), (dashSnap) => {
      if (dashSnap.exists() && dashSnap.data().dailyMessage !== undefined) {
        setDailyMessage(dashSnap.data().dailyMessage);
      }
    });

    return () => {
       unsubscribeUsers();
       unsubscribeLeagues();
       unsubscribeDash();
    };
  }, [userId]);

  const handleSaveNemesis = async () => {
    if (!nemesisInput) return toast.error("יש לבחור יריב מהרשימה!");
    setIsSavingNemesis(true);
    try {
      await updateDoc(doc(db, "users", userId), { nemesisId: nemesisInput });
      toast.success("יריב נבחר בהצלחה! שיהיה קרב הוגן ⚔️");
    } catch (e) { toast.error("שגיאה בשמירת היריב."); } 
    finally { setIsSavingNemesis(false); }
  };

  const handleClearNemesis = async () => {
    if (!confirm("בטוח שאתה רוצה לבטל את היריבות?")) return;
    try {
      await updateDoc(doc(db, "users", userId), { nemesisId: null });
      setNemesisInput("");
    } catch (e) { toast.error("שגיאה בביטול יריב."); }
  };

  const handleCreateLeague = async () => {
      const name = prompt("איך קוראים לליגה החדשה שלכם?");
      if (!name || name.trim() === "") return;
      setIsLeagueActionLoading(true);
      try {
          const pin = Math.random().toString(36).substring(2, 8).toUpperCase(); 
          await addDoc(collection(db, "mini_leagues"), {
              name: name.trim(),
              pin: pin,
              adminId: userId,
              members: [userId],
              createdAt: new Date()
          });
          toast.success(`הליגה '${name}' הוקמה! קוד הצטרפות: ${pin}`, { duration: 6000 });
      } catch(e) { toast.error("שגיאה בהקמת הליגה."); }
      finally { setIsLeagueActionLoading(false); }
  };

  const handleJoinLeague = async () => {
      const pin = prompt("הכנס קוד הצטרפות (6 תווים):");
      if (!pin || pin.trim() === "") return;
      setIsLeagueActionLoading(true);
      try {
          const q = query(collection(db, "mini_leagues"), where("pin", "==", pin.trim().toUpperCase()));
          const snap = await getDocs(q);
          if (snap.empty) {
              toast.error("לא נמצאה ליגה עם הקוד הזה.");
              return;
          }
          const leagueDoc = snap.docs[0];
          const leagueData = leagueDoc.data();
          if (leagueData.members.includes(userId)) {
              toast.error("אתה כבר חבר בליגה הזו!");
              return;
          }
          await updateDoc(doc(db, "mini_leagues", leagueDoc.id), { members: arrayUnion(userId) });
          toast.success(`הצטרפת לליגה '${leagueData.name}' בהצלחה!`);
      } catch(e) { toast.error("שגיאה בהצטרפות לליגה."); }
      finally { setIsLeagueActionLoading(false); }
  };

  const handleLeaveLeague = async (leagueId: string, leagueName: string) => {
      if (!confirm(`לצאת מהליגה '${leagueName}'?`)) return;
      try {
          await updateDoc(doc(db, "mini_leagues", leagueId), { members: arrayRemove(userId) });
          setSelectedLeague(null);
          toast.success("יצאת מהליגה.");
      } catch(e) { toast.error("שגיאה ביציאה מהליגה."); }
  };

  useEffect(() => {
    if (!userId) return;
    
    const fetchFeedAndRadar = async () => {
      try {
        const feed: any[] = [];
        const parseDate = (str: string) => {
          if(!str) return 0;
          try {
             const [d, t] = str.split(" ");
             const [day, month, year] = d.split("/");
             const [h, m] = t.split(":");
             return new Date(Number(year), Number(month)-1, Number(day), Number(h), Number(m)).getTime();
          } catch { return 0; }
        };

        const mSnap = await getDocs(collection(db, "matches"));
        const matches = mSnap.docs.map(d=>({id: d.id, ...d.data()}));
        const rQualSnap = await getDoc(doc(db, "admin_results", "qualifiers")); const realQuals = rQualSnap.exists() ? rQualSnap.data().results : {};
        const rThirdSnap = await getDoc(doc(db, "admin_results", "third_place")); const realThird = rThirdSnap.exists() ? rThirdSnap.data().teams : [];
        const rBonusSnap = await getDoc(doc(db, "admin_results", "bonus")); const realBonusAnswers = rBonusSnap.exists() ? rBonusSnap.data().answers : {};
        
        const bqSnap = await getDoc(doc(db, "settings", "bonus_questions")); 
        const bonusQuestions = bqSnap.exists() ? bqSnap.data().questions : [];

        const pbSnap = await getDoc(doc(db, "predictions_bonus", userId));
        const userBonusAnswers = pbSnap.exists() ? pbSnap.data().answers || {} : {};

        const nowMs = new Date().getTime();
        const activeSurprises: any[] = [];
        let openCount = 0;
        let missCount = 0;
        let missPoints = 0;

        bonusQuestions.forEach((q: any) => {
           const hasAnswered = userBonusAnswers[q.id] && userBonusAnswers[q.id].toString().trim() !== "";
           
           if (q.isSurprise) {
              if (q.openTime && q.closeTime) {
                 const openMs = new Date(q.openTime).getTime();
                 const closeMs = new Date(q.closeTime).getTime();
                 if (nowMs >= openMs && nowMs <= closeMs) {
                    if (!hasAnswered) activeSurprises.push(q); 
                 }
              }
           } 
           else {
              let isLocked = false;
              if (tournamentState > 0) {
                 if (q.phase === "TOURNAMENT" || q.phase === "GROUPS") isLocked = tournamentState >= 1;
                 else if (q.phase === "KNOCKOUT") {
                    if (q.round === "ALL" || q.round === "R32") isLocked = tournamentState >= 5;
                    else if (q.round === "R16") isLocked = tournamentState >= 7;
                    else if (q.round === "QF") isLocked = tournamentState >= 9;
                    else if (q.round === "SF") isLocked = tournamentState >= 11;
                    else if (q.round === "FINAL") isLocked = tournamentState >= 13;
                 }
              }
              const isVisible = q.phase === "KNOCKOUT" ? (tournamentState >= 4) : true;
              if (isVisible && !isLocked) {
                 openCount++;
                 if (!hasAnswered) {
                    missCount++;
                    missPoints += (Number(q.points) || 0);
                 }
              }
           }
        });
        
        setActiveSurpriseAlert(activeSurprises);
        setMissingBonuses({ count: missCount, points: missPoints, totalOpen: openCount });

        const pmSnap = await getDocs(query(collection(db, "predictions_matches"), where("userId", "==", userId)));
        const pkSnap = await getDocs(query(collection(db, "predictions_knockout"), where("userId", "==", userId)));
        
        const userMatchPreds: any = {};
        pmSnap.forEach(d => { userMatchPreds[d.data().matchId] = d.data(); });
        pkSnap.forEach(d => { userMatchPreds[d.data().matchId] = d.data(); });

        const today = new Date();
        const targets: any[] = [];
        const tMatches: any[] = [];
        const todayTeams = new Set<string>();
        
        matches.forEach(m => {
           if (!m.isFinished && m.matchDate) {
              const [d, t] = m.matchDate.split(" ");
              if(d) {
                 const [day, month, year] = d.split("/");
                 if (today.getDate() === Number(day) && today.getMonth() === Number(month) - 1 && today.getFullYear() === Number(year)) {
                    todayTeams.add(m.homeTeam);
                    todayTeams.add(m.awayTeam);
                    
                    tMatches.push({
                      ...m,
                      time: t,
                      userPrediction: userMatchPreds[m.id] || null
                    });
                 }
              }
           }
        });

        const noneKeywords = ["אף נבחרת", "אף אחת", "אין", "none"];
        
        if (todayTeams.size > 0) {
           for (const [qId, uAns] of Object.entries(userBonusAnswers)) {
              const ansStr = String(uAns).trim();
              if (!ansStr) continue;

              const truthArray = realBonusAnswers[qId] ? (Array.isArray(realBonusAnswers[qId]) ? realBonusAnswers[qId] : [realBonusAnswers[qId]]) : [];
              if (truthArray.includes(ansStr)) continue;
              if (noneKeywords.includes(ansStr) && truthArray.length > 0) continue;

              const q = bonusQuestions.find((q:any) => q.id === qId);
              if (!q) continue;

              if (todayTeams.has(ansStr)) {
                 targets.push({ team: ansStr, questionLabel: q.label, points: q.points, isSurvival: false });
              } 
              else if (noneKeywords.includes(ansStr) && todayTeams.size > 0) {
                 targets.push({ team: "אף נבחרת", questionLabel: q.label, points: q.points, isSurvival: true });
              }
           }
        }
        
        setTodayMatches(tMatches);
        setTodayTargets(targets);
        
        if (tMatches.length > 0) setActiveBannerMode("MATCHES");
        else if (targets.length > 0) setActiveBannerMode("BONUS");

        pmSnap.forEach(d => {
          const data = d.data(); const match = matches.find((m:any) => m.id === data.matchId);
          if(match && match.isFinished) {
            const pH = Number(data.predictedHomeScore); const pA = Number(data.predictedAwayScore);
            const rH = Number(match.realHomeScore); const rA = Number(match.realAwayScore);
            if(!isNaN(pH) && !isNaN(pA) && !isNaN(rH) && !isNaN(rA)) {
              if(Math.sign(pH-pA) === Math.sign(rH-rA)) {
                const exact = (pH===rH && pA===rA);
                feed.push({ id: `gm_${match.id}`, icon: exact ? '🎯' : '✅', title: `${match.homeTeam} נגד ${match.awayTeam}`, desc: exact ? `פגיעה בול! (${pH}-${pA})` : `כיוון נכון`, points: exact ? 15 : 5, ts: parseDate(match.matchDate) });
              }
            }
          }
        });

        pkSnap.forEach(d => {
          const data = d.data(); const match = matches.find((m:any) => m.id === data.matchId);
          if(match && match.isFinished) {
            const pH = Number(data.predictedHomeScore); const pA = Number(data.predictedAwayScore);
            const rH = Number(match.realHomeScore); const rA = Number(match.realAwayScore);
            if(!isNaN(pH) && !isNaN(pA) && !isNaN(rH) && !isNaN(rA)) {
              if(Math.sign(pH-pA) === Math.sign(rH-rA)) {
                const exact = (pH===rH && pA===rA);
                feed.push({ id: `ko_${match.id}`, icon: exact ? '🎯' : '✅', title: `${match.homeTeam} נגד ${match.awayTeam}`, desc: exact ? `בול בנוק-אאוט! (${pH}-${pA})` : `כיוון בנוק-אאוט`, points: exact ? 15 : 5, ts: parseDate(match.matchDate) });
              }
            }
            if(data.qualifier && data.qualifier === match.realQualifier) {
               const qMap:any = { "32 הגדולות": 5, "שמינית גמר": 10, "רבע גמר": 15, "חצי גמר": 20, "גמר": 25 };
               feed.push({ id: `qko_${match.id}`, icon: '🔥', title: `${data.qualifier}`, desc: `ניחוש העפלה (${match.roundName})`, points: qMap[match.roundName] || 0, ts: parseDate(match.matchDate) + 1 });
            }
          }
        });

        const pqSnap = await getDoc(doc(db, "predictions_qualifiers", userId));
        if(pqSnap.exists()) {
          const groups = pqSnap.data().groups || {};
          for(const [g, preds] of Object.entries<any>(groups)) {
            const rG = realQuals[g];
            if(rG) {
               if(preds.first === rG.first && preds.first) feed.push({ id: `q1_${g}`, icon: '🥇', title: `${preds.first} עולה מבית ${g}`, desc: `פגיעה מדויקת - מקום 1`, points: 15, ts: Infinity });
               else if(preds.first === rG.second && preds.first) feed.push({ id: `q1s_${g}`, icon: '🥈', title: `${preds.first} עולה מבית ${g}`, desc: `עלתה בפועל מהמקום ה-2`, points: 7, ts: Infinity });
               if(preds.second === rG.second && preds.second) feed.push({ id: `q2_${g}`, icon: '🥇', title: `${preds.second} עולה מבית ${g}`, desc: `פגיעה מדויקת - מקום 2`, points: 15, ts: Infinity });
               else if(preds.second === rG.first && preds.second) feed.push({ id: `q2s_${g}`, icon: '🥈', title: `${preds.second} עולה מבית ${g}`, desc: `עלתה בפועל מהמקום ה-1`, points: 7, ts: Infinity });
            }
          }
        }

        const ptSnap = await getDoc(doc(db, "predictions_third_place", userId));
        if(ptSnap.exists()) {
           const teams = ptSnap.data().teams || [];
           teams.forEach((t:string, i:number) => {
              if(t && realThird.includes(t)) feed.push({ id: `t3_${i}`, icon: '🥉', title: `${t}`, desc: `צדקת! העפילה לשמינית ממקום 3`, points: 10, ts: Infinity });
           });
        }

        if(Object.keys(realBonusAnswers).length > 0) {
           bonusQuestions.forEach((q:any) => {
              const truth = realBonusAnswers[q.id]; const uAns = userBonusAnswers[q.id];
              if(truth && uAns) {
                 const tArr = Array.isArray(truth) ? truth : [truth];
                 if(tArr.some((t:any) => t.toString().trim().toLowerCase() === uAns.toString().trim().toLowerCase())) {
                    feed.push({ id: `b_${q.id}`, icon: '🎁', title: q.label, desc: `שאלת בונוס (${uAns})`, points: Number(q.points)||0, ts: Infinity });
                 }
              }
           });
        }

        feed.sort((a,b) => b.ts - a.ts);
        setPointsFeed(feed);
      } catch(e) { console.error(e); } finally { setIsFeedLoading(false); }
    };
    fetchFeedAndRadar();
    const surpriseInterval = setInterval(fetchFeedAndRadar, 30000); 
    return () => clearInterval(surpriseInterval);
  }, [userId, tournamentState]);

  const getTrashTalk = () => {
    const { rank, totalUsers } = leaderboardInfo;
    const myIndex = allUsersList.findIndex(u => u.id === userId);
    if (myIndex === -1) return "הלו, ברוך הבא למשחק! זה הזמן ללכת למלא את הניחושים שלך.";

    const rankDiff = userStats.prevRank > 0 ? userStats.prevRank - rank : 0; 
    const ptsDiff = userStats.points - userStats.prevPoints;

    if (rankDiff > 0) {
       const passedGuy = allUsersList[myIndex + 1]; 
       const ptsStr = ptsDiff > 0 ? `אספת ${ptsDiff} נק' אתמול ו` : "";
       return `בואנה חביבי! ${ptsStr}עלית ${rankDiff} מקומות בדירוג! אתה פשוט חד. ${passedGuy ? `השארת ל-${passedGuy.name?.split(' ')[0]} אבק כרגע.` : ''}`;
    } 
    else if (rankDiff < 0) {
       const guyAhead = allUsersList[myIndex - 1];
       return `מה קורה פה? הכל בסדר בבית? צללת ${Math.abs(rankDiff)} מקומות ביום אחד... ${guyAhead ? `איך נתת ל-${guyAhead.name?.split(' ')[0]} לעקוף אותך ככה בלי למצמץ?` : ''}`;
    } 
    else if (ptsDiff > 0) {
       return `יפה, שאבת ${ptsDiff} נקודות לקופה! הדירוג נשאר זהה אבל אתה מטפס למעלה. תמשיך ככה!`;
    } 
    else {
       if (tournamentState === 0 && userStats.points === 0) return "הטורניר עוד לא התחיל. תעבור על הניחושים שלך ונוודא שאתה מוכן למאני-טיים!";
       if (rank === 1) return "מקום ראשון! 👑 כולם מאחוריך מחכים למעידה, אל תיתן לזה לעלות לך לראש.";
       if (rank <= 3) return "צמרת הטבלה! 🥈 מדליה זה נחמד, אבל באנו לקחת את הגביע.";
       if (rank <= totalUsers / 2) return "אמצע טבלה... 🥱 הגיע הזמן לקחת סיכונים מחושבים ולהפסיק לשחק בטוח.";
       return "אאוץ'. 📉 יש אנשים שמנחשים לפי צבע החולצות ומצבם טוב יותר... הגיע הזמן להתעורר!";
    }
  };

  const topGainedPoints = Math.max(...allUsersList.map(u => (u.totalPoints || 0) - (u.previousTotalPoints || 0)), 0);
  const starsOfTheDay = topGainedPoints > 0 ? allUsersList.filter(u => ((u.totalPoints || 0) - (u.previousTotalPoints || 0)) === topGainedPoints) : [];
  
  const avgPoints = allUsersList.length > 0 ? Math.round(allUsersList.reduce((sum, u) => sum + (u.totalPoints || 0), 0) / allUsersList.length) : 0;
  
  const currentLeader = allUsersList.length > 0 ? allUsersList[0].name?.split(' ')[0] : "אין";
  const currentKoLeader = allUsersList.length > 0 ? [...allUsersList].sort((a, b) => (b.knockoutPoints || 0) - (a.knockoutPoints || 0))[0]?.name?.split(' ')[0] : "אין";

  const rankDiff = userStats.prevRank > 0 ? userStats.prevRank - leaderboardInfo.rank : 0;
  const ptsDiff = userStats.points - userStats.prevPoints;

  const getRecentFeedItems = () => {
    if (ptsDiff <= 0) return [];
    const recent = [];
    let currentSum = 0;
    for (const item of pointsFeed) {
      if (currentSum < ptsDiff) {
        recent.push(item);
        currentSum += item.points;
      } else {
        break;
      }
    }
    return recent;
  };

  const displayFeed = showFullHistory ? pointsFeed : getRecentFeedItems();

  if (isLoading) return <div className="flex justify-center items-center h-64"><div className="animate-spin text-5xl text-blue-500">⚽</div></div>;

  const isMatchesMode = activeBannerMode === "MATCHES";

  return (
    <div className="w-full space-y-8 animate-fade-in-up">
      
      {/* 🚨 באנר שאלת הפתעה! 🚨 */}
      {activeSurpriseAlert.length > 0 && (
         <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 p-6 rounded-3xl border border-purple-300 shadow-[0_0_40px_rgba(168,85,247,0.6)] relative overflow-hidden animate-pulse">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-30"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-right">
               <div>
                  <h2 className="text-3xl font-black text-white mb-2 flex items-center justify-center md:justify-start gap-3 drop-shadow-md">
                     <span className="animate-bounce">🎁</span> שאלת הפתעה באוויר!
                  </h2>
                  <p className="text-white/90 font-medium text-lg leading-snug">
                     האדמין פתח עכשיו <strong>{activeSurpriseAlert.length} שאלות הפתעה</strong> לזמן מוגבל מאוד!<br/>כנס מהר לענות עליהן לפני שהשעון ייגמר.
                  </p>
               </div>
               <button onClick={() => setActiveTab(4)} className="bg-white text-purple-700 hover:bg-slate-100 font-black px-8 py-4 rounded-xl text-lg shadow-xl hover:-translate-y-1 transition-transform w-full md:w-auto flex-shrink-0">
                  לקחת אותי לבונוסים! 🏃‍♂️
               </button>
            </div>
         </div>
      )}

      {/* כרטיס חדר ההלבשה */}
      <div className="rounded-3xl p-6 md:p-10 flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl relative overflow-hidden group bg-slate-900 border border-slate-700">
         <img src="tunnel.png" alt="Bets in Prod Tunnel" className="absolute inset-0 w-full h-full object-cover z-0 opacity-40 group-hover:opacity-60 group-hover:scale-105 transition-all duration-1000 pointer-events-none" />
         <div className="absolute inset-0 z-0 bg-gradient-to-l from-slate-950/80 via-slate-900/40 to-slate-950/80 pointer-events-none"></div>
         <div className="relative z-10 text-center md:text-right">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-2 tracking-tight drop-shadow-md">
               אהלן, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">{userName?.split(" ")[0]}</span>! 👋
            </h1>
            <p className="text-slate-200 text-lg font-medium drop-shadow-lg">ברוך הבא לחדר ההלבשה. זה המצב נכון לעכשיו:</p>
         </div>

         <div className="flex gap-4 w-full md:w-auto relative z-10 mt-4 md:mt-0">
            <div className="flex-1 md:flex-none bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-slate-700 text-center relative shadow-xl">
               <div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">ניקוד</div>
               <div className="text-5xl font-black text-emerald-400 drop-shadow-lg">{userStats.points}</div>
               {ptsDiff > 0 && <div className="absolute -top-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:-top-4 md:-right-2 text-[12px] font-black text-white bg-gradient-to-r from-blue-600 to-blue-400 px-3 py-1 rounded-lg border border-blue-300 shadow-lg transform rotate-3 animate-pulse whitespace-nowrap z-20">+{ptsDiff} היום!</div>}
            </div>
            <div className="flex-1 md:flex-none bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-slate-700 text-center shadow-xl">
               <div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">מיקום</div>
               <div className="text-5xl font-black text-amber-400 flex justify-center items-center gap-2 drop-shadow-lg">
                 <span>{leaderboardInfo.rank > 0 ? leaderboardInfo.rank : "-"}</span>
               </div>
               <div className="mt-2 flex justify-center">
                 {rankDiff > 0 && <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30 shadow-sm">▲ עלית {rankDiff}</span>}
                 {rankDiff < 0 && <span className="text-xs font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/30 shadow-sm">▼ ירדת {Math.abs(rankDiff)}</span>}
                 {rankDiff === 0 && <span className="text-xs font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50 shadow-sm">- ללא שינוי</span>}
               </div>
            </div>
         </div>
      </div>

      {/* 🎯 באנר דינמי ומתחלף: משחקי היום + ראדאר בונוסים! 🎯 */}
      {(todayMatches.length > 0 || todayTargets.length > 0) && (
         <div className={`relative overflow-hidden rounded-3xl shadow-2xl border transition-colors duration-700 group bg-slate-900 ${isMatchesMode ? "border-blue-500/50" : "border-rose-500/50"}`}>
           <div className={`absolute inset-0 bg-gradient-to-r transition-opacity duration-700 ${isMatchesMode ? "from-blue-600/20 via-blue-500/5 to-cyan-500/10 opacity-100" : "opacity-0"}`}></div>
           <div className={`absolute inset-0 bg-gradient-to-r transition-opacity duration-700 ${!isMatchesMode ? "from-rose-600/20 via-rose-500/5 to-amber-500/10 opacity-100" : "opacity-0"}`}></div>
           <div className={`absolute top-0 right-0 w-2 h-full bg-gradient-to-b transition-colors duration-700 ${isMatchesMode ? "from-blue-400 to-cyan-500" : "from-rose-500 to-amber-500"}`}></div>

           <div className="p-6 md:p-8 relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10">
             
             <div className={`flex flex-col text-right md:text-center shrink-0 w-full md:w-auto border-b md:border-b-0 md:border-l pb-6 md:pb-0 md:pl-10 transition-colors duration-700 ${isMatchesMode ? "border-blue-500/30" : "border-rose-500/30"}`}>
                {todayMatches.length > 0 && todayTargets.length > 0 && (
                   <div className="flex bg-slate-950/80 p-1.5 rounded-xl border border-slate-700/50 mb-5 w-full md:w-auto shadow-inner mx-auto">
                     <button onClick={() => setActiveBannerMode("MATCHES")} className={`flex-1 px-5 py-2 rounded-lg text-sm font-bold transition-all ${isMatchesMode ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md transform scale-105" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}>⚽ משחקים</button>
                     <button onClick={() => setActiveBannerMode("BONUS")} className={`flex-1 px-5 py-2 rounded-lg text-sm font-bold transition-all ${!isMatchesMode ? "bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md transform scale-105" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}>🎯 בונוסים</button>
                   </div>
                )}

                <div className="md:mx-auto">
                  {isMatchesMode ? (
                     <>
                       <div className="text-5xl mb-2 drop-shadow-lg text-center md:text-center">⚽</div>
                       <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 tracking-wide text-center">משחקי היום</h2>
                       <div className="text-sm text-slate-300 font-medium max-w-[200px] text-center mx-auto mt-1">בדוק את הניחושים שלך לקראת שריקת הפתיחה</div>
                     </>
                  ) : (
                     <>
                       <div className="text-5xl mb-2 animate-pulse drop-shadow-lg text-center md:text-center">🎯</div>
                       <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-amber-400 tracking-wide text-center">על הכוונת היום!</h2>
                       <div className="text-sm text-slate-300 font-medium max-w-[200px] text-center mx-auto mt-1">הנבחרות שהימרת עליהן עולות לדשא היום</div>
                     </>
                  )}
                </div>
             </div>

             <div className="flex-1 w-full flex overflow-x-auto gap-4 custom-scrollbar pb-2 pt-2 pr-2">
               {isMatchesMode && todayMatches.map((m, idx) => {
                 const hasPrediction = m.userPrediction && m.userPrediction.predictedHomeScore !== "" && m.userPrediction.predictedAwayScore !== "";
                 return (
                   <div key={idx} className={`min-w-[240px] max-w-[260px] relative bg-slate-950/60 p-5 rounded-2xl border transition-colors shadow-inner flex flex-col ${hasPrediction ? "border-blue-500/30 hover:border-blue-400" : "border-amber-500/50 hover:border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]"}`}>
                      {Number(m.matchday) === 3 && m.stage !== "KNOCKOUT" && (
                         <div className="absolute top-0 right-0 bg-gradient-to-r from-rose-600 to-red-500 text-white text-[11px] font-black px-3 py-1.5 rounded-bl-xl rounded-tr-xl shadow-md z-20 border-b border-l border-rose-400/50">
                            🔥 מחזור הכרעה
                         </div>
                      )}
                      <div className="text-blue-400 text-xs font-bold mb-3 flex justify-between items-center mt-2">
                        <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700">🕒 {m.time}</span>
                        <span className="bg-blue-900/30 px-2 py-0.5 rounded border border-blue-500/20">{m.stage === "KNOCKOUT" ? m.roundName : `בית ${m.group}`}</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-white font-bold text-lg mb-4 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                        <span className="flex-1 flex justify-center items-center gap-2 truncate" title={m.homeTeam}>
                           {getFlagUrl(m.homeTeam) ? <img src={getFlagUrl(m.homeTeam)!} className="w-5 h-3.5 object-cover rounded-sm shadow-sm" alt="flag" /> : "🏳️"} {m.homeTeam}
                        </span>
                        <span className="text-slate-500 text-xs mx-1 font-black">VS</span>
                        <span className="flex-1 flex justify-center items-center gap-2 truncate" title={m.awayTeam}>
                           {m.awayTeam} {getFlagUrl(m.awayTeam) ? <img src={getFlagUrl(m.awayTeam)!} className="w-5 h-3.5 object-cover rounded-sm shadow-sm" alt="flag" /> : "🏳️"}
                        </span>
                      </div>

                      <div className="mt-auto pt-2 border-t border-slate-700/50">
                        {hasPrediction ? (
                           <div className="text-sm font-black text-emerald-400 bg-emerald-900/20 px-3 py-1.5 rounded-lg border border-emerald-500/30 text-center shadow-sm">
                             הניחוש שלך: {m.userPrediction.predictedHomeScore} - {m.userPrediction.predictedAwayScore}
                           </div>
                        ) : (
                           <button onClick={() => setActiveTab(m.stage === "KNOCKOUT" ? 2 : 0)} className="w-full text-sm font-bold text-slate-900 bg-amber-500 hover:bg-amber-400 px-3 py-1.5 rounded-lg text-center shadow-md transition-transform active:scale-95 animate-pulse">
                             לא הוזן ניחוש ⚠️
                           </button>
                        )}
                      </div>
                   </div>
                 );
               })}

               {!isMatchesMode && todayTargets.map((target, idx) => (
                 <div key={idx} className="min-w-[260px] max-w-[280px] bg-slate-950/60 p-5 rounded-2xl border border-rose-500/30 shadow-inner flex flex-col justify-between hover:border-rose-400 transition-colors">
                    {target.isSurvival ? (
                       <div>
                         <div className="text-white font-bold text-lg mb-2 flex items-center gap-2"><span className="text-emerald-400">🛡️ הישרדות!</span></div>
                         <p className="text-sm text-slate-300 leading-snug">הימרת שזה <strong className="text-rose-400">לא</strong> יקרה לאף נבחרת. תחזיק אצבעות גם היום: <br/><strong className="text-white bg-slate-800 px-2 py-0.5 rounded mt-1.5 inline-block text-xs border border-slate-700">"{target.questionLabel}"</strong></p>
                       </div>
                    ) : (
                       <div>
                         <div className="text-white font-bold text-lg mb-2 flex items-center gap-2">
                           {getFlagUrl(target.team) ? <img src={getFlagUrl(target.team)!} className="w-5 h-3.5 object-cover rounded-sm shadow-sm" alt="flag" /> : <span className="text-rose-400">🏳️</span>}
                           <span className="text-rose-400">{target.team}</span> משחקת!
                         </div>
                         <p className="text-sm text-slate-300 leading-snug">אם היא תקיים את התנאי: <br/><strong className="text-white bg-slate-800 px-2 py-0.5 rounded mt-1.5 inline-block text-xs border border-slate-700">"{target.questionLabel}"</strong></p>
                       </div>
                    )}
                    <div className="mt-4 text-left">
                      <span className={`text-white px-4 py-1.5 rounded-lg text-sm font-black shadow-md drop-shadow-md inline-block ${target.isSurvival ? "bg-gradient-to-r from-emerald-600 to-teal-500" : "bg-gradient-to-r from-rose-600 to-orange-500"}`}>
                        קופה: +{target.points} נק'
                      </span>
                    </div>
                 </div>
               ))}
             </div>

           </div>
         </div>
      )}

      {/* 📰 המגזין! */}
      {dailyMessage && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in-up">
           
           <div className="lg:col-span-3 bg-slate-900 rounded-3xl border border-slate-700 shadow-xl overflow-hidden flex flex-col relative group">
              <div className="absolute inset-y-0 right-0 w-2 bg-gradient-to-b from-blue-400 to-emerald-500"></div>
              
              <div className="bg-slate-950 p-4 md:px-8 border-b border-slate-800 flex justify-between items-center pr-6 md:pr-10">
                 <div className="flex items-center gap-3">
                    <span className="text-2xl md:text-3xl">📰</span>
                    <h2 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">המהדורה המרכזית</h2>
                 </div>
                 <div className="text-slate-500 text-sm font-medium bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                    {new Date().toLocaleDateString('he-IL')}
                 </div>
              </div>
              
              <div className="p-6 md:p-8 pr-8 md:pr-12">
                 <div className="text-slate-200 text-lg leading-relaxed whitespace-pre-wrap
                                 [&_div]:w-full
                                 [&_b]:text-amber-400 [&_strong]:text-amber-400
                                 [&_i]:text-slate-400 [&_u]:underline [&_u]:decoration-blue-400 [&_u]:underline-offset-4
                                 [&_h1]:text-3xl [&_h1]:font-black [&_h1]:mb-3 [&_h1]:text-transparent [&_h1]:bg-clip-text [&_h1]:bg-gradient-to-r [&_h1]:from-blue-400 [&_h1]:to-emerald-400
                                 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-4 [&_h2]:mt-6 [&_h2]:text-blue-300
                                 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-emerald-300
                                 [&_h4]:text-lg [&_h4]:font-bold [&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:text-slate-300
                                 [&_mark]:px-1.5 [&_mark]:rounded [&_mark]:font-bold
                                 [&_mark.yellow]:!bg-amber-500/20 [&_mark.yellow]:!text-amber-300
                                 [&_mark.green]:!bg-emerald-500/20 [&_mark.green]:!text-emerald-300
                                 [&_mark.blue]:!bg-blue-500/20 [&_mark.blue]:!text-blue-300
                                 [&_mark.red]:!bg-rose-500/20 [&_mark.red]:!text-rose-400
                                 [&_blockquote]:border-r-4 [&_blockquote]:border-emerald-500 [&_blockquote]:bg-slate-800/50 [&_blockquote]:p-4 [&_blockquote]:rounded-l-xl [&_blockquote]:my-4 [&_blockquote]:italic [&_blockquote]:text-slate-300
                                 [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-2 [&_ul]:my-4 [&_ul]:text-slate-300
                                 [&_hr]:border-slate-700 [&_hr]:my-6
                                 [&_img]:inline-block [&_img]:rounded-2xl [&_img]:shadow-lg [&_img]:my-4 [&_img]:max-h-[400px] [&_img]:w-auto [&_img]:max-w-full [&_img]:object-contain [&_img]:border [&_img]:border-slate-700
                                 [&_a]:text-cyan-400 [&_a]:underline hover:[&_a]:text-cyan-300" 
                      dangerouslySetInnerHTML={{ __html: dailyMessage }} 
                 />
              </div>
              
              <div className="mt-auto bg-slate-900/50 border-t border-slate-800 p-4 px-8 md:px-12 flex justify-between items-center text-sm">
                 <div className="text-slate-500 font-bold">מאת: הנהלת הטורניר</div>
                 <div className="text-blue-400/50 flex gap-1"><span className="animate-pulse">●</span><span>●</span><span>●</span></div>
              </div>
           </div>

           <div className="lg:col-span-1 bg-slate-900 rounded-3xl border border-slate-700 shadow-xl p-6 flex flex-col gap-6">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-3 flex items-center gap-2">
                 <span>⚡</span> מבזקי המערכת
              </h3>
              
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-amber-500/30 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full blur-xl pointer-events-none"></div>
                 <div className="text-xs text-slate-400 font-bold mb-1 flex justify-between items-center">
                    כדור הזהב ⚽ <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded text-[10px]">כללי</span>
                 </div>
                 <div className="text-2xl font-black text-amber-400 truncate mt-1 flex items-center gap-2">
                   <span className="text-lg">🏆</span> {currentLeader}
                 </div>
              </div>

              {tournamentState >= 4 && (
                 <div className="bg-slate-800/50 p-4 rounded-2xl border border-emerald-500/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl pointer-events-none"></div>
                    <div className="text-xs text-slate-400 font-bold mb-1 flex justify-between items-center">
                       נעל הזהב 👟 <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px]">נוק-אאוט</span>
                    </div>
                    <div className="text-2xl font-black text-emerald-400 truncate mt-1 flex items-center gap-2">
                       <span className="text-lg">🔥</span> {currentKoLeader}
                    </div>
                 </div>
              )}
              
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-blue-500/20">
                 <div className="text-xs text-slate-500 font-bold mb-1">כמות משתתפים</div>
                 <div className="text-xl font-black text-blue-400">{leaderboardInfo.totalUsers} <span className="text-sm font-normal text-slate-500">שחקנים</span></div>
              </div>
              
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-emerald-500/20">
                 <div className="text-xs text-slate-500 font-bold mb-1">ממוצע נקודות מחלקתי</div>
                 <div className="text-xl font-black text-emerald-400">{avgPoints} <span className="text-sm font-normal text-slate-500">נק'</span></div>
              </div>
           </div>

        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         <div className="lg:col-span-2 space-y-6">
            <div className="bg-gradient-to-br from-blue-900/20 to-indigo-900/10 p-6 md:p-8 rounded-3xl border border-blue-500/30 shadow-lg relative overflow-hidden group">
               <div className="absolute -top-6 -left-4 text-9xl text-blue-500/10 font-serif leading-none group-hover:scale-110 transition-transform">"</div>
               <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                 <span className="bg-blue-500/20 p-1.5 rounded-md">🎙️</span> עמדת השידור
               </h3>
               <p className="text-xl md:text-2xl font-bold text-white leading-relaxed relative z-10">
                 {getTrashTalk()}
               </p>
            </div>

            <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl flex flex-col h-[420px]">
               <div className="flex justify-between items-end border-b border-slate-700 pb-4 mb-4">
                 <h3 className="text-xl font-bold text-white flex items-center gap-2">
                   <span>🧾</span> {showFullHistory ? "כל הקבלות שלך" : "נקודות חדשות מאתמול"}
                 </h3>
                 <button onClick={() => setShowFullHistory(!showFullHistory)} className="text-xs text-blue-400 font-bold bg-blue-900/20 hover:bg-blue-900/40 px-3 py-1.5 rounded-lg transition-colors border border-blue-500/30">
                   {showFullHistory ? "הצג רק חדשים" : "הצג הכל 📋"}
                 </button>
               </div>
               
               <div className="overflow-y-auto custom-scrollbar flex-1 pr-2 space-y-3">
                  {isFeedLoading ? (
                     <div className="text-center py-12 text-slate-500 animate-pulse font-bold">שולף קבלות מהארכיון...</div>
                  ) : pointsFeed.length === 0 ? (
                     <div className="flex flex-col items-center justify-center py-16 opacity-50">
                        <span className="text-5xl mb-3">🕸️</span>
                        <span className="text-slate-400 font-bold">אין נקודות בינתיים...</span>
                     </div>
                  ) : (!showFullHistory && ptsDiff <= 0) ? (
                     <div className="flex flex-col items-center justify-center py-16 text-center">
                        <span className="text-5xl mb-4 opacity-80">📭</span>
                        <span className="text-slate-300 font-bold text-lg mb-1">אין קבלות חדשות מאתמול</span>
                        <span className="text-slate-500 text-sm mb-4">אל תדאג, המשחקים הבאים מעבר לפינה.</span>
                        <button onClick={() => setShowFullHistory(true)} className="text-blue-400 text-sm font-bold underline hover:text-blue-300">לחץ כאן כדי לראות את כל מה שהרווחת עד כה</button>
                     </div>
                  ) : (
                     displayFeed.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-900/60 p-4 rounded-2xl border border-slate-700/50 hover:border-slate-500 transition-colors group">
                           <div className="flex items-center gap-4">
                              <div className="text-3xl bg-slate-800 w-12 h-12 flex items-center justify-center rounded-xl shadow-inner shrink-0 group-hover:scale-110 transition-transform">{item.icon}</div>
                              <div>
                                <div className="text-white font-bold text-[15px] leading-tight">{item.title}</div>
                                <div className="text-xs text-slate-400 mt-1 font-medium bg-slate-800 inline-block px-2 py-0.5 rounded">{item.desc}</div>
                              </div>
                           </div>
                           <div className="text-emerald-400 font-black text-xl bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-500/20 shrink-0">
                             +{item.points}
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </div>
         </div>

         <div className="space-y-6 flex flex-col h-full">
            
            {/* ==================================================== */}
            {/* ⚔️ הווידג'ט המשודרג: זירת הקרב (נמסיס + ליגות) ⚔️ */}
            {/* ==================================================== */}
            <div className="bg-slate-900 rounded-3xl border border-slate-700 shadow-xl flex-shrink-0 flex flex-col h-[320px]">
               {/* כותרת קבועה עם טאבים בתוכה */}
               <div className="flex bg-slate-950 rounded-t-3xl border-b border-slate-700">
                  <button 
                    onClick={() => setArenaTab("NEMESIS")}
                    className={`flex-1 py-3 text-sm font-bold transition-colors rounded-tr-3xl ${arenaTab === "NEMESIS" ? "bg-slate-800 text-white shadow-inner" : "text-slate-500 hover:bg-slate-900 hover:text-slate-300"}`}
                  >
                    🎯 1-על-1 (נמסיס)
                  </button>
                  <button 
                    onClick={() => setArenaTab("LEAGUES")}
                    className={`flex-1 py-3 text-sm font-bold transition-colors rounded-tl-3xl ${arenaTab === "LEAGUES" ? "bg-slate-800 text-white shadow-inner" : "text-slate-500 hover:bg-slate-900 hover:text-slate-300"}`}
                  >
                    🏟️ ליגות פרטיות
                  </button>
               </div>

               <div className="p-5 flex-1 flex flex-col overflow-hidden bg-slate-800 rounded-b-3xl">
                 {/* טאב ה-NEMESIS */}
                 {arenaTab === "NEMESIS" && (
                    <div className="h-full flex flex-col justify-center">
                       {!nemesisData ? (
                         <div className="text-center animate-fade-in-up">
                            <div className="text-white font-bold mb-1 text-sm">בחר יריב מושבע</div>
                            <p className="text-xs text-slate-400 mb-3">מעקב לייב מול קולגה במשרד.</p>
                            <select 
                              value={nemesisInput} onChange={(e) => setNemesisInput(e.target.value)}
                              className="w-full bg-slate-950 text-white p-2.5 rounded-lg border border-slate-600 mb-3 outline-none focus:border-purple-500 text-sm font-bold"
                            >
                              <option value="">בחר משתמש...</option>
                              {allUsersList.filter(u => u.id !== userId).map(u => (<option key={u.id} value={u.id}>{u.name}</option>))}
                            </select>
                            <button onClick={handleSaveNemesis} disabled={isSavingNemesis || !nemesisInput} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-2 rounded-lg shadow-md text-sm">
                              {isSavingNemesis ? "שומר..." : "התחל קרב!"}
                            </button>
                         </div>
                       ) : (
                         <div className="bg-gradient-to-b from-slate-800 to-slate-900 p-4 rounded-xl border border-slate-700 shadow-inner h-full flex flex-col justify-center animate-fade-in-up relative">
                            {/* התיקון: שורת כותרת מסודרת (Flex) במקום מיקום אבסולוטי שדורס הכל */}
                            <div className="flex justify-between items-start mb-2">
                               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">ראש בראש</span>
                               <button onClick={handleClearNemesis} className="text-slate-400 hover:text-rose-400 transition-colors text-xs font-bold bg-slate-900/50 px-2 py-1 rounded border border-slate-700 hover:border-rose-500/50 flex items-center gap-1 shadow-sm shrink-0" title="בטל יריבות">
                                 <span>✕</span> החלף יריב
                               </button>
                            </div>
                            
                            <div className="flex justify-between items-center my-auto">
                               <div className="flex flex-col items-center flex-1">
                                  <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-black mb-1">אתה</span>
                                  <span className="text-sm font-bold text-white truncate max-w-[70px]">{userName?.split(" ")[0]}</span>
                                  <span className="text-2xl font-black text-blue-400">{userStats.points}</span>
                               </div>
                               <div className="flex flex-col items-center px-1"><span className="text-xl font-black text-slate-600 italic">VS</span></div>
                               <div className="flex flex-col items-center flex-1">
                                  <span className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded font-black mb-1">היריב</span>
                                  <span className="text-sm font-bold text-white truncate max-w-[70px]">{nemesisData.name?.split(" ")[0]}</span>
                                  <span className="text-2xl font-black text-rose-400">{nemesisData.totalPoints || 0}</span>
                               </div>
                            </div>

                            {(() => {
                               const myPts = userStats.points; const enemyPts = nemesisData.totalPoints || 0;
                               const total = myPts + enemyPts || 1; const myPercent = (myPts === 0 && enemyPts === 0) ? 50 : Math.round((myPts / total) * 100);
                               const diff = myPts - enemyPts;
                               let msg = "";
                               if (diff > 0) msg = `אתה רומס אותו! (פער: ${diff} נק')`;
                               else if (diff < 0) msg = `הוא בורח לך... (פיגור: ${Math.abs(diff)} נק')`;
                               else msg = "מלחמת התשה! שוויון מוחלט.";

                               return (
                                 <div className="mt-2">
                                    <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden flex border border-slate-700/50 relative">
                                       <div className="h-full bg-blue-500 transition-all duration-1000 ease-out" style={{ width: `${myPercent}%` }}></div>
                                       <div className="h-full bg-rose-500 transition-all duration-1000 ease-out" style={{ width: `${100 - myPercent}%` }}></div>
                                       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-white/30 z-10"></div>
                                    </div>
                                    <div className="text-center mt-2 text-[11px] font-bold text-slate-300">{msg}</div>
                                 </div>
                               );
                            })()}
                         </div>
                       )}
                    </div>
                 )}

                 {/* טאב הליגות הפרטיות */}
                 {arenaTab === "LEAGUES" && (
                    <div className="h-full flex flex-col animate-fade-in-up">
                       <div className="flex gap-2 mb-3 shrink-0">
                          <button onClick={handleCreateLeague} disabled={isLeagueLoading} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold py-2 rounded-lg border border-slate-600 transition-colors">
                             ➕ צור ליגה חדשה
                          </button>
                          <button onClick={handleJoinLeague} disabled={isLeagueLoading} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold py-2 rounded-lg border border-slate-600 transition-colors">
                             🔗 הצטרף עם קוד
                          </button>
                       </div>
                       
                       <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 space-y-2">
                          {myLeagues.length === 0 ? (
                             <div className="text-center text-slate-500 text-xs py-8 px-2 leading-relaxed">
                                עדיין לא הצטרפת לשום ליגה פרטית.<br/>צור אחת ושתף את הקוד עם החברים!
                             </div>
                          ) : (
                             myLeagues.map(league => {
                                const isMyLeague = league.adminId === userId;
                                return (
                                   <div 
                                      key={league.id} 
                                      onClick={() => setSelectedLeague(league)}
                                      className="bg-slate-900 p-3 rounded-xl border border-slate-700 cursor-pointer hover:border-blue-500 transition-colors group flex justify-between items-center"
                                   >
                                      <div className="flex flex-col truncate pr-2">
                                         <span className="font-bold text-slate-200 text-sm truncate">{league.name}</span>
                                         <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-slate-500">👤 {league.members?.length || 1} חברים</span>
                                            {isMyLeague && <span className="text-[9px] bg-slate-800 border border-slate-600 text-slate-400 px-1.5 rounded" title="קוד ההצטרפות לליגה שפתחת">קוד: {league.pin}</span>}
                                         </div>
                                      </div>
                                      <div className="text-slate-600 group-hover:text-blue-400 transition-colors">▶</div>
                                   </div>
                                );
                             })
                          )}
                       </div>
                    </div>
                 )}
               </div>
            </div>
            {/* ==================================================== */}

            <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl flex-shrink-0">
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">ניווט מהיר</h3>
               <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => setActiveTab(0)} className="bg-slate-900 hover:bg-blue-600 hover:text-white text-slate-300 p-4 rounded-2xl border border-slate-700 flex flex-col items-center justify-center gap-2 transition-all group">
                   <span className="text-3xl group-hover:scale-125 transition-transform">⚽</span>
                   <span className="font-bold text-xs">המשחקים</span>
                 </button>
                 <button onClick={() => setActiveTab(4)} className="bg-slate-900 hover:bg-amber-500 hover:text-slate-900 text-slate-300 p-4 rounded-2xl border border-slate-700 flex flex-col items-center justify-center gap-2 transition-all group">
                   <span className="text-3xl group-hover:scale-125 transition-transform">⭐</span>
                   <span className="font-bold text-xs">הבונוסים</span>
                 </button>
                 <button onClick={() => setActiveTab(3)} className="bg-slate-900 hover:bg-emerald-500 hover:text-slate-900 text-slate-300 p-4 rounded-2xl border border-slate-700 flex flex-col items-center justify-center gap-2 transition-all group col-span-2">
                   <span className="text-3xl group-hover:scale-110 transition-transform">🏆</span>
                   <span className="font-bold text-sm">הטבלה המלאה</span>
                 </button>
               </div>
            </div>

            {missingBonuses.totalOpen > 0 && (
              <div className={`p-6 rounded-3xl border shadow-xl relative overflow-hidden group transition-all flex-1 flex flex-col justify-center ${missingBonuses.count > 0 ? "bg-slate-800 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.1)] hover:border-amber-400" : "bg-slate-800/80 border-slate-700"}`}>
                 {missingBonuses.count > 0 && <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-orange-500/5 z-0"></div>}
                 
                 <div className="relative z-10 flex flex-col items-center text-center">
                    {missingBonuses.count > 0 ? (
                       <>
                         <div className="text-5xl mb-3 group-hover:scale-110 transition-transform drop-shadow-lg">💰</div>
                         <h3 className="text-xl font-black text-amber-400 mb-2">כסף על הרצפה!</h3>
                         <p className="text-slate-300 text-sm mb-5 leading-relaxed">
                           השארת <strong className="text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-700 mx-1">{missingBonuses.count} שאלות בונוס</strong> פתוחות ללא ניחוש.<br/>
                           יש פה קופה של <strong className="text-amber-400 font-black">+{missingBonuses.points} נק'</strong> שאפשר לאסוף.
                         </p>
                         <button onClick={() => setActiveTab(4)} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-black py-3.5 rounded-xl transition-all shadow-lg transform active:scale-95 text-sm">
                           קח אותי לבונוסים 🏃‍♂️
                         </button>
                       </>
                    ) : (
                       <>
                         <div className="text-5xl mb-3 opacity-80">🛡️</div>
                         <h3 className="text-lg font-bold text-emerald-400 mb-2">הקופה מאובטחת</h3>
                         <p className="text-slate-400 text-sm mb-5 leading-relaxed">
                           ענית על כל {missingBonuses.totalOpen} שאלות הבונוס שפתוחות כרגע. אפשר לישון בשקט.
                         </p>
                         <button onClick={() => setActiveTab(4)} className="w-full bg-slate-900 hover:bg-slate-700 text-slate-300 font-bold py-3.5 border border-slate-700 rounded-xl transition-all text-sm">
                           הצץ בניחושים שלך 🔍
                         </button>
                       </>
                    )}
                 </div>
              </div>
            )}

         </div>
      </div>

      {/* ==================================================== */}
      {/* פופ-אפ תצוגת ליגה פרטית (טבלת מובילים פנימית) */}
      {/* ==================================================== */}
      {selectedLeague && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-fade-in-up" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl relative">
            
            <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                   <span>🏟️</span> טבלת {selectedLeague.name}
                </h3>
                <div className="flex items-center gap-3 mt-1">
                   <p className="text-slate-400 text-sm">קוד הצטרפות: <strong className="text-blue-400 font-mono tracking-widest">{selectedLeague.pin}</strong></p>
                </div>
              </div>
              <button onClick={() => setSelectedLeague(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors font-black text-sm border border-slate-700">✕</button>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 pr-2 mb-4">
               <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-right">
                     <thead className="bg-slate-900/80 text-slate-500 text-xs uppercase tracking-widest">
                        <tr>
                           <th className="p-3 font-bold text-center w-12">#</th>
                           <th className="p-3 font-bold">שחקן</th>
                           <th className="p-3 font-bold text-center">נקודות</th>
                        </tr>
                     </thead>
                     <tbody>
                        {allUsersList
                           .filter(u => selectedLeague.members.includes(u.id))
                           .map((u, index) => {
                              const isMe = u.id === userId;
                              return (
                                 <tr key={u.id} className={`border-t border-slate-800/50 ${isMe ? 'bg-blue-900/20' : 'hover:bg-slate-800/50'}`}>
                                    <td className="p-3 text-center font-black text-slate-400">{index + 1}</td>
                                    <td className="p-3 font-bold text-slate-200">
                                       {u.name}
                                       {isMe && <span className="mr-2 text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase">אתה</span>}
                                    </td>
                                    <td className="p-3 text-center font-black text-amber-400 text-lg">{u.totalPoints || 0}</td>
                                 </tr>
                              );
                           })
                        }
                     </tbody>
                  </table>
               </div>
            </div>

            <div className="pt-4 border-t border-slate-800 text-center">
               <button onClick={() => handleLeaveLeague(selectedLeague.id, selectedLeague.name)} className="text-xs text-rose-500 hover:text-rose-400 font-bold underline transition-colors">
                  🚪 עזוב את הליגה
               </button>
            </div>

          </div>
        </div>
      )}
      
    </div>
  );
}