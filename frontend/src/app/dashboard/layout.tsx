import React from 'react';
import { TooltipProvider } from '@/src/components/ui/tooltip';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {children}
      </div>
    </TooltipProvider>
  );
}
