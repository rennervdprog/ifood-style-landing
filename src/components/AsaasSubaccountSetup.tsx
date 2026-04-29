import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, Banknote, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

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

export default function AsaasSubaccountSetup({ storeId, initialData }: Props) {
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

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

  const [form, setForm] = useState({
    name: initialData?.name || "",
    email: initialData?.email || "",
    cpfCnpj: initialData?.cpfCnpj || "",
    birthDate: "",
    companyType: "MEI" as "MEI" | "INDIVIDUAL" | "LIMITED" | "ASSOCIATION",
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

  const isCpf = form.cpfCnpj.replace(/\D/g, "").length === 11;

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    // Quick client-side validation
    if (!form.name || !form.email || !form.cpfCnpj || !form.phone || !form.address ||
        !form.addressNumber || !form.province || !form.postalCode || !form.pixAddressKey) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    if (isCpf && !form.birthDate) {
      toast.error("Data de nascimento é obrigatória para CPF.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-asaas-subaccount", {
        body: {
          store_id: storeId,
          name: form.name,
          email: form.email,
          cpfCnpj: form.cpfCnpj,
          birthDate: isCpf ? form.birthDate : undefined,
          companyType: !isCpf ? form.companyType : undefined,
          phone: form.phone,
          mobilePhone: form.phone,
          address: form.address,
          addressNumber: form.addressNumber,
          complement: form.complement || undefined,
          province: form.province,
          postalCode: form.postalCode,
          pixAddressKey: form.pixAddressKey,
          pixAddressKeyType: form.pixAddressKeyType,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Subconta criada! Split automático ativado. 🎉");
      qc.invalidateQueries({ queryKey: ["store-asaas", storeId] });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao criar subconta.");
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
          <div className="space-y-1.5">
            <Label className="text-xs">Nome completo / Razão social *</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CPF ou CNPJ *</Label>
            <Input value={form.cpfCnpj} onChange={(e) => update("cpfCnpj", e.target.value)} placeholder="Só números" />
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
            <Label className="text-xs">Telefone *</Label>
            <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="(14) 99999-9999" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CEP *</Label>
            <Input value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} />
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
              <Label className="text-xs">Chave PIX *</Label>
              <Input value={form.pixAddressKey} onChange={(e) => update("pixAddressKey", e.target.value)} />
            </div>
          </div>
        </div>

        <Button onClick={submit} disabled={submitting} className="w-full">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Criar subconta e ativar split automático
        </Button>
      </CardContent>
    </Card>
  );
}
