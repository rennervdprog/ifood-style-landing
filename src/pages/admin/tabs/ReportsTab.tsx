import React from "react";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar 
} from "recharts";
import { useAdmin } from "../AdminContext";
import { formatBRL } from "@/lib/utils";

const ReportsTab = () => {
  const { orders, todayTotal, todayCount, avgDeliveryTime, clientAnalytics } = useAdmin();

  // Simple analytics logic (placeholders for real data if needed)
  const data = [
    { name: 'Seg', total: 400 },
    { name: 'Ter', total: 300 },
    { name: 'Qua', total: 600 },
    { name: 'Qui', total: 800 },
    { name: 'Sex', total: 500 },
    { name: 'Sáb', total: 900 },
    { name: 'Dom', total: 1100 },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      <h2 className="text-xl font-black text-foreground">Relatórios de Vendas</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-3xl p-5 lg:p-6 shadow-sm">
          <h3 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wider">Faturamento Semanal</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                <RechartsTooltip />
                <Area type="monotone" dataKey="total" stroke="#8884d8" fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-3xl p-5 lg:p-6 shadow-sm">
          <h3 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wider">Distribuição de Pedidos</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip />
                <Bar dataKey="total" fill="#8884d8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsTab;
