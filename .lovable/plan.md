## Plano para Evolution voltar a funcionar

### Objetivo
Restaurar a conexão do WhatsApp Plataforma pelos dois caminhos:
- QR Code
- Código por número de telefone

### Diagnóstico atual
- A API Evolution nova está respondendo e a chave autentica.
- O erro atual vem da função `evolution-qr-code`, que está caindo em erro interno genérico antes de devolver uma mensagem útil.
- Há risco de instância antiga/stale no banco versus instância real inexistente no servidor novo.
- O fluxo precisa tratar Evolution v2.3.7 de forma mais direta, sem depender de estado antigo.

### Correção proposta
1. **Reescrever o fluxo da função de conexão**
   - Validar usuário/admin.
   - Ler a configuração atual.
   - Checar se a instância existe na Evolution.
   - Se não existir, criar a instância com payload compatível com Evolution v2.3.7.
   - Reaplicar webhook e settings.
   - Só depois chamar conexão por QR ou por número.

2. **Separar QR Code de código por número**
   - QR: usar `/instance/connect/{instance}` e aceitar `base64`, `qrcode.base64`, `qrcode.code` ou `code`.
   - Número: usar `/instance/connect/{instance}?number=55...` e aceitar `pairingCode`, `pairing_code`, `qrcode.pairingCode` ou `code` quando for realmente código curto.

3. **Parar o 500 genérico**
   - Toda falha da Evolution vai retornar erro claro para a tela: status, etapa e mensagem resumida.
   - Exemplo: “falha ao criar instância”, “falha ao conectar”, “Evolution não retornou QR”.

4. **Reset seguro da instância da plataforma**
   - Se a instância `itasuper-platform` estiver quebrada/stale, apagar no servidor novo quando existir.
   - Recriar limpa.
   - Atualizar o banco para `connecting` apenas quando QR/código for gerado de verdade.

5. **Fechar brecha de diagnóstico**
   - Remover ou proteger função pública de diagnóstico que expõe dados operacionais do WhatsApp.

6. **Testes finais**
   - Testar QR Code.
   - Testar código por número.
   - Parear o WhatsApp ItaSuper.
   - Sincronizar status até `connected`.
   - Enviar mensagem teste para `14991624997`.

### Resultado esperado
A aba WhatsApp Plataforma deixa de travar em loading/500 e passa a mostrar erro útil ou QR/código válido, permitindo reconectar o ItaSuper no servidor novo.