"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import confetti from "canvas-confetti"; // תצטרך להתקין: npm install canvas-confetti @types/canvas-confetti

export default function FinalePodiumModal({ onClose, winnersTable1, winnersTable2 }: any) {
  const [stage, setStage] = useState(0); // 0 = חושך, 1 = זרקורים וגביע, 2 = חשיפת מנצחים

  useEffect(() => {
    // רצף האנימציות: קודם חושך, אחרי שנייה זרקורים, אחרי 3 שניות התוצאות והקונפטי
    const t1 = setTimeout(() => setStage(1), 1000);
    const t2 = setTimeout(() => {
      setStage(2);
      fireConfetti();
    }, 3500);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const fireConfetti = () => {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      const particleCount = 50 * (timeLeft / duration);
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);
  };

  const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center bg-slate-950 overflow-y-auto py-6 px-4 md:py-12 md:justify-center" dir="rtl">
      
      {/* הגדרת האנימציות של הזרקורים (Spotlights) */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spot-left {
          0% { transform: rotate(20deg) scaleY(1); opacity: 0; }
          30% { opacity: 0.7; }
          50% { transform: rotate(-10deg) scaleY(1.2); opacity: 0.9; }
          100% { transform: rotate(15deg) scaleY(1.1); opacity: 0.6; }
        }
        @keyframes spot-right {
          0% { transform: rotate(-20deg) scaleY(1); opacity: 0; }
          30% { opacity: 0.7; }
          50% { transform: rotate(10deg) scaleY(1.2); opacity: 0.9; }
          100% { transform: rotate(-15deg) scaleY(1.1); opacity: 0.6; }
        }
        .spotlight-left { animation: spot-left 4s ease-in-out infinite alternate; transform-origin: top center; }
        .spotlight-right { animation: spot-right 4s ease-in-out infinite alternate; transform-origin: top center; }
      `}} />

      {/* זרקורים שמופיעים בשלב 1 */}
      {stage >= 1 && (
        <div className="absolute top-[-10%] w-full flex justify-center opacity-80 z-0 pointer-events-none">
           <div className="w-[300px] h-[100vh] bg-gradient-to-b from-amber-200/30 via-amber-400/5 to-transparent spotlight-left absolute left-1/4"></div>
           <div className="w-[300px] h-[100vh] bg-gradient-to-b from-amber-200/30 via-amber-400/5 to-transparent spotlight-right absolute right-1/4"></div>
        </div>
      )}

      <button onClick={onClose} className="absolute top-4 left-4 md:top-6 md:left-6 text-slate-500 hover:text-white transition-colors z-50 text-sm font-bold bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">✕ סגור</button>

      <div className={`relative z-10 flex flex-col items-center transition-all duration-1000 ${stage >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'} ${stage >= 2 ? '-translate-y-2 md:-translate-y-6 scale-90 md:scale-100' : 'translate-y-20'}`}>
         
         {/* הגביע הזוהר במרכז */}
         <div className={`relative w-24 h-32 md:w-48 md:h-56 transition-all duration-1000 ${stage >= 2 ? 'drop-shadow-[0_0_40px_rgba(251,191,36,0.8)] scale-75 md:scale-100' : 'drop-shadow-[0_0_15px_rgba(251,191,36,0.4)]'}`}>
             <Image src="/world-cup.png" alt="World Cup Trophy" fill className="object-contain" priority />
         </div>
         
         <h1 className={`text-3xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-500 mt-2 md:mt-4 tracking-widest text-center transition-opacity duration-1000 ${stage >= 1 ? 'opacity-100' : 'opacity-0'}`}>
            BETS IN PROD 2026
         </h1>
         <p className={`text-amber-500/80 font-bold text-xs md:text-sm tracking-widest uppercase mt-1 transition-opacity duration-1000 ${stage >= 1 ? 'opacity-100' : 'opacity-0'}`}>ההכתרה הרשמית</p>
      </div>

      {/* חשיפת הטבלאות בשלב 2 */}
      {stage >= 2 && (
         <div className="relative z-20 w-full max-w-5xl px-2 md:px-4 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 animate-fade-in-up mt-4 md:mt-6 pb-8">
            
            {/* טבלה 1 */}
            <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl border border-amber-500/30 p-4 md:p-6 shadow-[0_0_30px_rgba(245,158,11,0.15)] relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent"></div>
               <h2 className="text-lg md:text-2xl font-black text-white mb-4 md:mb-6 text-center">🏆 ליגת האלופים (ראשית)</h2>
               <div className="space-y-3">
                  {winnersTable1.map((winner: any, idx: number) => (
                     <div key={idx} className={`flex items-center justify-between p-2.5 md:p-3 rounded-2xl border transition-all ${idx === 0 ? 'bg-amber-500/20 border-amber-500/50 shadow-lg' : idx === 1 ? 'bg-slate-300/10 border-slate-300/30' : 'bg-orange-800/20 border-orange-700/30'}`}>
                        <div className="flex items-center gap-3">
                           <span className="text-xl md:text-2xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                           <div>
                             <div className="font-black text-white text-sm md:text-lg">{winner.name}</div>
                             <div className="text-[10px] md:text-xs text-slate-400 font-bold">{winner.points} נקודות</div>
                           </div>
                        </div>
                        <div className="bg-slate-950/80 px-3 py-1.5 md:px-4 md:py-2 rounded-xl border border-slate-700">
                           <span className="font-black text-emerald-400 text-base md:text-xl">₪{winner.prize}</span>
                        </div>
                     </div>
                  ))}
               </div>
            </div>

            {/* טבלה 2 */}
            <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl border border-purple-500/30 p-4 md:p-6 shadow-[0_0_30px_rgba(168,85,247,0.15)] relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent"></div>
               <h2 className="text-lg md:text-2xl font-black text-white mb-4 md:mb-6 text-center">🎯 טבלת הבונוסים</h2>
               <div className="space-y-3">
                  {winnersTable2.map((winner: any, idx: number) => (
                     <div key={idx} className={`flex items-center justify-between p-2.5 md:p-3 rounded-2xl border transition-all ${idx === 0 ? 'bg-purple-500/20 border-purple-500/50 shadow-lg' : idx === 1 ? 'bg-slate-300/10 border-slate-300/30' : 'bg-orange-800/20 border-orange-700/30'}`}>
                        <div className="flex items-center gap-3">
                           <span className="text-xl md:text-2xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                           <div>
                             <div className="font-black text-white text-sm md:text-lg">{winner.name}</div>
                             <div className="text-[10px] md:text-xs text-slate-400 font-bold">{winner.points} נקודות</div>
                           </div>
                        </div>
                        <div className="bg-slate-950/80 px-3 py-1.5 md:px-4 md:py-2 rounded-xl border border-slate-700">
                           <span className="font-black text-emerald-400 text-base md:text-xl">₪{winner.prize}</span>
                        </div>
                     </div>
                  ))}
               </div>
            </div>

         </div>
      )}
    </div>
  );
}