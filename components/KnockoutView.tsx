"use client";
import React, { useState, useEffect } from "react";
import MatchCard from "./MatchCard";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import Image from "next/image"; 
import { db } from "../app/firebase";
import { getFlagUrl } from "../app/utils/flags"; 
import toast from "react-hot-toast";
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";

// קומפוננטת עזר חכמה לכפתורי הזום
const ZoomControls = () => {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute bottom-6 left-6 z-50 flex gap-2 bg-slate-950/80 p-2 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-sm" dir="rtl">
       <button onClick={() => zoomIn()} className="w-10 h-10 flex items-center justify-center bg-slate-800 rounded-xl text-white text-xl font-black hover:bg-slate-700 hover:text-blue-400 transition-colors shadow-sm">+</button>
       <button onClick={() => zoomOut()} className="w-10 h-10 flex items-center justify-center bg-slate-800 rounded-xl text-white text-2xl font-black hover:bg-slate-700 hover:text-blue-400 transition-colors shadow-sm">-</button>
       <button onClick={() => resetTransform()} className="px-4 h-10 flex items-center justify-center bg-slate-800 rounded-xl text-slate-400 text-xs font-bold hover:bg-slate-700 hover:text-white transition-colors shadow-sm">מרכז עץ</button>
    </div>
  );
};

export default function KnockoutView({ matches, userId, tournamentState }: { matches: any[], userId: string, tournamentState: number }) {
  const rounds = ["32 הגדולות", "שמינית גמר", "רבע גמר", "חצי גמר", "גמר"];
  const [activeRound, setActiveRound] = useState(rounds[0]);
  const [viewMode, setViewMode] = useState<"LIST" | "BRACKET">("BRACKET");
  const [bracketModalMatch, setBracketModalMatch] = useState<any | null>(null);
  const [knockoutPreds, setKnockoutPreds] = useState<any>({});

  const roundMatches = matches.filter(m => {
     if (activeRound === "גמר") return m.roundName === "גמר" || m.roundName === "מקום שלישי";
     return m.roundName === activeRound;
  });

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, "predictions_knockout"), where("userId", "==", userId));
    const unsubscribe = onSnapshot(q, (snap) => {
      setKnockoutPreds((prev: any) => {
         const newPreds: any = { ...prev };
         snap.forEach(doc => {
            newPreds[doc.data().matchId] = doc.data();
         });
         return newPreds;
      });
    });
    return () => unsubscribe();
  }, [userId]);

  const isRoundHidden = (round: string) => {
    const limits: Record<string, number> = { "32 הגדולות": 4, "שמינית גמר": 6, "רבע גמר": 8, "חצי גמר": 10, "גמר": 12, "מקום שלישי": 12 };
    return tournamentState < (limits[round] || 0);
  };

  const isRoundLocked = (round: string) => {
    const limits: Record<string, number> = { "32 הגדולות": 5, "שמינית גמר": 7, "רבע גמר": 9, "חצי גמר": 11, "גמר": 13, "מקום שלישי": 13  };
    return tournamentState >= (limits[round] || 0);
  };

  const handleSelectQualifier = (nodeId: string, teamName: string) => {
     setKnockoutPreds((prev: any) => ({ ...prev, [nodeId]: { ...prev[nodeId], qualifier: teamName } }));
     toast.success(`בחרת ב-${teamName} כעולה! ⚽`);
  };

  const handleRandomizeRound = () => {
    toast((t) => (
      <div className="flex flex-col gap-3 text-right" dir="rtl">
        <span className="font-bold text-slate-800 text-sm">האם להגריל ניחושים אקראיים לשלב {activeRound}?</span>
        <div className="flex gap-2">
          <button onClick={() => {
            toast.dismiss(t.id);
            setTimeout(() => {
               const newPreds = { ...knockoutPreds };
               roundMatches.forEach(m => {
                  const hScore = Math.floor(Math.random() * 4);
                  const aScore = Math.floor(Math.random() * 4);
                  let qual = hScore > aScore ? m.homeTeam : aScore > hScore ? m.awayTeam : (Math.random() > 0.5 ? m.homeTeam : m.awayTeam);
                  newPreds[m.id] = { predictedHomeScore: hScore, predictedAwayScore: aScore, qualifier: qual };
               });
               setKnockoutPreds(newPreds);
               toast.success("🎲 הניחושים הוגרלו!");
            }, 600);
          }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all">כן, הגרל</button>
          <button onClick={() => toast.dismiss(t.id)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">בטל</button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const expectedCounts: Record<string, number> = { "32 הגדולות": 16, "שמינית גמר": 8, "רבע גמר": 4, "חצי גמר": 2, "גמר": 1 };
  const treeMatchesByRound: Record<string, any[]> = {};
  let previousRoundMatches: any[] = [];

  rounds.forEach(round => {
      const realMatches = matches.filter(m => m.roundName === round).sort((a,b) => {
          const numA = parseInt(a.id.replace(/\D/g, '') || "0");
          const numB = parseInt(b.id.replace(/\D/g, '') || "0");
          return numA - numB;
      });
      
      const count = expectedCounts[round] || 0;
      const nodes = [];
      for (let i = 0; i < count; i++) {
           const realMatch = realMatches[i];
           let pHome = realMatch ? realMatch.homeTeam : "";
           let pAway = realMatch ? realMatch.awayTeam : "";
           if (previousRoundMatches.length > 0) {
               const prev1 = previousRoundMatches[i * 2];
               const prev2 = previousRoundMatches[i * 2 + 1];
               if (prev1) pHome = prev1.isFinished ? prev1.realQualifier : (knockoutPreds[prev1.id]?.qualifier || prev1.projectedHome);
               if (prev2) pAway = prev2.isFinished ? prev2.realQualifier : (knockoutPreds[prev2.id]?.qualifier || prev2.projectedAway);
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
               originalMatch: realMatch,
               realQualifier: realMatch ? realMatch.realQualifier : ""
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
    const qual = node.isFinished ? node.realQualifier : knockoutPreds[node.id]?.qualifier;

    return (
      <div 
        onClick={() => {
            if (hidden && !isDummy) toast('שלב זה טרם נפתח לניחושים', { icon: '🔒', style: { background: '#334155', color: '#cbd5e1' } });
            else if (isDummy) toast('🔮 זוהי תחזית בלבד. בחר עולות בכפתורים מטה.', { icon: '🔮', style: { background: '#334155', color: '#cbd5e1', border: '1px solid #475569', fontSize: '14px' } });
            else {
                setBracketModalMatch({
                    ...node.originalMatch,
                    homeTeam: node.projectedHome || node.originalMatch.homeTeam,
                    awayTeam: node.projectedAway || node.originalMatch.awayTeam
                });
            }
        }}
        className={`border-2 rounded-xl p-1.5 flex flex-col gap-0.5 shadow-lg relative z-10 transition-all h-fit w-40 sm:w-44 bg-slate-800 ${
            isFinal ? "shadow-[0_0_40px_rgba(251,191,36,0.6)] border-amber-400 bg-slate-900 w-52 sm:w-60" : 
            isDummy ? "bg-slate-800/40 border-slate-700/50 border-dashed" : 
            hidden ? "bg-slate-800/40 border-slate-700/50 border-dashed cursor-not-allowed opacity-80" :
            locked ? "border-slate-700 opacity-95" : "border-slate-700 hover:border-purple-500 cursor-pointer group"
        }`}
        dir="rtl"
      >
          {isFinal && (
             <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-16 h-20 drop-shadow-[0_0_15px_rgba(251,191,36,0.9)] z-20 pointer-events-none">
                 <Image src="/world-cup.png" alt="Cup" width={100} height={120} className="w-full h-full object-contain" priority />
             </div>
          )}
          
          {isDummy && <div className="absolute -top-2 -right-2 text-[9px] bg-purple-600/90 border border-purple-500 text-white px-2 py-0.5 rounded-md z-10">🔮 סימולציה</div>}
          {!isDummy && hidden && <div className="absolute -top-2 -right-2 text-[9px] bg-slate-800 border border-slate-600 text-slate-400 px-1.5 py-0.5 rounded-md z-10 uppercase">🔒 נעול</div>}
          {!isDummy && !hidden && locked && <div className="absolute -top-2 -right-2 text-[10px] bg-slate-950 border border-slate-700 text-slate-400 px-1.5 py-0.5 rounded-md z-10">🔒</div>}
          {!isDummy && !hidden && !locked && <div className="absolute -top-2 -right-2 text-[10px] bg-purple-600 border border-purple-500 text-white px-1.5 py-0.5 rounded-md z-10 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">ערוך</div>}

          {[node.projectedHome, node.projectedAway].map((team, idx) => (
            <React.Fragment key={idx}>
              <div className={`flex justify-between items-center text-xs sm:text-sm font-bold px-1.5 py-1 rounded transition-colors ${qual === team && team !== "" ? (isFinal ? "bg-amber-400 text-slate-950" : "bg-emerald-500/20 text-emerald-400") : "text-slate-200"}`}>
                 <div className="flex items-center gap-1.5 truncate">
                    {getFlagUrl(team) ? <img src={getFlagUrl(team)!} className="w-4 h-3 object-cover rounded-sm" alt="" /> : "🏳️"}
                    <span className="truncate">{team || "TBD"}</span>
                 </div>
                 {idx === 0 && node.realHomeScore !== undefined && !isDummy && <span className="font-black text-slate-400 ml-1">{node.realHomeScore}</span>}
                 {idx === 0 && knockoutPreds[node.id]?.predictedHomeScore !== undefined && !node.isFinished && !isDummy && <span className="font-black text-slate-400 ml-1">{knockoutPreds[node.id].predictedHomeScore}</span>}
                 {idx === 1 && node.realAwayScore !== undefined && !isDummy && <span className="font-black text-slate-400 ml-1">{node.realAwayScore}</span>}
                 {idx === 1 && knockoutPreds[node.id]?.predictedAwayScore !== undefined && !node.isFinished && !isDummy && <span className="font-black text-slate-400 ml-1">{knockoutPreds[node.id].predictedAwayScore}</span>}
              </div>
              {idx === 0 && <div className={`w-full h-px ${isFinal ? 'bg-amber-600/30' : 'bg-slate-700/50'} my-0.5`}></div>}
            </React.Fragment>
          ))}

          {isDummy && !node.isFinished && (node.projectedHome || node.projectedAway) && (
             <div className="flex gap-1 mt-2 p-1 bg-slate-950/50 rounded-lg justify-around relative z-30">
                {[node.projectedHome, node.projectedAway].map((team, idx) => (
                  <button key={idx} disabled={!team} onClick={(e) => { e.stopPropagation(); if(team) handleSelectQualifier(node.id, team); }}
                    className={`text-[9px] font-black px-2 py-0.5 rounded-md border flex-1 mx-0.5 transition-colors ${qual === team && team ? "bg-purple-600/30 text-purple-300 border-purple-500/30" : "bg-slate-900 text-slate-500 border-slate-700/50 hover:bg-slate-800"} ${!team ? 'opacity-30 cursor-not-allowed' : ''}`}>
                    בחר: {team || (idx===0 ? "בית" : "חוץ")}
                  </button>
                ))}
             </div>
          )}
      </div>
    );
  };

  const renderSide = (side: "LEFT" | "RIGHT") => {
    const displayRounds = ["32 הגדולות", "שמינית גמר", "רבע גמר", "חצי גמר"];
    if (side === "RIGHT") displayRounds.reverse();
    
    return (
      <div className="flex items-stretch h-[680px] shrink-0">
        {displayRounds.map((round, idx) => {
          const allMatches = treeMatchesByRound[round] || [];
          const count = expectedCounts[round] || 0;
          const halfCount = count / 2;
          const sideMatches = side === "LEFT" ? allMatches.slice(0, halfCount) : allMatches.slice(halfCount);
          
          const isFirst = (side === "LEFT" && idx === 0) || (side === "RIGHT" && idx === displayRounds.length - 1);
          const isLast = (side === "LEFT" && idx === displayRounds.length - 1) || (side === "RIGHT" && idx === 0);

          return (
            <React.Fragment key={round}>
              {side === "RIGHT" && !isLast && (
                <div className="w-8 shrink-0 h-full flex flex-col py-6">
                   <div className="grid h-full w-full" style={{ gridTemplateRows: `repeat(${halfCount / 2}, minmax(0, 1fr))` }}>
                       {Array.from({length: halfCount / 2}).map((_, i) => (
                           <div key={i} className="flex items-center justify-center w-full h-full relative">
                               <div className="absolute w-full h-1/2 border-l-2 border-y-2 rounded-l-xl right-0 border-slate-600 z-0"></div>
                           </div>
                       ))}
                   </div>
                </div>
              )}

              <div className="flex flex-col justify-around h-full w-44 sm:w-48 px-2 relative shrink-0">
                <div className="absolute top-0 w-full text-center text-[10px] text-slate-500 font-black uppercase tracking-widest pt-2">
                  {round}
                </div>
                {sideMatches.map(node => (
                  <div key={node.id} className="w-full flex justify-center z-10 relative">
                     {!isFirst && side === "LEFT" && <div className="absolute left-0 top-1/2 w-2 border-t-2 border-slate-600 -z-10 -ml-2"></div>}
                     {!isLast && side === "RIGHT" && <div className="absolute right-0 top-1/2 w-2 border-t-2 border-slate-600 -z-10 -mr-2"></div>}
                     
                     {renderBracketNode(node)}
                     
                     {!isLast && side === "LEFT" && <div className="absolute right-0 top-1/2 w-2 border-t-2 border-slate-600 -z-10 -mr-2"></div>}
                     {!isFirst && side === "RIGHT" && <div className="absolute left-0 top-1/2 w-2 border-t-2 border-slate-600 -z-10 -ml-2"></div>}
                  </div>
                ))}
              </div>
              
              {side === "LEFT" && !isLast && (
                <div className="w-8 shrink-0 h-full flex flex-col py-6">
                   <div className="grid h-full w-full" style={{ gridTemplateRows: `repeat(${halfCount / 2}, minmax(0, 1fr))` }}>
                       {Array.from({length: halfCount / 2}).map((_, i) => (
                           <div key={i} className="flex items-center justify-center w-full h-full relative">
                               <div className="absolute w-full h-1/2 border-r-2 border-y-2 rounded-r-xl left-0 border-slate-600 z-0"></div>
                           </div>
                       ))}
                   </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderThirdPlaceNode = () => {
     const real3rd = matches.find(m => m.roundName === "מקום שלישי");
     let p3rdHome = real3rd ? real3rd.homeTeam : "";
     let p3rdAway = real3rd ? real3rd.awayTeam : "";

     const semiFinalNodes = treeMatchesByRound["חצי גמר"] || [];
     if (semiFinalNodes.length === 2) {
         const sf1 = semiFinalNodes[0];
         const sf2 = semiFinalNodes[1];
         const getLoser = (node: any) => {
             const winner = node.isFinished ? node.realQualifier : knockoutPreds[node.id]?.qualifier;
             if (!winner) return "";
             if (winner === node.projectedHome) return node.projectedAway;
             if (winner === node.projectedAway) return node.projectedHome;
             return "";
         };
         const sf1Loser = getLoser(sf1);
         const sf2Loser = getLoser(sf2);
         if (sf1Loser) p3rdHome = sf1Loser;
         if (sf2Loser) p3rdAway = sf2Loser;
     }
     
     return {
         id: real3rd ? real3rd.id : `dummy_3rd`,
         isDummy: !real3rd,
         roundName: "מקום שלישי",
         projectedHome: p3rdHome,
         projectedAway: p3rdAway,
         isFinished: real3rd ? real3rd.isFinished : false,
         realHomeScore: real3rd ? real3rd.realHomeScore : undefined,
         realAwayScore: real3rd ? real3rd.realAwayScore : undefined,
         originalMatch: real3rd,
         realQualifier: real3rd ? real3rd.realQualifier : ""
     };
  };

  let initialZoom = 0.35;
  if (tournamentState >= 12) initialZoom = 1.0;
  else if (tournamentState >= 10) initialZoom = 0.8;
  else if (tournamentState >= 8) initialZoom = 0.55;
  else if (tournamentState >= 6) initialZoom = 0.45;

  return (
    <div className="w-full pb-8">
      <div className="sticky top-[72px] md:top-[88px] z-40 bg-slate-950/85 backdrop-blur-xl p-4 rounded-3xl border border-slate-700 mb-8 flex justify-between items-center shadow-2xl">
         <h2 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 flex items-center gap-2"><span>🔥</span> שלבי הנוק-אאוט</h2>
         <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button onClick={() => setViewMode("LIST")} className={`px-4 py-2 rounded-lg font-bold text-xs ${viewMode === "LIST" ? "bg-purple-600 text-white" : "text-slate-400"}`}>רשימה</button>
            <button onClick={() => setViewMode("BRACKET")} className={`px-4 py-2 rounded-lg font-bold text-xs ${viewMode === "BRACKET" ? "bg-pink-600 text-white" : "text-slate-400"}`}>עץ אינטראקטיבי</button>
         </div>
      </div>

      {viewMode === "BRACKET" ? (
        <div dir="ltr" className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden h-[500px] md:h-[650px] relative w-full">
          {/* התיקון העיקרי לזום ולגלילה: 
              minScale=0.3 מונע ממנו להפוך לנקודה.
              wheel.step=0.05 מרכך את הגלילה.
              panning.velocityDisabled מונע גלישה מיותרת. */}
          <TransformWrapper 
            key={`zoom-${initialZoom}`} 
            initialScale={initialZoom} 
            minScale={0.3} 
            maxScale={1.5} 
            centerOnInit={true}
            centerZoomedOut={true}
            wheel={{ step: 0.05 }}
            panning={{ velocityDisabled: true }}
          >
            <ZoomControls />
            <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "2100px", height: "680px" }}>
               <div className="flex items-center justify-between w-[2100px] h-[680px] px-8" dir="ltr">
                  
                  {renderSide("LEFT")}
                  
                  <div className="flex flex-col items-center justify-center w-64 md:w-80 shrink-0 h-full relative z-10 mx-6">
                     
                     <div className="absolute top-12 text-3xl font-black text-amber-400 uppercase tracking-widest drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]">
                       The Final
                     </div>
                     
                     <div className="relative z-10 bg-slate-900 rounded-3xl shadow-2xl scale-110 mb-8 mt-12 transition-transform hover:scale-[1.15]">
                        {renderBracketNode(treeMatchesByRound["גמר"] ? treeMatchesByRound["גמר"][0] : null, true)}
                     </div>
                     
                     <div className="absolute bottom-12 flex flex-col items-center gap-3 w-full">
                        <div className="text-[10px] text-orange-400 font-black uppercase border-b-2 border-orange-500/50 pb-1 w-2/3 text-center tracking-widest">מקום 3-4</div>
                        {renderBracketNode(renderThirdPlaceNode(), false)}
                     </div>
                  </div>

                  {renderSide("RIGHT")}
                  
               </div>
            </TransformComponent>
          </TransformWrapper>
        </div>
      ) : (
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
                    activeRound === round ? "bg-purple-600 text-white border-purple-500" : 
                    hidden ? "bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed" : 
                    !hasMatches ? "bg-slate-900/80 text-slate-500 border-slate-800/50 cursor-not-allowed" : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  {round} {hidden && "🔒"}
                </button>
              );
            })}
          </div>

          <div className="flex-1 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4 mb-6 gap-4">
              <h2 className="text-2xl font-bold text-white">{activeRound}</h2>
              {!isRoundLocked(activeRound) && roundMatches.length > 0 && (
                 <button onClick={handleRandomizeRound} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm font-bold shadow-sm">🎲 הגרל שלב</button>
              )}
            </div>
            {roundMatches.length === 0 ? (
              <div className="text-center py-12 text-slate-500">אין משחקים לשלב זה כרגע.</div>
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
             <button onClick={() => setBracketModalMatch(null)} className="absolute -top-4 -right-4 w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 text-slate-300 font-bold z-50">✕</button>
             <MatchCard match={bracketModalMatch} userId={userId} tournamentState={tournamentState} />
          </div>
        </div>
      )}
      
      <footer className="mt-8 text-center text-slate-600 text-[10px]">Icons by Flaticon. Logic by Tech Lead Gemini.</footer>
    </div>
  );
}