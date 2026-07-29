// Phones are stored normalized as "+639XXXXXXXXX". This renders them in the
// local "09XXXXXXXXX" form for display. Anything already local or unrecognized
// is returned untouched.
export function toDisplayPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  if (/^\+639\d{9}$/.test(cleaned)) return `0${cleaned.slice(3)}`;
  if (/^639\d{9}$/.test(cleaned)) return `0${cleaned.slice(2)}`;
  return cleaned;
}
