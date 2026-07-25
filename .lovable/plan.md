## Objetivo
Corrigir o bug do teclado no app cliente onde, ao focar qualquer input, aparece um grande espaço branco/cinza entre o conteúdo e o teclado, deixando a tela difícil ou impossível de usar.

## Diagnóstico provável
O problema não é mais a cor preta/cinza: agora o WebView está branco, mas o bug real continua porque o app está adicionando `padding-bottom` global no `#root` com a altura inteira do teclado.

Na prática, quando o teclado abre:

```text
Tela normal
+ conteúdo
+ padding gigante = altura do teclado
+ teclado Android
```

Esse padding vira a “mancha enorme” visível na tela, especialmente em checkout, login e modais.

## Plano de correção

### 1. Remover o padding global gigante do app
Alterar `src/index.css` para parar de aplicar isso globalmente:

```css
.native-app.keyboard-open #root {
  padding-bottom: altura-do-teclado;
}
```

Manter apenas `scroll-padding-bottom`, que ajuda o campo focado a não ficar escondido, mas sem criar um bloco branco visível.

### 2. Trocar a estratégia: teclado sobreposto + scroll controlado
Manter no Android:

```xml
android:windowSoftInputMode="adjustNothing"
```

e no Capacitor:

```ts
KeyboardResize.None
```

Mas o JavaScript não deve “empurrar” a página inteira; ele deve apenas rolar o input ativo para uma posição útil.

### 3. Melhorar o `scrollFocusedFieldIntoView`
Atualizar `src/lib/nativeBoot.ts` para:

- usar `requestAnimationFrame` + delay curto após o teclado abrir;
- calcular se o input está atrás do teclado;
- rolar somente o necessário;
- não centralizar agressivamente campos que já estão visíveis;
- evitar scroll quando o input está no topo e já pode ser usado.

### 4. Corrigir telas com rodapé fixo durante teclado
Auditar e ajustar telas críticas com input:

- login/cadastro;
- checkout `/checkout` e guest checkout;
- modais de endereço/observação;
- perfil/endereço;
- busca.

Quando o teclado estiver aberto no app nativo, rodapés fixos como resumo do pedido devem não criar espaço extra nem disputar com o teclado.

### 5. Adicionar classe utilitária segura
Criar uma regra CSS tipo:

```css
.native-app.keyboard-open .native-hide-while-keyboard {
  display: none;
}
```

Usar apenas em barras fixas que atrapalham inputs, como CTA/resumo fixo no checkout, se necessário.

### 6. Validação real
Como esse bug depende do teclado nativo Android, o teste final precisa ser no APK, mas antes vou validar no código:

- sem `padding-bottom` global com altura do teclado;
- sem `KeyboardResize.Body` ou `Native`;
- sem `reload`/layout shift relacionado a OTA;
- campos ainda recebem scroll automático.

Depois de gerar APK, testar no celular:

1. login com senha;
2. checkout/finalizar pedido;
3. campo telefone/número;
4. modal com input;
5. fechar teclado e abrir de novo.

## Arquivos que serão alterados

- `src/index.css`
- `src/lib/nativeBoot.ts`
- possivelmente `src/pages/CheckoutPage.tsx` e `src/pages/GuestCheckoutPage.tsx` se o rodapé fixo estiver interferindo
- versão sincronizada em:
  - `src/lib/appVersion.ts`
  - `android/app/build.gradle`
  - `android/app/src/main/java/.../MainActivity.java`

## Resultado esperado
Ao abrir o teclado, a tela não deve criar uma faixa branca gigante; o teclado deve sobrepor a parte inferior e o app deve apenas rolar o campo ativo para ficar usável.