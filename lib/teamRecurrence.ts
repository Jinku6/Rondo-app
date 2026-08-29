export type TeamRecurrenceFrequency = 'weekly' | 'monthly';
export type TeamRecurrenceWeek = -1 | 1 | 2 | 3 | 4;

export const TEAM_RECURRENCE_TIMEZONE = 'Europe/Madrid' as const;

export const RECURRENCE_WEEKDAYS = [
  { value: 1, shortLabel: 'Lun', label: 'lunes', singularLabel: 'lunes' },
  { value: 2, shortLabel: 'Mar', label: 'martes', singularLabel: 'martes' },
  { value: 3, shortLabel: 'Mié', label: 'miércoles', singularLabel: 'miércoles' },
  { value: 4, shortLabel: 'Jue', label: 'jueves', singularLabel: 'jueves' },
  { value: 5, shortLabel: 'Vie', label: 'viernes', singularLabel: 'viernes' },
  { value: 6, shortLabel: 'Sáb', label: 'sábados', singularLabel: 'sábado' },
  { value: 0, shortLabel: 'Dom', label: 'domingos', singularLabel: 'domingo' },
] as const;

export const RECURRENCE_MONTH_WEEKS: ReadonlyArray<{
  value: TeamRecurrenceWeek;
  shortLabel: string;
  summaryLabel: string;
}> = [
  { value: 1, shortLabel: '1ª', summaryLabel: 'primer' },
  { value: 2, shortLabel: '2ª', summaryLabel: 'segundo' },
  { value: 3, shortLabel: '3ª', summaryLabel: 'tercer' },
  { value: 4, shortLabel: '4ª', summaryLabel: 'cuarto' },
  { value: -1, shortLabel: 'Última', summaryLabel: 'último' },
];

type CalendarDate = { day: number; month: number; year: number };

function parseDateText(value: string): CalendarDate | null {
  const [dayText, monthText, yearText] = value.split('/');
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  if (!day || !month || !year || yearText?.length !== 4) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;

  return { day, month, year };
}

function toUtcDate(value: CalendarDate) {
  return new Date(Date.UTC(value.year, value.month - 1, value.day));
}

function formatUtcDate(date: Date) {
  return [
    String(date.getUTCDate()).padStart(2, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCFullYear()),
  ].join('/');
}

function monthlyOccurrence(year: number, monthIndex: number, weekday: number, week: TeamRecurrenceWeek) {
  if (week === -1) {
    const last = new Date(Date.UTC(year, monthIndex + 1, 0));
    last.setUTCDate(last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7));
    return last;
  }

  const first = new Date(Date.UTC(year, monthIndex, 1));
  first.setUTCDate(1 + ((weekday - first.getUTCDay() + 7) % 7) + ((week - 1) * 7));
  return first;
}

export function getDateWeekday(value: string) {
  const parsed = parseDateText(value);
  return parsed ? toUtcDate(parsed).getUTCDay() : null;
}

export function getWeekOfMonth(value: string): TeamRecurrenceWeek | null {
  const parsed = parseDateText(value);
  if (!parsed) return null;
  const date = toUtcDate(parsed);
  const nextSameWeekday = new Date(date);
  nextSameWeekday.setUTCDate(date.getUTCDate() + 7);
  if (nextSameWeekday.getUTCMonth() !== date.getUTCMonth()) return -1;
  return Math.min(4, Math.ceil(parsed.day / 7)) as TeamRecurrenceWeek;
}

export function alignWeeklyDate(value: string, weekday: number) {
  const parsed = parseDateText(value);
  if (!parsed) return value;
  const date = toUtcDate(parsed);
  date.setUTCDate(date.getUTCDate() + ((weekday - date.getUTCDay() + 7) % 7));
  return formatUtcDate(date);
}

export function alignMonthlyDate(value: string, weekday: number, week: TeamRecurrenceWeek) {
  const parsed = parseDateText(value);
  if (!parsed) return value;
  const current = toUtcDate(parsed);
  let candidate = monthlyOccurrence(parsed.year, parsed.month - 1, weekday, week);
  if (candidate < current) {
    candidate = monthlyOccurrence(parsed.year, parsed.month, weekday, week);
  }
  return formatUtcDate(candidate);
}

export function buildRecurrenceSummary(
  frequency: TeamRecurrenceFrequency,
  weekday: number,
  week: TeamRecurrenceWeek,
  timeText: string,
) {
  const day = RECURRENCE_WEEKDAYS.find(option => option.value === weekday);
  if (!day || !timeText) return null;
  if (frequency === 'weekly') {
    return `Se jugará todos los ${day.label} a las ${timeText}. Seguirá activo hasta que lo anules.`;
  }
  const monthWeek = RECURRENCE_MONTH_WEEKS.find(option => option.value === week);
  if (!monthWeek) return null;
  return `Se jugará el ${monthWeek.summaryLabel} ${day.singularLabel} de cada mes a las ${timeText}. Seguirá activo hasta que lo anules.`;
}
