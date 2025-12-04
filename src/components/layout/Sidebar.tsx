import { motion } from "framer-motion";
import { 
  Sparkles, 
  LayoutDashboard, 
  FileText, 
  Image, 
  BarChart3, 
  Settings,
  Zap,
  ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", active: false },
  { icon: Sparkles, label: "Create Post", active: true },
  { icon: FileText, label: "Templates", active: false },
  { icon: Image, label: "Media Library", active: false },
  { icon: BarChart3, label: "Analytics", active: false },
  { icon: Settings, label: "Settings", active: false },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border z-50 transition-all duration-300",
        collapsed ? "w-20" : "w-64"
      )}
    >
      <div className="flex flex-col h-full p-4">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-display text-xl font-bold gradient-text"
            >
              PostAI
            </motion.span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          {menuItems.map((item, index) => (
            <motion.button
              key={item.label}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group",
                item.active 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-transform duration-200 group-hover:scale-110",
                item.active && "text-primary"
              )} />
              {!collapsed && (
                <span className="font-medium">{item.label}</span>
              )}
              {item.active && !collapsed && (
                <motion.div
                  layoutId="activeIndicator"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
                />
              )}
            </motion.button>
          ))}
        </nav>

        {/* Collapse Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className={cn(
            "w-5 h-5 transition-transform duration-300",
            collapsed && "rotate-180"
          )} />
        </button>

        {/* Pro Badge */}
        {!collapsed && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="p-4 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Upgrade to Pro</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Unlock unlimited generations & advanced features
            </p>
            <button className="w-full py-2 rounded-lg glass-button text-xs font-semibold text-primary-foreground">
              Get Pro
            </button>
          </motion.div>
        )}
      </div>
    </motion.aside>
  );
}
