import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import FileDetails from "./pages/FileDetails";
import RuleDetails from "./pages/RuleDetails";
import { MainLayout } from "./components/layout/MainLayout";
import YaraEditor from "./pages/YaraEditor";
import Lab from "./pages/Lab";
import Diagrams from "./pages/Diagrams";
import TerminalPage from "./pages/TerminalPage";
import { UISettingsProvider } from "./hooks/useUISettings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <UISettingsProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/rules" element={<Index />} />
              <Route path="/hunt" element={<Index />} />
              <Route path="/files/:id" element={<FileDetails />} />
              <Route path="/rules/editor" element={<YaraEditor />} />
              <Route path="/rules/:identifier" element={<RuleDetails />} />
              <Route path="/lab" element={<Lab />} />
              <Route path="/terminal" element={<TerminalPage />} />
              <Route path="/deobfuscate" element={<Index />} />
              <Route path="/plugins" element={<Index />} />
              <Route path="/settings" element={<Index />} />
              <Route path="/vt" element={<Index />} />
              <Route path="/diagrams" element={<Diagrams />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </TooltipProvider>
    </UISettingsProvider>
  </QueryClientProvider>
);

export default App;
