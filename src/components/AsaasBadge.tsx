/**
 * AsaasBadge — Selo oficial Asaas BaaS
 * Obrigatório conforme Resolução Conjunta nº 16/2025 do Banco Central
 * Playbook de BaaS — Asaas Gestão Financeira Instituição de Pagamento S.A.
 *
 * URLs individuais fornecidas pelo Asaas:
 * ID: 227615cf-f248-411a-8faf-1077012c80a4
 */

const SEAL_ID = "227615cf-f248-411a-8faf-1077012c80a4";

const SEAL_URLS = {
  positive:         `https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Positivo.svg?id=${SEAL_ID}`,
  "negative-black": `https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Negativo-Preto.svg?id=${SEAL_ID}`,
  "negative-white": `https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Negativo-Branco.svg?id=${SEAL_ID}`,
};

interface AsaasBadgeProps {
  variant?: "positive" | "negative-black" | "negative-white";
  size?: "sm" | "md" | "lg";
  className?: string;
  clickable?: boolean;
}

const SIZES = { sm: "h-6", md: "h-8", lg: "h-10" };

/**
 * Selo clicável que redireciona para asaas.com
 * Conforme Playbook p.15: "O selo pode ser utilizado como link de redirecionamento"
 */
export default function AsaasBadge({
  variant = "positive",
  size = "md",
  className = "",
  clickable = true,
}: AsaasBadgeProps) {
  const img = (
    <img
      src={SEAL_URLS[variant]}
      alt="Serviços financeiros Asaas"
      title="Serviços financeiros processados pelo Asaas — Instituição de Pagamento autorizada pelo Banco Central do Brasil"
      width={160}
      height={48}
      className={`${SIZES[size]} w-auto object-contain`}
      loading="eager"
      style={{ display: "inline-block" }}
    />
  );

  if (!clickable) return img;

  return (
    <a
      href="https://asaas.com"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Serviços financeiros processados pelo Asaas"
      className={className}
    >
      {img}
    </a>
  );
}

/**
 * AsaasBadgeBar — barra com selo + texto legal
 * Para uso em telas financeiras (checkout, painel, comprovantes)
 */
export function AsaasBadgeBar({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2.5 py-2.5 px-3 bg-muted/30 rounded-xl border border-border/40 ${className}`}>
      <AsaasBadge variant="positive" size="sm" />
      <p className="text-[10px] text-muted-foreground leading-snug">
        Serviços financeiros processados pelo{" "}
        <a
          href="https://asaas.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-foreground hover:underline"
        >
          Asaas
        </a>
        {" "}— Instituição de Pagamento autorizada pelo Banco Central do Brasil.
      </p>
    </div>
  );
}

/**
 * AsaasBadgeFooter — versão para rodapé do site institucional
 * Playbook p.7: "Telas de produto" e "site institucional"
 */
export function AsaasBadgeFooter({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-2 text-center ${className}`}>
      <AsaasBadge variant="positive" size="md" />
      <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
        Os serviços financeiros do ItaSuper são processados pelo{" "}
        <a
          href="https://asaas.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-foreground hover:underline"
        >
          Asaas Gestão Financeira Instituição de Pagamento S.A.
        </a>
        {" "}— autorizada e supervisionada pelo Banco Central do Brasil.
      </p>
    </div>
  );
}
