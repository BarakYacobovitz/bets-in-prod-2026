"use client";
import { useState, useEffect, useRef } from "react";
import { auth, db } from "../app/firebase";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import toast from "react-hot-toast";

// תאריך יעד קבוע מראש: 11 ביוני 2026, שעה 14:00 (סגירת קלפיות)
const LOCK_TIME = new Date("2026-06-11T14:00:00").getTime();

export default function Login() {
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // שומרים את יחידות הזמן בנפרד לעיצוב הדיגיטלי
  const [timeUnits, setTimeUnits] = useState<{ d: string, h: string, m: string, s: string } | null>(null);
  const [isTimeUp, setIsTimeUp] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // הפעלת סרטון הרקע בהשהייה
  useEffect(() => {
    const timer = setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play().catch(e => console.log("Autoplay prevented:", e));
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // ניהול טיימר השעון
  useEffect(() => {
    const updateTimer = () => {
      const diff = LOCK_TIME - Date.now();
      
      if (diff <= 0) {
        setIsTimeUp(true);
        setTimeUnits(null);
      } else {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        
        setTimeUnits({
           d: d.toString().padStart(2, '0'),
           h: h.toString().padStart(2, '0'),
           m: m.toString().padStart(2, '0'),
           s: s.toString().padStart(2, '0')
        });
      }
    };
    
    updateTimer(); 
    const intervalId = setInterval(updateTimer, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const handleLogin = async () => {
    setErrorMsg("");
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      const isReallyNewUser = !userDocSnap.exists();

      const sysSnap = await getDoc(doc(db, "settings", "system"));
      const currentTournamentState = sysSnap.exists() ? (Number(sysSnap.data().tournamentState) || 0) : 0;

      // בדיקה: האם זה משתמש חדש שמנסה להירשם אחרי שהתחיל הטורניר?
      if (isReallyNewUser && currentTournamentState >= 1) {
        toast.error("המשחקים כבר החלו! ⛔\nלא ניתן להצטרף לליגה לאחר שריקת הפתיחה.", {
          duration: 8000,
          style: { background: '#4c0519', color: '#fda4af', border: '1px solid #e11d48' }
        });
        setErrorMsg("המשחקים כבר החלו! ⛔ לא ניתן להצטרף לליגה לאחר שריקת הפתיחה. נתראה בטורניר הבא!");
        
        await signOut(auth);
        setIsLoggingIn(false);
        return;
      }

      // יצירת יוזר חדש במסד במידה וזה משתמש חדש והטורניר טרם התחיל
      if (isReallyNewUser) {
        const fallbackName = user.displayName || user.email?.split('@')[0] || "שחקן חדש";
        await setDoc(userDocRef, {
          name: fallbackName,
          email: user.email,
          totalPoints: 0,
          knockoutPoints: 0,
          hasPaid: false,
          createdAt: new Date()
        });
      }

    } catch (error: any) {
      if (error.code !== "auth/popup-closed-by-user") {
        setErrorMsg("התרחשה שגיאה בהתחברות. נסה שוב מאוחר יותר.");
        console.error("Login failed", error);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black flex flex-col items-center" dir="rtl">
      <video 
        ref={videoRef}
        src="/Preview.mp4" 
        loop 
        muted 
        playsInline 
        className="absolute inset-0 w-full h-full object-cover object-[35%_center] md:object-center z-0 brightness-125 opacity-85 pointer-events-none"
      />
      
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-slate-950/80 via-slate-900/50 to-slate-950/95 md:from-slate-950/50 md:via-slate-900/30 md:to-slate-950/60" />
    
      {/* 
        הגדלנו מעט את המקסימום רוחב ל-500px כדי שהשעון לא יישבר לשורות.
      */}
      <div className="relative z-20 flex flex-col items-center h-full min-h-screen w-full max-w-sm md:max-w-[500px] mx-auto p-6 md:p-12 md:mt-0 text-center md:justify-center justify-between pt-16 md:pt-12 pb-12 animate-fade-in-up">      
        
        {/* --- חלק עליון: לוגו וכותרות --- */}
        <div className="flex flex-col items-center flex-1 md:flex-initial md:justify-center w-full">
          <div className="w-20 h-20 md:w-32 md:h-32 mb-6 md:mb-6 mt-1 md:mt-0">
            <img src="/B.svg" alt="Logo" className="w-full h-full object-contain drop-shadow-[0_0_25px_rgba(253,224,71,0.5)]" />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-yellow-400 to-amber-600 mb-1 drop-shadow-md">
            Bets in PROD
          </h1>
          <span className="text-emerald-400 font-bold text-xs md:text-sm tracking-[0.2em] uppercase mb-8 opacity-90">
            מהמרים בייצור
          </span>
          
          <div className="px-4">
            <h2 className="text-xl md:text-2xl text-white font-black mb-3 drop-shadow-lg">⚽ מונדיאל 2026 ⚽</h2>
            <p className="text-slate-300 text-xs md:text-sm mb-6 leading-relaxed drop-shadow-lg max-w-[280px] md:max-w-none mx-auto">
              הליגה הסגורה שלנו יוצאת לדרך.<br/>סגירת הקלפיות קרובה מתמיד.
            </p>
          </div>
        </div>

        {/* --- חלק תחתון: שעון קומפקטי + כפתור התחברות צמודים --- */}
        <div className="w-full mt-auto flex flex-col items-center gap-6">
          
          {/* עיצוב השעון החדש: דיגיטלי, נקי, ללא טקסט מיותר */}
          {!isTimeUp && timeUnits ? (
             <div className="flex flex-col items-center w-full">
                <span className="text-[10px] text-amber-500/90 font-black tracking-[0.2em] mb-2.5 uppercase drop-shadow-md">
                   Time to Kickoff
                </span>
                
                <div className="flex items-center justify-center gap-2 md:gap-4 bg-slate-950/40 backdrop-blur-md px-6 py-3.5 md:px-8 md:py-4 rounded-2xl border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.5)] w-fit mx-auto" dir="ltr">
                   
                   {/* ימים */}
                   <div className="flex flex-col items-center min-w-[40px] md:min-w-[50px]">
                     <span className="text-2xl md:text-4xl font-mono font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.6)] leading-none">{timeUnits.d}</span>
                     <span className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 md:mt-1.5">Days</span>
                   </div>
                   
                   <span className="text-xl md:text-3xl text-slate-500/50 font-black leading-none pb-3 md:pb-4">:</span>
                   
                   {/* שעות */}
                   <div className="flex flex-col items-center min-w-[40px] md:min-w-[50px]">
                     <span className="text-2xl md:text-4xl font-mono font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.6)] leading-none">{timeUnits.h}</span>
                     <span className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 md:mt-1.5">Hrs</span>
                   </div>
                   
                   <span className="text-xl md:text-3xl text-slate-500/50 font-black leading-none pb-3 md:pb-4">:</span>
                   
                   {/* דקות */}
                   <div className="flex flex-col items-center min-w-[40px] md:min-w-[50px]">
                     <span className="text-2xl md:text-4xl font-mono font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.6)] leading-none">{timeUnits.m}</span>
                     <span className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 md:mt-1.5">Min</span>
                   </div>
                   
                   <span className="text-xl md:text-3xl text-slate-500/50 font-black leading-none pb-3 md:pb-4">:</span>
                   
                   {/* שניות */}
                   <div className="flex flex-col items-center min-w-[40px] md:min-w-[50px]">
                     <span className="text-2xl md:text-4xl font-mono font-black text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)] leading-none">{timeUnits.s}</span>
                     <span className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 md:mt-1.5">Sec</span>
                   </div>
                   
                </div>
             </div>
          ) : (
             <div className="text-2xl font-black text-rose-500 bg-rose-950/80 px-6 py-3 rounded-2xl border border-rose-500/50 animate-pulse drop-shadow-md">
                הקלפיות נסגרו! ⚽
             </div>
          )}

          <div className="w-full">
            {errorMsg && (
              <div className="w-full bg-rose-950/90 border border-rose-500/50 text-rose-300 text-xs font-bold p-4 rounded-xl mb-4 shadow-lg">
                {errorMsg}
              </div>
            )}
            
            {/* הכפתור הופך למושבת (disabled) אך ורק בזמן שמתבצעת התחברות (isLoggingIn) ולא בגלל שהשעון נגמר */}
            <button 
              onClick={handleLogin} 
              disabled={isLoggingIn}
              className={`w-full bg-white hover:bg-slate-200 text-slate-900 font-black py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(255,255,255,0.15)] hover:-translate-y-1 active:scale-95 ${isLoggingIn ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              {isLoggingIn ? (
                  <span className="animate-pulse">מתחבר למגרש...</span>
              ) : (
                <>
                  <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5 shrink-0" />
                  <span className="font-bold">כניסה מהירה עם Google</span>
                </>
              )}
            </button>
          </div>

        </div>
        
      </div>
    </div>
  );
}