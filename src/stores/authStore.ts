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

// TODO: Remove mock data when Supabase is configured
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
    if (!isSupabaseConfigured) return; // Already initialized with mock data at store creation

    // Check current session immediately
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        set({ user: session.user });
        await get().fetchProfile();
        await get().fetchTeam();
      } else {
        set({ user: null, profile: null, team: null });
      }
      set({ loading: false });
    }).catch(() => {
      console.warn('Supabase getSession failed, using mock data');
      set({
        user: { id: mockProfile.id, email: mockProfile.email } as User,
        profile: mockProfile,
        team: mockTeam,
        loading: false,
      });
    });

    // Listen for future auth changes (login, logout, token refresh)
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        set({ user: session.user });
        await get().fetchProfile();
        await get().fetchTeam();
      } else {
        set({ user: null, profile: null, team: null });
      }
      set({ loading: false });
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
      console.warn('Google OAuth failed');
      throw new Error('Error al iniciar sesión con Google');
    } finally {
      set({ loading: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ loading: true });
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured, using mock login');
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
    } catch {
      throw new Error('Credenciales incorrectas');
    } finally {
      set({ loading: false });
    }
  },

  register: async (email: string, password: string, fullName: string) => {
    set({ loading: true });
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured, using mock register');
      set({
        user: { id: mockProfile.id, email } as User,
        profile: { ...mockProfile, email, full_name: fullName },
        team: null,
        loading: false,
      });
      return;
    }
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;
    } catch {
      throw new Error('Error al crear la cuenta');
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch {
      // TODO: Remove mock data when Supabase is configured
      console.warn('Supabase not configured, using mock logout');
    } finally {
      set({ user: null, profile: null, team: null, loading: false });
    }
  },

  fetchProfile: async () => {
    const { user } = get();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      set({ profile: data as Profile });
    } catch {
      // TODO: Remove mock data when Supabase is configured
      console.warn('Supabase not configured, using mock profile');
      set({ profile: mockProfile });
    }
  },

  fetchTeam: async () => {
    const { profile } = get();
    if (!profile?.team_id) return;

    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', profile.team_id)
        .single();
      if (error) throw error;
      set({ team: data as Team });
    } catch {
      // TODO: Remove mock data when Supabase is configured
      console.warn('Supabase not configured, using mock team');
      set({ team: mockTeam });
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
    } catch {
      // TODO: Remove mock data when Supabase is configured
      console.warn('Supabase not configured, using mock joinTeam');
      set({ team: mockTeam, profile: { ...mockProfile, team_id: mockTeam.id } });
    } finally {
      set({ loading: false });
    }
  },
}));
