'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { trpc } from './client';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

/**
 * Creates a fresh QueryClient. We instantiate this inside a component so
 * Next.js doesn't share a single instance across requests.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Stale time of 30 seconds to avoid refetching immediately on focus
        staleTime: 30 * 1000,
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  }
  // Browser: reuse the same client
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

/**
 * Wrap your app (or layout) with this provider to enable tRPC + React Query.
 *
 * The Authorization header is automatically read from localStorage on each
 * request, so tokens set by authStore are picked up immediately.
 */
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${BACKEND_URL}/trpc`,
          transformer: superjson,
          headers() {
            // Pick up token from localStorage on every request
            if (typeof window === 'undefined') return {};
            const token = localStorage.getItem('saathi_access_token');
            return token ? { Authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
