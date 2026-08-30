const NON_DIGITS = /[^0-9]/g;

export function formatMatchDateInput(value: string): string {
  const digits = value.replace(NON_DIGITS, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

export function formatMatchTimeInput(value: string): string {
  const digits = value.replace(NON_DIGITS, '');
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

export function normalizeMatchTimeInput(value: string): string {
  const digits = value.replace(NON_DIGITS, '');
  if (!digits) return '';
  if (digits.length <= 2) return `${digits.padStart(2, '0')}:00`;
  if (digits.length === 3) return `${digits.slice(0, 1)}:${digits.slice(1)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

export function formatMatchDate(date: Date): string {
  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getFullYear()),
  ].join('/');
}

export function formatMatchTime(date: Date): string {
  return [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
  ].join(':');
}

export function parseMatchDateTime(dateText: string, timeText: string): Date | null {
  if (!dateText || !timeText) return null;

  const timeForParsing = timeText.includes(':') ? timeText : `${timeText}:00`;
  const [day, month, year] = dateText.split('/');
  const [hours, minutes] = timeForParsing.split(':');
  if (!day || !month || !year || year.length !== 4 || !hours || !minutes) return null;

  const dateParts = [day, month, year, hours, minutes].map(value => Number.parseInt(value, 10));
  if (dateParts.some(Number.isNaN)) return null;

  const [date, monthIndex, fullYear, hour, minute] = dateParts;
  const result = new Date(fullYear, monthIndex - 1, date, hour, minute);
  if (Number.isNaN(result.getTime())) return null;
  if (result.getMonth() !== monthIndex - 1 || result.getDate() !== date) return null;
  return result;
}
