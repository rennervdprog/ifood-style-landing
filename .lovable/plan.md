## Objetivo
Deixar o app cliente 100% consistente para Android, com identidade `app.itasuper.cliente` e sem resíduos do app entregador/legado.

## O que será corrigido

**1. Identidade do app (applicationId / namespace)**
- `android/app/build.gradle`: trocar `app.lovable.e8d28aded...` por `app.itasuper.cliente` (namespace + applicationId).
- `android/app/src/main/res/values/strings.xml`: atualizar `package_name` e `custom_url_scheme` para `app.itasuper.cliente`.
- Mover/ajustar o pacote Java do `MainActivity` para o novo namespace.

⚠️ Atenção: mudar o applicationId cria um app "novo" para o Android. Quem já tem o APK antigo instalado precisará desinstalar e instalar de novo. Se preferir evitar isso, posso manter o ID legado e apenas alinhar o `capacitor.config.ts` para ele.

**2. Remover plugin do entregador do app cliente**
- Tirar o bloco `BackgroundRunner` (`app.itasuper.driver.background` / `runners/driverBackground.js`) do `capacitor.config.ts` do cliente — ele não tem função no APK do cliente e só consome bateria/permissões.

**3. Sincronizar versões**
- `appendUserAgent` passa de `ItaSuperApp/1.26.4` para a versão corrente, lendo de uma constante única para não desatualizar de novo.

**4. Limpar o `build.gradle` da raiz**
- Arquivo duplicado com applicationId legado e `versionName 1.2.81`. Remover (ou marcar como obsoleto) para não confundir builds locais.

**5. Validar CI**
- Revisar `build-android.yml`: hoje ele "conserta" o applicationId em tempo de build. Depois da correção na base, esses patches viram redundantes e serão simplificados.

## Verificação final
- Typecheck limpo.
- `npx cap sync android` sem avisos.
- Deep links `itasuper://` e App Links `https://itasuper.com.br` continuam apontando para a MainActivity correta.
- Incremento de versão (patch + versionCode) conforme o padrão do projeto.

## Detalhes técnicos
Arquivos tocados: `capacitor.config.ts`, `android/app/build.gradle`, `android/app/src/main/res/values/strings.xml`, `android/app/src/main/java/**/MainActivity.java`, `build.gradle` (raiz), `.github/workflows/build-android.yml`, `src/lib/appVersion.ts`.
