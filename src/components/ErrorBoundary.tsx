import React from "react";
import { createScopedLogger } from "@/lib/logger";

const log = createScopedLogger("ErrorBoundary");

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    log.error("Unhandled error caught by ErrorBoundary", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: "center" }}>
          <h2>Something went wrong</h2>
          <p>We're sorry — an unexpected error occurred. You can try reloading the app.</p>
          <div style={{ marginTop: 16 }}>
            <button onClick={() => window.location.reload()} style={{ padding: "8px 12px", borderRadius: 6 }}>Reload</button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
import { Component, ReactNode, ErrorInfo } from 'react';
import { logger } from '@/lib/logger';
import { getUserFriendlyMessage } from '@/lib/errors';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component that catches React errors and displays fallback UI
 * Logs errors to centralized logging service
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to centralized logger
    logger.error('React Error Boundary caught error', error, {
      componentStack: errorInfo.componentStack,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Update state to show error
    this.setState({ errorInfo });
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      return <DefaultErrorFallback error={this.state.error} reset={this.reset} />;
    }

    return this.props.children;
  }
}

/**
 * Default error fallback UI
 */
function DefaultErrorFallback({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const message = getUserFriendlyMessage(error);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#07080d',
        color: '#edeae3',
        fontFamily: 'Sora, sans-serif',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: '500px',
          background: '#0d0f18',
          border: '1px solid rgba(255, 255, 255, 0.055)',
          borderRadius: '16px',
          padding: '40px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '48px',
            marginBottom: '16px',
          }}
        >
          ⚠️
        </div>

        <h1
          style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: '24px',
            fontWeight: 400,
            marginBottom: '16px',
            margin: 0,
          }}
        >
          Something Went Wrong
        </h1>

        <p
          style={{
            fontSize: '14px',
            color: '#7a7a8e',
            marginBottom: '24px',
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>

        <div
          style={{
            fontSize: '12px',
            backgroundColor: 'rgba(240, 154, 154, 0.08)',
            border: '1px solid rgba(240, 154, 154, 0.3)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '24px',
            color: '#c8a9a9',
            textAlign: 'left',
            fontFamily: 'monospace',
            overflow: 'auto',
            maxHeight: '150px',
          }}
        >
          <strong>Error Details:</strong>
          <div style={{ marginTop: '8px' }}>{error.message}</div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={reset}
            style={{
              flex: 1,
              background: '#c8f09a',
              color: '#07080d',
              border: '1px solid #c8f09a',
              borderRadius: '8px',
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'Sora, sans-serif',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.background = '#b9e289';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.background = '#c8f09a';
            }}
          >
            Try Again
          </button>

          <button
            onClick={() => (window.location.href = '/')}
            style={{
              flex: 1,
              background: 'transparent',
              color: '#7a7a8e',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'Sora, sans-serif',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.borderColor =
                'rgba(200, 240, 154, 0.3)';
              (e.target as HTMLButtonElement).style.color = '#c8f09a';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.borderColor =
                'rgba(255, 255, 255, 0.1)';
              (e.target as HTMLButtonElement).style.color = '#7a7a8e';
            }}
          >
            Go Home
          </button>
        </div>

        <p
          style={{
            fontSize: '11px',
            color: '#5a5a72',
            marginTop: '16px',
            margin: '16px 0 0 0',
          }}
        >
          Error details have been logged. Our team is working to fix this issue.
        </p>
      </div>
    </div>
  );
}

/**
 * Higher-order component to wrap a component with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorHandler?: (error: Error, errorInfo: ErrorInfo) => void
) {
  return function BoundaryComponent(props: P) {
    return (
      <ErrorBoundary onError={errorHandler}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
