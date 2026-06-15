'use client';

import React, { useState } from 'react';
import { trpc } from '../../../../lib/trpc/client';
import { FileCheck, ShieldCheck, CheckCircle2, TrendingUp, HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function NapsPage() {
  const { data, isLoading } = trpc.employer.naps.status.useQuery();
  const registerMutation = trpc.employer.naps.register.useMutation();
  const trpcUtils = trpc.useUtils();

  const [step, setStep] = useState(1);

  if (isLoading) return <div style={{ padding: 40, color: '#615f5c' }}>Loading NAPS data...</div>;

  const handleRegister = async () => {
    try {
      await registerMutation.mutateAsync();
      trpcUtils.employer.naps.status.invalidate();
    } catch (e) {
      alert('Registration failed: ' + (e as Error).message);
    }
  };

  const eligibility = data?.eligibility;

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: '#0f161e', margin: '0 0 8px' }}>NAPS Scheme</h1>
          <p style={{ color: '#615f5c', margin: 0 }}>National Apprenticeship Promotion Scheme (NAPS) — Claim ₹1,500/month per apprentice.</p>
        </div>
        {data?.registered && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#dcfce7', color: '#16a34a', borderRadius: 999, fontSize: 14, fontWeight: 700 }}>
            <CheckCircle2 size={18} /> Registered (Ref: {data.registration_ref})
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Eligibility Banner */}
          {!data?.registered && (
            <div style={{ background: '#fff', padding: 32, borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fa5d0015', color: '#fa5d00', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f161e', margin: '0 0 8px' }}>Eligibility Status</h2>
                  {eligibility?.eligible ? (
                    <>
                      <p style={{ color: '#615f5c', fontSize: 15, margin: '0 0 16px', lineHeight: 1.5 }}>
                        Based on your Udyam data ({data?.total_employees} employees), you are eligible to hire up to <strong>{eligibility.maxApprentices} apprentices</strong> under the NAPS scheme.
                      </p>
                      
                      <div style={{ background: '#f5f4f2', padding: 16, borderRadius: 12, marginBottom: 24 }}>
                        <div style={{ fontSize: 13, color: '#615f5c', marginBottom: 4 }}>Potential Annual Savings</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>₹{eligibility.annualSavings.toLocaleString()}</div>
                      </div>

                      {step === 1 && (
                        <button onClick={() => setStep(2)} style={{ padding: '12px 24px', background: '#004038', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                          Start Registration
                        </button>
                      )}
                      {step === 2 && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ background: '#fff8f1', padding: 20, borderRadius: 12, border: '1px solid rgba(250,93,0,0.2)' }}>
                          <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#0f161e' }}>Confirm Details</h4>
                          <p style={{ fontSize: 13, color: '#615f5c', marginBottom: 16 }}>Registering will sync your profile with the national MSDE portal using your Udyam data.</p>
                          <button onClick={handleRegister} disabled={registerMutation.isPending} style={{ padding: '12px 24px', background: '#fa5d00', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                            {registerMutation.isPending ? 'Registering...' : 'Confirm & Register'}
                          </button>
                        </motion.div>
                      )}
                    </>
                  ) : (
                    <p style={{ color: '#dc2626', fontSize: 15, margin: 0, lineHeight: 1.5 }}>
                      You need at least 4 registered employees to be eligible for NAPS. Currently you have {data?.total_employees}. Update your Udyam details in Profile.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Claims History Table */}
          {data?.registered && (
            <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: '#0f161e' }}>Stipend Claims</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #eee', textAlign: 'left' }}>
                    <th style={{ padding: '12px 0', fontSize: 13, color: '#615f5c' }}>Month</th>
                    <th style={{ padding: '12px 0', fontSize: 13, color: '#615f5c' }}>Apprentice / Role</th>
                    <th style={{ padding: '12px 0', fontSize: 13, color: '#615f5c' }}>Amount</th>
                    <th style={{ padding: '12px 0', fontSize: 13, color: '#615f5c' }}>Status</th>
                    <th style={{ padding: '12px 0', fontSize: 13, color: '#615f5c' }}>Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {data.claims.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '32px 0', textAlign: 'center', color: '#8a8886', fontSize: 14 }}>No claims submitted yet.</td></tr>
                  ) : (
                    data.claims.map((c: any) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '16px 0', fontSize: 14, fontWeight: 600 }}>{c.claim_month}</td>
                        <td style={{ padding: '16px 0', fontSize: 14 }}>{c.vacancy_id.slice(0,8)}...</td>
                        <td style={{ padding: '16px 0', fontSize: 14, color: '#16a34a', fontWeight: 600 }}>₹{c.stipend_amount}</td>
                        <td style={{ padding: '16px 0', fontSize: 14 }}>
                          <span style={{ padding: '4px 8px', background: '#dcfce7', color: '#16a34a', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{c.status}</span>
                        </td>
                        <td style={{ padding: '16px 0', fontSize: 13, color: '#8a8886', fontFamily: 'monospace' }}>{c.submission_ref}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* Sidebar Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ background: '#004038', padding: 24, borderRadius: 16, color: '#fff' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontFamily: "'DM Serif Display', serif" }}>How NAPS Works</h3>
            <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>
              <li>Hire ITI candidates for NAPS-eligible vacancies.</li>
              <li>Pay them the full stipend (minimum wage compliant).</li>
              <li>Submit monthly attendance and claim via SaathiAI.</li>
              <li>Govt directly transfers ₹1,500/month to employer bank account.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
