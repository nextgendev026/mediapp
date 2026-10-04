export const KENYAN_PHONE_DIGITS_REGEX = /^(?:254|0)[17]\d{8}$/;

export function normalizeKenyanPhone(input: string): string {
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('254')) return `+${digits}`;
  if (digits.startsWith('0')) return `+254${digits.slice(1)}`;
  return `+${digits}`;
}

export function isValidKenyanPhone(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (trimmed.length > 20) return false;
  if (!/^\+?[\d\s()-]+$/.test(trimmed)) return false;
  return KENYAN_PHONE_DIGITS_REGEX.test(trimmed.replace(/\D/g, ''));
}

export function isValidKenyanMsaNumber(input: string): boolean {
  const digits = input.trim().replace(/\D/g, '');
  return /^0[17]\d{8}$/.test(digits);
}

export function formatKenyanPhone(input: string): string {
  const normalized = normalizeKenyanPhone(input);
  if (normalized.length !== 13) return input;
  return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7, 10)} ${normalized.slice(10)}`;
}
