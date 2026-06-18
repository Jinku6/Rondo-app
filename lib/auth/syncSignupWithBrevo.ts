import { User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return fallback;
  }
};

export async function syncSignupWithBrevo(user?: Pick<User, 'id' | 'email'> | null) {
  const email = user?.email?.trim().toLowerCase();
  if (!user?.id || !email) return;

  try {
    const { error } = await supabase.functions.invoke('signup-brevo', {
      body: { userId: user.id, email },
    });

    if (error && __DEV__) {
      console.warn('signup brevo sync error:', error.message);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('signup brevo sync error:', getErrorMessage(error, 'No se pudo sincronizar con Brevo.'));
    }
  }
}
