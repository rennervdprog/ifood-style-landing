import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Crown, MessageCircle, MapPin, Loader2 } from "lucide-react";

/**
 * Landing page de campanha promocional de captação de lojistas.
 * Usa código por cidade (ex: LONDRINA10). Mostra contador de vagas restantes
 * em tempo real e leva ao cadastro com o plano Essencial travado em R$ 0/mês.
 */
const CITY_CODES: Record<string, { code: string; cityLabel: string; whatsapp: string }> = {
  londrina: { code: "LONDRINA10", cityLabel: "Londrina", whatsapp: "5514998880000" },
};

const VagaPromoPage = () => {
  const { cidade = "londrina" } = useParams();
  const key = (cidade || "").toLowerCase();
  const cfg = CITY_CODES[key] || CITY_CODES.londrina;
  const [remaining, setRemaining] = useState<number | null>(null);
  const [max, setMax] = useState<number>(10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await (supabase as any).rpc("get_promo_remaining", { _code: cfg.code });
      if (!active) return;
      if (data && typeof data === "object") {
        setRemaining(typeof data.remaining === "number" ? data.remaining : null);
        setMax(typeof data.max_uses === "number" ? data.max_uses : 10);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [cfg.code]);

  const soldOut = remaining === 0;
  const taken = max - (remaining ?? max);
  const pct = Math.min(100, Math.round((taken / max) * 100));

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-600 via-red-700 to-red-900 text-white">
      <div className="max-w-md mx-auto px-5 py-8 space-y-6">
        {/* Logo */}
        <div className="text-center">
          <p className="text-xs tracking-[0.3em] text-white/70 font-semibold">ITASUPER</p>
        </div>

        {/* Headline */}
        <div className="text-center space-y-3 pt-2">
          <div className="inline-flex items-center gap-1 bg-yellow-400 text-red-700 text-xs font-bold px-3 py-1 rounded-full">
            <MapPin className="h-3 w-3" /> {cfg.cityLabel.toUpperCase()}
          </div>
          <h1 className="text-3xl font-black leading-tight">
            {max} vagas grátis<br />
            <span className="text-yellow-300">no plano Essencial</span>
          </h1>
          <p className="text-white/90 text-sm">
            Cardápio digital próprio + PDV + motoboy integrado, <strong>sem mensalidade</strong> e <strong>sem comissão</strong>. Para sempre.
          </p>
        </div>

        {/* Vagas counter */}
        <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/20">
          {loading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-xs font-semibold text-white/80">VAGAS RESTANTES</span>
                <span className="text-2xl font-black text-yellow-300">{remaining}<span className="text-sm text-white/60">/{max}</span></span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-300 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </>
          )}
        </div>

        {/* Benefícios */}
        <div className="bg-white text-foreground rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Crown className="h-5 w-5 text-primary" />
            <p className="font-bold">Plano Essencial — Travado em R$ 0</p>
          </div>
          {[
            "R$ 0/mês (normalmente R$ 90)",
            "0% de comissão por pedido",
            "Você fica com 100% do valor",
            "Cardápio digital com link próprio",
            "PDV + KDS + app do motoboy",
            "Suporte VIP no WhatsApp",
          ].map((t) => (
            <div key={t} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <span>{t}</span>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Único custo: R$ 2 por pedido entregue (cobrado do cliente, não sai do seu caixa) + R$ 1,99 por PIX recebido.
          </p>
        </div>

        {/* CTA */}
        {soldOut ? (
          <div className="bg-white/10 border border-white/20 rounded-2xl p-5 text-center">
            <p className="font-bold mb-1">Vagas esgotadas 😔</p>
            <p className="text-sm text-white/80 mb-3">Chama no WhatsApp pra entrar na lista de espera.</p>
            <a
              href={`https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(`Quero entrar na lista de espera ${cfg.cityLabel}`)}`}
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-5 py-3 rounded-xl"
            >
              <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
            </a>
          </div>
        ) : (
          <Link
            to={`/cadastro-lojista?promo=${cfg.code}&city=${encodeURIComponent(cfg.cityLabel)}`}
            className="block text-center bg-yellow-400 hover:bg-yellow-300 text-red-700 font-black text-lg px-6 py-4 rounded-2xl shadow-xl active:scale-95 transition-transform"
          >
            GARANTIR MINHA VAGA →
          </Link>
        )}

        <p className="text-center text-[11px] text-white/60">
          Promoção válida apenas para lojas em {cfg.cityLabel}. Cadastro 100% online, sem cartão.
        </p>
      </div>
    </div>
  );
};

export default VagaPromoPage;