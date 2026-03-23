import { NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase'; // ודא שהנתיב לקובץ פיירבייס שלך נכון

export async function GET(request: Request) {
  // הגנת אבטחה: בודק שרק Vercel (או אתה עם הסיסמה) יכול להפעיל את זה
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const usersSnap = await getDocs(collection(db, "users"));
    const usersArray = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // חישוב דירוג כללי
    const sortedGeneral = [...usersArray].sort((a: any, b: any) => (b.totalPoints || 0) - (a.totalPoints || 0));
    let currentRank = 1;
    const genRanks = sortedGeneral.map((u: any, i: number) => {
      if (i > 0 && (u.totalPoints || 0) < (sortedGeneral[i - 1].totalPoints || 0)) currentRank = i + 1;
      return { id: u.id, rank: currentRank };
    });

    // חישוב דירוג נוקאאוט
    const sortedKnockout = [...usersArray].sort((a: any, b: any) => (b.knockoutPoints || 0) - (a.knockoutPoints || 0));
    let currentKoRank = 1;
    const koRanks = sortedKnockout.map((u: any, i: number) => {
      if (i > 0 && (u.knockoutPoints || 0) < (sortedKnockout[i - 1].knockoutPoints || 0)) currentKoRank = i + 1;
      return { id: u.id, rank: currentKoRank };
    });

    // שמירה לכל משתמש
    for (const u of usersArray) {
      const genRank = genRanks.find((r: any) => r.id === u.id)?.rank || 1;
      const koRank = koRanks.find((r: any) => r.id === u.id)?.rank || 1;
      await updateDoc(doc(db, "users", u.id), {
        previousTotalPoints: u.totalPoints || 0,
        previousKnockoutPoints: u.knockoutPoints || 0,
        previousRankGeneral: genRank,
        previousRankKnockout: koRank
      });
    }

    return NextResponse.json({ success: true, message: "Snapshot taken successfully!" });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to take snapshot' }, { status: 500 });
  }
}