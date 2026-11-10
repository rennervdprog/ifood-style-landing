/**
 * Cartão Novidade (Fase 4 dos tutoriais, 2026-11-10): anuncia UM
 * lançamento por vez na Visão Geral, em 1 passo — o lojista lê, pode
 * ir direto pra tela da novidade pelo botão, e o "Entendi" dispensa o
 * cartão pra sempre (por loja, neste aparelho). As novidades vivem em
 * src/lib/novidades.ts; lançamento novo = 1 item novo lá.
 */
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { NOVIDADES, novidadeStorageKey, novidadeVisivel } from "@/lib/novidades";

interface Props {
  storeId: string;
  onNavigate: (tab: any) => void;
}

export default function NovidadeCard({ storeId, onNavigate }: Props) {
  const [dispensadas, setDispensadas] = useState<ReadonlySet<string>>(new Set());
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    try {
      const lidas = new Set<string>();
      for (const n of NOVIDADES) {
        if (localStorage.getItem(novidadeStorageKey(storeId, n.id)) === "1") lidas.add(n.id);
      }
      setDispensadas(lidas);
    } catch {
      /* localStorage indisponível: o cartão só não lembra a dispensa */
    }
    setCarregado(true);
  }, [storeId]);

  if (!carregado) return null;
  const novidade = novidadeVisivel(dispensadas);
  if (!novidade) return null;

  const dispensar = () => {
    try {
      localStorage.setItem(novidadeStorageKey(storeId, novidade.id), "1");
    } catch {
      /* sem localStorage, dispensa só nesta sessão */
    }
    setDispensadas((prev) => new Set(prev).add(novidade.id));
  };

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-primary-foreground">
              NOVIDADE
            </span>
            <h3 className="text-sm font-bold text-foreground">{novidade.titulo}</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{novidade.texto}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {novidade.ctaLabel && novidade.ctaTab && (
              <button
                type="button"
                onClick={() => onNavigate(novidade.ctaTab)}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {novidade.ctaLabel}
              </button>
            )}
            <button
              type="button"
              onClick={dispensar}
              className="rounded-xl px-4 py-2 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Entendi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
