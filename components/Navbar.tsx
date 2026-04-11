"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../app/firebase";
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [userName, setUserName] = useState<string>("שחקן אורח");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userPoints, setUserPoints] = useState<number>(0);
  const [photoUrl, setPhotoUrl] = useState<string>("");

  const [deadlines, setDeadlines] = useState<any>({});
  const [timeLeft, setTimeLeft] = useState("--:--:--");
  const [nextNameFull, setNextNameFull] = useState("טרם נקבע");
  const [nextNameShort, setNextNameShort] = useState("לא נקבע");
  const [isNoMoreBets, setIsNoMoreBets] = useState(false);
  
  const [ptsDiff, setPtsDiff] = useState(0);
  const [missingMatchesToday, setMissingMatchesToday] = useState(0);
  const [activeSurpriseAlert, setActiveSurpriseAlert] = useState<number>(0);
  
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [hasViewedNotifs, setHasViewedNotifs] = useState(false);
  const [userCleared, setUserCleared] = useState(false); // סטייט חדש לניקוי ידני של ההתראות

  const notifMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setShowNotifMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let unsubscribeUser: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsLoggedIn(true);
        setUserId(user.uid);
        setUserEmail(user.email || "");
        setPhotoUrl(user.photoURL || "");
        
        unsubscribeUser = onSnapshot(doc(db, "users", user.uid), (userDoc) => {
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserName(data.name || "שחקן");
            setUserPoints(data.totalPoints || 0);
            
            const newPtsDiff = (data.totalPoints || 0) - (data.previousTotalPoints || data.totalPoints || 0);
            
            if (newPtsDiff !== ptsDiff) {
               setPtsDiff(newPtsDiff);
               setHasViewedNotifs(false); 
               setUserCleared(false); // מדליק מחדש אם יש משהו חדש
            }
          }
        });
      } else {
        setIsLoggedIn(false);
        setUserId("");
        if (unsubscribeUser) unsubscribeUser();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, [ptsDiff]);

  useEffect(() => {
    if (!userId) return;
    const unsubSys = onSnapshot(doc(db, "settings", "system"), (docSnap) => {
      if (docSnap.exists()) setDeadlines(docSnap.data().deadlines || {});
    });
    return () => unsubSys();
  }, [userId]);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const dls = [
        { name: "מחזור 1", short: "מ1", time: new Date(deadlines.md1 || "").getTime() },
        { name: "מחזור 2", short: "מ2", time: new Date(deadlines.md2 || "").getTime() },
        { name: "מחזור 3", short: "מ3", time: new Date(deadlines.md3 || "").getTime() },
        { name: "שלב הבא (נוקאאוט)", short: "נוקאאוט", time: new Date(deadlines.knockout || "").getTime() }
      ];
      
      const futureDls = dls.filter(d => !isNaN(d.time) && d.time > now).sort((a,b) => a.time - b.time);
      const allEmpty = !deadlines.md1 && !deadlines.md2 && !deadlines.md3 && !deadlines.knockout;

      if (futureDls.length > 0) {
        setIsNoMoreBets(false);
        const target = futureDls[0];
        setNextNameFull(target.name);
        setNextNameShort(target.short);
        
        const diff = target.time - now;
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / 1000 / 60) % 60);
        const s = Math.floor((diff / 1000) % 60);
        
        if (d > 0) setTimeLeft(`${d}ימ ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        else setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      } else if (allEmpty) {
        setIsNoMoreBets(false);
        setNextNameFull("טרם נקבע מועד");
        setNextNameShort("טרם נקבע");
        setTimeLeft("--:--:--");
      } else {
        setIsNoMoreBets(true);
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [deadlines]);

  useEffect(() => {
    if (!userId) return;

    const fetchNotifs = async () => {
      try {
        const mSnap = await getDocs(collection(db, "matches"));
        const matches = mSnap.docs.map(d=>({id: d.id, ...d.data()}));

        const bqSnap = await getDoc(doc(db, "settings", "bonus_questions"));
        const bonusQuestions = bqSnap.exists() ? bqSnap.data().questions : [];

        const pbSnap = await getDoc(doc(db, "predictions_bonus", userId));
        const userBonusAnswers = pbSnap.exists() ? pbSnap.data().answers || {} : {};

        const pmSnap = await getDocs(query(collection(db, "predictions_matches"), where("userId", "==", userId)));
        const userMatchPreds: any = {};
        pmSnap.forEach(d => { userMatchPreds[d.data().matchId] = d.data(); });

        const now = new Date();
        
        let missingMatches = 0;
        matches.forEach((m: any) => {
           if (!m.isFinished && m.matchDate && m.stage !== "KNOCKOUT") {
              const [d, t] = m.matchDate.split(" ");
              if(d) {
                 const [day, month, year] = d.split("/");
                 if (now.getDate() === Number(day) && now.getMonth() === Number(month) - 1 && now.getFullYear() === Number(year)) {
                    const pred = userMatchPreds[m.id];
                    if (!pred || pred.predictedHomeScore === "") missingMatches++;
                 }
              }
           }
        });

        if (missingMatches > missingMatchesToday) {
           setHasViewedNotifs(false);
           setUserCleared(false);
        }
        setMissingMatchesToday(missingMatches);

        let surprises = 0;
        const nowMs = now.getTime();
        bonusQuestions.forEach((q: any) => {
           if (q.isSurprise && q.openTime && q.closeTime) {
             const openMs = new Date(q.openTime).getTime();
             const closeMs = new Date(q.closeTime).getTime();
             if (nowMs >= openMs && nowMs <= closeMs) {
                const hasAnswered = userBonusAnswers[q.id] && userBonusAnswers[q.id].toString().trim() !== "";
                if (!hasAnswered) surprises++;
             }
           }
        });

        if (surprises > activeSurpriseAlert) {
           setHasViewedNotifs(false);
           setUserCleared(false);
        }
        setActiveSurpriseAlert(surprises);

      } catch (e) { console.error(e); }
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 60000); 
    return () => clearInterval(interval);
  }, [userId, missingMatchesToday, activeSurpriseAlert]);

  const handleLogout = () => {
    if (confirm("בטוח שברצונך להתנתק?")) {
      signOut(auth);
    }
  };

  const handleToggleNotifMenu = () => {
    setShowNotifMenu(!showNotifMenu);
    if (!showNotifMenu) {
       setHasViewedNotifs(true);
    }
  };

  if (!isLoggedIn) return null;

  const realNotifsCount = (ptsDiff > 0 ? 1 : 0) + (missingMatchesToday > 0 ? 1 : 0) + (activeSurpriseAlert > 0 ? 1 : 0);
  const totalNotifs = userCleared ? 0 : realNotifsCount;
  
  const shouldShowBadge = totalNotifs > 0 && !hasViewedNotifs;

  return (
    <nav className="w-full bg-slate-950 border-b border-slate-800 p-2 md:p-3 shadow-[0_4px_20px_rgba(0,0,0,0.5)] sticky top-0 z-50" dir="rtl">
      <div className="max-w-7xl mx-auto flex justify-between items-center gap-2">
        
        {/* צד ימין: הלוגו */}
        <a href="/" className="group flex items-center gap-2 md:gap-3 transition-all duration-300 hover:opacity-90 cursor-pointer shrink-0">
          <div className="w-10 h-10 md:w-16 md:h-16 flex items-center justify-center shrink-0">
            <img src="/B.svg" alt="Logo" className="w-full h-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] group-hover:drop-shadow-[0_0_15px_rgba(253,224,71,0.4)] transition-all duration-500" />
          </div>
          <div className="hidden lg:flex flex-col justify-center border-r border-white/10 pr-5">
             <span className="font-black text-[28px] tracking-tight leading-none bg-gradient-to-br from-amber-100 via-yellow-400 to-amber-600 bg-clip-text text-transparent drop-shadow-sm pb-1">Bets in PROD</span>
             <span className="text-emerald-400/90 font-bold text-sm tracking-[0.15em] mt-0.5">מהמרים בייצור</span>
          </div>
        </a>
        
        {/* מרכז: השעון או הודעת No More Bets */}
        <div className="flex-1 flex justify-center items-center px-1">
           {isNoMoreBets ? (
             <div className="flex items-center justify-center text-rose-300 font-bold bg-rose-500/10 px-3 py-1.5 md:px-5 md:py-2 rounded-lg md:rounded-xl border border-rose-500/30 shadow-sm shrink-0 min-w-[70px]">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <span className="text-xs md:text-base">🛑</span> 
                  <span className="text-[10px] md:text-sm tracking-wide hidden sm:inline">No More Bets! בהצלחה 🤞</span>
                  <span className="text-[10px] md:text-sm tracking-wide sm:hidden">No More Bets! 🤞</span>
                </div>
             </div>
           ) : (
             <div className="flex flex-col md:flex-row items-center justify-center text-amber-400 font-bold bg-amber-500/10 px-2 py-1 md:px-4 md:py-1.5 rounded-lg md:rounded-xl border border-amber-500/20 shadow-sm shrink-0 min-w-[70px]">
                <div className="flex items-center gap-1 md:gap-2">
                  <span className="text-[10px] md:text-sm animate-pulse">⏳</span> 
                  <span className="text-[9px] md:text-xs truncate hidden sm:inline">{nextNameFull}:</span>
                  <span className="text-[9px] md:text-xs truncate sm:hidden">{nextNameShort}:</span>
                </div>
                <span className="font-mono tracking-widest text-[11px] md:text-sm leading-none mt-0.5 md:mt-0 md:mr-1" dir="ltr">{timeLeft}</span>
             </div>
           )}
        </div>

        {/* צד שמאל: פעמון + פרופיל + יציאה */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
           
           <div className="relative shrink-0" ref={notifMenuRef}>
              <button 
                onClick={handleToggleNotifMenu}
                className={`w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center text-lg md:text-xl transition-all shadow-sm ${showNotifMenu ? "bg-slate-700 border-slate-500" : "bg-slate-800 hover:bg-slate-700 border-slate-700"} border relative`}
              >
                🔔
                {totalNotifs > 0 && !shouldShowBadge && (
                   <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-900"></span>
                )}
              </button>
              
              {shouldShowBadge && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] md:text-[10px] font-black w-4 h-4 md:w-5 md:h-5 flex items-center justify-center rounded-full shadow-md border-2 border-slate-900 animate-pulse pointer-events-none z-10">
                  {totalNotifs}
                </span>
              )}

              {showNotifMenu && (
                 <div className="absolute top-12 md:top-14 left-0 md:left-1/2 md:-translate-x-1/2 w-64 md:w-72 bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl p-4 z-50 animate-fade-in-up">
                    <h4 className="text-white font-bold mb-3 border-b border-slate-700 pb-2 flex justify-between items-center">
                      <span>עדכונים מהמגרש</span>
                      {realNotifsCount > 0 && !userCleared && (
                         <button onClick={() => setUserCleared(true)} className="text-[10px] text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 px-2 py-1 rounded transition-colors border border-transparent hover:border-rose-500/30 font-bold">
                            נקה הכל ✕
                         </button>
                      )}
                    </h4>
                    <div className="space-y-3">
                       {ptsDiff > 0 && !userCleared && (
                          <div className="flex items-start gap-3 bg-emerald-900/20 p-2 rounded-xl border border-emerald-500/20">
                             <span className="text-xl mt-1">💸</span>
                             <div>
                                <div className="text-emerald-400 font-bold text-sm">קופה פצצה!</div>
                                <div className="text-slate-300 text-xs mt-0.5">נכנסו לך {ptsDiff} נקודות חדשות מאתמול.</div>
                             </div>
                          </div>
                       )}
                       {activeSurpriseAlert > 0 && !userCleared && (
                          <Link href="/" onClick={() => setShowNotifMenu(false)}>
                            <div className="flex items-start gap-3 bg-purple-900/20 p-2 rounded-xl border border-purple-500/20 cursor-pointer hover:bg-purple-900/40 transition-colors mt-2">
                               <span className="text-xl mt-1 animate-bounce">🎁</span>
                               <div>
                                  <div className="text-purple-400 font-bold text-sm">שאלת הפתעה!</div>
                                  <div className="text-slate-300 text-xs mt-0.5">יש {activeSurpriseAlert} שאלות במערכת שפתוחות לזמן מוגבל.</div>
                               </div>
                            </div>
                          </Link>
                       )}
                       {missingMatchesToday > 0 && !userCleared && (
                          <Link href="/" onClick={() => setShowNotifMenu(false)}>
                            <div className="flex items-start gap-3 bg-amber-900/20 p-2 rounded-xl border border-amber-500/20 cursor-pointer hover:bg-amber-900/40 transition-colors mt-2">
                               <span className="text-xl mt-1">⚠️</span>
                               <div>
                                  <div className="text-amber-400 font-bold text-sm">משחקים להיום</div>
                                  <div className="text-slate-300 text-xs mt-0.5">חסרים לך {missingMatchesToday} ניחושים למשחקי היום.</div>
                               </div>
                            </div>
                          </Link>
                       )}
                       {totalNotifs === 0 && (
                          <div className="text-slate-500 text-sm text-center py-4 flex flex-col items-center gap-2">
                            <span className="text-3xl opacity-50">🧘‍♂️</span>
                            <span>הכל נקי, אין עדכונים חדשים.</span>
                          </div>
                       )}
                    </div>
                 </div>
              )}
           </div>

           {/* פרופיל משתמש */}
           <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 p-1 pr-2 md:p-1.5 md:pr-4 rounded-full shadow-inner hover:bg-slate-800 transition-colors cursor-pointer shrink-0">
              <div className="text-left hidden md:flex flex-col justify-center">
                <div className="text-slate-200 font-bold text-sm leading-tight max-w-[120px] truncate">{userName}</div>
                <div className="text-amber-400 text-xs font-black tracking-wider mt-0.5 flex items-center justify-end gap-1">
                  {userPoints} נק' 🏆
                </div>
              </div>
              
              {photoUrl ? (
                <img src={photoUrl} alt="Profile" className="w-7 h-7 md:w-9 md:h-9 rounded-full border border-slate-600 object-cover shadow-sm" />
              ) : (
                <div className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-gradient-to-tr from-blue-600 to-emerald-500 border border-slate-600 flex items-center justify-center text-sm md:text-lg shadow-sm">
                  ⚽
                </div>
              )}
           </div>

           {/* התנתקות */}
           <button 
              onClick={handleLogout} 
              className="bg-slate-900 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 border border-slate-700 w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-xl transition-colors shadow-sm shrink-0"
              title="התנתק מהמערכת"
           >
              🚪
           </button>
        </div>

      </div>
    </nav>
  );
}