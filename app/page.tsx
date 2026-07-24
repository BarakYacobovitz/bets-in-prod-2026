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
import Euro2028 from "../components/Euro2028";
import "driver.js/dist/driver.css";
import { driver } from "driver.js";

type MainTab = "DASHBOARD" | "PREDICTIONS" | "LEADERBOARD" | "RULES";
type PredictionTab = "MATCHES" | "QUALIFIERS" | "THIRD_PLACE" | "BONUS" | "KNOCKOUT";

export default function Home() {
  // ==========================================
  // 1. הגדרת כל ה-States 
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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        let docSnap = await getDoc(userDocRef);
        let attempts = 0;
        
        while (!docSnap.exists() && attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 500));
          docSnap = await getDoc(userDocRef);
          attempts++;
        }

        if (docSnap.exists()) {
          setUser(currentUser);
        } else {
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

  // ==========================================
  // 3. אפקט האזנה חיה לסטטוס המערכת (Live Sync)
  // ==========================================
  useEffect(() => {
    const unsubSys = onSnapshot(doc(db, "settings", "system"), (docSnap) => {
      if (docSnap.exists()) {
        const newState = Number(docSnap.data().tournamentState) || 0;
        setTournamentState(newState);
        
        if (newState >= 4) {
          setPredictionTab("KNOCKOUT");
        } else {
          setPredictionTab("MATCHES");
        }
      }
    });
    return () => unsubSys();
  }, []);

  // ==========================================
  // 4. אפקט מדריך משתמש דינמי (Walkthrough)
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
            nextBtnText: "הבא",
            prevBtnText: "הקודם",
            doneBtnText: "יאללה לשחק! ⚽",
            popoverClass: 'custom-football-tour',
            allowClose: false,
            steps: [
              {
                 element: '#nav-dashboard',
                 popover: { 
                 title: 'ברוכים הבאים ל-Bets in PROD! 💥\nמהמרים בייצור', 
                 description: 'החלפנו את האקסל! 🚀\nעכשיו נסביר לכם איך לעבוד עם המערכת החדשה. אני מסביר רק פעם אחת אז להקשיב טוב טוב! 👂\n\nכאן בלוח הבקרה תראו את הדירוג שלכם, הודעות מההנהלה ואת "הראדאר" שמעדכן מה קורה היום במגרש.\n\n📱 טיפ מובייל: נסו להחליק שמאלה על המסך כדי לגלות את הטור היומי ועוד הפתעות!' 
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
                  onPrevClick: () => {
                    setActiveTab("DASHBOARD");
                    setTimeout(() => driverObj.movePrevious(), 300);
                  },
                  onNextClick: () => {
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
                element: '#first-match-card', 
                popover: { 
                  title: 'איך מנחשים תוצאה? ✍️', 
                  description: 'פשוט מקלידים את התוצאה בתיבות. המערכת שומרת אוטומטית ברגע ההקלדה.',
                  onNextClick: () => {
                    document.getElementById('btn-switch-to-qualifiers')?.click();
                    setTimeout(() => driverObj.moveNext(), 250);
                  }
                }
              },
              {
                element: '#first-group-qualifiers', 
                popover: { 
                  title: 'העולות לשמינית 🥇🥈', 
                  description: 'בכל בית תצטרך לנחש אילו נבחרות יסיימו במקום הראשון והשני. פגיעה במיקום המדויק שווה המון נקודות!',
                  onPrevClick: () => {
                    document.getElementById('btn-switch-to-matches')?.click();
                    setTimeout(() => driverObj.movePrevious(), 250);
                  },
                  onNextClick: () => {
                    document.getElementById('btn-switch-to-matches')?.click();
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
                  onPrevClick: () => {
                    setPredictionTab("MATCHES");
                    setTimeout(() => {
                      document.getElementById('btn-switch-to-qualifiers')?.click();
                      setTimeout(() => driverObj.movePrevious(), 200);
                    }, 200);
                  },
                  onNextClick: () => {
                    setPredictionTab("BONUS");
                    setTimeout(() => driverObj.moveNext(), 300);
                  }
                }
              },
              {
                element: '#tab-bonus',
                popover: { 
                  title: 'שאלות הבונוס 🎁', 
                  description: 'זה השובר שוויון של הטורניר. המקום לעשות בו את הקפיצה הגדולה בדירוג.',
                  onPrevClick: () => {
                    setPredictionTab("THIRD_PLACE");
                    setTimeout(() => driverObj.movePrevious(), 300);
                  }
                }
              },
              {
                element: '#first-bonus-card', 
                popover: { 
                  title: 'איך עונים? 💡', 
                  description: 'תוכל להקליד שם של שחקן (אל דאגה, יש השלמה אוטומטית!), מספר, טקסט חופשי או בחירה מאוסף נבחרות.\n⭐ שים לב לניקוד: יש ניקוד רגיל ויש שאלות "דאבל" שיקפיצו אותך. \n🤫 וסוד קטן... יש גם שאלות הפתעה שמופיעות לזמן מוגבל בלבד!',
                  onNextClick: () => {
                    setActiveTab("LEADERBOARD");
                    setTimeout(() => driverObj.moveNext(), 400);
                  }
                }
              },
              {
                element: '#nav-leaderboard',
                popover: { 
                  title: 'דירוג וליגות 🏆', 
                  description: 'רוצה לראות איפה אתה עומד מול כולם? זה המקום.',
                  onPrevClick: () => {
                    setActiveTab("PREDICTIONS");
                    setPredictionTab("BONUS");
                    setTimeout(() => driverObj.movePrevious(), 400);
                  }
                }
              },
              {
                element: '#private-leagues-section',
                popover: { 
                  title: 'ליגות פרטיות 👥', 
                  description: 'כאן תוכל לפתוח ליגה סגורה לחברים ולהוכיח להם מי המלך של המגרש. שיהיה בהצלחה!',
                  onNextClick: () => {
                    setActiveTab("DASHBOARD");
                    setTimeout(() => driverObj.moveNext(), 300);
                  }
                }
              },
              {
                element: '#betting-pass-ticket',
                popover: { 
                  title: 'מוכנים להמראה? ✈️', 
                  description: 'לסיום, ודא שכרטיס הטיסה שלך מסומן כ-VALIDATED. אם כתוב "ממתין להסדר", תוכל להסדיר תשלום מול ההנהלה. אם אתה מאושר - אתה בפנים! יאללה לשחק!',
                  onPrevClick: () => {
                    setActiveTab("LEADERBOARD");
                    setTimeout(() => driverObj.movePrevious(), 300);
                  }
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

  if (isCheckingAuth) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-400 font-bold">טוען נתונים...</div>;
  if (!user) return <Login />;

  return (
    <div className="min-h-screen bg-slate-950 pt-8 pb-12 px-4 font-sans" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <Euro2028 />
      </div>
    </div>
  );
}