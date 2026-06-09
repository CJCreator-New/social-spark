import { Component, ReactNode, ErrorInfo } from "react";
import { logger } from "@/lib/logger";
import { getUserFriendlyMessage } from "@/lib/errors";

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
    logger.error("React Error Boundary caught error", error, {
      componentStack: errorInfo.componentStack,
    });

    this.props.onError?.(error, errorInfo);
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

function DefaultErrorFallback({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const isAiUnavailable = error.message === "AI_UNAVAILABLE";
  const message = isAiUnavailable
    ? "AI generation is currently unavailable. Add your own API key in Profile → API Keys to continue."
    : getUserFriendlyMessage(error);
  const showDetails = import.meta.env.DEV && typeof window !== 'undefined' && window.localStorage.getItem('ss:show-error-details') === 'true';

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#07080d",
        color: "#edeae3",
        fontFamily: "var(--font-body)",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "500px",
          background: "#0d0f18",
          border: "1px solid rgba(255, 255, 255, 0.055)",
          borderRadius: "16px",
          padding: "40px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>
          {isAiUnavailable ? "⚙️" : "!"}
        </div>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "24px",
            fontWeight: 400,
            marginBottom: "16px",
            margin: 0,
          }}
        >
          {isAiUnavailable ? "AI Generation Unavailable" : "Something Went Wrong"}
        </h1>

        <p
          style={{
            fontSize: "14px",
            color: "#7a7a8e",
            marginBottom: "24px",
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>

        {showDetails && !isAiUnavailable && (
          <details
            style={{
              fontSize: "12px",
              backgroundColor: "rgba(240, 154, 154, 0.08)",
              border: "1px solid rgba(240, 154, 154, 0.3)",
              borderRadius: "8px",
              padding: "12px",
              marginBottom: "24px",
              color: "#c8a9a9",
              textAlign: "left",
              fontFamily: "monospace",
              overflow: "auto",
              maxHeight: "150px",
            }}
          >
            <summary>Error details</summary>
            <div style={{ marginTop: "8px" }}>{error.message}</div>
          </details>
        )}

        <div style={{ display: "flex", gap: "8px" }}>
          {isAiUnavailable ? (
            <>
              <button
                onClick={() => window.location.assign('/profile?tab=api-keys')}
                style={{
                  flex: 1,
                  background: "#c8f09a",
                  color: "#07080d",
                  border: "1px solid #c8f09a",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.background = "#b9e289";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.background = "#c8f09a";
                }}
              >
                Go to API Keys
              </button>
              <button
                onClick={() => window.location.assign('/app')}
                style={{
                  flex: 1,
                  background: "transparent",
                  color: "#edeae3",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.borderColor = "rgba(200, 240, 154, 0.3)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.borderColor = "rgba(255, 255, 255, 0.1)";
                }}
              >
                Back to Dashboard
              </button>
            </>
          ) : (
            <>
              <button
                onClick={reset}
                style={{
                  flex: 1,
                  background: "#c8f09a",
                  color: "#07080d",
                  border: "1px solid #c8f09a",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.background = "#b9e289";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.background = "#c8f09a";
                }}
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  flex: 1,
                  background: "transparent",
                  color: "#edeae3",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.borderColor = "rgba(200, 240, 154, 0.3)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.borderColor = "rgba(255, 255, 255, 0.1)";
                }}
              >
                Reload App
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ErrorBoundary;
