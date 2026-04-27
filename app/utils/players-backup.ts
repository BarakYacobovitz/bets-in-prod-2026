// app/utils/players.ts

export interface Player {
  name: string;
  country: string;
  club: string;
  league: string;
}

export const PLAYERS_DATA: Player[] = [
  { name: "קיליאן אמבפה", country: "צרפת", club: "ריאל מדריד", league: "La Liga" },
  { name: "ארלינג האלאנד", country: "נורווגיה", club: "מנצ'סטר סיטי", league: "Premier League" },
  { name: "ג'וד בלינגהאם", country: "אנגליה", club: "ריאל מדריד", league: "La Liga" },
  { name: "הארי קיין", country: "אנגליה", club: "באיירן מינכן", league: "Bundesliga" },
  { name: "לאמין ימאל", country: "ספרד", club: "ברצלונה", league: "La Liga" },
  { name: "מוחמד סלאח", country: "מצרים", club: "ליברפול", league: "Premier League" },
  { name: "ליונל מסי", country: "ארגנטינה", club: "אינטר מיאמי", league: "MLS" },
  // ... המשך להוסיף כאן את שאר השחקנים
];

// רשימת שמות עבור ה-Autocomplete
export const TOP_PLAYERS_NAMES = PLAYERS_DATA.map(p => p.name);

// פונקציית עזר לשליפת מידע מלא על שחקן לפי שמו
export const getPlayerInfo = (name: string) => PLAYERS_DATA.find(p => p.name === name);
// --- להוסיף בסוף הקובץ app/utils/players.ts ---

// מחלץ רשימה ייחודית וממוינת של כל המועדונים
export const TOP_CLUBS_NAMES = Array.from(
  new Set(PLAYERS_DATA.map(p => p.club))
).filter(Boolean).sort();

// מחלץ רשימה ייחודית וממוינת של כל הליגות
export const TOP_LEAGUES_NAMES = Array.from(
  new Set(PLAYERS_DATA.map(p => p.league))
).filter(Boolean).sort();

// פונקציית עזר למציאת שחקנים לפי מועדון או ליגה (ישמש אותנו לדשבורד בהמשך)
export const getPlayersByClub = (club: string) => PLAYERS_DATA.filter(p => p.club === club);
export const getPlayersByLeague = (league: string) => PLAYERS_DATA.filter(p => p.league === league);