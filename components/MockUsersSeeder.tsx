"use client";
import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../app/firebase";
import toast from "react-hot-toast";

export default function MockUsersSeeder() {
  const [isSeeding, setIsSeeding] = useState(false);

  // הנה רשימת ה"בוטים" שלנו עם נקודות רנדומליות
  const fakeUsers = [
    { id: "fake_user_1", displayName: "דניאלה מור", totalPoints: 185 },
    { id: "fake_user_2", displayName: "אבי מזרחי", totalPoints: 210 }, // מקום ראשון
    { id: "fake_user_3", displayName: "יעל לוי", totalPoints: 160 },
    { id: "fake_user_4", displayName: "רונן (הבוס)", totalPoints: 95 },
    { id: "fake_user_5", displayName: "מיכל מהכספים", totalPoints: 175 }, // מקום שלישי
    { id: "fake_user_6", displayName: "תומר IT", totalPoints: 120 },
  ];

  const handleSeed = async () => {
    if (!confirm("להזריק משתמשים פיקטיביים למסד הנתונים?")) return;
    
    setIsSeeding(true);
    try {
      // עוברים על המערך ויוצרים להם מסמכים בקולקציית users
      for (const u of fakeUsers) {
        await setDoc(doc(db, "users", u.id), {
          displayName: u.displayName,
          totalPoints: u.totalPoints,
        });
      }
      toast.success("המשתמשים הוזרקו בהצלחה! 🎉 רענן את העמוד כדי לראות את הטבלה.");
    } catch (error) {
      console.error("שגיאה בהזרקה:", error);
      toast.error("אופס, משהו השתבש.");
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="flex justify-center my-6">
      <button
        onClick={handleSeed}
        disabled={isSeeding}
        className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform hover:scale-105 border-2 border-purple-400"
      >
        {isSeeding ? "מזריק נתונים... ⏳" : "🧪 הזרק משתמשים פיקטיביים לטבלה"}
      </button>
    </div>
  );
}