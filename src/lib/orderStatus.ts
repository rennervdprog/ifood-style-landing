 export const statusColors: Record<string, { bg: string; text: string; border: string; label: string }> = {
   pendente: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30", label: "Novo Pedido" },
   preparando: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30", label: "Em Preparo" },
   pronto_para_entrega: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30", label: "Pronto" },
   saiu_entrega: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30", label: "Saiu Entrega" },
   em_transito: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30", label: "Em Trânsito" },
   entregue: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30", label: "Entregue" },
   finalizado: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30", label: "Finalizado" },
   cancelado: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30", label: "Cancelado" },
   // Compatibility for transaction statuses in SuperAdmin
   pending: { bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/30", label: "Pendente" },
   approved: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/30", label: "Aprovado" },
   paid: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/30", label: "Pago" },
   failed: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/30", label: "Falhou" },
   cancelled: { bg: "bg-muted", text: "text-muted-foreground", border: "border-border", label: "Cancelado" },
 };
 
 export const getStatusLabel = (status: string): string => {
   return statusColors[status]?.label || status;
 };