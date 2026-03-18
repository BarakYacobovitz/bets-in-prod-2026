import './globals.css';
import { Toaster } from 'react-hot-toast';
import Navbar from '../components/Navbar'; // השאר רק את הייבוא הזה

export const metadata = {
  title: 'Bets in Prod',
  description: 'World Cup 2026 Predictions',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-slate-950 text-slate-200 min-h-screen flex flex-col">
        
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