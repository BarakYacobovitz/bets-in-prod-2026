import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

export async function POST(req: Request) {
  try {
    // 1. אתחול השרת 
    if (!admin.apps.length) {
      if (!process.env.FIREBASE_PRIVATE_KEY) {
        throw new Error("Missing FIREBASE_PRIVATE_KEY in .env.local file");
      }
      
      // מכונת הניקוי למפתח הפרטי: 
      // גם מורידה מרכאות עודפות אם הועתקו בטעות, וגם מסדרת את ירידות השורה
      let cleanPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
      if (cleanPrivateKey.startsWith('"') && cleanPrivateKey.endsWith('"')) {
        cleanPrivateKey = cleanPrivateKey.slice(1, -1);
      }
      cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: cleanPrivateKey,
        }),
      });
    }

    const body = await req.json();
    const { title, body: text } = body;

    // 2. שולפים את כל המשתמשים
    const db = admin.firestore();
    const usersSnap = await db.collection('users').get();

    // 3. אוספים טוקנים
    const tokens: string[] = [];
    usersSnap.forEach((doc) => {
      const data = doc.data();
      if (data.fcmToken) {
        tokens.push(data.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return NextResponse.json({ success: false, error: 'לא נמצאו מכשירים רשומים להתראות במסד הנתונים.' }, { status: 400 });
    }

    // 4. בונים את ההודעה לשידור המוני
    const message = {
      notification: {
        title: title,
        body: text,
      },
      tokens: tokens,
    };

    // 5. משגרים!
    const response = await admin.messaging().sendEachForMulticast(message);

    return NextResponse.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount
    });

  } catch (error: any) {
    console.error('API /notify Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}