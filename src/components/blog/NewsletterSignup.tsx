import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Mail, Loader2 } from "lucide-react";

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
});

interface Props {
  source?: string;
  variant?: "inline" | "card";
}

export default function NewsletterSignup({ source = "blog", variant = "card" }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await (supabase as any)
      .from("newsletter_subscribers")
      .insert({ email: parsed.data.email.toLowerCase(), source });
    setLoading(false);
    if (error && !String(error.message).toLowerCase().includes("duplicate")) {
      toast.error("Não foi possível inscrever agora. Tente novamente.");
      return;
    }
    setDone(true);
    toast.success("Pronto! Você receberá nossas próximas novidades.");
  };

  if (done) {
    return (
      <div className={variant === "card" ? "rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center" : "text-sm text-primary"}>
        ✓ Inscrição confirmada. Obrigado!
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={
        variant === "card"
          ? "rounded-2xl border border-border bg-card p-6 md:p-7"
          : "flex gap-2"
      }
    >
      {variant === "card" && (
        <div className="mb-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <Mail className="h-3 w-3" /> Newsletter
          </div>
          <h3 className="font-editorial mt-3 text-lg md:text-xl font-bold leading-snug">
            Receba o melhor do blog ItaSuper
          </h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            1 e-mail por semana com dicas reais de delivery. Sem spam, cancele quando quiser.
          </p>
        </div>
      )}
      <div className={variant === "card" ? "flex flex-col sm:flex-row gap-2" : "flex flex-1 gap-2"}>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={255}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Inscrever"}
        </button>
      </div>
    </form>
  );
}