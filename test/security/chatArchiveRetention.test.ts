import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('chat archive retention', () => {
  it('keeps completed match chats archived temporarily and deletes expired messages', () => {
    const sql = read('supabase/migrations/20260609171335_chat_archive_retention.sql');

    expect(sql).toMatch(/CREATE FUNCTION public\.get_user_chat_threads\(\)/i);
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS on_match_ended ON public\.matches/i);
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS public\.delete_chats_on_match_end\(\)/i);
    expect(sql).toMatch(/archived boolean/i);
    expect(sql).toMatch(/m\.status = 'completed'/i);
    expect(sql).toMatch(/COALESCE\(m\.completed_at,\s*m\.date_time \+ interval '2 hours'\)\s*>=\s*now\(\) - interval '30 days'/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION private\.delete_expired_chat_messages\(\)/i);
    expect(sql).toMatch(/DELETE FROM public\.chat_messages c/i);
    expect(sql).toMatch(/COALESCE\(m\.completed_at,\s*m\.date_time \+ interval '2 hours'\)\s*<\s*now\(\) - interval '30 days'/i);
    expect(sql).toMatch(/cron\.schedule\(\s*'delete-expired-chat-messages'/i);
    expect(sql).toMatch(/SELECT private\.delete_expired_chat_messages\(\);/i);
  });
});
