import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import { getBackendUrl } from "@/lib/api";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Layout from "@/components/Layout";
import SetupPage from "@/pages/SetupPage";
import NotificationsPage from "@/pages/NotificationsPage";
import ScheduledEventsPage from "@/pages/ScheduledEventsPage";
import ChatPage from "@/pages/ChatPage";
import AddDataPage from "@/pages/AddDataPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [configured, setConfigured] = useState(!!getBackendUrl());

  if (!configured) {
    return (
      <ThemeProvider>
        <Sonner />
        <SetupPage onComplete={() => setConfigured(true)} />
      </ThemeProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<ChatPage />} />
                <Route path="/events" element={<ScheduledEventsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/data" element={<AddDataPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
