'use client';

import React, { useState, useEffect, useId, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import { useLocale } from '../../lib/locale-context';
import { trpc } from '../../lib/trpc/client';
import { authStore, useAuth } from '../../lib/auth/authStore';

// ─── Zod Schemas ────────────────────────────────────────────────────────────

// Identifier field — email or phone depending on role
const loginSchema = z.object({
  identifier: z.string().min(5, 'emailOrPhone'),
  password: z.string().min(1, 'passwordRequired'),
});

type LoginInputs = z.infer<typeof loginSchema>;

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
    id: 'dssdo',
    labelKey: 'role_admin_label',
    emoji: '🏛️',
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
    dssdo: 'dssdo',
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

// ─── Shared: PasswordField with strength bar ──────────────────────────────────

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete = 'new-password',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete?: string;
}) {
  const { t } = useLocale();
  const strength = getPasswordStrength(value);
  return (
    <FormField label={label} id={id} error={error}>
      <Input
        id={id}
        type="password"
        autoComplete={autoComplete}
        placeholder="••••••••"
        hasError={!!error}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <div style={{ marginTop: '6px' }}>
          <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
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
  );
}

// ─── Shared: Contact + Password form (used after verification) ────────────────

const contactSchema = z
  .object({
    contactName: z.string().min(2, 'contactNameMin'),
    email: z.string().email('validEmail').optional().or(z.literal('')),
    mobile: z.string().regex(/^\d{10}$/, 'validMobile').optional().or(z.literal('')),
    password: z.string().min(8, 'passwordMin').regex(/[A-Z]/, 'passwordUppercase').regex(/[0-9]/, 'passwordNumber'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { message: 'passwordsNotMatch', path: ['confirmPassword'] })
  .refine((d) => d.email || d.mobile, { message: 'emailOrPhoneRequired', path: ['email'] });

type ContactInputs = z.infer<typeof contactSchema>;

function ContactForm({
  onSubmit,
  isLoading,
  serverError,
  companyName,
  prefillName,
  prefillEmail,
  prefillMobile,
}: {
  onSubmit: (data: ContactInputs) => void;
  isLoading: boolean;
  serverError: string;
  companyName?: string;
  prefillName?: string;
  prefillEmail?: string;
  prefillMobile?: string;
}) {
  const { t } = useLocale();
  const formId = useId();
  const [password, setPassword] = useState('');

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ContactInputs>({
    resolver: zodResolver(contactSchema),
    mode: 'onBlur',
    defaultValues: { contactName: prefillName ?? '', email: prefillEmail ?? '', mobile: prefillMobile ?? '' },
  });

  const watchedPassword = watch('password', '');

  useEffect(() => {
    if (prefillName) setValue('contactName', prefillName);
    if (prefillEmail) setValue('email', prefillEmail);
    if (prefillMobile) setValue('mobile', prefillMobile.replace(/^\+91/, ''));
  }, [prefillName, prefillEmail, prefillMobile, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {companyName && (
        <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #86efac', fontSize: '13px', color: '#166534' }}>
          Company: <strong>{companyName}</strong>
        </div>
      )}

      <FormField label="Your Full Name" id={`${formId}-name`} error={errors.contactName?.message}>
        <Input id={`${formId}-name`} type="text" placeholder="Your full name" hasError={!!errors.contactName} {...register('contactName')} />
      </FormField>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <FormField label="Work Email" id={`${formId}-email`} error={errors.email?.message}>
          <Input id={`${formId}-email`} type="email" autoComplete="email" placeholder="you@company.com" hasError={!!errors.email} {...register('email')} />
        </FormField>
        <FormField label="Mobile (for login)" id={`${formId}-mobile`} error={errors.mobile?.message}>
          <div style={{ display: 'flex' }}>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 10px', background: '#f5f5f5', border: '1.5px solid #c0bbb6', borderRight: 'none', borderRadius: '12px 0 0 12px', fontSize: '13px', color: '#615f5c', fontWeight: 600, whiteSpace: 'nowrap' }}>+91</span>
            <Input id={`${formId}-mobile`} type="tel" maxLength={10} placeholder="9876543210" hasError={!!errors.mobile} {...register('mobile')} style={{ borderRadius: '0 12px 12px 0' }} />
          </div>
        </FormField>
      </div>

      <PasswordField
        id={`${formId}-password`}
        label="Password"
        value={watchedPassword}
        onChange={(v) => setValue('password', v, { shouldValidate: true })}
        error={errors.password?.message}
      />

      <FormField label="Confirm Password" id={`${formId}-confirm`} error={errors.confirmPassword?.message}>
        <Input id={`${formId}-confirm`} type="password" autoComplete="new-password" placeholder="••••••••" hasError={!!errors.confirmPassword} {...register('confirmPassword')} />
      </FormField>

      {serverError && (
        <div role="alert" style={{ padding: '10px 14px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', fontSize: '13px', fontWeight: 500 }}>
          {serverError}
        </div>
      )}

      <SubmitButton isLoading={isLoading} label="Create Account" color="#fa5d00" />
    </form>
  );
}

// ─── Verification method tabs ─────────────────────────────────────────────────

type VerifTab = 'entitylocker' | 'aadhaar' | 'unverified';

function VerifTabBar({ active, onChange }: { active: VerifTab; onChange: (t: VerifTab) => void }) {
  const tabs: { id: VerifTab; label: string; badge?: string }[] = [
    { id: 'entitylocker', label: 'EntityLocker', badge: 'Recommended' },
    { id: 'aadhaar', label: 'Aadhaar' },
    { id: 'unverified', label: 'Unverified' },
  ];

  return (
    <div style={{ display: 'flex', background: '#f5f4f2', borderRadius: '14px', padding: '4px', gap: '4px', marginBottom: '20px' }}>
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              padding: '9px 6px',
              borderRadius: '11px',
              border: 'none',
              background: isActive ? '#fff' : 'transparent',
              color: isActive ? '#fa5d00' : '#615f5c',
              fontWeight: isActive ? 700 : 500,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isActive ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
              fontFamily: 'inherit',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
            }}
          >
            <span>{tab.label}</span>
            {tab.badge && (
              <span style={{ fontSize: '9px', background: isActive ? '#fa5d0020' : 'transparent', color: '#fa5d00', borderRadius: '4px', padding: '1px 4px', fontWeight: 700 }}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── EntityLocker Tab ─────────────────────────────────────────────────────────

type ELState = 'idle' | 'loading' | 'callback_loading' | 'form' | 'success';

function EntityLockerTab({ shouldReduceMotion }: { shouldReduceMotion: boolean }) {
  const [state, setState] = useState<ELState>('idle');
  const [serverError, setServerError] = useState('');
  const [entityData, setEntityData] = useState<{
    id: string; name: string; email: string; mobile: string;
    dateOfIncorporation: string; verifiedBy: string;
  } | null>(null);
  const [callbackSessionId, setCallbackSessionId] = useState<string | null>(null);

  const initMutation = trpc.auth.initEntityLockerSession.useMutation();
  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess(data) { authStore.setAuth(data); setState('success'); },
    onError(err) { setServerError(err.message); },
  });

  const entityQuery = trpc.auth.getEntityLockerDetails.useQuery(
    { sessionId: callbackSessionId ?? '' },
    { enabled: !!callbackSessionId }
  );

  // Detect EntityLocker callback via window.location on mount (avoids useSearchParams Suspense)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const isCallback = params.get('el_callback') === '1';
    const storedSessionId = sessionStorage.getItem('el_session_id');
    if (isCallback && storedSessionId) {
      setState('callback_loading');
      setCallbackSessionId(storedSessionId);
    }
  }, []);

  // Handle query result when callbackSessionId is set
  useEffect(() => {
    if (!callbackSessionId) return;
    if (entityQuery.data) {
      setEntityData(entityQuery.data);
      sessionStorage.removeItem('el_session_id');
      setState('form');
      const url = new URL(window.location.href);
      url.searchParams.delete('el_callback');
      window.history.replaceState({}, '', url.toString());
    } else if (entityQuery.error) {
      setServerError(entityQuery.error.message ?? 'Failed to fetch entity details');
      setState('idle');
      setCallbackSessionId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityQuery.data, entityQuery.error]);

  const handleEntityLockerLogin = async () => {
    setServerError('');
    setState('loading');
    try {
      const redirectUrl =
        (typeof window !== 'undefined' ? window.location.origin : 'https://app.saathi.ai') +
        '/signin?el_callback=1';
      const result = await initMutation.mutateAsync({ redirectUrl });
      sessionStorage.setItem('el_session_id', result.sessionId);
      window.location.href = result.authorizationUrl;
    } catch (err: any) {
      setServerError(err.message ?? 'Failed to initiate EntityLocker session');
      setState('idle');
    }
  };

  const handleFormSubmit = (data: ContactInputs) => {
    if (!entityData) return;
    setServerError('');
    signupMutation.mutate({
      role: 'employer',
      email: data.email || entityData.email || undefined,
      phone: data.mobile ? `+91${data.mobile}` : (entityData.mobile ? `+91${entityData.mobile}` : undefined),
      password: data.password,
      company_name: entityData.name,
      contact_name: data.contactName,
      verification_type: 'entitylocker',
      entity_data: {
        id: entityData.id,
        name: entityData.name,
        email: entityData.email,
        mobile: entityData.mobile,
        dateOfIncorporation: entityData.dateOfIncorporation,
        verifiedBy: entityData.verifiedBy as 'pan' | 'ud' | 'cin',
      },
    });
  };

  if (state === 'success') return <SuccessState shouldReduceMotion={shouldReduceMotion} />;

  if (state === 'callback_loading') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: '#615f5c' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }}>
          <circle cx="12" cy="12" r="10" stroke="#e5e7eb" strokeWidth="2.5" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="#fa5d00" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <p style={{ margin: 0, fontSize: '14px' }}>Fetching entity details from EntityLocker…</p>
      </div>
    );
  }

  if (state === 'form' && entityData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ padding: '14px', borderRadius: '12px', background: '#f0fdf4', border: '1px solid #86efac' }}>
          <div style={{ fontSize: '12px', color: '#166534', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="2"/></svg>
            EntityLocker Verified
          </div>
          <div style={{ fontSize: '13px', color: '#0f161e' }}>
            <div><strong>Company:</strong> {entityData.name}</div>
            <div><strong>Incorporated:</strong> {entityData.dateOfIncorporation}</div>
            <div><strong>Verified via:</strong> {entityData.verifiedBy.toUpperCase()}</div>
          </div>
        </div>
        <p style={{ fontSize: '13px', color: '#615f5c', margin: 0 }}>
          Confirm your personal contact details and set a password:
        </p>
        <ContactForm
          onSubmit={handleFormSubmit}
          isLoading={signupMutation.isPending}
          serverError={serverError}
          companyName={entityData.name}
          prefillEmail={entityData.email}
          prefillMobile={entityData.mobile}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ padding: '14px', borderRadius: '12px', background: '#fff7ed', border: '1px solid #fed7aa', fontSize: '13px', color: '#9a3412', lineHeight: 1.5 }}>
        <strong>Recommended:</strong> EntityLocker is India's official business identity platform.
        Verify your company instantly using your PAN, Udyam, or CIN number.
      </div>

      {serverError && (
        <div role="alert" style={{ padding: '10px 14px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', fontSize: '13px', fontWeight: 500 }}>
          {serverError}
        </div>
      )}

      <motion.button
        type="button"
        onClick={handleEntityLockerLogin}
        disabled={state === 'loading'}
        whileHover={state === 'loading' ? {} : { scale: 1.01 }}
        whileTap={state === 'loading' ? {} : { scale: 0.98 }}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '14px',
          border: '2px solid #1a56db',
          background: state === 'loading' ? '#eff6ff' : '#fff',
          color: '#1a56db',
          fontSize: '15px',
          fontWeight: 700,
          cursor: state === 'loading' ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          fontFamily: 'inherit',
          transition: 'all 0.2s ease',
        }}
      >
        {state === 'loading' ? (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
              <circle cx="12" cy="12" r="10" stroke="rgba(26,86,219,0.3)" strokeWidth="2.5" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="#1a56db" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            Redirecting to EntityLocker…
          </>
        ) : (
          <>
            {/* EntityLocker / DigiLocker logo */}
            <svg width="24" height="24" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <rect width="64" height="64" rx="12" fill="#1a56db"/>
              <path d="M16 44V20h10c8 0 14 5.4 14 12s-6 12-14 12H16z" fill="#fff"/>
              <rect x="44" y="20" width="6" height="24" rx="3" fill="#fff"/>
            </svg>
            Login with EntityLocker
          </>
        )}
      </motion.button>

      <p style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', margin: 0 }}>
        You will be redirected to EntityLocker's secure portal and brought back here.
      </p>
    </div>
  );
}

// ─── Aadhaar Tab ──────────────────────────────────────────────────────────────

type AadhaarState = 'number' | 'otp' | 'verified' | 'form' | 'success';

const OTP_TIMEOUT_SECONDS = 120;

function AadhaarTab({ shouldReduceMotion }: { shouldReduceMotion: boolean }) {
  const [state, setState] = useState<AadhaarState>('number');
  const [serverError, setServerError] = useState('');
  const [aadhaarInput, setAadhaarInput] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [kycData, setKycData] = useState<{
    aadhaarNumber: string; name: string; dob: string; gender: string;
    address: { line: string | null; district: string | null; state: string | null; pincode: string | null };
    photo: string;
  } | null>(null);
  const [countdown, setCountdown] = useState(OTP_TIMEOUT_SECONDS);
  const [canResend, setCanResend] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const otpMutation = trpc.auth.employerAadhaarOtp.useMutation();
  const verifyMutation = trpc.auth.employerAadhaarVerify.useMutation();
  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess(data) { authStore.setAuth(data); setState('success'); },
    onError(err) { setServerError(err.message); },
  });

  const startCountdown = useCallback(() => {
    setCountdown(OTP_TIMEOUT_SECONDS);
    setCanResend(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current!);
          setCanResend(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const handleSendOtp = async () => {
    const cleaned = aadhaarInput.replace(/\s/g, '');
    if (!/^\d{12}$/.test(cleaned)) {
      setServerError('Please enter a valid 12-digit Aadhaar number.');
      return;
    }
    setServerError('');
    try {
      const result = await otpMutation.mutateAsync({ aadhaarNumber: cleaned });
      setReferenceId(result.referenceId);
      setState('otp');
      startCountdown();
    } catch (err: any) {
      setServerError(err.message ?? 'Failed to send OTP.');
    }
  };

  const handleResendOtp = async () => {
    const cleaned = aadhaarInput.replace(/\s/g, '');
    setOtpError('');
    setServerError('');
    setOtp('');
    try {
      const result = await otpMutation.mutateAsync({ aadhaarNumber: cleaned });
      setReferenceId(result.referenceId);
      startCountdown();
    } catch (err: any) {
      setServerError(err.message ?? 'Failed to resend OTP.');
    }
  };

  const handleVerifyOtp = async () => {
    if (!/^\d{4,8}$/.test(otp.trim())) {
      setOtpError('Please enter a valid OTP (4–8 digits).');
      return;
    }
    setOtpError('');
    try {
      const result = await verifyMutation.mutateAsync({ referenceId, otp: otp.trim() });
      setKycData(result);
      setState('verified');
    } catch (err: any) {
      setOtpError(err.message ?? 'Invalid OTP. Please try again.');
    }
  };

  const handleFormSubmit = (data: ContactInputs) => {
    if (!kycData) return;
    setServerError('');
    signupMutation.mutate({
      role: 'employer',
      email: data.email || undefined,
      phone: data.mobile ? `+91${data.mobile}` : undefined,
      password: data.password,
      company_name: data.contactName, // employer name from their entry
      contact_name: data.contactName,
      verification_type: 'aadhaar',
      aadhaar_kyc: {
        aadhaarNumber: kycData.aadhaarNumber,
        name: kycData.name,
        dob: kycData.dob,
        gender: kycData.gender,
        address: kycData.address,
      },
    });
  };

  if (state === 'success') return <SuccessState shouldReduceMotion={shouldReduceMotion} />;

  if (state === 'verified' || state === 'form') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* KYC Summary Card */}
        <div style={{ padding: '14px', borderRadius: '12px', background: '#f0fdf4', border: '1px solid #86efac', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          {kycData?.photo && (
            <img
              src={`data:image/jpeg;base64,${kycData.photo}`}
              alt="Aadhaar photo"
              style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #86efac' }}
            />
          )}
          <div style={{ fontSize: '13px', color: '#0f161e' }}>
            <div style={{ fontSize: '12px', color: '#166534', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="2"/></svg>
              Aadhaar Verified
            </div>
            <div><strong>{kycData?.name}</strong></div>
            <div style={{ color: '#615f5c' }}>DOB: {kycData?.dob} · {kycData?.gender}</div>
            {kycData?.address?.district && (
              <div style={{ color: '#615f5c' }}>{kycData.address.district}, {kycData.address.state}</div>
            )}
          </div>
        </div>
        <p style={{ fontSize: '13px', color: '#615f5c', margin: 0 }}>
          Enter your contact details and password for logging into SaathiAI:
        </p>
        <ContactForm
          onSubmit={handleFormSubmit}
          isLoading={signupMutation.isPending}
          serverError={serverError}
          prefillName={kycData?.name}
        />
      </div>
    );
  }

  if (state === 'otp') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: '13px', color: '#1e40af' }}>
          An OTP has been sent to the mobile number registered with Aadhaar ending in …{aadhaarInput.slice(-4)}.
          Please enter it below.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#333942' }}>Enter OTP</label>
          <Input
            id="aadhaar-otp"
            type="tel"
            maxLength={8}
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            hasError={!!otpError}
          />
          {otpError && <span role="alert" style={{ fontSize: '12px', color: '#dc2626', fontWeight: 500 }}>{otpError}</span>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {canResend ? (
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={otpMutation.isPending}
              style={{ fontSize: '13px', color: '#fa5d00', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
            >
              {otpMutation.isPending ? 'Resending…' : 'Resend OTP'}
            </button>
          ) : (
            <span style={{ fontSize: '13px', color: '#9ca3af' }}>
              Resend in {countdown}s
            </span>
          )}
          <button
            type="button"
            onClick={() => { setState('number'); setOtp(''); setOtpError(''); }}
            style={{ fontSize: '13px', color: '#615f5c', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
          >
            Change number
          </button>
        </div>

        <ActionButton
          onClick={handleVerifyOtp}
          isLoading={verifyMutation.isPending}
          label="Verify OTP"
          color="#004038"
        />
      </div>
    );
  }

  // state === 'number'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#f5f4f2', fontSize: '13px', color: '#615f5c', lineHeight: 1.5 }}>
        Verify your identity via Aadhaar OTP. An OTP will be sent to the mobile number registered with your Aadhaar.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: '#333942' }}>Aadhaar Number</label>
        <Input
          id="aadhaar-number"
          type="tel"
          maxLength={12}
          placeholder="12-digit Aadhaar number"
          value={aadhaarInput}
          onChange={(e) => setAadhaarInput(e.target.value.replace(/\D/g, ''))}
          hasError={!!serverError}
        />
        {serverError && <span role="alert" style={{ fontSize: '12px', color: '#dc2626', fontWeight: 500 }}>{serverError}</span>}
      </div>

      <ActionButton
        onClick={handleSendOtp}
        isLoading={otpMutation.isPending}
        label="Send OTP"
        color="#004038"
      />
    </div>
  );
}

// ─── Unverified SignupForm ────────────────────────────────────────────────────

type SignupState = 'form' | 'success';

const simpleSignupSchema = z
  .object({
    companyName: z.string().min(2, 'companyNameMin'),
    contactName: z.string().min(2, 'contactNameMin'),
    mobile: z.string().regex(/^\d{10}$/, 'validMobile'),
    email: z.string().email('validEmail'),
    password: z.string().min(8, 'passwordMin').regex(/[A-Z]/, 'passwordUppercase').regex(/[0-9]/, 'passwordNumber'),
    confirmPassword: z.string(),
    udyam: z.string().optional().refine((v) => !v || /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(v), 'udyamFormat'),
    terms: z.literal(true, { errorMap: () => ({ message: 'acceptTerms' }) }),
  })
  .refine((d) => d.password === d.confirmPassword, { message: 'passwordsNotMatch', path: ['confirmPassword'] });

type SimpleSignupInputs = z.infer<typeof simpleSignupSchema>;

function UnverifiedSignupForm({ shouldReduceMotion }: { shouldReduceMotion: boolean }) {
  const { t } = useLocale();
  const [state, setState] = useState<SignupState>('form');
  const [serverError, setServerError] = useState('');
  const formId = useId();

  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess(data) { authStore.setAuth(data); setState('success'); },
    onError(err) { setServerError(err.message); },
  });

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<SimpleSignupInputs>({
    resolver: zodResolver(simpleSignupSchema),
    mode: 'onBlur',
  });

  const watchedPassword = watch('password', '');

  const onSubmit = (data: SimpleSignupInputs) => {
    setServerError('');
    signupMutation.mutate({
      role: 'employer',
      email: data.email,
      phone: data.mobile ? `+91${data.mobile}` : undefined,
      password: data.password,
      company_name: data.companyName,
      contact_name: data.contactName,
      udyam: data.udyam || undefined,
      verification_type: 'none',
    });
  };

  if (state === 'success') return <SuccessState shouldReduceMotion={shouldReduceMotion} />;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#fef9c3', border: '1px solid #fde68a', fontSize: '12px', color: '#854d0e' }}>
        Unverified accounts have limited access. Use EntityLocker or Aadhaar to unlock full features.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <FormField label={t('login', 'companyName')} id={`${formId}-company`} error={errors.companyName?.message}>
          <Input id={`${formId}-company`} type="text" placeholder="Acme Pvt Ltd" hasError={!!errors.companyName} {...register('companyName')} />
        </FormField>
        <FormField label={t('login', 'contactPerson')} id={`${formId}-contact`} error={errors.contactName?.message}>
          <Input id={`${formId}-contact`} type="text" placeholder={t('login', 'fullNamePlaceholder')} hasError={!!errors.contactName} {...register('contactName')} />
        </FormField>
      </div>

      <FormField label={t('login', 'mobileNumber')} id={`${formId}-mobile`} error={errors.mobile?.message}>
        <div style={{ display: 'flex' }}>
          <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', background: '#f5f5f5', border: '1.5px solid #c0bbb6', borderRight: 'none', borderRadius: '12px 0 0 12px', fontSize: '14px', color: '#615f5c', fontWeight: 600, whiteSpace: 'nowrap' }}>+91</span>
          <Input id={`${formId}-mobile`} type="tel" maxLength={10} placeholder="9876543210" hasError={!!errors.mobile} {...register('mobile')} style={{ borderRadius: '0 12px 12px 0' }} />
        </div>
      </FormField>

      <FormField label={t('login', 'workEmail')} id={`${formId}-email`} error={errors.email?.message}>
        <Input id={`${formId}-email`} type="email" autoComplete="email" placeholder="hr@company.com" hasError={!!errors.email} {...register('email')} />
      </FormField>

      <PasswordField
        id={`${formId}-password`}
        label={t('login', 'password')}
        value={watchedPassword}
        onChange={(v) => setValue('password', v, { shouldValidate: true })}
        error={errors.password?.message}
      />

      <FormField label={t('login', 'confirmPassword')} id={`${formId}-confirm`} error={errors.confirmPassword?.message}>
        <Input id={`${formId}-confirm`} type="password" autoComplete="new-password" placeholder={t('login', 'repeatPasswordPlaceholder')} hasError={!!errors.confirmPassword} {...register('confirmPassword')} />
      </FormField>

      <FormField label={t('login', 'udyamLabel')} id={`${formId}-udyam`} error={errors.udyam?.message}>
        <Input id={`${formId}-udyam`} type="text" placeholder="UDYAM-XX-00-0000000" hasError={!!errors.udyam} {...register('udyam')} />
      </FormField>

      <label htmlFor={`${formId}-terms`} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginTop: '2px' }}>
        <input id={`${formId}-terms`} type="checkbox" {...register('terms')} style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: '#004038', cursor: 'pointer', flexShrink: 0 }} />
        <span style={{ fontSize: '12px', color: '#615f5c', lineHeight: 1.5 }}>
          {t('login', 'termsAgreePrefix')}{' '}
          <a href="#" style={{ color: '#004038', fontWeight: 600, textDecoration: 'none' }}>{t('login', 'termsOfService')}</a>{' '}
          {t('login', 'termsAgreeAnd')}{' '}
          <a href="#" style={{ color: '#004038', fontWeight: 600, textDecoration: 'none' }}>{t('login', 'privacyPolicy')}</a>
        </span>
      </label>
      {errors.terms?.message && <span role="alert" style={{ fontSize: '12px', color: '#dc2626', fontWeight: 500 }}>{t('login', errors.terms.message, errors.terms.message)}</span>}

      {serverError && <div role="alert" style={{ padding: '10px 14px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', fontSize: '13px', fontWeight: 500 }}>{serverError}</div>}

      <SubmitButton isLoading={signupMutation.isPending} label={t('login', 'createAccount')} color="#fa5d00" />
    </form>
  );
}

// ─── SignupForm (orchestrator) ────────────────────────────────────────────────

function SignupForm({ shouldReduceMotion }: { shouldReduceMotion: boolean }) {
  const [activeVerifTab, setActiveVerifTab] = useState<VerifTab>('entitylocker');

  return (
    <div>
      <VerifTabBar active={activeVerifTab} onChange={setActiveVerifTab} />
      <AnimatePresence mode="wait">
        {activeVerifTab === 'entitylocker' && (
          <motion.div key="el" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <EntityLockerTab shouldReduceMotion={shouldReduceMotion} />
          </motion.div>
        )}
        {activeVerifTab === 'aadhaar' && (
          <motion.div key="aadhaar" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <AadhaarTab shouldReduceMotion={shouldReduceMotion} />
          </motion.div>
        )}
        {activeVerifTab === 'unverified' && (
          <motion.div key="unverified" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <UnverifiedSignupForm shouldReduceMotion={shouldReduceMotion} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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

function ActionButton({
  onClick,
  isLoading,
  label,
  color,
}: {
  onClick: () => void;
  isLoading: boolean;
  label: string;
  color: string;
}) {
  const { t } = useLocale();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      whileHover={isLoading ? {} : { scale: 1.01, boxShadow: `0 6px 20px ${color}30` }}
      whileTap={isLoading ? {} : { scale: 0.98 }}
      style={{
        width: '100%', padding: '13px', borderRadius: '14px', border: 'none',
        background: isLoading ? `${color}80` : color, color: '#fff', fontSize: '15px',
        fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'inherit',
        marginTop: '4px', transition: 'background 0.2s ease',
      }}
    >
      {isLoading && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
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
  const router = useRouter();
  const { isLoggedIn, dashboardPath } = useAuth();

  useEffect(() => {
    if (isLoggedIn && dashboardPath !== '/signin') {
      window.location.href = dashboardPath;
    }
  }, [isLoggedIn, dashboardPath]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Avoid rendering the login form while redirecting
  if (isLoggedIn) return null;

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
