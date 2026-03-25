import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import type { Profile, Team } from '@/types';
import { supabase } from '@/lib/supabase';

const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
  !import.meta.env.VITE_SUPABASE_URL.includes('placeholder') &&
  !import.meta.env.VITE_SUPABASE_URL.includes('your-project') &&
  import.meta.env.VITE_SUPABASE_ANON_KEY &&
  !import.meta.env.VITE_SUPABASE_ANON_KEY.includes('placeholder') &&
  !import.meta.env.VITE_SUPABASE_ANON_KEY.includes('your-anon-key')
);

const mockProfile: Profile = {
  id: 'mock-user-1',
  email: 'demo@example.com',
  full_name: 'Demo User',
  role: 'gerente',
  team_id: 'mock-team-1',
  is_active: true,
  created_at: new Date().toISOString(),
};

const mockTeam: Team = {
  id: 'mock-team-1',
  name: 'Demo Team',
  invite_code: 'DEMO123',
  business_type: 'retailer',
  active_modules: ['conversations', 'customers', 'ai-agents'],
  created_at: new Date().toISOString(),
  owner_id: 'mock-user-1',
};

interface AuthState {
  user: User | null;
  profile: Profile | null;
  team: Team | null;
  loading: boolean;
  initialize: () => void;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  fetchTeam: () => Promise<void>;
  joinTeam: (inviteCode: string) => Promise<void>;
}

// If Supabase is not configured, pre-populate the store with mock data so
// the app never renders in a loading state waiting for async initialization.
const initialState = isSupabaseConfigured
  ? { user: null as User | null, profile: null as Profile | null, team: null as Team | null, loading: true }
  : { user: { id: mockProfile.id, email: mockProfile.email } as User, profile: mockProfile, team: mockTeam, loading: false };

export const useAuthStore = create<AuthState>((set, get) => ({
  ...initialState,

  initialize: () => {
    if (!isSupabaseConfigured) return;

    // Safety net: if onAuthStateChange never fires or fetchProfile hangs,
    // force exit loading after 10 seconds to avoid infinite loading screen.
    const safetyTimeout = setTimeout(() => {
      if (get().loading) {
        console.warn('Auth initialization timed out — redirecting to login');
        set({ user: null, profile: null, team: null, loading: false });
      }
    }, 10000);

    // In Supabase v2, onAuthStateChange fires immediately with INITIAL_SESSION
    // when there is a stored session, replacing the need for a separate getSession() call.
    supabase.auth.onAuthStateChange(async (_event, session) => {
      // First event received — clear the safety timeout.
      clearTimeout(safetyTimeout);

      try {
        if (session?.user) {
          set({ user: session.user });
          await get().fetchProfile();
          await get().fetchTeam();
        } else {
          set({ user: null, profile: null, team: null });
        }
      } catch (err) {
        console.error('Auth state change error:', err);
        set({ user: null, profile: null, team: null });
      } finally {
        // Always exit the loading state, no matter what happened above.
        set({ loading: false });
      }
    });
  },

  loginWithGoogle: async () => {
    if (!isSupabaseConfigured) {
      throw new Error('Google OAuth requiere Supabase configurado');
    }
    set({ loading: true });
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
        },
      });
      if (error) throw error;
    } catch {
      set({ loading: false });
      throw new Error('Error al iniciar sesión con Google');
    }
  },

  login: async (email: string, password: string) => {
    set({ loading: true });
    if (!isSupabaseConfigured) {
      set({
        user: { id: mockProfile.id, email } as User,
        profile: { ...mockProfile, email },
        team: mockTeam,
        loading: false,
      });
      return;
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // loading: false will be set by onAuthStateChange (SIGNED_IN event)
    } catch {
      set({ loading: false });
      throw new Error('Credenciales incorrectas');
    }
  },

  register: async (email: string, password: string, fullName: string) => {
    set({ loading: true });
    if (!isSupabaseConfigured) {
      set({
        user: { id: mockProfile.id, email } as User,
        profile: { ...mockProfile, email, full_name: fullName, team_id: undefined },
        team: null,
        loading: false,
      });
      return;
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;

      // Auto-create the profile row immediately after sign-up so the app
      // never ends up with an authenticated user but no profile in the DB.
      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          email: email,
          full_name: fullName,
          role: 'gerente',
          is_active: true,
        });
        if (profileError && profileError.code !== '23505') {
          // 23505 = unique_violation (profile already exists), safe to ignore
          console.warn('Could not create profile row:', profileError.message);
        }
      }
      // loading: false will be set by onAuthStateChange (SIGNED_IN event)
    } catch {
      set({ loading: false });
      throw new Error('Error al crear la cuenta');
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
    } catch {
      console.warn('signOut error, clearing state anyway');
    } finally {
      set({ user: null, profile: null, team: null, loading: false });
    }
  },

  fetchProfile: async () => {
    const { user } = get();
    if (!user) return;

    if (!isSupabaseConfigured) {
      set({ profile: mockProfile });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        // PGRST116 = no rows found — user has no profile yet (no DB trigger).
        // Any other error is also treated as "no profile" so the user reaches onboarding.
        console.warn('fetchProfile:', error.message);
        set({ profile: null });
        return;
      }

      set({ profile: data as Profile });
    } catch (err) {
      console.error('fetchProfile unexpected error:', err);
      set({ profile: null });
    }
  },

  fetchTeam: async () => {
    const { profile } = get();
    if (!profile?.team_id) return;

    if (!isSupabaseConfigured) {
      set({ team: mockTeam });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', profile.team_id)
        .single();

      if (error) {
        console.warn('fetchTeam:', error.message);
        set({ team: null });
        return;
      }

      set({ team: data as Team });
    } catch (err) {
      console.error('fetchTeam unexpected error:', err);
      set({ team: null });
    }
  },

  joinTeam: async (inviteCode: string) => {
    set({ loading: true });
    try {
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('invite_code', inviteCode)
        .single();
      if (teamError) throw teamError;

      const { user } = get();
      if (!user) throw new Error('User not authenticated');

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ team_id: (team as Team).id })
        .eq('id', user.id);
      if (updateError) throw updateError;

      set({ team: team as Team });
      await get().fetchProfile();
    } catch (err) {
      console.error('joinTeam error:', err);
      throw new Error('Código de invitación inválido');
    } finally {
      set({ loading: false });
    }
  },
}));
