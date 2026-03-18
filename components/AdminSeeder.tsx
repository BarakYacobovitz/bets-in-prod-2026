"use client";
import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../app/firebase";
import toast from "react-hot-toast";

export default function AdminSeeder() {
  const [isSeeding, setIsSeeding] = useState(false);

  // כאן יושב ה"אקסל" שלנו - רשימת המשחקים המלאה שנדחוף לענן
  const matchesToSeed = [
    { homeTeam: "ארגנטינה", awayTeam: "ספרד", matchDate: "11 ביוני, 16:00", group: "A" },
    { homeTeam: "מקסיקו", awayTeam: "אנגליה", matchDate: "12 ביוני, 18:00", group: "A" },
    { homeTeam: "ברזיל", awayTeam: "צרפת", matchDate: "13 ביוני, 21:00", group: "B" },
    { homeTeam: "גרמניה", awayTeam: "יפן", matchDate: "14 ביוני, 16:00", group: "B" },
    { homeTeam: "פורטוגל", awayTeam: "קוריאה הדרומית", matchDate: "15 ביוני, 18:00", group: "C" },
    { homeTeam: "ארה״ב", awayTeam: "הולנד", matchDate: "16 ביוני, 21:00", group: "C" },
    // בהמשך תוכל פשוט להוסיף לכאן עוד שורות בדיוק ככה...
  ];

  const handleSeedDatabase = async () => {
    // אזהרה קטנה לפני שמריצים
    if (!confirm("האם אתה בטוח שאתה רוצה להזריק את כל המשחקים לענן?")) return;
    
    setIsSeeding(true);
    try {
      // עוברים על כל משחק במערך ויוצרים לו מסמך חדש בפיירבייס
      for (const match of matchesToSeed) {
        await addDoc(collection(db, "matches"), match);
      }
      toast.success("הזרקת הנתונים עברה בהצלחה! 🚀 רענן את העמוד כדי לראות את המשחקים.");
    } catch (error) {
      console.error("שגיאה בהזרקת נתונים:", error);
      toast.error("אופס, משהו השתבש בהזרקה.");
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="p-6 bg-red-900/30 border-2 border-red-500 rounded-2xl my-8 text-center max-w-lg mx-auto shadow-2xl">
      <h3 className="text-red-400 font-bold mb-2 text-xl">⚠️ כלי ניהול זמני - סכנת כפילויות!</h3>
      <p className="text-slate-300 text-sm mb-4">לחיצה על הכפתור תשגר את כל המערך לתוך הקולקציה matches.</p>
      <button
        onClick={handleSeedDatabase}
        disabled={isSeeding}
        className={`font-bold py-3 px-8 rounded-xl transition-all shadow-lg ${
          isSeeding ? "bg-slate-600 cursor-not-allowed" : "bg-red-600 hover:bg-red-500 text-white"
        }`}
      >
        {isSeeding ? "מזריק נתונים לענן... ⏳" : "הזרק משחקים ל-Firebase 💉"}
      </button>
    </div>
  );
}