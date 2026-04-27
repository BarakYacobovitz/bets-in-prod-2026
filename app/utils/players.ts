// app/utils/players.ts

export interface Player {
  name: string;
  country: string;
  club: string;
  league: string;
}

const GROUP_A: Player[] = [
  { name: "סנטיאגו חימנס", country: "מקסיקו", club: "פיינורד", league: "Eredivisie" },
  { name: "הירבינג לוסאנו", country: "מקסיקו", club: "פ.ס.וו איינדהובן", league: "Eredivisie" },
  { name: "אדסון אלבארס", country: "מקסיקו", club: "ווסטהאם", league: "Premier League" },
  { name: "גיירמו אוצ'ואה", country: "מקסיקו", club: "סלרניטנה", league: "Serie A" },
  { name: "לואיס צ'אווס", country: "מקסיקו", club: "דינמו מוסקבה", league: "Russian Premier League" },
  { name: "פרסי טאו", country: "דרום אפריקה", club: "אל אהלי", league: "Egyptian League" },
  { name: "רונוון ויליאמס", country: "דרום אפריקה", club: "ממלודי סאנדאונס", league: "PSL" },
  { name: "ת'מבה זוואנה", country: "דרום אפריקה", club: "ממלודי סאנדאונס", league: "PSL" },
  { name: "סון הונג-מין", country: "קוריאה הדרומית", club: "טוטנהאם", league: "Premier League" },
  { name: "לי קאנג-אין", country: "קוריאה הדרומית", club: "פ.ס.ז'", league: "Ligue 1" },
  { name: "קים מין-ג'ה", country: "קוריאה הדרומית", club: "באיירן מינכן", league: "Bundesliga" },
  { name: "הוואנג הי-צ'אן", country: "קוריאה הדרומית", club: "וולבס", league: "Premier League" },
  { name: "פאטריק שיק", country: "צ'כיה", club: "באייר לברקוזן", league: "Bundesliga" },
  { name: "תומאש סוצ'ק", country: "צ'כיה", club: "ווסטהאם", league: "Premier League" },
  { name: "אדם הלוז'ק", country: "צ'כיה", club: "באייר לברקוזן", league: "Bundesliga" },
];

const GROUP_B: Player[] = [
  { name: "אלפונסו דייוויס", country: "קנדה", club: "באיירן מינכן", league: "Bundesliga" },
  { name: "ג'ונתן דייוויד", country: "קנדה", club: "ליל", league: "Ligue 1" },
  { name: "קייל לארין", country: "קנדה", club: "מיורקה", league: "La Liga" },
  { name: "אדין דז'קו", country: "בוסניה", club: "פנרבחצ'ה", league: "Super Lig" },
  { name: "מיראלם פיאניץ'", country: "בוסניה", club: "שארג'ה", league: "UAE Pro League" },
  { name: "אקראם עפיף", country: "קטר", club: "אל סד", league: "QSL" },
  { name: "אלמועז עלי", country: "קטר", club: "אל דוהייל", league: "QSL" },
  { name: "גרניט ג'אקה", country: "שווייץ", club: "באייר לברקוזן", league: "Bundesliga" },
  { name: "מנואל אקאנג'י", country: "שווייץ", club: "מנצ'סטר סיטי", league: "Premier League" },
  { name: "יאן זומר", country: "שווייץ", club: "אינטר", league: "Serie A" },
];

const GROUP_C: Player[] = [
  { name: "ויניסיוס ג'וניור", country: "ברזיל", club: "ריאל מדריד", league: "La Liga" },
  { name: "רודריגו", country: "ברזיל", club: "ריאל מדריד", league: "La Liga" },
  { name: "אנדריק", country: "ברזיל", club: "ריאל מדריד", league: "La Liga" },
  { name: "ניימאר", country: "ברזיל", club: "אל הילאל", league: "Saudi Pro League" },
  { name: "ברונו גימראייש", country: "ברזיל", club: "ניוקאסל", league: "Premier League" },
  { name: "אליסון בקר", country: "ברזיל", club: "ליברפול", league: "Premier League" },
  { name: "אשרף חכימי", country: "מרוקו", club: "פ.ס.ז'", league: "Ligue 1" },
  { name: "חכים זייש", country: "מרוקו", club: "גלאטסראיי", league: "Super Lig" },
  { name: "ברהים דיאס", country: "מרוקו", club: "ריאל מדריד", league: "La Liga" },
  { name: "יאסין בונו", country: "מרוקו", club: "אל הילאל", league: "Saudi Pro League" },
  { name: "סקוט מקטומיניי", country: "סקוטלנד", club: "מנצ'סטר יונייטד", league: "Premier League" },
  { name: "אנדרו רוברטסון", country: "סקוטלנד", club: "ליברפול", league: "Premier League" },
];

const GROUP_D: Player[] = [
  { name: "כריסטיאן פוליסיק", country: "ארה"ב", club: "מילאן", league: "Serie A" },
  { name: "וסטון מקני", country: "ארה"ב", club: "יובנטוס", league: "Serie A" },
  { name: "ג'ובאני ריינה", country: "ארה"ב", club: "נוטינגהאם פורסט", league: "Premier League" },
  { name: "מתיו ראיין", country: "אוסטרליה", club: "אלקמאר", league: "Eredivisie" },
  { name: "הארי סוטאר", country: "אוסטרליה", club: "לסטר", league: "Championship" },
  { name: "הקאן צ'להאנולו", country: "טורקיה", club: "אינטר", league: "Serie A" },
  { name: "ארדה גולר", country: "טורקיה", club: "ריאל מדריד", league: "La Liga" },
  { name: "קנאן יילדיז", country: "טורקיה", club: "יובנטוס", league: "Serie A" },
];

const GROUP_E: Player[] = [
  { name: "פלוריאן וירץ", country: "גרמניה", club: "באייר לברקוזן", league: "Bundesliga" },
  { name: "ג'מאל מוסיאלה", country: "גרמניה", club: "באיירן מינכן", league: "Bundesliga" },
  { name: "קאי האברץ", country: "גרמניה", club: "ארסנל", league: "Premier League" },
  { name: "לירוי סאנה", country: "גרמניה", club: "באיירן מינכן", league: "Bundesliga" },
  { name: "אילקאי גונדואן", country: "גרמניה", club: "ברצלונה", league: "La Liga" },
  { name: "סבסטיאן האלר", country: "חוף השנהב", club: "בורוסיה דורטמונד", league: "Bundesliga" },
  { name: "סימון אדינגרה", country: "חוף השנהב", club: "ברייטון", league: "Premier League" },
  { name: "מויסס קאייסדו", country: "אקוודור", club: "צ'לסי", league: "Premier League" },
  { name: "אנר ולנסיה", country: "אקוודור", club: "אינטרנסיונל", league: "Serie A Brazil" },
];

const GROUP_F: Player[] = [
  { name: "וירג'יל ואן דייק", country: "הולנד", club: "ליברפול", league: "Premier League" },
  { name: "צ'אבי סימונס", country: "הולנד", club: "טוטנהאם", league: "Bundesliga" },
  { name: "פרנקי דה יונג", country: "הולנד", club: "ברצלונה", league: "La Liga" },
  { name: "קודי גאקפו", country: "הולנד", club: "ליברפול", league: "Premier League" },
  { name: "טקפוסה קובו", country: "יפן", club: "ריאל סוסיאדד", league: "La Liga" },
  { name: "קאורו מיטומה", country: "יפן", club: "ברייטון", league: "Premier League" },
  { name: "ווטארו אנדו", country: "יפן", club: "ליברפול", league: "Premier League" },
  { name: "ויקטור גיוקרס", country: "שוודיה", club: "ספורטינג ליסבון", league: "Liga Portugal" },
  { name: "אלכסנדר איסק", country: "שוודיה", club: "ליברפול", league: "Premier League" },
];

const GROUP_G: Player[] = [
  { name: "קווין דה בראונה", country: "בלגיה", club: "נאפולי", league: "Premier League" },
  { name: "רומלו לוקאקו", country: "בלגיה", club: "רומא", league: "Serie A" },
  { name: "ז'רמי דוקו", country: "בלגיה", club: "מנצ'סטר סיטי", league: "Premier League" },
  { name: "מוחמד סלאח", country: "מצרים", club: "ליברפול", league: "Premier League" },
  { name: "עומר מרמוש", country: "מצרים", club: "מנצ'סטר סיטי", league: "Bundesliga" },
  { name: "מהדי טארמי", country: "איראן", club: "פורטו", league: "Liga Portugal" },
  { name: "סרדאר אזמון", country: "איראן", club: "רומא", league: "Serie A" },
];

const GROUP_H: Player[] = [
  { name: "לאמין ימאל", country: "ספרד", club: "ברצלונה", league: "La Liga" },
  { name: "רודרי", country: "ספרד", club: "מנצ'סטר סיטי", league: "Premier League" },
  { name: "אלברו מוראטה", country: "ספרד", club: "אתלטיקו מדריד", league: "La Liga" },
  { name: "ניקו ויליאמס", country: "ספרד", club: "אתלטיק בילבאו", league: "La Liga" },
  { name: "פדרי", country: "ספרד", club: "ברצלונה", league: "La Liga" },
  { name: "פדריקו ואלוורדה", country: "אורוגוואי", club: "ריאל מדריד", league: "La Liga" },
  { name: "דרווין נונייס", country: "אורוגוואי", club: "ליברפול", league: "Premier League" },
  { name: "רונאלד אראוחו", country: "אורוגוואי", club: "ברצלונה", league: "La Liga" },
];

const GROUP_I: Player[] = [
  { name: "קיליאן אמבפה", country: "צרפת", club: "ריאל מדריד", league: "La Liga" },
  { name: "אנטואן גריזמן", country: "צרפת", club: "אתלטיקו מדריד", league: "La Liga" },
  { name: "אורליאן טשואמני", country: "צרפת", club: "ריאל מדריד", league: "La Liga" },
  { name: "אדוארדו קמבינגה", country: "צרפת", club: "ריאל מדריד", league: "La Liga" },
  { name: "מייק מניאן", country: "צרפת", club: "מילאן", league: "Serie A" },
  { name: "וויליאם סאליבה", country: "צרפת", club: "ארסנל", league: "Premier League" },
  { name: "סאדיו מאנה", country: "סנגל", club: "אל נאסר", league: "Saudi Pro League" },
  { name: "ניקולס ג'קסון", country: "סנגל", club: "צ'לסי", league: "Premier League" },
  { name: "ארלינג האלאנד", country: "נורווגיה", club: "מנצ'סטר סיטי", league: "Premier League" },
  { name: "מרטין אודגור", country: "נורווגיה", club: "ארסנל", league: "Premier League" },
];

const GROUP_J: Player[] = [
  { name: "ליונל מסי", country: "ארגנטינה", club: "אינטר מיאמי", league: "MLS" },
  { name: "לאוטרו מרטינס", country: "ארגנטינה", club: "אינטר", league: "Serie A" },
  { name: "חוליאן אלבארס", country: "ארגנטינה", club: "מנצ'סטר סיטי", league: "Premier League" },
  { name: "אלקסיס מק אליסטר", country: "ארגנטינה", club: "ליברפול", league: "Premier League" },
  { name: "אנסו פרננדס", country: "ארגנטינה", club: "צ'לסי", league: "Premier League" },
  { name: "אמיליאנו מרטינס", country: "ארגנטינה", club: "אסטון וילה", league: "Premier League" },
  { name: "ריאד מחרז", country: "אלג'יריה", club: "אל אהלי", league: "Saudi Pro League" },
  { name: "מרסל סביצר", country: "אוסטריה", club: "בורוסיה דורטמונד", league: "Bundesliga" },
];

const GROUP_K: Player[] = [
  { name: "כריסטיאנו רונאלדו", country: "פורטוגל", club: "אל נאסר", league: "Saudi Pro League" },
  { name: "ברונו פרננדש", country: "פורטוגל", club: "מנצ'סטר יונייטד", league: "Premier League" },
  { name: "ברנרדו סילבה", country: "פורטוגל", club: "מנצ'סטר סיטי", league: "Premier League" },
  { name: "רפאל ליאו", country: "פורטוגל", club: "מילאן", league: "Serie A" },
  { name: "ז'ואאו פליקס", country: "פורטוגל", club: "ברצלונה", league: "La Liga" },
  { name: "לואיס דיאס", country: "קולומביה", club: "ליברפול", league: "Premier League" },
  { name: "חאמס רודריגס", country: "קולומביה", club: "סאו פאולו", league: "Serie A Brazil" },
];

const GROUP_L: Player[] = [
  { name: "פדריקו קייזה", country: "איטליה", club: "יובנטוס", league: "Serie A" },
  { name: "ניקולו בארלה", country: "איטליה", club: "אינטר", league: "Serie A" },
  { name: "אלסנדרו בסטוני", country: "איטליה", club: "אינטר", league: "Serie A" },
  { name: "ויקטור אוסימהן", country: "ניגריה", club: "נאפולי", league: "Serie A" },
  { name: "אדמולה לוקמן", country: "ניגריה", club: "אטאלנטה", league: "Serie A" },
  { name: "לוקה מודריץ'", country: "קרואטיה", club: "ריאל מדריד", league: "La Liga" },
  { name: "יושקו גבארדיול", country: "קרואטיה", club: "מנצ'סטר סיטי", league: "Premier League" },
];

export const PLAYERS_DATA: Player[] = [
  ...GROUP_A,
  ...GROUP_B,
  ...GROUP_C,
  ...GROUP_D,
  ...GROUP_E,
  ...GROUP_F,
  ...GROUP_G,
  ...GROUP_H,
  ...GROUP_I,
  ...GROUP_J,
  ...GROUP_K,
  ...GROUP_L,
];

// רשימת שמות עבור ה-Autocomplete
export const TOP_PLAYERS_NAMES = PLAYERS_DATA.map(p => p.name);

// פונקציית עזר לשליפת מידע מלא על שחקן לפי שמו
export const getPlayerInfo = (name: string) => PLAYERS_DATA.find(p => p.name === name);

// מחלץ רשימת שחקנים עבור נבחרת ספציפית
export const getPlayersByCountry = (country: string) => PLAYERS_DATA.filter(p => p.country === country);
