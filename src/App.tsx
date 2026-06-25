import { useEffect, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { setupGlobalErrorHandlers } from "@/lib/logger";
import { RouteFallback } from "@/components/layout/RouteFallback";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

const Auth = lazyWithRetry(() => import("./pages/Auth"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const Landing = lazyWithRetry(() => import("./pages/Landing"));
const Privacy = lazyWithRetry(() => import("./pages/Privacy"));
const Terms = lazyWithRetry(() => import("./pages/Terms"));
const Docs = lazyWithRetry(() => import("./pages/Docs"));

function E2ECrashRoute(): JSX.Element {
  throw new Error("Test error");
}

// Lazy load pages for code splitting
const Index = lazyWithRetry(() => import("./pages/Index"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const MyCalendars = lazyWithRetry(() => import("./pages/MyCalendars"));
const CalendarDetail = lazyWithRetry(() => import("./pages/CalendarDetail"));
const Schedule = lazyWithRetry(() => import("./pages/Schedule"));
const Admin = lazyWithRetry(() => import("./pages/Admin").then(m => ({ default: m.AdminDashboard })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => {
  useEffect(() => {
    // Setup global error handlers on mount
    setupGlobalErrorHandlers();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <AuthProvider>
                <Routes>
                  <Route path="/auth" element={<Suspense fallback={<RouteFallback title="Sign In" />}><Auth /></Suspense>} />
                  <Route path="/reset-password" element={<Suspense fallback={<RouteFallback title="Reset Password" />}><ResetPassword /></Suspense>} />
                  <Route path="/" element={<Suspense fallback={<RouteFallback title="ContentForge" />}><Landing /></Suspense>} />
                  <Route path="/privacy" element={<Suspense fallback={<RouteFallback title="Privacy Policy" />}><Privacy /></Suspense>} />
                  <Route path="/terms" element={<Suspense fallback={<RouteFallback title="Terms of Service" />}><Terms /></Suspense>} />
                  <Route path="/docs" element={<Suspense fallback={<RouteFallback title="Docs" />}><Docs /></Suspense>} />
                  <Route path="/__e2e/crash" element={<E2ECrashRoute />} />
                  <Route
                    element={
                      <ProtectedRoute>
                        <AppShell>
                          <Outlet />
                        </AppShell>
                      </ProtectedRoute>
                    }
                  >
                    <Route
                      path="/app"
                      element={
                        <Suspense fallback={<RouteFallback title="ContentForge Workspace" />}>
                          <Index />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/profile"
                      element={
                        <Suspense fallback={<RouteFallback title="Profile Settings" />}>
                          <Profile />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/my-calendars"
                      element={
                        <Suspense fallback={<RouteFallback title="My Calendars" />}>
                          <MyCalendars />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/calendar/:id"
                      element={
                        <Suspense fallback={<RouteFallback title="Calendar Workspace" />}>
                          <CalendarDetail />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/schedule"
                      element={
                        <Suspense fallback={<RouteFallback title="Scheduling & Queue" />}>
                          <Schedule />
                        </Suspense>
                      }
                    />
                  </Route>
                  <Route path="/admin" element={<ProtectedRoute><AdminRoute><Suspense fallback={<RouteFallback title="Admin Dashboard" />}><Admin /></Suspense></AdminRoute></ProtectedRoute>} />
                  <Route path="*" element={<Suspense fallback={<RouteFallback title="Not Found" />}><NotFound /></Suspense>} />
                </Routes>
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
