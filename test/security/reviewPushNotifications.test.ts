import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('review push notifications', () => {
  it('keeps the immediate review push and adds the 24h player reminder', () => {
    const sendPush = read('supabase/functions/send-push/index.ts');
    const scheduledPushes = read('supabase/functions/scheduled-pushes/index.ts');
    const sharedPush = read('supabase/functions/_shared/push.ts');

    expect(sendPush).toMatch(/pending_player_review/);
    expect(sendPush).toMatch(/Valora a los compa/);
    expect(sendPush).toMatch(/Dos toques y listo/);

    expect(sharedPush).toMatch(/review_player_reminder/);
    expect(scheduledPushes).toMatch(/REVIEW_REMINDER_DELAY_HOURS\s*=\s*24/);
    expect(scheduledPushes).toMatch(/type ScheduledType = 'match_reminders' \| 'nearby_digest' \| 'review_reminders'/);
    expect(scheduledPushes).toMatch(/\.eq\('type', 'pending_player_review'\)/);
    expect(scheduledPushes).toMatch(/\.eq\('read', false\)/);
    expect(scheduledPushes).toMatch(/\.eq\('reviewer_id', notification\.user_id\)/);
    expect(scheduledPushes).toMatch(/Te queda una valoración pendiente/);
    expect(scheduledPushes).toMatch(/Un minuto y partido cerrado/);
    expect(scheduledPushes).toMatch(/review_player_reminder:\$\{notification\.id\}/);
  });
});
