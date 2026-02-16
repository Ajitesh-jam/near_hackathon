import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  Shield,
  Brain,
  Heart,
  Key,
  CalendarPlus,
} from "lucide-react";
import { api } from "@/lib/api";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const suggestions = [
  { icon: Heart, text: "How's my day looking?", color: "text-pink-400" },
  { icon: Shield, text: "I want to share a secret", color: "text-accent" },
  {
    icon: CalendarPlus,
    text: "Schedule a reminder for me",
    color: "text-primary",
  },
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Rotate hero text
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroIndex((i) => (i + 1) % heroTexts.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const data = await api.chat(text.trim());
      const reply =
        data.reply || data.response || data.message || JSON.stringify(data);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ Connection issue. Please try again.",
        },
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
    <div className="h-full w-full flex flex-col">
      {/* Scrollable area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 md:px-8 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* HERO STATE */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center text-center py-24">
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="w-20 h-20 rounded-3xl gradient-primary flex items-center justify-center mb-6 shadow-2xl relative"
              >
                <Bot className="w-10 h-10 text-white" />
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-success animate-glow-pulse" />
              </motion.div>

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

              <p className="text-sm text-muted-foreground max-w-md mb-10 leading-relaxed">
                Your personal AI agent that keeps your secrets safe, manages
                your schedule, tracks your goals, and helps you stay productive.
                Everything stays private.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-lg">
                {suggestions.map((s, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                    onClick={() => sendMessage(s.text)}
                    className="glass-card hover:glow-border px-4 py-3 text-left transition-all duration-300 group"
                  >
                    <s.icon
                      className={`w-4 h-4 mb-1.5 ${s.color} group-hover:scale-110 transition-transform`}
                    />
                    <p className="text-xs text-foreground/80 font-display leading-snug">
                      {s.text}
                    </p>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* CHAT MESSAGES */}
          {!isEmpty && (
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex gap-3 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center mt-1 shadow-lg">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}

                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === "user"
                        ? "gradient-primary text-white rounded-br-md shadow-lg"
                        : "glass-card-strong text-card-foreground rounded-bl-md"
                    }`}
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
                    <div className="w-8 h-8 rounded-xl bg-muted/60 border border-border/50 flex items-center justify-center mt-1">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="glass-card-strong rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground font-display">
                  Thinking...
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* INPUT BAR */}
      <div className="border-t border-border/40 bg-background/80 backdrop-blur-sm px-6 py-6">
        <div className="max-w-3xl mx-auto">
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