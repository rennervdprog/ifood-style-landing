import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { CheckCircle2, Loader2, Banknote, ShieldCheck, Copy, AlertCircle, FileText, ExternalLink, RefreshCw } from "lucide-react";
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

              <div className="pt-2 space-y-2">
                <p className="text-[10px] text-muted-foreground text-center">
                  Envie os documentos exigidos diretamente aqui, sem precisar acessar o site do Asaas.
                </p>
                <Button variant="outline" className="w-full text-[11px] h-8" asChild>
                  <a href="https://www.asaas.com/childAccounts/list" target="_blank" rel="noopener noreferrer">
                    Abrir painel do Asaas (opcional) <ExternalLink className="h-3 w-3 ml-2" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isPending && <AsaasDocumentsUpload storeId={storeId} />}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Banknote className="h-5 w-5 text-primary" />
          Receba PIX direto na sua conta (split automático)
        </CardTitle>
        <CardDescription className="text-xs">
          Crie sua subconta Asaas <strong>grátis</strong>. A cada venda PIX,
          sua parte vai direto pra sua conta bancária — sem precisar esperar repasse.
          Você não precisa criar conta no site do Asaas, fazemos tudo aqui.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-primary/30 bg-primary/5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <AlertDescription className="text-xs">
            <strong>100% gratuito.</strong> Sem mensalidade. Sem taxa de criação.
            Você só paga as taxas normais de PIX (R$ 1,99 por recebimento, padrão Asaas).
          </AlertDescription>
        </Alert>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Tipo de Documento *</Label>
            <div className="flex gap-2">
              <Button 
                type="button"
                variant={personType === "FISICA" ? "default" : "outline"}
                className={`flex-1 h-9 text-[11px] sm:text-xs ${personType === "FISICA" ? "bg-primary text-primary-foreground" : ""}`}
                onClick={() => {
                  setPersonType("FISICA");
                  update("cpfCnpj", "");
                }}
              >
                Pessoa Física (CPF)
              </Button>
              <Button 
                type="button"
                variant={personType === "JURIDICA" ? "default" : "outline"}
                className={`flex-1 h-9 text-[11px] sm:text-xs ${personType === "JURIDICA" ? "bg-primary text-primary-foreground" : ""}`}
                onClick={() => {
                  setPersonType("JURIDICA");
                  update("cpfCnpj", "");
                }}
              >
                Pessoa Jurídica (CNPJ)
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{isCpf ? "Nome completo *" : "Razão social *"}</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder={isCpf ? "Seu nome" : "Nome da empresa"} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{isCpf ? "CPF *" : "CNPJ *"}</Label>
            <Input value={formatPixKeyDisplay(form.cpfCnpj, isCpf ? "cpf" : "cnpj")} 
                   onChange={(e) => update("cpfCnpj", e.target.value)} placeholder="000.000.000-00" />
          </div>
          {isCpf ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Data de nascimento *</Label>
              <Input type="date" value={form.birthDate} onChange={(e) => update("birthDate", e.target.value)} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de empresa *</Label>
              <Select value={form.companyType} onValueChange={(v) => update("companyType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEI">MEI</SelectItem>
                  <SelectItem value="INDIVIDUAL">Empresário Individual</SelectItem>
                  <SelectItem value="LIMITED">LTDA</SelectItem>
                  <SelectItem value="ASSOCIATION">Associação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">{isCpf ? "Renda mensal *" : "Faturamento mensal *"}</Label>
            <Input
              inputMode="decimal"
              value={form.incomeValue}
              onChange={(e) => update("incomeValue", e.target.value.replace(/[^\d,.]/g, ""))}
              placeholder="2500,00"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Celular (WhatsApp) *</Label>
            <Input value={formatPixKeyDisplay(form.phone, "phone")} onChange={(e) => update("phone", e.target.value)} placeholder="(14) 99999-9999" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CEP (Só números) *</Label>
            <Input value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} placeholder="00000000" maxLength={8} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Endereço *</Label>
            <Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Rua, avenida..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Número *</Label>
            <Input value={form.addressNumber} onChange={(e) => update("addressNumber", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Complemento</Label>
            <Input value={form.complement} onChange={(e) => update("complement", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Bairro *</Label>
            <Input value={form.province} onChange={(e) => update("province", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cidade *</Label>
            <Input value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="Itatinga" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Estado (UF) *</Label>
            <Input value={form.state} onChange={(e) => update("state", e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" maxLength={2} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Site da loja (opcional)</Label>
            <Input value={form.site} onChange={(e) => update("site", e.target.value)} placeholder="https://minhaloja.com.br" />
          </div>
        </div>

        <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/30">
          <p className="text-xs font-bold text-foreground">Chave PIX para saques</p>
          <p className="text-[11px] text-muted-foreground">
            Aqui você cadastra a chave PIX onde quer sacar o dinheiro depois (qualquer banco — Itaú, Nubank, etc).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de chave *</Label>
              <Select value={form.pixAddressKeyType} onValueChange={(v) => update("pixAddressKeyType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CPF">CPF</SelectItem>
                  <SelectItem value="CNPJ">CNPJ</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="PHONE">Celular</SelectItem>
                  <SelectItem value="EVP">Aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Chave PIX ({form.pixAddressKeyType}) *</Label>
              <Input value={formatPixKeyDisplay(form.pixAddressKey, form.pixAddressKeyType.toLowerCase())} 
                     onChange={(e) => update("pixAddressKey", e.target.value)} />
            </div>
          </div>
        </div>

        <Button onClick={submit} disabled={submitting} className="w-full">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Criar subconta e ativar split automático
        </Button>

        <Alert className="border-blue-500/30 bg-blue-500/5">
          <FileText className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-700 text-xs">Após criar a subconta</AlertTitle>
          <AlertDescription className="text-[11px] space-y-1">
            O Asaas vai te pedir <strong>uma única vez</strong> os documentos abaixo (regra do Banco Central):
            <ul className="list-disc pl-4 mt-1 space-y-0.5">
              <li>RG ou CNH (frente e verso)</li>
              <li>Selfie segurando o documento</li>
              <li>Comprovante de residência (até 90 dias)</li>
              {!isCpf && <li>Cartão CNPJ / Contrato Social</li>}
            </ul>
            <p className="mt-1">Você receberá um e-mail e poderá enviar tudo pelo celular em 2 minutos.</p>
          </AlertDescription>
        </Alert>

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
