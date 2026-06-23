# Anúncio ItaSuper — Otimizado para Meta Andromeda (2026)

> Resumo do que mudou: o Andromeda (retrieval) + Adaptive Ranking Model leem **o criativo como sinal de targeting**. Não segmente por interesses — entregue 4+ ângulos de criativo, público amplo (Advantage+), CAPI ligado e deixe a IA achar o lojista.

---

## 1. Estrutura da campanha (cole no Ads Manager)

```
CAMPANHA: Captação Lojistas — ItaSuper
  Objetivo: Engajamento → Mensagens (WhatsApp)
  CBO: LIGADO   |  Orçamento: R$ 8-15/dia  |  Duração: 7 dias

  AD SET ÚNICO: Brasil — Donos de food service 25-58
    Localização: Brasil inteiro (ou só seu estado se quiser focar)
    Idade: 25-58  |  Gênero: todos  |  Idioma: PT
    Público: ADVANTAGE+ AUDIENCE (sem seed, sem interesses)
    Posicionamentos: Advantage+ Placements (deixar automático — Andromeda escolhe)
    Otimização: Conversas
    Pixel + CAPI: LIGADOS (evento "Mensagem Iniciada")

    CRIATIVOS ATIVOS: 6 a 8 (4 ângulos diferentes × 2 formatos)
```

> ⚠️ Esqueça o velho manual de Londrina com interesses ("Proprietários de pequenas empresas + Restaurante + iFood"). Em 2026 isso **piora** a entrega. Deixe Advantage+.

---

## 2. Os 4 ângulos de criativo (faça 1 vídeo 15s + 1 estático de cada)

### Ângulo 1 — DOR (comissão do iFood)
**Hook (3s):** "Se o iFood tá comendo 23% do seu pedido, presta atenção 3 segundos."
**Texto primário (<125 chars):**
> 23% de comissão é R$ 2.300 a cada R$ 10 mil vendidos. O ItaSuper cobra R$ 0. Chama no zap 👇

**Headline:** Sua loja sem comissão
**CTA:** Enviar mensagem

### Ângulo 2 — PROVA SOCIAL (lojas já rodando)
**Hook:** "Olha o painel real do Ric Burguer rodando no ItaSuper hoje."
**Texto primário:**
> Já tem loja faturando pelo ItaSuper sem pagar mensalidade. Quer ver o print? Manda mensagem.

**Headline:** Painel real, lojista real
**Visual:** print do painel admin (você já tem em /mnt/documents/itasuper-prints/)

### Ângulo 3 — DEMO (PDV + cozinha + motoboy)
**Hook:** "Pedido cai no app → vai pra cozinha → motoboy pega. Tudo num sistema só."
**Texto primário:**
> PDV + KDS + app do motoboy integrados. R$ 0/mês nas 10 primeiras vagas da sua cidade.

**Headline:** Tudo num painel só
**Visual:** screen recording 15s do painel

### Ângulo 4 — OFERTA / ESCASSEZ
**Hook:** "10 vagas grátis na sua cidade. Quando fechar, acabou."
**Texto primário:**
> Plano Essencial R$ 0/mês pra 10 lojas por cidade. Só R$ 2 por pedido — e o cliente paga.

**Headline:** 10 vagas grátis por cidade
**CTA:** Enviar mensagem

---

## 3. Mensagem pré-preenchida do WhatsApp (CRÍTICO)

Não use o genérico "Oi, tenho interesse". Configure no anúncio:

```
Oi! Vi o anúncio do ItaSuper. Tenho [ ] restaurante  [ ] pizzaria  [ ] hambúrguer  [ ] outro.
Quero saber das vagas grátis.
```

Adicione **Quick Reply Buttons** (até 3):
- "Quero uma vaga"
- "Quanto custa?"
- "Como funciona?"

---

## 4. Regras de ouro (não quebre)

1. **Responda em menos de 5 minutos.** Fechamento cai 70% depois disso.
2. **NÃO mexa nos primeiros 3 dias.** Andromeda precisa do learning phase (~50 conversas).
3. **Não pause criativo antes de 3 dias.** Mesmo que pareça ruim — pode ser o que está alimentando a IA.
4. **CAPI obrigatório.** Sem ele, o algoritmo fica cego pós-iOS 17. Use a edge function `evolution-webhook` pra disparar o evento "Lead" quando o lojista responde no WhatsApp.
5. **Renove criativos toda semana.** Mate o pior, suba 2 novos. Sem isso, CPA sobe ~23% em 5 semanas.
6. **Não segmente por interesse.** Não adicione "Restaurante", "iFood", "Empreendedorismo". Advantage+ sozinho performa melhor em 2026.
7. **Vídeo > estático.** Faça pelo menos metade dos criativos em vídeo curto 15s, vertical 9:16.

---

## 5. Métricas-alvo (7 dias, R$ 60-100 de teste)

| Métrica | Bom | Ótimo |
|---|---|---|
| Custo por conversa iniciada | até R$ 4,00 | até R$ 2,00 |
| Taxa de resposta sua | > 70% | > 90% |
| Conversa → proposta enviada | > 40% | > 60% |
| Proposta → lojista cadastrado | > 15% | > 25% |
| **CAC (custo por lojista fechado)** | < R$ 80 | < R$ 40 |

---

## 6. Próximo passo prático

1. Gravar 4 vídeos curtos de celular (15s cada) — você mesmo falando, sem produção.
2. Tirar 4 prints estáticos (painel, app do cliente, app motoboy, comparativo R$ 0 vs R$ 90).
3. Subir tudo num único ad set Advantage+, R$ 10/dia, 7 dias.
4. Não tocar até o dia 4. No dia 4: matar os 2 piores criativos, subir 2 novos.
5. Reconciliar leads do WhatsApp com cadastros reais toda segunda.

**Veredito Andromeda:** menos planilha, mais criativo. A IA da Meta hoje acha o lojista melhor que qualquer segmentação manual — desde que você dê 6+ ângulos pra ela testar e CAPI pra ela aprender.