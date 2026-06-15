'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Skeleton } from '@/src/components/ui/skeleton';
import { trpc } from '@/src/lib/trpc/client';
import { Users, Briefcase, AlertTriangle, TrendingUp, ArrowRight, UserCheck } from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { motion } from 'framer-motion';

export default function OfficerOverviewPage() {
  const { data: stats, isLoading: isStatsLoading } = trpc.dashboard.cohortStats.useQuery({});
  const { data: inbox, isLoading: isInboxLoading } = trpc.dashboard.priorityInbox.useQuery({ limit: 5 });

  const kpiCards = [
    {
      title: 'Total Learners',
      value: stats?.total ?? 0,
      icon: Users,
      color: 'bg-[var(--color-saathi-teal)]/10 text-[var(--color-saathi-teal)]',
    },
    {
      title: 'Placed',
      value: stats?.placed ?? 0,
      icon: Briefcase,
      color: 'bg-[var(--color-action-flame)]/10 text-[var(--color-action-flame)]',
    },
    {
      title: 'Active Seeking',
      value: stats?.active ?? 0,
      icon: TrendingUp,
      color: 'bg-[var(--color-caution)]/10 text-[var(--color-caution)]',
    },
    {
      title: 'At Risk',
      value: stats?.at_risk ?? 0,
      icon: AlertTriangle,
      color: 'bg-[var(--color-risk)]/10 text-[var(--color-risk)]',
    },
  ];

  return (
    <div className="flex flex-col gap-8 max-w-[var(--dashboard-max-width)] mx-auto w-full">
      {/* Header Summary */}
      <div className="flex justify-between items-end mb-2">
        <div>
          <h2 className="text-4xl font-bold text-[var(--color-ink-black)] tracking-tight">Cohort Overview</h2>
          <p className="text-[var(--color-warm-stone)] mt-2 text-lg">Monitor your learners' placement journey in real-time.</p>
        </div>
        {stats && (
          <div className="flex items-center gap-4 bg-white/80 backdrop-blur-md px-5 py-3 rounded-2xl shadow-[var(--shadow-sm)] border border-[var(--color-mist)]/50">
            <div className="w-14 h-14 rounded-full border-[3px] border-[var(--color-saathi-teal)] flex items-center justify-center bg-[var(--color-saathi-teal)]/5 text-[var(--color-saathi-teal)] font-bold text-lg">
              {stats.placement_rate}%
            </div>
            <div className="flex flex-col pr-2">
              <span className="text-[13px] font-bold text-[var(--color-ink-black)] uppercase tracking-wider">Placement Rate</span>
              <span className="text-sm text-[var(--color-warm-stone)] font-medium">Current cohort</span>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((card, idx) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1, duration: 0.4 }}
          >
            <Card className="border border-[var(--color-mist)]/30 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-teal)] hover:-translate-y-1 transition-all duration-300 rounded-[24px] bg-white overflow-hidden relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-white to-gray-50/50 z-0" />
              <CardContent className="p-6 relative z-10">
                <div className="flex items-center justify-between">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-110 ${card.color}`}>
                    <card.icon className="w-7 h-7" />
                  </div>
                  <div className="flex flex-col items-end">
                    {isStatsLoading ? (
                      <Skeleton className="h-10 w-20 mb-1 rounded-lg" />
                    ) : (
                      <span className="text-4xl font-bold text-[var(--color-ink-black)] tracking-tight">{card.value}</span>
                    )}
                    <span className="text-[15px] font-medium text-[var(--color-warm-stone)] mt-1">{card.title}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Priority Inbox */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className="border border-[var(--color-mist)]/50 shadow-[var(--shadow-card)] flex-1 rounded-[24px] bg-white overflow-hidden">
            <CardHeader className="pb-4 border-b border-[var(--color-mist)]/30 px-7 pt-7 bg-gray-50/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-[22px] flex items-center gap-2.5 text-[var(--color-ink-black)]">
                    <div className="p-2 bg-[var(--color-action-flame)]/10 rounded-xl">
                      <AlertTriangle className="w-5 h-5 text-[var(--color-action-flame)]" />
                    </div>
                    Priority Action Inbox
                  </CardTitle>
                  <CardDescription className="text-[15px] text-[var(--color-warm-stone)] mt-1.5 ml-[46px]">Learners requiring immediate officer attention.</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="h-10 px-5 rounded-xl font-semibold shadow-sm text-[var(--color-ink-black)] border-[var(--color-mist)]">View All</Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {isInboxLoading ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-[16px]" />
                  ))}
                </div>
              ) : inbox?.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-[var(--color-success-surface)] rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm">
                    <UserCheck className="w-10 h-10 text-[var(--color-success)]" />
                  </div>
                  <h3 className="text-xl font-semibold text-[var(--color-ink-black)]">All caught up!</h3>
                  <p className="text-[var(--color-warm-stone)] text-[15px] mt-2">No learners currently require immediate attention.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {inbox?.map((item: any) => (
                    <motion.div
                      key={item.id}
                      whileHover={{ scale: 1.01, translateY: -2 }}
                      className="flex items-center justify-between p-5 rounded-[16px] border border-[var(--color-mist)]/60 bg-white hover:shadow-[var(--shadow-card-warm)] transition-all duration-200 cursor-pointer group"
                    >
                      <div className="flex items-center gap-5">
                        <div className={`w-1.5 h-12 rounded-full shadow-sm ${item.urgency === 'critical' ? 'bg-[var(--color-risk)]' : item.urgency === 'follow_up' ? 'bg-[var(--color-action-flame)]' : 'bg-[var(--color-caution)]'}`} />
                        <div className="flex flex-col">
                          <span className="text-lg font-semibold text-[var(--color-ink-black)] group-hover:text-[var(--color-saathi-teal)] transition-colors">{item.full_name || item.phone}</span>
                          <span className="text-[15px] text-[var(--color-warm-stone)] mt-0.5">{item.reason}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-5">
                        <Badge variant={item.urgency === 'critical' ? 'destructive' : 'secondary'} className="capitalize px-3 py-1.5 text-[13px] rounded-lg font-semibold tracking-wide">
                          {item.urgency.replace('_', ' ')}
                        </Badge>
                        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-[var(--color-action-flame)]/10 transition-colors">
                          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[var(--color-action-flame)] transition-colors" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions / AI Insights */}
        <div className="flex flex-col gap-6">
          <Card className="border-none shadow-[var(--shadow-card-teal)] bg-gradient-to-br from-[var(--color-saathi-teal)] to-[var(--color-deep-moss)] text-white rounded-[24px] overflow-hidden relative h-full">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--color-action-flame)] opacity-20 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none" />
            <CardHeader className="relative z-10 px-7 pt-7 pb-4">
              <CardTitle className="text-[22px] font-bold flex items-center gap-2">
                <span className="text-2xl filter drop-shadow-md">✨</span> SaathiAI Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-7 pb-7 relative z-10">
              <div className="p-5 rounded-[16px] bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/15 transition-all duration-300 shadow-sm hover:shadow-md">
                <p className="text-[15px] leading-relaxed text-white/95">
                  <strong className="text-white font-semibold block mb-1">Smart Match ready:</strong> 12 active learners in the Fitter trade match newly posted jobs at Tata Motors.
                </p>
                <Button variant="secondary" className="w-full mt-4 h-10 text-[15px] font-semibold bg-white text-[var(--color-saathi-teal)] hover:bg-gray-50 rounded-xl shadow-sm hover:-translate-y-0.5 transition-all">
                  Review Matches
                </Button>
              </div>
              <div className="p-5 rounded-[16px] bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/15 transition-all duration-300 shadow-sm hover:shadow-md">
                <p className="text-[15px] leading-relaxed text-white/95">
                  <strong className="text-white font-semibold block mb-1">Attention:</strong> 3 learners from Cohort A have not responded to WhatsApp messages in 14 days.
                </p>
                <Button variant="outline" className="w-full mt-4 h-10 text-[15px] font-semibold border-white/30 text-white hover:bg-white/20 hover:text-white rounded-xl transition-all">
                  Send Follow-up
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
