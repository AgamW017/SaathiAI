import React from 'react';

const styles: Record<string, React.CSSProperties> = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '15px',
    borderRadius: '16px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    lineHeight: 1,
  },
  flame: {
    background: 'var(--color-action-flame)',
    color: '#fff',
    padding: '14px 28px',
  },
  flameLg: {
    background: 'var(--color-action-flame)',
    color: '#fff',
    padding: '16px 36px',
    fontSize: '16px',
  },
  tealOutline: {
    background: 'transparent',
    color: 'var(--color-saathi-teal)',
    border: '1.5px solid var(--color-saathi-teal)',
    padding: '14px 28px',
  },
  tealOutlineLg: {
    background: 'transparent',
    color: 'var(--color-saathi-teal)',
    border: '1.5px solid var(--color-saathi-teal)',
    padding: '16px 36px',
    fontSize: '16px',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-warm-stone)',
    padding: '10px 16px',
    fontWeight: 500,
  },
};

export default function Button({ variant = 'flame', size = 'md', children, onClick, href, ...rest }: { variant?: string; size?: string; children?: React.ReactNode; onClick?: () => void; href?: string; [key: string]: any }) {
  const variantKey = size === 'lg'
    ? (variant === 'flame' ? 'flameLg' : variant === 'teal-outline' ? 'tealOutlineLg' : variant)
    : (variant === 'teal-outline' ? 'tealOutline' : variant);

  const style = { ...styles.base, ...(styles[variantKey] || styles.flame) };

  const hoverStyle: Record<string, React.CSSProperties> = {
    flame: { background: '#e05300', boxShadow: 'var(--shadow-card-warm)', transform: 'translateY(-1px)' },
    flameLg: { background: '#e05300', boxShadow: 'var(--shadow-card-warm)', transform: 'translateY(-1px)' },
    tealOutline: { background: 'rgba(0,64,56,0.06)', transform: 'translateY(-1px)' },
    tealOutlineLg: { background: 'rgba(0,64,56,0.06)', transform: 'translateY(-1px)' },
    ghost: { color: 'var(--color-ink-black)' },
  };

  const [hovered, setHovered] = React.useState(false);

  const finalStyle = hovered ? { ...style, ...(hoverStyle[variantKey] || {}) } : style;

  if (href) {
    return (
      <a
        href={href}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        {...rest}
        style={{ ...finalStyle, ...rest.style }}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...rest}
      style={{ ...finalStyle, ...rest.style }}
    >
      {children}
    </button>
  );
}
