"use client";
import React, { useState, useEffect } from "react";
import { getFlagUrl } from "../../app/utils/flags";
import { doc, setDoc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../../app/firebase";
import toast from "react-hot-toast";

export default function AdminMatchesTab({
  matches,
  isCalculating,
  handleDeleteAllMatches,
  handleFileUpload,
  fileInputRef,
  handleSaveMatch,
  handleClearMatch,
  handleUpdateMatchday,
  handleUpdateMatchDate,
  handleUpdateMatchDetails, // פרופ חדש שסידרנו
  handleDeleteMatch,
  groupsList,
  savingId,
  handleCalculateCrowdStats
}: any) {
  
  const [adminMatchGroup, setAdminMatchGroup] = useState<string>("ALL");
  const [adminSearchTerm, setAdminSearchTerm] = useState<string>("");
  const [adminKnockoutViewMode, setAdminKnockoutViewMode] = useState<"LIST" | "BRACKET">("LIST");
  const [quickFilter, setQuickFilter] = useState<"ALL" | "TODAY" | "MISSING" | "MISSING_THIRD">("ALL");
  const [recentlySavedIds, setRecentlySavedIds] = useState<string[]>([]);
  
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);

  // שלבי נוקאאוט תמיד זמינים לאדמין לעריכה מראש
  const KNOCKOUT_ROUNDS = ["32 הגדולות", "שמינית גמר", "רבע גמר", "חצי גמר", "גמר"];
  const adminGroupList = ["ALL", ...groupsList, ...KNOCKOUT_ROUNDS];
  
  const currentAdminGroupIndex = adminGroupList.indexOf(adminMatchGroup);
  
  const handlePrevAdminGroup = () => setAdminMatchGroup(adminGroupList[currentAdminGroupIndex === 0 ? adminGroupList.length - 1 : currentAdminGroupIndex - 1]);
  const handleNextAdminGroup = () => setAdminMatchGroup(adminGroupList[currentAdminGroupIndex === adminGroupList.length - 1 ? 0 : currentAdminGroupIndex + 1]);

  const isMatchToday = (dateStr: string) => {
     if (!dateStr || typeof dateStr !== 'string') return false;
     try {
       const [d] = dateStr.split(" ");
       const [day, month, year] = (d || "").split("/");
       const today = new Date();
       return today.getDate() === Number(day) && today.getMonth() === Number(month) - 1 && today.getFullYear() === Number(year);
     } catch { return false; }
  };

  const isMatchMissingResult = (match: any) => {
     if (match.isFinished) return false;
     if (!match.matchDate || typeof match.matchDate !== 'string') return false;
     try {
       const parts = match.matchDate.split(" ");
       const [day, month, year] = (parts[0] || "").split("/");
       const [h, m] = (parts[1] || "00:00").split(":");
       const matchTime = new Date(Number(year), Number(month) - 1, Number(day), Number(h), Number(m)).getTime();
       return (new Date().getTime() - matchTime) > (1000 * 60 * 120); 
     } catch { return false; }
  };
  const [thirdPlaceTeams, setThirdPlaceTeams] = useState<string[]>([]);


  const filteredMatches = matches.filter((m: any) => {
    if (adminSearchTerm && !m.homeTeam.includes(adminSearchTerm) && !m.awayTeam.includes(adminSearchTerm)) return false;
    if (quickFilter === "TODAY" && !isMatchToday(m.matchDate)) return false;
    if (quickFilter === "MISSING" && !isMatchMissingResult(m)) return false;
    if (quickFilter === "MISSING_THIRD" && !(m.roundName === "32 הגדולות" && (String(m.homeTeam).includes("מקום 3") || String(m.awayTeam).includes("מקום 3")))) return false; 
    if (adminMatchGroup !== "ALL") {
       if (KNOCKOUT_ROUNDS.includes(adminMatchGroup)) {
          if (m.stage !== "KNOCKOUT") return false;
          if (adminMatchGroup === "גמר") {
             return m.roundName === "גמר" || m.roundName === "מקום שלישי";
          }
          return m.roundName === adminMatchGroup;
       } else {
          if (m.group !== adminMatchGroup) return false;
       }
    }
    return true;
  });

  const onSaveWithFeedback = async (matchId: string, home: number, away: number, qual: string) => {
     try {
       await handleSaveMatch(matchId, home, away, qual);
       setRecentlySavedIds(prev => [...prev, matchId]);
       setTimeout(() => {
          setRecentlySavedIds(prev => prev.filter(id => id !== matchId));
       }, 2000); 
     } catch (error) {
       console.error("Error in UI feedback:", error);
     }
  };
  // הפונקציה למיפוי אוטומטי של מקומות 1 ו-2 לשלב 32 הגדולות
  const handleAutoMapWinnersAndRunnersUp = async () => {
    try {
      // 1. שולפים את העולות האמיתיות מהדאטה-בייס (אלה שהזנת בסיום הבתים)
      const rQualSnap = await getDoc(doc(db, "admin_results", "qualifiers"));
      const realQuals = rQualSnap.exists() ? rQualSnap.data().results : null;

      if (!realQuals || Object.keys(realQuals).length === 0) {
        return toast.error("אין נתוני עולות במסד! אנא ודא שהזנת ושמרת עולות קודם.");
      }

      // 2. מסננים רק את משחקי 32 הגדולות מתוך הסטייט
      const knockoutMatches32 = matches.filter((m: any) => m.roundName === "32 הגדולות");
      if (knockoutMatches32.length === 0) {
        return toast.error("לא נמצאו משחקי 32 הגדולות במערכת.");
      }

      let updatedCount = 0;
      toast.loading("ממפה נבחרות...", { id: "mapping-toast" });

      // 3. רצים על המשחקים ומשבצים
      for (const match of knockoutMatches32) {
        let updatedHome = match.homeTeam;
        let updatedAway = match.awayTeam;
        let changed = false;

        // נבדוק גם את הפלייסחולדר וגם את השם הנוכחי כדי לחפש את התבנית (למשל: "1A")
        const homeCheckStr = match.homePlaceholder || match.homeTeam;
        const awayCheckStr = match.awayPlaceholder || match.awayTeam;

        const homeMatch = String(homeCheckStr).match(/^([12])([A-L])$/i);
        if (homeMatch) {
          const position = homeMatch[1]; // "1" או "2"
          const group = homeMatch[2].toUpperCase(); // "A" עד "L"
          const newTeam = position === "1" ? realQuals[group]?.first : realQuals[group]?.second;
          if (newTeam && newTeam !== updatedHome) {
            updatedHome = newTeam;
            changed = true;
          }
        }

        const awayMatch = String(awayCheckStr).match(/^([12])([A-L])$/i);
        if (awayMatch) {
          const position = awayMatch[1];
          const group = awayMatch[2].toUpperCase();
          const newTeam = position === "1" ? realQuals[group]?.first : realQuals[group]?.second;
          if (newTeam && newTeam !== updatedAway) {
            updatedAway = newTeam;
            changed = true;
          }
        }

        // 4. מעדכנים בדאטה-בייס רק אם היה שינוי
        if (changed) {
          await updateDoc(doc(db, "matches", match.id), {
            homeTeam: updatedHome,
            awayTeam: updatedAway
          });
          updatedCount++;
        }
      }

      toast.success(`הושלם! ${updatedCount * 2} נבחרות (מקומות 1-2) שובצו בהצלחה.`, { id: "mapping-toast" });
    } catch (e) {
      console.error(e);
      toast.error("תקלה בשיבוץ האוטומטי", { id: "mapping-toast" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up w-full relative">
      
      <div className="bg-slate-800 p-4 sm:p-6 rounded-3xl border border-slate-700 shadow-xl w-full">
        <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2"><span>🔍</span> איתור וסינון משחקים</h2>
        
        <div className="flex flex-col md:flex-row gap-4">
           <input 
              type="text" 
              placeholder="חפש נבחרת..." 
              value={adminSearchTerm} 
              onChange={(e) => setAdminSearchTerm(e.target.value)} 
              className="w-full md:w-1/3 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-colors"
           />
           
           <div className="flex-1 flex gap-2 overflow-x-auto custom-scrollbar pb-2 md:pb-0 snap-x">
             <button onClick={() => setQuickFilter("ALL")} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 snap-center ${quickFilter === "ALL" ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-700'}`}>
                🌐 הכל
             </button>
             <button onClick={() => setQuickFilter("TODAY")} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 snap-center ${quickFilter === "TODAY" ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-700'}`}>
                📅 משחקי היום
             </button>
             <button onClick={() => setQuickFilter("MISSING")} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 snap-center ${quickFilter === "MISSING" ? 'bg-rose-600 text-white shadow-md' : 'bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-700'}`}>
                ⚠️ חסרה תוצאה
             </button>
             <button onClick={() => setQuickFilter("MISSING_THIRD")} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 snap-center ${quickFilter === "MISSING_THIRD" ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-700'}`}>
                🧩 חסר מקום 3
             </button>
           </div>
        </div>

        <div className="flex items-center justify-between bg-slate-950 p-2 rounded-2xl border border-slate-700/50 w-full mt-4 shadow-inner">
          <button onClick={handlePrevAdminGroup} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors text-lg active:scale-95 border border-slate-600">▶</button>
          <div className="font-black text-white text-base sm:text-lg tracking-wide text-center">
             {adminMatchGroup === "ALL" ? "כל הבתים והמשחקים" : 
              adminMatchGroup === "גמר" ? "גמר ומקום שלישי 🏆" :
              KNOCKOUT_ROUNDS.includes(adminMatchGroup) ? adminMatchGroup : 
              `בית ${adminMatchGroup}`}
          </div>
          <button onClick={handleNextAdminGroup} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors text-lg active:scale-95 border border-slate-600">◀</button>
        </div>
      </div>

      {KNOCKOUT_ROUNDS.includes(adminMatchGroup) && (
        <div className="flex justify-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700 w-fit mx-auto shadow-inner">
          <button onClick={() => setAdminKnockoutViewMode("LIST")} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${adminKnockoutViewMode === "LIST" ? "bg-slate-600 text-white shadow" : "text-slate-400 hover:text-white"}`}>רשימה</button>
          <button onClick={() => setAdminKnockoutViewMode("BRACKET")} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${adminKnockoutViewMode === "BRACKET" ? "bg-slate-600 text-white shadow" : "text-slate-400 hover:text-white"}`}>עץ (Bracket)</button>
        </div>
      )}

      {(!KNOCKOUT_ROUNDS.includes(adminMatchGroup) || adminKnockoutViewMode === "LIST") ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
          {filteredMatches.length === 0 ? (
             <div className="col-span-full text-center py-10 text-slate-500 font-bold text-lg">לא נמצאו משחקים תואמים לסינון.</div>
          ) : (
             filteredMatches.map((m: any) => (
               <AdminMatchRow 
                 key={m.id} 
                 match={m} 
                 allMatches={matches} // <-- תוספת קריטית! מעבירים את כל המשחקים
                 isSaving={savingId === m.id} 
                 justSaved={recentlySavedIds.includes(m.id)}
                 onSave={onSaveWithFeedback} 
                 onClear={handleClearMatch} 
                 onUpdateDate={handleUpdateMatchDate} 
                 onUpdateMatchday={handleUpdateMatchday} 
                 onUpdateDetails={handleUpdateMatchDetails}
                 onDelete={handleDeleteMatch}
                 handleCalculateCrowdStats={handleCalculateCrowdStats}
               />
             ))
          )}
        </div>
      ) : (
        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-700 overflow-x-auto shadow-inner w-full min-h-[500px]">
           <div className="text-center text-slate-500 font-bold mt-20">
              [תצוגת עץ נוקאאוט - כרגע רק רשימה נתמכת בעדכון תוצאות מהיר]
              <br/><br/>אנא עבוד ממצב "רשימה" לעדכון תוצאות קל יותר.
           </div>
        </div>
      )}

      <div className="bg-rose-900/10 p-6 rounded-3xl border border-rose-500/30 w-full mt-8 shadow-xl">
        <h3 className="text-xl font-black text-rose-400 mb-4 flex items-center gap-2"><span>⚠️</span> ניהול מסד משחקים נמוך (Low Level)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl w-full">
            <label className="block text-slate-400 text-xs font-bold mb-2">ייבוא משחקים מקובץ JSON</label>
            <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileUpload} className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 transition-colors file:cursor-pointer" />
          </div>
          <button onClick={() => setShowGeneratorModal(true)} className="h-[74px] bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 px-6 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-md active:scale-95">
             <span className="text-xl">⚡</span> יצירת משחקים מהירה
          </button>
          <button onClick={handleDeleteAllMatches} disabled={isCalculating || matches.length === 0} className="h-[74px] bg-slate-900 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/30 px-6 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50 active:scale-95">
            <span className="text-xl">🗑️</span> מחק הכל
          </button>
        </div>
      </div>

      {showGeneratorModal && (
        <AdminGeneratorModal onClose={() => setShowGeneratorModal(false)} />
      )}
    </div>
  );
}

function AdminMatchRow({ match, allMatches, isSaving, justSaved, onSave, onClear, onUpdateDate, onUpdateMatchday, onUpdateDetails, onDelete, handleCalculateCrowdStats }: any) {  
  // הנה שתי השורות שהלכו לאיבוד!
  const [homeInput, setHomeInput] = useState(match.realHomeScore ?? "");
  const [awayInput, setAwayInput] = useState(match.realAwayScore ?? "");
  
  const [qualifierInput, setQualifierInput] = useState(match.realQualifier ?? "");
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [timeInput, setTimeInput] = useState(match.matchDate || "");
  const [isEditingMatchday, setIsEditingMatchday] = useState(false);
  const [matchdayInput, setMatchdayInput] = useState(match.matchday || "");

  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [editData, setEditData] = useState({
     homeTeam: match.homeTeam || "",
     awayTeam: match.awayTeam || "",
     stadium: match.stadium || "",
     city: match.city || "",
     broadcastUrl: match.broadcastUrl || ""
  });
  
  const [thirdPlaceTeams, setThirdPlaceTeams] = useState<string[]>([]);
  // שולף את 8 המעפילות (מקום 3) רק כשפותחים את פאנל העריכה של שלב 32 הגדולות
  useEffect(() => {
    if (isEditingDetails && match.roundName === "32 הגדולות") {
      const fetchThirdPlace = async () => {
        const { getDoc, doc } = await import("firebase/firestore");
        const tpSnap = await getDoc(doc(db, "admin_results", "third_place"));
        if (tpSnap.exists()) {
           setThirdPlaceTeams(tpSnap.data().teams || []);
        }
      };
      fetchThirdPlace();
    }
  }, [isEditingDetails, match.roundName]);
  
  useEffect(() => {
    setEditData({
      homeTeam: match.homeTeam || "",
      awayTeam: match.awayTeam || "",
      stadium: match.stadium || "",
      city: match.city || "",
      broadcastUrl: match.broadcastUrl || ""
    });
  }, [match]);

  useEffect(() => {
    setTimeInput(match.matchDate || "");
    setMatchdayInput(match.matchday || "");
  }, [match.matchDate, match.matchday]);
  
  const isKnockout = match.stage === "KNOCKOUT";
  useEffect(() => {
    if (isKnockout && homeInput !== "" && awayInput !== "") {
      const hScore = parseInt(homeInput);
      const aScore = parseInt(awayInput);
      
      if (!isNaN(hScore) && !isNaN(aScore)) {
         if (hScore > aScore) {
           setQualifierInput(match.homeTeam);
         } else if (aScore > hScore) {
           setQualifierInput(match.awayTeam);
         } else {
           // במקרה של תיקו (הארכה/פנדלים), מאפסים כדי להכריח אותך ללחוץ ידנית מי עלתה
           setQualifierInput(""); 
         }
      }
    }
  }, [homeInput, awayInput, isKnockout, match.homeTeam, match.awayTeam]);

  // תוספת 1: פונקציה לייצור הרשימה הנפתחת מהשלב הקודם
  const getRelevantTeams = () => {
    const teams = new Set<string>();
    if (!isKnockout || !allMatches) {
       allMatches?.forEach((m: any) => { if (m.homeTeam) teams.add(m.homeTeam); if (m.awayTeam) teams.add(m.awayTeam); });
       return Array.from(teams);
    }

    let prevRound = "";
    if (match.roundName === "מקום שלישי" || match.roundName === "גמר") prevRound = "חצי גמר";
    else if (match.roundName === "חצי גמר") prevRound = "רבע גמר";
    else if (match.roundName === "רבע גמר") prevRound = "שמינית גמר";
    else if (match.roundName === "שמינית גמר") prevRound = "32 הגדולות";

    if (prevRound) {
      const prevMatches = allMatches.filter((m: any) => m.roundName === prevRound);
      prevMatches.forEach((m: any) => {
        if (m.realQualifier) teams.add(m.realQualifier);
        else {
          if (m.homeTeam && !m.homeTeam.includes("מנצחת") && !m.homeTeam.includes("מקום")) teams.add(m.homeTeam);
          if (m.awayTeam && !m.awayTeam.includes("מנצחת") && !m.awayTeam.includes("מקום")) teams.add(m.awayTeam);
        }
      });
    } else {
       allMatches.filter((m: any) => m.stage !== "KNOCKOUT").forEach((m: any) => {
          if (m.homeTeam) teams.add(m.homeTeam);
          if (m.awayTeam) teams.add(m.awayTeam);
       });
    }
    return Array.from(teams);
  };

  const availableTeams = getRelevantTeams();
  // זיהוי האם השדה מחכה למקום 3 לפי הפלייסחולדר (מתחיל ב-"_3")
  const isHomeThirdPlace = String(match.homePlaceholder || match.homeTeam).startsWith("3_");
  const isAwayThirdPlace = String(match.awayPlaceholder || match.awayTeam).startsWith("3_");

  const homeListId = `home-list-${match.id}`;
  const awayListId = `away-list-${match.id}`;

  // 🚀 שדרוג חדש: סינון נבחרות שכבר שובצו במשחקים אחרים באותו שלב
  const alreadyAssignedTeams = allMatches
     .filter((m: any) => m.roundName === "32 הגדולות" && m.id !== match.id) // מסתכלים על כל המשחקים חוץ מהנוכחי
     .flatMap((m: any) => [m.homeTeam, m.awayTeam]); // אוספים את כל הקבוצות ששובצו

  // משאירים ברשימה של המקום ה-3 רק את הנבחרות שעדיין לא מופיעות במערך שאספנו
  const unassignedThirdPlaceTeams = thirdPlaceTeams.filter(t => !alreadyAssignedTeams.includes(t));

  // אם זה מקום 3 ויש לנו את הנתונים, נציג רק את הנבחרות הפנויות. אחרת נציג את הרשימה הרגילה
  const homeOptions = isHomeThirdPlace && unassignedThirdPlaceTeams.length > 0 ? unassignedThirdPlaceTeams : availableTeams;
  const awayOptions = isAwayThirdPlace && unassignedThirdPlaceTeams.length > 0 ? unassignedThirdPlaceTeams : availableTeams;
  const datalistId = `teams-list-${match.id}`;

  // תוספת 2: פונקציית הקסם למילוי אוטומטי
  // תוספת: פונקציית הקסם למילוי אוטומטי (משודרגת לתמיכה גם בשלב 32 הגדולות)
  const handleAutoFillTeams = async () => {
    let newHome = editData.homeTeam;
    let newAway = editData.awayTeam;
    let autoFilledCount = 0;

    // 🚀 אם אנחנו בשלב 32 הגדולות - נשאב ישירות מטבלת העולות של הבתים
    if (match.roundName === "32 הגדולות") {
       try {
          const { getDoc, doc } = await import("firebase/firestore");
          const rQualSnap = await getDoc(doc(db, "admin_results", "qualifiers"));
          const realQuals = rQualSnap.exists() ? rQualSnap.data().results : null;
          
          if (!realQuals || Object.keys(realQuals).length === 0) {
             toast.error("טרם הוזנו או נשמרו עולות משלב הבתים באדמין");
             return;
          }

          const homeCheckStr = match.homePlaceholder || match.homeTeam;
          const awayCheckStr = match.awayPlaceholder || match.awayTeam;

          // פענוח קבוצת הבית (למשל 1A)
          const homeMatch = String(homeCheckStr).match(/^([12])([A-L])$/i);
          if (homeMatch) {
             const position = homeMatch[1];
             const group = homeMatch[2].toUpperCase();
             const team = position === "1" ? realQuals[group]?.first : realQuals[group]?.second;
             if (team) { newHome = team; autoFilledCount++; }
          }

          // פענוח קבוצת החוץ (למשל 2B)
          const awayMatch = String(awayCheckStr).match(/^([12])([A-L])$/i);
          if (awayMatch) {
             const position = awayMatch[1];
             const group = awayMatch[2].toUpperCase();
             const team = position === "1" ? realQuals[group]?.first : realQuals[group]?.second;
             if (team) { newAway = team; autoFilledCount++; }
          }
       } catch (e) {
          console.error(e);
          toast.error("שגיאה במשיכת נתוני הבתים מהשרת");
          return;
       }
    } else {
        // 🏟️ הלוגיקה המשודרגת לשלבים המאוחרים (שמינית, רבע וכו')
        
        // פונקציית עזר שמזהה מספר משחק בטקסט (למשל מחלצת "73" מתוך "מנצחת משחק 73")
        const extractSourceMatchId = (text: string) => {
           if (!text) return null;
           const matchNum = String(text).match(/(?:משחק|match_?)\s*(\d+)/i);
           return matchNum ? `match_${matchNum[1]}` : null;
        };

        const homeSourceId = extractSourceMatchId(match.homePlaceholder || match.homeTeam);
        const awaySourceId = extractSourceMatchId(match.awayPlaceholder || match.awayTeam);

        // 1. שיטה חדשה וחכמה: חיפוש לפי מספר משחק מפורש (World Cup 2026 Format)
        if (homeSourceId || awaySourceId) {
            if (homeSourceId) {
                const sourceMatch = allMatches.find((m: any) => m.id === homeSourceId);
                // במקרה של משחק על המקום השלישי אנחנו רוצים את המפסידה, אחרת את המנצחת (realQualifier)
                if (sourceMatch?.isFinished && sourceMatch?.realQualifier) {
                    newHome = match.roundName === "מקום שלישי" 
                        ? (sourceMatch.realQualifier === sourceMatch.homeTeam ? sourceMatch.awayTeam : sourceMatch.homeTeam)
                        : sourceMatch.realQualifier;
                    autoFilledCount++;
                }
            }
            if (awaySourceId) {
                const sourceMatch = allMatches.find((m: any) => m.id === awaySourceId);
                if (sourceMatch?.isFinished && sourceMatch?.realQualifier) {
                    newAway = match.roundName === "מקום שלישי" 
                        ? (sourceMatch.realQualifier === sourceMatch.homeTeam ? sourceMatch.awayTeam : sourceMatch.homeTeam)
                        : sourceMatch.realQualifier;
                    autoFilledCount++;
                }
            }
        } 
        // 2. שיטת הגיבוי הישנה שלך (למקרה שלא רשמת מספרי משחקים)
        else {
            let prevRound = "";
            if (match.roundName === "מקום שלישי" || match.roundName === "גמר") prevRound = "חצי גמר";
            else if (match.roundName === "חצי גמר") prevRound = "רבע גמר";
            else if (match.roundName === "רבע גמר") prevRound = "שמינית גמר";
            else if (match.roundName === "שמינית גמר") prevRound = "32 הגדולות";

            if (!prevRound) {
                toast.error("לא ניתן לשאוב נתונים לשלב זה");
                return;
            }

            const sortMatchesById = (arr: any[]) => arr.sort((a,b) => {
                const numA = parseInt(a.id.replace(/\D/g, '') || "0");
                const numB = parseInt(b.id.replace(/\D/g, '') || "0");
                return numA - numB;
            });

            const currentRoundMatches = sortMatchesById(allMatches.filter((m: any) => m.roundName === match.roundName));
            const matchIndex = currentRoundMatches.findIndex((m: any) => m.id === match.id);
            const prevMatches = sortMatchesById(allMatches.filter((m: any) => m.roundName === prevRound));

            if (match.roundName === "מקום שלישי") {
                const getLoser = (m: any) => m?.isFinished && m?.realQualifier ? (m.realQualifier === m.homeTeam ? m.awayTeam : m.homeTeam) : "";
                const loser1 = getLoser(prevMatches[0]);
                const loser2 = getLoser(prevMatches[1]);

                if (loser1) { newHome = loser1; autoFilledCount++; }
                if (loser2) { newAway = loser2; autoFilledCount++; }
            } else {
                const prev1 = prevMatches[matchIndex * 2];
                const prev2 = prevMatches[matchIndex * 2 + 1];

                if (prev1?.isFinished && prev1?.realQualifier) { newHome = prev1.realQualifier; autoFilledCount++; }
                if (prev2?.isFinished && prev2?.realQualifier) { newAway = prev2.realQualifier; autoFilledCount++; }
            }
        }
    }

    if (autoFilledCount === 0) {
        toast.error("לא נמצאו נבחרות תואמות או שהשלב הקודם טרם הסתיים");
    } else {
        setEditData(prev => ({...prev, homeTeam: newHome, awayTeam: newAway}));
        toast.success(`נשאבו ${autoFilledCount} נבחרות בהצלחה! אל תשכח ללחוץ על שמירה 💾`);
    }
  };

  const handleSaveTime = () => { onUpdateDate(match.id, timeInput); setIsEditingTime(false); };
  const handleSaveMatchday = () => { onUpdateMatchday(match.id, matchdayInput); setIsEditingMatchday(false); };

  const onSaveDetails = async () => {
    setIsSavingDetails(true);
    try {
      if (onUpdateDetails) {
        await onUpdateDetails(match.id, editData);
      } else {
        await updateDoc(doc(db, "matches", match.id), editData);
      }
      toast.success("פרטי המשחק עודכנו בהצלחה! ✨");
      setIsEditingDetails(false);
    } catch (e) {
      toast.error("שגיאה בעדכון הפרטים.");
    } finally {
      setIsSavingDetails(false);
    }
  };
  return (
    <div className={`bg-slate-900 p-4 sm:p-5 rounded-3xl border transition-all duration-300 shadow-lg relative overflow-hidden flex flex-col h-full ${justSaved ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] bg-emerald-900/10' : match.isFinished ? 'border-slate-700 opacity-90' : 'border-slate-600 hover:border-blue-500/50'}`}>
      
      {justSaved && <div className="absolute top-2 left-2 text-emerald-400 font-black text-xs animate-bounce">✓ עודכן!</div>}
      
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
        <span className="text-[10px] sm:text-xs font-black bg-blue-900/30 text-blue-400 px-2 sm:px-2.5 py-1 rounded-lg border border-blue-500/20 whitespace-nowrap">
            ID: {match?.id ? String(match.id).substring(0, 4) : "---"}...
        </span>         
 <button onClick={() => setIsEditingDetails(!isEditingDetails)} className={`transition-all ${isEditingDetails ? 'rotate-90 text-blue-400' : 'text-slate-500 hover:text-white'}`} title="ערוך פרטי נבחרות ושידור">✏️</button>
        </div>
        <div className="flex gap-2">
          {isEditingMatchday ? (
            <div className="flex items-center gap-1 bg-slate-950 rounded-lg p-1 border border-slate-700">
               <input type="text" value={matchdayInput} onChange={e => setMatchdayInput(e.target.value)} className="w-12 sm:w-16 bg-transparent text-white text-center text-xs outline-none" />
               <button onClick={handleSaveMatchday} className="text-emerald-400 text-xs px-2 hover:bg-slate-800 rounded">✓</button>
            </div>
          ) : (
            <button onClick={() => setIsEditingMatchday(true)} className="text-[10px] sm:text-xs font-black bg-slate-800 text-slate-300 hover:bg-slate-700 px-2 sm:px-2.5 py-1 rounded-lg border border-slate-700 transition-colors">
               {isKnockout ? (match.roundName || "נוק-אאוט") : `מחזור ${match.matchday}`}
            </button>
          )}
          {isEditingTime ? (
            <div className="flex items-center gap-1 bg-slate-950 rounded-lg p-1 border border-slate-700"><input type="text" value={timeInput} onChange={e => setTimeInput(e.target.value)} className="w-24 sm:w-32 bg-transparent text-white text-center text-xs outline-none" dir="ltr" /><button onClick={handleSaveTime} className="text-emerald-400 text-xs px-2 hover:bg-slate-800 rounded">✓</button></div>
          ) : (
            <button onClick={() => setIsEditingTime(true)} className="text-[10px] sm:text-xs font-black bg-slate-800 text-slate-300 hover:bg-slate-700 px-2 sm:px-2.5 py-1 rounded-lg border border-slate-700 transition-colors">{match.matchDate}</button>
          )}
        </div>
      </div>

      {isEditingDetails && (
        <div className="flex flex-col gap-3 bg-slate-950/80 p-4 rounded-xl border border-slate-700 mb-4 shadow-inner">
          
          {/* תוספת 3: כפתור השאיבה ורשימת האפשרויות */}
          {isKnockout && (
             <button onClick={handleAutoFillTeams} className="w-full bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 text-[11px] font-bold py-2 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 mb-1">
                <span>⚡</span> שאב אוטומטית נבחרות לשורה זו
             </button>
          )}

          {/* ה-datalists המפוצלים והחכמים */}
          <datalist id={homeListId}>
             {homeOptions.map(t => <option key={t} value={t} />)}
          </datalist>
          <datalist id={awayListId}>
             {awayOptions.map(t => <option key={t} value={t} />)}
          </datalist>

          <div className="flex items-center gap-2">
             <input 
               list={homeListId} 
               type="text" 
               value={editData.homeTeam} 
               onChange={e=>setEditData({...editData, homeTeam: e.target.value})} 
               className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-white text-center text-xs outline-none focus:border-blue-500" 
               placeholder={match.homePlaceholder || "נבחרת בית"} 
             />
             <span className="text-xs font-bold text-slate-500">VS</span>
             <input 
               list={awayListId} 
               type="text" 
               value={editData.awayTeam} 
               onChange={e=>setEditData({...editData, awayTeam: e.target.value})} 
               className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-white text-center text-xs outline-none focus:border-blue-500" 
               placeholder={match.awayPlaceholder || "נבחרת חוץ"} 
             />
          </div>
          <div className="flex items-center gap-2">
             <input type="text" value={editData.stadium} onChange={e=>setEditData({...editData, stadium: e.target.value})} className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-white text-center text-xs outline-none focus:border-blue-500" placeholder="אצטדיון" />
             <input type="text" value={editData.city} onChange={e=>setEditData({...editData, city: e.target.value})} className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-white text-center text-xs outline-none focus:border-blue-500" placeholder="עיר" />
          </div>
          <input type="url" value={editData.broadcastUrl} onChange={e=>setEditData({...editData, broadcastUrl: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-center text-xs outline-none focus:border-blue-500" placeholder="לינק לשידור" dir="ltr" />
          <button onClick={onSaveDetails} disabled={isSavingDetails} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded-lg shadow-sm transition-all disabled:opacity-50 mt-1">
             {isSavingDetails ? "שומר..." : "💾 שמור שינויים"}
          </button>
        </div>
      )}

      <div className="flex justify-between items-center bg-slate-950 p-3 sm:p-4 rounded-2xl border border-slate-800 shadow-inner mb-4 flex-1">
        <div className="flex flex-col items-center flex-1 w-1/3 text-center gap-2">
          {getFlagUrl(match.homeTeam) ? <img src={getFlagUrl(match.homeTeam)!} className="w-6 h-4 sm:w-8 sm:h-5 object-cover rounded shadow-sm" alt="flag" /> : <span className="text-lg">🏳️</span>}
          <span className="font-bold text-white text-[11px] sm:text-sm leading-tight px-1 max-w-full break-words">{match.homeTeam}</span>
        </div>
        <div className="flex items-center gap-2 mx-2">
          <input type="number" value={homeInput} onChange={e => setHomeInput(e.target.value)} className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-900 border border-slate-700 rounded-xl text-center text-white font-black text-lg sm:text-xl outline-none focus:border-blue-500" placeholder="-" />
          <span className="text-slate-600 font-black text-sm">:</span>
          <input type="number" value={awayInput} onChange={e => setAwayInput(e.target.value)} className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-900 border border-slate-700 rounded-xl text-center text-white font-black text-lg sm:text-xl outline-none focus:border-blue-500" placeholder="-" />
        </div>
        <div className="flex flex-col items-center flex-1 w-1/3 text-center gap-2">
          {getFlagUrl(match.awayTeam) ? <img src={getFlagUrl(match.awayTeam)!} className="w-6 h-4 sm:w-8 sm:h-5 object-cover rounded shadow-sm" alt="flag" /> : <span className="text-lg">🏳️</span>}
          <span className="font-bold text-white text-[11px] sm:text-sm leading-tight px-1 max-w-full break-words">{match.awayTeam}</span>
        </div>
      </div>

      {isKnockout && (
        <div className="mb-4 bg-slate-950 p-3 rounded-2xl border border-slate-800">
          <label className="block text-center text-[10px] sm:text-xs text-slate-400 font-bold mb-2">מי העפילה לשלב הבא? (חובה לסמן)</label>
          <div className="flex gap-2">
            <button onClick={() => setQualifierInput(match.homeTeam)} className={`flex-1 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all border ${qualifierInput === match.homeTeam ? "bg-emerald-600/20 text-emerald-400 border-emerald-500" : "bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800"}`}>{match.homeTeam}</button>
            <button onClick={() => setQualifierInput(match.awayTeam)} className={`flex-1 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all border ${qualifierInput === match.awayTeam ? "bg-emerald-600/20 text-emerald-400 border-emerald-500" : "bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800"}`}>{match.awayTeam}</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        <button type="button" onClick={() => onSave(match.id, parseInt(homeInput), parseInt(awayInput), qualifierInput)} disabled={isSaving || homeInput === "" || awayInput === "" || (isKnockout && qualifierInput === "")} className={`flex-1 py-2 sm:py-2.5 rounded-xl font-black text-[10px] sm:text-xs transition-all shadow-md flex items-center justify-center gap-1.5 ${justSaved ? "bg-emerald-500 text-white border border-emerald-400" : isSaving ? "bg-slate-600 text-slate-300" : match.isFinished ? "bg-slate-800 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500 hover:bg-slate-700" : "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500"} disabled:opacity-50 active:scale-95`}>
          {justSaved ? "✓ נשמר" : isSaving ? "⏳..." : match.isFinished ? "עדכן תוצאה" : "💾 שמור תוצאה"}
        </button>
        <button onClick={() => handleCalculateCrowdStats(match)} className="flex-1 py-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 rounded-xl font-bold transition-all shadow-md active:scale-95 text-xs">
          📊 פרסם לקהל
        </button>
        {match.isFinished && (
          <button type="button" onClick={() => { onClear(match.id); setHomeInput(""); setAwayInput(""); setQualifierInput(""); }} disabled={isSaving} className="w-10 sm:w-12 flex-shrink-0 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-rose-900 text-rose-500 border border-slate-700 hover:border-rose-500 transition-all active:scale-95 disabled:opacity-50" title="אפס תוצאה">✕</button>
        )}
        {/* --- כפתור מחיקה חדש --- */}
        <button 
          type="button" 
          onClick={() => {
          if(confirm("האם אתה בטוח שברצונך למחוק לחלוטין את המשחק הזה מהמערכת?")) {
           onDelete(match.id);
           }
         }} 
          className="w-10 sm:w-12 flex-shrink-0 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-rose-600 text-rose-500 hover:text-white border border-slate-700 transition-all active:scale-95" 
          title="מחק משחק"
          >
            🗑️
          </button>
        
      </div>
    </div>
  );
}

function AdminGeneratorModal({ onClose }: { onClose: () => void }) {
  const [roundName, setRoundName] = useState("32 הגדולות");
  const [defaultDate, setDefaultDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [matches, setMatches] = useState([{ _tempId: Date.now(), homeTeam: "", awayTeam: "", matchDate: "", time: "21:00", stadium: "", city: "", broadcastUrl: "" }]);
  const STAGES = ["32 הגדולות", "שמינית גמר", "רבע גמר", "חצי גמר", "גמר", "מקום שלישי"];

  const handleAddMatch = () => setMatches([...matches, { _tempId: Date.now() + matches.length, homeTeam: "", awayTeam: "", matchDate: defaultDate, time: "21:00", stadium: "", city: "", broadcastUrl: "" }]);
  const handleRemoveMatch = (id: number) => { if (matches.length > 1) setMatches(matches.filter(m => m._tempId !== id)); };
  const updateMatch = (id: number, field: string, val: string) => setMatches(matches.map(m => m._tempId === id ? { ...m, [field]: val } : m));

  const handleSubmitToDb = async () => {
    const invalidMatch = matches.find(m => !m.homeTeam.trim() || !m.awayTeam.trim());
    if (invalidMatch) return toast.error("חובה להזין שמות קבוצות לכל המשחקים!");
    if (!confirm(`האם להזריק ${matches.length} משחקים למסד הנתונים?`)) return;
    setIsSubmitting(true);
    try {
      for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        let formattedDate = "";
        if (m.matchDate) { const [y, mm, d] = m.matchDate.split("-"); formattedDate = `${d}/${mm}/${y} ${m.time}`; }
        const matchData = { id: `ko_${Date.now().toString().slice(-4)}_${i + 1}`, homeTeam: m.homeTeam.trim(), awayTeam: m.awayTeam.trim(), matchDate: formattedDate, stage: "KNOCKOUT", roundName: roundName, isFinished: false, stadium: m.stadium.trim(), city: m.city.trim(), broadcastUrl: m.broadcastUrl.trim() };
        await setDoc(doc(db, "matches", matchData.id), matchData, { merge: true });
      }
      toast.success("המשחקים נוצרו בהצלחה!");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) { toast.error("שגיאה בהזרקה."); setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in-up" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
        <div className="absolute top-0 right-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-blue-500"></div>
        <div className="flex justify-between items-center p-6 border-b border-slate-800 shrink-0">
          <div><h3 className="text-xl md:text-2xl font-black text-white flex items-center gap-2"><span>⚡</span> הזרקת משחקים מהירה</h3><p className="text-slate-400 text-xs mt-1">בנה את משחקי הנוק-אאוט ושלח ישירות למערכת.</p></div>
          <button onClick={onClose} disabled={isSubmitting} className="w-10 h-10 flex items-center justify-center bg-slate-800 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 rounded-full transition-colors border border-slate-700 font-bold">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800"><label className="block text-slate-400 text-xs font-bold mb-2">שלב:</label><select value={roundName} onChange={e => setRoundName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-indigo-500">{STAGES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
             <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800"><label className="block text-slate-400 text-xs font-bold mb-2">תאריך ברירת מחדל:</label><input type="date" value={defaultDate} onChange={e => setDefaultDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-indigo-500 cursor-pointer" dir="ltr" /></div>
           </div>
           <div className="space-y-4">{matches.map((m, idx) => (
               <div key={m._tempId} className="flex flex-col gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 group hover:border-slate-600 transition-all shadow-inner">
                 <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
                   <div className="w-6 text-slate-600 font-black text-center text-sm">{idx + 1}.</div>
                   <input type="text" placeholder="קבוצת בית" value={m.homeTeam} onChange={e => updateMatch(m._tempId, "homeTeam", e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-sm text-center outline-none focus:border-indigo-500" />
                   <span className="text-slate-600 font-black text-xs">VS</span>
                   <input type="text" placeholder="קבוצת חוץ" value={m.awayTeam} onChange={e => updateMatch(m._tempId, "awayTeam", e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-sm text-center outline-none focus:border-indigo-500" />
                   <input type="date" value={m.matchDate} onChange={e => updateMatch(m._tempId, "matchDate", e.target.value)} className="w-full md:w-32 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-sm outline-none focus:border-indigo-500" dir="ltr" />
                   <input type="time" value={m.time} onChange={e => updateMatch(m._tempId, "time", e.target.value)} className="w-full md:w-24 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-sm outline-none focus:border-indigo-500" dir="ltr" />
                   <button onClick={() => handleRemoveMatch(m._tempId)} className="w-full md:w-10 h-10 flex items-center justify-center bg-rose-900/20 text-rose-500 hover:bg-rose-600 hover:text-white rounded-xl transition-all border border-rose-500/20 shrink-0">✕</button>
                 </div>
               </div>
             ))}</div>
           <button onClick={handleAddMatch} className="w-full py-4 border-2 border-dashed border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"><span>➕</span> הוסף שורת משחק נוספת</button>
        </div>
        <div className="p-6 border-t border-slate-800 bg-slate-900 shrink-0"><button onClick={handleSubmitToDb} disabled={isSubmitting} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-lg">{isSubmitting ? <span className="animate-pulse">מזריק למסד נתונים... ⏳</span> : <span>🚀 שלח {matches.length} משחקים למערכת</span>}</button></div>
      </div>
    </div>
  );
}