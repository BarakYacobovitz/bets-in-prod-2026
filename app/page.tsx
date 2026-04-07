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

// החלוקה ההיררכית שלנו
type MainTab = "DASHBOARD" | "PREDICTIONS" | "LEADERBOARD";
type PredictionTab = "MATCHES" | "QUALIFIERS" | "THIRD_PLACE" | "BONUS" | "KNOCKOUT";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [mainTab, setMainTab] = useState<MainTab>("DASHBOARD");
  const [predictionTab, setPredictionTab] = useState<PredictionTab>("MATCHES");

  const [matches, setMatches] = useState<any[]>([]);
  const [groups, setGroups] = useState<any>({});
  const [tournamentState, setTournamentState] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

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

        matchesData.sort((a, b) => a.id.localeCompare(b.id));
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

  if (isCheckingAuth) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-400 font-bold">טוען נתונים...</div>;
  if (!user) return <Login />;
  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-400 font-bold">מכין את המגרש... ⚽</div>;

  return (
    <div className="min-h-screen bg-slate-950 pt-08 pb-12 px-4 font-sans" dir="rtl">
      <div className="max-w-5xl mx-auto">
        
        {/* ========================================== */}
        {/* תפריט ראשי עליון */}
        {/* ========================================== */}
        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-lg mb-6 max-w-2xl mx-auto z-40 relative">
           <button 
             onClick={() => setMainTab("DASHBOARD")}
             className={`flex-1 py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${mainTab === "DASHBOARD" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white hover:bg-slate-800/50"}`}
           >
             <span>🏠</span> דאשבורד
           </button>
           <button 
             onClick={() => setMainTab("PREDICTIONS")}
             className={`flex-1 py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${mainTab === "PREDICTIONS" ? "bg-purple-600 text-white shadow-md" : "text-slate-400 hover:text-white hover:bg-slate-800/50"}`}
           >
             <span>✍️</span> אזור הניחושים
           </button>
           <button 
             onClick={() => setMainTab("LEADERBOARD")}
             className={`flex-1 py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${mainTab === "LEADERBOARD" ? "bg-amber-500 text-slate-900 shadow-md" : "text-slate-400 hover:text-white hover:bg-slate-800/50"}`}
           >
             <span>🏆</span> טבלת הליגה
           </button>
        </div>

        {/* ========================================== */}
        {/* תת-תפריט ניחושים (מוצג רק אם אנחנו בטאב ניחושים) */}
        {/* ========================================== */}
        {mainTab === "PREDICTIONS" && (
           <div className="flex overflow-x-auto gap-2 mb-8 pb-2 custom-scrollbar bg-slate-900/50 p-2 rounded-2xl border border-slate-800/50 max-w-4xl mx-auto">
              <button 
                onClick={() => setPredictionTab("MATCHES")}
                className={`px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-sm border flex items-center gap-2 ${predictionTab === "MATCHES" ? "bg-blue-500/20 text-blue-400 border-blue-500/50" : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white"}`}
              >
                <span>⚽</span> בתים
              </button>
              
              <button 
                onClick={() => setPredictionTab("THIRD_PLACE")}
                className={`px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-sm border flex items-center gap-2 ${predictionTab === "THIRD_PLACE" ? "bg-teal-500/20 text-teal-400 border-teal-500/50" : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white"}`}
              >
                <span>🥉</span> מעפילות מקום 3
              </button>

              <button 
                onClick={() => setPredictionTab("BONUS")}
                className={`px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-sm border flex items-center gap-2 ${predictionTab === "BONUS" ? "bg-amber-500/20 text-amber-400 border-amber-500/50" : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white"}`}
              >
                <span>⭐</span> בונוסים
              </button>

              {/* נוקאאוט מוסתר אם הטורניר עדיין לא בשלב 4 (חשיפת 32 הגדולות) */}
              {tournamentState >= 4 && (
                <button 
                  onClick={() => setPredictionTab("KNOCKOUT")}
                  className={`px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-sm border flex items-center gap-2 ${predictionTab === "KNOCKOUT" ? "bg-pink-500/20 text-pink-400 border-pink-500/50" : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white"}`}
                >
                  <span>🔥</span> נוק-אאוט
                </button>
              )}
           </div>
        )}

        {/* ========================================== */}
        {/* תוכן העמודים */}
        {/* ========================================== */}
        <div className="animate-fade-in-up mt-4">
           {mainTab === "DASHBOARD" && <Dashboard userId={user.uid} tournamentState={tournamentState} matches={matches} />}
           {mainTab === "LEADERBOARD" && <Leaderboard currentUserId={user.uid} tournamentState={tournamentState} />}
           
           {mainTab === "PREDICTIONS" && (
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