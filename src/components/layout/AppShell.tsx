import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCalendarQuery } from "@/hooks/useAppQueries";
import { cn } from "@/lib/utils";
import { Sparkles, CalendarDays, Clock, UserCircle, LogOut } from "lucide-react";
import { motion } from "framer-motion";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { id: routeCalendarId } = useParams<{ id?: string }>();
  const isCalendarDetail = location.pathname.startsWith("/calendar/") && !!routeCalendarId;
  const { data: calendarData } = useCalendarQuery(isCalendarDetail ? routeCalendarId : undefined);
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { label: "New calendar", path: "/app", icon: Sparkles },
    { label: "My calendars", path: "/my-calendars", icon: CalendarDays },
    { label: "Schedule", path: "/schedule", icon: Clock },
    { label: "Profile", path: "/profile", icon: UserCircle },
  ];

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const activeItem = menuItems.find(item => location.pathname === item.path || (item.path === "/my-calendars" && location.pathname.startsWith("/calendar/"))) || menuItems[0];
  const breadcrumbLabel = isCalendarDetail
    ? (calendarData?.title || (calendarData ? "Untitled calendar" : "Loading…"))
    : activeItem.label;
  const initial = (user?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="relative min-h-screen flex flex-col w-full overflow-x-hidden" style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}>

      {/* TOP NAVBAR (sticky, warm white) */}
      <header className="sticky top-0 z-40 w-full border-b px-6 md:px-8 h-16 flex items-center justify-between" style={{ backgroundColor: "#ffffff", borderColor: "#e7e5e4", boxShadow: "0 2px 10px rgba(120,113,108,0.03)" }}>
        {/* Left: Brand */}
        <Link to="/app" className="flex items-center gap-2 font-bold text-lg hover:opacity-90 transition-opacity" style={{ fontFamily: "var(--font-display)", color: "#c2410c", textDecoration: "none" }}>
          <Sparkles className="w-5 h-5" style={{ color: "#c2410c" }} />
          <span>ContentForge</span>
        </Link>

        {/* Center: Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Main Navigation">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === "/my-calendars" && location.pathname.startsWith("/calendar/"));
            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative py-2 px-1"
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#c2410c" : "#57534e",
                  textDecoration: "none",
                  transition: "color 0.15s",
                }}
              >
                {item.label}
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute left-0 right-0"
                    style={{ bottom: -17, height: 2, backgroundColor: "#c2410c", borderRadius: 9999 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: User Avatar & Actions */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs font-medium truncate max-w-[140px]" style={{ color: "#78716c" }}>
            {user?.email || "Creator"}
          </span>
          <div className="w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs border" style={{ backgroundColor: "#fef3c7", color: "#c2410c", borderColor: "#c2410c", borderWidth: 1.5 }}>
            {initial}
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-full text-xs transition-all"
            style={{ padding: "6px 12px", color: "#57534e", background: "none", border: "none", cursor: "pointer" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#c2410c"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(194,65,12,0.05)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#57534e"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-1.5 transition-colors"
            style={{ color: "#57534e", background: "none", border: "none", cursor: "pointer" }}
            aria-label="Toggle menu"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {isOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile Drawer menu (warm) */}
      {isOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 z-30 flex flex-col p-6 border-b" style={{ backgroundColor: "#ffffff", borderColor: "#e7e5e4" }}>
          <nav className="flex flex-col gap-3">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path === "/my-calendars" && location.pathname.startsWith("/calendar/"));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all"
                  style={{
                    color: isActive ? "#c2410c" : "#57534e",
                    backgroundColor: isActive ? "rgba(194,65,12,0.05)" : "transparent",
                    fontWeight: isActive ? 600 : 500,
                    textDecoration: "none",
                  }}
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 w-full max-w-[1100px] mx-auto px-4 md:px-8 py-8 flex flex-col" style={{ paddingBottom: 80 }}>
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs" style={{ color: "#78716c" }}>
          {isCalendarDetail ? (
            <Link to="/my-calendars" style={{ color: "#78716c", textDecoration: "none", transition: "color 0.15s" }} onMouseEnter={e => (e.currentTarget.style.color = "#c2410c")} onMouseLeave={e => (e.currentTarget.style.color = "#78716c")}>My calendars</Link>
          ) : (
            <span>Workspace</span>
          )}
          <span>/</span>
          <span style={{ color: "#1c1917", fontWeight: 500 }}>{breadcrumbLabel}</span>
        </div>

        {/* Inner page content */}
        <div className="w-full flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
