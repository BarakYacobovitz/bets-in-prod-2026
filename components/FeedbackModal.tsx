// components/FeedbackModal.tsx
"use client";
import React, { useState, useEffect } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../app/firebase";
import toast from "react-hot-toast";

interface FeedbackModalProps {
  userId: string;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

export default function FeedbackModal({ userId, userName, isOpen, onClose, onSubmitSuccess }: FeedbackModalProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [ratingGeneral, setRatingGeneral] = useState(0);
  const [ratingUsability, setRatingUsability] = useState(0);
  const [willRegister2028, setWillRegister2028] = useState("");
  const [useForChampions, setUseForChampions] = useState("");
  const [readWhatsAppColumn, setReadWhatsAppColumn] = useState("");
  const [readWebsiteColumn, setReadWebsiteColumn] = useState("");
  const [improvements, setImprovements] = useState("");
  const [preservations, setPreservations] = useState("");

  useEffect(() => {
    if (isOpen && userId) {
      const loadExistingFeedback = async () => {
        try {
          const docRef = doc(db, "feedbacks", userId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setRatingGeneral(data.ratingGeneral || 0);
            setRatingUsability(data.ratingUsability || 0);
            setWillRegister2028(data.willRegister2028 || "");
            setUseForChampions(data.useForChampions || "");
            setReadWhatsAppColumn(data.readWhatsAppColumn || "");
            setReadWebsiteColumn(data.readWebsiteColumn || "");
            setImprovements(data.improvements || "");
            setPreservations(data.preservations || "");
          } else {
            // Reset to defaults if no document exists yet
            setRatingGeneral(0);
            setRatingUsability(0);
            setWillRegister2028("");
            setUseForChampions("");
            setReadWhatsAppColumn("");
            setReadWebsiteColumn("");
            setImprovements("");
            setPreservations("");
          }
        } catch (err) {
          console.error("Error loading existing feedback:", err);
        }
      };
      loadExistingFeedback();
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ratingGeneral === 0 || ratingUsability === 0 || !willRegister2028 || !useForChampions || !readWhatsAppColumn || !readWebsiteColumn) {
      toast.error("אנא מלא את כל שאלות הבחירה לפני השליחה!");
      return;
    }

    setIsSubmitting(true);
    try {
      await setDoc(doc(db, "feedbacks", userId), {
        userId,
        userName: userName || "משתמש לא ידוע",
        ratingGeneral,
        ratingUsability,
        willRegister2028,
        useForChampions,
        readWhatsAppColumn,
        readWebsiteColumn,
        improvements,
        preservations,
        submittedAt: new Date()
      });
      toast.success("תודה רבה! המשוב שלך התקבל בהצלחה. 🏆");
      onSubmitSuccess();
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error(`שגיאה בשליחת משוב: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && (ratingGeneral === 0 || ratingUsability === 0)) {
      toast.error("אנא דרג את החוויה והשימוש לפני המעבר שלב!");
      return;
    }
    if (step === 2 && (!willRegister2028 || !useForChampions || !readWhatsAppColumn || !readWebsiteColumn)) {
      toast.error("אנא ענה על כל שאלות הבחירה לפני המעבר שלב!");
      return;
    }
    setStep(prev => prev + 1);
  };

  const prevStep = () => setStep(prev => prev - 1);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 text-right" dir="rtl">
      
      {/* Modal Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-fade-in-up">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 left-4 text-slate-400 hover:text-white transition-colors cursor-pointer text-xl w-8 h-8 rounded-full bg-slate-950/30 flex items-center justify-center border border-slate-800"
        >
          ✕
        </button>

        {/* Header */}
        <div className="mb-6 pb-4 border-b border-slate-800/80">
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            <span>🏆</span> סקר סוף טורניר - Bets in PROD
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            נשמח למשוב קצרצר כדי לשפר את החוויה לטורניר הבא!
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex justify-between items-center gap-2 mb-6 text-xs text-slate-400">
          <div className={`flex-1 text-center pb-2 border-b-2 transition-colors ${step >= 1 ? "border-blue-500 text-white font-bold" : "border-slate-800"}`}>שלב 1: דירוג</div>
          <div className={`flex-1 text-center pb-2 border-b-2 transition-colors ${step >= 2 ? "border-blue-500 text-white font-bold" : "border-slate-800"}`}>שלב 2: שימוש וקריאה</div>
          <div className={`flex-1 text-center pb-2 border-b-2 transition-colors ${step >= 3 ? "border-blue-500 text-white font-bold" : "border-slate-800"}`}>שלב 3: הצעות פתוחות</div>
        </div>

        {/* Step Contents */}
        <div className="space-y-6">
          
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              {/* General Rating */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-200 block">1. איך הייתה החוויה הכללית שלך בטורניר? ⭐</label>
                <div className="flex gap-2 justify-start mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingGeneral(star)}
                      className={`text-2xl cursor-pointer p-1 transition-all ${
                        star <= ratingGeneral ? "text-amber-400 scale-110" : "text-slate-600 hover:text-slate-500"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Usability Rating */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-200 block">2. איך הייתה נוחות השימוש באפליקציה (הזנת ניחושים, מעקב)? 📱</label>
                <div className="flex gap-2 justify-start mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingUsability(star)}
                      className={`text-2xl cursor-pointer p-1 transition-all ${
                        star <= ratingUsability ? "text-blue-400 scale-110" : "text-slate-600 hover:text-slate-500"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in text-sm">
              
              {/* WhatsApp Column */}
              <div className="space-y-2">
                <label className="font-bold text-slate-200 block">3. האם קראת את הטור היומי שפורסם בוואטסאפ? 💬</label>
                <div className="grid grid-cols-1 gap-2 mt-1">
                  {[
                    "כן, קראתי בקביעות (טור מעולה!)",
                    "לפעמים / כשיוצא",
                    "לא קראתי בכלל"
                  ].map(opt => (
                    <label key={opt} className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${
                      readWhatsAppColumn === opt ? "bg-blue-600/10 border-blue-500 text-blue-300" : "bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800"
                    }`}>
                      <input 
                        type="radio" 
                        name="whatsapp" 
                        value={opt} 
                        checked={readWhatsAppColumn === opt}
                        onChange={() => setReadWhatsAppColumn(opt)}
                        className="accent-blue-500"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Website Column */}
              <div className="space-y-2">
                <label className="font-bold text-slate-200 block">4. האם נכנסת לקרוא את הטור היומי ישירות באתר? 💻</label>
                <div className="grid grid-cols-1 gap-2 mt-1">
                  {[
                    "כן, קראתי בקביעות באתר",
                    "לפעמים כשנכנסתי להמר",
                    "לא קראתי באתר"
                  ].map(opt => (
                    <label key={opt} className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${
                      readWebsiteColumn === opt ? "bg-blue-600/10 border-blue-500 text-blue-300" : "bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800"
                    }`}>
                      <input 
                        type="radio" 
                        name="website" 
                        value={opt} 
                        checked={readWebsiteColumn === opt}
                        onChange={() => setReadWebsiteColumn(opt)}
                        className="accent-blue-500"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Euro 2028 */}
              <div className="space-y-2">
                <label className="font-bold text-slate-200 block">5. האם תרצה להירשם שוב לטורניר ביורו 2028? ⚽</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    "בטוח שכן! ⚽",
                    "אולי",
                    "לא נראה לי"
                  ].map(opt => (
                    <label key={opt} className={`flex flex-col items-center justify-center text-center p-3 rounded-xl border transition-all cursor-pointer text-xs ${
                      willRegister2028 === opt ? "bg-blue-600/10 border-blue-500 text-blue-300 font-bold" : "bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800"
                    }`}>
                      <input 
                        type="radio" 
                        name="register" 
                        value={opt} 
                        checked={willRegister2028 === opt}
                        onChange={() => setWillRegister2028(opt)}
                        className="accent-blue-500 mb-2"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Champions League */}
              <div className="space-y-2">
                <label className="font-bold text-slate-200 block">6. האם היית משתמש בפלטפורמה כזו לניחוש משחקי ליגת האלופות? 🏆</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    "בטוח שכן! ⚽",
                    "אולי",
                    "לא נראה לי"
                  ].map(opt => (
                    <label key={opt} className={`flex flex-col items-center justify-center text-center p-3 rounded-xl border transition-all cursor-pointer text-xs ${
                      useForChampions === opt ? "bg-blue-600/10 border-blue-500 text-blue-300 font-bold" : "bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800"
                    }`}>
                      <input 
                        type="radio" 
                        name="champions" 
                        value={opt} 
                        checked={useForChampions === opt}
                        onChange={() => setUseForChampions(opt)}
                        className="accent-blue-500 mb-2"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in text-sm">
              {/* Improvements */}
              <div className="space-y-2">
                <label className="font-bold text-slate-200 block">7. מה כדאי לשפר/לשנות לקראת הטורניר הבא? 🛠️</label>
                <textarea
                  value={improvements}
                  onChange={e => setImprovements(e.target.value)}
                  placeholder="למשל: סגירת ניחושים בשעה אחרת, חלוקת נקודות, ניקוד שונה על בונוסים וכו'..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-850 rounded-2xl p-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs text-right transition-colors"
                />
              </div>

              {/* Preservations */}
              <div className="space-y-2">
                <label className="font-bold text-slate-200 block">8. מה הכי אהבת שחייבים לשמר בפעם הבאה? 🛡️</label>
                <textarea
                  value={preservations}
                  onChange={e => setPreservations(e.target.value)}
                  placeholder="למשל: הטור היומי של ה-VAR, ממשק המשתמש, הסטטיסטיקות בראדאר וכו'..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-850 rounded-2xl p-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs text-right transition-colors"
                />
              </div>
            </div>
          )}

          {/* Buttons Footer */}
          <div className="flex justify-between items-center gap-3 pt-4 border-t border-slate-800/80">
            {step > 1 ? (
              <button
                key="prev-btn"
                type="button"
                onClick={prevStep}
                className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-black transition-all active:scale-95 cursor-pointer"
              >
                חזור
              </button>
            ) : (
              <button
                key="dismiss-btn"
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-slate-800 text-slate-500 hover:bg-slate-950 text-xs font-black transition-all active:scale-95 cursor-pointer"
              >
                הזכר לי אחר כך
              </button>
            )}

            {step < 3 ? (
              <button
                key="next-btn"
                type="button"
                onClick={nextStep}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition-all active:scale-95 shadow-md cursor-pointer"
              >
                המשך
              </button>
            ) : (
              <button
                key="submit-btn"
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all active:scale-95 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "⏳ שולח משוב..." : "🚀 שליחת משוב וסיום"}
              </button>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
