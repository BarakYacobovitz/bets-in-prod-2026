"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, updateDoc } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import toast from "react-hot-toast";
import { auth, db, messaging } from "../app/firebase";

const ADMIN_EMAIL = "bawak.y10@gmail.com";

const STAGE_NAMES: Record<string, string> = {
  "1": "מחזור 1",
  "2": "מחזור 2",
  "3": "מחזור 3",
  "ko32": "32 הגדולות",
  "ko16": "שמינית גמר",
  "ko8": "רבע גמר",
  "ko4": "חצי גמר",
  "ko2": "הגמר הגדול"
};

const parseDateTimeLocal = (dtStr: any) => {
  if (!dtStr) return 0;
  try {
    if (typeof dtStr === "object" && typeof dtStr.toDate === "function") return dtStr.toDate().getTime();
    if (typeof dtStr === "object" && dtStr.seconds) return dtStr.seconds * 1000;
    if (typeof dtStr === "number") return dtStr;
    
    const str = String(dtStr).trim();

    if (str.includes("/")) {
      const [datePart, timePart] = str.split(" ");
      const [day, month, year] = datePart.split("/");
      const [hour, minute] = (timePart || "00:00").split(":");
      return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)).getTime();
    }

    const safeStr = str.includes("T") ? str : str.replace(" ", "T");
    const timestamp = new Date(safeStr).getTime();
    
    return isNaN(timestamp) ? 0 : timestamp;
  } catch (e) { return 0; }
};

const isMatchOpenForPrediction = (m: any, state: number) => {
  const s = Number(state) || 0;
  if (m.stage !== "KNOCKOUT") {
     const md = Number(m.matchday) || 1;
     if (md === 1) return s === 0;
     if (md === 2) return s === 1;
     if (md === 3) return s === 2;
     return false;
  } else {
     if (m.roundName === "32 הגדולות") return s === 4;
     if (m.roundName === "שמינית גמר") return s === 6;
     if (m.roundName === "רבע גמר") return s === 8;
     if (m.roundName === "חצי גמר") return s === 10;
     if (m.roundName === "גמר" || m.roundName === "מקום שלישי") return s === 12;
     return false;
  }
};

const isQuestionMandatoryNow = (q: any, state: number) => {
  const s = Number(state) || 0;
  
  // 1. שאלות הפתעה
  if (q.isSurprise) {
    const now = Date.now();
    return now >= parseDateTimeLocal(q.openTime) && now <= parseDateTimeLocal(q.closeTime);
  }
  
  // 2. שלב הבתים - דורש שאלות של הטורניר ושל הבתים
  if (s === 0 || (s >= 1 && s <= 3)) return q.phase === "TOURNAMENT" || q.phase === "GROUPS";
  
  // 3. שלב הנוקאאוט
  if (q.phase === "KNOCKOUT") {
    // בדיקה חדשה: אם זו שאלה "כללית" לנוקאאוט (בלי שלב מוגדר), היא חובה רק בסטייט 4 (32 הגדולות)
    if (!q.knockoutRound || q.knockoutRound === "") {
        return s === 4; 
    }
    
    // אם זו שאלת בונוס לשלב ספציפי (למשל "שמינית גמר"), היא חובה רק בסטייט הספציפי שלה
    const rounds: Record<string, number> = { "32 הגדולות": 4, "שמינית גמר": 6, "רבע גמר": 8, "חצי גמר": 10, "גמר": 12 };
    return s === rounds[q.knockoutRound];
  }
  
  return false;
};

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [userName, setUserName] = useState<string>("שחקן אורח");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userPoints, setUserPoints] = useState<number>(0);
  const [photoUrl, setPhotoUrl] = useState<string>("");

  const [targetTime, setTargetTime] = useState<number | null>(null);
  const [timeUnits, setTimeUnits] = useState<{ d: string, h: string, m: string, s: string } | null>(null);
  const [nextNameFull, setNextNameFull] = useState("טרם נקבע");
  const [nextNameShort, setNextNameShort] = useState("לא נקבע");
  const [isNoMoreBets, setIsNoMoreBets] = useState(false);
  
  const [ptsDiff, setPtsDiff] = useState(0);
  const [missingNormalTasks, setMissingNormalTasks] = useState(0);
  const [requiredNormalTasks, setRequiredNormalTasks] = useState(0);
  
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const [nowMs, setNowMs] = useState(Date.now());
  const [liveBonusQs, setLiveBonusQs] = useState<any[]>([]);
  const [liveBonusAns, setLiveBonusAns] = useState<any>({});
  const [activeSurpriseAlert, setActiveSurpriseAlert] = useState<number>(0);
  const [openSurpriseTotal, setOpenSurpriseTotal] = useState<number>(0);

  const [notifPermission, setNotifPermission] = useState<string>("default");

  // 1. שעון פנימי שמתקתק כל שנייה עבור שאלות ההפתעה והשעון המרכזי
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. האזנה למשתמש מחובר
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    }

    let unsubUser: any;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setIsLoggedIn(true);
        setUserId(currentUser.uid);
        setUserEmail(currentUser.email || "");
        setPhotoUrl(currentUser.photoURL || "");

        unsubUser = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserName(data.name || "שחקן אורח");
            setUserPoints(data.totalPoints || 0);
            const prev = data.previousTotalPoints || 0;
            setPtsDiff((data.totalPoints || 0) - prev);
          }
        });
      } else {
        setIsLoggedIn(false);
        setUserId("");
        setUserEmail("");
        setUserName("שחקן אורח");
        setUserPoints(0);
        setPhotoUrl("");
        if (unsubUser) unsubUser();
      }
    });

    return () => { 
       unsubscribe(); 
       if (unsubUser) unsubUser();
    };
  }, []);

  // 3. מנוע האזנה חי למשימות הרגילות (משחקים, בתים, מקום 3 ובונוסים קבועים)
  useEffect(() => {
    if (!userId) {
      setRequiredNormalTasks(0);
      setMissingNormalTasks(0);
      setLiveBonusQs([]);
      setLiveBonusAns({});
      return;
    }

    let currentTState = 0;
    let matchesData: any[] = [];
    let pmData: any[] = [];
    let pkData: any[] = [];
    let pqData: any = {};
    let ptData: any = [];
    let bqData: any[] = [];
    let pbData: any = {};

    const doCalc = () => {
      let required = 0;
      let missing = 0;

      // חישוב משחקים פתוחים
      const userPreds = new Set();
      [...pmData, ...pkData].forEach(d => {
        const hasScores = d.predictedHomeScore !== undefined && d.predictedHomeScore !== "" && 
                          d.predictedAwayScore !== undefined && d.predictedAwayScore !== "";
        if (hasScores) {
          if (d.roundName) { 
            if (d.qualifier && String(d.qualifier).trim() !== "") userPreds.add(d.matchId);
          } else {
            userPreds.add(d.matchId);
          }
        }
      });

      matchesData.forEach((m: any) => {
        if (isMatchOpenForPrediction(m, currentTState)) {
           required++;
           if (!m.isFinished && !userPreds.has(m.id)) missing++;
        }
      });

      // חישוב בונוסים קבועים בלבד
      bqData.forEach((q: any) => {
        if (!q.isSurprise && isQuestionMandatoryNow(q, currentTState)) {
          required++;
          if (!pbData[q.id] || String(pbData[q.id]).trim() === "") missing++;
        }
      });

      // חישוב שלב הבתים ומקום שלישי
      if (currentTState === 0) {
         const groups = Array.from(new Set(matchesData.filter((m: any) => m.stage !== "KNOCKOUT").map((m: any) => m.group))).filter(Boolean);
         required += groups.length; 

         groups.forEach((g: any) => {
            if (!pqData[g]?.first || !pqData[g]?.second) missing++;
         });

         required += 1;
         if (ptData.filter((t: any) => t && String(t).trim() !== "").length < 8) missing++;
      }

      setMissingNormalTasks(missing);
      setRequiredNormalTasks(required);
    };

    // כל מאזין פה מבטיח שטבעת האחוזים קופצת ישר כשמשהו משתנה!
    const unsubSys = onSnapshot(doc(db, "settings", "system"), (snap) => {
      currentTState = snap.exists() ? Number(snap.data().tournamentState) || 0 : 0;
      doCalc();
    });

    const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
      matchesData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      doCalc();
    });

    const unsubPM = onSnapshot(query(collection(db, "predictions_matches"), where("userId", "==", userId)), (snap) => {
      pmData = snap.docs.map(d => d.data());
      doCalc();
    });

    const unsubPK = onSnapshot(query(collection(db, "predictions_knockout"), where("userId", "==", userId)), (snap) => {
      pkData = snap.docs.map(d => d.data());
      doCalc();
    });

    const unsubPQ = onSnapshot(doc(db, "predictions_qualifiers", userId), (snap) => {
      pqData = snap.exists() ? snap.data().groups || {} : {};
      doCalc();
    });

    const unsubPT = onSnapshot(doc(db, "predictions_third_place", userId), (snap) => {
      ptData = snap.exists() ? snap.data().teams || [] : [];
      doCalc();
    });

    const unsubBQ = onSnapshot(doc(db, "settings", "bonus_questions"), (snap) => {
      const q = snap.exists() ? snap.data().questions || [] : [];
      bqData = q;
      setLiveBonusQs(q);
      doCalc();
    });

    const unsubPB = onSnapshot(doc(db, "predictions_bonus", userId), (snap) => {
      const a = snap.exists() ? snap.data().answers || {} : {};
      pbData = a;
      setLiveBonusAns(a);
      doCalc();
    });

    return () => {
      unsubSys(); unsubMatches(); unsubPM(); unsubPK(); unsubPQ(); unsubPT(); unsubBQ(); unsubPB();
    };
  }, [userId]);

  // 4. חישוב חי לשאלות הפתעה שפתוחות כרגע לפי השעון
  useEffect(() => {
     let surpriseCount = 0;
     let openTotal = 0;
     liveBonusQs.forEach((q: any) => {
        if (q.isSurprise && q.openTime && q.closeTime) {
           const openMs = parseDateTimeLocal(q.openTime);
           const closeMs = parseDateTimeLocal(q.closeTime);
           if (nowMs >= openMs && nowMs <= closeMs) {
              openTotal++;
              const ans = liveBonusAns[q.id];
              if (!ans || String(ans).trim() === "") surpriseCount++;
           }
        }
     });
     setActiveSurpriseAlert(surpriseCount);
     setOpenSurpriseTotal(openTotal);
  }, [liveBonusQs, liveBonusAns, nowMs]);

  // 5. שעון העצר המרכזי
  useEffect(() => {
    if (!userId) return; 

    const unsub = onSnapshot(doc(db, "settings", "deadlines"), (snap) => {
      if (snap.exists() && snap.data().activeDeadline) {
         const ad = snap.data().activeDeadline;
         const sName = STAGE_NAMES[ad.stage] || "השלב הבא";
         
         setNextNameFull(`נעילת ${sName}`); 
         setNextNameShort(`נעילת ${sName}`);
         
         if (ad.time) {
            setTargetTime(parseDateTimeLocal(ad.time));
         } else {
            setTargetTime(null);
            setTimeUnits(null);
         }
      } else {
         setTargetTime(null);
         setNextNameFull("לא הוגדר שעון פעיל");
         setNextNameShort("אין נעילה");
         setTimeUnits(null);
      }
    });
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!targetTime) { setIsNoMoreBets(false); setTimeUnits(null); return; }
    const updateTimer = () => {
      const diff = targetTime - Date.now();
      if (diff <= 0) {
        setTimeUnits(null);
        setIsNoMoreBets(true);
      } else {
        setIsNoMoreBets(false);
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        
        setTimeUnits({
           d: d > 0 ? d.toString() : "",
           h: h.toString().padStart(2, '0'),
           m: m.toString().padStart(2, '0'),
           s: s.toString().padStart(2, '0')
        });
      }
    };
    updateTimer(); 
    const intervalId = setInterval(updateTimer, 1000);
    return () => clearInterval(intervalId);
  }, [targetTime]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setShowNotifMenu(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // שילוב המשימות הרגילות ושאלות ההפתעה לקבלת סך כל המשימות
  const totalRequiredTasks = requiredNormalTasks + openSurpriseTotal;
  const missingMatchesToday = missingNormalTasks + activeSurpriseAlert;
  const totalNotifs = missingMatchesToday;

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      try {
        if (totalNotifs > 0) {
          // @ts-ignore
          navigator.setAppBadge(totalNotifs).catch(() => {});
        } else {
          // @ts-ignore
          navigator.clearAppBadge().catch(() => {});
        }
      } catch (e) {}
    }
  }, [totalNotifs]);
  
  useEffect(() => {
  if (typeof window !== "undefined") {
    try {
    const { onMessage } = require("firebase/messaging");

    const setupForegroundMessaging = async () => {
      try {
        const msgInstance = await messaging(); 
        if (msgInstance) {
          onMessage(msgInstance, (payload: any) => {
              console.log("Message received in foreground! ", payload);
              toast(payload.notification?.body || "הודעה חדשה הגיעה!", {
                 icon: '🔔',
                 duration: 5000,
                 style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' }
              });
          });
        }
      } catch (err) {
        console.error("שגיאה בהפעלת מאזין התראות:", err);
      }
    };
    
    setupForegroundMessaging();
    } catch (e) {
        console.warn("מודול התראות לא נטען, ממשיך לרנדר את השעון כרגיל.");
      }
  }
  }, []);

  const handleRequestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      toast.error("הדפדפן לא תומך בהתראות.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      
      if (permission === "granted") {
        toast.success("מאשר מכשיר מול השרת... ⏳");
        
        const msgInstance = await messaging();
        if (msgInstance) {
          const currentToken = await getToken(msgInstance, {
            vapidKey: "BDwmvr6hhuHu4lZg2TLpvfHyftO0h93FEx_q9vEX7HTWgOV3NIR6VC7Jg7jnYM3zvy1zWWf0lE6TGSZ4-yr2Tns"
          });

          if (currentToken && userId) {
            await updateDoc(doc(db, "users", userId), {
              fcmToken: currentToken
            });
            toast.success("התראות הופעלו בהצלחה! 📱🔔");
            
            if ('setAppBadge' in navigator && totalNotifs > 0) {
              // @ts-ignore
              navigator.setAppBadge(totalNotifs).catch(() => {});
            }
          } else {
            toast.error("לא הצלחתי לייצר קוד התראה למכשיר.");
          }
        }
      } else {
        toast.error("התראות נחסמו בהגדרות המכשיר.");
      }
    } catch (error) {
      console.error("שגיאה בבקשת התראות:", error);
      toast.error("שגיאה בהפעלת התראות.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/";
  };

  const navigateToLeaderboard = (e: any) => {
    e.preventDefault();
    if (window.location.pathname === '/') {
       const event = new CustomEvent("changeTab", { detail: "LEADERBOARD" });
       window.dispatchEvent(event);
    } else {
       sessionStorage.setItem("startupTab", "LEADERBOARD");
       window.location.href = "/";
    }
  };
  const navigateToRules = (e: any) => {
    e.preventDefault();
    if (window.location.pathname === '/') {
       const event = new CustomEvent("changeTab", { detail: "RULES" });
       window.dispatchEvent(event);
    } else {
       sessionStorage.setItem("startupTab", "RULES");
       window.location.href = "/";
    }
  };
  const navigateToDashboard = (e: any) => {
    e.preventDefault();
    if (window.location.pathname === '/') {
       const event = new CustomEvent("changeTab", { detail: "DASHBOARD" });
       window.dispatchEvent(event);
    } else {
       sessionStorage.setItem("startupTab", "DASHBOARD");
       window.location.href = "/";
    }
  };

  if (!isLoggedIn) return null;

  return (
    <nav className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 text-white shadow-lg" dir="rtl">
      <div className="max-w-6xl mx-auto px-2 md:px-4 py-2 md:py-3 flex items-center justify-between">
        
        <a href="/" onClick={navigateToDashboard} className="flex items-center gap-2 md:gap-4 group shrink-0" dir="ltr">
          <div className="hidden sm:flex flex-col items-end justify-center">
             <div className="font-black text-2xl md:text-[28px] bg-gradient-to-b from-[#fef08a] via-[#fbbf24] to-[#d97706] bg-clip-text text-transparent leading-none tracking-wide">
                Bets in PROD
             </div>
             <div className="text-[#34d399] font-black text-xs md:text-[13px] tracking-widest mt-1.5">
                מהמרים בייצור
             </div>
          </div>
          <div className="hidden sm:block w-px h-10 md:h-12 bg-slate-700/80"></div>
          <div className="w-8 h-8 md:w-12 md:h-12 flex-shrink-0 group-hover:scale-110 transition-transform">
             <img src="/B.svg" alt="Logo" className="w-full h-full object-contain drop-shadow-lg" />
          </div>
        </a>

        {/* מרכז המסך: השעון ומד האחוזים צמודים */}
        <div className="flex-1 flex justify-center items-center gap-3 md:gap-6 px-1 md:px-2">
          
          {totalRequiredTasks > 0 && (() => {
              const progressPercent = Math.round(((totalRequiredTasks - missingMatchesToday) / totalRequiredTasks) * 100);
              const ringColor = progressPercent === 100 ? 'text-emerald-500' : progressPercent >= 50 ? 'text-amber-500' : 'text-rose-500';
              const textColor = progressPercent === 100 ? 'text-emerald-400' : progressPercent >= 50 ? 'text-amber-400' : 'text-rose-400';
              const dashArray = 100.53; 
              const dashOffset = dashArray - (progressPercent / 100) * dashArray;
              const needsAttention = progressPercent < 50;

              return (
                 <div className="flex flex-col items-center justify-center cursor-default shrink-0" title={`${totalRequiredTasks - missingMatchesToday} מתוך ${totalRequiredTasks} הושלמו`}>
                    <div className={`relative w-10 h-10 md:w-14 md:h-14 flex items-center justify-center drop-shadow-md transition-transform ${needsAttention ? 'animate-pulse drop-shadow-[0_0_8px_rgba(225,29,72,0.6)]' : 'group-hover:scale-105'}`}>
                       <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 40 40">
                          <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3.5" fill="transparent" className="text-slate-800" />
                          <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3.5" fill="transparent"
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                            className={`${ringColor} transition-all duration-1000 ease-out`}
                          />
                       </svg>
                       <span className={`text-[9px] md:text-xs font-black ${textColor}`}>
                          {progressPercent}%
                       </span>
                    </div>
                    <span className="text-[7px] md:text-[9px] text-slate-400 font-bold -mt-0.5 tracking-wider">הושלמו</span>
                 </div>
              );
          })()}

          {targetTime ? (
            <div className={`flex flex-col items-center justify-center px-3 py-1.5 md:px-5 md:py-2 rounded-xl border transition-colors duration-500 shrink-0 ${isNoMoreBets ? 'bg-rose-950/40 border-rose-500/50 shadow-[0_0_10px_rgba(225,29,72,0.2)]' : 'bg-[#0f1115] border-slate-700/60 shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)]'}`}>
               <span className="text-[8px] md:text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-widest">
                 <span className="hidden md:inline">{nextNameFull}</span>
                 <span className="inline md:hidden">{nextNameShort}</span>
               </span>
               
               {isNoMoreBets ? (
                 <span className="text-xs md:text-base font-black text-rose-500 animate-pulse tracking-widest">
                   ננעל! 🔒
                 </span>
               ) : timeUnits ? (
                 <div className="flex items-center gap-1 md:gap-1.5 text-sm md:text-xl font-mono font-black text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.4)]" dir="ltr">
                   {timeUnits.d && timeUnits.d !== "0" && (
                     <>
                       <span>{timeUnits.d.padStart(2, '0')}</span>
                       <span className="opacity-40 animate-pulse">:</span>
                     </>
                   )}
                   <span>{timeUnits.h}</span>
                   <span className="opacity-40 animate-pulse">:</span>
                   <span>{timeUnits.m}</span>
                   <span className="opacity-40 animate-pulse">:</span>
                   <span>{timeUnits.s}</span>
                 </div>
               ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
             <div className="relative" ref={notifRef}>
                <button onClick={() => setShowNotifMenu(!showNotifMenu)} className="relative p-1.5 md:p-2 bg-slate-900 rounded-full border border-slate-700 hover:bg-slate-800 transition-colors">
                   <span className="text-sm md:text-lg">🔔</span>
                   {totalNotifs > 0 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 md:w-4 md:h-4 bg-rose-500 rounded-full text-[8px] md:text-[9px] font-black flex items-center justify-center border border-slate-900 animate-pulse">{totalNotifs}</span>}
                </button>
                {showNotifMenu && (
                   <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in-up p-2">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-2 border-b border-slate-800 pb-2">התראות המערכת</div>
                      
                      {notifPermission === "default" && (
                        <button 
                          onClick={handleRequestNotificationPermission}
                          className="w-full text-[11px] font-black text-white bg-blue-600 hover:bg-blue-500 p-2.5 rounded-xl border border-blue-400 shadow-[0_0_10px_rgba(37,99,235,0.4)] flex items-center justify-center gap-2 mb-2 transition-all active:scale-95"
                        >
                          <span>🔔</span> הפעל התראות במסך הבית
                        </button>
                      )}

                      <div className="flex flex-col gap-1">
                         {ptsDiff > 0 && <div className="text-xs font-bold text-emerald-400 bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-500/20 flex items-center gap-2"><span>📈</span> עלית ב-{ptsDiff} נקודות היום!</div>}
                         {missingNormalTasks > 0 && <div className="text-xs font-bold text-amber-400 bg-amber-950/30 p-2.5 rounded-xl border border-amber-500/20 flex items-center gap-2"><span>⚠️</span> חסר ניחוש ל-{missingNormalTasks} משימות קבועות!</div>}
                         {activeSurpriseAlert > 0 && <div className="text-xs font-bold text-purple-400 bg-purple-950/30 p-2.5 rounded-xl border border-purple-500/20 flex items-center gap-2"><span>🎁</span> יש {activeSurpriseAlert} שאלות הפתעה פתוחות!</div>}
                         {totalNotifs === 0 && ptsDiff <= 0 && <div className="text-xs font-medium text-slate-500 text-center py-4">אין התראות חדשות.</div>}
                      </div>
                   </div>
                )}
             </div>

             <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 p-1 pl-1.5 md:p-1.5 md:pl-4 rounded-full shadow-inner">
                {photoUrl ? (
                  <img src={photoUrl} alt="Profile" className="w-6 h-6 md:w-9 md:h-9 rounded-full border border-slate-600 object-cover" />
                ) : (
                  <div className="w-6 h-6 md:w-9 md:h-9 rounded-full bg-blue-600 flex items-center justify-center text-xs md:text-sm">⚽</div>
                )}
                <div className="text-right hidden md:flex flex-col justify-center">
                  <div className="text-slate-200 font-bold text-sm truncate max-w-[100px]">{userName}</div>
                  <div className="text-amber-400 text-xs font-black">{userPoints} נק'</div>
                </div>
             </div>

             <div className="flex flex-col justify-center gap-1.5 mr-2 md:mr-3">
                {userEmail === ADMIN_EMAIL && (
                  <Link href="/admin" className="text-[10px] md:text-xs bg-emerald-600 text-white font-bold px-3 py-1 md:px-4 md:py-1.5 rounded-lg shadow-sm text-center hover:bg-emerald-500 transition-colors tracking-wide">
                    אדמין
                  </Link>
                )}
                <button onClick={handleLogout} className="text-[10px] md:text-xs bg-slate-800 border border-slate-700 text-rose-400 font-bold px-3 py-1 md:px-4 md:py-1.5 rounded-lg shadow-sm hover:bg-slate-700 hover:text-rose-300 transition-colors tracking-wide">
                  התנתק
                </button>
             </div>
        </div>
      </div>
    </nav>
  );
}