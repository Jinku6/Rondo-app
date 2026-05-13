import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');

const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath: string) => fs.existsSync(path.join(root, relativePath));
const listSql = () =>
  fs
    .readdirSync(path.join(root, 'supabase/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .map((name) => read(`supabase/migrations/${name}`))
    .join('\n');

describe('security hardening artifacts', () => {
  it('keeps Supabase backend source versioned instead of ignored', () => {
    const gitignore = read('.gitignore');

    expect(gitignore).not.toMatch(/^supabase\/migrations\/$/m);
    expect(gitignore).not.toMatch(/^supabase\/\*\.html$/m);
    expect(gitignore).not.toMatch(/^supabase\/functions\/$/m);
  });

  it('contains one hardening migration that closes public app data, unsafe RPCs, review integrity, and storage writes', () => {
    const sql = listSql();

    expect(sql).toMatch(/user_account_private/i);
    expect(sql).toMatch(/grant\s+select,\s*insert,\s*update\s+on\s+table\s+public\.user_account_private\s+to\s+authenticated/i);
    expect(sql).toMatch(/revoke\s+execute\s+on\s+function\s+public\.increment_cancellations\s*\(\s*uuid\s*\)/i);
    expect(sql).toMatch(/revoke\s+execute\s+on\s+function\s+public\.increment_organizer_cancellations\s*\(\s*uuid\s*\)/i);
    expect(sql).toMatch(/drop\s+policy\s+if\s+exists\s+"Users:\s+read\s+all"/i);
    expect(sql).toMatch(/create\s+policy\s+"Users:\s+read\s+authenticated"/i);
    expect(sql).toMatch(/match_reviews\.attended\s*=\s*true/i);
    expect(sql).toMatch(/storage\.foldername\s*\(\s*name\s*\)\s*\)\s*\[1\]\s*=\s*\(select\s+auth\.uid\(\)\)::text/i);
    expect(sql).toMatch(/update\s+storage\.buckets[\s\S]*file_size_limit\s*=\s*2097152/i);
    expect(sql).toMatch(/allowed_mime_types\s*=\s*array\['image\/jpeg','image\/png','image\/webp'\]/i);
  });

  it('versions the production Edge Functions with explicit auth posture', () => {
    expect(exists('supabase/functions/cancel-match/index.ts')).toBe(true);
    expect(exists('supabase/functions/cancel-participation/index.ts')).toBe(true);
    expect(exists('supabase/functions/waitlist/index.ts')).toBe(true);
    expect(exists('supabase/functions/signup-brevo/index.ts')).toBe(true);
    expect(exists('supabase/functions/delete-brevo-contact/index.ts')).toBe(true);
    expect(exists('supabase/functions/auto-confirm-attendance/index.ts')).toBe(true);
    expect(exists('supabase/functions/README.md')).toBe(true);

    const cancelMatch = read('supabase/functions/cancel-match/index.ts');
    const autoConfirm = read('supabase/functions/auto-confirm-attendance/index.ts');
    const waitlist = read('supabase/functions/waitlist/index.ts');
    const signupBrevo = read('supabase/functions/signup-brevo/index.ts');
    const deleteBrevoContact = read('supabase/functions/delete-brevo-contact/index.ts');

    expect(cancelMatch).toMatch(/createUserClient/);
    expect(cancelMatch).toMatch(/createServiceClient/);
    expect(autoConfirm).toMatch(/X-Cron-Secret/i);
    expect(waitlist).toMatch(/HCAPTCHA_SECRET/i);
    expect(signupBrevo).toMatch(/auth\.admin\.getUserById/);
    expect(signupBrevo).toMatch(/BREVO_API_KEY/);
    expect(deleteBrevoContact).toMatch(/requireUser/);
    expect(deleteBrevoContact).toMatch(/BREVO_API_KEY/);
  });

  it('removes dangerous client-side auth and telemetry defaults', () => {
    const appJson = read('app.json');
    const layout = read('app/_layout.tsx');
    const register = read('app/(auth)/register.tsx');
    const reset = read('app/(auth)/reset-password.tsx');

    expect(appJson).not.toMatch(/tempapp/);
    expect(layout).toMatch(/sendDefaultPii:\s*false/);
    expect(layout).toMatch(/beforeSend/);
    expect(layout).not.toMatch(/setSession\s*\(\s*\{/);
    expect(register).toMatch(/ConfirmHcaptcha/);
    expect(register).toMatch(/MIN_PASSWORD_LENGTH\s*=\s*12/);
    expect(reset).toMatch(/MIN_PASSWORD_LENGTH\s*=\s*12/);
  });
});
