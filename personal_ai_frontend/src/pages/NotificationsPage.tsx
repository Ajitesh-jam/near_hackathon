import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, Clock, Zap, RefreshCw, Sparkles } from "lucide-react";
import { api, type Notification } from "@/lib/api";
import { toast } from "sonner";

const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications || []);
    } catch {
      toast.error("Failed to fetch notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

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
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
              <Bell className="w-4 h-4 text-white" />
            </div>
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-12">
            {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={fetchNotifications}
          className="gradient-btn-outline p-2.5 rounded-xl"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && notifications.length === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4"
          >
            <Sparkles className="w-7 h-7 text-muted-foreground" />
          </motion.div>
          <p className="text-muted-foreground font-display">All clear. No pending notifications ✨</p>
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          {notifications.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="glass-card-strong glow-border p-5 mb-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-accent flex-shrink-0" />
                    <span className="font-mono text-xs text-accent uppercase tracking-wider">
                      {(n as Record<string, unknown>).tool ?? n.which_tool_to_call ?? "Info"}
                    </span>
                  </div>
                  <p className="text-foreground font-medium mb-2">{n.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(n.time_of_occur).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {n.arguments && Object.keys(n.arguments).length > 0 && (
                      <span className="font-mono bg-muted/60 px-2 py-0.5 rounded-lg text-xs">
                        {Object.entries(n.arguments).map(([k, v]) => `${k}: ${v}`).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRespond(n.id, "dismiss")}
                  disabled={responding === n.id}
                  className="gradient-btn-outline px-3.5 py-2 flex items-center gap-1.5 text-xs flex-shrink-0"
                  title="Dismiss"
                >
                  <Check className="w-4 h-4" /> Dismiss
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
};

export default NotificationsPage;
