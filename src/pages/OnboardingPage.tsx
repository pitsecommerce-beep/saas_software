import { useState, useCallback, useRef } from 'react';
import type { FormEvent, DragEvent, ChangeEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
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
  X,
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
  const { user, profile, pendingRegistration } = useAuthStore();

  // If user already has a profile with a team, redirect to dashboard.
  if (profile?.team_id) {
    return <Navigate to="/dashboard" replace />;
  }

  // Auth guard: only allow access if user has a pending registration (gerente flow)
  // OR is authenticated (Google OAuth / existing user without team).
  if (!pendingRegistration && !user) {
    return <Navigate to="/register" replace />;
  }

  return <OnboardingWizard />;
}

function OnboardingWizard() {
  const navigate = useNavigate();
  const { user, profile, pendingRegistration, clearPendingRegistration, fetchProfile, fetchTeam } = useAuthStore();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [inviteCode] = useState(() => generateInviteCode());
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [logoError, setLogoError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  const processLogoFile = (file: File) => {
    setLogoError('');
    if (!file.type.startsWith('image/')) {
      setLogoError('Solo se permiten imágenes (PNG, JPG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('El archivo no debe superar 2MB.');
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleLogoClick = () => {
    fileInputRef.current?.click();
  };

  const handleLogoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processLogoFile(file);
  };

  const handleLogoDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processLogoFile(file);
  };

  const handleLogoDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleLogoDragLeave = () => {
    setIsDragOver(false);
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const [createError, setCreateError] = useState('');

  const handleCreateTeam = async () => {
    setLoading(true);
    setCreateError('');

    // Track whether we created the auth user in this call so we can roll it
    // back if a later step fails (prevents orphaned auth users).
    let authCreatedHere = false;
    let success = false;

    try {
      let ownerId = profile?.id ?? user?.id;
      let ownerEmail = profile?.email ?? user?.email ?? '';
      let ownerFullName =
        profile?.full_name ?? (user?.user_metadata?.full_name as string) ?? '';

      // If the user hasn't authenticated yet (deferred registration), create
      // the Supabase auth user now — right before we create the team and profile,
      // so all three succeed or fail together.
      if (pendingRegistration && !ownerId) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: pendingRegistration.email,
          password: pendingRegistration.password,
          options: { data: { full_name: pendingRegistration.fullName } },
        });
        if (signUpError) {
          if (signUpError.message?.toLowerCase().includes('already registered') ||
              signUpError.message?.toLowerCase().includes('already exists')) {
            throw new Error('DUPLICATE_EMAIL');
          }
          throw signUpError;
        }
        if (!data.user) throw new Error('No se pudo crear el usuario de autenticación');

        // Supabase with email confirmation enabled returns a fake user with empty identities
        if (data.user.identities && data.user.identities.length === 0) {
          throw new Error('DUPLICATE_EMAIL');
        }

        ownerId = data.user.id;
        ownerEmail = pendingRegistration.email;
        ownerFullName = pendingRegistration.fullName;
        authCreatedHere = true;

        // Update the store with the newly created user
        useAuthStore.setState({ user: data.user });

        // Wait briefly for the DB trigger handle_new_user() to create the profile row.
        await new Promise((r) => setTimeout(r, 500));
      }

      // Last resort: query Supabase auth directly in case the store hasn't
      // been populated yet (e.g. Google OAuth without a pending registration).
      if (!ownerId) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        ownerId = authUser?.id;
        if (authUser) {
          ownerEmail = ownerEmail || authUser.email || '';
          ownerFullName = ownerFullName || (authUser.user_metadata?.full_name as string) || '';
          useAuthStore.setState({ user: authUser });
        }
      }

      if (!ownerId) throw new Error('Usuario no autenticado');

      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: companyName,
          business_type: businessType,
          invite_code: inviteCode,
          owner_id: ownerId,
          active_modules: ['conversations', 'customers', 'ai-agents'],
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Upload logo if provided
      if (logoFile && teamData) {
        const ext = logoFile.name.split('.').pop();
        const path = `${teamData.id}/logo.${ext}`;
        await supabase.storage.from('logos').upload(path, logoFile, { upsert: true });
      }

      // Update the profile row with team_id and role=gerente.
      // The DB trigger handle_new_user() should have already created the row.
      // Try UPDATE first (preferred), fall back to UPSERT if needed.
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          role: 'gerente',
          team_id: teamData.id,
          full_name: ownerFullName || ownerEmail,
        })
        .eq('id', ownerId);

      if (updateError) {
        // If UPDATE fails (e.g. no row to update), try UPSERT as fallback
        console.warn('Profile update failed, trying upsert:', updateError.message);
        const { error: upsertError } = await supabase.from('profiles').upsert({
          id: ownerId,
          email: ownerEmail,
          full_name: ownerFullName || ownerEmail,
          role: 'gerente',
          is_active: true,
          team_id: teamData.id,
        });
        if (upsertError) throw upsertError;
      }

      clearPendingRegistration();

      // Refresh auth store so ProtectedRoute sees the updated team_id
      await fetchProfile();
      await fetchTeam();
      success = true;
    } catch (err) {
      console.error('Error creating team:', err);
      const errMsg = err instanceof Error ? err.message : '';
      if (errMsg === 'DUPLICATE_EMAIL') {
        clearPendingRegistration();
        setCreateError('Ya existe una cuenta con este correo electrónico. Por favor, inicia sesión.');
      } else {
        // If we created the auth user in this attempt but subsequent steps failed,
        // sign out to avoid leaving an orphaned auth user with no team.
        if (authCreatedHere) {
          await supabase.auth.signOut();
          useAuthStore.setState({ user: null });
        }
        setCreateError('Error al crear el equipo. Inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
      // Only advance to the confirmation step on success.
      // Staying on step 2 lets the user retry without getting stuck.
      if (success) goNext();
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

  const handleGoBack = () => {
    if (pendingRegistration) {
      // Gerente registration flow: go back to register
      navigate('/register');
    } else {
      // Google OAuth flow: go back to login
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-surface-100">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-surface-900">Orkesta</span>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm text-surface-400">
            Paso {step} de {TOTAL_STEPS}
          </p>
          {step < TOTAL_STEPS && (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-600 transition-colors rounded-lg px-2 py-1 hover:bg-surface-100"
              title="Salir del registro"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          )}
        </div>
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

                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleGoBack}
                    icon={<ArrowLeft className="h-4 w-4" />}
                  >
                    Atrás
                  </Button>
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
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={handleLogoFileChange}
                    />
                    {logoPreview ? (
                      <div className="relative flex items-center gap-4 rounded-2xl border-2 border-surface-200 bg-white px-6 py-4">
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="h-16 w-16 rounded-xl object-contain border border-surface-100"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-surface-700 truncate">{logoFile?.name}</p>
                          <p className="text-xs text-surface-400 mt-0.5">
                            {logoFile ? (logoFile.size / 1024).toFixed(0) + ' KB' : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={removeLogo}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-100 text-surface-400 hover:bg-surface-200 hover:text-surface-600 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={handleLogoClick}
                        onDrop={handleLogoDrop}
                        onDragOver={handleLogoDragOver}
                        onDragLeave={handleLogoDragLeave}
                        className={`flex items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 transition-colors cursor-pointer ${
                          isDragOver
                            ? 'border-primary-400 bg-primary-50'
                            : 'border-surface-200 bg-white hover:border-surface-300 hover:bg-surface-50'
                        }`}
                      >
                        <div className="text-center">
                          <Upload className={`mx-auto h-8 w-8 ${isDragOver ? 'text-primary-400' : 'text-surface-300'}`} />
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
                    )}
                    {logoError && (
                      <p className="text-xs text-red-500 mt-1">{logoError}</p>
                    )}
                  </div>

                  {createError && (
                    <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
                      {createError}
                    </p>
                  )}

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
