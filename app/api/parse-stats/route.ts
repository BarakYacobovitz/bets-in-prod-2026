import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { rawText } = await request.json();

    if (!rawText) {
      return NextResponse.json({ success: false, error: "לא נשלח טקסט" }, { status: 400 });
    }

    const systemPrompt = `
      You are an elite football data parser. 
      Extract goal scorers and yellow cards from the following raw text copied from a sports website.
      Return ONLY a raw, valid JSON object with the exact following structure, without any markdown formatting, backticks, or extra text:
      {
        "matchName": "Team A vs Team B",
        "scorers": [
          { "playerName": "Messi", "team": "Argentina", "minute": "23" }
        ],
        "yellowCards": [
          { "playerName": "De Paul", "team": "Argentina", "minute": "45" }
        ]
      }
      If a piece of information (like team name) is missing, infer it from the text or leave it as "Unknown".
    `;

    // כאן תכניס את הקריאה למודל ה-AI שלך (כמו שעשית ב-VAR).
    // לדוגמה, אם יש לך מפתח של OpenAI:
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` // ודא שיש לך מפתח ב-.env
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // או gpt-3.5-turbo שזול ומהיר
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: rawText }
        ],
        temperature: 0.1 // טמפרטורה נמוכה לדיוק מקסימלי
      })
    });

    const data = await response.json();
    let jsonString = data.choices[0].message.content.trim();
    
    // ניקוי עטיפות Markdown אם ה-AI התעקש להוסיף אותן
    if (jsonString.startsWith('```json')) {
       jsonString = jsonString.replace(/^```json/, '').replace(/```$/, '').trim();
    }

    const parsedData = JSON.parse(jsonString);

    return NextResponse.json({ success: true, data: parsedData });

  } catch (error: any) {
    console.error("AI Parsing Error:", error);
    return NextResponse.json({ success: false, error: "שגיאה בפענוח הטקסט" }, { status: 500 });
  }
}