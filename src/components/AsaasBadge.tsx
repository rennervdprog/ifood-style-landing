/**
 * AsaasBadge
 * Selo obrigatório do Asaas conforme Resolução Conjunta nº 16 e 17 do Banco Central.
 * Deve aparecer em todos os pontos de contato com serviços financeiros
 * e no site institucional público.
 *
 * ID do selo: 227615cf-f248-411a-8faf-1077012c80a4
 * O carregamento da imagem pelo browser gera log automático no servidor do Asaas.
 */

interface AsaasBadgeProps {
  variant?: "positive" | "negative-black" | "negative-white";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SEAL_ID = "227615cf-f248-411a-8faf-1077012c80a4";

const SEAL_URLS = {
  positive:         `https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Positivo.svg?id=${SEAL_ID}`,
  "negative-black": `https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Negativo-Preto.svg?id=${SEAL_ID}`,
  "negative-white": `https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Negativo-Branco.svg?id=${SEAL_ID}`,
};

const SIZES = {
  sm: "h-6",
  md: "h-8",
  lg: "h-10",
};

export default function AsaasBadge({
  variant = "positive",
  size = "md",
  className = "",
}: AsaasBadgeProps) {
  return (
    <img
      src={SEAL_URLS[variant]}
      alt="Serviços financeiros processados pelo Asaas — Instituição de Pagamento autorizada pelo Banco Central do Brasil"
      title="Serviços financeiros processados pelo Asaas"
      className={`${SIZES[size]} w-auto object-contain ${className}`}
      loading="eager"
      crossOrigin="anonymous"
    />
  );
}

/**
 * AsaasBadgeBar — barra completa com texto legal
 * Para rodapés de telas financeiras e site institucional
 */
export function AsaasBadgeBar({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2.5 py-2.5 px-3 bg-muted/30 rounded-xl border border-border/40 ${className}`}>
      <AsaasBadge variant="positive" size="sm" />
      <p className="text-[10px] text-muted-foreground leading-snug text-center">
        Serviços financeiros processados pelo{" "}
        <a
          href="https://www.asaas.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-foreground hover:underline"
        >
          Asaas
        </a>
        {" "}— Instituição de Pagamento autorizada pelo{" "}
        <a
          href="https://www.bcb.gov.br"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-foreground hover:underline"
        >
          Banco Central do Brasil
        </a>
        .
      </p>
    </div>
  );
}

/**
 * AsaasBadgeFooter — versão para rodapé do site institucional
 * Mais visível, com texto completo de conformidade
 */
export function AsaasBadgeFooter({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-2 text-center ${className}`}>
      <AsaasBadge variant="positive" size="md" />
      <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
        Os serviços financeiros do ItaSuper são processados pelo{" "}
        <a
          href="https://www.asaas.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-foreground hover:underline"
        >
          Asaas Gestão Financeira S.A.
        </a>
        {" "}— Instituição de Pagamento autorizada e supervisionada pelo Banco Central do Brasil.
      </p>
    </div>
  );
}
