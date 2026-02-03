import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use environment variables with fallbacks to prevent crashes in production builds
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://hmtfxpihkoisncglllmq.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtdGZ4cGloa29pc25jZ2xsbG1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0Nzg1MjAsImV4cCI6MjA2NzA1NDUyMH0.BN3SSwAQUX2o4dHVilCzsdKFfOdcXjznz6LPnW_ECIY';

// Log warning if using fallback values (for debugging)
if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
  console.warn('⚠️ Using fallback Supabase URL - environment variable not found');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
