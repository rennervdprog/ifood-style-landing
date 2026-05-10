import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight, ChevronLeft, SkipForward } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

export interface TourStep {
  target: string; // CSS selector
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
}

interface ProductTourProps {
  steps: TourStep[];
  tourKey: string; // unique key per role
  onComplete?: () => void;
}

const ProductTour = ({ steps, tourKey, onComplete }: ProductTourProps) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const [arrowDir, setArrowDir] = useState<"top" | "bottom" | "left" | "right">("top");
  const tooltipRef = useRef<HTMLDivElement>(null);
  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), Math.max(min, max));

  // Check if user already saw onboarding
  useEffect(() => {
    if (!user) return;
    const checkOnboarding = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("has_seen_onboarding")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data && !(data as any).has_seen_onboarding) {
        setTimeout(() => setVisible(true), 800);
      }
    };
    checkOnboarding();
  }, [user]);

  const positionTooltip = useCallback(async () => {
    const step = steps[currentStep];
    if (!step) return;
    const viewportPadding = 12;
    const margin = 16;
    const tooltipWidth = Math.min(340, window.innerWidth - viewportPadding * 2);
    const tooltipHeight = Math.max(tooltipRef.current?.offsetHeight || 0, 220);
    const el = document.querySelector(step.target);
    if (!el) {
      // If element not found, skip to next step or center tooltip
      if (currentStep < steps.length - 1) {
        setCurrentStep(s => s + 1);
        return;
      }
      setTooltipStyle({
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10002,
        width: tooltipWidth,
        maxWidth: `calc(100vw - ${viewportPadding * 2}px)`,
      });
      return;
    }

    // Scroll element into view before positioning
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Wait for scroll to settle
    await new Promise(r => setTimeout(r, 350));

    const rect = el.getBoundingClientRect();
    const preferredPos = step.position || "bottom";
    let pos = preferredPos;
    let style: React.CSSProperties = {
      position: "fixed",
      zIndex: 10002,
      width: tooltipWidth,
      maxWidth: `calc(100vw - ${viewportPadding * 2}px)`,
    };
    let aStyle: React.CSSProperties = { position: "absolute" };

    const fitsBelow = rect.bottom + margin + tooltipHeight <= window.innerHeight - viewportPadding;
    const fitsAbove = rect.top - margin - tooltipHeight >= viewportPadding;
    const fitsRight = rect.right + margin + tooltipWidth <= window.innerWidth - viewportPadding;
    const fitsLeft = rect.left - margin - tooltipWidth >= viewportPadding;

    if (preferredPos === "bottom" && !fitsBelow && fitsAbove) pos = "top";
    if (preferredPos === "top" && !fitsAbove && fitsBelow) pos = "bottom";
    if (preferredPos === "right" && !fitsRight && fitsLeft) pos = "left";
    if (preferredPos === "left" && !fitsLeft && fitsRight) pos = "right";

    const centeredLeft = clamp(
      rect.left + rect.width / 2 - tooltipWidth / 2,
      viewportPadding,
      window.innerWidth - tooltipWidth - viewportPadding,
    );
    const centeredTop = clamp(
      rect.top + rect.height / 2 - tooltipHeight / 2,
      viewportPadding,
      window.innerHeight - tooltipHeight - viewportPadding,
    );

    // Highlight element
    (el as HTMLElement).style.position = "relative";
    (el as HTMLElement).style.zIndex = "10001";
    (el as HTMLElement).style.boxShadow = "0 0 0 4px hsl(var(--primary) / 0.4)";
    (el as HTMLElement).style.borderRadius = "12px";

    if (pos === "bottom") {
      style.top = clamp(
        rect.bottom + margin,
        viewportPadding,
        window.innerHeight - tooltipHeight - viewportPadding,
      );
      style.left = centeredLeft;
      aStyle = { top: -8, left: "50%", transform: "translateX(-50%)" };
      setArrowDir("top");
    } else if (pos === "top") {
      style.top = clamp(
        rect.top - tooltipHeight - margin,
        viewportPadding,
        window.innerHeight - tooltipHeight - viewportPadding,
      );
      style.left = centeredLeft;
      aStyle = { bottom: -8, left: "50%", transform: "translateX(-50%)" };
      setArrowDir("bottom");
    } else if (pos === "right") {
      style.top = centeredTop;
      style.left = clamp(
        rect.right + margin,
        viewportPadding,
        window.innerWidth - tooltipWidth - viewportPadding,
      );
      aStyle = { left: -8, top: "50%", transform: "translateY(-50%)" };
      setArrowDir("left");
    } else {
      style.top = centeredTop;
      style.left = clamp(
        rect.left - tooltipWidth - margin,
        viewportPadding,
        window.innerWidth - tooltipWidth - viewportPadding,
      );
      aStyle = { right: -8, top: "50%", transform: "translateY(-50%)" };
      setArrowDir("right");
    }

    setTooltipStyle(style);
    setArrowStyle(aStyle);
  }, [currentStep, steps]);

  useEffect(() => {
    if (!visible) return;
    // Clean up previous highlights
    document.querySelectorAll("[style*='z-index: 10001']").forEach((el) => {
      (el as HTMLElement).style.zIndex = "";
      (el as HTMLElement).style.boxShadow = "";
    });
    positionTooltip();
    window.addEventListener("resize", positionTooltip);
    return () => window.removeEventListener("resize", positionTooltip);
  }, [visible, currentStep, positionTooltip]);

  const completeTour = useCallback(async () => {
    // Clean up highlights
    document.querySelectorAll("[style*='z-index: 10001']").forEach((el) => {
      (el as HTMLElement).style.zIndex = "";
      (el as HTMLElement).style.boxShadow = "";
    });
    setVisible(false);
    if (user) {
      await supabase
        .from("profiles")
        .update({ has_seen_onboarding: true } as any)
        .eq("user_id", user.id);
    }
    onComplete?.();
  }, [user, onComplete]);

  const next = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      completeTour();
    }
  };

  const prev = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  if (!visible || steps.length === 0) return null;

  const progress = ((currentStep + 1) / steps.length) * 100;
  const step = steps[currentStep];

  const arrowRotation: Record<string, string> = {
    top: "rotate(0deg)",
    bottom: "rotate(180deg)",
    left: "rotate(-90deg)",
    right: "rotate(90deg)",
  };

  return (
    <>
      {/* Overlay - don't close on click to prevent accidental dismissal */}
      <div
        className="fixed inset-0 bg-black/60 z-[10000] transition-opacity duration-300"
      />

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          ref={tooltipRef}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -10 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          style={tooltipStyle}
          className="bg-card border border-border rounded-2xl shadow-2xl p-5 w-[min(340px,calc(100vw-24px))]"
        >
          {/* Arrow */}
          <div style={{ ...arrowStyle, position: "absolute" }}>
            <div
              className="w-4 h-4 bg-card border border-border"
              style={{
                transform: `${arrowRotation[arrowDir]} rotate(45deg)`,
                clipPath: arrowDir === "top" ? "polygon(0 0, 100% 0, 50% 50%)" : undefined,
              }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
              Passo {currentStep + 1} de {steps.length}
            </span>
            <button
              onClick={completeTour}
              className="p-1 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-muted rounded-full mb-4 overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: `${((currentStep) / steps.length) * 100}%` }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Content */}
          <h3 className="text-base font-bold text-foreground mb-1.5">{step.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-5">{step.description}</p>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={completeTour}
              className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1 transition-colors"
            >
              <SkipForward className="h-3 w-3" />
              Pular Tutorial
            </button>
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={prev}
                  className="px-3 py-2 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Anterior
                </button>
              )}
              <button
                onClick={next}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors flex items-center gap-1"
              >
                {currentStep === steps.length - 1 ? "Concluir" : "Próximo"}
                {currentStep < steps.length - 1 && <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};

// ─── Tour Steps per Role ───

export const clienteTourSteps: TourStep[] = [
  {
    target: "[data-tour='search']",
    title: "Buscar Produtos 🔍",
    description: "Use a barra de busca para encontrar lojas e produtos rapidamente pelo nome.",
    position: "bottom",
  },
  {
    target: "[data-tour='categories']",
    title: "Categorias 🍕",
    description: "Filtre as lojas por categoria como Lanches, Pizzas, Bebidas e muito mais.",
    position: "bottom",
  },
  {
    target: "[data-tour='store-card']",
    title: "Escolha uma Loja 🏪",
    description: "Toque em uma loja para ver o cardápio completo e fazer seu pedido.",
    position: "bottom",
  },
  {
    target: "[data-tour='nav-pedidos']",
    title: "Acompanhe Pedidos 📦",
    description: "Veja o status dos seus pedidos em tempo real e acompanhe a entrega.",
    position: "top",
  },
];

export const lojistaTourSteps: TourStep[] = [
  {
    target: "[data-tour='loja-status']",
    title: "Status da Loja 🟢",
    description: "Abra ou feche sua loja com um toque. Quando fechada, clientes não podem fazer pedidos.",
    position: "bottom",
  },
  {
    target: "[data-tour='loja-stats']",
    title: "Visão Geral 📊",
    description: "Acompanhe seus pedidos pendentes, faturamento do dia e motoboys online.",
    position: "bottom",
  },
  {
    target: "[data-tour='loja-orders']",
    title: "Gestão de Pedidos 📋",
    description: "Gerencie todos os pedidos. Aceite, prepare e marque como pronto para entrega.",
    position: "bottom",
  },
  {
    target: "[data-tour='loja-menu']",
    title: "Cardápio 🍔",
    description: "Adicione, edite e organize seus produtos e seções do cardápio.",
    position: "bottom",
  },
  {
    target: "[data-tour='loja-clients']",
    title: "CRM de Clientes 👥",
    description: "Veja seus clientes, os mais fiéis e os inativos para ações de marketing.",
    position: "bottom",
  },
];

export const motoboyTourSteps: TourStep[] = [
  {
    target: "[data-tour='motoboy-status']",
    title: "Ficar Online 🟢",
    description: "Ative seu status online para receber corridas disponíveis.",
    position: "bottom",
  },
  {
    target: "[data-tour='motoboy-entregas']",
    title: "Entregas Disponíveis 🏍️",
    description: "Veja pedidos prontos para entrega e aceite as corridas que desejar.",
    position: "bottom",
  },
  {
    target: "[data-tour='motoboy-nav']",
    title: "Navegação GPS 🗺️",
    description: "Após aceitar, use os botões de GPS para navegar até o lojista e depois até o cliente.",
    position: "bottom",
  },
  {
    target: "[data-tour='motoboy-ganhos']",
    title: "Seus Ganhos 💰",
    description: "Acompanhe seu faturamento, histórico de entregas e solicite saques.",
    position: "bottom",
  },
];

export default ProductTour;
