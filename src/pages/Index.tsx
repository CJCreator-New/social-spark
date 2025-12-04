import { motion } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { PostGenerator } from "@/components/post/PostGenerator";
import { Bell, Search, User } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "-3s" }} />
      </div>

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="ml-64 min-h-screen">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border/50"
        >
          <div className="flex items-center justify-between px-8 py-4">
            <div>
              <h1 className="text-2xl font-display font-bold">Create Post</h1>
              <p className="text-sm text-muted-foreground">Transform your ideas into engaging social content</p>
            </div>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-64 h-10 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>

              {/* Notifications */}
              <button className="relative w-10 h-10 rounded-xl bg-secondary/50 border border-border/50 flex items-center justify-center hover:bg-secondary transition-colors">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
              </button>

              {/* Profile */}
              <button className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <User className="w-5 h-5 text-primary-foreground" />
              </button>
            </div>
          </div>
        </motion.header>

        {/* Content */}
        <div className="p-8">
          <PostGenerator />
        </div>
      </main>
    </div>
  );
};

export default Index;
