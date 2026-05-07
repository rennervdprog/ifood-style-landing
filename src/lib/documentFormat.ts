export function formatDocument(value: string): string {
  const digits = value.replace(/\D/g, "");
  
  if (digits.length <= 11) {
    // CPF format: 000.000.000-00
    let formatted = digits;
    if (digits.length > 3) formatted = digits.slice(0, 3) + "." + digits.slice(3);
    if (digits.length > 6) formatted = digits.slice(0, 3) + "." + digits.slice(3, 6) + "." + digits.slice(6);
    if (digits.length > 9) formatted = digits.slice(0, 3) + "." + digits.slice(3, 6) + "." + digits.slice(6, 9) + "-" + digits.slice(9);
    return formatted;
  } else {
    // CNPJ format: 00.000.000/0000-00
    const d = digits.slice(0, 14);
    return d
      .replace(/^(\d{2})(\d)/, ".")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "..")
      .replace(/\.(\d{3})(\d)/, "./")
      .replace(/(\d{4})(\d)/, "-");
  }
}

export function sanitizeDocument(value: string): string {
  return value.replace(/\D/g, "");
}

export function validateDocument(value: string): boolean {
  const digits = sanitizeDocument(value);
  return digits.length === 11 || digits.length === 14;
}
