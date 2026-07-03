// Phone validation and normalization for Philippine mobile numbers.

export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, "");

  // +639XXXXXXXXX -> keep
  if (/^\+639\d{9}$/.test(cleaned)) return cleaned;

  // 09XXXXXXXXX -> +639XXXXXXXXX
  if (/^09\d{9}$/.test(cleaned)) return `+63${cleaned.slice(1)}`;

  // 639XXXXXXXXX -> +639XXXXXXXXX
  if (/^639\d{9}$/.test(cleaned)) return `+${cleaned}`;

  return null;
}

export function isValidPhilippinePhone(raw: string): boolean {
  return normalizePhone(raw) !== null;
}

export function maskPhone(normalized: string): string {
  // +639171234567 -> +6391***4567
  if (normalized.length < 8) return "***";
  return `${normalized.slice(0, 5)}***${normalized.slice(-4)}`;
}
