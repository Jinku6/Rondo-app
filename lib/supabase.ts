import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const isWeb = Platform.OS === 'web';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Usa localStorage nativo en Web, y AsyncStorage en móvil
    storage: isWeb ? (typeof window !== 'undefined' ? window.localStorage : null) : AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
