import { NextResponse } from 'next/server';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase'; // ודא שהנתיב ל-Firebase שלך מדויק

export async function GET() {
  try {
    // 1. פנייה לשירות הכדורגל החיצוני (לדוגמה API-Football)
    // שים לב: תצטרך להכניס את מזהה הליגה של מונדיאל 2026 ואת ה-API KEY שלך
    const response = await fetch("https://v3.football.api-sports.io/fixtures/events?league=1&season=2026", {
      method: "GET",
      headers: {
        "x-rapidapi-host": "v3.football.api-sports.io",
        "x-rapidapi-key": "5975ac929099f925907f44672c3116c2" // את זה תקבל כשתירשם לאתר שלהם
      }
    });

    const data = await response.json();

    // 2. עיבוד הנתונים: חילוץ הכובשים והמשחקים בלבד
    // זה רק מבנה רעיוני - תלוי בדיוק איך ה-API יחזיר את הנתונים
    const scorersData = data.response.map((match: any) => {
      // נסנן רק אירועים מסוג "Goal"
      const goals = match.events.filter((event: any) => event.type === "Goal");
      
      return {
        matchId: match.fixture.id,
        matchName: `${match.teams.home.name} vs ${match.teams.away.name}`,
        scorers: goals.map((g: any) => ({
          playerName: g.player.name,
          team: g.team.name,
          minute: g.time.elapsed
        }))
      };
    });

    // 3. שמירת הנתונים לתוך ה-Firebase שלך תחת קולקשן חדש
    await setDoc(doc(db, "system_data", "live_scorers"), {
      lastUpdated: new Date().toISOString(),
      matches: scorersData
    });

    return NextResponse.json({ success: true, message: "Scorers updated in Firebase!", data: scorersData });

  } catch (error) {
    console.error("Error fetching live scorers:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch scorers" }, { status: 500 });
  }
}