import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Plus, Search as SearchIcon, X, Calendar as CalendarIcon, List, Clock, Trash2, Send,
  ChevronDown, ChevronRight, Mail, FileText, CheckCircle2, Paperclip, Image as ImageIcon,
  Video, ExternalLink, MessageCircle, Columns3,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  useConteudoItems, useCreateConteudo, useUpdateConteudo, useDeleteConteudo,
  useConteudoActivity, useConteudoComments, useAddConteudoComment, useConteudoAttachments, useConteudoChecklist,
  useConteudoChecklistForItems,
  useCreateConteudoChecklistItem, useUpdateConteudoChecklistItem, useDeleteConteudoChecklistItem,
  useProgramacaoWorkspaces, useCreateProgramacaoWorkspace,
  type ConteudoItem, type ConteudoStatus, type ConteudoChannel, type ConteudoType,
  type ConteudoChecklistItem, type ConteudoChecklistStatus, type ProgramacaoWorkspace,
} from '@/hooks/useConteudo';
import {
  useNewsletters, useCreateNewsletter, useUpdateNewsletter, useDeleteNewsletter,
  useNewsletterComments, useAddNewsletterComment, useNewsletterActivity,
  type Newsletter, type NewsletterStatus, type NewsletterChannel,
} from '@/hooks/useNewsletters';
import {
  usePautas, usePautaItems, useCreatePauta, useUpdatePauta, useDeletePauta,
  useCreatePautaItem, useUpdatePautaItem, useDeletePautaItem,
  usePautaComments, useAddPautaComment, usePautaActivity,
  type Pauta, type PautaStatus, type PautaPriority, type PautaItem,
} from '@/hooks/usePautas';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useCreateProject, useProjectsByOrg } from '@/hooks/useProjectData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';
import { LinkedItems } from '@/components/LinkedItems';
import { ContentCalendar } from '@/components/conteudo/ContentCalendar';
import { SpreadsheetFields } from '@/components/SpreadsheetFields';
import TableViewPage from './TableViewPage';

/* ================================================================ */
/* Labels & Colors                                                   */
/* ================================================================ */

const channelLabels: Record<ConteudoChannel, string> = {
  mooui_kids: 'MOOUI Kids', mooui_home: 'MOOUI Home', amo_mooui: 'Amo MOOUI',
  barcelona: 'Barcelona', outras_redes: 'Outras Redes', pinterest: 'Pinterest',
};
const channelOrder: ConteudoChannel[] = ['mooui_kids', 'mooui_home', 'amo_mooui', 'barcelona', 'outras_redes', 'pinterest'];
const channelColors: Record<ConteudoChannel, string> = {
  mooui_kids: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
  mooui_home: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  amo_mooui: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  barcelona: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  outras_redes: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  pinterest: 'bg-red-600/15 text-red-700 dark:text-red-300',
};
const statusLabels: Record<ConteudoStatus, string> = {
  nao_iniciado: 'Não iniciado', em_andamento: 'Em andamento', em_revisao: 'Em revisão',
  aprovado: 'Aprovado', publicado: 'Publicado',
};
const statusColors: Record<ConteudoStatus, string> = {
  nao_iniciado: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  em_andamento: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  em_revisao: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  aprovado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  publicado: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
};
const typeLabels: Record<ConteudoType, string> = {
  foto: 'Foto', video: 'Vídeo', carrossel: 'Carrossel', reels: 'Reels', stories: 'Stories',
};
const nlStatusLabels: Record<NewsletterStatus, string> = {
  nao_iniciado: 'Não iniciado', em_andamento: 'Em andamento', enviado: 'Enviado',
};
const nlStatusColors: Record<NewsletterStatus, string> = {
  nao_iniciado: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  em_andamento: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  enviado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};
const nlChannelLabels: Record<string, string> = { brasil: 'Brasil', barcelona: 'Barcelona' };
const nlChannelOrder = ['brasil', 'barcelona'];
function newsletterChannelLabel(channel: NewsletterChannel) {
  return nlChannelLabels[channel] || channel;
}
const pautaStatusLabels: Record<PautaStatus, string> = {
  pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída',
};
const pautaStatusColors: Record<PautaStatus, string> = {
  pendente: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  em_andamento: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  concluida: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};
const pautaPriorityLabels: Record<PautaPriority, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' };
const pautaPriorityColors: Record<PautaPriority, string> = {
  low: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  medium: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  high: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
};
const pautaItemStatusLabels: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
};
const pautaItemStatusColors: Record<string, string> = {
  pendente: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  em_andamento: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  concluido: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};
const conteudoChecklistStatusLabels: Record<ConteudoChecklistStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluido: 'Concluido',
};
const conteudoChecklistStatusColors: Record<ConteudoChecklistStatus, string> = {
  pendente: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  em_andamento: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  concluido: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};
const channelAccentColors: Record<ConteudoChannel, string> = {
  mooui_kids: '#EC4899',
  mooui_home: '#F59E0B',
  amo_mooui: '#F43F5E',
  barcelona: '#3B82F6',
  outras_redes: '#64748B',
  pinterest: '#DC2626',
};

function spreadsheetGroup(fields?: Record<string, unknown> | null) {
  const group = fields?.['Grupo Monday'];
  return typeof group === 'string' && group.trim() ? group.trim() : 'Sem grupo';
}

function normalizedKey(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function findSundayProject(projects: any[] | undefined, aliases: Array<string | undefined | null>) {
  const keys = aliases.filter(Boolean).map((alias) => normalizedKey(alias));
  return (projects || []).find((project) => {
    const projectKey = normalizedKey(project.name);
    return keys.some((key) => key && (projectKey.includes(key) || key.includes(projectKey)));
  });
}

function programacaoWorkspaceName(item: ConteudoItem) {
  const custom = sheetField(item.custom_fields, 'Workspace Programacao', 'Workspace', 'Marca', 'Rede', 'Canal');
  return custom || channelLabels[item.channel] || item.channel;
}

function workspaceMatchesItem(workspace: ProgramacaoWorkspaceView, item: ConteudoItem) {
  if (workspace.channel && item.channel === workspace.channel) return true;
  const workspaceKey = normalizedKey(workspace.name);
  return normalizedKey(programacaoWorkspaceName(item)) === workspaceKey
    || normalizedKey(channelLabels[item.channel]) === workspaceKey
    || normalizedKey(item.channel) === workspaceKey;
}

function buildGroupStats<T extends { custom_fields?: Record<string, unknown> | null }>(items: T[]) {
  const map = new Map<string, number>();
  items.forEach((item) => {
    const group = spreadsheetGroup(item.custom_fields);
    map.set(group, (map.get(group) || 0) + 1);
  });
  return [...map.entries()]
    .map(([group, total]) => ({ group, total }))
    .sort((a, b) => a.group.localeCompare(b.group, 'pt-BR'));
}

function sheetValue(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function sheetField(fields: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!fields) return '';
  for (const key of keys) {
    const direct = fields[key];
    if (direct != null && String(direct).trim()) return sheetValue(direct);
    const found = Object.entries(fields).find(([fieldKey, value]) => {
      if (value == null || !String(value).trim()) return false;
      return fieldKey
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '') === key
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
    });
    if (found) return sheetValue(found[1]);
  }
  return '';
}

const programacaoFixedColumns = new Set([
  'name',
  'grupomonday',
  'pessoas',
  'pessoa',
  'responsavel',
  'responsaveis',
  'data',
  'date',
  'status',
  'horario',
  'foto/video',
  'fotovideo',
  'novo/repost',
  'novorepost',
  'tipo',
]);

function dynamicProgramacaoColumns(items: Array<{ custom_fields?: Record<string, unknown> | null }>) {
  return sheetColumns(items).filter((column) => {
    const normalized = column
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9/]+/g, '');
    return !programacaoFixedColumns.has(normalized);
  });
}

function splitProgramacaoTitle(value: string) {
  const parts = value.split(/\s+\|\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return { name: parts[0], subelement: parts.slice(1).join(' | ') };
}

function programacaoNameCell(item: ConteudoItem) {
  const explicit = sheetField(item.custom_fields, 'Name');
  const split = splitProgramacaoTitle(explicit || item.title);
  return split?.name || explicit || item.content_category || item.title;
}

function programacaoSubelementCell(item: ConteudoItem) {
  const explicit = sheetField(item.custom_fields, 'Subelementos', 'Subitems');
  const split = splitProgramacaoTitle(explicit || item.title);
  return explicit || split?.subelement || item.title;
}

function programacaoElementLabel(item: ConteudoItem) {
  const name = programacaoNameCell(item);
  const subelement = programacaoSubelementCell(item);
  if (!subelement || normalizedKey(name) === normalizedKey(subelement)) return name;
  return `${name} | ${subelement}`;
}

function programacaoMonthGroup(item: ConteudoItem) {
  if (!item.scheduled_date) return 'SEM DATA';
  const date = new Date(`${item.scheduled_date}T12:00:00`);
  return format(date, 'MMMM - yyyy', { locale: ptBR }).toUpperCase();
}

function programacaoMonthSortKey(item: ConteudoItem) {
  return item.scheduled_date ? item.scheduled_date.slice(0, 7) : '9999-99';
}

function programacaoDateAction(item: ConteudoItem) {
  const raw = sheetField(item.custom_fields, 'Data') || item.scheduled_date;
  if (!raw) return '';
  const date = /^\d{4}-\d{2}-\d{2}/.test(raw) ? new Date(`${raw.slice(0, 10)}T12:00:00`) : new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return `Ate ${format(date, 'd MMM', { locale: ptBR })}`;
}

function programacaoPriority(item: ConteudoItem) {
  return sheetField(item.custom_fields, 'Prioridade', 'Priority') || 'Media';
}

function programacaoResponsible(item: ConteudoItem) {
  return sheetField(item.custom_fields, 'Pessoas', 'Pessoa', 'Responsavel', 'Responsaveis') || '';
}

function programacaoOpenedAt(item: ConteudoItem) {
  return format(new Date(item.created_at), 'MMM d', { locale: ptBR }).replace('.', '');
}

const programacaoSundayBoardTitles: Record<ConteudoChannel, string> = {
  mooui_kids: 'Excel | programacao mooui kids (1780430295)',
  mooui_home: 'Excel | programacao mooui home (1780430305)',
  amo_mooui: 'Excel | programacao amo mooui (1780430275)',
  barcelona: 'Excel | programacao mooui barcelona (1780430285)',
  outras_redes: 'Excel | programacao outras redes (1780430314)',
  pinterest: 'Excel | programacao pinterest',
};

const newsletterSundayBoardTitles: Record<string, string> = {
  brasil: 'Excel | newsletter mooui brasil (1780430246)',
  barcelona: 'Excel | newsletter barcelona (1780430265)',
};

const pautaFixedColumns = new Set([
  'grupomonday',
  'pessoas',
  'pessoa',
  'responsavel',
  'responsaveis',
  'data',
  'date',
  'status',
  'prioridade',
  'priority',
  'subelementos',
  'subitems',
]);

const newsletterFixedColumns = new Set([
  'grupomonday',
  'grupo',
  'canal',
  'channel',
  'pessoas',
  'pessoa',
  'responsavel',
  'responsaveis',
  'data',
  'date',
  'status',
  'tema',
  'base',
  'hora',
  'tituloemail',
  'titulodoe-mail',
  'titulodoemail',
  'subelementos',
  'subitems',
]);

function dynamicNewsletterColumns(items: Newsletter[]) {
  return sheetColumns(items).filter((column) => {
    const normalized = column
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9/]+/g, '');
    return !newsletterFixedColumns.has(normalized);
  });
}

function dynamicPautaColumns(items: Pauta[]) {
  return sheetColumns(items).filter((column) => {
    const normalized = column
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9/]+/g, '');
    return !pautaFixedColumns.has(normalized);
  });
}

function sheetColumns<T extends { custom_fields?: Record<string, unknown> | null }>(items: T[]) {
  const columns: string[] = [];
  const seen = new Set<string>();
  items.forEach((item) => {
    Object.keys(item.custom_fields || {}).forEach((key) => {
      if (seen.has(key)) return;
      seen.add(key);
      columns.push(key);
    });
  });
  return columns;
}

function SheetCell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-h-10 min-w-[150px] border-r border-border/80 bg-background px-3 py-2 text-xs last:border-r-0', className)}>
      {children}
    </div>
  );
}

function SheetHeaderCell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-[150px] border-r border-border/80 bg-muted/70 px-3 py-2.5 text-xs font-semibold text-muted-foreground last:border-r-0', className)}>
      {children}
    </div>
  );
}

function SundayTableToolbar({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-3 border-b bg-background px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
        <span className="text-sm font-semibold">{title}</span>
        <Badge variant="outline" className="text-[10px]">Sunday puro</Badge>
      </div>
      <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>{count} elementos</span>
        <span className="rounded border px-2 py-1">Agrupado por Grupo Monday</span>
      </div>
    </div>
  );
}

function SundayProjectRedirect({ aliases, label }: { aliases: string[]; label: string }) {
  const { currentOrg } = useOrganization();
  const { data: projects = [], isLoading } = useProjectsByOrg(currentOrg?.id);
  const project = findSundayProject(projects, aliases);

  return (
    project ? (
      <TableViewPage projectId={project.id} embedded />
    ) : (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        {isLoading ? 'Carregando board...' : `Board Sunday de ${label} nao encontrado em Projetos.`}
      </Card>
    )
  );
}

/* ================================================================ */
/* Main Page                                                         */
/* ================================================================ */

type MarketingModule = 'all' | 'programacao' | 'newsletters' | 'demandas';
type ProgramacaoWorkspaceView = {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  source: 'planilha' | 'manual';
  channel?: ConteudoChannel;
};

const marketingModuleMeta: Record<MarketingModule, { title: string; description: string }> = {
  all: {
    title: 'Marketing',
    description: 'Programacao de posts, newsletters e demandas do time.',
  },
  programacao: {
    title: 'Programacao',
    description: 'Calendario, kanban e lista de conteudos por rede e grupo do Monday.',
  },
  newsletters: {
    title: 'Newsletters',
    description: 'Newsletters separadas por Mooui Brasil, Barcelona e grupos do Monday.',
  },
  demandas: {
    title: 'Demandas Marketing',
    description: 'Demandas com subelementos, responsaveis, status e campos da planilha.',
  },
};

export default function ConteudoPage({ module = 'all' }: { module?: MarketingModule }) {
  const { currentOrg } = useOrganization();
  const [mainTab, setMainTab] = useState<'programacao' | 'newsletters' | 'demandas'>('programacao');
  const meta = marketingModuleMeta[module];

  // Org members for assignment
  const { data: orgMembers = [] } = useQuery({
    queryKey: ['org-members-conteudo', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data } = await supabase.from('organization_members').select('user_id').eq('organization_id', currentOrg.id);
      const ids = (data || []).map((m: any) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      return profs || [];
    },
    enabled: !!currentOrg,
  });

  if (module !== 'all') {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{meta.title}</h1>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
        </div>
        {module === 'programacao' && <ProgramacaoTab orgMembers={orgMembers as any} />}
        {module === 'newsletters' && <NewslettersTab />}
        {module === 'demandas' && (
          <SundayProjectRedirect
            label="Demandas Marketing"
            aliases={['Excel | marketing demandas (1780430344)', 'Marketing Demandas 1780430344', 'Demandas Marketing 1780430344']}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Marketing</h1>
        <p className="text-sm text-muted-foreground">Programação de posts, newsletters e demandas do time.</p>
      </div>

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)}>
        <TabsList>
          <TabsTrigger value="programacao"><CalendarIcon className="h-3.5 w-3.5 mr-1.5" />Programação</TabsTrigger>
          <TabsTrigger value="newsletters"><Mail className="h-3.5 w-3.5 mr-1.5" />Newsletters</TabsTrigger>
          <TabsTrigger value="demandas"><FileText className="h-3.5 w-3.5 mr-1.5" />Demandas Marketing</TabsTrigger>
        </TabsList>

        <TabsContent value="programacao" className="mt-4">
          <ProgramacaoTab orgMembers={orgMembers as any} />
        </TabsContent>
        <TabsContent value="newsletters" className="mt-4">
          <NewslettersTab />
        </TabsContent>
        <TabsContent value="demandas" className="mt-4">
          <SundayProjectRedirect
            label="Demandas Marketing"
            aliases={['Excel | marketing demandas (1780430344)', 'Marketing Demandas 1780430344', 'Demandas Marketing 1780430344']}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ================================================================ */
/* TAB 1: Programação                                               */
/* ================================================================ */

function ProgramacaoTab({ orgMembers }: { orgMembers: { id: string; full_name: string | null }[] }) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { data: items = [], isLoading } = useConteudoItems();
  const { data: savedWorkspaces = [] } = useProgramacaoWorkspaces();
  const { data: projects = [] } = useProjectsByOrg(currentOrg?.id);
  const createWorkspaceMut = useCreateProgramacaoWorkspace();
  const createProjectMut = useCreateProject();
  const createMut = useCreateConteudo();
  const updateMut = useUpdateConteudo();
  const deleteMut = useDeleteConteudo();
  const confirm = useConfirm();

  const [view, setView] = useState<'list' | 'calendar' | 'kanban'>('list');
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [showWorkspaceDialog, setShowWorkspaceDialog] = useState(false);
  const [localWorkspaces, setLocalWorkspaces] = useState<ProgramacaoWorkspaceView[]>([]);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ConteudoStatus>('all');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [openItem, setOpenItem] = useState<ConteudoItem | null>(null);

  // New form
  const [nTitle, setNTitle] = useState('');
  const [nChannel, setNChannel] = useState<ConteudoChannel>('mooui_kids');
  const [nType, setNType] = useState<ConteudoType>('foto');
  const [nDate, setNDate] = useState('');
  const [nTimeSlot, setNTimeSlot] = useState('');
  const [nRepost, setNRepost] = useState(false);
  const [nNotes, setNNotes] = useState('');

  // Profiles
  const userIds = useMemo(() => {
    const ids = new Set<string>();
    items.forEach(i => { ids.add(i.created_by); if (i.assigned_to) ids.add(i.assigned_to); });
    return [...ids];
  }, [items]);
  const { data: profiles = [] } = useQuery({
    queryKey: ['conteudo-profiles', userIds.sort().join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });
  const profileMap = useMemo(() => new Map(profiles.map((p: any) => [p.id, p])), [profiles]);

  const workspaces = useMemo<ProgramacaoWorkspaceView[]>(() => {
    const map = new Map<string, ProgramacaoWorkspaceView>();
    for (const channel of channelOrder) {
      if (items.some((item) => item.channel === channel)) {
        map.set(`channel:${channel}`, {
          id: `channel:${channel}`,
          name: channelLabels[channel],
          description: 'Importado da planilha de programacao',
          color: channelAccentColors[channel],
          source: 'planilha',
          channel,
        });
      }
    }
    for (const workspace of savedWorkspaces as ProgramacaoWorkspace[]) {
      map.set(`saved:${workspace.id}`, {
        id: `saved:${workspace.id}`,
        name: workspace.name,
        description: workspace.description,
        color: workspace.color || '#D6336C',
        source: 'manual',
      });
    }
    for (const workspace of localWorkspaces) map.set(workspace.id, workspace);
    return [...map.values()].sort((a, b) => {
      if (a.source !== b.source) return a.source === 'planilha' ? -1 : 1;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [items, savedWorkspaces, localWorkspaces]);

  useEffect(() => {
    if (!activeWorkspaceId && workspaces.length > 0) setActiveWorkspaceId(workspaces[0].id);
    if (activeWorkspaceId && workspaces.length > 0 && !workspaces.some((workspace) => workspace.id === activeWorkspaceId)) {
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [activeWorkspaceId, workspaces]);

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || workspaces[0] || null;
  const projectForWorkspace = (workspace: ProgramacaoWorkspaceView) => findSundayProject(projects, [
    workspace.channel ? programacaoSundayBoardTitles[workspace.channel] : null,
    workspace.name,
    `programacao ${workspace.name}`,
  ]);
  const openSundayWorkspace = (workspace: ProgramacaoWorkspaceView) => {
    setActiveWorkspaceId(workspace.id);
    setGroupFilter('all');
  };
  const activeProject = activeWorkspace ? projectForWorkspace(activeWorkspace) : null;
  const workspaceItems = activeWorkspace ? items.filter((item) => workspaceMatchesItem(activeWorkspace, item)) : items;
  const q = search.trim().toLowerCase();
  const filtered = workspaceItems.filter(i => {
    if (groupFilter !== 'all' && spreadsheetGroup(i.custom_fields) !== groupFilter) return false;
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (q && ![
      i.title,
      programacaoNameCell(i),
      programacaoSubelementCell(i),
      sheetField(i.custom_fields, 'Pessoas', 'Pessoa', 'Responsavel', 'Responsaveis'),
    ].some((value) => value.toLowerCase().includes(q))) return false;
    return true;
  });
  const visibleItemIds = useMemo(() => filtered.map((item) => item.id), [filtered]);
  const { data: visibleSubitems = [] } = useConteudoChecklistForItems(visibleItemIds);
  const subitemsByItemId = useMemo(() => {
    const map = new Map<string, ConteudoChecklistItem[]>();
    visibleSubitems.forEach((subitem) => {
      if (!map.has(subitem.conteudo_item_id)) map.set(subitem.conteudo_item_id, []);
      map.get(subitem.conteudo_item_id)!.push(subitem);
    });
    return map;
  }, [visibleSubitems]);
  const programacaoGroups = useMemo(() => buildGroupStats(workspaceItems), [workspaceItems]);
  const handleCreateWorkspace = () => {
    const name = workspaceName.trim();
    if (!name) return;
    const localWorkspace: ProgramacaoWorkspaceView = {
      id: `local:${Date.now()}`,
      name,
      description: workspaceDescription.trim() || null,
      color: '#D6336C',
      source: 'manual',
    };
    setLocalWorkspaces((current) => [...current, localWorkspace]);
    setActiveWorkspaceId(localWorkspace.id);
    setShowWorkspaceDialog(false);
    setWorkspaceName('');
    setWorkspaceDescription('');
    createWorkspaceMut.mutate({
      name,
      description: localWorkspace.description,
      color: localWorkspace.color,
      metadata: { created_from: 'programacao_page' },
    }, {
      onSuccess: () => toast.success('Workspace criado'),
      onError: () => toast.warning('Workspace criado nesta sessao. Rode a migration de workspaces para salvar no banco.'),
    });
    if (currentOrg) {
      createProjectMut.mutate({
        name: `Excel | programacao ${name}`,
        description: workspaceDescription.trim() || undefined,
        color: localWorkspace.color,
        organizationId: currentOrg.id,
      }, {
        onSuccess: (project) => {
          toast.success('Board Sunday criado para a rede');
        },
      });
    }
  };

  const handleCreate = () => {
    if (!nTitle.trim()) return;
    const workspacePatch = activeWorkspace ? { 'Workspace Programacao': activeWorkspace.name } : {};
    createMut.mutate({
      title: nTitle.trim(), channel: activeWorkspace?.channel || nChannel, content_type: nType,
      scheduled_date: nDate || undefined, time_slot: nTimeSlot || undefined,
      is_repost: nRepost, notes: nNotes || undefined,
      custom_fields: workspacePatch,
    }, {
      onSuccess: () => {
        toast.success('Conteúdo criado!');
        setShowNew(false);
        setNTitle(''); setNChannel('mooui_kids'); setNType('foto'); setNDate(''); setNTimeSlot(''); setNRepost(false); setNNotes('');
      },
      onError: (e: any) => toast.error(e?.message || 'Erro'),
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="hidden">
        <div className="flex items-center gap-2">
          <Button variant={view === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setView('list')}>
            <List className="h-3.5 w-3.5 mr-1" />Lista
          </Button>
          <Button variant={view === 'calendar' ? 'default' : 'outline'} size="sm" onClick={() => setView('calendar')}>
            <CalendarIcon className="h-3.5 w-3.5 mr-1" />Calendário
          </Button>
          <Button variant={view === 'kanban' ? 'default' : 'outline'} size="sm" onClick={() => setView('kanban')}>
            <Columns3 className="h-3.5 w-3.5 mr-1" />Kanban
          </Button>
        </div>
        <Button onClick={() => setShowNew(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />Novo conteúdo
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Redes de Programacao</span>
          <div className="flex items-center gap-2">
            {activeWorkspace && <span className="text-xs text-muted-foreground">{workspaceItems.length} elementos nesta rede</span>}
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setShowWorkspaceDialog(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />Rede
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
        {workspaces.map(workspace => {
          const active = activeWorkspaceId === workspace.id;
          const count = items.filter((item) => workspaceMatchesItem(workspace, item)).length;
          const pending = items.filter((item) => workspaceMatchesItem(workspace, item) && item.status !== 'publicado').length;
          return (
            <button
              key={workspace.id}
              type="button"
              onClick={() => openSundayWorkspace(workspace)}
              className={cn(
                'rounded-md border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/40',
                active && 'border-primary ring-1 ring-primary/30'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-medium truncate">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: workspace.color }} />
                  {workspace.name}
                </span>
                <Badge variant="outline" className="text-[10px] shrink-0">{workspace.source === 'planilha' ? 'Rede' : 'Manual'}</Badge>
              </div>
              <div className="mt-2 text-2xl font-semibold leading-none">{count}</div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>{pending} pendentes</span>
                <span className="truncate">{workspace.description || 'Sunday puro'}</span>
              </div>
            </button>
          );
        })}
        </div>
      </div>

      {activeProject ? (
        <TableViewPage projectId={activeProject.id} embedded />
      ) : (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {activeWorkspace ? 'Board Sunday desta rede nao encontrado em Projetos.' : 'Escolha uma rede para abrir o board.'}
        </Card>
      )}

      {false && programacaoGroups.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Grupos do Monday</span>
            {groupFilter !== 'all' && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setGroupFilter('all')}>
                Limpar grupo
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
            {programacaoGroups.map((stat) => {
              const active = groupFilter === stat.group;
              return (
                <button
                  key={stat.group}
                  type="button"
                  onClick={() => setGroupFilter(active ? 'all' : stat.group)}
                  className={cn(
                    'rounded-md border bg-card p-2 text-left transition-colors hover:border-primary/50 hover:bg-muted/40',
                    active && 'border-primary ring-1 ring-primary/30',
                  )}
                >
                  <div className="truncate text-xs font-medium">{stat.group}</div>
                  <div className="mt-1 text-lg font-semibold leading-none">{stat.total}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="hidden">
        <div className="relative flex-1 min-w-0">
          <SearchIcon className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar…" className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os grupos</SelectItem>
            {programacaoGroups.map((stat) => (
              <SelectItem key={stat.group} value={stat.group}>{stat.group}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(statusLabels) as ConteudoStatus[]).map(k => (
              <SelectItem key={k} value={k}>{statusLabels[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="hidden">
      {/* View */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : view === 'calendar' ? (
        <ContentCalendar items={filtered} onClickItem={setOpenItem} />
      ) : view === 'kanban' ? (
        <ConteudoKanban items={filtered} profileMap={profileMap} onClickItem={setOpenItem} onStatusChange={(id, status) => updateMut.mutate({ id, status })} />
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nenhum conteúdo encontrado.</Card>
      ) : (
        <>
          <ProgramacaoSheetTable items={filtered} subitemsByItemId={subitemsByItemId} onOpen={setOpenItem} />
          <div className="hidden">
          {filtered.map(item => {
            const author = profileMap.get(item.created_by) as any;
            return (
              <Card key={item.id} onClick={() => setOpenItem(item)} className="p-3 cursor-pointer hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      {item.code && <span className="text-[10px] font-mono font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.code}</span>}
                      <h3 className="font-medium truncate flex-1 min-w-0">{item.title}</h3>
                      <Badge className={cn('text-[10px]', channelColors[item.channel])} variant="outline">{channelLabels[item.channel]}</Badge>
                      <Badge className={cn('text-[10px]', statusColors[item.status])} variant="outline">{statusLabels[item.status]}</Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <Badge variant="outline" className="text-[10px]">{typeLabels[item.content_type]}</Badge>
                      <Badge variant="outline" className="text-[10px]">{spreadsheetGroup(item.custom_fields)}</Badge>
                      {item.is_repost && <Badge variant="outline" className="text-[10px] bg-muted">Repost</Badge>}
                      {item.scheduled_date && (
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(item.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                          {item.time_slot && ` ${item.time_slot}`}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                      <span>{author?.full_name || 'Usuário'}</span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
          </div>
        </>
      )}

      </div>

      <Dialog open={showWorkspaceDialog} onOpenChange={setShowWorkspaceDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo workspace de Programacao</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome do workspace</Label>
              <Input
                autoFocus
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Ex.: MOOUI Kids, MOOUI Home, Barcelona"
              />
            </div>
            <div>
              <Label className="text-xs">Dados extras</Label>
              <Textarea
                value={workspaceDescription}
                onChange={(e) => setWorkspaceDescription(e.target.value)}
                rows={3}
                placeholder="Observacoes, marca, responsaveis ou criterio de uso"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWorkspaceDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateWorkspace} disabled={!workspaceName.trim() || createWorkspaceMut.isPending}>Criar workspace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo conteúdo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título</Label>
              <Input autoFocus value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="Título do post" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Canal</Label>
                <Select value={nChannel} onValueChange={(v) => setNChannel(v as ConteudoChannel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {channelOrder.map(k => (
                      <SelectItem key={k} value={k}>{channelLabels[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={nType} onValueChange={(v) => setNType(v as ConteudoType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(typeLabels) as ConteudoType[]).map(k => (
                      <SelectItem key={k} value={k}>{typeLabels[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data agendada</Label>
                <Input type="date" value={nDate} onChange={(e) => setNDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Horário</Label>
                <Input value={nTimeSlot} onChange={(e) => setNTimeSlot(e.target.value)} placeholder="Ex: 10h, 14h" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="repost" checked={nRepost} onChange={(e) => setNRepost(e.target.checked)} className="rounded" />
              <Label htmlFor="repost" className="text-xs cursor-pointer">É repost</Label>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={nNotes} onChange={(e) => setNNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!nTitle.trim() || createMut.isPending}>Criar conteúdo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      {openItem && (
        <ConteudoElementDetail
          item={openItem}
          onClose={() => setOpenItem(null)}
          onUpdate={(patch) => updateMut.mutate({ id: openItem.id, ...patch }, {
            onSuccess: () => { setOpenItem(cur => cur ? { ...cur, ...patch } as ConteudoItem : cur); toast.success('Atualizado'); },
          })}
          onDelete={async () => {
            const ok = await confirm({ title: 'Excluir este conteúdo?', destructive: true, confirmText: 'Excluir' });
            if (!ok) return;
            deleteMut.mutate(openItem.id, { onSuccess: () => { toast.success('Conteúdo excluído'); setOpenItem(null); } });
          }}
          isOwner={openItem.created_by === user?.id}
          orgMembers={orgMembers}
          profileMap={profileMap as any}
        />
      )}
    </div>
  );
}

/* ================================================================ */
/* Conteudo Kanban                                                   */
/* ================================================================ */

function ProgramacaoSheetTable({
  items,
  subitemsByItemId,
  onOpen,
}: {
  items: ConteudoItem[];
  subitemsByItemId: Map<string, ConteudoChecklistItem[]>;
  onOpen: (item: ConteudoItem) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: ConteudoItem[] }>();
    items.forEach((item) => {
      const key = programacaoMonthSortKey(item);
      if (!map.has(key)) map.set(key, { label: programacaoMonthGroup(item), items: [] });
      map.get(key)!.items.push(item);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => group);
  }, [items]);
  const boardTitle = items[0]?.channel ? programacaoSundayBoardTitles[items[0].channel] : 'Excel | programacao';

  return (
    <Card className="overflow-hidden border shadow-sm">
      <SundayTableToolbar title={boardTitle} count={items.length} />
      <div className="overflow-x-auto">
        <div className="min-w-[980px]">
          {groups.map(({ label: group, items: groupItems }) => (
            <div key={group}>
              <div className="border-b border-l-4 border-l-primary bg-primary/5 px-3 py-2 text-sm font-semibold text-foreground">
                {group} <span className="ml-2 text-xs font-normal text-muted-foreground">{groupItems.length} elementos</span>
              </div>
              <div className="grid grid-cols-[minmax(360px,1fr)_160px_120px_130px_150px_90px] border-b bg-muted/60 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <div className="border-r px-3 py-2">Elemento</div>
                <div className="border-r px-3 py-2 text-center">Data Acao</div>
                <div className="border-r px-3 py-2 text-center">Prioridade</div>
                <div className="border-r px-3 py-2 text-center">Status</div>
                <div className="border-r px-3 py-2 text-center">Responsavel</div>
                <div className="px-3 py-2 text-center">Abertura</div>
              </div>
              {groupItems.map((item) => {
                const subitems = subitemsByItemId.get(item.id) || [];
                return (
                  <div key={item.id} className="border-b last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onOpen(item)}
                      className="grid grid-cols-[minmax(360px,1fr)_160px_120px_130px_150px_90px] text-left transition-colors hover:bg-primary/5"
                    >
                      <div className="min-h-11 border-r px-3 py-2 font-medium">
                        <div className="truncate">{programacaoElementLabel(item)}</div>
                        {item.code && <div className="mt-0.5 text-[10px] font-mono text-muted-foreground">{item.code}</div>}
                      </div>
                      <div className="flex min-h-11 items-center justify-center border-r px-3 py-2">
                        {programacaoDateAction(item) && <span className="w-full rounded bg-red-500 px-2 py-1 text-center text-[10px] font-semibold text-white">{programacaoDateAction(item)}</span>}
                      </div>
                      <div className="flex min-h-11 items-center justify-center border-r px-3 py-2">
                        <span className="w-full rounded bg-amber-500 px-2 py-1 text-center text-[10px] font-semibold text-white">{programacaoPriority(item)}</span>
                      </div>
                      <div className="flex min-h-11 items-center justify-center border-r px-3 py-2">
                        <span className={cn('w-full rounded px-2 py-1 text-center text-[10px] font-semibold text-white', item.status === 'publicado' ? 'bg-emerald-500' : 'bg-slate-600')}>
                          {statusLabels[item.status]}
                        </span>
                      </div>
                      <div className="flex min-h-11 items-center justify-center border-r px-3 py-2 text-xs">{programacaoResponsible(item)}</div>
                      <div className="flex min-h-11 items-center justify-center px-3 py-2 text-xs text-muted-foreground">{programacaoOpenedAt(item)}</div>
                    </button>
                    {subitems.map((subitem) => (
                      <button
                        key={subitem.id}
                        type="button"
                        onClick={() => onOpen(item)}
                        className="grid grid-cols-[minmax(360px,1fr)_160px_120px_130px_150px_90px] bg-muted/25 text-left transition-colors hover:bg-primary/5"
                      >
                        <div className="min-h-10 border-r px-8 py-2 text-xs font-medium text-muted-foreground">
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{subitem.title}</span>
                          </span>
                        </div>
                        <div className="min-h-10 border-r px-3 py-2 text-center text-xs">{sheetField(subitem.custom_fields, 'Data', 'Date') || subitem.due_date || ''}</div>
                        <div className="min-h-10 border-r px-3 py-2" />
                        <div className="flex min-h-10 items-center justify-center border-r px-3 py-2">
                          <span className={cn('w-full rounded px-2 py-1 text-center text-[10px] font-semibold text-white', subitem.status === 'concluido' ? 'bg-emerald-500' : 'bg-slate-600')}>
                            {conteudoChecklistStatusLabels[subitem.status]}
                          </span>
                        </div>
                        <div className="min-h-10 border-r px-3 py-2 text-center text-xs">{sheetField(subitem.custom_fields, 'Pessoas', 'Pessoa', 'Owner', 'Responsavel', 'Responsaveis')}</div>
                        <div className="min-h-10 px-3 py-2" />
                      </button>
                    ))}
                    <button type="button" onClick={() => onOpen(item)} className="grid grid-cols-[minmax(360px,1fr)_160px_120px_130px_150px_90px] text-left text-xs text-muted-foreground hover:bg-primary/5">
                      <div className="border-r px-3 py-2">+ Adicionar elemento</div>
                      <div className="border-r px-3 py-2" />
                      <div className="border-r px-3 py-2" />
                      <div className="border-r px-3 py-2" />
                      <div className="border-r px-3 py-2" />
                      <div className="px-3 py-2" />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

const kanbanStatuses: ConteudoStatus[] = ['nao_iniciado', 'em_andamento', 'em_revisao', 'aprovado', 'publicado'];
const kanbanColumnColors: Record<ConteudoStatus, string> = {
  nao_iniciado: 'bg-slate-500/20',
  em_andamento: 'bg-blue-500/20',
  em_revisao: 'bg-amber-500/20',
  aprovado: 'bg-emerald-500/20',
  publicado: 'bg-violet-500/20',
};
const kanbanDotColors: Record<ConteudoStatus, string> = {
  nao_iniciado: 'bg-slate-500',
  em_andamento: 'bg-blue-500',
  em_revisao: 'bg-amber-500',
  aprovado: 'bg-emerald-500',
  publicado: 'bg-violet-500',
};

function ConteudoKanban({
  items, profileMap, onClickItem, onStatusChange,
}: {
  items: ConteudoItem[];
  profileMap: Map<string, any>;
  onClickItem: (item: ConteudoItem) => void;
  onStatusChange: (id: string, status: ConteudoStatus) => void;
}) {
  const columns = useMemo(() => {
    return kanbanStatuses.map(status => ({
      id: status,
      title: statusLabels[status],
      items: items.filter(i => i.status === status),
    }));
  }, [items]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId as ConteudoStatus;
    const itemId = result.draggableId;
    const item = items.find(i => i.id === itemId);
    if (!item || item.status === newStatus) return;
    onStatusChange(itemId, newStatus);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map(col => (
          <div key={col.id} className="flex-shrink-0 w-64">
            <div className={`rounded-lg px-3 py-2 mb-3 flex items-center gap-2 ${kanbanColumnColors[col.id]}`}>
              <div className={`h-2.5 w-2.5 rounded-full ${kanbanDotColors[col.id]}`} />
              <span className="text-sm font-semibold">{col.title}</span>
              <span className="text-xs text-muted-foreground bg-background/60 rounded-full px-2 py-0.5">
                {col.items.length}
              </span>
            </div>
            <Droppable droppableId={col.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    'space-y-2 min-h-[120px] rounded-lg p-1 transition-colors',
                    snapshot.isDraggingOver && 'bg-primary/5 ring-1 ring-primary/20'
                  )}
                >
                  {col.items.map((item, index) => {
                    const author = profileMap.get(item.created_by) as any;
                    return (
                      <Draggable key={item.id} draggableId={item.id} index={index}>
                        {(prov, snap) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            {...prov.dragHandleProps}
                            onClick={() => onClickItem(item)}
                            className={cn(
                              'rounded-md border bg-card p-2.5 cursor-pointer hover:border-primary/40 transition-colors',
                              snap.isDragging && 'shadow-lg ring-2 ring-primary/30'
                            )}
                          >
                            <div className="flex items-start gap-1.5 flex-wrap mb-1">
                              {item.code && (
                                <span className="text-[9px] font-mono font-semibold text-muted-foreground bg-muted px-1 py-0.5 rounded">{item.code}</span>
                              )}
                              <Badge className={cn('text-[9px]', channelColors[item.channel])} variant="outline">{channelLabels[item.channel]}</Badge>
                            </div>
                            <p className="text-sm font-medium leading-tight line-clamp-2">{item.title}</p>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <Badge variant="outline" className="text-[9px]">{typeLabels[item.content_type]}</Badge>
                              {item.is_repost && <Badge variant="outline" className="text-[9px] bg-muted">Repost</Badge>}
                            </div>
                            {item.scheduled_date && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {format(new Date(item.scheduled_date + 'T12:00:00'), 'dd/MM', { locale: ptBR })}
                                {item.time_slot && ` · ${item.time_slot}`}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-1">{author?.full_name || 'Usuário'}</p>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}

/* ================================================================ */
/* Conteudo Detail                                                   */
/* ================================================================ */

function ConteudoDetail({
  item, onClose, onUpdate, onDelete, isOwner, orgMembers, profileMap,
}: {
  item: ConteudoItem;
  onClose: () => void;
  onUpdate: (patch: Partial<ConteudoItem>) => void;
  onDelete: () => void;
  isOwner: boolean;
  orgMembers: { id: string; full_name: string | null }[];
  profileMap: Map<string, { id: string; full_name: string | null }>;
}) {
  const { data: activity = [] } = useConteudoActivity(item.id);
  const [tab, setTab] = useState<'details' | 'activity'>('details');

  const actUserIds = [...new Set(activity.filter(a => a.user_id).map(a => a.user_id!))];
  const { data: aProfiles = [] } = useQuery({
    queryKey: ['conteudo-aprofiles', actUserIds.sort().join(',')],
    queryFn: async () => {
      if (actUserIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', actUserIds);
      return data || [];
    },
    enabled: actUserIds.length > 0,
  });
  const aMap = new Map((aProfiles as any[]).map(p => [p.id, p]));
  const author = profileMap.get(item.created_by);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex-1 text-left flex items-baseline gap-2 flex-wrap pr-8">
            {item.code && <span className="text-xs font-mono font-semibold text-muted-foreground">{item.code}</span>}
            <span>{item.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline" className={cn('text-[10px]', statusColors[item.status])}>{statusLabels[item.status]}</Badge>
            <Badge variant="outline" className={cn('text-[10px]', channelColors[item.channel])}>{channelLabels[item.channel]}</Badge>
            <Badge variant="outline" className="text-[10px]">{typeLabels[item.content_type]}</Badge>
            {item.is_repost && <Badge variant="outline" className="text-[10px] bg-muted">Repost</Badge>}
          </div>

          {/* Editable fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={item.status} onValueChange={(v) => onUpdate({ status: v as ConteudoStatus })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(statusLabels) as ConteudoStatus[]).map(k => (
                    <SelectItem key={k} value={k}>{statusLabels[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Canal</Label>
              <Select value={item.channel} onValueChange={(v) => onUpdate({ channel: v as ConteudoChannel })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(channelLabels) as ConteudoChannel[]).map(k => (
                    <SelectItem key={k} value={k}>{channelLabels[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Responsável</Label>
              <Select value={item.assigned_to || '_none'} onValueChange={(v) => onUpdate({ assigned_to: v === '_none' ? null : v } as any)}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Ninguém" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Ninguém</SelectItem>
                  {orgMembers.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name || 'Usuário'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data agendada</Label>
              <Input type="date" className="h-8" value={item.scheduled_date || ''} onChange={(e) => onUpdate({ scheduled_date: e.target.value || null } as any)} />
            </div>
          </div>

          {item.notes && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{item.notes}</p>}

          <div className="text-xs text-muted-foreground">
            <p>Criado por {(author as any)?.full_name || 'Usuário'} em {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>

          <LinkedItems sourceType="conteudo" sourceId={item.id} />

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="activity">Atividade ({activity.length})</TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === 'activity' && (
            <div className="space-y-2">
              {activity.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma atividade.</p>}
              {activity.map(a => {
                const ap = a.user_id ? (aMap.get(a.user_id) as any) : null;
                return (
                  <div key={a.id} className="flex items-start gap-2 text-xs">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{ap?.full_name || 'Sistema'}</span>
                      {a.action === 'created' && <span> criou o conteúdo</span>}
                      {a.action === 'status' && <span> alterou status: {a.from_value} → {a.to_value}</span>}
                      {a.action === 'channel' && <span> alterou canal: {a.from_value} → {a.to_value}</span>}
                      {a.action === 'assigned' && <span> alterou responsável</span>}
                      <span className="text-muted-foreground ml-2">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isOwner && (
            <div className="pt-2 border-t">
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />Excluir conteúdo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConteudoElementDetail({
  item, onClose, onUpdate, onDelete, isOwner, orgMembers, profileMap,
}: {
  item: ConteudoItem;
  onClose: () => void;
  onUpdate: (patch: Partial<ConteudoItem>) => void;
  onDelete: () => void;
  isOwner: boolean;
  orgMembers: { id: string; full_name: string | null }[];
  profileMap: Map<string, { id: string; full_name: string | null }>;
}) {
  const { user } = useAuth();
  const { data: activity = [] } = useConteudoActivity(item.id);
  const { data: comments = [] } = useConteudoComments(item.id);
  const addComment = useAddConteudoComment();
  const [tab, setTab] = useState<'details' | 'comments' | 'project' | 'files' | 'activity'>('details');
  const [commentText, setCommentText] = useState('');
  const author = profileMap.get(item.created_by);

  // Comment profiles
  const commentUserIds = [...new Set(comments.map(c => c.user_id))];
  const { data: cProfiles = [] } = useQuery({
    queryKey: ['conteudo-cprofiles', commentUserIds.sort().join(',')],
    queryFn: async () => {
      if (commentUserIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', commentUserIds);
      return data || [];
    },
    enabled: commentUserIds.length > 0,
  });
  const cMap = new Map((cProfiles as any[]).map(p => [p.id, p]));

  // Activity profiles
  const actUserIds = [...new Set(activity.filter(a => a.user_id).map(a => a.user_id!))];
  const { data: aProfiles = [] } = useQuery({
    queryKey: ['conteudo-aprofiles-element', actUserIds.sort().join(',')],
    queryFn: async () => {
      if (actUserIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', actUserIds);
      return data || [];
    },
    enabled: actUserIds.length > 0,
  });
  const aMap = new Map((aProfiles as any[]).map(p => [p.id, p]));

  const sendComment = () => {
    if (!commentText.trim()) return;
    addComment.mutate({ conteudoItemId: item.id, content: commentText.trim() }, {
      onSuccess: () => setCommentText(''),
      onError: () => toast.error('Erro ao enviar'),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex-1 text-left flex items-baseline gap-2 flex-wrap pr-8">
            {item.code && <span className="text-xs font-mono font-semibold text-muted-foreground">{item.code}</span>}
            <span>{item.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline" className={cn('text-[10px]', statusColors[item.status])}>{statusLabels[item.status]}</Badge>
            <Badge variant="outline" className={cn('text-[10px]', channelColors[item.channel])}>{channelLabels[item.channel]}</Badge>
            <Badge variant="outline" className="text-[10px]">{typeLabels[item.content_type]}</Badge>
            {item.content_category && <Badge variant="outline" className="text-[10px]">{item.content_category}</Badge>}
            {item.is_repost && <Badge variant="outline" className="text-[10px] bg-muted">Repost</Badge>}
          </div>

          <div className="text-xs text-muted-foreground">
            <p>Criado por {(author as any)?.full_name || 'Usuario'} em {format(new Date(item.created_at), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}</p>
          </div>

          <LinkedItems sourceType="conteudo" sourceId={item.id} />

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="comments">Comentarios ({comments.length})</TabsTrigger>
              <TabsTrigger value="project">Subelementos</TabsTrigger>
              <TabsTrigger value="files">Arquivos</TabsTrigger>
              <TabsTrigger value="activity">Atividade ({activity.length})</TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === 'details' && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Titulo</Label>
                <Input className="h-8" value={item.title} onChange={(e) => onUpdate({ title: e.target.value })} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={item.status} onValueChange={(v) => onUpdate({ status: v as ConteudoStatus })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(statusLabels) as ConteudoStatus[]).map(k => (
                        <SelectItem key={k} value={k}>{statusLabels[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Responsavel</Label>
                  <Select value={item.assigned_to || '_none'} onValueChange={(v) => onUpdate({ assigned_to: v === '_none' ? null : v } as any)}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Ninguem" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Ninguem</SelectItem>
                      {orgMembers.map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name || 'Usuario'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Canal</Label>
                  <Select value={item.channel} onValueChange={(v) => onUpdate({ channel: v as ConteudoChannel })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {channelOrder.map(k => (
                        <SelectItem key={k} value={k}>{channelLabels[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Tipo de conteudo</Label>
                  <Select value={item.content_type} onValueChange={(v) => onUpdate({ content_type: v as ConteudoType })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(typeLabels) as ConteudoType[]).map(k => (
                        <SelectItem key={k} value={k}>{typeLabels[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Data agendada</Label>
                  <Input type="date" className="h-8" value={item.scheduled_date || ''} onChange={(e) => onUpdate({ scheduled_date: e.target.value || null } as any)} />
                </div>
                <div>
                  <Label className="text-xs">Horario</Label>
                  <Input className="h-8" value={item.time_slot || ''} onChange={(e) => onUpdate({ time_slot: e.target.value || null } as any)} placeholder="Ex: Manha, Tarde, 10h" />
                </div>
                <div>
                  <Label className="text-xs">Categoria / tipo do Excel</Label>
                  <Input className="h-8" value={item.content_category || ''} onChange={(e) => onUpdate({ content_category: e.target.value || null } as any)} />
                </div>
                <div>
                  <Label className="text-xs">Foto principal do Excel</Label>
                  <Input className="h-8" value={item.photo_url || ''} onChange={(e) => onUpdate({ photo_url: e.target.value || null } as any)} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={item.is_repost} onChange={(e) => onUpdate({ is_repost: e.target.checked })} />
                <span>Repost</span>
              </label>
              {item.photo_url && (
                <a href={item.photo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" />Abrir foto principal
                </a>
              )}
              <div>
                <Label className="text-xs">Observacoes</Label>
                <Textarea rows={4} value={item.notes || ''} onChange={(e) => onUpdate({ notes: e.target.value || null } as any)} />
              </div>
              <SpreadsheetFields fields={item.custom_fields} />
            </div>
          )}

          {tab === 'comments' && (
            <div className="space-y-3">
              {comments.length === 0 && <p className="text-xs text-muted-foreground">Nenhum comentario.</p>}
              {comments.map(c => {
                const cp = cMap.get(c.user_id) as any;
                return (
                  <div key={c.id} className="flex gap-2">
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                      {cp?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-medium">{cp?.full_name || 'Usuario'}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-2">
                <Input placeholder="Escrever comentario..." value={commentText} onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); } }} className="h-8 text-sm" />
                <Button size="sm" className="h-8 px-3" onClick={sendComment} disabled={!commentText.trim() || addComment.isPending}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {tab === 'project' && <ConteudoProjectPanel conteudoItemId={item.id} orgMembers={orgMembers} />}
          {tab === 'files' && <ConteudoFilesPanel conteudoItemId={item.id} />}

          {tab === 'activity' && (
            <div className="space-y-2">
              {activity.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma atividade.</p>}
              {activity.map(a => {
                const ap = a.user_id ? (aMap.get(a.user_id) as any) : null;
                return (
                  <div key={a.id} className="flex items-start gap-2 text-xs">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{ap?.full_name || 'Sistema'}</span>
                      {a.action === 'created' && <span> criou o conteudo</span>}
                      {a.action === 'status' && <span> alterou status: {a.from_value} → {a.to_value}</span>}
                      {a.action === 'channel' && <span> alterou canal: {a.from_value} → {a.to_value}</span>}
                      {a.action === 'assigned' && <span> alterou responsavel</span>}
                      <span className="text-muted-foreground ml-2">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isOwner && (
            <div className="pt-2 border-t">
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />Excluir conteudo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConteudoProjectPanel({
  conteudoItemId,
  orgMembers,
}: {
  conteudoItemId: string;
  orgMembers: { id: string; full_name: string | null }[];
}) {
  const { data: items = [] } = useConteudoChecklist(conteudoItemId);
  const createItem = useCreateConteudoChecklistItem();
  const updateItem = useUpdateConteudoChecklistItem();
  const deleteItem = useDeleteConteudoChecklistItem();
  const [newTitle, setNewTitle] = useState('');

  const done = items.filter((item) => item.status === 'concluido').length;
  const progress = items.length ? Math.round((done / items.length) * 100) : 0;

  const addItem = () => {
    if (!newTitle.trim()) return;
    createItem.mutate({
      conteudo_item_id: conteudoItemId,
      title: newTitle.trim(),
      position: items.length,
    }, {
      onSuccess: () => setNewTitle(''),
      onError: (e: any) => toast.error(e?.message || 'Erro ao criar item'),
    });
  };

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Subelementos do item</span>
          <span className="text-muted-foreground">{done}/{items.length}</span>
        </div>
        <div className="h-2 rounded-full bg-muted mt-2 overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </Card>

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum subelemento cadastrado.</p>
        ) : items.map((item) => (
          <ConteudoChecklistRow
            key={item.id}
            item={item}
            orgMembers={orgMembers}
            onUpdate={(patch) => updateItem.mutate({ id: item.id, conteudo_item_id: conteudoItemId, ...patch })}
            onDelete={() => deleteItem.mutate({ id: item.id, conteudo_item_id: conteudoItemId })}
          />
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          placeholder="Adicionar subelemento..."
          className="h-8"
        />
        <Button size="sm" className="h-8" onClick={addItem} disabled={!newTitle.trim() || createItem.isPending}>
          <Plus className="h-3.5 w-3.5 mr-1" />Subelemento
        </Button>
      </div>
    </div>
  );
}

function ConteudoChecklistRow({
  item,
  orgMembers,
  onUpdate,
  onDelete,
}: {
  item: ConteudoChecklistItem;
  orgMembers: { id: string; full_name: string | null }[];
  onUpdate: (patch: Partial<ConteudoChecklistItem>) => void;
  onDelete: () => void;
}) {
  const isDone = item.status === 'concluido';
  return (
    <div className="grid gap-2 rounded-md border bg-card p-2 sm:grid-cols-[auto_1fr_120px_120px_140px_130px_auto] sm:items-center">
      <button
        className={cn('h-5 w-5 rounded border flex items-center justify-center', isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-muted-foreground/40')}
        onClick={() => onUpdate({ status: isDone ? 'pendente' : 'concluido' })}
      >
        {isDone && <CheckCircle2 className="h-3.5 w-3.5" />}
      </button>
      <Input className="h-8" value={item.title} onChange={(e) => onUpdate({ title: e.target.value })} />
      <Select value={item.status} onValueChange={(value) => onUpdate({ status: value as ConteudoChecklistStatus })}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {Object.keys(pautaItemStatusLabels).map((key) => (
            <SelectItem key={key} value={key}>{pautaItemStatusLabels[key]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={(item as any).priority || 'medium'} onValueChange={(value) => onUpdate({ priority: value } as any)}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="low">Baixa</SelectItem>
          <SelectItem value="medium">Média</SelectItem>
          <SelectItem value="high">Alta</SelectItem>
          <SelectItem value="critical">Crítica</SelectItem>
        </SelectContent>
      </Select>
      <Select value={item.assigned_to || '_none'} onValueChange={(value) => onUpdate({ assigned_to: value === '_none' ? null : value } as any)}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_none">Ninguém</SelectItem>
          {orgMembers.map((member) => (
            <SelectItem key={member.id} value={member.id}>{member.full_name || 'Usuário'}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input type="date" className="h-8" value={item.due_date || ''} onChange={(e) => onUpdate({ due_date: e.target.value || null } as any)} />
      <button className="text-muted-foreground hover:text-destructive justify-self-start sm:justify-self-end" onClick={onDelete}>
        <X className="h-3.5 w-3.5" />
      </button>
      <SpreadsheetFields fields={item.custom_fields} className="sm:col-span-7" />
    </div>
  );
}

function ConteudoFilesPanel({ conteudoItemId }: { conteudoItemId: string }) {
  const { user } = useAuth();
  const { attachments, isLoading, uploadFile, deleteAttachment } = useConteudoAttachments(conteudoItemId);
  const fileRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} excede o limite de 50MB`);
        return;
      }
      uploadFile.mutate({ conteudoItemId, file }, {
        onSuccess: () => toast.success(`${file.name} enviado`),
        onError: (e: any) => toast.error(e?.message || `Erro ao enviar ${file.name}`),
      });
    });
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />
      <button
        type="button"
        disabled={uploadFile.isPending}
        onClick={() => fileRef.current?.click()}
        className={cn(
          'w-full rounded-md border-2 border-dashed p-4 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors flex items-center justify-center gap-2',
          uploadFile.isPending && 'opacity-50 cursor-not-allowed',
        )}
      >
        <Paperclip className="h-4 w-4" />{uploadFile.isPending ? 'Enviando...' : 'Anexar fotos ou videos'}
      </button>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando arquivos...</p>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum arquivo anexado.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {attachments.map((attachment) => {
            const isVideo = attachment.file_type?.startsWith('video/');
            const isImage = attachment.file_type?.startsWith('image/');
            return (
              <Card key={attachment.id} className="p-2">
                <div className="flex items-start gap-2">
                  <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                    {isVideo ? <Video className="h-4 w-4 text-muted-foreground" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {attachment.signed_url ? (
                      <a href={attachment.signed_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline truncate block">
                        {attachment.file_name}
                      </a>
                    ) : (
                      <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {attachment.file_size ? `${(attachment.file_size / 1024 / 1024).toFixed(2)} MB` : 'Arquivo'}
                      {attachment.profile?.full_name ? ` - ${attachment.profile.full_name}` : ''}
                    </p>
                  </div>
                  {attachment.user_id === user?.id && (
                    <button
                      disabled={deleteAttachment.isPending}
                      className={cn('text-muted-foreground hover:text-destructive', deleteAttachment.isPending && 'opacity-50 cursor-not-allowed')}
                      onClick={() => deleteAttachment.mutate(attachment.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {isImage && attachment.signed_url && (
                  <img src={attachment.signed_url} alt={attachment.file_name} className="mt-2 h-28 w-full rounded object-cover" />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================================================================ */
/* TAB 2: Newsletters                                               */
/* ================================================================ */

function NewslettersTab() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { data: newsletters = [], isLoading } = useNewsletters();
  const { data: projects = [] } = useProjectsByOrg(currentOrg?.id);
  const createProjectMut = useCreateProject();
  const createMut = useCreateNewsletter();
  const updateMut = useUpdateNewsletter();
  const deleteMut = useDeleteNewsletter();
  const confirm = useConfirm();

  const [showNew, setShowNew] = useState(false);
  const [showChannelDialog, setShowChannelDialog] = useState(false);
  const [openItem, setOpenItem] = useState<Newsletter | null>(null);
  const [activeChannel, setActiveChannel] = useState<NewsletterChannel>('brasil');
  const [localNewsletterChannels, setLocalNewsletterChannels] = useState<NewsletterChannel[]>([]);
  const [newChannelName, setNewChannelName] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');

  // New form
  const [nTitle, setNTitle] = useState('');
  const [nDate, setNDate] = useState('');
  const [nTema, setNTema] = useState('');
  const [nChannel, setNChannel] = useState<NewsletterChannel>('brasil');

  const newsletterChannels = useMemo(() => {
    const channels = new Set<NewsletterChannel>([...nlChannelOrder, ...localNewsletterChannels]);
    newsletters.forEach((item) => channels.add(item.channel));
    return [...channels].sort((a, b) => {
      const ai = nlChannelOrder.indexOf(a);
      const bi = nlChannelOrder.indexOf(b);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return newsletterChannelLabel(a).localeCompare(newsletterChannelLabel(b), 'pt-BR');
    });
  }, [newsletters, localNewsletterChannels]);

  useEffect(() => {
    if (newsletterChannels.length > 0 && !newsletterChannels.includes(activeChannel)) {
      setActiveChannel(newsletterChannels[0]);
    }
  }, [activeChannel, newsletterChannels]);

  const channelFilteredNewsletters = newsletters.filter(n => n.channel === activeChannel);
  const newsletterGroups = useMemo(() => buildGroupStats(channelFilteredNewsletters), [channelFilteredNewsletters]);
  const filtered = channelFilteredNewsletters.filter(n => groupFilter === 'all' || spreadsheetGroup(n.custom_fields) === groupFilter);
  const newsletterSheetColumns = useMemo(() => dynamicNewsletterColumns(filtered), [filtered]);
  const channelStats = newsletterChannels.map((channel) => {
    const channelItems = newsletters.filter((item) => item.channel === channel);
    return {
      channel,
      total: channelItems.length,
      pending: channelItems.filter((item) => item.status !== 'enviado').length,
      sent: channelItems.filter((item) => item.status === 'enviado').length,
      scheduled: channelItems.filter((item) => !!item.scheduled_date).length,
    };
  });

  const projectForChannel = (channel: NewsletterChannel) => findSundayProject(projects, [
    newsletterSundayBoardTitles[channel],
    `newsletter ${newsletterChannelLabel(channel)}`,
    channel,
  ]);
  const openSundayNewsletter = (channel: NewsletterChannel) => {
    setActiveChannel(channel);
    setNChannel(channel);
    setGroupFilter('all');
  };
  const activeProject = projectForChannel(activeChannel);

  const handleCreateChannel = () => {
    const name = newChannelName.trim();
    if (!name) return;
    setLocalNewsletterChannels((current) => current.includes(name) ? current : [...current, name]);
    setActiveChannel(name);
    setNChannel(name);
    setGroupFilter('all');
    setNewChannelName('');
    setShowChannelDialog(false);
    if (currentOrg) {
      createProjectMut.mutate({
        name: `Excel | newsletter ${name}`,
        color: '#D6336C',
        organizationId: currentOrg.id,
      }, {
        onSuccess: (project) => {
          toast.success('Board Sunday criado para o workspace');
        },
      });
    }
  };

  const handleCreate = () => {
    if (!nTitle.trim()) return;
    createMut.mutate({
      title: nTitle.trim(), scheduled_date: nDate || undefined,
      tema: nTema || undefined, channel: nChannel || activeChannel,
    }, {
      onSuccess: () => {
        toast.success('Newsletter criada!');
        setShowNew(false);
        setNTitle(''); setNDate(''); setNTema(''); setNChannel(activeChannel);
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Workspaces de Newsletter</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{channelFilteredNewsletters.length} elementos neste workspace</span>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setShowChannelDialog(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />Workspace
            </Button>
          </div>
        </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {channelStats.map((stat) => {
          const active = activeChannel === stat.channel;
          return (
            <button
              key={stat.channel}
              type="button"
              onClick={() => openSundayNewsletter(stat.channel)}
              className={cn(
                'rounded-md border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/40',
                active && 'border-primary ring-1 ring-primary/30',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{newsletterChannelLabel(stat.channel)}</span>
                <Badge variant="outline" className="text-[10px]">{stat.pending} pendentes</Badge>
              </div>
              <div className="mt-2 text-2xl font-semibold leading-none">{stat.total}</div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>{stat.sent} enviadas</span>
                <span>{stat.scheduled} datadas</span>
              </div>
            </button>
          );
        })}
      </div>
      </div>

      {activeProject ? (
        <TableViewPage projectId={activeProject.id} embedded />
      ) : (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Board Sunday deste workspace nao encontrado em Projetos.
        </Card>
      )}

      {false && newsletterGroups.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
          {newsletterGroups.map((stat) => {
            const active = groupFilter === stat.group;
            return (
              <button
                key={stat.group}
                type="button"
                onClick={() => setGroupFilter(active ? 'all' : stat.group)}
                className={cn(
                  'rounded-md border bg-card p-2 text-left transition-colors hover:border-primary/50 hover:bg-muted/40',
                  active && 'border-primary ring-1 ring-primary/30',
                )}
              >
                <div className="truncate text-xs font-medium">{stat.group}</div>
                <div className="mt-1 text-lg font-semibold leading-none">{stat.total}</div>
              </button>
            );
          })}
        </div>
      )}

      <div className="hidden">
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os grupos</SelectItem>
            {newsletterGroups.map((stat) => (
              <SelectItem key={stat.group} value={stat.group}>{stat.group}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowNew(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />Nova newsletter
        </Button>
      </div>

      <div className="hidden">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nenhuma newsletter encontrada.</Card>
      ) : (
        <>
          <NewsletterSheetTable items={filtered} columns={newsletterSheetColumns} onOpen={setOpenItem} />
        <div className="hidden">
          {filtered.map(nl => (
            <Card key={nl.id} onClick={() => setOpenItem(nl)} className="p-3 cursor-pointer hover:border-primary/40 transition-colors">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <h3 className="font-medium truncate flex-1 min-w-0">{nl.title}</h3>
                    <Badge variant="outline" className="text-[10px]">{newsletterChannelLabel(nl.channel)}</Badge>
                    <Badge variant="outline" className="text-[10px]">{spreadsheetGroup(nl.custom_fields)}</Badge>
                    <Badge variant="outline" className={cn('text-[10px]', nlStatusColors[nl.status])}>{nlStatusLabels[nl.status]}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                    {nl.scheduled_date && <span>{format(new Date(nl.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</span>}
                    {nl.tema && <><span>·</span><span>Tema: {nl.tema}</span></>}
                    {nl.open_rate != null && <><span>·</span><span>Open: {nl.open_rate}%</span></>}
                    {nl.click_rate != null && <><span>·</span><span>Click: {nl.click_rate}%</span></>}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
        </>
      )}
      </div>

      <Dialog open={showChannelDialog} onOpenChange={setShowChannelDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo workspace de Newsletter</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome do workspace</Label>
              <Input
                autoFocus
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="Ex.: Brasil, Barcelona, B2B"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChannelDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateChannel} disabled={!newChannelName.trim()}>Criar workspace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova newsletter</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Título</Label><Input autoFocus value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="Título da newsletter" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Canal</Label>
                <Select value={nChannel} onValueChange={(v) => setNChannel(v as NewsletterChannel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {newsletterChannels.map(k => (<SelectItem key={k} value={k}>{newsletterChannelLabel(k)}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Data</Label><Input type="date" value={nDate} onChange={(e) => setNDate(e.target.value)} /></div>
            </div>
            <div><Label className="text-xs">Tema</Label><Input value={nTema} onChange={(e) => setNTema(e.target.value)} placeholder="Tema da newsletter" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!nTitle.trim() || createMut.isPending}>Criar newsletter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      {openItem && (
        <NewsletterDetail
          item={openItem}
          onClose={() => setOpenItem(null)}
          onUpdate={(patch) => updateMut.mutate({ id: openItem.id, ...patch }, {
            onSuccess: () => { setOpenItem(cur => cur ? { ...cur, ...patch } as Newsletter : cur); toast.success('Atualizado'); },
          })}
          onDelete={async () => {
            const ok = await confirm({ title: 'Excluir newsletter?', destructive: true, confirmText: 'Excluir' });
            if (!ok) return;
            deleteMut.mutate(openItem.id, { onSuccess: () => { toast.success('Newsletter excluída'); setOpenItem(null); } });
          }}
          isOwner={openItem.created_by === user?.id}
        />
      )}
    </div>
  );
}

function NewsletterSheetTable({
  items,
  columns,
  onOpen,
}: {
  items: Newsletter[];
  columns: string[];
  onOpen: (item: Newsletter) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, Newsletter[]>();
    items.forEach((item) => {
      const group = spreadsheetGroup(item.custom_fields);
      map.set(group, [...(map.get(group) || []), item]);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
  }, [items]);

  return (
    <Card className="overflow-hidden border shadow-sm">
      <SundayTableToolbar title="Board de Newsletters" count={items.length} />
      <div className="overflow-x-auto">
        <div className="min-w-max">
          <div className="grid grid-flow-col auto-cols-max border-b">
            <SheetHeaderCell className="sticky left-0 z-10 min-w-[280px] bg-muted">Elemento</SheetHeaderCell>
            <SheetHeaderCell>Subelementos</SheetHeaderCell>
            <SheetHeaderCell>Canal</SheetHeaderCell>
            <SheetHeaderCell>Pessoas</SheetHeaderCell>
            <SheetHeaderCell>Data</SheetHeaderCell>
            <SheetHeaderCell>Status</SheetHeaderCell>
            <SheetHeaderCell>Tema</SheetHeaderCell>
            <SheetHeaderCell>Hora</SheetHeaderCell>
            <SheetHeaderCell>Base</SheetHeaderCell>
            <SheetHeaderCell>Titulo e-mail</SheetHeaderCell>
            {columns.map((column) => <SheetHeaderCell key={column}>{column}</SheetHeaderCell>)}
          </div>
          {grouped.map(([group, groupItems]) => (
            <div key={group}>
              <div className="border-b border-l-4 border-l-primary bg-primary/5 px-3 py-2 text-sm font-semibold text-foreground">
                {group} <span className="ml-2 font-normal">{groupItems.length} elementos</span>
              </div>
              {groupItems.map((item) => {
                const people = sheetField(item.custom_fields, 'Pessoas', 'Pessoa', 'Responsavel', 'Responsaveis');
                const date = sheetField(item.custom_fields, 'Data', 'Date') || (item.scheduled_date ? format(new Date(item.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '');
                const subelements = sheetField(item.custom_fields, 'Subelementos', 'Subitems');
                const tema = sheetField(item.custom_fields, 'Tema') || item.tema || '';
                const hora = sheetField(item.custom_fields, 'Hora') || item.hora || '';
                const base = sheetField(item.custom_fields, 'Base') || item.base || '';
                const tituloEmail = sheetField(item.custom_fields, 'Titulo Email', 'Titulo do Email', 'Titulo do E-mail') || item.titulo_email || '';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpen(item)}
                    className="grid grid-flow-col auto-cols-max border-b text-left transition-colors last:border-b-0 hover:bg-primary/5"
                  >
                    <SheetCell className="sticky left-0 z-10 min-w-[280px] bg-background font-medium">{item.title}</SheetCell>
                    <SheetCell className="max-w-[180px] break-words">{subelements}</SheetCell>
                    <SheetCell>{newsletterChannelLabel(item.channel)}</SheetCell>
                    <SheetCell className="max-w-[220px] break-words">{people}</SheetCell>
                    <SheetCell>{date}</SheetCell>
                    <SheetCell><Badge variant="outline" className={cn('text-[10px]', nlStatusColors[item.status])}>{nlStatusLabels[item.status]}</Badge></SheetCell>
                    <SheetCell className="max-w-[220px] break-words">{tema}</SheetCell>
                    <SheetCell>{hora}</SheetCell>
                    <SheetCell className="max-w-[180px] break-words">{base}</SheetCell>
                    <SheetCell className="max-w-[260px] break-words">{tituloEmail}</SheetCell>
                    {columns.map((column) => (
                      <SheetCell key={column} className="max-w-[260px] break-words">
                        {sheetValue(item.custom_fields?.[column])}
                      </SheetCell>
                    ))}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function NewsletterDetail({
  item, onClose, onUpdate, onDelete, isOwner,
}: {
  item: Newsletter; onClose: () => void; onUpdate: (patch: Partial<Newsletter>) => void; onDelete: () => void; isOwner: boolean;
}) {
  const { user } = useAuth();
  const [nlTab, setNlTab] = useState<'details' | 'comments' | 'activity'>('details');
  const [commentText, setCommentText] = useState('');
  const commentEndRef = useRef<HTMLDivElement>(null);

  const { data: comments = [] } = useNewsletterComments(item.id);
  const addComment = useAddNewsletterComment();
  const { data: activity = [] } = useNewsletterActivity(item.id);

  // Profile queries for comments & activity
  const commentUserIds = useMemo(() => [...new Set(comments.map(c => c.user_id))], [comments]);
  const activityUserIds = useMemo(() => [...new Set(activity.filter(a => a.user_id).map(a => a.user_id!))], [activity]);
  const allNlUserIds = useMemo(() => [...new Set([...commentUserIds, ...activityUserIds])], [commentUserIds, activityUserIds]);
  const { data: nlProfiles = [] } = useQuery({
    queryKey: ['nl-detail-profiles', allNlUserIds.sort().join(',')],
    queryFn: async () => {
      if (!allNlUserIds.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', allNlUserIds);
      return data || [];
    },
    enabled: allNlUserIds.length > 0,
  });
  const nlProfileMap = useMemo(() => new Map(nlProfiles.map((p: any) => [p.id, p])), [nlProfiles]);

  const sendComment = () => {
    if (!commentText.trim()) return;
    addComment.mutate({ newsletterId: item.id, content: commentText.trim() }, {
      onSuccess: () => { setCommentText(''); setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); },
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item.title}</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={cn('text-[10px]', nlStatusColors[item.status])}>{nlStatusLabels[item.status]}</Badge>
          <Badge variant="outline" className="text-[10px]">{newsletterChannelLabel(item.channel)}</Badge>
        </div>

        <Tabs value={nlTab} onValueChange={(v) => setNlTab(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1 text-xs"><FileText className="h-3 w-3 mr-1" />Detalhes</TabsTrigger>
            <TabsTrigger value="comments" className="flex-1 text-xs"><MessageCircle className="h-3 w-3 mr-1" />Comentários ({comments.length})</TabsTrigger>
            <TabsTrigger value="activity" className="flex-1 text-xs"><Clock className="h-3 w-3 mr-1" />Atividade</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={item.status} onValueChange={(v) => onUpdate({ status: v as NewsletterStatus })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(nlStatusLabels) as NewsletterStatus[]).map(k => (<SelectItem key={k} value={k}>{nlStatusLabels[k]}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Data</Label>
                <Input type="date" className="h-8" value={item.scheduled_date || ''} onChange={(e) => onUpdate({ scheduled_date: e.target.value || null } as any)} />
              </div>
              <div>
                <Label className="text-xs">Tema</Label>
                <Input className="h-8" value={item.tema || ''} onChange={(e) => onUpdate({ tema: e.target.value || null } as any)} />
              </div>
              <div>
                <Label className="text-xs">Base</Label>
                <Input className="h-8" value={item.base || ''} onChange={(e) => onUpdate({ base: e.target.value || null } as any)} />
              </div>
              <div>
                <Label className="text-xs">Hora envio</Label>
                <Input className="h-8" value={item.hora || ''} onChange={(e) => onUpdate({ hora: e.target.value || null } as any)} />
              </div>
              <div>
                <Label className="text-xs">Título do e-mail</Label>
                <Input className="h-8" value={item.titulo_email || ''} onChange={(e) => onUpdate({ titulo_email: e.target.value || null } as any)} />
              </div>
              <div>
                <Label className="text-xs">Open Rate (%)</Label>
                <Input type="number" step="0.01" className="h-8" value={item.open_rate ?? ''} onChange={(e) => onUpdate({ open_rate: e.target.value ? parseFloat(e.target.value) : null } as any)} />
              </div>
              <div>
                <Label className="text-xs">Click Rate (%)</Label>
                <Input type="number" step="0.01" className="h-8" value={item.click_rate ?? ''} onChange={(e) => onUpdate({ click_rate: e.target.value ? parseFloat(e.target.value) : null } as any)} />
              </div>
            </div>
            {item.notes && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{item.notes}</p>}
            <SpreadsheetFields fields={item.custom_fields} />
            {isOwner && (
              <div className="pt-2 border-t">
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />Excluir newsletter
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="comments" className="mt-3">
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {comments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum comentário ainda.</p>
              ) : comments.map(c => {
                const prof = nlProfileMap.get(c.user_id) as any;
                return (
                  <div key={c.id} className="flex gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-[11px] font-medium">
                      {(prof?.full_name || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-medium">{prof?.full_name || 'Usuário'}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={commentEndRef} />
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Escreva um comentário…"
                className="h-8 text-sm"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
              />
              <Button size="sm" className="h-8 px-2" onClick={sendComment} disabled={!commentText.trim() || addComment.isPending}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="mt-3">
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {activity.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma atividade registrada.</p>
              ) : activity.map(a => {
                const prof = a.user_id ? nlProfileMap.get(a.user_id) as any : null;
                return (
                  <div key={a.id} className="flex items-start gap-2 text-xs">
                    <Clock className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <span className="font-medium">{prof?.full_name || 'Sistema'}</span>{' '}
                      <span className="text-muted-foreground">{a.action}</span>
                      {a.from_value && a.to_value && (
                        <span className="text-muted-foreground"> {a.from_value} → {a.to_value}</span>
                      )}
                      <span className="text-muted-foreground/60 ml-1">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================ */
/* TAB 3: Pautas                                                    */
/* ================================================================ */

function PautasTab({ orgMembers }: { orgMembers: { id: string; full_name: string | null }[] }) {
  const { user } = useAuth();
  const { data: pautas = [], isLoading } = usePautas();
  const createMut = useCreatePauta();
  const updateMut = useUpdatePauta();
  const deleteMut = useDeletePauta();
  const confirm = useConfirm();

  const [showNew, setShowNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState('all');

  // New form
  const [nTitle, setNTitle] = useState('');
  const [nPriority, setNPriority] = useState<PautaPriority>('medium');
  const [nAssigned, setNAssigned] = useState('');

  // Profiles
  const userIds = useMemo(() => {
    const ids = new Set<string>();
    pautas.forEach(p => { ids.add(p.created_by); if (p.assigned_to) ids.add(p.assigned_to); });
    return [...ids];
  }, [pautas]);
  const { data: profiles = [] } = useQuery({
    queryKey: ['pauta-profiles', userIds.sort().join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });
  const profileMap = useMemo(() => new Map(profiles.map((p: any) => [p.id, p])), [profiles]);
  const pautaGroups = useMemo(() => buildGroupStats(pautas), [pautas]);
  const filteredPautas = pautas.filter((pauta) => groupFilter === 'all' || spreadsheetGroup(pauta.custom_fields) === groupFilter);
  const pautaSheetColumns = useMemo(() => dynamicPautaColumns(filteredPautas), [filteredPautas]);

  const handleCreate = () => {
    if (!nTitle.trim()) return;
    createMut.mutate({
      title: nTitle.trim(), priority: nPriority,
      assigned_to: nAssigned || undefined,
    }, {
      onSuccess: () => {
        toast.success('Demanda criada!');
        setShowNew(false);
        setNTitle(''); setNPriority('medium'); setNAssigned('');
      },
    });
  };

  return (
    <div className="space-y-4">
      {pautaGroups.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
          {pautaGroups.map((stat) => {
            const active = groupFilter === stat.group;
            return (
              <button
                key={stat.group}
                type="button"
                onClick={() => setGroupFilter(active ? 'all' : stat.group)}
                className={cn(
                  'rounded-md border bg-card p-2 text-left transition-colors hover:border-primary/50 hover:bg-muted/40',
                  active && 'border-primary ring-1 ring-primary/30',
                )}
              >
                <div className="truncate text-xs font-medium">{stat.group}</div>
                <div className="mt-1 text-lg font-semibold leading-none">{stat.total}</div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os grupos</SelectItem>
            {pautaGroups.map((stat) => (
              <SelectItem key={stat.group} value={stat.group}>{stat.group}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowNew(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />Nova demanda
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filteredPautas.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nenhuma demanda cadastrada.</Card>
      ) : (
        <>
          <PautaSheetTable
            items={filteredPautas}
            columns={pautaSheetColumns}
            expandedId={expandedId}
            onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
            profileMap={profileMap as any}
            renderExpanded={(pauta) => (
              <PautaExpanded
                pauta={pauta}
                orgMembers={orgMembers}
                onUpdate={(patch) => updateMut.mutate({ id: pauta.id, ...patch })}
                onDelete={async () => {
                  const ok = await confirm({ title: 'Excluir esta pauta?', destructive: true, confirmText: 'Excluir' });
                  if (!ok) return;
                  deleteMut.mutate(pauta.id, { onSuccess: () => { toast.success('Pauta excluida'); setExpandedId(null); } });
                }}
                isOwner={pauta.created_by === user?.id}
              />
            )}
          />
        <div className="hidden">
          {filteredPautas.map(pauta => {
            const isExpanded = expandedId === pauta.id;
            const author = profileMap.get(pauta.created_by) as any;
            const assignee = pauta.assigned_to ? (profileMap.get(pauta.assigned_to) as any) : null;
            return (
              <Card key={pauta.id} className="overflow-hidden">
                <div
                  className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : pauta.id)}
                >
                  <div className="flex items-start gap-2">
                    {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <h3 className="font-medium truncate flex-1 min-w-0">{pauta.title}</h3>
                        <Badge variant="outline" className="text-[10px]">{spreadsheetGroup(pauta.custom_fields)}</Badge>
                        <Badge variant="outline" className={cn('text-[10px]', pautaPriorityColors[pauta.priority])}>{pautaPriorityLabels[pauta.priority]}</Badge>
                        <Badge variant="outline" className={cn('text-[10px]', pautaStatusColors[pauta.status])}>{pautaStatusLabels[pauta.status]}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                        <span>{author?.full_name || 'Usuário'}</span>
                        {assignee && <><span>·</span><span>Atribuído: {assignee.full_name}</span></>}
                        {pauta.scheduled_date && <><span>·</span><span>{format(new Date(pauta.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</span></>}
                      </div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <PautaExpanded
                    pauta={pauta}
                    orgMembers={orgMembers}
                    onUpdate={(patch) => updateMut.mutate({ id: pauta.id, ...patch })}
                    onDelete={async () => {
                      const ok = await confirm({ title: 'Excluir esta pauta?', destructive: true, confirmText: 'Excluir' });
                      if (!ok) return;
                      deleteMut.mutate(pauta.id, { onSuccess: () => { toast.success('Pauta excluída'); setExpandedId(null); } });
                    }}
                    isOwner={pauta.created_by === user?.id}
                  />
                )}
              </Card>
            );
          })}
        </div>
        </>
      )}

      {/* New dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova demanda marketing</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Título</Label><Input autoFocus value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="Título da demanda" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Prioridade</Label>
                <Select value={nPriority} onValueChange={(v) => setNPriority(v as PautaPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(pautaPriorityLabels) as PautaPriority[]).map(k => (<SelectItem key={k} value={k}>{pautaPriorityLabels[k]}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Responsável</Label>
                <Select value={nAssigned || '_none'} onValueChange={(v) => setNAssigned(v === '_none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Ninguém" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Ninguém</SelectItem>
                    {orgMembers.map((m: any) => (<SelectItem key={m.id} value={m.id}>{m.full_name || 'Usuário'}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!nTitle.trim() || createMut.isPending}>Criar pauta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PautaSheetTable({
  items,
  columns,
  expandedId,
  onToggle,
  profileMap,
  renderExpanded,
}: {
  items: Pauta[];
  columns: string[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  profileMap: Map<string, { id: string; full_name: string | null }>;
  renderExpanded: (item: Pauta) => ReactNode;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, Pauta[]>();
    items.forEach((item) => {
      const group = spreadsheetGroup(item.custom_fields);
      map.set(group, [...(map.get(group) || []), item]);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
  }, [items]);

  return (
    <Card className="overflow-hidden border shadow-sm">
      <SundayTableToolbar title="Board de Demandas Marketing" count={items.length} />
      <div className="overflow-x-auto">
        <div className="min-w-max">
          <div className="grid grid-flow-col auto-cols-max border-b">
            <SheetHeaderCell className="sticky left-0 z-10 min-w-[300px] bg-muted">Elemento</SheetHeaderCell>
            <SheetHeaderCell>Status</SheetHeaderCell>
            <SheetHeaderCell>Prioridade</SheetHeaderCell>
            <SheetHeaderCell>Responsavel</SheetHeaderCell>
            <SheetHeaderCell>Data</SheetHeaderCell>
            {columns.map((column) => <SheetHeaderCell key={column}>{column}</SheetHeaderCell>)}
          </div>
          {grouped.map(([group, groupItems]) => (
            <div key={group}>
              <div className="border-b border-l-4 border-l-primary bg-primary/5 px-3 py-2 text-sm font-semibold text-foreground">
                {group} <span className="ml-2 font-normal">{groupItems.length} elementos</span>
              </div>
              {groupItems.map((item) => {
                const assignee = item.assigned_to ? (profileMap.get(item.assigned_to) as any) : null;
                const isExpanded = expandedId === item.id;
                const people = sheetField(item.custom_fields, 'Pessoas', 'Pessoa', 'Responsavel', 'Responsaveis') || assignee?.full_name || '';
                const date = sheetField(item.custom_fields, 'Data', 'Date') || (item.scheduled_date ? format(new Date(item.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '');
                return (
                  <div key={item.id} className="border-b last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onToggle(item.id)}
                      className="grid grid-flow-col auto-cols-max text-left transition-colors hover:bg-primary/5"
                    >
                      <SheetCell className="sticky left-0 z-10 flex min-w-[300px] items-center gap-2 bg-background font-medium">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <span className="truncate">{item.title}</span>
                      </SheetCell>
                      <SheetCell><Badge variant="outline" className={cn('text-[10px]', pautaStatusColors[item.status])}>{pautaStatusLabels[item.status]}</Badge></SheetCell>
                      <SheetCell><Badge variant="outline" className={cn('text-[10px]', pautaPriorityColors[item.priority])}>{pautaPriorityLabels[item.priority]}</Badge></SheetCell>
                      <SheetCell className="max-w-[220px] break-words">{people}</SheetCell>
                      <SheetCell>{date}</SheetCell>
                      {columns.map((column) => (
                        <SheetCell key={column} className="max-w-[260px] break-words">
                          {sheetValue(item.custom_fields?.[column])}
                        </SheetCell>
                      ))}
                    </button>
                    {isExpanded && <div className="min-w-[720px] bg-background">{renderExpanded(item)}</div>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function PautaExpanded({
  pauta, orgMembers, onUpdate, onDelete, isOwner,
}: {
  pauta: Pauta;
  orgMembers: { id: string; full_name: string | null }[];
  onUpdate: (patch: Partial<Pauta>) => void;
  onDelete: () => void;
  isOwner: boolean;
}) {
  const { user } = useAuth();
  const { data: items = [] } = usePautaItems(pauta.id);
  const createItem = useCreatePautaItem();
  const updateItem = useUpdatePautaItem();
  const deleteItem = useDeletePautaItem();
  const [newItemTitle, setNewItemTitle] = useState('');
  const [pautaTab, setPautaTab] = useState<'items' | 'comments' | 'activity'>('items');
  const [commentText, setCommentText] = useState('');
  const pCommentEndRef = useRef<HTMLDivElement>(null);

  const { data: pComments = [] } = usePautaComments(pauta.id);
  const addPautaComment = useAddPautaComment();
  const { data: pActivity = [] } = usePautaActivity(pauta.id);

  const pCommentUserIds = useMemo(() => [...new Set(pComments.map(c => c.user_id))], [pComments]);
  const pActivityUserIds = useMemo(() => [...new Set(pActivity.filter(a => a.user_id).map(a => a.user_id!))], [pActivity]);
  const allPautaUserIds = useMemo(() => [...new Set([...pCommentUserIds, ...pActivityUserIds])], [pCommentUserIds, pActivityUserIds]);
  const { data: pProfiles = [] } = useQuery({
    queryKey: ['pauta-detail-profiles', allPautaUserIds.sort().join(',')],
    queryFn: async () => {
      if (!allPautaUserIds.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', allPautaUserIds);
      return data || [];
    },
    enabled: allPautaUserIds.length > 0,
  });
  const pProfileMap = useMemo(() => new Map(pProfiles.map((p: any) => [p.id, p])), [pProfiles]);

  const addItem = () => {
    if (!newItemTitle.trim()) return;
    createItem.mutate({ pauta_id: pauta.id, title: newItemTitle.trim(), position: items.length }, {
      onSuccess: () => setNewItemTitle(''),
    });
  };

  const sendComment = () => {
    if (!commentText.trim()) return;
    addPautaComment.mutate({ pautaId: pauta.id, content: commentText.trim() }, {
      onSuccess: () => { setCommentText(''); setTimeout(() => pCommentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); },
    });
  };

  return (
    <div className="px-3 pb-3 border-t space-y-3 pt-3">
      {/* Editable fields */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={pauta.status} onValueChange={(v) => onUpdate({ status: v as PautaStatus })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(pautaStatusLabels) as PautaStatus[]).map(k => (<SelectItem key={k} value={k}>{pautaStatusLabels[k]}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Prioridade</Label>
          <Select value={pauta.priority} onValueChange={(v) => onUpdate({ priority: v as PautaPriority })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(pautaPriorityLabels) as PautaPriority[]).map(k => (<SelectItem key={k} value={k}>{pautaPriorityLabels[k]}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Responsável</Label>
          <Select value={pauta.assigned_to || '_none'} onValueChange={(v) => onUpdate({ assigned_to: v === '_none' ? null : v } as any)}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Ninguém" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Ninguém</SelectItem>
              {orgMembers.map((m: any) => (<SelectItem key={m.id} value={m.id}>{m.full_name || 'Usuário'}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <SpreadsheetFields fields={pauta.custom_fields} />

      {/* Tabs: Items / Comments / Activity */}
      <Tabs value={pautaTab} onValueChange={(v) => setPautaTab(v as any)}>
        <TabsList className="w-full">
          <TabsTrigger value="items" className="flex-1 text-xs"><List className="h-3 w-3 mr-1" />Itens ({items.length})</TabsTrigger>
          <TabsTrigger value="comments" className="flex-1 text-xs"><MessageCircle className="h-3 w-3 mr-1" />Comentários ({pComments.length})</TabsTrigger>
          <TabsTrigger value="activity" className="flex-1 text-xs"><Clock className="h-3 w-3 mr-1" />Atividade</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-3">
          <div className="space-y-1">
            {items.map(it => {
              const assignee = it.assigned_to ? orgMembers.find(m => m.id === it.assigned_to) : null;
              return (
              <div key={it.id} className="grid grid-cols-[auto_1fr_132px_150px_auto] items-center gap-2 rounded-md border bg-card px-2 py-1.5 group">
                <button
                  className={cn('h-4 w-4 rounded border shrink-0 flex items-center justify-center', it.status === 'concluido' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-muted-foreground/40')}
                  onClick={() => updateItem.mutate({ id: it.id, pauta_id: pauta.id, status: it.status === 'concluido' ? 'pendente' : 'concluido' })}
                >
                  {it.status === 'concluido' && <CheckCircle2 className="h-3 w-3" />}
                </button>
                <span className={cn('text-sm flex-1', it.status === 'concluido' && 'line-through text-muted-foreground')}>{it.title}</span>
                <Select
                  value={it.status || 'pendente'}
                  onValueChange={(status) => updateItem.mutate({ id: it.id, pauta_id: pauta.id, status })}
                >
                  <SelectTrigger className={cn('h-7 text-[11px]', pautaItemStatusColors[it.status] || pautaItemStatusColors.pendente)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(pautaItemStatusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={it.assigned_to || '_none'}
                  onValueChange={(assigned_to) => updateItem.mutate({ id: it.id, pauta_id: pauta.id, assigned_to: assigned_to === '_none' ? null : assigned_to } as any)}
                >
                  <SelectTrigger className="h-7 text-[11px]">
                    <SelectValue placeholder="Responsável">
                      {assignee?.full_name || 'Ninguém'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Ninguém</SelectItem>
                    {orgMembers.map((m: any) => (<SelectItem key={m.id} value={m.id}>{m.full_name || 'Usuário'}</SelectItem>))}
                  </SelectContent>
                </Select>
                <button onClick={() => deleteItem.mutate({ id: it.id, pauta_id: pauta.id })} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
                <SpreadsheetFields fields={it.custom_fields} className="col-span-5" />
              </div>
            )})}
          </div>
          <div className="flex gap-2 mt-2">
            <Input
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              placeholder="Adicionar item…"
              className="h-7 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
            />
            <Button size="sm" className="h-7 px-2" onClick={addItem} disabled={!newItemTitle.trim()}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="comments" className="mt-3">
          <div className="space-y-3 max-h-[250px] overflow-y-auto">
            {pComments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum comentário ainda.</p>
            ) : pComments.map(c => {
              const prof = pProfileMap.get(c.user_id) as any;
              return (
                <div key={c.id} className="flex gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-[10px] font-medium">
                    {(prof?.full_name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-medium">{prof?.full_name || 'Usuário'}</span>
                      <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                  </div>
                </div>
              );
            })}
            <div ref={pCommentEndRef} />
          </div>
          <div className="flex gap-2 mt-3 pt-3 border-t">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Escreva um comentário…"
              className="h-7 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
            />
            <Button size="sm" className="h-7 px-2" onClick={sendComment} disabled={!commentText.trim() || addPautaComment.isPending}>
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-3">
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {pActivity.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma atividade registrada.</p>
            ) : pActivity.map(a => {
              const prof = a.user_id ? pProfileMap.get(a.user_id) as any : null;
              return (
                <div key={a.id} className="flex items-start gap-2 text-xs">
                  <Clock className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <span className="font-medium">{prof?.full_name || 'Sistema'}</span>{' '}
                    <span className="text-muted-foreground">{a.action}</span>
                    {a.from_value && a.to_value && (
                      <span className="text-muted-foreground"> {a.from_value} → {a.to_value}</span>
                    )}
                    <span className="text-muted-foreground/60 ml-1">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {isOwner && (
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />Excluir pauta
        </Button>
      )}
    </div>
  );
}
