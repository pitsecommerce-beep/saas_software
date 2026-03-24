import { useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Briefcase,
  Building2,
  Upload,
  Check,
  Copy,
  ArrowRight,
  ArrowLeft,
  Zap,
  PartyPopper,
} from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { generateInviteCode } from '@/lib/utils';
import type { BusinessType } from '@/types';

const TOTAL_STEPS = 3;

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [inviteCode] = useState(() => generateInviteCode());
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  const handleCreateTeam = async () => {
    setLoading(true);
    try {
      await supabase.from('teams').insert({
        name: companyName,
        business_type: businessType,
        invite_code: inviteCode,
        owner_id: profile?.id,
        active_modules: ['conversations', 'customers', 'ai-agents'],
      });
    } catch {
      console.warn('Supabase not configured, proceeding with mock data');
    } finally {
      setLoading(false);
      goNext();
    }
  };

  const handleStep2Submit = (e: FormEvent) => {
    e.preventDefault();
    handleCreateTeam();
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFinish = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-surface-100">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-surface-900">Beep</span>
        </div>
        <p className="text-sm text-surface-400">
          Paso {step} de {TOTAL_STEPS}
        </p>
      </header>

      {/* Progress Bar */}
      <div className="h-1 bg-surface-100">
        <motion.div
          className="h-full bg-primary-500"
          initial={{ width: '0%' }}
          animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        />
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-center gap-3 pt-8 pb-4">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => {
          const stepNum = i + 1;
          const isCompleted = step > stepNum;
          const isCurrent = step === stepNum;

          return (
            <div key={stepNum} className="flex items-center gap-3">
              <motion.div
                animate={{
                  scale: isCurrent ? 1.1 : 1,
                  backgroundColor: isCompleted
                    ? '#22c55e'
                    : isCurrent
                      ? '#3b82f6'
                      : '#e2e8f0',
                }}
                transition={{ duration: 0.3 }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
              >
                {isCompleted ? (
                  <Check className="h-4 w-4 text-white" />
                ) : (
                  <span className={isCurrent ? 'text-white' : 'text-surface-400'}>
                    {stepNum}
                  </span>
                )}
              </motion.div>
              {i < TOTAL_STEPS - 1 && (
                <div
                  className={`h-px w-12 transition-colors duration-300 ${
                    step > stepNum ? 'bg-accent-500' : 'bg-surface-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="flex-1 flex items-start justify-center px-6 py-8">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait" custom={direction}>
            {step === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: 'easeInOut' }}
                className="space-y-8"
              >
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-surface-900">
                    ¿Qué tipo de negocio tienes?
                  </h2>
                  <p className="mt-2 text-surface-500">
                    Esto nos ayuda a configurar tu espacio de trabajo
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Retailer Card */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setBusinessType('retailer')}
                    className={`relative flex flex-col items-center gap-4 rounded-2xl border-2 p-8 transition-colors duration-200 ${
                      businessType === 'retailer'
                        ? 'border-primary-500 bg-primary-50 shadow-lg shadow-primary-500/10'
                        : 'border-surface-200 bg-white hover:border-surface-300'
                    }`}
                  >
                    {businessType === 'retailer' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary-500"
                      >
                        <Check className="h-3.5 w-3.5 text-white" />
                      </motion.div>
                    )}
                    <div
                      className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
                        businessType === 'retailer'
                          ? 'bg-primary-500 text-white'
                          : 'bg-surface-100 text-surface-500'
                      }`}
                    >
                      <ShoppingBag className="h-8 w-8" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-surface-900">
                        Venta de Productos
                      </p>
                      <p className="text-sm text-surface-400 mt-1">
                        Retailer
                      </p>
                      <p className="text-xs text-surface-400 mt-2">
                        Productos físicos, inventario, envíos
                      </p>
                    </div>
                  </motion.button>

                  {/* Services Card */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setBusinessType('servicios')}
                    className={`relative flex flex-col items-center gap-4 rounded-2xl border-2 p-8 transition-colors duration-200 ${
                      businessType === 'servicios'
                        ? 'border-primary-500 bg-primary-50 shadow-lg shadow-primary-500/10'
                        : 'border-surface-200 bg-white hover:border-surface-300'
                    }`}
                  >
                    {businessType === 'servicios' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary-500"
                      >
                        <Check className="h-3.5 w-3.5 text-white" />
                      </motion.div>
                    )}
                    <div
                      className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
                        businessType === 'servicios'
                          ? 'bg-primary-500 text-white'
                          : 'bg-surface-100 text-surface-500'
                      }`}
                    >
                      <Briefcase className="h-8 w-8" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-surface-900">
                        Proveedor de Servicios
                      </p>
                      <p className="text-sm text-surface-400 mt-1">
                        Servicios profesionales
                      </p>
                      <p className="text-xs text-surface-400 mt-2">
                        Citas, clases, membresías
                      </p>
                    </div>
                  </motion.button>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={goNext}
                    disabled={!businessType}
                    size="lg"
                    icon={<ArrowRight className="h-4 w-4" />}
                  >
                    Continuar
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: 'easeInOut' }}
                className="space-y-8"
              >
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-surface-900">
                    Nombre de tu empresa
                  </h2>
                  <p className="mt-2 text-surface-500">
                    Así aparecerá tu negocio en la plataforma
                  </p>
                </div>

                <form onSubmit={handleStep2Submit} className="space-y-6">
                  <Input
                    label="Nombre de la empresa"
                    type="text"
                    icon={Building2}
                    placeholder="Mi Negocio S.A."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />

                  {/* Logo upload area */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-surface-700">
                      Logo (opcional)
                    </label>
                    <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-surface-200 bg-white px-6 py-10 transition-colors hover:border-surface-300 hover:bg-surface-50 cursor-pointer">
                      <div className="text-center">
                        <Upload className="mx-auto h-8 w-8 text-surface-300" />
                        <p className="mt-2 text-sm text-surface-500">
                          Arrastra tu logo aquí o{' '}
                          <span className="font-medium text-primary-500">
                            selecciona un archivo
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-surface-400">
                          PNG, JPG hasta 2MB
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={goBack}
                      icon={<ArrowLeft className="h-4 w-4" />}
                    >
                      Atrás
                    </Button>
                    <Button
                      type="submit"
                      disabled={!companyName.trim()}
                      loading={loading}
                      size="lg"
                      icon={<ArrowRight className="h-4 w-4" />}
                    >
                      Crear equipo
                    </Button>
                  </div>
                </form>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: 'easeInOut' }}
                className="space-y-8"
              >
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                    className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-accent-100 mb-4"
                  >
                    <PartyPopper className="h-10 w-10 text-accent-600" />
                  </motion.div>
                  <h2 className="text-2xl font-bold text-surface-900">
                    ¡Listo!
                  </h2>
                  <p className="mt-2 text-surface-500">
                    Tu equipo <span className="font-semibold text-surface-700">{companyName}</span> ha sido creado
                  </p>
                </div>

                {/* Invite Code */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl border border-surface-200 bg-white p-6 space-y-4"
                >
                  <div className="text-center">
                    <p className="text-sm font-medium text-surface-700 mb-1">
                      Código de invitación de tu equipo
                    </p>
                    <p className="text-xs text-surface-400">
                      Comparte este código con tu equipo para que se unan
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <div className="rounded-xl bg-surface-50 border border-surface-100 px-6 py-3">
                      <span className="text-2xl font-mono font-bold tracking-widest text-surface-900">
                        {inviteCode}
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={handleCopyCode}
                      icon={
                        copied ? (
                          <Check className="h-4 w-4 text-accent-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )
                      }
                    >
                      {copied ? 'Copiado' : 'Copiar'}
                    </Button>
                  </div>

                  <div className="rounded-xl bg-primary-50 px-4 py-3">
                    <p className="text-xs text-primary-700 leading-relaxed">
                      Los miembros de tu equipo pueden unirse usando este código al registrarse.
                      Puedes encontrarlo después en la configuración de tu equipo.
                    </p>
                  </div>
                </motion.div>

                <div className="flex justify-center">
                  <Button
                    onClick={handleFinish}
                    size="lg"
                    icon={<ArrowRight className="h-4 w-4" />}
                  >
                    Ir al dashboard
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
