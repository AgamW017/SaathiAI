'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Plus, X, Upload, FileText, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { trpc } from '../../../../lib/trpc/client';

// ─── Validation Schema ────────────────────────────────────────────────────────

const ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg', 'application/pdf'] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const onboardFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number starting with 6-9'),
  district: z.string().min(1, 'District is required'),
  state: z.string().min(1, 'State is required'),
  certificateType: z.string().optional(),
});

type FormInputs = z.infer<typeof onboardFormSchema>;

// ─── Multi-Input Tag Component ────────────────────────────────────────────────

function TagInput({
  label,
  values,
  onChange,
  placeholder,
  error,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  error?: string;
}) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setInput('');
    }
  };

  const removeTag = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#333942' }}>{label}</label>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 8,
          border: error ? '1px solid #dc2626' : '1px solid #d1d0cd',
          minHeight: 42,
          alignItems: 'center',
        }}
      >
        {values.map((tag, i) => (
          <span
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: '#e0f2fe',
              color: '#0369a1',
              padding: '3px 10px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(i)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                color: '#0369a1',
              }}
              aria-label={`Remove ${tag}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={values.length === 0 ? placeholder : ''}
          style={{
            flex: 1,
            minWidth: 120,
            border: 'none',
            outline: 'none',
            fontSize: 14,
            padding: '2px 0',
          }}
        />
        <button
          type="button"
          onClick={addTag}
          style={{
            background: '#f5f4f2',
            border: '1px solid #d1d0cd',
            borderRadius: 6,
            padding: '4px 8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            fontWeight: 600,
            color: '#615f5c',
          }}
        >
          <Plus size={12} /> Add
        </button>
      </div>
      {error && (
        <span style={{ color: '#dc2626', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertCircle size={12} /> {error}
        </span>
      )}
    </div>
  );
}

// ─── Single File Upload Component ─────────────────────────────────────────────

interface SelectedFile {
  file: File;
  error?: string;
}

function SingleFileUpload({
  label,
  description,
  file,
  onChange,
  error,
}: {
  label: string;
  description: string;
  file: SelectedFile | null;
  onChange: (file: SelectedFile | null) => void;
  error?: string;
}) {
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    let fileError: string | undefined;
    if (!ACCEPTED_MIME_TYPES.includes(selected.type as any)) {
      fileError = 'Only PNG, JPEG, and PDF files are accepted';
    } else if (selected.size > MAX_FILE_SIZE) {
      fileError = 'File exceeds 10MB size limit';
    }
    onChange({ file: selected, error: fileError });
    e.target.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#333942' }}>
        {label} <span style={{ color: '#dc2626' }}>*</span>
      </label>
      <p style={{ fontSize: 12, color: '#615f5c', margin: 0 }}>{description}</p>

      {!file ? (
        <div
          style={{
            border: error ? '2px dashed #dc2626' : '2px dashed #d1d0cd',
            borderRadius: 12,
            padding: 20,
            textAlign: 'center',
            background: '#fafaf9',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.pdf"
            onChange={handleFileSelect}
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0,
              cursor: 'pointer',
            }}
            aria-label={`Upload ${label}`}
          />
          <Upload size={20} color="#615f5c" style={{ margin: '0 auto 6px' }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: '#333942' }}>
            Click to upload
          </div>
          <div style={{ fontSize: 11, color: '#615f5c', marginTop: 4 }}>
            PNG, JPEG, or PDF — max 10MB
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            borderRadius: 10,
            background: file.error ? '#fef2f2' : '#f0fdf4',
            border: file.error ? '1px solid #fca5a5' : '1px solid #bbf7d0',
          }}
        >
          <FileText size={18} color={file.error ? '#dc2626' : '#16a34a'} />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: '#0f161e',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {file.file.name}
            </div>
            {file.error && (
              <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>{file.error}</div>
            )}
            {!file.error && (
              <div style={{ fontSize: 11, color: '#615f5c', marginTop: 2 }}>
                {(file.file.size / 1024).toFixed(1)} KB
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              color: '#615f5c',
            }}
            aria-label={`Remove ${file.file.name}`}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {error && !file && (
        <span style={{ color: '#dc2626', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertCircle size={12} /> {error}
        </span>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OfficerOnboardPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormInputs>({
    resolver: zodResolver(onboardFormSchema),
    defaultValues: {
      name: '',
      phone: '',
      district: '',
      state: '',
      certificateType: '',
    },
  });

  const [trades, setTrades] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [aadhaarFile, setAadhaarFile] = useState<SelectedFile | null>(null);
  const [certificateFile, setCertificateFile] = useState<SelectedFile | null>(null);
  const [tradesError, setTradesError] = useState<string | undefined>();
  const [aadhaarError, setAadhaarError] = useState<string | undefined>();
  const [certificateError, setCertificateError] = useState<string | undefined>();
  const [successData, setSuccessData] = useState<{
    learnerName: string;
    phone: string;
    skillCardUrl: string;
    jobsMatched: number;
    whatsappNotified: boolean;
  } | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  const onboardMutation = trpc.officer.onboardLearner.useMutation({
    onSuccess: (data) => {
      setSuccessData({
        learnerName: data.learner.full_name,
        phone: data.learner.phone,
        skillCardUrl: data.skillCardUrl,
        jobsMatched: data.jobsMatched,
        whatsappNotified: data.whatsappNotified,
      });
      setBackendError(null);
    },
    onError: (err) => {
      setBackendError(err.message);
    },
  });

  const validateAndSubmit = async (data: FormInputs) => {
    // Validate trades (not managed by react-hook-form)
    let hasErrors = false;

    if (trades.length === 0) {
      setTradesError('At least one trade is required');
      hasErrors = true;
    } else {
      setTradesError(undefined);
    }

    // Validate Aadhaar document
    if (!aadhaarFile) {
      setAadhaarError('Aadhaar document is required');
      hasErrors = true;
    } else if (aadhaarFile.error) {
      setAadhaarError('Please fix or re-upload the Aadhaar document');
      hasErrors = true;
    } else {
      setAadhaarError(undefined);
    }

    // Validate Certificate document
    if (!certificateFile) {
      setCertificateError('Degree/Certificate document is required');
      hasErrors = true;
    } else if (certificateFile.error) {
      setCertificateError('Please fix or re-upload the certificate document');
      hasErrors = true;
    } else {
      setCertificateError(undefined);
    }

    if (hasErrors) return;

    // Convert files to base64
    const convertFile = async (f: SelectedFile) => {
      const buffer = await f.file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      return {
        filename: f.file.name,
        base64,
        mimeType: f.file.type as 'image/png' | 'image/jpeg' | 'application/pdf',
        sizeBytes: f.file.size,
      };
    };

    const aadhaarDoc = await convertFile(aadhaarFile!);
    const certificateDoc = await convertFile(certificateFile!);

    onboardMutation.mutate({
      name: data.name,
      phone: data.phone,
      trades,
      district: data.district,
      state: data.state,
      certificateType: data.certificateType || undefined,
      skills,
      aadhaarDocument: aadhaarDoc,
      certificateDocument: certificateDoc,
    });
  };

  const resetForm = () => {
    reset();
    setTrades([]);
    setSkills([]);
    setAadhaarFile(null);
    setCertificateFile(null);
    setTradesError(undefined);
    setAadhaarError(undefined);
    setCertificateError(undefined);
    setSuccessData(null);
    setBackendError(null);
  };

  // ─── Success State ──────────────────────────────────────────────────────────

  if (successData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ padding: '40px 48px', maxWidth: 600, margin: '0 auto' }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 16,
            padding: 40,
            textAlign: 'center',
            border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: '#dcfce7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#16a34a"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f161e', margin: '0 0 8px' }}>
            Learner Onboarded Successfully
          </h2>
          <p style={{ fontSize: 14, color: '#615f5c', margin: '0 0 20px' }}>
            <strong>{successData.learnerName}</strong> ({successData.phone}) has been registered.
          </p>

          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: '#166534', marginBottom: 8 }}>
              Skill Card
            </div>
            <a
              href={successData.skillCardUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 14,
                color: '#2563eb',
                fontWeight: 500,
                wordBreak: 'break-all',
              }}
            >
              {successData.skillCardUrl}
            </a>
          </div>

          {successData.jobsMatched > 0 && (
            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 10,
                padding: 12,
                marginBottom: 16,
                fontSize: 13,
                color: '#1d4ed8',
                fontWeight: 600,
              }}
            >
              💼 {successData.jobsMatched} matching job{successData.jobsMatched > 1 ? 's' : ''} found
            </div>
          )}

          {!successData.whatsappNotified && (
            <div
              style={{
                background: '#fef3c7',
                border: '1px solid #fde68a',
                borderRadius: 10,
                padding: 12,
                marginBottom: 16,
                fontSize: 12,
                color: '#92400e',
              }}
            >
              ⚠️ WhatsApp notification could not be delivered. The learner can still access their
              profile when they message the bot.
            </div>
          )}

          <button
            onClick={resetForm}
            style={{
              marginTop: 8,
              padding: '12px 24px',
              background: '#004038',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Onboard Another Learner
          </button>
        </div>
      </motion.div>
    );
  }

  // ─── Form State ─────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ padding: '40px 48px', maxWidth: 800, margin: '0 auto' }}
    >
      <Link
        href="/dashboard/officer"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: '#615f5c',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: 14,
          marginBottom: 24,
        }}
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      <h1
        style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 24,
          fontWeight: 700,
          color: '#0f161e',
          margin: '0 0 8px',
        }}
      >
        Onboard New Learner
      </h1>
      <p style={{ fontSize: 14, color: '#615f5c', margin: '0 0 32px' }}>
        Manually enroll a learner who visits your office. Their profile, skill card, and job matches
        will be created automatically.
      </p>

      {backendError && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            padding: 16,
            borderRadius: 12,
            marginBottom: 24,
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
          <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: '#991b1b', fontWeight: 500 }}>{backendError}</div>
        </div>
      )}

      <form
        onSubmit={handleSubmit(validateAndSubmit)}
        style={{
          background: '#fff',
          padding: 32,
          borderRadius: 16,
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        {/* Section 1: Personal Information */}
        <div>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 700,
              margin: '0 0 16px',
              color: '#0f161e',
              borderBottom: '1px solid #eee',
              paddingBottom: 8,
            }}
          >
            1. Personal Information
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#333942' }}>
                Full Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                {...register('name')}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: errors.name ? '1px solid #dc2626' : '1px solid #d1d0cd',
                }}
                placeholder="e.g. Rajesh Kumar"
              />
              {errors.name && (
                <span style={{ color: '#dc2626', fontSize: 12 }}>{errors.name.message}</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#333942' }}>
                Phone Number <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="tel"
                {...register('phone')}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: errors.phone ? '1px solid #dc2626' : '1px solid #d1d0cd',
                }}
                placeholder="e.g. 9876543210"
                maxLength={10}
              />
              {errors.phone && (
                <span style={{ color: '#dc2626', fontSize: 12 }}>{errors.phone.message}</span>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#333942' }}>
                District <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                {...register('district')}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: errors.district ? '1px solid #dc2626' : '1px solid #d1d0cd',
                }}
                placeholder="e.g. Varanasi"
              />
              {errors.district && (
                <span style={{ color: '#dc2626', fontSize: 12 }}>{errors.district.message}</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#333942' }}>
                State <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                {...register('state')}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: errors.state ? '1px solid #dc2626' : '1px solid #d1d0cd',
                }}
                placeholder="e.g. Uttar Pradesh"
              />
              {errors.state && (
                <span style={{ color: '#dc2626', fontSize: 12 }}>{errors.state.message}</span>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Trade & Skills */}
        <div>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 700,
              margin: '0 0 16px',
              color: '#0f161e',
              borderBottom: '1px solid #eee',
              paddingBottom: 8,
            }}
          >
            2. Trade & Skills
          </h3>

          <TagInput
            label="Trades *"
            values={trades}
            onChange={(v) => {
              setTrades(v);
              if (v.length > 0) setTradesError(undefined);
            }}
            placeholder="Type a trade and press Enter (e.g. Electrician)"
            error={tradesError}
          />

          <div style={{ marginTop: 16 }}>
            <TagInput
              label="Skills"
              values={skills}
              onChange={setSkills}
              placeholder="Type a skill and press Enter (e.g. Wiring)"
            />
          </div>

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#333942' }}>
              Certificate Type
            </label>
            <input
              type="text"
              {...register('certificateType')}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #d1d0cd',
              }}
              placeholder="e.g. ITI, Diploma, Degree"
            />
          </div>
        </div>

        {/* Section 3: Documents */}
        <div>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 700,
              margin: '0 0 16px',
              color: '#0f161e',
              borderBottom: '1px solid #eee',
              paddingBottom: 8,
            }}
          >
            3. Documents
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <SingleFileUpload
              label="Aadhaar Card"
              description="Upload a photo or scan of the learner's Aadhaar card"
              file={aadhaarFile}
              onChange={setAadhaarFile}
              error={aadhaarError}
            />
            <SingleFileUpload
              label="Degree / Certificate"
              description="Upload a photo or scan of the learner's ITI/diploma/degree certificate"
              file={certificateFile}
              onChange={setCertificateFile}
              error={certificateError}
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={onboardMutation.isPending}
          style={{
            padding: '14px',
            background: '#004038',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 15,
            cursor: onboardMutation.isPending ? 'not-allowed' : 'pointer',
            opacity: onboardMutation.isPending ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {onboardMutation.isPending && (
            <div
              style={{
                width: 16,
                height: 16,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
              }}
            />
          )}
          {onboardMutation.isPending ? 'Onboarding...' : 'Onboard Learner'}
        </button>
      </form>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>
  );
}
