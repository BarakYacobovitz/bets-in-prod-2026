"use client";
import { useState, useEffect, useRef } from "react";
import { auth, db } from "../app/firebase";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import toast from "react-hot-toast";

export default function Login() {
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // "שלט רחוק" לשליטה על הוידאו
  const videoRef = useRef<HTMLVideoElement>(null);

  // הטיימר: מחכה 3 שניות ואז לוחץ Play על הסרטון
  useEffect(() => {
    const timer = setTimeout(() => {
      if (videoRef.current) {
        // שימוש ב-catch למקרה שדפדפנים מסוימים (כמו ספארי בסלולר) יחסמו הפעלה אוטומטית
        videoRef.current.play().catch(e => console.log("Autoplay prevented:", e));
      }
    }, 3000); // הזמן לעצירת הפריים הראשון (כרגע 3 שניות - שנה לפי הצורך)
    
    return () => clearTimeout(timer);
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
      const tournamentState = sysSnap.exists() ? (Number(sysSnap.data().tournamentState) || 0) : 0;

      if (isReallyNewUser && tournamentState >= 1) {
        toast.error("המשחקים כבר החלו! ⛔\nלא ניתן להצטרף לליגה לאחר שריקת הפתיחה.", {
          duration: 8000,
          style: { background: '#4c0519', color: '#fda4af', border: '1px solid #e11d48' }
        });
        setErrorMsg("המשחקים כבר החלו! ⛔ לא ניתן להצטרף לליגה לאחר שריקת הפתיחה. נתראה בטורניר הבא!");
        
        await signOut(auth);
        setIsLoggingIn(false);
        return;
      }

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
      {/* סרטון רקע - מחובר ל-videoRef וללא autoPlay */}
      <video 
        ref={videoRef}
        src="/Preview.mp4" 
        loop 
        muted 
        playsInline 
        /* הוספנו את object-[30%_center] למובייל, ו-md:object-center למחשב */
        className="absolute inset-0 w-full h-full object-cover object-[35%_center] md:object-center z-0 opacity-60 pointer-events-none"
      />
      
      {/* שכבת גרדיאנט קבועה לקריאות נוחה */}
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-slate-950/80 via-slate-900/50 to-slate-950/95 md:from-slate-950/50 md:via-slate-900/30 md:to-slate-950/60" />
    
      {/* קונטיינר הרכיבים - מופיע מיד ללא השהייה (animate-fade-in-up עושה כניסה רכה ויפה של התפריט עצמו) */}
      <div className="relative z-20 flex flex-col items-center h-full min-h-screen w-full max-w-sm md:max-w-md mx-auto p-6 md:p-12 md:mt-0 text-center md:justify-center justify-between pt-16 md:pt-12 pb-12 animate-fade-in-up">      
        
        {/* קבוצת רכיבים עליונה: לוגו + כותרות */}
        <div className="flex flex-col items-center flex-1 md:flex-initial md:justify-center w-full">
          
          <div className="w-20 h-20 md:w-32 md:h-32 mb-6 md:mb-6 mt-1 md:mt-0">
            <img src="/B.svg" alt="Logo" className="w-full h-full object-contain drop-shadow-[0_0_25px_rgba(253,224,71,0.5)]" />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-yellow-400 to-amber-600 mb-1 drop-shadow-md">
            Bets in PROD
          </h1>
          <span className="text-emerald-400 font-bold text-xs md:text-sm tracking-[0.2em] uppercase mb-10 md:mb-8 opacity-90">
            מהמרים בייצור
          </span>
          
          <div className="px-4">
            <h2 className="text-xl md:text-2xl text-white font-black mb-3 drop-shadow-lg">⚽ מונדיאל 2026 ⚽</h2>
            <p className="text-slate-200 text-xs md:text-sm mb-6 leading-relaxed opacity-95 drop-shadow-lg max-w-[280px] md:max-w-none mx-auto">
              הליגה הסגורה שלנו יוצאת לדרך. התחבר עם גוגל כדי להיכנס למגרש.
            </p>
          </div>
        </div>

        {/* קבוצת רכיבים חובה למטה: כפתור לוגין */}
        <div className="w-full px-2 md:px-0">
          {errorMsg && (
            <div className="w-full bg-rose-950/90 border border-rose-500/50 text-rose-300 text-xs font-bold p-4 rounded-xl mb-6 shadow-lg">
              {errorMsg}
            </div>
          )}
          
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
  );
}