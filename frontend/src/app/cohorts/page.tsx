"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "../../lib/trpc/client";
import {
  Users,
  Briefcase,
  TrendingUp,
  IndianRupee,
  FolderOpen,
  FileUp,
  Calendar,
} from "lucide-react";

export default function CohortsPage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error } = trpc.cohort.listCohorts.useQuery({
    page,
    limit,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 md:p-10">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">My Cohorts</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse"
              >
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
                <div className="h-4 bg-gray-100 rounded w-1/2 mb-6" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-12 bg-gray-100 rounded" />
                  <div className="h-12 bg-gray-100 rounded" />
                  <div className="h-12 bg-gray-100 rounded" />
                  <div className="h-12 bg-gray-100 rounded" />
                </div>
              </div>
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
          <h1 className="text-2xl font-bold text-gray-900 mb-6">My Cohorts</h1>
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium">Failed to load cohorts</p>
            <p className="text-red-500 text-sm mt-1">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  type CohortItem = {
    id: string;
    name: string;
    createdAt: string;
    sourceDocumentUrl: string | null;
    stats: {
      total: number;
      placed: number;
      placementRate: number;
      averageSalary: number | null;
    };
  };

  const cohorts: CohortItem[] = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  // Empty state
  if (cohorts.length === 0 && page === 1) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 md:p-10">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">My Cohorts</h1>
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center">
                <FolderOpen className="w-8 h-8 text-teal-600" />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              No cohorts yet
            </h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Upload a student document to create your first cohort. You can
              upload PDF, image, or DOCX files containing student names and
              phone numbers.
            </p>
            <Link
              href="/cohorts/upload"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors"
            >
              <FileUp className="w-4 h-4" />
              Upload Document
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Cohorts</h1>
          <Link
            href="/cohorts/upload"
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors text-sm"
          >
            <FileUp className="w-4 h-4" />
            New Cohort
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cohorts.map((cohort) => (
            <Link
              key={cohort.id}
              href={`/cohorts/${cohort.id}`}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-gray-300 transition-all group"
            >
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-teal-700 transition-colors truncate">
                  {cohort.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
                  <Calendar className="w-3.5 h-3.5" />
                  <time dateTime={cohort.createdAt}>
                    {new Date(cohort.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </time>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
                    <Users className="w-3.5 h-3.5" />
                    Total Learners
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {cohort.stats.total}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
                    <Briefcase className="w-3.5 h-3.5" />
                    Placed
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {cohort.stats.placed}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Placement Rate
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {cohort.stats.placementRate}%
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
                    <IndianRupee className="w-3.5 h-3.5" />
                    Avg. Salary
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {cohort.stats.averageSalary
                      ? `₹${cohort.stats.averageSalary.toLocaleString("en-IN")}`
                      : "—"}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
