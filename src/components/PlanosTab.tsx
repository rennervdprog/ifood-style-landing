import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Wallet, Store, Clock, FileText } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import AdminFixedPlanReceivables from "@/components/AdminFixedPlanReceivables";
import AdminPlanTemplatesEditor from "@/components/AdminPlanTemplatesEditor";
import AdminPlanManager from "@/components/AdminPlanManager";

interface Kpis {
  receber: number;
  lojas: number;
  pendentes: number;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone: "emerald" | "blue" | "amber";
}) {
  const tones = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  } as const;
  return (
    <Card className="p-3 flex items-center gap-3 rounded-2xl">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold leading-tight truncate">{value}</p>
      </div>
    </Card>
  );
}

export default function PlanosTab() {
  const [kpis, setKpis] = useState<Kpis>({ receber: 0, lojas: 0, pendentes: 0 });
  const [pendentesCount, setPendentesCount] = useState(0);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [plans, requests] = await Promise.all([
        supabase
          .from("store_plans")
          .select("store_id, plan_type, monthly_fee, is_active")
          .eq("is_active", true),
        supabase
          .from("plan_change_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);
      if (cancel) return;
      const list = plans.data || [];
      const receber = list
        .filter((p: any) => p.plan_type === "fixed" || p.plan_type === "supporter")
        .reduce((s: number, p: any) => s + Number(p.monthly_fee || 0), 0);
      const pendentes = requests.count || 0;
      setKpis({ receber, lojas: list.length, pendentes });
      setPendentesCount(pendentes);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <KpiCard icon={Wallet} tone="emerald" label="A receber/mês" value={formatBRL(kpis.receber)} />
        <KpiCard icon={Store} tone="blue" label="Lojas com plano" value={String(kpis.lojas)} />
        <KpiCard icon={Clock} tone="amber" label="Solicitações" value={String(kpis.pendentes)} />
      </div>

      <Tabs defaultValue="lojas" className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-auto p-1">
          <TabsTrigger value="lojas" className="flex items-center gap-1.5 py-2">
            <Store className="h-4 w-4" />
            <span>Lojas</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-1.5 py-2">
            <FileText className="h-4 w-4" />
            <span>Templates</span>
          </TabsTrigger>
          <TabsTrigger value="receber" className="flex items-center gap-1.5 py-2 relative">
            <Wallet className="h-4 w-4" />
            <span>A Receber</span>
            {pendentesCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {pendentesCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lojas" className="mt-4">
          <AdminPlanManager />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <AdminPlanTemplatesEditor />
        </TabsContent>
        <TabsContent value="receber" className="mt-4">
          <AdminFixedPlanReceivables />
        </TabsContent>
      </Tabs>
    </div>
  );
}