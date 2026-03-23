import { NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase'; // ודא שהנתיב תקין

export async function GET(request: Request) {
  // הגנת אבטחה
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("❌ [CRON] Unauthorized access attempt.");
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log("🚀 [CRON] Starting Daily Snapshot Job...");

  try {
    const usersSnap = await getDocs(collection(db, "users"));
    const usersArray = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`📊 [CRON] Found ${usersArray.length} users to process.`);

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

    // שמירה לכל משתמש והדפסה ללוג
    for (const u of usersArray) {
      const genRank = genRanks.find((r: any) => r.id === u.id)?.rank || 1;
      const koRank = koRanks.find((r: any) => r.id === u.id)?.rank || 1;
      
      const uData = u as any;
      
      await updateDoc(doc(db, "users", u.id), {
        previousTotalPoints: uData.totalPoints || 0,
        previousKnockoutPoints: uData.knockoutPoints || 0,
        previousRankGeneral: genRank,
        previousRankKnockout: koRank
      });

      // הלוג המפורט שיופיע ב-Vercel
      console.log(`✅ [CRON] Snapshot saved for User: ${uData.name || 'Unknown'} | Points: ${uData.totalPoints || 0} | New Rank: ${genRank}`);
    }

    console.log("🏁 [CRON] Snapshot completed successfully!");
    return NextResponse.json({ success: true, message: "Snapshot taken successfully!" });
    
  } catch (error) {
    console.error("❌ [CRON] Critical Error taking snapshot:", error);
    return NextResponse.json({ error: 'Failed to take snapshot' }, { status: 500 });
  }
}