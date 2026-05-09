"use client";
import React, { useState, useEffect, useRef } from "react";
import { collection, getDocs, doc, updateDoc, setDoc, getDoc, deleteDoc, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import Link from "next/link";
import toast from "react-hot-toast";
import { getFlagUrl } from "../utils/flags";
import AdminMatchesTab from "@/components/admin/AdminMatchesTab"; 
import AdminSystemTab from "@/components/admin/AdminSystemTab";
import AdminMagazineTab from "@/components/admin/AdminMagazineTab";
import AdminBonusTab from "@/components/admin/AdminBonusTab";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AdminNotificationTab from "@/components/admin/AdminNotificationTab";
import AdminPrizesTab from "@/components/admin/AdminPrizesTab";
import AdminStatsTab from "@/components/admin/AdminStatsTab";

const ADMIN_EMAIL = "bawak.y10@gmail.com"; 

export default function AdminPanel() {
  const [user, setUser] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  const [activeTab, setActiveTab] = useState<"SYSTEM" | "MAGAZINE" | "USERS" | "MATCHES" | "GENERATOR" | "QUALIFIERS" | "THIRD_PLACE" | "BONUS" | "STATS" | "BACKUP" | "PRIZES">("SYSTEM");  

  const [adminBonusCategory, setAdminBonusCategory] = useState<string>("TOURNAMENT");
  const [adminKnockoutRound, setAdminKnockoutRound] = useState<string>("ALL");

  const [matches, setMatches] = useState<any[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [autoInsights, setAutoInsights] = useState<string[]>([]);
  const [statsData, setStatsData] = useState<any>(null); // השורה שחסרה!
  
  const [realQualifiers, setRealQualifiers] = useState<any>({});
  const [realThirdPlace, setRealThirdPlace] = useState<string[]>(Array(8).fill(""));
  
  const [realBonus, setRealBonus] = useState<any>({}); 
  const [bonusBlacklist, setBonusBlacklist] = useState<any>({}); 
  const [bonusLeading, setBonusLeading] = useState<any>({}); 
  const [bonusLocked, setBonusLocked] = useState<any>({}); 
  const [allUserBonusAnswers, setAllUserBonusAnswers] = useState<any[]>([]); 

  const [tournamentState, setTournamentState] = useState<number>(0);
  const [activeDeadline, setActiveDeadline] = useState<{ stage: string, time: string }>({ stage: "1", time: "" });
  const [usersList, setUsersList] = useState<any[]>([]);

  const [bonusQuestions, setBonusQuestions] = useState<any[]>([]); 
  const [editingId, setEditingId] = useState<string | null>(null); 
  
  const [newQuestion, setNewQuestion] = useState({ 
    label: "", phase: "TOURNAMENT", round: "ALL", weight: "REGULAR", answerType: "ALL_TEAMS", points: 15, customOptions: [] as string[], liveStatus: "",
    isSurprise: false, openTime: "", closeTime: "", isProximity: false
  });
  const [tempOption, setTempOption] = useState(""); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [simStage, setSimStage] = useState<string>("MD1");
  const [groupsList, setGroupsList] = useState<string[]>([]);

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

  const isMatchInCurrentActivePhase = (m: any, state: number) => {
    const s = Number(state) || 0;
    if (m.stage !== "KNOCKOUT") {
       const md = Number(m.matchday) || 1;
       if (s === 0 && md === 1) return true;
       if (s === 1 && md === 2) return true;
       if (s === 2 && md === 3) return true;
       return false;
    } else {
       if (s === 4 && m.roundName === "32 הגדולות") return true;
       if (s === 6 && m.roundName === "שמינית גמר") return true;
       if (s === 8 && m.roundName === "רבע גמר") return true;
       if (s === 10 && m.roundName === "חצי גמר") return true;
       if (s === 12 && (m.roundName === "גמר" || m.roundName === "מקום שלישי")) return true;
       return false;
    }
  };

// 1. פונקציית בדיקה - האם השאלה היא "חובה" לשלב שבו אנחנו נמצאים?
  const isQuestionMandatoryNow = (q: any, state: number) => {
    const s = Number(state) || 0;
    
    if (q.isSurprise) {
      const now = Date.now();
      return now >= parseDateTimeLocal(q.openTime) && now <= parseDateTimeLocal(q.closeTime);
    }

    if (s === 0) {
      return q.phase === "TOURNAMENT" || q.phase === "GROUPS";
    }

    if (s >= 1 && s <= 3) {
      return q.phase === "TOURNAMENT" || q.phase === "GROUPS";
    }

    if (q.phase === "KNOCKOUT") {
      // התיקון: תמיכה בשאלות נוקאאוט כלליות ("ALL") שיופיעו כחובה רק בסטייט 4
      if (!q.knockoutRound || q.knockoutRound === "ALL") {
          return s === 4;
      }
      
      const rounds: Record<string, number> = { 
        "32 הגדולות": 4, "שמינית גמר": 6, "רבע גמר": 8, "חצי גמר": 10, "גמר": 12 
      };
      const targetState = rounds[q.knockoutRound] || 4;
      return s === targetState; 
    }

    return false;
  };

  // מנוע חישוב התקדמות משודרג ומחמיר!
  // מנוע חישוב אחוזי התקדמות למשתמש - עכשיו עם פירוט חוסרים מלא!
  const calculateAllUsersProgress = async (users: any[], currentMatches: any[], questions: any[], currentTournState: number) => {
    const predictionsMatches = await getDocs(collection(db, "predictions_matches"));
    const predictionsKnockout = await getDocs(collection(db, "predictions_knockout"));
    const predictionsBonus = await getDocs(collection(db, "predictions_bonus"));
    const predictionsQuals = await getDocs(collection(db, "predictions_qualifiers"));
    const predictionsThird = await getDocs(collection(db, "predictions_third_place"));
      
      return users.map(u => {
      let total = 0;
      let completed = 0;
      const missing = { md1: 0, md2: 0, md3: 0, ko: 0, bonus: 0, quals: 0, third: 0 };

      // 1. משחקים - סופרים רק את השלב הפעיל כרגע!
      const activeMatches = currentMatches.filter(m => isMatchInCurrentActivePhase(m, currentTournState));
      total += activeMatches.length;
      
      const userMatchPreds = [...predictionsMatches.docs, ...predictionsKnockout.docs]
        .map(d => d.data())
        .filter(p => p.userId === u.id);

      activeMatches.forEach(m => {
        const p = userMatchPreds.find(pred => pred.matchId === m.id);
        if (p && p.predictedHomeScore !== "" && p.predictedAwayScore !== "") {
           if (m.stage === "KNOCKOUT") {
              if (p.qualifier && String(p.qualifier).trim() !== "") completed++;
              else missing.ko++;
           } else {
              completed++;
           }
        } else {
           if (m.stage === "KNOCKOUT") missing.ko++;
           else if (Number(m.matchday) === 1) missing.md1++;
           else if (Number(m.matchday) === 2) missing.md2++;
           else if (Number(m.matchday) === 3) missing.md3++;
        }
      });

      // 2. בונוסים - כאן השינוי הקריטי! סופרים רק מה ש"חובה כרגע"
      const mandatoryBonuses = questions.filter(q => isQuestionMandatoryNow(q, currentTournState));
      total += mandatoryBonuses.length;
      const userBonus = predictionsBonus.docs.find(d => d.id === u.id)?.data()?.answers || {};
      
      mandatoryBonuses.forEach(q => {
        if (userBonus[q.id] && String(userBonus[q.id]).trim() !== "") {
          completed++;
        } else {
          missing.bonus++;
        }
      });

      // 3. עולות מבתים ומקום 3 - חובה רק לפני הטורניר (State 0)
      if (currentTournState === 0) {
        const groups = Array.from(new Set(currentMatches.filter(m => m.stage !== "KNOCKOUT").map(m => m.group))).filter(Boolean);
        total += groups.length + 1;

        const userQuals = predictionsQuals.docs.find(d => d.id === u.id)?.data()?.groups || {};
        groups.forEach(g => { 
           if (userQuals[g as string]?.first && userQuals[g as string]?.second) completed++; 
           else missing.quals++;
        });

        const userThird = predictionsThird.docs.find(d => d.id === u.id)?.data()?.teams || [];
        if (userThird.filter((t: string) => t && String(t).trim() !== "").length === 8) completed++;
        else missing.third++;
      }

      return { 
        ...u, 
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 100, 
        missingBreakdown: missing 
      };
    });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchAdminData = async () => {
    setIsCalculating(true);
    try {
      const querySnapshot = await getDocs(collection(db, "matches"));
      const matchesArray: any[] = [];
      querySnapshot.forEach((doc) => matchesArray.push({ id: doc.id, ...doc.data() }));
      
      matchesArray.sort((a, b) => {
         if (!a.matchDate || !b.matchDate) return 0;
         const [dA, tA] = (a.matchDate as string).split(" ");
         const [dB, tB] = (b.matchDate as string).split(" ");
         const [dayA, monthA, yearA] = (dA||"").split("/");
         const [dayB, monthB, yearB] = (dB||"").split("/");
         const dateA = new Date(`${yearA}-${monthA}-${dayA}T${tA||"00:00"}`);
         const dateB = new Date(`${yearB}-${monthB}-${dayB}T${tB||"00:00"}`);
         return dateA.getTime() - dateB.getTime();
      });
      setMatches(matchesArray);

      const qualSnap = await getDoc(doc(db, "admin_results", "qualifiers"));
      if (qualSnap.exists()) setRealQualifiers(qualSnap.data().results || {});

      const thirdSnap = await getDoc(doc(db, "admin_results", "third_place"));
      if (thirdSnap.exists()) {
         const tData = thirdSnap.data().teams || [];
         const filledArr = Array(8).fill("");
         for(let i=0; i<8; i++) if (tData[i]) filledArr[i] = tData[i];
         setRealThirdPlace(filledArr);
      } else {
         setRealThirdPlace(Array(8).fill(""));
      }

      const pbSnap = await getDocs(collection(db, "predictions_bonus"));
      const pbData = pbSnap.docs.map(d => d.data().answers || {});
      setAllUserBonusAnswers(pbData);

      const bonusSnap = await getDoc(doc(db, "admin_results", "bonus"));
      if (bonusSnap.exists()) {
         setRealBonus(bonusSnap.data().answers || {});
         setBonusBlacklist(bonusSnap.data().blacklist || {});
         setBonusLeading(bonusSnap.data().leading || {});
         setBonusLocked(bonusSnap.data().locked || {});
      }

      const questionsSnap = await getDoc(doc(db, "settings", "bonus_questions"));
      const fetchedQuestions = questionsSnap.exists() ? (questionsSnap.data().questions || []) : [];
      setBonusQuestions(fetchedQuestions);

      const settingsSnap = await getDoc(doc(db, "settings", "system"));
      let currentTState = 0;
      if (settingsSnap.exists()) {
        currentTState = settingsSnap.data().tournamentState || 0;
        setTournamentState(currentTState);
      }

      const deadSnap = await getDoc(doc(db, "settings", "deadlines"));
      if (deadSnap.exists() && deadSnap.data().activeDeadline) {
         setActiveDeadline(deadSnap.data().activeDeadline);
      }

      const usersSnap = await getDocs(collection(db, "users"));
      const usersArray: any[] = [];
      usersSnap.forEach(doc => usersArray.push({ id: doc.id, ...doc.data() }));
      
      const usersWithProgress = await calculateAllUsersProgress(usersArray, matchesArray, fetchedQuestions, currentTState);
      usersWithProgress.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
      setUsersList(usersWithProgress);

      const groups = Array.from(new Set(matchesArray.filter(m => m.group && m.stage !== "KNOCKOUT").map(m => m.group))).sort();
      setGroupsList(groups as string[]);

    } catch (error) { 
       console.error("שגיאה:", error); 
       toast.error("שגיאה בשליפת נתונים");
    } finally {
       setIsCalculating(false);
    }
  };

  useEffect(() => {
    if (user && user.email === ADMIN_EMAIL) fetchAdminData();
  }, [user]);
  
  const groupTeams: any = {};
  matches.forEach(m => {
    if (!groupTeams[m.group] && m.stage !== "KNOCKOUT") groupTeams[m.group] = new Set();
    if (m.stage !== "KNOCKOUT") {
      groupTeams[m.group].add(m.homeTeam);
      groupTeams[m.group].add(m.awayTeam);
    }
  });
  const allTeams = Array.from(new Set(matches.flatMap(m => [m.homeTeam, m.awayTeam]))).sort();

  const handleTogglePayment = async (userId: string, currentStatus: boolean) => { 
    try { 
      await updateDoc(doc(db, "users", userId), { hasPaid: !currentStatus }); 
      setUsersList(usersList.map(u => u.id === userId ? { ...u, hasPaid: !currentStatus } : u));
      toast.success("סטטוס תשלום עודכן!");
    } catch (error) { 
      toast.error("שגיאה בעדכון הסטטוס"); 
    } 
  };
  
  const handleUpdateUserName = async (userId: string, newName: string) => {
    try {
      await updateDoc(doc(db, "users", userId), { name: newName });
      toast.success("שם השחקן עודכן בהצלחה! 👑");
    } catch (error) {
      toast.error("שגיאה בעדכון שם השחקן");
    }
  };

  const handleSaveTournamentState = async () => { 
    setSavingId("state"); 
    try { 
      await setDoc(doc(db, "settings", "system"), { tournamentState }, { merge: true }); 
      setTimeout(() => { setSavingId(null); toast.success("מצב הטורניר עודכן בהצלחה!"); }, 500); 
    } catch (error) { 
      setSavingId(null); 
      toast.error("שגיאה בעדכון מצב טורניר");
    } 
  };

  const handleSaveDeadline = async () => { 
    setSavingId("deadlines"); 
    try { 
      await setDoc(doc(db, "settings", "deadlines"), { activeDeadline }, { merge: true }); 
      setTimeout(() => { setSavingId(null); toast.success("שעון העצר המרכזי הופעל!"); }, 500); 
    } catch (error) { 
      setSavingId(null);
      toast.error("שגיאה בשמירת שעון העצר");
    } 
  };
  const handleUpdateMatchDetails = async (matchId: string, details: any) => {
  try {
    const matchRef = doc(db, "matches", matchId);
    await updateDoc(matchRef, details);
    
    // רענון ה-State המקומי של המשחקים כדי שהשינוי יופיע מיד ב-UI
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, ...details } : m));
    
    return true;
  } catch (error) {
    console.error("Error updating details:", error);
    throw error;
  }
};

  const handleUpdateMatchDate = async (matchId: string, newDate: string) => {
    try {
      await updateDoc(doc(db, "matches", matchId), { matchDate: newDate });
      setMatches(matches.map(m => m.id === matchId ? { ...m, matchDate: newDate } : m));
      toast.success("תאריך ושעת המשחק עודכנו בהצלחה!");
    } catch (error) {
      toast.error("שגיאה בעדכון מועד המשחק");
    }
  };

  const handleUpdateMatchday = async (matchId: string, newMatchday: number) => {
    try {
      await updateDoc(doc(db, "matches", matchId), { matchday: newMatchday });
      setMatches(matches.map(m => m.id === matchId ? { ...m, matchday: newMatchday } : m));
      toast.success("מחזור המשחק עודכן בהצלחה!");
    } catch (error) {
      toast.error("שגיאה בעדכון מחזור המשחק");
    }
  };
  
  const handleAddCustomOption = () => { 
    if (!tempOption.trim()) return; 
    if (newQuestion.customOptions.includes(tempOption.trim())) {
      return toast.error("האפשרות כבר קיימת ברשימה."); 
    }
    setNewQuestion(prev => ({ ...prev, customOptions: [...prev.customOptions, tempOption.trim()] })); 
    setTempOption(""); 
  };

  const handleRemoveCustomOption = (optionToRemove: string) => { 
    setNewQuestion(prev => ({ ...prev, customOptions: prev.customOptions.filter(opt => opt !== optionToRemove) })); 
  };

  const handleSaveQuestion = async () => { 
    if (!newQuestion.label) return toast.error("חובה להזין את תוכן השאלה"); 
    if (newQuestion.isSurprise && (!newQuestion.openTime || !newQuestion.closeTime)) return toast.error("יש להזין זמן פתיחה וסגירה לשאלת הפתעה.");
    if ((newQuestion.answerType === "MULTIPLE_CHOICE" || newQuestion.answerType === "TEAM_SUBSET") && newQuestion.customOptions.length < 2) return toast.error("חייבים לפחות 2 אפשרויות בחירה."); 
    
    let finalPoints = newQuestion.points;
    if (newQuestion.isProximity && finalPoints === 15) finalPoints = 50;

    const questionToSave = { ...newQuestion, points: finalPoints };

    let updatedQuestions; 
    if (editingId) { 
       updatedQuestions = bonusQuestions.map(q => q.id === editingId ? { ...q, ...questionToSave } : q); 
    } else { 
       const qId = `q_${Date.now()}`; 
       updatedQuestions = [...bonusQuestions, { id: qId, ...questionToSave }]; 
    } 
    try { 
       await setDoc(doc(db, "settings", "bonus_questions"), { questions: updatedQuestions }); 
       setBonusQuestions(updatedQuestions); 
       setNewQuestion({ label: "", phase: "TOURNAMENT", round: "ALL", weight: "REGULAR", answerType: "ALL_TEAMS", points: 15, customOptions: [], liveStatus: "", isSurprise: false, openTime: "", closeTime: "", isProximity: false }); 
       setEditingId(null); 
       toast.success("השאלה נשמרה בהצלחה!");
    } catch (error) { 
       toast.error("שגיאה בשמירת שאלה"); 
    } 
  };
  
  const handleEditClick = (q: any) => { 
    if (realBonus[q.id] && realBonus[q.id].length > 0) toast.error("שים לב: לשאלה זו כבר הוזנו תוצאות אמת.", { icon: '⚠️' }); 
    setNewQuestion({ 
      label: q.label, phase: q.phase, round: q.round, weight: q.weight, answerType: q.answerType, points: q.points, 
      customOptions: q.customOptions || [], liveStatus: q.liveStatus || "",
      isSurprise: q.isSurprise || false, openTime: q.openTime || "", closeTime: q.closeTime || "", isProximity: q.isProximity || false
    }); 
    setEditingId(q.id); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };
  
  const handleCancelEdit = () => { 
    setNewQuestion({ label: "", phase: "TOURNAMENT", round: "ALL", weight: "REGULAR", answerType: "ALL_TEAMS", points: 15, customOptions: [], liveStatus: "", isSurprise: false, openTime: "", closeTime: "", isProximity: false }); 
    setEditingId(null); 
  };
  
  const handleDeleteQuestion = async (idToDelete: string) => { 
    if (!confirm("האם למחוק שאלה זו?")) return; 
    const updatedQuestions = bonusQuestions.filter(q => q.id !== idToDelete); 
    try { 
      await setDoc(doc(db, "settings", "bonus_questions"), { questions: updatedQuestions }); 
      setBonusQuestions(updatedQuestions); 
      if (editingId === idToDelete) handleCancelEdit(); 
      toast.success("השאלה נמחקה!");
    } catch (error) { 
      toast.error("שגיאה במחיקת שאלה"); 
    } 
  };

  const handleToggleBonusWinner = (qId: string, val: string) => {
    if (!val.trim()) return;
    const v = val.trim();
    setBonusBlacklist((prev: any) => ({ ...prev, [qId]: (prev[qId] || []).filter((item:string) => item !== v) }));
    setBonusLeading((prev: any) => ({ ...prev, [qId]: (prev[qId] || []).filter((item:string) => item !== v) }));
    setRealBonus((prev: any) => {
       const curr = prev[qId] || [];
       if (curr.includes(v)) return { ...prev, [qId]: curr.filter((item:string) => item !== v) };
       return { ...prev, [qId]: [...curr, v] };
    });
  };

  const handleToggleBonusBlacklist = (qId: string, val: string) => {
    if (!val.trim()) return;
    const v = val.trim();
    setRealBonus((prev: any) => ({ ...prev, [qId]: (prev[qId] || []).filter((item:string) => item !== v) }));
    setBonusLeading((prev: any) => ({ ...prev, [qId]: (prev[qId] || []).filter((item:string) => item !== v) }));
    setBonusBlacklist((prev: any) => {
       const curr = prev[qId] || [];
       if (curr.includes(v)) return { ...prev, [qId]: curr.filter((item:string) => item !== v) };
       return { ...prev, [qId]: [...curr, v] };
    });
  };

  const handleToggleBonusLeading = (qId: string, val: string) => {
    if (!val.trim()) return;
    const v = val.trim();
    setRealBonus((prev: any) => ({ ...prev, [qId]: (prev[qId] || []).filter((item:string) => item !== v) }));
    setBonusBlacklist((prev: any) => ({ ...prev, [qId]: (prev[qId] || []).filter((item:string) => item !== v) }));
    setBonusLeading((prev: any) => {
       const curr = prev[qId] || [];
       if (curr.includes(v)) return { ...prev, [qId]: curr.filter((item:string) => item !== v) };
       return { ...prev, [qId]: [...curr, v] };
    });
  };

  const handleToggleBonusLock = (qId: string) => {
    setBonusLocked((prev: any) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const handleSaveBonus = async () => { 
    setSavingId("bonus"); 
    try { 
      await setDoc(doc(db, "admin_results", "bonus"), { 
          answers: realBonus, 
          blacklist: bonusBlacklist,
          leading: bonusLeading,
          locked: bonusLocked,
          updated_at: new Date() 
      }); 
      setTimeout(() => { setSavingId(null); toast.success("ניהול הבונוסים נשמר בהצלחה!"); }, 500); 
    } catch (error) { 
      setSavingId(null);
      toast.error("שגיאה בשמירת תוצאות הבונוס");
    } 
  };

  const handleClearBonus = async () => { 
    if (!confirm("לאפס את כל המנצחים והפסולים של הבונוסים?")) return; 
    setSavingId("bonus"); 
    try { 
      await setDoc(doc(db, "admin_results", "bonus"), { answers: {}, blacklist: {}, leading: {}, locked: {}, updated_at: new Date() }); 
      setRealBonus({}); 
      setBonusBlacklist({});
      setBonusLeading({});
      setBonusLocked({});
      setTimeout(() => { setSavingId(null); toast.success("ניהול הבונוס אופס!"); }, 500); 
    } catch (error) { 
      setSavingId(null);
      toast.error("שגיאה באיפוס התוצאות");
    } 
  };

  const getUniqueAnswers = (qId: string) => {
    const counts: Record<string, number> = {};
    allUserBonusAnswers.forEach(uAns => {
      const ans = uAns[qId];
      if (ans !== undefined && ans !== null && ans !== "") {
        if (Array.isArray(ans)) {
           ans.forEach(a => {
              const strAns = String(a).trim();
              if (strAns) counts[strAns] = (counts[strAns] || 0) + 1;
           });
        } else {
           const strAns = String(ans).trim();
           if (strAns) counts[strAns] = (counts[strAns] || 0) + 1;
        }
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]); 
  };

  const handleQuickLiveStatusSave = async (qId: string) => {
    const inputEl = document.getElementById(`live_status_${qId}`) as HTMLInputElement;
    if (!inputEl) return;
    const newStatus = inputEl.value;
    const updatedQuestions = bonusQuestions.map(q => q.id === qId ? { ...q, liveStatus: newStatus } : q);
    try { 
      await setDoc(doc(db, "settings", "bonus_questions"), { questions: updatedQuestions }); 
      setBonusQuestions(updatedQuestions); 
      toast.success("סטטוס חי עודכן וישודר למשתמשים!", { icon: '📡' }); 
    } catch (e) { 
      toast.error("שגיאה בעדכון סטטוס חי."); 
    }
  };

  const handleSaveMatch = async (matchId: string, homeScore: number, awayScore: number, qualifier: string) => {
  setSavingId(matchId);
  try {
    // 1. עדכון במסד הנתונים עם השדות של "תוצאת האמת"
    await updateDoc(doc(db, "matches", matchId), {
      realHomeScore: homeScore,
      realAwayScore: awayScore,
      realQualifier: qualifier || "",
      isFinished: true
    });

    // 2. עדכון הסטייט הלוקאלי כדי שהמסך יתעדכן מיידית בלי צורך ברענון הדפדפן!
    setMatches(prevMatches => prevMatches.map(m => 
      m.id === matchId ? {
        ...m,
        realHomeScore: homeScore,
        realAwayScore: awayScore,
        realQualifier: qualifier || "",
        isFinished: true
      } : m
    ));

    toast.success("תוצאת האמת נשמרה בהצלחה! ⚽");
  } catch (error) {
    console.error("Error saving match:", error);
    toast.error("שגיאה בשמירת התוצאה.");
  } finally {
    setSavingId(null);
  }
};

  const handleClearMatch = async (matchId: string) => { 
    if (!confirm("האם לאפס משחק זה?")) return; 
    setSavingId(matchId); 
    try { 
      await updateDoc(doc(db, "matches", matchId), { realHomeScore: null, realAwayScore: null, realQualifier: "", isFinished: false }); 
      setMatches(matches.map(m => m.id === matchId ? { ...m, realHomeScore: undefined, realAwayScore: undefined, realQualifier: "", isFinished: false } : m)); 
      setTimeout(() => { setSavingId(null); toast.success("תוצאת משחק אופסה."); }, 500); 
    } catch (error) { 
      setSavingId(null);
      toast.error("שגיאה באיפוס משחק");
    } 
  };

  const handleSaveQualifiers = async () => { 
    setSavingId("qualifiers"); 
    try { 
      await setDoc(doc(db, "admin_results", "qualifiers"), { results: realQualifiers, updated_at: new Date() }); 
      setTimeout(() => { setSavingId(null); toast.success("עולות מהבתים נשמרו בהצלחה!"); }, 500); 
    } catch (error) { 
      setSavingId(null);
      toast.error("שגיאה בשמירת עולות");
    } 
  };

  const handleClearQualifiers = async () => { 
    if (!confirm("לאפס תוצאות עולות מבתים?")) return; 
    setSavingId("qualifiers"); 
    try { 
      await setDoc(doc(db, "admin_results", "qualifiers"), { results: {}, updated_at: new Date() }); 
      setRealQualifiers({}); 
      setTimeout(() => { setSavingId(null); toast.success("עולות מבתים אופסו."); }, 500); 
    } catch (error) { 
      setSavingId(null);
      toast.error("שגיאה באיפוס עולות");
    } 
  };

  const handleSaveThirdPlace = async () => { 
    setSavingId("thirdPlace"); 
    try { 
      await setDoc(doc(db, "admin_results", "third_place"), { teams: realThirdPlace, updated_at: new Date() }); 
      setTimeout(() => { setSavingId(null); toast.success("8 המעפילות נשמרו בהצלחה!"); }, 500); 
    } catch (error) { 
      setSavingId(null);
      toast.error("שגיאה בשמירת המעפילות");
    } 
  };

  const handleClearThirdPlace = async () => { 
    if (!confirm("לאפס תוצאות מעפילות?")) return; 
    setSavingId("thirdPlace"); 
    try { 
      await setDoc(doc(db, "admin_results", "third_place"), { teams: Array(8).fill(""), updated_at: new Date() }); 
      setRealThirdPlace(Array(8).fill("")); 
      setTimeout(() => { setSavingId(null); toast.success("8 המעפילות אופסו."); }, 500); 
    } catch (error) { 
      setSavingId(null);
      toast.error("שגיאה באיפוס המעפילות");
    } 
  };

const handleCalculateScores = async (silentParam: any = false) => {
    const isSilent = silentParam === true;
    if (!isSilent && !confirm("האם לחשב נקודות לכל המשתמשים?")) return;
    setIsCalculating(true);
    
    let wasSnapshotTakenNow = false;

    try {
      const systemSnap = await getDoc(doc(db, "settings", "system"));
      const lastSnapshotDate = systemSnap.exists() ? systemSnap.data().lastSnapshotDate : "";
      
      const shiftedDate = new Date(Date.now() - 8 * 60 * 60 * 1000);
      const todayString = shiftedDate.toISOString().split('T')[0]; 
      
      if (lastSnapshotDate !== todayString) {
         console.log(`New football day detected! (Date: ${todayString}). Taking automated snapshot before calculating scores...`);
         await handleTakeSnapshot(true); 
         await setDoc(doc(db, "settings", "system"), { lastSnapshotDate: todayString }, { merge: true });
         wasSnapshotTakenNow = true;
      }

      const matchesSnap = await getDocs(collection(db, "matches")); const realMatches = matchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const qualSnap = await getDoc(doc(db, "admin_results", "qualifiers")); const realQuals = qualSnap.exists() ? (qualSnap.data().results || {}) : {};
      const thirdSnap = await getDoc(doc(db, "admin_results", "third_place")); const realThird = thirdSnap.exists() ? (thirdSnap.data().teams || []) : [];
      const bonusSnap = await getDoc(doc(db, "admin_results", "bonus")); const realBonusAns = bonusSnap.exists() ? (bonusSnap.data().answers || {}) : {};

      const questionsSnap = await getDoc(doc(db, "settings", "bonus_questions"));
      const currentBonusQuestions = questionsSnap.exists() ? (questionsSnap.data().questions || []) : [];

      const usersSnap = await getDocs(collection(db, "users")); const allUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const allUserMatchesSnap = await getDocs(collection(db, "predictions_matches")); const allUserMatches = allUserMatchesSnap.docs.map(doc => doc.data());
      const allUserKnockoutSnap = await getDocs(collection(db, "predictions_knockout")); const allUserKnockouts = allUserKnockoutSnap.docs.map(doc => doc.data());
      
      const allUserQualsSnap = await getDocs(collection(db, "predictions_qualifiers")); 
      const allUserQuals = allUserQualsSnap.docs.map(doc => ({ userId: doc.id, groups: doc.data().groups || {} }));
      
      const allUserBonusSnap = await getDocs(collection(db, "predictions_bonus")); 
      const allUserBonuses = allUserBonusSnap.docs.map(doc => ({ userId: doc.id, answers: doc.data().answers || {} }));
      
      const allUserThirdSnap = await getDocs(collection(db, "predictions_third_place")); 
              const allUserThirds = allUserThirdSnap.docs.map(doc => ({ userId: doc.id, teams: doc.data().teams || [] }));

              // ✨ הגדרת המחירון לשלבי הנוקאאוט (היה חסר וגרם לקריסות)
        const qualifierPointsMap: any = { "32 הגדולות": 5, "שמינית גמר": 10, "רבע גמר": 15, "חצי גמר": 20, "גמר": 25, "מקום שלישי": 10 };

        for (const currentUser of allUsers) {
          let basePoints = 0;       // ניקוד שלב הבתים והטורניר
          let knockoutPoints = 0;   // ניקוד שלב הנוקאאוט (משחקים + בונוסים של נוקאאוט)
          let matchesPoints = 0;
          let groupPoints = 0;
          let thirdPlacePoints = 0;
          let bonusPoints = 0;
          const uid = currentUser.id;

          // 1. חישוב משחקי שלב הבתים
          const userGroupMatches = allUserMatches.filter(m => m.userId === uid);
          userGroupMatches.forEach(userMatch => {
            const realMatch = realMatches.find(m => m.id === userMatch.matchId);
            // @ts-ignore
            if (realMatch && realMatch.isFinished && realMatch.stage !== "KNOCKOUT") {
              const predH = Number(userMatch.predictedHomeScore); const predA = Number(userMatch.predictedAwayScore);
              const realH = Number(realMatch.realHomeScore); const realA = Number(realMatch.realAwayScore);
              if (!isNaN(predH) && !isNaN(predA) && !isNaN(realH) && !isNaN(realA)) {
                if (Math.sign(predH - predA) === Math.sign(realH - realA)) { 
                  basePoints += 5; 
                  matchesPoints += 5;
                  if (predH === realH && predA === realA) {
                     basePoints += 10; 
                     matchesPoints += 10;
                  }
                }
              }
            }
          });

          // 2. חישוב מעפילות מהבתים
          const userQualData = allUserQuals.find(q => q.userId === uid);
          if (userQualData && userQualData.groups) {
            for (const [groupName, preds] of Object.entries<any>(userQualData.groups)) {
              const realGroup = realQuals[groupName];
              if (realGroup) {
                if (preds.first === realGroup.first && preds.first !== "") { basePoints += 15; groupPoints += 15; }
                else if (preds.first === realGroup.second && preds.first !== "") { basePoints += 7; groupPoints += 7; }
                
                if (preds.second === realGroup.second && preds.second !== "") { basePoints += 15; groupPoints += 15; }
                else if (preds.second === realGroup.first && preds.second !== "") { basePoints += 7; groupPoints += 7; }
              }
            }
          }

          // 3. חישוב 8 המעפילות מהמקום ה-3
          const userThirdData = allUserThirds.find(t => t.userId === uid);
          if (userThirdData) {
            userThirdData.teams.forEach((team: string) => { 
                if (realThird.includes(team) && team !== "") {
                    basePoints += 10; 
                    thirdPlacePoints += 10;
                }
            });
          }

          // 4. חישוב משחקי נוקאאוט (נוסף ישירות ל-knockoutPoints)
          const userKnockoutMatches = allUserKnockouts.filter(m => m.userId === uid);
          userKnockoutMatches.forEach(koMatch => {
            const realMatch = realMatches.find(m => m.id === koMatch.matchId);
            if (realMatch && realMatch.isFinished && realMatch.stage === "KNOCKOUT") {
              const predH = Number(koMatch.predictedHomeScore); const predA = Number(koMatch.predictedAwayScore);
              const realH = Number(realMatch.realHomeScore); const realA = Number(realMatch.realAwayScore);
              if (!isNaN(predH) && !isNaN(predA) && !isNaN(realH) && !isNaN(realA)) {
                if (Math.sign(predH - predA) === Math.sign(realH - realA)) { 
                  knockoutPoints += 5; 
                  if (predH === realH && predA === realA) knockoutPoints += 10; 
                }
              }
              const pointsForQualifying = qualifierPointsMap[koMatch.roundName] || 0;
              if (koMatch.qualifier === realMatch.realQualifier && koMatch.qualifier !== "") knockoutPoints += pointsForQualifying;
            }
          });

          // 5. חישוב שאלות בונוס (עם הפרדה לטבלת נוקאאוט)
          const userBonusData = allUserBonuses.find(b => b.userId === uid);
          if (userBonusData) {
            const userBonus = userBonusData.answers;
            currentBonusQuestions.forEach((q: any) => {
              const truth = realBonusAns[q.id]; 
              const userAnswer = userBonus[q.id];
              
              if (truth !== undefined && truth !== null && userAnswer !== undefined && userAnswer !== null && userAnswer !== "") {
                const truthArray = Array.isArray(truth) ? truth : [truth]; 
                let pointsForThisQuestion = 0;
                
                if (q.isProximity && q.answerType === "NUMBER_PURE") {
                   const truthNum = Number(truthArray[0]);
                   const ansNum = Number(userAnswer);
                   if (!isNaN(truthNum) && !isNaN(ansNum)) {
                      const diff = Math.abs(truthNum - ansNum);
                      if (diff === 0) pointsForThisQuestion = 50; 
                      else if (diff <= 5) pointsForThisQuestion = 40; 
                      else if (diff <= 10) pointsForThisQuestion = 30; 
                      else if (diff <= 15) pointsForThisQuestion = 20; 
                      else if (diff <= 20) pointsForThisQuestion = 10; 
                   }
                } else {
                  const normalize = (s: any) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
                  const isCorrect = truthArray.some((t: any) => normalize(t) === normalize(userAnswer));
                  if (isCorrect) pointsForThisQuestion = (Number(q.points) || 0);
                }

                if (pointsForThisQuestion > 0) {
                  bonusPoints += pointsForThisQuestion;
                  // ✨ התיקון הקריטי: אם הבונוס שייך לנוקאאוט, הוא נספר בטבלת הנוקאאוט
                  if (q.phase === "KNOCKOUT") {
                     knockoutPoints += pointsForThisQuestion;
                  } else {
                     basePoints += pointsForThisQuestion;
                  }
                }
              }
            });
          }

          // סיכום סופי: totalPoints הוא תמיד הסכום של שניהם
          const finalTotal = basePoints + knockoutPoints;
          
          await updateDoc(doc(db, "users", uid), { 
              totalPoints: finalTotal, 
              knockoutPoints: knockoutPoints, // עכשיו כולל גם בונוסים של נוקאאוט!
              breakdown: {
                  matches: matchesPoints,
                  groups: groupPoints,
                  thirdPlace: thirdPlacePoints,
                  bonuses: bonusPoints,
                  knockout: knockoutPoints
              }
          });
        }
      
      const updatedUsersSnap = await getDocs(collection(db, "users"));
      const updatedUsersArray: any[] = [];
      updatedUsersSnap.forEach(doc => updatedUsersArray.push({ id: doc.id, ...doc.data() }));
      
      const usersWithProgress = await calculateAllUsersProgress(updatedUsersArray, realMatches, currentBonusQuestions, tournamentState);
      usersWithProgress.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
      setUsersList(usersWithProgress);
      
      if (!isSilent) {
        toast.success("הניקוד חושב בהצלחה! 🏆");
        if (wasSnapshotTakenNow) {
          setTimeout(() => {
            toast.success("מודיעין: המערכת זיהתה יום חדש וביצעה ריצת סוף יום (Snapshot) ברקע! 📸", { 
              duration: 7000,
              icon: '🌟'
            });
          }, 500);
        }
      }

    } catch (error) { 
      console.error(error); 
      if (!isSilent) toast.error("אירעה שגיאה בחישוב הניקוד."); 
    } finally { 
      setIsCalculating(false); 
    }
  };


  
  const handleCreateAutoInsights = () => {
    if (!statsData) {
      toast.error("אנא עבור קודם לטאב 'תובנות' (STATS) ולחץ על 'סרוק מסד נתונים'.", { icon: "⚠️" });
      return;
    }
    
    const insights: string[] = [];

    for (const [mId, data] of Object.entries(statsData.matches)) {
      const match = matches.find(m => m.id === mId);
      if (!match) continue;
      
      const total = (data as any).total;
      if (total < 4) continue; 

      const homeCount = (data as any).homeWins.length;
      const awayCount = (data as any).awayWins.length;

      if (homeCount / total >= 0.8) insights.push(`🔥 קונצנזוס: ${Math.round((homeCount/total)*100)}% בטוחים ש${match.homeTeam} תנצח את ${match.awayTeam}.`);
      if (awayCount / total >= 0.8) insights.push(`🔥 קונצנזוס: ${Math.round((awayCount/total)*100)}% בטוחים ש${match.awayTeam} תנצח את ${match.homeTeam}.`);

      if (homeCount === 1 && total >= 5) insights.push(`🐺 זאב בודד: רק ${(data as any).homeWins[0].name} מאמין בניצחון של ${match.homeTeam} על ${match.awayTeam}!`);
      if (awayCount === 1 && total >= 5) insights.push(`🐺 זאב בודד: רק ${(data as any).awayWins[0].name} מאמין בניצחון של ${match.awayTeam} על ${match.homeTeam}!`);

      Object.entries((data as any).exactScores).forEach(([score, sData]: any) => {
         const [h, a] = score.split('-');
         if (Number(h) + Number(a) >= 5) {
            insights.push(`😱 טירוף: ${sData.users.map((u:any)=>u.name).join(', ')} חזה תוצאה פסיכית של ${score} בין ${match.homeTeam} ל-${match.awayTeam}.`);
         }
      });
    }

    const shuffled = insights.sort(() => 0.5 - Math.random()).slice(0, 4);
    if (shuffled.length === 0) shuffled.push("אין מספיק דרמות כרגע במערכת, חכו לעוד ניחושים של הקהל.");
    setAutoInsights(shuffled);
  };

  const addInsightToMessage = async (text: string) => {
    try {
      const snap = await getDoc(doc(db, "settings", "dashboard"));
      const currentMsg = snap.exists() ? (snap.data().dailyMessage || "") : "";
      const htmlBullet = `<ul>\n  <li>${text}</li>\n</ul>\n`;
      await setDoc(doc(db, "settings", "dashboard"), { dailyMessage: currentMsg + htmlBullet }, { merge: true });
      toast.success("התובנה נוספה לטור היומי!");
    } catch(e) {
      toast.error("שגיאה בהוספת התובנה");
    }
  };

  const handleFactoryReset = async () => {
    const confirm1 = confirm("⚠️ אזהרה חמורה: פעולה זו תמחק את *כל* המשתמשים ואת *כל* הניחושים במערכת. האם אתה בטוח?");
    if (!confirm1) return;
    const confirm2 = prompt("כדי לאשר את מחיקת כל הנתונים, הקלד את המילה: RESET");
    if (confirm2 !== "RESET") { toast.error("הפעולה בוטלה."); return; }
    toast.loading("מנקה את המערכת לחלוטין...", { duration: 4000 });
    setIsCalculating(true);
    try {
      const collectionsToNuke = ["users", "predictions_matches", "predictions_knockout", "predictions_qualifiers", "predictions_third_place", "predictions_bonus"];
      for (const collName of collectionsToNuke) {
        const snap = await getDocs(collection(db, collName));
        for (const d of snap.docs) await deleteDoc(doc(db, collName, d.id));
      }
      await setDoc(doc(db, "admin_results", "bonus"), { answers: {}, blacklist: {}, leading: {}, locked: {} });
      await setDoc(doc(db, "admin_results", "qualifiers"), { results: {} });
      await setDoc(doc(db, "admin_results", "third_place"), { teams: Array(8).fill("") });
      const matchesSnap = await getDocs(collection(db, "matches"));
      for (const m of matchesSnap.docs) {
        await updateDoc(doc(db, "matches", m.id), { realHomeScore: null, realAwayScore: null, realQualifier: "", isFinished: false });
      }
      await setDoc(doc(db, "settings", "system"), { tournamentState: 0, deadlines: {} }, { merge: true });
      await setDoc(doc(db, "settings", "dashboard"), { dailyMessage: "" }, { merge: true });
      
      toast.success("🧹 איזה ניקיון! המערכת אופסה לחלוטין למצב 'ונילה'.", { duration: 5000 });
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) { 
      toast.error("שגיאה בתהליך האיפוס."); 
    } finally { 
      setIsCalculating(false); 
    }
  };

  const handleSimulateFullTournament = async () => {
    const numUsers = parseInt(prompt("כמה משתמשים פיקטיביים תרצה להזריק לטורניר המלא? (מומלץ: 20-50)", "30") || "0");
    if (isNaN(numUsers) || numUsers <= 0) return;
    
    if (!confirm(`זהירות! זה ייצר ${numUsers} שחקנים, ימלא את כל תוצאות האמת של המונדיאל ויחשב ניקוד. מומלץ לעשות Factory Reset לפני. להמשיך?`)) return;

    toast.loading("מריץ סימולציה מלאה... זה יכול לקחת דקה", { duration: 5000 });
    setIsCalculating(true);
    try {
      const namesFirst = ["דני", "רוני", "יעל", "אלכס", "מיכל", "אורן", "נועה", "עידו", "מאיה", "גיא", "תמר", "עומר"];
      const namesLast = ["לוי", "כהן", "ישראלי", "אברהם", "גולן", "שפירא", "ברק", "מזרחי"];
      
      for (let i = 0; i < numUsers; i++) {
        const botId = `sim_${Date.now()}_${i}`;
        const randomName = `${namesFirst[Math.floor(Math.random() * namesFirst.length)]} ${namesLast[Math.floor(Math.random() * namesLast.length)]} (בוט)`;
        
        await setDoc(doc(db, "users", botId), { name: randomName, email: `${botId}@test.com`, totalPoints: 0, knockoutPoints: 0, hasPaid: true });
        
        for (const match of matches) {
          const coll = match.stage === "KNOCKOUT" ? "predictions_knockout" : "predictions_matches";
          const pHome = Math.floor(Math.random() * 5); const pAway = Math.floor(Math.random() * 5);
          let payload: any = { userId: botId, matchId: match.id, predictedHomeScore: pHome.toString(), predictedAwayScore: pAway.toString(), updatedAt: new Date() };
          if (match.stage === "KNOCKOUT") { payload.roundName = match.roundName; payload.qualifier = pHome > pAway ? match.homeTeam : (pAway > pHome ? match.awayTeam : (Math.random() > 0.5 ? match.homeTeam : match.awayTeam)); } 
          else { payload.groupId = match.group; }
          await setDoc(doc(db, coll, `${botId}_${match.id}`), payload);
        }

        const groupsPreds: any = {};
        for (const g of Object.keys(groupTeams)) {
          const t = Array.from(groupTeams[g] as Set<string>);
          if (t.length >= 2) { const sh = [...t].sort(()=>0.5-Math.random()); groupsPreds[g] = { first: sh[0], second: sh[1] }; }
        }
        await setDoc(doc(db, "predictions_qualifiers", botId), { groups: groupsPreds, updatedAt: new Date() });
        const shuffledTeamsForThird = [...allTeams].sort(() => 0.5 - Math.random()).slice(0, 8);
        while (shuffledTeamsForThird.length < 8) shuffledTeamsForThird.push("");
        await setDoc(doc(db, "predictions_third_place", botId), { teams: shuffledTeamsForThird, updatedAt: new Date() });
        
        const bAns: any = {};
        for (const q of bonusQuestions) {
           bAns[q.id] = (q.customOptions && q.customOptions.length > 0) ? q.customOptions[Math.floor(Math.random() * q.customOptions.length)] : (q.answerType === "NUMERIC" ? Math.floor(Math.random()*15).toString() : "תשובת סימולטור");
        }
        await setDoc(doc(db, "predictions_bonus", botId), { answers: bAns, updatedAt: new Date() });
      }

      for (const match of matches) {
        const rH = Math.floor(Math.random() * 5); const rA = Math.floor(Math.random() * 5);
        let rQ = "";
        if (match.stage === "KNOCKOUT") rQ = rH > rA ? match.homeTeam : (rA > rH ? match.awayTeam : (Math.random() > 0.5 ? match.homeTeam : match.awayTeam));
        await updateDoc(doc(db, "matches", match.id), { realHomeScore: rH, realAwayScore: rA, realQualifier: rQ, isFinished: true });
      }

      const rQuals: any = {};
      for (const g of Object.keys(groupTeams)) {
        const t = Array.from(groupTeams[g] as Set<string>);
        if (t.length >= 2) { const sh = [...t].sort(()=>0.5-Math.random()); rQuals[g] = { first: sh[0], second: sh[1] }; }
      }
      await setDoc(doc(db, "admin_results", "qualifiers"), { results: rQuals, updated_at: new Date() });

      const rThird = [...allTeams].sort(()=>0.5-Math.random()).slice(0, 8);
      await setDoc(doc(db, "admin_results", "third_place"), { teams: rThird, updated_at: new Date() });

      const rBonus: any = {};
      for (const q of bonusQuestions) {
         rBonus[q.id] = (q.customOptions && q.customOptions.length > 0) ? q.customOptions[Math.floor(Math.random() * q.customOptions.length)] : (q.answerType === "NUMERIC" ? Math.floor(Math.random()*15).toString() : "תשובת סימולטור");
      }
      await setDoc(doc(db, "admin_results", "bonus"), { answers: rBonus, blacklist: {}, leading: {}, locked: {}, updated_at: new Date() });

      await handleCalculateScores(true);

      toast.success("🎉 הסימולציה הסתיימה בהצלחה! מונדיאל שלם שוחק בשרת.", { duration: 6000 });
      setTimeout(() => window.location.reload(), 2000);
    } catch (e) { 
      console.error(e); 
      toast.error("שגיאה בסימולציה."); 
    } finally { 
      setIsCalculating(false); 
    }
  };

  const handleSpawnBotsOnly = async () => {
    const numUsers = parseInt(prompt("כמה בוטים להזריק למערכת? (הם ימלאו ניחושים מלאים לכל הטורניר)", "30") || "0");
    if (isNaN(numUsers) || numUsers <= 0) return;
    
    toast.loading("מייצר בוטים וממלא להם טפסים... ⏳", { duration: 5000 });
    setIsCalculating(true);
    try {
      const namesFirst = ["דני", "רוני", "יעל", "אלכס", "מיכל", "אורן", "נועה", "עידו", "מאיה", "גיא", "תמר", "עומר"];
      const namesLast = ["לוי", "כהן", "ישראלי", "אברהם", "גולן", "שפירא", "ברק", "מזרחי"];
      
      for (let i = 0; i < numUsers; i++) {
        const botId = `sim_${Date.now()}_${i}`;
        const randomName = `${namesFirst[Math.floor(Math.random() * namesFirst.length)]} ${namesLast[Math.floor(Math.random() * namesLast.length)]} (בוט)`;
        
        await setDoc(doc(db, "users", botId), { name: randomName, email: `${botId}@test.com`, totalPoints: 0, knockoutPoints: 0, hasPaid: true });
        
        for (const match of matches) {
          const coll = match.stage === "KNOCKOUT" ? "predictions_knockout" : "predictions_matches";
          const pHome = Math.floor(Math.random() * 5); const pAway = Math.floor(Math.random() * 5);
          let payload: any = { userId: botId, matchId: match.id, predictedHomeScore: pHome.toString(), predictedAwayScore: pAway.toString(), updatedAt: new Date() };
          if (match.stage === "KNOCKOUT") { payload.roundName = match.roundName; payload.qualifier = pHome > pAway ? match.homeTeam : (pAway > pHome ? match.awayTeam : (Math.random() > 0.5 ? match.homeTeam : match.awayTeam)); } 
          else { payload.groupId = match.group; }
          await setDoc(doc(db, coll, `${botId}_${match.id}`), payload);
        }

        const groupsPreds: any = {};
        for (const g of Object.keys(groupTeams)) {
          const t = Array.from(groupTeams[g] as Set<string>);
          if (t.length >= 2) { const sh = [...t].sort(()=>0.5-Math.random()); groupsPreds[g] = { first: sh[0], second: sh[1] }; }
        }
        await setDoc(doc(db, "predictions_qualifiers", botId), { groups: groupsPreds, updatedAt: new Date() });
        const shuffledTeamsForThird = [...allTeams].sort(() => 0.5 - Math.random()).slice(0, 8);
        while (shuffledTeamsForThird.length < 8) shuffledTeamsForThird.push("");
        await setDoc(doc(db, "predictions_third_place", botId), { teams: shuffledTeamsForThird, updatedAt: new Date() });
        
        const bAns: any = {};
        for (const q of bonusQuestions) {
           bAns[q.id] = (q.customOptions && q.customOptions.length > 0) ? q.customOptions[Math.floor(Math.random() * q.customOptions.length)] : (q.answerType === "NUMERIC" ? Math.floor(Math.random()*15).toString() : "תשובת סימולטור");
        }
        await setDoc(doc(db, "predictions_bonus", botId), { answers: bAns, updatedAt: new Date() });
      }

      toast.success(`✅ ${numUsers} בוטים נוצרו והגישו ניחושים לכל הטורניר! כעת תוכל לסמלץ תוצאות אמת לפי שלבים.`, { duration: 6000 });
      setTimeout(() => window.location.reload(), 2000);
    } catch (e) { 
      console.error(e); 
      toast.error("שגיאה ביצירת בוטים."); 
    } finally { 
      setIsCalculating(false); 
    }
  };

  const handleSmartSimulation = async () => {
    if (simStage === "ALL") {
       await handleSimulateFullTournament(); 
       return;
    }

    if (matches.length === 0) return toast.error("אין משחקים במסד הנתונים! טען קובץ JSON קודם.");

    if (!confirm(`האם אתה בטוח שברצונך למלא תוצאות אמת רק ל-${simStage} ולחשב ניקוד?`)) return;

    setIsCalculating(true);
    try {
      let matchesToResolve = [];
      let nextState = tournamentState;

      if (simStage === "MD1") {
         matchesToResolve = matches.filter(m => m.stage !== "KNOCKOUT" && (Number(m.matchday) || 1) === 1);
         nextState = 2;
      } else if (simStage === "MD2") {
         matchesToResolve = matches.filter(m => m.stage !== "KNOCKOUT" && Number(m.matchday) === 2);
         nextState = 3;
      } else if (simStage === "MD3") {
         matchesToResolve = matches.filter(m => m.stage !== "KNOCKOUT" && Number(m.matchday) === 3);
         nextState = 4;
      } else if (simStage === "R32") {
         matchesToResolve = matches.filter(m => m.stage === "KNOCKOUT" && m.roundName === "32 הגדולות");
         nextState = 6;
      } else if (simStage === "R16") {
         matchesToResolve = matches.filter(m => m.stage === "KNOCKOUT" && m.roundName === "שמינית גמר");
         nextState = 8;
      } else if (simStage === "QF") {
         matchesToResolve = matches.filter(m => m.stage === "KNOCKOUT" && m.roundName === "רבע גמר");
         nextState = 10;
      } else if (simStage === "SF") {
         matchesToResolve = matches.filter(m => m.stage === "KNOCKOUT" && (m.roundName === "חצי גמר" ));
         nextState = 12;
      } else if (simStage === "FINAL") {
         matchesToResolve = matches.filter(m => m.stage === "KNOCKOUT" && m.roundName === "גמר" || m.roundName === "מקום שלישי");
         nextState = 13;
      }

      for (const match of matchesToResolve) {
        const rH = Math.floor(Math.random() * 5);
        const rA = Math.floor(Math.random() * 5);
        let rQ = "";
        if (match.stage === "KNOCKOUT") {
           rQ = rH > rA ? match.homeTeam : (rA > rH ? match.awayTeam : (Math.random() > 0.5 ? match.homeTeam : match.awayTeam));
        }
        await updateDoc(doc(db, "matches", match.id), { realHomeScore: rH, realAwayScore: rA, realQualifier: rQ, isFinished: true });
      }

      if (simStage === "MD3") {
        const rQuals: any = {};
        for (const g of Object.keys(groupTeams)) {
          const t = Array.from(groupTeams[g] as Set<string>);
          if (t.length >= 2) { const sh = [...t].sort(()=>0.5-Math.random()); rQuals[g] = { first: sh[0], second: sh[1] }; }
        }
        await setDoc(doc(db, "admin_results", "qualifiers"), { results: rQuals, updated_at: new Date() });

        const rThird = [...allTeams].sort(()=>0.5-Math.random()).slice(0, 8);
        await setDoc(doc(db, "admin_results", "third_place"), { teams: rThird, updated_at: new Date() });
      }

      if (simStage === "FINAL") {
        const rBonus: any = {};
        for (const q of bonusQuestions) {
           rBonus[q.id] = (q.customOptions && q.customOptions.length > 0) ? q.customOptions[Math.floor(Math.random() * q.customOptions.length)] : (q.answerType === "NUMERIC" ? Math.floor(Math.random()*15).toString() : "תשובת סימולטור");
        }
        await setDoc(doc(db, "admin_results", "bonus"), { answers: rBonus, blacklist: {}, leading: {}, locked: {}, updated_at: new Date() });
      }

      await handleCalculateScores(true); 

      await setDoc(doc(db, "settings", "system"), { tournamentState: nextState }, { merge: true });
      setTournamentState(nextState);

      toast.success(`✅ הסימולציה לשלב ${simStage} הסתיימה! \nמילאנו תוצאות אמת, עדכנו ניקוד ושעון הטורניר קפץ למצב ${nextState}.`, { duration: 5000 });
      fetchAdminData();

    } catch(e) {
      console.error(e); 
      toast.error("שגיאה בסימולציה.");
    } finally {
      setIsCalculating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonMatches = JSON.parse(event.target?.result as string);
        if (!Array.isArray(jsonMatches)) throw new Error("File must contain an array of matches");
        if (!confirm(`נמצאו ${jsonMatches.length} משחקים. להעלות למסד הנתונים?`)) return;
        setIsCalculating(true);
        for (const m of jsonMatches) { if (m.id) await setDoc(doc(db, "matches", m.id.toString()), m, { merge: true }); }
        toast.success("✅ המשחקים הועלו בהצלחה!");
        fetchAdminData();
      } catch (err) { 
        toast.error("שגיאה בפיענוח קובץ ה-JSON."); 
      } 
      finally { 
        setIsCalculating(false); 
        if (fileInputRef.current) fileInputRef.current.value = ""; 
      }
    };
    reader.readAsText(file);
  };

  const handleExportBackup = async () => {
    setIsCalculating(true);
    try {
      const collectionsToBackup = ['users', 'matches', 'predictions_matches', 'predictions_knockout', 'predictions_qualifiers', 'predictions_third_place', 'predictions_bonus', 'settings', 'admin_results', 'mini_leagues'];
      const backupData: any = {};
      
      for (const collName of collectionsToBackup) {
        backupData[collName] = {};
        const snap = await getDocs(collection(db, collName));
        snap.forEach(d => { backupData[collName][d.id] = d.data(); });
      }

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `bets_in_prod_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      
      toast.success("קובץ הגיבוי הורד בהצלחה!");
    } catch (e) { 
      console.error(e); 
      toast.error("שגיאה ביצירת קובץ הגיבוי."); 
    } 
    finally { setIsCalculating(false); }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string);
        
        // --- 1. איתור משתמשים שעלולים להימחק ---
        const currentUsersSnap = await getDocs(collection(db, "users"));
        const currentUsersIds = currentUsersSnap.docs.map(d => d.id);
        const backupUsersIds = backup.users ? Object.keys(backup.users) : [];
        
        // מי נמצא עכשיו במערכת, אבל לא נמצא בקובץ הגיבוי?
        const newUsersAtRisk = currentUsersSnap.docs
           .filter(d => !backupUsersIds.includes(d.id))
           .map(d => (d.data() as any).name || d.id);

        let warningMessage = "⚠️ אזהרה חמורה: פעולה זו תמחק את *כל* הנתונים ותדרוס אותם עם הגיבוי.\n\n";
        
        if (newUsersAtRisk.length > 0) {
           warningMessage += `🚨 שים לב! מצאנו ${newUsersAtRisk.length} משתמשים שנרשמו *אחרי* שהגיבוי הזה נוצר.\nהם (והניחושים שלהם) יימחקו לחלוטין אם תמשיך!\n\nהמשתמשים בסכנה:\n${newUsersAtRisk.join(", ")}\n\n`;
        }

        warningMessage += "האם אתה בטוח שברצונך לבצע שחזור מלא?";
        if (!confirm(warningMessage)) return;

        setIsCalculating(true);
        toast.loading("מוחק נתונים ישנים ומשחזר מקובץ... ⏳", { duration: 5000 });
        
        // --- 2. מחיקה מלאה של הקולקשנים כדי למנוע "שאריות" ---
        const collectionsToRestore = Object.keys(backup);
        for (const collName of collectionsToRestore) {
           const snap = await getDocs(collection(db, collName));
           for (const d of snap.docs) {
              await deleteDoc(doc(db, collName, d.id));
           }
        }

        // --- 3. הזרקת הנתונים מהגיבוי למסד ---
        for (const [collName, docs] of Object.entries(backup)) {
          for (const [docId, data] of Object.entries(docs as any)) {
            await setDoc(doc(db, collName, docId), data);
          }
        }
        
        toast.success("✅ שחזור מסד הנתונים הסתיים בהצלחה! מרענן דף...", { duration: 5000 });
        setTimeout(() => window.location.reload(), 2000);
      } catch (err) { 
        console.error(err); 
        toast.error("שגיאה בפענוח קובץ השחזור. ודא שזהו קובץ תקין."); 
      } 
      finally { setIsCalculating(false); }
    };
    reader.readAsText(file);
  };

  const handleTakeSnapshot = async (isSilent: boolean = false) => {
    if (!isSilent && !confirm("לשמור תמונת מצב יומית? \nפעולה זו תקבע את נקודת הייחוס לחישוב 'מגמות' (חצים ירוקים/אדומים) עבור המשתמשים מחר. מומלץ לבצע פעם ביום בלילה.")) return;
    
    setIsCalculating(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const usersArray: any[] = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const sortedGeneral = [...usersArray].sort((a: any, b: any) => (b.totalPoints || 0) - (a.totalPoints || 0));
      let currentRank = 1;
      const genRanks = sortedGeneral.map((u: any, i: number) => {
        if (i > 0 && (u.totalPoints || 0) < (sortedGeneral[i - 1].totalPoints || 0)) currentRank = i + 1;
        return { id: u.id, rank: currentRank };
      });

      const sortedKnockout = [...usersArray].sort((a: any, b: any) => (b.knockoutPoints || 0) - (a.knockoutPoints || 0));
      let currentKoRank = 1;
      const koRanks = sortedKnockout.map((u: any, i: number) => {
        if (i > 0 && (u.knockoutPoints || 0) < (sortedKnockout[i - 1].knockoutPoints || 0)) currentKoRank = i + 1;
        return { id: u.id, rank: currentKoRank };
      });

      for (const u of usersArray) {
        const genRank = genRanks.find((r: any) => r.id === u.id)?.rank || 1;
        const koRank = koRanks.find((r: any) => r.id === u.id)?.rank || 1;
        await updateDoc(doc(db, "users", u.id), {
          previousTotalPoints: u.totalPoints || 0,
          previousKnockoutPoints: u.knockoutPoints || 0,
          previousRankGeneral: genRank,
          previousRankKnockout: koRank
        });
      }
      
      if (!isSilent) toast.success("📸 תמונת מצב נשמרה בהצלחה! חיצי המגמה התאפסו.");
    } catch (error) { 
      if (!isSilent) toast.error("שגיאה בשמירת תמונת מצב."); 
    } finally { 
      setIsCalculating(false); 
    }
  };

  const formatAuditTime = (ts: any) => {
    if (!ts) return "";
    try {
      const date = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
      return date.toLocaleString('he-IL', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
    } catch { return ""; }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את המשתמש "${userName}" ואת כל הניחושים שלו לצמיתות?`)) return;
    setIsCalculating(true);
    try {
      await deleteDoc(doc(db, "users", userId));
      await deleteDoc(doc(db, "predictions_qualifiers", userId));
      await deleteDoc(doc(db, "predictions_third_place", userId));
      await deleteDoc(doc(db, "predictions_bonus", userId));
      
      const matchesQuery = query(collection(db, "predictions_matches"), where("userId", "==", userId));
      const matchesSnap = await getDocs(matchesQuery);
      for (const d of matchesSnap.docs) {
         await deleteDoc(doc(db, "predictions_matches", d.id));
      }
      
      const koQuery = query(collection(db, "predictions_knockout"), where("userId", "==", userId));
      const koSnap = await getDocs(koQuery);
      for (const d of koSnap.docs) {
         await deleteDoc(doc(db, "predictions_knockout", d.id));
      }
      
      setUsersList(usersList.filter(u => u.id !== userId));
      toast.success("✅ המשתמש וכל הניחושים שלו נמחקו בהצלחה וללא שאריות!");
    } catch (error) { 
      console.error(error); 
      toast.error("שגיאה במחיקת המשתמש."); 
    } 
    finally { setIsCalculating(false); }
  };

  const handleDeleteAllMatches = async () => {
    if (!confirm("⚠️ אזהרה חמורה: פעולה זו תמחק את *כל* המשחקים ממסד הנתונים וגם את *כל ניחושי המשתמשים* למשחקים אלו! האם להמשיך?")) return;
    setIsCalculating(true);
    try { 
      for (const match of matches) { 
         await deleteDoc(doc(db, "matches", String(match.id))); 
      } 
      
      const pmSnap = await getDocs(collection(db, "predictions_matches"));
      for (const d of pmSnap.docs) {
         await deleteDoc(doc(db, "predictions_matches", d.id));
      }

      const pkSnap = await getDocs(collection(db, "predictions_knockout"));
      for (const d of pkSnap.docs) {
         await deleteDoc(doc(db, "predictions_knockout", d.id));
      }

      setMatches([]); 
      toast.success("✅ כל המשחקים וניחושי השחקנים נמחקו לחלוטין."); 
    } 
    catch (error) { 
      console.error(error); 
      toast.error("שגיאה במחיקת המשחקים."); 
    } 
    finally { setIsCalculating(false); }
  };

  const handleDeleteMatch = async (matchId: string) => {
  try {
    await deleteDoc(doc(db, "matches", matchId));
    setMatches(prev => prev.filter(m => m.id !== matchId));
    toast.success("המשחק נמחק מהמערכת.");
  } catch (e) {
    toast.error("שגיאה במחיקת המשחק.");
  }
};
  const handleExportPredictions = async (targetUserId: string | "ALL", targetUserName: string) => {
    setIsCalculating(true);
    toast.loading("מכין קובץ אקסל...", { id: "csvExport" });
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const matchesSnap = await getDocs(collection(db, "matches"));
      const bqSnap = await getDoc(doc(db, "settings", "bonus_questions"));
      
      const qualSnap = await getDoc(doc(db, "admin_results", "qualifiers")); 
      const realQuals = qualSnap.exists() ? (qualSnap.data().results || {}) : {};
      const thirdSnap = await getDoc(doc(db, "admin_results", "third_place")); 
      const realThird = thirdSnap.exists() ? (thirdSnap.data().teams || []) : [];
      const bonusSnap = await getDoc(doc(db, "admin_results", "bonus")); 
      const realBonusAns = bonusSnap.exists() ? (bonusSnap.data().answers || {}) : {};

      const users = usersSnap.docs.map(d => ({id: d.id, ...d.data()}));
      const matchesList = matchesSnap.docs.map(d => ({id: d.id, ...d.data()}));
      const bonusQs = bqSnap.exists() ? (bqSnap.data().questions || []) : [];

      let csvContent = "\uFEFF"; 
      csvContent += "שם משתמש,סוג הניחוש,שלב המשחק,פירוט המשחק,ניחוש,תאריך הניחוש,ניקוד\n";

      const usersToExport = targetUserId === "ALL" ? users : users.filter(u => u.id === targetUserId);

      const pmSnap = await getDocs(collection(db, "predictions_matches"));
      const pkSnap = await getDocs(collection(db, "predictions_knockout"));
      const pqSnap = await getDocs(collection(db, "predictions_qualifiers"));
      const ptSnap = await getDocs(collection(db, "predictions_third_place"));
      const pbSnap = await getDocs(collection(db, "predictions_bonus"));

      const pmData = pmSnap.docs.map(d => d.data());
      const pkData = pkSnap.docs.map(d => d.data());
      const pqData = pqSnap.docs.map(d => ({id: d.id, ...d.data()}));
      const ptData = ptSnap.docs.map(d => ({id: d.id, ...d.data()}));
      const pbData = pbSnap.docs.map(d => ({id: d.id, ...d.data()}));

      const qualifierPointsMap: any = { "32 הגדולות": 5, "שמינית גמר": 10, "רבע גמר": 15, "חצי גמר": 20, "גמר": 25, "מקום שלישי": 10 };
      for (const u of usersToExport) {
         const uName = (u as any).name || "Unknown";
         const escapeCSV = (str: string) => `"${String(str).replace(/"/g, '""')}"`;
         
         const uMatches = pmData.filter(p => p.userId === u.id);
         uMatches.forEach(p => {
            const m: any = matchesList.find(x => x.id === p.matchId);
            if (m) {
               let pts = 0;
               if (m.isFinished && m.stage !== "KNOCKOUT") {
                 const predH = Number(p.predictedHomeScore); const predA = Number(p.predictedAwayScore);
                 const realH = Number(m.realHomeScore); const realA = Number(m.realAwayScore);
                 if (!isNaN(predH) && !isNaN(predA) && !isNaN(realH) && !isNaN(realA)) {
                   if (Math.sign(predH - predA) === Math.sign(realH - realA)) { 
                     pts += 5; 
                     if (predH === realH && predA === realA) pts += 10;
                   }
                 }
               }
               const stageStr = `בית ${m.group}`;
               const detailsStr = `${m.homeTeam} - ${m.awayTeam}`;
               const predStr = `${m.homeTeam} ${p.predictedHomeScore} - ${p.predictedAwayScore} ${m.awayTeam}`;
               const ptsStr = m.isFinished ? pts : '-';
               csvContent += `${escapeCSV(uName)},"משחק",${escapeCSV(stageStr)},${escapeCSV(detailsStr)},${escapeCSV(predStr)},${escapeCSV(formatAuditTime(p.updatedAt))},${escapeCSV(ptsStr.toString())}\n`;
            }
         });
         
         const uKnockout = pkData.filter(p => p.userId === u.id);
         uKnockout.forEach(p => {
            const m: any = matchesList.find(x => x.id === p.matchId);
            if (m) {
               let pts = 0;
               if (m.isFinished && m.stage === "KNOCKOUT") {
                 const predH = Number(p.predictedHomeScore); const predA = Number(p.predictedAwayScore);
                 const realH = Number(m.realHomeScore); const realA = Number(m.realAwayScore);
                 if (!isNaN(predH) && !isNaN(predA) && !isNaN(realH) && !isNaN(realA)) {
                   if (Math.sign(predH - predA) === Math.sign(realH - realA)) { 
                     pts += 5; 
                     if (predH === realH && predA === realA) pts += 10; 
                   }
                 }
                 if (p.qualifier === m.realQualifier && p.qualifier !== "") {
                   pts += (qualifierPointsMap[m.roundName] || 0);
                 }
               }
               const stageStr = m.roundName;
               const detailsStr = `${m.homeTeam} - ${m.awayTeam}`;
               const predStr = `${m.homeTeam} ${p.predictedHomeScore} - ${p.predictedAwayScore} ${m.awayTeam} (עולה: ${p.qualifier})`;
               const ptsStr = m.isFinished ? pts : '-';
               csvContent += `${escapeCSV(uName)},"משחק",${escapeCSV(stageStr)},${escapeCSV(detailsStr)},${escapeCSV(predStr)},${escapeCSV(formatAuditTime(p.updatedAt))},${escapeCSV(ptsStr.toString())}\n`;
            }
         });

         const uQual: any = pqData.find(p => p.id === u.id);
         if (uQual && uQual.groups) {
            for (const [grp, preds] of Object.entries<any>(uQual.groups)) {
               const realGroup = realQuals[grp];
               const isGraded = realGroup && (realGroup.first || realGroup.second);
               
               if (preds.first) {
                  let pts1 = 0;
                  if (isGraded) {
                     if (preds.first === realGroup.first) pts1 = 15;
                     else if (preds.first === realGroup.second) pts1 = 7;
                  }
                  csvContent += `${escapeCSV(uName)},"מעפילה",${escapeCSV(`בית ${grp}`)},"מקום 1",${escapeCSV(preds.first)},${escapeCSV(formatAuditTime(uQual.updatedAt))},${escapeCSV(isGraded ? pts1.toString() : '-')}\n`;
               }

               if (preds.second) {
                  let pts2 = 0;
                  if (isGraded) {
                     if (preds.second === realGroup.second) pts2 = 15;
                     else if (preds.second === realGroup.first) pts2 = 7;
                  }
                  csvContent += `${escapeCSV(uName)},"מעפילה",${escapeCSV(`בית ${grp}`)},"מקום 2",${escapeCSV(preds.second)},${escapeCSV(formatAuditTime(uQual.updatedAt))},${escapeCSV(isGraded ? pts2.toString() : '-')}\n`;
               }
            }
         }

         const uThird: any = ptData.find(p => p.id === u.id);
         if (uThird && uThird.teams) {
            const pred = uThird.teams.filter((x:any)=>x).join(', ');
            if (pred) {
               let pts = 0;
               let isGraded = false;
               if (realThird && realThird.some((x:string) => x !== "")) {
                 isGraded = true;
                 uThird.teams.forEach((team: string) => { 
                   if (realThird.includes(team) && team !== "") pts += 10;
                 });
               }
               csvContent += `${escapeCSV(uName)},"מקום 3","ללא שלב","מקום 3",${escapeCSV(pred)},${escapeCSV(formatAuditTime(uThird.updatedAt))},${escapeCSV(isGraded ? pts.toString() : '-')}\n`;
            }
         }

         const uBonus: any = pbData.find(p => p.id === u.id);
         if (uBonus && uBonus.answers) {
            for (const [qId, ans] of Object.entries<any>(uBonus.answers)) {
               const q: any = bonusQs.find((x:any) => x.id === qId);
               if (q && String(ans).trim() !== "") {
                  let pts = 0;
                  let isGraded = false;
                  const truth = realBonusAns[qId];
                  if (truth && truth.length > 0) {
                     isGraded = true;
                     const truthArray = Array.isArray(truth) ? truth : [truth]; 
                     
                     if (q.isProximity && q.answerType === "NUMBER_PURE") {
                        const truthNum = Number(truthArray[0]); 
                        const ansNum = Number(ans);
                        if (!isNaN(truthNum) && !isNaN(ansNum)) {
                           const diff = Math.abs(truthNum - ansNum);
                           let proxPts = 0;
                           if (diff === 0) proxPts = 50; 
                           else if (diff <= 5) proxPts = 40; 
                           else if (diff <= 10) proxPts = 30; 
                           else if (diff <= 15) proxPts = 20; 
                           else if (diff <= 20) proxPts = 10; 
                           if (proxPts > 0) pts = proxPts;
                        }
                     } else {
                        const isCorrect = truthArray.some((t: any) => t.toString().trim().toLowerCase() === String(ans).trim().toLowerCase());
                        if (isCorrect) pts = (Number(q.points) || 0);
                     }
                  }
                  
                  let phaseStr = q.phase === "GROUPS" ? "בתים" : q.phase === "KNOCKOUT" ? "נוקאאוט" : "כל הטורניר";
                  let weightStr = q.weight === "DOUBLE" ? "דאבל" : q.isSurprise ? "הפתעה" : "רגיל";
                  let stageStr = `${phaseStr} - ${weightStr}`;

                  csvContent += `${escapeCSV(uName)},"בונוס",${escapeCSV(stageStr)},${escapeCSV(q.label)},${escapeCSV(String(ans))},${escapeCSV(formatAuditTime(uBonus.updatedAt))},${escapeCSV(isGraded ? pts.toString() : '-')}\n`;
               }
            }
         }
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `predictions_log_${targetUserId === "ALL" ? "ALL_USERS" : targetUserName}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("קובץ הניחושים נוצר בהצלחה!", { id: "csvExport" });
    } catch (err) {
      console.error(err);
      toast.error("שגיאה בהורדת הניחושים.", { id: "csvExport" });
    } finally {
      setIsCalculating(false);
    }
  };
  
  const handleExportUserBackup = async (userId: string, userName: string) => {
    setIsCalculating(true);
    toast.loading("מכין קובץ גיבוי אישי...", { id: "userExport" });
    try {
      const userBackup: any = { userId, userName, data: {} };
      const collections = ['users', 'predictions_matches', 'predictions_knockout', 'predictions_qualifiers', 'predictions_third_place', 'predictions_bonus'];

      for (const coll of collections) {
        if (coll === 'predictions_matches' || coll === 'predictions_knockout') {
          const q = query(collection(db, coll), where("userId", "==", userId));
          const snap = await getDocs(q);
          userBackup.data[coll] = {};
          snap.forEach(d => { userBackup.data[coll][d.id] = d.data(); });
        } else {
          const docRef = doc(db, coll, userId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            userBackup.data[coll] = { [userId]: snap.data() };
          }
        }
      }

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(userBackup));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `user_backup_${userName}_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();

      toast.success("גיבוי משתמש ירד בהצלחה!", { id: "userExport" });
    } catch (e) {
      console.error(e);
      toast.error("שגיאה בגיבוי המשתמש", { id: "userExport" });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleImportUserBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const userBackup = JSON.parse(event.target?.result as string);
        if (!userBackup.userId || !userBackup.data) throw new Error("Invalid file format");

        if (!confirm(`האם לשחזר את הנתונים של המשתמש "${userBackup.userName}"? פעולה זו תדרוס את הניחושים והנתונים שלו בלבד.`)) return;

        setIsCalculating(true);
        toast.loading("משחזר נתוני משתמש... ⏳", { id: "userImport" });

        for (const [collName, docs] of Object.entries(userBackup.data)) {
          for (const [docId, data] of Object.entries(docs as any)) {
            await setDoc(doc(db, collName, docId), data);
          }
        }

        toast.success(`✅ שחזור המשתמש ${userBackup.userName} הסתיים בהצלחה!`, { id: "userImport" });
        fetchAdminData(); 
      } catch (err) {
        console.error(err);
        toast.error("שגיאה בפענוח קובץ השחזור. ודא שזהו גיבוי משתמש תקין.", { id: "userImport" });
      } finally {
        setIsCalculating(false);
        if (e.target) e.target.value = ""; 
      }
    };
    reader.readAsText(file);
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

  if (isCheckingAuth) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-2xl">בודק הרשאות...</div>;
  if (!user || user.email !== ADMIN_EMAIL) return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white text-center"><h1 className="text-6xl mb-4">⛔</h1><h2 className="text-3xl font-bold text-rose-500 mb-2">גישה נדחתה</h2><Link href="/" className="px-6 py-3 bg-blue-600 rounded-full font-bold mt-4 shadow-lg">חזור למשחק</Link></div>;

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 font-sans" dir="rtl">
      <div className="max-w-6xl mx-auto">
        
        <div className="bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-slate-950 p-6 md:p-8 rounded-3xl border border-slate-800 shadow-2xl mb-8 flex flex-col md:flex-row justify-between items-center gap-4 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 text-center md:text-right">
            <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-2 flex items-center justify-center md:justify-start gap-3">
              <span className="text-white drop-shadow-md">⚙️</span> חדר הבקרה
            </h1>
            <p className="text-slate-400 text-sm font-medium">ברוך הבא לאדמין פאנל. מכאן מנהלים את כל המשחק.</p>
          </div>
          <Link href="/" className="relative z-10 px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl font-bold text-white transition-all shadow-lg flex items-center gap-2">
            חזור למשחק <span>➡️</span>
          </Link>
        </div>

        <div className="mb-6 p-6 bg-slate-900 border border-emerald-500/30 rounded-3xl flex flex-col md:flex-row gap-4 justify-between items-center shadow-xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors pointer-events-none"></div>
          <div className="relative z-10 text-center md:text-right">
             <h2 className="text-xl md:text-2xl font-bold text-emerald-400 mb-1">מנוע חישוב ניקוד 🏆</h2>
             <p className="text-slate-400 text-sm">הזנת תוצאה באדמין? לחץ על הריצת מנוע כדי לעדכן את הטבלאות. שמור תמונת מצב בלילה כדי לייצר מגמות למחר.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto relative z-10">
             <button onClick={() => handleTakeSnapshot()} disabled={isCalculating} className="flex-1 md:flex-none px-6 py-3 rounded-xl font-bold border border-emerald-500/50 text-emerald-400 hover:bg-emerald-900/50 transition-all shadow-sm">
               {isCalculating ? "⏳" : "📸 סוף יום (Snapshot)"}
             </button>
             <button onClick={() => handleCalculateScores()} disabled={isCalculating} className="flex-1 md:flex-none px-8 py-3 rounded-xl font-black shadow-[0_0_15px_rgba(16,185,129,0.3)] bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white transition-all transform active:scale-95">
               {isCalculating ? "⏳" : "🚀 הרץ מנוע ניקוד!"}
             </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-8 bg-slate-900/80 p-2 rounded-2xl border border-slate-800/50 sticky top-4 z-50 backdrop-blur-md shadow-2xl">
          {[
            { id: "SYSTEM", icon: "🛠️", label: "מערכת" }, 
            { id: "MAGAZINE", icon: "📰", label: "טור יומי" },
            { id: "MATCHES", icon: "⚽", label: "משחקים" }, 
            { id: "QUALIFIERS", icon: "🥇", label: "בתים" }, 
            { id: "THIRD_PLACE", icon: "🥉", label: "8 מעפילות" }, 
            { id: "BONUS", icon: "🎁", label: "בונוסים" },
            { id: "USERS", icon: "👥", label: "משתמשים" },
            { id: "STATS", icon: "📊", label: "ראדאר" },
            { id: "PRIZES", icon: "💰", label: "פרסים" },
            { id: "NOTIFICATIONS", icon: "📢", label: "פוש" },
            { id: "BACKUP", icon: "💾", label: "גיבוי" }

          ].map(tab => (
            <button 
               key={tab.id} 
               onClick={() => setActiveTab(tab.id as any)} 
               className={`flex-1 min-w-[90px] sm:min-w-[100px] px-3 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-center text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 shadow-sm ${activeTab === tab.id ? "bg-blue-600 text-white shadow-lg transform scale-[1.02] border border-blue-400" : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700"}`}
            >
              <span className="text-lg mb-0.5 sm:mb-0">{tab.icon}</span> <span>{tab.label}</span>
            </button>
            
          ))}
        </div>

        <div className="bg-slate-900 p-4 md:p-8 rounded-3xl border border-slate-800 shadow-xl min-h-[50vh] animate-fade-in-up">

          {activeTab === "BACKUP" && (
            <div className="space-y-8 max-w-3xl mx-auto">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-3xl border border-blue-500/30 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-400"></div>
                <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2"><span>💾</span> גיבוי נתונים מלא (Export)</h2>
                <p className="text-slate-400 mb-6 text-sm leading-relaxed">הורד קובץ JSON המכיל את כל מסד הנתונים: משתמשים, ניחושים מכל הסוגים, משחקים, הגדרות הטורניר ותוצאות האמת של האדמין. הקובץ מהווה תמונת מצב מדויקת.</p>
                <button onClick={handleExportBackup} disabled={isCalculating} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg w-full md:w-auto text-lg">{isCalculating ? "מייצר קובץ גיבוי... ⏳" : "⬇️ הורד קובץ גיבוי למחשב"}</button>
              </div>

              <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-3xl border border-rose-500/30 shadow-xl mt-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-red-400"></div>
                <h2 className="text-2xl font-bold text-rose-400 mb-2 flex items-center gap-2"><span>⚠️</span> שחזור נתונים מקובץ (Import)</h2>
                <p className="text-slate-400 mb-6 text-sm leading-relaxed">העלה קובץ גיבוי (JSON) ששמרת בעבר באמצעות המערכת. <br/><strong className="text-rose-300">שים לב:</strong> פעולה זו תדרוס לחלוטין את הנתונים הקיימים במערכת עם הנתונים שבקובץ!</p>
                <input type="file" accept=".json" id="import-backup" className="hidden" onChange={handleImportBackup} />
                <label htmlFor="import-backup" className="cursor-pointer bg-rose-600 hover:bg-rose-500 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg inline-block w-full md:w-auto text-center text-lg">{isCalculating ? "קורא קובץ ומשחזר... ⏳" : "📤 העלה קובץ שחזור"}</label>
              </div>
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-3xl border border-teal-500/30 shadow-xl mt-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-emerald-400"></div>
                <h2 className="text-2xl font-bold text-teal-400 mb-2 flex items-center gap-2"><span>🧑‍💻</span> שחזור משתמש ספציפי (Import User)</h2>
                <p className="text-slate-400 mb-6 text-sm leading-relaxed">העלה קובץ גיבוי של משתמש בודד שהורדת דרך טאב המשתמשים. <br/><strong className="text-teal-300">שים לב:</strong> פעולה זו תעדכן ותשחזר רק את הניחושים של משתמש זה מבלי לפגוע בשאר המערכת.</p>
                <input type="file" accept=".json" id="import-user-backup" className="hidden" onChange={handleImportUserBackup} />
                <label htmlFor="import-user-backup" className="cursor-pointer bg-teal-600 hover:bg-teal-500 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg inline-block w-full md:w-auto text-center text-lg">{isCalculating ? "משחזר משתמש... ⏳" : "📤 העלה קובץ שחזור משתמש"}</label>
              </div>
            </div>
          )}

          {activeTab === "SYSTEM" && (
             <AdminSystemTab 
                tournamentState={tournamentState}
                setTournamentState={setTournamentState}
                activeDeadline={activeDeadline}
                setActiveDeadline={setActiveDeadline}
                savingId={savingId}
                isCalculating={isCalculating}
                handleSaveTournamentState={handleSaveTournamentState}
                handleSaveDeadline={handleSaveDeadline}
                handleFactoryReset={handleFactoryReset}
             />
          )}

          {activeTab === "MAGAZINE" && (
             <AdminMagazineTab />
          )}

          {activeTab === "STATS" && (
             <AdminStatsTab 
             matches={matches} 
             bonusQuestions={bonusQuestions} 
             groupsList={groupsList} 
             isCalculating={isCalculating} 
             setIsCalculating={setIsCalculating} 
             statsData={statsData}
             setStatsData={setStatsData}
             />
          )}
          {/* --- הנה הקסם החדש שלנו --- */}
          {activeTab === "NOTIFICATIONS" && (
            <AdminNotificationTab />
          )}
          {activeTab === "USERS" && (
            <AdminUsersTab
             usersList={usersList}
             setUsersList={setUsersList}
             handleUpdateUserName={handleUpdateUserName}
             handleTogglePayment={handleTogglePayment}
             handleExportPredictions={handleExportPredictions}
             handleDeleteUser={handleDeleteUser}
             isCalculating={isCalculating}
             autoInsights={autoInsights}
             handleCreateAutoInsights={handleCreateAutoInsights}
             addInsightToMessage={addInsightToMessage}
             simStage={simStage}
             setSimStage={setSimStage}
             handleSpawnBotsOnly={handleSpawnBotsOnly}
             handleSmartSimulation={handleSmartSimulation}
             // הוספנו פרופ לסנכרון ידני!
             handleRefreshData={fetchAdminData}
             handleExportUserBackup={handleExportUserBackup}
           />
        )}
        {activeTab === "PRIZES" && <AdminPrizesTab />}

          {activeTab === "BONUS" && (
            <AdminBonusTab />
          )}

          {activeTab === "QUALIFIERS" && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {groupsList.map(group => {
                  const teams = Array.from(groupTeams[group] || []);
                  const first = realQualifiers[group]?.first || "";
                  const second = realQualifiers[group]?.second || "";

                  const handleTeamClick = (team: string) => {
                    if (first === team) {
                      setRealQualifiers({...realQualifiers, [group]: { ...realQualifiers[group], first: "" }});
                    } else if (second === team) {
                      setRealQualifiers({...realQualifiers, [group]: { ...realQualifiers[group], second: "" }});
                    } else if (!first) {
                      setRealQualifiers({...realQualifiers, [group]: { ...realQualifiers[group], first: team }});
                    } else if (!second) {
                      setRealQualifiers({...realQualifiers, [group]: { ...realQualifiers[group], second: team }});
                    }
                  };

                  return (
                    <div key={group} className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-lg relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-2 h-full bg-blue-500 group-hover:w-3 transition-all"></div>
                      <h3 className="font-black text-xl text-blue-400 mb-4 border-b border-slate-700/50 pb-2">בית {group}</h3>
                      
                      <div className="flex gap-3 mb-4">
                        <div onClick={() => first && handleTeamClick(first)} className={`flex-1 h-12 rounded-xl flex items-center justify-center font-bold text-sm cursor-pointer transition-colors border-2 ${first ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-slate-900 border-slate-700 text-slate-600 border-dashed'}`}>
                          {first ? <><img src={getFlagUrl(first)!} className="w-5 h-3.5 mr-2 rounded-sm" alt="" />{first}</> : "1️⃣ מקום 1"}
                        </div>
                        <div onClick={() => second && handleTeamClick(second)} className={`flex-1 h-12 rounded-xl flex items-center justify-center font-bold text-sm cursor-pointer transition-colors border-2 ${second ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-600 border-dashed'}`}>
                          {second ? <><img src={getFlagUrl(second)!} className="w-5 h-3.5 mr-2 rounded-sm" alt="" />{second}</> : "2️⃣ מקום 2"}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {teams.map((t: any) => {
                          const isSelected = first === t || second === t;
                          return (
                            <button key={t} onClick={() => handleTeamClick(t)} className={`py-2 px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${isSelected ? 'opacity-30 cursor-not-allowed bg-slate-900 border border-slate-800' : 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 shadow-sm'}`}>
                               {getFlagUrl(t) && <img src={getFlagUrl(t)!} className="w-4 h-3 rounded-sm" alt="" />} {t}
                            </button>
                          )
                        })}
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-700/50 flex justify-end">
                         <button 
                            onClick={handleSaveQualifiers} 
                            className="text-[10px] font-black bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg shadow-md transition-all active:scale-95"
                         >
                            💾 שמור בית {group}
                         </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={handleSaveQualifiers} className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xl shadow-lg transition-all">💾 שמור עולות לכל הבתים</button>
                <button onClick={handleClearQualifiers} className="px-6 py-4 bg-slate-800 text-rose-400 border border-slate-700 hover:border-rose-500 hover:bg-rose-900/20 font-bold rounded-xl transition-all">אפס הכל</button>
              </div>
            </div>
          )}

          {activeTab === "THIRD_PLACE" && (
            <div className="space-y-8">
              <div className="bg-slate-800 p-6 md:p-8 rounded-3xl border border-rose-500/30 shadow-xl relative overflow-hidden group">
                 <div className="absolute top-0 left-0 w-2 h-full bg-rose-500 group-hover:w-3 transition-all"></div>
                 <h2 className="text-2xl font-black text-rose-400 mb-6 flex items-center gap-2"><span>🥉</span> בחר את 8 המעפילות מהמקום ה-3</h2>
                 
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                   {Array.from({length: 8}).map((_, idx) => {
                     const team = realThirdPlace[idx];
                     return (
                       <div key={idx} 
                            onClick={() => {
                              if(team) {
                                const newArr = [...realThirdPlace];
                                newArr[idx] = "";
                                setRealThirdPlace(newArr);
                              }
                            }}
                            className={`h-16 rounded-xl flex items-center justify-center font-bold text-sm cursor-pointer transition-all border-2 ${team ? 'bg-rose-600/20 border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(225,29,72,0.2)]' : 'bg-slate-900 border-slate-700 text-slate-600 border-dashed'}`}>
                         {team ? <div className="flex items-center gap-2">{getFlagUrl(team) && <img src={getFlagUrl(team)!} className="w-6 h-4 rounded-sm" alt="" />} <span className="text-lg">{team}</span></div> : `עולה #${idx + 1}`}
                       </div>
                     );
                   })}
                 </div>
                 <div className="flex flex-col sm:flex-row gap-4">
                    <button onClick={handleSaveThirdPlace} className="flex-1 py-4 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-xl shadow-lg transition-all">💾 שמור 8 מעפילות</button>
                    <button onClick={handleClearThirdPlace} className="px-6 py-4 bg-slate-800 text-rose-400 border border-slate-700 hover:border-rose-500 hover:bg-rose-900/20 font-bold rounded-xl transition-all">אפס הכל</button>
                 </div>
                 <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700 mt-6">
                   <h3 className="text-slate-400 font-bold mb-4 text-sm">מאגר הנבחרות (לחץ כדי להוסיף לעמדה פנויה):</h3>
                   <div className="flex flex-wrap gap-2">
                     {allTeams.map((t: any) => {
                       const isSelected = realThirdPlace.includes(t);
                       return (
                         <button key={t} 
                                 disabled={isSelected || realThirdPlace.filter(x=>x).length >= 8}
                                 onClick={() => {
                                   const emptyIdx = realThirdPlace.findIndex(x => !x);
                                   if (emptyIdx !== -1) {
                                     const newArr = [...realThirdPlace];
                                     newArr[emptyIdx] = t;
                                     setRealThirdPlace(newArr);
                                   }
                                 }}
                                 className={`py-2 px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${isSelected ? 'opacity-20 cursor-not-allowed bg-slate-900' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 hover:border-rose-400'}`}>
                            {getFlagUrl(t) && <img src={getFlagUrl(t)!} className="w-4 h-3 rounded-sm" alt="" />} {t}
                         </button>
                       )
                     })}
                   </div>
                 </div>
              </div>


            </div>
          )}

        {activeTab === "MATCHES" && (
         <AdminMatchesTab 
            matches={matches} 
            isCalculating={isCalculating} 
            handleDeleteAllMatches={handleDeleteAllMatches} 
            handleFileUpload={handleFileUpload} 
            fileInputRef={fileInputRef} 
            handleSaveMatch={handleSaveMatch} 
            handleClearMatch={handleClearMatch} 
            handleUpdateMatchday={handleUpdateMatchday} 
            handleUpdateMatchDate={handleUpdateMatchDate}
            groupsList={groupsList} 
            savingId={savingId}
            handleUpdateMatchDetails={handleUpdateMatchDetails}
            handleDeleteMatch={handleDeleteMatch} 
         />
       )}

        </div>
      </div>
    </div>
  );
}