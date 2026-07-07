import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { RouteFallback } from "@/components/layout/RouteFallback";
import { toast } from "sonner";

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useIsAdmin();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }

    const timeout = window.setTimeout(() => setTimedOut(true), 8000);
    return () => window.clearTimeout(timeout);
  }, [loading]);

  useEffect(() => {
    if (!loading && !isAdmin) toast.error("You don't have admin access");
  }, [loading, isAdmin]);

  if (loading) {
    if (timedOut) {
      return (
        <RouteFallback title="Permission check timed out" ariaLabel="Permission check timed out" />
      );
    }
    return <RouteFallback title="Checking permissions" ariaLabel="Checking admin permissions" />;
  }
  if (!isAdmin) {
    return <Navigate to="/app" replace />;
  }
  return <>{children}</>;
}
