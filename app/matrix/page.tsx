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
    if (m.roundName === "גמר" && s >= 13) return true;
    return false;
  }
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

  const [activeTab, setActiveTab] = useState<TabType>("MATCHES");
  const [searchPlayer, setSearchPlayer] = useState("");
  const [searchTeam, setSearchTeam] = useState("");
  const [filterMatchday, setFilterMatchday] = useState("ALL");
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [uSnap, mSnap, pSnap, bpSnap, qSnap, tpSnap, bqDoc, aqDoc, atDoc, abDoc, sysDoc] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "matches")),
          getDocs(collection(db, "predictions_matches")),
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
        mList.sort((a, b) => {
            if (a.stage !== "KNOCKOUT" && b.stage === "KNOCKOUT") return -1;
            if (a.stage === "KNOCKOUT" && b.stage !== "KNOCKOUT") return 1;
            return (a.matchday || 1) - (b.matchday || 1) || a.id.localeCompare(b.id);
        });
        setMatches(mList);

        const preds: any = {};
        pSnap.forEach(d => {
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
      const matchdayMatch = filterMatchday === "ALL" || (filterMatchday === "KNOCKOUT" ? m.stage === "KNOCKOUT" : String(m.matchday) === filterMatchday);
      
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
             
             // התיקון באקסל: אם סטטוס 0, שום דבר לא חשוף!
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
       bonusQuestions.forEach(q => headers.push(q.label || q.questionText));
       csvContent += headers.map(escapeCSV).join(",") + "\n";

       filteredUsers.forEach((u, idx) => {
          const row = [String(idx + 1), u.name || "ללא שם", String(u.totalPoints || 0)];
          bonusQuestions.forEach(q => {
             let answerText = "--";
             const bData = bonusPredictions[u.id];
             if (bData && bData[q.id] !== undefined) answerText = String(bData[q.id]);

             const phase = q.phase || "TOURNAMENT";
             const isExposed = (phase === "KNOCKOUT") ? (tournamentState >= 5) : (tournamentState >= 1);

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
    link.setAttribute("download", `transparency_matrix_${tabName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-400 font-black animate-pulse text-2xl" dir="rtl">טוען נתוני שקיפות... 🕵️‍♂️</div>;

  const groupsList = ["A","B","C","D","E","F","G","H","I","J","K","L"];

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8" dir="rtl">
      
      <div className="max-w-[98vw] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
         <div>
            <h1 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">טבלת שקיפות המשרד 👁️</h1>
            <p className="text-slate-400 text-xs mt-1 font-medium bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 inline-block">
               {activeTab === "MATCHES" && "🟢 בול | 🔵 כיוון נכון | 🔴 טעות | 🔒 נחשף בתחילת השלב"}
               {activeTab === "QUALIFIERS" && "🟢 בול | 🔵 פגיעה חלקית (הצלבה) | 🔴 טעות | 🔒 נחשף בתחילת השלב"}
               {activeTab === "BONUS" && "🟢 בול | 👑 מוביל זמני | 🔵 במשחק | 🔴 נפסל (קו חוצה) | 🔒 נחשף בהתאם לשלב"}
            </p>
         </div>
         <div className="flex flex-wrap gap-3 items-center">
            <button onClick={handleExportCSV} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold transition-all border border-emerald-500 shadow-sm flex items-center gap-2 active:scale-95">
               <span>📊</span> ייצא לאקסל
            </button>
            <Link href="/" className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all border border-slate-700 shadow-sm shrink-0">חזור לדאשבורד 🏠</Link>
         </div>
      </div>

      <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800 mb-6 max-w-md mx-auto shadow-inner">
        {(["MATCHES", "QUALIFIERS", "BONUS"] as TabType[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${activeTab === tab ? "bg-blue-600 text-white shadow-lg scale-105" : "text-slate-500 hover:text-slate-300"}`}>
            {tab === "MATCHES" ? "⚽ משחקים" : tab === "QUALIFIERS" ? "🌍 מעפילות" : "⭐ בונוסים"}
          </button>
        ))}
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
              <label className="text-[10px] font-bold text-slate-500 mr-1">📅 מחזור</label>
              <select value={filterMatchday} onChange={e => setFilterMatchday(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2 text-sm outline-none focus:border-blue-500">
                <option value="ALL">הכל</option>
                <option value="1">מחזור 1</option><option value="2">מחזור 2</option><option value="3">מחזור 3</option>
                <option value="KNOCKOUT">נוק-אאוט</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
              <label className="text-[10px] font-bold text-slate-500 mr-1">📆 סנן לפי תאריך</label>
              <input 
                type="date" 
                value={filterDate} 
                onChange={e => setFilterDate(e.target.value)} 
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2 text-sm outline-none focus:border-blue-500 cursor-pointer" 
                dir="ltr" 
              />
            </div>
          </>
        )}
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
                                <div className="text-[10px] text-emerald-400 font-black bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/20 mt-1 flex items-center justify-center gap-1 w-full">
                                  <span className="w-3 text-center">{m.realHomeScore}</span><span className="text-emerald-500/50">-</span><span className="w-3 text-center">{m.realAwayScore}</span>
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
                              <div className="mt-2 flex flex-wrap justify-center gap-1">
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

                     {activeTab === "BONUS" && bonusQuestions.map(q => {
                        const truth = realBonusFull.answers?.[q.id];
                        const truthStr = truth ? (Array.isArray(truth) ? truth.join(", ") : truth) : null;
                        return (
                         <th key={q.id} className="sticky top-0 z-20 bg-slate-900 border-b-2 border-l border-slate-700/50 p-4 min-w-[160px] text-[11px] max-w-[180px]">
                           <div className="line-clamp-2 text-slate-300" title={q.label}>{q.label}</div>
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

                      {/* תאים משחקים */}
                      {activeTab === "MATCHES" && filteredMatches.map(m => {
                        const uData = predictions[u.id];
                        const p = uData ? uData[m.id] : null;
                        
                        // התיקון: אם הסטטוס הוא 0, שום דבר לא חשוף! חוסם תצוגה לפני תחילת טורניר
                        const isMatchExposed = tournamentState > 0 && (m.isFinished || checkIsMatchLocked(m, tournamentState));
                        
                        let tdClass = "border-b border-l border-slate-800/50 p-2 text-sm font-mono tracking-widest text-center transition-colors ";
                        
                        if (!isMatchExposed) return <td key={m.id} className={tdClass}><span className="text-slate-600 text-xs">🔒</span></td>;
                        if (!p || p.predictedHomeScore === "") return <td key={m.id} className={tdClass}><span className="text-rose-500/40 text-xs">--</span></td>;

                        if (m.isFinished) {
                            const pH = Number(p.predictedHomeScore); const pA = Number(p.predictedAwayScore);
                            const rH = Number(m.realHomeScore); const rA = Number(m.realAwayScore);
                            if (pH === rH && pA === rA) tdClass += "bg-emerald-900/20 text-emerald-400 font-black shadow-[inset_0_0_10px_rgba(16,185,129,0.1)]";
                            else if (Math.sign(pH - pA) === Math.sign(rH - rA)) tdClass += "bg-blue-900/20 text-blue-400 font-bold";
                            else tdClass += "bg-rose-900/10 text-rose-400 opacity-80";
                        } else { tdClass += "text-slate-300"; }

                        return (
                          <td key={m.id} className={tdClass}>
                            <div className="flex items-center justify-center gap-1.5 w-full">
                               <span className="w-3 text-center">{p.predictedHomeScore}</span><span className="opacity-40">-</span><span className="w-3 text-center">{p.predictedAwayScore}</span>
                            </div>
                          </td>
                        );
                      })}

                      {/* תאים עולות מהבתים */}
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
                      
                      {/* תאים 8 מעפילות */}
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

                      {/* תאים בונוסים */}
                      {activeTab === "BONUS" && bonusQuestions.map(q => {
                        let answerText = "--";
                        const bData = bonusPredictions[u.id];
                        if (bData && bData[q.id] !== undefined) {
                           answerText = String(bData[q.id]);
                        }

                        const phase = q.phase || "TOURNAMENT";
                        const isExposed = (phase === "KNOCKOUT") ? (tournamentState >= 5) : (tournamentState >= 1);

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
    </div>
  );
}