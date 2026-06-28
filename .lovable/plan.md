## Plano para fazer o `- 1 +` funcionar corretamente nos adicionais

### Problema atual
Na imagem, a Coca está selecionada com quantidade 3 e a linha mostra `+ R$ 27,00`, mas o botão final continua `Adicionar • R$ 9,00`.

Isso indica que a interface já multiplica visualmente o adicional, mas o cálculo final usado pelo botão/carrinho ainda está caindo em uma dessas situações:

1. O grupo está marcado como `price_replaces_base`, então o preço base é substituído, mas o total final não está sincronizado com a quantidade do item selecionado.
2. O produto base tem preço zerado ou substituível, e o cálculo do botão está usando apenas uma unidade.
3. O carrinho recebe addons repetidos, mas o `totalUnitPrice` enviado ainda não representa a soma real dos addons escolhidos.

### Correção proposta

#### 1. Criar um cálculo único e auditável para adicionais
Em `ProductDetailModal.tsx`, trocar os cálculos soltos por um resumo único:

```text
selectedAddonRows = [
  grupo,
  item,
  quantidade,
  preço unitário,
  total da linha,
  se substitui preço base
]
```

A partir disso calcular:

```text
replacementTotal = soma dos adicionais que substituem o preço base
normalAddonsTotal = soma dos adicionais normais
unitPrice = preço base correto + normalAddonsTotal
lineTotal = unitPrice * quantidade do produto
```

#### 2. Regra para `price_replaces_base`
Quando o grupo for “define valor final”, o item selecionado passa a ser o preço do produto configurado.

Exemplo correto:

```text
Coca zero R$ 9,00 x 3
Botão: Adicionar • R$ 27,00
Carrinho: item com preço unitário R$ 27,00 se a quantidade principal for 1
```

Se o cliente também aumentar a quantidade principal do produto para 2:

```text
3 Cocas no adicional x quantidade 2 do produto
Botão: Adicionar • R$ 54,00
```

#### 3. Manter compatibilidade com carrinho, checkout, PDV e thermal
Para não quebrar o sistema atual:

- Continuar repetindo os addons no array `CartAddon[]`, como já é feito hoje.
- Enviar `totalUnitPrice` já consolidado para o carrinho.
- Não mudar banco de dados.
- Não mudar schema de pedido.
- Não mexer em Pizza/Pastel builders.
- Não alterar impressão térmica agora, porque ela já lê os addons repetidos.

#### 4. Ajustar a UI para evitar confusão
Na linha selecionada mostrar:

```text
Coca zero        R$ 9,00 x 3 = R$ 27,00
```

Ou, em layout mobile compacto:

```text
Coca zero
R$ 9,00 x 3
```

O botão final sempre deve bater com o que aparece na seleção.

#### 5. Validar casos principais
Testar manualmente estes cenários:

1. Bebida com `define valor final`, 1 unidade: botão `R$ 9,00`.
2. Bebida com `define valor final`, 3 unidades: botão `R$ 27,00`.
3. Bebida com `define valor final`, 3 unidades + quantidade principal 2: botão `R$ 54,00`.
4. Adicional normal, exemplo bacon R$ 4 x 2, somar ao preço base.
5. Grupo obrigatório `Escolha 1` continua validando como selecionado quando há quantidade maior que 1.
6. Pizza e Pastel continuam sem mudança no fluxo.

#### 6. Versão
Após aplicar a correção:

- Subir para `1.10.314`.
- Incrementar `versionCode` Android para `644`.
- Manter versão sincronizada no app.

### Resultado esperado
O `- 1 +` dos adicionais vai alterar visual, botão final, carrinho, checkout e impressão térmica de forma consistente, sem mexer em APIs internas nem quebrar Pizza/Pastel.