import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

const stats = [
  {
    number: '8–23%',
    label: 'PMKVY Placement Rate',
    plain: "That's 3 out of 4 trained — wasted.",
    source: 'PMKVY 2.0 & 3.0 data',
    isRange: true,
  },
  {
    number: '22',
    suffix: '%',
    label: 'New Hires Quit Within 90 Days',
    plain: 'Entry-level blue-collar attrition — employers burned.',
    source: 'HR retention surveys',
    countTo: 22,
  },
  {
    number: '71',
    suffix: '%',
    label: 'MSMEs Say Govt Skilling Didn\'t Help',
    plain: 'Manufacturing MSME survey — majority unconvinced.',
    source: 'KPMG MSME Report',
    countTo: 71,
  },
  {
    number: '<1',
    suffix: '%',
    label: 'Trainees Submitted Feedback',
    plain: 'Near-zero feedback = invisible problem.',
    source: 'CAG Audit, Sep 2022',
    isLess: true,
  },
  {
    number: '1270',
    label: 'Days Some Graduates Waited for Certificate',
    plain: '3+ years — career stuck at the starting line.',
    source: 'CAG Audit: Assessment Delay',
    countTo: 1270,
    suffix: '',
  },
];

function CountUp({ target, duration = 1.8, suffix = '', isRange, isLess, triggered }) {
  const motionVal = useMotionValue(0);
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    if (!triggered) return;
    if (isRange || isLess) return;
    const controls = animate(motionVal, target, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v).toString()),
    });
    return controls.stop;
  }, [triggered, target]);

  if (isRange) return <span>8–23{suffix}</span>;
  if (isLess) return <span>&lt;1{suffix}</span>;
  return <span>{display}{suffix}</span>;
}

function StatCard({ stat, delay, triggered }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={triggered ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '16px',
        padding: '28px 24px',
        transition: 'background 0.2s ease, transform 0.2s ease',
        transform: hovered ? 'scale(1.02)' : 'scale(1)',
        cursor: 'default',
      }}
    >
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(36px, 4vw, 56px)',
        color: 'var(--color-parchment-glow)',
        lineHeight: 1.1,
        marginBottom: '8px',
      }}>
        <CountUp
          target={stat.countTo}
          suffix={stat.suffix}
          isRange={stat.isRange}
          isLess={stat.isLess}
          triggered={triggered}
          duration={stat.countTo === 1270 ? 2.2 : 1.8}
        />
      </div>
      <div style={{
        fontFamily: 'var(--font-body)', fontWeight: 500,
        fontSize: '14px', color: '#fff',
        lineHeight: 1.4, marginBottom: '8px',
      }}>
        {stat.label}
      </div>
      <div style={{
        fontFamily: 'var(--font-body)', fontSize: '11px',
        color: 'rgba(255,255,255,0.5)', lineHeight: 1.4,
        marginBottom: '4px', fontStyle: 'italic',
      }}>
        {stat.plain}
      </div>
      <div style={{
        fontFamily: 'var(--font-body)', fontSize: '10px',
        color: 'rgba(255,255,255,0.35)',
      }}>
        {stat.source}
      </div>
    </motion.div>
  );
}

export default function CrisisStrip() {
  const [ref, inView] = useInView({ threshold: 0.15, triggerOnce: true });

  return (
    <section style={{
      background: 'radial-gradient(ellipse at 30% 50%, #00544c 0%, #004038 60%, #002d28 100%)',
      padding: '56px 0',
    }} ref={ref}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 3vw, 38px)',
            color: '#fff', textAlign: 'center',
            marginBottom: '48px',
          }}
        >
          The numbers that make this urgent.
        </motion.h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}>
          {stats.map((stat, i) => (
            <StatCard key={i} stat={stat} delay={i * 0.1} triggered={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}
