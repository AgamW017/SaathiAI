"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { trpc } from "../../../lib/trpc/client";
import {
  ArrowLeft,
  Users,
  Briefcase,
  TrendingUp,
  AlertTriangle,
  XCircle,
  Phone,
} from "lucide-react";

type PlacementStatus = "active" | "placed" | "at_risk" | "dropped";
type OnboardingStatus = "success" | "failed" | "unreachable" | "pending";

const placementStatusConfig: Record<
  PlacementStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "bg-blue-100 text-blue-700",
  },
  placed: {
    label: "Placed",
    className: "bg-green-100 text-green-700",
  },
  at_risk: {
    label: "At Risk",
    className: "bg-amber-100 text-amber-700",
  },
  dropped: {
    label: "Dropped",
    className: "bg-gray-100 text-gray-600",
  },
};

const onboardingStatusConfig: Record<
  OnboardingStatus,
  { label: string; className: string }
> = {
  success: {
    label: "Onboarded",
    className: "bg-green-100 text-green-700",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-700",
  },
  unreachable: {
    label: "Unreachable",
    className: "bg-gray-100 text-gray-600",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-100 text-amber-700",
  },
};

function StatusBadge({
  status,
  config,
}: {
  status: string;
  config: Record<string, { label: string; className: string }>;
}) {
  const statusInfo = config[status] ?? {
    label: status,
    className: "bg-gray-100 text-gray-600",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}
    >
      {statusInfo.label}
    </span>
  );
}

export default function CohortDetailPage() {
  const params = useParams();
  const cohortId = params.id as string;

  const { data, isLoading, error } = trpc.cohort.getCohortDetail.useQuery(
    { cohortId },
    { enabled: !!cohortId }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 md:p-10">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <div className="h-5 bg-gray-200 rounded w-32 mb-4 animate-pulse" />
            <div className="h-8 bg-gray-200 rounded w-64 animate-pulse" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse"
              >
                <div className="h-4 bg-gray-100 rounded w-16 mb-2" />
                <div className="h-6 bg-gray-200 rounded w-12" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-48 mb-4" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded mb-2" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 md:p-10">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/cohorts"
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Cohorts
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium">
              Failed to load cohort details
            </p>
            <p className="text-red-500 text-sm mt-1">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const cohort = data?.cohort;
  const learners = data?.learners ?? [];
  const stats = data?.stats;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Back link */}
        <Link
          href="/cohorts"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Cohorts
        </Link>

        {/* Page title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {cohort?.name ?? "Cohort Details"}
        </h1>

        {/* Summary stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
                <Users className="w-3.5 h-3.5" />
                Total
              </div>
              <p className="text-xl font-semibold text-gray-900">
                {stats.total}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-1.5 text-green-600 text-xs mb-1">
                <Briefcase className="w-3.5 h-3.5" />
                Placed
              </div>
              <p className="text-xl font-semibold text-gray-900">
                {stats.placed}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-1.5 text-blue-600 text-xs mb-1">
                <TrendingUp className="w-3.5 h-3.5" />
                Active
              </div>
              <p className="text-xl font-semibold text-gray-900">
                {stats.active}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-1.5 text-amber-600 text-xs mb-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                At Risk
              </div>
              <p className="text-xl font-semibold text-gray-900">
                {stats.atRisk}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
                <XCircle className="w-3.5 h-3.5" />
                Dropped
              </div>
              <p className="text-xl font-semibold text-gray-900">
                {stats.dropped}
              </p>
            </div>
          </div>
        )}

        {/* Learner list table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Learners ({learners.length})
            </h2>
          </div>

          {learners.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No learners in this cohort</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-6 py-3 font-medium text-gray-600">
                      Name
                    </th>
                    <th className="text-left px-6 py-3 font-medium text-gray-600">
                      Phone
                    </th>
                    <th className="text-left px-6 py-3 font-medium text-gray-600">
                      Placement Status
                    </th>
                    <th className="text-left px-6 py-3 font-medium text-gray-600">
                      Onboarding Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {learners.map((learner: any) => {
                    const placementStatus: PlacementStatus =
                      learner.status ?? "active";
                    // Onboarding status is derived: if a learner was created
                    // and is active, they were successfully onboarded. This
                    // can be replaced by an explicit field when available.
                    const onboardingStatus: OnboardingStatus =
                      learner.onboarding_status ?? "pending";

                    return (
                      <tr
                        key={learner.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-3 text-gray-900 font-medium">
                          {learner.full_name || "—"}
                        </td>
                        <td className="px-6 py-3 text-gray-600">
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                            {learner.phone}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <StatusBadge
                            status={placementStatus}
                            config={placementStatusConfig}
                          />
                        </td>
                        <td className="px-6 py-3">
                          <StatusBadge
                            status={onboardingStatus}
                            config={onboardingStatusConfig}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
