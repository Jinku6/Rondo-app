import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('push webhook hardening migration', () => {
  const migrationPath = 'supabase/migrations/20260901074310_secure_push_webhook_secret.sql';

  it('loads the dedicated credential from Vault with a fixed search path', () => {
    const migration = read(migrationPath);

    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION private\.push_webhook_handler\(\)/i);
    expect(migration).toMatch(/SECURITY DEFINER[\s\S]*SET search_path TO pg_catalog/i);
    expect(migration).toMatch(/SELECT ds\.decrypted_secret[\s\S]*INTO v_secret/i);
    expect(migration).toMatch(/FROM vault\.decrypted_secrets ds/i);
    expect(migration).toMatch(/ds\.name = 'send_push_webhook_secret'/i);
    expect(migration).not.toMatch(/v_secret\s+text\s*:=/i);
  });

  it('fails closed for the webhook without blocking the triggering operation', () => {
    const migration = read(migrationPath);

    expect(migration).toMatch(/v_secret IS NULL OR length\(v_secret\) < 32/i);
    expect(migration).toMatch(/Vault lookup failed \(SQLSTATE %\)/i);
    expect(migration).toMatch(/Webhook dispatch failed for event % \(SQLSTATE %\)/i);
    expect(migration).toMatch(/PERFORM net\.http_post/i);
    expect(migration).toMatch(/'Authorization', 'Bearer ' \|\| v_secret/i);
    expect(migration).toMatch(/RETURN NULL/i);
  });

  it('keeps trigger wiring untouched and execution private', () => {
    const migration = read(migrationPath);

    expect(migration).not.toMatch(/(?:CREATE|DROP) TRIGGER/i);
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION private\.push_webhook_handler\(\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role/i,
    );
  });

  it('keeps the temporary next secret limited to Edge authentication', () => {
    const sendPush = read('supabase/functions/send-push/index.ts');

    expect(sendPush).toMatch(/matchesWebhookSecret/);
    expect(sendPush).toMatch(/SEND_PUSH_WEBHOOK_SECRET/);
    expect(sendPush).toMatch(/SEND_PUSH_WEBHOOK_SECRET_NEXT/);
    expect(sendPush).not.toMatch(/providedSecret === expectedSecret/);
  });
});
