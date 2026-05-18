"use client";
import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, getDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import Link from "next/link";
import { getFlagUrl } from "../utils/flags";

type TabType = "MATCHES" | "QUALIFIERS" | "BONUS";

// הפונקציה שבודקת האם משחק ננעל
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
    if ((m.roundName === "גמר" || m.roundName === "מקום שלישי") && s >= 13) return true;
    return false;
  }
};

// פונקציית קריאת זמנים בדיוק לפי השעון המקומי
const parseDateTimeLocal = (dtStr: string) => {
  if (!dtStr) return 0;
  try {
    if (dtStr.includes("T")) {
      const [datePart, timePart] = dtStr.split("T");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hour, minute] = timePart.split(":").map(Number);
      return new Date(year, month - 1, day, hour, minute).getTime();
    }
    return new Date(dtStr).getTime();
  } catch { return 0; }
};

export default function MatrixPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any>({});
  const [bonusQuestions, setBonusQuestions] = useState<any[]>([]);
  const [bonusPredictions, setBonusPredictions] = useState<any>({});
  const [qualifiersPredictions, setQualifiersPredictions] = useState<any>({});
  const [thirdPlacePredictions, setThirdPlacePredictions] = useState<any>({});
  
  const [realQualifiers, setRealQualifiers] = useState<any>({});
  const [realThirdPlace, setRealThirdPlace] = useState<any[]>([]);
  const [realBonusFull, setRealBonusFull] = useState<any>({});

  const [tournamentState, setTournamentState] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
// 👑 כאן בדיוק להדביק: המשתנים החדשים של עמדת ה-VAR
  // --- States for VAR Station (AI) ---
  const [varQuery, setVarQuery] = useState("");
  const [varResponse, setVarResponse] = useState("");
  const [isVarLoading, setIsVarLoading] = useState(false);
  const [isVarModalOpen, setIsVarModalOpen] = useState(false); // שולט בפתיחת הפופ-אפ
  const [activeTab, setActiveTab] = useState<TabType>("MATCHES");
  const [searchPlayer, setSearchPlayer] = useState("");
  const [searchTeam, setSearchTeam] = useState("");
  const [filterMatchday, setFilterMatchday] = useState("ALL");
  const [filterDate, setFilterDate] = useState("");
  
  const [filterBonusPhase, setFilterBonusPhase] = useState("ALL");

  // שעון חי כדי לחשוף שאלות הפתעה ברגע שהן נסגרות
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [uSnap, mSnap, pSnap, pkSnap, bpSnap, qSnap, tpSnap, bqDoc, aqDoc, atDoc, abDoc, sysDoc] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "matches")),
          getDocs(collection(db, "predictions_matches")),
          getDocs(collection(db, "predictions_knockout")),
          getDocs(collection(db, "predictions_bonus")),
          getDocs(collection(db, "predictions_qualifiers")),
          getDocs(collection(db, "predictions_third_place")),
          getDoc(doc(db, "settings", "bonus_questions")),
          getDoc(doc(db, "admin_results", "qualifiers")),
          getDoc(doc(db, "admin_results", "third_place")),
          getDoc(doc(db, "admin_results", "bonus")),
          getDoc(doc(db, "settings", "system")) 
        ]);

        if (sysDoc.exists()) {
           setTournamentState(sysDoc.data().tournamentState || 0);
        }

        const uList: any[] = [];
        uSnap.forEach(d => uList.push({ id: d.id, ...d.data() }));
        uList.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
        setUsers(uList);

const mList: any[] = [];
        mSnap.forEach(d => mList.push({ id: d.id, ...d.data() }));
        
        // --- מילון סדר השלבים הקשיח ---
        const ROUND_ORDER: Record<string, number> = {
          "32 הגדולות": 1,
          "שמינית גמר": 2,
          "רבע גמר": 3,
          "חצי גמר": 4,
          "מקום שלישי": 5,
          "גמר": 6
        };

        mList.sort((a, b) => {
            // קודם כל, בתים לפני נוקאאוט
            if (a.stage !== "KNOCKOUT" && b.stage === "KNOCKOUT") return -1;
            if (a.stage === "KNOCKOUT" && b.stage !== "KNOCKOUT") return 1;
            
            // אם שניהם נוקאאוט - מיין לפי המילון שלנו!
            if (a.stage === "KNOCKOUT" && b.stage === "KNOCKOUT") {
                const orderA = ROUND_ORDER[a.roundName] || 99;
                const orderB = ROUND_ORDER[b.roundName] || 99;
                if (orderA !== orderB) return orderA - orderB;
            }
            
            // אם זה שלב הבתים, מיין לפי מחזור
            return (a.matchday || 1) - (b.matchday || 1) || String(a.id).localeCompare(String(b.id));
        });

        setMatches(mList);

        const preds: any = {};
        pSnap.forEach(d => {
          const data = d.data();
          const uid = data.userId || d.id;
          if (!preds[uid]) preds[uid] = {};
          preds[uid][data.matchId] = data; 
        });
        pkSnap.forEach(d => {
          const data = d.data();
          const uid = data.userId || d.id;
          if (!preds[uid]) preds[uid] = {};
          preds[uid][data.matchId] = data; 
        });
        setPredictions(preds);

        if (bqDoc.exists() && bqDoc.data().questions) {
            setBonusQuestions(bqDoc.data().questions);
        }

        const bPreds: any = {};
        bpSnap.forEach(d => {
          const data = d.data();
          bPreds[d.id] = data.answers || {}; 
        });
        setBonusPredictions(bPreds);

        const qPreds: any = {};
        qSnap.forEach(d => {
           qPreds[d.id] = d.data().groups || {};
        });
        setQualifiersPredictions(qPreds);

        const tpPreds: any = {};
        tpSnap.forEach(d => {
           tpPreds[d.id] = d.data();
        });
        setThirdPlacePredictions(tpPreds);

        if (aqDoc.exists()) setRealQualifiers(aqDoc.data().results || {});
        if (atDoc.exists()) setRealThirdPlace(atDoc.data().teams || []);
        if (abDoc.exists()) {
           setRealBonusFull({
              answers: abDoc.data().answers || {},
              blacklist: abDoc.data().blacklist || {},
              leading: abDoc.data().leading || {},
              locked: abDoc.data().locked || {}
           });
        }

      } catch (error) {
        console.error("Error fetching matrix data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, []);

  const filteredUsers = useMemo(() => users.filter(u => u.name.toLowerCase().includes(searchPlayer.toLowerCase())), [users, searchPlayer]);
  
  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      const teamMatch = m.homeTeam.includes(searchTeam) || m.awayTeam.includes(searchTeam);
      
      let matchdayMatch = true;
      if (filterMatchday !== "ALL") {
         if (filterMatchday === "KNOCKOUT") {
             matchdayMatch = m.stage === "KNOCKOUT";
         } else if (["32 הגדולות", "שמינית גמר", "רבע גמר", "חצי גמר", "גמר","מקום 3"].includes(filterMatchday)) {
             matchdayMatch = m.stage === "KNOCKOUT" && (m.roundName === filterMatchday || (filterMatchday === "גמר" && m.roundName === "מקום שלישי"));
         } else {
             matchdayMatch = String(m.matchday) === filterMatchday;
         }
      }
      
      let dateMatch = true;
      if (filterDate && m.matchDate) {
         const [year, month, day] = filterDate.split("-");
         const formattedDate = `${day}/${month}/${year}`;
         dateMatch = m.matchDate.startsWith(formattedDate);
      } else if (filterDate) {
         dateMatch = false; 
      }

      return teamMatch && matchdayMatch && dateMatch;
    });
  }, [matches, searchTeam, filterMatchday, filterDate]);

  // סינון הבונוסים - עודכן לתפוס "ALL" לפי מסד הנתונים
  const filteredBonusQuestions = useMemo(() => {
    return bonusQuestions.filter(q => {
      if (filterBonusPhase === "ALL") return true;
      if (filterBonusPhase === "TOURNAMENT") return q.phase === "TOURNAMENT" || (!q.phase && !q.isSurprise);
      if (filterBonusPhase === "GROUPS") return q.phase === "GROUPS";
      if (filterBonusPhase === "KNOCKOUT_GENERAL") {
          // הבדיקה המורחבת: מוודאת "ALL" בדיוק כפי שנשמר ב-DB
          return q.phase === "KNOCKOUT" && (!q.knockoutRound || q.knockoutRound === "" || q.knockoutRound === "ALL" || q.knockoutRound.includes("כללי"));
      }
      if (["32 הגדולות", "שמינית גמר", "רבע גמר", "חצי גמר", "גמר","מקום 3"].includes(filterBonusPhase)) {
          return q.phase === "KNOCKOUT" && q.knockoutRound === filterBonusPhase;
      }
      if (filterBonusPhase === "SURPRISE") return q.isSurprise;
      return true;
    });
  }, [bonusQuestions, filterBonusPhase]);

  const handleExportCSV = () => {
    let csvContent = "\uFEFF";
    const escapeCSV = (str: string) => `"${String(str).replace(/"/g, '""')}"`;

    if (activeTab === "MATCHES") {
       const headers = ["דירוג", "שחקן", "נקודות"];
       filteredMatches.forEach(m => headers.push(`${m.homeTeam} נגד ${m.awayTeam} (${m.stage === "KNOCKOUT" ? m.roundName : `מחזור ${m.matchday}`})`));
       csvContent += headers.map(escapeCSV).join(",") + "\n";

       filteredUsers.forEach((u, idx) => {
          const row = [String(idx + 1), u.name || "ללא שם", String(u.totalPoints || 0)];
          filteredMatches.forEach(m => {
             const uData = predictions[u.id];
             const p = uData ? uData[m.id] : null;
             
             const isMatchExposed = tournamentState > 0 && (m.isFinished || checkIsMatchLocked(m, tournamentState));
             
             if (!isMatchExposed) row.push("מוסתר");
             else if (!p || p.predictedHomeScore === undefined || p.predictedHomeScore === "") row.push("--");
             else row.push(`${p.predictedHomeScore}-${p.predictedAwayScore}`);
          });
          csvContent += row.map(escapeCSV).join(",") + "\n";
       });
    } 
    else if (activeTab === "QUALIFIERS") {
       const headers = ["דירוג", "שחקן", "נקודות"];
       ["A","B","C","D","E","F","G","H","I","J","K","L"].forEach(g => { 
           headers.push(`בית ${g} - מקום 1`); 
           headers.push(`בית ${g} - מקום 2`); 
       });
       headers.push("8 המעפילות (מקום 3)");
       csvContent += headers.map(escapeCSV).join(",") + "\n";

       filteredUsers.forEach((u, idx) => {
          const row = [String(idx + 1), u.name || "ללא שם", String(u.totalPoints || 0)];
          const isQualExposed = tournamentState >= 1;
          
          ["A","B","C","D","E","F","G","H","I","J","K","L"].forEach(g => {
             if (!isQualExposed) { row.push("מוסתר"); row.push("מוסתר"); }
             else {
                const groupPred = qualifiersPredictions[u.id]?.[g];
                row.push(groupPred?.first || "--");
                row.push(groupPred?.second || "--");
             }
          });
          
          const isThirdExposed = tournamentState >= 1;
          if (!isThirdExposed) {
             row.push("מוסתר");
          } else {
             const uTeams = thirdPlacePredictions[u.id]?.teams || [];
             row.push(uTeams.length > 0 ? uTeams.join(", ") : "--");
          }
          csvContent += row.map(escapeCSV).join(",") + "\n";
       });
    } 
    else if (activeTab === "BONUS") {
       const headers = ["דירוג", "שחקן", "נקודות"];
       filteredBonusQuestions.forEach(q => headers.push(q.label || q.questionText));
       csvContent += headers.map(escapeCSV).join(",") + "\n";

       filteredUsers.forEach((u, idx) => {
          const row = [String(idx + 1), u.name || "ללא שם", String(u.totalPoints || 0)];
          filteredBonusQuestions.forEach(q => {
             let answerText = "--";
             const bData = bonusPredictions[u.id];
             if (bData && bData[q.id] !== undefined) answerText = String(bData[q.id]);

             const phase = q.phase || "TOURNAMENT";
             let isExposed = (phase === "KNOCKOUT") ? (tournamentState >= 5) : (tournamentState >= 1);

             if (q.isSurprise) {
                const closeMs = parseDateTimeLocal(q.closeTime);
                isExposed = nowMs > closeMs;
             }

             if (!isExposed) row.push("מוסתר");
             else row.push(answerText);
          });
          csvContent += row.map(escapeCSV).join(",") + "\n";
       });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const tabName = activeTab === "MATCHES" ? "matches" : activeTab === "QUALIFIERS" ? "qualifiers" : "bonus";
    link.setAttribute("download", `due_disclosure_${tabName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  // --- Function to fetch AI answer using Local Matrix State ---
  // --- Function to fetch AI answer using Local Matrix State (Agentic Pre-filtering) ---
  const handleAskVAR = async () => {
    if (!varQuery.trim()) return;
    
    setIsVarLoading(true);
    setVarResponse(""); 
    
    try {
      // 🛡️ הגנה: בוא נגדיר contextData מקומי אם הוא לא קיים בגלובל
      // אם יש לך משתנה אחר ב-page.tsx שמחזיק את הנתונים, תחליף את ה-{} בשם שלו
      const dataToSend = typeof contextData !== 'undefined' ? contextData : { activeTab: "MATCHES" };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: varQuery, context: dataToSend })
      });
      
      const rawText = await res.text();
      
      if (!res.ok) {
         throw new Error(`Server returned ${res.status}`);
      }

      const data = JSON.parse(rawText);
      setVarResponse(data.reply || "אין תשובה מה-AI.");
      
    } catch (error: any) {
      console.error("VAR Error:", error);
      setVarResponse(`ה-VAR שבת מפעילות. תקלה: ${error.message}`);
    } finally {
      setIsVarLoading(false);
    }
  };
    
    setIsVarLoading(true);
    setVarResponse(""); 
    
    try {
      // ... (שאר הקוד של הכנת ה-contextData נשאר בדיוק אותו דבר) ...
      // (תוודא שה-contextData מוגדר כמו שהיה קודם)

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: varQuery, context: contextData })
      });
      
      // התיקון המכריע: קוראים את התוכן פעם אחת בלבד!
      const data = await res.json();
      
      if (!res.ok) {
         throw new Error(data.error || `Server error: ${res.status}`);
      }

      if (data.reply) {
        setVarResponse(data.reply);
      } else {
        setVarResponse("השופטים מתקשים לקבל החלטה. נסה לנסח מחדש.");
      }
      
    } catch (error: any) {
      console.error("VAR Error:", error);
      setVarResponse(`ה-VAR שבת מפעילות. תקלה טכנית: ${error.message}`);
    } finally {
      setIsVarLoading(false);
    }
  };
  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-400 font-black animate-pulse text-2xl" dir="rtl">טוען נתוני גילוי נאות... 🕵️‍♂️</div>;

  const groupsList = ["A","B","C","D","E","F","G","H","I","J","K","L"];

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8" dir="rtl">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes eyeBlink {
          0%, 90%, 100% { transform: scaleY(1); }
          92% { transform: scaleY(0.1); }
          94% { transform: scaleY(1); }
          96% { transform: scaleY(0.1); }
          98% { transform: scaleY(1); }
        }
        .animate-eye-blink {
          display: inline-block;
          animation: eyeBlink 4s infinite;
          transform-origin: center;
        }
      `}} />

      <div className="max-w-[98vw] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
         <div>
            <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
               <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">דף גילוי נאות</span>
               <span className="animate-eye-blink drop-shadow-md">👁️</span>
            </h1>
            <p className="text-slate-400 text-xs mt-1 font-medium bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 inline-block">
               {activeTab === "MATCHES" && "🟢 בול | 🔵 כיוון נכון | 🔴 טעות | 🔒 נחשף בתחילת השלב"}
               {activeTab === "QUALIFIERS" && "🟢 בול | 🔵 פגיעה חלקית (הצלבה) | 🔴 טעות | 🔒 נחשף בתחילת השלב"}
               {activeTab === "BONUS" && "🟢 בול | 👑 מוביל זמני | 🔵 במשחק | 🔴 נפסל (קו חוצה) | 🔒 נחשף בהתאם לשלב או לסגירת השאלה"}
            </p>
         </div>
         <div className="flex flex-wrap gap-3 items-center">
            <button onClick={handleExportCSV} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold transition-all border border-emerald-500 shadow-sm flex items-center gap-2 active:scale-95">
               <span>📊</span> ייצא לאקסל
            </button>
            <Link href="/" className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all border border-slate-700 shadow-sm shrink-0">חזור לדאשבורד 🏠</Link>
         </div>
      </div>

      <div className="flex overflow-x-auto custom-scrollbar gap-2 mb-6 pb-2 bg-slate-900/50 p-2 rounded-2xl border border-slate-800 max-w-2xl mx-auto md:justify-center">
        <button 
          onClick={() => setActiveTab("MATCHES")} 
          className={`flex flex-1 items-center justify-center gap-2 min-w-[120px] px-4 py-3 rounded-xl font-black whitespace-nowrap transition-all text-sm ${activeTab === "MATCHES" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-blue-400"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          משחקים
        </button>

        <button 
          onClick={() => setActiveTab("QUALIFIERS")} 
          className={`flex flex-1 items-center justify-center gap-2 min-w-[120px] px-4 py-3 rounded-xl font-black whitespace-nowrap transition-all text-sm ${activeTab === "QUALIFIERS" ? "bg-teal-600 text-white shadow-lg shadow-teal-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-teal-400"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <circle cx="12" cy="15" r="5" /><path d="M8.21 13.89L7 3h2l1 5h4l1-5h2l-1.21 10.89" />
          </svg>
          מעפילות
        </button>

        <button 
          onClick={() => setActiveTab("BONUS")} 
          className={`flex flex-1 items-center justify-center gap-2 min-w-[120px] px-4 py-3 rounded-xl font-black whitespace-nowrap transition-all text-sm ${activeTab === "BONUS" ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-amber-400"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          בונוסים
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/50 items-end">
        <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
          <label className="text-[10px] font-bold text-slate-500 mr-1">🔍 חפש שחקן</label>
          <input type="text" value={searchPlayer} onChange={e => setSearchPlayer(e.target.value)} placeholder="שם השחקן..." className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2 text-sm outline-none focus:border-blue-500" />
        </div>
        
        {activeTab === "MATCHES" && (
          <>
            <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
              <label className="text-[10px] font-bold text-slate-500 mr-1">🏟️ חפש קבוצה</label>
              <input type="text" value={searchTeam} onChange={e => setSearchTeam(e.target.value)} placeholder="שם קבוצה..." className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
              <label className="text-[10px] font-bold text-slate-500 mr-1">📅 שלב / מחזור</label>
              <select value={filterMatchday} onChange={e => setFilterMatchday(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2 text-sm outline-none focus:border-blue-500">
                <option value="ALL">הכל</option>
                <option value="1">מחזור 1</option>
                <option value="2">מחזור 2</option>
                <option value="3">מחזור 3</option>
                <option value="KNOCKOUT">כל הנוק-אאוט</option>
                <option value="32 הגדולות">-- 32 הגדולות</option>
                <option value="שמינית גמר">-- שמינית גמר</option>
                <option value="רבע גמר">-- רבע גמר</option>
                <option value="חצי גמר">-- חצי גמר</option>
                <option value="גמר">-- גמר</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
              <label className="text-[10px] font-bold text-slate-500 mr-1">📆 סנן לפי תאריך</label>
              <input 
                type="date" 
                value={filterDate} 
                onChange={e => setFilterDate(e.target.value)} 
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2 text-sm outline-none focus:border-blue-500 cursor-pointer " 
                dir="ltr" 
              />
            </div>
          </>
        )}

        {activeTab === "BONUS" && (
           <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
              <label className="text-[10px] font-bold text-slate-500 mr-1">🏷️ שלב הבונוס</label>
              <select value={filterBonusPhase} onChange={e => setFilterBonusPhase(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2 text-sm outline-none focus:border-blue-500">
                <option value="ALL">הכל</option>
                <option value="TOURNAMENT">כל הטורניר</option>
                <option value="GROUPS">שלב הבתים</option>
                <option value="KNOCKOUT_GENERAL">נוקאאוט כללי</option>
                <option value="32 הגדולות">שלב 32</option>
                <option value="שמינית גמר">שמינית הגמר</option>
                <option value="רבע גמר">רבע גמר</option>
                <option value="חצי גמר">חצי גמר</option>
                <option value="גמר">גמר</option>
                <option value="SURPRISE">שאלות הפתעה</option>
              </select>
           </div>
        )}
      </div>
{/* 🔍 שורת הפעלה מהירה ל-VAR */}
      <div className="w-full max-w-4xl mx-auto mb-6 bg-slate-950 border border-slate-800 rounded-2xl p-3 flex gap-3 shadow-inner" dir="rtl">
        <input
          type="text"
          value={varQuery}
          onChange={(e) => setVarQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && varQuery.trim()) {
              setIsVarModalOpen(true);
              handleAskVAR();
            }
          }}
          placeholder="שלח אירוע לבדיקת שופטי המסך... (לדוגמה: מה דקל הימר על מקסיקו?)"
          className="flex-1 bg-black text-blue-400 font-mono text-sm px-4 py-3 rounded-xl border border-slate-800 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all placeholder-slate-700"
        />
        <button
          onClick={() => {
            if (varQuery.trim()) {
              setIsVarModalOpen(true);
              handleAskVAR();
            }
          }}
          className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 font-bold px-6 py-3 rounded-xl font-mono text-xs border border-rose-900/50 shadow-md transition-all uppercase tracking-wider whitespace-nowrap active:scale-95"
        >
          🚨 שלח לבדיקה
        </button>
      </div>
<div className="max-w-[98vw] mx-auto bg-slate-900/80 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
         <div className="overflow-auto max-h-[65vh] w-full custom-scrollbar">
            <table className="w-max min-w-full text-center border-collapse text-sm">
               
               <thead>
                  <tr className="bg-slate-950">
                     <th className="sticky top-0 right-0 z-30 bg-slate-950 border-b-2 border-l border-slate-700 p-4 min-w-[150px] shadow-xl">
                        <div className="font-black text-slate-300">דירוג \ שחקן</div>
                     </th>
                     
                     {activeTab === "MATCHES" && filteredMatches.map(m => (
                        <th key={m.id} className="sticky top-0 z-20 bg-slate-900 border-b-2 border-l border-slate-700/50 p-2 min-w-[110px]">
                           <div className="flex flex-col items-center gap-1.5">
                              <span className="text-[9px] text-slate-500 font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">{m.stage === "KNOCKOUT" ? m.roundName : `מחזור ${m.matchday}`}</span>
                              <div className="flex items-center gap-1.5">
                                 <div className="flex flex-col items-center w-8"><img src={getFlagUrl(m.homeTeam)} className="w-5 h-4 object-cover rounded-sm mb-1 shadow-sm" /><span className="text-[9px] font-black text-slate-200 truncate w-full text-center">{m.homeTeam.substring(0,3)}</span></div>
                                 <span className="text-slate-600 text-xs font-black">-</span>
                                 <div className="flex flex-col items-center w-8"><img src={getFlagUrl(m.awayTeam)} className="w-5 h-4 object-cover rounded-sm mb-1 shadow-sm" /><span className="text-[9px] font-black text-slate-200 truncate w-full text-center">{m.awayTeam.substring(0,3)}</span></div>
                              </div>
                              {m.isFinished && (
                                <div className="text-[10px] text-emerald-400 font-black bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/20 mt-1 flex flex-col items-center justify-center gap-0.5 w-full">
                                  <div className="flex items-center justify-center gap-1">
                                    <span className="w-3 text-center">{m.realHomeScore}</span><span className="text-emerald-500/50">-</span><span className="w-3 text-center">{m.realAwayScore}</span>
                                  </div>
                                  {m.stage === "KNOCKOUT" && m.realQualifier && (
                                     <span className="text-[8px] bg-emerald-800/40 px-1 rounded text-emerald-300">עולה: {m.realQualifier}</span>
                                  )}
                                </div>
                              )} 
                           </div>
                        </th>
                     ))}

                     {activeTab === "QUALIFIERS" && groupsList.map(group => {
                        const rG = realQualifiers[group];
                        return (
                          <th key={group} className="sticky top-0 z-20 bg-slate-900 border-b-2 border-l border-slate-700/50 p-3 min-w-[120px]">
                             <div className="font-black text-slate-300">בית {group}</div>
                             {rG && (rG.first || rG.second) && (
                                <div className="text-[9px] text-emerald-400 font-black bg-emerald-900/30 px-1.5 py-0.5 rounded border border-emerald-500/20 mt-1 flex flex-col gap-0.5">
                                   <div className="flex items-center gap-1">🥇 {getFlagUrl(rG.first) && <img src={getFlagUrl(rG.first)!} className="w-3 h-2 rounded-sm shadow-sm" />} {rG.first || "?"}</div>
                                   <div className="flex items-center gap-1">🥈 {getFlagUrl(rG.second) && <img src={getFlagUrl(rG.second)!} className="w-3 h-2 rounded-sm shadow-sm" />} {rG.second || "?"}</div>
                                </div>
                             )}
                          </th>
                        );
                     })}

                     {activeTab === "QUALIFIERS" && (
                        <th className="sticky top-0 z-20 bg-purple-900/20 border-b-2 border-l border-purple-500/30 p-4 min-w-[180px]">
                           <div className="font-black text-purple-300">8 המעפילות</div>
                           {realThirdPlace.filter(x=>x).length > 0 && (
                              <div className="grid grid-cols-4 gap-0.5 min-w-[150px] max-w-[180px] mx-auto mt-2">
                                {realThirdPlace.filter(x=>x).map((t, idx) => (
                                   <div key={idx} className="text-[9px] text-emerald-400 font-black bg-emerald-900/40 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1 shadow-sm">
                                      {getFlagUrl(t) && <img src={getFlagUrl(t)!} className="w-3 h-2 rounded-sm" alt="" />}
                                      {t}
                                   </div>
                                ))}
                              </div>
                           )}
                        </th>
                     )}

                     {activeTab === "BONUS" && filteredBonusQuestions.map(q => {
                        const truth = realBonusFull.answers?.[q.id];
                        const truthStr = truth ? (Array.isArray(truth) ? truth.join(", ") : truth) : null;
                        return (
                         <th key={q.id} className="sticky top-0 z-20 bg-slate-900 border-b-2 border-l border-slate-700/50 p-4 min-w-[160px] text-[11px] max-w-[180px]">
                           <div className="flex flex-col gap-1.5 mb-1.5">
                              <div className={`text-[9px] font-black flex items-center justify-center gap-1 px-1.5 py-0.5 rounded border shadow-sm ${
                                q.isSurprise ? 'bg-purple-950/40 text-purple-400 border-purple-500/30' : 
                                q.phase === 'KNOCKOUT' ? 'bg-rose-950/40 text-rose-400 border-rose-500/30' : 
                                'bg-emerald-950/30 text-emerald-400 border-emerald-500/20'
                              }`}>
                                 <span>{q.isSurprise ? "🎁 הפתעה" : q.phase === "KNOCKOUT" ? "🔥 נוק-אאוט" : "🏆 בתים/כללי"}</span>
                                 <span className="opacity-40">|</span>
                                 <span>{q.points || 0} נק'</span>
                              </div>
                           </div>
                           <div className="line-clamp-2 text-slate-300 font-bold leading-tight" title={q.label || q.questionText}>{q.label || q.questionText}</div>
                           {truthStr && (
                             <div className="text-[9px] text-emerald-400 font-black bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/20 mt-2 shadow-sm truncate flex items-center justify-center gap-1" title={truthStr}>
                               <span>אמת:</span>
                               {getFlagUrl(truthStr) && <img src={getFlagUrl(truthStr)!} className="w-3 h-2 rounded-sm shadow-sm" />}
                               <span className="truncate">{truthStr}</span>
                             </div>
                           )}
                         </th>
                        );
                     })}
                  </tr>
               </thead>
               
               <tbody>
                  {filteredUsers.map((u, idx) => (
                    <tr key={u.id} className="hover:bg-slate-800/50 transition-colors group">
                      
                      <td className="sticky right-0 z-10 bg-slate-950 group-hover:bg-slate-900 border-b border-l border-slate-700/80 p-3 shadow-xl transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] text-slate-500 font-mono">{idx + 1}.</span>
                          <span className="font-bold text-white text-xs truncate max-w-[80px]" title={u.name}>{u.name}</span>
                          <span className="bg-amber-500/10 text-amber-400 text-[10px] px-2 py-0.5 rounded border border-amber-500/20">{u.totalPoints || 0}</span>
                        </div>
                      </td>

                      {activeTab === "MATCHES" && filteredMatches.map(m => {
                        const uData = predictions[u.id];
                        const p = uData ? uData[m.id] : null;
                        
                        const isMatchExposed = tournamentState > 0 && (m.isFinished || checkIsMatchLocked(m, tournamentState));
                        
                        let tdClass = "border-b border-l border-slate-800/50 p-2 text-sm font-mono tracking-widest text-center transition-colors ";
                        
                        if (!isMatchExposed) return <td key={m.id} className={tdClass}><span className="text-slate-600 text-xs">🔒</span></td>;
                        if (!p || p.predictedHomeScore === undefined || p.predictedHomeScore === "") return <td key={m.id} className={tdClass}><span className="text-rose-500/40 text-xs">--</span></td>;

                        if (m.isFinished) {
                            const pH = Number(p.predictedHomeScore); const pA = Number(p.predictedAwayScore);
                            const rH = Number(m.realHomeScore); const rA = Number(m.realAwayScore);
                            if (pH === rH && pA === rA) tdClass += "bg-emerald-900/20 text-emerald-400 font-black shadow-[inset_0_0_10px_rgba(16,185,129,0.1)]";
                            else if (Math.sign(pH - pA) === Math.sign(rH - rA)) tdClass += "bg-blue-900/20 text-blue-400 font-bold";
                            else tdClass += "bg-rose-900/10 text-rose-400 opacity-80";
                        } else { tdClass += "text-slate-300"; }

                        return (
                          <td key={m.id} className={tdClass}>
                            <div className="flex flex-col items-center justify-center gap-1 w-full">
                               <div className="flex items-center justify-center gap-1.5">
                                 <span className="w-3 text-center">{p.predictedHomeScore}</span><span className="opacity-40">-</span><span className="w-3 text-center">{p.predictedAwayScore}</span>
                               </div>
                               
                               {m.stage === "KNOCKOUT" && p.qualifier && (
                                 <div className={`text-[8.5px] flex items-center gap-1 px-1.5 py-0.5 rounded shadow-sm border ${
                                     m.isFinished 
                                       ? (p.qualifier === m.realQualifier 
                                           ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                                           : 'bg-rose-500/20 text-rose-400 border-rose-500/30 line-through decoration-rose-500/50 opacity-75') 
                                       : 'bg-purple-900/30 text-purple-300 border-purple-500/30'
                                 }`}>
                                   {getFlagUrl(p.qualifier) && <img src={getFlagUrl(p.qualifier)!} className="w-3 h-2 object-cover rounded-[1px] shadow-sm" alt="" />}
                                   <span className="truncate max-w-[35px] leading-none" title={p.qualifier}>{p.qualifier}</span>
                                 </div>
                               )}
                            </div>
                          </td>
                        );
                      })}

                      {activeTab === "QUALIFIERS" && groupsList.map(group => {
                        const groupPred = qualifiersPredictions[u.id]?.[group];
                        const first = groupPred?.first;
                        const second = groupPred?.second;
                        
                        const isQualifiersExposed = tournamentState >= 1;
                        const rG = realQualifiers[group];

                        let firstColor = "text-slate-300";
                        let secondColor = "text-slate-300";

                        if (rG && (rG.first || rG.second)) {
                           if (first) {
                              if (first === rG.first) firstColor = "text-emerald-400 font-black";
                              else if (first === rG.second) firstColor = "text-blue-400 font-bold";
                              else firstColor = "text-rose-400 opacity-80";
                           }
                           if (second) {
                              if (second === rG.second) secondColor = "text-emerald-400 font-black";
                              else if (second === rG.first) secondColor = "text-blue-400 font-bold";
                              else secondColor = "text-rose-400 opacity-80";
                           }
                        }

                        return (
                          <td key={group} className="border-b border-l border-slate-800/50 p-2 text-[10px] font-bold transition-colors">
                             {!isQualifiersExposed ? <div className="text-slate-600 text-center">🔒</div> :
                             first || second ? (
                               <div className="flex flex-col gap-1.5 text-right px-1">
                                  <div className={`flex items-center gap-1.5 ${firstColor}`}>
                                     <span className="opacity-50">1.</span> 
                                     {getFlagUrl(first) && <img src={getFlagUrl(first)!} className="w-3 h-2 rounded-sm shadow-sm" alt="" />}
                                     <span className="truncate">{first || "--"}</span>
                                  </div>
                                  <div className={`flex items-center gap-1.5 ${secondColor}`}>
                                     <span className="opacity-50">2.</span> 
                                     {getFlagUrl(second) && <img src={getFlagUrl(second)!} className="w-3 h-2 rounded-sm shadow-sm" alt="" />}
                                     <span className="truncate">{second || "--"}</span>
                                  </div>
                               </div>
                             ) : <span className="text-rose-500/40 text-center block">--</span>}
                          </td>
                        );
                      })}
                      
                      {activeTab === "QUALIFIERS" && (() => {
                         const isThirdExposed = tournamentState >= 1;
                         const uTeams = thirdPlacePredictions[u.id]?.teams || [];
                         return (
                          <td className="border-b border-l border-purple-500/20 bg-purple-900/5 p-1 transition-colors">
                             {!isThirdExposed ? <div className="text-slate-500 text-center text-[10px]">🔒 מוסתר</div> : 
                             uTeams.length > 0 
                                ? (
                                  <div className="grid grid-cols-4 gap-0.5 min-w-[150px] max-w-[180px] mx-auto">
                                     {uTeams.map((t: string, i: number) => {
                                        const isHit = realThirdPlace.length > 0 && realThirdPlace.includes(t);
                                        const isFull = realThirdPlace.filter(x=>x).length >= 8;
                                        return (
                                          <div key={i} className={`text-[8px] font-black p-1 rounded-md border flex items-center justify-center gap-1 truncate ${isHit ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : (isFull ? "bg-rose-500/10 text-rose-400 border-rose-500/20 opacity-60" : "bg-slate-800 text-slate-400 border-slate-700")}`}>
                                             {getFlagUrl(t) && <img src={getFlagUrl(t)!} className="w-3 h-2 rounded-sm shadow-sm" />}
                                             {t}
                                          </div>
                                        );
                                     })}
                                  </div>
                                )
                                : <span className="text-rose-500/40 text-center block">--</span>}
                          </td>
                         )
                      })()}

                      {activeTab === "BONUS" && filteredBonusQuestions.map(q => {
                        let answerText = "--";
                        const bData = bonusPredictions[u.id];
                        if (bData && bData[q.id] !== undefined) {
                           answerText = String(bData[q.id]);
                        }

                        const phase = q.phase || "TOURNAMENT";
                        let isExposed = (phase === "KNOCKOUT") ? (tournamentState >= 5) : (tournamentState >= 1);

                        if (q.isSurprise) {
                           const closeTimeMs = parseDateTimeLocal(q.closeTime);
                           isExposed = nowMs > closeTimeMs;
                        }

                        const truth = realBonusFull.answers?.[q.id] || [];
                        const leaders = realBonusFull.leading?.[q.id] || [];
                        const losers = realBonusFull.blacklist?.[q.id] || [];
                        const isLocked = realBonusFull.locked?.[q.id] || false;

                        const tArr = Array.isArray(truth) ? truth : [truth];
                        const isHit = tArr.some((t:any) => String(t).trim().toLowerCase() === answerText.trim().toLowerCase());
                        const isLead = leaders.some((t:any) => String(t).trim().toLowerCase() === answerText.trim().toLowerCase());
                        const isMiss = losers.some((t:any) => String(t).trim().toLowerCase() === answerText.trim().toLowerCase()) || (isLocked && !isHit);

                        let tdClass = "border-b border-l border-slate-800/50 p-2 text-[11px] font-bold text-center transition-colors ";
                        
                        if (!isExposed) return <td key={q.id} className={tdClass}><span className="text-slate-600 text-[10px]">🔒 מוסתר</span></td>;
                        if (answerText === "--") return <td key={q.id} className={tdClass}><span className="text-rose-500/40">--</span></td>;

                        if (isHit) {
                           tdClass += "bg-emerald-900/20 text-emerald-400 font-black shadow-[inset_0_0_8px_rgba(16,185,129,0.15)]";
                        } else if (isMiss) {
                           tdClass += "bg-rose-900/10 text-rose-500/70 line-through decoration-rose-500/40";
                        } else {
                           tdClass += "bg-slate-900/30 text-slate-300 hover:text-white";
                        }

                        return (
                          <td key={q.id} className={tdClass} title={answerText}>
                             <div className="truncate max-w-[120px] mx-auto flex items-center justify-center gap-1.5">
                                {isLead && !isHit && <span className="animate-pulse drop-shadow-md text-sm" title="מוביל זמני">👑</span>}
                                {getFlagUrl(answerText) && (
                                   <img src={getFlagUrl(answerText)!} className={`w-4 h-3 rounded-sm shadow-sm transition-all ${isMiss ? 'opacity-50 grayscale' : ''}`} alt="" />
                                )}
                                <span className={isLead && !isHit ? "text-amber-400 font-black" : ""}>{answerText}</span>
                             </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
      {/* ========================================== */}
{/* 🚨 מודל פריצת שידור - עמדת VAR אצטדיון 🚨 */}
{/* ========================================== */}
{isVarModalOpen && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fade-in" dir="rtl">
    
    {/* הזרקת האנימציה של קו הסריקה בטלוויזיה */}
    <style dangerouslySetInnerHTML={{__html: `
      @keyframes scanline {
        0% { transform: translateY(-100%); }
        100% { transform: translateY(260px); }
      }
      .animate-scanline {
        animation: scanline 3s infinite linear;
      }
    `}} />

    {/* גוף המודל */}
    <div className="bg-slate-900 border-4 border-gray-800 rounded-2xl w-full max-w-lg flex flex-col shadow-[0_0_50px_rgba(225,29,72,0.3)] relative overflow-hidden">
      
      {/* כפתור סגירה עליון קטן */}
      <button 
        onClick={() => { setIsVarModalOpen(false); setVarQuery(""); setVarResponse(""); }}
        className="absolute top-3 left-3 z-50 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-gray-400 hover:text-white transition-colors text-sm border border-white/10"
      >
        ✕
      </button>

      {/* 📺 חצי עליון: המוניטור עם תמונת השופט והאפקטים */}
      <div className="relative h-[240px] w-full bg-black shrink-0 border-b-4 border-gray-800">
        {/* תמונת השופט שלקחת מהמגרש */}
        <img 
          src="/var-referee.jpg" 
          alt="VAR Check" 
          className="w-full h-full object-cover opacity-80"
        />

        {/* אפקט פסי סריקה (Scanlines) כמו מסך טלוויזיה ישן */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100%_4px] opacity-70"></div>
        
        {/* קו הלייזר הכחול שיורד ועולה (אנימציית הסריקה) */}
        <div className="absolute inset-x-0 h-0.5 bg-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.8)] opacity-70 animate-scanline"></div>

        {/* באנר סטטוס שידור עליון */}
        <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm border border-red-500/30 px-3 py-1 rounded-md flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,1)]"></span>
          <span className="text-red-400 font-mono font-black text-[10px] tracking-widest uppercase">LIVE REVIEW</span>
        </div>

        {/* כתובית בזמן טעינה */}
        {isVarLoading && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 text-center">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-cyan-400 font-mono text-xs tracking-wider uppercase mt-1 bg-black/40 px-3 py-1 rounded border border-cyan-500/20">
              מפענח זוויות צילום ונתוני טבלה...
            </div>
          </div>
        )}
      </div>

      {/* 🏟️ חצי תחתון: לוח פסק הדין של האצטדיון */}
      <div className="bg-[#050507] p-6 flex-1 flex flex-col justify-between min-h-[180px]">
        
        <div className="space-y-2">
          <div className="text-[10px] font-black text-slate-500 tracking-wider uppercase font-mono">
            שאילתת שופט: "{varQuery}"
          </div>
          
          <div className="w-full h-px bg-slate-800 my-2"></div>

          {/* מקום התשובה */}
          {!isVarLoading && varResponse && (
            <div className="text-emerald-400 font-mono text-base sm:text-lg leading-relaxed bg-emerald-950/10 p-4 border-r-4 border-emerald-500 rounded-l shadow-inner animate-fade-in">
              <span className="text-white font-black block text-xs uppercase tracking-wider mb-1.5 opacity-60">החלטה סופית:</span>
              {varResponse}
            </div>
          )}

          {/* מצב המתנה (למקרה שהמודל נפתח מסיבה כלשהי בלי טעינה) */}
          {!isVarLoading && !varResponse && (
            <div className="text-slate-600 font-mono text-sm text-center py-6">
              ממתין להעברת הנתונים מחדר הבקרה...
            </div>
          )}
        </div>

        {/* כפתור סגירה תחתון - חזרה למגרש */}
        {!isVarLoading && varResponse && (
          <button
            onClick={() => { setIsVarModalOpen(false); setVarQuery(""); setVarResponse(""); }}
            className="w-full mt-6 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-slate-300 font-black py-3 rounded-xl border border-slate-700 text-sm transition-all text-center active:scale-95 shadow-lg font-mono"
          >
            ✓ חזרה למגרש
          </button>
        )}
      </div>
    </div>
  </div>
)}
    </div>
  );
}