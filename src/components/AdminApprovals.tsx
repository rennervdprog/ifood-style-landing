import {
  Shield, Clock, Store, Bike, CheckCircle2, XCircle, Loader2, Trash2,
  FileText, ChevronDown, ChevronUp, User, Phone, Mail, MapPin,
  Calendar, CreditCard, Hash, Eye, EyeOff, AlertTriangle, Search, Filter,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import WhatsAppButton from "@/components/WhatsAppButton";
import { openWhatsApp } from "@/lib/whatsapp";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/* ── helpers ─────────────────────────────────────────────────── */

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const fmtDoc = (doc: string | null) => {
  if (!doc) return "Não informado";
  const clean = doc.replace(/\D/g, "");
  if (clean.length === 11) return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (clean.length === 14) return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
};

const completeness = (p: any): number => {
  const fields = [p.full_name, p.document, p.email, p.phone || p.whatsapp_number, p.city];
  if (p.role === "motoboy") fields.push(p.vehicle, p.cnh_number, p.cnh_front_url, p.selfie_url);
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
};

/* ── info row ────────────────────────────────────────────────── */

const InfoRow = ({ icon: Icon, label, value, warn, masked }: { icon: any; label: string; value: string | null | undefined; warn?: boolean; masked?: boolean }) => (
  <div className="flex items-start gap-2 py-1.5">
    <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${warn ? "text-yellow-500" : "text-muted-foreground"}`} />
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none mb-0.5">{label}</p>
      <p className={`text-xs font-medium leading-tight ${value ? "text-foreground" : "text-muted-foreground/50 italic"}`}>
        {masked && value ? "••••••••" : (value || "Não informado")}
      </p>
    </div>
  </div>
);

/* ── completeness bar ────────────────────────────────────────── */

const CompletenessBar = ({ pct }: { pct: number }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-destructive"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
    <span className="text-[10px] font-bold text-muted-foreground w-8 text-right">{pct}%</span>
  </div>
);

/* ── main component ──────────────────────────────────────────── */

const AdminApprovals = () => {
  const queryClient = useQueryClient();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "lojista" | "motoboy">("all");
  const [visibleSensitive, setVisibleSensitive] = useState<Set<string>>(new Set());

  const { data: allProfiles, isLoading } = useQuery({
    queryKey: ["admin-pending-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).filter((p: any) => p.role === "lojista" || p.role === "motoboy");
    },
  });

  // Fetch store info for lojistas
  const { data: stores } = useQuery({
    queryKey: ["admin-stores-for-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, owner_id, category, status, address_city, created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const storeByOwner = useMemo(() => {
    const map: Record<string, any> = {};
    (stores || []).forEach((s: any) => { if (s.owner_id) map[s.owner_id] = s; });
    return map;
  }, [stores]);

  const filtered = useMemo(() => {
    let list = allProfiles || [];
    if (roleFilter !== "all") list = list.filter((p: any) => p.role === roleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p: any) =>
        (p.full_name || "").toLowerCase().includes(q) ||
        (p.document || "").includes(q) ||
        (p.email || "").toLowerCase().includes(q) ||
        (p.whatsapp_number || "").includes(q)
      );
    }
    return list;
  }, [allProfiles, roleFilter, search]);

  const pending = filtered.filter((p: any) => !p.is_approved);
  const approved = filtered.filter((p: any) => p.is_approved);

  /* ── actions ─────────────────────────────────────────────── */

  const handleApprove = async (profile: any, approve: boolean) => {
    setSyncingId(profile.user_id);
    try {
      const { error } = await supabase.rpc("admin_approve_partner", {
        _profile_user_id: profile.user_id,
        _approved: approve,
      } as any);
      if (error) { toast.error(error.message); return; }

      if (approve) {
        await supabase.rpc("log_admin_action", {
          _action: "approve_partner",
          _target_type: profile.role,
          _target_id: profile.user_id,
          _details: { full_name: profile.full_name }
        });
        // Nota: sync-to-external removida (não utilizada)
        toast.success("Parceiro aprovado com sucesso!");

        // Send automatic WhatsApp congratulations message
        const whatsappNumber = profile.whatsapp_number || profile.phone;
        if (whatsappNumber) {
          const partnerName = profile.full_name || "Parceiro";
          const roleLabel = profile.role === "lojista" ? "lojista" : "entregador";
          const message = `🎉 Parabéns, ${partnerName}! Seu cadastro como ${roleLabel} no *ItaSuper* foi aprovado com sucesso!\n\n` +
            `✅ Você já pode acessar a plataforma e começar a usar todos os recursos disponíveis.\n\n` +
            `📱 Acesse: https://itasuper.com.br/auth\n\n` +
            `Qualquer dúvida, estamos à disposição. Boas vendas! 🚀`;
          openWhatsApp(whatsappNumber, message);
          toast.info("WhatsApp aberto com mensagem de aprovação!");
        }
      } else {
        await supabase.rpc("log_admin_action", {
          _action: "reject_partner",
          _target_type: profile.role,
          _target_id: profile.user_id,
          _details: { full_name: profile.full_name }
        });
        toast.success("Parceiro recusado.");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-pending-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stores-for-approvals"] });
    } finally { setSyncingId(null); }
  };

  const handleDelete = async (profile: any) => {
    setDeletingId(profile.user_id);
    try {
      const { error } = await supabase.rpc("admin_delete_partner", { _profile_user_id: profile.user_id } as any);
      if (error) { toast.error(error.message); return; }
      toast.success("Parceiro excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-pending-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stores"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stores-for-approvals"] });
    } finally { setDeletingId(null); }
  };

  /* ── card ────────────────────────────────────────────────── */

  const renderProfileCard = (p: any, isPending: boolean) => {
    const pct = completeness(p);
    const store = storeByOwner[p.user_id];
    const isSensitiveVisible = visibleSensitive.has(p.id);
    const toggleSensitive = () => {
      setVisibleSensitive(prev => {
        const next = new Set(prev);
        if (next.has(p.id)) next.delete(p.id);
        else next.add(p.id);
        return next;
      });
    };
    const hide = !isSensitiveVisible;
    const missingFields: string[] = [];
    if (!p.full_name) missingFields.push("Nome");
    if (!p.document) missingFields.push("Documento");
    if (!p.email) missingFields.push("E-mail");
    if (!p.phone && !p.whatsapp_number) missingFields.push("Telefone");
    if (p.role === "motoboy") {
      if (!p.vehicle) missingFields.push("Veículo/Placa");
      if (!p.cnh_number) missingFields.push("CNH");
      if (!p.cnh_front_url) missingFields.push("Foto CNH");
      if (!p.selfie_url) missingFields.push("Selfie");
    }

    return (
      <div
        key={p.id}
        className={`bg-card rounded-2xl border overflow-hidden transition-all ${
          isPending ? "border-yellow-500/40 shadow-sm shadow-yellow-500/10" : "border-border"
        }`}
      >
        {/* header */}
        <div className={`px-4 py-3 flex items-center justify-between ${isPending ? "bg-yellow-500/5" : "bg-muted/30"}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
              p.role === "lojista" ? "bg-orange-500/15 text-orange-500" : "bg-primary/15 text-primary"
            }`}>
              {p.role === "lojista" ? <Store className="h-4 w-4" /> : <Bike className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{p.full_name || "Sem nome"}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                  {p.role === "lojista" ? "Lojista" : "Entregador"}
                </Badge>
                {store && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-orange-500/30 text-orange-500">
                    {store.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Badge className={`shrink-0 text-[10px] font-bold ${
            isPending
              ? "bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30 border-yellow-500/30"
              : "bg-green-500/20 text-green-600 hover:bg-green-500/30 border-green-500/30"
          }`} variant="outline">
            {isPending ? "⏳ Pendente" : "✅ Ativo"}
          </Badge>
          <button
            onClick={toggleSensitive}
            className={`p-1.5 rounded-lg transition-colors ${isSensitiveVisible ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            title={isSensitiveVisible ? "Ocultar dados sensíveis" : "Mostrar dados sensíveis"}
          >
            {isSensitiveVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>

        {/* body */}
        <div className="px-4 py-3 space-y-2">
          {/* completeness */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Completude do cadastro</p>
            <CompletenessBar pct={pct} />
          </div>

          {/* missing fields alert */}
          {missingFields.length > 0 && isPending && (
            <div className="flex items-start gap-2 bg-yellow-500/10 rounded-lg px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-yellow-600">
                <span className="font-bold">Campos faltando:</span> {missingFields.join(", ")}
              </p>
            </div>
          )}

          {/* info grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-0">
            <InfoRow icon={User} label="Nome completo" value={p.full_name} warn={!p.full_name} />
            <InfoRow icon={Hash} label="CPF / CNPJ" value={fmtDoc(p.document)} warn={!p.document} masked={hide} />
            <InfoRow icon={Mail} label="E-mail" value={p.email} warn={!p.email} masked={hide} />
            <InfoRow icon={Phone} label="Telefone / WhatsApp" value={p.whatsapp_number || p.phone} warn={!p.whatsapp_number && !p.phone} masked={hide} />
            <InfoRow icon={MapPin} label="Cidade" value={p.city || "Não informado"} />
            <InfoRow icon={Calendar} label="Cadastro em" value={fmtDate(p.created_at)} />
            {p.role === "lojista" && store && (
              <InfoRow icon={Store} label="Categoria da loja" value={store.category} />
            )}
            {p.role === "motoboy" && (
              <>
                <InfoRow icon={Bike} label="Veículo / Placa" value={p.vehicle} warn={!p.vehicle} />
                <InfoRow icon={FileText} label="Nº CNH" value={p.cnh_number} warn={!p.cnh_number} masked={hide} />
              </>
            )}
          </div>

          {/* driver documents */}
          {p.role === "motoboy" && <DriverDocuments profile={p} />}

          {/* address for lojistas */}
          {p.role === "lojista" && (p.street || p.cep) && (
            <div className="bg-muted/30 rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Endereço</p>
              <p className="text-xs text-foreground">
                {[p.street, p.number, p.complement, p.neighborhood, p.city].filter(Boolean).join(", ")}
                {p.cep ? ` — CEP ${p.cep}` : ""}
              </p>
            </div>
          )}
        </div>

        {/* actions */}
        <div className="px-4 py-3 bg-muted/20 border-t border-border flex gap-2 flex-wrap">
          {p.whatsapp_number && (
            <WhatsAppButton
              number={p.whatsapp_number}
              message={`Olá ${p.full_name || ""}! Aqui é o admin do ItaSuper. Sobre seu cadastro como ${p.role === "lojista" ? "lojista" : "entregador"}...`}
              label="WhatsApp"
              size="sm"
            />
          )}
          {isPending && (
            <>
              <button
                onClick={() => handleApprove(p, true)}
                disabled={syncingId === p.user_id}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold active:scale-95 transition-all min-h-[44px] disabled:opacity-50"
              >
                {syncingId === p.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Aprovar
              </button>
              <button
                onClick={() => handleApprove(p, false)}
                disabled={syncingId === p.user_id}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-bold active:scale-95 transition-all min-h-[44px] disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Recusar
              </button>
            </>
          )}
          <DeleteButton profile={p} deletingId={deletingId} onDelete={handleDelete} />
        </div>
      </div>
    );
  };

  /* ── layout ──────────────────────────────────────────────── */

  const totalPending = (allProfiles || []).filter((p: any) => !p.is_approved).length;
  const totalApproved = (allProfiles || []).filter((p: any) => p.is_approved).length;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <p className="text-lg font-bold text-foreground">{(allProfiles || []).length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
        </div>
        <div className="bg-yellow-500/10 rounded-xl border border-yellow-500/30 p-3 text-center">
          <p className="text-lg font-bold text-yellow-600">{totalPending}</p>
          <p className="text-[10px] text-yellow-600 uppercase tracking-wider">Pendentes</p>
        </div>
        <div className="bg-green-500/10 rounded-xl border border-green-500/30 p-3 text-center">
          <p className="text-lg font-bold text-green-600">{totalApproved}</p>
          <p className="text-[10px] text-green-600 uppercase tracking-wider">Aprovados</p>
        </div>
      </div>

      {/* Search & filter */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF, e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex bg-card border border-border rounded-xl overflow-hidden">
          {(["all", "lojista", "motoboy"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setRoleFilter(f)}
              className={`px-3 py-2 text-xs font-bold transition-colors ${
                roleFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "Todos" : f === "lojista" ? "Lojistas" : "Motoboys"}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="space-y-3">
        <TabsList className="w-full bg-muted/50">
          <TabsTrigger value="pending" className="flex-1 text-xs">
            <Clock className="h-3.5 w-3.5 mr-1" />
            Pendentes ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex-1 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Aprovados ({approved.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3 mt-0">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : pending.length > 0 ? (
            <div className="space-y-3">
              {pending.map((p: any) => renderProfileCard(p, true))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle2 className="h-10 w-10 mx-auto text-green-500/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum cadastro pendente</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-3 mt-0">
          {approved.length > 0 ? (
            <div className="space-y-3">
              {approved.map((p: any) => renderProfileCard(p, false))}
            </div>
          ) : (
            <div className="text-center py-8">
              <User className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum parceiro aprovado encontrado</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* ── delete button ───────────────────────────────────────────── */

const DeleteButton = ({ profile: p, deletingId, onDelete }: { profile: any; deletingId: string | null; onDelete: (p: any) => void }) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <button
        disabled={deletingId === p.user_id}
        className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive text-sm font-bold active:scale-95 transition-all min-h-[44px] disabled:opacity-50"
      >
        {deletingId === p.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </button>
    </AlertDialogTrigger>
    <AlertDialogContent className="bg-card border-border">
      <AlertDialogHeader>
        <AlertDialogTitle className="text-foreground">
          Excluir {p.role === "lojista" ? "Lojista" : "Entregador"}?
        </AlertDialogTitle>
        <AlertDialogDescription className="text-muted-foreground">
          Isso vai excluir <strong className="text-foreground">{p.full_name || "este parceiro"}</strong> e{" "}
          <strong className="text-destructive">TODOS os dados associados</strong> (pedidos, produtos, ganhos, saques, lojas). Ação irreversível.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="bg-muted text-foreground border-border hover:bg-muted/80">Cancelar</AlertDialogCancel>
        <AlertDialogAction
          onClick={() => onDelete(p)}
          className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
        >
          Excluir Tudo
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

/* ── driver documents ────────────────────────────────────────── */

const DriverDocuments = ({ profile }: { profile: any }) => {
  const [expanded, setExpanded] = useState(false);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});

  const loadDocs = async () => {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    const urls: Record<string, string> = {};
    for (const [key, path] of Object.entries({
      cnh_front: profile.cnh_front_url,
      cnh_back: profile.cnh_back_url,
      selfie: profile.selfie_url,
    })) {
      if (path) {
        const { data } = await supabase.storage.from("driver-documents").createSignedUrl(path as string, 300);
        if (data?.signedUrl) urls[key] = data.signedUrl;
      }
    }
    setDocUrls(urls);
  };

  const hasAnyDoc = profile.cnh_front_url || profile.cnh_back_url || profile.selfie_url;
  if (!hasAnyDoc) return null;

  return (
    <div>
      <button
        type="button"
        onClick={loadDocs}
        className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
      >
        <Eye className="h-3.5 w-3.5" />
        {expanded ? "Ocultar documentos" : "📷 Ver documentos enviados"}
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {expanded && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          {Object.entries({ cnh_front: "Frente CNH", cnh_back: "Verso CNH", selfie: "Selfie" }).map(([key, label]) =>
            docUrls[key] ? (
              <div key={key} className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
                <img
                  src={docUrls[key]}
                  alt={label}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-28 object-cover rounded-lg border border-border cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => window.open(docUrls[key], "_blank")}
                />
              </div>
            ) : null
          )}
          {Object.keys(docUrls).length === 0 && (
            <p className="col-span-3 text-xs text-muted-foreground py-2">Carregando documentos...</p>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminApprovals;
