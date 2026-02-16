import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Loader2, Sparkles, Shield, Brain, Heart, Key, CalendarPlus } from "lucide-react";
import { api } from "@/lib/api";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const suggestions = [
  { icon: Heart, text: "How's my day looking?", color: "text-pink-400" },
  { icon: Shield, text: "I want to share a secret", color: "text-accent" },
  { icon: CalendarPlus, text: "Schedule a reminder for me", color: "text-primary" },
  { icon: Brain, text: "What do you know about me?", color: "text-warning" },
  { icon: Key, text: "Store an API key for me", color: "text-success" },
  { icon: Sparkles, text: "Surprise me with something", color: "text-primary" },
];

const heroTexts = [
  "Your personal AI vault",
  "Secrets stay safe here",
  "Schedule, plan, execute",
  "Your digital companion",
  "Memories, secured forever",
];

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroIndex((i) => (i + 1) % heroTexts.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    setInput("");
    const userMsg: Message = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const data = await api.chat(text.trim());
      const reply = data.reply || data.response || data.message || JSON.stringify(data);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Connection issue. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full relative">
      {/* Background orbs */}
      {isEmpty && (
        <>
          <div className="floating-orb w-72 h-72 top-20 left-1/4 animate-float" style={{ background: "radial-gradient(circle, hsl(270 80% 60% / 0.12), transparent)" }} />
          <div className="floating-orb w-56 h-56 bottom-40 right-1/4 animate-float-delayed" style={{ background: "radial-gradient(circle, hsl(185 75% 50% / 0.1), transparent)" }} />
        </>
      )}

      {/* Messages area - pb for overlay input clearance */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 pb-28 space-y-4 max-w-3xl mx-auto w-full">
        {isEmpty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full text-center relative z-10"
          >
            {/* Hero Bot Icon */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="w-20 h-20 rounded-3xl gradient-primary flex items-center justify-center mb-6 shadow-2xl relative"
              style={{ boxShadow: "0 0 50px hsl(var(--glow) / 0.3), 0 0 100px hsl(var(--glow-cyan) / 0.1)" }}
            >
              <Bot className="w-10 h-10 text-white" />
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-success animate-glow-pulse" />
            </motion.div>

            {/* Animated rotating text */}
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
              Hey, I'm <span className="text-gradient">Nexus</span>
            </h2>
            <div className="h-8 overflow-hidden mb-6">
              <AnimatePresence mode="wait">
                <motion.p
                  key={heroIndex}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="text-muted-foreground font-display text-sm md:text-base"
                >
                  {heroTexts[heroIndex]}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground max-w-md mb-8 leading-relaxed">
              Your personal AI agent that keeps your secrets safe, manages your schedule,
              tracks your goals, and helps you stay productive. Everything stays private.
            </p>

            {/* Suggestion chips */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 max-w-lg">
              {suggestions.map((s, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  onClick={() => sendMessage(s.text)}
                  className="glass-card hover:glow-border px-3.5 py-3 text-left transition-all duration-300 group cursor-pointer"
                >
                  <s.icon className={`w-4 h-4 mb-1.5 ${s.color} group-hover:scale-110 transition-transform`} />
                  <p className="text-xs text-foreground/80 font-display leading-snug">{s.text}</p>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 mt-1 shadow-lg" style={{ boxShadow: "0 0 15px hsl(var(--glow) / 0.2)" }}>
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "gradient-primary text-white rounded-br-md shadow-lg"
                    : "glass-card-strong text-card-foreground rounded-bl-md"
                }`}
                style={msg.role === "user" ? { boxShadow: "0 4px 20px hsl(var(--glow) / 0.2)" } : undefined}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-xl bg-muted/60 border border-border/50 flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="glass-card-strong rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground font-display">Thinking...</span>
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input - overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 pt-8 pb-4 px-4 bg-gradient-to-t from-background via-background/95 to-transparent backdrop-blur-sm pointer-events-none">
        <div className="pointer-events-auto max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..."
            className="flex-1 px-5 py-3.5 rounded-2xl bg-muted/50 border border-border/50 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all backdrop-blur-xl"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="gradient-btn px-5 py-3.5 flex items-center justify-center"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
