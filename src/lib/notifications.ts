// Browser Notification API helper for ItaFood

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
};

export const sendNotification = (title: string, options?: NotificationOptions) => {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  // Vibrate if supported
  if ("vibrate" in navigator) {
    navigator.vibrate([200, 100, 200]);
  }

  try {
    new Notification(title, {
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      ...options,
    });
  } catch {
    // Notification constructor may fail in some contexts
  }
};

// Predefined notifications
export const notifyNewOrder = () => {
  sendNotification("🍕 Novo Pedido no ItaFood!", {
    body: "Abra para aceitar o pedido.",
    tag: "new-order",
  });
};

export const notifyDeliveryAvailable = () => {
  sendNotification("🏍️ Nova Entrega Disponível!", {
    body: "Veja os detalhes e aceite a corrida.",
    tag: "delivery-available",
  });
};

export const notifyOrderPreparing = () => {
  sendNotification("👨‍🍳 Seu pedido está sendo preparado!", {
    body: "O restaurante começou a preparar sua comida.",
    tag: "order-preparing",
  });
};

export const notifyOrderOnTheWay = () => {
  sendNotification("🛵 O motoboy saiu para entrega!", {
    body: "Seu pedido está a caminho. Fique atento!",
    tag: "order-on-way",
  });
};

export const notifyOrderDelivered = () => {
  sendNotification("✅ Pedido entregue!", {
    body: "Seu pedido foi entregue. Bom apetite!",
    tag: "order-delivered",
  });
};
