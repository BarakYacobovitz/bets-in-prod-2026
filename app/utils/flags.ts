// utils/flags.ts

const flagMap: Record<string, string> = {
  // --- נבחרות מוכרות ---
  "ארגנטינה": "https://flagcdn.com/w40/ar.png",
  "ברזיל": "https://flagcdn.com/w40/br.png",
  "צרפת": "https://flagcdn.com/w40/fr.png",
  "אנגליה": "https://flagcdn.com/w40/gb-eng.png", // אנגליה זה חריג
  "ספרד": "https://flagcdn.com/w40/es.png",
  "הולנד": "https://flagcdn.com/w40/nl.png",
  "גרמניה": "https://flagcdn.com/w40/de.png",
  "פורטוגל": "https://flagcdn.com/w40/pt.png",
  "איטליה": "https://flagcdn.com/w40/it.png",
  "ארה\"ב": "https://flagcdn.com/w40/us.png",
  "מקסיקו": "https://flagcdn.com/w40/mx.png",
  "קנדה": "https://flagcdn.com/w40/ca.png",

  // --- נבחרות מהקובץ החדש שאולי חסרות לך ---
  "קוראסאו": "https://flagcdn.com/w40/cw.png",
  "כף ורדה": "https://flagcdn.com/w40/cv.png",
  "האיטי": "https://flagcdn.com/w40/ht.png",
  "בוסניה": "https://flagcdn.com/w40/ba.png",
  "עיראק": "https://flagcdn.com/w40/iq.png",
  "דרום אפריקה": "https://flagcdn.com/w40/za.png",
  "קוריאה הדרומית": "https://flagcdn.com/w40/kr.png",
  "צ'כיה": "https://flagcdn.com/w40/cz.png",
  "קטר": "https://flagcdn.com/w40/qa.png",
  "שווייץ": "https://flagcdn.com/w40/ch.png",
  "מרוקו": "https://flagcdn.com/w40/ma.png",
  "סקוטלנד": "https://flagcdn.com/w40/gb-sct.png", // סקוטלנד זה גם חריג
  "פרגוואי": "https://flagcdn.com/w40/py.png",
  "אוסטרליה": "https://flagcdn.com/w40/au.png",
  "טורקיה": "https://flagcdn.com/w40/tr.png",
  "חוף השנהב": "https://flagcdn.com/w40/ci.png",
  "אקוודור": "https://flagcdn.com/w40/ec.png",
  "יפן": "https://flagcdn.com/w40/jp.png",
  "שוודיה": "https://flagcdn.com/w40/se.png",
  "תוניסיה": "https://flagcdn.com/w40/tn.png",
  "בלגיה": "https://flagcdn.com/w40/be.png",
  "מצרים": "https://flagcdn.com/w40/eg.png",
  "איראן": "https://flagcdn.com/w40/ir.png",
  "ניו זילנד": "https://flagcdn.com/w40/nz.png",
  "סעודיה": "https://flagcdn.com/w40/sa.png",
  "אורוגוואי": "https://flagcdn.com/w40/uy.png",
  "סנגל": "https://flagcdn.com/w40/sn.png",
  "נורווגיה": "https://flagcdn.com/w40/no.png",
  "אלג'יריה": "https://flagcdn.com/w40/dz.png",
  "אוסטריה": "https://flagcdn.com/w40/at.png",
  "ירדן": "https://flagcdn.com/w40/jo.png",
  "קונגו": "https://flagcdn.com/w40/cg.png",
  "אוזבקיסטן": "https://flagcdn.com/w40/uz.png",
  "קולומביה": "https://flagcdn.com/w40/co.png",
  "גאנה": "https://flagcdn.com/w40/gh.png",
  "קרואטיה": "https://flagcdn.com/w40/hr.png",
  "פנמה": "https://flagcdn.com/w40/pa.png"
};

export const getFlagUrl = (teamName: string): string | null => {
  if (!teamName) return null;
  return flagMap[teamName.trim()] || null;
};