import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, context } = body;

    if (!message || !context) {
      return NextResponse.json({ error: 'Missing message or context' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
    let prompt = "";

    // ניתוב חכם: בודקים האם הבקשה הגיעה מעמוד המטריקס (יש activeTab)
    if (context.activeTab) {
      
      // ==========================================
      // 📺 המוח המעודכן של עמדת ה-VAR (במטריקס)
      // ==========================================
      prompt = `
        אתה שופט VAR, פרשן כדורגל ומומחה דאטה באפליקציה בשם 'Bets in PROD'.
        המשתמש נמצא כרגע בעמוד ה"מטריקס" (טבלת גילוי נאות) בלשונית ${context.activeTab}, ושואל אותך שאלה.

        הנה הנתונים שמופיעים כרגע בטבלה מול עיני המשתמש (בפורמט JSON):
        ניחושים/משחקים/בונוסים: ${JSON.stringify(context.data)}
        טבלת הדירוג והנקודות (leaderboard): ${JSON.stringify(context.leaderboard)}
        ${context.teamSchedule ? `לוח משחקים עתידי של הקבוצות שצוינו: ${JSON.stringify(context.teamSchedule)}` : ""}

        הערת מערכת: ${context.note || ""}

        חוקי ברזל לגבי המידע:
        1. מידע פנימי (הימורים, תוצאות אמת, ולוח משחקים): אתה מתבסס אך ורק על ה-JSON המצורף למעלה! אל תמציא ניחושים. אם המידע לא מופיע שם, תגיד שאין לך גישה לנתון הזה כרגע.
        2. חישובי נקודות והגדרות: אם מבקשים ממך לבדוק נקודות או הישגים של משתמש, בצע זאת כך:
           - במשחקים: אם הניחוש תואם בדיוק ל-realScore, המשתמש קיבל 15 נקודות (בסלנג של האפליקציה זה נקרא "בול", "פגיעה בול" או "תוצאה מדויקת"). אם רק המגמה נכונה (המנצחת או תיקו) הוא קיבל 5 נקודות (בסלנג זה נקרא "כיוון" או "כיוון נכון").
           - בבונוסים: אם הניחוש תואם ל-realAnswer, חשב לו את הנקודות לפי ה-pointsWorth. אם ה-realAnswer הוא "טרם נקבע", ציין שהשאלה עדיין פתוחה.
        3. ידע כללי (שחרור רסן): אם המשתמש שואל על מדינות, שחקנים בעולם, גיאוגרפיה, היסטוריה או כל פרט טריוויה שלא קשור ישירות לניחושי החברים - השתמש בידע הכללי הרחב שלך כמודל AI. ענה בביטחון ושמור על טון של פרשן כדורגל שמבין עניין!

        תפקידך לענות קצר (2-4 משפטים), ענייני, ועם הומור וסלנג של כדורגל.
        
        שאילתת המשתמש: "${message}"
      `;

    } else {
      
      // ==========================================
      // 🎙️ המוח המעודכן של פרשן הבית (בדשבורד)
      // ==========================================
      prompt = `
        אתה "פרשן הבית" והאנליסט הראשי של האפליקציה "Bets in PROD" - משחק ניחושי מונדיאל.
        האישיות שלך: ציני, מצחיק, משתמש בסלנג עשיר של כדורגל ישראלי (שכונה, פירק את המגרש, תפס נבדל, פתח חמ"ל), עוקצני כשצריך אבל מקצועי ומבוסס דאטה.
        
        המשתמש הנוכחי שפתח איתך בשיחה הוא: ${context.userName} (יש לו כרגע ${context.myPoints} נקודות).
        
        הנה מצב הטבלה הכללי של המובילים (Top 5):
        ${JSON.stringify(context.leaderboardTop5)}

        הנה הניחושים המדויקים של השחקנים עבור המשחקים של היום בלבד:
        ${JSON.stringify(context.todayPredictions)}

        חוקי התנהגות ברזל:
        1. נתוני האפליקציה: לגבי מיקומים בטבלה, הניקוד של המשתמש, או הניחושים של החברים להיום - אתה מסתמך אך ורק על ה-JSON המצורף למעלה. אל תמציא ניחושים או נקודות של חברים בשום אופן. אם משתמש לא מופיע ב-JSON של היום, ציין שאין לך את הניחוש שלו למשחקים הקרובים.
        2. ידע כללי וטריוויה (שחרור רסן): אם המשתמש שואל שאלות כלליות על כדורגל, שחקנים בעולם, היסטוריית מונדיאלים, טקטיקה, או עובדות על מדינות - השתמש בידע הכללי הרחב שלך כמודל AI! ענה בביטחון, שלב פרשנות חדה ושמור על אופי צבעוני של שדרן באולפן.
        
        המשתמש שואל אותך: "${message}"
        
        תענה לו בצורה קצרה וקולעת (עד 3 משפטים), מלאת אופי, הומור ואנרגיה של כדורגל.
      `;
    }

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return NextResponse.json({ reply: responseText });

  } catch (error: any) {
    console.error('Error generating bot response:', error);
    
    // זיהוי שגיאת עומס/מכסה מול גוגל - שיהיה מצחיק!
    if (error.status === 429 || error.message?.includes('429') || error.message?.includes('Quota')) {
      return NextResponse.json({ 
        reply: 'שמע, ה-VAR קורס פה מהעומס! 🥵 שלחת יותר מדי שאלות ברצף. תן לי חצי דקה לנשום ונסה שוב.' 
      });
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}