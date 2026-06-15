import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useProjectsByOrg, useCreateProject } from '@/hooks/useProjectData';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import SundayBoard from './SundayBoard';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

function normalizedKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, '');
}

export interface BoardCard {
  /** Unique key for this card */
  key: string;
  /** Display label */
  label: string;
  /** Color dot */
  color: string;
  /** Aliases for matching project names (e.g. 'Modulo | Melhorias | Site', '1780430139') */
  aliases: string[];
  /** Optional icon component */
  icon?: ReactNode;
}

export interface SectorBoardsPageConfig {
  /** Page title */
  title: string;
  /** Subtitle / description */
  description?: string;
  /** Board cards to display */
  cards: BoardCard[];
  /** Optional extra content rendered above the board (e.g. pipeline tracker) */
  headerExtra?: ReactNode;
  /** Prefix for auto-discovering and creating new boards (e.g. 'Modulo | Programacao') */
  modulePrefix?: string;
}

function findProject(projects: any[], aliases: string[]): any | null {
  for (const alias of aliases) {
    const key = normalizedKey(alias);
    const found = projects.find((p: any) => normalizedKey(p.name).includes(key));
    if (found) return found;
  }
  return null;
}

function InlineEditable({ value, onSave, className }: { value: string; onSave: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  if (!editing) {
    return (
      <span
        className={cn('cursor-pointer group/edit inline-flex items-center gap-1.5', className)}
        onDoubleClick={() => { setDraft(value); setEditing(true); }}
        title="Duplo-clique para editar"
      >
        {value}
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/edit:opacity-100 transition-opacity" />
      </span>
    );
  }

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setEditing(false);
  };

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      className={cn('bg-transparent border-b border-primary outline-none', className)}
    />
  );
}

const BOARD_COLORS = ['#EC4899', '#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6', '#F43F5E', '#06B6D4', '#64748B'];

export default function SectorBoardsPage({ title, description, cards, headerExtra, modulePrefix }: SectorBoardsPageConfig) {
  const { currentOrg } = useOrganization();
  const { data: projects = [], isLoading } = useProjectsByOrg(currentOrg?.id);
  const createProject = useCreateProject();
  const [activeKey, setActiveKey] = useState(cards[0]?.key || '');
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');

  const TITLE_KEY = `sector-title:${title}`;
  const DESC_KEY = `sector-desc:${title}`;
  const [displayTitle, setDisplayTitle] = useState(() => localStorage.getItem(TITLE_KEY) || title);
  const [displayDesc, setDisplayDesc] = useState(() => localStorage.getItem(DESC_KEY) || description || '');

  const knownProjectIds = new Set<string>();
  const resolvedCards = cards.map((card) => {
    const project = findProject(projects, card.aliases);
    if (project) knownProjectIds.add(project.id);
    return { ...card, project };
  });

  const extraCards = useMemo(() => {
    if (!modulePrefix) return [];
    const prefix = normalizedKey(modulePrefix);
    return projects
      .filter((p: any) => normalizedKey(p.name).startsWith(prefix) && !knownProjectIds.has(p.id))
      .map((p: any, i: number) => {
        const suffix = p.name.replace(/^.*\|\s*/, '').trim();
        return {
          key: `extra-${p.id}`,
          label: suffix || p.name,
          color: BOARD_COLORS[(resolvedCards.length + i) % BOARD_COLORS.length],
          aliases: [p.name],
          project: p,
        };
      });
  }, [projects, modulePrefix, knownProjectIds.size]);

  const allCards = [...resolvedCards, ...extraCards];
  const activeCard = allCards.find((c) => c.key === activeKey) || allCards[0];

  const handleCreateBoard = () => {
    if (!newBoardName.trim() || !modulePrefix) return;
    const fullName = `${modulePrefix} | ${newBoardName.trim()}`;
    createProject.mutate(
      { name: fullName, organizationId: currentOrg?.id },
      {
        onSuccess: () => {
          toast.success('Board criado!');
          setShowNewBoard(false);
          setNewBoardName('');
        },
        onError: () => toast.error('Erro ao criar board'),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            <InlineEditable
              value={displayTitle}
              onSave={(v) => { setDisplayTitle(v); localStorage.setItem(TITLE_KEY, v); }}
            />
          </h1>
          {displayDesc && (
            <p className="text-sm text-muted-foreground">
              <InlineEditable
                value={displayDesc}
                onSave={(v) => { setDisplayDesc(v); localStorage.setItem(DESC_KEY, v); }}
                className="text-sm text-muted-foreground"
              />
            </p>
          )}
        </div>
        {modulePrefix && (
          <Button variant="outline" size="sm" onClick={() => setShowNewBoard(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo board
          </Button>
        )}
      </div>

      {allCards.length > 1 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {allCards.map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={() => setActiveKey(card.key)}
              className={cn(
                'rounded-md border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/40',
                activeKey === card.key && 'border-primary ring-1 ring-primary/30',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: card.color }} />
                  {card.icon}
                  {card.label}
                </span>
                <Badge variant="outline" className="text-[10px]">Sunday</Badge>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                {card.project ? 'Abrir board completo' : isLoading ? 'Carregando...' : 'Projeto nao encontrado'}
              </div>
            </button>
          ))}
        </div>
      )}

      {headerExtra}

      {activeCard?.project ? (
        <SundayBoard projectId={activeCard.project.id} />
      ) : (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {isLoading ? 'Carregando board...' : `Board Sunday de ${activeCard?.label || title} nao encontrado em Projetos.`}
        </Card>
      )}

      <Dialog open={showNewBoard} onOpenChange={setShowNewBoard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Board</DialogTitle>
          </DialogHeader>
          <div className="text-xs text-muted-foreground mb-1">
            Será criado como: <strong>{modulePrefix} | {newBoardName || '...'}</strong>
          </div>
          <Input
            autoFocus
            placeholder="Nome do board"
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateBoard()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewBoard(false)}>Cancelar</Button>
            <Button onClick={handleCreateBoard} disabled={!newBoardName.trim() || createProject.isPending}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
