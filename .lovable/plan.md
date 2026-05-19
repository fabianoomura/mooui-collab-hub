# Plano — Tickets, Docs e Mensagens

Implementação em **3 fases**, do maior impacto imediato pro mais complexo. Cada fase é entregável de forma independente — você aprova fase a fase.

---

## Fase 1 — Tickets de TI (inspirado no Jira)

**Objetivo:** transformar o módulo de tickets em ferramenta de trabalho real para a TI.

### 1.1 Código legível do ticket (`TI-001`)
- Adicionar coluna `code` (texto) + sequência por organização
- Migration com função que gera `TI-{n}` no insert
- Exibir o código no card, no modal e na listagem

### 1.2 Histórico de atividade (audit log)
- Tabela `ticket_activity` (ticket_id, user_id, action, from_value, to_value, created_at)
- Trigger no `tickets` que registra mudanças de status, responsável, prioridade
- Aba "Atividade" no modal do ticket com timeline

### 1.3 Anexos no ticket
- Bucket `ticket-attachments` já existe ✅
- Tabela `ticket_attachments` (ticket_id, file_path, file_name, size, uploaded_by)
- Upload via drag-and-drop no modal + preview de imagens
- RLS: quem vê o ticket vê os anexos

### 1.4 SLA por prioridade
- Configuração por org: prazo de resposta e resolução por prioridade (urgent/high/medium/low)
- Cálculo em runtime: `due_at = created_at + sla(priority)`
- Badge visual: 🟢 dentro do prazo / 🟡 perto / 🔴 estourado
- Filtro "SLA estourado" na Gestão TI

### 1.5 Labels customizáveis
- Tabela `ticket_labels` (org_id, name, color)
- Tabela junção `ticket_label_assignments`
- Multi-seleção no modal + filtro por label no Kanban

---

## Fase 2 — Documentação (inspirado no Notion)

### 2.1 Sub-páginas aninhadas
- Coluna `parent_id` já existe ✅ (não está sendo usada na UI)
- Sidebar com árvore expansível (recursão)
- Drag-and-drop para reordenar/aninhar
- Breadcrumbs no topo da página

### 2.2 Exportar página como `.md`
- Botão "Exportar" no header da página
- Download direto do conteúdo markdown
- Opção "exportar com sub-páginas" (zip)

### 2.3 Busca full-text no conteúdo
- Índice `tsvector` no campo `content` (português)
- Componente de busca global (⌘K já existe — estender)
- Highlight do trecho encontrado

### 2.4 Favoritos por usuário
- Tabela `doc_favorites` (user_id, page_id)
- Seção "⭐ Favoritos" no topo da sidebar
- Botão de estrela no header da página

### 2.5 Templates de página
- Tabela `doc_templates` (org_id, name, icon, content)
- Modal "Nova página a partir de template"
- Templates iniciais: Ata de reunião, PRD, Runbook, Onboarding

---

## Fase 3 — Mensagens (inspirado no Slack)

### 3.1 Reações emoji
- Tabela `message_reactions` (message_id, user_id, emoji)
- Picker simples (👍 ❤️ 😂 🎉 👀 ✅) + emoji-mart opcional
- Agrupamento por emoji com contador

### 3.2 Threads
- Coluna `parent_message_id` em `messages`
- Painel lateral ao clicar "Responder em thread"
- Contador de respostas no card da mensagem original

### 3.3 @menções com notificação
- Parser de `@nome` no compositor (autocomplete via membros da org)
- Ao enviar: cria `notification` para cada mencionado
- Highlight visual da menção na mensagem

### 3.4 Edição e exclusão da própria mensagem
- Hover → menu (editar / excluir)
- Marca "(editada)" + RLS garantindo `user_id = auth.uid()`

### 3.5 Upload de arquivos no chat
- Bucket `chat-attachments` já existe ✅
- Drag-and-drop no compositor
- Preview de imagens inline, outros tipos como link

---

## Ordem de execução proposta

```text
Fase 1 (Tickets)        ──►  2-3 entregas
  1.1 código + 1.2 atividade   (1 entrega)
  1.3 anexos                   (1 entrega)
  1.4 SLA + 1.5 labels         (1 entrega)

Fase 2 (Docs)           ──►  2-3 entregas
  2.1 sub-páginas + breadcrumbs  (1 entrega)
  2.2 export + 2.4 favoritos     (1 entrega)
  2.3 busca + 2.5 templates      (1 entrega)

Fase 3 (Mensagens)      ──►  2-3 entregas
  3.1 reações + 3.4 edit/del     (1 entrega)
  3.2 threads                    (1 entrega)
  3.3 menções + 3.5 anexos       (1 entrega)
```

---

## Detalhes técnicos

**Migrations:** todas via `supabase--migration` com RLS configurado por org/ownership.
**Realtime:** habilitar para `messages`, `message_reactions`, `ticket_activity` quando chegarmos lá.
**Notificações:** reusar `useNotifications` + `notify_user()` que já existe.
**Permissões:** seguir padrão atual — admin/director sempre, demais via membership.
**Testes:** rodar a suíte (`bunx vitest run`) após cada fase.

---

## Como vamos tocar

A cada "entrega" da tabela acima eu:
1. Faço as migrations necessárias
2. Implemento UI + hooks
3. Rodo os testes
4. Você valida no preview
5. Seguimos pra próxima

**Sugiro começar pela entrega 1.1 + 1.2 (código TI-001 + histórico de atividade)** — é o que mais muda a percepção de "ferramenta profissional" no dia-a-dia.

Topa? Ou quer reordenar algo?
