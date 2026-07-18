// components/admin/AdminScenariosTab.tsx
"use client";
import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../app/firebase";
import toast from "react-hot-toast";

interface User {
  id: string;
  displayName: string;
  totalPoints: number;
  knockoutPoints: number;
  rank?: number;
}

interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  stage: string;
  roundName: string;
  isFinished: boolean;
}

interface MatchPrediction {
  userId: string;
  matchId: string;
  predictedHomeScore: string;
  predictedAwayScore: string;
  qualifier: string;
}

interface BonusQuestion {
  id: string;
  question: string;
  points: number;
  isProximity: boolean;
  answerType: string;
  options?: any;
}

interface ScenarioItem {
  varId: string;
  varName: string;
  label: string;
  outcome: any;
}

interface SimulatedUserRank {
  userId: string;
  userName: string;
  score: number;
  rank: number;
}

interface UserScenarioResult {
  dream: ScenarioItem[] | null;
  dreamTargetRank: number | null;
  dreamTable?: SimulatedUserRank[] | null;
  nightmare: ScenarioItem[] | null;
  nightmareTable?: SimulatedUserRank[] | null;
  timestamp: string;
}

export default function AdminScenariosTab() {
  const [isLoading, setIsLoading] = useState(false);
  const [calculatingUserId, setCalculatingUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [openTableKey, setOpenTableKey] = useState<string | null>(null);
  
  // Data state
  const [users, setUsers] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [bonusQuestions, setBonusQuestions] = useState<BonusQuestion[]>([]);
  const [matchPredictions, setMatchPredictions] = useState<MatchPrediction[]>([]);
  const [bonusPredictions, setBonusPredictions] = useState<Record<string, Record<string, string>>>({});
  
  // Precomputed variables for simulation
  const [precomputed, setPrecomputed] = useState<{
    variables: any[];
    maxSuffixSum: number[];
    topUsers: User[];
    matchPredsMap: Record<string, Record<string, MatchPrediction>>;
    rbBlacklist: any;
  } | null>(null);

  // Per-user simulation results
  const [userResults, setUserResults] = useState<Record<string, UserScenarioResult>>({});

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Get users
      const usersSnap = await getDocs(collection(db, "users"));
      const usersList: User[] = [];
      usersSnap.forEach(d => {
        const data = d.data();
        usersList.push({
          id: d.id,
          displayName: data.name || data.displayName || d.id,
          totalPoints: Number(data.totalPoints) || 0,
          knockoutPoints: Number(data.knockoutPoints) || 0
        });
      });
      usersList.sort((a, b) => b.totalPoints - a.totalPoints);
      
      // Calculate ranks including ties
      let currentRank = 1;
      usersList.forEach((u, i) => {
        if (i > 0 && u.totalPoints < usersList[i - 1].totalPoints) {
          currentRank = i + 1;
        }
        u.rank = currentRank;
      });
      setUsers(usersList);

      // 2. Get matches
      const matchesSnap = await getDocs(collection(db, "matches"));
      const matchesList: Match[] = [];
      matchesSnap.forEach(d => {
        const data = d.data();
        matchesList.push({
          id: d.id,
          homeTeam: data.homeTeam,
          awayTeam: data.awayTeam,
          stage: data.stage,
          roundName: data.roundName,
          isFinished: !!data.isFinished
        });
      });
      setMatches(matchesList);

      // 3. Get bonus questions settings & results
      const bqSnap = await getDoc(doc(db, "settings", "bonus_questions"));
      const questionsData = bqSnap.exists() ? bqSnap.data().questions || [] : [];
      
      const rbSnap = await getDoc(doc(db, "admin_results", "bonus"));
      const rbData = rbSnap.exists() ? rbSnap.data() : {};
      const rbAnswers = rbData.answers || {};
      const rbBlacklist = rbData.blacklist || {};
      const rbLeading = rbData.leading || {};

      // Filter only open bonus questions
      const openBonuses: BonusQuestion[] = [];
      questionsData.forEach((q: any) => {
        if (q.id === "bq_1783463384597") return; // Skip Quarterfinal Double Game which is already factored in
        const ans = rbAnswers[q.id];
        const hasAnswer = ans !== undefined && ans !== null && (Array.isArray(ans) ? ans.length > 0 : String(ans).trim() !== "");
        if (!hasAnswer) {
          openBonuses.push({
            id: q.id,
            question: q.label || q.question || q.text || q.qText || q.title || JSON.stringify(q),
            points: Number(q.points) || 15,
            isProximity: !!q.isProximity,
            answerType: q.answerType || "",
            options: q.options
          });
        }
      });
      setBonusQuestions(openBonuses);

      // 4. Get match predictions
      const predMatchesSnap = await getDocs(collection(db, "predictions_knockout"));
      const mPreds: MatchPrediction[] = [];
      predMatchesSnap.forEach(d => {
        const data = d.data();
        mPreds.push({
          userId: data.userId,
          matchId: data.matchId,
          predictedHomeScore: String(data.predictedHomeScore || ""),
          predictedAwayScore: String(data.predictedAwayScore || ""),
          qualifier: data.qualifier || ""
        });
      });
      setMatchPredictions(mPreds);

      // 5. Get bonus predictions
      const predBonusSnap = await getDocs(collection(db, "predictions_bonus"));
      const bPreds: Record<string, Record<string, string>> = {};
      predBonusSnap.forEach(d => {
        bPreds[d.id] = d.data().answers || {};
      });
      setBonusPredictions(bPreds);

      // 6. Precompute variables list sorted by max points descending
      precomputeVariables(usersList, matchesList, openBonuses, mPreds, bPreds, rbBlacklist, rbLeading);
      
      toast.success("הנתונים נטענו בהצלחה!");
    } catch (e: any) {
      console.error(e);
      toast.error(`שגיאה בטעינת נתונים: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const precomputeVariables = (
    usersList: User[],
    matchesList: Match[],
    openBonuses: BonusQuestion[],
    mPreds: MatchPrediction[],
    bPreds: Record<string, Record<string, string>>,
    rbBlacklist: any = {},
    rbLeading: any = {}
  ) => {
    const parseConfigArray = (val: any): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) {
        return val.map(s => String(s).trim().toLowerCase()).filter(Boolean);
      }
      return String(val).split(',').map(s => String(s).trim().toLowerCase()).filter(s => s !== "");
    };
    // Top 15 users simulation set
    const topUsers = usersList.slice(0, 15);
    const topIds = topUsers.map(u => u.id);

    const matchPredsMap: Record<string, Record<string, MatchPrediction>> = {};
    mPreds.forEach(p => {
      if (topIds.includes(p.userId)) {
        if (!matchPredsMap[p.matchId]) matchPredsMap[p.matchId] = {};
        matchPredsMap[p.matchId][p.userId] = p;
      }
    });

    const unfinishedMatches = matchesList.filter(m => !m.isFinished && m.stage === "KNOCKOUT");
    const variables: any[] = [];

    // Add match variables
    unfinishedMatches.forEach(m => {
      const preds = topUsers.map(u => matchPredsMap[m.id]?.[u.id]).filter(Boolean);
      const uniqueScores = Array.from(new Set(preds.map(p => `${p.predictedHomeScore}-${p.predictedAwayScore}`)));
      
      const outcomes: any[] = [];
      uniqueScores.forEach(scoreStr => {
        const [h, a] = scoreStr.split('-').map(Number);
        const qualifier = h > a ? m.homeTeam : (a > h ? m.awayTeam : m.homeTeam);
        outcomes.push({
          type: "MATCH",
          matchId: m.id,
          realHomeScore: h,
          realAwayScore: a,
          realQualifier: qualifier,
          label: `${m.homeTeam} ${h}-${a} ${m.awayTeam} (${qualifier} עולה)`
        });
      });
      
      outcomes.push({
        type: "MATCH",
        matchId: m.id,
        realHomeScore: 3,
        realAwayScore: 0,
        realQualifier: m.homeTeam,
        label: `${m.homeTeam} מנצחת בתוצאה אחרת (למשל 3-0)`
      });
      outcomes.push({
        type: "MATCH",
        matchId: m.id,
        realHomeScore: 0,
        realAwayScore: 3,
        realQualifier: m.awayTeam,
        label: `${m.awayTeam} מנצחת בתוצאה אחרת (למשל 0-3)`
      });
      outcomes.push({
        type: "MATCH",
        matchId: m.id,
        realHomeScore: 1,
        realAwayScore: 1,
        realQualifier: m.homeTeam,
        label: `תיקו (למשל 1-1), ${m.homeTeam} עולה בפנדלים`
      });
      outcomes.push({
        type: "MATCH",
        matchId: m.id,
        realHomeScore: 1,
        realAwayScore: 1,
        realQualifier: m.awayTeam,
        label: `תיקו (למשל 1-1), ${m.awayTeam} עולה בפנדלים`
      });

      variables.push({
        id: m.id,
        name: `${m.roundName}: ${m.homeTeam} - ${m.awayTeam}`,
        maxPoints: m.id === 'match_103' ? 25 : 40,
        outcomes
      });
    });

    // Add bonus variables
    openBonuses.forEach(bq => {
      const blacklist = parseConfigArray(rbBlacklist[bq.id]);
      const leading = parseConfigArray(rbLeading[bq.id]);
      
      const predictions = topUsers.map(u => (bPreds[u.id] || {})[bq.id]);
      const uniquePredictions = Array.from(new Set(predictions)).filter(x => x !== undefined && x !== null && x !== "");
      
      // Determine possible outcomes
      let possibleAnswers: string[] = [];
      if (leading.length > 0) {
        // If leading is specified, only simulate leading options
        leading.forEach(lVal => {
          if (!blacklist.includes(lVal)) {
            // Find if any user predicted this, to keep original casing
            const originalPred = uniquePredictions.find(p => String(p).trim().toLowerCase() === lVal);
            possibleAnswers.push(originalPred || lVal);
          }
        });
      } else {
        // Fallback to top user predictions minus blacklist
        uniquePredictions.forEach(predVal => {
          const lPred = String(predVal).trim().toLowerCase();
          if (!blacklist.includes(lPred)) {
            possibleAnswers.push(predVal);
          }
        });
      }
      
      if (possibleAnswers.length === 0) return; // skip if no possible answers
      if (possibleAnswers.length === 1 && leading.length === 0) return; // skip if constant and no leading restriction
      
      const outcomes: any[] = [];
      possibleAnswers.forEach(predVal => {
        outcomes.push({
          type: "BONUS",
          qId: bq.id,
          realAnswer: predVal,
          label: `תשובה: "${predVal}"`
        });
      });
      
      let incorrectLabel = "תשובה אחרת (אף אחד לא פוגע)";
      if (leading.length > 0) {
        const leadingOriginalCasings = leading.map(lVal => {
          const original = uniquePredictions.find(p => String(p).trim().toLowerCase() === lVal);
          return original || lVal;
        });
        incorrectLabel = `הכל רק לא ${leadingOriginalCasings.join(' / ')}`;
      }
      
      outcomes.push({
        type: "BONUS",
        qId: bq.id,
        realAnswer: "__OTHER_INCORRECT_VALUE__",
        label: incorrectLabel
      });
      
      variables.push({
        id: bq.id,
        name: bq.question,
        points: bq.points,
        isProximity: bq.isProximity,
        answerType: bq.answerType,
        maxPoints: bq.isProximity ? 50 : bq.points,
        outcomes
      });
    });

    // Sort variables by max points descending for DFS branch pruning
    variables.sort((a, b) => b.maxPoints - a.maxPoints);

    // Compute max suffix sums
    const maxSuffixSum: number[] = [];
    let sum = 0;
    for (let i = variables.length - 1; i >= 0; i--) {
      sum += variables[i].maxPoints;
      maxSuffixSum[i] = sum;
    }
    maxSuffixSum.push(0);

    setPrecomputed({
      variables,
      maxSuffixSum,
      topUsers,
      matchPredsMap,
      rbBlacklist
    });
  };

  const handleCalculateUser = (userId: string) => {
    setCalculatingUserId(userId);
    setTimeout(() => {
      runSimulationForUser(userId);
    }, 50);
  };

  const runSimulationForUser = (userId: string) => {
    if (!precomputed || users.length === 0) return;
    const { variables, maxSuffixSum, topUsers, matchPredsMap, rbBlacklist } = precomputed;
    
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;
    
    const targetUserId = targetUser.id;
    const targetUserRank = targetUser.rank || 0;
    const targetUserDisplayName = targetUser.displayName;

    // Dynamically insert target user's own predictions as simulated outcomes for open bonuses if missing
    const targetVariables = variables.map(v => {
      if (v.id.startsWith('match_')) return v;
      
      const predVal = (bonusPredictions[targetUserId] || {})[v.id];
      if (!predVal) return v;
      
      const hasPredVal = v.outcomes.some((o: any) => 
        o.type === 'BONUS' && 
        String(o.realAnswer).trim().toLowerCase() === String(predVal).trim().toLowerCase()
      );
      if (hasPredVal) return v;
      
      const parseConfigArray = (val: any): string[] => {
        if (!val) return [];
        if (Array.isArray(val)) {
          return val.map(s => String(s).trim().toLowerCase()).filter(Boolean);
        }
        return String(val).split(',').map(s => String(s).trim().toLowerCase()).filter(s => s !== "");
      };
      
      const blacklist = parseConfigArray(rbBlacklist[v.id]);
      if (blacklist.includes(String(predVal).trim().toLowerCase())) return v;
      
      const newOutcomes = [...v.outcomes];
      const otherIdx = newOutcomes.findIndex(o => o.realAnswer === "__OTHER_INCORRECT_VALUE__");
      const newItem = {
        type: "BONUS",
        qId: v.id,
        realAnswer: predVal,
        label: `תשובה: "${predVal}" (הניחוש של ${targetUserDisplayName})`
      };
      
      if (otherIdx > -1) {
        newOutcomes.splice(otherIdx, 0, newItem);
      } else {
        newOutcomes.push(newItem);
      }
      
      return {
        ...v,
        outcomes: newOutcomes
      };
    });
    
    const leaderPoints = users[0].totalPoints;
    const initialScores = topUsers.map(u => u.totalPoints);
    const targetIdxInTop = topUsers.findIndex(u => u.id === targetUserId);
    
    let simUsers = [...topUsers];
    let simScores = [...initialScores];
    if (targetIdxInTop === -1) {
      simUsers.push(targetUser);
      simScores.push(targetUser.totalPoints);
    }
    const targetUserIdx = simUsers.findIndex(u => u.id === targetUserId);

    // Score calculations
    const getMatchPoints = (pred: MatchPrediction | undefined, outcome: any) => {
      if (!pred) return 0;
      let pts = 0;
      const pH = Number(pred.predictedHomeScore);
      const pA = Number(pred.predictedAwayScore);
      const rH = outcome.realHomeScore;
      const rA = outcome.realAwayScore;
      
      if (!isNaN(pH) && !isNaN(pA)) {
        if (Math.sign(pH - pA) === Math.sign(rH - rA)) {
          pts += 5;
          if (pH === rH && pA === rA) pts += 10;
        }
      }
      
      if (pred.qualifier === outcome.realQualifier && pred.qualifier !== "") {
        const mInfo = matches.find(m => m.id === outcome.matchId);
        const roundName = mInfo ? mInfo.roundName : "גמר";
        const qMap: Record<string, number> = { "מקום שלישי": 10, "גמר": 25 };
        pts += (qMap[roundName] || 0);
      }
      return pts;
    };

    const getBonusPoints = (predVal: string | undefined, outcome: any, vInfo: any) => {
      if (!predVal) return 0;
      if (vInfo.isProximity && vInfo.answerType === "NUMBER_PURE") {
        const truthNum = Number(outcome.realAnswer);
        const ansNum = Number(predVal);
        if (!isNaN(truthNum) && !isNaN(ansNum)) {
          const diff = Math.abs(truthNum - ansNum);
          if (diff === 0) return 50;
          if (diff <= 5) return 40;
          if (diff <= 10) return 30;
          if (diff <= 15) return 20;
          if (diff <= 20) return 10;
          return 0;
        }
        return 0;
      }
      if (outcome.realAnswer === "__OTHER_INCORRECT_VALUE__") return 0;
      return String(predVal).trim().toLowerCase() === String(outcome.realAnswer).trim().toLowerCase() ? vInfo.points : 0;
    };

    // Helper to sort outcomes for Dream Scenario: target user's prediction goes FIRST
    const getSortedOutcomesForDream = (v: any, uid: string) => {
      const outcomes = [...v.outcomes];
      let targetOutcomeIdx = -1;
      
      if (v.id.startsWith('match_')) {
        const pred = matchPredsMap[v.id]?.[uid] || matchPredictions.find(p => p.userId === uid && p.matchId === v.id);
        if (pred) {
          const predScoreStr = `${pred.predictedHomeScore}-${pred.predictedAwayScore}`;
          targetOutcomeIdx = outcomes.findIndex(o => 
            o.type === 'MATCH' && 
            `${o.realHomeScore}-${o.realAwayScore}` === predScoreStr && 
            o.realQualifier === pred.qualifier
          );
        }
      } else {
        const predVal = (bonusPredictions[uid] || {})[v.id];
        if (predVal) {
          targetOutcomeIdx = outcomes.findIndex(o => 
            o.type === 'BONUS' && 
            String(o.realAnswer).trim().toLowerCase() === String(predVal).trim().toLowerCase()
          );
        }
      }
      
      if (targetOutcomeIdx > -1) {
        const [targetOutcome] = outcomes.splice(targetOutcomeIdx, 1);
        outcomes.unshift(targetOutcome); // Prioritize target user's own prediction
      }
      
      return outcomes;
    };

    // Helper to sort outcomes for Nightmare Scenario: target user's prediction goes LAST, rivals' predictions go FIRST
    const getSortedOutcomesForNightmare = (v: any, uid: string) => {
      const outcomes = [...v.outcomes];
      
      let targetOutcomeIdx = -1;
      if (v.id.startsWith('match_')) {
        const pred = matchPredsMap[v.id]?.[uid] || matchPredictions.find(p => p.userId === uid && p.matchId === v.id);
        if (pred) {
          const predScoreStr = `${pred.predictedHomeScore}-${pred.predictedAwayScore}`;
          targetOutcomeIdx = outcomes.findIndex(o => 
            o.type === 'MATCH' && 
            `${o.realHomeScore}-${o.realAwayScore}` === predScoreStr && 
            o.realQualifier === pred.qualifier
          );
        }
      } else {
        const predVal = (bonusPredictions[uid] || {})[v.id];
        if (predVal) {
          targetOutcomeIdx = outcomes.findIndex(o => 
            o.type === 'BONUS' && 
            String(o.realAnswer).trim().toLowerCase() === String(predVal).trim().toLowerCase()
          );
        }
      }
      
      let targetOutcome: any = null;
      if (targetOutcomeIdx > -1) {
        [targetOutcome] = outcomes.splice(targetOutcomeIdx, 1);
      }
      
      // Prioritize outcomes predicted by other top users
      const otherUsers = topUsers.filter(u => u.id !== uid);
      
      outcomes.forEach((o: any) => {
        let count = 0;
        otherUsers.forEach(ou => {
          if (v.id.startsWith('match_')) {
            const pred = matchPredsMap[v.id]?.[ou.id] || matchPredictions.find(p => p.userId === ou.id && p.matchId === v.id);
            if (pred) {
              const predScoreStr = `${pred.predictedHomeScore}-${pred.predictedAwayScore}`;
              if (`${o.realHomeScore}-${o.realAwayScore}` === predScoreStr && o.realQualifier === pred.qualifier) {
                count++;
              }
            }
          } else {
            const predVal = (bonusPredictions[ou.id] || {})[v.id];
            if (predVal && String(o.realAnswer).trim().toLowerCase() === String(predVal).trim().toLowerCase()) {
              count++;
            }
          }
        });
        o.tempSortCount = count;
      });
      
      outcomes.sort((a: any, b: any) => (b.tempSortCount || 0) - (a.tempSortCount || 0));
      
      if (targetOutcome) {
        outcomes.push(targetOutcome); // Put target user's prediction at the very end
      }
      
      return outcomes;
    };

    // 1. Solve Dream Scenario
    function solveDream(varIdx: number, currentScores: number[], assigned: ScenarioItem[], targetRankLimit: number): ScenarioItem[] | null {
      let outscoredMaxCount = 0;
      const targetUserMaxPossible = currentScores[targetUserIdx] + maxSuffixSum[varIdx];
      for (let i = 0; i < currentScores.length; i++) {
        if (i === targetUserIdx) continue;
        if (currentScores[i] > targetUserMaxPossible) {
          outscoredMaxCount++;
        }
      }
      if (outscoredMaxCount >= targetRankLimit) {
        return null; // Prune
      }

      if (varIdx === targetVariables.length) {
        let outscoredCount = 0;
        for (let i = 0; i < currentScores.length; i++) {
          if (i === targetUserIdx) continue;
          if (currentScores[i] > currentScores[targetUserIdx]) {
            outscoredCount++;
          }
        }
        return (outscoredCount < targetRankLimit) ? [...assigned] : null;
      }

      const v = targetVariables[varIdx];
      const sortedOutcomes = getSortedOutcomesForDream(v, targetUserId);
      
      for (const out of sortedOutcomes) {
        const nextScores = [...currentScores];
        for (let i = 0; i < simUsers.length; i++) {
          const uid = simUsers[i].id;
          let pts = 0;
          if (v.id.startsWith('match_')) {
            const pred = matchPredsMap[v.id]?.[uid] || matchPredictions.find(p => p.userId === uid && p.matchId === v.id);
            pts = getMatchPoints(pred, out);
          } else {
            const predVal = (bonusPredictions[uid] || {})[v.id];
            pts = getBonusPoints(predVal, out, v);
          }
          nextScores[i] += pts;
        }

        assigned.push({
          varId: v.id,
          varName: v.name,
          label: out.label,
          outcome: out
        });

        const res = solveDream(varIdx + 1, nextScores, assigned, targetRankLimit);
        assigned.pop();
        if (res) return res;
      }
      return null;
    }

    // 2. Solve Nightmare Scenario
    function solveNightmare(varIdx: number, currentScores: number[], assigned: ScenarioItem[]): ScenarioItem[] | null {
      const uScore = currentScores[targetUserIdx];
      
      let canOutscoreCount = 0;
      for (let i = 0; i < simUsers.length; i++) {
        if (i === targetUserIdx) continue;
        if (currentScores[i] + maxSuffixSum[varIdx] > uScore) {
          canOutscoreCount++;
        }
      }
      
      if (canOutscoreCount < 5) {
        return null; // Prune
      }

      if (varIdx === targetVariables.length) {
        let outscoredCount = 0;
        for (let i = 0; i < simUsers.length; i++) {
          if (i === targetUserIdx) continue;
          if (currentScores[i] > currentScores[targetUserIdx]) {
            outscoredCount++;
          }
        }
        return outscoredCount >= 5 ? [...assigned] : null;
      }

      const v = targetVariables[varIdx];
      const sortedOutcomes = getSortedOutcomesForNightmare(v, targetUserId);
      
      for (const out of sortedOutcomes) {
        const nextScores = [...currentScores];
        for (let i = 0; i < simUsers.length; i++) {
          const uid = simUsers[i].id;
          let pts = 0;
          if (v.id.startsWith('match_')) {
            const pred = matchPredsMap[v.id]?.[uid] || matchPredictions.find(p => p.userId === uid && p.matchId === v.id);
            pts = getMatchPoints(pred, out);
          } else {
            const predVal = (bonusPredictions[uid] || {})[v.id];
            pts = getBonusPoints(predVal, out, v);
          }
          nextScores[i] += pts;
        }

        assigned.push({
          varId: v.id,
          varName: v.name,
          label: out.label,
          outcome: out
        });

        const res = solveNightmare(varIdx + 1, nextScores, assigned);
        assigned.pop();
        if (res) return res;
      }
      return null;
    }

    const getSimulatedTable = (assigned: ScenarioItem[], initialScores: number[]): SimulatedUserRank[] => {
      const finalScores = [...initialScores];
      
      assigned.forEach(item => {
        const v = variables.find(x => x.id === item.varId);
        if (!v) return;
        const out = item.outcome;
        
        for (let i = 0; i < simUsers.length; i++) {
          const uid = simUsers[i].id;
          let pts = 0;
          if (v.id.startsWith('match_')) {
            const pred = matchPredsMap[v.id]?.[uid] || matchPredictions.find(p => p.userId === uid && p.matchId === v.id);
            pts = getMatchPoints(pred, out);
          } else {
            const predVal = (bonusPredictions[uid] || {})[v.id];
            pts = getBonusPoints(predVal, out, v);
          }
          finalScores[i] += pts;
        }
      });
      
      const rankedUsers = simUsers.map((u, idx) => ({
        userId: u.id,
        userName: u.displayName,
        score: finalScores[idx],
        rank: 1
      }));
      
      rankedUsers.sort((a, b) => b.score - a.score);
      
      let currRank = 1;
      rankedUsers.forEach((u, idx) => {
        if (idx > 0 && rankedUsers[idx].score < rankedUsers[idx - 1].score) {
          currRank = idx + 1;
        }
        u.rank = currRank;
      });
      
      return rankedUsers;
    };

    // Try finding scenario for 1st place, then 2nd, then 3rd, then 4th
    let dream: ScenarioItem[] | null = null;
    let dreamTargetRank: number | null = null;
    for (let r = 1; r <= 4; r++) {
      const res = solveDream(0, simScores, [], r);
      if (res) {
        dream = res;
        dreamTargetRank = r;
        break;
      }
    }

    const isTop10 = targetUserRank <= 10;
    const nightmare = isTop10 ? solveNightmare(0, simScores, []) : null;

    const dreamTable = dream ? getSimulatedTable(dream, simScores) : null;
    const nightmareTable = nightmare ? getSimulatedTable(nightmare, simScores) : null;

    setUserResults(prev => ({
      ...prev,
      [userId]: {
        dream,
        dreamTargetRank,
        dreamTable,
        nightmare,
        nightmareTable,
        timestamp: new Date().toLocaleTimeString("he-IL", { hour: '2-digit', minute: '2-digit' })
      }
    }));

    setCalculatingUserId(null);
    toast.success(`התרחישים עבור ${targetUserDisplayName} חושבו!`);
  };

  const copyWhatsAppText = (u: User) => {
    const result = userResults[u.id];
    if (!result) return;
    const { dream, dreamTargetRank, nightmare } = result;
    
    let text = `*🔮 מונדיאל 2026 - דוח סימולציה עבור ${u.displayName}* \n`;
    text += `מצב נוכחי: מקום ${u.rank} (${u.totalPoints} נק')\n\n`;
    
    if (dream) {
      const emojiMap: Record<number, string> = { 1: "🏆 מקום 1", 2: "🥈 מקום 2", 3: "🥉 מקום 3", 4: "🏅 מקום 4" };
      const rankText = emojiMap[dreamTargetRank || 1] || "מקום 1";
      text += `*✨ תרחיש חלומות (להגעה אל ${rankText}):*\n`;
      dream.forEach(s => {
        text += `• _${s.varName.split(':')[0]}_: ${s.label}\n`;
      });
      text += `\n`;
    } else {
      text += `❌ *הדחה מתמטית:* לא נותר תרחיש בו תוכל לסיים בטופ 4.\n\n`;
    }
    
    if (u.rank && u.rank <= 10) {
      if (nightmare) {
        text += `*💀 תרחיש בלהות (התרסקות אל מתחת למקום 5):*\n`;
        nightmare.forEach(s => {
          text += `• _${s.varName.split(':')[0]}_: ${s.label}\n`;
        });
      } else {
        text += `🛡️ *חסין מהתרסקות:* מתמטית לא תרד מתחת למקום 5!`;
      }
    }
    
    navigator.clipboard.writeText(text);
    toast.success(`הודעת WhatsApp עבור ${u.displayName} הועתקה!`);
  };

  const publishReport = async () => {
    setIsLoading(true);
    try {
      let md = `## סיכום תרחישי קצה מונדיאל 2026\n\n`;
      users.forEach(u => {
        md += `### ${u.rank}. ${u.displayName} (${u.totalPoints} נק')\n`;
        const res = userResults[u.id];
        
        if (res) {
          if (res.dream) {
            md += `* **תסריט הגעה מקסימלי: מקום ${res.dreamTargetRank || 1}**\n`;
            res.dream.forEach(s => md += `  - ${s.varName}: ${s.label}\n`);
          } else {
            md += `* **תסריט הגעה מקסימלי:** הדחה מתמטית מטופ 4 ❌\n`;
          }
          if (u.rank && u.rank <= 10) {
            if (res.nightmare) {
              md += `* **תסריט בלהות (מתחת למקום 5):**\n`;
              res.nightmare.forEach(s => md += `  - ${s.varName}: ${s.label}\n`);
            } else {
              md += `* **תסריט בלהות:** חסין ירידה מתחת למקום 5 🛡️\n`;
            }
          }
        } else {
          md += `*טרם חושבו תרחישים למשתמש זה.*\n`;
        }
        md += `\n---\n\n`;
      });
      
      await setDoc(doc(db, "admin_results", "scenarios"), {
        markdown: md,
        updatedAt: new Date().toISOString(),
        timestamp: new Date().toLocaleString("he-IL")
      });
      toast.success("הדוח המרוכז פורסם בבסיס הנתונים!");
    } catch (e: any) {
      console.error(e);
      toast.error(`שגיאה בפרסום הדוח: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-right" dir="rtl">
      
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <span>🔮</span> סימולטור תרחישי קצה (חלומות ובלהות)
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            חישוב תרחישים פר-משתמש (בדיקת מקום ראשון לכולם, ובלהות למקומות 1-10) ללא עומס על הדפדפן.
          </p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={publishReport} 
            disabled={isLoading || Object.keys(userResults).length === 0}
            className="flex-1 md:flex-none px-6 py-3 rounded-2xl font-black bg-blue-600 hover:bg-blue-500 text-white shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            📢 פרסם דוח מרוכז
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="mb-6 relative">
        <input 
          type="text" 
          placeholder="🔍 חפש משתמש..." 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 text-white rounded-2xl px-4 py-3 text-sm focus:outline-none transition-colors text-right"
        />
      </div>

      {/* Dashboard Users Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-400 font-bold">טוען נתונים מהשרת...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredUsers.map((u) => {
            const result = userResults[u.id];
            const isCalculating = calculatingUserId === u.id;
            const isTop10 = u.rank && u.rank <= 10;
            
            return (
              <div 
                key={u.id} 
                className="bg-slate-950/30 border border-slate-850 hover:border-slate-700/60 rounded-3xl p-5 transition-all shadow-md flex flex-col gap-4"
              >
                {/* Header */}
                <div className="flex justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white ${
                      u.rank && u.rank === 1 ? "bg-amber-500 shadow-amber-500/30" : 
                      u.rank && u.rank <= 3 ? "bg-slate-400 shadow-slate-400/30" : "bg-slate-800"
                    } shadow-md`}>
                      {u.rank}
                    </span>
                    <div>
                      <h3 className="text-lg font-black text-white">{u.displayName}</h3>
                      <span className="text-xs text-slate-500">ניקוד: {u.totalPoints} נק'</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {result && (
                      <button 
                        onClick={() => copyWhatsAppText(u)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        💬 העתק לווטסאפ
                      </button>
                    )}
                    
                    <button 
                      onClick={() => handleCalculateUser(u.id)}
                      disabled={isCalculating || calculatingUserId !== null}
                      className={`px-4 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                        result 
                          ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700" 
                          : "bg-blue-600 hover:bg-blue-500 text-white shadow-md border border-blue-500"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isCalculating ? "⏳ מחשב..." : (result ? "🔄 חישוב מחדש" : "⚡ חשב תרחישים")}
                    </button>
                  </div>
                </div>

                {/* Scenarios Grid */}
                {isCalculating ? (
                  <div className="flex items-center justify-center py-6 gap-2 text-blue-400 text-xs font-bold">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>מחשב מיליוני שילובים של תוצאות ובונוסים...</span>
                  </div>
                ) : !result ? (
                  <div className="text-slate-600 text-xs py-2 text-right">
                    טרם חושבו תרחישים למשתמש זה. לחץ על "חשב תרחישים" כדי להריץ את המנוע.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Dream Scenario */}
                    <div className={`p-4 rounded-2xl border ${
                      result.dream ? "bg-blue-600/5 border-blue-500/20 text-blue-300" : "bg-slate-900/30 border-slate-850 text-slate-500 opacity-60"
                    }`}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">
                          {result.dreamTargetRank === 1 ? "🏆" : result.dreamTargetRank === 2 ? "🥈" : result.dreamTargetRank === 3 ? "🥉" : "🏅"}
                        </span>
                        <h4 className="font-black text-sm">
                          תסריט חלומות (למקום ה-{result.dreamTargetRank === 1 ? "ראשון" : result.dreamTargetRank === 2 ? "שני" : result.dreamTargetRank === 3 ? "שלישי" : "רביעי"})
                        </h4>
                      </div>
                      
                      {result.dream ? (
                        <>
                          <ul className="text-xs space-y-2">
                            {result.dream.map((s, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <span className="text-blue-500">•</span>
                                <span><strong>{s.varName.split(':')[0]}:</strong> {s.label}</span>
                              </li>
                            ))}
                          </ul>
                          
                          <div className="mt-3 border-t border-blue-500/10 pt-3">
                            <button
                              onClick={() => {
                                const key = `${u.id}:dream`;
                                setOpenTableKey(openTableKey === key ? null : key);
                              }}
                              className="text-[10px] font-black text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <span>📊</span>
                              <span>{openTableKey === `${u.id}:dream` ? "הסתר טבלה מדומה" : "הצג טבלה מדומה"}</span>
                            </button>
                            
                            {openTableKey === `${u.id}:dream` && result.dreamTable && (
                              <div className="mt-2 bg-slate-950/60 rounded-xl p-2.5 border border-blue-500/10 text-[10px] space-y-1 max-h-[150px] overflow-y-auto">
                                {(() => {
                                  const topN = result.dreamTable.slice(0, 5);
                                  const hasTarget = topN.some(x => x.userId === u.id);
                                  const targetRow = !hasTarget ? result.dreamTable.find(x => x.userId === u.id) : null;
                                  
                                  return (
                                    <>
                                      {topN.map((tu) => {
                                        const isTarget = tu.userId === u.id;
                                        return (
                                          <div key={tu.userId} className={`flex justify-between items-center px-2 py-1 rounded ${isTarget ? "bg-blue-600/20 text-white font-bold" : "text-slate-400"}`}>
                                            <div className="flex items-center gap-1.5">
                                              <span className="w-4 text-center font-bold text-slate-500">{tu.rank}.</span>
                                              <span>{tu.userName}</span>
                                            </div>
                                            <span>{tu.score} נק'</span>
                                          </div>
                                        );
                                      })}
                                      {targetRow && (
                                        <>
                                          <div className="text-center text-[8px] text-slate-700 py-0.5">...</div>
                                          <div key={targetRow.userId} className="flex justify-between items-center px-2 py-1 rounded bg-blue-600/20 text-white font-bold">
                                            <div className="flex items-center gap-1.5">
                                              <span className="w-4 text-center font-bold text-slate-500">{targetRow.rank}.</span>
                                              <span>{targetRow.userName}</span>
                                            </div>
                                            <span>{targetRow.score} נק'</span>
                                          </div>
                                        </>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-rose-400 font-bold flex items-center gap-1">
                          <span>❌</span> 
                          <span>הדחה מתמטית. לא נותרה דרך להתברג בטופ 4.</span>
                        </div>
                      )}
                    </div>

                    {/* Nightmare Scenario */}
                    {isTop10 && (
                      <div className={`p-4 rounded-2xl border ${
                        result.nightmare ? "bg-rose-950/20 border-rose-500/20 text-rose-300" : "bg-emerald-950/10 border-emerald-550/20 text-emerald-300"
                      }`}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">{result.nightmare ? "💀" : "🛡️"}</span>
                          <h4 className="font-black text-sm">
                            {result.nightmare ? "תסריט בלהות (ירידה מתחת למקום 5)" : "חסין מהתרסקות"}
                          </h4>
                        </div>
                        
                        {result.nightmare ? (
                          <>
                            <ul className="text-xs space-y-2">
                              {result.nightmare.map((s, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="text-rose-500">•</span>
                                  <span><strong>{s.varName.split(':')[0]}:</strong> {s.label}</span>
                                </li>
                              ))}
                            </ul>

                            <div className="mt-3 border-t border-rose-500/10 pt-3">
                              <button
                                onClick={() => {
                                  const key = `${u.id}:nightmare`;
                                  setOpenTableKey(openTableKey === key ? null : key);
                                }}
                                className="text-[10px] font-black text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <span>📊</span>
                                <span>{openTableKey === `${u.id}:nightmare` ? "הסתר טבלה מדומה" : "הצג טבלה מדומה"}</span>
                              </button>

                              {openTableKey === `${u.id}:nightmare` && result.nightmareTable && (
                                <div className="mt-2 bg-slate-950/60 rounded-xl p-2.5 border border-rose-500/10 text-[10px] space-y-1 max-h-[150px] overflow-y-auto">
                                  {(() => {
                                    const topN = result.nightmareTable.slice(0, 5);
                                    const hasTarget = topN.some(x => x.userId === u.id);
                                    const targetRow = !hasTarget ? result.nightmareTable.find(x => x.userId === u.id) : null;

                                    return (
                                      <>
                                        {topN.map((tu) => {
                                          const isTarget = tu.userId === u.id;
                                          return (
                                            <div key={tu.userId} className={`flex justify-between items-center px-2 py-1 rounded ${isTarget ? "bg-rose-600/20 text-white font-bold" : "text-slate-400"}`}>
                                              <div className="flex items-center gap-1.5">
                                                <span className="w-4 text-center font-bold text-slate-500">{tu.rank}.</span>
                                                <span>{tu.userName}</span>
                                              </div>
                                              <span>{tu.score} נק'</span>
                                            </div>
                                          );
                                        })}
                                        {targetRow && (
                                          <>
                                            <div className="text-center text-[8px] text-slate-700 py-0.5">...</div>
                                            <div key={targetRow.userId} className="flex justify-between items-center px-2 py-1 rounded bg-rose-600/20 text-white font-bold">
                                              <div className="flex items-center gap-1.5">
                                                <span className="w-4 text-center font-bold text-slate-500">{targetRow.rank}.</span>
                                                <span>{targetRow.userName}</span>
                                              </div>
                                              <span>{targetRow.score} נק'</span>
                                            </div>
                                          </>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                            <span>🛡️</span>
                            <span>מובטח מקום בטופ 5! אין שילוב שיוריד אותך מתחת.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
