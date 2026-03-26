import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Zap, Users, Briefcase, Hash } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GoogleIcon } from '@/components/ui/GoogleIcon';
import { useAuthStore } from '@/stores/authStore';

type RegistrationRole = 'gerente' | 'vendedor';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, loginWithGoogle, joinTeam, loading } = useAuthStore();

  const [role, setRole] = useState<RegistrationRole | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [joiningLoading, setJoiningLoading] = useState(false);

  const handleGoogleRegister = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch {
      setError('Error al registrarse con Google.');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!role) {
      setError('Selecciona tu tipo de cuenta.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (role === 'vendedor') {
      if (!teamCode.trim()) {
        setError('Ingresa el código de equipo que te compartió tu gerente.');
        return;
      }
      // Register and join team in one flow
      setJoiningLoading(true);
      try {
        await register(email, password, fullName, 'vendedor');
        await joinTeam(teamCode.trim().toUpperCase());
        navigate('/dashboard');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('Ya existe')) {
          setError(msg);
        } else if (msg.includes('invitación') || msg.includes('invite') || msg.includes('Código')) {
          setError('Código de equipo inválido. Verifica con tu gerente.');
        } else {
          setError('Error al crear la cuenta. Inténtalo de nuevo.');
        }
      } finally {
        setJoiningLoading(false);
      }
    } else {
      try {
        await register(email, password, fullName, 'gerente');
        navigate('/onboarding');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        setError(msg.includes('Ya existe') ? msg : 'Error al crear la cuenta. Inténtalo de nuevo.');
      }
    }
  };

  const isLoading = loading || joiningLoading;

  return (
    <div className="flex min-h-screen">
      {/* Brand Side */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary-600 to-primary-800"
      >
        <div className="absolute inset-0">
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/5" />
          <div className="absolute bottom-20 -left-16 h-72 w-72 rounded-full bg-white/5" />
          <div className="absolute top-1/3 right-1/4 h-48 w-48 rotate-12 rounded-3xl bg-white/5" />
          <div className="absolute top-2/3 right-16 h-32 w-32 rounded-full bg-accent-500/20" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center w-full px-12 text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-5xl font-bold tracking-tight">Orkesta</h1>
            </div>
            <p className="text-xl text-primary-100 font-medium mb-2">
              Tu asistente de ventas inteligente
            </p>
            <p className="text-primary-200 max-w-sm mx-auto leading-relaxed">
              Comienza hoy y transforma la manera en que gestionas tu negocio.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="mt-16 space-y-4 w-full max-w-xs"
          >
            {[
              'Configura tu equipo en minutos',
              'Conecta tus canales de venta',
              'Deja que la IA te ayude a vender más',
            ].map((text, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-sm px-4 py-3"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-500 text-xs font-bold text-white">
                  {i + 1}
                </div>
                <p className="text-sm text-primary-100">{text}</p>
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
        className="flex w-full lg:w-1/2 items-center justify-center bg-surface-50 px-6 py-12 overflow-y-auto"
      >
        <div className="w-full max-w-md space-y-6">
          {/* Mobile brand header */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-3xl font-bold text-surface-900">Orkesta</span>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-surface-900">Crear tu cuenta</h2>
            <p className="mt-1 text-sm text-surface-500">
              Regístrate para empezar a gestionar tu negocio
            </p>
          </div>

          {/* Role selector */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-surface-700">Tipo de cuenta</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('gerente')}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200 ${
                  role === 'gerente'
                    ? 'border-primary-500 bg-primary-50 shadow-sm shadow-primary-500/15'
                    : 'border-surface-200 bg-white hover:border-surface-300'
                }`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${role === 'gerente' ? 'bg-primary-500 text-white' : 'bg-surface-100 text-surface-500'}`}>
                  <Briefcase className="h-5 w-5" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-surface-900">Gerente</p>
                  <p className="text-xs text-surface-400 mt-0.5">Crea tu equipo</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole('vendedor')}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200 ${
                  role === 'vendedor'
                    ? 'border-primary-500 bg-primary-50 shadow-sm shadow-primary-500/15'
                    : 'border-surface-200 bg-white hover:border-surface-300'
                }`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${role === 'vendedor' ? 'bg-primary-500 text-white' : 'bg-surface-100 text-surface-500'}`}>
                  <Users className="h-5 w-5" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-surface-900">Agente de Ventas</p>
                  <p className="text-xs text-surface-400 mt-0.5">Únete a un equipo</p>
                </div>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nombre completo"
              type="text"
              icon={User}
              placeholder="Juan Pérez"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
            />

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
              autoComplete="new-password"
            />

            <Input
              label="Confirmar contraseña"
              type="password"
              icon={Lock}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />

            {/* Team code field — only for agents */}
            <AnimatePresence>
              {role === 'vendedor' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl bg-primary-50 border border-primary-100 p-3 mb-2">
                    <p className="text-xs text-primary-700">
                      Pide a tu gerente el código de equipo para unirte.
                    </p>
                  </div>
                  <Input
                    label="Código de equipo"
                    type="text"
                    icon={Hash}
                    placeholder="Ej: ABC12345"
                    value={teamCode}
                    onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                    required={role === 'vendedor'}
                  />
                </motion.div>
              )}
            </AnimatePresence>

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
              loading={isLoading}
              size="lg"
              className="w-full"
              disabled={!role}
            >
              {role === 'vendedor' ? 'Unirme al equipo' : 'Crear cuenta'}
            </Button>
          </form>

          {role !== 'vendedor' && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-surface-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-surface-50 px-3 text-surface-400">o regístrate con</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleRegister}
                disabled={googleLoading}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm font-medium text-surface-700 shadow-sm transition-all hover:bg-surface-50 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <GoogleIcon />
                {googleLoading ? 'Conectando...' : 'Registrarse con Google'}
              </button>
            </>
          )}

          <p className="text-center text-sm text-surface-500">
            ¿Ya tienes cuenta?{' '}
            <Link
              to="/login"
              className="font-medium text-primary-500 hover:text-primary-600 transition-colors"
            >
              Iniciar sesión
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
