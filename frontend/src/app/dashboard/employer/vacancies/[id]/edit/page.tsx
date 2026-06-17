'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { trpc } from '../../../../../../lib/trpc/client';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

const vacancySchema = z.object({
  title: z.string().min(2, 'Required'),
  trade_required: z.string().min(2, 'Required'),
  nsqf_level_min: z.coerce.number().int().min(1).max(8).optional().or(z.literal('')),
  nsqf_level_max: z.coerce.number().int().min(1).max(8).optional().or(z.literal('')),
  salary_min: z.coerce.number().int().positive(),
  salary_max: z.coerce.number().int().positive(),
  openings: z.coerce.number().int().positive().default(1),
  location: z.string().optional(),
  district: z.string().optional(),
  description: z.string().optional(),
  naps_eligible: z.boolean().optional().default(false),
  status: z.enum(['draft', 'active', 'paused', 'closed']).optional(),
});

type VacancyInputs = z.infer<typeof vacancySchema>;

export default function EditVacancyPage() {
  const router = useRouter();
  const params = useParams();
  const vacancyId = params.id as string;

  const [warning, setWarning] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const { data: vacancy, isLoading, error } = trpc.employer.vacancies.get.useQuery(
    { id: vacancyId },
    { enabled: !!vacancyId }
  );

  const { register, handleSubmit, formState: { errors }, reset } = useForm<VacancyInputs>({
    resolver: zodResolver(vacancySchema as any),
    values: vacancy ? {
      title: vacancy.title,
      trade_required: vacancy.trade_required,
      nsqf_level_min: vacancy.nsqf_level_min ?? undefined,
      nsqf_level_max: vacancy.nsqf_level_max ?? undefined,
      salary_min: vacancy.salary_min,
      salary_max: vacancy.salary_max,
      openings: vacancy.openings ?? 1,
      location: vacancy.location ?? '',
      district: vacancy.district ?? '',
      description: vacancy.description ?? '',
      naps_eligible: vacancy.naps_eligible ?? false,
      status: vacancy.status ?? 'active',
    } : undefined,
  });

  const updateMutation = trpc.employer.vacancies.update.useMutation({
    onSuccess: (data: any) => {
      if (data?.status === 'flagged') {
        setWarning('Salary is below minimum wage. Vacancy flagged for compliance review.');
      }
      setSuccessToast('Vacancy updated successfully');
      setTimeout(() => {
        router.push('/dashboard/employer/vacancies');
      }, 1500);
    },
    onError: (err) => {
      setWarning(err.message || 'Failed to update vacancy');
    },
  });

  const onSubmit = (data: VacancyInputs) => {
    // Clean up optional number fields
    const cleaned: any = { ...data, id: vacancyId };
    if (cleaned.nsqf_level_min === '' || cleaned.nsqf_level_min === undefined) delete cleaned.nsqf_level_min;
    if (cleaned.nsqf_level_max === '' || cleaned.nsqf_level_max === undefined) delete cleaned.nsqf_level_max;
    if (!cleaned.location) delete cleaned.location;
    if (!cleaned.district) delete cleaned.district;
    if (!cleaned.description) delete cleaned.description;
    updateMutation.mutate(cleaned);
  };

  if (isLoading) {
    return (
      <div style={{ padding: '80px 48px', textAlign: 'center' }}>
        <Loader2 size={24} color="#8a8886" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#8a8886', marginTop: 12 }}>Loading vacancy...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !vacancy) {
    return (
      <div style={{ padding: '80px 48px', textAlign: 'center' }}>
        <AlertTriangle size={24} color="#dc2626" />
        <p style={{ color: '#dc2626', marginTop: 12 }}>Vacancy not found or access denied.</p>
        <Link href="/dashboard/employer/vacancies" style={{ color: '#fa5d00', fontWeight: 600, fontSize: 14, textDecoration: 'underline' }}>
          Back to Vacancies
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ padding: '40px 48px', maxWidth: 800, margin: '0 auto' }}
    >
      <Link href="/dashboard/employer/vacancies" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#615f5c', textDecoration: 'none', fontWeight: 600, fontSize: 14, marginBottom: 24 }}>
        <ArrowLeft size={16} /> Back to Vacancies
      </Link>
      <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, fontWeight: 700, color: '#0f161e', margin: '0 0 32px' }}>Edit Vacancy</h1>

      {warning && (
        <div style={{ background: '#fff7ed', border: '1px solid #fdba74', padding: 16, borderRadius: 12, marginBottom: 24, display: 'flex', gap: 12 }}>
          <AlertTriangle color="#ea580c" />
          <div>
            <div style={{ fontWeight: 600, color: '#9a3412', fontSize: 14 }}>Warning</div>
            <div style={{ color: '#c2410c', fontSize: 13, marginTop: 4 }}>{warning}</div>
          </div>
        </div>
      )}

      {successToast && (
        <div style={{ background: '#f0fdf4', border: '1px solid rgba(22,163,74,0.2)', padding: 16, borderRadius: 12, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle size={18} color="#16a34a" />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>{successToast}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit as any)} style={{ background: '#fff', padding: 32, borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Section 1: Role Details */}
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: '#0f161e', borderBottom: '1px solid #eee', paddingBottom: 8 }}>1. Role Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#333942' }}>Job Title</label>
              <input type="text" {...register('title')} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d0cd' }} placeholder="e.g. Senior Electrician" />
              {errors.title && <span style={{ color: 'red', fontSize: 12 }}>{errors.title.message}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#333942' }}>ITI Trade Required</label>
              <input type="text" {...register('trade_required')} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d0cd' }} placeholder="e.g. Electrician" />
              {errors.trade_required && <span style={{ color: 'red', fontSize: 12 }}>{errors.trade_required.message}</span>}
            </div>
          </div>
        </div>

        {/* Section 2: Compensation */}
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: '#0f161e', borderBottom: '1px solid #eee', paddingBottom: 8 }}>2. Compensation</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#333942' }}>Minimum Salary (₹/month)</label>
              <input type="number" {...register('salary_min')} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d0cd' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#333942' }}>Maximum Salary (₹/month)</label>
              <input type="number" {...register('salary_max')} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d0cd' }} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, cursor: 'pointer' }}>
            <input type="checkbox" {...register('naps_eligible')} style={{ width: 18, height: 18, accentColor: '#004038' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#333942' }}>This is an Apprenticeship role (NAPS Eligible)</span>
          </label>
          <div style={{ marginLeft: 28, fontSize: 12, color: '#615f5c', marginTop: 4 }}>Check this if you plan to hire apprentices under the NAPS scheme.</div>
        </div>

        {/* Section 3: Location & Details */}
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: '#0f161e', borderBottom: '1px solid #eee', paddingBottom: 8 }}>3. Location & Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#333942' }}>District</label>
              <input type="text" {...register('district')} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d0cd' }} placeholder="e.g. Varanasi" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#333942' }}>Number of Openings</label>
              <input type="number" {...register('openings')} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d0cd' }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#333942' }}>Description (optional)</label>
            <textarea {...register('description')} rows={3} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d0cd', resize: 'vertical', fontFamily: 'inherit' }} placeholder="Job responsibilities, requirements, perks..." />
          </div>
        </div>

        {/* Section 4: Status */}
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: '#0f161e', borderBottom: '1px solid #eee', paddingBottom: 8 }}>4. Status</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#333942' }}>Vacancy Status</label>
            <select {...register('status')} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d0cd', background: '#fff', fontSize: 14 }}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="draft">Draft</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        <button type="submit" disabled={updateMutation.isPending} style={{ marginTop: 16, padding: '14px', background: '#fa5d00', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 15, cursor: 'pointer', opacity: updateMutation.isPending ? 0.7 : 1 }}>
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </motion.div>
  );
}
