import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');

const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('match completion review flow', () => {
  it('wires completed matches to pending organizer review notifications', () => {
    const sql = read('supabase/migrations/20260609190000_fix_match_completion_review_notifications.sql');
    const matchDetail = read('app/match/[id].tsx');

    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION private\.set_match_completed_at/i);
    expect(sql).toMatch(/CREATE TRIGGER set_match_completed_at_before_update/i);
    expect(sql).toMatch(/CREATE TRIGGER create_match_completion_review_notification_after_update/i);
    expect(sql).toMatch(/pending_organizer_review/i);
    expect(sql).toMatch(/ON CONFLICT \(user_id, match_id, type\) DO NOTHING/i);
    expect(sql).toMatch(/SET\s+completed_at\s*=\s*COALESCE\(completed_at,\s*date_time\s*\+\s*interval '2 hours',\s*now\(\)\)/i);
    expect(matchDetail).toMatch(/completed_at:\s*new Date\(\)\.toISOString\(\)/i);
    expect(matchDetail).toMatch(/ignoreDuplicates:\s*true/i);
  });
});
