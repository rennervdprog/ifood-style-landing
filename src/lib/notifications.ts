// Browser + Push Notification helpers for ItaSuper
import { sendPushNotification } from "@/lib/firebase";
import { isCapacitorNative, registerCapacitorPush } from "@/lib/capacitorNative";

// ── Local browser notifications ──

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (isCapacitorNative()) {
    const token = await registerCapacitorPush();
    return Boolean(token);
  }
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
};

export const sendNotification = (title: string, options?: NotificationOptions) => {
  if (isCapacitorNative()) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
  try {
    new Notification(title, { icon: "/icon-192x192.png", badge: "/icon-192x192.png", ...options });
  } catch { /* noop */ }
};

// ── Push notification helpers (calls edge function) ──

export const pushNotifyNewOrder = (storeOwnerIds: string[], orderId: string) =>
  sendPushNotification(storeOwnerIds, "🍕 Novo Pedido!", "Abra para aceitar o pedido.", { link: "/admin", order_id: orderId });

export const pushNotifyDeliveryAvailable = (driverIds: string[], orderId: string) =>
  sendPushNotification(driverIds, "🏍️ Nova Entrega Disponível!", "Veja os detalhes e aceite a corrida.", { link: "/entregas", order_id: orderId });

export const pushNotifyOrderPreparing = (clientId: string) =>
  sendPushNotification([clientId], "👨‍🍳 Seu pedido está sendo preparado!", "O restaurante começou a preparar sua comida.", { link: "/pedidos" });

export const pushNotifyOrderOnTheWay = (clientId: string) =>
  sendPushNotification([clientId], "🛵 O motoboy saiu para entrega!", "Seu pedido está a caminho. Fique atento!", { link: "/pedidos" });

export const pushNotifyOrderDelivered = (clientId: string) =>
  sendPushNotification([clientId], "✅ Pedido entregue!", "Seu pedido foi entregue. Bom apetite!", { link: "/pedidos" });

// ── Legacy local notifications (kept for compatibility) ──

export const notifyNewOrder = () => sendNotification("🍕 Novo Pedido no ItaSuper!", { body: "Abra para aceitar o pedido.", tag: "new-order" });
export const notifyDeliveryAvailable = () => sendNotification("🏍️ Nova Entrega Disponível!", { body: "Veja os detalhes e aceite a corrida.", tag: "delivery-available" });
export const notifyOrderPreparing = () => sendNotification("👨‍🍳 Seu pedido está sendo preparado!", { body: "O restaurante começou a preparar sua comida.", tag: "order-preparing" });
export const notifyOrderOnTheWay = () => sendNotification("🛵 O motoboy saiu para entrega!", { body: "Seu pedido está a caminho. Fique atento!", tag: "order-on-way" });
export const notifyOrderDelivered = () => sendNotification("✅ Pedido entregue!", { body: "Seu pedido foi entregue. Bom apetite!", tag: "order-delivered" });
