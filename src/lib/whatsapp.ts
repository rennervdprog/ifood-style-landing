/**
 * Formats a Brazilian phone number to international format for WhatsApp.
 * Input: "15 99999-9999" or "1599999999" etc.
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
 */
export const openWhatsApp = (number: string, message?: string): void => {
  const formatted = formatWhatsAppNumber(number);
  const encodedMessage = message ? `?text=${encodeURIComponent(message)}` : "";
  window.open(`https://wa.me/${formatted}${encodedMessage}`, "_blank");
};

/**
 * Validates a WhatsApp number (must have at least 10 digits after cleaning).
 */
export const isValidWhatsApp = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
};

/**
 * Formats phone display with mask: (15) 99999-9999
 */
export const maskWhatsApp = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};
