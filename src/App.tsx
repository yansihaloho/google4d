import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import GanjilPage from "@/pages/ganjil";
import GenapPage from "@/pages/genap";
import BesarPage from "@/pages/besar";
import KecilPage from "@/pages/kecil";
import KecilEkorPage from "@/pages/kecil-ekor";
import BesarEkorPage from "@/pages/besar-ekor";
import GenapEkorPage from "@/pages/genap-ekor";
import GanjilEkorPage from "@/pages/ganjil-ekor";
import AnalisaHarianPage from "@/pages/analisa-harian";
import PrediksiAIPage from "@/pages/prediksi-ai";
import RiwayatPrediksiPage from "@/pages/riwayat-prediksi";
import Prediksi2DPage from "@/pages/prediksi-2d";
import PaitoPage from "@/pages/paito";
import { FloatingNav } from "@/components/floating-nav";
import { TopNav } from "@/components/top-nav";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/ganjil" component={GanjilPage} />
      <Route path="/genap" component={GenapPage} />
      <Route path="/besar" component={BesarPage} />
      <Route path="/kecil" component={KecilPage} />
      <Route path="/kecil-ekor" component={KecilEkorPage} />
      <Route path="/besar-ekor" component={BesarEkorPage} />
      <Route path="/genap-ekor" component={GenapEkorPage} />
      <Route path="/ganjil-ekor" component={GanjilEkorPage} />
      <Route path="/analisa-harian" component={AnalisaHarianPage} />
      <Route path="/prediksi-ai" component={PrediksiAIPage} />
      <Route path="/prediksi-2d" component={Prediksi2DPage} />
      <Route path="/riwayat-prediksi" component={RiwayatPrediksiPage} />
      <Route path="/paito" component={PaitoPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={((import.meta as any).env?.BASE_URL || "/").replace(/\/$/, "")}>
          <TopNav />
          <Router />
          <FloatingNav />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
