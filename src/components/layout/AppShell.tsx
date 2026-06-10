import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const menuItems = [
    { label: "New calendar", path: "/app", icon: "✨" },
    { label: "My calendars", path: "/my-calendars", icon: "📅" },
    { label: "Schedule", path: "/schedule", icon: "🕒" },
    { label: "Profile & Brand", path: "/profile", icon: "👤" },
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

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const activeItem = menuItems.find(item => location.pathname === item.path) || menuItems[0];
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
                      ? "text-[#c8f09a] bg-white/[0.04] font-medium border border-white/5"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]"
                  )}
                >
                  {/* Subtle hover glow effect */}
                  <span className="text-base z-10">{item.icon}</span>
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
            <span>🚪</span>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 md:h-screen md:overflow-y-auto overflow-x-hidden">
        {/* Subtle breadcrumb/topbar header on desktop */}
        <div className="hidden md:flex items-center justify-between h-16 px-8 border-b border-white/5 backdrop-blur-xl bg-background/20 sticky top-0 z-30">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Workspace</span>
            <span>/</span>
            <span className="text-slate-300 font-medium">{activeItem.label}</span>
          </div>
        </div>

        {/* Real route pages */}
        <div className="flex-1 pt-20 pb-12 px-4 md:pt-6 md:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}
