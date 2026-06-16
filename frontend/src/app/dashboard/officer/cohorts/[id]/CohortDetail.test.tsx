import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

/**
 * Unit tests for the Cohort Detail View page.
 * Validates: Requirements 4.2, 4.3, 4.4, 8.4
 *
 * Tests:
 * - All required cohort fields are rendered (name, date, count, rate, salary)
 * - Learner table rows are clickable and navigate correctly
 * - Shimmer skeleton shown during loading
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'cohort-123' }),
  useRouter: () => ({ push: mockPush }),
}));

// Mock framer-motion to render children without animation
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: any, ref: any) => (
      <div ref={ref} {...props}>{children}</div>
    )),
    tr: React.forwardRef(({ children, ...props }: any, ref: any) => (
      <tr ref={ref} {...props}>{children}</tr>
    )),
  },
}));

// tRPC mock state
let mockCohortDetailData: any = null;
let mockCohortDetailLoading = false;
let mockCohortListData: any = null;
let mockLearnerListData: any = null;
let mockLearnerListLoading = false;
let mockLearnerListError: any = null;

vi.mock('../../../../../lib/trpc/client', () => ({
  trpc: {
    cohort: {
      getCohortDetail: {
        useQuery: (input: any, opts: any) => ({
          data: mockCohortDetailData,
          isLoading: mockCohortDetailLoading,
          error: null,
        }),
      },
      listCohorts: {
        useQuery: () => ({
          data: mockCohortListData,
          isLoading: false,
        }),
      },
    },
    dashboard: {
      learner: {
        list: {
          useQuery: (input: any, opts: any) => {
            // Simulate calling onSuccess if data is present
            if (mockLearnerListData && opts?.onSuccess) {
              opts.onSuccess(mockLearnerListData);
            }
            return {
              data: mockLearnerListData,
              isLoading: mockLearnerListLoading,
              error: mockLearnerListError,
            };
          },
        },
      },
    },
  },
}));

// Import the component AFTER mocks are set up
import CohortDetailsPage from './page';

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Cohort Detail View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCohortDetailData = null;
    mockCohortDetailLoading = false;
    mockCohortListData = null;
    mockLearnerListData = null;
    mockLearnerListLoading = false;
    mockLearnerListError = null;
  });

  describe('Shimmer skeleton during loading (Requirement 8.4)', () => {
    it('shows shimmer skeleton placeholders when cohort data is loading', () => {
      mockCohortDetailLoading = true;
      mockLearnerListLoading = true;

      const { container } = render(<CohortDetailsPage />);

      // Shimmer skeletons are rendered as divs with shimmer animation background
      const skeletonElements = container.querySelectorAll(
        'div[style*="linear-gradient"]'
      );
      expect(skeletonElements.length).toBeGreaterThan(0);
    });

    it('shows table skeleton rows when learner data is loading', () => {
      mockCohortDetailLoading = false;
      mockCohortDetailData = {
        cohort: { name: 'Test Cohort', createdAt: '2024-01-15T00:00:00Z' },
        stats: { total: 20, placementRate: 75 },
      };
      mockLearnerListLoading = true;

      const { container } = render(<CohortDetailsPage />);

      // Table header should still be visible
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Phone')).toBeInTheDocument();
      expect(screen.getByText('Trade')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Risk Score')).toBeInTheDocument();

      // Skeleton placeholders in the table body
      const skeletons = container.querySelectorAll(
        'td div[style*="linear-gradient"]'
      );
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Cohort fields rendering (Requirement 4.2)', () => {
    beforeEach(() => {
      mockCohortDetailData = {
        cohort: {
          name: 'ITI Batch 2024-A',
          createdAt: '2024-03-15T00:00:00Z',
        },
        stats: {
          total: 45,
          placementRate: 67,
        },
      };
      mockCohortListData = {
        data: [
          {
            id: 'cohort-123',
            name: 'ITI Batch 2024-A',
            stats: { averageSalary: 18500 },
          },
        ],
      };
      mockCohortDetailLoading = false;
      mockLearnerListData = { data: [], total: 0, totalPages: 1 };
      mockLearnerListLoading = false;
    });

    it('displays the cohort name', () => {
      render(<CohortDetailsPage />);
      expect(screen.getByText('ITI Batch 2024-A')).toBeInTheDocument();
    });

    it('displays the creation date', () => {
      render(<CohortDetailsPage />);
      // Date formatted with en-IN locale: "15 Mar 2024"
      expect(screen.getByText('15 Mar 2024')).toBeInTheDocument();
    });

    it('displays the learner count', () => {
      render(<CohortDetailsPage />);
      expect(screen.getByText('45')).toBeInTheDocument();
    });

    it('displays the placement rate', () => {
      render(<CohortDetailsPage />);
      expect(screen.getByText('67%')).toBeInTheDocument();
    });

    it('displays the average salary', () => {
      render(<CohortDetailsPage />);
      expect(screen.getByText('₹18,500')).toBeInTheDocument();
    });

    it('renders all stat labels (Learner Count, Placement Rate, Average Salary, Created)', () => {
      render(<CohortDetailsPage />);
      expect(screen.getAllByText('Learner Count').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Placement Rate').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Average Salary').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Created').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Learner table rows are clickable and navigate correctly (Requirements 4.3, 4.4)', () => {
    beforeEach(() => {
      mockCohortDetailData = {
        cohort: { name: 'Test Cohort', createdAt: '2024-01-01T00:00:00Z' },
        stats: { total: 3, placementRate: 33 },
      };
      mockCohortListData = { data: [] };
      mockLearnerListData = {
        data: [
          { id: 'learner-1', full_name: 'Amit Kumar', phone: '9876543210', trade: 'Electrician', status: 'active', risk_score: 25 },
          { id: 'learner-2', full_name: 'Priya Sharma', phone: '8765432109', trade: 'Fitter', status: 'placed', risk_score: 10 },
          { id: 'learner-3', full_name: 'Rahul Singh', phone: '7654321098', trade: 'Welder', status: 'at_risk', risk_score: 85 },
        ],
        total: 3,
        totalPages: 1,
      };
      mockLearnerListLoading = false;
    });

    it('renders learner names in the table', () => {
      render(<CohortDetailsPage />);
      expect(screen.getByText('Amit Kumar')).toBeInTheDocument();
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
      expect(screen.getByText('Rahul Singh')).toBeInTheDocument();
    });

    it('renders learner phone numbers', () => {
      render(<CohortDetailsPage />);
      expect(screen.getByText('9876543210')).toBeInTheDocument();
      expect(screen.getByText('8765432109')).toBeInTheDocument();
    });

    it('renders learner trade columns', () => {
      render(<CohortDetailsPage />);
      expect(screen.getByText('Electrician')).toBeInTheDocument();
      expect(screen.getByText('Fitter')).toBeInTheDocument();
      expect(screen.getByText('Welder')).toBeInTheDocument();
    });

    it('renders learner status badges', () => {
      render(<CohortDetailsPage />);
      // Status badges are rendered as <span> elements; the filter dropdown also has "Active", "Placed" etc.
      // Use getAllByText and check that at least 2 exist (one in dropdown, one in badge)
      const activeElements = screen.getAllByText('Active');
      expect(activeElements.length).toBeGreaterThanOrEqual(2); // one in filter, one in badge

      const placedElements = screen.getAllByText('Placed');
      expect(placedElements.length).toBeGreaterThanOrEqual(2); // one in filter, one in badge

      // "At Risk" is unique to the badge (filter uses "At Risk" option too)
      const atRiskElements = screen.getAllByText('At Risk');
      expect(atRiskElements.length).toBeGreaterThanOrEqual(2); // one in filter, one in badge
    });

    it('navigates to learner profile on row click', () => {
      render(<CohortDetailsPage />);

      const learnerRow = screen.getByText('Amit Kumar').closest('tr');
      expect(learnerRow).not.toBeNull();

      fireEvent.click(learnerRow!);
      expect(mockPush).toHaveBeenCalledWith('/dashboard/officer/learners/learner-1');
    });

    it('navigates to correct learner ID for different rows', () => {
      render(<CohortDetailsPage />);

      const priyaRow = screen.getByText('Priya Sharma').closest('tr');
      fireEvent.click(priyaRow!);
      expect(mockPush).toHaveBeenCalledWith('/dashboard/officer/learners/learner-2');
    });
  });
});
