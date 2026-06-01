UPDATE public.doc_pages SET content = '<h1>☀️ Sunday - Projetos e Tarefas</h1>
<p>Sunday é o módulo de gestão de projetos. Use para organizar trabalho em quadros, listas e sprints.</p>
<h2>Criar um projeto</h2>
<ol>
<li>Vá em <strong>Sunday</strong> na barra lateral</li>
<li>Clique em <strong>Novo projeto</strong></li>
<li>Dê um nome, cor e descrição</li>
<li>Você vira automaticamente o owner</li>
</ol>
<h2>Visualizações</h2>
<ul>
<li><strong>Tabela</strong>: visão completa estilo planilha, ideal para gerenciar muitos itens</li>
<li><strong>Kanban</strong>: arraste cards entre colunas (A fazer, Fazendo, Pronto)</li>
<li><strong>Sprints</strong>: organize tarefas em ciclos com data de início e fim</li>
</ul>
<h2>Trabalhando com tarefas</h2>
<ul>
<li>Clique em uma tarefa para abrir o painel lateral com detalhes</li>
<li>Adicione <strong>responsáveis</strong>, <strong>prazo</strong>, <strong>prioridade</strong>, <strong>checklists</strong> e <strong>anexos</strong></li>
<li>Comente para discutir com o time</li>
<li>O histórico registra todas as mudanças automaticamente</li>
</ul>
<h2>Colunas personalizadas</h2>
<p>Na visão Tabela, clique em <strong>+</strong> no cabeçalho para adicionar colunas (texto, número, data, status, pessoa, etc).</p>
<blockquote><p><strong>💡 Boas práticas</strong></p><ul>
<li>Um projeto por iniciativa, não por departamento</li>
<li>Use sprints semanais ou quinzenais</li>
<li>Mantenha colunas de status consistentes entre projetos</li>
</ul></blockquote>
', updated_at = now() WHERE id = '11571c76-0ba0-4268-bf3b-a8749962bdd5';

UPDATE public.doc_pages SET content = '<h1>⚙️ Configurações e Permissões</h1>
<h2>Meu Perfil</h2>
<p>Edite nome, email, foto, cargo e departamento.</p>
<h2>Organização (admin)</h2>
<p>Nome, slug, cor da organização.</p>
<h2>Departamentos e Cargos (admin)</h2>
<p>Crie e edite os departamentos (Marketing, TI, Vendas...) e cargos da empresa.</p>
<h2>Membros (admin)</h2>
<ul>
<li>Convidar novos membros</li>
<li>Atribuir papel na organização (Admin / Membro)</li>
<li>Resetar senha</li>
<li>Remover</li>
</ul>
<h2>Permissões (admin)</h2>
<p>Cada usuário tem dois papéis:</p>
<h3>Papel na organização</h3>
<ul>
<li><strong>Admin</strong> — gerencia membros, departamentos, cargos, canais, docs e configurações</li>
<li><strong>Membro</strong> — uso normal; só edita/exclui o que criou</li>
</ul>
<h3>Papel de aplicação</h3>
<ul>
<li><strong>Admin</strong> — acesso total, inclusive docs sigilosos. Reservado para diretoria/TI</li>
<li><strong>Diretor</strong> — liderança executiva, vê docs restritos, edita políticas</li>
<li><strong>Gerente</strong> — gerente de área, edita docs do time, modera canais</li>
<li><strong>Membro</strong> — padrão; lê/cria conteúdo público, só edita o próprio</li>
</ul>
<h3>Flag Suporte TI</h3>
<p>Marca quem atende tickets — pode resolver chamados de qualquer área. Independente do papel: alguém pode ser <strong>Membro</strong> no dia a dia e mesmo assim ter a flag para atuar como agente.</p>
<blockquote><p><strong>💡 Boas práticas</strong></p><ul>
<li>90% das pessoas devem ser <strong>Membro</strong></li>
<li>Promover a Admin é exceção</li>
<li>Para esconder conteúdo sensível, use o toggle <strong>Sigiloso</strong> em Papelinho em vez de criar novos papéis</li>
<li>Para conversas restritas, marque canais como <strong>Privados</strong> em vez de restringir por papel</li>
</ul></blockquote>
', updated_at = now() WHERE id = '4adde058-0dd4-4b31-9d47-e3736be88782';

UPDATE public.doc_pages SET content = '<h1>🎫 Tickets - Suporte e Chamados</h1>
<p>Use Tickets para qualquer pedido formal que precise ser registrado e acompanhado: bugs, hardware, acessos, dúvidas, melhorias.</p>
<h2>Abrir um ticket</h2>
<ol>
<li>Vá em <strong>Tickets</strong></li>
<li>Clique em <strong>Novo ticket</strong></li>
<li>Preencha:<ul>
<li><strong>Título</strong> curto e claro</li>
<li><strong>Descrição</strong> com passos para reproduzir, prints, contexto</li>
<li><strong>Categoria</strong> (bug, hardware, acesso, dúvida, melhoria, etc)</li>
<li><strong>Prioridade</strong> (baixa, média, alta, crítica)</li>
</ul>
</li>
</ol>
<p>O sistema gera um código automático (ex: TI-001).</p>
<h2>Status</h2>
<ul>
<li><strong>Aberto</strong> — recém-criado, aguardando triagem</li>
<li><strong>Em andamento</strong> — alguém está resolvendo</li>
<li><strong>Aguardando</strong> — esperando resposta sua ou de terceiro</li>
<li><strong>Resolvido</strong> — solução aplicada, validar</li>
<li><strong>Fechado</strong> — concluído</li>
</ul>
<h2>Atribuição</h2>
<p>Tickets podem ser atribuídos a qualquer membro com flag de <strong>Suporte TI</strong>. Esses são os agentes que aparecem na lista de responsáveis.</p>
<h2>Labels</h2>
<p>Use labels (urgente, bug, hardware...) para filtrar e priorizar.</p>
<h2>SLA</h2>
<p>A página do ticket mostra o tempo desde a abertura. Use como referência interna de tempo de resposta.</p>
<blockquote><p><strong>💡 Boas práticas</strong></p><ul>
<li>Um problema por ticket</li>
<li>Reabra ticket fechado se o problema voltar (não abra novo)</li>
<li>Comente sempre que mudar algo importante</li>
</ul></blockquote>
', updated_at = now() WHERE id = '78ea2948-1045-4da3-8d39-0b63dcfeb4e4';

UPDATE public.doc_pages SET content = '<h1>🏢 Salas de Reunião</h1>
<p>Reserve salas de reunião pelo sistema, evitando conflitos.</p>
<h2>Reservar</h2>
<ol>
<li>Vá em <strong>Salas</strong></li>
<li>Escolha a sala e o horário no calendário</li>
<li>Adicione título e descrição</li>
<li>Salve</li>
</ol>
<p>O sistema bloqueia automaticamente conflitos de horário.</p>
<h2>Gerenciar salas (admin)</h2>
<p>Admins podem criar/editar salas em <strong>Salas → Gerenciar</strong>: nome, capacidade, cor.</p>
<blockquote><p><strong>💡 Boas práticas</strong></p><ul>
<li>Reserve sempre, mesmo para reuniões rápidas</li>
<li>Libere a reserva se a reunião for cancelada</li>
<li>Use cores para tipos de sala (estratégica, criativa, etc)</li>
</ul></blockquote>
', updated_at = now() WHERE id = 'fa7ef033-504d-4b94-8df7-4610e9578c5f';

UPDATE public.doc_pages SET content = '<h1>👥 Equipe</h1>
<p>Diretório de pessoas da organização.</p>
<h2>O que você vê</h2>
<ul>
<li>Foto, nome, cargo, departamento e email</li>
<li>Botão de <strong>mensagem direta</strong> — abre Speaks já na DM com a pessoa</li>
<li>Filtros por departamento</li>
</ul>
<h2>Atualizar seus dados</h2>
<p>Vá em <strong>Configurações → Meu Perfil</strong> para alterar foto, nome, cargo e departamento.</p>
', updated_at = now() WHERE id = '0322b789-f35a-46c9-bb01-a79a0afcbb65';

UPDATE public.doc_pages SET content = '<h1>💬 Speaks - Mensagens</h1>
<p>Speaks é o canal de comunicação interna da empresa, estilo Slack.</p>
<h2>Canais</h2>
<ul>
<li><strong>Públicos</strong> — qualquer membro da organização pode entrar</li>
<li><strong>Privados</strong> — só por convite</li>
<li><strong>DMs (mensagens diretas)</strong> — conversa 1:1 com colegas</li>
</ul>
<h2>Como usar</h2>
<ol>
<li>Vá em <strong>Speaks</strong></li>
<li>Clique no <strong>+</strong> ao lado de &quot;Canais&quot; para criar um canal</li>
<li>Para mandar DM, vá em <strong>Equipe</strong> e clique no botão de mensagem ao lado do colega</li>
</ol>
<h2>Recursos</h2>
<ul>
<li><strong>Reações</strong> com emoji em qualquer mensagem</li>
<li><strong>Threads</strong>: responda diretamente a uma mensagem para manter o assunto organizado</li>
<li><strong>Anexos</strong>: arraste arquivos para a caixa de mensagem</li>
<li><strong>Menções</strong>: digite @ para chamar alguém (gera notificação)</li>
</ul>
<blockquote><p><strong>💡 Boas práticas</strong></p><ul>
<li>Canais por tema ou time, não por pessoa</li>
<li>Use threads para evitar poluir o canal principal</li>
<li>Marque canais como privados quando o assunto for sensível</li>
<li>Para conversas longas e estratégicas, prefira um doc em Papelinho</li>
</ul></blockquote>
', updated_at = now() WHERE id = 'ddfd2e19-4945-4080-a9b3-31179ace2094';

UPDATE public.doc_pages SET content = '<h1>📄 Papelinho - Documentação</h1>
<p>Papelinho é a base de conhecimento da empresa. Use para procedimentos, políticas, runbooks, onboarding, brand guidelines, etc.</p>
<h2>Criar uma página</h2>
<ol>
<li>Vá em <strong>Papelinho</strong></li>
<li>Clique em <strong>Nova página</strong> (pode usar um template pronto)</li>
<li>Dê título, ícone e escreva em Markdown</li>
</ol>
<h2>Hierarquia</h2>
<p>Páginas podem ter sub-páginas (clique no <strong>+</strong> ao lado do título na lista). Use para agrupar manuais relacionados.</p>
<h2>Favoritos</h2>
<p>Estrele páginas frequentes — elas aparecem no topo da lista.</p>
<h2>Páginas sigilosas</h2>
<p>Ao criar/editar, ative <strong>&quot;Sigiloso&quot;</strong> e escolha quem pode ver. Útil para:</p>
<ul>
<li>Políticas de salário</li>
<li>Planejamento estratégico</li>
<li>Documentos jurídicos</li>
</ul>
<h2>Permissões padrão</h2>
<ul>
<li><strong>Ver</strong>: todos os membros (a menos que seja sigiloso)</li>
<li><strong>Editar</strong>: admin, manager, member</li>
<li><strong>Excluir</strong>: só admin ou quem criou</li>
</ul>
<blockquote><p><strong>💡 Boas práticas</strong></p><ul>
<li>Um manual por tema, não páginas gigantes com tudo</li>
<li>Atualize a data ao revisar</li>
<li>Linke páginas relacionadas para virar wiki de verdade</li>
</ul></blockquote>
', updated_at = now() WHERE id = '1cbd443a-a134-4943-b913-3622f4bf7c4a';

UPDATE public.doc_pages SET content = '<h1>📅 Eventos Anuais</h1>
<p>Calendário estratégico do ano: lançamentos, Black Friday, feiras, datas comemorativas, inventário.</p>
<h2>Adicionar evento</h2>
<ol>
<li>Vá em <strong>Calendário</strong> / <strong>Eventos Anuais</strong></li>
<li>Clique no dia ou em <strong>Novo evento</strong></li>
<li>Defina título, categoria (lançamento, ação, evento, operacional), cor, data início e fim</li>
</ol>
<h2>Visualizações</h2>
<ul>
<li><strong>Mês</strong> — visão clássica</li>
<li><strong>Ano</strong> — visão estratégica de longo prazo</li>
</ul>
<blockquote><p><strong>💡 Boas práticas</strong></p><ul>
<li>Cadastre datas com pelo menos 60 dias de antecedência</li>
<li>Use categorias consistentes</li>
<li>Vincule a um lançamento quando aplicável</li>
</ul></blockquote>
', updated_at = now() WHERE id = '91eb7a7e-7466-4299-96c9-13a3dd8aa58f';

UPDATE public.doc_pages SET content = '<h1>📖 Manual de Uso - MOOUI</h1>
<p>Manual oficial da plataforma. Use este guia para entender cada módulo e tirar o máximo do sistema.</p>
<h2>Visão geral</h2>
<p>O MOOUI é a central de trabalho da empresa: projetos, comunicação, documentação, lançamentos, pedidos, salas e suporte — tudo em um só lugar, organizado por workspace.</p>
<p>Use a <strong>barra lateral à esquerda</strong> para navegar e o <strong>seletor de workspace</strong> no topo para alternar entre organizações (ex.: Brasil / Barcelona). Cada workspace tem seus próprios dados, membros e permissões.</p>
<p>Atalho global: <strong>⌘K / Ctrl+K</strong> abre a busca rápida para ir a qualquer tela.</p>
<hr>
<h2>Colaboração</h2>
<h3>💬 Speaks — Mensagens</h3>
<p>Comunicação interna por canais públicos, privados e mensagens diretas. Suporta reações, anexos, menções e notificações em tempo real.</p>
<h3>📄 Papelinho — Documentação (esta área)</h3>
<p>Base de conhecimento da empresa. Crie páginas com editor rico (títulos, listas, tabelas, imagens, checklists), organize por setor, defina permissões e importe arquivos <code>.md</code>. Cada módulo do sistema tem sua própria página de manual aqui.</p>
<h3>🏢 Salas — Reservas</h3>
<p>Agende salas de reunião com calendário visual, controle de conflitos e gestão das salas disponíveis (admin).</p>
<h3>👥 Equipe</h3>
<p>Diretório de pessoas: quem é quem, cargo, setor e contato. Ponto de partida para entender a estrutura da organização.</p>
<hr>
<h2>Operações</h2>
<h3>☀️ Sunday — Projetos e tarefas</h3>
<p>Gestão estilo Monday com múltiplas visões:</p>
<ul>
<li><strong>Tabela</strong> — colunas customizáveis (status, prazo, responsáveis, etiquetas)</li>
<li><strong>Kanban</strong> — fluxo por status</li>
<li><strong>Timeline / Gantt</strong> — prazos e dependências</li>
<li><strong>Checklists, anexos, comentários</strong> em cada tarefa</li>
<li><strong>Templates de projeto</strong> para padronizar processos</li>
<li>Carga de trabalho do time e sub-tarefas</li>
</ul>
<h3>📅 Calendário de Marketing</h3>
<p>Calendário estratégico anual: campanhas, datas comemorativas, sazonalidades e eventos da marca.</p>
<h3>🚀 Produção — Lançamentos</h3>
<p>Coordenação de coleções e campanhas: etapas, anexos por estágio, atividade e responsáveis.</p>
<h3>✅ Check Lançamentos</h3>
<p>Checklists operacionais para validar que cada lançamento sai conforme o padrão.</p>
<h3>📦 Pedidos</h3>
<p>Acompanhamento de pedidos com problema: status, anexos, relatório consolidado e integração Shopify (rascunhos e checkouts abandonados).</p>
<h3>🎫 Tickets de TI</h3>
<p>Chamados internos: abertura por categoria, SLA, etiquetas, anexos e relatório. Use para dúvidas, bugs ou solicitações ao time de TI/operações.</p>
<h3>📊 Timeline</h3>
<p>Visão consolidada de prazos e marcos atravessando módulos.</p>
<hr>
<h2>Configurações &amp; permissões</h2>
<p>Em <strong>⚙️ Configurações</strong> você gerencia:</p>
<ul>
<li><strong>Perfil</strong> — nome, avatar, senha</li>
<li><strong>Workspace</strong> — nome, logo da organização</li>
<li><strong>Setores &amp; cargos</strong> — estrutura organizacional</li>
<li><strong>Membros &amp; papéis</strong> — convidar pessoas e definir Admin, Gestor ou Membro</li>
<li><strong>Integrações</strong> — Shopify e outros</li>
</ul>
<p>Papéis:</p>
<ul>
<li><strong>Admin</strong> — controle total do workspace</li>
<li><strong>Gestor</strong> — gerencia projetos e equipes do seu setor</li>
<li><strong>Membro</strong> — acessa e colabora conforme permissões</li>
</ul>
<hr>
<h2>Dicas rápidas</h2>
<ul>
<li><strong>⌘K / Ctrl+K</strong> — busca global</li>
<li><strong>Tema claro/escuro</strong> — alterne pelo menu do perfil</li>
<li><strong>Notificações</strong> — sino no topo direito mostra menções, atribuições e novidades</li>
<li><strong>Multi-workspace</strong> — sua conta pode participar de várias organizações; alterne pelo seletor no topo da barra lateral</li>
</ul>
<h2>Precisa de ajuda?</h2>
<p>Abra um chamado em <strong>Tickets de TI</strong> com a categoria adequada — o time responde por lá.</p>
', updated_at = now() WHERE id = '2d0e038f-9747-4097-bfad-53559b5e84f2';

UPDATE public.doc_pages SET content = '<h1>📦 Pedidos</h1>
<p>Módulo para acompanhar pedidos com algum problema (devolução, troca, atraso, divergência, etc).</p>
<h2>Cadastrar um pedido</h2>
<ol>
<li>Vá em <strong>Pedidos</strong></li>
<li>Clique em <strong>Novo pedido</strong></li>
<li>Informe:<ul>
<li><strong>Pedido Shopify</strong> e/ou <strong>TOTVS</strong></li>
<li><strong>Nome do cliente</strong></li>
<li><strong>Tipo de problema</strong> (devolução, troca, etc)</li>
<li><strong>Origem</strong> (expedição, atendimento, loja)</li>
<li><strong>Prioridade</strong></li>
</ul>
</li>
</ol>
<p>O código (ex: PD-001) é gerado automaticamente.</p>
<h2>Fluxo</h2>
<p>Aberto → Em análise → Enviado / Concluído / Cancelado</p>
<p>Ao marcar como enviado/concluído/cancelado, a data de fechamento é registrada.</p>
<h2>Comentários e histórico</h2>
<p>Toda mudança fica registrada na aba de atividade. Use comentários para alinhar com o time de expedição.</p>
', updated_at = now() WHERE id = 'b5e60ec0-d81d-433b-b2c8-dc22a460eab3';

UPDATE public.doc_pages SET content = '<h1>🚀 Lançamentos</h1>
<p>Coordene lançamentos de coleções, campanhas e produtos com etapas e checklists.</p>
<h2>Criar lançamento</h2>
<ol>
<li>Vá em <strong>Lançamentos</strong></li>
<li><strong>Novo lançamento</strong> com nome, data de início e descrição</li>
<li>Adicione <strong>etapas</strong> (Briefing, Desenvolvimento, Aprovação, Produção, Marketing, Lançamento)</li>
<li>Defina duração e responsável por etapa</li>
</ol>
<h2>Checklists</h2>
<p>Crie checklists vinculados ao lançamento para itens de qualidade, peças, embalagem, etc. Use templates para repetir o padrão entre lançamentos.</p>
<h2>Status das etapas</h2>
<ul>
<li>Pendente → Em andamento → Concluída</li>
</ul>
<h2>Visão geral</h2>
<p>A timeline mostra todos os lançamentos do ano e a etapa atual de cada um.</p>
', updated_at = now() WHERE id = '952d513d-7946-45ca-9b41-3585191cac9a';

UPDATE public.doc_pages SET content = '<h1>Configurações e Permissões</h1>
<p># Configurações ## Meu Perfil Edite nome, email, foto, cargo e departamento. ## Organização (admin) Nome, slug, cor da organização. ## Departamentos e Cargos (admin) Crie e edite os departamentos (Marketing, TI, Vendas...) e cargos da empresa. ## Membros (admin) - Convidar novos membros - Atribuir papel na organização (Admin / Membro) - Resetar senha - Remover ## Permissões (admin) Cada usuário tem dois papéis: ### Papel na organização - **Admin** — gerencia membros, departamentos, cargos, canais, docs e configurações - **Membro** — uso normal; só edita/exclui o que criou ### Papel de aplicação - **Admin** — acesso total, inclusive docs sigilosos. Reservado para diretoria/TI - **Diretor** — liderança executiva, vê docs restritos, edita políticas - **Gerente** — gerente de área, edita docs do time, modera canais - **Membro** — padrão; lê/cria conteúdo público, só edita o próprio ### Flag Suporte TI Marca quem atende tickets — pode resolver chamados de qualquer área. Independente do papel: alguém pode ser **Membro** no dia a dia e mesmo assim ter a flag para atuar como agente. ## Boas práticas - 90% das pessoas devem ser **Membro** - Promover a Admin é exceção - Para esconder conteúdo sensível, use o toggle **Sigiloso** em Papelinho em vez de criar novos papéis - Para conversas restritas, marque canais como **Privados** em vez de restringir por papel</p><hr><hr><table style="min-width: 75px;"><colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><th colspan="1" rowspan="1"><table style="min-width: 75px;"><colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><th colspan="1" rowspan="1"><p></p></th><th colspan="1" rowspan="1"><p></p></th><th colspan="1" rowspan="1"><p></p></th></tr><tr><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td></tr><tr><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td></tr></tbody></table></th><th colspan="1" rowspan="1"><p></p></th><th colspan="1" rowspan="1"><p></p></th></tr><tr><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td></tr><tr><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td></tr></tbody></table>', updated_at = now() WHERE id = '54fa02bc-5bfe-4528-bee0-e1e7f052a43e';

UPDATE public.doc_pages SET content = '<h1>Equipe</h1>
<p>Diretório de pessoas da organização.</p>
<h2>O que você vê</h2>
<ul>
<li>Foto, nome, cargo, departamento e email</li>
<li>Botão de <strong>mensagem direta</strong> — abre Speaks já na DM com a pessoa</li>
<li>Filtros por departamento</li>
</ul>
<h2>Atualizar seus dados</h2>
<p>Vá em <strong>Configurações → Meu Perfil</strong> para alterar foto, nome, cargo e departamento.</p>
', updated_at = now() WHERE id = '2187d0c0-2143-4996-811c-02679ae40b8a';

UPDATE public.doc_pages SET content = '<h1>Eventos Anuais</h1>
<p>Calendário estratégico do ano: lançamentos, Black Friday, feiras, datas comemorativas, inventário.</p>
<h2>Adicionar evento</h2>
<ol>
<li>Vá em <strong>Calendário</strong> / <strong>Eventos Anuais</strong></li>
<li>Clique no dia ou em <strong>Novo evento</strong></li>
<li>Defina título, categoria (lançamento, ação, evento, operacional), cor, data início e fim</li>
</ol>
<h2>Visualizações</h2>
<ul>
<li><strong>Mês</strong> — visão clássica</li>
<li><strong>Ano</strong> — visão estratégica de longo prazo</li>
</ul>
<blockquote><p><strong>💡 Boas práticas</strong></p><ul>
<li>Cadastre datas com pelo menos 60 dias de antecedência</li>
<li>Use categorias consistentes</li>
<li>Vincule a um lançamento quando aplicável</li>
</ul></blockquote>
', updated_at = now() WHERE id = 'a2be262b-7c2a-451f-90fa-3b1ea6ea2773';

UPDATE public.doc_pages SET content = '<h1>Lançamentos</h1>
<p>Coordene lançamentos de coleções, campanhas e produtos com etapas e checklists.</p>
<h2>Criar lançamento</h2>
<ol>
<li>Vá em <strong>Lançamentos</strong></li>
<li><strong>Novo lançamento</strong> com nome, data de início e descrição</li>
<li>Adicione <strong>etapas</strong> (Briefing, Desenvolvimento, Aprovação, Produção, Marketing, Lançamento)</li>
<li>Defina duração e responsável por etapa</li>
</ol>
<h2>Checklists</h2>
<p>Crie checklists vinculados ao lançamento para itens de qualidade, peças, embalagem, etc. Use templates para repetir o padrão entre lançamentos.</p>
<h2>Status das etapas</h2>
<ul>
<li>Pendente → Em andamento → Concluída</li>
</ul>
<h2>Visão geral</h2>
<p>A timeline mostra todos os lançamentos do ano e a etapa atual de cada um.</p>
', updated_at = now() WHERE id = 'a2fcb405-598d-4c23-be0a-5fabd4194502';

UPDATE public.doc_pages SET content = '<h1>Manual de Uso - MOOUI</h1>
<p>Manual oficial da plataforma. Use este guia para entender cada módulo e tirar o máximo do sistema.</p>
<h2>Visão geral</h2>
<p>O MOOUI é a central de trabalho da empresa: projetos, comunicação, documentação, lançamentos, pedidos, salas e suporte — tudo em um só lugar, organizado por workspace.</p>
<p>Use a <strong>barra lateral à esquerda</strong> para navegar e o <strong>seletor de workspace</strong> no topo para alternar entre organizações (ex.: Brasil / Barcelona). Cada workspace tem seus próprios dados, membros e permissões.</p>
<p>Atalho global: <strong>⌘K / Ctrl+K</strong> abre a busca rápida para ir a qualquer tela.</p>
<hr>
<h2>Colaboração</h2>
<h3>💬 Speaks — Mensagens</h3>
<p>Comunicação interna por canais públicos, privados e mensagens diretas. Suporta reações, anexos, menções e notificações em tempo real.</p>
<h3>📄 Papelinho — Documentação (esta área)</h3>
<p>Base de conhecimento da empresa. Crie páginas com editor rico (títulos, listas, tabelas, imagens, checklists), organize por setor, defina permissões e importe arquivos <code>.md</code>. Cada módulo do sistema tem sua própria página de manual aqui.</p>
<h3>🏢 Salas — Reservas</h3>
<p>Agende salas de reunião com calendário visual, controle de conflitos e gestão das salas disponíveis (admin).</p>
<h3>👥 Equipe</h3>
<p>Diretório de pessoas: quem é quem, cargo, setor e contato. Ponto de partida para entender a estrutura da organização.</p>
<hr>
<h2>Operações</h2>
<h3>☀️ Sunday — Projetos e tarefas</h3>
<p>Gestão estilo Monday com múltiplas visões:</p>
<ul>
<li><strong>Tabela</strong> — colunas customizáveis (status, prazo, responsáveis, etiquetas)</li>
<li><strong>Kanban</strong> — fluxo por status</li>
<li><strong>Timeline / Gantt</strong> — prazos e dependências</li>
<li><strong>Checklists, anexos, comentários</strong> em cada tarefa</li>
<li><strong>Templates de projeto</strong> para padronizar processos</li>
<li>Carga de trabalho do time e sub-tarefas</li>
</ul>
<h3>📅 Calendário de Marketing</h3>
<p>Calendário estratégico anual: campanhas, datas comemorativas, sazonalidades e eventos da marca.</p>
<h3>🚀 Produção — Lançamentos</h3>
<p>Coordenação de coleções e campanhas: etapas, anexos por estágio, atividade e responsáveis.</p>
<h3>✅ Check Lançamentos</h3>
<p>Checklists operacionais para validar que cada lançamento sai conforme o padrão.</p>
<h3>📦 Pedidos</h3>
<p>Acompanhamento de pedidos com problema: status, anexos, relatório consolidado e integração Shopify (rascunhos e checkouts abandonados).</p>
<h3>🎫 Tickets de TI</h3>
<p>Chamados internos: abertura por categoria, SLA, etiquetas, anexos e relatório. Use para dúvidas, bugs ou solicitações ao time de TI/operações.</p>
<h3>📊 Timeline</h3>
<p>Visão consolidada de prazos e marcos atravessando módulos.</p>
<hr>
<h2>Configurações &amp; permissões</h2>
<p>Em <strong>⚙️ Configurações</strong> você gerencia:</p>
<ul>
<li><strong>Perfil</strong> — nome, avatar, senha</li>
<li><strong>Workspace</strong> — nome, logo da organização</li>
<li><strong>Setores &amp; cargos</strong> — estrutura organizacional</li>
<li><strong>Membros &amp; papéis</strong> — convidar pessoas e definir Admin, Gestor ou Membro</li>
<li><strong>Integrações</strong> — Shopify e outros</li>
</ul>
<p>Papéis:</p>
<ul>
<li><strong>Admin</strong> — controle total do workspace</li>
<li><strong>Gestor</strong> — gerencia projetos e equipes do seu setor</li>
<li><strong>Membro</strong> — acessa e colabora conforme permissões</li>
</ul>
<hr>
<h2>Dicas rápidas</h2>
<ul>
<li><strong>⌘K / Ctrl+K</strong> — busca global</li>
<li><strong>Tema claro/escuro</strong> — alterne pelo menu do perfil</li>
<li><strong>Notificações</strong> — sino no topo direito mostra menções, atribuições e novidades</li>
<li><strong>Multi-workspace</strong> — sua conta pode participar de várias organizações; alterne pelo seletor no topo da barra lateral</li>
</ul>
<h2>Precisa de ajuda?</h2>
<p>Abra um chamado em <strong>Tickets de TI</strong> com a categoria adequada — o time responde por lá.</p>
', updated_at = now() WHERE id = 'b3278ffa-207e-4945-afc8-35404ea94acd';

UPDATE public.doc_pages SET content = '<h1>Papelinho - Documentação</h1>
<p>Papelinho é a base de conhecimento da empresa. Use para procedimentos, políticas, runbooks, onboarding, brand guidelines, etc.</p>
<h2>Criar uma página</h2>
<ol>
<li>Vá em <strong>Papelinho</strong></li>
<li>Clique em <strong>Nova página</strong> (pode usar um template pronto)</li>
<li>Dê título, ícone e escreva em Markdown</li>
</ol>
<h2>Hierarquia</h2>
<p>Páginas podem ter sub-páginas (clique no <strong>+</strong> ao lado do título na lista). Use para agrupar manuais relacionados.</p>
<h2>Favoritos</h2>
<p>Estrele páginas frequentes — elas aparecem no topo da lista.</p>
<h2>Páginas sigilosas</h2>
<p>Ao criar/editar, ative <strong>&quot;Sigiloso&quot;</strong> e escolha quem pode ver. Útil para:</p>
<ul>
<li>Políticas de salário</li>
<li>Planejamento estratégico</li>
<li>Documentos jurídicos</li>
</ul>
<h2>Permissões padrão</h2>
<ul>
<li><strong>Ver</strong>: todos os membros (a menos que seja sigiloso)</li>
<li><strong>Editar</strong>: admin, manager, member</li>
<li><strong>Excluir</strong>: só admin ou quem criou</li>
</ul>
<blockquote><p><strong>💡 Boas práticas</strong></p><ul>
<li>Um manual por tema, não páginas gigantes com tudo</li>
<li>Atualize a data ao revisar</li>
<li>Linke páginas relacionadas para virar wiki de verdade</li>
</ul></blockquote>
', updated_at = now() WHERE id = '046b9889-5c68-407b-a833-61a065d8eee8';

UPDATE public.doc_pages SET content = '<h1>Pedidos</h1>
<p># Pedidos Módulo para acompanhar pedidos com algum problema (devolução, troca, atraso, divergência, etc). ## Cadastrar um pedido 1. Vá em **Pedidos** 2. Clique em **Novo pedido** 3. Informe: - **Pedido Shopify** e/ou **TOTVS** - **Nome do cliente** - **Tipo de problema** (devolução, troca, etc) - **Origem** (expedição, atendimento, loja) - **Prioridade** O código (ex: PD-001) é gerado automaticamente. ## Fluxo Aberto → Em análise → Enviado / Concluído / Cancelado Ao marcar como enviado/concluído/cancelado, a data de fechamento é registrada. ## Comentários e histórico Toda mudança fica registrada na aba de atividade. Use comentários para alinhar com o time de expedição.</p>', updated_at = now() WHERE id = '49ddb908-d2b1-42dd-a194-e3f35f30004a';

UPDATE public.doc_pages SET content = '<h1>Salas de Reunião</h1>
<p>Reserve salas de reunião pelo sistema, evitando conflitos.</p>
<h2>Reservar</h2>
<ol>
<li>Vá em <strong>Salas</strong></li>
<li>Escolha a sala e o horário no calendário</li>
<li>Adicione título e descrição</li>
<li>Salve</li>
</ol>
<p>O sistema bloqueia automaticamente conflitos de horário.</p>
<h2>Gerenciar salas (admin)</h2>
<p>Admins podem criar/editar salas em <strong>Salas → Gerenciar</strong>: nome, capacidade, cor.</p>
<blockquote><p><strong>💡 Boas práticas</strong></p><ul>
<li>Reserve sempre, mesmo para reuniões rápidas</li>
<li>Libere a reserva se a reunião for cancelada</li>
<li>Use cores para tipos de sala (estratégica, criativa, etc)</li>
</ul></blockquote>
', updated_at = now() WHERE id = 'd29e9ffe-15f4-46a6-97a6-fddfc05b568a';

UPDATE public.doc_pages SET content = '<h1>Speaks - Mensagens</h1>
<p>Speaks é o canal de comunicação interna da empresa, estilo Slack.</p>
<h2>Canais</h2>
<ul>
<li><strong>Públicos</strong> — qualquer membro da organização pode entrar</li>
<li><strong>Privados</strong> — só por convite</li>
<li><strong>DMs (mensagens diretas)</strong> — conversa 1:1 com colegas</li>
</ul>
<h2>Como usar</h2>
<ol>
<li>Vá em <strong>Speaks</strong></li>
<li>Clique no <strong>+</strong> ao lado de &quot;Canais&quot; para criar um canal</li>
<li>Para mandar DM, vá em <strong>Equipe</strong> e clique no botão de mensagem ao lado do colega</li>
</ol>
<h2>Recursos</h2>
<ul>
<li><strong>Reações</strong> com emoji em qualquer mensagem</li>
<li><strong>Threads</strong>: responda diretamente a uma mensagem para manter o assunto organizado</li>
<li><strong>Anexos</strong>: arraste arquivos para a caixa de mensagem</li>
<li><strong>Menções</strong>: digite @ para chamar alguém (gera notificação)</li>
</ul>
<blockquote><p><strong>💡 Boas práticas</strong></p><ul>
<li>Canais por tema ou time, não por pessoa</li>
<li>Use threads para evitar poluir o canal principal</li>
<li>Marque canais como privados quando o assunto for sensível</li>
<li>Para conversas longas e estratégicas, prefira um doc em Papelinho</li>
</ul></blockquote>
', updated_at = now() WHERE id = 'd9177f13-0971-49ee-8cd8-d92ff1d623ce';

UPDATE public.doc_pages SET content = '<h1>Sunday - Projetos e Tarefas</h1>
<p># Sunday Sunday é o módulo de gestão de projetos. Use para organizar trabalho em quadros, listas e sprints. ## Criar um projeto 1. Vá em **Sunday** na barra lateral 2. Clique em **Novo projeto** 3. Dê um nome, cor e descrição 4. Você vira automaticamente o owner ## Visualizações - **Tabela**: visão completa estilo planilha, ideal para gerenciar muitos itens - **Kanban**: arraste cards entre colunas (A fazer, Fazendo, Pronto) - **Sprints**: organize tarefas em ciclos com data de início e fim ## Trabalhando com tarefas - Clique em uma tarefa para abrir o painel lateral com detalhes - Adicione **responsáveis**, **prazo**, **prioridade**, **checklists** e **anexos** - Comente para discutir com o time - O histórico registra todas as mudanças automaticamente ## Colunas personalizadas Na visão Tabela, clique em **+** no cabeçalho para adicionar colunas (texto, número, data, status, pessoa, etc). ## Boas práticas - Um projeto por iniciativa, não por departamento - Use sprints semanais ou quinzenais - Mantenha colunas de status consistentes entre projetos</p>', updated_at = now() WHERE id = '3e4c0b02-b2c3-4146-847a-47c5a4766c95';

UPDATE public.doc_pages SET content = '<h1>Tickets - Suporte e Chamados</h1>
<p>Use Tickets para qualquer pedido formal que precise ser registrado e acompanhado: bugs, hardware, acessos, dúvidas, melhorias.</p>
<h2>Abrir um ticket</h2>
<ol>
<li>Vá em <strong>Tickets</strong></li>
<li>Clique em <strong>Novo ticket</strong></li>
<li>Preencha:<ul>
<li><strong>Título</strong> curto e claro</li>
<li><strong>Descrição</strong> com passos para reproduzir, prints, contexto</li>
<li><strong>Categoria</strong> (bug, hardware, acesso, dúvida, melhoria, etc)</li>
<li><strong>Prioridade</strong> (baixa, média, alta, crítica)</li>
</ul>
</li>
</ol>
<p>O sistema gera um código automático (ex: TI-001).</p>
<h2>Status</h2>
<ul>
<li><strong>Aberto</strong> — recém-criado, aguardando triagem</li>
<li><strong>Em andamento</strong> — alguém está resolvendo</li>
<li><strong>Aguardando</strong> — esperando resposta sua ou de terceiro</li>
<li><strong>Resolvido</strong> — solução aplicada, validar</li>
<li><strong>Fechado</strong> — concluído</li>
</ul>
<h2>Atribuição</h2>
<p>Tickets podem ser atribuídos a qualquer membro com flag de <strong>Suporte TI</strong>. Esses são os agentes que aparecem na lista de responsáveis.</p>
<h2>Labels</h2>
<p>Use labels (urgente, bug, hardware...) para filtrar e priorizar.</p>
<h2>SLA</h2>
<p>A página do ticket mostra o tempo desde a abertura. Use como referência interna de tempo de resposta.</p>
<blockquote><p><strong>💡 Boas práticas</strong></p><ul>
<li>Um problema por ticket</li>
<li>Reabra ticket fechado se o problema voltar (não abra novo)</li>
<li>Comente sempre que mudar algo importante</li>
</ul></blockquote>
', updated_at = now() WHERE id = 'a6eb57a5-1245-4e05-8d2a-3c264121f1e2';