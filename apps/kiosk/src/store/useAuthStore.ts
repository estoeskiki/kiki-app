import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

interface AuthState {
  deviceToken: string | null;
  restaurantId: string | null;
  orgId: string | null;
  deviceName: string | null;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  authenticate: (token: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const STORAGE_KEY = '@kiki_kiosk_device_token';

export const useAuthStore = create<AuthState>((set) => ({
  deviceToken: null,
  restaurantId: null,
  orgId: null,
  deviceName: null,
  isLoading: true,
  error: null,

  initialize: async () => {
    try {
      set({ isLoading: true });
      const storedToken = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedToken) {
        await useAuthStore.getState().authenticate(storedToken);
      }
    } catch (e) {
      console.error('Failed to load device token', e);
    } finally {
      set({ isLoading: false });
    }
  },

  authenticate: async (token: string) => {
    try {
      set({ isLoading: true, error: null });
      
      // 1. Authenticate anonymously BEFORE validating the token.
      // This gives the app a secure 'auth.uid()' that Postgres can use!
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      
      if (authError || !authData.user) {
        console.error('Anonymous Auth Failed:', authError);
        set({ error: authError?.message || 'Failed to initialize session' });
        return false;
      }

      // 2. Call the postgres function to validate token AND link the new anon user to the branch
      const { data, error } = await supabase.rpc('authenticate_device', {
        p_token_hash: token 
      });

      if (error) {
        console.error('RPC Error details:', error);
      }

      if (error || !data || data.length === 0) {
        console.error('Token validation failed. Data:', data);
        set({ error: 'Invalid or inactive device token.' });
        await supabase.auth.signOut(); // Clean up if validation failed
        return false;
      }

      const deviceData = data[0];

      // Store in Async Storage
      await AsyncStorage.setItem(STORAGE_KEY, token);

      set({
        deviceToken: token,
        restaurantId: deviceData.ret_restaurant_id,
        orgId: deviceData.ret_org_id,
        deviceName: deviceData.ret_device_name,
      });

      return true;
    } catch (e: any) {
      set({ error: e.message || 'Authentication failed' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({
      deviceToken: null,
      restaurantId: null,
      orgId: null,
      deviceName: null,
    });
  },
}));
