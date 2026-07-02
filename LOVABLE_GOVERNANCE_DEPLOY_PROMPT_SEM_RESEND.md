# Prompt para Lovable — Publicacao sem Resend

Cole o texto abaixo no chat do Lovable:

```text
Contexto:
Este projeto MOOUI Collab Hub ja esta conectado ao Git/Lovable. O frontend deve ser atualizado a partir da branch atual do repositorio. Antes de publicar, confirme que as mudancas locais ja foram commitadas e enviadas para o Git; o Lovable nao enxerga arquivos apenas locais. O SQL de governanca ja foi aplicado manualmente no Supabase SQL Editor usando generated/governance-release.sql. Nao rode esse SQL novamente.

Decisao desta etapa:
Vamos seguir sem configurar Resend agora. Nao configurar RESEND_API_KEY nem EMAIL_FROM nesta rodada. Tambem nao bloquear a publicacao por falta de dados de e-mail externo.

Objetivo:
Publicar/sincronizar o frontend pelo Lovable e publicar as Edge Functions de governanca que nao dependem obrigatoriamente do Resend para executar.

Por favor faca:

1. Sincronize o projeto com a branch Git atual e confirme que as mudancas recentes foram carregadas.

2. Publique/atualize o app no Lovable.

3. Verifique se o projeto Supabase conectado eh o correto:
   project ref: rckglywohrywurknephc

4. Nao rode migrations e nao rode generated/governance-release.sql novamente. O SQL ja foi aplicado no Supabase SQL Editor.

5. Publique as Edge Functions abaixo no Supabase:
   - admin-set-member-status
   - admin-renew-member-access
   - record-member-access
   - process-board-reminders
   - process-access-governance-alerts
   - admin-resend-invite

6. Sobre e-mail/convites:
   - Nao configurar RESEND_API_KEY nesta rodada.
   - Nao configurar EMAIL_FROM nesta rodada.
   - Se a function admin-resend-invite depender do Resend como fallback, mantenha a function publicada, mas marque reenvio de convite por e-mail externo como pendente.
   - Convite inicial pode usar o fluxo nativo do Supabase Auth se estiver disponivel.
   - Nao considerar falha de envio via Resend como bloqueio desta publicacao.

7. Sobre ALLOWED_ORIGIN:
   - Se for obrigatorio preencher, use a URL publicada do app no Lovable sem barra no final.
   - Se ainda nao houver URL final, deixe ausente ou use "*" temporariamente apenas para teste.
   - Nao invente dominio customizado.

8. Verifique/configure somente os secrets necessarios para as functions sem Resend:
   - SUPABASE_SERVICE_ROLE_KEY
   - SUPABASE_PUBLISHABLE_KEY ou SUPABASE_ANON_KEY
   - BOARD_REMINDERS_CRON_SECRET, se for configurar cron de lembretes
   - ACCESS_GOVERNANCE_CRON_SECRET, se for configurar cron de governanca
   - ALLOWED_ORIGIN apenas se o ambiente exigir CORS explicito

9. Se o Lovable tiver acesso a agendamentos/cron do Supabase, configure:
   - process-board-reminders para rodar periodicamente os lembretes de Data Acao.
   - process-access-governance-alerts para rodar diariamente os alertas de convites/acessos.

10. Faca smoke test remoto sem depender de Resend:
   - Abrir o app publicado.
   - Entrar como admin.
   - Ver Configuracoes > Usuarios.
   - Testar suspender usuario.
   - Testar reativar usuario.
   - Testar renovar validade de acesso.
   - Testar filtros/ordenacao da aba Usuarios.
   - Testar Liberacoes/presets/simulador.
   - Invocar process-board-reminders com payload {"limit":25}, se houver secret/cron.
   - Invocar process-access-governance-alerts com payload {"limit":25}, se houver secret/cron.

Regras importantes:
- Nao recrie migrations.
- Nao rode generated/governance-release.sql de novo.
- Nao altere schema sem necessidade.
- Nao exigir Resend nesta rodada.
- Se alguma Edge Function nao puder ser publicada por permissao, informe exatamente qual permissao falta e em qual etapa falhou.
- Se algum secret realmente obrigatorio estiver ausente, liste exatamente o nome do secret faltante.
- Ao final, entregue um resumo com: frontend publicado, functions publicadas, secrets configurados/ignorados, crons configurados/pendentes e smoke tests realizados.
```
