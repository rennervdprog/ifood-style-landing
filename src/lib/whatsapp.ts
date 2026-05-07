/**
 * Formats a Brazilian phone number to international format for WhatsApp.
 * Input: "15 99999-9999" or "1599999999" or "+55 15 99999-9999" etc.
 * Output: "5515999999999"
 */
export const formatWhatsAppNumber = (phone: string): string => {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");
  
  // If already starts with 55 and has 12-13 digits, return as-is
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }
  
  // Otherwise prepend 55 (Brazil country code)
  return `55${digits}`;
};

/**
 * Opens WhatsApp with a pre-filled message.
 * Robust across browser, PWA and Capacitor (Android) WebView:
 *  - Native (Capacitor): force `_system` so the OS opens the WhatsApp app.
 *  - Web: try `_blank`; if blocked, fall back to `location.href`.
 */
export const openWhatsApp = (number: string, message?: string): void => {
  const formatted = formatWhatsAppNumber(number);
  const encodedMessage = message ? `?text=${encodeURIComponent(message)}` : "";
  const url = `https://wa.me/${formatted}${encodedMessage}`;

  try {
    // Capacitor / native WebView: '_system' delegates to the OS browser/app intent
    const w = window as any;
    const isNative = !!(w.Capacitor?.isNativePlatform?.() || w.cordova || w.gonative);
    if (isNative) {
      window.open(url, "_system");
      return;
    }
  } catch {
    /* ignore and fall through to web behavior */
  }

  // Web: try a new tab; if popup blocker prevents it, navigate the current tab
  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (!popup) {
    window.location.href = url;
  }
};

/**
 * Validates a WhatsApp number (must have at least 10 digits after cleaning).
 */
export const isValidWhatsApp = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, "");
  // With country code: 12-13 digits (55 + 2 DDD + 8-9 number)
  // Without country code: 10-11 digits (2 DDD + 8-9 number)
  if (digits.startsWith("55")) {
    return digits.length >= 12 && digits.length <= 13;
  }
  return digits.length >= 10 && digits.length <= 11;
};

/**
 * Formats phone display with standard Brazilian mask: (11) 99999-9999 or (11) 9999-9999
 * Accepts input with or without country code 55.
 */
export const maskWhatsApp = (value: string): string => {
  if (!value) return "";
  
  let digits = value.replace(/\D/g, "");
  
  // If it starts with 55 and has 12 or 13 digits (Brazil country code + DDD + number)
  // we remove the 55 for the display mask to keep it cleaner
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  
  // Limit to 11 digits (maximum for Brazilian mobile numbers with DDD)
  digits = digits.slice(0, 11);
  
  const len = digits.length;
  if (len === 0) return "";
  if (len <= 2) return `(${digits}`;
  if (len <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (len <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

/**
 * Formats a phone number for display: +55 15 99999-9999
 * Works with stored numbers (just digits like "5515999999999" or "15999999999")
 */
export const formatPhoneDisplay = (phone: string): string => {
  if (!phone) return "";
  return maskWhatsApp(phone);
};
