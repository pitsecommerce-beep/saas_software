import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GoogleIcon } from '@/components/ui/GoogleIcon';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const { login, loginWithGoogle, loading, profileFetchFailed, logout } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(() =>
    profileFetchFailed
      ? 'Hubo un error al cargar tu perfil. Por favor, intenta iniciar sesión de nuevo.'
      : ''
  );
  const [googleLoading, setGoogleLoading] = useState(false);

  // If we arrived here due to a profile fetch failure, clear the broken session
  // so the user can start fresh.
  useEffect(() => {
    if (profileFetchFailed) {
      logout();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch {
      setError('Error al iniciar sesión con Google.');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      // Don't navigate here — onAuthStateChange will fetch profile/team,
      // then PublicRoute will auto-redirect to /dashboard once ready.
    } catch {
      setError('Credenciales incorrectas. Inténtalo de nuevo.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="flex min-h-screen"
    >
      {/* Brand / Illustration Side */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary-600 to-primary-800"
      >
        {/* Decorative shapes */}
        <div className="absolute inset-0">
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/5" />
          <div className="absolute bottom-16 -right-20 h-72 w-72 rounded-full bg-white/5" />
          <div className="absolute top-1/2 left-1/3 h-48 w-48 rotate-45 rounded-3xl bg-white/5" />
          <div className="absolute bottom-1/3 left-16 h-32 w-32 rounded-full bg-accent-500/20" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center w-full px-12 text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-center"
          >
            <div className="mb-6">
              <img src="/logo.png" alt="Logo" className="h-16 w-auto object-contain" />
            </div>
            <p className="text-xl text-primary-100 font-medium mb-2">
              Tu asistente de ventas inteligente
            </p>
            <p className="text-primary-200 max-w-sm mx-auto leading-relaxed">
              Gestiona conversaciones, clientes y pedidos desde una sola plataforma impulsada por IA.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="mt-16 grid grid-cols-3 gap-6 text-center"
          >
            {[
              { value: 'WhatsApp', label: 'Integración' },
              { value: 'IA', label: 'Automatización' },
              { value: '24/7', label: 'Disponibilidad' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-white/10 backdrop-blur-sm px-4 py-3">
                <p className="text-lg font-semibold">{item.value}</p>
                <p className="text-xs text-primary-200">{item.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Form Side */}
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex w-full lg:w-1/2 items-center justify-center bg-surface-50 px-6 py-12"
      >
        <div className="w-full max-w-md space-y-8">
          {/* Mobile brand header */}
          <div className="lg:hidden text-center mb-8">
            <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain mx-auto" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-surface-900">Bienvenido de vuelta</h2>
            <p className="mt-1 text-sm text-surface-500">
              Ingresa tus credenciales para acceder a tu cuenta
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Correo electrónico"
              type="email"
              icon={Mail}
              placeholder="tu@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <Input
              label="Contraseña"
              type="password"
              icon={Lock}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-danger-500 bg-danger-50 rounded-lg px-3 py-2"
              >
                {error}
              </motion.p>
            )}

            <Button
              type="submit"
              loading={loading}
              size="lg"
              className="w-full"
            >
              Iniciar Sesión
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-surface-50 px-3 text-surface-400">o continúa con</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm font-medium text-surface-700 shadow-sm transition-all hover:bg-surface-50 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <GoogleIcon />
            {googleLoading ? 'Conectando...' : 'Continuar con Google'}
          </button>

          <p className="text-center text-sm text-surface-500">
            ¿No tienes cuenta?{' '}
            <Link
              to="/register"
              className="font-medium text-primary-500 hover:text-primary-600 transition-colors"
            >
              Crear cuenta
            </Link>
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
