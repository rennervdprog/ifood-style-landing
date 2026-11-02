import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatBRL } from "@/lib/utils";
import { Wallet } from "lucide-react";

interface Props {
  compact?: boolean;
}

const WalletBanner = ({ compact }: Props) => {
  const { user } = useAuth();

  const { data: wallet } = useQuery({
    queryKey: ["user-wallet", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_wallet")
        .select("balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const balance = Number(wallet?.balance || 0);
  if (balance <= 0) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full">
        <Wallet className="h-3.5 w-3.5" />
        <span className="text-xs font-bold">{formatBRL(balance)}</span>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
        <Wallet className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">Saldo disponível</p>
        <p className="text-lg font-black text-foreground">{formatBRL(balance)}</p>
      </div>
    </div>
  );
};

export default WalletBanner;
