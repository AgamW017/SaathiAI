import React from 'react';
import { ShieldCheck, ShieldQuestion, Shield } from 'lucide-react';

// Employer verification tiers — kept in sync with backend/src/utils/verification.ts
export type EmployerVerificationStatus =
  | 'unverified'
  | 'phone_verified'
  | 'udyam_verified'
  | 'aadhaar_verified'
  | 'entitylocker_verified'
  | 'fully_verified';

interface TierMeta {
  label: string;
  short: string;
  rank: number;
  fg: string;
  bg: string;
}

const TIERS: Record<EmployerVerificationStatus, TierMeta> = {
  unverified: { label: 'Unverified employer', short: 'Unverified', rank: 0, fg: 'var(--color-risk, #b91c1c)', bg: 'var(--color-risk-surface, rgba(185,28,28,0.1))' },
  phone_verified: { label: 'Phone verified', short: 'Phone', rank: 1, fg: 'var(--color-caution, #b45309)', bg: 'var(--color-caution-surface, rgba(180,83,9,0.1))' },
  udyam_verified: { label: 'Udyam (MSME) verified', short: 'Udyam', rank: 2, fg: 'var(--color-saathi-teal, #004038)', bg: 'var(--color-apricot-wash, rgba(0,64,56,0.08))' },
  aadhaar_verified: { label: 'Aadhaar verified', short: 'Aadhaar', rank: 3, fg: 'var(--color-success, #15803d)', bg: 'var(--color-success-surface, rgba(21,128,61,0.1))' },
  entitylocker_verified: { label: 'EntityLocker verified', short: 'EntityLocker', rank: 3, fg: 'var(--color-success, #15803d)', bg: 'var(--color-success-surface, rgba(21,128,61,0.1))' },
  fully_verified: { label: 'Fully verified', short: 'Verified', rank: 4, fg: 'var(--color-success, #15803d)', bg: 'var(--color-success-surface, rgba(21,128,61,0.12))' },
};

export function verificationMeta(status?: string | null): TierMeta {
  return TIERS[(status as EmployerVerificationStatus)] ?? TIERS.unverified;
}

/**
 * Tiered employer trust badge. Use `compact` for table cells / dense lists.
 */
export default function VerificationBadge({
  status,
  compact = false,
  style: extraStyle = {},
}: {
  status?: string | null;
  compact?: boolean;
  style?: React.CSSProperties;
}) {
  const meta = verificationMeta(status);
  const Icon = meta.rank === 0 ? ShieldQuestion : meta.rank >= 3 ? ShieldCheck : Shield;
  return (
    <span
      title={meta.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: compact ? '10px' : '11px',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        borderRadius: '999px',
        padding: compact ? '3px 8px' : '5px 12px',
        lineHeight: 1,
        color: meta.fg,
        background: meta.bg,
        ...extraStyle,
      }}
    >
      <Icon size={compact ? 11 : 13} strokeWidth={2.5} />
      {compact ? meta.short : meta.label}
    </span>
  );
}
