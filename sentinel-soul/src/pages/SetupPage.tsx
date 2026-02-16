import React, { useState } from "react";
import { motion } from "framer-motion";
import { Bot, ArrowRight, Server, Shield, Sparkles, Lock } from "lucide-react";
import { setBackendUrl } from "@/lib/api";

interface SetupPageProps {
  onComplete: () => void;
}

const features = [
  { icon: Shield, text: "End-to-end secure" },
  { icon: Lock, text: "Your secrets, your control" },
  { icon: Sparkles, text: "AI-powered agent" },
];

const SetupPage: React.FC<SetupPageProps> = ({ onComplete }) => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    console.log("handleSubmit", url);
    try {
      const cleanUrl = url.trim().replace(/\/+$/, "");
      const res = await fetch(`${cleanUrl}/notifications`).catch(() => null);
      const testUrl =
        /^https?:\/\/(localhost|127\.0\.0\.1):3000$/i.test(cleanUrl) ? "/agent-api/notifications" : `${cleanUrl}/notifications`;
      // Test connection (use proxy for localhost:3000 to avoid CORS)
     
      if (!res) {
        setError("Could not reach the server. Check the URL and try again.");
        setLoading(false);
        return;
      }
      setBackendUrl(cleanUrl);
      onComplete();
    } catch {
      setError("Connection failed. Please verify the URL.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="floating-orb w-[500px] h-[500px] -top-60 -left-60" style={{ background: "radial-gradient(circle, hsl(270 80% 60% / 0.15), transparent)" }} />
      <div className="floating-orb w-[400px] h-[400px] -bottom-40 -right-40" style={{ background: "radial-gradient(circle, hsl(185 75% 50% / 0.12), transparent)" }} />
      <div className="floating-orb w-[300px] h-[300px] top-1/3 right-1/4" style={{ background: "radial-gradient(circle, hsl(300 70% 55% / 0.08), transparent)" }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="inline-flex w-20 h-20 rounded-3xl gradient-primary items-center justify-center mb-6 shadow-2xl"
            style={{ boxShadow: "0 0 50px hsl(var(--glow) / 0.35), 0 0 100px hsl(var(--glow-cyan) / 0.1)" }}
          >
            <Bot className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="font-display text-4xl font-bold mb-2">
            <span className="text-gradient">NEXUS</span>
          </h1>
          <p className="text-muted-foreground font-display text-sm">
            Your personal AI agent awaits
          </p>

          {/* Feature badges */}
          <div className="flex items-center justify-center gap-3 mt-5">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border/50"
              >
                <f.icon className="w-3 h-3 text-primary" />
                {f.text}
              </motion.div>
            ))}
          </div>
        </div>

        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onSubmit={handleSubmit}
          className="glass-card-strong glow-border p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Server className="w-4 h-4 text-primary" />
            <span className="font-display">Backend Agent URL</span>
          </div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-agent-api.example.com"
            className="w-full px-4 py-3.5 rounded-xl bg-muted/50 border border-border/50 text-foreground font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all backdrop-blur-xl"
            required
          />
          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-destructive">
              {error}
            </motion.p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="gradient-btn w-full flex items-center justify-center gap-2 px-4 py-3.5"
          >
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              />
            ) : (
              <>
                Connect <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </motion.form>

        <p className="text-center text-xs text-muted-foreground mt-6 flex items-center justify-center gap-1.5">
          <Lock className="w-3 h-3" />
          Your secrets are encrypted. Everything stays local.
        </p>
      </motion.div>
    </div>
  );
};

export default SetupPage;
