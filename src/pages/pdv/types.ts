import type { CartAddon } from "@/contexts/CartContext";

/** Produto exibido no catálogo do PDV. */
export interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  section_id: string | null;
  is_available: boolean;
}

/** Seção/categoria do cardápio. */
export interface MenuSection {
  id: string;
  name: string;
  sort_order: number;
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
export type PdvTab = "venda" | "historico" | "turnos" | "relatorios";