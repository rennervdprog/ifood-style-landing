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
  const orderId = payload.data?.order_id;
  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    sound: "/sounds/order-bell.mp3",
    data: payload.data,
    tag: orderId ? "order-" + orderId : "itasuper-" + Date.now(),
    renotify: true,
    requireInteraction: true,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  var link = data.link || "/";
  var orderId = data.order_id;

  if (orderId) {
    if (link === "/pedidos") {
      link = "/pedidos?chat=" + orderId;
    } else if (link === "/admin") {
      link = "/admin?order=" + orderId;
    } else if (link === "/entregador") {
      link = "/entregador?order=" + orderId;
    }
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
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
