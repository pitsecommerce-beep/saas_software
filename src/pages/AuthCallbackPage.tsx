import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    // Guard against double-firing (React StrictMode / fast-refresh)
    if (handled.current) return;
    handled.current = true;

    const handleCallback = async () => {
      try {
        // Supabase exchanges the OAuth code in the URL hash for a session
        // automatically. getSession() returns the resulting session.
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          console.warn('AuthCallback: no session found, redirecting to login');
          navigate('/login', { replace: true });
          return;
        }

        // Populate the auth store with the user from the session.
        const store = useAuthStore.getState();
        useAuthStore.setState({ user: session.user, profileFetchFailed: false });

        // Fetch profile — the DB trigger handle_new_user() may have already
        // created it. Retry once after a short delay if it fails (trigger
        // may not have completed yet).
        await store.fetchProfile();
        let profile = useAuthStore.getState().profile;

        if (!profile && !useAuthStore.getState().profileFetchFailed) {
          // Profile doesn't exist yet — the trigger may be delayed.
          // Wait 1s and retry.
          await new Promise((r) => setTimeout(r, 1000));
          await store.fetchProfile();
          profile = useAuthStore.getState().profile;
        }

        // If profile fetch failed due to server error, go to login
        // so the user can retry instead of being stuck in onboarding.
        if (useAuthStore.getState().profileFetchFailed) {
          console.warn('AuthCallback: profile fetch failed (server error), redirecting to login');
          navigate('/login', { replace: true });
          return;
        }

        if (profile?.team_id) {
          // Profile exists and has a team — fetch team data and go to dashboard.
          await store.fetchTeam();
          navigate('/dashboard', { replace: true });
        } else {
          // Profile exists but no team (or no profile at all) — onboarding.
          navigate('/onboarding', { replace: true });
        }
      } catch (err) {
        console.error('AuthCallback error:', err);
        navigate('/login', { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-500">
          <Zap className="h-8 w-8 text-white" />
        </div>
        <div className="w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-surface-500 text-sm">Autenticando...</p>
      </motion.div>
    </div>
  );
}
