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

const parseDateTimeLocal = (dtStr: string) => {
  if (!dtStr) return 0;
  try {
    // קודם ננסה פיענוח טבעי ואמין של הדפדפן
    const timestamp = new Date(dtStr).getTime();
    if (!isNaN(timestamp)) return timestamp;

    // גיבוי למקרה של תאריכים בפורמט T במכשירים בעייתיים
    if (dtStr.includes("T")) {
      const [datePart, timePart] = dtStr.split("T");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hour, minute] = timePart.split(":").map(Number);
      return new Date(year, month - 1, day, hour, minute || 0).getTime();
    }
    return 0;
  } catch { return 0; }
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

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [userName, setUserName] = useState<string>("שחקן אורח");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userPoints, setUserPoints] = useState<number>(0);
  const [photoUrl, setPhotoUrl] = useState<string>("");

  const [targetTime, setTargetTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState("--:--:--");
  const [nextNameFull, setNextNameFull] = useState("טרם נקבע");
  const [nextNameShort, setNextNameShort] = useState("לא נקבע");
  const [isNoMoreBets, setIsNoMoreBets] = useState(false);
  
  const [ptsDiff, setPtsDiff] = useState(0);
  const [missingMatchesToday, setMissingMatchesToday] = useState(0);
  
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const [nowMs, setNowMs] = useState(Date.now());
  const [liveBonusQs, setLiveBonusQs] = useState<any[]>([]);
  const [liveBonusAns, setLiveBonusAns] = useState<any>({});
  const [activeSurpriseAlert, setActiveSurpriseAlert] = useState<number>(0);

  const [notifPermission, setNotifPermission] = useState<string>("default");

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    }

    let unsubUser: any;
    let unsubMatches: any;
    let unsubKnockout: any;

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

        const calculateMissing = async () => {
          try {
            const sysSnap = await getDoc(doc(db, "settings", "system"));
            const currentTState = sysSnap.exists() ? Number(sysSnap.data().tournamentState) || 0 : 0;

            const mSnap = await getDocs(collection(db, "matches"));
            const pmSnap = await getDocs(query(collection(db, "predictions_matches"), where("userId", "==", currentUser.uid)));
            const pkSnap = await getDocs(query(collection(db, "predictions_knockout"), where("userId", "==", currentUser.uid)));

            const userPreds = new Set();
            [...pmSnap.docs, ...pkSnap.docs].forEach(d => {
              const data = d.data();
              const hasScores = data.predictedHomeScore !== undefined && data.predictedHomeScore !== "" && 
                                data.predictedAwayScore !== undefined && data.predictedAwayScore !== "";
              
              if (hasScores) {
                if (data.roundName) { 
                  if (data.qualifier && String(data.qualifier).trim() !== "") userPreds.add(data.matchId);
                } else {
                  userPreds.add(data.matchId);
                }
              }
            });

            let missing = 0;
            mSnap.docs.forEach(d => {
              const m = d.data();
              if (!m.isFinished && !userPreds.has(d.id) && isMatchOpenForPrediction(m, currentTState)) {
                missing++;
              }
            });
            setMissingMatchesToday(missing);
          } catch (e) { console.error(e); }
        };

        unsubMatches = onSnapshot(query(collection(db, "predictions_matches"), where("userId", "==", currentUser.uid)), calculateMissing);
        unsubKnockout = onSnapshot(query(collection(db, "predictions_knockout"), where("userId", "==", currentUser.uid)), calculateMissing);
        
        calculateMissing();

      } else {
        setIsLoggedIn(false);
        setUserId("");
        setUserEmail("");
        setUserName("שחקן אורח");
        setUserPoints(0);
        setPhotoUrl("");
        if (unsubUser) unsubUser();
        if (unsubMatches) unsubMatches();
        if (unsubKnockout) unsubKnockout();
      }
    });

    return () => { 
       unsubscribe(); 
       if (unsubUser) unsubUser();
       if (unsubMatches) unsubMatches();
       if (unsubKnockout) unsubKnockout();
    };
  }, []);

  useEffect(() => {
     const unsub1 = onSnapshot(doc(db, "settings", "bonus_questions"), (snap) => {
        if(snap.exists()) setLiveBonusQs(snap.data().questions || []);
     });
     return () => unsub1();
  }, []);

  useEffect(() => {
     if(!userId) return;
     const unsub2 = onSnapshot(doc(db, "predictions_bonus", userId), (snap) => {
        if(snap.exists()) setLiveBonusAns(snap.data().answers || {});
     });
     return () => unsub2();
  }, [userId]);

  useEffect(() => {
     let surpriseCount = 0;
     liveBonusQs.forEach((q: any) => {
        if (q.isSurprise && q.openTime && q.closeTime) {
           const openMs = parseDateTimeLocal(q.openTime);
           const closeMs = parseDateTimeLocal(q.closeTime);
           if (nowMs >= openMs && nowMs <= closeMs) {
              const ans = liveBonusAns[q.id];
              if (!ans || String(ans).trim() === "") surpriseCount++;
           }
        }
     });
     setActiveSurpriseAlert(surpriseCount);
  }, [liveBonusQs, liveBonusAns, nowMs]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "deadlines"), (snap) => {
      if (snap.exists() && snap.data().activeDeadline) {
         const ad = snap.data().activeDeadline;
         const sName = STAGE_NAMES[ad.stage] || "השלב הבא";
         
         setNextNameFull(`הניחושים ל-${sName} יינעלו בעוד:`);
         setNextNameShort(`נעילת ${sName}:`);
         
         if (ad.time) {
            setTargetTime(parseDateTimeLocal(ad.time));
         } else {
            setTargetTime(null);
            setTimeLeft("לא נקבע");
         }
      } else {
         setTargetTime(null);
         setNextNameFull("לא הוגדר שעון פעיל");
         setNextNameShort("אין נעילה קרובה");
         setTimeLeft("--:--:--");
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!targetTime) { setIsNoMoreBets(false); return; }
    const updateTimer = () => {
      const diff = targetTime - Date.now();
      if (diff <= 0) {
        setTimeLeft("הזמן תם! ננעל.");
        setIsNoMoreBets(true);
      } else {
        setIsNoMoreBets(false);
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        if (d > 0) setTimeLeft(`${d} ימים, ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        else setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
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

  useEffect(() => {
    const totalNotifs = missingMatchesToday + activeSurpriseAlert;
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
  }, [missingMatchesToday, activeSurpriseAlert]);
  
  useEffect(() => {
  if (typeof window !== "undefined") {
    try {
    const { onMessage } = require("firebase/messaging");

    const setupForegroundMessaging = async () => {
      try {
        // אנחנו משתמשים ב-messaging שייבאת בשורה 9
        const msgInstance = await messaging(); 
        if (msgInstance) {
          onMessage(msgInstance, (payload: any) => {
              console.log("Message received in foreground! ", payload);toast(payload.notification?.body || "הודעה חדשה הגיעה!", {
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
            // 👇 הדבק כאן את מפתח ה-VAPID האמיתי שלך מה-Firebase Console 👇
            vapidKey: "BDwmvr6hhuHu4lZg2TLpvfHyftO0h93FEx_q9vEX7HTWgOV3NIR6VC7Jg7jnYM3zvy1zWWf0lE6TGSZ4-yr2Tns"
            
          });

          if (currentToken && userId) {
            await updateDoc(doc(db, "users", userId), {
              fcmToken: currentToken
            });
            toast.success("התראות הופעלו בהצלחה! 📱🔔");
            
            const total = missingMatchesToday + activeSurpriseAlert;
            if ('setAppBadge' in navigator && total > 0) {
              // @ts-ignore
              navigator.setAppBadge(total).catch(() => {});
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

  const totalNotifs = missingMatchesToday + activeSurpriseAlert;
  if (!isLoggedIn) return null;

  return (
    <nav className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 text-white shadow-lg" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        
        <Link href="/" className="flex items-center gap-3 md:gap-4 group" dir="ltr">
          <div className="hidden sm:flex flex-col items-end justify-center">
             <div className="font-black text-2xl md:text-[28px] bg-gradient-to-b from-[#fef08a] via-[#fbbf24] to-[#d97706] bg-clip-text text-transparent leading-none tracking-wide">
                Bets in PROD
             </div>
             <div className="text-[#34d399] font-black text-xs md:text-[13px] tracking-widest mt-1.5">
                מהמרים בייצור
             </div>
          </div>
          <div className="hidden sm:block w-px h-10 md:h-12 bg-slate-700/80"></div>
          <div className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0 group-hover:scale-110 transition-transform">
             <img src="/B.svg" alt="Logo" className="w-full h-full object-contain drop-shadow-lg" />
          </div>
        </Link>

        <div className="flex-1 flex justify-center px-2">
          <div className={`flex flex-col items-center justify-center px-4 py-1.5 rounded-xl border transition-colors duration-500 ${isNoMoreBets ? 'bg-rose-950/40 border-rose-500/50 shadow-[0_0_10px_rgba(225,29,72,0.2)]' : 'bg-slate-900 border-slate-700 shadow-inner'}`}>
             <span className="text-[10px] md:text-xs font-bold text-slate-400">
               <span className="hidden md:inline">{nextNameFull}</span>
               <span className="inline md:hidden">{nextNameShort}</span>
             </span>
             <span className={`text-sm md:text-lg font-black font-mono tracking-wider ${isNoMoreBets ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`}>
               {timeLeft}
             </span>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
             <div className="relative" ref={notifRef}>
                <button onClick={() => setShowNotifMenu(!showNotifMenu)} className="relative p-2 bg-slate-900 rounded-full border border-slate-700 hover:bg-slate-800 transition-colors">
                   <span className="text-lg">🔔</span>
                   {totalNotifs > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-[9px] font-black flex items-center justify-center border border-slate-900 animate-pulse">{totalNotifs}</span>}
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
                         {missingMatchesToday > 0 && <div className="text-xs font-bold text-amber-400 bg-amber-950/30 p-2.5 rounded-xl border border-amber-500/20 flex items-center gap-2"><span>⚠️</span> חסר ניחוש ל-{missingMatchesToday} משימות פתוחות!</div>}
                         {activeSurpriseAlert > 0 && <div className="text-xs font-bold text-purple-400 bg-purple-950/30 p-2.5 rounded-xl border border-purple-500/20 flex items-center gap-2"><span>🎁</span> יש {activeSurpriseAlert} שאלות הפתעה פתוחות!</div>}
                         {totalNotifs === 0 && ptsDiff <= 0 && <div className="text-xs font-medium text-slate-500 text-center py-4">אין התראות חדשות.</div>}
                      </div>
                   </div>
                )}
             </div>

             <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 p-1 pl-2 md:p-1.5 md:pl-4 rounded-full shadow-inner">
                {photoUrl ? (
                  <img src={photoUrl} alt="Profile" className="w-7 h-7 md:w-9 md:h-9 rounded-full border border-slate-600 object-cover" />
                ) : (
                  <div className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm">⚽</div>
                )}
                <div className="text-right hidden md:flex flex-col justify-center">
                  <div className="text-slate-200 font-bold text-sm truncate max-w-[100px]">{userName}</div>
                  <div className="text-amber-400 text-xs font-black">{userPoints} נק'</div>
                </div>
             </div>

             <div className="flex flex-col gap-1">
                {/* --- כפתור החוקים החדש הוסף כאן --- */}
                <Link href="/rules" className="text-[10px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded shadow-sm text-center hover:bg-blue-500 transition-colors cursor-pointer flex items-center justify-center gap-1">
                  חוקים 📜
                </Link>
                
                {userEmail === ADMIN_EMAIL ? (
                  <Link href="/admin" className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded shadow-sm text-center hover:bg-emerald-500 transition-colors">אדמין</Link>
                ) : (
                  <a href="/" onClick={navigateToLeaderboard} className="text-[10px] bg-amber-600 text-slate-900 font-black px-2 py-0.5 rounded shadow-sm text-center hover:bg-amber-500 transition-colors cursor-pointer flex items-center justify-center gap-1">
                    לוח תוצאות 🏆
                  </a>
                )}
                <button onClick={handleLogout} className="text-[10px] bg-slate-800 text-rose-400 font-bold px-2 py-0.5 rounded shadow-sm hover:bg-slate-700 transition-colors">התנתק</button>
             </div>
        </div>
      </div>
    </nav>
  );
}