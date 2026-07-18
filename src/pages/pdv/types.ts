import type { CartAddon } from "@/contexts/CartContext";

/** Produto exibido no catálogo do PDV. */
export interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  section_id: string | null;
  is_available: boolean;
  /** Campos extras necessários para os builders Pizza/Pastel. */
  store_id?: string;
  description?: string | null;
  metadata?: Record<string, any> | null;
  /** Venda por peso (kg). Quando true, `price_per_kg` define o preço base. */
  sold_by_weight?: boolean | null;
  price_per_kg?: number | null;
  weight_unit?: string | null;
  /** Código curto pra digitar+Enter no PDV (ex.: "01"). */
  pdv_short_code?: string | null;
  /** Ordem custom da grade rápida do PDV. */
  pdv_sort_order?: number | null;
}

/** Seção/categoria do cardápio. */
export interface MenuSection {
  id: string;
  name: string;
  sort_order: number;
  /** Cor da categoria na sidebar do PDV (hex ou nome de token). */
  pdv_color?: string | null;
}

/** Item dentro do carrinho do PDV. */
export interface CartItem {
  id: string;
  name: string;
  /** preço unitário total (base + addons) */
  price: number;
  /** preço base sem adicionais */
  basePrice: number;
  quantity: number;
  addons?: CartAddon[];
  observations?: string;
  image_url?: string | null;
  /** Metadados livres do item (ex.: { weight_grams, price_per_kg }). */
  metadata?: Record<string, any>;
}

/** Sessão de caixa aberta. */
export interface PdvSession {
  id: string;
  store_id: string;
  opened_at: string;
  opening_amount: number;
  status: string;
}

/** Telas principais do PDV. */
export type PdvScreen = "loading" | "abertura" | "venda" | "fechamento";

/** Passos do fluxo mobile. */
export type PdvMobileStep = "catalog" | "cart";

/** Abas dentro da tela de venda. */
export type PdvTab = "venda" | "mesas" | "historico" | "turnos" | "relatorios" | "meu_plano";