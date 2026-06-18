import * as AppleAuthentication from 'expo-apple-authentication';
import { z } from 'zod';

import { syncSignupWithBrevo } from '@/lib/auth/syncSignupWithBrevo';
import { supabase } from '@/lib/supabase';

const AppleFullNameSchema = z.object({
  givenName: z.string().nullable().optional(),
  familyName: z.string().nullable().optional(),
});

const AppleCredentialSchema = z.object({
  identityToken: z.string().min(1),
  user: z.string().min(1),
  email: z.string().email().nullable().optional(),
  fullName: AppleFullNameSchema.nullable().optional(),
});

export async function signInWithApple(
  credential: AppleAuthentication.AppleAuthenticationCredential,
) {
  try {
    const parsedCredential = AppleCredentialSchema.parse(credential);

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: parsedCredential.identityToken,
    });

    if (error) throw error;

    const fullName = [
      parsedCredential.fullName?.givenName,
      parsedCredential.fullName?.familyName,
    ].filter(Boolean).join(' ');

    if (data.user && fullName) {
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      });

      if (metadataError) throw metadataError;

      const { error: updateError } = await supabase
        .from('users')
        .update({ full_name: fullName })
        .eq('id', data.user.id);

      if (updateError) throw updateError;
    }

    await syncSignupWithBrevo(data.user);

    return data;
  } catch (error) {
    throw error;
  }
}
