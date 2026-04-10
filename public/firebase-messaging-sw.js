/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyC7o57Z8Y-F2KLyqSIGtHTSPgTxGRr-JNQ",
  authDomain: "itasuper-c71a1.firebaseapp.com",
  projectId: "itasuper-c71a1",
  storageBucket: "itasuper-c71a1.firebasestorage.app",
  messagingSenderId: "344752263518",
  appId: "1:344752263518:web:abcb197795dbd262d37fcf",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || "ItaSuper";
  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    vibrate: [200, 100, 200],
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  // If notification has an order_id, open the chat for that order
  let link = data.link || "/";
  if (data.order_id) {
    link = "/pedidos?chat=" + data.order_id;
  }
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Try to focus an existing window and navigate it
      for (const client of windowClients) {
        if ("focus" in client) {
          client.focus();
          client.navigate(link);
          return;
        }
      }
      return clients.openWindow(link);
    })
  );
});
