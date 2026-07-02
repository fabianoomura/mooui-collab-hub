# Prompt para Lovable — Publicacao Governanca MOOUI

Cole o texto abaixo no chat do Lovable:

```text
Contexto:
Este projeto MOOUI Collab Hub ja esta conectado ao Git/Lovable. O frontend deve ser atualizado a partir da branch atual do repositorio. Antes de publicar, confirme que as mudancas locais ja foram commitadas e enviadas para o Git; o Lovable nao enxerga arquivos apenas locais. O SQL de governanca ja foi aplicado manualmente no Supabase SQL Editor usando generated/governance-release.sql. Nao rode esse SQL novamente.

Objetivo:
Sincronizar/publicar o frontend no Lovable e completar a publicacao das Supabase Edge Functions de governanca.

Por favor faca:

1. Sincronize o projeto com a branch Git atual e confirme que as mudancas recentes foram carregadas.

2. Publique/atualize o app no Lovable.

3. Verifique se o projeto Supabase conectado eh o correto:
   project ref: rckglywohrywurknephc

4. Publique as Edge Functions abaixo no Supabase:
   - admin-set-member-status
   - admin-resend-invite
   - admin-renew-member-access
   - record-member-access
   - process-board-reminders
   - process-access-governance-alerts

5. Verifique/configure os secrets necessarios:
   - SUPABASE_SERVICE_ROLE_KEY
   - SUPABASE_PUBLISHABLE_KEY ou SUPABASE_ANON_KEY
   - ALLOWED_ORIGIN
   - RESEND_API_KEY
   - EMAIL_FROM
   - BOARD_REMINDERS_CRON_SECRET
   - ACCESS_GOVERNANCE_CRON_SECRET

6. Se o Lovable tiver acesso a agendamentos/cron do Supabase, configure:
   - process-board-reminders para rodar periodicamente os lembretes de Data Acao.
   - process-access-governance-alerts para rodar diariamente os alertas de convites/acessos.

7. Faca um smoke test remoto das funcoes:
   - Convite de usuario
   - Reenvio de convite
   - Suspender usuario
   - Reativar usuario
   - Renovar validade de acesso
   - Registrar primeiro acesso/aceite de convite
   - Processar lembretes de Data Acao
   - Processar alertas de governanca

Regras importantes:
- Nao recrie migrations.
- Nao rode generated/governance-release.sql de novo.
- Nao altere schema sem necessidade.
- Se alguma Edge Function nao puder ser publicada por permissao, informe exatamente qual permissao falta e em qual etapa falhou.
- Se algum secret estiver ausente, liste exatamente o nome do secret faltante.
- Ao final, me entregue um resumo com: frontend publicado, functions publicadas, secrets conferidos, crons configurados e smoke tests realizados.
```

## Valores dos secrets

Use estes formatos no painel do Lovable/Supabase:

```text
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=MOOUI <noreply@seudominio.com.br>
ALLOWED_ORIGIN=https://seu-app.lovable.app
```

Observacoes:

- `RESEND_API_KEY`: chave criada no Resend, normalmente com prefixo `re_`.
- `EMAIL_FROM`: remetente com dominio verificado no Resend. Exemplo final: `MOOUI <noreply@mooui.com.br>`.
- `ALLOWED_ORIGIN`: URL base do app publicado, com `https://` e sem barra no final. Exemplo: `https://hub.mooui.com.br` ou `https://nome-do-projeto.lovable.app`.
- O codigo atual le `ALLOWED_ORIGIN` como uma unica origem. Para producao, prefira a URL final do Lovable/custom domain. Para teste temporario, `*` funciona, mas e menos restrito.
