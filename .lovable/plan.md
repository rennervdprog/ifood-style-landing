# Refactor Completo do PDV — Estilo Square/Toast

## Análise dos melhores PDVs do mercado

| Sistema | O que fazem bem |
|---|---|
| **Square** | Visual minimalista, grid grande de produtos com imagem, atalhos numéricos, multi-pagamento fluido |
| **Toast** | Categorias coloridas, tela densa mas organizada, fechamento cego (blind close), múltiplos turnos por operador |
| **iFood Shop / Goomer** | Touch-first, busca por código de barras, sugestões inteligentes |
| **Linx/Bematech** | Atalhos de teclado (F2/F3/F8), sangria/suprimento com motivo, conferência rigorosa |
| **Stone TON** | Multi-pagamento (cliente paga R$50 PIX + R$30 dinheiro), divisão de conta |

## O que está bom hoje (manter)
- Estrutura de turno (abertura → venda → fechamento)
- Sangria / Suprimento
- Histórico, Turnos anteriores e Relatórios
- Modal de adicionais
- Impressão térmica nativa
- Modo mobile com etapa catálogo→carrinho

## O que vou melhorar

### 1. UI/UX (visual Square/Toast — clean SaaS)
- Layout reformulado: grid de produtos maior, mais respiração entre elementos, tipografia hierárquica
- Cards de produto com hover/active claros, indicador visual de quantidade no carrinho
- Sidebar do carrinho com scroll independente, totais em sticky
- Cores semânticas consistentes (verde = receita, vermelho = saída/falta, azul = entrada, âmbar = atenção)
- Estados vazios mais elegantes (ilustrações leves)
- Header simplificado com KPI ao vivo (vendas do turno + ticket médio)

### 2. Atalhos de teclado (desktop)
- `F2` → focar busca de produtos
- `F3` → abrir desconto
- `F4` → ciclar formas de pagamento
- `F8` → finalizar venda
- `ESC` → limpar venda atual
- `Enter` em produto único filtrado → adicionar ao carrinho
- `+` / `-` em item selecionado → ajustar quantidade

### 3. Funcionalidades de venda novas
- **Multi-pagamento (split)**: cliente paga parte em dinheiro + parte em PIX/cartão. Lista visual com saldo restante.
- **Desconto por item** (além do desconto geral) — long press / botão no item do carrinho
- **Suporte a leitor de código de barras** (captura rajada de teclado terminando em Enter — ativo em qualquer foco da tela)
- **Cliente identificado opcional** (campo nome/telefone — já salva no order)
- **Mesa/Comanda**: chips de mesas em uso (1, 2, 3…) para reabrir/somar

### 4. Caixa e fechamento (mais profissional)
- **Fechamento cego (blind close)**: opção de o operador contar sem ver o esperado, sistema mostra diferença depois (anti-fraude — padrão Toast)
- **Motivo obrigatório em sangria** (cofre, despesa, etc.) — já tem campo, vou tornar obrigatório com presets
- **Conferência por cédula** (opcional): R$200/100/50/20/10/5/2/1 + moedas, soma automática
- **Resumo do operador**: quem abriu, quem fechou, duração do turno, ticket médio

### 5. Periféricos
- **Listener de barcode scanner global** (já mencionado) — detecta entrada rápida (>10 chars/s) e busca produto por nome OU SKU/barcode
- **Recibo melhorado** — versão atual já existe, vou adicionar opção "Não imprimir" (toggle por venda) para evitar desperdício

## Estrutura de arquivos

```text
src/pages/PdvPage.tsx                    # orquestrador (reduzido a ~300 linhas)
src/components/pdv/
  ├── PdvHeader.tsx                      # topbar + KPIs ao vivo
  ├── PdvAbertura.tsx                    # tela de abertura de caixa
  ├── PdvFechamento.tsx                  # tela de fechamento (com blind close)
  ├── PdvCatalog.tsx                     # grid de produtos + busca + categorias
  ├── PdvCart.tsx                        # carrinho + descontos + totais
  ├── PdvPayment.tsx                     # painel de pagamento com SPLIT
  ├── PdvProductCard.tsx                 # card individual do produto
  ├── PdvCartItem.tsx                    # item individual do carrinho
  ├── PdvMovementModal.tsx               # sangria/suprimento c/ motivos
  ├── PdvBarcodeScanner.tsx              # hook listener global
  ├── PdvKeyboardShortcuts.tsx           # hook de atalhos
  ├── PdvHistorico.tsx                   # (mantém)
  └── PdvRelatorios.tsx                  # (mantém)
```

## Banco de dados
- Adicionar coluna `payments` (jsonb) na tabela `orders` para suportar multi-pagamento — armazena `[{method, amount}]`
- Adicionar coluna `cashier_user_id` em `pdv_sessions` (já existe `opened_by`, ok)
- Adicionar coluna `denomination_count` (jsonb) em `pdv_sessions` para conferência por cédula

## Fora do escopo desta entrega
- Comanda compartilhada multi-dispositivo em tempo real (próxima fase)
- Integração com gaveta de dinheiro física (depende de driver específico)
- Balança integrada (depende de protocolo da balança do cliente)

## Versionamento
Bump para **1.5.0** (minor — mudança grande de funcionalidade), `versionCode` +1.

---

Confirma que posso prosseguir? Se quiser, posso ajustar o escopo (ex: deixar split de pagamento para depois e focar 100% em UI/atalhos primeiro).