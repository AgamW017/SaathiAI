"use client";

import * as React from "react";

interface ErrorBoundaryProps {
  children?: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class WebGLErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <WebGLFallback />;
    }
    return this.props.children;
  }
}

export function WebGLFallback({
  className,
  message = "Interactive WebGL content is unavailable on this device/browser.",
  style,
}: {
  className?: string;
  message?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: "linear-gradient(135deg, #09090b, #0f172a)",
        padding: "0 16px",
        textAlign: "center",
        fontSize: "14px",
        color: "rgba(255, 255, 255, 0.75)",
        ...style,
      }}
      role="status"
      aria-live="polite"
    >
      <p>{message}</p>
    </div>
  );
}
