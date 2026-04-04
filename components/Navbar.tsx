"use client";
// הסרנו את Link, אנחנו נשתמש בתגית a רגילה לריפרוש הסטייט
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../app/firebase";
import { doc, onSnapshot } from "firebase/firestore"; // שינינו מ-getDoc ל-onSnapshot!

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState<string>("שחקן אורח");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userPoints, setUserPoints] = useState<number>(0);
  const [photoUrl, setPhotoUrl] = useState<string>("");

  useEffect(() => {
    let unsubscribeUser: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsLoggedIn(true);
        setUserEmail(user.email || "");
        setPhotoUrl(user.photoURL || "");
        
        // --- התיקון הקריטי: מאזין בזמן אמת למסמך המשתמש! ---
        unsubscribeUser = onSnapshot(doc(db, "users", user.uid), (userDoc) => {
          if (userDoc.exists()) {
            setUserName(userDoc.data().name || "שחקן");
            setUserPoints(userDoc.data().totalPoints || 0); // יתעדכן מיד כשהקופה תגדל!
          }
        });

      } else {
        setIsLoggedIn(false);
        if (unsubscribeUser) unsubscribeUser(); // ניקוי המאזין כשהמשתמש מתנתק
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  const handleLogout = () => {
    if (confirm("בטוח שברצונך להתנתק?")) {
      signOut(auth);
    }
  };

  if (!isLoggedIn) return null;

  return (
    <nav className="w-full bg-slate-950 border-b border-slate-800 p-3 md:p-4 shadow-[0_4px_20px_rgba(0,0,0,0.5)] sticky top-0 z-50" dir="rtl">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        
        {/* צד ימין: הלוגו B והטקסט בסטייל פרימיום */}
        {/* החלפנו ל-a רגיל כדי שלחיצה עליו תמיד תאפס את האפליקציה למסך הדאשבורד הראשי */}
        <a href="/" className="group flex items-center gap-4 transition-all duration-300 hover:opacity-90 cursor-pointer">
          
          {/* הלוגו - נקי, עם צללית שמתגברת במעבר עכבר */}
          <div className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center shrink-0">
            <img 
              src="/B.svg" 
              alt="Bets in Prod Logo" 
              className="w-full h-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] group-hover:drop-shadow-[0_0_15px_rgba(253,224,71,0.4)] transition-all duration-500" 
            />
          </div>

          {/* אזור הטקסטים - מעוצב מחדש */}
          <div className="hidden sm:flex flex-col justify-center border-r border-white/10 pr-5">
             
             {/* Bets in PROD - אפקט גרדיאנט זהב/שמפניה על הטקסט עצמו! */}
             <span className="font-black text-2xl md:text-[28px] tracking-tight leading-none bg-gradient-to-br from-amber-100 via-yellow-400 to-amber-600 bg-clip-text text-transparent drop-shadow-sm pb-1">
               Bets in PROD
             </span>
             
             {/* מהמרים בייצור - ירוק אמרלד עדין עם ריווח אותיות רחב למראה מודרני */}
             <span className="text-emerald-400/90 font-bold text-sm tracking-[0.15em] mt-0.5">
               מהמרים בייצור
             </span>
             
          </div>
        </a>

        {/* צד שמאל: פרופיל משתמש + התנתקות */}
        <div className="flex items-center gap-3 md:gap-4">
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-700 p-1.5 pr-4 md:p-2 md:pr-5 rounded-full shadow-inner hover:bg-slate-800 transition-colors">
              <div className="text-left hidden md:flex flex-col justify-center">
                <div className="text-slate-200 font-bold text-sm leading-tight">{userName}</div>
                {userEmail && <div className="text-slate-500 text-[10px] mb-0.5">{userEmail}</div>}
                <div className="text-amber-400 text-xs font-black tracking-wider flex items-center justify-end gap-1">
                  {userPoints} נק' 🏆
                </div>
              </div>
              
              {photoUrl ? (
                <img src={photoUrl} alt="Profile" className="w-10 h-10 md:w-11 md:h-11 rounded-full border-2 border-slate-600 object-cover shadow-lg" />
              ) : (
                <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-gradient-to-tr from-blue-600 to-emerald-500 border-2 border-slate-600 flex items-center justify-center text-xl shadow-lg">
                  ⚽
                </div>
              )}
            </div>

            <button 
              onClick={handleLogout} 
              className="bg-slate-900 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 border border-slate-700 p-2.5 md:p-3 rounded-xl transition-colors shadow-sm"
              title="התנתק מהמערכת"
            >
              🚪
            </button>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shine {
          0% { transform: translateX(150%) skewX(-15deg); }
          100% { transform: translateX(-150%) skewX(-15deg); }
        }
      `}} />
    </nav>
  );
}