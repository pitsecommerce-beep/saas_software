import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

import { isSupabaseConfigured } from '@/lib/config';
if (!isSupabaseConfigured) {
  console.warn('[Orkesta] Supabase no configurado — ejecutando en modo offline/demo');
}
