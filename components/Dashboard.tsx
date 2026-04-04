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
  
  const [arenaTab, setArenaTab] = useState<"NEMESIS" | "LEAGUES">("NEMESIS");
  const [nemesisData, setNemesisData] = useState<any>(null);
  const [nemesisInput, setNemesisInput] = useState<string>("");
  const [isSavingNemesis, setIsSavingNemesis] = useState(false);

  const [myLeagues, setMyLeagues] = useState<any[]>([]);
  const [isLeagueLoading, setIsLeagueActionLoading] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState<any | null>(null);

  const [timelineTab, setTimelineTab] = useState<"TODAY" | "YESTERDAY">("TODAY");

  const [pointsFeed, setPointsFeed] = useState<any[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [showFullHistory, setShowFullHistory] = useState(false);

  const [missingBonuses, setMissingBonuses] = useState({ count: 0, points: 0, totalOpen: 0 });
  const [activeSurpriseAlert, setActiveSurpriseAlert] = useState<any[]>([]);
  
  const [todayTargets, setTodayTargets] = useState<any[]>([]);
  const [todayMatches, setTodayMatches] = useState<any[]>([]);
  
  const [activeBannerMode, setActiveBannerMode] = useState<"MATCHES" | "BONUS">("MATCHES");
  const [todayMatchIndex, setTodayMatchIndex] = useState(0);
  const [todayBonusIndex, setTodayBonusIndex] = useState(0);

  const [spyModalMatch, setSpyModalMatch] = useState<any | null>(null);
  const [spyData, setSpyData] = useState<any[]>([]);
  const [isLoadingSpy, setIsLoadingSpy] = useState(false);
  
  const [spySearchQuery, setSpySearchQuery] = useState("");
  const [spyFilter, setSpyFilter] = useState<"ALL" | "EXACT" | "DIRECTION" | "MISS">("ALL");

  const [showMagazineModal, setShowMagazineModal] = useState(false);
  const [showRealStandingsModal, setShowRealStandingsModal] = useState(false);

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

  const rankUsers = (usersArr: any[], field: string) => {
    const sorted = [...usersArr].sort((a, b) => (b[field] || 0) - (a[field] || 0));
    let currentRank = 1;
    return sorted.map((u, i) => {
      if (i > 0 && (u[field] || 0) < (sorted[i - 1][field] || 0)) currentRank = i + 1;
      return { ...u, displayRank: currentRank };
    });
  };

  const checkIsMatchLocked = (m: any, state: number) => {
    const s = Number(state) || 0;
    if (m.stage !== "KNOCKOUT") {
      const md = Number(m.matchday) || 1;
      if (md === 1 && s >= 1) return true;
      if (md === 2 && s >= 2) return true;
      if (md === 3 && s >= 3) return true;
      return false;
    } else {
      if (m.roundName === "32 הגדולות" && s >= 5) return true;
      if (m.roundName === "שמינית גמר" && s >= 7) return true;
      if (m.roundName === "רבע גמר" && s >= 9) return true;
      if (m.roundName === "חצי גמר" && s >= 11) return true;
      if (m.roundName === "גמר" && s >= 13) return true;
      return false;
    }
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
                    openCount++;
                    if (!hasAnswered) {
                       missCount++;
                       missPoints += (Number(q.points) || 0);
                    }
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

  const calculateMatchPoints = (predH: string, predA: string, predQ: string, rH: number, rA: number, rQ: string, match: any) => {
    if (!match.isFinished || predH === "" || predA === "") return null;
    let pts = 0; const pH = Number(predH); const pA = Number(predA);
    if (Math.sign(pH - pA) === Math.sign(rH - rA)) { pts += 5; if (pH === rH && pA === rA) pts += 10; }
    if (match.stage === "KNOCKOUT" && predQ === rQ && predQ !== "") {
      const qMap: any = { "32 הגדולות": 5, "שמינית גמר": 10, "רבע גמר": 15, "חצי גמר": 20, "גמר": 25 }; pts += (qMap[match.roundName] || 0);
    }
    return pts;
  };

  const handleOpenSpyForMatch = async (match: any) => {
    setSpyModalMatch(match);
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

      const collectionName = match.stage === "KNOCKOUT" ? "predictions_knockout" : "predictions_matches";
      const q = query(collection(db, collectionName), where("matchId", "==", match.id));
      const snap = await getDocs(q);
      const gathered: any[] = [];
      
      snap.forEach(doc => {
        const d = doc.data();
        if (d.predictedHomeScore !== "" && d.predictedAwayScore !== "") {
          gathered.push({ 
            ...d, 
            userName: usersMap[d.userId]?.name || "משתמש",
            userTotalPoints: usersMap[d.userId]?.totalPoints || 0,
            userRank: usersMap[d.userId]?.rank || 999,
            points: calculateMatchPoints(d.predictedHomeScore, d.predictedAwayScore, d.qualifier || "", Number(match.realHomeScore), Number(match.realAwayScore), match.realQualifier, match)
          });
        }
      });
      
      gathered.sort((a, b) => b.userTotalPoints - a.userTotalPoints);
      setSpyData(gathered);
    } catch (e) { console.error(e); }
    finally { setIsLoadingSpy(false); }
  };

  const getRecentFeedItems = () => {
    const ptsDiff = userStats.points - userStats.prevPoints;
    if (ptsDiff <= 0) return [];
    const recent = [];
    let currentSum = 0;
    for (const item of pointsFeed) {
      if (currentSum < ptsDiff) {
        recent.push(item);
        currentSum += item.points;
      } else { break; }
    }
    return recent;
  };

  const avgPoints = allUsersList.length > 0 ? Math.round(allUsersList.reduce((sum, u) => sum + (Number(u.totalPoints) || 0), 0) / allUsersList.length) : 0;
  const displayFeed = showFullHistory ? pointsFeed : getRecentFeedItems();
  const ptsDiff = userStats.points - userStats.prevPoints;
  const rankDiff = userStats.prevRank > 0 ? userStats.prevRank - leaderboardInfo.rank : 0;
  
  const currentLeader = allUsersList.length > 0 ? allUsersList[0].name?.split(' ')[0] : "אין";
  const currentKoLeader = allUsersList.length > 0 ? [...allUsersList].sort((a, b) => (Number(b.knockoutPoints) || 0) - (Number(a.knockoutPoints) || 0))[0]?.name?.split(' ')[0] : "אין";

  const handlePrevMatch = () => setTodayMatchIndex(i => (i === 0 ? todayMatches.length - 1 : i - 1));
  const handleNextMatch = () => setTodayMatchIndex(i => (i === todayMatches.length - 1 ? 0 : i + 1));
  const handlePrevBonus = () => setTodayBonusIndex(i => (i === 0 ? todayTargets.length - 1 : i - 1));
  const handleNextBonus = () => setTodayBonusIndex(i => (i === todayTargets.length - 1 ? 0 : i + 1));

  if (isLoading) return <div className="flex justify-center items-center h-64"><div className="animate-spin text-5xl text-blue-500">⚽</div></div>;

  const isMatchesMode = activeBannerMode === "MATCHES";
  const currentDisplayedMatch = todayMatches[todayMatchIndex];
  const currentDisplayedBonus = todayTargets[todayBonusIndex];

  const spyStats = { exact: 0, direction: 0, miss: 0 };
  if (spyModalMatch && spyModalMatch.isFinished) {
    spyData.forEach(d => {
      const pH = Number(d.predictedHomeScore); const pA = Number(d.predictedAwayScore);
      const rH = Number(spyModalMatch.realHomeScore); const rA = Number(spyModalMatch.realAwayScore);
      if (pH === rH && pA === rA) spyStats.exact++;
      else if (Math.sign(pH - pA) === Math.sign(rH - rA)) spyStats.direction++;
      else spyStats.miss++;
    });
  }

  const filteredSpyData = spyData.filter(d => {
    if (!d.userName.toLowerCase().includes(spySearchQuery.toLowerCase())) return false;
    
    if (spyModalMatch && spyModalMatch.isFinished && spyFilter !== "ALL") {
      const pH = Number(d.predictedHomeScore); const pA = Number(d.predictedAwayScore);
      const rH = Number(spyModalMatch.realHomeScore); const rA = Number(spyModalMatch.realAwayScore);
      const isExact = (pH === rH && pA === rA);
      const isDirection = (!isExact && Math.sign(pH - pA) === Math.sign(rH - rA));
      
      if (spyFilter === "EXACT" && !isExact) return false;
      if (spyFilter === "DIRECTION" && !isDirection) return false;
      if (spyFilter === "MISS" && (isExact || isDirection)) return false;
    }
    return true;
  });

  return (
    <div className="w-full space-y-8 animate-fade-in-up">
      
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

      {/* 1. אהלן ברק (הוסר הכפתור הגדול) */}
      <div className="flex md:grid md:grid-cols-2 overflow-x-auto snap-x snap-mandatory md:overflow-visible gap-4 md:gap-8 pb-4 md:pb-0 custom-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
         
         <div className="w-[90%] md:w-auto shrink-0 snap-center rounded-3xl p-6 shadow-2xl relative overflow-hidden bg-slate-900 border border-slate-700 group flex flex-col justify-center">
            <img src="tunnel.png" alt="Bets in Prod Tunnel" className="absolute inset-0 w-full h-full object-cover z-0 opacity-40 group-hover:opacity-60 group-hover:scale-105 transition-all duration-1000 pointer-events-none" />
            <div className="absolute inset-0 z-0 bg-gradient-to-l from-slate-950/90 via-slate-900/60 to-slate-950/90 pointer-events-none"></div>
            
            <div className="relative z-10 text-right mb-6">
               <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-1 tracking-tight drop-shadow-md">
                  אהלן, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">{userName?.split(" ")[0]}</span>! 👋
               </h1>
               <p className="text-slate-300 text-sm font-medium drop-shadow-lg">ברוך הבא לחדר ההלבשה. הנה המצב שלך כרגע:</p>
            </div>

            <div className="flex justify-between gap-3 relative z-10 w-full mb-6">
               <div className="flex-1 bg-slate-900/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-700 text-center relative shadow-xl">
                  <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">ניקוד</div>
                  <div className="text-3xl font-black text-emerald-400 drop-shadow-lg">{userStats.points}</div>
                  {ptsDiff > 0 && <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-black text-white bg-gradient-to-r from-blue-600 to-blue-400 px-2 py-0.5 rounded-lg border border-blue-300 shadow-lg transform rotate-3 animate-pulse whitespace-nowrap z-20">+{ptsDiff} היום!</div>}
               </div>
               <div className="flex-1 bg-slate-900/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-700 text-center shadow-xl">
                  <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">מיקום</div>
                  <div className="text-3xl font-black text-amber-400 drop-shadow-lg">
                    {leaderboardInfo.rank > 0 ? leaderboardInfo.rank : "-"}
                  </div>
                  <div className="mt-1 flex justify-center">
                    {rankDiff > 0 && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/30">▲ עלית {rankDiff}</span>}
                    {rankDiff < 0 && <span className="text-[9px] font-bold text-rose-400 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-500/30">▼ ירדת {Math.abs(rankDiff)}</span>}
                    {rankDiff === 0 && <span className="text-[9px] font-bold text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50">- ללא שינוי</span>}
                  </div>
               </div>
            </div>

            <div className="flex gap-3 relative z-10 w-full mt-auto">
               <div className="flex-1 bg-amber-500/10 p-3 rounded-xl border border-amber-500/30 backdrop-blur-sm text-center">
                  <div className="text-[9px] text-amber-500/80 font-black mb-0.5 uppercase tracking-wider">🏆 כדור הזהב</div>
                  <div className="text-sm font-black text-amber-400 truncate">{currentLeader}</div>
               </div>
               {tournamentState >= 4 && (
                  <div className="flex-1 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/30 backdrop-blur-sm text-center">
                     <div className="text-[9px] text-emerald-500/80 font-black mb-0.5 uppercase tracking-wider">🔥 נעל הזהב</div>
                     <div className="text-sm font-black text-emerald-400 truncate">{currentKoLeader}</div>
                  </div>
               )}
            </div>
         </div>

         {dailyMessage && (
            <div 
               onClick={() => setShowMagazineModal(true)}
               className="w-[90%] md:w-auto shrink-0 snap-center rounded-3xl p-6 shadow-xl relative overflow-hidden bg-slate-900 border border-slate-700 group cursor-pointer flex flex-col hover:border-blue-500/50 transition-all duration-300"
            >
               <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-emerald-900/10 z-0"></div>
               <div className="absolute -bottom-10 -left-10 text-9xl opacity-5 transform -rotate-12 pointer-events-none group-hover:scale-110 transition-transform duration-500">📰</div>
               <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-blue-400 to-emerald-500"></div>

               <div className="relative z-10 flex justify-between items-start mb-4">
                  <div className="bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 backdrop-blur-sm text-slate-400 text-xs font-bold">
                     {new Date().toLocaleDateString('he-IL')}
                  </div>
                  <div className="text-3xl drop-shadow-md">📰</div>
               </div>

               <div className="relative z-10 mt-auto">
                  <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-2">המהדורה המרכזית</h2>
                  <p className="text-slate-300 text-sm font-medium leading-relaxed mb-6 line-clamp-3">
                     הודעות מהנהלת הטורניר, עדכונים חמים, סיכום המחזור, וכל מה שצריך לדעת כדי לא להישאר מאחור.
                  </p>
                  <button className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 w-full rounded-xl border border-slate-600 transition-colors flex justify-center items-center gap-2 text-sm shadow-md group-hover:bg-blue-600 group-hover:border-blue-500">
                     קרא את המהדורה המלאה <span>👈</span>
                  </button>
               </div>
            </div>
         )}
      </div>

      {/* 2. ציר הזמן (והכפתור החדש בתוכו) */}
      <div className="bg-slate-900 rounded-3xl border border-slate-700 shadow-xl flex flex-col lg:h-[600px] overflow-hidden">
         <div className="flex lg:hidden bg-slate-950 rounded-t-3xl border-b border-slate-700 shrink-0">
            <button 
              onClick={() => setTimelineTab("TODAY")}
              className={`flex-1 py-4 text-sm font-bold transition-all rounded-tr-3xl flex items-center justify-center gap-2 ${timelineTab === "TODAY" ? "bg-slate-800 text-white shadow-inner border-b-2 border-blue-500" : "text-slate-500 hover:bg-slate-900 hover:text-slate-300"}`}
            >
              <span>📅</span> מה צפוי היום
            </button>
            <button 
              onClick={() => setTimelineTab("YESTERDAY")}
              className={`flex-1 py-4 text-sm font-bold transition-all rounded-tl-3xl flex items-center justify-center gap-2 ${timelineTab === "YESTERDAY" ? "bg-slate-800 text-white shadow-inner border-b-2 border-emerald-500" : "text-slate-500 hover:bg-slate-900 hover:text-slate-300"}`}
            >
              <span>🧾</span> מה היה אתמול
            </button>
         </div>

         <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-800 rounded-b-3xl lg:rounded-3xl">
            <div className={`${timelineTab === "YESTERDAY" ? "flex" : "hidden"} lg:flex flex-col w-full lg:w-1/2 h-full bg-slate-800/50 lg:border-l border-slate-700`}>
               
               {/* כותרת דסקטופ (עם הכפתור החדש "תמונת מצב בתים") */}
               <div className="hidden lg:flex bg-slate-900/80 px-6 h-20 border-b border-slate-700 justify-between items-center z-10 shadow-sm shrink-0">
                 <h2 className="text-xl font-black text-white flex items-center gap-2"><span>🧾</span> מה היה לנו אתמול?</h2>
                 <div className="flex gap-2">
                   <button onClick={() => setShowRealStandingsModal(true)} className="text-[11px] text-emerald-400 font-bold bg-emerald-900/20 hover:bg-emerald-900/40 px-3 py-2 rounded transition-colors border border-emerald-500/30 whitespace-nowrap flex items-center gap-1.5 shadow-sm active:scale-95">
                     <span className="text-sm">🌍</span> תמונת מצב בתים
                   </button>
                   <button onClick={() => setShowFullHistory(!showFullHistory)} className="text-[11px] text-blue-400 font-bold bg-blue-900/20 hover:bg-blue-900/40 px-3 py-2 rounded transition-colors border border-blue-500/30 whitespace-nowrap shadow-sm active:scale-95">
                     {showFullHistory ? "הצג רק חדשים" : "היסטוריה מלאה"}
                   </button>
                 </div>
               </div>
               
               {/* כותרת מובייל (עם הכפתור החדש "תמונת מצב בתים") */}
               <div className="flex lg:hidden bg-slate-800 px-4 sm:px-6 py-4 border-b border-slate-700 justify-between items-center z-10 shadow-sm shrink-0 gap-2">
                  <div className="text-sm font-bold text-slate-300">נקודות שנכנסו:</div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setShowRealStandingsModal(true)} className="text-[10px] text-emerald-400 font-bold bg-emerald-900/20 hover:bg-emerald-900/40 px-2.5 py-1.5 rounded transition-colors border border-emerald-500/30 whitespace-nowrap flex items-center gap-1 shadow-sm active:scale-95">
                      <span className="text-sm">🌍</span> תמונת מצב בתים
                    </button>
                    <button onClick={() => setShowFullHistory(!showFullHistory)} className="text-[10px] text-blue-400 font-bold bg-blue-900/20 hover:bg-blue-900/40 px-2.5 py-1.5 rounded transition-colors border border-blue-500/30 whitespace-nowrap shadow-sm active:scale-95">
                      {showFullHistory ? "רק חדשים" : "הכל"}
                    </button>
                  </div>
               </div>
               
               <div className="overflow-y-auto custom-scrollbar flex-1 p-4 md:p-6 space-y-3 bg-slate-900/30">
                  {isFeedLoading ? (
                     <div className="text-center py-12 text-slate-500 animate-pulse font-bold text-sm">שולף קבלות...</div>
                  ) : pointsFeed.length === 0 ? (
                     <div className="flex flex-col items-center justify-center py-16 opacity-50 h-full">
                        <span className="text-4xl mb-3">🕸️</span>
                        <span className="text-slate-400 text-sm font-bold">הקופה ריקה בינתיים.</span>
                     </div>
                  ) : (!showFullHistory && ptsDiff <= 0) ? (
                     <div className="flex flex-col items-center justify-center py-16 text-center px-4 h-full">
                        <span className="text-5xl mb-4 opacity-80">📭</span>
                        <span className="text-slate-300 font-bold text-lg mb-2">לא נרשמו הכנסות חדשות</span>
                        <p className="text-slate-500 text-sm mb-4 leading-relaxed">אל תדאג, המשחקים הבאים מעבר לפינה.</p>
                        <button onClick={() => setShowFullHistory(true)} className="text-blue-400 text-sm font-bold underline hover:text-blue-300">הצג את כל הקבלות שאספתי</button>
                     </div>
                  ) : (
                     displayFeed.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700 hover:border-slate-500 transition-colors group shadow-sm max-w-xl mx-auto w-full">
                           <div className="flex items-center gap-3 md:gap-4">
                              <div className="text-2xl md:text-3xl bg-slate-900 w-12 h-12 flex items-center justify-center rounded-xl shadow-inner shrink-0 group-hover:scale-110 transition-transform">{item.icon}</div>
                              <div>
                                <div className="text-white font-bold text-sm md:text-base leading-tight">{item.title}</div>
                                <div className="text-[11px] md:text-xs text-slate-400 mt-1 font-medium bg-slate-900 inline-block px-2 py-0.5 rounded">{item.desc}</div>
                              </div>
                           </div>
                           <div className="text-emerald-400 font-black text-lg md:text-xl bg-emerald-950/30 px-4 py-2 rounded-lg border border-emerald-500/20 shrink-0">
                             +{item.points}
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </div>

            <div className={`${timelineTab === "TODAY" ? "flex" : "hidden"} lg:flex flex-col w-full lg:w-1/2 h-full bg-slate-800`}>
               <div className="hidden lg:flex bg-slate-900/80 px-6 h-20 border-b border-slate-700 justify-between items-center z-10 shadow-sm shrink-0">
                 <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 flex items-center gap-2"><span>📅</span> מה צפוי היום?</h2>
                 {(todayMatches.length > 0 && todayTargets.length > 0) && (
                   <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-700/50 shadow-inner">
                     <button onClick={() => { setActiveBannerMode("MATCHES"); setTodayMatchIndex(0); }} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${isMatchesMode ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}>⚽ משחקים</button>
                     <button onClick={() => { setActiveBannerMode("BONUS"); setTodayBonusIndex(0); }} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${!isMatchesMode ? "bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}>🎯 בונוסים</button>
                   </div>
                 )}
               </div>

               {(todayMatches.length > 0 && todayTargets.length > 0) && (
                 <div className="flex lg:hidden bg-slate-950 px-4 py-3 border-b border-slate-800 shrink-0 justify-center">
                    <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-700/50 shadow-inner w-full max-w-xs">
                      <button onClick={() => { setActiveBannerMode("MATCHES"); setTodayMatchIndex(0); }} className={`flex-1 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${isMatchesMode ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}>⚽ משחקים</button>
                      <button onClick={() => { setActiveBannerMode("BONUS"); setTodayBonusIndex(0); }} className={`flex-1 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${!isMatchesMode ? "bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}>🎯 בונוסים</button>
                    </div>
                 </div>
               )}

               <div className="flex-1 p-4 md:p-6 flex flex-col justify-center items-center relative overflow-y-auto">
                  {(todayMatches.length === 0 && todayTargets.length === 0) ? (
                    <div className="text-center py-10">
                      <div className="text-5xl mb-4 opacity-50">😴</div>
                      <h3 className="text-xl font-bold text-slate-300 mb-2">שקט היום על הדשא</h3>
                      <p className="text-slate-500 text-sm max-w-sm mx-auto">אין משחקים או נבחרות מהבונוסים שלך שמשחקות היום.</p>
                    </div>
                  ) : isMatchesMode ? (
                    todayMatches.length > 0 && (
                      <div className="w-full max-w-md mx-auto flex flex-col items-center animate-fade-in-up">
                         <div className="flex items-center justify-between w-full bg-slate-950 p-2 rounded-2xl border border-slate-800 mb-6 shadow-inner shrink-0">
                            <button onClick={handlePrevMatch} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 active:scale-95 text-lg">▶</button>
                            <div className="text-sm font-bold text-slate-400">משחק {todayMatchIndex + 1} מתוך {todayMatches.length}</div>
                            <button onClick={handleNextMatch} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 active:scale-95 text-lg">◀</button>
                         </div>

                         {currentDisplayedMatch && (() => {
                            const m = currentDisplayedMatch;
                            const hasPrediction = m.userPrediction && m.userPrediction.predictedHomeScore !== "" && m.userPrediction.predictedAwayScore !== "";
                            const locked = checkIsMatchLocked(m, tournamentState);
                            
                            return (
                              <div className={`w-full relative bg-slate-900 p-6 md:p-8 rounded-3xl border transition-all shadow-xl flex flex-col shrink-0 ${hasPrediction ? "border-blue-500/30" : "border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]"}`}>
                                 {Number(m.matchday) === 3 && m.stage !== "KNOCKOUT" && (
                                    <div className="absolute top-0 right-0 bg-gradient-to-r from-rose-600 to-red-500 text-white text-[10px] font-black px-3 py-1.5 rounded-bl-xl rounded-tr-3xl shadow-md border-b border-l border-rose-400/50">🔥 מחזור הכרעה</div>
                                 )}
                                 
                                 <div className="text-blue-400 text-xs font-bold mb-6 flex justify-between items-center">
                                   <span className="bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">🕒 {m.time}</span>
                                   <span className="bg-blue-900/30 px-3 py-1 rounded-lg border border-blue-500/20">{m.stage === "KNOCKOUT" ? m.roundName : `בית ${m.group}`}</span>
                                 </div>
                                 
                                 <div className="flex justify-between items-center text-white font-bold text-lg mb-6 bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-inner">
                                   <span className="flex-1 flex flex-col items-center gap-2 text-center" title={m.homeTeam}>
                                      {getFlagUrl(m.homeTeam) ? <img src={getFlagUrl(m.homeTeam)!} className="w-8 h-5 object-cover rounded shadow-sm" alt="flag" /> : "🏳️"} 
                                      <span className="truncate max-w-[80px] text-sm md:text-base">{m.homeTeam}</span>
                                   </span>
                                   <span className="text-slate-600 text-sm mx-2 font-black">VS</span>
                                   <span className="flex-1 flex flex-col items-center gap-2 text-center" title={m.awayTeam}>
                                      {getFlagUrl(m.awayTeam) ? <img src={getFlagUrl(m.awayTeam)!} className="w-8 h-5 object-cover rounded shadow-sm" alt="flag" /> : "🏳️"}
                                      <span className="truncate max-w-[80px] text-sm md:text-base">{m.awayTeam}</span>
                                   </span>
                                 </div>

                                 <div className="mt-auto border-t border-slate-700/50 pt-5">
                                   {hasPrediction ? (
                                      <div className="flex flex-col gap-3">
                                         <div className="text-sm font-black text-emerald-400 bg-emerald-900/20 py-3 rounded-xl border border-emerald-500/30 text-center shadow-sm">
                                           הניחוש שלך: {m.userPrediction.predictedHomeScore} - {m.userPrediction.predictedAwayScore}
                                         </div>
                                         {locked ? (
                                           <button onClick={() => handleOpenSpyForMatch(m)} className="w-full text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 py-3 rounded-xl border border-slate-600 text-center shadow-sm flex justify-center items-center gap-2 transition-all">
                                              <span className="text-base">👁️</span> הצג ניחושי חברים (ריגול)
                                           </button>
                                         ) : (
                                           <button onClick={() => setActiveTab(m.stage === "KNOCKOUT" ? 2 : 0)} className="w-full text-xs font-bold text-blue-300 bg-blue-900/20 hover:bg-blue-900/40 py-3 rounded-xl border border-blue-500/30 text-center shadow-sm flex justify-center items-center gap-2 transition-all">
                                              <span className="text-base">✍️</span> עדכן את הניחוש שלך
                                           </button>
                                         )}
                                      </div>
                                   ) : (
                                      <button onClick={() => setActiveTab(m.stage === "KNOCKOUT" ? 2 : 0)} className="w-full text-sm font-bold text-slate-900 bg-amber-500 hover:bg-amber-400 py-3 rounded-xl text-center shadow-md transition-transform active:scale-95 animate-pulse">
                                        הזן ניחוש למשחק זה! ⚠️
                                      </button>
                                   )}
                                 </div>
                              </div>
                            );
                         })()}
                      </div>
                    )
                  ) : (
                    todayTargets.length > 0 && (
                      <div className="w-full max-w-md mx-auto flex flex-col items-center animate-fade-in-up">
                         <div className="flex items-center justify-between w-full bg-slate-950 p-2 rounded-2xl border border-slate-800 mb-6 shadow-inner shrink-0">
                            <button onClick={handlePrevBonus} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 active:scale-95 text-lg">▶</button>
                            <div className="text-sm font-bold text-slate-400">בונוס {todayBonusIndex + 1} מתוך {todayTargets.length}</div>
                            <button onClick={handleNextBonus} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 active:scale-95 text-lg">◀</button>
                         </div>

                         {currentDisplayedBonus && (() => {
                            const target = currentDisplayedBonus;
                            return (
                              <div className="w-full bg-slate-900 p-6 md:p-8 rounded-3xl border border-rose-500/30 shadow-xl flex flex-col text-center shrink-0">
                                 {target.isSurvival ? (
                                    <>
                                      <div className="text-5xl mb-4 drop-shadow-md">🛡️</div>
                                      <h3 className="text-xl md:text-2xl font-bold text-emerald-400 mb-3">משחק הישרדות!</h3>
                                      <p className="text-sm text-slate-300 leading-relaxed mb-8">
                                        הימרת שזה <strong className="text-rose-400">לא</strong> יקרה לאף נבחרת.<br/>תחזיק אצבעות גם במשחקי היום: <br/>
                                        <strong className="text-white bg-slate-950 px-4 py-2 rounded-xl mt-4 inline-block text-xs border border-slate-700 shadow-inner">"{target.questionLabel}"</strong>
                                      </p>
                                    </>
                                 ) : (
                                    <>
                                      <div className="flex justify-center mb-4">
                                        {getFlagUrl(target.team) ? <img src={getFlagUrl(target.team)!} className="w-16 h-10 object-cover rounded shadow-md" alt="flag" /> : <span className="text-5xl text-rose-400">🏳️</span>}
                                      </div>
                                      <h3 className="text-xl md:text-2xl font-bold text-white mb-3"><span className="text-rose-400">{target.team}</span> עולה לדשא!</h3>
                                      <p className="text-sm text-slate-300 leading-relaxed mb-8">
                                        הרווחת נקודות אם היא תקיים היום את התנאי: <br/>
                                        <strong className="text-white bg-slate-950 px-4 py-2 rounded-xl mt-4 inline-block text-xs border border-slate-700 shadow-inner">"{target.questionLabel}"</strong>
                                      </p>
                                    </>
                                 )}
                                 <div className="mt-auto">
                                   <div className={`text-white px-6 py-4 rounded-xl text-lg font-black shadow-md drop-shadow-md w-full ${target.isSurvival ? "bg-gradient-to-r from-emerald-600 to-teal-500" : "bg-gradient-to-r from-rose-600 to-orange-500"}`}>
                                     קופה אפשרית: +{target.points} נק'
                                   </div>
                                 </div>
                              </div>
                            );
                         })()}
                      </div>
                    )
                  )}
               </div>
            </div>
         </div>
      </div>

      {/* 3. זירת הקרב */}
      <div className="bg-slate-900 rounded-3xl border border-slate-700 shadow-xl flex flex-col h-[400px]">
         <div className="flex bg-slate-950 rounded-t-3xl border-b border-slate-700 shrink-0">
            <button 
              onClick={() => setArenaTab("NEMESIS")}
              className={`flex-1 py-4 text-sm font-bold transition-colors rounded-tr-3xl flex items-center justify-center gap-2 ${arenaTab === "NEMESIS" ? "bg-slate-800 text-white shadow-inner border-b-2 border-rose-500" : "text-slate-500 hover:bg-slate-900 hover:text-slate-300"}`}
            >
              <span>🎯</span> קרב 1-על-1
            </button>
            <button 
              onClick={() => setArenaTab("LEAGUES")}
              className={`flex-1 py-4 text-sm font-bold transition-colors rounded-tl-3xl flex items-center justify-center gap-2 ${arenaTab === "LEAGUES" ? "bg-slate-800 text-white shadow-inner border-b-2 border-indigo-500" : "text-slate-500 hover:bg-slate-900 hover:text-slate-300"}`}
            >
              <span>🏟️</span> ליגות פרטיות
            </button>
         </div>

         <div className="p-6 flex-1 flex flex-col overflow-hidden bg-slate-800 rounded-b-3xl">
           {arenaTab === "NEMESIS" && (
              <div className="h-full flex flex-col justify-center">
                 {!nemesisData ? (
                   <div className="text-center animate-fade-in-up max-w-sm mx-auto w-full">
                      <div className="text-white font-bold mb-2 text-base">בחר יריב מושבע</div>
                      <p className="text-xs text-slate-400 mb-4">מעקב לייב מול החבר מהמשרד שחייב להפסיד.</p>
                      <select 
                        value={nemesisInput} onChange={(e) => setNemesisInput(e.target.value)}
                        className="w-full bg-slate-950 text-white p-3 rounded-xl border border-slate-600 mb-4 outline-none focus:border-purple-500 text-sm font-bold shadow-inner"
                      >
                        <option value="">בחר משתמש...</option>
                        {allUsersList.filter(u => u.id !== userId).map(u => (<option key={u.id} value={u.id}>{u.name}</option>))}
                      </select>
                      <button onClick={handleSaveNemesis} disabled={isSavingNemesis || !nemesisInput} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-md text-sm">
                        {isSavingNemesis ? "שומר..." : "התחל קרב! ⚔️"}
                      </button>
                   </div>
                 ) : (
                   <div className="bg-gradient-to-b from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 shadow-inner h-full flex flex-col justify-center animate-fade-in-up relative">
                      <div className="flex justify-between items-start mb-6">
                         <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">ראש בראש</span>
                         <button onClick={handleClearNemesis} className="text-slate-400 hover:text-rose-400 transition-colors text-[10px] font-bold bg-slate-900/50 px-2.5 py-1.5 rounded border border-slate-700 hover:border-rose-500/50 flex items-center gap-1 shadow-sm shrink-0" title="בטל יריבות">
                           <span>✕</span> החלף יריב
                         </button>
                      </div>
                      
                      <div className="flex justify-between items-center my-auto">
                         <div className="flex flex-col items-center flex-1 w-2/5">
                            <span className="text-[11px] bg-blue-600 text-white px-2 py-0.5 rounded font-black mb-2 shadow-sm">אתה</span>
                            <span className="text-sm md:text-base font-bold text-white truncate max-w-[100px] md:max-w-[120px]">{userName?.split(" ")[0]}</span>
                            <span className="text-4xl font-black text-blue-400 mt-2">{userStats.points}</span>
                         </div>
                         <div className="flex flex-col items-center px-1 shrink-0"><span className="text-3xl font-black text-slate-600 italic">VS</span></div>
                         <div className="flex flex-col items-center flex-1 w-2/5">
                            <span className="text-[11px] bg-rose-600 text-white px-2 py-0.5 rounded font-black mb-2 shadow-sm">היריב</span>
                            <span className="text-sm md:text-base font-bold text-white truncate max-w-[100px] md:max-w-[120px]">{nemesisData.name?.split(" ")[0]}</span>
                            <span className="text-4xl font-black text-rose-400 mt-2">{nemesisData.totalPoints || 0}</span>
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
                           <div className="mt-8">
                              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden flex border border-slate-700/50 relative shadow-inner">
                                 <div className="h-full bg-blue-500 transition-all duration-1000 ease-out" style={{ width: `${myPercent}%` }}></div>
                                 <div className="h-full bg-rose-500 transition-all duration-1000 ease-out" style={{ width: `${100 - myPercent}%` }}></div>
                                 <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-white/30 z-10"></div>
                              </div>
                              <div className="text-center mt-3 text-[11px] font-bold text-slate-300">{msg}</div>
                           </div>
                         );
                      })()}
                   </div>
                 )}
              </div>
           )}

           {arenaTab === "LEAGUES" && (
              <div className="h-full flex flex-col animate-fade-in-up">
                 <div className="flex gap-3 mb-4 shrink-0">
                    <button onClick={handleCreateLeague} disabled={isLeagueLoading} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-3 rounded-xl border border-slate-600 transition-colors shadow-sm">
                       ➕ צור ליגה
                    </button>
                    <button onClick={handleJoinLeague} disabled={isLeagueLoading} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-3 rounded-xl border border-slate-600 transition-colors shadow-sm">
                       🔗 הצטרף עם קוד
                    </button>
                 </div>
                 
                 <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 space-y-3">
                    {myLeagues.length === 0 ? (
                       <div className="text-center text-slate-500 text-sm py-10 px-4 leading-relaxed">
                          עדיין לא הצטרפת לשום ליגה פרטית.<br/>צור אחת ושתף את הקוד עם החברים!
                       </div>
                    ) : (
                       myLeagues.map(league => {
                          const isMyLeague = league.adminId === userId;
                          return (
                             <div 
                                key={league.id} 
                                onClick={() => setSelectedLeague(league)}
                                className="bg-slate-900 p-4 rounded-2xl border border-slate-700 cursor-pointer hover:border-blue-500 transition-colors group flex justify-between items-center shadow-sm"
                             >
                                <div className="flex flex-col truncate pr-2">
                                   <span className="font-bold text-slate-200 text-base truncate">{league.name}</span>
                                   <div className="flex items-center gap-2 mt-1.5">
                                      <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">👤 {league.members?.length || 1} חברים</span>
                                      {isMyLeague && <span className="text-[10px] text-blue-400 bg-blue-900/20 border border-blue-500/30 px-2 py-0.5 rounded" title="קוד ההצטרפות לליגה">קוד: {league.pin}</span>}
                                   </div>
                                </div>
                                <div className="text-slate-600 group-hover:text-blue-400 transition-colors bg-slate-800 w-10 h-10 flex items-center justify-center rounded-full text-lg shadow-inner">▶</div>
                             </div>
                          );
                       })
                    )}
                 </div>
              </div>
           )}
         </div>
      </div>

      {/* 4. נתונים יבשים */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-800">
         <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button onClick={() => setActiveTab(0)} className="bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-300 p-3 rounded-2xl border border-slate-700 flex flex-col items-center justify-center gap-1.5 transition-all group shadow-sm">
              <span className="text-2xl group-hover:scale-110 transition-transform">⚽</span>
              <span className="font-bold text-[11px]">משחקים</span>
            </button>
            <button onClick={() => setActiveTab(1)} className="bg-slate-800 hover:bg-teal-500 hover:text-slate-900 text-slate-300 p-3 rounded-2xl border border-slate-700 flex flex-col items-center justify-center gap-1.5 transition-all group shadow-sm">
              <span className="text-2xl group-hover:scale-110 transition-transform">🥉</span>
              <span className="font-bold text-[11px]">מקום 3</span>
            </button>
            <button onClick={() => setActiveTab(4)} className="bg-slate-800 hover:bg-amber-500 hover:text-slate-900 text-slate-300 p-3 rounded-2xl border border-slate-700 flex flex-col items-center justify-center gap-1.5 transition-all group shadow-sm">
              <span className="text-2xl group-hover:scale-110 transition-transform">⭐</span>
              <span className="font-bold text-[11px]">בונוסים</span>
            </button>
            <button onClick={() => setActiveTab(3)} className="bg-slate-800 hover:bg-emerald-500 hover:text-slate-900 text-slate-300 p-3 rounded-2xl border border-slate-700 flex flex-col items-center justify-center gap-1.5 transition-all group shadow-sm">
              <span className="text-2xl group-hover:scale-110 transition-transform">🏆</span>
              <span className="font-bold text-[11px]">טבלה</span>
            </button>
         </div>

         <div className="md:col-span-1 grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 p-4 rounded-2xl border border-blue-500/20 flex flex-col items-center justify-center text-center shadow-inner">
               <div className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">משתתפים בטורניר</div>
               <div className="text-2xl font-black text-blue-400">{leaderboardInfo.totalUsers}</div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-2xl border border-emerald-500/20 flex flex-col items-center justify-center text-center shadow-inner">
               <div className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">ממוצע ניקוד למשתמש</div>
               <div className="text-2xl font-black text-emerald-400">{avgPoints}</div>
            </div>
         </div>
      </div>

      {/* מודל המהדורה המרכזית */}
      {showMagazineModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fade-in-up" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 p-6 md:p-8 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-blue-400 to-emerald-500"></div>
            
            <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-4 pr-4">
              <div>
                <h3 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 flex items-center gap-3">
                   <span className="text-white drop-shadow-md">📰</span> המהדורה המרכזית
                </h3>
                <div className="text-slate-500 text-sm font-medium mt-1">
                   {new Date().toLocaleDateString('he-IL')}
                </div>
              </div>
              <button onClick={() => setShowMagazineModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors font-black text-lg border border-slate-700">✕</button>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 pr-4 pb-4">
                 <div className="text-slate-200 text-base md:text-lg leading-relaxed whitespace-pre-wrap
                                 [&_div]:w-full
                                 [&_b]:text-amber-400 [&_strong]:text-amber-400
                                 [&_i]:text-slate-400 [&_u]:underline [&_u]:decoration-blue-400 [&_u]:underline-offset-4
                                 [&_h1]:text-2xl md:[&_h1]:text-3xl [&_h1]:font-black [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:text-transparent [&_h1]:bg-clip-text [&_h1]:bg-gradient-to-r [&_h1]:from-blue-400 [&_h1]:to-emerald-400
                                 [&_h2]:text-xl md:[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-blue-300
                                 [&_h3]:text-lg md:[&_h3]:text-xl [&_h3]:font-bold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-emerald-300
                                 [&_h4]:text-base md:[&_h4]:text-lg [&_h4]:font-bold [&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:text-slate-300
                                 [&_mark]:px-1.5 [&_mark]:rounded [&_mark]:font-bold
                                 [&_mark.yellow]:!bg-amber-500/20 [&_mark.yellow]:!text-amber-300
                                 [&_mark.green]:!bg-emerald-500/20 [&_mark.green]:!text-emerald-300
                                 [&_mark.blue]:!bg-blue-500/20 [&_mark.blue]:!text-blue-300
                                 [&_mark.red]:!bg-rose-500/20 [&_mark.red]:!text-rose-400
                                 [&_blockquote]:border-r-4 [&_blockquote]:border-emerald-500 [&_blockquote]:bg-slate-800/50 [&_blockquote]:p-5 [&_blockquote]:rounded-l-2xl [&_blockquote]:my-6 [&_blockquote]:italic [&_blockquote]:text-slate-300
                                 [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-2 [&_ul]:my-4 [&_ul]:text-slate-300
                                 [&_hr]:border-slate-700 [&_hr]:my-8
                                 [&_img]:inline-block [&_img]:rounded-2xl [&_img]:shadow-lg [&_img]:my-6 [&_img]:max-h-[300px] md:[&_img]:max-h-[400px] [&_img]:w-auto [&_img]:max-w-full [&_img]:object-contain [&_img]:border [&_img]:border-slate-700
                                 [&_a]:text-cyan-400 [&_a]:underline hover:[&_a]:text-cyan-300" 
                      dangerouslySetInnerHTML={{ __html: dailyMessage }} 
                 />
            </div>
            
            <div className="pt-4 mt-2 border-t border-slate-800 flex justify-end">
               <button onClick={() => setShowMagazineModal(false)} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl font-bold transition-colors border border-slate-600">
                  סגור
               </button>
            </div>
          </div>
        </div>
      )}

      {/* מודל טבלאות אמת עם הכותרת החדשה */}
      {showRealStandingsModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-2 md:p-4 backdrop-blur-md animate-fade-in-up" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 p-2 md:p-6 rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl relative overflow-hidden md:resize">
            
            <div className="flex justify-between items-center mb-4 px-2 pt-2 md:px-0 md:pt-0 border-b border-slate-800 pb-4 shrink-0">
              <div>
                <h3 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
                   <span>🌍</span> תמונת מצב בתים (LIVE)
                </h3>
                <p className="text-slate-400 text-xs md:text-sm mt-1 hidden sm:block">הטבלאות מתעדכנות בזמן אמת. להמחשה מוצג כרגע מונדיאל 2022.</p>
              </div>
              <button onClick={() => setShowRealStandingsModal(false)} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors font-black text-lg border border-slate-700">✕</button>
            </div>

            <div className="flex-1 w-full bg-white rounded-xl overflow-hidden shadow-inner">
               <iframe 
                 id="sofa-standings-embed-1" 
                 width="100%" 
                 height="100%" 
                 src="https://widgets.sofascore.com/embed/tournament/16/season/41087/standings/regular?widgetTitle=World Cup" 
                 frameBorder="0" 
                 scrolling="yes"
                 className="w-full h-full"
               ></iframe>
            </div>
            
          </div>
        </div>
      )}

      {selectedLeague && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-fade-in-up" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl relative">
            
            <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-800">
              <div className="pr-1">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                   <span>🏟️</span> טבלת {selectedLeague.name}
                </h3>
                <div className="flex items-center gap-3 mt-1.5">
                   <p className="text-slate-400 text-sm">קוד: <strong className="text-blue-400 font-mono tracking-widest bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-500/30">{selectedLeague.pin}</strong></p>
                </div>
              </div>
              <button onClick={() => setSelectedLeague(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors font-black text-sm border border-slate-700">✕</button>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 pr-2 mb-4">
               <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-right">
                     <thead className="bg-slate-900/80 text-slate-500 text-xs uppercase tracking-widest border-b border-slate-800">
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
                                 <tr key={u.id} className={`border-b border-slate-800/50 ${isMe ? 'bg-blue-900/20' : 'hover:bg-slate-800/50'}`}>
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
               <button onClick={() => handleLeaveLeague(selectedLeague.id, selectedLeague.name)} className="text-xs text-rose-500 hover:text-rose-400 font-bold underline transition-colors p-2">
                  🚪 עזוב את הליגה
               </button>
            </div>

          </div>
        </div>
      )}

      {spyModalMatch && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-fade-in-up" dir="rtl">
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 p-5 md:p-6 rounded-3xl w-full max-w-md md:max-w-[600px] md:min-w-[400px] min-h-[500px] h-[85vh] md:h-[650px] md:max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden md:resize">
            
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-700/50 shrink-0">
                <h3 className="text-xl font-black text-white flex items-center gap-2"><span>🕵️‍♂️</span> חדר בקרה</h3>
                <button onClick={() => setSpyModalMatch(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors font-black border border-slate-700 hover:border-rose-500/30">✕</button>
            </div>
            
            <div className="bg-slate-900 rounded-2xl mb-4 border border-slate-700/50 overflow-hidden shadow-inner shrink-0">
               <div className="bg-slate-800/80 p-2 text-center text-[10px] text-blue-400 font-black uppercase tracking-widest">{spyModalMatch.stage === "KNOCKOUT" ? spyModalMatch.roundName : `מחזור ${Number(spyModalMatch.matchday) || 1}`}</div>
               <div className="p-4 flex justify-between items-center text-sm font-bold text-slate-300 gap-2">
                 <div className="flex flex-col items-center flex-1 w-2/5 text-center">
                   <span className="text-sm sm:text-base font-black text-white mb-1 tracking-tight flex flex-wrap items-center justify-center gap-1.5 w-full leading-snug">
                     {getFlagUrl(spyModalMatch.homeTeam) ? <img src={getFlagUrl(spyModalMatch.homeTeam)!} className="w-6 h-4 object-cover rounded-sm shadow-sm" alt="flag" /> : <span>🏳️</span>}
                     {spyModalMatch.homeTeam}
                   </span>
                   {spyModalMatch.isFinished && <span className="text-emerald-400 text-[10px] uppercase font-black bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/20 mt-1">אמת: {spyModalMatch.realHomeScore}</span>}
                 </div>
                 <span className="text-slate-600 px-1 font-black text-lg">VS</span>
                 <div className="flex flex-col items-center flex-1 w-2/5 text-center">
                   <span className="text-sm sm:text-base font-black text-white mb-1 tracking-tight flex flex-wrap items-center justify-center gap-1.5 w-full leading-snug">
                     {spyModalMatch.awayTeam}
                     {getFlagUrl(spyModalMatch.awayTeam) ? <img src={getFlagUrl(spyModalMatch.awayTeam)!} className="w-6 h-4 object-cover rounded-sm shadow-sm" alt="flag" /> : <span>🏳️</span>}
                   </span>
                   {spyModalMatch.isFinished && <span className="text-emerald-400 text-[10px] uppercase font-black bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/20 mt-1">אמת: {spyModalMatch.realAwayScore}</span>}
                 </div>
               </div>
            </div>

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

            {spyModalMatch && spyModalMatch.isFinished && (() => {
              const spyStats = { exact: 0, direction: 0, miss: 0 };
              spyData.forEach(d => {
                const pH = Number(d.predictedHomeScore); const pA = Number(d.predictedAwayScore);
                const rH = Number(spyModalMatch.realHomeScore); const rA = Number(spyModalMatch.realAwayScore);
                if (pH === rH && pA === rA) spyStats.exact++;
                else if (Math.sign(pH - pA) === Math.sign(rH - rA)) spyStats.direction++;
                else spyStats.miss++;
              });

              return (
                <div className="grid grid-cols-2 md:flex md:justify-center gap-2 mb-4 shrink-0">
                  <button onClick={() => setSpyFilter("ALL")} className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1 ${spyFilter === "ALL" ? "bg-slate-700 text-white border-slate-500 shadow-sm" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"}`}>
                    הכל ({spyData.length})
                  </button>
                  <button onClick={() => setSpyFilter("EXACT")} className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1.5 ${spyFilter === "EXACT" ? "bg-emerald-900/40 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.15)]" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"}`}>
                    🎯 בול ({spyStats.exact})
                  </button>
                  <button onClick={() => setSpyFilter("DIRECTION")} className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1.5 ${spyFilter === "DIRECTION" ? "bg-amber-900/40 text-amber-400 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.1)]" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"}`}>
                    ✅ כיוון ({spyStats.direction})
                  </button>
                  <button onClick={() => setSpyFilter("MISS")} className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-colors border flex justify-center items-center gap-1.5 ${spyFilter === "MISS" ? "bg-rose-900/40 text-rose-400 border-rose-500/50 shadow-[0_0_10px_rgba(225,29,72,0.1)]" : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"}`}>
                    ❌ נפילה ({spyStats.miss})
                  </button>
                </div>
              );
            })()}
            
            <div className="overflow-y-auto custom-scrollbar flex-1 pl-2 md:pl-4 pr-1 pb-2">
              {isLoadingSpy ? (<div className="flex justify-center py-8 text-blue-400 animate-pulse font-black tracking-wide">טוען נתונים מהשטח... ⏳</div>) : filteredSpyData.length === 0 ? (<div className="text-center text-slate-500 py-8 font-bold">לא נמצאו ניחושים שמתאימים לחיפוש.</div>) : (
                <div className="space-y-2">
                  {filteredSpyData.map((data, idx) => {
                    let cardStyle = "px-3 py-2.5 rounded-xl border transition-all ";
                    if (spyModalMatch.isFinished) {
                      const pH = Number(data.predictedHomeScore); const pA = Number(data.predictedAwayScore);
                      const rH = Number(spyModalMatch.realHomeScore); const rA = Number(spyModalMatch.realAwayScore);
                      if (pH === rH && pA === rA) cardStyle += "bg-emerald-900/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]";
                      else if (Math.sign(pH - pA) === Math.sign(rH - rA)) cardStyle += "bg-amber-900/10 border-amber-500/30";
                      else cardStyle += "bg-rose-900/10 border-rose-500/20 opacity-80";
                    } else {
                      cardStyle += data.userId === userId ? "bg-blue-900/10 border-blue-500/30" : "bg-slate-900/50 border-slate-800 hover:bg-slate-800";
                    }

                    return (
                      <div key={idx} className={cardStyle}>
                        <div className="flex justify-between items-center mb-2">
                            <div className="font-bold text-slate-200 flex items-center gap-2">
                              <div className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black border shrink-0 ${
                                data.userRank === 1 ? "bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.3)]" :
                                data.userRank === 2 ? "bg-slate-400/20 text-slate-300 border-slate-400/50 shadow-[0_0_8px_rgba(148,163,184,0.2)]" :
                                data.userRank === 3 ? "bg-orange-700/30 text-orange-400 border-orange-500/40 shadow-[0_0_8px_rgba(249,115,22,0.2)]" :
                                "bg-slate-600 text-white border-slate-500 shadow-sm"
                              }`}>
                                {data.userRank || "-"}
                              </div>
                              <span className="text-sm truncate max-w-[110px] sm:max-w-[160px]">{data.userName}</span>
                              {data.userId === userId && <span className="text-[8px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase">אתה</span>}
                            </div>
                            <div className="text-[9px] font-bold text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-700/50 shrink-0">
                              סה״כ: <span className="text-amber-400">{data.userTotalPoints}</span>
                            </div>
                        </div>
                        
                        <div className="flex justify-between items-center">
                            <div className="flex justify-center items-center gap-3 pl-2">
                                <span className="text-lg font-black text-white bg-slate-950 border border-slate-700 w-9 h-9 flex items-center justify-center rounded-lg shadow-inner">{data.predictedHomeScore}</span>
                                <span className="text-slate-600 font-black text-sm">:</span>
                                <span className="text-lg font-black text-white bg-slate-950 border border-slate-700 w-9 h-9 flex items-center justify-center rounded-lg shadow-inner">{data.predictedAwayScore}</span>
                            </div>
                            
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              {spyModalMatch.stage === "KNOCKOUT" && data.qualifier && (
                                <span className="text-[9px] bg-purple-500/10 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/20 font-bold uppercase tracking-wide flex items-center gap-1 w-fit">
                                  {getFlagUrl(data.qualifier) ? <img src={getFlagUrl(data.qualifier)!} className="w-3 h-2 object-cover rounded-sm shadow-sm" alt="flag" /> : <span className="text-[8px]">🏳️</span>}
                                  {data.qualifier}
                                </span>
                              )}
                              
                              {spyModalMatch.isFinished && data.points !== null && (
                                <div>
                                  {(() => {
                                    if (data.points === 0) return <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 bg-rose-950/50 text-rose-400 border border-rose-500/40 px-2 py-1 rounded text-[10px] font-black shadow-sm">0 נק'</span>;
                                    if (data.points > 0 && data.points < 15) return <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 bg-amber-900/40 text-amber-400 border border-amber-500/50 px-2 py-1 rounded text-[10px] font-black shadow-sm">+{data.points} נק'</span>;
                                    if (data.points >= 15) return <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 bg-emerald-900/40 text-emerald-400 border border-emerald-500/50 px-2 py-1 rounded text-[10px] font-black shadow-[0_0_10px_rgba(16,185,129,0.2)]">🎯 +{data.points} נק'</span>;
                                    return <span className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 bg-blue-900/40 text-blue-400 border border-blue-500/40 px-2 py-1 rounded text-[10px] font-black shadow-sm">+{data.points} נק'</span>;
                                  })()}
                                </div>
                              )}
                            </div>
                        </div>
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