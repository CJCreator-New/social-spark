import { useEffect, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SkeletonList } from "@/components/SkeletonList";
import { setupGlobalErrorHandlers } from "@/lib/logger";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

// Lazy load pages for code splitting
import { lazy } from "react";
const Index = lazy(() => import("./pages/Index"));
const Profile = lazy(() => import("./pages/Profile"));
const MyCalendars = lazy(() => import("./pages/MyCalendars"));
const CalendarDetail = lazy(() => import("./pages/CalendarDetail"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Admin = lazy(() => import("./pages/Admin").then(m => ({ default: m.AdminDashboard })));

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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary>
            <AuthProvider>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/" element={<ProtectedRoute><Suspense fallback={<SkeletonList />}><Index /></Suspense></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Suspense fallback={<SkeletonList />}><Profile /></Suspense></ProtectedRoute>} />
                <Route path="/my-calendars" element={<ProtectedRoute><Suspense fallback={<SkeletonList />}><MyCalendars /></Suspense></ProtectedRoute>} />
                <Route path="/calendar/:id" element={<ProtectedRoute><Suspense fallback={<SkeletonList />}><CalendarDetail /></Suspense></ProtectedRoute>} />
                <Route path="/schedule" element={<ProtectedRoute><Suspense fallback={<SkeletonList />}><Schedule /></Suspense></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><Suspense fallback={<SkeletonList />}><Admin /></Suspense></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
