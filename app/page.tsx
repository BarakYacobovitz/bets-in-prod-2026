"use client";
import { useState, useEffect } from "react";
import { auth, db, provider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs, onSnapshot } from "firebase/firestore";

// ייבוא הקומפוננטות שלנו
import Dashboard from "../components/Dashboard"; 
import GroupsView from "../components/GroupsView";
import KnockoutView from "../components/KnockoutView";
import Leaderboard from "../components/Leaderboard";
import BonusQuestions from "../components/BonusQuestions";
import Rules from "../components/Rules";
import ThirdPlaceQualifiers from "../components/ThirdPlaceQualifiers";
import toast from "react-hot-toast";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<number>(-1); 
  
  const [tournamentState, setTournamentState] = useState<number>(0);
  const [matches, setMatches] = useState<any[]>([]);
  const [groups, setGroups] = useState<any>({});
  
  const [dailyMessage, setDailyMessage] = useState("");
  const [userStats, setUserStats] = useState({ points: 0, rank: 0, totalUsers: 0 });
  const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            name: currentUser.displayName,
            email: currentUser.email,
            totalPoints: 0,
            knockoutPoints: 0,
            hasPaid: false,
            createdAt: new Date()
          });
        }
        fetchDashboardData(currentUser.uid);
        fetchTournamentData();
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const target = new Date("2026-06-11T22:00:00").getTime();
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const diff = target - now;
      if (diff > 0) {
        setCountdown({
          d: Math.floor(diff / (1000 * 60 * 60 * 24)),
          h: Math.floor((diff / (1000 * 60 * 60)) % 24),
          m: Math.floor((diff / 1000 / 60) % 60),
          s: Math.floor((diff / 1000) % 60)
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async (uid: string) => {
    try {
      const dashSnap = await getDoc(doc(db, "settings", "dashboard"));
      if (dashSnap.exists()) setDailyMessage(dashSnap.data().dailyMessage || "");

      const usersSnap = await getDocs(collection(db, "users"));
      const usersList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      usersList.sort((a: any, b: any) => (b.totalPoints || 0) - (a.totalPoints || 0));
      
      const myIndex = usersList.findIndex(u => u.id === uid);
      if (myIndex !== -1) {
        setUserStats({ points: usersList[myIndex].totalPoints || 0, rank: myIndex + 1, totalUsers: usersList.length });
      }
    } catch (e) { console.error("Error fetching dashboard:", e); }
  };

  const fetchTournamentData = async () => {
    try {
      // 🚀 התיקון: האזנה חיה לשעון המערכת והמרה בטוחה למספר (Number)
      onSnapshot(doc(db, "settings", "system"), (sysSnap) => {
        if (sysSnap.exists()) {
          setTournamentState(Number(sysSnap.data().tournamentState) || 0);
        }
      });

      const matchesSnap = await getDocs(collection(db, "matches"));
      const mArray: any[] = [];
      const gObj: any = {};
      matchesSnap.forEach(doc => {
        const m = { id: doc.id, ...doc.data() } as any;
        mArray.push(m);
        if (m.stage !== "KNOCKOUT") {
          if (!gObj[m.group]) gObj[m.group] = new Set();
          gObj[m.group].add(m.homeTeam);
          gObj[m.group].add(m.awayTeam);
        }
      });
      mArray.sort((a, b) => a.id.localeCompare(b.id));
      setMatches(mArray);
      
      const parsedGroups: any = {};
      for (const [g, teamsSet] of Object.entries(gObj)) { parsedGroups[g] = Array.from(teamsSet as Set<string>); }
      setGroups(parsedGroups);
    } catch (e) { console.error("Error fetching matches:", e); }
  };

  const handleLogin = async () => {
    try { await signInWithPopup(auth, provider); } 
    catch (error) { console.error("Login failed", error); toast.error("שגיאה בהתחברות"); }
  };

  if (isAuthLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-2xl font-bold animate-pulse">טוען את המגרש... ⚽</div>;

if (!user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans" dir="rtl">
        
        {/* === וידאו הרקע === */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute top-0 left-0 w-full h-full object-cover z-0"
        >
          {/* שים לב ל-P הגדולה - חייב להיות תואם בדיוק לשם הקובץ ב-public */}
          <source src="/Preview.mp4" type="video/mp4" />
        </video>

        {/* === שכבת Overlay כהה כדי שהטקסט יהיה קריא === */}
        <div className="absolute top-0 left-0 w-full h-full bg-slate-950/70 z-10 pointer-events-none backdrop-blur-[2px]"></div>
        
        {/* === התוכן שלך (ללא שינוי בלוגיקה, רק z-index מוגדל) === */}
        <div className="relative z-20 text-center max-w-2xl w-full flex flex-col items-center">
          <div className="inline-block bg-blue-500/20 border border-blue-500/40 text-blue-300 px-4 py-1.5 rounded-full text-sm font-bold tracking-widest mb-6 shadow-sm backdrop-blur-md">
            ⚽ מונדיאל 2026 ארה"ב, מקסיקו וקנדה ⚽
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 mb-6 drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)]">
            מהמרים בייצור
          </h1>
          
          <p className="text-lg md:text-xl text-slate-200 mb-10 leading-relaxed max-w-xl mx-auto drop-shadow-lg font-medium">
            הגיע הזמן להוכיח לכל המחלקה מי באמת מבין בכדורגל, ומי סתם בוט. נחשו תוצאות, עקבו אחרי ההימורים של החברים, וקחו את התהילה.
          </p>

          <div className="bg-slate-900/60 border border-slate-700/50 p-6 md:p-8 rounded-3xl mb-12 backdrop-blur-md w-full shadow-2xl">
            <h3 className="text-sm md:text-base font-bold text-slate-300 uppercase tracking-widest mb-4">שריקת הפתיחה בעוד:</h3>
            <div className="flex justify-center gap-4 md:gap-8">
              <div className="flex flex-col items-center"><span className="text-4xl md:text-6xl font-black text-white drop-shadow-md">{countdown.d}</span><span className="text-slate-400 text-xs md:text-sm mt-1">ימים</span></div><span className="text-4xl md:text-6xl font-black text-slate-500">:</span>
              <div className="flex flex-col items-center"><span className="text-4xl md:text-6xl font-black text-white drop-shadow-md">{countdown.h.toString().padStart(2, '0')}</span><span className="text-slate-400 text-xs md:text-sm mt-1">שעות</span></div><span className="text-4xl md:text-6xl font-black text-slate-500">:</span>
              <div className="flex flex-col items-center"><span className="text-4xl md:text-6xl font-black text-white drop-shadow-md">{countdown.m.toString().padStart(2, '0')}</span><span className="text-slate-400 text-xs md:text-sm mt-1">דקות</span></div>
            </div>
          </div>

          <button onClick={handleLogin} className="bg-white text-slate-900 hover:bg-slate-200 font-black text-lg md:text-xl px-8 py-4 md:px-10 md:py-5 rounded-full flex items-center justify-center gap-4 transition-all hover:scale-105 shadow-[0_0_40px_rgba(255,255,255,0.2)] w-full md:w-auto">
             <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6 md:w-8 md:h-8" alt="Google Logo" />
             התחבר עם חשבון גוגל
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 font-sans pb-12" dir="rtl">
      


      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        <div className="flex overflow-x-auto gap-2 mb-8 pb-2 custom-scrollbar">
          {[
            { id: -1, label: "🏠 דאשבורד" },
            { id: 0, label: "⚽ שלב הבתים" },
            { id: 1, label: "🥉 מעפילות (מקום 3)" },
            { id: 2, label: "🔥 נוק-אאוט" },
            { id: 3, label: "🏆 טבלה וריגול" },
            { id: 4, label: "⭐ בונוסים" },
            { id: 5, label: "ℹ️ חוקים וניקוד" }
          ].map(tab => {
            if (tab.id === 2 && tournamentState < 4) return null;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === tab.id ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25" : "bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200"}`}>
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === -1 && <Dashboard userId={user.uid} userName={user.displayName} setActiveTab={setActiveTab} tournamentState={tournamentState} />}
        
        {activeTab === 0 && <GroupsView matches={matches.filter(m => m.stage !== "KNOCKOUT")} groups={groups} userId={user.uid} tournamentState={tournamentState} />}
        
        {activeTab === 1 && <ThirdPlaceQualifiers groups={groups} userId={user.uid} tournamentState={tournamentState} />}
        
        {activeTab === 2 && <KnockoutView matches={matches.filter(m => m.stage === "KNOCKOUT")} userId={user.uid} tournamentState={tournamentState} />}
        
        {activeTab === 3 && <Leaderboard />}
        
        {activeTab === 4 && <BonusQuestions userId={user.uid} tournamentState={tournamentState} matches={matches} groups={groups} />}
        
        {activeTab === 5 && <Rules />}

      </div>
    </div>
  );
}