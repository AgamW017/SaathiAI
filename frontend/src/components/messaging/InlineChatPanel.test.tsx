import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for InlineChatPanel component.
 * Validates: Requirements 3.4, 3.6, 3.7, 3.8
 */

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const { initial, animate, transition, ...rest } = props;
      return <div {...rest}>{children}</div>;
    },
  },
}));

// Mock the MessageThread component
vi.mock('./MessageThread', () => ({
  default: ({ messages }: { messages: any[] }) => (
    <div data-testid="message-thread">
      {messages.map((m: any) => (
        <div key={m.id}>{m.content}</div>
      ))}
    </div>
  ),
}));

// Create mock functions for tRPC hooks
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock('../../lib/trpc/client', () => ({
  trpc: {
    employer: {
      messaging: {
        getThread: {
          useQuery: (...args: any[]) => mockUseQuery(...args),
        },
        sendPing: {
          useMutation: (...args: any[]) => mockUseMutation(...args),
        },
      },
    },
  },
}));

// Import the component after all mocks are set up
import InlineChatPanel from './InlineChatPanel';

describe('InlineChatPanel', () => {
  let mockMutate: (...args: any[]) => any;
  let mockRefetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMutate = vi.fn();
    mockRefetch = vi.fn();

    // Default query mock: loaded with no messages
    mockUseQuery.mockReturnValue({
      data: { messages: [] },
      isLoading: false,
      refetch: mockRefetch,
    });

    // Default mutation mock
    mockUseMutation.mockImplementation((opts?: any) => ({
      mutate: (...args: any[]) => {
        mockMutate(...args);
        // Simulate success by default
        if (opts?.onSuccess) {
          opts.onSuccess();
        }
      },
      isPending: false,
    }));
  });

  describe('Empty state (Requirement 3.8)', () => {
    it('renders prompt message when thread is empty', () => {
      mockUseQuery.mockReturnValue({
        data: { messages: [] },
        isLoading: false,
        refetch: mockRefetch,
      });

      render(<InlineChatPanel learnerId="learner-1" learnerName="Ravi Kumar" />);

      expect(screen.getByText('No messages yet')).toBeInTheDocument();
      expect(
        screen.getByText(/Send a message to start the conversation with Ravi Kumar/)
      ).toBeInTheDocument();
    });

    it('renders learner name in header', () => {
      render(<InlineChatPanel learnerId="learner-1" learnerName="Ravi Kumar" />);

      expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();
    });

    it('renders learner initial avatar', () => {
      render(<InlineChatPanel learnerId="learner-1" learnerName="Ravi Kumar" />);

      expect(screen.getByText('R')).toBeInTheDocument();
    });
  });

  describe('Loading state (Requirement 3.7)', () => {
    it('renders shimmer skeleton while thread is loading', () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        refetch: mockRefetch,
      });

      const { container } = render(
        <InlineChatPanel learnerId="learner-1" learnerName="Ravi Kumar" />
      );

      // ShimmerSkeleton renders 3 placeholder blocks with shimmer animation
      const shimmerElements = container.querySelectorAll('[style*="animation: shimmer"]');
      expect(shimmerElements.length).toBe(3);
    });

    it('does not show empty state message while loading', () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        refetch: mockRefetch,
      });

      render(<InlineChatPanel learnerId="learner-1" learnerName="Ravi Kumar" />);

      expect(screen.queryByText('No messages yet')).not.toBeInTheDocument();
    });
  });

  describe('Character counter and 1000-char limit (Requirement 3.6)', () => {
    it('displays character counter showing 0/1000 initially', () => {
      render(<InlineChatPanel learnerId="learner-1" learnerName="Ravi Kumar" />);

      expect(screen.getByText('0/1000')).toBeInTheDocument();
    });

    it('updates character counter as user types', () => {
      render(<InlineChatPanel learnerId="learner-1" learnerName="Ravi Kumar" />);

      const textarea = screen.getByPlaceholderText('Type a message...');
      fireEvent.change(textarea, { target: { value: 'Hello' } });

      expect(screen.getByText('5/1000')).toBeInTheDocument();
    });

    it('shows counter at 1000/1000 for exactly 1000 characters', () => {
      render(<InlineChatPanel learnerId="learner-1" learnerName="Ravi Kumar" />);

      const textarea = screen.getByPlaceholderText('Type a message...');
      fireEvent.change(textarea, { target: { value: 'a'.repeat(1000) } });

      expect(screen.getByText('1000/1000')).toBeInTheDocument();
    });

    it('disables send button when message exceeds 1000 characters', () => {
      render(<InlineChatPanel learnerId="learner-1" learnerName="Ravi Kumar" />);

      const textarea = screen.getByPlaceholderText('Type a message...');
      fireEvent.change(textarea, { target: { value: 'a'.repeat(1001) } });

      const sendButton = screen.getByRole('button', { name: /send message/i });
      expect(sendButton).toBeDisabled();
    });

    it('does not disable send button at exactly 1000 characters', () => {
      render(<InlineChatPanel learnerId="learner-1" learnerName="Ravi Kumar" />);

      const textarea = screen.getByPlaceholderText('Type a message...');
      fireEvent.change(textarea, { target: { value: 'a'.repeat(1000) } });

      const sendButton = screen.getByRole('button', { name: /send message/i });
      expect(sendButton).not.toBeDisabled();
    });

    it('disables send button for empty message', () => {
      render(<InlineChatPanel learnerId="learner-1" learnerName="Ravi Kumar" />);

      const sendButton = screen.getByRole('button', { name: /send message/i });
      expect(sendButton).toBeDisabled();
    });

    it('disables send button for whitespace-only message', () => {
      render(<InlineChatPanel learnerId="learner-1" learnerName="Ravi Kumar" />);

      const textarea = screen.getByPlaceholderText('Type a message...');
      fireEvent.change(textarea, { target: { value: '   ' } });

      const sendButton = screen.getByRole('button', { name: /send message/i });
      expect(sendButton).toBeDisabled();
    });
  });

  describe('Error message on send failure (Requirement 3.4)', () => {
    it('displays error message below input when send fails', () => {
      const errorMessage = 'Daily message limit reached for this learner';

      mockUseMutation.mockImplementation((opts?: any) => ({
        mutate: (...args: any[]) => {
          mockMutate(...args);
          if (opts?.onError) {
            opts.onError({ message: errorMessage });
          }
        },
        isPending: false,
      }));

      render(<InlineChatPanel learnerId="learner-1" learnerName="Ravi Kumar" />);

      const textarea = screen.getByPlaceholderText('Type a message...');
      fireEvent.change(textarea, { target: { value: 'Hello' } });

      const sendButton = screen.getByRole('button', { name: /send message/i });
      fireEvent.click(sendButton);

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('displays generic error when no message is provided', () => {
      mockUseMutation.mockImplementation((opts?: any) => ({
        mutate: (...args: any[]) => {
          mockMutate(...args);
          if (opts?.onError) {
            opts.onError({ message: '' });
          }
        },
        isPending: false,
      }));

      render(<InlineChatPanel learnerId="learner-1" learnerName="Ravi Kumar" />);

      const textarea = screen.getByPlaceholderText('Type a message...');
      fireEvent.change(textarea, { target: { value: 'Hello' } });

      const sendButton = screen.getByRole('button', { name: /send message/i });
      fireEvent.click(sendButton);

      expect(screen.getByText('Failed to send message')).toBeInTheDocument();
    });

    it('clears error message on successful send', () => {
      // First trigger an error
      let mutationOpts: any = {};
      mockUseMutation.mockImplementation((opts?: any) => {
        mutationOpts = opts;
        return {
          mutate: (...args: any[]) => {
            mockMutate(...args);
            if (opts?.onError) {
              opts.onError({ message: 'Network error' });
            }
          },
          isPending: false,
        };
      });

      const { rerender } = render(
        <InlineChatPanel learnerId="learner-1" learnerName="Ravi Kumar" />
      );

      const textarea = screen.getByPlaceholderText('Type a message...');
      fireEvent.change(textarea, { target: { value: 'Hello' } });

      const sendButton = screen.getByRole('button', { name: /send message/i });
      fireEvent.click(sendButton);

      expect(screen.getByText('Network error')).toBeInTheDocument();

      // Now mock a successful send
      mockUseMutation.mockImplementation((opts?: any) => ({
        mutate: (...args: any[]) => {
          mockMutate(...args);
          if (opts?.onSuccess) {
            opts.onSuccess();
          }
        },
        isPending: false,
      }));

      rerender(<InlineChatPanel learnerId="learner-1" learnerName="Ravi Kumar" />);

      // Type and send again
      const textarea2 = screen.getByPlaceholderText('Type a message...');
      fireEvent.change(textarea2, { target: { value: 'Retry' } });

      const sendButton2 = screen.getByRole('button', { name: /send message/i });
      fireEvent.click(sendButton2);

      expect(screen.queryByText('Network error')).not.toBeInTheDocument();
    });
  });

  describe('Message sending', () => {
    it('calls sendPing mutation with correct arguments', () => {
      render(<InlineChatPanel learnerId="learner-123" learnerName="Ravi Kumar" />);

      const textarea = screen.getByPlaceholderText('Type a message...');
      fireEvent.change(textarea, { target: { value: 'Hello Ravi!' } });

      const sendButton = screen.getByRole('button', { name: /send message/i });
      fireEvent.click(sendButton);

      expect(mockMutate).toHaveBeenCalledWith({
        learnerId: 'learner-123',
        message: 'Hello Ravi!',
      });
    });

    it('trims whitespace before sending', () => {
      render(<InlineChatPanel learnerId="learner-123" learnerName="Ravi Kumar" />);

      const textarea = screen.getByPlaceholderText('Type a message...');
      fireEvent.change(textarea, { target: { value: '  Hello  ' } });

      const sendButton = screen.getByRole('button', { name: /send message/i });
      fireEvent.click(sendButton);

      expect(mockMutate).toHaveBeenCalledWith({
        learnerId: 'learner-123',
        message: 'Hello',
      });
    });
  });

  describe('Polling configuration', () => {
    it('passes 5000ms refetchInterval to getThread query', () => {
      render(<InlineChatPanel learnerId="learner-1" learnerName="Ravi Kumar" />);

      // Verify the query was called with correct arguments
      expect(mockUseQuery).toHaveBeenCalledWith(
        { learnerId: 'learner-1' },
        expect.objectContaining({ refetchInterval: 5000 })
      );
    });
  });
});
