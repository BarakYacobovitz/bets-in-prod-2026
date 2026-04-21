// public/firebase-messaging-sw.js

// ייבוא הספריות הרלוונטיות לפיירבייס ב-Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// --- ⚠️ החלף את זה בנתונים האמיתיים שלך מקובץ ה-firebase.ts ⚠️ ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
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
    icon: '/B.svg',
    badge: '/B.svg',
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