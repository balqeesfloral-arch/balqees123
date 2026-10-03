export const cleanEmail = value => (value || '').trim().toLowerCase();

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail(value));
}

export function normalizeSaudiPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^05\d{8}$/.test(digits)) return `+966${digits.slice(1)}`;
  if (/^9665\d{8}$/.test(digits)) return `+${digits}`;
  if (/^5\d{8}$/.test(digits)) return `+966${digits}`;
  return String(value || '').trim();
}

export function isValidSaudiPhone(value) {
  return /^\+9665\d{8}$/.test(normalizeSaudiPhone(value));
}

export function isValidUsername(value) {
  const v = String(value || '').trim();
  return /^(?=.{3,30}$)[\p{L}\p{N}._-]+$/u.test(v) && !/[._-]{2,}/.test(v);
}

// Saudi Arabia's current unified commercial registration / establishment number.
// The 2025 Commercial Register system uses the unified establishment number, beginning with 7.
export function isValidUnifiedCommercialNumber(value) {
  return /^7\d{9}$/.test(String(value || '').replace(/\D/g, ''));
}

// ZATCA VAT registration number syntax: 15 digits, begins with 3 and ends with 3.
export function isValidVatNumber(value) {
  return /^3\d{13}3$/.test(String(value || '').replace(/\D/g, ''));
}

export function isValidBuildingNumber(value) {
  return /^\d{4}$/.test(String(value || '').replace(/\D/g, ''));
}

export function isValidSecondaryNumber(value) {
  return /^\d{4}$/.test(String(value || '').replace(/\D/g, ''));
}

export function isValidPostalCode(value) {
  return /^\d{5}$/.test(String(value || '').replace(/\D/g, ''));
}

export function isValidShortAddress(value) {
  if (!String(value || '').trim()) return true;
  return /^[A-Za-z]{4}\d{4}$/.test(String(value || '').trim());
}

export function passwordScore(value) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[a-z]/i.test(value) && /\d/.test(value)) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value) || value.length >= 12) score += 1;
  return score;
}

export function isValidBirthDate(value) {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const oldest = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
  return date <= now && date >= oldest;
}
