'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DropdownMenu } from 'radix-ui';
import { AnimatePresence, motion } from 'framer-motion';
import { MoreVertical, Users, Edit2, Bell, Send, UserMinus, Target, Loader2 } from 'lucide-react';
import { trpc } from '../../lib/trpc/client';
import SmartTargetingPanel from './SmartTargetingPanel';

interface VacancyActionsMenuProps {
  vacancy: {
    id: string;
    title: string;
    trade_required: string;
    status: string;
  };
}

interface ToastState {
  type: 'success' | 'info' | 'error';
  message: string;
}

export default function VacancyActionsMenu({ vacancy }: VacancyActionsMenuProps) {
  const router = useRouter();

  const [toast, setToast] = useState<ToastState | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const showToast = useCallback((type: ToastState['type'], message: string) => {
    setToast({ type, message });
  }, []);

  // Broadcast mutation shared across sub-menu notification actions
  const broadcastMutation = trpc.employer.vacancies.broadcast.useMutation();

  // Auto-dismiss success/info toasts after 5 seconds; error toasts persist
  useEffect(() => {
    if (!toast || toast.type === 'error') return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleBroadcastAllMatching = () => {
    setIsBroadcasting(true);
    broadcastMutation.mutate(
      { vacancy_id: vacancy.id, filters: { trade: vacancy.trade_required } },
      {
        onSuccess: (data) => {
          setIsBroadcasting(false);
          if (data.count > 0) {
            showToast('success', `Notified ${data.count} learners`);
          } else {
            showToast('info', 'No matching learners found');
          }
        },
        onError: (error) => {
          setIsBroadcasting(false);
          if (error.data?.code === 'TOO_MANY_REQUESTS') {
            showToast('error', 'Daily broadcast limit reached (5 per day)');
          } else {
            showToast('error', 'Broadcast could not be completed. Please retry.');
          }
        },
      }
    );
  };

  return (
    <>
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={`Actions for ${vacancy.title}`}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#8a8886',
            padding: 4,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <MoreVertical size={18} />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
            padding: 6,
            minWidth: 200,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            zIndex: 50,
            animationDuration: '0.2s',
          }}
        >
          <DropdownMenu.Item
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              color: '#333942',
              cursor: 'pointer',
              outline: 'none',
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f4f2'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            onFocus={(e) => { e.currentTarget.style.background = '#f5f4f2'; }}
            onBlur={(e) => { e.currentTarget.style.background = 'transparent'; }}
            onSelect={() => {
              if (!vacancy.id) {
                console.error('Vacancy could not be identified');
                return;
              }
              router.push(`/dashboard/employer/pipeline?vacancy_id=${vacancy.id}`);
            }}
          >
            <Users size={16} color="#615f5c" />
            View Applicants
          </DropdownMenu.Item>

          <DropdownMenu.Item
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              color: '#333942',
              cursor: 'pointer',
              outline: 'none',
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f4f2'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            onFocus={(e) => { e.currentTarget.style.background = '#f5f4f2'; }}
            onBlur={(e) => { e.currentTarget.style.background = 'transparent'; }}
            onSelect={() => {
              if (!vacancy.id) {
                console.error('Vacancy could not be identified');
                return;
              }
              router.push(`/dashboard/employer/vacancies/${vacancy.id}/edit`);
            }}
          >
            <Edit2 size={16} color="#615f5c" />
            Edit Vacancy
          </DropdownMenu.Item>

          <DropdownMenu.Separator
            style={{
              height: 1,
              background: 'rgba(0,0,0,0.06)',
              margin: '6px 0',
            }}
          />

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                color: '#333942',
                cursor: 'pointer',
                outline: 'none',
                transition: 'background 0.12s',
                justifyContent: 'space-between',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f4f2'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              onFocus={(e) => { e.currentTarget.style.background = '#f5f4f2'; }}
              onBlur={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Bell size={16} color="#615f5c" />
                Notify Learners
              </span>
              <span style={{ fontSize: 12, color: '#8a8886' }}>›</span>
            </DropdownMenu.SubTrigger>

            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                sideOffset={8}
                alignOffset={-4}
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  border: '1px solid rgba(0,0,0,0.08)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
                  padding: 6,
                  minWidth: 220,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  zIndex: 51,
                  animationDuration: '0.2s',
                }}
              >
                <DropdownMenu.Item
                  disabled={isBroadcasting}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    color: isBroadcasting ? '#8a8886' : '#333942',
                    cursor: isBroadcasting ? 'not-allowed' : 'pointer',
                    outline: 'none',
                    transition: 'background 0.12s',
                    opacity: isBroadcasting ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => { if (!isBroadcasting) e.currentTarget.style.background = '#f5f4f2'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  onFocus={(e) => { if (!isBroadcasting) e.currentTarget.style.background = '#f5f4f2'; }}
                  onBlur={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  onSelect={(e) => {
                    e.preventDefault();
                    if (!isBroadcasting) {
                      handleBroadcastAllMatching();
                    }
                  }}
                >
                  {isBroadcasting ? (
                    <Loader2 size={16} color="#8a8886" style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Send size={16} color="#16a34a" />
                  )}
                  {isBroadcasting ? 'Sending...' : 'Send to All Matching'}
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  disabled={isBroadcasting}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    color: isBroadcasting ? '#8a8886' : '#333942',
                    cursor: isBroadcasting ? 'not-allowed' : 'pointer',
                    outline: 'none',
                    transition: 'background 0.12s',
                    opacity: isBroadcasting ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => { if (!isBroadcasting) e.currentTarget.style.background = '#f5f4f2'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  onFocus={(e) => { if (!isBroadcasting) e.currentTarget.style.background = '#f5f4f2'; }}
                  onBlur={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  onSelect={(e) => {
                    e.preventDefault();
                    if (isBroadcasting) return;
                    setIsBroadcasting(true);
                    broadcastMutation.mutate(
                      { vacancy_id: vacancy.id, filters: { trade: vacancy.trade_required }, exclude_applied: true },
                      {
                        onSuccess: (data) => {
                          setIsBroadcasting(false);
                          if (data.count > 0) {
                            showToast('success', `Notified ${data.count} learners`);
                          } else {
                            showToast('info', 'All matching learners already notified');
                          }
                        },
                        onError: (error) => {
                          setIsBroadcasting(false);
                          if (error.data?.code === 'TOO_MANY_REQUESTS') {
                            showToast('error', 'Daily broadcast limit reached (5 per day)');
                          } else {
                            showToast('error', 'Broadcast could not be completed. Please retry.');
                          }
                        },
                      }
                    );
                  }}
                >
                  {isBroadcasting ? (
                    <Loader2 size={16} color="#8a8886" style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <UserMinus size={16} color="#ca8a04" />
                  )}
                  {isBroadcasting ? 'Sending...' : 'Send to All Except Applied'}
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#333942',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f4f2'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  onFocus={(e) => { e.currentTarget.style.background = '#f5f4f2'; }}
                  onBlur={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  onSelect={() => {
                    setShowModal(true);
                  }}
                >
                  <Target size={16} color="#7c3aed" />
                  Custom Targeting
                </DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>

      {/* Custom Targeting Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                background: '#fff',
                borderRadius: 16,
                padding: 24,
                maxWidth: 600,
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <SmartTargetingPanel
                vacancyId={vacancy.id}
                onBroadcastComplete={(count: number) => {
                  setShowModal(false);
                  showToast('success', `Notified ${count} learners`);
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast notification - rendered outside DropdownMenu for visibility */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 9999,
              padding: '14px 20px',
              borderRadius: 12,
              boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 14,
              fontWeight: 500,
              color: '#fff',
              maxWidth: 360,
              background:
                toast.type === 'success'
                  ? '#16a34a'
                  : toast.type === 'info'
                  ? '#2563eb'
                  : '#dc2626',
            }}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
