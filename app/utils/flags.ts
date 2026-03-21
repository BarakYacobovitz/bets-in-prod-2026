// utils/flags.ts

// מילון שממפה שם נבחרת בעברית לקוד מדינה בינלאומי בן 2 אותיות
export const teamToCountryCode: Record<string, string> = {
  "ארגנטינה": "ar",
  "ספרד": "es",
  "מקסיקו": "mx",
  "אנגליה": "gb-eng",
  "ברזיל": "br",
  "צרפת": "fr",
  "גרמניה": "de",
  "יפן": "jp",
  "פורטוגל": "pt",
  "קוריאה הדרומית": "kr",
  "ארה״ב": "us",
  "ארה\"ב": "us",
  "הולנד": "nl",
  "איטליה": "it",
  "בלגיה": "be",
  "קרואטיה": "hr",
  "אורוגוואי": "uy",
  "שווייץ": "ch",
  "דנמרק": "dk",
  "קולומביה": "co",
  "צ'ילה": "cl",
  "סנגל": "sn",
  "מרוקו": "ma",
  "קנדה": "ca",
  "אקוודור": "ec",
  "ערב הסעודית": "sa",
  "אוסטרליה": "au",
  "פולין": "pl",
  "שוודיה": "se",
  "ויילס": "gb-wls",
  "קוסטה ריקה": "cr",   // הוספנו!
  "אלג'יריה": "dz"      // הוספנו!
};

// פונקציה שמחזירה לינק ישיר לתמונת הדגל!
export const getFlagUrl = (teamName: string): string | null => {
  if (!teamName) return null;
  const code = teamToCountryCode[teamName.trim()];
  if (!code) return null; 
  return `https://flagcdn.com/w40/${code}.png`; // שואב תמונה ברוחב 40 פיקסלים (סופר מהיר)
};