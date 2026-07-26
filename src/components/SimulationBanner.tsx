import { SIMULATION_MODE } from "@/lib/pixSimulation";
import { AlertTriangle } from "lucide-react";

const SimulationBanner = () => {
  if (!SIMULATION_MODE) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-center gap-2">
      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
      <p className="text-xs font-bold text-amber-600 text-center">
        ⚠️ MODO DE SIMULAÇÃO ATIVO — Transações não são reais
      </p>
    </div>
  );
};

export default SimulationBanner;
