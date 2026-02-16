import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database, Heart, Target, DollarSign, Users, StickyNote, KeyRound, Send, Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Tab = "interests" | "goals" | "spending" | "contacts" | "notes" | "secrets";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "interests", label: "Interests", icon: Heart },
  { id: "goals", label: "Goals", icon: Target },
  { id: "spending", label: "Spending", icon: DollarSign },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "secrets", label: "Secrets", icon: KeyRound },
];

const AddDataPage: React.FC = () => {
  const [active, setActive] = useState<Tab>("interests");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [interest, setInterest] = useState("");
  const [goal, setGoal] = useState("");
  const [spending, setSpending] = useState({ amount: "", category: "", date: "" });
  const [contact, setContact] = useState({ name: "", email: "" });
  const [note, setNote] = useState("");
  const [secret, setSecret] = useState({ api_key_name: "", value: "" });

  const submit = async (endpoint: string, data: Record<string, unknown>) => {
    setLoading(true);
    setSuccess(false);
    try {
      await api.addData(endpoint, data);
      setSuccess(true);
      toast.success("Data added successfully");
      setTimeout(() => setSuccess(false), 2000);
    } catch {
      toast.error("Failed to add data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    switch (active) {
      case "interests":
        if (!interest.trim()) return;
        submit("add-data", { type: "interest", interest: interest.trim() });
        setInterest("");
        break;
      case "goals":
        if (!goal.trim()) return;
        submit("add-data", { type: "goal", goal: goal.trim() });
        setGoal("");
        break;
      case "spending":
        if (!spending.amount || !spending.category) return;
        submit("add-data", {
          type: "spending",
          amount: Number(spending.amount),
          category: spending.category,
          ...(spending.date ? { date: spending.date } : {}),
        });
        setSpending({ amount: "", category: "", date: "" });
        break;
      case "contacts":
        if (!contact.name) return;
        submit("add-data", { type: "contact", ...contact });
        setContact({ name: "", email: "" });
        break;
      case "notes":
        if (!note.trim()) return;
        submit("add-data", { type: "note", note: note.trim() });
        setNote("");
        break;
      case "secrets":
        if (!secret.api_key_name || !secret.value) return;
        submit("add-data", { type: "secret", ...secret });
        setSecret({ api_key_name: "", value: "" });
        break;
    }
  };

  const inputClass =
    "w-full px-4 py-3.5 rounded-xl bg-muted/50 border border-border/50 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all backdrop-blur-xl font-body";

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
            <Database className="w-4 h-4 text-white" />
          </div>
          Add Data
        </h1>
        <p className="text-sm text-muted-foreground mt-1 ml-12">Store information without calling the LLM</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-display text-sm transition-all duration-300 ${
              active === tab.id
                ? "gradient-btn text-white"
                : "glass-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Form */}
      <motion.div layout className="glass-card-strong glow-border p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {active === "interests" && (
                <input value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="e.g. Machine Learning, Crypto Trading" className={inputClass} />
              )}
              {active === "goals" && (
                <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Learn Rust by March" className={inputClass} />
              )}
              {active === "spending" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input type="number" value={spending.amount} onChange={(e) => setSpending({ ...spending, amount: e.target.value })} placeholder="Amount" className={inputClass} />
                  <input value={spending.category} onChange={(e) => setSpending({ ...spending, category: e.target.value })} placeholder="Category" className={inputClass} />
                  <input type="date" value={spending.date} onChange={(e) => setSpending({ ...spending, date: e.target.value })} className={inputClass} />
                </div>
              )}
              {active === "contacts" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder="Name" className={inputClass} />
                  <input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="Email" className={inputClass} />
                </div>
              )}
              {active === "notes" && (
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Write anything..." rows={4} className={`${inputClass} resize-none`} />
              )}
              {active === "secrets" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input value={secret.api_key_name} onChange={(e) => setSecret({ ...secret, api_key_name: e.target.value })} placeholder="Key name (e.g. Google API)" className={inputClass} />
                  <input type="password" value={secret.value} onChange={(e) => setSecret({ ...secret, value: e.target.value })} placeholder="Key value" className={inputClass} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className="gradient-btn flex items-center gap-2 px-6 py-3.5"
          >
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
              />
            ) : success ? (
              <><Check className="w-4 h-4" /> Saved</>
            ) : (
              <><Send className="w-4 h-4" /> Submit</>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default AddDataPage;
