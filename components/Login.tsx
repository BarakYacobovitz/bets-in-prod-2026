"use client";
import { useState } from "react";
import { auth, db } from "../app/firebase";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import toast from "react-hot-toast";

export default function Login() {
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setErrorMsg("");
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    
    try {
      // 1. התחברות לגוגל
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // 2. בדיקה אמינה מול ה-DB האם זה משתמש חדש
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      const isReallyNewUser = !userDocSnap.exists();

      // 3. בודקים מה מצב הטורניר
      const sysSnap = await getDoc(doc(db, "settings", "system"));
      const tournamentState = sysSnap.exists() ? (Number(sysSnap.data().tournamentState) || 0) : 0;

      // 4. לוגיקת החסימה (אם הטורניר התחיל וזה יוזר חדש לחלוטין)
      if (isReallyNewUser && tournamentState >= 1) {
        toast.error("המשחקים כבר החלו! ⛔\nלא ניתן להצטרף לליגה לאחר שריקת הפתיחה.", {
          duration: 8000,
          style: { background: '#4c0519', color: '#fda4af', border: '1px solid #e11d48' }
        });
        setErrorMsg("המשחקים כבר החלו! ⛔ לא ניתן להצטרף לליגה לאחר שריקת הפתיחה. נתראה בטורניר הבא!");
        
        await signOut(auth); // מנתקים מיד
        setIsLoggingIn(false);
        return;
      }

      // 5. רישום משתמש חדש בצורה מובטחת
      if (isReallyNewUser) {
        // Fallback חכם לשם: אם אין DisplayName, ניקח את תחילת האימייל
        const fallbackName = user.displayName || user.email?.split('@')[0] || "שחקן חדש";
        
        await setDoc(userDocRef, {
          name: fallbackName,
          email: user.email,
          totalPoints: 0,
          knockoutPoints: 0,
          hasPaid: false,
          createdAt: new Date()
        });
        
        console.log("User successfully created in Firestore:", fallbackName);
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
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-black" dir="rtl">
        <video 
          src="/Preview.mp4" 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-75 pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-slate-900/30 to-slate-950/60 z-0"></div>
      
      <div className="relative z-10 bg-slate-900/40 backdrop-blur-md p-8 md:p-12 rounded-[2.5rem] border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.6)] max-w-md w-full mx-4 text-center flex flex-col items-center animate-fade-in-up">       
        <div className="w-24 h-24 md:w-32 md:h-32 mb-6">
          <img src="/B.svg" alt="Logo" className="w-full h-full object-contain drop-shadow-[0_0_25px_rgba(253,224,71,0.5)]" />
        </div>
        
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-yellow-400 to-amber-600 mb-1 drop-shadow-sm">
          Bets in PROD
        </h1>
        <span className="text-emerald-400 font-bold text-sm tracking-[0.2em] uppercase mb-8">
          מהמרים בייצור
        </span>
        
        <h2 className="text-2xl text-white font-black mb-3">⚽ מונדיאל 2026 ⚽</h2>
        <p className="text-slate-300 text-sm mb-6 leading-relaxed px-4">
          הליגה הסגורה שלנו יוצאת לדרך. התחבר עם חשבון הגוגל שלך כדי להזין את הניחושים ולהיכנס למגרש.
        </p>

        {errorMsg && (
          <div className="w-full bg-rose-950/90 border border-rose-500/50 text-rose-300 text-sm font-bold p-4 rounded-xl mb-6 shadow-lg animate-fade-in-up">
            {errorMsg}
          </div>
        )}
        
        <button 
          onClick={handleLogin} 
          disabled={isLoggingIn}
          className={`w-full bg-white hover:bg-slate-200 text-slate-900 font-black py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(255,255,255,0.15)] hover:shadow-[0_10px_40px_rgba(255,255,255,0.25)] hover:-translate-y-1 active:scale-95 ${isLoggingIn ? "opacity-70 cursor-not-allowed" : ""}`}
        >
          {isLoggingIn ? (
             <span className="animate-pulse">מתחבר למגרש...</span>
          ) : (
            <>
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6 shrink-0" />
              <span>כניסה מהירה עם Google</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}