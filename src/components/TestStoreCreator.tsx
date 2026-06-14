import { Store } from "lucide-react";

/**
 * Produção: criação de lojas-teste desabilitada.
 * Subcontas Asaas com dados fictícios podem causar bloqueio da conta principal.
 * Reative apenas em ambiente de homologação.
 */
const TestStoreCreator = () => {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Store className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-bold text-foreground">🧪 Lojas de Teste</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Desativado em produção. O Asaas pode bloquear a conta principal se forem
        criadas subcontas com dados fictícios. Use apenas no ambiente de testes.
      </p>
    </div>
  );
};

export default TestStoreCreator;
