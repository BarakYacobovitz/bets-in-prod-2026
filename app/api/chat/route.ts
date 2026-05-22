import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, context } = body;

    console.log("DEBUG - Received context keys:", Object.keys(context || {}));
    console.log("DEBUG - Received message:", message);
    // בדיקת הגנה: בוא נראה אם המפתח קיים בכלל בשרת
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
       return NextResponse.json({ reply: "שגיאת שרת: המפתח (API KEY) לא מוגדר בשרת!" }, { status: 500 });
    }
    // בדיקה נוספת: אולי הוא ריק?
    if (apiKey.length < 10) {
       return NextResponse.json({ reply: `המפתח שהוגדר קצר מדי: ${apiKey}` }, { status: 500 });
    }

    if (!message || !context) {
      return NextResponse.json({ error: 'Missing message or context' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
    let prompt = "";

    // ==========================================
    // הניתוב החכם החדש: האם קיבלנו הנחיות קשיחות מהמטריקס החדש?
    // ==========================================
    if (context.systemInstructions) {
      prompt = `${context.systemInstructions}\n\nהמשתמש שואל אותך: "${message}"`;
    }
    // ==========================================
    // גיבוי לגרסאות ישנות או כפתורי VAR שלא עודכנו
    // ==========================================
    else if (context.activeTab) {
      prompt = `
        אתה שופט VAR, פרשן כדורגל ומומחה דאטה באפליקציה בשם 'Bets in PROD'.
        המשתמש נמצא כרגע בעמוד ה"מטריקס" בלשונית ${context.activeTab}.

        ניחושים/משחקים/בונוסים: ${JSON.stringify(context.data)}
        טבלת הדירוג והנקודות: ${JSON.stringify(context.leaderboard)}
        
        תענה קצר (2-4 משפטים), ענייני, ועם הומור וסלנג של כדורגל.
        שאילתת המשתמש: "${message}"
      `;
    } else {
      // הלוגיקה של פרשן הבית (בדשבורד הראשי)
      prompt = `
        אתה "פרשן הבית" והאנליסט הראשי של האפליקציה "Bets in PROD".
        המשתמש הנוכחי שפתח איתך בשיחה הוא: ${context.userName} (יש לו כרגע ${context.myPoints} נקודות).
        
        הנה מצב הטבלה הכללי של המובילים (Top 5):
        ${JSON.stringify(context.leaderboardTop5)}

        הנה הניחושים המדויקים של השחקנים עבור המשחקים של היום בלבד:
        ${JSON.stringify(context.todayPredictions)}
        
        המשתמש שואל אותך: "${message}"
        
        תענה לו בצורה קצרה וקולעת, מלאת אופי, הומור ואנרגיה של כדורגל.
      `;
    }

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return NextResponse.json({ reply: responseText });

  } catch (error: any) {
    // 1. מדפיסים את השגיאה האמיתית והמלאה ללוגים של השרת (Vercel/Console)
    // כך רק אתה רואה את המידע הטכני:
    console.error('🔥 VAR API Critical Error:', error.message || error);
    
    // 2. זיהוי שגיאת עומס/מכסה מול גוגל - עדיין שומרים על ההודעה המצחיקה
    if (error.status === 429 || error.message?.includes('429') || error.message?.includes('Quota')) {
      return NextResponse.json({ 
        reply: 'שמע, ה-VAR קורס פה מהעומס! 🥵 שלחת יותר מדי שאלות ברצף. תן לי חצי דקה לנשום ונסה שוב.' 
      });
    }

    // 3. התיקון: מחזירים הודעה ידידותית למשתמש הקצה, בלי להלחיץ
    return NextResponse.json({ 
      reply: 'צוות ה-VAR חווה כרגע ניתוק בקשר מול האצטדיון 📺🔌. נסה לשלוח את הבדיקה שוב בעוד מספר רגעים!' 
    });
  }
}