"use client";
import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import { getFlagUrl } from "../app/utils/flags";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../app/firebase";

export default function WrappedModal({ onClose, userName, userStats, allUsersList, nemesisData }: any) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fetchedMatches, setFetchedMatches] = useState<any[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);

  const myUser = allUsersList.find((u: any) => u.id === userStats.id || u.name === userName);
  const data = myUser?.wrappedData;

  useEffect(() => {
    const fetchAllMatches = async () => {
      try {
        const snap = await getDocs(collection(db, "matches"));
        setFetchedMatches(snap.docs.map(doc => doc.data()));
      } catch (error) {
        console.error("Error fetching matches:", error);
      } finally {
        setIsLoadingMatches(false);
      }
    };
    fetchAllMatches();
  }, []);

  const totalSlides = nemesisData ? 7 : 6;
  useEffect(() => {
    if (currentSlide === totalSlides - 1) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, zIndex: 1000 });
    }
  }, [currentSlide, totalSlides]);

  const groupTeams: Record<string, Set<string>> = {};
  fetchedMatches.forEach((m: any) => {
     if (m.stage !== "KNOCKOUT" && m.group) {
        if (!groupTeams[m.group]) groupTeams[m.group] = new Set();
        groupTeams[m.group].add(m.homeTeam);
        groupTeams[m.group].add(m.awayTeam);
     }
  });

  const pointsPerGroup = data?.pointsPerGroup || {};
  const sortedGroups = Object.entries(pointsPerGroup).sort((a: any, b: any) => Number(b[1] || 0) - Number(a[1] || 0));

  if (!data || isLoadingMatches) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center text-white text-center p-6" dir="rtl">
        <div className="animate-fade-in text-center">
          <div className="text-5xl mb-4 animate-bounce">⚽</div>
          <h2 className="text-2xl font-black">הסיכום שלך מתבשל...</h2>
          <p className="text-slate-400 text-sm mt-2 font-medium">האדמין מנתח את הביצועים, מיד זה מוכן.</p>
          <button onClick={onClose} className="mt-8 px-6 py-2 bg-slate-800 rounded-full text-blue-400 font-bold hover:bg-slate-700 transition-all">סגור</button>
        </div>
      </div>
    );
  }

  // תיקון הניקוד הכללי - בודק את כל השמות האופציונליים לשדה הניקוד
  const displayPoints = Number(userStats.points || userStats.totalPoints || 0);

  const slides = [
    {
      id: "intro",
      bg: "bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
          <div className="w-24 h-24 bg-indigo-500/20 rounded-full flex items-center justify-center mb-8 border border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
            <span className="text-5xl">🎬</span>
          </div>
          <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">הבתים ננעלו.</h2>
          <p className="text-xl text-indigo-300 font-medium">בוא נראה איזה חותם השארת על המונדיאל עד כה...</p>
          <div className="mt-16 flex flex-col items-center gap-2">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">לחץ להמשך</span>
            <div className="w-1 h-8 bg-gradient-to-b from-indigo-500 to-transparent animate-bounce rounded-full"></div>
          </div>
        </div>
      )
    },
    {
      id: "identity",
      bg: "bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
           <h3 className="text-blue-400 font-black text-sm uppercase tracking-widest mb-8">תעודת זהות: שלב הבתים</h3>
           <div className="text-7xl font-black text-white mb-2">{displayPoints}</div>
           <div className="text-blue-300 font-bold mb-12">נקודות שצברת</div>
           
           <div className="grid grid-cols-2 gap-4 w-full">
              <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-lg">
                 <div className="text-2xl mb-1 text-emerald-400">🎯</div>
                 <div className="text-2xl font-black text-white">{data.exactHits || 0}</div>
                 <div className="text-[10px] text-slate-400 font-bold uppercase">ניחושי בול</div>
              </div>
              <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-lg">
                 <div className="text-2xl mb-1 text-blue-400">✅</div>
                 <div className="text-2xl font-black text-white">{data.directionHits || 0}</div>
                 <div className="text-[10px] text-slate-400 font-bold uppercase">כיוון נכון</div>
              </div>
           </div>
           <div className="mt-8 text-xl font-bold text-white">מקום <span className="text-amber-400 text-2xl">{userStats.rank || "?"}</span> מתוך {allUsersList.length}</div>
        </div>
      )
    },
    {
      id: "groups",
      bg: "bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900",
      content: (
        <div className="flex flex-col items-center h-full text-center px-4 pt-8 animate-fade-in">
           <div className="w-full pb-4 shrink-0">
              <h3 className="text-teal-400 font-black text-sm uppercase tracking-widest mt-2">יחסים דיפלומטיים 🌍</h3>
              <p className="text-slate-400 text-xs font-bold mt-1">כמה נקודות כל בית סידר לך</p>
           </div>
           
           <div className="w-full space-y-3 mt-2 pb-12 overflow-y-auto custom-scrollbar h-[65vh] pr-1">
              {sortedGroups.length > 0 ? sortedGroups.map(([gName, val]: any, index: number) => {
                 const pts = Number(val || 0);
                 const isBest = index === 0 && pts > 0;
                 const isWorst = index === sortedGroups.length - 1 && sortedGroups.length > 1;
                 const teams = Array.from(groupTeams[gName] || []);
                 
                 let title = "אחלה גברים שבעולם";
                 let emoji = "🤝";
                 let bg = "bg-slate-800/40 border-slate-700/50";
                 let textColor = "text-slate-300";
                 
                 if (isBest) {
                    title = "BFFs! הבית המנצח שלך";
                    emoji = "👑";
                    bg = "bg-amber-500/20 border-amber-500/60 shadow-[0_0_25px_rgba(245,158,11,0.25)] scale-[1.02] z-10";
                    textColor = "text-amber-400";
                 } else if (isWorst) {
                    title = "רשימת החיסול שלך";
                    emoji = "🤬";
                    bg = "bg-rose-500/10 border-rose-500/30 opacity-80";
                    textColor = "text-rose-400";
                 }

                 return (
                    <div key={gName} className={`relative p-4 rounded-2xl border flex flex-col justify-between transition-all duration-500 ${bg}`}>
                       {isBest && <div className="absolute -top-3 -right-2 bg-amber-500 text-amber-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg z-20">TOP SCORER</div>}
                       
                       <div className="flex justify-between w-full items-center mb-3 px-1">
                          <div className={`text-2xl font-black ${textColor}`}>בית {gName}</div>
                          <div className={`text-2xl font-black ${textColor}`}>{pts} <span className="text-xs font-bold opacity-70">pts</span></div>
                       </div>
                       
                       <div className="flex w-full justify-between items-center bg-black/40 rounded-xl p-2.5 border border-white/5">
                           <div className="text-[11px] font-bold text-slate-200 flex items-center gap-2">
                              <span className="text-lg">{emoji}</span> {title}
                           </div>
                           <div className="flex -space-x-2.5 flex-row-reverse">
                              {teams.map(team => (
                                 <img 
                                    key={team} 
                                    src={getFlagUrl(team)!} 
                                    alt={team} 
                                    className="w-8 h-8 rounded-full border-2 border-slate-900 object-cover shadow-md"
                                 />
                              ))}
                           </div>
                       </div>
                    </div>
                 );
              }) : (
                 <p className="text-slate-400 text-sm mt-10 italic">הנתונים יופיעו כאן מיד...</p>
              )}
           </div>
        </div>
      )
    },
    {
      id: "achievements",
      bg: "bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
           <h3 className="text-purple-400 font-black text-sm uppercase tracking-widest mb-8">מחוץ לכר הדשא</h3>
           <div className="w-full space-y-4">
              <div className="bg-purple-900/20 border border-purple-500/30 p-5 rounded-2xl shadow-lg text-right">
                 <div className="text-3xl mb-2">🌍</div>
                 <div className="text-lg font-bold text-white mb-1">תחזית הבתים</div>
                 <div className="text-sm text-slate-300">פגעת בול ב-<span className="text-purple-400 font-black text-lg">{data.qualStats?.exact || 0}</span> מתוך 24 עולות!</div>
              </div>
              <div className="bg-pink-900/20 border border-pink-500/30 p-5 rounded-2xl shadow-lg text-right">
                 <div className="text-3xl mb-2">🥉</div>
                 <div className="text-lg font-bold text-white mb-1">המעפילות (מקום 3)</div>
                 <div className="text-sm text-slate-300">תפסת <span className="text-pink-400 font-black text-lg">{data.thirdPlaceHitsCount || 0}</span> נבחרות.</div>
              </div>
              <div className="bg-amber-900/20 border border-amber-500/30 p-5 rounded-2xl shadow-lg text-right">
                 <div className="text-3xl mb-2">🎁</div>
                 <div className="text-lg font-bold text-white mb-1">צייד הבונוסים</div>
                 <div className="text-sm text-slate-300">גרפת קופה על <span className="text-amber-400 font-black text-lg">{data.bonusHitsCount || 0}</span> שאלות.</div>
              </div>
           </div>
        </div>
      )
    },
    {
      id: "rare",
      bg: "bg-gradient-to-br from-slate-900 via-amber-950 to-slate-900",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
           <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mb-6 border border-amber-500/30">
              <span className="text-4xl animate-pulse">🦅</span>
           </div>
           <h3 className="text-amber-400 font-black text-sm uppercase tracking-widest mb-4">עין הנץ: הניחוש הנדיר</h3>
           {data.rarestHit ? (
             <div className="bg-slate-900/80 p-8 rounded-[2.5rem] border-2 border-amber-500/50 shadow-[0_0_40px_rgba(245,158,11,0.2)] w-full relative">
                <div className="text-amber-400 font-black mb-2 text-xl">{data.rarestHit.matchTitle}</div>
                <div className="text-5xl font-black text-white mb-6 tracking-widest">{data.rarestHit.score}</div>
                <div className="text-slate-400 text-sm font-bold">פגעת בבול שרק <span className="text-amber-400 text-lg">{data.rarestHit.percentage}%</span> הצליחו לתפוס!</div>
             </div>
           ) : <p className="text-slate-400 italic font-medium">לא נמצא ניחוש נדיר במיוחד...</p>}
        </div>
      )
    },
    {
      id: "outro",
      bg: "bg-gradient-to-br from-slate-900 to-slate-950",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
           <div className="text-7xl mb-6 animate-bounce text-emerald-500">🔥</div>
           <h2 className="text-4xl font-black text-white mb-4">הכסף הגדול מתחיל עכשיו.</h2>
           <p className="text-xl text-slate-400 font-medium mb-10 leading-relaxed">בנוקאאוט הניקוד מוכפל. כל טעות קריטית, כל בול שווה זהב.</p>
           <button onClick={onClose} className="bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 px-8 py-5 rounded-2xl font-black text-2xl shadow-[0_0_30px_rgba(52,211,153,0.3)] hover:scale-105 transition-transform w-full max-w-xs">יאללה לנוקאאוט! ⚽</button>
        </div>
      )
    }
  ];

  if (nemesisData) {
    const diff = displayPoints - Number(nemesisData.points || nemesisData.totalPoints || 0);
    slides.splice(slides.length - 1, 0, {
      id: "nemesis",
      bg: "bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
           <div className="text-7xl mb-6 drop-shadow-[0_0_20px_rgba(225,29,72,0.8)]">⚔️</div>
           <h3 className="text-2xl text-rose-300 font-bold mb-10">ראש בראש מול {nemesisData.name.split(" ")[0]}</h3>
           <div className="flex items-center justify-center gap-6 mb-10 w-full">
              <div className="flex flex-col items-center bg-blue-900/20 p-4 rounded-2xl border border-blue-500/30 w-28 shadow-lg">
                 <span className="text-xs text-blue-300 mb-1 font-bold">אתה</span>
                 <span className="text-4xl font-black text-white">{displayPoints}</span>
              </div>
              <div className="text-2xl text-slate-600 font-black text-center">VS</div>
              <div className="flex flex-col items-center bg-rose-900/20 p-4 rounded-2xl border border-rose-500/30 w-28 shadow-lg">
                 <span className="text-xs text-rose-300 mb-1 font-bold">היריב</span>
                 <span className="text-4xl font-black text-rose-400">{Number(nemesisData.points || nemesisData.totalPoints || 0)}</span>
              </div>
           </div>
           <div className="text-xl font-black text-white bg-slate-900/60 py-4 px-6 rounded-2xl border border-slate-700 shadow-xl mx-4">
              {diff > 0 ? `אתה מוביל ב-${diff} נקודות! 💪` : diff < 0 ? `אתה בפיגור של ${Math.abs(diff)} נקודות. הזמן למהפך! 😤` : "תיקו מוחלט! מי ימצמץ ראשון? 👀"}
           </div>
        </div>
      )
    });
  }

  const handleScreenClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const clickX = e.clientX;
    const screenWidth = window.innerWidth;
    if (clickX < screenWidth / 3) {
      if (currentSlide > 0) setCurrentSlide(prev => prev - 1);
    } else {
      if (currentSlide < slides.length - 1) setCurrentSlide(prev => prev + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md" dir="rtl">
      <div className={`relative w-full h-full max-w-md mx-auto shadow-2xl transition-colors duration-700 ${slides[currentSlide].bg}`} onClick={handleScreenClick}>
        <div className="absolute top-4 left-4 right-4 flex gap-1.5 z-50">
          {slides.map((_, idx) => (
            <div key={idx} className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden">
              <div className={`h-full bg-white transition-all duration-300 ${idx < currentSlide ? "w-full" : idx === currentSlide ? "w-full" : "w-0"}`} style={{ transitionDuration: idx === currentSlide ? '5s' : '0.3s' }} />
            </div>
          ))}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="absolute top-8 right-6 z-50 bg-black/30 hover:bg-black/50 text-white/70 hover:text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm backdrop-blur-md transition-all">✕</button>
        {slides[currentSlide].content}
      </div>
    </div>
  );
}