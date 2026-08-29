import { describe, expect, it } from 'vitest';

import {
  alignMonthlyDate,
  alignWeeklyDate,
  buildRecurrenceSummary,
  getDateWeekday,
  getWeekOfMonth,
} from '../teamRecurrence';

describe('team recurrence calendar', () => {
  it('aligns a weekly date without changing an already matching day', () => {
    expect(alignWeeklyDate('27/08/2026', 6)).toBe('29/08/2026');
    expect(alignWeeklyDate('29/08/2026', 6)).toBe('29/08/2026');
    expect(getDateWeekday('29/08/2026')).toBe(6);
  });

  it('aligns monthly dates to explicit and last weeks', () => {
    expect(alignMonthlyDate('01/08/2026', 4, 3)).toBe('20/08/2026');
    expect(alignMonthlyDate('21/08/2026', 4, 3)).toBe('17/09/2026');
    expect(alignMonthlyDate('01/02/2028', 2, -1)).toBe('29/02/2028');
    expect(getWeekOfMonth('29/02/2028')).toBe(-1);
  });

  it('builds the visible weekly and monthly summaries', () => {
    expect(buildRecurrenceSummary('weekly', 6, 1, '21:00')).toBe(
      'Se jugará todos los sábados a las 21:00. Seguirá activo hasta que lo anules.',
    );
    expect(buildRecurrenceSummary('monthly', 4, 3, '21:00')).toBe(
      'Se jugará el tercer jueves de cada mes a las 21:00. Seguirá activo hasta que lo anules.',
    );
  });
});
