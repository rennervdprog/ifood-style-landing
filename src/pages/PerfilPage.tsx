import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { User, LogOut, Store, Shield, UserPlus, MapPin, Save, Bike, Wallet, Copy, AlertTriangle, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { maskWhatsApp, formatWhatsAppNumber, isValidWhatsApp } from "@/lib/whatsapp";

const PerfilPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: myStore } = useQuery({
    queryKey: ["my-store", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name")
        .eq("owner_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: myDriver } = useQuery({
    queryKey: ["my-driver", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: neighborhoods } = useQuery({
    queryKey: ["neighborhoods"],
    queryFn: async () => {
      const { data, error } = await supabase.from("neighborhood_fees").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Address form state
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [referencePoint, setReferencePoint] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressLoaded, setAddressLoaded] = useState(false);

  // PIX form state
  const [pixKey, setPixKey] = useState("");
  const [pixType, setPixType] = useState("");
  const [savingPix, setSavingPix] = useState(false);
  const [pixLoaded, setPixLoaded] = useState(false);

  useEffect(() => {
    if (profile && !addressLoaded) {
      setStreet((profile as any).street || "");
      setNumber((profile as any).number || "");
      setComplement((profile as any).complement || "");
      setReferencePoint((profile as any).reference_point || "");
      setNeighborhood((profile as any).neighborhood || "");
      setPhone((profile as any).phone || "");
      const wn = (profile as any).whatsapp_number || "";
      setWhatsappNumber(wn ? maskWhatsApp(wn) : "");
      setAddressLoaded(true);
    }
  }, [profile, addressLoaded]);

  useEffect(() => {
    if (profile && !pixLoaded) {
      setPixKey((profile as any).pix_key || "");
      setPixType((profile as any).pix_type || "");
      setPixLoaded(true);
    }
  }, [profile, pixLoaded]);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Você saiu da conta.");
    navigate("/");
  };

  const handleSaveAddress = async () => {
    if (!street.trim() || !number.trim() || !neighborhood) {
      toast.error("Preencha rua, número e bairro.");
      return;
    }
    setSavingAddress(true);
    try {
      // Upsert profile with address
      const { error } = await supabase
        .from("profiles")
        .upsert({
          user_id: user!.id,
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim(),
          reference_point: referencePoint.trim(),
          neighborhood,
          phone: phone.trim(),
        } as any, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Endereço salvo!");
      queryClient.invalidateQueries({ queryKey: ["my-profile", user?.id] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar.");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleSavePix = async () => {
    if (!pixKey.trim() || !pixType) {
      toast.error("Preencha o tipo e a chave PIX.");
      return;
    }
    setSavingPix(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          user_id: user!.id,
          pix_key: pixKey.trim(),
          pix_type: pixType,
        } as any, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Chave PIX salva!");
      queryClient.invalidateQueries({ queryKey: ["my-profile", user?.id] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar.");
    } finally {
      setSavingPix(false);
    }
  };

  const copyPixKey = () => {
    if (pixKey) {
      navigator.clipboard.writeText(pixKey);
      toast.success("Chave PIX copiada!");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center h-14 px-4">
          <h1 className="font-bold text-foreground">Meu Perfil</h1>
        </header>
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <User className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-1">Faça login</h2>
          <p className="text-sm text-muted-foreground">Entre para acompanhar seus pedidos.</p>
          <button onClick={() => navigate("/auth")} className="mt-6 bg-primary text-primary-foreground font-bold px-8 py-3 rounded-2xl">
            Entrar
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  const profileRole = (profile as any)?.role;
  const isApproved = (profile as any)?.is_approved;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center h-14 px-4">
        <h1 className="font-bold text-foreground">Meu Perfil</h1>
      </header>
      <div className="px-4 py-6 space-y-4">
        {/* User info */}
        <div className="bg-card rounded-2xl p-4 border border-border flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-foreground">{(profile as any)?.full_name || user.email}</h2>
            <p className="text-xs text-muted-foreground">
              {profileRole === "lojista" ? "Lojista" : profileRole === "motoboy" ? "Entregador" : "Cliente"} em Itatinga
            </p>
          </div>
        </div>

        {/* Address section */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Endereço de Entrega
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <input
                  type="text"
                  placeholder="Rua"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  autoComplete="street-address"
                />
              </div>
              <input
                type="text"
                placeholder="Nº"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                inputMode="numeric"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <input
              type="text"
              placeholder="Complemento (apto, bloco...)"
              value={complement}
              onChange={(e) => setComplement(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <select
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
            >
              <option value="">Selecione o Bairro</option>
              {neighborhoods?.map((n) => (
                <option key={n.id} value={n.name}>{n.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Ponto de referência (Ex: Próximo à Igreja)"
              value={referencePoint}
              onChange={(e) => setReferencePoint(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              type="tel"
              placeholder="Telefone / WhatsApp"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              autoComplete="tel"
            />
            <button
              onClick={handleSaveAddress}
              disabled={savingAddress}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingAddress ? "Salvando..." : "Salvar Endereço"}
            </button>
          </div>
        </div>

        {/* PIX Section - only for lojista/motoboy */}
        {(profileRole === "lojista" || profileRole === "motoboy") && (
          <div className="bg-card rounded-2xl p-4 border border-border">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Dados de Recebimento (PIX)
            </h3>
            {!pixKey && !pixType && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-xs text-destructive font-bold">
                  Cadastre sua chave PIX para receber seus pagamentos!
                </p>
              </div>
            )}
            <div className="space-y-3">
              <select
                value={pixType}
                onChange={(e) => setPixType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
              >
                <option value="">Tipo da Chave</option>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="email">E-mail</option>
                <option value="phone">Telefone</option>
                <option value="random">Chave Aleatória</option>
              </select>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Sua chave PIX"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {pixKey && (
                  <button
                    onClick={copyPixKey}
                    className="px-3 py-2.5 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                onClick={handleSavePix}
                disabled={savingPix}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingPix ? "Salvando..." : "Salvar Chave PIX"}
              </button>
            </div>
          </div>
        )}
        {/* Partner buttons */}
        {myStore && (
          <button
            onClick={() => navigate("/admin")}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-border bg-secondary text-secondary-foreground font-bold"
          >
            <Store className="h-4 w-4" />
            Painel da Loja ({myStore.name})
          </button>
        )}

        {myDriver && (
          <button
            onClick={() => navigate("/entregador")}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-border bg-secondary text-secondary-foreground font-bold"
          >
            <Bike className="h-4 w-4" />
            Painel do Entregador
          </button>
        )}

        {user.email === "vinivias13@gmail.com" && (
          <button
            onClick={() => navigate("/super-admin")}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 font-bold"
          >
            <Shield className="h-4 w-4" />
            Painel Administrativo
          </button>
        )}

        {!myStore && !myDriver && profileRole !== "lojista" && profileRole !== "motoboy" && (
          <button
            onClick={() => navigate("/parceiro")}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-primary/30 bg-primary/5 text-primary font-bold"
          >
            <UserPlus className="h-4 w-4" />
            Seja um Parceiro
          </button>
        )}

        {/* Pending approval notice */}
        {(profileRole === "lojista" || profileRole === "motoboy") && !isApproved && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 text-center">
            <p className="text-sm font-bold text-yellow-600">🛡️ Cadastro em Análise</p>
            <p className="text-xs text-muted-foreground mt-1">
              Aguarde a aprovação do administrador.
            </p>
          </div>
        )}

        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-border bg-card text-destructive font-bold"
        >
          <LogOut className="h-4 w-4" />
          Sair da conta
        </button>
      </div>
      <BottomNav />
    </div>
  );
};

export default PerfilPage;
