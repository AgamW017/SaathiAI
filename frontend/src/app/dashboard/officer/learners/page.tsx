'use client';

import React, { useState } from 'react';
import { trpc } from '@/src/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Search, Filter, Phone, MapPin, Wrench, AlertTriangle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/src/components/ui/sheet';
import { Button } from '@/src/components/ui/button';
import { motion } from 'framer-motion';

export default function LearnersPage() {
  const [page, setPage] = useState(1);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);

  const { data: learnersResp, isLoading } = trpc.dashboard.learner.list.useQuery({ page, limit: 20 });
  const { data: learnerDetail, isLoading: isDetailLoading } = trpc.dashboard.learner.byId.useQuery(
    { id: selectedLearnerId || '' },
    { enabled: !!selectedLearnerId }
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-none">Active</Badge>;
      case 'placed': return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none">Placed</Badge>;
      case 'at_risk': return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-none">At Risk</Badge>;
      case 'dropped': return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-none">Dropped</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Learner Directory</h2>
          <p className="text-gray-500 mt-1">Manage and track learners in your cohort.</p>
        </div>
      </div>

      <Card className="border-none shadow-md shadow-gray-200/50">
        <CardHeader className="pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search learners by name or phone..." className="pl-9 bg-gray-50/50 border-gray-200 focus-visible:ring-[#004038]" />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-gray-600">Name</TableHead>
                <TableHead className="font-semibold text-gray-600">Trade</TableHead>
                <TableHead className="font-semibold text-gray-600">District</TableHead>
                <TableHead className="font-semibold text-gray-600">Status</TableHead>
                <TableHead className="font-semibold text-gray-600">Risk Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : learnersResp?.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-gray-500">
                    No learners found.
                  </TableCell>
                </TableRow>
              ) : (
                learnersResp?.data.map((learner) => (
                  <TableRow 
                    key={learner.id} 
                    onClick={() => setSelectedLearnerId(learner.id)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <TableCell className="font-medium text-gray-900">
                      <div className="flex flex-col">
                        <span>{learner.full_name || 'Unnamed Learner'}</span>
                        <span className="text-xs text-gray-500 font-normal">{learner.phone}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600 capitalize">{learner.trade || '-'}</TableCell>
                    <TableCell className="text-gray-600">{learner.district || '-'}</TableCell>
                    <TableCell>{getStatusBadge(learner.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${learner.risk_score > 70 ? 'bg-red-500' : learner.risk_score > 40 ? 'bg-orange-400' : 'bg-green-500'}`}
                            style={{ width: `${learner.risk_score}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-600">{learner.risk_score}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {/* Pagination (Simplified) */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              Showing <span className="font-medium">1</span> to <span className="font-medium">{learnersResp?.data.length || 0}</span> of <span className="font-medium">{learnersResp?.total || 0}</span> learners
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= (learnersResp?.totalPages || 1)} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Slide-out Learner Profile */}
      <Sheet open={!!selectedLearnerId} onOpenChange={(open) => !open && setSelectedLearnerId(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          {isDetailLoading ? (
            <div className="space-y-4 mt-6">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-32 w-full mt-8" />
            </div>
          ) : learnerDetail ? (
            <div className="mt-6 flex flex-col gap-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{learnerDetail.learner.full_name || 'Unnamed Learner'}</h2>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600">
                    <div className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> {learnerDetail.learner.phone}</div>
                    <div className="flex items-center gap-1.5"><Wrench className="w-4 h-4" /> <span className="capitalize">{learnerDetail.learner.trade || 'No Trade'}</span></div>
                    <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {learnerDetail.learner.district || 'No District'}</div>
                  </div>
                </div>
                {getStatusBadge(learnerDetail.learner.status)}
              </div>

              {/* AI Summary */}
              <div className="bg-[#004038]/5 border border-[#004038]/10 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-[#004038] uppercase tracking-wider mb-2">AI Summary</h3>
                <p className="text-gray-700 leading-relaxed text-sm">{learnerDetail.aiSummary}</p>
                {learnerDetail.suggestedAction && (
                  <div className="mt-4 pt-4 border-t border-[#004038]/10 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#fa5d00]/20 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#fa5d00]" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-900">Suggested Action</span>
                      <p className="text-sm text-gray-600 mt-0.5">{learnerDetail.suggestedAction}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Match History */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Application History</h3>
                {learnerDetail.applications.length === 0 ? (
                  <p className="text-gray-500 text-sm">No applications yet.</p>
                ) : (
                  <div className="space-y-3">
                    {learnerDetail.applications.map((app: any) => (
                      <div key={app.id} className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-gray-900">{app.jobs?.title || 'Unknown Job'}</p>
                          <p className="text-sm text-gray-500">{app.jobs?.company || 'Unknown Company'}</p>
                        </div>
                        <Badge variant="secondary" className="capitalize">{app.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-6 border-t border-gray-100 flex gap-3">
                <Button className="flex-1 bg-[#004038] hover:bg-[#00544c]">Message on WhatsApp</Button>
                <Button variant="outline" className="flex-1">Update Status</Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
