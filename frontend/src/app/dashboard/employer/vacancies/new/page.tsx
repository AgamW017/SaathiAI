'use client';

import React, { useState } from 'react';
import { trpc } from '../../../../../lib/trpc/client';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

const vacancySchema = z.object({
  title: z.string().min(2, 'Required'),
  trade_required: z.string().min(2, 'Required'),
  nsqf_level_min: z.number().int().min(1).max(8).optional(),
  nsqf_level_max: z.number().int().min(1).max(8).optional(),
  salary_min: z.coerce.number().int().positive(),
  salary_max: z.coerce.number().int().positive(),
  openings: z.coerce.number().int().positive().default(1),
  location: z.string().optional(),
  district: z.string().optional(),
  description: z.string().optional(),
  naps_eligible: z.boolean().optional().default(false),
});

type VacancyInputs = z.infer<typeof vacancySchema>;

export default function NewVacancyPage() {
  const router = useRouter();
  const [warning, setWarning] = useState<string | null>(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<VacancyInputs>({
    resolver: zodResolver(vacancySchema as any),
    defaultValues: { naps_eligible: false, openings: 1, salary_min: 12000, salary_max: 15000 },
  });

  const createMutation = trpc.employer.vacancies.create.useMutation({
    onSuccess: (data: any) => {
      if (data.minimum_wage_warning) {
        setWarning(data.minimum_wage_warning.message);
        // It was flagged, but created. Redirect after a bit or let user see warning.
        setTimeout(() => router.push('/dashboard/employer/vacancies'), 3000);
      } else {
        router.push('/dashboard/employer/vacancies');
      }
    }
  });

  const onSubmit = (data: VacancyInputs) => {
    createMutation.mutate(data);
  };

  return (
    <div style={{ padding: '40px 48px', maxWidth: 800, margin: '0 auto' }}>
      <Link href="/dashboard/employer/vacancies" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#615f5c', textDecoration: 'none', fontWeight: 600, fontSize: 14, marginBottom: 24 }}>
        <ArrowLeft size={16} /> Back to Vacancies
      </Link>
      <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: '#0f161e', margin: '0 0 32px' }}>Post New Vacancy</h1>

      {warning && (
        <div style={{ background: '#fff7ed', border: '1px solid #fdba74', padding: 16, borderRadius: 12, marginBottom: 24, display: 'flex', gap: 12 }}>
          <AlertTriangle color="#ea580c" />
          <div>
            <div style={{ fontWeight: 600, color: '#9a3412', fontSize: 14 }}>Compliance Warning</div>
            <div style={{ color: '#c2410c', fontSize: 13, marginTop: 4 }}>{warning}</div>
            <div style={{ color: '#c2410c', fontSize: 12, marginTop: 8 }}>Vacancy saved as Flagged. Redirecting...</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit as any)} style={{ background: '#fff', padding: 32, borderRadius: 16, border: '1px solid rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Step 1: Role */}
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

        {/* Step 2: Compensation */}
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
          <div style={{ marginLeft: 28, fontSize: 12, color: '#615f5c', marginTop: 4 }}>Check this if you plan to hire apprentices under the NAPS scheme to claim ₹1500/mo reimbursement.</div>
        </div>

        {/* Step 3: Location */}
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
        </div>

        <button type="submit" disabled={createMutation.isPending} style={{ marginTop: 16, padding: '14px', background: '#fa5d00', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
          {createMutation.isPending ? 'Saving...' : 'Post Vacancy'}
        </button>

      </form>
    </div>
  );
}
