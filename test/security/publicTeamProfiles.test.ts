import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('public team profiles', () => {
  const migration = read('supabase/migrations/20260828172548_public_team_profiles.sql');
  const publicTeamFunction = migration.match(
    /CREATE FUNCTION public\.get_public_team[\s\S]*?(?=CREATE FUNCTION public\.get_public_user_teams)/,
  )?.[0] ?? '';

  it('limits public team data and requires an authenticated caller', () => {
    expect(publicTeamFunction).toMatch(/v_user_id uuid := auth\.uid\(\)/);
    expect(publicTeamFunction).toMatch(/IF v_user_id IS NULL/);
    expect(publicTeamFunction).toMatch(/ms\.is_active = true/);
    expect(publicTeamFunction).toMatch(/ms\.deleted_at IS NULL/);
    expect(publicTeamFunction).toMatch(/sm\.status = 'active'/);
    expect(publicTeamFunction).toMatch(/sm\.user_id <> ms\.organizer_id/);
    expect(publicTeamFunction).not.toMatch(/invite_code/);
    expect(publicTeamFunction).not.toMatch(/price_per_player/);
    expect(publicTeamFunction).not.toMatch(/requires_approval/);
  });

  it('keeps public reads out of the anonymous API surface', () => {
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.get_public_team\(uuid\)\s+FROM PUBLIC, anon/i);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.get_public_user_teams\(uuid\)\s+FROM PUBLIC, anon/i);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_public_team\(uuid\)\s+TO authenticated, service_role/i);
  });

  it('versions the description limit and leaves match visibility policies unchanged', () => {
    expect(migration).toMatch(/char_length\(btrim\(description\)\) BETWEEN 1 AND 300/);
    expect(migration).not.toMatch(/CREATE POLICY/);
    expect(migration).not.toMatch(/ALTER POLICY/);
  });
});
