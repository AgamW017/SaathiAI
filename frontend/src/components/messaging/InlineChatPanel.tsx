'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { trpc } from '../../lib/trpc/client';
import MessageThread from './MessageThread';

interface InlineChatPanelProps {
  learnerId: string;
  learnerName: string;
}

const MAX_MESSAGE_LENGTH = 1000;

function ShimmerSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: i % 2 === 0 ? 'flex-end' : 'flex-start',
          }}
        >
          <div
            style={{
              width: i === 1 ? '60%' : i === 2 ? '45%' : '55%',
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

export default function InlineChatPanel({ learnerId, learnerName }: InlineChatPanelProps) {
  const [message, setMessage] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    data: threadData,
    isLoading,
    refetch,
  } = trpc.employer.messaging.getThread.useQuery(
    { learnerId },
    { refetchInterval: 5000 }
  );

  const sendPing = trpc.employer.messaging.sendPing.useMutation({
    onSuccess: () => {
      setMessage('');
      setSendError(null);
      refetch();
    },
    onError: (error) => {
      setSendError(error.message || 'Failed to send message');
    },
  });

  const messages = threadData?.messages ?? [];

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return;
    setSendError(null);
    sendPing.mutate({ learnerId, message: trimmed });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const charCount = message.length;
  const isOverLimit = charCount > MAX_MESSAGE_LENGTH;
  const canSend = message.trim().length > 0 && !isOverLimit && !sendPing.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        height: 480,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#004038',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
            color: '#fff',
            flexShrink: 0,
          }}
        >
          {learnerName.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f161e' }}>
            {learnerName}
          </div>
          <div style={{ fontSize: 12, color: '#615f5c' }}>WhatsApp messages</div>
        </div>
      </div>

      {/* Message Area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {isLoading ? (
          <ShimmerSkeleton />
        ) : messages.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              textAlign: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 14, color: '#615f5c', marginBottom: 4 }}>
                No messages yet
              </div>
              <div style={{ fontSize: 13, color: '#9ca3af' }}>
                Send a message to start the conversation with {learnerName}
              </div>
            </div>
          </div>
        ) : (
          <>
            <MessageThread messages={messages} />
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div
        style={{
          borderTop: '1px solid rgba(0,0,0,0.06)',
          padding: '12px 16px',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={2}
            style={{
              flex: 1,
              resize: 'none',
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 14,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              outline: 'none',
              lineHeight: 1.4,
              transition: 'border-color 0.15s',
              borderColor: isOverLimit ? '#ef4444' : 'rgba(0,0,0,0.1)',
            }}
            onFocus={(e) => {
              if (!isOverLimit) {
                e.currentTarget.style.borderColor = '#004038';
              }
            }}
            onBlur={(e) => {
              if (!isOverLimit) {
                e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)';
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              border: 'none',
              background: canSend ? '#fa5d00' : '#e5e5e5',
              color: canSend ? '#fff' : '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: canSend ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
              flexShrink: 0,
            }}
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>

        {/* Character counter and error */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 6,
            minHeight: 18,
          }}
        >
          <div style={{ fontSize: 12, color: '#ef4444', flex: 1 }}>
            {sendError && <span>{sendError}</span>}
          </div>
          <div
            style={{
              fontSize: 12,
              color: isOverLimit ? '#ef4444' : charCount > 900 ? '#f59e0b' : '#9ca3af',
              fontWeight: isOverLimit ? 600 : 400,
              flexShrink: 0,
            }}
          >
            {charCount}/{MAX_MESSAGE_LENGTH}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
