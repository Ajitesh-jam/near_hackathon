import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, Trash2, RefreshCw, Zap, Sparkles } from "lucide-react";
import { api, type ScheduledEvent } from "@/lib/api";
import { toast } from "sonner";

const ScheduledEventsPage: React.FC = () => {
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await api.getScheduledEvents();
      setEvents((data.notifications || []).sort((a, b) => new Date(a.time_of_occur).getTime() - new Date(b.time_of_occur).getTime()));
    } catch {
      toast.error("Failed to fetch events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleReject = async (id: string) => {
    setRejecting(id);
    try {
      await api.rejectScheduledEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      toast.success("Event removed");
    } catch {
      toast.error("Failed to reject event");
    } finally {
      setRejecting(null);
    }
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const groupedByDate = events.reduce<Record<string, ScheduledEvent[]>>((acc, ev) => {
    const key = new Date(ev.time_of_occur).toDateString();
    (acc[key] = acc[key] || []).push(ev);
    return acc;
  }, {});

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            Scheduled Events
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-12">{events.length} upcoming</p>
        </div>
        <button onClick={fetchEvents} className="gradient-btn-outline p-2.5 rounded-xl">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && events.length === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4"
          >
            <Sparkles className="w-7 h-7 text-muted-foreground" />
          </motion.div>
          <p className="text-muted-foreground font-display">No scheduled events yet</p>
        </motion.div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px" style={{ background: "linear-gradient(to bottom, hsl(var(--primary) / 0.4), hsl(var(--accent) / 0.2), transparent)" }} />

          {Object.entries(groupedByDate).map(([dateStr, dayEvents], gi) => (
            <div key={dateStr} className="mb-8">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: gi * 0.1 }}
                className="flex items-center gap-3 mb-4 relative"
              >
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center z-10 shadow-lg animate-glow-pulse">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <span className="font-display text-sm font-semibold text-foreground">
                  {formatDate(dayEvents[0].time_of_occur)}
                </span>
              </motion.div>

              <AnimatePresence mode="popLayout">
                {dayEvents.map((ev, i) => (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="ml-12 mb-3 glass-card-strong p-4 relative"
                  >
                    <div className="absolute -left-[25px] top-5 w-2.5 h-2.5 rounded-full bg-primary animate-glow-pulse" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground font-medium text-sm">{ev.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(ev.time_of_occur)}
                          </span>
                          {ev.which_tool_to_call && (
                            <span className="flex items-center gap-1 font-mono text-accent">
                              <Zap className="w-3 h-3" />
                              {ev.which_tool_to_call}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleReject(ev.id)}
                        disabled={rejecting === ev.id}
                        className="gradient-btn-outline p-2 rounded-xl !border-destructive/40 !text-destructive flex-shrink-0"
                        title="Remove event"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScheduledEventsPage;
