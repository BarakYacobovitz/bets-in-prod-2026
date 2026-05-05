import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// אתחול Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, body: text } = body;

    // 1. מתחברים למסד הנתונים ושולפים את כל המשתמשים
    const db = admin.firestore();
    const usersSnap = await db.collection('users').get();

    // 2. אוספים את כל הטוקנים (רק ממי שאישר התראות ויש לו טוקן)
    const tokens: string[] = [];
    usersSnap.forEach((doc) => {
      const data = doc.data();
      if (data.fcmToken) {
        tokens.push(data.fcmToken);
      }
    });

    // אם אף אחד לא נרשם, אין למי לשלוח
    if (tokens.length === 0) {
      return NextResponse.json({ success: false, error: 'לא נמצאו מכשירים רשומים להתראות.' }, { status: 400 });
    }

    // 3. בונים את ההודעה לריבוי נמענים (Multicast)
    const message = {
      notification: {
        title: title,
        body: text,
      },
      tokens: tokens, // שולחים למערך הטוקנים שאספנו
    };

    // 4. משגרים את ההתראה!
    const response = await admin.messaging().sendEachForMulticast(message);

    return NextResponse.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount
    });

  } catch (error: any) {
    console.error('Error sending notification:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}