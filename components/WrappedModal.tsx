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
      } catch (error) { console.error(error); } 
      finally { setIsLoadingMatches(false); }
    };
    fetchAllMatches();
  }, []);

  const totalSlides = nemesisData ? 8 : 7; // הוספנו שקף, אז העלינו את המספר
  useEffect(() => {
    if (currentSlide === totalSlides - 1) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, zIndex: 1000 });
    }
  }, [currentSlide, totalSlides]);

  // 1. מצב טעינה - משיכת נתונים ראשונית מהשרת
  if (isLoadingMatches) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center text-white text-center p-6" dir="rtl">
        <div className="animate-fade-in">
          <div className="text-5xl mb-4 animate-bounce">⚽</div>
          <h2 className="text-2xl font-black">מושך נתונים מהמגרש...</h2>
        </div>
      </div>
    );
  }

  // 2. מצב שגיאה - הטעינה הסתיימה אבל האדמין טרם יצר נתונים למשתמש הזה
  if (!data) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center text-white text-center p-6" dir="rtl">
        <div className="animate-fade-in relative bg-slate-900 border border-slate-700 p-8 rounded-3xl max-w-sm shadow-2xl">
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-rose-500 transition-colors font-bold">✕</button>
          <div className="text-5xl mb-4 opacity-80">📭</div>
          <h2 className="text-2xl font-black mb-2">הסיכום טרם מוכן</h2>
          <p className="text-slate-400 text-sm leading-relaxed">נראה שהאדמין עדיין לא סיים לחשב את הסיכום שלך, או שאין מספיק נתונים להציג. נסה שוב מאוחר יותר.</p>
        </div>
      </div>
    );
  }

  // תיקון הניקוד הכללי - בודק את כל השמות האופציונליים
  const displayPoints = Number(userStats.points || userStats.totalPoints || userStats.score || 0);

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

  const slides = [
    // שקף 1: פתיח
    {
      id: "intro",
      bg: "bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
          <div className="w-24 h-24 bg-indigo-500/20 rounded-full flex items-center justify-center mb-8 border border-indigo-500/30">
            <span className="text-5xl">🎬</span>
          </div>
          <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">הבתים ננעלו.</h2>
          <p className="text-xl text-indigo-300 font-medium">בוא נראה איזה חותם השארת על המונדיאל עד כה...</p>
        </div>
      )
    },
    // שקף 2: תעודת זהות
    {
      id: "identity",
      bg: "bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
           <h3 className="text-blue-400 font-black text-sm uppercase tracking-widest mb-8">תעודת זהות: שלב הבתים</h3>
           <div className="text-7xl font-black text-white mb-2">{displayPoints}</div>
           <div className="text-blue-300 font-bold mb-12">נקודות שצברת</div>
           <div className="grid grid-cols-2 gap-4 w-full">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 shadow-lg">
                 <div className="text-2xl mb-1">🎯</div>
                 <div className="text-2xl font-black text-white">{data.exactHits || 0}</div>
                 <div className="text-[10px] text-slate-400 font-bold uppercase">ניחושי בול</div>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 shadow-lg">
                 <div className="text-2xl mb-1">✅</div>
                 <div className="text-2xl font-black text-white">{data.directionHits || 0}</div>
                 <div className="text-[10px] text-slate-400 font-bold uppercase">כיוון נכון</div>
              </div>
           </div>
        </div>
      )
    },
    // שקף 3: יחסים דיפלומטיים
    {
      id: "groups",
      bg: "bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900",
      content: (
        <div className="flex flex-col items-center h-full text-center px-4 pt-12 animate-fade-in">
           <h3 className="text-teal-400 font-black text-sm uppercase tracking-widest mb-2">יחסים דיפלומטיים 🌍</h3>
           <p className="text-slate-400 text-xs font-bold mb-6">כמה נקודות כל בית סידר לך</p>
           <div className="w-full space-y-3 overflow-y-auto custom-scrollbar h-[60vh] pr-1 pb-10">
              {sortedGroups.map(([gName, val]: any, index: number) => {
                 const pts = Number(val || 0);
                 const isBest = index === 0 && pts > 0;
                 const teams = Array.from(groupTeams[gName] || []);
                 return (
                    <div key={gName} className={`p-4 rounded-2xl border flex flex-col transition-all ${isBest ? 'bg-amber-500/20 border-amber-500/60 shadow-lg scale-[1.02]' : 'bg-slate-800/40 border-slate-700/50'}`}>
                       <div className="flex justify-between items-center mb-2">
                          <span className={`text-xl font-black ${isBest ? 'text-amber-400' : 'text-slate-200'}`}>בית {gName} {isBest && "👑"}</span>
                          <span className={`text-xl font-black ${isBest ? 'text-amber-400' : 'text-slate-200'}`}>{pts} pts</span>
                       </div>
                       <div className="flex justify-end -space-x-2">
                          {teams.map(t => <img key={t} src={getFlagUrl(t)!} className="w-7 h-7 rounded-full border-2 border-slate-900 object-cover shadow-sm" />)}
                       </div>
                    </div>
                 );
              })}
           </div>
        </div>
      )
    },
    // שקף 4: הבונוסים (השקף החדש!)
    {
      id: "bonus_detailed",
      bg: "bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
           <div className="text-5xl mb-6">🎁</div>
           <h3 className="text-emerald-400 font-black text-sm uppercase tracking-widest mb-2">צייד הבונוסים</h3>
           <p className="text-slate-300 text-lg mb-10 font-medium italic">"מי שמשקיע, שוקע... בנקודות!"</p>
           
           <div className="w-full space-y-4">
              <div className="bg-white/5 p-5 rounded-2xl border border-white/10 flex items-center justify-between">
                 <div className="text-right">
                    <div className="text-white font-bold">הלחם והחמאה 🍞</div>
                    <div className="text-slate-400 text-xs">בונוסים רגילים שפגעת בהם</div>
                 </div>
                 <div className="text-3xl font-black text-emerald-400">{data.bonusBreakdown?.regular || 0}</div>
              </div>

              <div className="bg-amber-500/10 p-5 rounded-2xl border border-amber-500/20 flex items-center justify-between scale-[1.05] shadow-xl">
                 <div className="text-right">
                    <div className="text-amber-400 font-bold">המכפיל האכזרי ⚡</div>
                    <div className="text-amber-200/50 text-xs">פגיעות בבונוס דאבל (פי 2!)</div>
                 </div>
                 <div className="text-3xl font-black text-amber-400">{data.bonusBreakdown?.double || 0}</div>
              </div>

              <div className="bg-rose-500/10 p-5 rounded-2xl border border-rose-500/20 flex items-center justify-between">
                 <div className="text-right">
                    <div className="text-rose-400 font-bold">הנינג'ה של הליגה 🥷</div>
                    <div className="text-rose-200/50 text-xs">שאלות הפתעה שתפסת בזמן</div>
                 </div>
                 <div className="text-3xl font-black text-rose-400">{data.bonusBreakdown?.surprise || 0}</div>
              </div>
           </div>
        </div>
      )
    },
    // שקף 5: הניחוש הנדיר
    {
      id: "rare",
      bg: "bg-gradient-to-br from-slate-900 via-amber-950 to-slate-900",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
           <div className="text-4xl mb-4 animate-pulse">🦅</div>
           <h3 className="text-amber-400 font-black text-sm uppercase tracking-widest mb-4">עין הנץ: הניחוש הנדיר</h3>
           {data.rarestHit ? (
             <div className="bg-slate-900/80 p-8 rounded-[2.5rem] border-2 border-amber-500/50 shadow-xl w-full">
                <div className="text-amber-400 font-black mb-2 text-xl">{data.rarestHit.matchTitle}</div>
                <div className="text-5xl font-black text-white mb-6 tracking-widest">{data.rarestHit.score}</div>
                <div className="text-slate-400 text-sm font-bold">רק <span className="text-amber-400 text-lg">{data.rarestHit.percentage}%</span> פגעו כמוך!</div>
             </div>
           ) : <p className="text-slate-400 italic">לא נמצא ניחוש נדיר... עדיין.</p>}
        </div>
      )
    }
  ];

  if (nemesisData) {
    const diff = displayPoints - Number(nemesisData.points || nemesisData.totalPoints || 0);
    slides.push({
      id: "nemesis",
      bg: "bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
           <div className="text-7xl mb-6">⚔️</div>
           <h3 className="text-2xl text-rose-300 font-bold mb-10">ראש בראש מול {nemesisData.name.split(" ")[0]}</h3>
           <div className="flex items-center justify-center gap-6 mb-10 w-full">
              <div className="bg-blue-900/20 p-4 rounded-2xl border border-blue-500/30 w-28">
                 <span className="text-xs text-blue-300 font-bold">אתה</span>
                 <div className="text-4xl font-black text-white">{displayPoints}</div>
              </div>
              <div className="bg-rose-900/20 p-4 rounded-2xl border border-rose-500/30 w-28">
                 <span className="text-xs text-rose-300 font-bold">היריב</span>
                 <div className="text-4xl font-black text-rose-400">{Number(nemesisData.points || nemesisData.totalPoints || 0)}</div>
              </div>
           </div>
           <div className="text-xl font-black text-white bg-slate-900/60 py-4 px-6 rounded-2xl border border-slate-700">
              {diff > 0 ? `אתה מוביל ב-${diff} נקודות! 💪` : diff < 0 ? `אתה בפיגור של ${Math.abs(diff)} נקודות. הזמן למהפך! 😤` : "תיקו מוחלט! מי ימצמץ ראשון? 👀"}
           </div>
        </div>
      )
    });
  }

  // שקף סיום
  slides.push({
    id: "outro",
    bg: "bg-gradient-to-br from-slate-900 to-slate-950",
    content: (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
         <div className="text-7xl mb-6 animate-bounce">🔥</div>
         <h2 className="text-4xl font-black text-white mb-4">הכסף הגדול מתחיל עכשיו.</h2>
         <p className="text-xl text-slate-400 font-medium mb-10">בנוקאאוט הניקוד מוכפל. כל טעות קריטית, כל בול שווה זהב.</p>
         <button onClick={onClose} className="bg-emerald-500 text-emerald-950 px-8 py-5 rounded-2xl font-black text-2xl shadow-lg hover:scale-105 transition-transform w-full max-w-xs">יאללה לנוקאאוט! ⚽</button>
      </div>
    )
  });

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
            <div key={idx} className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden shadow-sm">
              <div className={`h-full bg-white transition-all duration-300 ${idx < currentSlide ? "w-full" : idx === currentSlide ? "w-full" : "w-0"}`} style={{ transitionDuration: idx === currentSlide ? '5s' : '0.3s' }} />
            </div>
          ))}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="absolute top-8 right-6 z-50 bg-black/30 text-white/70 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">✕</button>
        {slides[currentSlide].content}
      </div>
    </div>
  );
}