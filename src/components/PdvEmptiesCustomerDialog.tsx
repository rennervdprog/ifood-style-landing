import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Recycle, Search } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  orderId: string;
  onClose: () => void;
  onFound: (customerId: string, customerName: string) => void;
}

/**
 * Pergunta CPF/telefone do cliente no PDV, localiza no profiles e vincula
 * ao pedido (atualiza orders.client_id) para o fluxo de troca de casquinhas.
 */
const PdvEmptiesCustomerDialog = ({ open, orderId, onClose, onFound }: Props) => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    const digits = input.replace(/\D/g, "");
    if (digits.length < 8) {
      toast.error("Digite um CPF ou telefone válido.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, document, phone, whatsapp_number")
        .or(`document.eq.${digits},phone.eq.${digits},whatsapp_number.eq.${digits}`)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Cliente não encontrado.");
        return;
      }
      const { error: upErr } = await supabase
        .from("orders")
        .update({ client_id: data.user_id })
        .eq("id", orderId);
      if (upErr) throw upErr;
      onFound(data.user_id, data.full_name);
      setInput("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao buscar cliente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Recycle className="h-5 w-5 text-emerald-600" />
            Cliente trocou casquinhas?
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Esta venda tem garrafas retornáveis. Para creditar o saldo do cliente, digite o CPF ou telefone dele. Se for venda anônima, pule.
        </p>
        <Input
          autoFocus
          placeholder="CPF ou telefone"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
          maxLength={20}
        />
        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Pular</Button>
          <Button onClick={handleSearch} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
            <Search className="h-4 w-4 mr-1" />
            {loading ? "Buscando..." : "Buscar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PdvEmptiesCustomerDialog;