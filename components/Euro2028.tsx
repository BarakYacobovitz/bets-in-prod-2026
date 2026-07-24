"use client";
import React, { useState, useEffect } from "react";

export default function Euro2028() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    // Euro 2028 kickoff date: June 9, 2028
    const targetDate = new Date("2028-06-09T18:00:00").getTime();

    const updateTimer = () => {
      const now = Date.now();
      const difference = targetDate - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, []);

  const stadiums = [
    {
      name: "Wembley Stadium",
      city: "לונדון",
      capacity: "90,000",
      image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQds3piPJzd27vuAw55UgIBh5xmjOY2Z0BMrZUTaJt1Ww&s=10"
    },
    {
      name: "Principality Stadium",
      city: "קארדיף",
      capacity: "73,900",
      image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ32LeupDc3jV1V2itTguhAoMxW-RRLuh6BgYTLxNXb4zLKHeW66YDigAWL&s=10"
    },
    {
      name: "Tottenham Stadium",
      city: "לונדון",
      capacity: "62,850",
      image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSo6lY89wFnJqAuSCmnSzzej3Itp6noYzow9fkJ1a8yRSnEXJd4XlbG11Y&s=10"
    },
    {
      name: "Aviva Stadium",
      city: "דבלין",
      capacity: "51,700",
      image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQHq76z6KBXanlxdNNaopXld1zgHW_CuuZzAXim2dWSeME9qBpG-ijR4aY&s=10"
    }
  ];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 pb-12 animate-fade-in-up" dir="rtl">
      
      {/* באנר ראשי מעוצב ומנצנץ */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/80 p-8 md:p-12 rounded-3xl border border-indigo-500/30 shadow-2xl relative overflow-hidden text-center">
        {/* אפקטי תאורה ברקע */}
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col items-center">
          {/* תצוגת דגלים יציבה באמצעות תמונות */}
          <div className="flex justify-center gap-3 mb-6" dir="ltr">
            <img src="https://flagcdn.com/h40/gb-nir.png" alt="Northern Ireland" className="h-7 sm:h-9 rounded shadow-md border border-slate-700" />
            <img src="https://flagcdn.com/h40/gb-eng.png" alt="England" className="h-7 sm:h-9 rounded shadow-md border border-slate-700" />
            <img src="https://flagcdn.com/h40/gb-sct.png" alt="Scotland" className="h-7 sm:h-9 rounded shadow-md border border-slate-700" />
            <img src="https://flagcdn.com/h40/gb-wls.png" alt="Wales" className="h-7 sm:h-9 rounded shadow-md border border-slate-700" />
            <img src="https://flagcdn.com/h40/ie.png" alt="Ireland" className="h-7 sm:h-9 rounded shadow-md border border-slate-700" />
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tight bg-gradient-to-b from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent leading-none">
            נתראה ביורו 2028!
          </h1>
          <p className="text-indigo-400 font-extrabold text-base md:text-lg tracking-widest uppercase mb-2">
            בריטניה ואירלנד • UK & Ireland
          </p>
          <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
            מונדיאל 2026 הגיע לסיומו, ועמו חוויה בלתי נשכחת של הימורים וניחושים. 
            עכשיו העיניים נשואות אל עבר הטורניר הגדול הבא ביבשת הישנה. מכינים את הקרקע, מלטשים את הטבלאות - נפגש בייצור בקרוב!
          </p>
        </div>
      </div>

      {/* קאונטדאון בעיצוב ניאון */}
      <div className="bg-slate-900 border border-slate-800 p-6 md:p-10 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-blue-500 to-emerald-500"></div>
        <h2 className="text-xl md:text-2xl font-black text-white text-center mb-6 md:mb-8 flex items-center justify-center gap-2">
          <span>⏳</span> הספירה לאחור החלה
        </h2>

        {timeLeft.isExpired ? (
          <div className="text-center text-emerald-400 font-black text-2xl md:text-4xl animate-pulse">
            הטורניר החל! ⚽🔥
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-2xl mx-auto" dir="ltr">
            {/* ימים */}
            <div className="bg-slate-950/80 border border-slate-800 p-3 sm:p-5 rounded-2xl flex flex-col items-center justify-center shadow-inner group hover:border-blue-500/30 transition-all">
              <span className="text-2xl sm:text-5xl font-black text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                {timeLeft.days}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">Days</span>
            </div>

            {/* שעות */}
            <div className="bg-slate-950/80 border border-slate-800 p-3 sm:p-5 rounded-2xl flex flex-col items-center justify-center shadow-inner group hover:border-red-500/30 transition-all">
              <span className="text-2xl sm:text-5xl font-black text-red-400 drop-shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                {timeLeft.hours.toString().padStart(2, "0")}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">Hours</span>
            </div>

            {/* דקות */}
            <div className="bg-slate-950/80 border border-slate-800 p-3 sm:p-5 rounded-2xl flex flex-col items-center justify-center shadow-inner group hover:border-emerald-500/30 transition-all">
              <span className="text-2xl sm:text-5xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                {timeLeft.minutes.toString().padStart(2, "0")}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">Mins</span>
            </div>

            {/* שניות */}
            <div className="bg-slate-950/80 border border-slate-800 p-3 sm:p-5 rounded-2xl flex flex-col items-center justify-center shadow-inner group hover:border-amber-500/30 transition-all">
              <span className="text-2xl sm:text-5xl font-black text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.3)] animate-pulse">
                {timeLeft.seconds.toString().padStart(2, "0")}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">Secs</span>
            </div>
          </div>
        )}
      </div>

      {/* מידע ואינטואיציה על המארחות */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* כרטיס מארחות */}
        <div className="bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-800 shadow-lg relative overflow-hidden group hover:border-indigo-500/30 transition-all">
          <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600 transition-all group-hover:w-3"></div>
          <h3 className="text-2xl font-bold text-indigo-400 mb-4 flex items-center gap-2">
            <span>🗺️</span> חמש המדינות המארחות
          </h3>
          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            בפעם השנייה בהיסטוריה, אליפות אירופה לנבחרות תתארח במספר מדינות תחת איחוד בריטי-אירי משותף. כל המדינות יציעו אירוח חם, אווירה מחשמלת ותרבות כדורגל עשירה:
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
              <img src="https://flagcdn.com/w40/gb-eng.png" alt="England" className="w-7 rounded border border-slate-700 shadow-sm" />
              <div className="text-right">
                <p className="font-bold text-white text-sm">אנגליה (England)</p>
                <p className="text-xs text-slate-500">הבמה המרכזית עם משחק הגמר באצטדיון וומבלי האגדי.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
              <img src="https://flagcdn.com/w40/gb-sct.png" alt="Scotland" className="w-7 rounded border border-slate-700 shadow-sm" />
              <div className="text-right">
                <p className="font-bold text-white text-sm">סקוטלנד (Scotland)</p>
                <p className="text-xs text-slate-500">האמפדן פארק המפורסם בגלזגו יביא את הטירוף הסקוטי הידוע.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
              <img src="https://flagcdn.com/w40/gb-wls.png" alt="Wales" className="w-7 rounded border border-slate-700 shadow-sm" />
              <div className="text-right">
                <p className="font-bold text-white text-sm">ויילס (Wales)</p>
                <p className="text-xs text-slate-500">האיצטדיון הלאומי בקארדיף (Principality) המרשים ביופיו.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
              <img src="https://flagcdn.com/w40/ie.png" alt="Ireland" className="w-7 rounded border border-slate-700 shadow-sm" />
              <div className="text-right">
                <p className="font-bold text-white text-sm">רפובליקת אירלנד (Ireland)</p>
                <p className="text-xs text-slate-500">דבלין הירוקה והחגיגית תארח משחקים באצטדיון אביבה.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
              <img src="https://flagcdn.com/w40/gb-nir.png" alt="Northern Ireland" className="w-7 rounded border border-slate-700 shadow-sm" />
              <div className="text-right">
                <p className="font-bold text-white text-sm">צפון אירלנד (Northern Ireland)</p>
                <p className="text-xs text-slate-500">בלפסט תצטרף לחגיגה עם חידוש אצטדיון קייסמנט פארק.</p>
              </div>
            </div>
          </div>
        </div>

        {/* כרטיס איצטדיונים עם גלריית תמונות יפה */}
        <div className="bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-800 shadow-lg relative overflow-hidden group hover:border-emerald-500/30 transition-all flex flex-col justify-between">
          <div>
            <div className="absolute top-0 left-0 w-2 h-full bg-emerald-600 transition-all group-hover:w-3"></div>
            <h3 className="text-2xl font-bold text-emerald-400 mb-4 flex items-center gap-2">
              <span>🏟️</span> המגרשים המובחרים
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              המשחקים ישוחקו באצטדיונים המובילים והמתקדמים ביותר בעולם. הנה כמה מהבולטים שבהם:
            </p>
            
            {/* גריד אצטדיונים עם תמונות */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {stadiums.map((stadium, idx) => (
                <div key={idx} className="bg-slate-950/40 rounded-xl border border-slate-800/80 overflow-hidden shadow-inner group/card hover:border-emerald-500/20 transition-all flex flex-col">
                  <div className="h-20 w-full overflow-hidden relative">
                    <img 
                      src={stadium.image} 
                      alt={stadium.name} 
                      className="w-full h-full object-cover object-center group-hover/card:scale-110 transition-transform duration-500" 
                    />
                  </div>
                  <div className="p-2 flex-1 flex flex-col justify-center">
                    <span className="text-xs font-bold text-white block truncate">{stadium.name}</span>
                    <span className="text-[10px] text-slate-500">{stadium.city} • {stadium.capacity} מקומות</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-2xl">
            <h4 className="font-bold text-emerald-400 text-sm mb-1">📢 עדכון מנהלה:</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              מערכת הניחושים של מונדיאל 2026 נסגרה לצמיתות. נתראה ביורו 2028!
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
