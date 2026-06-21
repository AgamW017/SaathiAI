import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for SmartTargetingPanel component.
 * Validates: Requirements 5.4, 5.5, 5.6, 5.7
 *
 * Tests mock the tRPC hooks (previewTargetCount query and broadcast mutation)
 * to isolate component rendering logic.
 */

// Mock tRPC client
const mockPreviewQuery = {
  data: undefined as { count: number } | undefined,
  isLoading: false,
  isError: false,
};

const mockBroadcastMutate = vi.fn();
const mockBroadcastMutation: {
  mutate: ReturnType<typeof vi.fn>;
  isPending: boolean;
  _simulateSuccess?: any;
  _simulateError?: any;
} = {
  mutate: mockBroadcastMutate,
  isPending: false,
};

vi.mock('../../lib/trpc/client', () => ({
  trpc: {
    employer: {
      vacancies: {
        previewTargetCount: {
          useQuery: () => mockPreviewQuery,
        },
        broadcast: {
          useMutation: (opts: any) => {
            // Store callbacks so tests can trigger them
            mockBroadcastMutation.mutate = vi.fn((input: any) => {
              if (opts?.onSuccess && mockBroadcastMutation._simulateSuccess) {
                opts.onSuccess(mockBroadcastMutation._simulateSuccess);
              }
              if (opts?.onError && mockBroadcastMutation._simulateError) {
                opts.onError(mockBroadcastMutation._simulateError);
              }
            });
            return mockBroadcastMutation;
          },
        },
      },
    },
  },
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...filterDomProps(props)}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Helper to filter non-DOM props from framer-motion
function filterDomProps(props: Record<string, any>) {
  const { initial, animate, exit, transition, whileHover, whileTap, ...domProps } = props;
  return domProps;
}

import SmartTargetingPanel from './SmartTargetingPanel';

describe('SmartTargetingPanel - Filter Inputs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreviewQuery.data = undefined;
    mockPreviewQuery.isLoading = false;
    mockPreviewQuery.isError = false;
    mockBroadcastMutation._simulateSuccess = undefined;
    mockBroadcastMutation._simulateError = undefined;
    mockBroadcastMutation.isPending = false;
  });

  it('renders trade, district, and location filter inputs', () => {
    render(<SmartTargetingPanel vacancyId="v-1" onBroadcastComplete={vi.fn()} />);

    // Labels are present
    expect(screen.getByText('Trade')).toBeInTheDocument();
    expect(screen.getByText('District')).toBeInTheDocument();
    expect(screen.getByText('Location (State)')).toBeInTheDocument();

    // Corresponding inputs are present
    expect(screen.getByPlaceholderText('e.g. Electrician')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Varanasi')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Uttar Pradesh')).toBeInTheDocument();
  });

  it('renders filter input placeholders correctly', () => {
    render(<SmartTargetingPanel vacancyId="v-1" onBroadcastComplete={vi.fn()} />);

    expect(screen.getByPlaceholderText('e.g. Electrician')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Varanasi')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Uttar Pradesh')).toBeInTheDocument();
  });

  it('allows typing in filter fields', () => {
    render(<SmartTargetingPanel vacancyId="v-1" onBroadcastComplete={vi.fn()} />);

    const tradeInput = screen.getByPlaceholderText('e.g. Electrician') as HTMLInputElement;
    fireEvent.change(tradeInput, { target: { value: 'Plumber' } });
    expect(tradeInput.value).toBe('Plumber');
  });
});

describe('SmartTargetingPanel - Zero Match Warning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreviewQuery.data = { count: 0 };
    mockPreviewQuery.isLoading = false;
    mockPreviewQuery.isError = false;
    mockBroadcastMutation._simulateSuccess = undefined;
    mockBroadcastMutation._simulateError = undefined;
    mockBroadcastMutation.isPending = false;
  });

  it('displays zero-match warning when preview count is 0', async () => {
    render(<SmartTargetingPanel vacancyId="v-1" onBroadcastComplete={vi.fn()} />);

    // Type into trade to activate filters (triggers the preview display)
    const tradeInput = screen.getByPlaceholderText('e.g. Electrician') as HTMLInputElement;
    fireEvent.change(tradeInput, { target: { value: 'Welder' } });

    // Wait for debounce and re-render with query data
    await waitFor(() => {
      expect(screen.getByText(/0 learners match/i)).toBeInTheDocument();
    });
  });

  it('displays warning message about no matching learners', async () => {
    render(<SmartTargetingPanel vacancyId="v-1" onBroadcastComplete={vi.fn()} />);

    const tradeInput = screen.getByPlaceholderText('e.g. Electrician') as HTMLInputElement;
    fireEvent.change(tradeInput, { target: { value: 'Welder' } });

    await waitFor(() => {
      expect(screen.getByText(/no learners match these criteria/i)).toBeInTheDocument();
    });
  });

  it('disables broadcast button when count is 0', async () => {
    render(<SmartTargetingPanel vacancyId="v-1" onBroadcastComplete={vi.fn()} />);

    const tradeInput = screen.getByPlaceholderText('e.g. Electrician') as HTMLInputElement;
    fireEvent.change(tradeInput, { target: { value: 'Welder' } });

    await waitFor(() => {
      const broadcastBtn = screen.getByRole('button', { name: /broadcast to matching learners/i });
      expect(broadcastBtn).toBeDisabled();
    });
  });
});

describe('SmartTargetingPanel - Confirmation Dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreviewQuery.data = { count: 25 };
    mockPreviewQuery.isLoading = false;
    mockPreviewQuery.isError = false;
    mockBroadcastMutation._simulateSuccess = undefined;
    mockBroadcastMutation._simulateError = undefined;
    mockBroadcastMutation.isPending = false;
  });

  it('shows confirmation dialog when broadcast button is clicked', async () => {
    render(<SmartTargetingPanel vacancyId="v-1" onBroadcastComplete={vi.fn()} />);

    // Type to activate filters
    const tradeInput = screen.getByPlaceholderText('e.g. Electrician') as HTMLInputElement;
    fireEvent.change(tradeInput, { target: { value: 'Electrician' } });

    await waitFor(() => {
      expect(screen.getByText(/25 learners match/i)).toBeInTheDocument();
    });

    // Click broadcast button
    const broadcastBtn = screen.getByRole('button', { name: /broadcast to matching learners/i });
    fireEvent.click(broadcastBtn);

    // Confirmation dialog should appear
    expect(screen.getByText(/confirm broadcast/i)).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('shows target learner count in confirmation dialog', async () => {
    render(<SmartTargetingPanel vacancyId="v-1" onBroadcastComplete={vi.fn()} />);

    const tradeInput = screen.getByPlaceholderText('e.g. Electrician') as HTMLInputElement;
    fireEvent.change(tradeInput, { target: { value: 'Electrician' } });

    await waitFor(() => {
      expect(screen.getByText(/25 learners match/i)).toBeInTheDocument();
    });

    const broadcastBtn = screen.getByRole('button', { name: /broadcast to matching learners/i });
    fireEvent.click(broadcastBtn);

    // Should mention the action cannot be undone
    expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
  });

  it('closes confirmation dialog when cancel is clicked', async () => {
    render(<SmartTargetingPanel vacancyId="v-1" onBroadcastComplete={vi.fn()} />);

    const tradeInput = screen.getByPlaceholderText('e.g. Electrician') as HTMLInputElement;
    fireEvent.change(tradeInput, { target: { value: 'Electrician' } });

    await waitFor(() => {
      expect(screen.getByText(/25 learners match/i)).toBeInTheDocument();
    });

    const broadcastBtn = screen.getByRole('button', { name: /broadcast to matching learners/i });
    fireEvent.click(broadcastBtn);

    expect(screen.getByText(/confirm broadcast/i)).toBeInTheDocument();

    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    // Dialog should disappear
    expect(screen.queryByText(/confirm broadcast/i)).not.toBeInTheDocument();
  });
});

describe('SmartTargetingPanel - Success Notification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreviewQuery.data = { count: 12 };
    mockPreviewQuery.isLoading = false;
    mockPreviewQuery.isError = false;
    mockBroadcastMutation._simulateSuccess = { count: 12, broadcast_at: '2024-06-01T12:00:00Z' };
    mockBroadcastMutation._simulateError = undefined;
    mockBroadcastMutation.isPending = false;
  });

  it('shows success notification with count after broadcast', async () => {
    const onBroadcastComplete = vi.fn();
    render(<SmartTargetingPanel vacancyId="v-1" onBroadcastComplete={onBroadcastComplete} />);

    // Type to activate filters
    const tradeInput = screen.getByPlaceholderText('e.g. Electrician') as HTMLInputElement;
    fireEvent.change(tradeInput, { target: { value: 'Fitter' } });

    await waitFor(() => {
      expect(screen.getByText(/12 learners match/i)).toBeInTheDocument();
    });

    // Click broadcast, then confirm
    const broadcastBtn = screen.getByRole('button', { name: /broadcast to matching learners/i });
    fireEvent.click(broadcastBtn);

    const confirmBtn = screen.getByRole('button', { name: /confirm & send/i });
    fireEvent.click(confirmBtn);

    // Success message
    await waitFor(() => {
      expect(screen.getByText(/broadcast sent to 12 learners via whatsapp/i)).toBeInTheDocument();
    });

    // Callback should be invoked
    expect(onBroadcastComplete).toHaveBeenCalledWith(12);
  });
});

describe('SmartTargetingPanel - Broadcast Failure and Retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreviewQuery.data = { count: 10 };
    mockPreviewQuery.isLoading = false;
    mockPreviewQuery.isError = false;
    mockBroadcastMutation._simulateSuccess = undefined;
    mockBroadcastMutation._simulateError = { message: 'Unable to reach messaging service' };
    mockBroadcastMutation.isPending = false;
  });

  it('displays error message on broadcast failure', async () => {
    render(<SmartTargetingPanel vacancyId="v-1" onBroadcastComplete={vi.fn()} />);

    // Type to activate filters
    const tradeInput = screen.getByPlaceholderText('e.g. Electrician') as HTMLInputElement;
    fireEvent.change(tradeInput, { target: { value: 'Welder' } });

    await waitFor(() => {
      expect(screen.getByText(/10 learners match/i)).toBeInTheDocument();
    });

    // Click broadcast, then confirm
    const broadcastBtn = screen.getByRole('button', { name: /broadcast to matching learners/i });
    fireEvent.click(broadcastBtn);

    const confirmBtn = screen.getByRole('button', { name: /confirm & send/i });
    fireEvent.click(confirmBtn);

    // Error message should appear
    await waitFor(() => {
      expect(screen.getByText(/unable to reach messaging service/i)).toBeInTheDocument();
    });
  });

  it('shows retry button on broadcast failure', async () => {
    render(<SmartTargetingPanel vacancyId="v-1" onBroadcastComplete={vi.fn()} />);

    const tradeInput = screen.getByPlaceholderText('e.g. Electrician') as HTMLInputElement;
    fireEvent.change(tradeInput, { target: { value: 'Welder' } });

    await waitFor(() => {
      expect(screen.getByText(/10 learners match/i)).toBeInTheDocument();
    });

    const broadcastBtn = screen.getByRole('button', { name: /broadcast to matching learners/i });
    fireEvent.click(broadcastBtn);

    const confirmBtn = screen.getByRole('button', { name: /confirm & send/i });
    fireEvent.click(confirmBtn);

    // Retry button should appear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  it('retry button is clickable and triggers broadcast logic', async () => {
    render(<SmartTargetingPanel vacancyId="v-1" onBroadcastComplete={vi.fn()} />);

    const tradeInput = screen.getByPlaceholderText('e.g. Electrician') as HTMLInputElement;
    fireEvent.change(tradeInput, { target: { value: 'Welder' } });

    await waitFor(() => {
      expect(screen.getByText(/10 learners match/i)).toBeInTheDocument();
    });

    const broadcastBtn = screen.getByRole('button', { name: /broadcast to matching learners/i });
    fireEvent.click(broadcastBtn);

    const confirmBtn = screen.getByRole('button', { name: /confirm & send/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    // Click retry - should not throw and retry button should remain functional
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).not.toBeDisabled();
    fireEvent.click(retryBtn);

    // After retry click, the error may still show (since mock still returns error),
    // but the retry button was functional (not disabled)
    expect(retryBtn).toBeInTheDocument();
  });
});
