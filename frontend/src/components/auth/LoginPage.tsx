'use client';

import React, { useState, useEffect, useId } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import { useLocale } from '../../lib/locale-context';
import { trpc } from '../../lib/trpc/client';
import { authStore } from '../../lib/auth/authStore';

// ─── Zod Schemas ────────────────────────────────────────────────────────────

// Identifier field — email or phone depending on role
const loginSchema = z.object({
  identifier: z.string().min(5, 'emailOrPhone'),
  password: z.string().min(1, 'passwordRequired'),
});

const signupSchema = z
  .object({
    companyName: z.string().min(2, 'companyNameMin'),
    contactName: z.string().min(2, 'contactNameMin'),
    mobile: z
      .string()
      .regex(/^\d{10}$/, 'validMobile'),
    email: z.string().email('validEmail'),
    password: z
      .string()
      .min(8, 'passwordMin')
      .regex(/[A-Z]/, 'passwordUppercase')
      .regex(/[0-9]/, 'passwordNumber'),
    confirmPassword: z.string(),
    udyam: z
      .string()
      .optional()
      .refine(
        (v) => !v || /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(v),
        'udyamFormat',
      ),
    terms: z.literal(true, {
      errorMap: () => ({ message: 'acceptTerms' }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'passwordsNotMatch',
    path: ['confirmPassword'],
  });

type LoginInputs = z.infer<typeof loginSchema>;
type SignupInputs = z.infer<typeof signupSchema>;

// ─── Role Config ─────────────────────────────────────────────────────────────

const ROLES = [
  {
    id: 'jobseeker',
    labelKey: 'role_jobseeker_label',
    emoji: '🎓',
    hintKey: 'role_jobseeker_hint',
    color: '#004038',
  },
  {
    id: 'employer',
    labelKey: 'role_employer_label',
    emoji: '🏢',
    hintKey: 'role_employer_hint',
    color: '#fa5d00',
  },
  {
    id: 'trainer',
    labelKey: 'role_trainer_label',
    emoji: '🧑‍🏫',
    hintKey: 'role_trainer_hint',
    color: '#2563eb',
  },
  {
    id: 'admin',
    labelKey: 'role_admin_label',
    emoji: '🛡️',
    hintKey: 'role_admin_hint',
    color: '#6b21a8',
  },
] as const;

type RoleId = (typeof ROLES)[number]['id'];

// ─── Stat Cards Data ──────────────────────────────────────────────────────────

const STATS = [
  { valueKey: 'stat1Value', labelKey: 'stat1Label', subKey: 'stat1Sub' },
  { valueKey: 'stat2Value', labelKey: 'stat2Label', subKey: 'stat2Sub' },
  { valueKey: 'stat3Value', labelKey: 'stat3Label', subKey: 'stat3Sub' },
];

// ─── Password Strength ────────────────────────────────────────────────────────

function getPasswordStrength(password: string): { score: number; labelKey: string; color: string } {
  if (!password) return { score: 0, labelKey: '', color: 'transparent' };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (password.length >= 12) score++;

  const map: Record<number, { labelKey: string; color: string }> = {
    0: { labelKey: 'strengthTooWeak', color: '#dc2626' },
    1: { labelKey: 'strengthWeak', color: '#dc2626' },
    2: { labelKey: 'strengthFair', color: '#d97706' },
    3: { labelKey: 'strengthGood', color: '#16a34a' },
    4: { labelKey: 'strengthStrong', color: '#16a34a' },
    5: { labelKey: 'strengthVeryStrong', color: '#047857' },
  };

  return { score, ...map[score] };
}

// ─── LeftPanel ────────────────────────────────────────────────────────────────

function StatCard({
  stat,
  delay,
  shouldReduceMotion,
}: {
  stat: (typeof STATS)[number];
  delay: number;
  shouldReduceMotion: boolean;
}) {
  const { t } = useLocale();
  return (
    <motion.div
      animate={
        shouldReduceMotion
          ? {}
          : {
              y: [0, -8, 0],
              transition: {
                duration: 3 + delay * 0.7,
                repeat: Infinity,
                ease: 'easeInOut',
                delay,
              },
            }
      }
      style={{
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '16px',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        minWidth: '140px',
      }}
    >
      <span
        style={{
          fontSize: '26px',
          fontWeight: 700,
          color: '#fff',
          lineHeight: 1,
          fontFamily: "'DM Serif Display', serif",
        }}
      >
        {t('login', stat.valueKey)}
      </span>
      <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
        {t('login', stat.labelKey)}
      </span>
      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>{t('login', stat.subKey)}</span>
    </motion.div>
  );
}

function LeftPanel({ shouldReduceMotion }: { shouldReduceMotion: boolean }) {
  const { t } = useLocale();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.15 }}
      aria-hidden="true"
      style={{
        flex: '0 0 44%',
        background: 'linear-gradient(145deg, #004038 0%, #00544c 40%, #006b5a 80%, #004038 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 40px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative circles */}
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          right: '-120px',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'rgba(250,93,0,0.12)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-80px',
          left: '-80px',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '60%',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'rgba(250,93,0,0.06)',
          pointerEvents: 'none',
          transform: 'translate(-50%,-50%)',
        }}
      />

      {/* Logo */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '48px' }}>
          {/* Inline SVG logo */}
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-label="SaathiAI logo">
            <rect width="36" height="36" rx="10" fill="#fa5d00" />
            <path
              d="M9 27c0-5 4-8.5 9-8.5s9 3.5 9 8.5"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="18" cy="13" r="5" fill="#fff" />
          </svg>
          <span
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '22px',
              color: '#fff',
              letterSpacing: '-0.3px',
            }}
          >
            SaathiAI
          </span>
        </div>

        <h1
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 'clamp(28px, 3vw, 42px)',
            color: '#fff',
            lineHeight: 1.2,
            margin: 0,
            maxWidth: '340px',
          }}
        >
          {t('login', 'leftHeading')}
        </h1>
        <p
          style={{
            fontSize: '15px',
            color: 'rgba(255,255,255,0.65)',
            marginTop: '16px',
            lineHeight: 1.6,
            maxWidth: '320px',
          }}
        >
          {t('login', 'leftBody')}
        </p>
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {STATS.map((stat, i) => (
          <StatCard key={stat.valueKey} stat={stat} delay={i * 0.5} shouldReduceMotion={shouldReduceMotion} />
        ))}
      </div>

      {/* Bottom badge */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.45)',
            fontWeight: 500,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}
        >
          {t('login', 'leftBottom')}
        </span>
      </div>
    </motion.div>
  );
}

// ─── MobileStatPill ───────────────────────────────────────────────────────────

function MobileStatPill({ shouldReduceMotion }: { shouldReduceMotion: boolean }) {
  const { t } = useLocale();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (shouldReduceMotion) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % STATS.length), 3000);
    return () => clearInterval(t);
  }, [shouldReduceMotion]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '10px 20px',
        background: 'linear-gradient(90deg, #004038 0%, #006b5a 100%)',
        borderRadius: '999px',
        marginBottom: '32px',
        width: 'fit-content',
        margin: '0 auto 32px',
        overflow: 'hidden',
        position: 'relative',
        minWidth: '220px',
        minHeight: '40px',
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? {} : { opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <span
            style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}
          >
            {t('login', STATS[idx].valueKey)}
          </span>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
            {t('login', STATS[idx].labelKey)}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── RoleSelector ─────────────────────────────────────────────────────────────

function RoleSelector({
  selected,
  onSelect,
  shouldReduceMotion,
}: {
  selected: RoleId;
  onSelect: (id: RoleId) => void;
  shouldReduceMotion: boolean;
}) {
  const { t } = useLocale();
  return (
    <div
      role="radiogroup"
      aria-label="Select your role"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        marginBottom: '24px',
      }}
    >
      {ROLES.map((role) => {
        const isSelected = selected === role.id;
        return (
          <motion.button
            key={role.id}
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(role.id as RoleId)}
            whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '4px',
              padding: '12px 14px',
              borderRadius: '14px',
              border: isSelected
                ? `2px solid ${role.color}`
                : '2px solid rgba(0,0,0,0.08)',
              background: isSelected ? `${role.color}10` : 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              textAlign: 'left',
              boxShadow: isSelected
                ? `0 0 0 4px ${role.color}15`
                : 'none',
            }}
          >
            {isSelected && (
              <motion.div
                layoutId="role-bg"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '12px',
                  background: `${role.color}08`,
                  pointerEvents: 'none',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span style={{ fontSize: '20px' }}>{role.emoji}</span>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: isSelected ? role.color : '#0f161e',
                lineHeight: 1.2,
              }}
            >
              {t('login', role.labelKey)}
            </span>
            <span style={{ fontSize: '11px', color: '#615f5c' }}>{t('login', role.hintKey)}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── FormField ────────────────────────────────────────────────────────────────

function FormField({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label
        htmlFor={id}
        style={{ fontSize: '13px', fontWeight: 600, color: '#333942' }}
      >
        {label}
      </label>
      {children}
      <AnimatePresence>
        {error && (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            role="alert"
            style={{ fontSize: '12px', color: '#dc2626', fontWeight: 500 }}
          >
            {t('login', error, error)}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: '12px',
  border: '1.5px solid #c0bbb6',
  fontSize: '14px',
  fontFamily: 'inherit',
  color: '#0f161e',
  background: '#fff',
  outline: 'none',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  boxSizing: 'border-box',
};

function Input({
  id,
  hasError,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; hasError?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      id={id}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={{
        ...inputStyle,
        borderColor: hasError ? '#dc2626' : focused ? '#004038' : '#c0bbb6',
        boxShadow: focused ? '0 0 0 3px rgba(0,64,56,0.1)' : 'none',
        ...(props.style ?? {}),
      }}
    />
  );
}

// ─── LoginForm ────────────────────────────────────────────────────────────────

function LoginForm({
  role,
  shouldReduceMotion,
}: {
  role: RoleId;
  shouldReduceMotion: boolean;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [serverError, setServerError] = useState('');
  const formId = useId();

  const signinMutation = trpc.auth.signin.useMutation({
    onSuccess(data) {
      authStore.setAuth(data);
      router.push(authStore.getDashboardPath());
    },
    onError(err) {
      setServerError(err.message);
    },
  });

  const isLoading = signinMutation.isPending;

  // Determine which identifier field to show based on role
  const showPhone = role === 'jobseeker';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInputs>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });

  const currentRole = ROLES.find((r) => r.id === role)!;

  // Map frontend role IDs to backend role enum
  const backendRole: Record<RoleId, 'learner' | 'employer' | 'officer' | 'dssdo' | 'admin'> = {
    jobseeker: 'learner',
    employer: 'employer',
    trainer: 'officer',
    admin: 'dssdo',
  };

  const onSubmit = (data: LoginInputs) => {
    setServerError('');
    signinMutation.mutate({
      identifier: data.identifier,
      password: data.password,
      role: backendRole[role],
    });
  };

  const identifierLabel = showPhone
    ? t('login', 'mobileNumber')
    : role === 'employer'
      ? t('login', 'emailOrPhone')
      : t('login', 'email');

  const identifierPlaceholder = showPhone
    ? '9876543210'
    : role === 'employer'
      ? 'you@company.com'
      : 'you@example.com';

  const identifierInputType = showPhone ? 'tel' : 'text';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      {/* Role hint pill */}
      <AnimatePresence mode="wait">
        <motion.div
          key={role}
          initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={shouldReduceMotion ? {} : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '999px',
            background: `${currentRole.color}12`,
            border: `1px solid ${currentRole.color}30`,
            width: 'fit-content',
            marginBottom: '4px',
          }}
        >
          <span style={{ fontSize: '14px' }}>{currentRole.emoji}</span>
          <span
            style={{ fontSize: '12px', fontWeight: 600, color: currentRole.color }}
          >
            {t('login', 'signingInAs')} {t('login', currentRole.labelKey)}
          </span>
        </motion.div>
      </AnimatePresence>

      <FormField label={identifierLabel} id={`${formId}-identifier`} error={errors.identifier?.message}>
        <Input
          id={`${formId}-identifier`}
          type={identifierInputType}
          autoComplete={showPhone ? 'tel' : 'email'}
          placeholder={identifierPlaceholder}
          hasError={!!errors.identifier}
          {...register('identifier')}
        />
      </FormField>

      <FormField label={t('login', 'password')} id={`${formId}-password`} error={errors.password?.message}>
        <Input
          id={`${formId}-password`}
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          hasError={!!errors.password}
          {...register('password')}
        />
      </FormField>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <a
          href="#"
          style={{
            fontSize: '13px',
            color: '#004038',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          {t('login', 'forgotPassword')}
        </a>
      </div>

      {serverError && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            background: '#fee2e2',
            color: '#dc2626',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {t('login', serverError, serverError)}
        </div>
      )}

      <SubmitButton isLoading={isLoading} label={t('login', 'signIn')} color="#004038" />
    </form>
  );
}

// ─── SignupForm ───────────────────────────────────────────────────────────────

type SignupState = 'form' | 'success';

function SignupForm({ shouldReduceMotion }: { shouldReduceMotion: boolean }) {
  const { t } = useLocale();
  const router = useRouter();
  const [state, setState] = useState<SignupState>('form');
  const [serverError, setServerError] = useState('');
  const [passwordVal, setPasswordVal] = useState('');
  const formId = useId();

  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess(data) {
      authStore.setAuth(data);
      setState('success');
    },
    onError(err) {
      setServerError(err.message);
    },
  });

  const isLoading = signupMutation.isPending;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupInputs>({
    resolver: zodResolver(signupSchema),
    mode: 'onBlur',
  });

  const watchedPassword = watch('password', '');
  const strength = getPasswordStrength(watchedPassword);

  const onSubmit = (data: SignupInputs) => {
    setServerError('');
    signupMutation.mutate({
      role: 'employer',
      email: data.email,
      phone: data.mobile ? `+91${data.mobile}` : undefined,
      password: data.password,
      company_name: data.companyName,
      contact_name: data.contactName,
      udyam: data.udyam || undefined,
    });
  };

  if (state === 'success') {
    return <SuccessState shouldReduceMotion={shouldReduceMotion} />;
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <FormField
          label={t('login', 'companyName')}
          id={`${formId}-company`}
          error={errors.companyName?.message}
        >
          <Input
            id={`${formId}-company`}
            type="text"
            placeholder="Acme Pvt Ltd"
            hasError={!!errors.companyName}
            {...register('companyName')}
          />
        </FormField>

        <FormField
          label={t('login', 'contactPerson')}
          id={`${formId}-contact`}
          error={errors.contactName?.message}
        >
          <Input
            id={`${formId}-contact`}
            type="text"
            placeholder={t('login', 'fullNamePlaceholder')}
            hasError={!!errors.contactName}
            {...register('contactName')}
          />
        </FormField>
      </div>

      <FormField label={t('login', 'mobileNumber')} id={`${formId}-mobile`} error={errors.mobile?.message}>
        <div style={{ display: 'flex', gap: '0' }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              background: '#f5f5f5',
              border: '1.5px solid #c0bbb6',
              borderRight: 'none',
              borderRadius: '12px 0 0 12px',
              fontSize: '14px',
              color: '#615f5c',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            +91
          </span>
          <Input
            id={`${formId}-mobile`}
            type="tel"
            maxLength={10}
            placeholder="9876543210"
            hasError={!!errors.mobile}
            {...register('mobile')}
            style={{ borderRadius: '0 12px 12px 0' }}
          />
        </div>
      </FormField>

      <FormField label={t('login', 'workEmail')} id={`${formId}-email`} error={errors.email?.message}>
        <Input
          id={`${formId}-email`}
          type="email"
          autoComplete="email"
          placeholder="hr@company.com"
          hasError={!!errors.email}
          {...register('email')}
        />
      </FormField>

      <FormField label={t('login', 'password')} id={`${formId}-password`} error={errors.password?.message}>
        <Input
          id={`${formId}-password`}
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          hasError={!!errors.password}
          {...register('password')}
          onChange={(e) => {
            setPasswordVal(e.target.value);
            register('password').onChange(e);
          }}
        />
        {/* Password strength bar */}
        {watchedPassword && (
          <div style={{ marginTop: '6px' }}>
            <div
              style={{
                height: '4px',
                background: '#e5e7eb',
                borderRadius: '999px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${(strength.score / 5) * 100}%`,
                  background: strength.color,
                  borderRadius: '999px',
                  transition: 'width 0.3s ease, background 0.3s ease',
                }}
              />
            </div>
            <span style={{ fontSize: '11px', color: strength.color, fontWeight: 500, marginTop: '2px', display: 'block' }}>
              {t('login', strength.labelKey)}
            </span>
          </div>
        )}
      </FormField>

      <FormField
        label={t('login', 'confirmPassword')}
        id={`${formId}-confirm`}
        error={errors.confirmPassword?.message}
      >
        <Input
          id={`${formId}-confirm`}
          type="password"
          autoComplete="new-password"
          placeholder={t('login', 'repeatPasswordPlaceholder')}
          hasError={!!errors.confirmPassword}
          {...register('confirmPassword')}
        />
      </FormField>

      <FormField
        label={t('login', 'udyamLabel')}
        id={`${formId}-udyam`}
        error={errors.udyam?.message}
      >
        <Input
          id={`${formId}-udyam`}
          type="text"
          placeholder="UDYAM-XX-00-0000000"
          hasError={!!errors.udyam}
          {...register('udyam')}
        />
      </FormField>

      {/* Terms */}
      <label
        htmlFor={`${formId}-terms`}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          cursor: 'pointer',
          marginTop: '2px',
        }}
      >
        <input
          id={`${formId}-terms`}
          type="checkbox"
          {...register('terms')}
          style={{
            marginTop: '2px',
            width: '16px',
            height: '16px',
            accentColor: '#004038',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: '12px', color: '#615f5c', lineHeight: 1.5 }}>
          {t('login', 'termsAgreePrefix')}{' '}
          <a href="#" style={{ color: '#004038', fontWeight: 600, textDecoration: 'none' }}>
            {t('login', 'termsOfService')}
          </a>{' '}
          {t('login', 'termsAgreeAnd')}{' '}
          <a href="#" style={{ color: '#004038', fontWeight: 600, textDecoration: 'none' }}>
            {t('login', 'privacyPolicy')}
          </a>
        </span>
      </label>
      {errors.terms && errors.terms.message && (
        <span role="alert" style={{ fontSize: '12px', color: '#dc2626', fontWeight: 500 }}>
          {t('login', errors.terms.message, errors.terms.message)}
        </span>
      )}

      {serverError && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            background: '#fee2e2',
            color: '#dc2626',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {serverError}
        </div>
      )}

      <SubmitButton isLoading={isLoading} label={t('login', 'createAccount')} color="#fa5d00" />
    </form>
  );
}

// ─── SubmitButton ─────────────────────────────────────────────────────────────

function SubmitButton({
  isLoading,
  label,
  color,
}: {
  isLoading: boolean;
  label: string;
  color: string;
}) {
  const { t } = useLocale();
  return (
    <motion.button
      type="submit"
      disabled={isLoading}
      whileHover={isLoading ? {} : { scale: 1.01, boxShadow: `0 6px 20px ${color}30` }}
      whileTap={isLoading ? {} : { scale: 0.98 }}
      style={{
        width: '100%',
        padding: '13px',
        borderRadius: '14px',
        border: 'none',
        background: isLoading
          ? `${color}80`
          : color,
        color: '#fff',
        fontSize: '15px',
        fontWeight: 600,
        cursor: isLoading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontFamily: 'inherit',
        marginTop: '4px',
        transition: 'background 0.2s ease',
      }}
    >
      {isLoading && (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          style={{ animation: 'spin 0.8s linear infinite' }}
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="2.5"
          />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="#fff"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      )}
      {isLoading ? t('login', 'pleaseWait') : label}
    </motion.button>
  );
}

// ─── SuccessState ─────────────────────────────────────────────────────────────

function SuccessState({ shouldReduceMotion }: { shouldReduceMotion: boolean }) {
  const { t } = useLocale();
  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '40px 24px',
        gap: '16px',
      }}
    >
      <motion.div
        initial={shouldReduceMotion ? {} : { scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 18, delay: 0.15 }}
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: '#dcfce7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 13l4 4L19 7"
            stroke="#16a34a"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>
      <h2
        style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: '26px',
          color: '#0f161e',
          margin: 0,
        }}
      >
        {t('login', 'accountCreated')}
      </h2>
      <p style={{ fontSize: '14px', color: '#615f5c', margin: 0, lineHeight: 1.6 }}>
        {t('login', 'successBody')}
      </p>
      <a
        href="/"
        style={{
          display: 'inline-block',
          marginTop: '8px',
          padding: '12px 28px',
          borderRadius: '12px',
          background: '#004038',
          color: '#fff',
          fontWeight: 600,
          fontSize: '14px',
          textDecoration: 'none',
        }}
      >
        {t('login', 'goHome')}
      </a>
    </motion.div>
  );
}

// ─── TabSwitcher ──────────────────────────────────────────────────────────────

type TabId = 'signin' | 'signup';

function TabSwitcher({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (t: TabId) => void;
}) {
  const { t } = useLocale();
  return (
    <div
      role="tablist"
      aria-label="Authentication mode"
      style={{
        display: 'flex',
        background: '#f5f4f2',
        borderRadius: '14px',
        padding: '4px',
        gap: '4px',
        marginBottom: '28px',
      }}
    >
      {(['signin', 'signup'] as TabId[]).map((tab) => {
        const isActive = activeTab === tab;
        return (
          <button
            key={tab}
            role="tab"
            aria-selected={isActive}
            aria-controls={`${tab}-panel`}
            id={`${tab}-tab`}
            onClick={() => onTabChange(tab)}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '11px',
              border: 'none',
              background: isActive ? '#fff' : 'transparent',
              color: isActive ? '#004038' : '#615f5c',
              fontWeight: isActive ? 700 : 500,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isActive ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
              fontFamily: 'inherit',
            }}
          >
            {tab === 'signin' ? t('login', 'signIn') : t('login', 'signUp')}
          </button>
        );
      })}
    </div>
  );
}

// ─── RightPanel ──────────────────────────────────────────────────────────────

function RightPanel({ shouldReduceMotion }: { shouldReduceMotion: boolean }) {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<TabId>('signin');
  const [selectedRole, setSelectedRole] = useState<RoleId>('jobseeker');

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        flex: '0 0 56%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#fff8f1',
        padding: 'clamp(24px, 5vw, 64px)',
        minHeight: '100vh',
        overflowY: 'auto',
        position: 'relative',
      }}
    >
      {/* Language switcher — top-right corner */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 10,
        }}
      >
        <LanguageSwitcher variant="compact" placement="down" />
      </div>

      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h2
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 'clamp(24px, 3vw, 32px)',
              color: '#0f161e',
              margin: '0 0 6px',
            }}
          >
            {activeTab === 'signin' ? t('login', 'welcomeBack') : t('login', 'joinSaathi')}
          </h2>
          <p style={{ fontSize: '14px', color: '#615f5c', margin: 0 }}>
            {activeTab === 'signin'
              ? t('login', 'signinBody')
              : t('login', 'signupBody')}
          </p>
        </div>

        <TabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />

        <AnimatePresence mode="wait">
          {activeTab === 'signin' ? (
            <motion.div
              key="signin"
              id="signin-panel"
              role="tabpanel"
              aria-labelledby="signin-tab"
              initial={shouldReduceMotion ? {} : { opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={shouldReduceMotion ? {} : { opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
            >
              <RoleSelector
                selected={selectedRole}
                onSelect={setSelectedRole}
                shouldReduceMotion={shouldReduceMotion}
              />
              <LoginForm role={selectedRole} shouldReduceMotion={shouldReduceMotion} />
            </motion.div>
          ) : (
            <motion.div
              key="signup"
              id="signup-panel"
              role="tabpanel"
              aria-labelledby="signup-tab"
              initial={shouldReduceMotion ? {} : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={shouldReduceMotion ? {} : { opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  background: 'rgba(250,93,0,0.07)',
                  borderRadius: '10px',
                  marginBottom: '20px',
                }}
              >
                <span style={{ fontSize: '16px' }}>🏢</span>
                <span style={{ fontSize: '13px', color: '#615f5c' }}>
                  {t('login', 'signupEmployerOnly')}
                </span>
              </div>
              <SignupForm shouldReduceMotion={shouldReduceMotion} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <p
          style={{
            marginTop: '28px',
            textAlign: 'center',
            fontSize: '12px',
            color: '#615f5c',
          }}
        >
          {t('login', 'agreePrefix')}{' '}
          <a href="#" style={{ color: '#004038', fontWeight: 600, textDecoration: 'none' }}>
            {t('login', 'terms')}
          </a>{' '}
          {t('login', 'agreeAnd')}{' '}
          <a href="#" style={{ color: '#004038', fontWeight: 600, textDecoration: 'none' }}>
            {t('login', 'privacyPolicy')}
          </a>
        </p>
      </div>
    </motion.div>
  );
}

// ─── LoginPage (root) ─────────────────────────────────────────────────────────

export default function LoginPage() {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        * { box-sizing: border-box; }
      `}</style>
      <main
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          minHeight: '100vh',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          background: '#fff8f1',
        }}
      >
        {isMobile ? (
          /* Mobile: show rotating stat pill at top */
          <>
            <div
              style={{
                background: 'linear-gradient(145deg, #004038 0%, #006b5a 100%)',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <svg width="28" height="28" viewBox="0 0 36 36" fill="none" aria-label="SaathiAI">
                  <rect width="36" height="36" rx="10" fill="#fa5d00" />
                  <path
                    d="M9 27c0-5 4-8.5 9-8.5s9 3.5 9 8.5"
                    stroke="#fff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="18" cy="13" r="5" fill="#fff" />
                </svg>
                <span
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontSize: '18px',
                    color: '#fff',
                  }}
                >
                  SaathiAI
                </span>
              </div>
              <MobileStatPill shouldReduceMotion={shouldReduceMotion} />
            </div>
            <RightPanel shouldReduceMotion={shouldReduceMotion} />
          </>
        ) : (
          /* Desktop: split layout */
          <>
            <LeftPanel shouldReduceMotion={shouldReduceMotion} />
            <RightPanel shouldReduceMotion={shouldReduceMotion} />
          </>
        )}
      </main>
    </>
  );
}
