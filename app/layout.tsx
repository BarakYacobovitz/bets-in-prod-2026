import './globals.css';
import { Toaster } from 'react-hot-toast';
import Navbar from '../components/Navbar'; 

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

        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}