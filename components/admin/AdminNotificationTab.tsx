"use client";
import React, { useState } from "react";
import toast from "react-hot-toast";

export default function AdminNotificationTab() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSendNotification = async () => {
    if (!title || !body) {
      toast.error("חובה להזין כותרת ותוכן להודעה");
      return;
    }

    if (!confirm("האם אתה בטוח שברצונך לשלוח התראת פוש לכל המשתמשים הרשומים?")) return;

    setIsSending(true);
    const toastId = toast.loading("משגר התראות למכשירים... 🚀");

    try {
      // התיקון המבוקש: שליחת title ו-body בלבד ל-API החדש שיצרנו
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(`נשלח בהצלחה ל-${data.successCount} מכשירים! ✅`, { id: toastId });
        setTitle("");
        setBody("");
      } else {
        throw new Error(data.error || "שגיאה לא ידועה בשליחה");
      }
    } catch (error: any) {
      toast.error(`כישלון בשליחה: ${error.message}`, { id: toastId });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up">
      <div className="bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-700 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
        
        <div className="mb-6">
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <span>📢</span> שליחת התראת פוש כללית
          </h2>
          <p className="text-slate-400 text-sm mt-1">ההודעה תישלח לכל מי שאישר קבלת התראות באפליקציה.</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-slate-300 text-xs font-black uppercase tracking-wider mb-2 pr-1">כותרת ההתראה (קליט וקצר)</label>
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="למשל: עלה טור חדש בייצור! ⚽"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white outline-none focus:border-indigo-500 transition-all shadow-inner"
            />
          </div>

          <div>
            <label className="block text-slate-300 text-xs font-black uppercase tracking-wider mb-2 pr-1">תוכן ההודעה</label>
            <textarea 
              value={body} 
              onChange={(e) => setBody(e.target.value)} 
              placeholder="למשל: בואו לראות מי ניחש מה ברבע הגמר..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white outline-none focus:border-indigo-500 h-32 resize-none transition-all shadow-inner"
            />
          </div>

          <button 
            onClick={handleSendNotification} 
            disabled={isSending}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black rounded-2xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-3 text-lg"
          >
            {isSending ? (
              <><span className="animate-spin">⚽</span> שולח...</>
            ) : (
              <>🚀 שגר התראה לכולם</>
            )}
          </button>
        </div>
      </div>

      <div className="mt-6 bg-blue-900/10 border border-blue-500/20 p-4 rounded-2xl">
         <p className="text-blue-300 text-xs leading-relaxed">
           <strong>טיפ:</strong> התראות נשלחות למשתמשים שביצעו "הפעל התראות" ב-Navbar. המערכת משתמשת ב-`fcmToken` השמור במסמך המשתמש ב-Firestore.
         </p>
      </div>
    </div>
  );
}