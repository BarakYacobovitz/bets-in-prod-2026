import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { doc, getDoc, collection, getDocs, updateDoc, increment } from 'firebase/firestore';
import { db } from '../../firebase'; // ודא שהנתיב תואם לקובץ שלך

// הגדרת ה-API Key (חובה להוסיף ב- .env.local את המשתנה GEMINI_API_KEY)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, message } = body;

    if (!userId || !message) {
      return NextResponse.json({ error: 'Missing userId or message' }, { status: 400 });
    }

    // --- 1. בדיקת מכסת שאלות יומית (Rate Limiting) ---
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userSnap.data();
    const dailyQueries = userData.dailyBotQueries || 0;
    const lastQueryDate = userData.lastBotQueryDate || '';
    const todayStr = new Date().toISOString().split('T')[0];

    // איפוס ספירה אם עבר יום, אחרת בדיקה אם חרג מהמכסה (למשל: 5 שאלות ביום)
    if (lastQueryDate === todayStr && dailyQueries >= 5) {
      return NextResponse.json({ 
        reply: 'חפרת לי היום! ⚽ תן לראות את המשחק בשקט, נדבר מחר כשיתאפסו לך השאלות.' 
      });
    }

    // עדכון מונה שאלות ב-Firestore
    await updateDoc(userRef, {
      dailyBotQueries: lastQueryDate === todayStr ? increment(1) : 1,
      lastBotQueryDate: todayStr
    });

    // --- 2. שליפת הנתונים הרלוונטיים ויצירת JSON רזה (Minified Context) ---
    // כאן אנחנו שולפים רק טבלאות ומשחקים נעולים כדי לחסוך טוקנים ולמנוע הדלפות
    const usersSnap = await getDocs(collection(db, 'users'));
    const leaderboard: any[] = [];
    usersSnap.forEach(doc => {
      const d = doc.data();
      leaderboard.push({ name: d.name, pts: d.totalPoints || 0 });
    });
    // מיון המשתמשים כדי שלבוט יהיה קל להבין מי מוביל
    leaderboard.sort((a, b) => b.pts - a.pts);

    // TODO במערכת אמיתית: לשלוף מכאן את המשחקים שהסטטוס שלהם "נעול" בלבד
    // const lockedMatches = ... 

    const gameContext = {
      currentUser: userData.name,
      myPoints: userData.totalPoints || 0,
      leaderboardTop5: leaderboard.slice(0, 5), // נשלח רק את הטופ 5 כדי לחסוך טוקנים
      // lockedMatches: lockedMatches
    };

    // --- 3. פנייה ל-Gemini עם ה-System Prompt ---
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // המודל המהיר והזול

    const prompt = `
      אתה "פרשן הבית" של האפליקציה "Bets in PROD" - משחק ניחושי מונדיאל.
      האישיות שלך: ציני, מצחיק, מדבר בסלנג של כדורגל ישראלי, לפעמים קצת עוקצני אבל תמיד עוזר. 
      המשתמש שמדבר איתך עכשיו הוא: ${gameContext.currentUser} (יש לו ${gameContext.myPoints} נקודות).
      
      הנה מצב הטבלה המעודכן כרגע (בפורמט JSON):
      ${JSON.stringify(gameContext.leaderboardTop5)}

      המשתמש שואל אותך: "${message}"
      
      תענה לו בצורה קצרה (עד 3-4 משפטים), מצחיקה, ותתייחס לנתונים האמיתיים מהטבלה אם זה רלוונטי לשאלה שלו.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // --- 4. החזרת התשובה לקליינט ---
    return NextResponse.json({ reply: responseText });

  } catch (error) {
    console.error('Error generating bot response:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}