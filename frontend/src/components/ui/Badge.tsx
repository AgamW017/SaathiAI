import React from 'react';

const variants: Record<string, React.CSSProperties> = {
  flame: { background: 'rgba(250,93,0,0.1)', color: 'var(--color-action-flame)' },
  teal: { background: 'rgba(0,64,56,0.1)', color: 'var(--color-saathi-teal)' },
  success: { background: 'var(--color-success-surface)', color: 'var(--color-success)' },
  caution: { background: 'var(--color-caution-surface)', color: 'var(--color-caution)' },
  risk: { background: 'var(--color-risk-surface)', color: 'var(--color-risk)' },
  parchment: { background: 'var(--color-parchment-glow)', color: 'var(--color-saathi-teal)' },
  apricot: { background: 'var(--color-apricot-wash)', color: 'var(--color-saathi-teal)' },
  white: { background: 'var(--color-pure-white)', color: 'var(--color-saathi-teal)', border: '1px solid var(--color-mist)' },
  ghost: { background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' },
};

export default function Badge({ variant = 'teal', children, style: extraStyle = {}, ...rest }: { variant?: string; children?: React.ReactNode; style?: React.CSSProperties; [key: string]: any }) {
  const variantStyle = variants[variant] || variants.teal;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: '11px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        borderRadius: '999px',
        padding: '5px 12px',
        lineHeight: 1,
        ...variantStyle,
        ...extraStyle,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
