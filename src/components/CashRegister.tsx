import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Minus, History, Lock, Unlock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CashRegisterProps {
  storeId: string;
}

export const CashRegister = ({ storeId }: CashRegisterProps) => {
  const queryClient = useQueryClient();
  const [openingBalance, setOpeningBalance] = useState<string>("0");
  const [transactionAmount, setTransactionAmount] = useState<string>("");
  const [transactionNote, setTransactionNote] = useState<string>("");

  // Busca o caixa atual aberto
  const { data: activeRegister, isLoading: isLoadingRegister } = useQuery({
    queryKey: ["active-cash-register", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("store_id", storeId)
        .eq("status", "open")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Busca transações do caixa atual
  const { data: transactions } = useQuery({
    queryKey: ["cash-transactions", activeRegister?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_transactions")
        .select("*")
        .eq("cash_register_id", activeRegister?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeRegister?.id,
  });

  const openMutation = useMutation({
    mutationFn: async (amount: number) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");
      
      const { data, error } = await supabase
        .from("cash_registers")
        .insert({
          store_id: storeId,
          opening_balance: amount,
          opened_by: userData.user.id,
          status: "open",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-cash-register", storeId] });
      toast.success("Caixa aberto com sucesso!");
    },
  });

  const transactionMutation = useMutation({
    mutationFn: async ({ amount, type, category }: { amount: number, type: 'in' | 'out', category: 'sale' | 'cash_in' | 'cash_out' | 'expense' }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("cash_transactions")
        .insert({
          cash_register_id: activeRegister?.id,
          amount,
          type,
          category,
          description: transactionNote,
          created_by: userData.user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-transactions"] });
      setTransactionAmount("");
      setTransactionNote("");
      toast.success("Operação registrada!");
    },
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("cash_registers")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
          closed_by: userData.user?.id,
        })
        .eq("id", activeRegister?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-cash-register"] });
      toast.success("Caixa fechado com sucesso!");
    },
  });

  if (isLoadingRegister) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!activeRegister) {
    return (
      <div className="p-6 border rounded-xl bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col items-center gap-4 py-8">
          <Lock className="w-12 h-12 text-muted-foreground" />
          <h3 className="text-xl font-bold">O caixa está fechado</h3>
          <p className="text-muted-foreground text-center max-w-xs">
            Para começar a registrar vendas e movimentações, você precisa abrir o caixa.
          </p>
          <div className="flex flex-col gap-2 w-full max-w-xs mt-4">
            <label className="text-sm font-medium">Fundo de troco (R$)</label>
            <Input 
              type="number" 
              value={openingBalance} 
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0,00"
            />
            <Button 
              className="w-full mt-2" 
              onClick={() => openMutation.mutate(Number(openingBalance))}
              disabled={openMutation.isPending}
            >
              Abrir Caixa
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 border rounded-xl bg-card shadow-sm">
          <p className="text-sm text-muted-foreground">Saldo em Caixa</p>
          <p className="text-2xl font-bold text-foreground">
            {formatBRL(Number(activeRegister.opening_balance) + (transactions?.reduce((acc, curr) => curr.type === 'in' ? acc + Number(curr.amount) : acc - Number(curr.amount), 0) || 0))}
          </p>
        </div>
        <div className="p-6 border rounded-xl bg-card shadow-sm">
          <p className="text-sm text-muted-foreground">Status</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Aberto</Badge>
            <span className="text-xs text-muted-foreground">Desde {format(new Date(activeRegister.opened_at), "HH:mm")}</span>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="h-full border-destructive/20 text-destructive hover:bg-destructive/10"
          onClick={() => closeMutation.mutate()}
          disabled={closeMutation.isPending}
        >
          <Lock className="w-4 h-4 mr-2" />
          Fechar Caixa
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 border rounded-xl bg-card shadow-sm space-y-4">
          <h4 className="font-bold flex items-center gap-2">
            <History className="w-4 h-4" />
            Nova Movimentação
          </h4>
          <div className="space-y-3">
            <Input 
              type="number" 
              placeholder="Valor (R$)" 
              value={transactionAmount}
              onChange={(e) => setTransactionAmount(e.target.value)}
            />
            <Input 
              placeholder="Observação (ex: Sangria, Almoço, Reforço)" 
              value={transactionNote}
              onChange={(e) => setTransactionNote(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                className="border-primary/20 text-primary hover:bg-primary/10"
                onClick={() => transactionMutation.mutate({ amount: Number(transactionAmount), type: 'in', category: 'cash_in' })}
                disabled={transactionMutation.isPending || !transactionAmount}
              >
                <Plus className="w-4 h-4 mr-2" />
                Entrada
              </Button>
              <Button 
                variant="outline" 
                className="border-border text-foreground hover:bg-muted"
                onClick={() => transactionMutation.mutate({ amount: Number(transactionAmount), type: 'out', category: 'cash_out' })}
                disabled={transactionMutation.isPending || !transactionAmount}
              >
                <Minus className="w-4 h-4 mr-2" />
                Saída
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6 border rounded-xl bg-card shadow-sm overflow-hidden">
          <h4 className="font-bold mb-4">Últimas Movimentações</h4>
          <div className="max-h-[300px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions?.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-xs">{format(new Date(tx.created_at), "HH:mm")}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground block">{tx.description || tx.category}</span>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${tx.type === 'in' ? 'text-primary' : 'text-muted-foreground'}`}>
                      {tx.type === 'in' ? '+' : '-'} {formatBRL(Number(tx.amount))}
                    </TableCell>
                  </TableRow>
                ))}
                {transactions?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Nenhuma transação</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
};