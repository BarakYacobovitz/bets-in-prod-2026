"use client";
import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";

export default function WrappedModal({ onClose, userName, userStats, allUsersList, nemesisData }: any) {
  const [currentSlide, setCurrentSlide] = useState(0);

  // משיכת הנתונים המוכנים שהסקריפט באדמין יצר
  const myUser = allUsersList.find((u: any) => u.id === userStats.id || u.name === userName);
  const data = myUser?.wrappedData;

  // אם הנתונים עוד לא חושבו, נציג הודעת טעינה/שגיאה
  if (!data) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center text-white text-center p-6" dir="rtl">
        <div>
          <div className="text-4xl mb-4 animate-spin">⚽</div>
          <h2 className="text-xl font-bold">הסיכום שלך מתבשל...</h2>
          <p className="text-slate-400 text-sm mt-2">האדמין מכין את הנתונים, מיד זה מוכן.</p>
          <button onClick={onClose} className="mt-6 text-blue-400 underline font-bold">סגור</button>
        </div>
      </div>
    );
  }

  const slides = [
    // שקף 1: פתיח דרמטי
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
    // שקף 2: תעודת הזהות (דירוג ובולים)
    {
      id: "identity",
      bg: "bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
           <h3 className="text-blue-400 font-black text-sm uppercase tracking-widest mb-8">תעודת זהות: שלב הבתים</h3>
           <div className="text-7xl font-black text-white mb-2">{userStats.points}</div>
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
           <div className="mt-8 text-xl font-bold text-white">מקום <span className="text-amber-400 text-2xl">{userStats.rank}</span> מתוך {allUsersList.length}</div>
        </div>
      )
    },
    // שקף 3: מחוץ לדשא - עולות, מקום 3 ובונוסים (השקף החדש!)
    {
      id: "achievements",
      bg: "bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
           <h3 className="text-purple-400 font-black text-sm uppercase tracking-widest mb-8">מחוץ לכר הדשא</h3>
           
           <div className="w-full space-y-4">
              {/* העולות מבתים */}
              <div className="bg-purple-900/20 border border-purple-500/30 p-5 rounded-2xl shadow-lg">
                 <div className="text-3xl mb-2">🌍</div>
                 <div className="text-lg font-bold text-white mb-1">תחזית הבתים</div>
                 <div className="text-sm text-slate-300">
                    פגעת בול ב-<span className="text-purple-400 font-black text-lg">{data.qualStats?.exact || 0}</span> מתוך 24 עולות!
                    {data.qualStats?.direction > 0 && <span className="block mt-1">ועוד {data.qualStats?.direction} בכיוון הנכון.</span>}
                 </div>
              </div>

              {/* מעפילות מקום שלישי */}
              <div className="bg-pink-900/20 border border-pink-500/30 p-5 rounded-2xl shadow-lg">
                 <div className="text-3xl mb-2">🥉</div>
                 <div className="text-lg font-bold text-white mb-1">המעפילות (מקום 3)</div>
                 <div className="text-sm text-slate-300">
                    תפסת <span className="text-pink-400 font-black text-lg">{data.thirdPlaceHitsCount || 0}</span> מתוך 8 הנבחרות שהשחילו את דרכן לשמינית.
                 </div>
              </div>

              {/* בונוסים */}
              <div className="bg-amber-900/20 border border-amber-500/30 p-5 rounded-2xl shadow-lg">
                 <div className="text-3xl mb-2">🎁</div>
                 <div className="text-lg font-bold text-white mb-1">צייד הבונוסים</div>
                 <div className="text-sm text-slate-300">
                    גרפת קופה על <span className="text-amber-400 font-black text-lg">{data.bonusHitsCount || 0}</span> שאלות בונוס.
                 </div>
              </div>
           </div>
        </div>
      )
    },
    // שקף 4: הבית הכי טוב והכי גרוע
    {
      id: "groups",
      bg: "bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
           <h3 className="text-emerald-400 font-black text-sm uppercase tracking-widest mb-12">ניתוח לפי בתים</h3>
           
           <div className="w-full space-y-8">
              <div className="relative group">
                 <div className="text-xs text-slate-500 font-bold mb-2 uppercase tracking-widest text-right mr-2">מכרה הזהב שלך</div>
                 <div className="bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-3xl flex items-center justify-between shadow-lg">
                    <div className="text-5xl font-black text-emerald-400">בית {data.bestGroup?.name}</div>
                    <div className="text-right">
                       <div className="text-2xl font-black text-white">{data.bestGroup?.points}</div>
                       <div className="text-xs text-emerald-500 font-bold">נקודות</div>
                    </div>
                 </div>
              </div>

              <div className="relative group opacity-90">
                 <div className="text-xs text-slate-500 font-bold mb-2 uppercase tracking-widest text-right mr-2">הבית המקולל</div>
                 <div className="bg-rose-500/10 border border-rose-500/30 p-6 rounded-3xl flex items-center justify-between shadow-lg">
                    <div className="text-5xl font-black text-rose-400">בית {data.worstGroup?.name}</div>
                    <div className="text-right">
                       <div className="text-2xl font-black text-white">{data.worstGroup?.points}</div>
                       <div className="text-xs text-rose-500 font-bold">נקודות</div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )
    },
    // שקף 5: הניחוש הנדיר (האגו-בוסט)
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
             <>
               <p className="text-white text-lg font-medium mb-8">הלכת נגד העדר, וזה השתלם לך בענק.</p>
               <div className="bg-slate-900/80 p-8 rounded-[2.5rem] border-2 border-amber-500/50 shadow-[0_0_40px_rgba(245,158,11,0.2)] w-full relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent"></div>
                  <div className="text-amber-400 font-black mb-2 text-xl">{data.rarestHit.matchTitle}</div>
                  <div className="text-5xl font-black text-white mb-6 tracking-widest">{data.rarestHit.score}</div>
                  <div className="text-slate-400 text-sm font-bold">
                     פגעת בבול שרק <span className="text-amber-400 text-lg">{data.rarestHit.percentage}%</span> מהליגה הצליחו לתפוס!
                  </div>
               </div>
             </>
           ) : (
             <p className="text-slate-400 italic font-medium">לא נמצא ניחוש נדיר במיוחד... אולי בנוקאאוט תפתיע את כולם?</p>
           )}
        </div>
      )
    }
  ];

  // שקף היריב (Nemesis) רק אם קיים
  if (nemesisData) {
    const diff = userStats.points - (nemesisData.totalPoints || 0);
    slides.push({
      id: "nemesis",
      bg: "bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
           <div className="text-7xl mb-6 drop-shadow-[0_0_20px_rgba(225,29,72,0.8)]">⚔️</div>
           <h3 className="text-2xl text-rose-300 font-bold mb-6">ראש בראש מול {nemesisData.name.split(" ")[0]}</h3>
           
           <div className="flex items-center justify-center gap-6 mb-10 w-full">
              <div className="flex flex-col items-center bg-blue-900/20 p-4 rounded-2xl border border-blue-500/30 w-28 shadow-lg">
                 <span className="text-xs text-blue-300 mb-1 font-bold">אתה</span>
                 <span className="text-4xl font-black text-white">{userStats.points}</span>
              </div>
              <div className="text-2xl text-slate-600 font-black">VS</div>
              <div className="flex flex-col items-center bg-rose-900/20 p-4 rounded-2xl border border-rose-500/30 w-28 shadow-lg">
                 <span className="text-xs text-rose-300 mb-1 font-bold">היריב</span>
                 <span className="text-4xl font-black text-rose-400">{nemesisData.totalPoints || 0}</span>
              </div>
           </div>

           <div className="text-xl font-black text-white bg-slate-900/60 py-4 px-6 rounded-2xl border border-slate-700 shadow-xl">
              {diff > 0 
                ? `אתה מוביל ב-${diff} נקודות! תמשיך ככה! 💪` 
                : diff < 0 
                ? `אתה בפיגור של ${Math.abs(diff)} נקודות. הזמן למהפך! 😤`
                : "אתם בתיקו מוחלט! מי ימצמץ ראשון? 👀"}
           </div>
        </div>
      )
    });
  }

  // שקף סיום חובה לכולם
  slides.push({
    id: "outro",
    bg: "bg-gradient-to-br from-slate-900 to-slate-950",
    content: (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
         <div className="text-7xl mb-6 animate-bounce">🔥</div>
         <h2 className="text-4xl font-black text-white mb-4">הכסף הגדול מתחיל עכשיו.</h2>
         <p className="text-xl text-slate-400 font-medium mb-10">
           בנוקאאוט הניקוד מכפיל את עצמו. כל טעות קריטית, כל בול שווה זהב.
         </p>
         <button 
           onClick={onClose}
           className="bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 px-8 py-5 rounded-2xl font-black text-2xl shadow-[0_0_30px_rgba(52,211,153,0.3)] hover:scale-105 transition-transform w-full max-w-xs"
         >
           יאללה לנוקאאוט! ⚽
         </button>
      </div>
    )
  });

  // יריית קונפטי בשקף האחרון
  useEffect(() => {
    if (currentSlide === slides.length - 1) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, zIndex: 1000 });
    }
  }, [currentSlide, slides.length]);

  // לוגיקת מעבר בין שקפים
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
      <div 
        className={`relative w-full h-full max-w-md mx-auto shadow-2xl transition-colors duration-700 ${slides[currentSlide].bg}`}
        onClick={handleScreenClick}
      >
        {/* פסי התקדמות */}
        <div className="absolute top-4 left-4 right-4 flex gap-1.5 z-50">
          {slides.map((_, idx) => (
            <div key={idx} className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden shadow-sm">
              <div 
                className={`h-full bg-white transition-all duration-300 ${
                  idx < currentSlide ? "w-full" : idx === currentSlide ? "w-full" : "w-0"
                }`} 
                style={{ transitionDuration: idx === currentSlide ? '5s' : '0.3s' }}
              />
            </div>
          ))}
        </div>

        {/* כפתור יציאה */}
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute top-8 right-6 z-50 bg-black/30 hover:bg-black/50 text-white/70 hover:text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm backdrop-blur-md transition-all"
        >
          ✕
        </button>

        {/* התוכן של השקף */}
        {slides[currentSlide].content}
      </div>
    </div>
  );
}