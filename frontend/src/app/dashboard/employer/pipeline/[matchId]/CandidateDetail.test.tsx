import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

/**
 * Unit tests for the Candidate Detail Page.
 * Validates: Requirements 3.1, 8.6
 *
 * Tests:
 * - Renders learner profile information correctly
 * - InlineChatPanel is rendered with correct learnerId prop
 * - Back button navigates to pipeline page
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ matchId: 'match-abc-123' }),
  useRouter: () => ({ push: mockPush }),
}));

// Mock framer-motion to render children without animation
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: any, ref: any) => {
      const { initial, animate, transition, whileHover, whileTap, ...rest } = props;
      return <div ref={ref} {...rest}>{children}</div>;
    }),
  },
}));

// Capture InlineChatPanel props
const mockInlineChatPanel = vi.fn();
vi.mock('../../../../../components/messaging/InlineChatPanel', () => ({
  default: (props: any) => {
    mockInlineChatPanel(props);
    return <div data-testid="inline-chat-panel" data-learner-id={props.learnerId} data-learner-name={props.learnerName}>InlineChatPanel</div>;
  },
}));

// tRPC mock state
const mockGetCandidateDetail = vi.fn();
const mockTransitionMutate = vi.fn();
const mockInvalidate = vi.fn();

vi.mock('../../../../../lib/trpc/client', () => ({
  trpc: {
    employer: {
      pipeline: {
        getCandidateDetail: {
          useQuery: (...args: any[]) => mockGetCandidateDetail(...args),
        },
        transition: {
          useMutation: (opts?: any) => ({
            mutate: (...args: any[]) => {
              mockTransitionMutate(...args);
              if (opts?.onSuccess) opts.onSuccess();
            },
            isPending: false,
          }),
        },
      },
    },
    useUtils: () => ({
      employer: {
        pipeline: {
          getCandidateDetail: { invalidate: mockInvalidate },
        },
      },
    }),
  },
}));

// Import the component AFTER mocks are set up
import CandidateDetailPage from './page';

// ─── Test Data ────────────────────────────────────────────────────────────────

const mockCandidateData = {
  learners: {
    id: 'learner-xyz-456',
    full_name: 'Ravi Kumar',
    trade: 'Electrician',
    district: 'Pune',
    skill_cards: [
      {
        trade: 'Electrician',
        verification_status: 'verified',
        skills: ['Wiring', 'Motor Repair'],
      },
    ],
  },
  vacancies: {
    title: 'Junior Electrician',
    trade_required: 'Electrician',
    salary_min: 15000,
    salary_max: 22000,
    district: 'Pune',
  },
  stage: 'interest_expressed',
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Candidate Detail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInlineChatPanel.mockClear();

    // Default: loaded with candidate data
    mockGetCandidateDetail.mockReturnValue({
      data: mockCandidateData,
      isLoading: false,
      error: null,
    });
  });

  describe('Renders learner profile information correctly (Requirements 3.1, 8.6)', () => {
    it('displays the learner full name as the page heading', () => {
      render(<CandidateDetailPage />);
      // Name appears in h1 heading and profile card
      const nameElements = screen.getAllByText('Ravi Kumar');
      expect(nameElements.length).toBeGreaterThanOrEqual(1);
      // Verify the h1 heading specifically
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ravi Kumar');
    });

    it('displays the learner trade in the profile card', () => {
      render(<CandidateDetailPage />);
      // Trade appears in profile card and vacancy context
      const tradeElements = screen.getAllByText('Electrician');
      expect(tradeElements.length).toBeGreaterThanOrEqual(1);
    });

    it('displays the learner district in the profile card', () => {
      render(<CandidateDetailPage />);
      // District appears in profile card and vacancy context
      const districtElements = screen.getAllByText('Pune');
      expect(districtElements.length).toBeGreaterThanOrEqual(1);
    });

    it('displays skill card information', () => {
      render(<CandidateDetailPage />);
      expect(screen.getByText('Electrician (verified)')).toBeInTheDocument();
    });

    it('displays skills from the skill card', () => {
      render(<CandidateDetailPage />);
      expect(screen.getByText('Wiring')).toBeInTheDocument();
      expect(screen.getByText('Motor Repair')).toBeInTheDocument();
    });

    it('displays vacancy context with position title', () => {
      render(<CandidateDetailPage />);
      // Vacancy title appears in the subtitle and the vacancy context card
      const titleElements = screen.getAllByText('Junior Electrician');
      expect(titleElements.length).toBeGreaterThanOrEqual(1);
    });

    it('displays the current pipeline stage', () => {
      render(<CandidateDetailPage />);
      expect(screen.getByText('Interested')).toBeInTheDocument();
    });
  });

  describe('InlineChatPanel is rendered with correct learnerId prop (Requirement 3.1)', () => {
    it('renders InlineChatPanel component', () => {
      render(<CandidateDetailPage />);
      expect(screen.getByTestId('inline-chat-panel')).toBeInTheDocument();
    });

    it('passes the correct learnerId to InlineChatPanel', () => {
      render(<CandidateDetailPage />);
      expect(mockInlineChatPanel).toHaveBeenCalledWith(
        expect.objectContaining({ learnerId: 'learner-xyz-456' })
      );
    });

    it('passes the correct learnerName to InlineChatPanel', () => {
      render(<CandidateDetailPage />);
      expect(mockInlineChatPanel).toHaveBeenCalledWith(
        expect.objectContaining({ learnerName: 'Ravi Kumar' })
      );
    });
  });

  describe('Back button navigates to pipeline page', () => {
    it('renders a back button with text "Back to Pipeline"', () => {
      render(<CandidateDetailPage />);
      expect(screen.getByText('Back to Pipeline')).toBeInTheDocument();
    });

    it('navigates to /dashboard/employer/pipeline when back button is clicked', () => {
      render(<CandidateDetailPage />);
      const backButton = screen.getByText('Back to Pipeline');
      fireEvent.click(backButton);
      expect(mockPush).toHaveBeenCalledWith('/dashboard/employer/pipeline');
    });
  });

  describe('Loading and error states', () => {
    it('shows loading skeleton when data is being fetched', () => {
      mockGetCandidateDetail.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      const { container } = render(<CandidateDetailPage />);

      // Loading skeleton has shimmer animation elements
      const shimmerElements = container.querySelectorAll(
        'div[style*="linear-gradient"]'
      );
      expect(shimmerElements.length).toBeGreaterThan(0);
    });

    it('shows error message and back button when fetch fails', () => {
      mockGetCandidateDetail.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { message: 'Not found' },
      });

      render(<CandidateDetailPage />);
      expect(screen.getByText('Not found')).toBeInTheDocument();
      expect(screen.getByText('Back to Pipeline')).toBeInTheDocument();
    });
  });
});
