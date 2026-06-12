/**
 * Seed a Papelinho doc page with the "Como criar um board" guide (5.4).
 *
 * Dry-run:
 *   node scripts/seed-board-guide-doc.mjs
 *
 * Write:
 *   node scripts/seed-board-guide-doc.mjs --yes
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BASE_URL = 'https://rckglywohrywurknephc.supabase.co';
const ORG_ID = '0d32934f-9628-4bd5-b3f4-1bc74f9227de';
const WRITE = process.argv.includes('--yes');

let ANON_KEY = '';
let TOKEN = '';
let USER_ID = '';

async function loadAuth() {
  for (const file of ['.auth2.json', '.auth_response.json']) {
    try {
      const json = JSON.parse(await fs.readFile(path.join(ROOT, 'generated', file), 'utf8'));
      const session = json.session || json;
      if (session.access_token && (session.user?.id || json.user?.id)) {
        return {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          user: session.user || json.user,
        };
      }
    } catch { /* try next */ }
  }
  throw new Error('Missing generated/.auth2.json or generated/.auth_response.json');
}

async function refreshAuth(auth) {
  if (!auth.refresh_token) return auth;
  const response = await fetch(`${BASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: auth.refresh_token }),
  });
  if (!response.ok) return auth;
  const refreshed = await response.json();
  return {
    access_token: refreshed.access_token || auth.access_token,
    refresh_token: refreshed.refresh_token || auth.refresh_token,
    user: refreshed.user || auth.user,
  };
}

async function loadAnonKey() {
  const envText = await fs.readFile(path.join(ROOT, '.env'), 'utf8');
  const key = /VITE_SUPABASE_PUBLISHABLE_KEY="?([^"\r\n]+)"?/.exec(envText)?.[1];
  if (!key) throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  return key;
}

async function rest(table, query = '', options = {}) {
  const url = `${BASE_URL}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const headers = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${options.method || 'GET'} ${table} failed ${response.status}: ${text}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const GUIDE_TITLE = 'Como criar um board no Sunday';
const GUIDE_ICON = '📋';

const GUIDE_CONTENT = `# Como criar um board no Sunday

Este guia explica como criar e configurar um novo board no sistema Sunday do MOOUI Collab Hub.

---

## 1. Acesse o Sunday

Navegue até **Sunday** no menu lateral (seção Ferramentas) ou use **Ctrl+K** e busque "Sunday".

## 2. Crie o projeto

1. No painel lateral esquerdo, clique no botão **+** ao lado de "Projetos"
2. Digite o nome do board (ex: "Planejamento Q3 2026")
3. Clique em **Criar**

O board será criado com as colunas padrão (Status, Prioridade, Data, Responsável).

## 3. Configure as colunas

Cada board pode ter colunas personalizadas. Para adicionar:

1. Na visualização **Tabela**, clique no botão **+ Coluna** no canto direito do cabeçalho
2. Escolha o nome e o tipo da coluna

### Tipos de coluna disponíveis

| Tipo | Descrição | Exemplo de uso |
|------|-----------|----------------|
| **Texto** | Campo de texto livre | Observações, links, notas |
| **Número** | Valor numérico | Quantidade, preço, % |
| **Data** | Seletor de data | Prazo, data de entrega |
| **Status** | Dropdown com cores | Em andamento, Concluído, Pendente |
| **Select** | Dropdown simples | Categoria, tipo, prioridade |
| **Tags** | Múltiplas etiquetas | Departamentos, habilidades |
| **Pessoa** | Atribuir responsável | Dono da tarefa |
| **Checkbox** | Sim/Não | Aprovado, revisado |
| **Rating** | Estrelas (1-5) | Prioridade, dificuldade |
| **Link** | URL clicável | Referência externa |
| **Cronograma** | Período (início → fim) | Sprint, fase |

### Editar opções de Select/Status/Tags

1. Clique no menu **⋮** no cabeçalho da coluna
2. Selecione **Editar opções**
3. Digite uma opção por linha
4. Clique em **Confirmar**

### Mostrar coluna nos cards do Kanban

1. Clique no menu **⋮** no cabeçalho da coluna
2. Ative **Mostrar no card**

A coluna aparecerá nos cards da visualização Kanban.

## 4. Adicione tarefas

- Na tabela: clique na linha vazia no final e digite o título
- No Kanban: clique em **+ Adicionar** dentro de qualquer coluna de status

### Subtarefas

Clique em uma tarefa para abrir o detalhe, depois use **+ Subtarefa** para criar tarefas filhas.

## 5. Visualizações

Cada board tem 4 visualizações, acessíveis pelas abas no topo:

- **Tabela** — visão completa com todas as colunas (como uma planilha)
- **Kanban** — cards organizados por status (arrastar para mover)
- **Timeline** — barras de Gantt por data
- **Calendário** — tarefas no calendário por data de entrega

## 6. Filtros e busca

Use a barra de filtros acima da tabela/kanban para:
- Filtrar por **status**, **responsável**, **prioridade**
- Buscar por **título** da tarefa

## 7. Grupos

Use grupos para organizar tarefas em seções dentro do board:
- Crie grupos pelo seletor de grupo no topo
- Arraste tarefas entre grupos
- Cada grupo pode ser colapsado/expandido

---

## Dicas

- **Nomenclatura de boards de setor:** se o board pertence a um setor específico, use o padrão \`Modulo | NomeDoSetor | NomeDoBoard\`
- **Responsáveis:** sempre atribua pelo menos um responsável por tarefa
- **Prazos:** tarefas com data aparecem automaticamente na Timeline e no Calendário
- **Arquivamento:** tarefas concluídas podem ser arquivadas (não deletadas) para manter o histórico

---

*Última atualização: Junho 2026*
`;

async function main() {
  ANON_KEY = await loadAnonKey();
  const auth = await refreshAuth(await loadAuth());
  TOKEN = auth.access_token;
  USER_ID = auth.user.id;

  // Check if doc already exists
  const existing = await rest('doc_pages', `select=id,title&organization_id=eq.${ORG_ID}&title=eq.${encodeURIComponent(GUIDE_TITLE)}`);
  if (existing && existing.length > 0) {
    console.log(`Doc already exists: "${GUIDE_TITLE}" (id: ${existing[0].id})`);
    return;
  }

  if (!WRITE) {
    console.log(`DRY-RUN: Would create doc page "${GUIDE_TITLE}" with ${GUIDE_CONTENT.length} chars of content.`);
    console.log('Re-run with --yes to create.');
    return;
  }

  const [doc] = await rest('doc_pages', '', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      organization_id: ORG_ID,
      title: GUIDE_TITLE,
      icon: GUIDE_ICON,
      content: GUIDE_CONTENT,
      position: 0,
      created_by: USER_ID,
      can_edit_roles: ['admin', 'manager'],
      can_delete_roles: ['admin'],
    }),
  });

  console.log(`Created doc page: "${doc.title}" (id: ${doc.id})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
