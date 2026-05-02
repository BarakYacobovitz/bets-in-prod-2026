"use client";
import React, { useState, useEffect } from "react";
import MatchCard from "./MatchCard";
import { doc, setDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import Image from "next/image"; // ייבוא תמונה של Next.js לשילוב הגביע
import { db } from "../app/firebase";
import { getFlagUrl } from "../app/utils/flags"; 
import toast from "react-hot-toast";

export default function KnockoutView({ matches, userId, tournamentState }: { matches: any[], userId: string, tournamentState: number }) {
  const rounds = ["32 הגדולות", "שמינית גמר", "רבע גמר", "חצי גמר", "גמר"];
  
  const availableRounds = rounds.filter(r => matches.some(m => m.roundName === r));
  const [activeRound, setActiveRound] = useState(availableRounds.length > 0 ? availableRounds[0] : rounds[0]);
  const [isRandomizing, setIsRandomizing] = useState(false);

  const [viewMode, setViewMode] = useState<"LIST" | "BRACKET">("LIST");
  const [bracketModalMatch, setBracketModalMatch] = useState<any | null>(null);

  const [knockoutPreds, setKnockoutPreds] = useState<any>({});

  // איחוד המקום ה-3 לרשימה של הגמר בטאב ה-LIST
  const roundMatches = matches.filter(m => {
     if (activeRound === "גמר") return m.roundName === "גמר" || m.roundName === "מקום שלישי";
     return m.roundName === activeRound;
  });

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, "predictions_knockout"), where("userId", "==", userId));
    const unsubscribe = onSnapshot(q, (snap) => {
      const preds: any = {};
      snap.forEach(doc => {
        preds[doc.data().matchId] = doc.data();
      });
      setKnockoutPreds(preds);
    });
    return () => unsubscribe();
  }, [userId]);

  const isRoundHidden = (round: string) => {
    if (round === "32 הגדולות" && tournamentState < 4) return true;
    if (round === "שמינית גמר" && tournamentState < 6) return true;
    if (round === "רבע גמר" && tournamentState < 8) return true;
    if (round === "חצי גמר" && tournamentState < 10) return true;
    if ((round === "גמר" || round === "מקום שלישי") && tournamentState < 12) return true;
    return false;
  };
  
  const isRoundLocked = (round: string) => {
    if (round === "32 הגדולות" && tournamentState >= 5) return true;
    if (round === "שמינית גמר" && tournamentState >= 7) return true;
    if (round === "רבע גמר" && tournamentState >= 9) return true;
    if (round === "חצי גמר" && tournamentState >= 11) return true;
    if ((round === "גמר" || round === "מקום שלישי") && tournamentState >= 13) return true;
    return false;
  };

  const handleRandomizeRound = () => {
    toast((t) => (
      <div className="flex flex-col gap-3 text-right" dir="rtl">
        <span className="font-bold text-slate-800 text-sm">האם להגריל ניחושים אקראיים לשלב {activeRound}?</span>
        <div className="flex gap-2">
          <button onClick={() => {
            toast.dismiss(t.id);
            setIsRandomizing(true);
            setTimeout(() => {
               const newPreds = { ...knockoutPreds };
               roundMatches.forEach(m => {
                  const hScore = Math.floor(Math.random() * 4);
                  const aScore = Math.floor(Math.random() * 4);
                  let qual = hScore > aScore ? m.homeTeam : aScore > hScore ? m.awayTeam : (Math.random() > 0.5 ? m.homeTeam : m.awayTeam);
                  newPreds[m.id] = { predictedHomeScore: hScore, predictedAwayScore: aScore, qualifier: qual };
               });
               setKnockoutPreds(newPreds);
               setIsRandomizing(false);
               toast.success("🎲 הניחושים הוגרלו!");
            }, 600);
          }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all">כן, הגרל</button>
          <button onClick={() => toast.dismiss(t.id)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">בטל</button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const expectedCounts: Record<string, number> = { "32 הגדולות": 16, "שמינית גמר": 8, "רבע גמר": 4, "חצי גמר": 2, "גמר": 1 };
  const firstRealRoundIdx = rounds.findIndex(r => matches.some(m => m.roundName === r));
  const roundsToRender = firstRealRoundIdx !== -1 ? rounds.slice(firstRealRoundIdx) : [];

  const treeMatchesByRound: Record<string, any[]> = {};
  let previousRoundMatches: any[] = [];

  roundsToRender.forEach(round => {
      const realMatches = matches.filter(m => m.roundName === round).sort((a,b) => a.id.localeCompare(b.id));
      const count = expectedCounts[round] || 0;
      const nodes = [];

      for (let i = 0; i < count; i++) {
           const realMatch = realMatches[i];
           let pHome = realMatch ? realMatch.homeTeam : "";
           let pAway = realMatch ? realMatch.awayTeam : "";

           if (previousRoundMatches.length > 0) {
               const prev1 = previousRoundMatches[i * 2];
               const prev2 = previousRoundMatches[i * 2 + 1];
               
               if (prev1) {
                   const pred = knockoutPreds[prev1.id]?.qualifier;
                   const real = prev1.isFinished ? prev1.realQualifier : pred;
                   if (real) pHome = real; 
               }
               if (prev2) {
                   const pred = knockoutPreds[prev2.id]?.qualifier;
                   const real = prev2.isFinished ? prev2.realQualifier : pred;
                   if (real) pAway = real; 
               }
           }

           nodes.push({
               id: realMatch ? realMatch.id : `dummy_${round}_${i}`,
               isDummy: !realMatch,
               roundName: round,
               projectedHome: pHome,
               projectedAway: pAway,
               isFinished: realMatch ? realMatch.isFinished : false,
               realHomeScore: realMatch ? realMatch.realHomeScore : undefined,
               realAwayScore: realMatch ? realMatch.realAwayScore : undefined,
               originalMatch: realMatch 
           });
      }
      treeMatchesByRound[round] = nodes;
      previousRoundMatches = nodes;
  });

  const renderBracketNode = (node: any, isFinal: boolean = false) => {
    if (!node) return null;
    
    const isDummy = node.isDummy;
    const hidden = isRoundHidden(node.roundName);
    const locked = isRoundLocked(node.roundName) || node.isFinished;
    const canEdit = !isDummy && !hidden && !locked;
    
    const hScore = node.isFinished ? node.realHomeScore : knockoutPreds[node.id]?.predictedHomeScore;
    const aScore = node.isFinished ? node.realAwayScore : knockoutPreds[node.id]?.predictedAwayScore;
    const qual = node.isFinished ? node.realQualifier : knockoutPreds[node.id]?.qualifier;

    const isHomeQual = qual === node.projectedHome && node.projectedHome !== "";
    const isAwayQual = qual === node.projectedAway && node.projectedAway !== "";

    return (
      <div 
        onClick={() => {
            if (hidden) {
                toast('שלב זה טרם נפתח לניחושים', { icon: '🔒', style: { background: '#334155', color: '#cbd5e1' } });
            } else if (isDummy) {
                toast('🔮 זוהי תחזית בלבד. המשחק ייפתח לעריכה כשהשלב יתחיל רשמית.', { icon: '🔮', style: { background: '#334155', color: '#cbd5e1', border: '1px solid #475569', fontSize: '14px' } });
            } else {
                setBracketModalMatch(node.originalMatch);
            }
        }}
        className={`border-2 rounded-xl p-1.5 flex flex-col gap-0.5 shadow-lg relative z-10 transition-all h-fit ${
            isFinal ? "w-48 sm:w-56" : "w-36 sm:w-44"
        } ${
            isFinal 
               ? "shadow-[0_0_40px_rgba(251,191,36,0.6)] border-amber-400 bg-slate-900 ring-4 ring-amber-500/30 animate-pulse-slow" 
               : isDummy || hidden 
                  ? "bg-slate-800/40 border-slate-700/50 border-dashed cursor-not-allowed opacity-80 hover:opacity-100" 
                  : locked 
                      ? "bg-slate-800 border-slate-700 opacity-95 cursor-pointer" 
                      : "bg-slate-800 border-slate-700 hover:border-purple-500 cursor-pointer hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] group"
        }`}
      >
          {/* שתילת גביע העולם האמיתי מעל הגמר */}
          {isFinal && (
             <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-16 h-20 drop-shadow-[0_0_15px_rgba(251,191,36,0.9)] z-20">
                 <Image src="/world-cup.png" alt="FIFA World Cup" width={100} height={120} className="w-full h-full object-contain" priority />
             </div>
          )}
          
          {!isDummy && !hidden && locked && <div className="absolute -top-2 -right-2 text-[10px] bg-slate-950 border border-slate-700 text-slate-400 px-1.5 py-0.5 rounded-md z-10">🔒</div>}
          {canEdit && <div className="absolute -top-2 -right-2 text-[10px] bg-purple-600 border border-purple-500 text-white px-1.5 py-0.5 rounded-md z-10 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">ערוך</div>}
          {(isDummy || hidden) && <div className="absolute -top-2 -right-2 text-[9px] bg-slate-800 border border-slate-600 text-slate-400 px-1.5 py-0.5 rounded-md z-10 tracking-widest uppercase">{hidden ? "נעול" : "תחזית"}</div>}
          
          <div className={`flex justify-between items-center text-xs sm:text-sm font-bold px-1.5 py-1 rounded transition-colors ${
              isFinal ? "text-lg py-2" : ""
          } ${
              isHomeQual ? (isFinal ? "bg-amber-400 text-slate-950" : "bg-emerald-500/20 text-emerald-400") : "text-slate-200"
          }`}>
             <div className="flex items-center gap-1.5 truncate">
               {getFlagUrl(node.projectedHome) ? <img src={getFlagUrl(node.projectedHome)!} className="w-4 h-3 object-cover rounded-sm" alt="flag" /> : <span className="text-[10px]">🏳️</span>}
               <span className="truncate">{node.projectedHome || "TBD"}</span>
             </div>
             {hScore !== undefined && !isDummy && <span className={`font-black ml-1 ${isFinal ? 'text-2xl text-white' : 'text-slate-400'}`}>{hScore}</span>}
          </div>
          
          <div className={`w-full h-px ${isFinal ? 'bg-amber-600/30' : 'bg-slate-700/50'} my-0.5`}></div>
          
          <div className={`flex justify-between items-center text-xs sm:text-sm font-bold px-1.5 py-1 rounded transition-colors ${
              isFinal ? "text-lg py-2" : ""
          } ${
              isAwayQual ? (isFinal ? "bg-amber-400 text-slate-950" : "bg-emerald-500/20 text-emerald-400") : "text-slate-200"
          }`}>
             <div className="flex items-center gap-1.5 truncate">
               {getFlagUrl(node.projectedAway) ? <img src={getFlagUrl(node.projectedAway)!} className="w-4 h-3 object-cover rounded-sm" alt="flag" /> : <span className="text-[10px]">🏳️</span>}
               <span className="truncate">{node.projectedAway || "TBD"}</span>
             </div>
             {aScore !== undefined && !isDummy && <span className={`font-black ml-1 ${isFinal ? 'text-2xl text-white' : 'text-slate-400'}`}>{aScore}</span>}
          </div>
      </div>
    );
  };

  const renderColumn = (roundName: string, isFirst: boolean, isFinal: boolean) => {
      const nodes = treeMatchesByRound[roundName];
      if (!nodes || nodes.length === 0) return null;
      const count = expectedCounts[roundName];

      let thirdPlaceNode = null;
      if (isFinal) {
         const real3rd = matches.find(m => m.roundName === "מקום שלישי");
         thirdPlaceNode = {
             id: real3rd ? real3rd.id : `dummy_3rd`,
             isDummy: !real3rd,
             roundName: "מקום שלישי",
             projectedHome: real3rd ? real3rd.homeTeam : "",
             projectedAway: real3rd ? real3rd.awayTeam : "",
             isFinished: real3rd ? real3rd.isFinished : false,
             realHomeScore: real3rd ? real3rd.realHomeScore : undefined,
             realAwayScore: real3rd ? real3rd.realAwayScore : undefined,
             originalMatch: real3rd 
         };
      }

      return (
         <div className={`relative h-full shrink-0 py-8 ${isFinal ? 'w-52 sm:w-60' : 'w-40 sm:w-48'}`}>
             <div className={`absolute top-0 w-full text-center font-black uppercase tracking-widest ${
                 isFinal ? 'text-2xl md:text-3xl text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]' : 'text-slate-500 text-xs'
             }`}>
                {roundName}
             </div>
             
             <div className={`grid w-full ${isFinal ? 'h-[70%]' : 'h-full'}`} style={{ gridTemplateRows: `repeat(${count}, minmax(0, 1fr))` }}>
                 {nodes.map((node) => (
                     <div key={node.id} className="flex items-center justify-center relative px-2 sm:px-4 w-full h-full">
                         {!isFirst && <div className={`absolute right-0 border-slate-600 top-1/2 -z-10 ${isFinal ? 'w-1 sm:w-2 border-t-2' : 'w-2 sm:w-4 border-t-2'}`}></div>}
                         {renderBracketNode(node, isFinal)}
                         {!isFinal && <div className="absolute left-0 w-2 sm:w-4 border-t-2 border-slate-600 top-1/2 -z-10"></div>}
                     </div>
                 ))}
             </div>

             {/* המקום ה-3 ממוקם בתוך הטור של הגמר, צמוד אליו מלמטה ובקו אחד עם קווי החצי גמר */}
             {isFinal && (
                 <div className="absolute top-1/2 left-0 w-full flex flex-col items-center px-2 sm:px-4 z-20 translate-y-[8.5rem] animate-fade-in delay-500">
                     <div className="text-[10px] text-orange-400 font-black mb-2 tracking-widest uppercase border-b-2 border-orange-500/50 pb-1 flex items-center gap-2">
                         <span className="text-xl">🥉</span> מקום 3-4
                     </div>
                     {renderBracketNode(thirdPlaceNode, false)}
                 </div>
             )}
         </div>
      );
  };

  const renderConnectorCol = (count: number) => {
      return (
         <div className="relative h-full w-4 sm:w-6 shrink-0 py-8">
             <div className="grid h-full w-full" style={{ gridTemplateRows: `repeat(${count}, minmax(0, 1fr))` }}>
                 {Array.from({length: count}).map((_, i) => (
                     <div key={i} className="flex items-center justify-center w-full h-full relative">
                         <div className="absolute w-full h-1/2 border-l-2 border-y-2 border-slate-600 rounded-l-lg -ml-[1px] z-0"></div>
                     </div>
                 ))}
             </div>
         </div>
      );
  };

  const dynamicHeight = roundsToRender.includes("32 הגדולות") ? "h-[1600px] md:h-[1800px]" : "h-[800px] md:h-[1000px]";

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
    <div className="w-full animate-fade-in-up pb-8">
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulseSlow {
           0%, 100% { opacity: 1; filter: brightness(1.1); transform: scale(1); }
           50% { opacity: 0.95; filter: brightness(1.0); transform: scale(0.99); }
        }
        .animate-pulse-slow {
           animation: pulseSlow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}} />
      
      <div className="sticky top-[72px] md:top-[88px] z-40 bg-slate-950/85 backdrop-blur-xl p-4 md:p-5 rounded-3xl border border-slate-700 shadow-[0_10px_30px_rgba(0,0,0,0.6)] mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all">
         <h2 className="text-xl md:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 flex items-center gap-2">
            <span>🔥</span> שלבי הנוק-אאוט
         </h2>
         
         <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-full md:w-auto shadow-inner">
            <button 
              onClick={() => setViewMode("LIST")} 
              className={`flex-1 md:w-32 py-2 rounded-lg font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 ${viewMode === "LIST" ? "bg-purple-600 text-white shadow-md transform scale-[1.02]" : "text-slate-400 hover:text-white"}`}
            >
              <span>📄</span> רשימה ועריכה
            </button>
            <button 
              onClick={() => setViewMode("BRACKET")} 
              className={`flex-1 md:w-32 py-2 rounded-lg font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 ${viewMode === "BRACKET" ? "bg-pink-600 text-white shadow-md transform scale-[1.02]" : "text-slate-400 hover:text-white"}`}
            >
              <span>🌳</span> מסלול לגמר
            </button>
         </div>
      </div>

      {viewMode === "BRACKET" && (
         <div className="bg-slate-900 rounded-3xl border border-purple-500/30 shadow-2xl p-4 md:p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-900/20 via-slate-900 to-slate-900 pointer-events-none z-0"></div>
            
            <div className="mb-6 flex items-center gap-2 text-purple-300 text-[10px] md:text-xs font-bold bg-purple-900/20 w-fit px-3 py-1.5 md:px-4 md:py-2 rounded-lg border border-purple-500/30 relative z-10 shadow-sm">
               <span>💡</span> לחץ על משחקי השלב הנוכחי כדי להזין ניחוש. השלבים הבאים מתמפים אוטומטית על בסיס התחזית שלך!
            </div>

            <div className="overflow-x-auto custom-scrollbar pb-6 relative z-10" dir="rtl">
               <div className={`flex min-w-max pt-6 ${dynamicHeight} items-stretch`}>
                  
                  {roundsToRender.map((round, idx) => {
                      const isFirst = idx === 0;
                      const isFinal = idx === roundsToRender.length - 1;
                      const count = expectedCounts[round];

                      return (
                          <React.Fragment key={round}>
                              {renderColumn(round, isFirst, isFinal)}
                              {!isFinal && renderConnectorCol(count / 2)}
                          </React.Fragment>
                      );
                  })}

               </div>
            </div>
         </div>
      )}

      {viewMode === "LIST" && (
        <div className="flex flex-col animate-fade-in-up">
          <div className="flex overflow-x-auto gap-2 mb-6 pb-2 custom-scrollbar bg-slate-900/50 p-2 rounded-2xl border border-slate-800/50">
            {rounds.map(round => {
              const hidden = isRoundHidden(round);
              const hasMatches = matches.some(m => m.roundName === round);
              
              return (
                <button
                  key={round}
                  disabled={hidden || !hasMatches}
                  onClick={() => setActiveRound(round)}
                  className={`px-4 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-sm border ${
                    activeRound === round 
                      ? "bg-purple-600 text-white border-purple-500 shadow-md" 
                      : hidden 
                        ? "bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed" 
                        : !hasMatches 
                          ? "bg-slate-900/80 text-slate-500 border-slate-800/50 cursor-not-allowed"
                          : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  {round} {hidden && "🔒"}
                </button>
              );
            })}
          </div>

          <div className="flex-1 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4 mb-6 gap-4">
              <h2 className="text-2xl font-bold text-white">
                {activeRound}
              </h2>
              
              {!isRoundLocked(activeRound) && roundMatches.length > 0 && (
                 <button 
                    onClick={handleRandomizeRound} 
                    disabled={isRandomizing}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs md:text-sm font-bold py-2 px-3 md:px-4 rounded-xl border border-slate-600 flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                 >
                   <span className="text-lg">🎲</span> {isRandomizing ? "מגריל..." : "הגרל שלב"}
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
                  <MatchCard key={match.id} match={match} userId={userId} tournamentState={tournamentState} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {bracketModalMatch && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in-up" dir="rtl">
          <div className="relative w-full max-w-lg">
             <button 
               onClick={() => setBracketModalMatch(null)} 
               className="absolute -top-4 -right-4 md:-right-10 md:-top-4 w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 border border-slate-600 text-slate-300 transition-colors font-bold text-xl z-50 shadow-xl"
             >
               ✕
             </button>
             <MatchCard match={bracketModalMatch} userId={userId} tournamentState={tournamentState} />
          </div>
        </div>
      )}
      {/* Footer עם קרדיט לאייקון - מעוצב בסגנון טשטוש זכוכית */}
      <footer className="mt-12 mx-auto max-w-2xl w-full" dir="ltr">
        <div className="bg-slate-900/60 backdrop-blur-sm p-4 rounded-2xl border border-slate-800 shadow-inner flex flex-col sm:flex-row items-center justify-center gap-3 text-center sm:text-left transition-all">
          
          {/* אייקון קטן של הגביע */}
          <div className="text-2xl drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]">🏆</div>
          
          {/* טקסט הקרדיט עם לינקים מעוצבים */}
          <p className="text-slate-500 text-xs font-medium leading-relaxed">
            World cup icons provided by{' '}
            <a 
              href="https://www.flaticon.com/free-icons/world-cup" 
              title="world cup icons"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 font-bold underline decoration-amber-500/30 decoration-dashed underline-offset-2 transition-colors"
            >
              Flaticon
            </a>
            . Created by{' '}
            <a 
              href="https://www.flaticon.com/authors/bankseengern" 
              title="BankSeeNgern - Flaticon"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 font-bold underline decoration-amber-500/30 decoration-dashed underline-offset-2 transition-colors"
            >
              BankSeeNgern
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}