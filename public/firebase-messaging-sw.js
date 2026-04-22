// public/firebase-messaging-sw.js

// ייבוא הספריות הרלוונטיות לפיירבייס ב-Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// --- ⚠️ החלף את זה בנתונים האמיתיים שלך מקובץ ה-firebase.ts ⚠️ ---
const firebaseConfig = {
  
  apiKey: "AIzaSyB1bwnonDx4ZoRZD_32Tdozh8T6iazxiKk",
  authDomain: "betsinprod26.firebaseapp.com",
  projectId: "betsinprod26",
  storageBucket: "betsinprod26.firebasestorage.app",
  messagingSenderId: "948458575430",
  appId: "1:948458575430:web:6261da007a3ec9fb0f1c47"

};
// ---------------------------------------------------------------

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// האזנה להודעות Push שמגיעות כשהאפליקציה סגורה או ברקע
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);

  const notificationTitle = payload.notification?.title || 'Bets in PROD';
  const notificationOptions = {
    body: payload.notification?.body || 'יש לך עדכונים חדשים במערכת!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    dir: 'rtl'
  };

  // קסם הבועה האדומה! אם השרת שלח מספר חוסרים, נעדכן את ה-Badge ברקע
  if (payload.data && payload.data.missingCount) {
    if (navigator.setAppBadge) {
      navigator.setAppBadge(Number(payload.data.missingCount)).catch(console.error);
    }
  }

  return self.registration.showNotification(notificationTitle, notificationOptions);
});