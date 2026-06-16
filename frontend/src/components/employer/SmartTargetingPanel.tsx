'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Send, AlertTriangle, CheckCircle, RefreshCw, X } from 'lucide-react';
import { trpc } from '../../lib/trpc/client';

interface SmartTargetingPanelProps {
  vacancyId: string | null;
  onBroadcastComplete: (count: number) => void;
}

interface TargetingFilters {
  trade: string;
  district: string;
  location: string;
}

export default function SmartTargetingPanel({ vacancyId, onBroadcastComplete }: SmartTargetingPanelProps) {
  const [filters, setFilters] = useState<TargetingFilters>({ trade: '', district: '', location: '' });
  const [debouncedFilters, setDebouncedFilters] = useState<TargetingFilters>({ trade: '', district: '', location: '' });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [broadcastSuccess, setBroadcastSuccess] = useState<number | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce filter changes (400ms)
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 400);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [filters]);

  // Build query input - only include non-empty filter values
  const queryInput = {
    ...(debouncedFilters.trade ? { trade: debouncedFilters.trade } : {}),
    ...(debouncedFilters.district ? { district: debouncedFilters.district } : {}),
    ...(debouncedFilters.location ? { location: debouncedFilters.location } : {}),
  };

  const hasAnyFilter = debouncedFilters.trade || debouncedFilters.district || debouncedFilters.location;

  // Live preview count query
  const { data: previewData, isLoading: previewLoading, isError: previewError } = trpc.employer.vacancies.previewTargetCount.useQuery(
    queryInput,
    { enabled: !!hasAnyFilter }
  );

  const previewCount = hasAnyFilter ? (previewData?.count ?? null) : null;

  // Broadcast mutation
  const broadcastMutation = trpc.employer.vacancies.broadcast.useMutation({
    onSuccess: (data) => {
      setBroadcastError(null);
      setBroadcastSuccess(data.count);
      setShowConfirmDialog(false);
      onBroadcastComplete(data.count);
    },
    onError: (error) => {
      setBroadcastError(error.message);
      setShowConfirmDialog(false);
    },
  });

  const handleFilterChange = (field: keyof TargetingFilters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setBroadcastError(null);
    setBroadcastSuccess(null);
  };

  const handleBroadcastClick = () => {
    if (!vacancyId) return;
    if (previewCount === 0) return; // Don't allow broadcast with zero matches
    setShowConfirmDialog(true);
  };

  const handleConfirmBroadcast = () => {
    if (!vacancyId) return;
    broadcastMutation.mutate({
      vacancy_id: vacancyId,
      filters: {
        ...(filters.trade ? { trade: filters.trade } : {}),
        ...(filters.district ? { district: filters.district } : {}),
        ...(filters.location ? { location: filters.location } : {}),
      },
    });
  };

  const handleRetry = () => {
    setBroadcastError(null);
    handleConfirmBroadcast();
  };

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
        padding: 32,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(250,93,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Users size={20} color="#fa5d00" />
        </div>
        <div>
          <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, fontWeight: 700, margin: 0, color: '#0f161e' }}>
            Smart Targeting
          </h3>
          <p style={{ fontSize: 13, color: '#615f5c', margin: 0 }}>
            Define your audience to notify matching learners via WhatsApp
          </p>
        </div>
      </div>

      {/* Filter Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#333942' }}>Trade</label>
          <input
            type="text"
            value={filters.trade}
            onChange={(e) => handleFilterChange('trade', e.target.value)}
            placeholder="e.g. Electrician"
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #d1d0cd',
              fontSize: 14,
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#333942' }}>District</label>
          <input
            type="text"
            value={filters.district}
            onChange={(e) => handleFilterChange('district', e.target.value)}
            placeholder="e.g. Varanasi"
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #d1d0cd',
              fontSize: 14,
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#333942' }}>Location (State)</label>
          <input
            type="text"
            value={filters.location}
            onChange={(e) => handleFilterChange('location', e.target.value)}
            placeholder="e.g. Uttar Pradesh"
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #d1d0cd',
              fontSize: 14,
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />
        </div>
      </div>

      {/* Preview Count */}
      {hasAnyFilter && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '14px 20px',
            borderRadius: 12,
            background: previewCount === 0 ? '#fff7ed' : '#f0fdf4',
            border: `1px solid ${previewCount === 0 ? 'rgba(234,88,12,0.2)' : 'rgba(22,163,74,0.2)'}`,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {previewCount === 0 ? (
              <AlertTriangle size={18} color="#ea580c" />
            ) : (
              <Users size={18} color="#16a34a" />
            )}
            <span style={{ fontSize: 14, fontWeight: 600, color: previewCount === 0 ? '#9a3412' : '#166534' }}>
              {previewLoading ? 'Counting...' : previewError ? '—' : `${previewCount ?? 0} learner${previewCount !== 1 ? 's' : ''} match`}
            </span>
          </div>
          {previewCount === 0 && !previewLoading && (
            <span style={{ fontSize: 12, color: '#c2410c' }}>
              No learners match these criteria. Adjust your filters or proceed without broadcasting.
            </span>
          )}
        </motion.div>
      )}

      {/* Broadcast Error */}
      <AnimatePresence>
        {broadcastError && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{
              padding: '14px 20px',
              borderRadius: 12,
              background: '#fef2f2',
              border: '1px solid rgba(220,38,38,0.2)',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={18} color="#dc2626" />
              <span style={{ fontSize: 14, color: '#991b1b' }}>{broadcastError}</span>
            </div>
            <button
              onClick={handleRetry}
              disabled={broadcastMutation.isPending}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid rgba(220,38,38,0.3)',
                background: '#fff',
                color: '#dc2626',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} /> Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Broadcast Success */}
      <AnimatePresence>
        {broadcastSuccess !== null && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{
              padding: '14px 20px',
              borderRadius: 12,
              background: '#f0fdf4',
              border: '1px solid rgba(22,163,74,0.2)',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <CheckCircle size={18} color="#16a34a" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>
              Broadcast sent to {broadcastSuccess} learner{broadcastSuccess !== 1 ? 's' : ''} via WhatsApp
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Broadcast Button */}
      {!broadcastSuccess && (
        <button
          onClick={handleBroadcastClick}
          disabled={!vacancyId || !hasAnyFilter || previewCount === 0 || previewLoading || broadcastMutation.isPending}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '14px',
            background: (!vacancyId || !hasAnyFilter || previewCount === 0 || previewLoading) ? '#d1d0cd' : '#fa5d00',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 15,
            cursor: (!vacancyId || !hasAnyFilter || previewCount === 0 || previewLoading) ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          <Send size={18} />
          {broadcastMutation.isPending ? 'Broadcasting...' : 'Broadcast to Matching Learners'}
        </button>
      )}

      {/* Disabled state message */}
      {!vacancyId && (
        <p style={{ fontSize: 12, color: '#8a8886', textAlign: 'center', margin: '12px 0 0' }}>
          Save the vacancy first to enable broadcasting.
        </p>
      )}

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {showConfirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setShowConfirmDialog(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#fff',
                borderRadius: 16,
                padding: 32,
                maxWidth: 420,
                width: '90%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h4 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, margin: 0, color: '#0f161e' }}>
                  Confirm Broadcast
                </h4>
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8a8886' }}
                >
                  <X size={20} />
                </button>
              </div>
              <p style={{ fontSize: 14, color: '#333942', margin: '0 0 8px', lineHeight: 1.5 }}>
                You are about to send a WhatsApp notification to:
              </p>
              <div style={{
                padding: '12px 16px',
                background: 'rgba(250,93,0,0.06)',
                borderRadius: 10,
                marginBottom: 20,
                textAlign: 'center',
              }}>
                <span style={{ fontSize: 28, fontWeight: 700, fontFamily: "'DM Serif Display', serif", color: '#fa5d00' }}>
                  {previewCount}
                </span>
                <span style={{ fontSize: 14, color: '#615f5c', marginLeft: 8 }}>
                  learner{previewCount !== 1 ? 's' : ''}
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#615f5c', margin: '0 0 24px' }}>
                Each matching learner will receive a WhatsApp message about this vacancy. This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: 8,
                    border: '1px solid #d1d0cd',
                    background: '#fff',
                    color: '#333942',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmBroadcast}
                  disabled={broadcastMutation.isPending}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#fa5d00',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {broadcastMutation.isPending ? 'Sending...' : 'Confirm & Send'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
