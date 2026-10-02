import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Simulator from "./pages/Simulator";
import FirmaDigital from "./pages/FirmaDigital";
import Apply from "./pages/Apply";
import Applications from "./pages/Applications";
import NotFound from "./pages/NotFound";
import PayLoans from "./pages/PayLoans";
import Desembolso from "./pages/Desembolso";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/simulator" element={<Simulator />} />
            <Route path="/apply" element={<Apply />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/pay-loans" element={<PayLoans />} />
            <Route path="/firmaDigital" element={<FirmaDigital />} />
            <Route path="/desembolso" element={<Desembolso />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
