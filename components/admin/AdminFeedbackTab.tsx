// components/admin/AdminFeedbackTab.tsx
"use client";
import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../app/firebase";
import toast from "react-hot-toast";

interface FeedbackItem {
  id: string;
  userId: string;
  userName: string;
  ratingGeneral: number;
  ratingUsability: number;
  willRegister2028: string;
  useForChampions: string;
  readWhatsAppColumn: string;
  readWebsiteColumn: string;
  improvements: string;
  preservations: string;
  submittedAt?: any;
}

export default function AdminFeedbackTab() {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "feedbacks"));
      const list: FeedbackItem[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({
          id: d.id,
          userId: data.userId || d.id,
          userName: data.userName || "משתמש לא ידוע",
          ratingGeneral: Number(data.ratingGeneral) || 0,
          ratingUsability: Number(data.ratingUsability) || 0,
          willRegister2028: data.willRegister2028 || "",
          useForChampions: data.useForChampions || "",
          readWhatsAppColumn: data.readWhatsAppColumn || "",
          readWebsiteColumn: data.readWebsiteColumn || "",
          improvements: data.improvements || "",
          preservations: data.preservations || "",
          submittedAt: data.submittedAt
        });
      });
      
      // Sort by submitted time or name
      list.sort((a, b) => {
        const timeA = a.submittedAt?.seconds || 0;
        const timeB = b.submittedAt?.seconds || 0;
        return timeB - timeA; // newest first
      });

      setFeedbacks(list);
    } catch (e: any) {
      console.error(e);
      toast.error(`שגיאה בטעינת משובים: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate statistics
  const stats = React.useMemo(() => {
    const total = feedbacks.length;
    if (total === 0) return { total: 0, avgGeneral: 0, avgUsability: 0, regYes: 0, regMaybe: 0, championsYes: 0, championsMaybe: 0, waYes: 0, webYes: 0 };

    let sumGeneral = 0;
    let sumUsability = 0;
    let regYes = 0;
    let regMaybe = 0;
    let championsYes = 0;
    let championsMaybe = 0;
    let waYes = 0;
    let webYes = 0;

    feedbacks.forEach(f => {
      sumGeneral += f.ratingGeneral;
      sumUsability += f.ratingUsability;
      if (f.willRegister2028?.includes("כן")) regYes++;
      if (f.willRegister2028?.includes("אולי")) regMaybe++;
      if (f.useForChampions?.includes("כן")) championsYes++;
      if (f.useForChampions?.includes("אולי")) championsMaybe++;
      if (f.readWhatsAppColumn?.includes("קביעות")) waYes++;
      if (f.readWebsiteColumn?.includes("קביעות")) webYes++;
    });

    return {
      total,
      avgGeneral: (sumGeneral / total).toFixed(1),
      avgUsability: (sumUsability / total).toFixed(1),
      regYes: Math.round((regYes / total) * 100),
      regMaybe: Math.round((regMaybe / total) * 100),
      championsYes: Math.round((championsYes / total) * 100),
      championsMaybe: Math.round((championsMaybe / total) * 100),
      waYes: Math.round((waYes / total) * 100),
      webYes: Math.round((webYes / total) * 100)
    };
  }, [feedbacks]);

  const filteredFeedbacks = feedbacks.filter(f => 
    f.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.improvements.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.preservations.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-right" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <span>💬</span> דשבורד משובים והצעות לשיפור
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            צפייה בסטטיסטיקות סקר סוף הטורניר וניתוח הצעות השיפור והשימור של המשתתפים.
          </p>
        </div>
        
        <button 
          onClick={fetchFeedbacks}
          className="px-5 py-2.5 rounded-2xl border border-slate-700 hover:bg-slate-800 text-white font-black text-sm active:scale-95 transition-all"
        >
          🔄 רענן נתונים
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-400 font-bold">טוען משובים...</span>
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="text-center py-16 text-slate-500 font-bold border border-dashed border-slate-800 rounded-3xl bg-slate-950/20">
          📥 טרם התקבלו משובים בטורניר זה.
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            {/* Cards */}
            <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-3xl flex flex-col items-center text-center">
              <span className="text-3xl mb-1">👥</span>
              <span className="text-sm text-slate-400">סה"כ משובים</span>
              <span className="text-3xl font-black text-white mt-2">{stats.total}</span>
            </div>

            <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-3xl flex flex-col items-center text-center">
              <span className="text-3xl mb-1">⭐</span>
              <span className="text-sm text-slate-400">חוויה כללית ממוצעת</span>
              <span className="text-3xl font-black text-amber-400 mt-2">{stats.avgGeneral} / 5</span>
            </div>

            <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-3xl flex flex-col items-center text-center">
              <span className="text-3xl mb-1">⚙️</span>
              <span className="text-sm text-slate-400">נוחות שימוש באפליקציה</span>
              <span className="text-3xl font-black text-blue-400 mt-2">{stats.avgUsability} / 5</span>
            </div>

            <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-3xl flex flex-col items-center text-center">
              <span className="text-3xl mb-1">📅</span>
              <span className="text-sm text-slate-400">ירשמו שוב ב-2028?</span>
              <span className="text-3xl font-black text-emerald-400 mt-2">{stats.regYes}%</span>
              <span className="text-xs text-slate-500 mt-1">(ועוד {stats.regMaybe}% סימנו אולי)</span>
            </div>

          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-950/20 border border-slate-850 p-5 rounded-3xl">
            <div>
              <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> קריאת הטור היומי בוואטסאפ בקביעות:
              </h4>
              <div className="w-full bg-slate-900 rounded-full h-3.5 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${stats.waYes}%` }}></div>
              </div>
              <span className="text-xs text-slate-400 mt-1 block">{stats.waYes}% מהמשיבים קראו בקביעות</span>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> קריאת הטור היומי באתר בקביעות:
              </h4>
              <div className="w-full bg-slate-900 rounded-full h-3.5 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full transition-all" style={{ width: `${stats.webYes}%` }}></div>
              </div>
              <span className="text-xs text-slate-400 mt-1 block">{stats.webYes}% מהמשיבים קראו בקביעות</span>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> שימוש בניחושי ליגת האלופות:
              </h4>
              <div className="w-full bg-slate-900 rounded-full h-3.5 overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${stats.championsYes}%` }}></div>
              </div>
              <span className="text-xs text-slate-400 mt-1 block">{stats.championsYes}% ירצו לניחושי ליגת האלופות (עוד {stats.championsMaybe}% אולי)</span>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <input 
              type="text"
              placeholder="🔍 חפש משוב או הצעה (לפי משתמש או טקסט)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 text-white rounded-2xl px-4 py-3 text-sm focus:outline-none transition-colors text-right"
            />
          </div>

          {/* Feedbacks Grid */}
          <div className="grid grid-cols-1 gap-6">
            {filteredFeedbacks.map(f => (
              <div key={f.id} className="bg-slate-950/40 border border-slate-850 rounded-3xl p-5 hover:border-slate-800 transition-all flex flex-col gap-4">
                
                {/* Header */}
                <div className="flex justify-between items-center gap-4 border-b border-slate-850/60 pb-3">
                  <div>
                    <h4 className="text-md font-black text-white">{f.userName}</h4>
                    <span className="text-xs text-slate-500">
                      {f.submittedAt ? new Date(f.submittedAt.seconds * 1000).toLocaleString("he-IL") : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1">
                      ⭐ חוויה: {f.ratingGeneral}
                    </span>
                    <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1">
                      ⚙️ שימוש: {f.ratingUsability}
                    </span>
                  </div>
                </div>

                {/* Question Info Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-400 bg-slate-950/20 p-3 rounded-2xl">
                  <div>📞 קרא בוואטסאפ: <strong className="text-slate-200">{f.readWhatsAppColumn}</strong></div>
                  <div>💻 קרא באתר: <strong className="text-slate-200">{f.readWebsiteColumn}</strong></div>
                  <div>✍️ יורו 2028: <strong className="text-slate-200">{f.willRegister2028}</strong></div>
                  <div>🏆 ליגת האלופות: <strong className="text-slate-200">{f.useForChampions || "לא ענה"}</strong></div>
                </div>

                {/* Text suggestions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  
                  {/* Improvements */}
                  <div className="bg-rose-950/5 border border-rose-500/10 p-4 rounded-2xl text-xs">
                    <h5 className="font-black text-rose-400 mb-2 flex items-center gap-1">
                      <span>🛠️</span> מה לשפר לקראת הפעם הבאה?
                    </h5>
                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {f.improvements ? `"${f.improvements}"` : <span className="text-slate-600">לא נכתבה הצעה</span>}
                    </p>
                  </div>

                  {/* Keep/Preserve */}
                  <div className="bg-emerald-950/5 border border-emerald-500/10 p-4 rounded-2xl text-xs">
                    <h5 className="font-black text-emerald-400 mb-2 flex items-center gap-1">
                      <span>🛡️</span> מה לשמר (היה מעולה)?
                    </h5>
                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {f.preservations ? `"${f.preservations}"` : <span className="text-slate-600">לא נכתב משוב</span>}
                    </p>
                  </div>

                </div>

              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
