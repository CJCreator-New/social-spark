import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCalendarQuery } from "@/hooks/useAppQueries";
import { cn } from "@/lib/utils";
import { Sparkles, CalendarDays, Clock, UserCircle, LogOut } from "lucide-react";

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
  const sidebarRef = useRef<HTMLDivElement>(null);

  const menuItems = [
    { label: "New calendar", path: "/app", icon: Sparkles },
    { label: "My calendars", path: "/my-calendars", icon: CalendarDays },
    { label: "Schedule", path: "/schedule", icon: Clock },
    { label: "Profile & Brand", path: "/profile", icon: UserCircle },
  ];

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Handle outside click to close mobile sidebar
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  // Escape key closes mobile sidebar, and focus trap while open
  useEffect(() => {
    if (!isOpen) return;

    const FOCUSABLE_SELECTOR =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        return;
      }

      if (e.key !== "Tab") return;

      const container = sidebarRef.current;
      if (!container) return;

      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !container.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Focus first focusable element in sidebar on open
    const container = sidebarRef.current;
    if (container) {
      const focusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      focusable?.focus();
    }

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const activeItem = menuItems.find(item => location.pathname === item.path) || menuItems[0];
  const breadcrumbLabel = isCalendarDetail
    ? (calendarData?.title || (calendarData ? "Untitled calendar" : "Loading…"))
    : activeItem.label;
  const initial = (user?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="relative min-h-screen bg-background text-foreground flex overflow-x-hidden w-full">
      {/* Background decoration elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[radial-gradient(circle_at_center,rgba(200,240,154,0.08)_0%,transparent_70%)] pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[radial-gradient(circle_at_center,rgba(154,200,240,0.06)_0%,transparent_70%)] pointer-events-none -z-10" />

      {/* MOBILE HEADER */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card/60 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#c8f09a] to-[#a0e86b] flex items-center justify-center text-background font-bold text-sm">
            CF
          </div>
          <span className="font-display text-lg tracking-tight">
            Content<em>Forge</em>
          </span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-slate-400 hover:text-white transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            {isOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </header>

      {/* MOBILE BACKDROP */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* SIDEBAR */}
      <aside
        ref={sidebarRef}
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card/45 backdrop-blur-2xl border-r border-white/5 flex flex-col justify-between p-6 transition-transform duration-300 ease-out md:translate-x-0 md:static md:h-screen md:flex-shrink-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col gap-8">
          {/* Logo Deck */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#c8f09a] to-[#a0e86b] flex items-center justify-center text-background font-bold text-base shadow-lg shadow-[#c8f09a]/15">
              CF
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#c8f09a]">
                AI Studio
              </div>
              <div className="font-display text-xl leading-tight">
                Content<em>Forge</em>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5" aria-label="Main Navigation">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-200 relative overflow-hidden group",
                    isActive
                      ? "text-[#c8f09a] bg-accent/10 font-semibold border border-white/5"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]"
                  )}
                >
                  {/* Subtle hover glow effect */}
                  <item.icon className="w-[18px] h-[18px] z-10" aria-hidden="true" />
                  <span className="z-10">{item.label}</span>
                  {isActive && (
                    <div className="absolute left-0 top-3 bottom-3 w-1 bg-[#c8f09a] rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card & Sign Out */}
        <div className="flex flex-col gap-4 border-t border-white/5 pt-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-slate-300 font-semibold text-sm">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500 truncate">Logged in as</div>
              <div className="text-sm font-medium text-slate-300 truncate" title={user?.email || ""}>
                {user?.email || "Workspace User"}
              </div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs text-slate-500 hover:text-red-400 hover:bg-red-500/[0.05] transition-all duration-200 w-full text-left"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 md:h-screen md:overflow-y-auto overflow-x-hidden">
        {/* Subtle breadcrumb/topbar header on desktop */}
        <header className="hidden md:flex items-center justify-between h-16 px-8 border-b border-white/5 backdrop-blur-xl bg-background/20 sticky top-0 z-30">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {isCalendarDetail ? (
              <Link to="/my-calendars" className="hover:text-slate-300 transition-colors">My calendars</Link>
            ) : (
              <span>Workspace</span>
            )}
            <span>/</span>
            <span className="text-slate-300 font-medium">{breadcrumbLabel}</span>
          </div>
        </header>

        {/* Real route pages */}
        <div className="flex-1 pt-20 pb-12 px-4 md:pt-6 md:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}
