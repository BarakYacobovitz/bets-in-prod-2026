"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase";
import GroupsView from "../components/GroupsView";
import ThirdPlaceQualifiers from "../components/ThirdPlaceQualifiers";
import KnockoutView from "../components/KnockoutView";
import BonusQuestions from "../components/BonusQuestions";
import Dashboard from "../components/Dashboard";
import Leaderboard from "../components/Leaderboard";
import Login from "../components/Login";
import Rules from "../components/Rules";

// החלוקה ההיררכית שלנו
type MainTab = "DASHBOARD" | "PREDICTIONS" | "LEADERBOARD" | "RULES";
type PredictionTab = "MATCHES" | "QUALIFIERS" | "THIRD_PLACE" | "BONUS" | "KNOCKOUT";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // הסטייט המאוחד! עכשיו הכל עובד על activeTab
  const [activeTab, setActiveTab] = useState<MainTab>("DASHBOARD");
  const [predictionTab, setPredictionTab] = useState<PredictionTab>("MATCHES");
  
  const [matches, setMatches] = useState<any[]>([]);
  const [groups, setGroups] = useState<any>({});
  const [tournamentState, setTournamentState] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // המשתמש התחבר לגוגל, אבל אנחנו לא מכניסים אותו עדיין!
        // נוודא ש-Login.tsx סיים לייצר לו כרטיסייה ב-Firestore
        const userDocRef = doc(db, "users", currentUser.uid);
        let docSnap = await getDoc(userDocRef);
        let attempts = 0;
        
        // לולאת המתנה (Polling) - בודק כל חצי שנייה אם הכרטיסייה כבר נוצרה (עד 5 שניות)
        while (!docSnap.exists() && attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 500));
          docSnap = await getDoc(userDocRef);
          attempts++;
        }

        if (docSnap.exists()) {
          setUser(currentUser); // הכל מוכן, הנהג יכול להיכנס!
        } else {
          // אם עברו 5 שניות ואין כרטיסייה, משהו נכשל. ננתק אותו כדי למנוע באגים.
          await auth.signOut();
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setIsCheckingAuth(false);
    });
    
    return () => unsubscribe();
  }, []);
  useEffect(() => {
  // אם אנחנו בשלב הנוקאאוט (4 ומעלה) - הטאב הדיפולטיבי יהיה נוקאאוט
  if (tournamentState >= 4) {
    setPredictionTab("KNOCKOUT");
  } else {
    // אחרת (שלב הבתים) - הטאב הדיפולטיבי יהיה בתים
    setPredictionTab("MATCHES");
  }
}, [tournamentState]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const matchesSnap = await getDocs(collection(db, "matches"));
        const matchesData: any[] = [];
        const groupsData: any = {};

        matchesSnap.forEach((doc) => {
          const m = { id: doc.id, ...doc.data() };
          matchesData.push(m);
          if (m.stage !== "KNOCKOUT" && m.group) {
            if (!groupsData[m.group]) groupsData[m.group] = new Set();
            groupsData[m.group].add(m.homeTeam);
            groupsData[m.group].add(m.awayTeam);
          }
        });

        matchesData.sort((a, b) => String(a.id).localeCompare(String(b.id)));     
        setMatches(matchesData);
        setGroups(groupsData);

        const systemSnap = await getDoc(doc(db, "settings", "system"));
        if (systemSnap.exists()) {
          setTournamentState(systemSnap.data().tournamentState || 0);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // האזנה לאירועי ניווט חיצוניים (כמו מה-Navbar)
  useEffect(() => {
    const handleTabChange = (e: any) => {
      if (e.detail) {
        setActiveTab(e.detail);
        // אם מנווטים לטאב כלשהו, נוודא שאנחנו גוללים למעלה שיהיה נוח
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    window.addEventListener("changeTab", handleTabChange);

    // בדיקה: האם הגענו לדף ויש לנו טאב שמור ב-SessionStorage? (למשל כי עשינו ריענון)
    const startupTab = sessionStorage.getItem("startupTab");
    if (startupTab) {
      setActiveTab(startupTab as MainTab);
      sessionStorage.removeItem("startupTab");
    }

    return () => window.removeEventListener("changeTab", handleTabChange);
  }, []);
  if (isCheckingAuth) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-400 font-bold">טוען נתונים...</div>;
  if (!user) return <Login />;
  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-400 font-bold">מכין את המגרש... ⚽</div>;

  return (
    <div className="min-h-screen bg-slate-950 pt-08 pb-12 px-4 font-sans" dir="rtl">
      <div className="max-w-5xl mx-auto">
        
{/* ========================================== */}
        {/* תפריט ראשי עליון - גרסה קומפקטית ללא גלילה */}
        {/* ========================================== */}
        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-lg mb-6 max-w-3xl mx-auto z-40 relative md:justify-center gap-1">
           
           <button 
             onClick={() => setActiveTab("DASHBOARD")}
             className={`flex-1 py-3 px-1 rounded-xl font-black whitespace-nowrap text-[11px] sm:text-sm transition-all flex items-center justify-center gap-1.5 ${activeTab === "DASHBOARD" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"}`}
           >
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-5 sm:h-5 shrink-0">
               <path d="M3.34 16a10 10 0 1 1 17.32 0" />
               <path d="m12 14 4-4" />
             </svg>
             <span>דשבורד</span>
           </button>

           <button 
             onClick={() => setActiveTab("PREDICTIONS")}
             className={`flex-1 py-3 px-1 rounded-xl font-black whitespace-nowrap text-[11px] sm:text-sm transition-all flex items-center justify-center gap-1.5 ${activeTab === "PREDICTIONS" ? "bg-purple-600 text-white shadow-md" : "text-slate-400 hover:text-purple-400 hover:bg-purple-500/10"}`}
           >
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-5 sm:h-5 shrink-0">
               <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
               <path d="m15 5 4 4" />
             </svg>
             <span>ניחושים</span>
           </button>

           <button 
             onClick={() => setActiveTab("LEADERBOARD")}
             className={`flex-1 py-3 px-1 rounded-xl font-black whitespace-nowrap text-[11px] sm:text-sm transition-all flex items-center justify-center gap-1.5 ${activeTab === "LEADERBOARD" ? "bg-amber-500 text-slate-900 shadow-md" : "text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"}`} 
           >
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-5 sm:h-5 shrink-0">
               <path d="M22 20H2" />
               <path d="M8 20V8h8v12" />
               <path d="M16 20v-8h6v8" />
               <path d="M2 20v-4h6v4" />
             </svg>
             <span>דירוג</span>
           </button>

           <button 
             onClick={() => setActiveTab("RULES")}
             className={`flex-1 py-3 px-1 rounded-xl font-black whitespace-nowrap text-[11px] sm:text-sm transition-all flex items-center justify-center gap-1.5 ${activeTab === "RULES" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10"}`}
           >
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-5 sm:h-5 shrink-0">
               <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
               <polyline points="14 2 14 8 20 8" />
               <line x1="16" x2="8" y1="13" y2="13" />
               <line x1="16" x2="8" y1="17" y2="17" />
               <polyline points="10 9 9 9 8 9" />
             </svg>
             <span>חוקים</span>
           </button>
        </div>
{/* ========================================== */}
{/* תפריט ניחושים דינמי - משימה 1 מהבקלוג */}
{/* ========================================== */}
{activeTab === "PREDICTIONS" && (
   <div className="flex overflow-x-auto gap-2 mb-8 pb-2 custom-scrollbar bg-slate-900/50 p-2 rounded-2xl border border-slate-800 max-w-4xl mx-auto md:justify-center">
      
      {/* 1. נוק-אאוט: מופיע ראשון רק אם השלב פתוח (4+) */}
      {tournamentState >= 4 && (
        <button 
          onClick={() => setPredictionTab("KNOCKOUT")}
          className={`px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-sm flex items-center justify-center gap-2 ${predictionTab === "KNOCKOUT" ? "bg-pink-600 text-white shadow-lg shadow-pink-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M14.5 17.5L3 6V3h3l11.5 11.5" /><path d="M13 19l6-6" /><path d="M16 16l4 4" /><path d="M19 21l2-2" /><path d="M6.5 12.5L3 16v3h3l3.5-3.5" /><path d="M21 3v3l-3.5 3.5" /><path d="M18 5l-4 4" />
          </svg>
          נוק-אאוט
        </button>
      )}

      {/* 2. בונוסים: מופיע שני אם אנחנו בנוק-אאוט (כדי שיהיה נגיש) */}
      {tournamentState >= 4 && (
        <button 
          onClick={() => setPredictionTab("BONUS")}
          className={`px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-sm flex items-center justify-center gap-2 ${predictionTab === "BONUS" ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          בונוסים
        </button>
      )}

      {/* 3. בתים: מופיע ראשון כשאנחנו בבתים, ושלישי כשאנחנו בנוק-אאוט */}
      <button 
        onClick={() => setPredictionTab("MATCHES")}
        className={`px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-sm flex items-center justify-center gap-2 ${predictionTab === "MATCHES" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        בתים
      </button>
      
      {/* 4. מעפילות מקום 3: תמיד יופיע אחרי הבתים */}
      <button 
        onClick={() => setPredictionTab("THIRD_PLACE")}
        className={`px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-sm flex items-center justify-center gap-2 ${predictionTab === "THIRD_PLACE" ? "bg-teal-600 text-white shadow-lg shadow-teal-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <circle cx="12" cy="15" r="5" /><path d="M8.21 13.89L7 3h2l1 5h4l1-5h2l-1.21 10.89" />
        </svg>
        מעפילות מקום 3
      </button>

      {/* 5. בונוסים: מופיע אחרון רק כשאנחנו בשלב הבתים */}
      {tournamentState < 4 && (
        <button 
          onClick={() => setPredictionTab("BONUS")}
          className={`px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-sm flex items-center justify-center gap-2 ${predictionTab === "BONUS" ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          בונוסים
        </button>
      )}
   </div>
)}
        {/* ========================================== */}
        {/* תוכן העמודים */}
        {/* ========================================== */}
        <div className="animate-fade-in-up mt-4">
           {activeTab === "DASHBOARD" && <Dashboard userId={user.uid} tournamentState={tournamentState} matches={matches} setActiveTab={setActiveTab} setPredictionTab={setPredictionTab} />}
           {activeTab === "LEADERBOARD" && <Leaderboard currentUserId={user.uid} tournamentState={tournamentState} />}
           {activeTab === "RULES" && <Rules />}
           {activeTab === "PREDICTIONS" && (
             <>
               {predictionTab === "MATCHES" && <GroupsView matches={matches} groups={groups} userId={user.uid} tournamentState={tournamentState} />}
               {predictionTab === "THIRD_PLACE" && <ThirdPlaceQualifiers groups={groups} userId={user.uid} tournamentState={tournamentState} />}
               {predictionTab === "BONUS" && <BonusQuestions userId={user.uid} tournamentState={tournamentState} groups={groups} />}
               {predictionTab === "KNOCKOUT" && tournamentState >= 4 && <KnockoutView matches={matches.filter(m => m.stage === "KNOCKOUT")} userId={user.uid} tournamentState={tournamentState} />}
             </>
           )}
        </div>

      </div>
    </div>
  );
}