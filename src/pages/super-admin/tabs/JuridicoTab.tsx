import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";
import { Scale, Search, Loader2, User, FileText, Mail, Phone, Shield, MapPin, Wallet, Calendar, CheckCircle2, AlertTriangle, Download, Eye, ChevronDown, ChevronUp, ShoppingBag } from "lucide-react";

const JuridicoTab = () => {
  const [search, setSearch] = useState("");
  const [searchType, setSearchType] = useState<"name" | "cpf" | "email">("name");
  const [results, setResults] = useState<any[]>([]);
  const [archivedResults, setArchivedResults] = useState<any[]>([]);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [userTerms, setUserTerms] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    setSearchAttempted(true);
    setSelectedUser(null);
    setResults([]);
    setArchivedResults([]);

    try {
      const cleanSearch = search.trim();
      const normalizedDocument = cleanSearch.replace(/\D/g, "");
      const namePattern = `%${cleanSearch}%`;
      const documentPattern = `%${normalizedDocument}%`;
      const emailPattern = `%${cleanSearch.toLowerCase()}%`;

      const profileQuery = supabase.from("profiles").select("*");
      const archivedQuery = supabase.from("archived_accounts").select("*");

      const activeSearch =
        searchType === "name"
          ? profileQuery.ilike("full_name", namePattern)
          : searchType === "cpf"
            ? profileQuery.ilike("document", documentPattern)
            : profileQuery.ilike("email", emailPattern);

      const archivedSearch =
        searchType === "name"
          ? archivedQuery.ilike("full_name", namePattern)
          : searchType === "cpf"
            ? archivedQuery.ilike("document", documentPattern)
            : archivedQuery.ilike("email", emailPattern);

      const [profilesResponse, archivedResponse] = await Promise.all([
        activeSearch.limit(20),
        archivedSearch.limit(20),
      ]);

      if (profilesResponse.error) {
        console.error("Erro ao buscar perfis:", profilesResponse.error);
        throw new Error(`Erro ao buscar perfis: ${profilesResponse.error.message}`);
      }

      if (archivedResponse.error) {
        console.error("Erro ao buscar contas arquivadas:", archivedResponse.error);
        throw new Error(`Erro ao buscar contas arquivadas: ${archivedResponse.error.message}`);
      }

      const activeProfiles = (profilesResponse.data || []) as any[];
      const archivedAccounts = (archivedResponse.data || []) as any[];

      setResults(activeProfiles);
      setArchivedResults(archivedAccounts);

      const totalResults = activeProfiles.length + archivedAccounts.length;
      if (totalResults === 0) {
        toast.info(`Nenhum resultado para "${cleanSearch}"`);
      } else {
        toast.success(`${totalResults} resultado(s) encontrado(s)`);
      }
    } catch (err: any) {
      console.error("Erro na busca jurídica:", err);
      toast.error(err?.message || "Erro inesperado na busca");
    } finally {
      setLoading(false);
    }
  };

  const loadUserDetails = async (userId: string, isArchived = false) => {
    setLoadingDetails(true);
    try {
      // Load orders
      const { data: orders } = await supabase
        .from("orders")
        .select("id, status, total_price, subtotal, payment_method, created_at, neighborhood, address_details")
        .eq("client_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      setUserOrders(orders || []);

      // Load terms acceptance
      const { data: terms } = await supabase
        .from("terms_acceptance")
        .select("*")
        .eq("user_id", userId)
        .order("accepted_at", { ascending: false })
        .limit(50);
      setUserTerms(terms || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const selectProfile = (profile: any) => {
    setSelectedUser({ ...profile, _type: "active" });
    loadUserDetails(profile.user_id);
  };

  const selectArchived = (archived: any) => {
    setSelectedUser({ ...archived, _type: "archived" });
    loadUserDetails(archived.original_user_id, true);
  };

  const exportUserData = () => {
    if (!selectedUser) return;
    const isArchived = selectedUser._type === "archived";
    const data = {
      tipo: isArchived ? "CONTA EXCLUÍDA (ARQUIVADA)" : "CONTA ATIVA",
      dados_pessoais: {
        nome: selectedUser.full_name,
        email: selectedUser.email,
        documento: selectedUser.document,
        telefone: selectedUser.phone,
        whatsapp: selectedUser.whatsapp_number,
        cidade: selectedUser.city,
        bairro: selectedUser.neighborhood,
        cep: selectedUser.cep,
        rua: selectedUser.street,
        numero: isArchived ? selectedUser.address_number : selectedUser.number,
      },
      funcao: selectedUser.role,
      pix: { tipo: selectedUser.pix_type, chave: selectedUser.pix_key },
      termos_aceitos: selectedUser.terms_accepted_at,
      conta_criada: isArchived ? selectedUser.account_created_at : selectedUser.created_at,
      ...(isArchived && {
        conta_excluida_em: selectedUser.deleted_at,
        motivo_exclusao: selectedUser.deletion_reason,
        reter_ate: selectedUser.retain_until,
        total_pedidos: selectedUser.order_count,
        total_gasto: selectedUser.total_spent,
      }),
      historico_pedidos: userOrders.map(o => ({
        id: o.id,
        status: o.status,
        valor: o.total_price,
        pagamento: o.payment_method,
        data: o.created_at,
        endereco: o.address_details,
        bairro: o.neighborhood,
      })),
      aceites_termos: userTerms.map(t => ({
        versao_termos: t.terms_version,
        versao_privacidade: t.privacy_version,
        data: t.accepted_at,
        ip: t.ip_address,
        user_agent: t.user_agent,
      })),
      exportado_em: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dados_usuario_${selectedUser.document || selectedUser.full_name || "desconhecido"}_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Dados exportados com sucesso!");
  };

  const roleLabels: Record<string, string> = { cliente: "Cliente", lojista: "Lojista", motoboy: "Entregador" };
  const statusLabels: Record<string, string> = {
    pendente: "Pendente", preparando: "Preparando", pronto_para_entrega: "Pronto",
    saiu_entrega: "Saiu Entrega", em_transito: "Em Trânsito", entregue: "Entregue",
    finalizado: "Finalizado", cancelado: "Cancelado", aguardando_pagamento: "Aguardando Pgto",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Scale className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-foreground">Consulta Jurídica</h2>
            <p className="text-xs text-muted-foreground">Busque dados de usuários para atender solicitações legais (LGPD, Judiciais)</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-3">
          {(["name", "cpf", "email"] as const).map(type => (
            <button
              key={type}
              onClick={() => setSearchType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                searchType === type ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {type === "name" ? "Nome" : type === "cpf" ? "CPF/CNPJ" : "Email"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder={searchType === "name" ? "Digite o nome..." : searchType === "cpf" ? "Digite o CPF/CNPJ..." : "Digite o email..."}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !search.trim()}
            className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
          </button>
        </div>
      </div>

      {/* Results */}
      {(results.length > 0 || archivedResults.length > 0) && !selectedUser && (
        <div className="space-y-3">
          {results.length > 0 && (
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Contas Ativas ({results.length})
                </h3>
              </div>
              <div className="divide-y divide-border">
                {results.map((p: any) => (
                  <button key={p.id} onClick={() => selectProfile(p)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{p.full_name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{p.email} • {p.document || "Sem doc"} • {roleLabels[p.role] || p.role}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      p.is_approved ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}>
                      {p.is_approved ? "Aprovado" : "Pendente"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {archivedResults.length > 0 && (
            <div className="bg-card rounded-2xl border border-destructive/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-destructive/5">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-destructive" />
                  Contas Excluídas / Arquivadas ({archivedResults.length})
                </h3>
              </div>
              <div className="divide-y divide-border">
                {archivedResults.map((a: any) => (
                  <button key={a.id} onClick={() => selectArchived(a)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left">
                    <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{a.full_name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{a.email} • {a.document || "Sem doc"} • Excluída em {new Date(a.deleted_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                      Arquivado
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Detail View */}
      {selectedUser && (
        <div className="space-y-3">
          <button onClick={() => setSelectedUser(null)} className="text-xs text-primary font-bold flex items-center gap-1 hover:underline">
            ← Voltar aos resultados
          </button>

          {/* User info card */}
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  selectedUser._type === "archived" ? "bg-destructive/10" : "bg-primary/10"
                }`}>
                  <User className={`h-6 w-6 ${selectedUser._type === "archived" ? "text-destructive" : "text-primary"}`} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg">{selectedUser.full_name}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selectedUser._type === "archived" ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-600"
                  }`}>
                    {selectedUser._type === "archived" ? "CONTA EXCLUÍDA" : "CONTA ATIVA"}
                  </span>
                </div>
              </div>
              <button onClick={exportUserData} className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">
                <Download className="h-3.5 w-3.5" />
                Exportar JSON
              </button>
            </div>

            {/* Data grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: User, label: "Nome", value: selectedUser.full_name },
                { icon: Mail, label: "Email", value: selectedUser.email },
                { icon: FileText, label: "CPF/CNPJ", value: selectedUser.document },
                { icon: Phone, label: "Telefone", value: selectedUser.phone },
                { icon: Phone, label: "WhatsApp", value: selectedUser.whatsapp_number },
                { icon: Shield, label: "Função", value: roleLabels[selectedUser.role] || selectedUser.role },
                { icon: MapPin, label: "Cidade", value: selectedUser.city },
                { icon: MapPin, label: "Bairro", value: selectedUser.neighborhood },
                { icon: MapPin, label: "CEP", value: selectedUser.cep },
                { icon: MapPin, label: "Rua", value: selectedUser.street },
                { icon: MapPin, label: "Número", value: selectedUser._type === "archived" ? selectedUser.address_number : selectedUser.number },
                { icon: Wallet, label: "PIX", value: selectedUser.pix_key ? `${selectedUser.pix_type}: ${selectedUser.pix_key}` : null },
                { icon: Calendar, label: "Conta criada", value: selectedUser._type === "archived" ? selectedUser.account_created_at : selectedUser.created_at },
                { icon: CheckCircle2, label: "Termos aceitos", value: selectedUser.terms_accepted_at },
              ].filter(f => f.value).map((field, i) => (
                <div key={i} className="flex items-center gap-2 bg-muted/30 rounded-xl px-3 py-2.5">
                  <field.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground font-medium">{field.label}</p>
                    <p className="text-sm font-semibold text-foreground truncate">
                      {field.label.includes("criada") || field.label.includes("aceitos")
                        ? new Date(field.value).toLocaleString("pt-BR")
                        : field.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Archived-specific info */}
            {selectedUser._type === "archived" && (
              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 space-y-2">
                <h4 className="text-sm font-bold text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Dados de Exclusão
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Excluída em:</span> <span className="font-bold text-foreground">{new Date(selectedUser.deleted_at).toLocaleString("pt-BR")}</span></div>
                  <div><span className="text-muted-foreground">Motivo:</span> <span className="font-bold text-foreground">{selectedUser.deletion_reason}</span></div>
                  <div><span className="text-muted-foreground">Reter até:</span> <span className="font-bold text-foreground">{new Date(selectedUser.retain_until).toLocaleDateString("pt-BR")}</span></div>
                  <div><span className="text-muted-foreground">Total pedidos:</span> <span className="font-bold text-foreground">{selectedUser.order_count}</span></div>
                  <div><span className="text-muted-foreground">Total gasto:</span> <span className="font-bold text-foreground">{formatBRL(Number(selectedUser.total_spent || 0))}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Terms acceptance history */}
          {loadingDetails ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <>
              {userTerms.length > 0 && (
                <div className="bg-card rounded-2xl border border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-muted/30">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Aceites de Termos ({userTerms.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-border">
                    {userTerms.map((t: any) => (
                      <div key={t.id} className="px-4 py-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">Termos v{t.terms_version} • Privacidade v{t.privacy_version}</span>
                          <span className="text-muted-foreground">{new Date(t.accepted_at).toLocaleString("pt-BR")}</span>
                        </div>
                        <p className="text-muted-foreground">IP: {t.ip_address || "N/A"} • UA: {(t.user_agent || "N/A").substring(0, 60)}...</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Order history */}
              {userOrders.length > 0 && (
                <div className="bg-card rounded-2xl border border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-muted/30">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-primary" />
                      Histórico de Pedidos ({userOrders.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-border max-h-96 overflow-y-auto">
                    {userOrders.map((o: any) => (
                      <div key={o.id} className="px-4 py-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-foreground tabular-nums">{formatBRL(Number(o.total_price))}</p>
                          <p className="text-muted-foreground tabular-nums">{new Date(o.created_at).toLocaleString("pt-BR")} • {o.neighborhood}</p>
                        </div>
                        <div className="text-right">
                          <span className={`font-bold px-2 py-0.5 rounded-full ${
                            o.status === "finalizado" || o.status === "entregue" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                            o.status === "cancelado" ? "bg-destructive/10 text-destructive" :
                            "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          }`}>
                            {statusLabels[o.status] || o.status}
                          </span>
                          <p className="text-muted-foreground mt-0.5">{o.payment_method}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {userOrders.length === 0 && userTerms.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">Nenhum registro adicional encontrado.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && archivedResults.length === 0 && !loading && searchAttempted && search.trim() && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum resultado encontrado para "{search}"</p>
        </div>
      )}

      {/* Retention info */}
      <div className="bg-muted/30 rounded-2xl border border-border p-4 space-y-2">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Política de Retenção de Dados
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-start gap-2"><span className="text-primary">•</span> Dados de conta: mantidos enquanto ativa</div>
          <div className="flex items-start gap-2"><span className="text-primary">•</span> Histórico de pedidos: 5 anos (Art. 173, CTN)</div>
          <div className="flex items-start gap-2"><span className="text-primary">•</span> Dados financeiros: 5 anos (obrigações tributárias)</div>
          <div className="flex items-start gap-2"><span className="text-primary">•</span> Docs entregadores: 30 dias após exclusão</div>
          <div className="flex items-start gap-2"><span className="text-primary">•</span> Aceites de termos: indefinidamente (prova legal)</div>
        </div>
      </div>
    </div>
  );
};

export default JuridicoTab;
