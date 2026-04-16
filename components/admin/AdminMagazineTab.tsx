"use client";
import React, { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../app/firebase"; 
import toast from "react-hot-toast";

export default function AdminMagazineTab() {
  const [dashMsg, setDashMsg] = useState("");
  const [dashMediaUrl, setDashMediaUrl] = useState("");
  const [dashSubtext, setDashSubtext] = useState("");
  const [isSavingDash, setIsSavingDash] = useState(false);
  
  // הוספנו רפרנס נפרד גם לתקציר
  const msgRef = useRef<HTMLTextAreaElement>(null);
  const subtextRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchDashSettings = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "dashboard"));
        if (snap.exists()) {
          setDashMsg(snap.data().dailyMessage || "");
          setDashMediaUrl(snap.data().dailyMediaUrl || "");
          setDashSubtext(snap.data().dailySubtext || "");
        }
      } catch (e) {
        console.error("שגיאה במשיכת המהדורה", e);
      }
    };
    fetchDashSettings();
  }, []);

  const handleSaveDashboard = async () => {
    setIsSavingDash(true);
    try {
      await setDoc(doc(db, "settings", "dashboard"), {
        dailyMessage: dashMsg,
        dailyMediaUrl: dashMediaUrl,
        dailySubtext: dashSubtext
      }, { merge: true });
      toast.success("המהדורה המרכזית עודכנה ופורסמה בהצלחה!");
    } catch (e) {
      toast.error("שגיאה בשמירת המהדורה");
    } finally {
      setIsSavingDash(false);
    }
  };

  // פונקציית הקסם - עכשיו יודעת לטפל בשני השדות השונים
  const wrapText = (prefix: string, suffix: string, target: 'msg' | 'subtext') => {
    const ref = target === 'msg' ? msgRef : subtextRef;
    const textState = target === 'msg' ? dashMsg : dashSubtext;
    const setTextState = target === 'msg' ? setDashMsg : setDashSubtext;

    if (!ref.current) return;
    const start = ref.current.selectionStart;
    const end = ref.current.selectionEnd;
    const selectedText = textState.substring(start, end);
    
    // אם לא סומן טקסט, נכניס טקסט ברירת מחדל
    const textToWrap = selectedText.length > 0 ? selectedText : "טקסט";
    const newText = textState.substring(0, start) + prefix + textToWrap + suffix + textState.substring(end);
    
    setTextState(newText);
    
    // החזרת הפוקוס למיקום הנכון
    setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        ref.current.setSelectionRange(start + prefix.length, start + prefix.length + textToWrap.length);
      }
    }, 0);
  };

  // רכיב סרגל כלים שמונע שכפול קוד
  const renderToolbar = (target: 'msg' | 'subtext') => (
     <div className="flex flex-wrap gap-2 mb-0 bg-slate-800 p-2 rounded-t-xl border border-slate-700 border-b-0">
        <button onClick={() => wrapText('<b>', '</b>', target)} className="w-8 h-8 flex items-center justify-center bg-slate-950 hover:bg-slate-700 text-white rounded font-bold border border-slate-700" title="הדגש (Bold)">B</button>
        {/* כותרות גדולות קיימות רק בתוכן המלא, לא בתקציר כדי לא לשבור תצוגה */}
        {target === 'msg' && (
          <>
            <button onClick={() => wrapText('<h1>', '</h1>', target)} className="w-8 h-8 flex items-center justify-center bg-slate-950 hover:bg-slate-700 text-white rounded font-bold border border-slate-700" title="כותרת גדולה">H1</button>
            <button onClick={() => wrapText('<h2>', '</h2>', target)} className="w-8 h-8 flex items-center justify-center bg-slate-950 hover:bg-slate-700 text-white rounded font-bold border border-slate-700" title="כותרת משנית">H2</button>
          </>
        )}
        <div className="w-px bg-slate-700 mx-1 my-1"></div>
        <button onClick={() => wrapText('<mark class="yellow">', '</mark>', target)} className="px-2 h-8 flex items-center justify-center bg-slate-950 hover:bg-slate-700 text-amber-400 rounded font-bold border border-slate-700" title="מרקר צהוב">מרקר צהוב</button>
        <button onClick={() => wrapText('<mark class="green">', '</mark>', target)} className="px-2 h-8 flex items-center justify-center bg-slate-950 hover:bg-slate-700 text-emerald-400 rounded font-bold border border-slate-700" title="מרקר ירוק">מרקר ירוק</button>
        <button onClick={() => wrapText('<mark class="red">', '</mark>', target)} className="px-2 h-8 flex items-center justify-center bg-slate-950 hover:bg-slate-700 text-rose-400 rounded font-bold border border-slate-700" title="מרקר אדום">מרקר אדום</button>
        <div className="w-px bg-slate-700 mx-1 my-1"></div>
        <button onClick={() => wrapText('<a href="כאן_שמים_את_הלינק" target="_blank">', '</a>', target)} className="w-8 h-8 flex items-center justify-center bg-slate-950 hover:bg-slate-700 text-cyan-400 rounded font-bold border border-slate-700" title="הוסף קישור">🔗</button>
        <button onClick={() => wrapText('<br/>\n', '', target)} className="w-8 h-8 flex items-center justify-center bg-slate-950 hover:bg-slate-700 text-slate-300 rounded font-bold border border-slate-700" title="שבירת שורה (אנטר)">⏎</button>
     </div>
  );

  return (
    <div className="animate-fade-in-up grid grid-cols-1 xl:grid-cols-2 gap-8">
      
      {/* פאנל העריכה */}
      <div className="bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden flex flex-col h-full">
         <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>
         <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2"><span>✍️</span> עורך הטור היומי (Magazine)</h3>
         
         <div className="space-y-6 flex-1 flex flex-col">
           
           {/* עורך התקציר החדש */}
           <div className="flex flex-col">
             <label className="block text-slate-400 text-sm font-bold mb-2">📝 תקציר / כותרת משנה (יופיע בכרטיסייה בדאשבורד)</label>
             {renderToolbar('subtext')}
             <textarea 
               ref={subtextRef}
               value={dashSubtext} 
               onChange={(e) => setDashSubtext(e.target.value)} 
               className="w-full bg-slate-950 border border-slate-700 rounded-b-xl p-3 text-white outline-none focus:border-emerald-500 min-h-[100px] resize-y custom-scrollbar font-mono text-sm leading-relaxed" 
               placeholder="סמן טקסט ועצב אותו באמצעות הסרגל..."
               dir="rtl"
             />
           </div>

           <div>
             <label className="block text-slate-400 text-sm font-bold mb-2">📸 כתובת תמונה / וידאו ראשי (URL)</label>
             <input 
               type="text" 
               value={dashMediaUrl} 
               onChange={(e) => setDashMediaUrl(e.target.value)} 
               className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-emerald-500" 
               placeholder="https://..." 
               dir="ltr"
             />
           </div>

           {/* עורך התוכן המלא */}
           <div className="flex-1 flex flex-col">
             <label className="block text-slate-400 text-sm font-bold mb-2">📄 התוכן המלא של הכתבה</label>
             {renderToolbar('msg')}
             <textarea 
               ref={msgRef}
               value={dashMsg} 
               onChange={(e) => setDashMsg(e.target.value)} 
               className="w-full flex-1 bg-slate-950 border border-slate-700 rounded-b-xl p-4 text-slate-300 outline-none focus:border-emerald-500 min-h-[250px] font-mono text-base leading-relaxed custom-scrollbar" 
               placeholder="סמן מילה ולחץ על הכלים למעלה כדי לעצב אותה..." 
               dir="rtl"
             />
           </div>
           
           <button 
             onClick={handleSaveDashboard} 
             disabled={isSavingDash}
             className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-95 text-lg mt-auto flex items-center justify-center gap-2"
           >
             {isSavingDash ? "שומר נתונים..." : "💾 שמור ופרסם לחבר'ה"}
           </button>
         </div>
      </div>

      {/* פאנל תצוגה מקדימה (Live Preview) */}
      <div className="bg-slate-950 p-4 md:p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col h-full">
         <h3 className="text-lg font-black text-slate-400 mb-4 flex items-center gap-2"><span>👁️</span> תצוגה מקדימה חיה (איך זה ייראה למשתמשים)</h3>
         
         <div className="bg-slate-900 border border-slate-700 p-6 md:p-8 rounded-3xl w-full flex flex-col shadow-2xl relative overflow-hidden flex-1">
            <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-blue-400 to-emerald-500"></div>
            
            <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-4 pr-4">
              <div>
                <h3 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 flex items-center gap-3">
                   <span className="text-white drop-shadow-md">📰</span> המהדורה המרכזית
                </h3>
                <div className="text-slate-500 text-sm font-medium mt-1">
                   {new Date().toLocaleDateString('he-IL')}
                </div>
              </div>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 pr-4 pb-4">
                 {dashMediaUrl && (
                    <div className="w-full rounded-2xl overflow-hidden mb-6 border border-slate-800 shadow-lg">
                       {dashMediaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null ? (
                          <img src={dashMediaUrl} alt="Preview" className="w-full max-h-[300px] object-contain mx-auto" />
                       ) : (
                          <video src={dashMediaUrl} autoPlay loop muted playsInline controls className="w-full max-h-[300px] object-contain mx-auto" />
                       )}
                    </div>
                 )}

                 {/* תצוגה מקדימה לתקציר שמתרנדר עכשיו כ-HTML כדי לראות את העיצוב */}
                 {dashSubtext && (
                    <div 
                      className="text-slate-300 text-base md:text-lg leading-relaxed mb-6 font-medium whitespace-pre-wrap italic border-r-4 border-slate-600 pr-4 [&_b]:text-amber-400 [&_strong]:text-amber-400 [&_mark]:px-1.5 [&_mark]:rounded [&_mark.yellow]:bg-amber-500/20 [&_mark.yellow]:text-amber-300 [&_mark.green]:bg-emerald-500/20 [&_mark.green]:text-emerald-300 [&_mark.red]:bg-rose-500/20 [&_mark.red]:text-rose-400 [&_a]:text-cyan-400 [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: dashSubtext }}
                    />
                 )}

                 {/* תצוגת תוכן אמיתית עם כל חוקי ה-CSS של הקוראים */}
                 <div className="text-slate-200 text-base md:text-lg leading-relaxed whitespace-pre-wrap
                                 [&_div]:w-full
                                 [&_b]:text-amber-400 [&_strong]:text-amber-400
                                 [&_i]:text-slate-400 [&_u]:underline [&_u]:decoration-blue-400 [&_u]:underline-offset-4
                                 [&_h1]:text-2xl md:[&_h1]:text-3xl [&_h1]:font-black [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:text-transparent [&_h1]:bg-clip-text [&_h1]:bg-gradient-to-r [&_h1]:from-blue-400 [&_h1]:to-emerald-400
                                 [&_h2]:text-xl md:[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-blue-300
                                 [&_h3]:text-lg md:[&_h3]:text-xl [&_h3]:font-bold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-emerald-300
                                 [&_h4]:text-base md:[&_h4]:text-lg [&_h4]:font-bold [&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:text-slate-300
                                 [&_mark]:px-1.5 [&_mark]:rounded [&_mark]:font-bold
                                 [&_mark.yellow]:!bg-amber-500/20 [&_mark.yellow]:!text-amber-300
                                 [&_mark.green]:!bg-emerald-500/20 [&_mark.green]:!text-emerald-300
                                 [&_mark.blue]:!bg-blue-500/20 [&_mark.blue]:!text-blue-300
                                 [&_mark.red]:!bg-rose-500/20 [&_mark.red]:!text-rose-400
                                 [&_blockquote]:border-r-4 [&_blockquote]:border-emerald-500 [&_blockquote]:bg-slate-800/50 [&_blockquote]:p-5 [&_blockquote]:rounded-l-2xl [&_blockquote]:my-6 [&_blockquote]:italic [&_blockquote]:text-slate-300
                                 [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-2 [&_ul]:my-4 [&_ul]:text-slate-300
                                 [&_hr]:border-slate-700 [&_hr]:my-8
                                 [&_img]:inline-block [&_img]:rounded-2xl [&_img]:shadow-lg [&_img]:my-6 [&_img]:max-h-[300px] md:[&_img]:max-h-[400px] [&_img]:w-auto [&_img]:max-w-full [&_img]:object-contain [&_img]:border [&_img]:border-slate-700
                                 [&_a]:text-cyan-400 [&_a]:underline hover:[&_a]:text-cyan-300" 
                      dangerouslySetInnerHTML={{ __html: dashMsg || "<span class='text-slate-600 font-bold'>התוכן שייכתב יופיע כאן...</span>" }} 
                 />
            </div>
         </div>
      </div>

    </div>
  );
}