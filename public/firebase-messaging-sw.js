// ייבוא הספריות של פיירבייס ל-Service Worker (גרסת compat)
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// --- החלף את זה בהגדרות שלך מה-Firebase Console ---
const firebaseConfig = {
  
  apiKey: "AIzaSyB1bwnonDx4ZoRZD_32Tdozh8T6iazxiKk",
  authDomain: "betsinprod26.firebaseapp.com",
  projectId: "betsinprod26",
  storageBucket: "betsinprod26.firebasestorage.app",
  messagingSenderId: "948458575430",
  appId: "1:948458575430:web:6261da007a3ec9fb0f1c47"

};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// האזנה להודעות שמגיעות כשהאפליקציה ברקע או סגורה
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification?.title || 'Bets in PROD';
  const notificationOptions = {
    body: payload.notification?.body || 'יש לך עדכונים חדשים במערכת!',
    icon: '/icon-192x192.png', // תמונה קיימת בתיקיית public
    badge: '/icon-192x192.png',
    dir: 'rtl'
  };

  // ברגע שמגיעה הודעה - אנחנו מוסיפים התראה ל-Badge החיצוני (של האייקון במסך הבית)
  if ('setAppBadge' in navigator) {
    // מכיוון שאנחנו ברקע ולא יודעים בדיוק כמה חסר, פשוט נדליק את ה-Badge
    navigator.setAppBadge().catch((err) => console.log('Badge error:', err));
  }

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// מאזין לאירוע של סילוק ההתראה (כשהמשתמש עושה לה Swipe מלוח ההתראות בטלפון)
self.addEventListener('notificationclose', (event) => {
  console.log('המשתמש סילק את ההתראה מהמסך');
  
  // אם הוא סילק, ננקה את העיגול האדום מהאייקון של האפליקציה
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch((err) => console.log('Clear badge error:', err));
  }
});

// מאזין לאירוע של לחיצה על ההתראה עצמה
self.addEventListener('notificationclick', (event) => {
  console.log('המשתמש לחץ על ההתראה');
  event.notification.close();
  
  // פותח את האפליקציה כשלוחצים
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // אם האפליקציה כבר פתוחה ברקע, נביא אותה לפוקוס
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // אם היא סגורה לחלוטין, נפתח אותה
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});