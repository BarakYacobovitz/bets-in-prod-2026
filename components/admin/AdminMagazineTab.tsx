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
  
  const [isSubtextHtmlMode, setIsSubtextHtmlMode] = useState(false);
  const [isMsgHtmlMode, setIsMsgHtmlMode] = useState(false);
  
  const msgRef = useRef<HTMLDivElement>(null);
  const subtextRef = useRef<HTMLDivElement>(null);
  const activeEditorRef = useRef<HTMLDivElement | null>(null);

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

          if (msgRef.current) msgRef.current.innerHTML = data.dailyMessage || "";
          if (subtextRef.current) subtextRef.current.innerHTML = data.dailySubtext || "";
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
      const finalMsg = isMsgHtmlMode ? dashMsg : (msgRef.current?.innerHTML || "");
      const finalSubtext = isSubtextHtmlMode ? dashSubtext : (subtextRef.current?.innerHTML || "");

      await setDoc(doc(db, "settings", "dashboard"), {
        dailyMessage: finalMsg,
        dailyMediaUrl: dashMediaUrl,
        dailySubtext: finalSubtext,
        studioQuotes: {
          trump: trumpQuote,
          canadian: canadianQuote,
          mexican: mexicanQuote
        }
      }, { merge: true });
      
      setDashMsg(finalMsg);
      setDashSubtext(finalSubtext);
      
      if (msgRef.current) msgRef.current.innerHTML = finalMsg;
      if (subtextRef.current) subtextRef.current.innerHTML = finalSubtext;
      
      toast.success("המהדורה והדמויות עודכנו בהצלחה!");
    } catch (e) {
      toast.error("שגיאה בשמירת הנתונים");
    } finally {
      setIsSavingDash(false);
    }
  };

  const execCmd = (cmd: string, arg?: string) => {
    document.execCommand(cmd, false, (cmd === 'formatBlock' && arg && !arg.startsWith('<')) ? `<${arg}>` : arg);
    if (activeEditorRef.current === msgRef.current) setDashMsg(msgRef.current?.innerHTML || "");
    if (activeEditorRef.current === subtextRef.current) setDashSubtext(subtextRef.current?.innerHTML || "");
  };

  const ToolBtn = ({ action, children, title, extraClass = "", disabled = false }: any) => (
    <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); action(); }}
      className={`h-8 flex items-center justify-center rounded bg-slate-950 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2 ${extraClass} ${disabled ? 'opacity-30' : ''}`} title={title}>
      {children}
    </button>
  );

  const renderToolbar = (type: 'msg' | 'subtext') => {
    const isHtml = type === 'msg' ? isMsgHtmlMode : isSubtextHtmlMode;
    const setter = type === 'msg' ? setIsMsgHtmlMode : setIsSubtextHtmlMode;
    const ref = type === 'msg' ? msgRef : subtextRef;
    const currentText = type === 'msg' ? dashMsg : dashSubtext;

    return (
     <div className="flex flex-wrap items-center gap-2 mb-0 bg-slate-800 p-2 rounded-t-xl border border-slate-700 border-b-0 sticky top-0 z-20">
        <button type="button" onClick={() => {
            if (!isHtml && ref.current) (type === 'msg' ? setDashMsg : setDashSubtext)(ref.current.innerHTML);
            else if (isHtml && ref.current) ref.current.innerHTML = currentText;
            setter(!isHtml);
          }}
          className={`h-8 px-3 rounded font-bold text-xs border shadow-sm ${isHtml ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-950 text-emerald-400 border-slate-700 hover:bg-slate-700'}`}>
          {isHtml ? "👁️ חזור לעיצוב" : "</> מצב קוד (AI)"}
        </button>
        <div className="w-px h-6 bg-slate-600 mx-1"></div>
        <ToolBtn disabled={isHtml} action={() => execCmd('formatBlock', 'p')}>רגיל</ToolBtn>
        <ToolBtn disabled={isHtml} action={() => execCmd('formatBlock', 'h1')} extraClass="font-black">H1</ToolBtn>
        <ToolBtn disabled={isHtml} action={() => execCmd('formatBlock', 'h2')} extraClass="font-bold text-blue-300">H2</ToolBtn>
        <ToolBtn disabled={isHtml} action={() => execCmd('bold')} extraClass="w-8 font-black">B</ToolBtn>
        <ToolBtn disabled={isHtml} action={() => execCmd('justifyCenter')} extraClass="w-8">↔</ToolBtn>
        <ToolBtn disabled={isHtml} action={() => execCmd('removeFormat')} extraClass="w-8">🧹</ToolBtn>
     </div>
    );
  };

  return (
    <div className="animate-fade-in-up flex flex-col gap-8 p-4">
      
      {/* פאנל ניהול ציטוטי הדמויות (בשורה מלאה משלו!) */}
      <div className="bg-slate-800 p-6 md:p-8 rounded-3xl border border-slate-700 shadow-xl">
        <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <span>🎭</span> דיבובי הדמויות בלייב
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              עדכן מה הדמויות צועקות כרגע במסך הראשי של המשתמשים. (הטקסט יישמר כשתלחץ על "שמור ופרסם" למטה)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 p-5 rounded-2xl border border-rose-500/30 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-600 to-red-500"></div>
            <h3 className="font-bold text-lg text-slate-200 mb-3 flex items-center gap-2" dir="ltr"><span className="text-2xl">🇺🇸</span> Trump</h3>
            <textarea value={trumpQuote} onChange={(e) => setTrumpQuote(e.target.value)} placeholder="Make Bets in PROD Great Again!..." className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm outline-none focus:border-rose-500 h-20 resize-none" dir="rtl" />
          </div>
          <div className="bg-slate-900 p-5 rounded-2xl border border-emerald-500/30 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-600 to-green-400"></div>
            <h3 className="font-bold text-lg text-slate-200 mb-3 flex items-center gap-2" dir="ltr"><span className="text-2xl">🇲🇽</span> Mexicano</h3>
            <textarea value={mexicanQuote} onChange={(e) => setMexicanQuote(e.target.value)} placeholder="אמיגוס, איזה משחק..." className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm outline-none focus:border-emerald-500 h-20 resize-none" dir="rtl" />
          </div>
          <div className="bg-slate-900 p-5 rounded-2xl border border-blue-500/30 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-400"></div>
            <h3 className="font-bold text-lg text-slate-200 mb-3 flex items-center gap-2" dir="ltr"><span className="text-2xl">🇨🇦</span> Canadian</h3>
            <textarea value={canadianQuote} onChange={(e) => setCanadianQuote(e.target.value)} placeholder="Sorry eh..." className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500 h-20 resize-none" dir="rtl" />
          </div>
        </div>
      </div>

      {/* הגריד שמפצל את המסך לחצי עורך וחצי תצוגה מקדימה */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col h-full">
           <h3 className="text-xl font-black text-white mb-6">✍️ עורך הטור היומי</h3>
           <div className="flex flex-col mb-6">
            <label className="block text-slate-400 text-sm font-bold mb-2">🖼️ תמונה/וידאו ראשית (לינק)</label>
            <input 
              type="text" value={dashMediaUrl} onChange={(e) => setDashMediaUrl(e.target.value)}
              placeholder="הכנס לינק... (השאר ריק כדי להעלים את האיש המתרגש לנצח)" 
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-200 text-sm outline-none focus:border-blue-500 transition-colors" dir="ltr" 
            />
          </div>
           <div className="space-y-6 flex-1 flex flex-col">
             <div className="flex flex-col">
               <label className="block text-slate-400 text-sm font-bold mb-2">📝 תקציר / כותרת משנה</label>
               {renderToolbar('subtext')}
               {isSubtextHtmlMode ? (
                 <textarea value={dashSubtext} onChange={(e) => setDashSubtext(e.target.value)} className="w-full bg-slate-950 border border-emerald-500/50 rounded-b-xl p-4 text-emerald-400 font-mono text-sm min-h-[120px] outline-none" dir="ltr" />
               ) : (
                 <div ref={subtextRef} contentEditable onFocus={(e) => activeEditorRef.current = e.currentTarget} onInput={() => setDashSubtext(subtextRef.current?.innerHTML || "")} className="w-full bg-slate-950 border border-slate-700 rounded-b-xl p-4 text-slate-200 min-h-[120px] outline-none" dir="rtl" />
               )}
             </div>
             <div className="flex-1 flex flex-col">
               <label className="block text-slate-400 text-sm font-bold mb-2">📄 התוכן המלא של הכתבה</label>
               {renderToolbar('msg')}
               {isMsgHtmlMode ? (
                 <textarea value={dashMsg} onChange={(e) => setDashMsg(e.target.value)} className="w-full flex-1 bg-slate-950 border border-emerald-500/50 rounded-b-xl p-6 text-emerald-400 font-mono text-sm min-h-[300px] outline-none" dir="ltr" />
               ) : (
                 <div ref={msgRef} contentEditable onFocus={(e) => activeEditorRef.current = e.currentTarget} onInput={() => setDashMsg(msgRef.current?.innerHTML || "")} className="w-full flex-1 bg-slate-950 border border-slate-700 rounded-b-xl p-6 text-slate-200 min-h-[300px] outline-none" dir="rtl" />
               )}
             </div>
             <button onClick={handleSaveDashboard} disabled={isSavingDash} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl shadow-lg">
               {isSavingDash ? "שומר..." : "💾 שמור ופרסם הכל"}
             </button>
           </div>
        </div>
        
        {/* תצוגה מקדימה */}
        <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl overflow-y-auto custom-scrollbar h-full max-h-[85vh] sticky top-4">
          <div className="mb-8 pb-8 border-b border-slate-800">
             <h3 className="text-lg font-black text-slate-400 mb-4">👁️ כרטיס טיזר (כפי שיופיע בדשבורד בחוץ)</h3>
             <div className="w-full max-w-sm mx-auto bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-700 hover:border-blue-500/50 transition-all flex flex-col overflow-hidden opacity-80 cursor-not-allowed">
                {dashMediaUrl && (
                  <div className="w-full mb-4 overflow-hidden rounded-2xl border border-slate-800">
                    {dashMediaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null ? (
                      <img src={dashMediaUrl} alt="Magazine" className="w-full h-auto object-cover" />
                    ) : (
                      <video src={dashMediaUrl} autoPlay loop muted playsInline className="w-full h-auto object-cover" />
                    )}
                  </div>
                )}
                <div 
                  className="w-full overflow-hidden [&_img]:w-full [&_img]:h-auto [&_img]:rounded-2xl [&_h1]:text-2xl [&_h2]:text-xl [&_p]:text-sm [&_p]:text-slate-300"
                  dangerouslySetInnerHTML={{ __html: dashSubtext || "אין עדכונים מיוחדים הבוקר." }} 
                />
                <button disabled className="mt-4 bg-slate-800 text-slate-500 font-bold py-3 w-full rounded-xl border border-slate-700 text-sm shadow-md">
                   קרא את המהדורה המלאה 👈
                </button>
             </div>
          </div>
          <div>
             <h3 className="text-lg font-black text-slate-400 mb-4">📰 המודל הפנימי (לאחר לחיצה על הכרטיס)</h3>
             <div className="bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-700 flex flex-col overflow-hidden shadow-2xl relative">
                <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-blue-400 to-emerald-500"></div>
                <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-4 pr-2">
                   <h3 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">📰 המהדורה המרכזית</h3>
                </div>
                {dashMediaUrl && (
                  <div className="w-full mb-6 overflow-hidden rounded-2xl border border-slate-800 shadow-lg">
                      {dashMediaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null ? (
                        <img src={dashMediaUrl} alt="Preview" className="w-full max-h-[300px] object-contain mx-auto" />
                      ) : (
                        <video src={dashMediaUrl} autoPlay loop muted playsInline controls className="w-full max-h-[300px] object-contain mx-auto" />
                      )}
                  </div>
                )}
                  <div 
                    className="w-full h-full text-slate-200 text-base md:text-lg leading-relaxed [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-2xl [&_h1]:text-2xl md:[&_h1]:text-3xl [&_h1]:font-black [&_h1]:text-emerald-400 [&_h2]:text-xl md:[&_h2]:text-2xl [&_mark]:bg-emerald-500/20 [&_mark]:text-emerald-300 [&_blockquote]:border-r-4 [&_blockquote]:bg-slate-800/50 [&_blockquote]:p-4"
                    dangerouslySetInnerHTML={{ __html: dashMsg || "<p class='text-slate-500 italic'>הכתבה המלאה ריקה...</p>" }} 
                  />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}