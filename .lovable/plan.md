# Ebook ItaSuper para Lojistas — Plano de Geração de PDF

## Recomendação de formato

- **Papel:** A4 (210×297mm) — padrão brasileiro, imprime bem e abre em qualquer WhatsApp/celular. US Letter só se o público fosse EUA.
- **Orientação:** retrato, margens 18mm.
- **Tipografia:** Inter/DejaVu Sans (suporta acentos PT-BR nativamente no ReportLab).
- **Paleta:** cores da marca ItaSuper já usadas no app (primary do `index.css`) + preto/cinza + destaques amarelo/verde para CTAs.
- **Extensão alvo:** 14–18 páginas (leitura de 8–10 min, ideal pra WhatsApp).
- **Peso alvo:** < 3 MB (compressão de imagens em 150 dpi).
- **Entrega:** `/mnt/documents/ItaSuper-Ebook-Lojistas-v1.pdf` + versão landscape opcional pra apresentação em tela.

## Estrutura (só dados REAIS que já existem no sistema)

Todo conteúdo abaixo sai de arquivos já auditados no repo — nada inventado.

```text
Capa                       — Logo + "Pare de pagar comissão. Comece a lucrar."
Sumário
1. O problema do marketplace  (docs/anuncio-andromeda-lojistas.md, LandingPage.tsx)
2. O que é o ItaSuper          (public/llms-full.txt — descrição oficial)
3. Como funciona em 4 passos   (fluxo cliente do llms-full.txt)
4. Planos e preços REAIS       (src/lib/plansInfo.ts — Essencial, Autonomia, PDV)
   • Essencial: R$ 0 → R$ 180 após R$ 5.000 GMV, 0% comissão
   • Autonomia: R$ 0 → R$ 239,90 após R$ 2.500 GMV, 0% taxa plataforma
   • PDV Only: R$ 69/mês
   • Add-on PDV: R$ 49/mês
5. Comparativo vs iFood/Rappi   (números reais do plansInfo.ts + FAQ do llms-full)
6. Taxa de entrega explicada    (DELIVERY_FEE_NOTE — os R$0,99 em cima, meio-a-meio, lojista)
7. Ferramentas incluídas        (llms-full: PDV, KDS, Motoboy, Multi-loja, PIX, IA WhatsApp)
8. Segurança e LGPD             (PoliticaPrivacidade.tsx, TermosDeUso.tsx)
9. Prova social / cases         (deixar placeholder — só se você tiver depoimento real)
10. FAQ                         (llms-full.txt já tem 9 perguntas)
11. Como cadastrar em 3 min     (link https://itasuper.com.br/cadastro-lojista + QR code)
Contracapa                     — CTA + WhatsApp + QR
```

## Copy persuasivo (princípios aplicados)

- **Contraste de preço concreto:** "R$ 0 até faturar R$ 5.000" vs "27% do iFood".
- **Reciprocidade:** 2 meses grátis + tutorial.
- **Escassez real:** 10 vagas Apoiador (dado real de `plansInfo.ts`) — só se ainda estiver aberto.
- **Autoridade:** número de lojas ativas, cidades atendidas (buscar do banco antes de gerar).
- **Prova numérica:** exemplo "Pedido de R$ 50 → você fica com R$ 48,01" (função `netPerOrder`).
- **CTA único e claro:** QR code pro cadastro em toda página par.

## Implementação técnica

1. Script Python `/tmp/gen_ebook.py` usando **ReportLab Platypus** (skill/pdf já carregada).
2. Registrar **DejaVu Sans** via `fc-match` (skill exige — senão acento vira caixinha).
3. Ler `src/lib/plansInfo.ts` e `public/llms-full.txt` do próprio repo pra não divergir dos preços atuais.
4. Gerar QR codes com `qrcode[pil]` apontando pra `itasuper.com.br/cadastro-lojista` e WhatsApp.
5. Usar cores hex do `src/index.css` (primary/foreground).
6. **QA obrigatório:** rodar `pdftoppm -jpeg -r 150` e revisar cada página com `code--view` — checar acentos, quebras, overflow, contraste. Corrigir e re-gerar até passar.
7. Salvar em `/mnt/documents/ItaSuper-Ebook-Lojistas-v1.pdf` e emitir `<presentation-artifact>`.

## O que NÃO vou incluir (pra não inventar)

- Depoimentos de lojistas (não temos no repo — vou deixar página em branco marcada "inserir 2 depoimentos aqui").
- Número de lojas/pedidos totais (só incluo se você autorizar consulta ao banco real agora).
- Datas de fundação, prêmios, mídia.

## Próximos passos

Se aprovar, eu:
1. Gero o PDF v1 completo com os dados do repo.
2. Faço QA visual página por página.
3. Entrego pra download.
Se quiser, também consulto o banco pra puxar nº real de lojas ativas e cidades atendidas antes de gerar — só confirmar.
