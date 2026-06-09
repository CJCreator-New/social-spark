import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ErrorBoundary } from "../ErrorBoundary";

// ---------------------------------------------------------------------------
// Mock the logger so tests don't pollute console
// ---------------------------------------------------------------------------
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helper: A child that throws
// ---------------------------------------------------------------------------
function ThrowingChild({ error }: { error: Error }): JSX.Element | null {
  throw error;
}

// Silence React's error boundary console.error during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("ErrorBoundary", () => {
  it("renders children normally when no error", () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Hello</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders friendly AI_UNAVAILABLE message when child throws AI_UNAVAILABLE", () => {
    const aiError = new Error("AI_UNAVAILABLE");

    render(
      <ErrorBoundary>
        <ThrowingChild error={aiError} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/AI Generation Unavailable/i)).toBeInTheDocument();
    expect(
      screen.getByText(/add your own API key in Profile/i)
    ).toBeInTheDocument();
  });

  it("renders 'Go to API Keys' button for AI_UNAVAILABLE error", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild error={new Error("AI_UNAVAILABLE")} />
      </ErrorBoundary>
    );

    const btn = screen.getByRole("button", { name: /go to api keys/i });
    expect(btn).toBeInTheDocument();
  });

  it("'Go to API Keys' button navigates to /profile?tab=api-keys", () => {
    // Redefine window.location to allow spying/mocking of assign in jsdom
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { ...originalLocation, assign: vi.fn() } as any;

    render(
      <ErrorBoundary>
        <ThrowingChild error={new Error("AI_UNAVAILABLE")} />
      </ErrorBoundary>
    );

    const btn = screen.getByRole("button", { name: /go to api keys/i });
    fireEvent.click(btn);

    expect(window.location.assign).toHaveBeenCalledWith("/profile?tab=api-keys");
    (window as any).location = originalLocation;
  });

  it("renders generic fallback for non-AI_UNAVAILABLE errors", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild error={new Error("Some other error")} />
      </ErrorBoundary>
    );

    expect(screen.getByRole("heading", { name: /something went wrong/i })).toBeInTheDocument();
    // Should NOT show AI Keys button
    expect(screen.queryByRole("button", { name: /go to api keys/i })).not.toBeInTheDocument();
  });

  it("does NOT render a raw stack trace to the user in production mode", () => {
    const errorWithStack = new Error("Some network error");
    errorWithStack.stack = "Error: Some network error\n  at foo (bar.js:1:1)\n  at baz (qux.js:2:2)";

    render(
      <ErrorBoundary>
        <ThrowingChild error={errorWithStack} />
      </ErrorBoundary>
    );

    // Stack trace text should not appear in the DOM
    expect(screen.queryByText(/at foo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/bar\.js/i)).not.toBeInTheDocument();
  });

  it("custom fallback prop is called with error and reset function", () => {
    const customFallback = vi.fn().mockReturnValue(<div>Custom Error UI</div>);

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowingChild error={new Error("test error")} />
      </ErrorBoundary>
    );

    expect(customFallback).toHaveBeenCalledWith(
      expect.objectContaining({ message: "test error" }),
      expect.any(Function) // reset function
    );
    expect(screen.getByText("Custom Error UI")).toBeInTheDocument();
  });

  it("'Try Again' button renders for non-AI errors", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild error={new Error("generic error")} />
      </ErrorBoundary>
    );

    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
