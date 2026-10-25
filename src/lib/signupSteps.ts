/**
 * Cadastro do cliente em 3 passos (/auth, modo signup).
 *
 * Validação por passo + rascunho local — funções puras, sem React, para
 * poderem ser testadas sem montar o componente.
 *
 * Regras de validação: as MESMAS do cadastro antigo (só o momento muda —
 * por passo, não tudo no fim). O CPF/CNPJ foi REMOVIDO do cadastro em
 * 2026-10-25 (decisão do Renner): o campo era gravado em profiles.document
 * mas nada no fluxo o usava (só 10 dos 89 clientes tinham documento).
 */

export type SignupStep = 1 | 2 | 3;

export interface SignupValues {
  email: string;
  whatsapp: string;
  fullName: string;
  password: string;
  cep: string;
  number: string;
  street: string;
  neighborhood: string;
  complement: string;
  referencePoint: string;
  deliveryPin: string;
  confirmPin: string;
  pinAcknowledged: boolean;
  acceptedTerms: boolean;
}

export const EMPTY_SIGNUP_VALUES: SignupValues = {
  email: "",
  whatsapp: "",
  fullName: "",
  password: "",
  cep: "",
  number: "",
  street: "",
  neighborhood: "",
  complement: "",
  referencePoint: "",
  deliveryPin: "",
  confirmPin: "",
  pinAcknowledged: false,
  acceptedTerms: false,
};

export const SIGNUP_STEPS: { step: SignupStep; title: string; label: string; subtitle: string }[] = [
  {
    step: 1,
    title: "Sua conta",
    label: "Sua conta",
    subtitle: "Seus dados de acesso. Usaremos o e-mail para entrar e recuperar a senha.",
  },
  {
    step: 2,
    title: "Seu endereço de entrega",
    label: "Endereço",
    subtitle: "Usaremos para calcular o frete e mostrar lojas perto de você.",
  },
  {
    step: 3,
    title: "Seu PIN de entrega",
    label: "PIN",
    subtitle: "Escolha 4 dígitos que só você sabe. O entregador vai pedir esse código em todas as suas entregas.",
  },
];

export const SIGNUP_STEP_TITLES: Record<SignupStep, string> = {
  1: "Sua conta",
  2: "Seu endereço de entrega",
  3: "Seu PIN de entrega",
};

/** Campos de cada passo, na ordem em que aparecem (para focar o primeiro inválido). */
export const SIGNUP_STEP_FIELDS: Record<SignupStep, (keyof SignupValues)[]> = {
  1: ["email", "whatsapp", "fullName", "password"],
  2: ["cep", "number", "street", "neighborhood"],
  3: ["deliveryPin", "confirmPin", "pinAcknowledged", "acceptedTerms"],
};

export type SignupErrors = Partial<Record<keyof SignupValues, string>>;

const looksLikeEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

/**
 * Valida um passo do cadastro e devolve o mapa campo → mensagem de erro
 * (vazio = passo válido). As mensagens são as mesmas dos toasts do cadastro
 * antigo — só o lugar mudou (inline, no campo).
 *
 * `passwordRulesPassed` é se a senha atende as 5 regras (o componente
 * calcula com PASSWORD_RULES; o validador só recebe o resultado).
 */
export function validateSignupStep(
  step: SignupStep,
  values: SignupValues,
  passwordRulesPassed: boolean,
): SignupErrors {
  const errors: SignupErrors = {};
  const digits = (v: string) => v.replace(/\D/g, "");

  if (step === 1) {
    if (!looksLikeEmail(values.email)) {
      errors.email = "Informe um e-mail válido.";
    }
    const whatsDigits = digits(values.whatsapp);
    if (whatsDigits.length < 10 || whatsDigits.length > 11) {
      errors.whatsapp = "Informe um WhatsApp válido com DDD.";
    }
    if (values.fullName.trim().length < 3) {
      errors.fullName = "Informe seu nome completo.";
    }
    if (!values.password.trim()) {
      errors.password = "Crie uma senha.";
    } else if (!passwordRulesPassed) {
      errors.password = "Sua senha precisa atender as 5 regras acima.";
    }
  }

  if (step === 2) {
    if (digits(values.cep).length !== 8) {
      errors.cep = "Informe um CEP válido com 8 dígitos.";
    }
    if (!values.number.trim()) {
      errors.number = "Informe o número.";
    }
    if (!values.street.trim()) {
      errors.street = "Informe a rua.";
    }
    if (!values.neighborhood.trim()) {
      errors.neighborhood = "Informe o bairro.";
    }
  }

  if (step === 3) {
    if (!/^\d{4}$/.test(values.deliveryPin)) {
      errors.deliveryPin = "Defina um PIN de entrega com 4 dígitos numéricos.";
    }
    if (values.confirmPin !== values.deliveryPin || !values.confirmPin) {
      errors.confirmPin = "Os PINs informados não coincidem.";
    }
    if (!values.pinAcknowledged) {
      errors.pinAcknowledged = "Confirme que este PIN será usado em todas as suas entregas.";
    }
    if (!values.acceptedTerms) {
      errors.acceptedTerms = "Você precisa aceitar os Termos de Uso e a Política de Privacidade.";
    }
  }

  return errors;
}

/** Primeiro campo com erro de um passo, na ordem dos campos (para o foco). */
export function firstErrorField(step: SignupStep, errors: SignupErrors): keyof SignupValues | null {
  for (const field of SIGNUP_STEP_FIELDS[step]) {
    if (errors[field]) return field;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rascunho local — salvo no aparelho (localStorage), apagado ao concluir.
// Não sai do aparelho, não toca no servidor, não cria conta parcial.
// Inclui a senha digitada (é o mesmo dado que o usuário já digitou no
// formulário; some ao concluir). Se preferir sem a senha no rascunho, é só
// tirar o campo daqui e do restore.
// ---------------------------------------------------------------------------

export const SIGNUP_DRAFT_KEY = "itasuper_cadastro_draft";

export interface SignupDraft {
  values: SignupValues;
  step: SignupStep;
}

export function saveSignupDraft(values: SignupValues, step: SignupStep): void {
  try {
    localStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify({ values, step }));
  } catch {
    /* armazenamento indisponível — o cadastro continua sem rascunho */
  }
}

export function loadSignupDraft(): SignupDraft | null {
  try {
    const raw = localStorage.getItem(SIGNUP_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SignupDraft>;
    if (!parsed || typeof parsed !== "object") return null;
    const step = parsed.step === 2 || parsed.step === 3 ? parsed.step : 1;
    const values: SignupValues = { ...EMPTY_SIGNUP_VALUES, ...(parsed.values ?? {}) };
    return { values, step };
  } catch {
    return null;
  }
}

export function clearSignupDraft(): void {
  try {
    localStorage.removeItem(SIGNUP_DRAFT_KEY);
  } catch {
    /* sem rascunho para apagar */
  }
}
