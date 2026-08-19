import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MapPin, ShieldCheck, Users } from "lucide-react";

interface DriverDirectoryOptInCardProps {
  userId: string;
  initialCity?: string | null;
}

const DriverDirectoryOptInCard = ({ userId, initialCity }: DriverDirectoryOptInCardProps) => {
  const queryClient = useQueryClient();
  const [city, setCity] = useState(initialCity || "");
  const [isListed, setIsListed] = useState(false);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: preference, isLoading } = useQuery({
    queryKey: ["driver-directory-preference", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_directory_preferences" as any)
        .select("city, is_listed, contact_consent_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as { city?: string; is_listed?: boolean; contact_consent_at?: string | null } | null;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (preference) {
      setCity(preference.city || initialCity || "");
      setIsListed(!!preference.is_listed);
      setConsent(!!preference.is_listed && !!preference.contact_consent_at);
    } else if (initialCity) {
      setCity(initialCity);
    }
  }, [preference, initialCity]);

  const savePreference = async () => {
    const normalizedCity = city.trim();
    if (normalizedCity.length < 2) {
      toast.error("Informe a cidade onde você deseja receber contatos.");
      return;
    }
    if (isListed && !consent) {
      toast.error("Confirme a autorização de contato para aparecer na base.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc("upsert_driver_directory_preference" as any, {
        _city: normalizedCity,
        _is_listed: isListed,
      } as any);
      if (error) throw error;

      toast.success(isListed ? "Você está visível para lojistas da sua cidade." : "Seu perfil foi removido da base de contatos.");
      queryClient.invalidateQueries({ queryKey: ["driver-directory-preference", userId] });
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível atualizar sua preferência.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-card border border-border/60 rounded-2xl overflow-hidden">
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-foreground">Base de motoboys da cidade</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Escolha se deseja aparecer para lojistas que procuram motoboy na sua cidade.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-muted/50 border border-border p-3 flex gap-2.5">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            A ItaSuper não contrata nem intermedeia acordos. Quando você autoriza, lojistas veem apenas seu <strong className="text-foreground">nome, cidade, veículo e WhatsApp</strong> para falar diretamente com você.
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-bold text-foreground">Cidade de atuação</span>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Ex.: Itatinga"
              className="w-full pl-9 pr-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </label>

        <label className="flex items-start gap-3 rounded-xl border border-border p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isListed}
            onChange={(event) => {
              setIsListed(event.target.checked);
              if (!event.target.checked) setConsent(false);
            }}
            className="mt-0.5 rounded border-border accent-primary"
          />
          <span className="text-[11px] text-muted-foreground leading-relaxed">
            Quero aparecer na base de motoboys da minha cidade.
          </span>
        </label>

        {isListed && (
          <label className="flex items-start gap-3 rounded-xl bg-primary/5 border border-primary/15 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 rounded border-primary accent-primary"
            />
            <span className="text-[10px] text-muted-foreground leading-relaxed">
              Autorizo a ItaSuper a mostrar meu nome, cidade, veículo e WhatsApp para lojistas da mesma cidade, exclusivamente para que possam entrar em contato direto sobre possível contratação.
            </span>
          </label>
        )}

        <button
          type="button"
          disabled={saving || isLoading}
          onClick={savePreference}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving || isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {isListed ? "Salvar e aparecer na base" : "Salvar preferência"}
        </button>
      </div>
    </section>
  );
};

export default DriverDirectoryOptInCard;
