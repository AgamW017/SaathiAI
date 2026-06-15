'use client';

import React, { useState } from 'react';
import { trpc } from '@/src/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Search, Calendar, CheckCircle2, TrendingUp, Download } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { format } from 'date-fns';

export default function PlacementsPage() {
  const [page, setPage] = useState(1);

  const { data: placementsResp, isLoading } = trpc.dashboard.placements.list.useQuery({ page, limit: 20 });
  const { data: stats } = trpc.dashboard.cohortStats.useQuery({});

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Placement Records</h2>
          <p className="text-gray-500 mt-1">Confirmed job placements for the current cohort.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button className="bg-[#004038] hover:bg-[#00544c] gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Confirm Placement
          </Button>
        </div>
      </div>

      {/* Mini Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-gradient-to-br from-green-50 to-emerald-50/30">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-800">Total Placements</p>
              <h3 className="text-2xl font-bold text-green-900">{stats?.placed || 0}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50/30">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-800">Placement Rate</p>
              <h3 className="text-2xl font-bold text-blue-900">{stats?.placement_rate || 0}%</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-md shadow-gray-200/50">
        <CardHeader className="pb-4 border-b border-gray-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search by learner or company..." className="pl-9 bg-gray-50/50 border-gray-200" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-gray-600">Learner</TableHead>
                <TableHead className="font-semibold text-gray-600">Company & Job</TableHead>
                <TableHead className="font-semibold text-gray-600">Placement Date</TableHead>
                <TableHead className="font-semibold text-gray-600">Salary</TableHead>
                <TableHead className="font-semibold text-gray-600 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-6 w-20 ml-auto rounded-full" /></TableCell>
                  </TableRow>
                ))
              ) : placementsResp?.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-gray-500">
                    No confirmed placements found.
                  </TableCell>
                </TableRow>
              ) : (
                placementsResp?.data.map((placement: any) => (
                  <TableRow key={placement.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="font-medium text-gray-900">
                      <div className="flex flex-col">
                        <span>{placement.learners?.full_name || 'Unknown Learner'}</span>
                        <span className="text-xs text-gray-500 font-normal capitalize">{placement.learners?.trade || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{placement.jobs?.company || 'Unknown Company'}</span>
                        <span className="text-sm text-gray-500">{placement.jobs?.title || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {placement.placement_date ? format(new Date(placement.placement_date), 'PP') : '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-900 font-medium">
                      {placement.salary ? `₹${placement.salary.toLocaleString()}` : 'Not Disclosed'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none">
                        Confirmed
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              Showing <span className="font-medium">1</span> to <span className="font-medium">{placementsResp?.data.length || 0}</span> of <span className="font-medium">{placementsResp?.total || 0}</span> placements
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= (placementsResp?.totalPages || 1)} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
