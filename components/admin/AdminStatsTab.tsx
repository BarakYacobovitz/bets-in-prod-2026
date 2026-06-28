"use client";
import React, { useState, useRef } from "react";
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../app/firebase";
import { getFlagUrl } from "../../app/utils/flags";
import toast from "react-hot-toast";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from "recharts";
import { toPng } from "html-to-image";

interface AdminStatsTabProps {
  matches: any[];
  bonusQuestions: any[];
  groupsList: string[];
  isCalculating: boolean;
  setIsCalculating: (val: boolean) => void;
  statsData: any;
  setStatsData: React.Dispatch<React.SetStateAction<any>>;
}

export default function AdminStatsTab({ matches, bonusQuestions, groupsList, isCalculating, setIsCalculating, statsData, setStatsData }: AdminStatsTabProps) {  
  const [selectedStatMatch, setSelectedStatMatch] = useState<string>("");
  const [selectedStatBonus, setSelectedStatBonus] = useState<string>("");
  const [selectedStatGroup, setSelectedStatGroup] = useState<string>("A");
  const [statSpyModal, setStatSpyModal] = useState<{title: string, list: any[], type: "MATCH_DIRECTION" | "NAMES_ONLY"} | null>(null);
  
  const [bonusViewMode, setBonusViewMode] = useState<"list" | "chart">("list");
  const chartRef = useRef<HTMLDivElement>(null);
  const [scorersData, setScorersData] = useState<any[] | null>(null);
  const [isFetchingScorers, setIsFetchingScorers] = useState(false);
// סטייטים למפענח ה-AI
  const [rawStatsText, setRawStatsText] = useState("");
  const [parsedStatsPreview, setParsedStatsPreview] = useState<any>(null);
  const [isParsingStats, setIsParsingStats] = useState(false);
  const formatAuditTime = (ts: any) => {
    if (!ts) return "";
    try {
      const date = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
      return date.toLocaleString('he-IL', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
    } catch { return ""; }
  };
  // --- הסטייטים החדשים לדוח הקבוצתי ---
  const [leagueSummaryUsers, setLeagueSummaryUsers] = useState<any[]>([]);
  const [showLeagueSummaryModal, setShowLeagueSummaryModal] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  // פונקציה ששולפת את הנתונים המוכנים של כולם ופותחת את הטבלה
  const handleOpenLeagueSummary = async () => {
    const toastId = toast.loading("מכין את דוח הפדיחות של הליגה... 😈");
    try {
      const uSnap = await getDocs(collection(db, "users"));
      const users = uSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.wrappedData) // מביא רק את מי שכבר חושב לו Wrapped
        .sort((a, b) => (Number(b.totalPoints) || 0) - (Number(a.totalPoints) || 0));
      
      setLeagueSummaryUsers(users);
      setShowLeagueSummaryModal(true);
      toast.success("הדוח מוכן!", { id: toastId });
    } catch (e) {
      toast.error("שגיאה במשיכת נתונים", { id: toastId });
    }
  };

  // פונקציה שמצלמת את הטבלה ומורידה אותה כתמונה
  const handleExportLeagueSummary = async () => {
    if (!summaryRef.current) return;
    const toastId = toast.loading("מצלם את לוח התוצאות... 📸");
    try {
      const dataUrl = await toPng(summaryRef.current, { 
        quality: 1, 
        pixelRatio: 2, 
        backgroundColor: "#0f172a" 
      });
      const link = document.createElement("a");
      link.download = `BetsInProd_League_Summary.png`;
      link.href = dataUrl;
      link.click();
      toast.success("התמונה ירדה! זרוק אותה בוואטסאפ ותתחיל את החגיגה 🎉", { id: toastId });
    } catch (error) {
      toast.error("שגיאה ביצירת התמונה", { id: toastId });
    }
  };
  const handleDownloadGraphImage = async () => {
    if (!chartRef.current) return;
    const toastId = toast.loading("מייצר תמונה... 📷");
    try {
      const dataUrl = await toPng(chartRef.current, { 
        backgroundColor: "#0f172a", 
        pixelRatio: 2 
      });
      const link = document.createElement("a");
      link.download = `bets_in_prod_graph_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("התמונה מוכנה! אפשר לשתף בוואטסאפ 🚀", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("שגיאה ביצירת התמונה", { id: toastId });
    }
  };

  const handleFetchLiveScorers = async () => {
    setIsFetchingScorers(true);
    const toastId = toast.loading("מתחבר ללוויין... מושך כובשים מהאינטרנט 📡");
    try {
      const res = await fetch('/api/scorers');
      const data = await res.json();
      if (data.success) {
        toast.success("טבלת הכובשים עודכנה בהצלחה ב-Firebase! ⚽", { id: toastId });
        setScorersData(data.data); // שומרים את הנתונים כדי להציג לאדמין במסך
      } else {
        toast.error("שגיאה במשיכת הנתונים: " + data.error, { id: toastId });
      }
    } catch (e) {
      toast.error("שגיאת תקשורת. ה-API כנראה לא זמין.", { id: toastId });
    } finally {
      setIsFetchingScorers(false);
    }
  };
  const handleParseRawText = async () => {
    if (!rawStatsText.trim()) return toast.error("אין טקסט לפענוח");
    setIsParsingStats(true);
    const toastId = toast.loading("🤖 ה-AI מפענח את האירועים...");
    
    try {
      const systemInstructions = `You are a strict data extraction parser. 
Extract goal scorers and yellow cards from the raw text provided. 
CRITICAL RULES:
1. Return ONLY valid JSON. No markdown, no intro text.
2. 'scorers' and 'yellowCards' MUST ALWAYS be arrays []. Even if there are no scorers or cards, return an empty array []. NEVER return null, undefined, or a string.
3. Guess the "matchName" (e.g. "Japan vs Tunisia") from the context.
4. For each event, provide "playerName", "team", and "minute" (numbers only for minute).
Structure:
{
  "matchName": "Team A vs Team B",
  "scorers": [ { "playerName": "Name", "team": "Team", "minute": "45" } ],
  "yellowCards": []
}`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: rawStatsText, context: { systemInstructions } })
      });
      
      const data = await res.json();
      
      let jsonString = data.reply.trim();
      
      // ניקוי Markdown בטוח ללא Regex
      if (jsonString.startsWith("```json")) {
        jsonString = jsonString.substring(7);
      } else if (jsonString.startsWith("```")) {
        jsonString = jsonString.substring(3);
      }
      
      if (jsonString.endsWith("```")) {
        jsonString = jsonString.substring(0, jsonString.length - 3);
      }
      
      jsonString = jsonString.trim();

      const parsedData = JSON.parse(jsonString);
      
      setParsedStatsPreview(parsedData);
      toast.success("הפענוח הושלם בהצלחה!", { id: toastId });
      
    } catch (e: any) {
      console.error("Parsing error:", e);
      toast.error("שגיאה: ה-AI לא הצליח לקרוא את הטקסט או שהפורמט שבור.", { id: toastId });
    } finally {
      setIsParsingStats(false);
    }
  };

  const handleSaveParsedStats = async () => {
    if (!parsedStatsPreview) return;
    const toastId = toast.loading("שומר למסד הנתונים... 💾");
    try {
      // שומרים תחת קולקשן מרכזי של סטטיסטיקות הטורניר
      await updateDoc(doc(db, "system_data", "tournament_stats"), {
        [parsedStatsPreview.matchName]: parsedStatsPreview
      });
      toast.success("הנתונים נשמרו!", { id: toastId });
      setRawStatsText("");
      setParsedStatsPreview(null);
    } catch (e: any) {
      // אם המסמך לא קיים עדיין, ניצור אותו
      if (e.code === 'not-found') {
         const { setDoc } = await import("firebase/firestore");
         await setDoc(doc(db, "system_data", "tournament_stats"), {
            [parsedStatsPreview.matchName]: parsedStatsPreview
         });
         toast.success("הנתונים נשמרו (נוצר מסמך חדש)!", { id: toastId });
         setRawStatsText("");
         setParsedStatsPreview(null);
      } else {
         toast.error("שגיאה בשמירה", { id: toastId });
      }
    }
  };

  const handleGenerateStats = async () => {
    setIsCalculating(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const usersMap: any = {};
      usersSnap.forEach(doc => { usersMap[doc.id] = doc.data().name; });

      const matchStatsMap: any = {};
      const bonusStatsMap: any = {};
      const qualStatsMap: any = {};
      const thirdStatsMap: any = {};

      const gSnap = await getDocs(collection(db, "predictions_matches"));
      const kSnap = await getDocs(collection(db, "predictions_knockout"));
      const allMatches = [...gSnap.docs.map(d=>d.data()), ...kSnap.docs.map(d=>d.data())];

      allMatches.forEach(pred => {
        if (!pred.predictedHomeScore || !pred.predictedAwayScore) return;
        const userName = usersMap[pred.userId];
        if (!userName) return; 

        const timeStr = formatAuditTime(pred.updatedAt);
        const mId = pred.matchId;
        if (!matchStatsMap[mId]) matchStatsMap[mId] = { total: 0, homeWins: [], awayWins: [], draws: [], exactScores: {}, qualifiers: {} };           matchStatsMap[mId].total++;
        
        const h = Number(pred.predictedHomeScore); const a = Number(pred.predictedAwayScore);
        const userObj = { name: userName, home: h, away: a, time: timeStr }; 

        if (h > a) matchStatsMap[mId].homeWins.push(userObj);
        else if (a > h) matchStatsMap[mId].awayWins.push(userObj);
        else matchStatsMap[mId].draws.push(userObj);

        const exact = `${h}-${a}`;
        if (!matchStatsMap[mId].exactScores[exact]) matchStatsMap[mId].exactScores[exact] = { count: 0, users: [] };
        matchStatsMap[mId].exactScores[exact].count++;
        matchStatsMap[mId].exactScores[exact].users.push({ name: userName, time: timeStr }); 
        // --- התוספת החדשה: איסוף התפלגות מעפילות בנוקאאוט ---
        if (pred.qualifier && String(pred.qualifier).trim() !== "") {
           const qual = String(pred.qualifier).trim();
           if (!matchStatsMap[mId].qualifiers[qual]) matchStatsMap[mId].qualifiers[qual] = { count: 0, users: [] };
           matchStatsMap[mId].qualifiers[qual].count++;
           matchStatsMap[mId].qualifiers[qual].users.push({ name: userName, time: timeStr });
        }
      });

      const bSnap = await getDocs(collection(db, "predictions_bonus"));
      bSnap.forEach(doc => {
        const userName = usersMap[doc.id];
        if (!userName) return; 
        const timeStr = formatAuditTime(doc.data().updatedAt);
        const answers = doc.data().answers || {};
        for (const [qId, ans] of Object.entries(answers)) {
          if (!ans) continue;
          if (!bonusStatsMap[qId]) bonusStatsMap[qId] = { total: 0, answers: {} };
          bonusStatsMap[qId].total++;
          const answerStr = String(ans).trim();
          if (!bonusStatsMap[qId].answers[answerStr]) bonusStatsMap[qId].answers[answerStr] = { count: 0, users: [] };
          bonusStatsMap[qId].answers[answerStr].count++;
          bonusStatsMap[qId].answers[answerStr].users.push({ name: userName, time: timeStr });
        }
      });

      const qSnap = await getDocs(collection(db, "predictions_qualifiers"));
      qSnap.forEach(doc => {
        const userName = usersMap[doc.id];
        if (!userName) return;
        const timeStr = formatAuditTime(doc.data().updatedAt);
        const data = doc.data().groups || {};
        for (const [group, preds] of Object.entries<any>(data)) {
          if (!qualStatsMap[group]) qualStatsMap[group] = { first: {}, second: {}, total: 0 };
          qualStatsMap[group].total++;
          if (preds.first) {
            if (!qualStatsMap[group].first[preds.first]) qualStatsMap[group].first[preds.first] = { count: 0, users: [] };
            qualStatsMap[group].first[preds.first].count++;
            qualStatsMap[group].first[preds.first].users.push({ name: userName, time: timeStr });
          }
          if (preds.second) {
            if (!qualStatsMap[group].second[preds.second]) qualStatsMap[group].second[preds.second] = { count: 0, users: [] };
            qualStatsMap[group].second[preds.second].count++;
            qualStatsMap[group].second[preds.second].users.push({ name: userName, time: timeStr });
          }
        }
      });

      const tSnap = await getDocs(collection(db, "predictions_third_place"));
      let totalThirdPlaceUsers = 0;
      tSnap.forEach(doc => {
        const userName = usersMap[doc.id];
        if (!userName) return;
        const timeStr = formatAuditTime(doc.data().updatedAt);
        const teams = doc.data().teams || [];
        let hasVoted = false;
        teams.forEach((team: string) => {
          if (!team) return;
          hasVoted = true;
          if (!thirdStatsMap[team]) thirdStatsMap[team] = { count: 0, users: [] };
          thirdStatsMap[team].count++;
          thirdStatsMap[team].users.push({ name: userName, time: timeStr });
        });
        if (hasVoted) totalThirdPlaceUsers++;
      });

      setStatsData({ matches: matchStatsMap, bonuses: bonusStatsMap, qualifiers: qualStatsMap, thirdPlace: { teams: thirdStatsMap, totalUsers: totalThirdPlaceUsers } });
      if (matches.length > 0) setSelectedStatMatch(matches[0].id);
      if (bonusQuestions.length > 0) setSelectedStatBonus(bonusQuestions[0].id);
      
      toast.success("סריקת הנתונים הסתיימה!");

    } catch(e) { 
      console.error(e); 
      toast.error("שגיאה ביצירת תובנות הקהל"); 
    }
    finally { setIsCalculating(false); }
  };

  const handleGenerateWrappedData = async () => {
    if (!confirm("האם אתה בטוח שברצונך לייצר ולפרסם נתוני Wrapped לכולם? פעולה זו עשויה לקחת כמה שניות.")) return;
    
    setIsCalculating(true);
    const toastId = toast.loading("מחשב נתוני Wrapped אישיים... נא להמתין", { duration: 10000 });
    
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const rqSnap = await getDoc(doc(db, "admin_results", "qualifiers"));
      const realQualifiers = rqSnap.exists() ? rqSnap.data().results || {} : {};

      const rtSnap = await getDoc(doc(db, "admin_results", "third_place"));
      const realThirdPlace = rtSnap.exists() ? rtSnap.data().teams || [] : [];

      const rbSnap = await getDoc(doc(db, "admin_results", "bonus"));
      const realBonusAnswers = rbSnap.exists() ? rbSnap.data().answers || {} : {};

      const bqMap: any = {};
      bonusQuestions.forEach((q: any) => bqMap[q.id] = q);

      const pmSnap = await getDocs(collection(db, "predictions_matches"));
      const allMatchesPreds = pmSnap.docs.map(d => d.data());

      const pqSnap = await getDocs(collection(db, "predictions_qualifiers"));
      const allQualPreds = pqSnap.docs.map(d => ({ userId: d.id, ...d.data() }));

      const ptSnap = await getDocs(collection(db, "predictions_third_place"));
      const allThirdPreds = ptSnap.docs.map(d => ({ userId: d.id, ...d.data() }));

      const pbSnap = await getDocs(collection(db, "predictions_bonus"));
      const allBonusPreds = pbSnap.docs.map(d => ({ userId: d.id, ...d.data() }));

      const groupMatches = matches.filter(m => m.stage !== "KNOCKOUT" && m.isFinished);
      
      const matchExactHits: any = {};
      groupMatches.forEach(m => { matchExactHits[m.id] = 0; });

      allMatchesPreds.forEach(pred => {
         const match = groupMatches.find(m => m.id === pred.matchId);
         if (match && pred.predictedHomeScore !== "" && pred.predictedAwayScore !== "") {
            const pH = Number(pred.predictedHomeScore); const pA = Number(pred.predictedAwayScore);
            const rH = Number(match.realHomeScore); const rA = Number(match.realAwayScore);
            if (pH === rH && pA === rA) {
               matchExactHits[match.id]++;
            }
         }
      });

      for (const user of allUsers) {
         const pointsPerGroup: any = {};
         
         const userPreds = allMatchesPreds.filter(p => p.userId === user.id);
         let exactHits = 0;
         let directionHits = 0;
         let rarestHit: any = null;
         let lowestHitPercentage = 101; 

         userPreds.forEach(pred => {
            const match = groupMatches.find(m => m.id === pred.matchId);
            if (!match) return;

            const group = match.group || "Unknown";
            if (!pointsPerGroup[group]) pointsPerGroup[group] = 0;

            const pH = Number(pred.predictedHomeScore); const pA = Number(pred.predictedAwayScore);
            const rH = Number(match.realHomeScore); const rA = Number(match.realAwayScore);
            
            if (isNaN(pH) || isNaN(pA) || isNaN(rH) || isNaN(rA)) return;

            if (Math.sign(pH - pA) === Math.sign(rH - rA)) {
               if (pH === rH && pA === rA) {
                  exactHits++;
                  pointsPerGroup[group] += 15;
                  
                  const totalUsersCount = allUsers.length || 1;
                  const hitCount = matchExactHits[match.id] || 1;
                  const hitPercentage = Math.round((hitCount / totalUsersCount) * 100);

                  if (hitPercentage < lowestHitPercentage) {
                     lowestHitPercentage = hitPercentage;
                     rarestHit = {
                        matchTitle: `${match.homeTeam} נגד ${match.awayTeam}`,
                        score: `${pH}-${pA}`,
                        percentage: hitPercentage,
                        peopleCount: hitCount
                     };
                  }
               } else {
                  directionHits++;
                  pointsPerGroup[group] += 5;
               }
            }
         });

         const qualPred = allQualPreds.find(p => p.userId === user.id)?.groups || {};
         let qualPoints = 0;
         let qualStats = { exact: 0, direction: 0 }; 
         
         for (const [gName, preds] of Object.entries<any>(qualPred)) {
            const real = realQualifiers[gName];
            if (!real) continue;
            if (!pointsPerGroup[gName]) pointsPerGroup[gName] = 0;

            let p1 = 0;
            if (preds.first) {
               if (preds.first === real.first) { p1 = 15; qualStats.exact++; }
               else if (preds.first === real.second) { p1 = 7; qualStats.direction++; }
            }
            let p2 = 0;
            if (preds.second) {
               if (preds.second === real.second) { p2 = 15; qualStats.exact++; }
               else if (preds.second === real.first) { p2 = 7; qualStats.direction++; }
            }
            pointsPerGroup[gName] += (p1 + p2);
            qualPoints += (p1 + p2);
         }

         const thirdPred = allThirdPreds.find(p => p.userId === user.id)?.teams || [];
         let thirdPlacePoints = 0;
         let thirdPlaceHitsCount = 0; 

         thirdPred.forEach((t: string) => {
            if (t && realThirdPlace.includes(t)) {
                thirdPlacePoints += 10;
                thirdPlaceHitsCount++;
            }
         });

         const bonusPred = allBonusPreds.find(p => p.userId === user.id)?.answers || {};
         let bonusPoints = 0;
         let bonusHitsCount = 0; 
         const bonusBreakdown = { regular: 0, double: 0, surprise: 0 }; 

         for (const [qId, ans] of Object.entries(bonusPred)) {
            const truth = realBonusAnswers[qId];
            if (!truth || !ans) continue;
            const qInfo = bqMap[qId];
            const truthArray = Array.isArray(truth) ? truth : [truth];
            if (truthArray.some((t: string) => t.toString().trim() === (ans as string).toString().trim())) {
               bonusPoints += (qInfo?.points || 0);
               bonusHitsCount++;
               
               if (qInfo?.isDouble) {
                  bonusBreakdown.double++;
               } else if (qInfo?.isSurprise) {
                  bonusBreakdown.surprise++;
               } else {
                  bonusBreakdown.regular++;
               }
            }
         }

         let bestGroup = { name: "-", points: -1 };
         let worstGroup = { name: "-", points: 9999 };
         
         Object.entries(pointsPerGroup).forEach(([gName, pts]) => {
            const points = Number(pts);
            if (points > bestGroup.points) bestGroup = { name: gName, points };
            if (points < worstGroup.points) worstGroup = { name: gName, points };
         });

         const wrappedData = {
            exactHits,
            directionHits,
            qualPoints,
            thirdPlacePoints,
            bonusPoints,
            bestGroup,
            worstGroup,
            rarestHit,
            qualStats,          
            thirdPlaceHitsCount, 
            bonusHitsCount,      
            bonusBreakdown, 
            pointsPerGroup
         };

         await updateDoc(doc(db, "users", user.id), { wrappedData });
      }

      await updateDoc(doc(db, "settings", "system"), { isWrappedReady: true }, { merge: true });
      toast.success("נתוני ה-Wrapped חושבו כולל עולות, מקום 3 ובונוסים! 🚀", { id: toastId });

    } catch (error) {
      console.error(error);
      toast.error("שגיאה ביצירת נתוני Wrapped.", { id: toastId });
    } finally {
      setIsCalculating(false);
    }
  };

  const renderProgressBar = (label: string, count: number, total: number, colorClass: string, onClickAction: () => void) => {
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <div key={label} className="mb-4 cursor-pointer group" onClick={onClickAction}>
        <div className="flex justify-between text-sm font-bold text-slate-400 mb-1 group-hover:text-white transition-colors">
          <span className="flex items-center gap-2">
             {getFlagUrl(label) && <img src={getFlagUrl(label)!} className="w-4 h-3 object-cover rounded-sm" alt="flag" />}
             {label}
             {count > 0 && <span className="opacity-0 group-hover:opacity-100 text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded transition-all">👁️ מי הצביע?</span>}
          </span>
          <span>{percent}% ({count})</span>
        </div>
        <div className="w-full bg-slate-900 rounded-full h-3 border border-slate-700 overflow-hidden shadow-inner">
          <div className={`h-3 rounded-full ${colorClass} transition-all duration-1000`} style={{ width: `${percent}%` }}></div>
        </div>
      </div>
    );
  };

  const currentBonusAnswers = statsData?.bonuses?.[selectedStatBonus]?.answers || {};
  const numericChartData = Object.entries(currentBonusAnswers)
    .filter(([answer]) => !isNaN(Number(answer.trim())))
    .flatMap(([answer, data]: any) => 
      data.users.map((u: any) => ({
        name: u.name,
        guess: Number(answer.trim())
      }))
    )
    .sort((a, b) => a.guess - b.guess);

  const isNumericBonus = numericChartData.length > 0;
  
  const dynamicChartHeight = Math.max(400, numericChartData.length * 45);

  return (
    <div className="space-y-8 relative">
       
       <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/40 p-6 rounded-3xl border border-pink-500/30 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
         <div>
           <h3 className="text-xl font-black text-pink-400 mb-2 flex items-center gap-2"><span>🎬</span> יצירת Wrapped אישי</h3>
           <p className="text-slate-400 text-sm max-w-xl">
             מחשב לכל משתמש במערכת את הסטטיסטיקות העמוקות שלו (כמה בולים, הבית החזק ביותר, והניחוש הכי נדיר שלו) ופותח את הצגת המודאל המרהיב בדאשבורד. יש להריץ בסוף שלב הבתים!
           </p>
         </div>
         <button 
           onClick={handleGenerateWrappedData} 
           disabled={isCalculating} 
           className="w-full md:w-auto bg-pink-600 hover:bg-pink-500 text-white font-black py-3 px-6 rounded-xl shadow-lg transition-transform active:scale-95 whitespace-nowrap"
         >
           {isCalculating ? "⏳ מעבד נתונים..." : "🚀 פרסם Wrapped לכולם"}
         </button>
         {/* הכפתור החדש שמפעיל את דוח הליגה */}
           <button 
             onClick={handleOpenLeagueSummary} 
             className="w-full bg-slate-800 border border-pink-500/50 hover:bg-slate-700 text-pink-300 font-black py-3 px-6 rounded-xl shadow-lg transition-transform active:scale-95 whitespace-nowrap"
           >
             📊 2. צור דוח קבוצתי לתמונה
           </button>
       </div>
       {/* 🤖 מפענח AI להזנת סטטיסטיקות ידנית */}
       <div className="bg-gradient-to-r from-slate-900 to-blue-950/40 p-6 rounded-3xl border border-blue-500/30 shadow-xl flex flex-col gap-4 mt-8">
         <div>
           <h3 className="text-xl font-black text-blue-400 mb-2 flex items-center gap-2"><span>🧠</span> מפענח נתונים אוטומטי (AI)</h3>
           <p className="text-slate-400 text-sm max-w-xl">
             העתק את אזור הסטטיסטיקה של המשחק (מגוגל או מאתרי ספורט) והדבק כאן. המערכת תחלץ כובשים וכרטיסים צהובים באופן אוטומטי ותכין אותם לשמירה עבור שאלות הבונוס.
           </p>
         </div>

         <div className="flex flex-col lg:flex-row gap-6">
           {/* אזור ההדבקה */}
           <div className="flex-1 flex flex-col gap-3">
             <textarea
               value={rawStatsText}
               onChange={(e) => setRawStatsText(e.target.value)}
               placeholder="הדבק כאן טקסט מבולגן..."
               className="w-full h-40 bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-300 text-sm font-mono focus:border-blue-500 outline-none resize-none"
             />
             <button 
               onClick={handleParseRawText} 
               disabled={isParsingStats || !rawStatsText.trim()}
               className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-3 rounded-xl shadow-md transition-transform active:scale-95 flex justify-center items-center gap-2"
             >
               {isParsingStats ? "מפענח..." : "חלץ נתונים עכשיו ⚡"}
             </button>
           </div>

           {/* אזור התצוגה המקדימה (Preview) */}
           <div className="flex-1 bg-slate-950/50 rounded-xl border border-blue-500/20 p-4 shadow-inner relative min-h-[160px]">
             {!parsedStatsPreview ? (
               <div className="flex h-full items-center justify-center text-slate-600 text-sm font-bold">הנתונים יופיעו כאן לאישור...</div>
             ) : (
               <div className="space-y-4 animate-fade-in">
                 <div className="text-center font-black text-lg text-white bg-slate-900 py-2 rounded-lg border border-slate-700">
                   {parsedStatsPreview.matchName}
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                   <div className="bg-slate-900/80 p-3 rounded-lg border border-emerald-500/20">
                     <div className="text-emerald-400 font-bold mb-2 border-b border-slate-700 pb-1 text-sm">⚽ כובשים:</div>
                     {Array.isArray(parsedStatsPreview.scorers) && parsedStatsPreview.scorers.length > 0 ? (
                       parsedStatsPreview.scorers.map((s: any, i: number) => (
                         <div key={i} className="text-xs text-slate-300 mb-1 flex justify-between">
                           <span>{s.playerName} <span className="opacity-50">({s.team})</span></span>
                           <span className="text-emerald-500">{s.minute}'</span>
                         </div>
                       ))
                     ) : (
                       <div className="text-xs text-slate-500 text-center py-2">אין נתוני כובשים</div>
                     )}
                   </div>
                   
                   <div className="bg-slate-900/80 p-3 rounded-lg border border-amber-500/20">
                     <div className="text-amber-400 font-bold mb-2 border-b border-slate-700 pb-1 text-sm">🟨 צהובים:</div>
                     {Array.isArray(parsedStatsPreview.yellowCards) && parsedStatsPreview.yellowCards.length > 0 ? (
                       parsedStatsPreview.yellowCards.map((c: any, i: number) => (
                         <div key={i} className="text-xs text-slate-300 mb-1 flex justify-between">
                           <span>{c.playerName} <span className="opacity-50">({c.team})</span></span>
                           <span className="text-amber-500">{c.minute}'</span>
                         </div>
                       ))
                     ) : (
                       <div className="text-xs text-slate-500 text-center py-2">אין נתוני כרטיסים</div>
                     )}
                   </div>
                 </div>

                 <button 
                   onClick={handleSaveParsedStats}
                   className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-lg shadow-md transition-transform active:scale-95"
                 >
                   אישור ושמירה ל-Firebase ✔️
                 </button>
               </div>
             )}
           </div>
         </div>
       </div>
{/* מודול חיבור ל-API חיצוני - כובשים */}
       <div className="bg-gradient-to-r from-emerald-900/40 to-teal-900/30 p-6 rounded-3xl border border-emerald-500/30 shadow-xl flex flex-col gap-4">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <div>
             <h3 className="text-xl font-black text-emerald-400 mb-2 flex items-center gap-2"><span>📡</span> מערכת סריקת כובשים (LIVE API)</h3>
             <p className="text-slate-400 text-sm max-w-xl">
               מתחבר לשירות API חיצוני כדי למשוך את כל השערים שנכבשו במונדיאל. הנתונים נשמרים ישירות ל-Firebase לטובת חישוב שאלות בונוס עתידיות (כמו מלך השערים).
             </p>
           </div>
           <button 
             onClick={handleFetchLiveScorers} 
             disabled={isFetchingScorers} 
             className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-3 px-6 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-transform active:scale-95 whitespace-nowrap"
           >
             {isFetchingScorers ? "⏳ שואב נתונים..." : "⚽ הפעל סריקת כובשים"}
           </button>
         </div>

         {/* תצוגת התוצאות מהאינטרנט באותו רגע */}
         {scorersData && (
           <div className="mt-4 bg-slate-950/50 rounded-2xl border border-emerald-500/20 p-4 max-h-96 overflow-y-auto custom-scrollbar shadow-inner animate-fade-in-up">
             <h4 className="text-emerald-300 font-bold mb-4 border-b border-slate-700/50 pb-2 flex justify-between items-center">
               <span>דוח סריקה נוכחי:</span>
               <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">{scorersData.length} משחקים נסרקו</span>
             </h4>
             
             {scorersData.length === 0 ? (
               <div className="text-slate-500 text-sm text-center py-4">לא נמצאו אירועי שערים (אולי הטורניר טרם התחיל או שהליגה ריקה).</div>
             ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                 {scorersData.map((match: any, idx: number) => (
                   <div key={idx} className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 shadow-sm">
                     <div className="text-white font-black text-sm mb-3 text-center bg-slate-900 py-1.5 rounded-lg border border-slate-700/50">
                       {match.matchName}
                     </div>
                     <div className="space-y-1.5">
                       {match.scorers && match.scorers.length > 0 ? (
                         match.scorers.map((s: any, sIdx: number) => (
                           <div key={sIdx} className="text-xs font-bold text-emerald-100 flex justify-between items-center bg-emerald-900/20 px-2.5 py-1.5 rounded border border-emerald-500/10">
                             <span className="flex items-center gap-1.5">
                               <span className="text-[10px]">⚽</span> {s.playerName}
                               {getFlagUrl(s.team) && <img src={getFlagUrl(s.team)!} className="w-3 h-2 rounded-[1px] opacity-80" alt="flag"/>}
                             </span>
                             <span className="text-emerald-500/70 text-[10px] bg-slate-900 px-1.5 py-0.5 rounded">דק' {s.minute}</span>
                           </div>
                         ))
                       ) : (
                         <div className="text-xs text-slate-500 italic text-center py-1">תיקו מאופס / אין שערים</div>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
             )}
           </div>
         )}
       </div>
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-r from-indigo-900/50 to-slate-800 p-6 md:p-8 rounded-3xl border border-indigo-500/30 shadow-lg gap-6">
         <div>
           <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 flex items-center gap-2"><span>📡</span> ראדאר תובנות וביון</h2>
           <p className="text-slate-400 text-sm mt-2">סרוק את הנתונים, צפה בהתפלגויות הקהל, ולחץ על הברים כדי לראות מי בדיוק אמר מה.</p>
         </div>
         <button onClick={handleGenerateStats} disabled={isCalculating} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 px-8 rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95">
           {isCalculating ? "סורק נתונים מסווגים... ⏳" : "🔍 התחל סריקת ראדאר"}
         </button>
       </div>

       {!statsData ? (
         <div className="text-center text-slate-500 py-16 border border-dashed border-slate-700 rounded-3xl font-bold text-lg">יש ללחוץ על "סריקת ראדאר" כדי להציג את הנתונים המעודכנים.</div>
       ) : (
         <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
           
           <div className="bg-slate-800 p-6 md:p-8 rounded-3xl border border-slate-700 shadow-xl">
              <h3 className="text-xl md:text-2xl font-black text-white mb-6 border-b border-slate-700 pb-3">⚽ התפלגות ניחושי משחק</h3>
              <select value={selectedStatMatch} onChange={(e) => setSelectedStatMatch(e.target.value)} className="w-full bg-slate-900 text-blue-300 font-bold p-3.5 rounded-xl border border-slate-600 mb-6 outline-none shadow-inner cursor-pointer">
                {matches.map(m => (<option key={m.id} value={m.id}>{m.homeTeam} נגד {m.awayTeam}</option>))}
              </select>
              {statsData.matches[selectedStatMatch] ? (
                <>
                  {(() => {
                     const match = matches.find(m => m.id === selectedStatMatch);
                     const stats = statsData.matches[selectedStatMatch];
                     return (
                       <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 shadow-inner mb-6">
                         <div className="text-[10px] text-slate-500 mb-3 uppercase tracking-widest font-bold">ניחושי תוצאה (90 דקות):</div>
                         {renderProgressBar(match?.homeTeam || "קבוצת בית", stats.homeWins.length, stats.total, "bg-blue-500", () => { if(stats.homeWins.length>0) setStatSpyModal({ title: `הימרו על ${match?.homeTeam}`, list: stats.homeWins, type: "MATCH_DIRECTION" })})}
                         {renderProgressBar("תיקו", stats.draws.length, stats.total, "bg-slate-400", () => { if(stats.draws.length>0) setStatSpyModal({ title: `הימרו על תיקו`, list: stats.draws, type: "MATCH_DIRECTION" })})}
                         {renderProgressBar(match?.awayTeam || "קבוצת חוץ", stats.awayWins.length, stats.total, "bg-emerald-500", () => { if(stats.awayWins.length>0) setStatSpyModal({ title: `הימרו על ${match?.awayTeam}`, list: stats.awayWins, type: "MATCH_DIRECTION" })})}
                         
                         {/* אזור העולות - יופיע רק אם זה משחק נוקאאוט ויש נתונים */}
                         {match?.stage === "KNOCKOUT" && stats.qualifiers && Object.keys(stats.qualifiers).length > 0 && (
                            <div className="mt-6 border-t border-slate-700/80 pt-5">
                               <h4 className="text-sm font-black text-purple-400 mb-4 flex items-center gap-2"><span>🏆</span> מי תעפיל לשלב הבא? (כולל הארכה/פנדלים):</h4>
                               <div className="space-y-1">
                                 {Object.entries(stats.qualifiers)
                                    .sort(([,a]:any, [,b]:any) => b.count - a.count)
                                    .map(([team, data]: any) => (
                                       renderProgressBar(team, data.count, stats.total, team === match.homeTeam ? "bg-indigo-500" : "bg-teal-500", () => setStatSpyModal({ title: `הימרו ש${team} תעפיל`, list: data.users, type: "NAMES_ONLY" }))
                                 ))}
                               </div>
                            </div>
                         )}
                       </div>
                     )
                  })()}
                  <div>
                    <h4 className="text-sm font-black text-amber-400 mb-3 border-t border-slate-700/50 pt-4">התוצאות הכי פופולריות:</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(statsData.matches[selectedStatMatch].exactScores).sort(([,a]:any, [,b]:any) => b.count - a.count).slice(0, 6).map(([score, data]: any) => (
                          <button key={score} onClick={() => setStatSpyModal({ title: `הימרו על תוצאה מדויקת ${score}`, list: data.users, type: "NAMES_ONLY" })} className="bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-600 hover:border-amber-500 hover:bg-slate-800 font-black text-white flex gap-3 transition-colors shadow-sm">
                            <span className="tracking-widest">{score}</span><span className="text-amber-500 text-sm">({data.count})</span>
                          </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (<div className="text-slate-500 text-center py-8">אף אחד לא ניחש עדיין את המשחק הזה.</div>)}
           </div>

           <div className="bg-slate-800 p-6 md:p-8 rounded-3xl border border-slate-700 shadow-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 border-b border-slate-700 pb-3">
                <h3 className="text-xl md:text-2xl font-black text-amber-400">⭐ שאלות בונוס</h3>
                
                {isNumericBonus && (
                  <div className="flex gap-2 bg-slate-900 p-1 rounded-xl border border-slate-700 self-end sm:self-auto items-center">
                    {bonusViewMode === "chart" && (
                      <button 
                        onClick={handleDownloadGraphImage}
                        className="px-3 py-1.5 text-xs font-black rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-all flex items-center gap-1.5 ml-2"
                      >
                        <span>📷</span> תמונה לוואטסאפ
                      </button>
                    )}
                    <div className="flex border-r border-slate-700 pr-2">
                      <button 
                        onClick={() => setBonusViewMode("list")} 
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${bonusViewMode === "list" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"}`}
                      >
                        📋 פרופיל הימורים
                      </button>
                      <button 
                        onClick={() => setBonusViewMode("chart")} 
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${bonusViewMode === "chart" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"}`}
                      >
                        📊 גרף התפלגות
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <select value={selectedStatBonus} onChange={(e) => setSelectedStatBonus(e.target.value)} className="w-full bg-slate-900 text-amber-300 font-bold p-3.5 rounded-xl border border-slate-600 mb-6 outline-none shadow-inner cursor-pointer">
                {bonusQuestions.map(q => (<option key={q.id} value={q.id}>{q.label}</option>))}
              </select>

              {statsData.bonuses[selectedStatBonus] ? (
                bonusViewMode === "chart" && isNumericBonus ? (
                  /* עוטפים ב-dir="ltr" כדי למנוע את באג המרכוז של ה-SVG! */
                  <div className="overflow-x-auto custom-scrollbar" dir="ltr">
                    <div ref={chartRef} className="bg-slate-900 p-6 pr-8 rounded-2xl border border-slate-700/50 flex flex-col justify-center relative" style={{ height: dynamicChartHeight, minWidth: '500px' }}>
                       <div className="absolute top-4 right-6 text-slate-400 text-sm font-black tracking-widest opacity-50 z-10">
                         BETS IN PROD - מודיעין הקהל
                       </div>
                       <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={numericChartData} margin={{ top: 40, right: 60, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                            
                            {/* ציר LTR קלאסי: העמודה צומחת מימין לשמאל במסך LTR (שזה אומר שהיא צומחת ימינה) */}
                            <XAxis type="number" domain={[0, 'dataMax + 5']} stroke="#94a3b8" tick={{ fontSize: 12, fontWeight: 'bold' }} />
                            
                            {/* השמות מופיעים בצד שמאל, ומיושרים ימינה עד הקו בעזרת textAnchor: 'end' */}
                            <YAxis 
                              dataKey="name" 
                              type="category" 
                              width={140} 
                              stroke="#94a3b8" 
                              tick={{ fontSize: 13, fill: '#cbd5e1', fontWeight: 'bold', textAnchor: 'end', dx: -5 }} 
                            />
                            
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#475569', borderRadius: '14px', textAlign: 'right' }}
                              itemStyle={{ color: '#fbbf24', fontWeight: 'black', direction: 'rtl' }}
                              labelStyle={{ color: '#94a3b8', fontSize: '12px' }}
                              labelFormatter={(label) => `שחקן: ${label}`}
                              formatter={(value: any) => [`${value}`, "ניחוש"]}
                            />
                            
                            {/* העמודה צומחת ימינה באופן טבעי, המספר בקצה הימני */}
                            <Bar dataKey="guess" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                               <LabelList dataKey="guess" position="right" fill="#f8fafc" fontSize={14} fontWeight="black" offset={10} />
                            </Bar>
                          </BarChart>
                       </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 shadow-inner max-h-[300px] overflow-y-auto custom-scrollbar pr-2 space-y-2">
                    {Object.entries(statsData.bonuses[selectedStatBonus].answers).sort(([,a]:any, [,b]:any) => b.count - a.count).map(([answer, data]: any, idx) => {
                        return renderProgressBar(answer, data.count, statsData.bonuses[selectedStatBonus].total, idx === 0 ? "bg-amber-500" : "bg-slate-500", () => setStatSpyModal({ title: `הימרו על: ${answer}`, list: data.users, type: "NAMES_ONLY" }));
                    })}
                  </div>
                )
              ) : (<div className="text-slate-500 text-center py-8">אף אחד לא ענה על שאלת הבונוס הזו.</div>)}
           </div>

           <div className="bg-slate-800 p-6 md:p-8 rounded-3xl border border-slate-700 shadow-xl">
              <h3 className="text-xl md:text-2xl font-black text-teal-400 mb-6 border-b border-slate-700 pb-3">🥇 עולות מהבתים</h3>
              <select value={selectedStatGroup} onChange={(e) => setSelectedStatGroup(e.target.value)} className="w-full bg-slate-900 text-teal-300 font-bold p-3.5 rounded-xl border border-slate-600 mb-6 outline-none shadow-inner cursor-pointer">
                {groupsList.map(g => <option key={g} value={g}>בית {g}</option>)}
              </select>
              {statsData.qualifiers[selectedStatGroup] ? (
                <div className="space-y-6">
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 shadow-inner"><h4 className="text-teal-400 font-bold mb-4 border-b border-slate-700/50 pb-2">מקום 1:</h4>{Object.entries(statsData.qualifiers[selectedStatGroup].first).sort(([,a]:any, [,b]:any) => b.count - a.count).map(([team, data]: any) => renderProgressBar(team, data.count, statsData.qualifiers[selectedStatGroup].total, "bg-teal-500", () => setStatSpyModal({ title: `הימרו על ${team} (מקום 1 - בית ${selectedStatGroup})`, list: data.users, type: "NAMES_ONLY" })))}</div>
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 shadow-inner"><h4 className="text-emerald-400 font-bold mb-4 border-b border-slate-700/50 pb-2">מקום 2:</h4>{Object.entries(statsData.qualifiers[selectedStatGroup].second).sort(([,a]:any, [,b]:any) => b.count - a.count).map(([team, data]: any) => renderProgressBar(team, data.count, statsData.qualifiers[selectedStatGroup].total, "bg-emerald-500", () => setStatSpyModal({ title: `הימרו על ${team} (מקום 2 - בית ${selectedStatGroup})`, list: data.users, type: "NAMES_ONLY" })))}</div>
                </div>
              ) : (<div className="text-slate-500 text-center py-8">אין נתונים.</div>)}
           </div>

           <div className="bg-slate-800 p-6 md:p-8 rounded-3xl border border-slate-700 shadow-xl">
              <h3 className="text-xl md:text-2xl font-black text-rose-400 mb-6 border-b border-slate-700 pb-3">🥉 8 המעפילות (מקום 3)</h3>
              {Object.keys(statsData.thirdPlace.teams).length > 0 ? (
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 shadow-inner max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                  <div className="text-[10px] text-slate-500 mb-4 uppercase tracking-widest font-bold">אחוזים מחושבים מתוך סך המשתתפים שהצביעו:</div>
                  <div className="space-y-3">
                    {Object.entries(statsData.thirdPlace.teams).sort(([,a]:any, [,b]:any) => b.count - a.count).map(([team, data]: any) => renderProgressBar(team, data.count, statsData.thirdPlace.totalUsers, "bg-rose-500", () => setStatSpyModal({ title: `הימרו על ${team} (מקום 3)`, list: data.users, type: "NAMES_ONLY" })))}
                  </div>
                </div>
              ) : (<div className="text-slate-500 text-center py-8">אין נתונים.</div>)}
           </div>

         </div>
       )}

       {statSpyModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in-up">
            <div className="bg-slate-900 border border-slate-600 p-6 rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden md:resize">
               <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800 shrink-0">
                 <h3 className="text-xl font-bold text-white flex items-center gap-2"><span>👀</span> {statSpyModal.title}</h3>
                 <button onClick={() => setStatSpyModal(null)} className="text-slate-400 hover:text-rose-400 font-bold w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 transition-colors">✕</button>
               </div>
               <div className="overflow-y-auto custom-scrollbar flex-1 pr-2 space-y-2">
                  {statSpyModal.type === "NAMES_ONLY" ? (
                     statSpyModal.list.map((uObj, i) => (
                       <div key={i} className="bg-slate-800 p-3 rounded-xl border border-slate-700 text-white font-bold flex justify-between items-center gap-3 hover:bg-slate-700 transition-colors shadow-sm">
                         <div className="flex items-center gap-2"><span className="text-slate-500 text-xs w-4">{i+1}.</span> {uObj.name || uObj}</div>
                         {uObj.time && <div className="text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-700 px-2 py-1 rounded">עדכון: {uObj.time}</div>}
                       </div>
                     ))
                  ) : (
                     statSpyModal.list.sort((a, b) => b.home - a.home).map((userObj, i) => (
                       <div key={i} className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex justify-between items-center hover:bg-slate-700 transition-colors shadow-sm">
                          <div className="text-white font-bold flex flex-col gap-1">
                            <div className="flex items-center gap-2"><span className="text-slate-500 text-xs w-4">{i+1}.</span> {userObj.name}</div>
                            {userObj.time && <div className="text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-700 px-2 py-1 rounded inline-block w-fit">עדכון: {userObj.time}</div>}
                          </div>
                          <div className="font-black text-slate-200 tracking-widest bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-700 shadow-inner">
                            {userObj.home} - {userObj.away}
                          </div>
                       </div>
                     ))
                  )}
               </div>
            </div>
         </div>
       )}
       {showLeagueSummaryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm overflow-y-auto" dir="rtl">
          <div className="flex flex-col items-center max-h-screen py-10">
            <button onClick={() => setShowLeagueSummaryModal(false)} className="mb-4 bg-slate-800 text-white px-4 py-2 rounded-full font-bold">✕ סגור תצוגה מקדימה</button>

            {/* ה-DIV המצולם */}
            <div className="overflow-x-auto custom-scrollbar w-full max-w-[95vw]">
               <div ref={summaryRef} className="bg-slate-900 border-2 border-blue-500/50 p-6 md:p-10 rounded-3xl min-w-[800px] shadow-2xl relative overflow-hidden shrink-0">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                  
                  {/* כותרת התמונה */}
                  <div className="text-center mb-8 relative z-10">
                     <h2 className="text-4xl font-black text-white drop-shadow-md mb-2">סיכום שלב הבתים 🏆</h2>
                     <h3 className="text-xl font-bold text-blue-400">האמת כולה על השולחן - מי הפציץ ומי עשה פדיחות?</h3>
                  </div>

                  {/* טבלת הליגה */}
                  <div className="w-full bg-slate-950 rounded-2xl border border-slate-700 shadow-inner relative z-10">
                     <table className="w-full text-right text-sm">
                        <thead className="bg-slate-800 border-b-2 border-slate-700 text-slate-300">
                           <tr>
                              <th className="p-4 font-black">מקום</th>
                              <th className="p-4 font-black">חבר פאנל</th>
                              <th className="p-4 font-black text-blue-400">סה"כ נק'</th>
                              <th className="p-4 font-black text-emerald-400">בולים 🎯</th>
                              <th className="p-4 font-black text-teal-400">מעפילות 🌍</th>
                              <th className="p-4 font-black text-purple-400">בונוסים 🎁</th>
                              <th className="p-4 font-black text-amber-400">הברקת הטורניר 💡</th>
                           </tr>
                        </thead>
                        <tbody>
                           {leagueSummaryUsers.map((u, i) => (
                              <tr key={u.id} className={`border-b border-slate-800/60 font-bold transition-colors ${i === 0 ? 'bg-amber-500/10' : i === leagueSummaryUsers.length - 1 ? 'bg-rose-500/10 opacity-70' : 'hover:bg-slate-800/40'}`}>
                                 <td className="p-4 text-slate-400">{i + 1}</td>
                                 <td className="p-4 text-white text-base">
                                    {u.name?.split(" ")[0]} {i === 0 && "👑"} {i === leagueSummaryUsers.length - 1 && "🤦‍♂️"}
                                 </td>
                                 <td className="p-4 text-blue-400 text-lg">{u.totalPoints || 0}</td>
                                 <td className="p-4 text-emerald-400">{u.wrappedData?.exactHits || 0}</td>
                                 <td className="p-4 text-teal-400">{(u.wrappedData?.qualPoints || 0) + (u.wrappedData?.thirdPlacePoints || 0)}</td>
                                 <td className="p-4 text-purple-400">{u.wrappedData?.bonusPoints || 0}</td>
                                 <td className="p-4 text-amber-400 text-[11px] max-w-[150px] leading-tight">
                                    {u.wrappedData?.rarestHit ? (
                                       <span className="block truncate" title={u.wrappedData.rarestHit.matchTitle}>
                                          {u.wrappedData.rarestHit.matchTitle} <br/><span className="text-slate-300">({u.wrappedData.rarestHit.score})</span>
                                       </span>
                                    ) : (
                                       <span className="text-slate-600">-</span>
                                    )}
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
                  
                  <div className="mt-8 text-center opacity-40">
                     <span className="font-black text-white text-lg tracking-widest italic">BETS IN PROD</span>
                  </div>
               </div>
            </div>

            <button 
              onClick={handleExportLeagueSummary} 
              className="mt-6 bg-emerald-600 hover:bg-emerald-500 px-8 py-4 rounded-xl text-white font-black shadow-[0_0_20px_rgba(16,185,129,0.4)] text-lg flex items-center gap-2 transition-transform active:scale-95"
            >
              <span>📸</span> לחץ כאן כדי לצלם את הדוח לתמונה!
            </button>
          </div>
        </div>
      )}
       
    </div>
  );
  
}