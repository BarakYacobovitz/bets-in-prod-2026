import './globals.css';
import toast, { Toaster } from 'react-hot-toast';
import Navbar from '../components/Navbar'; 
// --- תחילת הפתרון לתיקון באג ה-Hover באייפון ---
const originalSuccess = toast.success;
toast.success = (message, options) => {
  // קוראים להודעה הרגילה ושומרים את המזהה שלה
  const toastId = originalSuccess(message, options);
  
  // מכריחים את המערכת להעלים את הטוסט אחרי 3 שניות, 
  // ועוקפים את מנגנון עצירת-הזמן של הספרייה.
  setTimeout(() => {
    toast.dismiss(toastId);
  }, 3000);
  
  return toastId;
};
// 1. הגדרת צבע הרקע של שורת הסטטוס בטלפון (השוליים העליונים באייפון/אנדרואיד)
export const viewport = {
  themeColor: '#0f172a',
};

// 2. הוספנו לכאן את הקישור למניפסט ואת הגדרות האפליקציה של אפל
export const metadata = {
  title: 'Bets in Prod',
  description: 'World Cup 2026 Predictions',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bets in Prod',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className="bg-slate-950">
      <body className="bg-slate-950 text-slate-200 min-h-[100dvh] flex flex-col">
        
        
        {/* זה הבר העליון היחיד שצריך להיות כאן! */}
        <Navbar />
        
        {/* תוכן העמוד המשתנה */}
        <main className="flex-1">
          {children}
        </main>

       <Toaster 
            position="top-center"
            toastOptions={{
              // 1. הגדרות גלובליות לכל הטוסטים במערכת (שאלות, שגיאות, וכו')
              duration: 3000,
              style: {
                background: '#1e293b',
                color: '#fff',
                border: '1px solid #334155',
                direction: 'rtl',
                // שים לב: הסרנו מכאן את ה-pointerEvents כדי לאפשר לחיצות!
              },
              
              // 2. הגדרות ספציפיות *רק* ל-toast.success
              success: {
                style: {
                  background: '#1e293b',
                  color: '#fff',
                  border: '1px solid #10b981', // אפשר אפילו לתת מסגרת ירקרקה להצלחה
                  direction: 'rtl',
                  pointerEvents: 'none', // הופך רק את הודעות ההצלחה לרואות ואינן נראות למגע
                },
              },

              // 3. הגדרות ספציפיות לשגיאות
              error: {
                duration: 4000,
                style: {
                  background: '#1e293b',
                  color: '#fff',
                  border: '1px solid #ef4444', // מסגרת אדומה לשגיאות
                  direction: 'rtl',
                }
              },
            }} 
          />
      </body>
    </html>
  );
}