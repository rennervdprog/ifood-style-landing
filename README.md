# 🍔 ItaSuper

Plataforma de delivery para Itatinga/SP — sistema completo conectando clientes, lojistas e entregadores.

---

## 📦 Estrutura do Projeto

```
src/
├── pages/           # Páginas da aplicação
├── components/      # Componentes reutilizáveis
├── hooks/           # React hooks customizados
├── lib/             # Funções utilitárias e integrações
├── contexts/        # Contextos React (Auth, Cart, Store)
└── integrations/    # Cliente Supabase

supabase/
├── functions/       # Edge Functions (35 funções)
└── migrations/      # Migrations do banco de dados

android/             # App Capacitor para Android
```

---

## 🧩 Stack Tecnológica

- **Frontend:** React 18 + Vite + TypeScript
- **UI:** Tailwind CSS + shadcn/ui + Radix
- **Backend:** Supabase (Postgres + Auth + Edge Functions + Storage)
- **Mobile:** Capacitor (Android)
- **Pagamentos:** Asaas + Mercado Pago
- **Notificações:** Firebase Cloud Messaging
- **Mapas:** Leaflet + OpenStreetMap
- **Monitoramento:** Sentry

---

## 🏪 Modelos de Plano

A plataforma oferece 3 modalidades para lojistas:

| Plano       | Mensalidade | Comissão por pedido | Taxa fixa de entrega |
|-------------|-------------|---------------------|----------------------|
| Essencial   | R$ 180/mês  | 0%                  | R$ 2,00              |
| Crescimento | R$ 100/mês  | 2,5% do subtotal    | R$ 2,00              |
| Comissão    | R$ 0/mês    | 6% do subtotal      | R$ 2,00              |

A taxa de R$ 2,00 da plataforma é sempre adicionada à taxa de entrega do lojista e cobrada do cliente.

---

## 🚀 Como rodar localmente

### Pré-requisitos
- Node.js 22+
- Conta Supabase
- Conta Asaas (para pagamentos)
- Conta Firebase (para push notifications)

### Setup

```bash
# 1. Instalar dependências
npm install

# 2. Copiar template de variáveis de ambiente
cp .env.example .env

# 3. Preencher .env com suas chaves Supabase

# 4. Rodar em desenvolvimento
npm run dev
```

### Build

```bash
# Build web
npm run build

# Build Android (requer Capacitor configurado)
npx cap sync android
npx cap open android
```

---

## 🔒 Segurança

### Variáveis de ambiente
- **Nunca** commite o arquivo `.env`
- Use `.env.example` como template
- Secrets sensíveis (`SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY`, etc) ficam apenas no painel do Supabase em Settings > Edge Functions > Secrets

### RLS (Row Level Security)
Todas as tabelas têm RLS ativo. Não desabilite sem auditoria.

### Capacitor
- `usesCleartextTraffic="false"` em produção
- `minifyEnabled true` no build release
- Apenas HTTPS para todas as APIs

---

## 📋 Versionamento

Mantenha sempre sincronizadas as 3 referências de versão:

1. `src/App.tsx` → `APP_VERSION`
2. `android/app/build.gradle` → `versionCode` e `versionName`
3. `package.json` → `version` (se aplicável)

Quando atualizar uma, atualize as outras.

---

## 🏗 Arquitetura financeira

```
Cliente paga via PIX/Cartão
        ↓
CheckoutPage cria registro em "orders" com commission_rate histórica
        ↓
Edge Function "payment-router" processa pagamento via Asaas
        ↓
Asaas faz split automático para subconta do lojista
        ↓
Trigger no banco atualiza store_balances
        ↓
Painel admin exibe via SuperAdminDashboard
        ↓
Lojista vê via StoreFinancePanel (usa taxa histórica do pedido)
```

---

## 🐛 Debug

### Logs Capacitor
```bash
adb logcat | grep -i capacitor
```

### Erros frontend
Sentry captura automaticamente. Acesse o dashboard do Sentry.

### Edge Functions
```bash
supabase functions logs <nome-da-funcao>
```

---

## 📞 Suporte

Para questões internas, contate a equipe de desenvolvimento.

---

## ⚖️ Licença

Proprietário — uso exclusivo do projeto ItaSuper.
