'use client';

import React, { useState } from 'react';
import { trpc } from '@/src/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Search, Building2, MapPin, Briefcase } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/src/components/ui/sheet';
import { Button } from '@/src/components/ui/button';

export default function EmployersPage() {
  const [page, setPage] = useState(1);
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null);

  const { data: employersResp, isLoading } = trpc.dashboard.employers.list.useQuery({ page, limit: 20 });
  const { data: employerDetail, isLoading: isDetailLoading } = trpc.dashboard.employers.byId.useQuery(
    { id: selectedEmployerId || '' },
    { enabled: !!selectedEmployerId }
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Employer Partners</h2>
          <p className="text-gray-500 mt-1">Directory of registered companies and their hiring needs.</p>
        </div>
        <Button className="bg-[#004038] hover:bg-[#00544c]">Invite Employer</Button>
      </div>

      <Card className="border-none shadow-md shadow-gray-200/50">
        <CardHeader className="pb-4 border-b border-gray-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search companies..." className="pl-9 bg-gray-50/50 border-gray-200" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-gray-600">Company</TableHead>
                <TableHead className="font-semibold text-gray-600">Contact Person</TableHead>
                <TableHead className="font-semibold text-gray-600">District</TableHead>
                <TableHead className="font-semibold text-gray-600 text-center">Active Jobs</TableHead>
                <TableHead className="font-semibold text-gray-600">Trades Needed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  </TableRow>
                ))
              ) : employersResp?.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-gray-500">
                    No employers found.
                  </TableCell>
                </TableRow>
              ) : (
                employersResp?.data.map((emp: any) => (
                  <TableRow 
                    key={emp.id} 
                    onClick={() => setSelectedEmployerId(emp.id)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <TableCell className="font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <span>{emp.full_name || 'Unnamed Company'}</span>
                          <span className="text-xs text-gray-500 font-normal">{emp.phone}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{emp.email || '-'}</TableCell>
                    <TableCell className="text-gray-600">{emp.district || 'All Districts'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">
                        {emp.active_jobs}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {emp.trades.length > 0 ? emp.trades.map((t: string) => (
                          <Badge key={t} variant="outline" className="text-xs bg-gray-50 capitalize">{t}</Badge>
                        )) : <span className="text-gray-400 text-sm">-</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              Showing <span className="font-medium">1</span> to <span className="font-medium">{employersResp?.data.length || 0}</span> of <span className="font-medium">{employersResp?.total || 0}</span> employers
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= (employersResp?.totalPages || 1)} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Slide-out Employer Profile */}
      <Sheet open={!!selectedEmployerId} onOpenChange={(open) => !open && setSelectedEmployerId(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          {isDetailLoading ? (
            <div className="space-y-4 mt-6">
              <Skeleton className="h-12 w-12 rounded-xl mb-4" />
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-32 w-full mt-8" />
            </div>
          ) : employerDetail ? (
            <div className="mt-6 flex flex-col gap-6">
              <div>
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 mb-4">
                  <Building2 className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{employerDetail.employer.full_name || 'Unnamed Company'}</h2>
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                  <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {employerDetail.employer.district || 'Any District'}</div>
                  <div className="flex items-center gap-1.5"><Briefcase className="w-4 h-4" /> {employerDetail.jobs.length} total jobs</div>
                </div>
              </div>

              {/* Active Jobs */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Postings</h3>
                {employerDetail.jobs.length === 0 ? (
                  <p className="text-gray-500 text-sm">No jobs posted yet.</p>
                ) : (
                  <div className="space-y-3">
                    {employerDetail.jobs.map((job: any) => (
                      <div key={job.id} className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <p className="font-semibold text-gray-900 text-lg">{job.title}</p>
                          <Badge variant={job.is_active ? 'default' : 'secondary'} className={job.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200 shadow-none border-none' : ''}>
                            {job.is_active ? 'Active' : 'Closed'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="capitalize">Trade: {job.trade || 'Any'}</span>
                          <span>Salary: ₹{job.salary_min || 0} - ₹{job.salary_max || 0}</span>
                        </div>
                        {job.is_active && (
                          <div className="mt-2 pt-2 border-t border-gray-100 flex justify-end">
                            <Button variant="ghost" size="sm" className="text-[#004038] hover:text-[#00544c] hover:bg-[#004038]/5 h-8">
                              Find Matches
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
