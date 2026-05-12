"use client";
import React, { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../app/firebase"; 
import toast from "react-hot-toast";

export default function AdminMagazineTab() {
  const [dashMsg, setDashMsg] = useState("");
  const [dashMediaUrl, setDashMediaUrl] = useState("");
  const [dashSubtext, setDashSubtext] = useState("");
  
  const [trumpQuote, setTrumpQuote] = useState("");
  const [canadianQuote, setCanadianQuote] = useState("");
  const [mexicanQuote, setMexicanQuote] = useState("");
  
  const [isSavingDash, setIsSavingDash] = useState(false);
  
  const msgRef = useRef<HTMLTextAreaElement>(null);
  const subtextRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchDashSettings = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "dashboard"));
        if (snap.exists()) {
          const data = snap.data();
          setDashMsg(data.dailyMessage || "");
          setDashMediaUrl(data.dailyMediaUrl || "");
          setDashSubtext(data.dailySubtext || "");
          
          if (data.studioQuotes) {
            setTrumpQuote(data.studioQuotes.trump || "");
            setCanadianQuote(data.studioQuotes.canadian || "");
            setMexicanQuote(data.studioQuotes.mexican || "");
          }
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
        dailySubtext: dashSubtext,
        studioQuotes: {
          trump: trumpQuote,
          canadian: canadianQuote,
          mexican: mexicanQuote
        }
      }, { merge: true });
      toast.success("המהדורה ומשפטי הפאנל עודכנו בהצלחה!");
    } catch (e) {
      toast.error("שגיאה בשמירת הנתונים");
    } finally {
      setIsSavingDash(false);
    }
  };

  const wrapText = (prefix: string, suffix: string, target: 'msg' | 'subtext') => {
    const ref = target === 'msg' ? msgRef : subtextRef;
    const textState = target === 'msg' ? dashMsg : dashSubtext;
    const setTextState = target === 'msg' ? setDashMsg : setDashSubtext;

    if (!ref.current) return;
    const start = ref.current.selectionStart;
    const end = ref.current.selectionEnd;
    const selectedText = textState.substring(start, end);
    
    const textToWrap = selectedText.length > 0 ? selectedText : "טקסט";
    const newText = textState.substring(0, start) + prefix + textToWrap + suffix + textState.substring(end);
    
    setTextState(newText);
    
    setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        ref.current.setSelectionRange(start + prefix.length, start + prefix.length + textToWrap.length);
      }
    }, 0);
  };

  const renderToolbar = (target: 'msg' | 'subtext') => (
     <div className="flex flex-col gap-3 mb-0 bg-slate-800/90 p-3 rounded-t-xl border border-slate-700 border-b-0 shadow-inner">
        {/* שורה 1: טיפוגרפיה, יישור וסגנון בסיסי */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* כותרות */}
          {target === 'msg' && (
            <div className="flex items-center bg-slate-950 rounded-lg border border-slate-700 overflow-hidden shadow-sm">
              <button onClick={() => wrapText('<h1>', '</h1>', target)} className="px-3 h-8 hover:bg-slate-700 text-white font-black text-sm border-l border-slate-700" title="כותרת ראשית (H1)">H1</button>
              <button onClick={() => wrapText('<h2>', '</h2>', target)} className="px-3 h-8 hover:bg-slate-700 text-white font-bold text-sm border-l border-slate-700" title="כותרת משנית (H2)">H2</button>
              <button onClick={() => wrapText('<h3>', '</h3>', target)} className="px-3 h-8 hover:bg-slate-700 text-white font-medium text-sm" title="כותרת קטנה (H3)">H3</button>
            </div>
          )}

          {/* מראה טקסט */}
          <div className="flex items-center bg-slate-950 rounded-lg border border-slate-700 overflow-hidden shadow-sm">
            <button onClick={() => wrapText('<b>', '</b>', target)} className="w-8 h-8 hover:bg-slate-700 text-white font-black border-l border-slate-700" title="הדגש (Bold)">B</button>
            <button onClick={() => wrapText('<i>', '</i>', target)} className="w-8 h-8 hover:bg-slate-700 text-white italic font-serif border-l border-slate-700" title="נטוי (Italic)">I</button>
            <button onClick={() => wrapText('<u>', '</u>', target)} className="w-8 h-8 hover:bg-slate-700 text-white underline" title="קו תחתון (Underline)">U</button>
          </div>

          {/* יישור טקסט (מרכז, ימין, שמאל) */}
          <div className="flex items-center bg-slate-950 rounded-lg border border-slate-700 overflow-hidden shadow-sm" dir="ltr">
             <button onClick={() => wrapText('<div style="text-align: left;">\n', '\n</div>', target)} className="w-8 h-8 hover:bg-slate-700 text-white text-lg border-r border-slate-700" title="יישור לשמאל">⇤</button>
             <button onClick={() => wrapText('<div style="text-align: center;">\n', '\n</div>', target)} className="w-8 h-8 hover:bg-slate-700 text-white text-lg border-r border-slate-700" title="מרכוז טקסט">↔</button>
             <button onClick={() => wrapText('<div style="text-align: right;">\n', '\n</div>', target)} className="w-8 h-8 hover:bg-slate-700 text-white text-lg" title="יישור לימין">⇥</button>
          </div>

          {/* טקסט רגיל / ללא צבע */}
          <button onClick={() => wrapText('<span style="color: #e2e8f0; font-weight: normal; background: transparent;">', '</span>', target)} className="px-3 h-8 flex items-center justify-center bg-slate-950 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 shadow-sm transition-colors" title="נקה עיצוב וצבע חזרה לטקסט רגיל">טקסט רגיל (נקי)</button>
        </div>

        {/* שורה 2: מרקרים, קישורים, ציטוטים ומדיה */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* מרקרים (צבעים) */}
          <div className="flex items-center bg-slate-950 rounded-lg border border-slate-700 px-2 py-1 gap-2 shadow-sm">
             <span className="text-xs text-slate-500 font-bold ml-1">הדגשה:</span>
             <button onClick={() => wrapText('<mark class="yellow">', '</mark>', target)} className="w-5 h-5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] hover:scale-125 transition-transform" title="צהוב"></button>
             <button onClick={() => wrapText('<mark class="green">', '</mark>', target)} className="w-5 h-5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] hover:scale-125 transition-transform" title="ירוק"></button>
             <button onClick={() => wrapText('<mark class="red">', '</mark>', target)} className="w-5 h-5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.5)] hover:scale-125 transition-transform" title="אדום"></button>
             <button onClick={() => wrapText('<mark class="blue">', '</mark>', target)} className="w-5 h-5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] hover:scale-125 transition-transform" title="כחול"></button>
          </div>

          <div className="w-px h-6 bg-slate-600"></div>

          {/* קישורים ותוספות */}
          <div className="flex items-center gap-1">
             <button onClick={() => wrapText('<a href="כאן_שמים_את_הלינק" target="_blank">', '</a>', target)} className="w-8 h-8 flex items-center justify-center bg-slate-950 hover:bg-slate-700 text-cyan-400 rounded-lg border border-slate-700 shadow-sm" title="הוסף קישור">🔗</button>
             <button onClick={() => wrapText('<blockquote>\n', '\n</blockquote>', target)} className="w-8 h-8 flex items-center justify-center bg-slate-950 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-xl font-serif shadow-sm" title="ציטוט בולט (Blockquote)">"</button>
             <button onClick={() => wrapText('<ul>\n  <li>', '</li>\n</ul>', target)} className="w-8 h-8 flex items-center justify-center bg-slate-950 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 shadow-sm" title="רשימה עם נקודות (Bullets)">📋</button>
          </div>

          {target === 'msg' && (
            <>
              <div className="w-px h-6 bg-slate-600 mx-1"></div>
              {/* כפתורי מדיה */}
              <div className="flex items-center gap-1">
                <button onClick={() => wrapText('<img src="כאן_הלינק_לתמונה" alt="תמונה" />', '', target)} className="w-8 h-8 flex items-center justify-center bg-slate-950 hover:bg-slate-700 text-purple-400 rounded-lg border border-slate-700 shadow-sm" title="תמונה בתוך הטקסט">🖼️</button>
                <button onClick={() => wrapText('<video src="כאן_הלינק_לוידאו_ישיר" autoplay loop muted playsinline controls></video>', '', target)} className="w-8 h-8 flex items-center justify-center bg-slate-950 hover:bg-slate-700 text-pink-400 rounded-lg border border-slate-700 shadow-sm" title="וידאו (MP4)">🎬</button>
                <button onClick={() => wrapText('<iframe src="https://www.youtube.com/embed/', '" title="YouTube video player" frameborder="0" allowfullscreen></iframe>', target)} className="w-8 h-8 flex items-center justify-center bg-slate-950 hover:bg-slate-700 text-red-500 rounded-lg border border-slate-700 shadow-sm" title="סרטון יוטיוב">🟥</button>
              </div>
            </>
          )}
          
          <button onClick={() => wrapText('<br/>\n', '', target)} className="mr-auto w-8 h-8 flex items-center justify-center bg-slate-950 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 shadow-sm" title="שבירת שורה (אנטר קשיח)">⏎</button>
        </div>
     </div>
  );

  return (
    <div className="animate-fade-in-up grid grid-cols-1 xl:grid-cols-2 gap-8">
      
      {/* פאנל העריכה */}
      <div className="bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden flex flex-col h-full">
         <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>
         <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2"><span>✍️</span> עורך הטור היומי (Magazine)</h3>
         
         <div className="space-y-6 flex-1 flex flex-col">
           
           <div className="flex flex-col">
             <label className="block text-slate-400 text-sm font-bold mb-2">📝 תקציר / כותרת משנה</label>
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

           <div className="flex-1 flex flex-col">
             <label className="block text-slate-400 text-sm font-bold mb-2">📄 התוכן המלא של הכתבה</label>
             {renderToolbar('msg')}
             <textarea 
               ref={msgRef}
               value={dashMsg} 
               onChange={(e) => setDashMsg(e.target.value)} 
               className="w-full flex-1 bg-slate-950 border border-slate-700 rounded-b-xl p-4 text-slate-300 outline-none focus:border-emerald-500 min-h-[200px] font-mono text-base leading-relaxed custom-scrollbar" 
               placeholder="סמן מילה ולחץ על הכלים למעלה כדי לעצב אותה..." 
               dir="rtl"
             />
           </div>

           <div className="pt-6 mt-4 border-t border-slate-800">
             <h4 className="text-lg font-black text-white mb-4 flex items-center gap-2"><span>🎙️</span> עדכון משפטי חברי הפאנל</h4>
             <div className="space-y-4">
                <div className="relative">
                   <div className="absolute top-1/2 -translate-y-1/2 right-3 text-xl">🇺🇸</div>
                   <input 
                     type="text" 
                     value={trumpQuote}
                     onChange={(e) => setTrumpQuote(e.target.value)}
                     className="w-full bg-slate-950 border border-rose-500/50 rounded-xl py-3 pr-10 pl-3 text-rose-100 outline-none focus:border-rose-500 shadow-inner"
                     dir="rtl"
                   />
                </div>
                <div className="relative">
                   <div className="absolute top-1/2 -translate-y-1/2 right-3 text-xl">🇨🇦</div>
                   <input 
                     type="text" 
                     value={canadianQuote}
                     onChange={(e) => setCanadianQuote(e.target.value)}
                     className="w-full bg-slate-950 border border-blue-500/50 rounded-xl py-3 pr-10 pl-3 text-blue-100 outline-none focus:border-blue-500 shadow-inner"
                     dir="rtl"
                   />
                </div>
                <div className="relative">
                   <div className="absolute top-1/2 -translate-y-1/2 right-3 text-xl">🇲🇽</div>
                   <input 
                     type="text" 
                     value={mexicanQuote}
                     onChange={(e) => setMexicanQuote(e.target.value)}
                     className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl py-3 pr-10 pl-3 text-emerald-100 outline-none focus:border-emerald-500 shadow-inner"
                     dir="rtl"
                   />
                </div>
             </div>
           </div>
           
           <button 
             onClick={handleSaveDashboard} 
             disabled={isSavingDash}
             className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-95 text-lg flex items-center justify-center gap-2"
           >
             {isSavingDash ? "שומר נתונים..." : "💾 שמור ופרסם לחבר'ה"}
           </button>
         </div>
      </div>

      {/* פאנל תצוגה מקדימה */}
      <div className="bg-slate-950 p-4 md:p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col h-full">
         <h3 className="text-lg font-black text-slate-400 mb-4 flex items-center gap-2"><span>👁️</span> תצוגה מקדימה חיה</h3>
         
         <div className="bg-slate-900 border border-slate-700 p-6 md:p-8 rounded-3xl w-full flex flex-col shadow-2xl relative overflow-hidden flex-1">
            <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-blue-400 to-emerald-500"></div>
            
            <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-4 pr-4">
              <div>
                <h3 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 flex items-center gap-3">
                   <span className="text-white drop-shadow-md">📰</span> המהדורה המרכזית
                </h3>
                <div className="text-slate-500 text-sm font-medium mt-1">{new Date().toLocaleDateString('he-IL')}</div>
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

                 {dashSubtext && (
                    <div 
                      className="text-slate-300 text-base md:text-lg leading-relaxed mb-6 font-medium whitespace-pre-wrap italic border-r-4 border-slate-600 pr-4 [&_b]:text-amber-400 [&_strong]:text-amber-400 [&_mark]:px-1.5 [&_mark]:rounded [&_mark.yellow]:bg-amber-500/20 [&_mark.yellow]:text-amber-300 [&_mark.green]:bg-emerald-500/20 [&_mark.green]:text-emerald-300 [&_mark.red]:bg-rose-500/20 [&_mark.red]:text-rose-400 [&_a]:text-cyan-400 [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: dashSubtext }}
                    />
                 )}

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
                                 [&_img]:block [&_img]:mx-auto [&_img]:rounded-2xl [&_img]:shadow-lg [&_img]:my-6 [&_img]:max-h-[300px] md:[&_img]:max-h-[400px] [&_img]:w-auto [&_img]:max-w-full [&_img]:object-contain [&_img]:border [&_img]:border-slate-700
                                 [&_video]:block [&_video]:mx-auto [&_video]:rounded-2xl [&_video]:shadow-lg [&_video]:my-6 [&_video]:max-h-[300px] md:[&_video]:max-h-[400px] [&_video]:w-auto [&_video]:max-w-full [&_video]:object-contain [&_video]:border [&_video]:border-slate-700 [&_video]:bg-slate-950
                                 [&_iframe]:block [&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:rounded-2xl [&_iframe]:shadow-lg [&_iframe]:my-6 [&_iframe]:border [&_iframe]:border-slate-700 [&_iframe]:mx-auto
                                 [&_a]:text-cyan-400 [&_a]:underline hover:[&_a]:text-cyan-300" 
                      dangerouslySetInnerHTML={{ __html: dashMsg || "<span class='text-slate-600 font-bold'>התוכן שייכתב יופיע כאן...</span>" }} 
                 />
            </div>
         </div>
      </div>

    </div>
  );
}