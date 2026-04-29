import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { CheckCircle2, Loader2, Banknote, ShieldCheck, Copy } from "lucide-react";
import { toast } from "sonner";
import { formatPixKeyDisplay, sanitizePixKeyForAsaas, validatePixKey } from "@/lib/pixFormat";

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

const isValidCpf = (value: string) => {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const calc = (base: string, factor: number) => {
    const total = base.split("").reduce((sum, n) => sum + Number(n) * factor--, 0);
    const digit = (total * 10) % 11;
    return digit === 10 ? 0 : digit;
  };
  return calc(cpf.slice(0, 9), 10) === Number(cpf[9]) && calc(cpf.slice(0, 10), 11) === Number(cpf[10]);
};

const isValidCnpj = (value: string) => {
  const cnpj = value.replace(/\D/g, "");
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
    (initialData?.cpfCnpj?.replace(/\D/g, "").length || 0) === 14 ? "JURIDICA" : "FISICA"
  );

  const [form, setForm] = useState({
    name: initialData?.name || "",
    email: initialData?.email || "",
    cpfCnpj: initialData?.cpfCnpj || "",
    birthDate: "",
    companyType: "MEI" as "MEI" | "INDIVIDUAL" | "LIMITED" | "ASSOCIATION",
    incomeValue: "",
    phone: initialData?.phone || "",
    address: initialData?.address || "",
    addressNumber: initialData?.addressNumber || "",
    complement: initialData?.complement || "",
    province: initialData?.province || "",
    postalCode: initialData?.postalCode || "",
    pixAddressKey: initialData?.cpfCnpj || "",
    pixAddressKeyType: "CPF" as PixKeyType,
  });

  useEffect(() => {
    if (initialData) {
      setForm(f => ({
        ...f,
        name: f.name || initialData.name || "",
        email: f.email || initialData.email || "",
        cpfCnpj: f.cpfCnpj || initialData.cpfCnpj || "",
        phone: f.phone || initialData.phone || "",
        address: f.address || initialData.address || "",
        addressNumber: f.addressNumber || initialData.addressNumber || "",
        complement: f.complement || initialData.complement || "",
        province: f.province || initialData.province || "",
        postalCode: f.postalCode || initialData.postalCode || "",
        pixAddressKey: f.pixAddressKey || initialData.cpfCnpj || "",
      }));
    }
  }, [initialData]);

  const isCpf = personType === "FISICA";

  const update = (k: string, v: string) => {
    let val = v;
    if (k === "cpfCnpj") {
      val = v.replace(/\D/g, "");
      val = val.slice(0, personType === "FISICA" ? 11 : 14);
    }
    if (k === "pixAddressKey" && (form.pixAddressKeyType === "CPF" || form.pixAddressKeyType === "CNPJ")) {
      val = v.replace(/\D/g, "");
      val = val.slice(0, form.pixAddressKeyType === "CPF" ? 11 : 14);
    }
    if (k === "phone") val = v.replace(/\D/g, "").slice(0, 11);
    if (k === "postalCode") val = v.replace(/\D/g, "").slice(0, 8);
    
    setForm((f) => {
      const next = { ...f, [k]: val };
      if (k === "pixAddressKeyType") next.pixAddressKey = "";
      return next;
    });
  };

  const submit = async () => {
    const cleanCpfCnpj = form.cpfCnpj.replace(/\D/g, "");
    const cleanPhone = form.phone.replace(/\D/g, "");
    const cleanCep = form.postalCode.replace(/\D/g, "");
    const cleanIncomeValue = Number(String(form.incomeValue).replace(/\./g, "").replace(",", "."));
    const documentIsCpf = cleanCpfCnpj.length === 11;

    if (!form.name || !form.email || cleanCpfCnpj.length < 11 || cleanPhone.length < 10 || !form.address ||
        !form.addressNumber || !form.province || cleanCep.length !== 8 || !form.pixAddressKey) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    if ((personType === "FISICA" && cleanCpfCnpj.length !== 11) || (personType === "JURIDICA" && cleanCpfCnpj.length !== 14)) {
      toast.error(personType === "FISICA" ? "CPF deve ter 11 dígitos." : "CNPJ deve ter 14 dígitos.");
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
    const pixErr = validatePixKey(form.pixAddressKey, form.pixAddressKeyType.toLowerCase());
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
      pixAddressKey: sanitizePixKeyForAsaas(form.pixAddressKey, form.pixAddressKeyType.toLowerCase()),
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
    return (
      <Alert className="border-green-500/40 bg-green-500/5">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <AlertTitle className="text-green-700 dark:text-green-400">
          Split automático ativo
        </AlertTitle>
        <AlertDescription className="text-xs">
          Sua subconta Asaas está conectada. A cada PIX recebido, sua parte cai
          direto na sua conta — só a comissão da plataforma vai pra ItaSuper.
          <br />
          <span className="text-muted-foreground">Wallet: <code className="text-[10px]">{store.asaas_wallet_id}</code></span>
        </AlertDescription>
      </Alert>
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
