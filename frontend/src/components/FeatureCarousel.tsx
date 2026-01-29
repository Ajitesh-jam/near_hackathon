import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Zap, Shield, Globe, Lock, Server } from 'lucide-react';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: Shield,
    title: 'Trustless & Verifiable',
    description: 'Shade Agents operate in Trusted Execution Environments (TEEs), ensuring complete verifiability and non-custody of your assets.',
    gradient: 'from-cyan-500/20 to-blue-500/20',
  },
  {
    icon: Lock,
    title: 'Persistent Control',
    description: 'Using NEAR\'s decentralized key management, any instance running the same code can access the same accounts. No more lost private keys.',
    gradient: 'from-emerald-500/20 to-green-500/20',
  },
  {
    icon: Globe,
    title: 'Cross-Chain Operations',
    description: 'Autonomously sign transactions across any blockchain, interact with AI models, and manage assets seamlessly.',
    gradient: 'from-purple-500/20 to-pink-500/20',
  },
  {
    icon: Server,
    title: 'Privacy-Preserving',
    description: 'Perform verifiable computations while maintaining privacy. Get the flexibility of Web2 with the verifiability of Web3.',
    gradient: 'from-orange-500/20 to-amber-500/20',
  },
];

export const FeatureCarousel: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);

  const next = () => {
    setDirection(1);
    setCurrent((prev) => (prev + 1) % features.length);
  };

  const prev = () => {
    setDirection(-1);
    setCurrent((prev) => (prev - 1 + features.length) % features.length);
  };

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, []);

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
  };

  const feature = features[current];
  const Icon = feature.icon;

  return (
    <div className="relative">
      {/* Main Carousel */}
      <div className="relative h-[400px] overflow-hidden rounded-2xl glass-card neon-border">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="absolute inset-0 p-8 md:p-12 flex flex-col justify-center"
          >
            <div className={cn(
              "absolute inset-0 bg-gradient-to-br opacity-30",
              feature.gradient
            )} />
            
            <div className="relative z-10">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex p-4 rounded-2xl bg-primary/10 mb-6"
              >
                <Icon className="h-12 w-12 text-primary" />
              </motion.div>
              
              <motion.h3
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-3xl md:text-4xl font-bold mb-4 neon-text"
              >
                {feature.title}
              </motion.h3>
              
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-lg text-muted-foreground max-w-2xl"
              >
                {feature.description}
              </motion.p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        <button
          onClick={prev}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full glass-card hover:bg-primary/20 transition-colors group"
        >
          <ChevronLeft className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
        </button>
        <button
          onClick={next}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full glass-card hover:bg-primary/20 transition-colors group"
        >
          <ChevronRight className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
        </button>
      </div>

      {/* Dots Indicator */}
      <div className="flex justify-center gap-2 mt-6">
        {features.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              setDirection(index > current ? 1 : -1);
              setCurrent(index);
            }}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              index === current
                ? "w-8 bg-primary shadow-[0_0_10px_hsl(var(--primary))]"
                : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
            )}
          />
        ))}
      </div>
    </div>
  );
};
