"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  Upload,
  FileUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowLeft,
  Users,
  AlertTriangle,
} from "lucide-react";
import { trpc } from "../../../lib/trpc/client";

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ACCEPTED_MIME_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpeg, .jpg",
  "image/png": ".png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
};

const ACCEPTED_EXTENSIONS = ".pdf,.jpeg,.jpg,.png,.docx";

const PHONE_REGEX = /^[6-9]\d{9}$/;

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExtractedLearner {
  name: string;
  phone: string;
  confidence: number;
  valid: boolean;
  lowConfidence: boolean;
  invalidReason?: string;
}

interface UploadResult {
  cohortName: string;
  filename: string;
  pages: number | null;
  totalExtracted: number;
  validEntries: ExtractedLearner[];
  invalidEntries: ExtractedLearner[];
}

interface ConfirmResult {
  cohortId: string;
  cohortName: string;
  learnersCreated: number;
  skipped: number;
  errors: Array<{ phone: string; reason: string }>;
}

type Step = "upload" | "preview" | "success";

// ─── Page Component ──────────────────────────────────────────────────────────

export default function CohortUploadPage() {
  const [step, setStep] = useState<Step>("upload");

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [cohortName, setCohortName] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview state
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [editableEntries, setEditableEntries] = useState<ExtractedLearner[]>([]);
  const [phoneErrors, setPhoneErrors] = useState<Record<number, string>>({});

  // Success state
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(
    null
  );

  // tRPC mutations
  const uploadDocument = trpc.cohort.uploadDocument.useMutation({
    onSuccess: (data: UploadResult) => {
      setUploadResult(data);
      setEditableEntries(
        data.validEntries.map((e) => ({ ...e }))
      );
      setStep("preview");
      setUploadError(null);
    },
    onError: (err: { message: string }) => {
      setUploadError(err.message || "Upload failed. Please try again.");
    },
  });

  const confirmCohort = trpc.cohort.confirmCohort.useMutation({
    onSuccess: (data: ConfirmResult) => {
      setConfirmResult(data);
      setStep("success");
    },
    onError: (err: { message: string }) => {
      setUploadError(
        err.message || "Failed to create cohort. Please try again."
      );
    },
  });

  // ─── Upload Step Handlers ──────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      setFile(null);
      return;
    }

    // Validate MIME type
    if (!Object.keys(ACCEPTED_MIME_TYPES).includes(selectedFile.type)) {
      setFileError(
        "Invalid file type. Accepted formats: PDF, JPEG, PNG, DOCX."
      );
      setFile(null);
      return;
    }

    // Validate size
    if (selectedFile.size > MAX_FILE_SIZE) {
      setFileError("File is too large. Maximum allowed size is 10 MB.");
      setFile(null);
      return;
    }

    setFile(selectedFile);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadError(null);

    if (!file) {
      setFileError("Please select a file to upload.");
      return;
    }
    if (!cohortName.trim()) {
      return;
    }

    // Convert file to base64
    const buffer = await file.arrayBuffer();
    const base64 = btoa(
      String.fromCharCode(...new Uint8Array(buffer))
    );

    uploadDocument.mutate({
      fileBase64: base64,
      mimeType: file.type,
      cohortName: cohortName.trim(),
      filename: file.name,
    });
  }

  // ─── Preview Step Handlers ─────────────────────────────────────────────────

  function handleEntryEdit(
    index: number,
    field: "name" | "phone",
    value: string
  ) {
    setEditableEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });

    // Validate phone on change
    if (field === "phone") {
      setPhoneErrors((prev) => {
        const updated = { ...prev };
        if (!PHONE_REGEX.test(value)) {
          updated[index] =
            "Must be a valid 10-digit Indian mobile number (starts with 6-9)";
        } else {
          delete updated[index];
        }
        return updated;
      });
    }
  }

  function hasPhoneErrors(): boolean {
    // Check current editable entries for invalid phones
    for (let i = 0; i < editableEntries.length; i++) {
      if (!PHONE_REGEX.test(editableEntries[i].phone)) {
        return true;
      }
    }
    return false;
  }

  async function handleConfirm() {
    if (hasPhoneErrors()) return;
    if (!file || !uploadResult) return;

    // Convert file to base64 again for storage
    const buffer = await file.arrayBuffer();
    const base64 = btoa(
      String.fromCharCode(...new Uint8Array(buffer))
    );

    confirmCohort.mutate({
      cohortName: uploadResult.cohortName,
      validEntries: editableEntries.map((e) => ({
        name: e.name,
        phone: e.phone,
      })),
      fileBase64: base64,
      mimeType: file.type,
      filename: file.name,
    });
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        {/* Back link */}
        <Link
          href="/cohorts"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Cohorts
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-8">
          Create New Cohort
        </h1>

        {/* Step Indicator */}
        <StepIndicator currentStep={step} />

        {/* Step 1: Upload */}
        {step === "upload" && (
          <section className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Upload Student Document
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Upload a document containing student names and phone numbers. We
              accept PDF, JPEG, PNG, and DOCX files up to 10 MB.
            </p>

            <form onSubmit={handleUpload} className="space-y-5">
              {/* Cohort Name */}
              <div>
                <label
                  htmlFor="cohort-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Cohort Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="cohort-name"
                  type="text"
                  required
                  value={cohortName}
                  onChange={(e) => setCohortName(e.target.value)}
                  placeholder="e.g., ITI Varanasi Batch 2025-A"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  maxLength={200}
                />
              </div>

              {/* File Input */}
              <div>
                <label
                  htmlFor="document-upload"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Document File <span className="text-red-500">*</span>
                </label>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-teal-400 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      fileInputRef.current?.click();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="Click to select a file"
                >
                  <Upload className="h-8 w-8 mx-auto text-gray-400 mb-3" />
                  {file ? (
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600">
                        Click to select or drag a file here
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        PDF, JPEG, PNG, DOCX — Max 10 MB
                      </p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  id="document-upload"
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  onChange={handleFileChange}
                  className="hidden"
                  aria-describedby="file-error"
                />
              </div>

              {/* File Error */}
              {fileError && (
                <div
                  id="file-error"
                  className="flex items-center gap-2 text-sm text-red-600"
                  role="alert"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{fileError}</span>
                </div>
              )}

              {/* Upload Error */}
              {uploadError && (
                <div
                  className="flex items-center gap-2 text-sm text-red-600"
                  role="alert"
                >
                  <XCircle className="h-4 w-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={
                  !file ||
                  !cohortName.trim() ||
                  uploadDocument.isPending
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadDocument.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading & Parsing...
                  </>
                ) : (
                  <>
                    <FileUp className="h-4 w-4" />
                    Upload & Parse
                  </>
                )}
              </button>
            </form>
          </section>
        )}

        {/* Step 2: Preview & Edit */}
        {step === "preview" && uploadResult && (
          <section className="mt-6 space-y-6">
            {/* Summary Bar */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-teal-600" />
                <span className="font-medium text-gray-700">
                  {uploadResult.totalExtracted} entries extracted
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {editableEntries.length} valid •{" "}
                {uploadResult.invalidEntries.length} invalid
              </div>
              {uploadResult.pages && (
                <div className="text-sm text-gray-500">
                  {uploadResult.pages} page
                  {uploadResult.pages > 1 ? "s" : ""} processed
                </div>
              )}
            </div>

            {/* Valid Entries — Editable Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">
                  Valid Entries
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Review and edit names and phone numbers before confirming.
                </p>
              </div>

              {editableEntries.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-400 text-sm">
                  No valid entries found in the document.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-6 py-3 font-medium text-gray-600">
                          #
                        </th>
                        <th className="px-6 py-3 font-medium text-gray-600">
                          Name
                        </th>
                        <th className="px-6 py-3 font-medium text-gray-600">
                          Phone Number
                        </th>
                        <th className="px-6 py-3 font-medium text-gray-600">
                          Confidence
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {editableEntries.map((entry, idx) => {
                        const isLowConfidence = entry.confidence < 0.7;
                        return (
                          <tr
                            key={idx}
                            className={
                              isLowConfidence
                                ? "bg-amber-50"
                                : "hover:bg-gray-50"
                            }
                          >
                            <td className="px-6 py-3 text-gray-500">
                              {idx + 1}
                            </td>
                            <td className="px-6 py-3">
                              <input
                                type="text"
                                value={entry.name}
                                onChange={(e) =>
                                  handleEntryEdit(idx, "name", e.target.value)
                                }
                                className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                aria-label={`Name for entry ${idx + 1}`}
                              />
                            </td>
                            <td className="px-6 py-3">
                              <div>
                                <input
                                  type="text"
                                  value={entry.phone}
                                  onChange={(e) =>
                                    handleEntryEdit(
                                      idx,
                                      "phone",
                                      e.target.value
                                    )
                                  }
                                  className={`w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent ${
                                    phoneErrors[idx]
                                      ? "border-red-300 bg-red-50"
                                      : "border-gray-200"
                                  }`}
                                  aria-label={`Phone number for entry ${idx + 1}`}
                                  aria-invalid={!!phoneErrors[idx]}
                                  aria-describedby={
                                    phoneErrors[idx]
                                      ? `phone-error-${idx}`
                                      : undefined
                                  }
                                />
                                {phoneErrors[idx] && (
                                  <p
                                    id={`phone-error-${idx}`}
                                    className="text-xs text-red-600 mt-1"
                                  >
                                    {phoneErrors[idx]}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                  isLowConfidence
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-green-100 text-green-800"
                                }`}
                              >
                                {isLowConfidence && (
                                  <AlertTriangle className="h-3 w-3" />
                                )}
                                {(entry.confidence * 100).toFixed(0)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Invalid Entries — Non-Editable */}
            {uploadResult.invalidEntries.length > 0 && (
              <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-red-100 bg-red-50">
                  <h2 className="text-lg font-semibold text-red-800">
                    Invalid Entries
                  </h2>
                  <p className="text-sm text-red-600 mt-1">
                    These entries cannot be included due to invalid data.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-red-50/50 text-left">
                        <th className="px-6 py-3 font-medium text-red-700">
                          #
                        </th>
                        <th className="px-6 py-3 font-medium text-red-700">
                          Name
                        </th>
                        <th className="px-6 py-3 font-medium text-red-700">
                          Phone
                        </th>
                        <th className="px-6 py-3 font-medium text-red-700">
                          Reason
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100">
                      {uploadResult.invalidEntries.map((entry, idx) => (
                        <tr key={idx} className="bg-red-50/30">
                          <td className="px-6 py-3 text-red-400">{idx + 1}</td>
                          <td className="px-6 py-3 text-gray-700">
                            {entry.name || "—"}
                          </td>
                          <td className="px-6 py-3 text-gray-700 font-mono">
                            {entry.phone || "—"}
                          </td>
                          <td className="px-6 py-3">
                            <span className="inline-flex items-center gap-1 text-xs text-red-600">
                              <XCircle className="h-3 w-3" />
                              {entry.invalidReason}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Upload/Confirm Error */}
            {uploadError && (
              <div
                className="flex items-center gap-2 text-sm text-red-600"
                role="alert"
              >
                <XCircle className="h-4 w-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setStep("upload");
                  setUploadResult(null);
                  setEditableEntries([]);
                  setPhoneErrors({});
                  setUploadError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back to Upload
              </button>

              <button
                onClick={handleConfirm}
                disabled={
                  editableEntries.length === 0 ||
                  hasPhoneErrors() ||
                  confirmCohort.isPending
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirmCohort.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating Cohort...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Create Cohort
                  </>
                )}
              </button>
            </div>
          </section>
        )}

        {/* Step 3: Success */}
        {step === "success" && confirmResult && (
          <section className="bg-white rounded-xl border border-gray-200 p-8 mt-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Cohort Created Successfully
            </h2>
            <p className="text-gray-500 mb-6">
              &quot;{confirmResult.cohortName}&quot; has been created.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-md mx-auto mb-8">
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-green-700">
                  {confirmResult.learnersCreated}
                </p>
                <p className="text-xs text-green-600 mt-1">Learners Created</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-amber-700">
                  {confirmResult.skipped}
                </p>
                <p className="text-xs text-amber-600 mt-1">Skipped (Existing)</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-2xl font-bold text-red-700">
                  {confirmResult.errors.length}
                </p>
                <p className="text-xs text-red-600 mt-1">Errors</p>
              </div>
            </div>

            {/* Show errors detail if any */}
            {confirmResult.errors.length > 0 && (
              <div className="text-left max-w-md mx-auto mb-6 bg-red-50 rounded-lg p-4">
                <p className="text-sm font-medium text-red-800 mb-2">
                  Failed entries:
                </p>
                <ul className="text-xs text-red-600 space-y-1">
                  {confirmResult.errors.map((err, idx) => (
                    <li key={idx}>
                      {err.phone}: {err.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-center gap-4">
              <Link
                href="/cohorts"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                View All Cohorts
              </Link>
              <Link
                href={`/cohorts/${confirmResult.cohortId}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors"
              >
                <Users className="h-4 w-4" />
                View Cohort
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ─── Step Indicator Component ────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps = [
    { key: "upload", label: "Upload Document" },
    { key: "preview", label: "Preview & Edit" },
    { key: "success", label: "Done" },
  ] as const;

  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center gap-2" aria-label="Progress">
      {steps.map((s, idx) => {
        const isComplete = idx < currentIndex;
        const isCurrent = idx === currentIndex;

        return (
          <div key={s.key} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                  isComplete
                    ? "bg-teal-600 text-white"
                    : isCurrent
                      ? "bg-teal-100 text-teal-700 border-2 border-teal-600"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={`text-sm hidden sm:inline ${
                  isCurrent
                    ? "font-medium text-gray-900"
                    : isComplete
                      ? "text-gray-600"
                      : "text-gray-400"
                }`}
              >
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`w-8 h-0.5 ${
                  idx < currentIndex ? "bg-teal-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
