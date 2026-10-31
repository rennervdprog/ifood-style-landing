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
    // CNPJ format: 00.000.000/0000-00 (mesmo padrão slice() do ramo CPF —
    // os .replace() anteriores descartavam os grupos capturados e
    // engoliam os dígitos, destruindo qualquer CNPJ digitado/colado)
    const d = digits.slice(0, 14);
    let formatted = d;
    if (d.length > 2) formatted = d.slice(0, 2) + "." + d.slice(2);
    if (d.length > 5) formatted = d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5);
    if (d.length > 8) formatted = d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5, 8) + "/" + d.slice(8);
    if (d.length > 12) formatted = d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5, 8) + "/" + d.slice(8, 12) + "-" + d.slice(12);
    return formatted;
  }
}

export function sanitizeDocument(value: string): string {
  return value.replace(/\D/g, "");
}

export function validateDocument(value: string): boolean {
  const digits = sanitizeDocument(value);
  return digits.length === 11 || digits.length === 14;
}
