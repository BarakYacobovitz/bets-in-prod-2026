"use client";
import { useState } from "react";
import MatchCard from "./MatchCard";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../app/firebase";

export default function KnockoutView({ matches, userId, tournamentState }: { matches: any[], userId: string, tournamentState: number }) {
  const rounds = ["32 הגדולות", "שמינית גמר", "רבע גמר", "חצי גמר", "גמר"];
  
  const availableRounds = rounds.filter(r => matches.some(m => m.roundName === r));
  const [activeRound, setActiveRound] = useState(availableRounds.length > 0 ? availableRounds[0] : rounds[0]);
  const [isRandomizing, setIsRandomizing] = useState(false);

  const roundMatches = matches.filter(m => m.roundName === activeRound);

  const isRoundHidden = (round: string) => {
    if (round === "32 הגדולות" && tournamentState < 4) return true;
    if (round === "שמינית גמר" && tournamentState < 6) return true;
    if (round === "רבע גמר" && tournamentState < 8) return true;
    if (round === "חצי גמר" && tournamentState < 10) return true;
    if (round === "גמר" && tournamentState < 12) return true;
    return false;
  };
  
  const isRoundLocked = (round: string) => {
    if (round === "32 הגדולות" && tournamentState >= 5) return true;
    if (round === "שמינית גמר" && tournamentState >= 7) return true;
    if (round === "רבע גמר" && tournamentState >= 9) return true;
    if (round === "חצי גמר" && tournamentState >= 11) return true;
    if (round === "גמר" && tournamentState >= 13) return true;
    return false;
  };

  const handleRandomizeRound = async () => {
    if (!confirm(`להגריל תוצאות אקראיות לכל משחקי ${activeRound}?`)) return;
    setIsRandomizing(true);
    try {
       const batchPromises = roundMatches.map(async (m) => {
          if (!m.isFinished) {
             const h = Math.floor(Math.random() * 4);
             const a = Math.floor(Math.random() * 4);
             let qualifier = "";
             if (h > a) qualifier = m.homeTeam;
             else if (a > h) qualifier = m.awayTeam;
             else qualifier = Math.random() > 0.5 ? m.homeTeam : m.awayTeam;

             const docRef = doc(db, "predictions_knockout", `${userId}_${m.id}`);
             return setDoc(docRef, { 
                 userId, matchId: m.id, roundName: m.roundName,
                 predictedHomeScore: h.toString(), predictedAwayScore: a.toString(),
                 qualifier, updatedAt: new Date() 
             }, { merge: true });
          }
       });
       await Promise.all(batchPromises);
    } catch(e) { console.error(e); }
    finally { setIsRandomizing(false); }
  };

  if (matches.length === 0) {
    return (
      <div className="text-center py-20 bg-slate-900/50 rounded-3xl border border-slate-800">
        <div className="text-6xl mb-4">🤫</div>
        <h2 className="text-2xl font-bold text-slate-300">שלב הנוק-אאוט עדיין לא פורסם</h2>
        <p className="text-slate-500 mt-2">המשחקים יופיעו כאן ברגע שהמנהל יעדכן את תמונת העולות.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-8 w-full animate-fade-in-up">
      
      <div className="w-full md:w-64 shrink-0">
        <div className="bg-slate-900 rounded-3xl p-4 border border-slate-800 md:sticky md:top-24 shadow-xl">
          <h3 className="text-xl font-bold text-white mb-4 px-2 border-b border-slate-800 pb-2">שלבי הכרעה</h3>
          <div className="flex flex-row md:flex-col gap-3 overflow-x-auto md:overflow-visible custom-scrollbar pb-2 md:pb-0">
            {rounds.map(round => {
              const hidden = isRoundHidden(round);
              const hasMatches = matches.some(m => m.roundName === round);
              
              return (
                <button
                  key={round}
                  disabled={hidden || !hasMatches}
                  onClick={() => setActiveRound(round)}
                  className={`relative flex flex-col items-start p-4 rounded-xl font-bold transition-all min-w-[140px] md:min-w-0 overflow-hidden ${
                    activeRound === round 
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30" 
                      : hidden 
                        ? "bg-slate-900/50 text-slate-600 border border-slate-800 cursor-not-allowed" 
                        : !hasMatches 
                          ? "bg-slate-900/80 text-slate-500 border border-slate-800/50 cursor-not-allowed"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  <div className="flex justify-between items-center w-full relative z-10">
                    <span className="text-lg">{round}</span>
                    {hidden ? <span>🔒</span> : !hasMatches ? <span className="text-xs">בקרוב</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4 mb-8 gap-4">
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            {activeRound}
          </h2>
          
          {/* כפתור הגרלת שלב (אם לא נעול) */}
          {!isRoundLocked(activeRound) && roundMatches.length > 0 && (
             <button 
                onClick={handleRandomizeRound} 
                disabled={isRandomizing}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-bold py-2 px-4 rounded-xl border border-slate-600 flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
             >
               <span className="text-xl">🎲</span> {isRandomizing ? "מגריל..." : "הגרל שלב"}
             </button>
          )}
        </div>

        {roundMatches.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-slate-800/30 rounded-2xl border border-slate-700/50">
            אין משחקים לשלב זה כרגע.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {roundMatches.map(match => (
              <MatchCard 
                key={match.id} 
                match={match} 
                userId={userId} 
                tournamentState={tournamentState} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}