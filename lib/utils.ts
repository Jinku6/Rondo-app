// Valida que un string sea un UUID v4 bien formado
export const isValidUUID = (val: unknown): val is string =>
  typeof val === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

// Valida coordenadas geográficas
export const isValidCoords = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

// Valida color hex (#RGB o #RRGGBB)
export const isValidHexColor = (val: string): boolean =>
  /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val);

// Valida URL con protocolo https únicamente
export const isSafeUrl = (val: unknown): val is string =>
  typeof val === 'string' && /^https:\/\/.+/.test(val);

// Extrae el primer elemento si el param puede ser string | string[]
export const firstParam = (val: string | string[]): string =>
  Array.isArray(val) ? val[0] : val;

export const calculateAge = (birthday: string | null | undefined): number | null => {
  if (!birthday) return null;
  const birthDate = new Date(birthday);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};
