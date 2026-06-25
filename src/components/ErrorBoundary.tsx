import { Component, ReactNode, ErrorInfo } from "react";
import { logger } from "@/lib/logger";
import { getUserFriendlyMessage } from "@/lib/errors";
import { Zap, AlertCircle } from "lucide-react";

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
  const isAiUnavailable    = error.message === "AI_UNAVAILABLE";
  const isPlatformOverload = error.message.includes("PLATFORM_UNAVAILABLE") || error.message.includes("All platform AI providers") || error.message.includes("temporarily overloaded");
  const isNotConfigured    = error.message.includes("AI is not configured");
  const isAiRelated        = isAiUnavailable || isPlatformOverload || isNotConfigured;

  const message = isAiUnavailable
    ? "AI generation is temporarily unavailable. You can try again shortly, or add your own API key in Profile → API Keys to generate without platform limits."
    : isPlatformOverload
    ? "Our AI providers are temporarily overloaded. Please try again in a moment — this usually clears within seconds. You can also add your own API key in Profile → API Keys to bypass platform limits."
    : isNotConfigured
    ? "The AI service is not configured on the server. Please contact support or try again later."
    : getUserFriendlyMessage(error);
  const showDetails = import.meta.env.DEV && typeof window !== 'undefined' && window.localStorage.getItem('ss:show-error-details') === 'true';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground font-sans p-6">
      <div className="max-w-[500px] w-full bg-card border border-border rounded-2xl p-10 text-center">
        <div className="flex justify-center mb-4">
          {isAiRelated
            ? <Zap className="w-10 h-10 text-primary" />
            : <AlertCircle className="w-10 h-10 text-destructive" />
          }
        </div>

        <h1 className="font-display text-2xl font-normal mb-4">
          {isPlatformOverload
            ? "AI Providers Overloaded"
            : isAiUnavailable
            ? "AI Generation Unavailable"
            : "Something Went Wrong"}
        </h1>

        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {message}
        </p>

        {showDetails && !isAiRelated && (
          <details className="text-xs bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-6 text-destructive text-left font-mono overflow-auto max-h-[150px]">
            <summary>Error details</summary>
            <div className="mt-2">{error.message}</div>
          </details>
        )}

        <div className="flex gap-2">
          {isAiRelated ? (
            <>
              <button
                onClick={reset}
                className="flex-1 bg-primary text-primary-foreground border border-primary rounded-lg px-4 py-3 text-sm font-medium cursor-pointer transition-colors hover:bg-primary/90"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.assign('/profile?tab=api-keys')}
                className="flex-1 bg-transparent text-foreground border border-border rounded-lg px-4 py-3 text-sm font-medium cursor-pointer transition-colors hover:border-primary/40"
              >
                Add API Key
              </button>
            </>
          ) : (
            <>
              <button
                onClick={reset}
                className="flex-1 bg-primary text-primary-foreground border border-primary rounded-lg px-4 py-3 text-sm font-medium cursor-pointer transition-colors hover:bg-primary/90"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-transparent text-foreground border border-border rounded-lg px-4 py-3 text-sm font-medium cursor-pointer transition-colors hover:border-accent/40"
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
