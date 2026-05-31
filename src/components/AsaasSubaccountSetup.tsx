import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AsaasBadge, AsaasBadgeBar } from "@/components/AsaasBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
  import { CheckCircle2, Loader2, Banknote, ShieldCheck, Copy, AlertCircle, FileText, ExternalLink, RefreshCw, User, MapPin, Landmark, ArrowRight, Wallet, Info } from "lucide-react";
import { toast } from "sonner";
import { formatPixKeyDisplay, sanitizePixKeyForAsaas, validatePixKey } from "@/lib/pixFormat";
import { fetchCep } from "@/lib/cepLookup";
import AsaasDocumentsUpload from "./AsaasDocumentsUpload";

interface Props {
  storeId: string;
  initialData?: {
    name?: string;
    email?: string;
    cpfCnpj?: string;
    phone?: string;
    postalCode?: string;
    address?: string;
    addressNumber?: string;
    complement?: string;
    province?: string;
  };
}

type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

const onlyDigits = (value: unknown) => String(value ?? "").replace(/[^0-9]/g, "");

const isValidCpf = (value: string) => {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const calc = (base: string, factor: number) => {
    const total = base.split("").reduce((sum, n) => sum + Number(n) * factor--, 0);
    const digit = (total * 10) % 11;
    return digit === 10 ? 0 : digit;
  };
  return calc(cpf.slice(0, 9), 10) === Number(cpf[9]) && calc(cpf.slice(0, 10), 11) === Number(cpf[10]);
};

const isValidCnpj = (value: string) => {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calc = (base: string, factors: number[]) => {
    const total = base.split("").reduce((sum, n, i) => sum + Number(n) * factors[i], 0);
    const rest = total % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[12]) &&
    calc(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[13]);
};

export default function AsaasSubaccountSetup({ storeId, initialData }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const { data: store, isLoading } = useQuery({
    queryKey: ["store-asaas", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, asaas_wallet_id")
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const [personType, setPersonType] = useState<"FISICA" | "JURIDICA">(
    (onlyDigits(initialData?.cpfCnpj).length || 0) === 14 ? "JURIDICA" : "FISICA"
  );

  const [form, setForm] = useState({
    name: initialData?.name || "",
    email: initialData?.email || "",
    emailConfirm: "",  // 🔒 campo de confirmação de e-mail
    cpfCnpj: onlyDigits(initialData?.cpfCnpj),
    birthDate: "",
    companyType: "MEI" as "MEI" | "INDIVIDUAL" | "LIMITED" | "ASSOCIATION",
    incomeValue: "",
    phone: initialData?.phone || "",
    address: initialData?.address || "",
    addressNumber: initialData?.addressNumber || "",
    complement: initialData?.complement || "",
    province: initialData?.province || "",
    postalCode: initialData?.postalCode || "",
    city: "",
    state: "",
    site: "",
    pixAddressKey: onlyDigits(initialData?.cpfCnpj),
    pixAddressKeyType: "CPF" as PixKeyType,
  });

  useEffect(() => {
    if (initialData) {
      setForm(f => ({
        ...f,
        name: f.name || initialData.name || "",
        email: f.email || initialData.email || "",
        cpfCnpj: f.cpfCnpj || onlyDigits(initialData.cpfCnpj),
        phone: f.phone || initialData.phone || "",
        address: f.address || initialData.address || "",
        addressNumber: f.addressNumber || initialData.addressNumber || "",
        complement: f.complement || initialData.complement || "",
        province: f.province || initialData.province || "",
        postalCode: f.postalCode || initialData.postalCode || "",
        pixAddressKey: f.pixAddressKey || onlyDigits(initialData.cpfCnpj),
      }));
    }
  }, [initialData]);

  const isCpf = personType === "FISICA";

  const update = (k: string, v: string) => {
    let val = v;
    if (k === "cpfCnpj") val = onlyDigits(v).slice(0, personType === "FISICA" ? 11 : 14);
    if (k === "pixAddressKey" && (form.pixAddressKeyType === "CPF" || form.pixAddressKeyType === "CNPJ")) {
      val = onlyDigits(v);
      val = val.slice(0, form.pixAddressKeyType === "CPF" ? 11 : 14);
    }
    if (k === "phone") val = onlyDigits(v).slice(0, 11);
    if (k === "postalCode") val = onlyDigits(v).slice(0, 8);
    
    setForm((f) => {
      const next = { ...f, [k]: val };
      if (k === "pixAddressKeyType") next.pixAddressKey = "";
      return next;
    });

    // Auto-busca de CEP quando completar 8 dígitos
    if (k === "postalCode" && val.length === 8) {
      fetchCep(val).then((data) => {
        if (data) {
          setForm((f) => ({
            ...f,
            address: f.address || data.logradouro || "",
            province: f.province || data.bairro || "",
            city: data.localidade || "",
            state: data.uf || "",
          }));
        }
      }).catch(() => {});
    }
  };

  const submit = async () => {
    const cleanCpfCnpj = onlyDigits(form.cpfCnpj).slice(0, personType === "FISICA" ? 11 : 14);
    const cleanPhone = onlyDigits(form.phone);
    const cleanCep = onlyDigits(form.postalCode);
    const cleanIncomeValue = Number(String(form.incomeValue).replace(/\./g, "").replace(",", "."));
    const documentIsCpf = cleanCpfCnpj.length === 11;

    if (!form.name || !form.email || cleanCpfCnpj.length < 11 || cleanPhone.length < 10 || !form.address ||
        !form.addressNumber || !form.province || cleanCep.length !== 8 || !form.pixAddressKey) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    // 🔒 Validação: e-mail deve ser confirmado corretamente
    if (!form.emailConfirm) {
      toast.error("Confirme seu e-mail antes de continuar.");
      return;
    }
    if (form.email.toLowerCase().trim() !== form.emailConfirm.toLowerCase().trim()) {
      toast.error("Os e-mails não coincidem. Verifique e tente novamente.");
      return;
    }
    if (personType === "FISICA" && cleanCpfCnpj.length !== 11) {
      toast.error(`O CPF deve ter 11 números. O sistema identificou ${cleanCpfCnpj.length} números.`);
      return;
    }
    if (personType === "JURIDICA" && cleanCpfCnpj.length !== 14) {
      toast.error(`O CNPJ deve ter 14 números. O sistema identificou ${cleanCpfCnpj.length} números.`);
      return;
    }
    if (documentIsCpf && !isValidCpf(cleanCpfCnpj)) {
      toast.error("CPF inválido. Confira os números digitados.");
      return;
    }
    if (!documentIsCpf && !isValidCnpj(cleanCpfCnpj)) {
      toast.error("CNPJ inválido. Confira os números digitados.");
      return;
    }
    if (documentIsCpf && !form.birthDate) {
      toast.error("Data de nascimento é obrigatória para CPF.");
      return;
    }
    if (!Number.isFinite(cleanIncomeValue) || cleanIncomeValue <= 0) {
      toast.error(documentIsCpf ? "Informe a renda mensal." : "Informe o faturamento mensal.");
      return;
    }
    const cleanPixAddressKey = sanitizePixKeyForAsaas(form.pixAddressKey, form.pixAddressKeyType.toLowerCase());
    const pixErr = validatePixKey(cleanPixAddressKey, form.pixAddressKeyType.toLowerCase());
    if (pixErr) {
      toast.error(`Chave PIX: ${pixErr}`);
      return;
    }

    setSubmitting(true);
    const payload = {
      store_id: storeId,
      name: form.name,
      email: form.email,
      cpfCnpj: cleanCpfCnpj,
      birthDate: documentIsCpf ? form.birthDate : undefined,
      personType: documentIsCpf ? "FISICA" : "JURIDICA",
      companyType: !documentIsCpf ? form.companyType : undefined,
      incomeValue: cleanIncomeValue,
      phone: cleanPhone,
      mobilePhone: cleanPhone,
      address: form.address,
      addressNumber: form.addressNumber,
      complement: form.complement || undefined,
      province: form.province,
      postalCode: cleanCep,
      city: form.city || undefined,
      state: form.state || undefined,
      site: form.site || undefined,
      pixAddressKey: cleanPixAddressKey,
      pixAddressKeyType: form.pixAddressKeyType,
    };

    setLastError(null);
    setDebugInfo(null);
    try {
       console.log("Chamando edge function create-asaas-subaccount manualmente via fetch...");
       const { data: { session } } = await supabase.auth.getSession();
       const response = await fetch("https://qkjhguziuchqsbxzruea.supabase.co/functions/v1/create-asaas-subaccount", {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           Authorization: `Bearer ${session?.access_token}`,
            apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFramhndXppdWNocXNieHpydWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDg4NTUsImV4cCI6MjA5MDYyNDg1NX0.2sTeKchqAEN2gCqnH1_Zn9cJmUSmZgryt05A66tgm2Y",
         },
         body: JSON.stringify(payload),
       });
       const data = await response.json();

       if (!response.ok) {
         console.error("Erro retornado pela função:", data);
         setDebugInfo(data);
         throw new Error((data as any)?.error || "Erro na comunicação com o servidor.");
       }

      console.log("Resposta da Edge Function:", data);

      if ((data as any)?.error) {
        console.error("Erro de lógica retornado pela função:", (data as any).error);
        setDebugInfo(data);
        throw new Error((data as any).error);
      }

      toast.success("Subconta criada! Split automático ativado. 🎉");
      qc.invalidateQueries({ queryKey: ["store-asaas", storeId] });
    } catch (e: any) {
      console.error("Erro ao criar subconta:", e);
      setLastError(e?.message || "Erro desconhecido"); toast.error(e?.message || "Falha ao criar subconta.");
    } finally {
      setSubmitting(false);
    }
  };


  const { data: activationStatus, isLoading: loadingStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["asaas-activation-status", storeId],
    queryFn: async () => {
      if (!store?.asaas_wallet_id) return null;
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("https://qkjhguziuchqsbxzruea.supabase.co/functions/v1/get-asaas-subaccount-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFramhndXppdWNocXNieHpydWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDg4NTUsImV4cCI6MjA5MDYyNDg1NX0.2sTeKchqAEN2gCqnH1_Zn9cJmUSmZgryt05A66tgm2Y",
        },
        body: JSON.stringify({ store_id: storeId }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.status;
    },
    enabled: !!store?.asaas_wallet_id,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

   if (store?.asaas_wallet_id) {
     const isPending = !activationStatus || 
                      activationStatus?.commercialInfo !== "APPROVED" || 
                      activationStatus?.bankAccount !== "APPROVED" || 
                      activationStatus?.document !== "APPROVED";

    return (
      <div className="space-y-4">
        <Alert className={isPending ? "border-amber-500/40 bg-amber-500/5" : "border-green-500/40 bg-green-500/5"}>
          {isPending ? <AlertCircle className="h-5 w-5 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 text-green-600" />}
          <AlertTitle className={isPending ? "text-amber-700" : "text-green-700"}>
            {isPending ? "Subconta em análise / Pendente" : "Subconta 100% Ativa"}
          </AlertTitle>
          <AlertDescription className="text-xs">
            {isPending 
              ? "Sua subconta já recebe pagamentos, mas você precisa completar a ativação para realizar saques."
              : "Tudo pronto! Seus recebimentos e saques estão liberados."}
            <br />
            <span className="text-muted-foreground">Wallet: <code className="text-[10px]">{store.asaas_wallet_id}</code></span>
          </AlertDescription>
        </Alert>

         {isPending && (
          <Card className="border-amber-200">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center justify-between">
                Situação da Ativação
                <Button variant="ghost" size="sm" onClick={() => refetchStatus()} disabled={loadingStatus}>
                  <RefreshCw className={`h-3 w-3 ${loadingStatus ? "animate-spin" : ""}`} />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-4 space-y-3">
               <div className="flex items-center justify-between text-xs">
                 <span className="flex items-center gap-2"><ShieldCheck className="h-3 w-3" /> Dados Comerciais</span>
                 <span className={activationStatus?.commercialInfo === "APPROVED" ? "text-green-600 font-bold" : "text-amber-600"}>
                   {activationStatus?.commercialInfo === "APPROVED" ? "Aprovado" : "Pendente"}
                 </span>
               </div>
               <div className="flex items-center justify-between text-xs">
                 <span className="flex items-center gap-2"><Banknote className="h-3 w-3" /> Dados Bancários</span>
                 <span className={activationStatus?.bankAccount === "APPROVED" ? "text-green-600 font-bold" : "text-amber-600"}>
                   {activationStatus?.bankAccount === "APPROVED" ? "Aprovado" : "Pendente"}
                 </span>
               </div>
               <div className="flex items-center justify-between text-xs">
                 <span className="flex items-center gap-2"><FileText className="h-3 w-3" /> Documentos</span>
                 <span className={activationStatus?.document === "APPROVED" ? "text-green-600 font-bold" : "text-amber-600"}>
                   {activationStatus?.document === "APPROVED" ? "Aprovado" : "Pendente"}
                 </span>
               </div>

               {/* Links específicos por item pendente */}
               <div className="pt-2 space-y-2">
                 {activationStatus?.commercialInfo !== "APPROVED" && (
                   <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-2">
                     <p className="text-[11px] text-amber-800 dark:text-amber-400 font-medium">
                       📋 Dados comerciais pendentes
                     </p>
                     <a
                       href="https://www.asaas.com/commercialInfo/index"
                       target="_blank"
                       rel="noopener noreferrer"
                       className="text-[11px] font-bold text-primary underline flex items-center gap-1"
                     >
                       Completar <ExternalLink className="h-2.5 w-2.5" />
                     </a>
                   </div>
                 )}
                 {activationStatus?.bankAccount !== "APPROVED" && (
                   <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-2">
                     <p className="text-[11px] text-amber-800 dark:text-amber-400 font-medium">
                       🏦 Dados bancários pendentes
                     </p>
                     <a
                       href="https://www.asaas.com/bankAccount/index"
                       target="_blank"
                       rel="noopener noreferrer"
                       className="text-[11px] font-bold text-primary underline flex items-center gap-1"
                     >
                       Completar <ExternalLink className="h-2.5 w-2.5" />
                     </a>
                   </div>
                 )}
                 {activationStatus?.document !== "APPROVED" && (
                   <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-2">
                     <p className="text-[11px] text-amber-800 dark:text-amber-400 font-medium">
                       📄 Documentos pendentes ou rejeitados
                     </p>
                     <a
                       href="https://www.asaas.com/documents/index"
                       target="_blank"
                       rel="noopener noreferrer"
                       className="text-[11px] font-bold text-primary underline flex items-center gap-1"
                     >
                       Enviar <ExternalLink className="h-2.5 w-2.5" />
                     </a>
                   </div>
                 )}
               </div>

               <div className="pt-1 space-y-1.5">
                 <Button variant="outline" className="w-full text-[11px] h-8 border-primary/30 text-primary hover:bg-primary/5" asChild>
                   <a href="https://www.asaas.com/childAccounts/list" target="_blank" rel="noopener noreferrer">
                     Abrir painel Asaas completo <ExternalLink className="h-3 w-3 ml-1.5" />
                   </a>
                 </Button>
                 <p className="text-[9px] text-center text-muted-foreground">
                   Suporte Asaas:{" "}
                   <a href="mailto:contato@asaas.com.br" className="underline">contato@asaas.com.br</a>
                   {" "}| 0800 009 0037
                 </p>
               </div>
            </CardContent>
          </Card>
        )}

        {isPending && <AsaasDocumentsUpload storeId={storeId} />}
      </div>
    );
  }

  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-8 px-2">
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex flex-col items-center gap-2 flex-1 relative">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-colors ${
            step >= s ? "bg-primary text-white" : "bg-muted text-muted-foreground"
          }`}>
            {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
          </div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {s === 1 ? "Dados" : s === 2 ? "Endereço" : "Financeiro"}
          </span>
          {s < 3 && (
            <div className={`absolute top-4 left-[60%] w-[80%] h-[2px] -z-0 ${
              step > s ? "bg-primary" : "bg-muted"
            }`} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <Card className="overflow-hidden border-none shadow-xl bg-gradient-to-b from-background to-muted/20">
      <CardHeader className="bg-primary/5 border-b border-primary/10 pb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Banknote className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">
            Configuração da Subconta
          </CardTitle>
        </div>
        <CardDescription className="text-sm">
          Ative o recebimento direto e split automático via Asaas.
        </CardDescription>
        <AsaasBadgeBar className="mt-3 mx-6" />
      </CardHeader>
      
      <CardContent className="pt-8 space-y-6">
        {renderStepIndicator()}

        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-4">
              <div className="flex p-1 bg-muted rounded-xl gap-1">
                <Button 
                  type="button"
                  variant={personType === "FISICA" ? "default" : "ghost"}
                  className="flex-1 rounded-lg h-10"
                  onClick={() => setPersonType("FISICA")}
                >
                  <User className="h-4 w-4 mr-2" /> Pessoa Física
                </Button>
                <Button 
                  type="button"
                  variant={personType === "JURIDICA" ? "default" : "ghost"}
                  className="flex-1 rounded-lg h-10"
                  onClick={() => setPersonType("JURIDICA")}
                >
                  <Landmark className="h-4 w-4 mr-2" /> Pessoa Jurídica
                </Button>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>{isCpf ? "Nome completo" : "Razão social"}</Label>
                  <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder={isCpf ? "Como no RG/CNH" : "Como no Cartão CNPJ"} />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{isCpf ? "CPF" : "CNPJ"}</Label>
                    <Input value={formatPixKeyDisplay(form.cpfCnpj, isCpf ? "cpf" : "cnpj")} 
                           onChange={(e) => update("cpfCnpj", e.target.value)} placeholder="000.000.000-00" />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail comercial</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      placeholder="vendas@loja.com"
                    />
                  </div>
                </div>

                {/* 🔒 Confirmação de e-mail */}
                <div className="space-y-2">
                  <Label>Confirmar e-mail</Label>
                  <Input
                    type="email"
                    value={form.emailConfirm}
                    onChange={(e) => update("emailConfirm", e.target.value)}
                    placeholder="Digite o e-mail novamente"
                    className={
                      form.emailConfirm && form.email
                        ? form.email.toLowerCase().trim() === form.emailConfirm.toLowerCase().trim()
                          ? "border-emerald-500 focus-visible:ring-emerald-500/30"
                          : "border-red-500 focus-visible:ring-red-500/30"
                        : ""
                    }
                  />
                  {form.emailConfirm && form.email && (
                    form.email.toLowerCase().trim() === form.emailConfirm.toLowerCase().trim() ? (
                      <p className="text-xs text-emerald-600 flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" /> E-mails conferem
                      </p>
                    ) : (
                      <p className="text-xs text-red-500 flex items-center gap-1.5 font-medium">
                        <AlertCircle className="h-3.5 w-3.5" /> E-mails não coincidem
                      </p>
                    )
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    ⚠️ Este e-mail será vinculado à sua conta Asaas de recebimento. Use um e-mail real que você acessa.
                  </p>
                </div>

                {isCpf ? (
                  <div className="space-y-2">
                    <Label>Data de nascimento</Label>
                    <Input type="date" value={form.birthDate} onChange={(e) => update("birthDate", e.target.value)} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Tipo de empresa</Label>
                    <Select value={form.companyType} onValueChange={(v) => update("companyType", v)}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEI">MEI - Microempreendedor Individual</SelectItem>
                        <SelectItem value="INDIVIDUAL">Empresário Individual</SelectItem>
                        <SelectItem value="LIMITED">LTDA - Sociedade Limitada</SelectItem>
                        <SelectItem value="ASSOCIATION">Associação / Sem fins lucrativos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{isCpf ? "Renda mensal" : "Faturamento mensal"}</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">R$</span>
                      <Input className="pl-9" inputMode="decimal" value={form.incomeValue} onChange={(e) => update("incomeValue", e.target.value)} placeholder="0,00" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>WhatsApp</Label>
                    <Input value={formatPixKeyDisplay(form.phone, "phone")} onChange={(e) => update("phone", e.target.value)} placeholder="(00) 00000-0000" />
                  </div>
                </div>
              </div>
            </div>
            
            <Button className="w-full h-12 text-base font-bold" onClick={() => {
              if (!form.name || !form.email || !form.cpfCnpj) {
                toast.error("Preencha os campos básicos para continuar.");
                return;
              }
              // 🔒 Validar e-mail antes de avançar
              if (!form.emailConfirm) {
                toast.error("Confirme seu e-mail antes de continuar.");
                return;
              }
              if (form.email.toLowerCase().trim() !== form.emailConfirm.toLowerCase().trim()) {
                toast.error("Os e-mails não coincidem. Verifique e tente novamente.");
                return;
              }
              setStep(2);
            }}>
              Continuar para Endereço <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} placeholder="00000-000" maxLength={9} />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3 space-y-2">
                  <Label>Endereço</Label>
                  <Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Rua, Avenida..." />
                </div>
                <div className="col-span-1 space-y-2">
                  <Label>Nº</Label>
                  <Input value={form.addressNumber} onChange={(e) => update("addressNumber", e.target.value)} placeholder="123" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input value={form.province} onChange={(e) => update("province", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Complemento</Label>
                  <Input value={form.complement} onChange={(e) => update("complement", e.target.value)} placeholder="Apto, Sala..." />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3 space-y-2">
                  <Label>Cidade</Label>
                  <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
                </div>
                <div className="col-span-1 space-y-2">
                  <Label>UF</Label>
                  <Input value={form.state} onChange={(e) => update("state", e.target.value.toUpperCase())} maxLength={2} />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(1)}>Voltar</Button>
              <Button className="flex-[2] h-12 text-base font-bold" onClick={() => {
                 if (!form.postalCode || !form.address || !form.addressNumber) {
                   toast.error("Preencha os campos obrigatórios de endereço.");
                   return;
                 }
                 setStep(3);
              }}>
                Dados Bancários <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <Alert className="border-primary/20 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs">
                Informe a chave PIX onde você deseja receber seus saques. Pode ser de qualquer banco.
              </AlertDescription>
            </Alert>

            <div className="space-y-4 p-4 border rounded-2xl bg-muted/30">
              <div className="space-y-2">
                <Label>Tipo de chave PIX</Label>
                <Select value={form.pixAddressKeyType} onValueChange={(v) => update("pixAddressKeyType", v)}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CPF">CPF</SelectItem>
                    <SelectItem value="CNPJ">CNPJ</SelectItem>
                    <SelectItem value="EMAIL">E-mail</SelectItem>
                    <SelectItem value="PHONE">Celular</SelectItem>
                    <SelectItem value="EVP">Chave Aleatória (EVP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sua Chave PIX</Label>
                <Input 
                  value={formatPixKeyDisplay(form.pixAddressKey, form.pixAddressKeyType.toLowerCase())} 
                  onChange={(e) => update("pixAddressKey", e.target.value)} 
                  placeholder="Digite sua chave aqui"
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-amber-900 uppercase tracking-tight">Verificação de Segurança</p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Ao clicar abaixo, seus dados serão validados pelo Asaas e pela Receita Federal. 
                      Use apenas dados <strong>reais</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(2)}>Voltar</Button>
                <Button className="flex-[2] h-12 text-base font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20" onClick={submit} disabled={submitting}>
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ShieldCheck className="h-5 w-5 mr-2" />}
                  Ativar Minha Conta
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Footer info always visible */}
        <div className="pt-6 border-t border-border mt-4 flex items-center justify-center gap-6">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            <ShieldCheck className="h-3 w-3 text-primary" /> 100% Seguro
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            <Landmark className="h-3 w-3 text-primary" /> Homologado Asaas
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            <CheckCircle2 className="h-3 w-3 text-primary" /> Grátis
          </div>
        </div>

        {(lastError || debugInfo) && (
          <div className="mt-4 p-3 rounded bg-slate-50 border border-slate-200 text-[10px] font-mono overflow-hidden">
            <div className="flex justify-between items-center mb-2">
              <p className="font-bold text-red-700">Log de Erro (Debug):</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 px-2 text-[10px]"
                onClick={() => {
                  const text = `${lastError}\n\n${JSON.stringify(debugInfo, null, 2)}`;
                  navigator.clipboard.writeText(text);
                  toast.success("Copiado!");
                }}
              >
                <Copy className="h-3 w-3 mr-1" /> Copiar
              </Button>
            </div>
            <div className="max-h-40 overflow-auto">
              <p className="text-red-600 mb-2">{lastError}</p>
              {debugInfo && (
                <pre className="text-slate-600 whitespace-pre-wrap">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
