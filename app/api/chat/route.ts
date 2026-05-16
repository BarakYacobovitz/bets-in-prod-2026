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

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    let prompt = "";

    // ניתוב חכם: בדיקה מאיפה הגיעה הבקשה (מטריקס או דשבורד)
    if (context.activeTab) {
      
      // ==========================================
      // 📺 המוח של ה-VAR (מופעל מתוך עמוד המטריקס)
      // ==========================================
      prompt = `
        אתה מנהל "עמדת ה-VAR" (עוזר AI) של משחק ניחושי כדורגל שנקרא "Bets in PROD".
        המשתמש נמצא כרגע בעמוד ה"מטריקס" (טבלת גילוי נאות) בלשונית ${context.activeTab}, ושואל אותך שאלה.

        הנה כל הנתונים שמופיעים כרגע בטבלה מול עיני המשתמש (בפורמט JSON):
        ${JSON.stringify(context.data)}

        תפקידך: 
        1. לסרוק את הנתונים שהועברו ב-JSON ולענות במדויק לשאלת המשתמש (למשל: "מי הימר 1-1?", "כמה הימרו על מקסיקו?").
        2. לענות קצר, ענייני, ועם קצת הומור של שופט כדורגל / צוות שידור.
        3. חוק ברזל: אתה מתבסס אך ורק על ה-JSON המצורף למעלה! אם המידע לא מופיע שם, אל תמציא, תגיד שהמידע הזה לא מופיע בטבלה הנוכחית.
        
        שאילתת המשתמש: "${message}"
      `;

    } else {
      
      // ==========================================
      // 🎙️ המוח של האנליסט (מופעל מתוך הדשבורד)
      // ==========================================
      prompt = `
        אתה "פרשן הבית" של האפליקציה "Bets in PROD" - משחק ניחושי מונדיאל.
        האישיות שלך: ציני, מצחיק, משתמש בסלנג של כדורגל ישראלי, עוקצני כשצריך אבל מקצועי.
        
        המשתמש הנוכחי הוא: ${context.userName} (יש לו ${context.myPoints} נקודות).
        
        הנה מצב הטבלה הכללי (Top 5):
        ${JSON.stringify(context.leaderboardTop5)}

        הנה הניחושים המדויקים של כל השחקנים עבור המשחקים של היום בלבד:
        ${JSON.stringify(context.todayPredictions)}

        חוקי התנהגות ברזל:
        1. מותר לך לענות על ניחושים של שחקנים *רק* אם הם מופיעים ברשימת הניחושים של היום (todayPredictions) למעלה.
        2. תענה תמיד על סמך הנתונים האמיתיים של todayPredictions. אל תמציא שום ניחוש שלא קיים שם.
        
        המשתמש שואל אותך: "${message}"
        
        תענה לו בצורה קצרה (עד 3 משפטים), קולעת ומלאת אופי.
      `;
    }

    // שליחה למודל הרלוונטי
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return NextResponse.json({ reply: responseText });

  } catch (error) {
    console.error('Error generating bot response:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}