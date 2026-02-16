import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Calendar, MessageSquare, Database, Sun, Moon, Bot, Menu, X,
  Check, Clock, Zap, Sparkles
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { api, type Notification } from "@/lib/api";
import { toast } from "sonner";

const navItems = [
  { to: "/", icon: MessageSquare, label: "Chat" },
  { to: "/events", icon: Calendar, label: "Events" },
  { to: "/notifications", icon: Bell, label: "Alerts" },
  { to: "/data", icon: Database, label: "Data" },
];

const Layout: React.FC = () => {
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifPanel, setNotifPanel] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [responding, setResponding] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => { setMobileOpen(false); }, [location]);

  // Fetch notifications on load
  useEffect(() => {
    api.getNotifications()
      .then((d) => setNotifications(d.notifications || []))
      .catch(() => {});
  }, []);

  const handleRespond = async (id: string, action: "approve" | "reject" | "dismiss") => {
    setResponding(id);
    try {
      await api.respondNotification(id, action);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success("Dismissed");
    } catch {
      toast.error(`Failed to ${action}`);
    } finally {
      setResponding(null);
    }
  };

  return (
    <div className="flex h-screen min-h-0 w-full max-w-full overflow-hidden bg-background relative">
      {/* Ambient orbs */}
      <div className="floating-orb w-96 h-96 -top-48 -left-48 bg-primary/20" />
      <div className="floating-orb w-80 h-80 -bottom-40 -right-40" style={{ background: "radial-gradient(circle, hsl(185 75% 50% / 0.15), transparent)" }} />

      {/* Desktop Sidebar - flex-shrink-0 so nav is never compressed */}
      <aside className="hidden md:flex flex-shrink-0 flex-col w-72 border-r border-border/50 bg-card/40 backdrop-blur-2xl relative z-10">
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-lg"
              style={{ boxShadow: "0 0 25px hsl(var(--glow) / 0.3)" }}
            >
              <Bot className="w-5 h-5 text-white" />
            </motion.div>
            <div>
              <h1 className="font-display text-lg font-bold text-gradient">NEXUS</h1>
              <p className="text-xs text-muted-foreground font-mono">AI Agent · Online</p>
            </div>
            <div className="ml-auto pulse-dot" />
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-display text-sm">{item.label}</span>
              {item.to === "/notifications" && notifications.length > 0 && (
                <span className="ml-auto bg-primary/20 text-primary text-xs font-mono px-2 py-0.5 rounded-full">
                  {notifications.length}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Notification toast trigger */}
        <div className="px-4 pb-2">
          <button
            onClick={() => setNotifPanel(!notifPanel)}
            className="gradient-btn-outline w-full flex items-center justify-center gap-2 px-4 py-2.5"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-sm">{notifications.length} Notification{notifications.length !== 1 ? "s" : ""}</span>
          </button>
        </div>

        <div className="p-4 border-t border-border/50">
          <button onClick={toggle} className="nav-link w-full justify-center gap-2">
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="font-display text-sm">{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-2xl border-b border-border/50">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-gradient">NEXUS</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNotifPanel(!notifPanel)}
              className="p-2 rounded-xl text-muted-foreground relative"
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-[10px] text-white rounded-full flex items-center justify-center font-mono">
                  {notifications.length}
                </span>
              )}
            </button>
            <button onClick={toggle} className="p-2 rounded-xl text-muted-foreground">
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-xl text-muted-foreground">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-4 space-y-1 border-t border-border/50 overflow-hidden"
            >
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-display text-sm">{item.label}</span>
                </NavLink>
              ))}
            </motion.nav>
          )}
        </AnimatePresence>
      </div>

      {/* Main content - min-w-0 prevents flex overflow from pushing nav */}
      <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto md:pt-0 pt-16 relative z-0">
        <Outlet />
      </main>

      {/* Notification Side Panel / Toast Panel */}
      <AnimatePresence>
        {notifPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNotifPanel(false)}
              className="fixed inset-0 bg-background/40 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm z-50 bg-card/90 backdrop-blur-2xl border-l border-border/50 flex flex-col"
            >
              <div className="p-5 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" />
                  <h2 className="font-display font-bold text-foreground">Notifications</h2>
                </div>
                <button onClick={() => setNotifPanel(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {notifications.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-3">
                      <Bell className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground font-display">All clear ✨</p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {notifications.map((n, i) => (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 40, height: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="notification-toast"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="w-3.5 h-3.5 text-accent" />
                          <span className="font-mono text-xs text-accent uppercase tracking-wider">
                            {(n as Record<string, unknown>).tool ?? n.which_tool_to_call ?? "Info"}
                          </span>
                        </div>
                        <p className="text-sm text-foreground font-medium mb-2">{n.description}</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                          <Clock className="w-3 h-3" />
                          {new Date(n.time_of_occur).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <button
                          onClick={() => handleRespond(n.id, "dismiss")}
                          disabled={responding === n.id}
                          className="gradient-btn-outline w-full px-3 py-2 flex items-center justify-center gap-1.5 text-xs"
                        >
                          <Check className="w-3.5 h-3.5" /> Dismiss
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Layout;
