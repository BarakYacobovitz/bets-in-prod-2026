"use client";

export default function Rules() {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 pb-12 animate-fade-in-up" dir="rtl">
      
      {/* כותרת ראשית */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-3xl border border-slate-700 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3 relative z-10 flex items-center gap-3">
          <span>📜</span> חוקים ושיטת ניקוד
        </h1>
        <p className="text-slate-400 text-lg relative z-10 max-w-3xl leading-relaxed">
          ברוכים הבאים ל-Bets in Prod (בעברית: מהמרים בייצור), משחק הניחושים החברי למונדיאל 2026. 
          הכלל הראשון הוא שברגע שאתם מצטרפים, אתם מקבלים על עצמכם שהאדמין הוא הפוסק האחרון. גם אם אתם לא מסכימים ב-100% - החלטתו סופית. 
          <br/><br/>
          כדי למנוע כאלו ויכוחים מראש, הנה הפירוט המלא של חוקי המשחק שלנו. <strong className="text-blue-400">שימו לב: הכל מחושב באופן אוטומטי לחלוטין</strong> על ידי המנוע של המערכת.
        </p>
      </div>

      {/* באנר חובת מילוי - בולט במיוחד */}
      <div className="bg-gradient-to-r from-amber-900/40 to-amber-600/10 border-2 border-amber-500/50 p-6 md:p-8 rounded-3xl shadow-[0_0_25px_rgba(245,158,11,0.15)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-3 h-full bg-amber-500"></div>
        <h2 className="text-2xl font-black text-amber-400 mb-4 flex items-center gap-2">
          <span className="animate-pulse">🚨</span> מה חובה למלא עד שריקת הפתיחה?
        </h2>
        <p className="text-slate-200 mb-5 text-sm font-medium">
          עד תחילת המשחק הראשון של הטורניר, עליכם להשלים את ה"באנדל" הבא (לאחר מכן אזורים אלו יינעלו!):
        </p>
        <div className="flex flex-wrap gap-3">
          <span className="bg-amber-500/20 text-amber-300 px-4 py-2.5 rounded-xl font-bold border border-amber-500/30 shadow-sm">🎯 כל משחקי מחזור 1</span>
          <span className="bg-amber-500/20 text-amber-300 px-4 py-2.5 rounded-xl font-bold border border-amber-500/30 shadow-sm">🥇 עולות משלב הבתים</span>
          <span className="bg-amber-500/20 text-amber-300 px-4 py-2.5 rounded-xl font-bold border border-amber-500/30 shadow-sm">🥉 8 העולות מהמקום ה-3</span>
          <span className="bg-amber-500/20 text-amber-300 px-4 py-2.5 rounded-xl font-bold border border-amber-500/30 shadow-sm">🎁 כל שאלות הבונוס לטורניר ולבתים</span>
        </div>
        <p className="text-amber-200/60 text-xs mt-5 font-bold">
          * המלצה: מלאו מראש גם את מחזורים 2 ו-3. תוכלו תמיד לשנות אותם בהמשך עד לדד-ליין המדויק שיופיע בשעון המערכת למעלה.
        </p>
      </div>

      {/* גריד החוקים */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* קובייה 1: משחקים - תוצאות */}
        <div className="bg-slate-800 p-6 md:p-8 rounded-3xl border border-blue-500/20 shadow-lg hover:border-blue-500/40 transition-colors relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-2 h-full bg-blue-500 group-hover:w-3 transition-all"></div>
          <h2 className="text-2xl font-bold text-blue-400 mb-6 flex items-center gap-2">
            <span>⚽</span> ניחושי משחקים
          </h2>
          <p className="text-slate-300 mb-6 text-sm">
            תקף לכל המשחקים בטורניר (שלב הבתים ונוק-אאוט). הניקוד על כל משחק מורכב משני חלקים:
          </p>
          <div className="space-y-4">
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-white">פגיעה בכיוון</span>
                <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-lg text-sm font-black">+5 נק'</span>
              </div>
              <p className="text-sm text-slate-400">ניחשת נכון מי תנצח, או שניחשת תיקו והמשחק אכן הסתיים בתיקו, אבל לא פגעת בתוצאה המדויקת.</p>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-white">פגיעה בול! (בינגו)</span>
                <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg text-sm font-black border border-emerald-500/30">🎯 +15 נק'</span>
              </div>
              <p className="text-sm text-slate-400">ניחשת את התוצאה המדויקת של המשחק (כולל כיוון + פגיעה מושלמת בשערים).</p>
            </div>
          </div>
        </div>

        {/* קובייה 2: עולות משלב הבתים */}
        <div className="bg-slate-800 p-6 md:p-8 rounded-3xl border border-purple-500/20 shadow-lg hover:border-purple-500/40 transition-colors relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-2 h-full bg-purple-500 group-hover:w-3 transition-all"></div>
          <h2 className="text-2xl font-bold text-purple-400 mb-6 flex items-center gap-2">
            <span>🥇</span> עולות משלב הבתים
          </h2>
          <p className="text-slate-300 mb-6 text-sm">
            הניקוד יינתן בסיום שלב הבתים, כאשר תמונת העולות תהיה סופית.
          </p>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
              <span className="text-slate-300 font-medium">נבחרת שעלתה <strong className="text-white">במיקום המדויק</strong> שניחשת:</span>
              <span className="font-black text-purple-400">+15 נק'</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
              <span className="text-slate-300 font-medium">נבחרת שעלתה, אך <strong className="text-white">במיקום הפוך</strong> (שמתי ראשונה, סיימה 2):</span>
              <span className="font-black text-purple-400">+7 נק'</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
              <span className="text-slate-300 font-medium">עלייה של נבחרת מהרשימה של <strong className="text-white">8 המעפילות מ-3</strong>:</span>
              <span className="font-black text-purple-400">+10 נק'</span>
            </div>
          </div>
        </div>

        {/* קובייה 3: מעפילות בנוק-אאוט */}
        <div className="bg-slate-800 p-6 md:p-8 rounded-3xl border border-orange-500/20 shadow-lg hover:border-orange-500/40 transition-colors relative overflow-hidden group md:col-span-2">
          <div className="absolute top-0 left-0 w-2 h-full bg-orange-500 group-hover:w-3 transition-all"></div>
          <h2 className="text-2xl font-bold text-orange-400 mb-6 flex items-center gap-2">
            <span>🔥</span> זהות העולות בנוק-אאוט
          </h2>
          <p className="text-slate-300 mb-6 text-sm">
            בשלבי הנוק-אאוט, מעבר לניקוד על תוצאת המשחק עצמו <strong className="bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded border border-orange-500/30 underline decoration-orange-500 decoration-2">בסיום 120 דקות</strong>, אתם מקבלים ניקוד משמעותי על בחירה נכונה של הנבחרת שתעפיל לשלב הבא (גם אם זה בפנדלים). ככל שמתקדמים בשלבים - הניקוד עולה!
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center text-center">
              <span className="text-slate-400 text-xs font-bold mb-2">שלב ה-32</span>
              <span className="text-2xl font-black text-orange-400">+5</span>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center text-center">
              <span className="text-slate-400 text-xs font-bold mb-2">שמינית גמר</span>
              <span className="text-2xl font-black text-orange-400">+10</span>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center text-center">
              <span className="text-slate-400 text-xs font-bold mb-2">רבע גמר</span>
              <span className="text-2xl font-black text-orange-400">+15</span>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center text-center">
              <span className="text-slate-400 text-xs font-bold mb-2">חצי גמר</span>
              <span className="text-2xl font-black text-orange-400">+20</span>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-xl border border-amber-500/30 flex flex-col items-center justify-center text-center shadow-[0_0_15px_rgba(245,158,11,0.1)] col-span-2 md:col-span-1">
              <span className="text-amber-400 text-xs font-bold mb-2">אלופת העולם (גמר)</span>
              <span className="text-2xl font-black text-amber-500">+25</span>
            </div>
          </div>
        </div>

        {/* קובייה 4: בונוסים ונעילות */}
        <div className="bg-slate-800 p-6 md:p-8 rounded-3xl border border-slate-700 shadow-lg md:col-span-2 flex flex-col lg:flex-row gap-8">
          
          {/* --- עמודה ימנית: הבונוסים לסוגיהם --- */}
          <div className="flex-1 flex flex-col gap-6">
            
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-amber-400 mb-4 flex items-center gap-2"><span>⭐</span> שאלות בונוס רגילות</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                הניקוד המדויק (למשל: רגיל או דאבל) מופיע בצורה בולטת ממש ליד כל שאלה במסך הבונוסים. 
                <br/><br/>
                <strong className="text-white">כמה דברים שחשוב לדעת:</strong>
              </p>
              <ul className="text-slate-300 text-sm space-y-3 list-disc list-inside pr-2">
                <li>
                  <strong className="text-amber-200">כפל מנצחים:</strong> אם יש תיקו במציאות (לדוגמה: שני שחקנים מסיימים עם אותה כמות שערים) - כל מי שבחר באחד מהם יקבל את מלוא הנקודות! המערכת יודעת לקבל מספר תשובות נכונות לאותה שאלה.
                </li>
                <li>
                  <strong className="text-amber-200">סוגי בחירה:</strong> בחלק מהשאלות תתבקשו לבחור נבחרת מרשימה (ולפעמים יופיעו אפשרויות מכשילות כמו "אף נבחרת" או "כל הנבחרות").
                </li>
                <li>
                  <strong className="text-amber-200">שאלות פתוחות:</strong> בשאלות שבהן צריך להזין שם חופשי, תהיו חופשיים לגמרי להקליד בעצמכם כל שם שתרצו. אבל שימו לב שאנחנו ממליצים מאוד להיעזר בהשלמה האוטומטית, בכדי שהשחקן שניבאתם באמת ייקלט בצורה תקינה.
                </li>
                <li>
                  <strong className="text-amber-200">שאלות מספריות וניחוש דקה:</strong> שימו לב שיש שאלות מספריות שהן מספר מלא, ויש שאלות של ניחוש דקה שבהן אם אתם חושבים שזה יקרה בתוספת הזמן - תצטרכו לכתוב את הנוסחה, למשל: <span className="font-mono bg-slate-900 px-1 rounded text-white">45+3</span>.
                </li>
              </ul>
            </div>

            <div className="bg-slate-900/50 p-5 rounded-2xl border border-purple-500/30 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none group-hover:scale-150 transition-transform"></div>
              <h3 className="text-lg font-black text-purple-400 mb-3 flex items-center gap-2 relative z-10"><span>🎁</span> שאלות הפתעה ("Surprise Drop")</h3>
              <p className="text-slate-300 text-sm leading-relaxed relative z-10">
                במהלך הטורניר יצוצו פתאום "שאלות הפתעה". שאלות אלו נפתחות <b>לזמן מוגבל בלבד</b> (שעתיים, חצי יום, וכו'). 
                אם נכנסת לאפליקציה וראית סירנה אדומה למעלה, רוץ למלא אותן לפני שהזמן נגמר! מי שפספס - הפסיד את הנקודות.
              </p>
            </div>

            <div className="bg-slate-900/50 p-5 rounded-2xl border border-orange-500/30 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl pointer-events-none group-hover:scale-150 transition-transform"></div>
              <h3 className="text-lg font-black text-orange-400 mb-3 flex items-center gap-2 relative z-10"><span>🤪</span> "בעל הבית השתגע" (ניקוד לפי קרבה)</h3>
              <p className="text-slate-300 text-sm leading-relaxed relative z-10 mb-3">
                בניגוד לשאלות בונוס רגילות, בחלק מהשאלות המספריות המערכת תעניק ניקוד מדורג על פי הקרבה שלך למספר האמיתי.
              </p>
              <ul className="text-sm font-bold text-slate-400 space-y-2 relative z-10 bg-slate-950/50 p-4 rounded-xl border border-slate-700/50">
                <li className="flex justify-between items-center"><span className="text-emerald-400">🎯 פגיעה בול</span> <span className="bg-slate-800 px-2 py-1 rounded">50 נק'</span></li>
                <li className="flex justify-between items-center"><span className="text-blue-400">✔️ טעות של עד 5 (±)</span> <span className="bg-slate-800 px-2 py-1 rounded">40 נק'</span></li>
                <li className="flex justify-between items-center"><span className="text-amber-400">⚠️ טעות של עד 10 (±)</span> <span className="bg-slate-800 px-2 py-1 rounded">30 נק'</span></li>
                <li className="flex justify-between items-center"><span className="text-orange-400">📉 טעות של עד 15 (±)</span> <span className="bg-slate-800 px-2 py-1 rounded">20 נק'</span></li>
                <li className="flex justify-between items-center"><span className="text-rose-400">❌ טעות של עד 20 (±)</span> <span className="bg-slate-800 px-2 py-1 rounded">10 נק'</span></li>
              </ul>
            </div>
            
          </div>

          {/* --- קו מפריד --- */}
          <div className="w-px bg-slate-700 hidden lg:block shrink-0"></div>
          <div className="h-px bg-slate-700 lg:hidden w-full shrink-0"></div>

          {/* --- עמודה שמאלית: נעילות וריגול --- */}
          <div className="flex-1 space-y-4">
            <h3 className="text-xl font-bold text-rose-400 mb-4 flex items-center gap-2"><span>🔒</span> זמני נעילה וריגול</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              המשחקים ושאלות הבונוס ננעלים אוטומטית לפי שעון המערכת. חלק מהבונוסים יינעלו כבר במשחק הפתיחה, וחלק ייפתחו וינעלו רק בשלבי הנוק-אאוט - שווה לעקוב!
            </p>
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 mt-4">
              <h4 className="font-bold text-white mb-2 flex items-center gap-2"><span>👁️</span> פיצ'ר הריגול והשקיפות</h4>
              <p className="text-slate-400 text-sm">
                ברגע שמשחק, בחירת מעפילה או שאלת בונוס ננעלים לעריכה - הם הופכים להיות חשופים לכולם! תוכלו להיכנס לטבלת המובילים (או ללחוץ על כפתור הריגול) ולראות בדיוק מה הקולגות שלכם ניחשו במקביל. <strong className="text-white">כמו כן, ניתן לראות טבלה מסכמת של כולם בטבלת גילוי הנאות (שקיפות).</strong>
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}