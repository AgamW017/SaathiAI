import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const conversation = [
  {
    id: 1,
    type: 'ai',
    delay: 600,
    content: (
      <span>
        🎓 <em>Badhaai ho Ramu ji!</em> आपने Electrician (NSQF Level 3) complete कर लिया।
        <br />मैं SaathiAI हूँ — आपका career साथी। आपके लिए 3 काम के मौके ढूंढ रहा हूँ... 🔍
      </span>
    ),
  },
  {
    id: 2,
    type: 'typing',
    delay: 1800,
  },
  {
    id: 3,
    type: 'ai',
    delay: 3400,
    content: (
      <span style={{ lineHeight: 1.7 }}>
        ⚡ <strong>आपके लिए 3 मौके मिले:</strong>
        <br /><br />
        1. <strong>Electrician Helper</strong> — Varanasi
        <br />&nbsp;&nbsp;&nbsp;₹12,000/mo · 3.2 km दूर · NAPS
        <br /><br />
        2. <strong>Wiring Technician</strong> — Sarnath
        <br />&nbsp;&nbsp;&nbsp;₹14,500/mo · 8.1 km दूर
        <br /><br />
        3. <strong>Apprentice Electrician</strong> — Mirzapur
        <br />&nbsp;&nbsp;&nbsp;₹10,000/mo · NSDC verified
        <br /><br />
        किसमें interest है? 1, 2 या 3 लिखें 👇
      </span>
    ),
  },
  {
    id: 4,
    type: 'user',
    delay: 5200,
    content: <span>1</span>,
  },
  {
    id: 5,
    type: 'ai',
    delay: 6400,
    content: (
      <span>
        ✅ <strong>Perfect choice!</strong> Interview के लिए ready करते हैं...
        <br />
        <span style={{
          display: 'inline-block',
          marginTop: '10px',
          background: 'var(--color-saathi-teal)',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: 'var(--font-body)',
        }}>
          Mock Interview शुरू करें ▶
        </span>
      </span>
    ),
  },
];

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'rgba(0,64,56,0.4)',
          }}
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

export default function PhoneMockup() {
  const [visibleMessages, setVisibleMessages] = useState<any[]>([]);
  const [phase, setPhase] = useState(0); // 0=animating, 1=full, 2=fading
  const chatRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout[]>([]);

  const startAnimation = () => {
    setVisibleMessages([]);
    setPhase(0);

    conversation.forEach((msg) => {
      const t = setTimeout(() => {
        if (msg.type === 'typing') {
          setVisibleMessages(prev => [...prev, msg]);
          const hideTyping = setTimeout(() => {
            setVisibleMessages(prev => prev.filter(m => m.id !== msg.id));
          }, 1400);
          timerRef.current.push(hideTyping);
        } else {
          setVisibleMessages(prev => [...prev.filter(m => m.type !== 'typing'), msg]);
        }
      }, msg.delay);
      timerRef.current.push(t);
    });

    // After full conversation, wait then restart
    const restartT = setTimeout(() => {
      setPhase(2);
      const clearT = setTimeout(() => {
        startAnimation();
      }, 1000);
      timerRef.current.push(clearT);
    }, 12000);
    timerRef.current.push(restartT);
  };

  useEffect(() => {
    startAnimation();
    return () => timerRef.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [visibleMessages]);

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {/* Floating badges */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', top: '30px', right: '-30px', zIndex: 10,
          background: '#fff', border: '1px solid var(--color-mist)',
          borderRadius: '12px', padding: '8px 14px',
          boxShadow: 'var(--shadow-card)',
          fontSize: '12px', fontFamily: 'var(--font-body)',
          fontWeight: 600, color: 'var(--color-saathi-teal)',
          whiteSpace: 'nowrap',
        }}
      >
        🔒 DigiLocker Verified
      </motion.div>

      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', top: '140px', left: '-50px', zIndex: 10,
          background: 'var(--color-parchment-glow)', borderRadius: '12px',
          padding: '8px 14px', fontSize: '12px',
          fontFamily: 'var(--font-body)', fontWeight: 600,
          color: 'var(--color-saathi-teal)', whiteSpace: 'nowrap',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        📍 Varanasi, UP
      </motion.div>

      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', bottom: '80px', right: '-44px', zIndex: 10,
          background: 'var(--color-success-surface)', borderRadius: '12px',
          padding: '8px 14px', fontSize: '12px',
          fontFamily: 'var(--font-body)', fontWeight: 600,
          color: 'var(--color-success)', whiteSpace: 'nowrap',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        ⭐ 94% Match
      </motion.div>

      {/* Phone frame */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 320, height: 580,
          background: '#1a1a2e',
          borderRadius: 36,
          border: '8px solid #1a1a2e',
          boxShadow: 'var(--shadow-modal), 0 0 0 2px rgba(255,255,255,0.08)',
          overflow: 'hidden',
          transform: 'rotate(3deg)',
          flexShrink: 0,
        }}
      >
        <AnimatePresence>
          {phase === 2 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute', inset: 0,
                background: '#1a1a2e', zIndex: 20,
              }}
            />
          )}
        </AnimatePresence>

        {/* WhatsApp header */}
        <div style={{
          background: '#075e54',
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px',
          }}>🤝</div>
          <div>
            <div style={{ color: '#fff', fontSize: '15px', fontFamily: 'var(--font-body)', fontWeight: 600 }}>SaathiAI 🤝</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', fontFamily: 'var(--font-body)' }}>Online</span>
            </div>
          </div>
        </div>

        {/* Chat area */}
        <div
          ref={chatRef}
          style={{
            flex: 1,
            background: '#e5ddd5',
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h60v60H0z' fill='%23e5ddd5'/%3E%3Ccircle cx='30' cy='30' r='1' fill='rgba(0,0,0,0.04)'/%3E%3C/svg%3E")`,
            height: 'calc(100% - 60px)',
            overflowY: 'auto',
            padding: '12px',
            display: 'flex', flexDirection: 'column', gap: '8px',
            scrollbarWidth: 'none',
          }}
        >
          <AnimatePresence>
            {visibleMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                style={{
                  display: 'flex',
                  justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                {msg.type === 'typing' ? (
                  <div style={{
                    background: 'var(--color-bubble-ai)',
                    borderRadius: '0 16px 16px 16px',
                    padding: '10px 14px',
                    maxWidth: '70%',
                  }}>
                    <TypingDots />
                  </div>
                ) : (
                  <div
                    style={{
                      background: msg.type === 'user' ? 'var(--color-bubble-learner)' : 'var(--color-bubble-ai)',
                      borderRadius: msg.type === 'user' ? '16px 0 16px 16px' : '0 16px 16px 16px',
                      padding: '10px 14px',
                      maxWidth: '85%',
                      fontSize: '13px',
                      fontFamily: 'var(--font-body)',
                      color: 'var(--color-ink-black)',
                      lineHeight: 1.55,
                    }}
                  >
                    {msg.content}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
