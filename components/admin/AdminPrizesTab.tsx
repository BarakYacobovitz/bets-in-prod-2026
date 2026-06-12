"use client";
import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../app/firebase";
import toast from "react-hot-toast";

export default function AdminPrizesTab() {
  const [prizes, setPrizes] = useState({
    main1: 0, main2: 0, main3: 0, main4: 0,
    ko1: 0, ko2: 0, ko3: 0
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchPrizes = async () => {
      try {
        const docSnap = await getDoc(doc(db, "settings", "prizes"));
        if (docSnap.exists()) {
          setPrizes(docSnap.data() as any);
        }
      } catch (e) {
        console.error("Error fetching prizes:", e);
      }
    };
    fetchPrizes();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "settings", "prizes"), prizes);
      toast.success("טבלת הפרסים עודכנה ופורסמה לכולם! 💸");
    } catch (e) {
      toast.error("שגיאה בשמירת הנתונים");
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = "w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-center text-emerald-400 font-black text-lg outline-none focus:border-emerald-500 transition-all";

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* טבלה ראשית */}
        <div className="bg-slate-800/50 p-6 rounded-3xl border border-amber-500/20 shadow-xl backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">🏆</span>
            <div>
              <h3 className="text-xl font-black text-white">ליגת האלופים (ראשית)</h3>
              <p className="text-slate-400 text-xs">הפרסים עבור ארבעת המקומות הראשונים</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((num) => (
              <div key={num} className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                <label className="block text-slate-500 text-[10px] font-bold mb-2 uppercase tracking-widest">מקום {num}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500/50 font-bold">₪</span>
                  <input 
                    type="number" 
                    value={prizes[`main${num}` as keyof typeof prizes]} 
                    onChange={(e) => setPrizes({...prizes, [`main${num}`]: Number(e.target.value)})}
                    className={inputClass}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* טבלת נוקאאוט */}
        <div className="bg-slate-800/50 p-6 rounded-3xl border border-purple-500/20 shadow-xl backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">⚔️</span>
            <div>
              <h3 className="text-xl font-black text-white">אלופי הנוק-אאוט</h3>
              <p className="text-slate-400 text-xs">הפרסים עבור שלושת המקומות הראשונים</p> {/* עדכון טקסט */}
            </div>
          </div>
          
          {/* הוספנו את המספר 3 למערך! */}
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3].map((num) => (
              <div key={num} className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                <label className="block text-slate-500 text-[10px] font-bold mb-2 uppercase tracking-widest">מקום {num}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500/50 font-bold">₪</span>
                  <input 
                    type="number" 
                    value={prizes[`ko${num}` as keyof typeof prizes]} 
                    onChange={(e) => setPrizes({...prizes, [`ko${num}`]: Number(e.target.value)})}
                    className={inputClass}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button 
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all active:scale-[0.98] disabled:opacity-50 text-lg flex items-center justify-center gap-3"
      >
        {isSaving ? "מעדכן... ⏳" : "🚀 שמור ופרסם טבלת פרסים"}
      </button>
    </div>
  );
}