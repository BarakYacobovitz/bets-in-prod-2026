"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
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
import "driver.js/dist/driver.css";
import { driver } from "driver.js";

type MainTab = "DASHBOARD" | "PREDICTIONS" | "LEADERBOARD" | "RULES";
type PredictionTab = "MATCHES" | "QUALIFIERS" | "THIRD_PLACE" | "BONUS" | "KNOCKOUT";

export default function Home() {
  // ==========================================
  // 1. הגדרת כל ה-States (שוחזרו במלעם)
  // ==========================================
  const [user, setUser] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<MainTab>("DASHBOARD");
  const [predictionTab, setPredictionTab] = useState<PredictionTab>("MATCHES");
  const [matches, setMatches] = useState<any[]>([]);
  const [groups, setGroups] = useState<any>({});
  const [tournamentState, setTournamentState] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // ==========================================
  // 2. אפקט מאזין אותנטיקציה (Auth Listener)
  // ==========================================
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // ==========================================
  // 3. אפקט האזנה חיה לסטטוס המערכת (Live Sync)
  // ==========================================
  useEffect(() => {
    const unsubSys = onSnapshot(doc(db, "settings", "system"), (docSnap) => {
      if (docSnap.exists()) {
        setTournamentState(Number(docSnap.data().tournamentState) || 0);
      }
    });
    return () => unsubSys();
  }, []);

  // ==========================================
  // 4. אפקט מדריך משתמש דינמי (Walkthrough עם הגנות)
  // ==========================================
  useEffect(() => {
    if (!user?.uid) return;

    const checkAndRunOnboarding = async () => {
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        // בדיקה האם המשתמש כבר השלים את הסיור בעבר
        if (userSnap.exists() && userSnap.data().onboardingCompleted) {
          return; 
        }

  const runOnboarding = () => {
  const driverObj = driver({
  showProgress: true,
  // הורדנו את החצים כדי למנוע את עיוות ה-RTL
  nextBtnText: "הבא", 
  prevBtnText: "הקודם",
  doneBtnText: "יאללה לשחק! ⚽",
  popoverClass: 'custom-football-tour',
  allowClose: false,
  steps: [
    {
      element: '#nav-dashboard',
      popover: { 
        title: 'ברוכים הבאים ל-PROD! 🏟️', 
        description: 'כאן בלוח הבקרה תראה את הדירוג שלך, הודעות מההנהלה ואת "הראדאר" שמעדכן מה קורה היום במגרש.'
      }
    },
    {
      element: '#tour-progress-ring',
      popover: { 
        title: 'מד המשימות שלך 🎯', 
        description: 'המטרה היא תמיד להיות על 100%! המד מראה כמה מהניחושים הפתוחים כרגע כבר מילאת.' 
      }
    },
    {
      element: '#tour-timer',
      popover: { 
        title: 'שעון נעילה ⏳', 
        description: 'שים לב מתי ננעל השלב הבא. אחרי האיפוס, לא תוכל לשנות ניחושים לאותו מחזור!' 
      }
    },
    {
      element: '#nav-predictions',
      popover: { 
        title: 'זירת הניחושים ⚽', 
        description: 'כאן מרוויחים את הנקודות. בוא נכנס פנימה ונראה איך זה עובד...',
        onNextClick: () => {
          // המשתמש לוחץ "הבא", ואנחנו פותחים לו את טאב המשחקים לפני שהזרקור זז!
          setActiveTab("PREDICTIONS");
          setPredictionTab("MATCHES");
          setTimeout(() => driverObj.moveNext(), 300);
        }
      }
    },
    {
      element: '#tab-matches', 
      popover: { 
        title: 'שלב הבתים 🌍', 
        description: 'זה הטאב בו תזין את תוצאות המשחקים ותבחר את העולות מכל בית.' 
      }
    },
    {
      element: '#first-match-card', // 💡 הנה הצלילה פנימה לכרטיס המשחק!
      popover: { 
        title: 'איך מנחשים? ✍️', 
        description: 'פשוט מקלידים את התוצאה בתיבות. המערכת שומרת אוטומטית ברגע ההקלדה.',
        onNextClick: () => {
          // מכינים את הרקע לצעד הבא - מעבירים לטאב מקום 3
          setPredictionTab("THIRD_PLACE");
          setTimeout(() => driverObj.moveNext(), 300);
        }
      }
    },
    {
      element: '#tab-third',
      popover: { 
        title: 'מעפילות ממקום שלישי 🥉', 
        description: 'במונדיאל הזה, 8 הנבחרות הטובות ביותר מהמקום השלישי עולות גם הן! כאן תוכל לבחור מי לדעתך יעלו.',
        onNextClick: () => {
          // מכינים את הרקע לטאב הבונוסים
          setPredictionTab("BONUS");
          setTimeout(() => driverObj.moveNext(), 300);
        }
      }
    },
    {
      element: '#tab-bonus',
      popover: { 
        title: 'שאלות הבונוס 🎁', 
        description: 'זה השובר שוויון של הטורניר. נקודות על אלופה, מלכי שערים ועוד.',
      }
    },
    {
      element: '#first-bonus-card', // 💡 צלילה פנימה לתוך השאלה הראשונה
      popover: { 
        title: 'איך עונים? 💡', 
        description: 'חלק מהשאלות פתוחות מתחילת הטורניר, וחלקן "שאלות הפתעה" שנפתחות לזמן מוגבל. שים לב לזמני הנעילה.',
        onNextClick: () => {
          // לפני הצעד הבא, מעבירים ללידרבורד
          setActiveTab("LEADERBOARD");
          setTimeout(() => driverObj.moveNext(), 400);
        }
      }
    },
    {
      element: '#nav-leaderboard',
      popover: { 
        title: 'דירוג וליגות 🏆', 
        description: 'רוצה לראות איפה אתה עומד מול כולם? זה המקום.' 
      }
    },
    {
      element: '#private-leagues-section',
      popover: { 
        title: 'ליגות פרטיות 👥', 
        description: 'כאן תוכל לפתוח ליגה סגורה לחברים ולהוכיח להם מי המלך של המגרש. שיהיה בהצלחה!' 
      }
    }
  ],
  onDestroyStarted: () => {
    if (!driverObj.hasNextStep()) {
      driverObj.destroy();
    } else {
      const forceQuit = window.confirm("רגע, עוד לא סיימנו את הסיור! בטוח שאתה רוצה לצאת?");
      if (forceQuit) {
        driverObj.destroy();
      }
    }
  },
  onDestroyed: async () => {
    if (user?.uid) {
      try {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, { onboardingCompleted: true }, { merge: true });
      } catch (error) {
        console.error("שגיאה בשמירת סטטוס סיור:", error);
      }
    }
  }
});

  driverObj.drive();
};

        runOnboarding();
      } catch (error) {
        console.error("שגיאה בבדיקת סטטוס משתמש:", error);
      }
    };

    checkAndRunOnboarding();
  }, [user]);

  // ==========================================
  // 5. אפקט טעינת הנתונים מה-DB (משחקים ובתים)
  // ==========================================
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        const matchesSnap = await getDocs(collection(db, "matches"));
        const matchesList = matchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMatches(matchesList);

        const groupsSnap = await getDocs(collection(db, "groups"));
        const groupsData: any = {};
        groupsSnap.docs.forEach(doc => {
          groupsData[doc.id] = doc.data();
        });
        setGroups(groupsData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchAllData();
    }
  }, [user]);

  // ==========================================
  // 6. מסכי טעינה ומסך התחברות
  // ==========================================
  if (isCheckingAuth || isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-sans">
        <div className="animate-pulse text-xl font-black">טוען נתונים...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // ==========================================
  // 7. תצוגת ה-HTML המקורית והמעודכנת (עם ה-IDs)
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-950 pt-8 pb-12 px-4 font-sans" dir="rtl">
      <div className="max-w-5xl mx-auto">
        
        {/* תפריט ראשי עליון */}
        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-lg mb-6 max-w-3xl mx-auto z-40 relative md:justify-center gap-1">
           <button 
             id="nav-dashboard"
             onClick={() => setActiveTab("DASHBOARD")}
             className={`flex-1 py-3 px-1 rounded-xl font-black whitespace-nowrap text-[11px] sm:text-sm transition-all flex items-center justify-center gap-1.5 ${activeTab === "DASHBOARD" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"}`}
           >
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-5 sm:h-5 shrink-0">
               <path d="M3.34 16 a10 10 0 1 1 17.32 0" />
               <path d="m12 14 4-4" />
             </svg>
             <span>דשבורד</span>
           </button>

           <button 
             id="nav-predictions"
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
             id="nav-leaderboard"
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
             id="nav-rules"
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

        {/* תפריט ניחושים דינמי */}
        {activeTab === "PREDICTIONS" && (
           <div className="flex overflow-x-auto gap-2 mb-8 pb-2 custom-scrollbar bg-slate-900/50 p-2 rounded-2xl border border-slate-800 max-w-4xl mx-auto md:justify-center">
              {tournamentState >= 4 && (
                <button 
                  id="tab-knockout"
                  onClick={() => setPredictionTab("KNOCKOUT")}
                  className={`px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-sm flex items-center justify-center gap-2 ${predictionTab === "KNOCKOUT" ? "bg-pink-600 text-white shadow-lg shadow-pink-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"}`}
                >
                  נוק-אאוט
                </button>
              )}

              {tournamentState >= 4 && (
                <button 
                  id="tab-bonus"
                  onClick={() => setPredictionTab("BONUS")}
                  className={`px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-sm flex items-center justify-center gap-2 ${predictionTab === "BONUS" ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"}`}
                >
                  בונוסים
                </button>
              )}

              <button 
                id="tab-matches"
                onClick={() => setPredictionTab("MATCHES")}
                className={`px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-sm flex items-center justify-center gap-2 ${predictionTab === "MATCHES" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"}`}
              >
                בתים
              </button>
              
              <button 
                id="tab-third"
                onClick={() => setPredictionTab("THIRD_PLACE")}
                className={`px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-sm flex items-center justify-center gap-2 ${predictionTab === "THIRD_PLACE" ? "bg-teal-600 text-white shadow-lg shadow-teal-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"}`}
              >
                מעפילות מקום 3
              </button>

              {tournamentState < 4 && (
                <button 
                  id="tab-bonus"
                  onClick={() => setPredictionTab("BONUS")}
                  className={`px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-sm flex items-center justify-center gap-2 ${predictionTab === "BONUS" ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"}`}
                >
                  בונוסים
                </button>
              )}
           </div>
        )}

        {/* תוכן העמודים */}
        <div className="animate-fade-in-up mt-4">
            {activeTab === "DASHBOARD" && (
                <div id="dashboard-content">
                    <Dashboard userId={user.uid} tournamentState={tournamentState} matches={matches} setActiveTab={setActiveTab} setPredictionTab={setPredictionTab} />
                </div>
            )}
            
            {activeTab === "LEADERBOARD" && (
                <div id="leaderboard-content">
                    <Leaderboard currentUserId={user.uid} tournamentState={tournamentState} />
                </div>
            )}
            
            {activeTab === "RULES" && (
                <div id="rules-content">
                    <Rules />
                </div>
            )}

            {activeTab === "PREDICTIONS" && (
                <div id="predictions-content">
                    {predictionTab === "MATCHES" && <GroupsView matches={matches} groups={groups} userId={user.uid} tournamentState={tournamentState} />}
                    {predictionTab === "THIRD_PLACE" && <ThirdPlaceQualifiers groups={groups} userId={user.uid} tournamentState={tournamentState} />}
                    {predictionTab === "BONUS" && <BonusQuestions userId={user.uid} tournamentState={tournamentState} groups={groups} />}
                    {predictionTab === "KNOCKOUT" && tournamentState >= 4 && <KnockoutView matches={matches.filter(m => m.stage === "KNOCKOUT")} userId={user.uid} tournamentState={tournamentState} />}
                </div>
            )}
        </div>

      </div>
    </div>
  );
}