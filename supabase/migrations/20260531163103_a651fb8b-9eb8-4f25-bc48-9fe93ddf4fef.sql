UPDATE public.doc_pages SET content = $MANUAL$# Bem-vindo ao MOOUI

Manual oficial da plataforma. Use este guia para entender cada módulo e tirar o máximo do sistema.

## Visão geral

O MOOUI é a central de trabalho da empresa: projetos, comunicação, documentação, lançamentos, pedidos, salas e suporte — tudo em um só lugar, organizado por workspace.

Use a **barra lateral à esquerda** para navegar e o **seletor de workspace** no topo para alternar entre organizações (ex.: Brasil / Barcelona). Cada workspace tem seus próprios dados, membros e permissões.

Atalho global: **⌘K / Ctrl+K** abre a busca rápida para ir a qualquer tela.

---

## Colaboração

### 💬 Speaks — Mensagens
Comunicação interna por canais públicos, privados e mensagens diretas. Suporta reações, anexos, menções e notificações em tempo real.

### 📄 Papelinho — Documentação (esta área)
Base de conhecimento da empresa. Crie páginas com editor rico (títulos, listas, tabelas, imagens, checklists), organize por setor, defina permissões e importe arquivos `.md`. Cada módulo do sistema tem sua própria página de manual aqui.

### 🏢 Salas — Reservas
Agende salas de reunião com calendário visual, controle de conflitos e gestão das salas disponíveis (admin).

### 👥 Equipe
Diretório de pessoas: quem é quem, cargo, setor e contato. Ponto de partida para entender a estrutura da organização.

---

## Operações

### ☀️ Sunday — Projetos e tarefas
Gestão estilo Monday com múltiplas visões:
- **Tabela** — colunas customizáveis (status, prazo, responsáveis, etiquetas)
- **Kanban** — fluxo por status
- **Timeline / Gantt** — prazos e dependências
- **Checklists, anexos, comentários** em cada tarefa
- **Templates de projeto** para padronizar processos
- Carga de trabalho do time e sub-tarefas

### 📅 Calendário de Marketing
Calendário estratégico anual: campanhas, datas comemorativas, sazonalidades e eventos da marca.

### 🚀 Produção — Lançamentos
Coordenação de coleções e campanhas: etapas, anexos por estágio, atividade e responsáveis.

### ✅ Check Lançamentos
Checklists operacionais para validar que cada lançamento sai conforme o padrão.

### 📦 Pedidos
Acompanhamento de pedidos com problema: status, anexos, relatório consolidado e integração Shopify (rascunhos e checkouts abandonados).

### 🎫 Tickets de TI
Chamados internos: abertura por categoria, SLA, etiquetas, anexos e relatório. Use para dúvidas, bugs ou solicitações ao time de TI/operações.

### 📊 Timeline
Visão consolidada de prazos e marcos atravessando módulos.

---

## Configurações & permissões

Em **⚙️ Configurações** você gerencia:
- **Perfil** — nome, avatar, senha
- **Workspace** — nome, logo da organização
- **Setores & cargos** — estrutura organizacional
- **Membros & papéis** — convidar pessoas e definir Admin, Gestor ou Membro
- **Integrações** — Shopify e outros

Papéis:
- **Admin** — controle total do workspace
- **Gestor** — gerencia projetos e equipes do seu setor
- **Membro** — acessa e colabora conforme permissões

---

## Dicas rápidas

- **⌘K / Ctrl+K** — busca global
- **Tema claro/escuro** — alterne pelo menu do perfil
- **Notificações** — sino no topo direito mostra menções, atribuições e novidades
- **Multi-workspace** — sua conta pode participar de várias organizações; alterne pelo seletor no topo da barra lateral

## Precisa de ajuda?

Abra um chamado em **Tickets de TI** com a categoria adequada — o time responde por lá.
$MANUAL$,
updated_at = now()
WHERE title ILIKE '%Manual de Uso%';