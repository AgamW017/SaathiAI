'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Briefcase, MapPin, Award, User, Calendar, ChevronRight } from 'lucide-react';
import { trpc } from '../../../../../lib/trpc/client';
import InlineChatPanel from '../../../../../components/messaging/InlineChatPanel';

const STAGES = [
  { id: 'new_match', label: 'New Match' },
  { id: 'skill_card_viewed', label: 'Viewed Card' },
  { id: 'interest_expressed', label: 'Interested' },
  { id: 'interview_scheduled', label: 'Interview Scheduled' },
  { id: 'interview_completed', label: 'Interview Done' },
  { id: 'offer_extended', label: 'Offer Extended' },
  { id: 'hired', label: 'Hired' },
  { id: 'rejected', label: 'Rejected' },
] as const;

type Stage = (typeof STAGES)[number]['id'];

function getNextStages(current: Stage): Stage[] {
  const transitions: Record<string, Stage[]> = {
    new_match: ['skill_card_viewed', 'rejected'],
    skill_card_viewed: ['interest_expressed', 'rejected'],
    interest_expressed: ['interview_scheduled', 'rejected'],
    interview_scheduled: ['interview_completed', 'rejected'],
    interview_completed: ['offer_extended', 'rejected'],
    offer_extended: ['hired', 'rejected'],
    hired: [],
    rejected: [],
  };
  return transitions[current] ?? [];
}

function getStageColor(stage: string): string {
  const colors: Record<string, string> = {
    new_match: '#3b82f6',
    skill_card_viewed: '#8b5cf6',
    interest_expressed: '#fa5d00',
    interview_scheduled: '#eab308',
    interview_completed: '#f97316',
    offer_extended: '#f97316',
    hired: '#16a34a',
    rejected: '#ef4444',
  };
  return colors[stage] ?? '#615f5c';
}

function ShimmerBlock({ width, height }: { width: string; height: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 8,
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: '40px 48px', maxWidth: 1200, margin: '0 auto' }}>
      <ShimmerBlock width="120px" height={20} />
      <div style={{ height: 24 }} />
      <ShimmerBlock width="300px" height={36} />
      <div style={{ height: 32 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ShimmerBlock width="100%" height={200} />
          <ShimmerBlock width="100%" height={140} />
        </div>
        <ShimmerBlock width="100%" height={480} />
      </div>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

export default function CandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.matchId as string;

  const { data, isLoading, error } = trpc.employer.pipeline.getCandidateDetail.useQuery(
    { match_id: matchId },
    { enabled: !!matchId }
  );

  const trpcUtils = trpc.useUtils();
  const transitionMutation = trpc.employer.pipeline.transition.useMutation({
    onSuccess: () => {
      trpcUtils.employer.pipeline.getCandidateDetail.invalidate({ match_id: matchId });
    },
    onError: (err) => {
      alert('Transition failed: ' + err.message);
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  if (error || !data) {
    return (
      <div style={{ padding: '40px 48px', textAlign: 'center' }}>
        <div style={{ fontSize: 16, color: '#ef4444', marginBottom: 16 }}>
          {error?.message ?? 'Candidate not found'}
        </div>
        <button
          onClick={() => router.push('/dashboard/employer/pipeline')}
          style={{
            padding: '10px 20px',
            background: '#fa5d00',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Back to Pipeline
        </button>
      </div>
    );
  }

  const learner = data.learners;
  const vacancy = data.vacancies;
  const currentStage = data.stage as Stage;
  const stageLabel = STAGES.find((s) => s.id === currentStage)?.label ?? currentStage;
  const nextStages = getNextStages(currentStage);
  const skillCard = learner?.skill_cards?.[0] ?? null;

  const handleTransition = (toStage: Stage) => {
    if (transitionMutation.isPending) return;
    transitionMutation.mutate({ match_id: matchId, to_stage: toStage });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ padding: '32px 48px', maxWidth: 1200, margin: '0 auto' }}
    >
      {/* Back button */}
      <button
        onClick={() => router.push('/dashboard/employer/pipeline')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          color: '#615f5c',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          padding: '4px 0',
          marginBottom: 20,
        }}
      >
        <ArrowLeft size={16} />
        Back to Pipeline
      </button>

      {/* Page heading */}
      <h1
        style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 24,
          fontWeight: 700,
          color: '#0f161e',
          margin: '0 0 8px',
        }}
      >
        {learner?.full_name ?? 'Candidate'}
      </h1>
      <p style={{ color: '#615f5c', margin: '0 0 28px', fontSize: 14 }}>
        Pipeline candidate for <strong>{vacancy?.title}</strong>
      </p>

      {/* Two column layout: Profile + Chat */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 28 }}>
        {/* Left column: Profile info and stage controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Learner profile card */}
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
              padding: 24,
            }}
          >
            <h2
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: 16,
                fontWeight: 700,
                color: '#0f161e',
                margin: '0 0 16px',
              }}
            >
              Learner Profile
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#fa5d0015',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fa5d00',
                  }}
                >
                  <User size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#8a8886' }}>Name</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f161e' }}>
                    {learner?.full_name}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#fa5d0015',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fa5d00',
                  }}
                >
                  <Briefcase size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#8a8886' }}>Trade</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f161e' }}>
                    {learner?.trade ?? '—'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#fa5d0015',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fa5d00',
                  }}
                >
                  <MapPin size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#8a8886' }}>District</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f161e' }}>
                    {learner?.district ?? '—'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#fa5d0015',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fa5d00',
                  }}
                >
                  <Award size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#8a8886' }}>Skill Card</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f161e' }}>
                    {skillCard
                      ? `${skillCard.trade} (${skillCard.verification_status})`
                      : 'Not available'}
                  </div>
                </div>
              </div>
            </div>

            {/* Skills list from skill card */}
            {skillCard?.skills && skillCard.skills.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: '#8a8886', marginBottom: 8 }}>Skills</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {skillCard.skills.map((skill: string, i: number) => (
                    <span
                      key={i}
                      style={{
                        padding: '4px 10px',
                        background: '#fa5d0010',
                        color: '#fa5d00',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Vacancy context card */}
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
              padding: 24,
            }}
          >
            <h2
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: 16,
                fontWeight: 700,
                color: '#0f161e',
                margin: '0 0 16px',
              }}
            >
              Vacancy Context
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#8a8886' }}>Position</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0f161e' }}>
                  {vacancy?.title}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#8a8886' }}>Trade Required</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0f161e' }}>
                  {vacancy?.trade_required}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#8a8886' }}>Salary Range</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0f161e' }}>
                  ₹{vacancy?.salary_min?.toLocaleString('en-IN')} – ₹
                  {vacancy?.salary_max?.toLocaleString('en-IN')}
                </span>
              </div>
              {vacancy?.district && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: '#8a8886' }}>Location</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#0f161e' }}>
                    {vacancy.district}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Pipeline stage card with transition controls */}
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
              padding: 24,
            }}
          >
            <h2
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: 16,
                fontWeight: 700,
                color: '#0f161e',
                margin: '0 0 16px',
              }}
            >
              Pipeline Stage
            </h2>

            {/* Current stage badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: getStageColor(currentStage),
                }}
              />
              <span style={{ fontSize: 16, fontWeight: 700, color: '#0f161e' }}>
                {stageLabel}
              </span>
            </div>

            {/* Stage transition buttons */}
            {nextStages.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: '#8a8886', marginBottom: 10 }}>
                  Move to next stage:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {nextStages.map((stage) => {
                    const label = STAGES.find((s) => s.id === stage)?.label ?? stage;
                    const isReject = stage === 'rejected';
                    return (
                      <button
                        key={stage}
                        onClick={() => handleTransition(stage)}
                        disabled={transitionMutation.isPending}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 16px',
                          borderRadius: 8,
                          border: isReject
                            ? '1px solid rgba(239,68,68,0.3)'
                            : '1px solid rgba(250,93,0,0.3)',
                          background: isReject ? '#fef2f2' : '#fff8f1',
                          color: isReject ? '#ef4444' : '#fa5d00',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: transitionMutation.isPending ? 'not-allowed' : 'pointer',
                          opacity: transitionMutation.isPending ? 0.6 : 1,
                          transition: 'all 0.15s',
                        }}
                      >
                        <ChevronRight size={14} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {nextStages.length === 0 && (
              <div style={{ fontSize: 13, color: '#615f5c', fontStyle: 'italic' }}>
                This candidate has reached a terminal stage.
              </div>
            )}
          </div>
        </div>

        {/* Right column: InlineChatPanel */}
        <div style={{ position: 'sticky', top: 32, alignSelf: 'start' }}>
          <InlineChatPanel
            learnerId={learner?.id ?? ''}
            learnerName={learner?.full_name ?? 'Candidate'}
          />
        </div>
      </div>
    </motion.div>
  );
}
