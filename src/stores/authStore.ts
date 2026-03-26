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

interface PendingRegistration {
  email: string;
  password: string;
  fullName: string;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  team: Team | null;
  loading: boolean;
  /** True when fetchProfile hit a server error (e.g. RLS 500) vs "no rows found". */
  profileFetchFailed: boolean;
  /** Credentials stored during registration, consumed atomically at end of onboarding. */
  pendingRegistration: PendingRegistration | null;
  initialize: () => void;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  /**
   * Stores credentials temporarily without creating a Supabase auth user.
   * The auth user, profile, and team are created together at the end of onboarding.
   * For vendedor role, the auth user is created immediately so joinTeam can be called right after.
   */
  register: (email: string, password: string, fullName: string, role?: 'gerente' | 'vendedor') => Promise<void>;
  clearPendingRegistration: () => void;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  fetchTeam: () => Promise<void>;
  joinTeam: (inviteCode: string) => Promise<void>;
}

// If Supabase is not configured, pre-populate the store with mock data so
// the app never renders in a loading state waiting for async initialization.
const initialState = isSupabaseConfigured
  ? { user: null as User | null, profile: null as Profile | null, team: null as Team | null, loading: true, profileFetchFailed: false, pendingRegistration: null as PendingRegistration | null }
  : { user: { id: mockProfile.id, email: mockProfile.email } as User, profile: mockProfile, team: mockTeam, loading: false, profileFetchFailed: false, pendingRegistration: null as PendingRegistration | null };

export const useAuthStore = create<AuthState>((set, get) => ({
  ...initialState,

  initialize: () => {
    if (!isSupabaseConfigured) return;

    // Prevent double-initialization (e.g. React StrictMode or hot-reload).
    if ((useAuthStore as unknown as { _initialized?: boolean })._initialized) return;
    (useAuthStore as unknown as { _initialized?: boolean })._initialized = true;

    // Safety net: force exit loading after 8 seconds to avoid infinite loading screen.
    const safetyTimeout = setTimeout(() => {
      if (get().loading) {
        console.warn('Auth initialization timed out — redirecting to login');
        set({ user: null, profile: null, team: null, loading: false, profileFetchFailed: false });
      }
    }, 8000);

    supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (session?.user) {
          set({ user: session.user });
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
            // Wrap fetches in a race against a per-operation timeout so a
            // hanging request doesn't block the app forever.
            const withTimeout = <T>(p: Promise<T>, ms = 5000): Promise<T> =>
              Promise.race([
                p,
                new Promise<T>((_, reject) =>
                  setTimeout(() => reject(new Error('Fetch timed out')), ms)
                ),
              ]);

            try {
              await withTimeout(get().fetchProfile());
              await withTimeout(get().fetchTeam());
            } catch (fetchErr) {
              console.warn('Profile/team fetch timed out or failed:', fetchErr);
              // Mark as fetch failure so ProtectedRoute doesn't wrongly
              // redirect to onboarding when the real problem is a server error.
              set({ profileFetchFailed: true });
            }
          }
        } else {
          set({ user: null, profile: null, team: null, profileFetchFailed: false });
        }
      } catch (err) {
        console.error('Auth state change error:', err);
        set({ user: null, profile: null, team: null, profileFetchFailed: false });
      } finally {
        clearTimeout(safetyTimeout);
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
      // Build the callback URL so the browser returns to /auth/callback
      // after completing the OAuth flow with Google.
      const basePath = (import.meta.env.VITE_BASE_PATH ?? '/saas_software/').replace(/\/$/, '');
      const callbackUrl = `${window.location.origin}${basePath}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
        },
      });
      if (error) throw error;
    } catch {
      set({ loading: false });
      throw new Error('Error al iniciar sesión con Google');
    }
  },

  login: async (email: string, password: string) => {
    set({ loading: true, profileFetchFailed: false });
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

  register: async (email: string, password: string, fullName: string, role: 'gerente' | 'vendedor' = 'gerente') => {
    if (!isSupabaseConfigured) {
      // Mock mode: pre-populate store so the rest of the app works as usual.
      set({
        user: { id: mockProfile.id, email } as User,
        profile: { ...mockProfile, email, full_name: fullName, role, team_id: undefined },
        team: null,
      });
      return;
    }

    // Pre-flight check: try to detect if the email is already registered.
    // Uses the check_email_exists RPC if available; silently skips if not deployed.
    try {
      const { data: exists } = await supabase.rpc('check_email_exists', { p_email: email });
      if (exists) {
        throw new Error('Ya existe una cuenta con este correo electrónico. Inicia sesión.');
      }
    } catch (rpcErr: unknown) {
      // If the error is our own "Ya existe" message, re-throw it.
      if (rpcErr instanceof Error && rpcErr.message.includes('Ya existe')) throw rpcErr;
      // Otherwise the RPC is not deployed yet — fall through and let signUp catch duplicates.
    }

    if (role === 'vendedor') {
      // For agents, create the auth user immediately so joinTeam can follow right after.
      // Pass the role in user metadata so the DB trigger creates the profile with the correct role.
      let authUser: User | null = null;

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, role: 'vendedor' } },
      });

      if (signUpError) {
        // A 500 from Supabase often means the user was created in auth.users but
        // a post-signup step failed (e.g. email sending, trigger error).
        // Try signing in — if it works, the user was actually created.
        if (signUpError.status === 500 || signUpError.message?.includes('500')) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (signInError || !signInData.user) {
            throw new Error('Error del servidor al crear la cuenta. Verifica la configuración de email en Supabase (Authentication → Email → desactiva "Confirm email") e inténtalo de nuevo.');
          }
          authUser = signInData.user;
        } else if (signUpError.message?.toLowerCase().includes('already registered') ||
            signUpError.message?.toLowerCase().includes('already exists')) {
          throw new Error('Ya existe una cuenta con este correo electrónico. Inicia sesión.');
        } else {
          throw signUpError;
        }
      } else {
        if (!data.user) throw new Error('No se pudo crear el usuario');
        // Supabase with email confirmation enabled returns a fake user with empty identities
        // when the email is already taken (to prevent enumeration).
        if (data.user.identities && data.user.identities.length === 0) {
          throw new Error('Ya existe una cuenta con este correo electrónico. Inicia sesión.');
        }
        authUser = data.user;
      }

      // The DB trigger handle_new_user() should have created the profile row.
      // Wait briefly, then verify it exists. If the trigger didn't fire, create
      // the profile manually as a fallback.
      await new Promise((r) => setTimeout(r, 500));

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', authUser.id)
        .maybeSingle();

      if (existingProfile) {
        // Profile exists — ensure role is 'vendedor' (old triggers may have defaulted to 'gerente').
        if (existingProfile.role !== 'vendedor') {
          await supabase.from('profiles').update({ role: 'vendedor' }).eq('id', authUser.id);
        }
      } else {
        // Trigger didn't create the profile — insert it manually.
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({ id: authUser.id, email, full_name: fullName, role: 'vendedor' });
        if (insertError) {
          console.warn('Could not create vendedor profile:', insertError.message);
        }
      }

      set({ user: authUser, profile: { id: authUser.id, email, full_name: fullName, role: 'vendedor', is_active: true, created_at: new Date().toISOString() } });
      return;
    }

    // Gerente: defer Supabase auth user creation until the end of onboarding.
    // This prevents orphaned auth users when onboarding is abandoned or fails.
    set({ pendingRegistration: { email, password, fullName } });
  },

  clearPendingRegistration: () => set({ pendingRegistration: null }),

  logout: async () => {
    // Clear auth state immediately so the UI redirects to /login without delay.
    // Never set loading: true here — that would show the fullscreen spinner and
    // could block navigation if signOut is slow or throws.
    set({ user: null, profile: null, team: null, pendingRegistration: null, profileFetchFailed: false });
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch {
      // State is already cleared — nothing left to do.
      console.warn('signOut error, state already cleared');
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
        if (error.code === 'PGRST116') {
          console.warn('fetchProfile: no profile row found');
          set({ profile: null, profileFetchFailed: false });
          return;
        }
        // Any other error (500, RLS recursion, etc.) is a server failure.
        console.error('fetchProfile server error:', error.message);
        set({ profile: null, profileFetchFailed: true });
        return;
      }

      set({ profile: data as Profile, profileFetchFailed: false });
    } catch (err) {
      console.error('fetchProfile unexpected error:', err);
      set({ profile: null, profileFetchFailed: true });
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
      if (!isSupabaseConfigured) {
        // Mock mode: simulate joining
        set({ team: { ...mockTeam, invite_code: inviteCode }, profile: { ...mockProfile, team_id: mockTeam.id }, loading: false });
        return;
      }

      // Use an RPC with SECURITY DEFINER so users without a team_id
      // can look up a team by invite code (the regular RLS policy only
      // allows seeing teams you are already a member of).
      const { data: teamRows, error: teamError } = await supabase
        .rpc('get_team_by_invite_code', { p_invite_code: inviteCode });
      const team = Array.isArray(teamRows) ? teamRows[0] : teamRows;
      if (teamError || !team) throw new Error('Código de invitación inválido');

      const { user } = get();
      if (!user) throw new Error('Usuario no autenticado');

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
