import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock tRPC client
const mockMutate = vi.fn();
vi.mock('../../src/lib/trpc/client', () => ({
  trpc: {
    employer: {
      vacancies: {
        broadcast: {
          useMutation: () => ({
            mutate: mockMutate,
            isLoading: false,
          }),
        },
      },
    },
  },
}));

// Mock SmartTargetingPanel
vi.mock('../../src/components/employer/SmartTargetingPanel', () => ({
  default: ({ vacancyId }: { vacancyId: string }) => (
    <div data-testid="smart-targeting-panel">SmartTargetingPanel: {vacancyId}</div>
  ),
}));

// Mock framer-motion to render children directly without animations
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: React.forwardRef(({ children, initial, animate, exit, transition, ...props }: any, ref: any) => (
      <div ref={ref} {...props}>{children}</div>
    )),
  },
}));

import VacancyActionsMenu from '../../src/components/employer/VacancyActionsMenu';

const mockVacancy = {
  id: 'vacancy-123',
  title: 'Electrician',
  trade_required: 'Electrical',
  status: 'active',
};

/**
 * Helper to simulate a full pointer click sequence that Radix UI requires.
 * Radix DropdownMenu listens for pointerdown + pointerup + click.
 */
function pointerClick(element: HTMLElement) {
  fireEvent.pointerDown(element, { pointerType: 'mouse', button: 0 });
  fireEvent.pointerUp(element, { pointerType: 'mouse', button: 0 });
  fireEvent.click(element, { button: 0 });
}

// Radix uses window.DOMRect and ResizeObserver which jsdom doesn't implement
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.clearAllMocks();
  // Radix needs ResizeObserver
  global.ResizeObserver = MockResizeObserver as any;
  // Mock pointer capture methods that Radix uses
  Element.prototype.hasPointerCapture = function () { return false; };
  Element.prototype.setPointerCapture = function () {};
  Element.prototype.releasePointerCapture = function () {};
  // DOMRect mock for floating-ui positioning
  Element.prototype.getBoundingClientRect = function () {
    return { x: 0, y: 0, width: 100, height: 30, top: 0, right: 100, bottom: 30, left: 0, toJSON: () => {} } as DOMRect;
  };
  // scrollIntoView is used by Radix for focus management
  Element.prototype.scrollIntoView = function () {};
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('VacancyActionsMenu - Menu Open/Close and Keyboard Interactions', () => {
  /**
   * Validates: Requirements 1.1
   * Click trigger opens menu — the MoreVertical button opens the dropdown
   */
  it('click trigger opens menu and shows menu items', async () => {
    render(<VacancyActionsMenu vacancy={mockVacancy} />);

    const trigger = screen.getByRole('button', { name: /actions for electrician/i });
    expect(trigger).toBeInTheDocument();

    // Menu items should not be visible initially
    expect(screen.queryByText('View Applicants')).not.toBeInTheDocument();

    // Open menu with pointer events (Radix requirement)
    await act(async () => {
      pointerClick(trigger);
    });

    // Menu items should now be visible
    await waitFor(() => {
      expect(screen.getByText('View Applicants')).toBeInTheDocument();
      expect(screen.getByText('Edit Vacancy')).toBeInTheDocument();
      expect(screen.getByText('Notify Learners')).toBeInTheDocument();
    });
  });

  /**
   * Validates: Requirements 1.2
   * Click trigger again closes the menu
   */
  it('click trigger again closes the menu', async () => {
    render(<VacancyActionsMenu vacancy={mockVacancy} />);

    const trigger = screen.getByRole('button', { name: /actions for electrician/i });

    // Open the menu
    await act(async () => {
      pointerClick(trigger);
    });

    await waitFor(() => {
      expect(screen.getByText('View Applicants')).toBeInTheDocument();
    });

    // Click the trigger again to close
    await act(async () => {
      pointerClick(trigger);
    });

    await waitFor(() => {
      expect(screen.queryByText('View Applicants')).not.toBeInTheDocument();
    });
  });

  /**
   * Validates: Requirements 1.3, 1.6
   * Escape key closes menu and returns focus to trigger
   */
  it('Escape key closes menu and returns focus to trigger', async () => {
    render(<VacancyActionsMenu vacancy={mockVacancy} />);

    const trigger = screen.getByRole('button', { name: /actions for electrician/i });

    // Open the menu
    await act(async () => {
      pointerClick(trigger);
    });

    await waitFor(() => {
      expect(screen.getByText('View Applicants')).toBeInTheDocument();
    });

    // Press Escape on the active element (menu content)
    await act(async () => {
      fireEvent.keyDown(document.activeElement || document.body, {
        key: 'Escape',
        code: 'Escape',
      });
    });

    // Menu should be closed
    await waitFor(() => {
      expect(screen.queryByText('View Applicants')).not.toBeInTheDocument();
    });

    // Focus should return to the trigger button
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  /**
   * Validates: Requirements 1.4
   * Click outside closes menu
   */
  it('click outside closes menu', async () => {
    render(
      <div>
        <div data-testid="outside-element">Outside area</div>
        <VacancyActionsMenu vacancy={mockVacancy} />
      </div>
    );

    const trigger = screen.getByRole('button', { name: /actions for electrician/i });

    // Open the menu
    await act(async () => {
      pointerClick(trigger);
    });

    await waitFor(() => {
      expect(screen.getByText('View Applicants')).toBeInTheDocument();
    });

    // Click outside — Radix uses pointerdown on dismiss layer
    const outsideElement = screen.getByTestId('outside-element');
    await act(async () => {
      // Radix dismisses on pointerdown outside the content
      fireEvent.pointerDown(outsideElement, { pointerType: 'mouse', button: 0 });
    });

    await waitFor(() => {
      expect(screen.queryByText('View Applicants')).not.toBeInTheDocument();
    });
  });
});

describe('VacancyActionsMenu - Navigation Actions and Broadcast Flows', () => {
  /**
   * Validates: Requirements 2.1
   * "View Applicants" click navigates to the pipeline page with vacancy_id query param
   */
  it('"View Applicants" calls router.push with correct URL', async () => {
    render(<VacancyActionsMenu vacancy={mockVacancy} />);

    const trigger = screen.getByRole('button', { name: /actions for electrician/i });

    // Open the menu
    await act(async () => {
      pointerClick(trigger);
    });

    await waitFor(() => {
      expect(screen.getByText('View Applicants')).toBeInTheDocument();
    });

    // Click "View Applicants"
    const viewApplicants = screen.getByText('View Applicants');
    await act(async () => {
      pointerClick(viewApplicants);
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard/employer/pipeline?vacancy_id=vacancy-123');
    });
  });

  /**
   * Validates: Requirements 3.1
   * "Edit Vacancy" click navigates to the vacancy edit page
   */
  it('"Edit Vacancy" calls router.push with correct URL', async () => {
    render(<VacancyActionsMenu vacancy={mockVacancy} />);

    const trigger = screen.getByRole('button', { name: /actions for electrician/i });

    // Open the menu
    await act(async () => {
      pointerClick(trigger);
    });

    await waitFor(() => {
      expect(screen.getByText('Edit Vacancy')).toBeInTheDocument();
    });

    // Click "Edit Vacancy"
    const editVacancy = screen.getByText('Edit Vacancy');
    await act(async () => {
      pointerClick(editVacancy);
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard/employer/vacancies/vacancy-123/edit');
    });
  });

  /**
   * Validates: Requirements 5.1
   * "Send to All Matching" calls the broadcast mutation with correct parameters
   */
  it('"Send to All Matching" calls broadcast mutation with correct params', async () => {
    render(<VacancyActionsMenu vacancy={mockVacancy} />);

    const trigger = screen.getByRole('button', { name: /actions for electrician/i });

    // Open the menu
    await act(async () => {
      pointerClick(trigger);
    });

    await waitFor(() => {
      expect(screen.getByText('Notify Learners')).toBeInTheDocument();
    });

    // Open the "Notify Learners" sub-menu
    const notifyLearners = screen.getByText('Notify Learners');
    await act(async () => {
      pointerClick(notifyLearners);
    });

    await waitFor(() => {
      expect(screen.getByText('Send to All Matching')).toBeInTheDocument();
    });

    // Click "Send to All Matching"
    const sendToAll = screen.getByText('Send to All Matching');
    await act(async () => {
      pointerClick(sendToAll);
    });

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        { vacancy_id: 'vacancy-123', filters: { trade: 'Electrical' } },
        expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
      );
    });
  });

  /**
   * Validates: Requirements 5.3
   * Success toast renders when broadcast mutation succeeds
   */
  it('success toast renders when broadcast succeeds', async () => {
    mockMutate.mockImplementation((input: any, opts: any) => {
      opts.onSuccess({ count: 5, broadcast_at: '2024-01-01T00:00:00Z' });
    });

    render(<VacancyActionsMenu vacancy={mockVacancy} />);

    const trigger = screen.getByRole('button', { name: /actions for electrician/i });

    // Open the menu
    await act(async () => {
      pointerClick(trigger);
    });

    await waitFor(() => {
      expect(screen.getByText('Notify Learners')).toBeInTheDocument();
    });

    // Open the "Notify Learners" sub-menu
    const notifyLearners = screen.getByText('Notify Learners');
    await act(async () => {
      pointerClick(notifyLearners);
    });

    await waitFor(() => {
      expect(screen.getByText('Send to All Matching')).toBeInTheDocument();
    });

    // Click "Send to All Matching"
    const sendToAll = screen.getByText('Send to All Matching');
    await act(async () => {
      pointerClick(sendToAll);
    });

    // Success toast should appear
    await waitFor(() => {
      expect(screen.getByText('Notified 5 learners')).toBeInTheDocument();
    });
  });

  /**
   * Validates: Requirements 5.5
   * Error toast renders when broadcast hits rate limit
   */
  it('error toast renders when rate limit is hit', async () => {
    mockMutate.mockImplementation((input: any, opts: any) => {
      opts.onError({ data: { code: 'TOO_MANY_REQUESTS' } });
    });

    render(<VacancyActionsMenu vacancy={mockVacancy} />);

    const trigger = screen.getByRole('button', { name: /actions for electrician/i });

    // Open the menu
    await act(async () => {
      pointerClick(trigger);
    });

    await waitFor(() => {
      expect(screen.getByText('Notify Learners')).toBeInTheDocument();
    });

    // Open the "Notify Learners" sub-menu
    const notifyLearners = screen.getByText('Notify Learners');
    await act(async () => {
      pointerClick(notifyLearners);
    });

    await waitFor(() => {
      expect(screen.getByText('Send to All Matching')).toBeInTheDocument();
    });

    // Click "Send to All Matching"
    const sendToAll = screen.getByText('Send to All Matching');
    await act(async () => {
      pointerClick(sendToAll);
    });

    // Error toast should appear
    await waitFor(() => {
      expect(screen.getByText('Daily broadcast limit reached (5 per day)')).toBeInTheDocument();
    });
  });

  /**
   * Validates: Requirements 7.1
   * "Custom Targeting" click opens modal with SmartTargetingPanel
   */
  it('"Custom Targeting" opens modal with SmartTargetingPanel', async () => {
    render(<VacancyActionsMenu vacancy={mockVacancy} />);

    const trigger = screen.getByRole('button', { name: /actions for electrician/i });

    // Open the menu
    await act(async () => {
      pointerClick(trigger);
    });

    await waitFor(() => {
      expect(screen.getByText('Notify Learners')).toBeInTheDocument();
    });

    // Open the "Notify Learners" sub-menu
    const notifyLearners = screen.getByText('Notify Learners');
    await act(async () => {
      pointerClick(notifyLearners);
    });

    await waitFor(() => {
      expect(screen.getByText('Custom Targeting')).toBeInTheDocument();
    });

    // Click "Custom Targeting"
    const customTargeting = screen.getByText('Custom Targeting');
    await act(async () => {
      pointerClick(customTargeting);
    });

    // SmartTargetingPanel should render with correct vacancyId
    await waitFor(() => {
      expect(screen.getByTestId('smart-targeting-panel')).toBeInTheDocument();
      expect(screen.getByText('SmartTargetingPanel: vacancy-123')).toBeInTheDocument();
    });
  });
});
