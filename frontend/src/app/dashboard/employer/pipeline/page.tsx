'use client';

import React, { useState, useMemo } from 'react';
import { trpc } from '../../../../lib/trpc/client';
import {
  DndContext, DragOverlay, pointerWithin, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragStartEvent, DragEndEvent, useDroppable
} from '@dnd-kit/core';
import { useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MapPin, Briefcase, Eye, Copy, Check } from 'lucide-react';

const STAGES = [
  { id: 'new_match', label: 'New Matches', color: '#3b82f6' },
  { id: 'skill_card_viewed', label: 'Viewed Card', color: '#8b5cf6' },
  { id: 'interest_expressed', label: 'Interested', color: '#fa5d00' },
  { id: 'interview_scheduled', label: 'Interview', color: '#eab308' },
  { id: 'offer_extended', label: 'Offered', color: '#f97316' },
  { id: 'hired', label: 'Hired', color: '#16a34a' },
  { id: 'rejected', label: 'Rejected', color: '#ef4444' },
] as const;

// Complete explicit transition map — no heuristics, no +-1 logic
const VALID_TRANSITIONS: Record<string, string[]> = {
  new_match:          ['skill_card_viewed', 'interest_expressed', 'interview_scheduled', 'rejected'],
  skill_card_viewed:  ['interest_expressed', 'interview_scheduled', 'rejected'],
  interest_expressed: ['skill_card_viewed', 'interview_scheduled', 'offer_extended', 'rejected'],
  interview_scheduled:['interest_expressed', 'offer_extended', 'hired', 'rejected'],
  offer_extended:     ['interview_scheduled', 'hired', 'rejected'],
  hired:              [],
  rejected:           ['new_match', 'skill_card_viewed', 'interest_expressed'],
};

type Match = any;

// ─── Droppable Column ─────────────────────────────────────────────────────────

function DroppableColumn({ id, label, color, count, isValid, isHovering, isInvalid, children }: {
  id: string; label: string; color: string; count: number;
  isValid: boolean; isHovering: boolean; isInvalid: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const hovering = isOver || isHovering;

  return (
    <div ref={setNodeRef} style={{
      display: 'flex', flexDirection: 'column', width: 300, flexShrink: 0,
      borderRadius: 16,
      border: hovering && isValid ? '2px solid #16a34a' : isValid ? '2px dashed #16a34a80' : isInvalid ? '1px dashed #ef444440' : '1px solid rgba(0,0,0,0.05)',
      background: hovering && isValid ? '#f0fdf4' : isValid ? '#f9fefb' : '#f5f4f2',
      transition: 'all 0.15s ease',
      opacity: isInvalid ? 0.45 : 1,
    }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f161e', margin: 0 }}>{label}</h3>
          <div style={{ marginLeft: 'auto', background: 'rgba(0,0,0,0.05)', color: '#615f5c', fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>
            {count}
          </div>
        </div>
      </div>
      <div style={{ padding: 16, flex: 1, overflowY: 'auto', minHeight: 100 }}>
        {children}
      </div>
    </div>
  );
}

// ─── Draggable Card ───────────────────────────────────────────────────────────

function DraggableCard({ match, onViewCard, onTransition }: { match: Match; onViewCard: (url: string) => void; onTransition: (id: string, stage: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: match.id });

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }} {...attributes} {...listeners}>
      <CardContent match={match} onViewCard={onViewCard} onTransition={onTransition} />
    </div>
  );
}

function CardContent({ match, onViewCard, onTransition }: { match: Match; onViewCard?: (url: string) => void; onTransition?: (id: string, stage: string) => void }) {
  const trpcUtils = trpc.useUtils();
  const [copied, setCopied] = useState(false);
  const generateLink = trpc.employer.skillCard.generate.useMutation({
    onSuccess: () => trpcUtils.employer.pipeline.list.invalidate(),
  });

  return (
    <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', marginBottom: 12, cursor: 'grab' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#fa5d0022', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fa5d00' }}>
          {(match?.learners as any)?.aadhaar_photo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={(match.learners as any).aadhaar_photo_url} alt={match?.learners?.full_name ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (match?.learners?.full_name ?? '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f161e' }}>{match?.learners?.full_name}</div>
      </div>
      <div style={{ fontSize: 12, color: '#615f5c', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Briefcase size={12} /> {match?.learners?.trade}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {match?.learners?.district}</div>
        {match?.vacancies?.title && <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#2563eb', fontWeight: 600 }}>Role: {match.vacancies.title}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {!match?.skill_card_token ? (
          <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); generateLink.mutate({ match_id: match.id }); }}
            style={{ flex: 1, padding: '6px', background: '#fa5d0015', color: '#fa5d00', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {generateLink.isPending ? '...' : 'Generate Card'}
          </button>
        ) : (
          <>
            <button onPointerDown={e => e.stopPropagation()} onClick={e => {
              e.stopPropagation();
              onViewCard?.(`/s/${match.skill_card_token}`);
              if (match.stage === 'new_match') onTransition?.(match.id, 'skill_card_viewed');
            }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px', background: '#fa5d0015', color: '#fa5d00', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Eye size={12} /> View Card
            </button>
            <button onPointerDown={e => e.stopPropagation()} onClick={e => {
              e.stopPropagation();
              navigator.clipboard.writeText(window.location.origin + '/s/' + match.skill_card_token);
              setCopied(true); setTimeout(() => setCopied(false), 1500);
            }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 8px', background: copied ? '#dcfce7' : '#f5f4f2', color: copied ? '#16a34a' : '#615f5c', border: `1px solid ${copied ? '#bbf7d0' : '#e5e5e5'}`, borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s' }} title="Copy link">
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const { data: matches, isLoading } = trpc.employer.pipeline.list.useQuery({});
  const transitionMutation = trpc.employer.pipeline.transition.useMutation();
  const trpcUtils = trpc.useUtils();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [cardModalUrl, setCardModalUrl] = useState<string | null>(null);

  React.useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const columns = useMemo(() => {
    const cols: Record<string, Match[]> = {};
    STAGES.forEach(s => cols[s.id] = []);
    (matches ?? []).forEach((m: any) => { if (cols[m.stage]) cols[m.stage].push(m); });
    return cols;
  }, [matches]);

  const validTargets = useMemo(() => {
    if (!activeId || !matches) return new Set<string>();
    const m = matches.find((m: any) => m.id === activeId);
    return new Set(m ? (VALID_TRANSITIONS[m.stage] ?? []) : []);
  }, [activeId, matches]);

  const doTransition = (matchId: string, toStage: string) => {
    trpcUtils.employer.pipeline.list.setData({}, (old: any) =>
      old ? old.map((m: any) => m.id === matchId ? { ...m, stage: toStage } : m) : old
    );
    transitionMutation.mutate(
      { match_id: matchId, to_stage: toStage as any },
      {
        onSuccess: () => setToast({ type: 'success', message: 'Moved' }),
        onError: (err: any) => { setToast({ type: 'error', message: err.message || 'Failed' }); trpcUtils.employer.pipeline.list.invalidate(); },
      }
    );
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const match = matches?.find((m: any) => m.id === e.active.id);
    // The over.id is the column id (from useDroppable)
    const targetColumn = e.over.id as string;
    if (!match || match.stage === targetColumn) return;
    if (!validTargets.has(targetColumn)) return;
    doTransition(e.active.id as string, targetColumn);
  };

  if (isLoading) return <div style={{ padding: 40, color: '#615f5c' }}>Loading pipeline...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '32px 48px 16px' }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: '#0f161e', margin: '0 0 8px' }}>Candidate Pipeline</h1>
        <p style={{ color: '#615f5c', margin: 0 }}>Drag candidates between stages.</p>
      </div>

      <div style={{ flex: 1, padding: '0 48px 48px', overflowX: 'auto', display: 'flex', gap: 20 }}>
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {STAGES.map(stage => {
            const isSource = activeId && matches?.find((m: any) => m.id === activeId)?.stage === stage.id;
            const isValid = !!activeId && validTargets.has(stage.id);
            const isInvalid = !!activeId && !isValid && !isSource;

            return (
              <DroppableColumn key={stage.id} id={stage.id} label={stage.label} color={stage.color}
                count={columns[stage.id]?.length ?? 0} isValid={isValid} isHovering={false} isInvalid={isInvalid}>
                {columns[stage.id]?.map(match => (
                  <DraggableCard key={match.id} match={match} onViewCard={setCardModalUrl} onTransition={doTransition} />
                ))}
              </DroppableColumn>
            );
          })}
          <DragOverlay>
            {activeId ? <CardContent match={matches?.find((m: any) => m.id === activeId)} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, padding: '10px 16px', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontSize: 13, fontWeight: 600, color: '#fff', background: toast.type === 'success' ? '#16a34a' : '#dc2626' }}>
          {toast.message}
        </div>
      )}

      {cardModalUrl && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setCardModalUrl(null)}>
          <div style={{ width: '90%', maxWidth: 420, height: '85vh', background: '#fff', borderRadius: 20, overflow: 'hidden', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setCardModalUrl(null)} style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, background: 'rgba(0,0,0,0.1)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✕</button>
            <iframe src={cardModalUrl} style={{ width: '100%', height: '100%', border: 'none' }} />
          </div>
        </div>
      )}
    </div>
  );
}
