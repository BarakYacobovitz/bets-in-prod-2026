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

const ADMIN_EMAIL = "bawak.y10@gmail.com"; 

export default function AdminPanel() {
  const [user, setUser] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  const [activeTab, setActiveTab] = useState<"SYSTEM" | "USERS" | "MATCHES" | "QUALIFIERS" | "THIRD_PLACE" | "BONUS" | "STATS" | "BACKUP">("SYSTEM");
  
  const [statsData, setStatsData] = useState<any>(null);
  const [selectedStatMatch, setSelectedStatMatch] = useState<string>("");
  const [selectedStatBonus, setSelectedStatBonus] = useState<string>("");
  const [selectedStatGroup, setSelectedStatGroup] = useState<string>("A");
  const [statSpyModal, setStatSpyModal] = useState<{title: string, list: any[], type: "MATCH_DIRECTION" | "NAMES_ONLY"} | null>(null);

  const [adminBonusCategory, setAdminBonusCategory] = useState<string>("TOURNAMENT");
  const [adminKnockoutRound, setAdminKnockoutRound] = useState<string>("ALL");

  const [matches, setMatches] = useState<any[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [autoInsights, setAutoInsights] = useState<string[]>([]);
  
  const [realQualifiers, setRealQualifiers] = useState<any>({});
  const [realThirdPlace, setRealThirdPlace] = useState<string[]>(Array(8).fill(""));
  
  // -- מנגנון הבונוסים החכם: מנצחים, פסולים, מובילים ונעולים --
  const [realBonus, setRealBonus] = useState<any>({}); 
  const [bonusBlacklist, setBonusBlacklist] = useState<any>({}); 
  const [bonusLeading, setBonusLeading] = useState<any>({}); 
  const [bonusLocked, setBonusLocked] = useState<any>({}); 
  const [allUserBonusAnswers, setAllUserBonusAnswers] = useState<any[]>([]); 

  const [tournamentState, setTournamentState] = useState<number>(0);
  const [deadlines, setDeadlines] = useState<any>({});
  const [usersList, setUsersList] = useState<any[]>([]);
  const [dailyMessage, setDailyMessage] = useState("");
  const [dailyMediaUrl, setDailyMediaUrl] = useState("");
  const [dailySubtext, setDailySubtext] = useState(""); 

  const [bonusQuestions, setBonusQuestions] = useState<any[]>([]); 
  const [editingId, setEditingId] = useState<string | null>(null); 
  
  const [newQuestion, setNewQuestion] = useState({ 
    label: "", phase: "TOURNAMENT", round: "ALL", weight: "REGULAR", answerType: "ALL_TEAMS", points: 15, customOptions: [] as string[], liveStatus: "",
    isSurprise: false, openTime: "", closeTime: "", isProximity: false
  });
  const [tempOption, setTempOption] = useState(""); 
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dailyMessageRef = useRef<HTMLTextAreaElement>(null); 

  const [simStage, setSimStage] = useState<string>("MD1");
  const groupsList = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchAdminData = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "matches"));
      const matchesArray: any[] = [];
      querySnapshot.forEach((doc) => matchesArray.push({ id: doc.id, ...doc.data() }));
      matchesArray.sort((a, b) => a.id.localeCompare(b.id));
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
      if (questionsSnap.exists()) setBonusQuestions(questionsSnap.data().questions || []);

      const settingsSnap = await getDoc(doc(db, "settings", "system"));
      if (settingsSnap.exists()) {
        setTournamentState(settingsSnap.data().tournamentState || 0);
        setDeadlines(settingsSnap.data().deadlines || {});
      }

      const dashSnap = await getDoc(doc(db, "settings", "dashboard"));
      if (dashSnap.exists()) {
         setDailyMessage(dashSnap.data().dailyMessage || "");
         setDailyMediaUrl(dashSnap.data().dailyMediaUrl || "");
         setDailySubtext(dashSnap.data().dailySubtext || ""); 
      }

      const usersSnap = await getDocs(collection(db, "users"));
      const usersArray: any[] = [];
      usersSnap.forEach(doc => usersArray.push({ id: doc.id, ...doc.data() }));
      usersArray.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
      setUsersList(usersArray);

    } catch (error) { 
       console.error("שגיאה:", error); 
       toast.error("שגיאה בשליפת נתונים");
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

  const handleSaveDailyMessage = async () => { 
  setSavingId("dashboardMsg"); 
  try { 
    await setDoc(doc(db, "settings", "dashboard"), { dailyMessage, dailyMediaUrl, dailySubtext }, { merge: true }); 
    setTimeout(() => setSavingId(null), 500); 
    toast.success("הטור היומי והמדיה עודכנו בהצלחה!"); 
    } catch (error) { 
    toast.error("שגיאה בשמירת הטור היומי"); 
    setSavingId(null); 
    } 
  };
      
  const insertTagToDailyMessage = (before: string, after: string) => {
    const textarea = dailyMessageRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = dailyMessage;
    const selectedText = text.substring(start, end);
    let newText = text.substring(0, start) + before + selectedText + after + text.substring(end);
    
    if (before === "<hr>" || before === "<br>") {
       newText = text.substring(0, start) + before + text.substring(end);
    }
    
    setDailyMessage(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

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
    setSavingId("system"); 
    try { 
      await setDoc(doc(db, "settings", "system"), { tournamentState }, { merge: true }); 
      setTimeout(() => { setSavingId(null); toast.success("מצב הטורניר עודכן בהצלחה!"); }, 500); 
    } catch (error) { 
      setSavingId(null); 
      toast.error("שגיאה בעדכון מצב טורניר");
    } 
  };

  const handleSaveDeadlines = async () => { 
    setSavingId("deadlines"); 
    try { 
      await setDoc(doc(db, "settings", "system"), { deadlines }, { merge: true }); 
      setTimeout(() => { setSavingId(null); toast.success("מועדי הנעילה עודכנו בהצלחה!"); }, 500); 
    } catch (error) { 
      setSavingId(null);
      toast.error("שגיאה בשמירת מועדי נעילה");
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

  // --- מנגנון הבונוסים החכם: אישור, מוביל זמני, פסילה ונעילה ---
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

  const handleClearLiveStatus = async (qId: string) => {
    const inputEl = document.getElementById(`live_status_${qId}`) as HTMLInputElement;
    if (inputEl) inputEl.value = ""; 
    const updatedQuestions = bonusQuestions.map(q => q.id === qId ? { ...q, liveStatus: "" } : q);
    try { 
      await setDoc(doc(db, "settings", "bonus_questions"), { questions: updatedQuestions }); 
      setBonusQuestions(updatedQuestions); 
      toast.success("סטטוס חי נוקה.");
    } catch (e) { 
      toast.error("שגיאה בניקוי סטטוס חי."); 
    }
  };

  const handleSaveMatch = async (matchId: string, realHome: number, realAway: number, realQualifier: string = "") => { 
    setSavingId(matchId); 
    try { 
      await updateDoc(doc(db, "matches", matchId), { realHomeScore: realHome, realAwayScore: realAway, realQualifier: realQualifier, isFinished: true }); 
      setMatches(matches.map(m => m.id === matchId ? { ...m, realHomeScore: realHome, realAwayScore: realAway, realQualifier, isFinished: true } : m)); 
      setTimeout(() => { setSavingId(null); toast.success("תוצאת משחק נשמרה!"); }, 500); 
    } catch (error) { 
      setSavingId(null); 
      toast.error("שגיאה בשמירת המשחק");
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

      const qualifierPointsMap: any = { "32 הגדולות": 5, "שמינית גמר": 10, "רבע גמר": 15, "חצי גמר": 20, "גמר": 25 };

      for (const currentUser of allUsers) {
        let basePoints = 0; 
        let knockoutPoints = 0; 
        let matchesPoints = 0;
        let groupPoints = 0;
        let thirdPlacePoints = 0;
        let bonusPoints = 0;
        const uid = currentUser.id;

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

        const userThirdData = allUserThirds.find(t => t.userId === uid);
        if (userThirdData) {
          userThirdData.teams.forEach((team: string) => { 
              if (realThird.includes(team) && team !== "") {
                  basePoints += 10; 
                  thirdPlacePoints += 10;
              }
          });
        }

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

        const userBonusData = allUserBonuses.find(b => b.userId === uid);
        if (userBonusData) {
          const userBonus = userBonusData.answers;
          currentBonusQuestions.forEach((q: any) => {
            const truth = realBonusAns[q.id]; const userAnswer = userBonus[q.id];
            if (truth && userAnswer) {
              const truthArray = Array.isArray(truth) ? truth : [truth]; 
              
              if (q.isProximity && q.answerType === "NUMERIC") {
                 const truthNum = Number(truthArray[0]); 
                 const ansNum = Number(userAnswer);
                 if (!isNaN(truthNum) && !isNaN(ansNum)) {
                    const diff = Math.abs(truthNum - ansNum);
                    let proxPts = 0;
                    if (diff === 0) proxPts = q.points; 
                    else if (diff <= 5) proxPts = q.points - 10; 
                    else if (diff <= 10) proxPts = q.points - 20; 
                    else if (diff <= 15) proxPts = q.points - 30; 
                    else if (diff <= 20) proxPts = q.points - 40; 

                    if (proxPts > 0) {
                       basePoints += proxPts;
                       bonusPoints += proxPts;
                    }
                 }
              } 
              else {
                 const isCorrect = truthArray.some((t: any) => t.toString().trim().toLowerCase() === userAnswer.toString().trim().toLowerCase());
                 if (isCorrect) {
                     basePoints += (Number(q.points) || 0); 
                     bonusPoints += (Number(q.points) || 0);
                 }
              }
            }
          });
        }

        const finalTotal = basePoints + knockoutPoints;
        
        await updateDoc(doc(db, "users", uid), { 
            totalPoints: finalTotal, 
            knockoutPoints: knockoutPoints,
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
      updatedUsersArray.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
      setUsersList(updatedUsersArray);
      
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
        if (!matchStatsMap[mId]) matchStatsMap[mId] = { total: 0, homeWins: [], awayWins: [], draws: [], exactScores: {} };
        matchStatsMap[mId].total++;
        
        const h = Number(pred.predictedHomeScore); const a = Number(pred.predictedAwayScore);
        const userObj = { name: userName, home: h, away: a, time: timeStr }; 

        if (h > a) matchStatsMap[mId].homeWins.push(userObj);
        else if (a > h) matchStatsMap[mId].awayWins.push(userObj);
        else matchStatsMap[mId].draws.push(userObj);

        const exact = `${h}-${a}`;
        if (!matchStatsMap[mId].exactScores[exact]) matchStatsMap[mId].exactScores[exact] = { count: 0, users: [] };
        matchStatsMap[mId].exactScores[exact].count++;
        matchStatsMap[mId].exactScores[exact].users.push({ name: userName, time: timeStr }); 
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

  const addInsightToMessage = (text: string) => {
    const htmlBullet = `<ul>\n  <li>${text}</li>\n</ul>\n`;
    setDailyMessage(prev => prev + htmlBullet);
    toast.success("התובנה נוספה לטור היומי!");
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
         matchesToResolve = matches.filter(m => m.stage === "KNOCKOUT" && (m.roundName === "חצי גמר" || m.roundName === "מקום שלישי"));
         nextState = 12;
      } else if (simStage === "FINAL") {
         matchesToResolve = matches.filter(m => m.stage === "KNOCKOUT" && m.roundName === "גמר");
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
        if (!confirm("⚠️ אזהרה חמורה: פעולה זו תדרוס את כל הנתונים הקיימים במערכת עם הנתונים שבקובץ. האם להמשיך?")) return;
        setIsCalculating(true);
        
        for (const [collName, docs] of Object.entries(backup)) {
          for (const [docId, data] of Object.entries(docs as any)) {
            await setDoc(doc(db, collName, docId), data);
          }
        }
        toast.success("✅ שחזור מסד הנתונים הסתיים בהצלחה! מרענן דף...");
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
         await deleteDoc(doc(db, "matches", match.id)); 
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

      const qualifierPointsMap: any = { "32 הגדולות": 5, "שמינית גמר": 10, "רבע גמר": 15, "חצי גמר": 20, "גמר": 25 };

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
                     
                     if (q.isProximity && q.answerType === "NUMERIC") {
                        const truthNum = Number(truthArray[0]); 
                        const ansNum = Number(ans);
                        if (!isNaN(truthNum) && !isNaN(ansNum)) {
                           const diff = Math.abs(truthNum - ansNum);
                           let proxPts = 0;
                           if (diff === 0) proxPts = q.points; 
                           else if (diff <= 5) proxPts = q.points - 10; 
                           else if (diff <= 10) proxPts = q.points - 20; 
                           else if (diff <= 15) proxPts = q.points - 30; 
                           else if (diff <= 20) proxPts = q.points - 40; 
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
  
  const renderProgressBar = (label: string, count: number, total: number, colorClass: string, onClickAction: () => void) => {
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <div className="mb-4 cursor-pointer group" onClick={onClickAction}>
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
             <button onClick={handleTakeSnapshot} disabled={isCalculating} className="flex-1 md:flex-none px-6 py-3 rounded-xl font-bold border border-emerald-500/50 text-emerald-400 hover:bg-emerald-900/50 transition-all shadow-sm">
               {isCalculating ? "⏳" : "📸 סוף יום (Snapshot)"}
             </button>
             <button onClick={() => handleCalculateScores()} disabled={isCalculating} className="flex-1 md:flex-none px-8 py-3 rounded-xl font-black shadow-[0_0_15px_rgba(16,185,129,0.3)] bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white transition-all transform active:scale-95">
               {isCalculating ? "⏳" : "🚀 הרץ מנוע ניקוד!"}
             </button>
          </div>
        </div>

        <div className="flex gap-2 mb-8 bg-slate-900/60 p-2 rounded-2xl border border-slate-800 overflow-x-auto custom-scrollbar shadow-inner">
          {[
            { id: "SYSTEM", label: "⏱️ שעון המערכת" }, 
            { id: "USERS", label: "👥 משתמשים" },
            { id: "MATCHES", label: "⚽ משחקים" }, 
            { id: "QUALIFIERS", label: "🥇 בתים" }, 
            { id: "THIRD_PLACE", label: "🥉 8 מעפילות" }, 
            { id: "BONUS", label: "⭐ בונוסים" },
            { id: "STATS", label: "📊 ראדאר" },
            { id: "BACKUP", label: "💾 גיבוי" }
          ].map(tab => (
            <button 
               key={tab.id} 
               onClick={() => setActiveTab(tab.id as any)} 
               className={`px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all flex-1 text-center text-sm md:text-base ${activeTab === tab.id ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg transform scale-[1.02] border border-blue-500/50" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-slate-900 p-4 md:p-8 rounded-3xl border border-slate-800 shadow-xl min-h-[50vh]">

          {activeTab === "BACKUP" && (
            <div className="space-y-8 max-w-3xl mx-auto animate-fade-in-up">
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
            </div>
          )}

        {activeTab === "SYSTEM" && (
         <AdminSystemTab 
            tournamentState={tournamentState}
            setTournamentState={setTournamentState}
            deadlines={deadlines}
            setDeadlines={setDeadlines}
            savingId={savingId}
            isCalculating={isCalculating}
            handleSaveTournamentState={handleSaveTournamentState}
            handleSaveDeadlines={handleSaveDeadlines}
            handleFactoryReset={handleFactoryReset}
         />
       )}

          {activeTab === "STATS" && (
            <div className="space-y-8 relative animate-fade-in-up">
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
                                 {renderProgressBar(match?.homeTeam || "קבוצת בית", stats.homeWins.length, stats.total, "bg-blue-500", () => { if(stats.homeWins.length>0) setStatSpyModal({ title: `הימרו על ${match?.homeTeam}`, list: stats.homeWins, type: "MATCH_DIRECTION" })})}
                                 {renderProgressBar("תיקו", stats.draws.length, stats.total, "bg-slate-400", () => { if(stats.draws.length>0) setStatSpyModal({ title: `הימרו על תיקו`, list: stats.draws, type: "MATCH_DIRECTION" })})}
                                 {renderProgressBar(match?.awayTeam || "קבוצת חוץ", stats.awayWins.length, stats.total, "bg-emerald-500", () => { if(stats.awayWins.length>0) setStatSpyModal({ title: `הימרו על ${match?.awayTeam}`, list: stats.awayWins, type: "MATCH_DIRECTION" })})}
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
                      <h3 className="text-xl md:text-2xl font-black text-amber-400 mb-6 border-b border-slate-700 pb-3">⭐ שאלות בונוס</h3>
                      <select value={selectedStatBonus} onChange={(e) => setSelectedStatBonus(e.target.value)} className="w-full bg-slate-900 text-amber-300 font-bold p-3.5 rounded-xl border border-slate-600 mb-6 outline-none shadow-inner cursor-pointer">
                        {bonusQuestions.map(q => (<option key={q.id} value={q.id}>{q.label}</option>))}
                      </select>
                      {statsData.bonuses[selectedStatBonus] ? (
                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 shadow-inner max-h-[300px] overflow-y-auto custom-scrollbar pr-2 space-y-2">
                          {Object.entries(statsData.bonuses[selectedStatBonus].answers).sort(([,a]:any, [,b]:any) => b.count - a.count).map(([answer, data]: any, idx) => {
                              return renderProgressBar(answer, data.count, statsData.bonuses[selectedStatBonus].total, idx === 0 ? "bg-amber-500" : "bg-slate-500", () => setStatSpyModal({ title: `הימרו על: ${answer}`, list: data.users, type: "NAMES_ONLY" }));
                          })}
                        </div>
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
            </div>
          )}
          
          {activeTab === "USERS" && (
            
            <div className="space-y-8 max-w-4xl mx-auto animate-fade-in-up">
              
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-3xl border border-emerald-500/30 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-blue-400 to-emerald-500"></div>
                <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-2"><span>📰</span> עריכת המהדורה המרכזית (Rich Text)</h2>
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">השתמש בכפתורים כדי להוסיף עיצוב, תמונות וגיפים! משתמשים יראו את זה בלייב בכתבת המגזין שבדאשבורד.</p>
                
                <div className="flex flex-wrap gap-2 mb-0 bg-slate-950 p-3 rounded-t-xl border border-b-0 border-slate-700 items-center shadow-inner">
                  <button onClick={() => insertTagToDailyMessage('<b>', '</b>')} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border border-slate-600"><b>B</b> מודגש</button>
                  <button onClick={() => insertTagToDailyMessage('<i>', '</i>')} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border border-slate-600"><i>I</i> נטוי</button>
                  <button onClick={() => insertTagToDailyMessage('<u>', '</u>')} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border border-slate-600"><u>U</u> קו תחתון</button>
                  
                  <div className="w-px h-6 bg-slate-700 mx-1 self-center"></div>
                  
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700 shadow-inner">
                    <button onClick={() => insertTagToDailyMessage('<div style="text-align: right;">\n', '\n</div>')} className="px-2 py-1 hover:bg-slate-800 rounded text-sm transition-colors text-slate-300" title="יישור לימין">▶️</button>
                    <button onClick={() => insertTagToDailyMessage('<div style="text-align: center;">\n', '\n</div>')} className="px-2 py-1 hover:bg-slate-800 rounded text-sm transition-colors text-slate-300" title="יישור למרכז">⏸️</button>
                    <button onClick={() => insertTagToDailyMessage('<div style="text-align: left;">\n', '\n</div>')} className="px-2 py-1 hover:bg-slate-800 rounded text-sm transition-colors text-slate-300" title="יישור לשמאל">◀️</button>
                  </div>
                  
                  <div className="w-px h-6 bg-slate-700 mx-1 self-center"></div>
                  
                  <button onClick={() => insertTagToDailyMessage('<h2>', '</h2>')} className="bg-slate-800 hover:bg-slate-700 text-blue-300 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border border-slate-600">📝 כותרת גדולה</button>
                  <button onClick={() => insertTagToDailyMessage('<h3>', '</h3>')} className="bg-slate-800 hover:bg-slate-700 text-emerald-300 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border border-slate-600">📝 תת-כותרת</button>
                  
                  <div className="w-px h-6 bg-slate-700 mx-1 self-center"></div>
                  
                  <button onClick={() => insertTagToDailyMessage('<blockquote>', '</blockquote>')} className="bg-slate-800 hover:bg-slate-700 text-emerald-300 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border border-slate-600">❝ ציטוט</button>
                  
                  <div className="w-px h-6 bg-slate-700 mx-1 self-center"></div>
                  
                  <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-lg border border-slate-700 shadow-inner">
                    <span className="text-[10px] text-slate-500 font-bold px-1 uppercase">מרקר:</span>
                    <button onClick={() => insertTagToDailyMessage('<mark class="yellow">', '</mark>')} className="w-5 h-5 rounded-md bg-amber-500/80 hover:bg-amber-400 border border-amber-600 transition-colors shadow-sm" title="צהוב"></button>
                    <button onClick={() => insertTagToDailyMessage('<mark class="green">', '</mark>')} className="w-5 h-5 rounded-md bg-emerald-500/80 hover:bg-emerald-400 border border-emerald-600 transition-colors shadow-sm" title="ירוק"></button>
                    <button onClick={() => insertTagToDailyMessage('<mark class="blue">', '</mark>')} className="w-5 h-5 rounded-md bg-blue-500/80 hover:bg-blue-400 border border-blue-600 transition-colors shadow-sm" title="כחול"></button>
                    <button onClick={() => insertTagToDailyMessage('<mark class="red">', '</mark>')} className="w-5 h-5 rounded-md bg-rose-500/80 hover:bg-rose-400 border border-rose-600 transition-colors shadow-sm" title="אדום"></button>
                  </div>

                  <div className="w-px h-6 bg-slate-700 mx-1 self-center"></div>
                  <button onClick={() => insertTagToDailyMessage('<ul>\n  <li>', '</li>\n</ul>')} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border border-slate-600">📑 רשימה</button>
                  <button onClick={() => insertTagToDailyMessage('<hr>\n', '')} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border border-slate-600">➖ קו הפרדה</button>
                  <div className="w-px h-6 bg-slate-700 mx-1 self-center"></div>
                  <button onClick={() => insertTagToDailyMessage('<img src="', '" />')} className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">🖼️ תמונה/גיף</button>
                  <button onClick={() => insertTagToDailyMessage('<a href="', '" target="_blank">טקסט ללחיצה</a>')} className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">🔗 קישור</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                   <div className="flex flex-col gap-1">
                      <label className="text-blue-400 text-xs font-bold px-1">🖼️ לינק למדיה (תמונה/וידאו):</label>
                      <input 
                        type="text" 
                        value={dailyMediaUrl} 
                        onChange={(e) => setDailyMediaUrl(e.target.value)}
                        placeholder="https://... (jpg, mp4, gif)"
                        className="bg-slate-950 text-white p-3 rounded-xl border border-slate-700 focus:border-blue-500 outline-none text-sm"
                      />
                   </div>
                   <div className="flex flex-col gap-1">
                      <label className="text-emerald-400 text-xs font-bold px-1">📝 תקציר / כותרת משנה (מופיע בכרטיסייה):</label>
                      <input 
                        type="text" 
                        value={dailySubtext} 
                        onChange={(e) => setDailySubtext(e.target.value)}
                        placeholder="הודעות מהנהלת הטורניר, עדכונים חמים..."
                        className="bg-slate-950 text-white p-3 rounded-xl border border-slate-700 focus:border-emerald-500 outline-none text-sm"
                      />
                   </div>
                </div>
                <textarea 
                  ref={dailyMessageRef}
                  value={dailyMessage} 
                  onChange={e => setDailyMessage(e.target.value)} 
                  className="w-full bg-slate-950 text-slate-300 p-5 rounded-b-xl border border-slate-700 focus:border-emerald-500 min-h-[200px] outline-none font-mono text-sm leading-relaxed shadow-inner" 
                  placeholder="כתוב את הטור היומי כאן... אפשר להיעזר בכפתורים למעלה." 
                />
                
                <button onClick={handleSaveDailyMessage} className="mt-5 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 px-6 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] text-lg active:scale-95">
                  {savingId === "dashboardMsg" ? "שומר ומשדר... ⏳" : "💾 פרסם את המהדורה בלייב"}
                </button>

                <div className="mt-8 border-t border-slate-700 pt-6">
                   <h4 className="text-slate-500 text-sm font-bold mb-4 flex items-center gap-2 uppercase tracking-widest"><span>👀</span> תצוגה מקדימה למשתמשים:</h4>
                   
                   <div className="bg-slate-900 rounded-3xl border border-slate-700 shadow-xl overflow-hidden flex flex-col max-w-2xl mx-auto">
                      <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center">
                         <div className="flex items-center gap-3">
                            <span className="text-2xl">📰</span>
                            <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">המהדורה המרכזית</h2>
                         </div>
                         <div className="text-slate-500 text-sm font-medium">{new Date().toLocaleDateString('he-IL')}</div>
                      </div>
                      <div className="p-6 md:p-8">
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
                              dangerouslySetInnerHTML={{ __html: dailyMessage || "<span class='text-slate-600 font-medium'>השורות שלך יופיעו כאן...</span>" }} />
                      </div>
                   </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-indigo-900/40 to-slate-800 p-8 rounded-3xl border border-indigo-500/30 shadow-xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-700 pb-4">
                  <div>
                    <h2 className="text-2xl font-black text-indigo-400 flex items-center gap-2"><span>🔮</span> מחולל Wall of Fame / Shame</h2>
                    <p className="text-slate-400 text-sm mt-1">המערכת קוראת את הראדאר ובוחרת ניחושים קיצוניים או קונצנזוסים.</p>
                  </div>
                  <button onClick={handleCreateAutoInsights} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center gap-2">
                    {statsData ? "🔄 רענן תובנות מהראדאר" : "🔍 חלץ תובנות עכשיו"}
                  </button>
                </div>
                
                {autoInsights.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {autoInsights.map((insight, idx) => (
                      <div key={idx} className="bg-slate-900/80 border border-slate-700 p-4 rounded-2xl flex justify-between items-center gap-4 group hover:border-indigo-500/50 hover:bg-slate-800 transition-colors shadow-sm">
                        <span className="text-slate-200 text-sm font-medium leading-relaxed">{insight}</span>
                        <button onClick={() => addInsightToMessage(insight)} className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap opacity-0 group-hover:opacity-100 flex items-center gap-1">
                          <span>➕</span> הוסף לטור
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm bg-slate-900/50 p-6 rounded-2xl border border-dashed border-slate-700 text-center">
                     לחץ על הכפתור כדי לנתח את הסטטיסטיקות ולמצוא את הניחושים הכי מעניינים להיום.
                  </div>
                )}
              </div> 

              <div className="bg-slate-800 p-8 rounded-3xl border border-blue-500/30 shadow-xl mt-8">
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-700 pb-6">
                  <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-2"><span>👥</span> ניהול שחקנים (ותשלומים)</h2>
                    <p className="text-slate-400 text-sm mt-1">רשימת כל השחקנים במערכת עם שליטה בסטטוס התשלום שלהם.</p>
                  </div>
                  <button onClick={() => handleExportPredictions("ALL", "All")} disabled={isCalculating} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-2 active:scale-95">
                    <span>⬇️</span> הורד יומן ניחושים שטוח (CSV)
                  </button>
                </div>
                
                <div className="bg-purple-900/10 p-5 rounded-2xl border border-purple-500/30 mb-8 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 shadow-inner">
                  <div>
                    <h3 className="text-purple-400 font-black flex items-center gap-2 mb-1 text-lg"><span>🤖</span> מעבדת סימולציות (הזרקת בוטים)</h3>
                    <p className="text-slate-400 text-sm">הזרק משתמשים פיקטיביים עם ניחושים אקראיים כדי למלא את הטבלה ולבדוק את האפליקציה.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full">
                     <select value={simStage} onChange={(e) => setSimStage(e.target.value)} className="bg-slate-950 text-white p-3 rounded-xl border border-purple-500/50 outline-none font-bold text-sm flex-1 xl:flex-none shadow-sm cursor-pointer">
                        <option value="BOTS_ONLY">🤖 בוטים בלבד (ללא תוצאות אמת)</option>
                        <option value="MD1">סמלץ מחזור 1 (תוצאות אמת)</option>
                        <option value="MD2">סמלץ מחזור 2</option>
                        <option value="MD3">סמלץ מחזור 3 + עולות</option>
                        <option value="R32">סמלץ 32 הגדולות</option>
                        <option value="R16">סמלץ שמינית גמר</option>
                        <option value="QF">סמלץ רבע גמר</option>
                        <option value="SF">סמלץ חצי גמר</option>
                        <option value="FINAL">סמלץ גמר הטורניר</option>
                        <option value="ALL">סמלץ טורניר שלם (בוטים + הכל)</option>
                     </select>
                     <button 
                       onClick={() => {
                         if (simStage === "BOTS_ONLY") handleSpawnBotsOnly();
                         else handleSmartSimulation();
                       }} 
                       disabled={isCalculating} 
                       className="py-3 px-8 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl transition-all shadow-lg text-sm whitespace-nowrap active:scale-95"
                     >
                       {isCalculating ? "מריץ... ⏳" : "🧪 הפעל"}
                     </button>
                  </div>
                </div>

                <div className="w-full overflow-x-auto bg-slate-950 rounded-2xl border border-slate-700 shadow-inner custom-scrollbar">
                  <table className="w-full text-right text-slate-300 min-w-[600px]">
                    <thead className="text-xs uppercase tracking-widest bg-slate-900/80 text-slate-500 border-b border-slate-800">
                      <tr>
                        <th className="p-4 font-black">שם משתמש</th>
                        <th className="p-4 font-black">אימייל</th>
                        <th className="p-4 text-center font-black">נק'</th>
                        <th className="p-4 text-center font-black">תשלום</th>
                        <th className="p-4 text-center font-black">פעולות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList.length === 0 ? (<tr><td colSpan={5} className="p-12 text-center text-slate-500 font-bold">אין משתמשים במערכת.</td></tr>) : (
                        usersList.map((u, idx) => (
                          <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                            <td className="p-4 font-bold text-white flex items-center gap-2 min-w-[220px]">
    <span className="text-slate-600 text-xs w-4">{idx + 1}.</span> 
    <input 
      type="text" 
      value={u.name || ""} 
      onChange={(e) => setUsersList(usersList.map(user => user.id === u.id ? { ...user, name: e.target.value } : user))}
      className="bg-slate-900 border border-slate-700 text-white px-2 py-1.5 rounded-lg focus:border-blue-500 outline-none text-sm w-full transition-all shadow-inner"
      placeholder="הכנס שם בעברית..."
    />
    <button 
      onClick={() => handleUpdateUserName(u.id, u.name)}
      className="bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white p-1.5 rounded-lg border border-slate-700 shadow-sm transition-all active:scale-95 shrink-0"
      title="שמור שם"
    >
      💾
    </button>
  </td>
                            <td className="p-4 text-sm text-slate-400 font-mono">{u.email}</td>
                            <td className="p-4 text-center font-black text-amber-400 text-lg">{u.totalPoints || 0}</td>
                            
                            <td className="p-4">
                              <div className="flex justify-center">
                                <button onClick={() => handleTogglePayment(u.id, u.hasPaid)} className={`px-4 py-1.5 rounded-lg font-bold text-xs w-24 transition-colors border shadow-sm ${u.hasPaid ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"}`}>
                                  {u.hasPaid ? "✅ שולם" : "❌ חוב"}
                                </button>
                              </div>
                            </td>
                            
                            <td className="p-4">
                              <div className="flex justify-center gap-2">
                                <button onClick={() => handleExportPredictions(u.id, u.name || "ללא שם")} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 w-9 h-9 rounded-lg transition-colors flex items-center justify-center text-sm shadow-sm" title="הורד ניחושים אישיים">⬇️</button>
                                <button onClick={() => handleDeleteUser(u.id, u.name || "ללא שם")} className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 w-9 h-9 rounded-lg transition-colors flex items-center justify-center text-sm shadow-sm" title="מחק משתמש לצמיתות">🗑️</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "BONUS" && (
            <div className="space-y-12">
              
              <div className="bg-slate-800 p-6 rounded-3xl border border-amber-500/30 shadow-lg transition-all relative">
                <h2 className="text-2xl font-bold text-amber-400 mb-6 flex items-center gap-2"><span>{editingId ? "✏️" : "⚙️"}</span> {editingId ? "עריכת שאלת בונוס" : "בונה שאלות הבונוס (מפעל)"}</h2>
                <div className={`bg-slate-900/50 p-6 rounded-xl border transition-colors ${editingId ? "border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]" : "border-slate-700"}`}>
                  <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <div className="flex-grow"><label className="text-slate-400 text-sm mb-1 block">תוכן השאלה</label><input type="text" value={newQuestion.label} onChange={e => setNewQuestion({...newQuestion, label: e.target.value})} className="w-full bg-slate-950 text-white p-3 rounded-lg border border-slate-600 focus:border-amber-500 outline-none" /></div>
                    <div className="w-full md:w-32"><label className="text-slate-400 text-sm mb-1 block">ניקוד בסיס</label><input type="number" min="0" value={newQuestion.points} onChange={e => setNewQuestion({...newQuestion, points: Number(e.target.value)})} className="w-full bg-slate-950 text-white p-3 rounded-lg text-center text-amber-500 font-bold outline-none" /></div>
                  </div>
                  
                  <div className="flex flex-wrap gap-6 mb-6 p-4 bg-slate-950 rounded-xl border border-slate-700">
                    <label className="flex items-center gap-2 text-purple-400 font-bold cursor-pointer hover:text-purple-300">
                       <input type="checkbox" checked={newQuestion.isSurprise} onChange={e => setNewQuestion({...newQuestion, isSurprise: e.target.checked})} className="w-5 h-5 accent-purple-500 cursor-pointer" />
                       🎁 שאלת הפתעה מתוזמנת
                    </label>
                    {newQuestion.answerType === "NUMERIC" && (
                       <label className="flex items-center gap-2 text-orange-400 font-bold cursor-pointer hover:text-orange-300">
                          <input type="checkbox" checked={newQuestion.isProximity} onChange={e => setNewQuestion({...newQuestion, isProximity: e.target.checked})} className="w-5 h-5 accent-orange-500 cursor-pointer" />
                          🤪 "בעל הבית השתגע" (ניקוד לפי קרבה)
                       </label>
                    )}
                  </div>

                  {newQuestion.isSurprise && (
                     <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg animate-fade-in-up">
                         <div className="flex-1"><label className="text-purple-300 text-xs font-bold mb-1 block">מתי השאלה תופיע למשתמשים?</label><input type="datetime-local" value={newQuestion.openTime} onChange={e => setNewQuestion({...newQuestion, openTime: e.target.value})} className="w-full bg-slate-900 text-white p-3 rounded-lg border border-purple-500/50 outline-none" /></div>
                         <div className="flex-1"><label className="text-purple-300 text-xs font-bold mb-1 block">מתי השאלה תינעל לעריכה?</label><input type="datetime-local" value={newQuestion.closeTime} onChange={e => setNewQuestion({...newQuestion, closeTime: e.target.value})} className="w-full bg-slate-900 text-white p-3 rounded-lg border border-purple-500/50 outline-none" /></div>
                     </div>
                  )}

                  <div className="mb-4">
                    <label className="text-slate-400 text-sm mb-1 block">סטטוס חי (אופציונלי - מופיע כעדכון לייב למשתמשים)</label>
                    <input type="text" value={newQuestion.liveStatus || ""} onChange={e => setNewQuestion({...newQuestion, liveStatus: e.target.value})} className="w-full bg-slate-950 text-white p-3 rounded-lg border border-slate-600 focus:border-amber-500 outline-none" placeholder="לדוגמה: מסי (2), אמבפה (1)..." />
                  </div>

                  <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <div className="flex-1"><label className="text-slate-400 text-sm mb-1 block">שלב בטורניר</label><select value={newQuestion.phase} onChange={e => setNewQuestion({...newQuestion, phase: e.target.value})} className="w-full bg-slate-950 text-white p-3 rounded-lg"><option value="TOURNAMENT">🏆 כל הטורניר</option><option value="GROUPS">⚽ שלב הבתים</option><option value="KNOCKOUT">🔥 נוק-אאוט</option></select></div>
                    {newQuestion.phase === "KNOCKOUT" && <div className="flex-1"><label className="text-slate-400 text-sm mb-1 block">סיבוב</label><select value={newQuestion.round} onChange={e => setNewQuestion({...newQuestion, round: e.target.value})} className="w-full bg-slate-950 text-white p-3 rounded-lg"><option value="ALL">כל שלבי הנוקאאוט</option><option value="R32">32 הגדולות</option><option value="R16">שמינית גמר</option><option value="QF">רבע גמר</option><option value="SF">חצי גמר</option><option value="FINAL">גמר</option></select></div>}
                    <div className="flex-1"><label className="text-slate-400 text-sm mb-1 block">משקל השאלה</label><select value={newQuestion.weight} onChange={e => setNewQuestion({...newQuestion, weight: e.target.value})} className="w-full bg-slate-950 text-white p-3 rounded-lg"><option value="REGULAR">רגילה</option><option value="DOUBLE">כפולה</option><option value="SURPRISE">הפתעה</option></select></div>
                  </div>
                  <div className="mb-4">
                    <label className="text-slate-400 text-sm mb-1 block">סוג התשובה</label>
                    <select value={newQuestion.answerType} onChange={e => setNewQuestion({...newQuestion, answerType: e.target.value, customOptions: []})} className="w-full bg-slate-950 text-white p-3 rounded-lg"><option value="ALL_TEAMS">🏳️ בחירה מכל הנבחרות</option><option value="TEAM_SUBSET">🎯 בחירה מנבחרות ספציפיות</option><option value="OPEN_TEXT">✍️ טקסט חופשי (מתאים לשחקנים)</option><option value="MULTIPLE_CHOICE">🆚 בחירה מרובה / ראש-בראש</option><option value="NUMERIC">🔢 תשובה מספרית</option></select>
                  </div>
                  {newQuestion.answerType !== "NUMERIC" && (
                    <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-700/50 mb-4">
                      {newQuestion.answerType === "TEAM_SUBSET" && (<div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar mb-3">{allTeams.map((t: any) => <button key={t} onClick={() => { if(!newQuestion.customOptions.includes(t)) setNewQuestion(prev => ({...prev, customOptions: [...prev.customOptions, t]})) }} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded">+ {t}</button>)}</div>)}
                      <div className="flex flex-col sm:flex-row gap-2 mb-4 mt-2 items-center">
                        <input type="text" value={tempOption} onChange={e => setTempOption(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCustomOption()} placeholder="הוסף אפשרות ידנית..." className="w-full bg-slate-900 text-white p-3 rounded-xl border border-slate-600 outline-none" />
                        <button onClick={handleAddCustomOption} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold w-full sm:w-auto whitespace-nowrap">הוסף</button>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        {newQuestion.customOptions.map((opt, i) => <div key={i} className="flex items-center gap-2 bg-slate-800 border border-slate-600 px-3 py-1 rounded-full text-sm text-white"><span>{opt}</span><button onClick={() => handleRemoveCustomOption(opt)} className="text-rose-400 font-bold hover:text-rose-300">×</button></div>)}
                        {newQuestion.customOptions.length > 0 && <button onClick={() => setNewQuestion(prev => ({...prev, customOptions: []}))} className="text-xs text-rose-400 hover:text-rose-300 underline mt-1">נקה רשימה</button>}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-4 mt-2">
                    <button onClick={handleSaveQuestion} className={`flex-grow h-12 text-white font-bold rounded-lg transition-all ${editingId ? "bg-emerald-600 hover:bg-emerald-500" : "bg-amber-600 hover:bg-amber-500"}`}>{editingId ? "💾 שמור שינויים בשאלה" : "➕ הוסף שאלה למפעל"}</button>
                    {editingId && <button onClick={handleCancelEdit} className="h-12 px-6 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-all">❌ ביטול</button>}
                  </div>
                </div>
              </div>

              <div className="w-full h-px bg-slate-700 my-8"></div>

              <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <h2 className="text-xl md:text-2xl font-bold text-white">🎯 ניהול שאלות והזנת תוצאות אמת</h2>
                  <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={handleSaveBonus} className="flex-1 md:flex-none px-4 md:px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-colors text-sm md:text-base">שמור תוצאות ופסילות 💾</button>
                    <button onClick={handleClearBonus} className="px-4 py-3 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 font-bold rounded-xl transition-colors shrink-0" title="אפס את כל התשובות">🗑️</button>
                  </div>
                </div>

                <div className="flex overflow-x-auto gap-3 mb-4 pb-2 custom-scrollbar">
                  {[
                    { id: "TOURNAMENT", label: "🏆 כל הטורניר" },
                    { id: "GROUPS", label: "⚽ שלב הבתים" },
                    { id: "KNOCKOUT", label: "🔥 נוק-אאוט" }
                  ].map(tab => (
                    <button 
                      key={tab.id} 
                      onClick={() => { setAdminBonusCategory(tab.id); if(tab.id !== "KNOCKOUT") setAdminKnockoutRound("ALL"); }} 
                      className={`px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all border ${
                        adminBonusCategory === tab.id 
                          ? "bg-amber-500 text-slate-900 border-amber-400 shadow-lg" 
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-amber-400"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {adminBonusCategory === "KNOCKOUT" && (
                  <div className="flex overflow-x-auto gap-2 mb-8 pb-2 custom-scrollbar bg-slate-900/50 p-2 rounded-2xl border border-slate-800/50">
                    {[
                      { id: "ALL", label: "כללי (כל הנוק-אאוט)" },
                      { id: "R32", label: "32 הגדולות" },
                      { id: "R16", label: "שמינית גמר" },
                      { id: "QF", label: "רבע גמר" },
                      { id: "SF", label: "חצי גמר" },
                      { id: "FINAL", label: "גמר" }
                    ].map(subTab => (
                      <button
                        key={subTab.id}
                        onClick={() => setAdminKnockoutRound(subTab.id)}
                        className={`px-4 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-sm border ${
                          adminKnockoutRound === subTab.id
                            ? "bg-purple-600 text-white border-purple-500 shadow-md"
                            : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white"
                        }`}
                      >
                        {subTab.label}
                      </button>
                    ))}
                  </div>
                )}

                {(() => {
                  const filteredAdminQuestions = bonusQuestions.filter(q => {
                    if (q.phase !== adminBonusCategory) return false;
                    if (adminBonusCategory === "KNOCKOUT") return q.round === adminKnockoutRound;
                    return true;
                  });

                  const adminRegularQs = filteredAdminQuestions.filter(q => q.weight === "REGULAR" && !q.isSurprise);
                  const adminDoubleQs = filteredAdminQuestions.filter(q => q.weight === "DOUBLE" && !q.isSurprise);
                  const adminSurpriseQs = filteredAdminQuestions.filter(q => q.isSurprise);

                  const renderAdminTruthCard = (q: any) => {
                    const uniqueAnswersData = getUniqueAnswers(q.id); 
                    const isLocked = bonusLocked[q.id] || false;
                    const winners = realBonus[q.id] || [];
                    const losers = bonusBlacklist[q.id] || [];
                    const leaders = bonusLeading[q.id] || [];

                    return (
                      <div key={q.id} className={`p-5 rounded-2xl border border-t-4 flex flex-col justify-between shadow-lg transition-colors ${isLocked ? "bg-rose-950/20 border-rose-500/50 border-t-rose-600" : "bg-slate-900 border-slate-700 border-t-amber-500 hover:border-slate-600"}`}>
                        <div className="flex justify-between items-start mb-4 gap-4">
                           <label className="text-white font-bold leading-snug">{q.label}</label>
                           <div className="flex gap-2 shrink-0">
                              <button onClick={() => handleEditClick(q)} className="text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-600 border border-blue-500/30 px-2 py-1 rounded text-xs font-bold transition-colors">✏️ ערוך</button>
                              <button onClick={() => handleDeleteQuestion(q.id)} className="text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 px-2 py-1 rounded text-xs font-bold transition-colors">🗑️</button>
                           </div>
                        </div>

                        {/* סטטוס חי ונעילה */}
                        <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 mb-4 shadow-inner flex flex-col gap-3">
                           <div>
                              <label className="text-slate-500 text-xs mb-2 font-bold flex items-center gap-1"><span>📡</span> סטטוס לייב (למשתמשים):</label>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <input type="text" id={`live_status_${q.id}`} defaultValue={q.liveStatus || ""} className="flex-grow bg-slate-900 text-slate-300 p-2 rounded-lg border border-slate-700 focus:border-blue-500 outline-none text-sm w-full" placeholder="אמבפה (4), אנגליה דקה 4..." />
                                <div className="flex gap-2 w-full sm:w-auto shrink-0">
                                  <button onClick={() => handleQuickLiveStatusSave(q.id)} className="flex-1 sm:flex-none bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 px-3 py-2 rounded-lg text-sm font-bold transition-all">לשדר</button>
                                </div>
                              </div>
                           </div>
                           <button onClick={() => handleToggleBonusLock(q.id)} className={`w-full py-2 rounded-lg font-bold text-xs transition-all border ${isLocked ? "bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-[0_0_10px_rgba(225,29,72,0.3)]" : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border-slate-700"}`}>
                              {isLocked ? "🔓 שחרר נעילת שאלה" : "🔒 נעל שאלה סופית (כולם טעו)"}
                           </button>
                        </div>
                        
                        {/* רשימת ניחושי הקהל המרכזית */}
                        <div className="mb-4">
                           <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 border-b border-slate-800 pb-1">ניחושי הקהל:</div>
                           {uniqueAnswersData.length === 0 ? (
                              <div className="text-xs text-slate-600 text-center py-2">אף אחד לא ענה עדיין.</div>
                           ) : (
                              <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                                 {uniqueAnswersData.map(([ansStr, count]: any) => {
                                    const isWinner = winners.includes(ansStr);
                                    const isLeading = leaders.includes(ansStr);
                                    const isLoser = losers.includes(ansStr) || (isLocked && !isWinner); 

                                    let badgeColor = "bg-slate-800 text-slate-300 border-slate-700";
                                    if (isWinner) badgeColor = "bg-emerald-600/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.2)]";
                                    else if (isLeading) badgeColor = "bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.3)] animate-pulse";
                                    else if (isLoser) badgeColor = "bg-rose-900/40 text-rose-400/50 border-rose-500/20 line-through decoration-rose-500/50";

                                    return (
                                       <div key={ansStr} className={`flex flex-col items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-bold transition-all ${badgeColor}`}>
                                          <div className="flex items-center gap-1">
                                             {getFlagUrl(ansStr) && <img src={getFlagUrl(ansStr)!} className="w-3 h-2 object-cover rounded-sm opacity-80" alt="flag" />}
                                             <span className="truncate max-w-[100px]" title={ansStr}>{ansStr}</span>
                                             <span className="text-[9px] opacity-60">({count})</span>
                                          </div>
                                          {/* כפתורי השליטה - כעת עם כתר! */}
                                          {!isLocked && (
                                             <div className="flex gap-1 border-t border-slate-700/30 pt-1 w-full justify-center">
                                                <button onClick={() => handleToggleBonusWinner(q.id, ansStr)} title="פגיעה בול!" className={`w-5 h-5 rounded flex items-center justify-center ${isWinner ? 'bg-emerald-500 text-white' : 'bg-slate-700 hover:bg-emerald-500/50 text-slate-400'}`}>✅</button>
                                                <button onClick={() => handleToggleBonusLeading(q.id, ansStr)} title="מוביל זמני" className={`w-5 h-5 rounded flex items-center justify-center ${isLeading ? 'bg-amber-500 text-white' : 'bg-slate-700 hover:bg-amber-500/50 text-slate-400'}`}>👑</button>
                                                <button onClick={() => handleToggleBonusBlacklist(q.id, ansStr)} title="פסול תשובה זו" className={`w-5 h-5 rounded flex items-center justify-center ${losers.includes(ansStr) ? 'bg-rose-500 text-white' : 'bg-slate-700 hover:bg-rose-500/50 text-slate-400'}`}>❌</button>
                                             </div>
                                          )}
                                       </div>
                                    )
                                 })}
                              </div>
                           )}
                        </div>

                       {/* גיבוי - הוספת תשובה חופשית שאיש לא ענה */}
                       <div className="mt-auto border-t border-slate-800 pt-3">
                          <div className="flex flex-col sm:flex-row gap-2">
                             <input type="text" id={`manual_truth_${q.id}`} className="flex-grow w-full bg-slate-950 text-white p-2 rounded-lg border border-slate-700 focus:border-amber-500 outline-none text-xs" placeholder="הכנס תשובה שלא ברשימה..." onKeyDown={(e) => { if (e.key === 'Enter') { handleToggleBonusWinner(q.id, e.currentTarget.value); e.currentTarget.value = ''; } }} />
                             <button onClick={() => { const inp = document.getElementById(`manual_truth_${q.id}`) as HTMLInputElement; handleToggleBonusWinner(q.id, inp.value); inp.value = ''; }} className="bg-slate-700 hover:bg-slate-600 text-white w-full sm:w-auto px-3 py-2 rounded-lg text-xs font-bold shrink-0 transition-colors">סמן ✅</button>
                          </div>
                       </div>

                      </div>
                    );
                  };

                  if (filteredAdminQuestions.length === 0) {
                    return <div className="text-slate-500 text-center py-16 bg-slate-900/50 rounded-2xl border border-dashed border-slate-700 font-bold text-lg">אין שאלות בקטגוריה זו.</div>;
                  }

                  return (
                    <div className="space-y-10 mt-6">
                       {adminRegularQs.length > 0 && (
                          <div>
                            <h3 className="text-xl font-bold text-blue-400 mb-4 border-b border-slate-700 pb-3 flex items-center gap-2"><span>🎯</span> שאלות רגילות</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{adminRegularQs.map(renderAdminTruthCard)}</div>
                          </div>
                       )}
                       {adminDoubleQs.length > 0 && (
                          <div>
                            <h3 className="text-xl font-bold text-rose-400 mb-4 border-b border-slate-700 pb-3 flex items-center gap-2"><span>🔥</span> שאלות דאבל-בונוס</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{adminDoubleQs.map(renderAdminTruthCard)}</div>
                          </div>
                       )}
                       {adminSurpriseQs.length > 0 && (
                          <div>
                            <h3 className="text-xl font-bold text-purple-400 mb-4 border-b border-slate-700 pb-3 flex items-center gap-2"><span>🎁</span> שאלות הפתעה</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{adminSurpriseQs.map(renderAdminTruthCard)}</div>
                          </div>
                       )}
                    </div>
                  );
                })()}

              </div>
            </div>
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
         />
       )}

        </div>
      </div>
    </div>
  );
}