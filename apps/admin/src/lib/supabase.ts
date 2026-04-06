import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Always .trim() to prevent hidden carriage returns (\r) inserted by some code editors
// from completely destroying the native Android HTTPS fetch stack
const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL as string)?.trim();
export const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string)?.trim();

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
