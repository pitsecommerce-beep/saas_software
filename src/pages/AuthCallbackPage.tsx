import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { fetchProfile, fetchTeam } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        navigate('/login', { replace: true });
        return;
      }

      // Check if user already has a profile with a team
      const { data: profile } = await supabase
        .from('profiles')
        .select('team_id')
        .eq('id', session.user.id)
        .single();

      await fetchProfile();
      await fetchTeam();

      if (profile?.team_id) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    };

    handleCallback();
  }, [navigate, fetchProfile, fetchTeam]);

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
