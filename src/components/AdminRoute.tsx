import { Navigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useIsAdmin();
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#07080d", display: "flex", alignItems: "center", justifyContent: "center", color: "#7a7a8e", fontFamily: "Sora, sans-serif", fontSize: 13 }}>
        Checking permissions…
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
