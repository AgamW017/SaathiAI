'use client';

import React, { useState, useMemo } from 'react';
import { trpc } from '../../../../lib/trpc/client';
import {
  DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragStartEvent, DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MapPin, Briefcase, Share2, Phone, Calendar } from 'lucide-react';


const STAGES = [
  { id: 'new_match', label: 'New Matches', color: '#3b82f6' },
  { id: 'skill_card_viewed', label: 'Viewed Card', color: '#8b5cf6' },
  { id: 'interest_expressed', label: 'Interested', color: '#fa5d00' },
  { id: 'interview_scheduled', label: 'Interview', color: '#eab308' },
  { id: 'offer_extended', label: 'Offered', color: '#f97316' },
  { id: 'hired', label: 'Hired', color: '#16a34a' },
  { id: 'rejected', label: 'Rejected', color: '#ef4444' }
] as const;

type Match = any; // Fallback any for quick prototyping

function SortableItem({ match }: { match: Match }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: match.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CandidateCard match={match} />
    </div>
  );
}

function CandidateCard({ match }: { match: Match }) {
  const trpcUtils = trpc.useUtils();
  const generateLink = trpc.employer.skillCard.generate.useMutation({
    onSuccess: (data) => {
      navigator.clipboard.writeText(window.location.origin + data.url);
      alert('Skill Card URL copied to clipboard!');
      trpcUtils.employer.pipeline.list.invalidate();
    }
  });

  return (
    <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', marginBottom: 12, cursor: 'grab' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f161e', marginBottom: 4 }}>{match.learners.full_name}</div>
      <div style={{ fontSize: 12, color: '#615f5c', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Briefcase size={12} /> {match.learners.trade}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {match.learners.district}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#2563eb', fontWeight: 600 }}>Role: {match.vacancies.title}</div>
      </div>
      
      <div style={{ display: 'flex', gap: 8 }}>
        {!match.skill_card_token ? (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); generateLink.mutate({ match_id: match.id }); }}
            style={{ flex: 1, padding: '6px', background: '#fa5d0015', color: '#fa5d00', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            {generateLink.isPending ? '...' : 'Generate Card'}
          </button>
        ) : (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(window.location.origin + '/s/' + match.skill_card_token); alert('Copied!'); }}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px', background: '#f5f4f2', color: '#615f5c', border: '1px solid #e5e5e5', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <Share2 size={12} /> Copy Link
          </button>
        )}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const { data: matches, isLoading } = trpc.employer.pipeline.list.useQuery({});
  const transitionMutation = trpc.employer.pipeline.transition.useMutation();
  const trpcUtils = trpc.useUtils();

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    usePointerSensor(),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Custom pointer sensor to allow clicking buttons inside drag items
  function usePointerSensor() {
    return useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // Wait for 5px movement before dragging
    });
  }

  const columns = useMemo(() => {
    if (!matches) return {};
    const cols: Record<string, Match[]> = {};
    STAGES.forEach(s => cols[s.id] = []);
    matches.forEach((m: any) => {
      if (cols[m.stage]) cols[m.stage].push(m);
    });
    return cols;
  }, [matches]);

  if (isLoading) return <div style={{ padding: 40, color: '#615f5c' }}>Loading pipeline...</div>;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeMatch = matches?.find((m: any) => m.id === active.id);
    const overColumnId = over.data.current?.sortable?.containerId || over.id;

    if (activeMatch && activeMatch.stage !== overColumnId) {
      // Optimistic update
      trpcUtils.employer.pipeline.list.setData({}, (old: any) => {
        if (!old) return old;
        return old.map((m: any) => m.id === active.id ? { ...m, stage: overColumnId } : m);
      });

      // API Call
      transitionMutation.mutate(
        { match_id: active.id as string, to_stage: overColumnId as any },
        {
          onError: (err: any) => {
            alert('Cannot move candidate: ' + err.message);
            trpcUtils.employer.pipeline.list.invalidate(); // revert
          }
        }
      );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '32px 48px 16px' }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: '#0f161e', margin: '0 0 8px' }}>Candidate Pipeline</h1>
        <p style={{ color: '#615f5c', margin: 0 }}>Drag and drop candidates across stages.</p>
      </div>

      <div style={{ flex: 1, padding: '0 48px 48px', overflowX: 'auto', display: 'flex', gap: 20 }}>
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {STAGES.map((stage) => (
            <div key={stage.id} style={{ display: 'flex', flexDirection: 'column', width: 320, flexShrink: 0, background: '#f5f4f2', borderRadius: 16, border: '1px solid rgba(0,0,0,0.05)' }}>
              
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: stage.color }} />
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f161e', margin: 0 }}>{stage.label}</h3>
                  <div style={{ marginLeft: 'auto', background: 'rgba(0,0,0,0.05)', color: '#615f5c', fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>
                    {columns[stage.id]?.length || 0}
                  </div>
                </div>
              </div>

              <div style={{ padding: '16px 16px', flex: 1, overflowY: 'auto' }}>
                <SortableContext id={stage.id} items={columns[stage.id]?.map(m => m.id) || []} strategy={verticalListSortingStrategy}>
                  <div style={{ minHeight: 100 }}>
                    {columns[stage.id]?.map(match => (
                      <SortableItem key={match.id} match={match} />
                    ))}
                  </div>
                </SortableContext>
              </div>

            </div>
          ))}

          <DragOverlay>
            {activeId ? <CandidateCard match={matches?.find((m: any) => m.id === activeId)} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
