import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// ─── Extracted logic from reports/page.tsx for unit testing ───

/** Date validation logic: returns error message if startDate > endDate */
function validateDateRange(startDate: string, endDate: string): string | null {
  if (startDate && endDate && startDate > endDate) {
    return "Start date must be on or before end date.";
  }
  return null;
}

/** Format a date string to a readable format (same as in page.tsx) */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type ReportStatus = "generating" | "ready" | "failed";

/** StatusBadge component (mirrors the one in reports/page.tsx) */
function StatusBadge({ status }: { status: ReportStatus }) {
  switch (status) {
    case "generating":
      return (
        <span data-testid="status-badge" className="text-amber-700">
          Generating
        </span>
      );
    case "ready":
      return (
        <span data-testid="status-badge" className="text-green-700">
          Ready
        </span>
      );
    case "failed":
      return (
        <span data-testid="status-badge" className="text-red-700">
          Failed
        </span>
      );
    default:
      return (
        <span data-testid="status-badge" className="text-gray-600">
          Unknown
        </span>
      );
  }
}

/** Expired link detection logic (from downloadReport error handler) */
function isExpiredLink(errorMessage: string | undefined): boolean {
  return errorMessage?.includes("expired") ?? false;
}

// ─── Tests ───

describe("Reports UI - Filter Validation", () => {
  it("returns error when start date is after end date", () => {
    const error = validateDateRange("2025-01-15", "2025-01-10");
    expect(error).toBe("Start date must be on or before end date.");
  });

  it("returns null when start date is before end date", () => {
    const error = validateDateRange("2025-01-01", "2025-01-15");
    expect(error).toBeNull();
  });

  it("returns null when start date equals end date", () => {
    const error = validateDateRange("2025-01-10", "2025-01-10");
    expect(error).toBeNull();
  });

  it("returns null when start date is empty", () => {
    const error = validateDateRange("", "2025-01-10");
    expect(error).toBeNull();
  });

  it("returns null when end date is empty", () => {
    const error = validateDateRange("2025-01-10", "");
    expect(error).toBeNull();
  });

  it("returns null when both dates are empty", () => {
    const error = validateDateRange("", "");
    expect(error).toBeNull();
  });
});

describe("Reports UI - Report Status Display", () => {
  it("renders 'Generating' text for generating status", () => {
    render(<StatusBadge status="generating" />);
    expect(screen.getByTestId("status-badge")).toHaveTextContent("Generating");
  });

  it("renders 'Ready' text for ready status", () => {
    render(<StatusBadge status="ready" />);
    expect(screen.getByTestId("status-badge")).toHaveTextContent("Ready");
  });

  it("renders 'Failed' text for failed status", () => {
    render(<StatusBadge status="failed" />);
    expect(screen.getByTestId("status-badge")).toHaveTextContent("Failed");
  });

  it("renders 'Unknown' for unrecognized status", () => {
    // @ts-expect-error testing unknown status
    render(<StatusBadge status="other" />);
    expect(screen.getByTestId("status-badge")).toHaveTextContent("Unknown");
  });
});

describe("Reports UI - Download Link Handling", () => {
  it("detects expired link from error message containing 'expired'", () => {
    expect(isExpiredLink("Download link has expired")).toBe(true);
  });

  it("detects expired in various message formats", () => {
    expect(isExpiredLink("The report link expired, please regenerate")).toBe(true);
  });

  it("returns false for non-expired error messages", () => {
    expect(isExpiredLink("Network error")).toBe(false);
  });

  it("returns false for undefined error message", () => {
    expect(isExpiredLink(undefined)).toBe(false);
  });
});

describe("Reports UI - formatDate utility", () => {
  it("formats ISO date string to en-IN locale", () => {
    const result = formatDate("2025-01-15");
    // en-IN format: "15 Jan 2025"
    expect(result).toContain("Jan");
    expect(result).toContain("2025");
    expect(result).toContain("15");
  });

  it("formats another date correctly", () => {
    const result = formatDate("2024-12-25");
    expect(result).toContain("Dec");
    expect(result).toContain("2024");
    expect(result).toContain("25");
  });
});
