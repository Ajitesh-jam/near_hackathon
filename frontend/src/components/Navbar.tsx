import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Cpu, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { WalletButton } from "./NEAR/NEARWalletButton";

const navItems = [
  { name: "Home", path: "/" },
  { name: "Build Agent", path: "/buildAgent" },
];

export const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Cpu className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xl font-bold neon-text">
              Shade<span className="text-foreground">Agent</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path}>
                <Button
                  variant="ghost"
                  className="text-foreground/80 hover:text-primary"
                >
                  {item.name}
                </Button>
              </Link>
            ))}
            <Link to="/buildAgent">
              <Button variant="glow" className="ml-4">
                Launch Agent
              </Button>
            </Link>

            <ConnectButton />
            <WalletButton />
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X /> : <Menu />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        <motion.div
          initial={false}
          animate={{ height: isOpen ? "auto" : 0 }}
          className="md:hidden overflow-hidden"
        >
          <div className="py-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
              >
                <Button variant="ghost" className="w-full justify-start">
                  {item.name}
                </Button>
              </Link>
            ))}
            <Link to="/buildAgent" onClick={() => setIsOpen(false)}>
              <Button variant="glow" className="w-full mt-4">
                Launch Agent
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </motion.nav>
  );
};
