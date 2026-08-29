import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const migration = read('supabase/migrations/20260829224147_team_match_recurrences_phase2.sql');
const sqlTests = read('supabase/tests/team_match_recurrences_phase2.sql');

describe('team match recurrences security', () => {
  it('limits recurrence rows to related authenticated users', () => {
    expect(migration).toMatch(/ALTER TABLE public\.team_match_recurrences ENABLE ROW LEVEL SECURITY/i);
    expect(migration).toMatch(/FOR SELECT\s+TO authenticated[\s\S]*private\.can_access_series/i);
    expect(migration).toMatch(/REVOKE ALL ON TABLE public\.team_match_recurrences\s+FROM PUBLIC, anon, authenticated/i);
    expect(migration).not.toMatch(/FOR (INSERT|UPDATE|DELETE)\s+TO authenticated/i);
  });

  it('keeps generation internal and participants pending', () => {
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION private\.generate_team_match_recurrences[\s\S]*FROM PUBLIC, anon, authenticated, service_role/i);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION private\.generate_team_match_recurrences[\s\S]*TO postgres/i);
    expect(migration).toMatch(/sm\.user_id,\s+'pending'/i);
    expect(migration).not.toMatch(/CREATE OR REPLACE FUNCTION public\.auto_confirm_attendance/i);
  });

  it('versions idempotency and delays cron activation', () => {
    expect(migration).toMatch(/CREATE UNIQUE INDEX matches_recurrence_datetime_key/i);
    expect(migration).toMatch(/FOR UPDATE OF r/i);
    expect(migration).not.toMatch(/cron\.schedule/i);
  });

  it('covers both Europe Madrid clock changes', () => {
    expect(sqlTests).toContain("2026-03-29 21:00:00 Europe/Madrid");
    expect(sqlTests).toContain("2026-10-25 21:00:00 Europe/Madrid");
    expect(sqlTests).toMatch(/AT TIME ZONE 'Europe\/Madrid'/i);
  });
});
