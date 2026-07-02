import { useProjects, useCreateProject, useUpdateProject, useProjectTasks, type TaskWithAssignees, type TaskStatus, type TaskPriority } from '@/hooks/useProjectData';
import { useAssigneeProfiles } from '@/hooks/useAssigneeProfiles';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { useProjectTemplates, useSaveProjectAsTemplate, useCreateProjectFromTemplate, useDeleteProjectTemplate } from '@/hooks/useProjectTemplates';
import { useProjectColumns, type ColumnType, type ProjectColumn } from '@/hooks/useProjectColumns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, FolderKanban, Loader2, ChevronDown, ChevronRight, Search, LayoutGrid, X, MoreHorizontal, Pencil, Trash2, FileStack, Columns3, GanttChart, CalendarDays, Archive, Copy, Download, CheckSquare, ArrowUp, ArrowDown, Palette, Sparkles } from 'lucide-react';
import { useState, useMemo, useCallback, useEffect, useRef, type CSSProperties, type MutableRefObject, type UIEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { TaskSidePanel } from '@/components/kanban/TaskSidePanel';
import { LabelEditorDialog, type LabelOption } from '@/components/table/LabelEditor';
import { PromptDialog } from '@/components/PromptDialog';
import { useConfirm } from '@/components/ConfirmDialog';
import { SundayMobileList, ColumnCell } from '@/features/boards';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { useTaskCommentCounts } from '@/hooks/useTaskCommentCounts';
import { useBoardPreferences, type BoardPreferences } from '@/hooks/useBoardPreferences';
import { useDateActionReminders } from '@/hooks/useDateActionReminders';

// Extracted components
import {
  statusLabels, statusCellColors, priorityLabels, priorityCellColors,
  groupColors, statusOrder, priorityOrder, columnTypeLabels,
  FIXED_COLUMNS, fixedColumnLabels, type FixedColumnKey,
  type SortField, type SortDir, type GroupBy, type ViewMode,
  getMonthYearKey, getMonthYearLabel, taskMatchesAssignee, taskMatchesSearch,
} from '@/features/boards/constants';
import { FilterPopover, SortPopover, GroupByPopover, HideColumnsPopover, FixedColHeader, ColumnHeaderMenu, AddColumnButton } from '@/features/boards/components/TableToolbar';
import { SundayKanbanView, SundayTimelineView, SundayCalendarView } from '@/features/boards/components/SundayViews';
import { TaskRow } from '@/features/boards/components/TaskRow';

type TableViewPageProps = {
  projectId?: string;
  embedded?: boolean;
};

type BoardGroup = {
  key: string;
  label: string;
  tasks: TaskWithAssignees[];
  color: string;
};

type GroupScrollTargets = MutableRefObject<Record<string, HTMLDivElement | null>>;

function StickyGroupScrollbar({
  groupKey,
  targetRefs,
  color,
  refreshKey,
}: {
  groupKey: string;
  targetRefs: GroupScrollTargets;
  color: string;
  refreshKey: string;
}) {
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({ scrollWidth: 0, clientWidth: 0 });
  const [placement, setPlacement] = useState({ fixed: false, left: 0, width: 0 });

  const getTarget = useCallback(() => targetRefs.current[groupKey] ?? null, [groupKey, targetRefs]);

  const updateMetrics = useCallback(() => {
    const target = getTarget();
    if (!target) return;

    const nextMetrics = {
      scrollWidth: target.scrollWidth,
      clientWidth: target.clientWidth,
    };
    const rect = target.getBoundingClientRect();
    const viewportPadding = 12;
    const anchorY = window.innerHeight - 28;
    const shouldFix = nextMetrics.scrollWidth > nextMetrics.clientWidth + 1
      && rect.top < anchorY
      && rect.bottom > anchorY;
    const left = Math.max(rect.left, viewportPadding);
    const width = Math.max(0, Math.min(rect.width, window.innerWidth - left - viewportPadding));

    setMetrics((current) => (
      current.scrollWidth === nextMetrics.scrollWidth && current.clientWidth === nextMetrics.clientWidth
        ? current
        : nextMetrics
    ));
    setPlacement((current) => (
      current.fixed === shouldFix && current.left === left && current.width === width
        ? current
        : { fixed: shouldFix, left, width }
    ));

    const scrollbar = scrollbarRef.current;
    if (scrollbar && scrollbar.scrollLeft !== target.scrollLeft) {
      scrollbar.scrollLeft = target.scrollLeft;
    }
  }, [getTarget]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(updateMetrics);
    const target = getTarget();

    if (!target) {
      return () => window.cancelAnimationFrame(frameId);
    }

    const syncFromTable = () => {
      const scrollbar = scrollbarRef.current;
      if (scrollbar && scrollbar.scrollLeft !== target.scrollLeft) {
        scrollbar.scrollLeft = target.scrollLeft;
      }
    };

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateMetrics)
      : null;

    target.addEventListener('scroll', syncFromTable, { passive: true });
    resizeObserver?.observe(target);
    if (target.firstElementChild) resizeObserver?.observe(target.firstElementChild);
    window.addEventListener('scroll', updateMetrics, { passive: true });
    window.addEventListener('resize', updateMetrics);

    return () => {
      window.cancelAnimationFrame(frameId);
      target.removeEventListener('scroll', syncFromTable);
      resizeObserver?.disconnect();
      window.removeEventListener('scroll', updateMetrics);
      window.removeEventListener('resize', updateMetrics);
    };
  }, [getTarget, updateMetrics, refreshKey]);

  const handleScrollbarScroll = (event: UIEvent<HTMLDivElement>) => {
    const target = getTarget();
    if (!target || target.scrollLeft === event.currentTarget.scrollLeft) return;
    target.scrollLeft = event.currentTarget.scrollLeft;
  };

  if (metrics.scrollWidth <= metrics.clientWidth + 1) return null;

  return (
    <div
      className={[
        placement.fixed ? 'fixed z-50 rounded-md border border-border shadow-lg' : 'sticky bottom-0 z-20 border-t border-border',
        'bg-card/95 px-2 py-1 backdrop-blur supports-[backdrop-filter]:bg-card/85',
      ].join(' ')}
      style={{
        '--group-scrollbar-thumb': color,
        ...(placement.fixed ? { left: placement.left, width: placement.width, bottom: 12 } : {}),
      } as CSSProperties}
    >
      <div
        ref={scrollbarRef}
        className="sunday-group-scrollbar overflow-x-auto overflow-y-hidden"
        onScroll={handleScrollbarScroll}
        aria-label="Rolagem horizontal do grupo"
      >
        <div style={{ width: metrics.scrollWidth, height: 1 }} />
      </div>
    </div>
  );
}

function parseNumericValue(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumericTotal(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

export default function TableViewPage({ projectId, embedded = false }: TableViewPageProps = {}) {
  const { data: projects, isLoading: loadingProjects } = useProjects();
  const createProject = useCreateProject();
  const updateProjectMeta = useUpdateProject();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectFromUrl = searchParams.get('projeto');
  const isMobile = useMediaQuery('(max-width: 639px)');

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [sidePanelTask, setSidePanelTask] = useState<{ task: TaskWithAssignees; parent?: TaskWithAssignees } | null>(null);
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Set<TaskStatus>>(new Set());
  const [filterPriority, setFilterPriority] = useState<Set<TaskPriority>>(new Set());
  const [filterAssignee, setFilterAssignee] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [dynamicGroupColumnId, setDynamicGroupColumnId] = useState<string | null>(null);
  const [dynamicColumnFilters, setDynamicColumnFilters] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [visibleColumns, setVisibleColumns] = useState<Set<FixedColumnKey>>(new Set(FIXED_COLUMNS));
  const [editingLabelType, setEditingLabelType] = useState<'status' | 'priority' | null>(null);
  const [groupRenames, setGroupRenames] = useState<Record<string, string>>(() => {
    try { const s = localStorage.getItem(`mooui_group_names_${projectFromUrl}`); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [groupColorOverrides, setGroupColorOverrides] = useState<Record<string, string>>(() => {
    try { const s = localStorage.getItem(`mooui_group_colors_${projectFromUrl}`); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [customGroups, setCustomGroups] = useState<{ key: string; label: string; color: string }[]>(() => {
    try { const s = localStorage.getItem(`mooui_custom_groups_${projectFromUrl}`); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [groupOrder, setGroupOrder] = useState<string[]>(() => {
    try { const s = localStorage.getItem(`mooui_group_order_${projectFromUrl}`); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [fixedColumnLabelOverrides, setFixedColumnLabelOverrides] = useState<Partial<Record<FixedColumnKey, string>>>(() => {
    try { const s = localStorage.getItem(`mooui_fixed_col_labels_${projectFromUrl}`); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const onDragStartTask = useCallback((id: string) => setDraggedTaskId(id), []);
  const onDragEndTask = useCallback(() => setDraggedTaskId(null), []);

  const [columnOrder, setColumnOrder] = useState<FixedColumnKey[]>(() => {
    try { const s = localStorage.getItem(`mooui_col_order_${projectFromUrl}`); if (s) return JSON.parse(s); } catch {}
    return [...FIXED_COLUMNS];
  });
  const [hiddenDynamicColumnIds, setHiddenDynamicColumnIds] = useState<Set<string>>(() => {
    try { const s = localStorage.getItem(`mooui_hidden_dynamic_cols_${projectFromUrl}`); return new Set(s ? JSON.parse(s) : []); } catch {}
    return new Set();
  });
  const dragColRef = useRef<string | null>(null);
  const groupScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [statusLabelsConfig, setStatusLabelsConfig] = useState<LabelOption[]>(() => {
    const saved = localStorage.getItem(`mooui_status_labels_${projectFromUrl}`);
    if (saved) return JSON.parse(saved);
    return [
      { id: 'backlog', text: 'Backlog', color: '#6B7280' },
      { id: 'todo', text: 'Não Iniciado', color: '#3B82F6' },
      { id: 'in_progress', text: 'Em Andamento', color: '#F59E0B' },
      { id: 'in_review', text: 'Aguardando Revisão', color: '#8B5CF6' },
      { id: 'done', text: 'Feito', color: '#22C55E' },
    ];
  });

  const [priorityLabelsConfig, setPriorityLabelsConfig] = useState<LabelOption[]>(() => {
    const saved = localStorage.getItem(`mooui_priority_labels_${projectFromUrl}`);
    if (saved) return JSON.parse(saved);
    return [
      { id: 'low', text: 'Baixa', color: '#6B7280' },
      { id: 'medium', text: 'Média', color: '#F59E0B' },
      { id: 'high', text: 'Alta', color: '#EF4444' },
      { id: 'critical', text: 'Crítica', color: '#B91C1C' },
    ];
  });

  const handleSaveStatusLabels = (labels: LabelOption[]) => {
    setStatusLabelsConfig(labels);
    localStorage.setItem(`mooui_status_labels_${projectFromUrl}`, JSON.stringify(labels));
    toast.success('Etiquetas de status atualizadas!');
  };

  const handleSavePriorityLabels = (labels: LabelOption[]) => {
    setPriorityLabelsConfig(labels);
    localStorage.setItem(`mooui_priority_labels_${projectFromUrl}`, JSON.stringify(labels));
    toast.success('Etiquetas de prioridade atualizadas!');
  };

  const activeProjectId = projectId || projectFromUrl || projects?.[0]?.id;
  const { tasks, isLoading: loadingTasks, addTask, updateTask, archiveTask, deleteTask } = useProjectTasks(activeProjectId);
  const { columns: dynamicColumns, customValues, addColumn, updateColumn, deleteColumn, setCustomValue } = useProjectColumns(activeProjectId);
  const { members: projectMembers, addAssignee, removeAssignee } = useProjectMembers(activeProjectId);
  const { preferences: boardPreferences, updatePreferences: updateBoardPreferences } = useBoardPreferences(activeProjectId);
  const { configureDateActionReminders } = useDateActionReminders(activeProjectId);
  const { data: projectTemplates = [] } = useProjectTemplates();
  const saveAsTemplate = useSaveProjectAsTemplate();
  const applyTemplate = useCreateProjectFromTemplate();
  const deleteTemplate = useDeleteProjectTemplate();
  const [pinnedTaskIds, setPinnedTaskIds] = useState<Set<string>>(new Set());

  const persistBoardPreferences = useCallback((patch: BoardPreferences) => {
    if (!activeProjectId) return;
    updateBoardPreferences.mutate(patch, {
      onError: (error: any) => {
        console.warn('Failed to sync board preferences', error);
      },
    });
  }, [activeProjectId, updateBoardPreferences]);

  useEffect(() => {
    if (!activeProjectId) {
      setPinnedTaskIds(new Set());
      setHiddenDynamicColumnIds(new Set());
      setGroupColorOverrides({});
      setCustomGroups([]);
      setGroupOrder([]);
      setDynamicColumnFilters({});
      setDynamicGroupColumnId(null);
      setFixedColumnLabelOverrides({});
      return;
    }
    try {
      const stored = localStorage.getItem(`mooui_pinned_tasks_${activeProjectId}`);
      setPinnedTaskIds(new Set(stored ? JSON.parse(stored) : []));
    } catch {
      setPinnedTaskIds(new Set());
    }
    try {
      const stored = localStorage.getItem(`mooui_hidden_dynamic_cols_${activeProjectId}`);
      setHiddenDynamicColumnIds(new Set(stored ? JSON.parse(stored) : []));
    } catch {
      setHiddenDynamicColumnIds(new Set());
    }
    try {
      const stored = localStorage.getItem(`mooui_group_colors_${activeProjectId}`);
      setGroupColorOverrides(stored ? JSON.parse(stored) : {});
    } catch {
      setGroupColorOverrides({});
    }
    try {
      const stored = localStorage.getItem(`mooui_custom_groups_${activeProjectId}`);
      setCustomGroups(stored ? JSON.parse(stored) : []);
    } catch {
      setCustomGroups([]);
    }
    try {
      const stored = localStorage.getItem(`mooui_group_order_${activeProjectId}`);
      setGroupOrder(stored ? JSON.parse(stored) : []);
    } catch {
      setGroupOrder([]);
    }
    try {
      const stored = localStorage.getItem(`mooui_fixed_col_labels_${activeProjectId}`);
      setFixedColumnLabelOverrides(stored ? JSON.parse(stored) : {});
    } catch {
      setFixedColumnLabelOverrides({});
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (!boardPreferences) return;
    if (boardPreferences.pinned_task_ids) setPinnedTaskIds(new Set(boardPreferences.pinned_task_ids));
    if (boardPreferences.hidden_dynamic_column_ids) setHiddenDynamicColumnIds(new Set(boardPreferences.hidden_dynamic_column_ids));
    if (boardPreferences.group_names) setGroupRenames(boardPreferences.group_names);
    if (boardPreferences.group_colors) setGroupColorOverrides(boardPreferences.group_colors);
    if (boardPreferences.custom_groups) setCustomGroups(boardPreferences.custom_groups);
    if (boardPreferences.group_order) setGroupOrder(boardPreferences.group_order);
    if (boardPreferences.fixed_column_labels) setFixedColumnLabelOverrides(boardPreferences.fixed_column_labels);
    if (boardPreferences.dynamic_column_filters) setDynamicColumnFilters(boardPreferences.dynamic_column_filters);
    if (boardPreferences.dynamic_group_column_id !== undefined) setDynamicGroupColumnId(boardPreferences.dynamic_group_column_id);
    if (boardPreferences.fixed_column_order) {
      const allowed = new Set(FIXED_COLUMNS);
      const savedOrder = boardPreferences.fixed_column_order.filter((col): col is FixedColumnKey => allowed.has(col as FixedColumnKey));
      const missing = FIXED_COLUMNS.filter(col => !savedOrder.includes(col));
      setColumnOrder([...savedOrder, ...missing]);
    }
  }, [boardPreferences]);

  const allAssigneeIds = useMemo(() => {
    const ids = new Set<string>();
    tasks.forEach(t => {
      t.task_assignees.forEach(a => ids.add(a.user_id));
      t.subtasks?.forEach(sub => sub.task_assignees.forEach(a => ids.add(a.user_id)));
    });
    return Array.from(ids);
  }, [tasks]);

  const { data: profilesMap } = useAssigneeProfiles(allAssigneeIds);

  const allTaskIds = useMemo(() => {
    const ids: string[] = [];
    tasks.forEach(t => { ids.push(t.id); t.subtasks?.forEach(s => ids.push(s.id)); });
    return ids;
  }, [tasks]);
  const { data: commentCounts } = useTaskCommentCounts(allTaskIds);

  const orderedColumns = useMemo(
    () => columnOrder.filter(col => visibleColumns.has(col)),
    [columnOrder, visibleColumns],
  );
  const visibleDynamicColumns = useMemo(
    () => dynamicColumns.filter((col) => !hiddenDynamicColumnIds.has(col.id)),
    [dynamicColumns, hiddenDynamicColumnIds],
  );

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      result = result.filter(t => taskMatchesSearch(t, lower));
    }
    if (filterStatus.size > 0) result = result.filter(t => filterStatus.has(t.status) || t.subtasks?.some(s => filterStatus.has(s.status)));
    if (filterPriority.size > 0) result = result.filter(t => filterPriority.has(t.priority) || t.subtasks?.some(s => filterPriority.has(s.priority)));
    if (filterAssignee.size > 0) result = result.filter(t => taskMatchesAssignee(t, filterAssignee));
    Object.entries(dynamicColumnFilters).forEach(([columnId, filterValue]) => {
      const lower = filterValue.trim().toLowerCase();
      if (!lower) return;
      result = result.filter(task => {
        const taskValue = customValues.get(task.id)?.get(columnId) || '';
        const subtaskMatch = task.subtasks?.some(subtask => (customValues.get(subtask.id)?.get(columnId) || '').toLowerCase().includes(lower));
        return taskValue.toLowerCase().includes(lower) || !!subtaskMatch;
      });
    });
    return result;
  }, [tasks, searchText, filterStatus, filterPriority, filterAssignee, dynamicColumnFilters, customValues]);

  const sortedTasks = useMemo(() => {
    const sorted = !sortField ? [...filteredTasks] : [...filteredTasks].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'title': cmp = a.title.localeCompare(b.title, 'pt-BR'); break;
        case 'priority': cmp = priorityOrder[a.priority] - priorityOrder[b.priority]; break;
        case 'status': cmp = statusOrder[a.status] - statusOrder[b.status]; break;
        case 'due_date': cmp = (a.due_date || '').localeCompare(b.due_date || ''); break;
        case 'created_at': cmp = a.created_at.localeCompare(b.created_at); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return sorted.sort((a, b) => Number(pinnedTaskIds.has(b.id)) - Number(pinnedTaskIds.has(a.id)));
  }, [filteredTasks, sortField, sortDir, pinnedTaskIds]);

  const groups = useMemo(() => {
    const grouped = new Map<string, TaskWithAssignees[]>();
    const dynamicGroupColumn = dynamicColumns.find(column => column.id === dynamicGroupColumnId);
    const customGroupMap = new Map(customGroups.map(group => [group.key, group]));
    sortedTasks.forEach(task => {
      let key: string;
      const manualGroupKey = (task as any).group_key as string | null | undefined;
      if (manualGroupKey && customGroupMap.has(manualGroupKey)) {
        key = manualGroupKey;
      } else if (dynamicGroupColumn) {
        const value = customValues.get(task.id)?.get(dynamicGroupColumn.id)?.trim() || 'Sem valor';
        key = `custom:${dynamicGroupColumn.id}:${value}`;
      } else {
        switch (groupBy) {
          case 'month': key = getMonthYearKey(task.due_date || task.created_at); break;
          case 'status': key = task.status; break;
          case 'priority': key = task.priority; break;
          case 'none': key = 'all'; break;
        }
      }
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(task);
    });
    const entries = Array.from(grouped.entries()).sort(([a], [b]) => {
      if (dynamicGroupColumn) return a.localeCompare(b, 'pt-BR', { numeric: true });
      if (groupBy === 'status') return statusOrder[a as TaskStatus] - statusOrder[b as TaskStatus];
      if (groupBy === 'priority') return priorityOrder[a as TaskPriority] - priorityOrder[b as TaskPriority];
      return a.localeCompare(b);
    });
    const computedGroups = entries.map(([key, tsks], i) => {
      let label: string;
      const manualGroup = customGroupMap.get(key);
      if (manualGroup) {
        label = groupRenames[key] || manualGroup.label;
      } else if (dynamicGroupColumn) {
        label = `${dynamicGroupColumn.name}: ${key.split(':').slice(2).join(':')}`;
      } else {
        switch (groupBy) {
          case 'month': label = getMonthYearLabel(key); break;
          case 'status': label = statusLabels[key as TaskStatus] || key; break;
          case 'priority': label = priorityLabels[key as TaskPriority] || key; break;
          case 'none': label = 'Todos os elementos'; break;
        }
      }
      return { key, label, tasks: tsks, color: groupColorOverrides[key] || groupColors[i % groupColors.length] };
    });
    const existingKeys = new Set(computedGroups.map(group => group.key));
    const manualGroups = customGroups
      .filter(group => !existingKeys.has(group.key))
      .map(group => ({ ...group, color: groupColorOverrides[group.key] || group.color, tasks: [] as TaskWithAssignees[] }));
    const allGroups = [...computedGroups, ...manualGroups];
    if (groupOrder.length === 0) return allGroups;
    return [...allGroups].sort((a, b) => {
      const ai = groupOrder.indexOf(a.key);
      const bi = groupOrder.indexOf(b.key);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [sortedTasks, groupBy, dynamicGroupColumnId, dynamicColumns, customValues, groupColorOverrides, groupRenames, customGroups, groupOrder]);

  const toggleGroup = (key: string) => { setCollapsedGroups(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; }); };
  const expandGroup = (key: string) => setCollapsedGroups(prev => { const next = new Set(prev); next.delete(key); return next; });
  const collapseGroup = (key: string) => setCollapsedGroups(prev => new Set(prev).add(key));
  const expandAllGroups = () => setCollapsedGroups(new Set());
  const collapseAllGroups = () => setCollapsedGroups(new Set(groups.map(group => group.key)));
  const toggleExpand = useCallback((taskId: string) => { setExpandedTasks(prev => { const next = new Set(prev); if (next.has(taskId)) next.delete(taskId); else next.add(taskId); return next; }); }, []);
  const expandSubtasks = (taskIds: string[]) => setExpandedTasks(prev => new Set([...prev, ...taskIds]));
  const collapseSubtasks = (taskIds: string[]) => setExpandedTasks(prev => {
    const next = new Set(prev);
    taskIds.forEach(id => next.delete(id));
    return next;
  });
  const topLevelIdsWithSubtasks = (group: BoardGroup) => group.tasks.filter(task => (task.subtasks?.length || 0) > 0).map(task => task.id);
  const allTopLevelIdsWithSubtasks = () => groups.flatMap(group => topLevelIdsWithSubtasks(group));
  const toggleColumn = useCallback((col: FixedColumnKey) => { setVisibleColumns(prev => { const next = new Set(prev); if (next.has(col)) next.delete(col); else next.add(col); return next; }); }, []);
  const hideDynamicColumn = useCallback((columnId: string) => {
    setHiddenDynamicColumnIds((prev) => {
      const next = new Set(prev);
      next.add(columnId);
      localStorage.setItem(`mooui_hidden_dynamic_cols_${activeProjectId}`, JSON.stringify(Array.from(next)));
      persistBoardPreferences({ hidden_dynamic_column_ids: Array.from(next) });
      return next;
    });
    toast.success('Coluna oculta');
  }, [activeProjectId, persistBoardPreferences]);
  const toggleDynamicColumn = useCallback((columnId: string) => {
    setHiddenDynamicColumnIds((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) next.delete(columnId);
      else next.add(columnId);
      localStorage.setItem(`mooui_hidden_dynamic_cols_${activeProjectId}`, JSON.stringify(Array.from(next)));
      persistBoardPreferences({ hidden_dynamic_column_ids: Array.from(next) });
      return next;
    });
  }, [activeProjectId, persistBoardPreferences]);
  const setSelectedProject = (id: string) => {
    if (!embedded) setSearchParams({ projeto: id });
  };

  const getGroupAggregate = useCallback((group: BoardGroup, column: ProjectColumn): string => {
    const groupTasks = group.tasks.flatMap(task => [task, ...(task.subtasks || [])]);
    const values = groupTasks.map(task => customValues.get(task.id)?.get(column.id) || '').filter(Boolean);

    if (column.column_type === 'numeros') {
      const numbers = values.map(parseNumericValue).filter((value): value is number => value !== null);
      if (numbers.length === 0) return '';
      const total = numbers.reduce((sum, value) => sum + value, 0);
      return `Total ${formatNumericTotal(total)}`;
    }

    if (column.column_type === 'checkbox') {
      const checked = values.filter(value => value === 'true' || value === '1').length;
      if (values.length === 0) return '';
      return `${checked}/${values.length} marcados`;
    }

    if (column.column_type === 'rating') {
      const ratings = values.map(parseNumericValue).filter((value): value is number => value !== null && value > 0);
      if (ratings.length === 0) return '';
      const average = ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
      return `Media ${formatNumericTotal(average)}`;
    }

    return '';
  }, [customValues]);

  type PromptState = { title: string; label?: string; defaultValue?: string; placeholder?: string; confirmLabel?: string; multiline?: boolean; onSubmit: (v: string) => void } | null;
  const [promptState, setPromptState] = useState<PromptState>(null);

  const handleCreateProject = () => {
    setPromptState({
      title: 'Novo projeto', label: 'Nome', placeholder: 'Ex.: Lançamento Q1', confirmLabel: 'Criar',
      onSubmit: (name) => {
        createProject.mutate({ name }, { onSuccess: (project) => { setSelectedProject(project.id); toast.success('Projeto criado!'); } });
        setPromptState(null);
      },
    });
  };

  const handleQuickAdd = (status: TaskStatus = 'todo', parentId?: string, groupKey?: string | null) => {
    setPromptState({
      title: parentId ? 'Novo subelemento' : 'Nova tarefa',
      label: 'Título', placeholder: parentId ? 'Título do subelemento' : 'Título da tarefa', confirmLabel: 'Criar',
      onSubmit: (title) => {
        addTask.mutate({ title, status, priority: 'medium', parent_task_id: parentId, group_key: parentId ? null : groupKey }, { onSuccess: () => toast.success(parentId ? 'Subelemento criado!' : 'Tarefa criada!') });
        setPromptState(null);
      },
    });
  };

  const handleInlineUpdate = (taskId: string, updates: Record<string, unknown>) => { updateTask.mutate({ taskId, updates }); };
  const handleClickTask = (task: TaskWithAssignees, parent?: TaskWithAssignees) => { setSidePanelTask({ task, parent }); };

  const handleAddColumn = (name: string, type: ColumnType) => {
    addColumn.mutate({ name, columnType: type }, { onSuccess: () => toast.success('Coluna adicionada!') });
  };

  const handleRenameColumn = (col: ProjectColumn) => {
    setPromptState({
      title: 'Renomear coluna', label: 'Novo nome', defaultValue: col.name, confirmLabel: 'Salvar',
      onSubmit: (newName) => {
        if (newName !== col.name) updateColumn.mutate({ columnId: col.id, updates: { name: newName } });
        setPromptState(null);
      },
    });
  };

  const handleRenameFixedColumn = (col: FixedColumnKey) => {
    setPromptState({
      title: 'Renomear coluna',
      label: 'Novo nome',
      defaultValue: fixedColumnLabelOverrides[col] || fixedColumnLabels[col],
      confirmLabel: 'Salvar',
      onSubmit: (newName) => {
        const trimmed = newName.trim();
        const next = { ...fixedColumnLabelOverrides };
        if (!trimmed || trimmed === fixedColumnLabels[col]) delete next[col];
        else next[col] = trimmed;
        setFixedColumnLabelOverrides(next);
        if (activeProjectId) {
          localStorage.setItem(`mooui_fixed_col_labels_${activeProjectId}`, JSON.stringify(next));
          persistBoardPreferences({ fixed_column_labels: next });
        }
        toast.success('Coluna renomeada');
        setPromptState(null);
      },
    });
  };

  const handleDeleteColumn = async (col: ProjectColumn) => {
    const ok = await confirm({ title: `Excluir coluna "${col.name}"?`, destructive: true, confirmText: 'Excluir' });
    if (ok) {
      deleteColumn.mutate(col.id, { onSuccess: () => toast.success('Coluna excluída!') });
    }
  };

  const handleToggleCardVisibility = (col: ProjectColumn) => {
    const showOnCard = !col.config?.show_on_card;
    updateColumn.mutate({
      columnId: col.id,
      updates: { config: { ...col.config, show_on_card: showOnCard } },
    }, {
      onSuccess: () => toast.success(showOnCard ? 'Coluna visível no card' : 'Coluna oculta do card'),
    });
  };

  const handleMoveColumn = (col: ProjectColumn, direction: 'left' | 'right') => {
    const idx = dynamicColumns.findIndex(c => c.id === col.id);
    const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= dynamicColumns.length) return;
    const other = dynamicColumns[swapIdx];
    updateColumn.mutate({ columnId: col.id, updates: { position: other.position } });
    updateColumn.mutate({ columnId: other.id, updates: { position: col.position } });
  };

  const handleEditColumnOptions = (col: ProjectColumn) => {
    const currentOptions = Array.isArray(col.config?.options) ? col.config.options : [];
    const currentStr = (currentOptions as { value?: string; label?: string }[])
      .map((o: any) => typeof o === 'string' ? o : (o.label || o.value || ''))
      .join('\n');
    setPromptState({
      title: `Opções de "${col.name}"`,
      label: 'Uma opção por linha',
      defaultValue: currentStr,
      confirmLabel: 'Salvar',
      multiline: true,
      onSubmit: (text) => {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const options = col.column_type === 'tags'
          ? lines
          : lines.map((label) => ({ value: label.toLowerCase().replace(/\s+/g, '_'), label, color: undefined }));
        updateColumn.mutate({
          columnId: col.id,
          updates: { config: { ...col.config, options } },
        }, {
          onSuccess: () => toast.success('Opções salvas'),
        });
        setPromptState(null);
      },
    });
  };

  const handleDuplicateColumn = async (col: ProjectColumn) => {
    try {
      const created = await addColumn.mutateAsync({
        name: `${col.name} copia`,
        columnType: col.column_type,
        config: { ...col.config },
      });
      const entries = Array.from(customValues.entries())
        .map(([taskId, values]) => ({ taskId, value: values.get(col.id) }))
        .filter((entry): entry is { taskId: string; value: string } => !!entry.value);
      await Promise.all(entries.map(entry => setCustomValue.mutateAsync({
        taskId: entry.taskId,
        columnId: created.id,
        value: entry.value,
      })));
      toast.success('Coluna duplicada com valores');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao duplicar coluna');
    }
  };

  const handleChangeColumnType = (col: ProjectColumn) => {
    const validTypes: ColumnType[] = ['status', 'texto', 'pessoas', 'cronograma', 'data', 'tags', 'numeros', 'checkbox', 'link', 'rating', 'select'];
    setPromptState({
      title: 'Alterar tipo da coluna',
      label: `Tipo (${validTypes.join(', ')})`,
      defaultValue: col.column_type,
      confirmLabel: 'Alterar',
      onSubmit: (type) => {
        const nextType = type.trim() as ColumnType;
        if (!validTypes.includes(nextType)) {
          toast.error('Tipo de coluna invalido');
          return;
        }
        updateColumn.mutate({
          columnId: col.id,
          updates: { column_type: nextType },
        }, {
          onSuccess: () => toast.success(`Tipo alterado para ${columnTypeLabels[nextType]}`),
        });
        setPromptState(null);
      },
    });
  };

  const handleFilterDynamicColumn = (col: ProjectColumn) => {
    setPromptState({
      title: `Filtrar "${col.name}"`,
      label: 'Valor contem',
      defaultValue: dynamicColumnFilters[col.id] || '',
      confirmLabel: 'Aplicar',
      onSubmit: (value) => {
        const trimmed = value.trim();
        const next = { ...dynamicColumnFilters };
        if (trimmed) next[col.id] = trimmed;
        else delete next[col.id];
        setDynamicColumnFilters(next);
        persistBoardPreferences({ dynamic_column_filters: next });
        toast.success(trimmed ? 'Filtro aplicado' : 'Filtro removido');
        setPromptState(null);
      },
    });
  };

  const handleClearDynamicColumnFilter = (columnId: string) => {
    const next = { ...dynamicColumnFilters };
    delete next[columnId];
    setDynamicColumnFilters(next);
    persistBoardPreferences({ dynamic_column_filters: next });
    toast.success('Filtro removido');
  };

  const handleToggleDynamicGroup = (columnId: string) => {
    const next = dynamicGroupColumnId === columnId ? null : columnId;
    setDynamicGroupColumnId(next);
    if (next) setGroupBy('none');
    persistBoardPreferences({ dynamic_group_column_id: next });
    toast.success(next ? 'Agrupamento por coluna aplicado' : 'Agrupamento por coluna removido');
  };

  const handleToggleColumnAutomation = (col: ProjectColumn) => {
    const enabled = !col.config?.automation_enabled;
    updateColumn.mutate({
      columnId: col.id,
      updates: { config: { ...col.config, automation_enabled: enabled } },
    }, {
      onSuccess: () => toast.success(enabled ? 'Automacao da coluna ativada' : 'Automacao da coluna desativada'),
    });
  };

  const handleMoveTaskToGroup = (taskId: string, groupKey: string | null) => {
    updateTask.mutate({
      taskId,
      updates: { group_key: groupKey } as any,
    }, {
      onSuccess: () => toast.success(groupKey ? 'Elemento movido para o grupo' : 'Elemento voltou para agrupamento automatico'),
    });
  };

  const handleSetCustomValue = (taskId: string, columnId: string, value: string) => {
    setCustomValue.mutate({ taskId, columnId, value });
  };

  const handleTogglePinTask = (taskId: string) => {
    if (!activeProjectId) return;
    setPinnedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
        toast.success('Elemento desafixado');
      } else {
        next.add(taskId);
        toast.success('Elemento fixado');
      }
      localStorage.setItem(`mooui_pinned_tasks_${activeProjectId}`, JSON.stringify(Array.from(next)));
      persistBoardPreferences({ pinned_task_ids: Array.from(next) });
      return next;
    });
  };

  const handleConfigureDateReminder = () => {
    if (!activeProjectId) return;
    const key = `mooui_date_reminders_${activeProjectId}`;
    const current = String(boardPreferences?.date_reminder_days ?? localStorage.getItem(key) ?? '3');
    setPromptState({
      title: 'Lembretes da Data Acao',
      label: 'Dias antes do prazo',
      defaultValue: current,
      placeholder: 'Ex.: 3',
      confirmLabel: 'Salvar',
      onSubmit: async (value) => {
        const days = Math.max(0, Number(value.trim() || '0'));
        localStorage.setItem(key, String(days));
        persistBoardPreferences({ date_reminder_days: days });
        try {
          const count = await configureDateActionReminders.mutateAsync({ leadDays: days, tasks });
          toast.success(`Lembrete configurado para ${days} dia${days === 1 ? '' : 's'} antes do prazo`, {
            description: `${count} lembrete${count === 1 ? '' : 's'} pendente${count === 1 ? '' : 's'} criado${count === 1 ? '' : 's'} para tarefas com Data Acao.`,
          });
        } catch (error: any) {
          toast.error(error.message || 'Erro ao criar lembretes');
        }
        setPromptState(null);
      },
    });
  };

  const handleAddGroup = () => {
    if (!activeProjectId) return;
    setPromptState({
      title: 'Adicionar grupo',
      label: 'Nome do grupo',
      placeholder: 'Ex.: Novo topico',
      confirmLabel: 'Criar',
      onSubmit: (name) => {
        const label = name.trim();
        if (!label) return;
        const group = {
          key: `custom-${Date.now()}`,
          label,
          color: groupColors[customGroups.length % groupColors.length],
        };
        const nextGroups = [...customGroups, group];
        setCustomGroups(nextGroups);
        localStorage.setItem(`mooui_custom_groups_${activeProjectId}`, JSON.stringify(nextGroups));
        const nextOrder = [...groupOrder.filter(Boolean), group.key];
        setGroupOrder(nextOrder);
        localStorage.setItem(`mooui_group_order_${activeProjectId}`, JSON.stringify(nextOrder));
        persistBoardPreferences({ custom_groups: nextGroups, group_order: nextOrder });
        toast.success('Grupo criado');
        setPromptState(null);
      },
    });
  };

  const handleMoveGroup = (groupKey: string, direction: 'up' | 'down') => {
    if (!activeProjectId) return;
    const current = groupOrder.length > 0 ? groupOrder : groups.map(group => group.key);
    const next = [...current];
    const index = next.indexOf(groupKey);
    if (index === -1) next.push(groupKey);
    const from = next.indexOf(groupKey);
    const to = direction === 'up' ? from - 1 : from + 1;
    if (to < 0 || to >= next.length) return;
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setGroupOrder(next);
    localStorage.setItem(`mooui_group_order_${activeProjectId}`, JSON.stringify(next));
    persistBoardPreferences({ group_order: next });
  };

  const handleChangeGroupColor = (group: BoardGroup) => {
    if (!activeProjectId) return;
    setPromptState({
      title: 'Alterar cor do grupo',
      label: 'Cor em HEX ou CSS',
      defaultValue: groupColorOverrides[group.key] || group.color,
      placeholder: '#D6336C',
      confirmLabel: 'Salvar',
      onSubmit: (color) => {
        const next = { ...groupColorOverrides, [group.key]: color.trim() || group.color };
        setGroupColorOverrides(next);
        localStorage.setItem(`mooui_group_colors_${activeProjectId}`, JSON.stringify(next));
        persistBoardPreferences({ group_colors: next });
        toast.success('Cor do grupo atualizada');
        setPromptState(null);
      },
    });
  };

  const handleOpenGroupApps = () => {
    toast('Apps e automacoes', {
      description: 'Base criada no menu. Proximo passo: persistir automacoes e lembretes no Supabase.',
    });
  };

  const activeProject = projects?.find((project) => project.id === activeProjectId);

  const handleRenameProject = () => {
    if (!activeProjectId || !activeProject) return;
    setPromptState({
      title: 'Renomear board',
      label: 'Nome',
      defaultValue: activeProject.name,
      confirmLabel: 'Salvar',
      onSubmit: (name) => {
        const nextName = name.trim();
        if (nextName && nextName !== activeProject.name) {
          updateProjectMeta.mutate({
            projectId: activeProjectId,
            updates: { name: nextName },
          }, { onSuccess: () => toast.success('Nome atualizado') });
        }
        setPromptState(null);
      },
    });
  };

  const handleDeleteTask = async (task: TaskWithAssignees) => {
    const hasSubtasks = (task.subtasks?.length || 0) > 0;
    const ok = await confirm({
      title: hasSubtasks ? `Excluir "${task.title}" e seus subelementos?` : `Excluir "${task.title}"?`,
      description: hasSubtasks ? 'Os subelementos vinculados tambem serao removidos.' : 'Esta acao remove o elemento do projeto.',
      destructive: true,
      confirmText: 'Excluir',
    });
    if (!ok) return;
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        toast.success('Elemento excluido!');
        setSidePanelTask((current) => current?.task.id === task.id ? null : current);
      },
      onError: (e: any) => toast.error(e.message || 'Erro ao excluir elemento'),
    });
  };

  const handleArchiveTask = async (task: TaskWithAssignees) => {
    const hasSubtasks = (task.subtasks?.length || 0) > 0;
    const ok = await confirm({
      title: hasSubtasks ? `Arquivar "${task.title}" e seus subelementos?` : `Arquivar "${task.title}"?`,
      description: hasSubtasks ? 'O elemento sai das visualizacoes ativas junto com os subelementos vinculados.' : 'O elemento sai das visualizacoes ativas, sem ser apagado.',
      confirmText: 'Arquivar',
    });
    if (!ok) return;
    const taskIds = [task.id, ...(task.subtasks || []).map((subtask) => subtask.id)];
    Promise.all(taskIds.map((taskId) => archiveTask.mutateAsync(taskId))).then(() => {
      toast.success('Elemento arquivado!');
      setSidePanelTask((current) => current?.task.id === task.id ? null : current);
    }).catch((e: any) => toast.error(e.message || 'Erro ao arquivar elemento'));
  };

  const handleArchiveGroup = async (group: { label: string; tasks: TaskWithAssignees[] }) => {
    if (group.tasks.length === 0) return;
    const subtaskCount = group.tasks.reduce((sum, task) => sum + (task.subtasks?.length || 0), 0);
    const ok = await confirm({
      title: `Arquivar grupo "${group.label}"?`,
      description: `Isto arquiva ${group.tasks.length} elemento${group.tasks.length === 1 ? '' : 's'}${subtaskCount ? ` e ${subtaskCount} subelemento${subtaskCount === 1 ? '' : 's'}` : ''}. Eles saem das visualizacoes ativas sem serem apagados.`,
      confirmText: 'Arquivar grupo',
    });
    if (!ok) return;
    try {
      const taskIds = group.tasks.flatMap((task) => [task.id, ...(task.subtasks || []).map((subtask) => subtask.id)]);
      await Promise.all(taskIds.map((taskId) => archiveTask.mutateAsync(taskId)));
      toast.success(`Grupo "${group.label}" arquivado`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao arquivar grupo');
    }
  };

  const handleSelectGroup = (group: BoardGroup) => {
    const ids = group.tasks.flatMap((task) => [task.id, ...(task.subtasks || []).map((subtask) => subtask.id)]);
    setSelectedTaskIds(new Set(ids));
    toast.success(`${ids.length} item${ids.length === 1 ? '' : 's'} selecionado${ids.length === 1 ? '' : 's'}`);
  };

  const handleDuplicateGroup = async (group: BoardGroup) => {
    if (group.tasks.length === 0) return;
    const ok = await confirm({
      title: `Duplicar grupo "${group.label}"?`,
      description: `Isto cria uma copia dos ${group.tasks.length} elementos visiveis e seus subelementos no mesmo board.`,
      confirmText: 'Duplicar grupo',
    });
    if (!ok) return;

    try {
      for (const task of group.tasks) {
        const parent = await addTask.mutateAsync({
          title: `${task.title} (copia)`,
          status: task.status,
          priority: task.priority,
          group_key: group.key.startsWith('custom-') ? group.key : ((task as any).group_key || null),
        });
        const parentId = (parent as { id?: string } | null)?.id;
        if (!parentId) continue;
        for (const subtask of task.subtasks || []) {
          await addTask.mutateAsync({
            title: subtask.title,
            status: subtask.status,
            priority: subtask.priority,
            parent_task_id: parentId,
          });
        }
      }
      toast.success(`Grupo "${group.label}" duplicado`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao duplicar grupo');
    }
  };

  const handleExportGroup = (group: BoardGroup) => {
    const headers = ['Elemento', 'Tipo', 'Status', 'Prioridade', 'Data inicio', 'Data fim', 'Ticket', ...dynamicColumns.map((col) => col.name)];
    const rows = group.tasks.flatMap((task) => {
      const toRow = (item: TaskWithAssignees, type: string) => [
        item.title,
        type,
        statusLabels[item.status],
        priorityLabels[item.priority],
        item.start_date || '',
        item.due_date || '',
        item.ticket_number || '',
        ...dynamicColumns.map((col) => customValues.get(item.id)?.get(col.id) || ''),
      ];
      return [toRow(task, 'Elemento'), ...(task.subtasks || []).map((subtask) => toRow(subtask, 'Subelemento'))];
    });
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escape).join(';')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(groupRenames[group.key] || group.label).replace(/[\\/:*?"<>|]+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Grupo exportado');
  };

  const handleDeleteGroup = async (group: { label: string; tasks: TaskWithAssignees[] }) => {
    if (group.tasks.length === 0) return;
    const subtaskCount = group.tasks.reduce((sum, task) => sum + (task.subtasks?.length || 0), 0);
    const ok = await confirm({
      title: `Excluir grupo "${group.label}"?`,
      description: `Isto remove ${group.tasks.length} elemento${group.tasks.length === 1 ? '' : 's'}${subtaskCount ? ` e ${subtaskCount} subelemento${subtaskCount === 1 ? '' : 's'}` : ''}. Esta acao nao pode ser desfeita.`,
      destructive: true,
      confirmText: 'Excluir grupo',
    });
    if (!ok) return;
    try {
      await Promise.all(group.tasks.map((task) => deleteTask.mutateAsync(task.id)));
      toast.success(`Grupo "${group.label}" excluido`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir grupo');
    }
  };

  const handleRenameGroup = (group: { key: string; label: string }) => {
    setPromptState({
      title: 'Renomear grupo',
      label: 'Nome',
      defaultValue: groupRenames[group.key] || group.label,
      confirmLabel: 'Salvar',
      onSubmit: (name) => {
        const trimmed = name.trim();
        setGroupRenames((prev) => {
          const next = { ...prev, [group.key]: trimmed };
          localStorage.setItem(`mooui_group_names_${activeProjectId}`, JSON.stringify(next));
          persistBoardPreferences({ group_names: next });
          return next;
        });
        toast.success('Grupo renomeado');
        setPromptState(null);
      },
    });
  };

  const colWidths: Record<FixedColumnKey, string> = { due_date: '180px', priority: '100px', status: '120px', assignee: '100px', created_at: '100px', ticket: '100px' };
  const gridCols = useMemo(() => {
    const cols = ['3px', '1fr'];
    orderedColumns.forEach(col => cols.push(colWidths[col]));
    visibleDynamicColumns.forEach(col => cols.push(`${col.width || 150}px`));
    cols.push('40px');
    return cols.join(' ');
  }, [orderedColumns, visibleDynamicColumns]);

  const handleColumnDragStart = useCallback((key: string) => { dragColRef.current = key; }, []);
  const handleColumnDrop = useCallback((targetKey: string) => {
    const srcKey = dragColRef.current;
    dragColRef.current = null;
    if (!srcKey || srcKey === targetKey) return;
    setColumnOrder(prev => {
      const next = [...prev];
      const srcIdx = next.indexOf(srcKey as FixedColumnKey);
      const tgtIdx = next.indexOf(targetKey as FixedColumnKey);
      if (srcIdx === -1 || tgtIdx === -1) return prev;
      next.splice(srcIdx, 1);
      next.splice(tgtIdx, 0, srcKey as FixedColumnKey);
      localStorage.setItem(`mooui_col_order_${activeProjectId}`, JSON.stringify(next));
      persistBoardPreferences({ fixed_column_order: next });
      return next;
    });
  }, [activeProjectId, persistBoardPreferences]);

  return (
    <div className="space-y-3 min-w-0 max-w-full">
      <div className="flex items-center gap-3">
        {projects && projects.length > 0 ? (
          embedded ? (
            <h2
              className="flex items-center gap-2 text-xl font-bold text-foreground cursor-pointer hover:text-primary transition-colors"
              onDoubleClick={handleRenameProject}
              title="Duplo-clique para renomear"
            >
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: projects.find((p) => p.id === activeProjectId)?.color || 'hsl(var(--primary))' }}
              />
              {activeProject?.name || 'Quadro Principal'}
            </h2>
          ) : (
          <Select value={activeProjectId} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-auto border-0 bg-transparent text-xl font-bold text-foreground h-auto py-0 gap-2">
              <SelectValue placeholder="Selecione um projeto" />
            </SelectTrigger>
            <SelectContent>
              {[...projects].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true })).map(p => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          )
        ) : (
          <h1 className="text-xl font-bold text-foreground">Quadro Principal</h1>
        )}
      </div>

      {activeProjectId && (
        <div className="flex items-center gap-1 flex-wrap bg-card/50 rounded-lg px-2 py-1.5 border border-border">
          <Button onClick={() => handleQuickAdd('todo')} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-medium text-xs h-8">
            <Plus className="h-3.5 w-3.5 mr-1" /> Criar elemento
          </Button>
          <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
            <Button variant={viewMode === 'table' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => setViewMode('table')}>
              <LayoutGrid className="h-3.5 w-3.5" /> Tabela
            </Button>
            <Button variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => setViewMode('kanban')}>
              <Columns3 className="h-3.5 w-3.5" /> Kanban
            </Button>
            <Button variant={viewMode === 'timeline' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => setViewMode('timeline')}>
              <GanttChart className="h-3.5 w-3.5" /> Timeline
            </Button>
            <Button variant={viewMode === 'calendar' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => setViewMode('calendar')}>
              <CalendarDays className="h-3.5 w-3.5" /> Calendario
            </Button>
          </div>
          <div className="h-5 w-px bg-border mx-1" />
          {selectedTaskIds.size > 0 && (
            <>
              <span className="text-xs text-muted-foreground px-1">
                {selectedTaskIds.size} selecionado{selectedTaskIds.size === 1 ? '' : 's'}
              </span>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 text-xs h-8" onClick={() => setSelectedTaskIds(new Set())}>
                <X className="h-3.5 w-3.5" /> Limpar selecao
              </Button>
              <div className="h-5 w-px bg-border mx-1" />
            </>
          )}
          <Button variant="ghost" size="sm" className={`gap-1.5 text-xs h-8 ${searchOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearchText(''); }}>
            <Search className="h-3.5 w-3.5" /> Pesquisar
          </Button>
          <FilterPopover filterStatus={filterStatus} setFilterStatus={setFilterStatus} filterPriority={filterPriority} setFilterPriority={setFilterPriority} filterAssignee={filterAssignee} setFilterAssignee={setFilterAssignee} members={projectMembers} profilesMap={profilesMap || new Map()} />
          <SortPopover sortField={sortField} sortDir={sortDir} onSort={(f, d) => { setSortField(f); setSortDir(d); }} />
          <HideColumnsPopover
            visible={visibleColumns}
            onToggle={toggleColumn}
            dynamicColumns={dynamicColumns}
            hiddenDynamic={hiddenDynamicColumnIds}
            onToggleDynamic={toggleDynamicColumn}
          />
          <GroupByPopover groupBy={dynamicGroupColumnId ? 'none' : groupBy} onGroupBy={(nextGroupBy) => {
            setDynamicGroupColumnId(null);
            persistBoardPreferences({ dynamic_group_column_id: null });
            setGroupBy(nextGroupBy);
          }} />
          <div className="h-5 w-px bg-border mx-1" />
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 text-xs h-8" onClick={handleRenameProject}>
            <Pencil className="h-3.5 w-3.5" /> Renomear
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 text-xs h-8">
                <FileStack className="h-3.5 w-3.5" /> Templates
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase px-2 py-1">Salvar como template</p>
              <button
                className="w-full text-left px-3 py-1.5 text-xs rounded-sm hover:bg-accent"
                onClick={() => {
                  setPromptState({
                    title: 'Salvar como Template', label: 'Nome do template', placeholder: 'Ex.: Lançamento Padrão', confirmLabel: 'Salvar',
                    onSubmit: (name) => {
                      if (activeProjectId) saveAsTemplate.mutate({ projectId: activeProjectId, name });
                      setPromptState(null);
                    },
                  });
                }}
              >
                Salvar projeto atual como template
              </button>
              {projectTemplates.length > 0 && (
                <>
                  <div className="border-t border-border my-1.5" />
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase px-2 py-1">Aplicar template</p>
                  {projectTemplates.map(tpl => (
                    <div key={tpl.id} className="flex items-center gap-1 px-2 py-1 rounded-sm hover:bg-accent group">
                      <button
                        className="flex-1 text-left text-xs truncate"
                        onClick={() => {
                          if (activeProjectId) applyTemplate.mutate({ templateId: tpl.id, projectId: activeProjectId });
                        }}
                      >
                        {tpl.name}
                      </button>
                      <button
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5"
                        onClick={(e) => { e.stopPropagation(); deleteTemplate.mutate(tpl.id); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </PopoverContent>
          </Popover>
        </div>
      )}

      {searchOpen && (
        <div className="flex items-center gap-2 px-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar elementos..." value={searchText} onChange={e => setSearchText(e.target.value)} className="max-w-sm h-8 text-sm" autoFocus />
          {searchText && <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setSearchText('')}><X className="h-3.5 w-3.5" /></Button>}
        </div>
      )}

      {(loadingProjects || loadingTasks) && (
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      )}

      {!loadingProjects && (!projects || projects.length === 0) ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <FolderKanban className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">Nenhum projeto ainda</h3>
          <p className="text-muted-foreground text-sm mb-4">Crie seu primeiro projeto para começar</p>
          <Button onClick={handleCreateProject}><Plus className="h-4 w-4 mr-1" /> Criar Projeto</Button>
        </div>
      ) : viewMode === 'kanban' ? (
        <SundayKanbanView
          tasks={sortedTasks} profilesMap={profilesMap || new Map()} projectMembers={projectMembers}
          onOpen={handleClickTask} onArchive={handleArchiveTask} onDelete={handleDeleteTask}
          onStatusChange={(taskId, status) => updateTask.mutate({ taskId, updates: { status } })}
          onQuickAdd={(status) => handleQuickAdd(status)}
          onAddAssignee={(taskId, userId) => addAssignee.mutate({ taskId, userId })}
          onRemoveAssignee={(taskId, userId) => removeAssignee.mutate({ taskId, userId })}
          cardColumns={dynamicColumns.filter(c => !!c.config?.show_on_card)}
          customValues={customValues} onSetCustomValue={handleSetCustomValue}
        />
      ) : viewMode === 'timeline' ? (
        <SundayTimelineView
          tasks={sortedTasks} profilesMap={profilesMap || new Map()} projectMembers={projectMembers}
          onOpen={handleClickTask} onArchive={handleArchiveTask} onDelete={handleDeleteTask}
          onAddAssignee={(taskId, userId) => addAssignee.mutate({ taskId, userId })}
          onRemoveAssignee={(taskId, userId) => removeAssignee.mutate({ taskId, userId })}
        />
      ) : viewMode === 'calendar' ? (
        <SundayCalendarView tasks={sortedTasks} onOpen={handleClickTask} />
      ) : isMobile && viewMode === 'table' ? (
        <SundayMobileList
          groups={groups} profilesMap={profilesMap || new Map()}
          onClickTask={handleClickTask} onQuickAdd={(status) => handleQuickAdd(status || 'todo')}
          onArchiveGroup={handleArchiveGroup} onDeleteGroup={handleDeleteGroup}
        />
      ) : (
        <div className="sunday-table-scroll space-y-5 pb-4 min-w-0 max-w-full">
          {groups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.key);
            const groupSubtaskIds = topLevelIdsWithSubtasks(group);
            const subtaskCount = group.tasks.reduce((sum, task) => sum + (task.subtasks?.length || 0), 0);
            const doneSubtaskCount = group.tasks.reduce((sum, task) => sum + (task.subtasks?.filter(sub => sub.status === 'done').length || 0), 0);
            const doneTaskCount = group.tasks.filter(task => task.status === 'done').length;
            const groupCommentCount = group.tasks.reduce((sum, task) => {
              const taskCount = commentCounts?.get(task.id) || 0;
              const subtaskComments = task.subtasks?.reduce((subSum, subtask) => subSum + (commentCounts?.get(subtask.id) || 0), 0) || 0;
              return sum + taskCount + subtaskComments;
            }, 0);
            const groupProgress = subtaskCount > 0
              ? Math.round((doneSubtaskCount / subtaskCount) * 100)
              : group.tasks.length > 0
                ? Math.round((doneTaskCount / group.tasks.length) * 100)
                : 0;
            return (
              <div key={group.key}>
                <div className="mb-1 flex items-center gap-2">
                  <button onClick={() => toggleGroup(group.key)} className="flex items-center gap-2">
                    {isCollapsed ? <ChevronRight className="h-4 w-4" style={{ color: group.color }} /> : <ChevronDown className="h-4 w-4" style={{ color: group.color }} />}
                    <span className="text-sm font-bold tracking-wide" style={{ color: group.color }}>{groupRenames[group.key] || group.label}</span>
                    <span className="text-xs text-muted-foreground ml-1">{group.tasks.length} elementos</span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64">
                      <DropdownMenuItem onClick={() => expandGroup(group.key)}>
                        <ChevronDown className="h-4 w-4 mr-2" /> Expandir este grupo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => expandAllGroups()}>
                        <ChevronDown className="h-4 w-4 mr-2" /> Expandir todos os grupos
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => collapseGroup(group.key)}>
                        <ChevronRight className="h-4 w-4 mr-2" /> Recolher este grupo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => collapseAllGroups()}>
                        <ChevronRight className="h-4 w-4 mr-2" /> Recolher todos os grupos
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled={groupSubtaskIds.length === 0} onClick={() => expandSubtasks(groupSubtaskIds)}>
                        <ChevronDown className="h-4 w-4 mr-2" /> Expandir subelementos deste grupo
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={allTopLevelIdsWithSubtasks().length === 0} onClick={() => expandSubtasks(allTopLevelIdsWithSubtasks())}>
                        <ChevronDown className="h-4 w-4 mr-2" /> Expandir todos os subelementos
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={groupSubtaskIds.length === 0} onClick={() => collapseSubtasks(groupSubtaskIds)}>
                        <ChevronRight className="h-4 w-4 mr-2" /> Recolher subelementos deste grupo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => collapseSubtasks(allTopLevelIdsWithSubtasks())}>
                        <ChevronRight className="h-4 w-4 mr-2" /> Recolher todos os subelementos
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleSelectGroup(group)}>
                        <CheckSquare className="h-4 w-4 mr-2" /> Selecionar todos os elementos
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleAddGroup}>
                        <Plus className="h-4 w-4 mr-2" /> Adicionar grupo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicateGroup(group)}>
                        <Copy className="h-4 w-4 mr-2" /> Duplicar grupo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportGroup(group)}>
                        <Download className="h-4 w-4 mr-2" /> Exportar para Excel
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleMoveGroup(group.key, 'up')}>
                        <ArrowUp className="h-4 w-4 mr-2" /> Mover grupo para cima
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleMoveGroup(group.key, 'down')}>
                        <ArrowDown className="h-4 w-4 mr-2" /> Mover grupo para baixo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleChangeGroupColor(group)}>
                        <Palette className="h-4 w-4 mr-2" /> Alterar cor do grupo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleOpenGroupApps}>
                        <Sparkles className="h-4 w-4 mr-2" /> Apps e automacoes
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleRenameGroup(group)}>
                        <Pencil className="h-4 w-4 mr-2" /> Renomear grupo
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleArchiveGroup(group)}>
                        <Archive className="h-4 w-4 mr-2" /> Arquivar grupo inteiro
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleDeleteGroup(group)} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir grupo inteiro
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {isCollapsed && (
                  <div className="rounded-lg border border-border bg-card/40 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{group.tasks.length} elemento{group.tasks.length === 1 ? '' : 's'}</span>
                      <span>{subtaskCount} subelemento{subtaskCount === 1 ? '' : 's'}</span>
                      <span>{groupProgress}% concluido</span>
                      {groupCommentCount > 0 && (
                        <span>{groupCommentCount} comentario{groupCommentCount === 1 ? '' : 's'}</span>
                      )}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${groupProgress}%`, backgroundColor: group.color }}
                      />
                    </div>
                  </div>
                )}

                {!isCollapsed && (
                  <div className="rounded-lg border border-border bg-card/20">
                    <div
                      ref={(node) => { groupScrollRefs.current[group.key] = node; }}
                      className="sunday-table-scroll overflow-x-auto overscroll-x-contain"
                    >
                    <div className="min-w-full w-max">
                    <div className="grid items-center bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border" style={{ gridTemplateColumns: gridCols }}>
                      <div style={{ backgroundColor: group.color }} className="h-full" />
                      <span className="px-3 py-2">Elemento</span>
                      {orderedColumns.map(col => (
                        <FixedColHeader
                          key={col}
                          label={fixedColumnLabelOverrides[col] || fixedColumnLabels[col]}
                          colKey={col}
                          onHide={() => toggleColumn(col)}
                          onRename={() => handleRenameFixedColumn(col)}
                          onDragStart={handleColumnDragStart}
                          onDrop={handleColumnDrop}
                          onSortAsc={() => { setSortField(col === 'assignee' || col === 'ticket' ? 'title' : col); setSortDir('asc'); }}
                          onSortDesc={() => { setSortField(col === 'assignee' || col === 'ticket' ? 'title' : col); setSortDir('desc'); }}
                          onConfigureReminder={col === 'due_date' ? handleConfigureDateReminder : undefined}
                        />
                      ))}
                      {visibleDynamicColumns.map(col => (
                        <span key={col.id} className="px-2 py-2 text-center flex items-center justify-center gap-1 group">
                          {col.name}
                          <ColumnHeaderMenu
                            column={col}
                            onRename={() => handleRenameColumn(col)}
                            onDelete={() => handleDeleteColumn(col)}
                            onToggleCardVisibility={() => handleToggleCardVisibility(col)}
                            onHide={() => hideDynamicColumn(col.id)}
                            onMoveLeft={() => handleMoveColumn(col, 'left')}
                            onMoveRight={() => handleMoveColumn(col, 'right')}
                            onEditOptions={() => handleEditColumnOptions(col)}
                            onDuplicate={() => handleDuplicateColumn(col)}
                            onChangeType={() => handleChangeColumnType(col)}
                            onFilter={() => handleFilterDynamicColumn(col)}
                            onClearFilter={() => handleClearDynamicColumnFilter(col.id)}
                            onGroupByColumn={() => handleToggleDynamicGroup(col.id)}
                            onAutomation={() => handleToggleColumnAutomation(col)}
                            isFiltered={!!dynamicColumnFilters[col.id]}
                            isGrouped={dynamicGroupColumnId === col.id}
                            isFirst={visibleDynamicColumns.indexOf(col) === 0}
                            isLast={visibleDynamicColumns.indexOf(col) === visibleDynamicColumns.length - 1}
                          />
                        </span>
                      ))}
                      <AddColumnButton onAdd={handleAddColumn} />
                    </div>

                    {group.tasks.map((task) => (
                      <TaskRow
                        key={task.id} task={task} groupColor={group.color} gridCols={gridCols}
                        orderedColumns={orderedColumns} profilesMap={profilesMap || new Map()}
                        expandedTasks={expandedTasks} onToggleExpand={toggleExpand}
                        onClickTask={handleClickTask} onInlineUpdate={handleInlineUpdate}
                        onAddSubtask={(parentId) => handleQuickAdd('todo', parentId)}
                        dynamicColumns={visibleDynamicColumns} customValues={customValues}
                        onSetCustomValue={handleSetCustomValue}
                        statusLabelsConfig={statusLabelsConfig} priorityLabelsConfig={priorityLabelsConfig}
                        onEditStatusLabels={() => setEditingLabelType('status')}
                        onEditPriorityLabels={() => setEditingLabelType('priority')}
                        projectMembers={projectMembers}
                        onAddAssignee={(taskId, userId) => addAssignee.mutate({ taskId, userId })}
                        onRemoveAssignee={(taskId, userId) => removeAssignee.mutate({ taskId, userId })}
                        allTopLevelTasks={tasks}
                        onMoveToParent={(taskId, parentId) => { updateTask.mutate({ taskId, updates: { parent_task_id: parentId } }); toast.success('Elemento movido!'); }}
                        onPromoteToTopLevel={(taskId) => { updateTask.mutate({ taskId, updates: { parent_task_id: null } }); toast.success('Elemento promovido!'); }}
                        onArchiveTask={handleArchiveTask}
                        onDeleteTask={handleDeleteTask}
                        draggedTaskId={draggedTaskId} onDragStartTask={onDragStartTask} onDragEndTask={onDragEndTask}
                        commentCounts={commentCounts}
                        isPinned={pinnedTaskIds.has(task.id)}
                        onTogglePin={handleTogglePinTask}
                        availableGroups={customGroups.map(customGroup => ({ key: customGroup.key, label: groupRenames[customGroup.key] || customGroup.label }))}
                        onMoveToGroup={handleMoveTaskToGroup}
                      />
                    ))}

                    <button onClick={() => handleQuickAdd('todo', undefined, group.key.startsWith('custom-') ? group.key : null)} className="w-full text-left px-6 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors flex items-center gap-1.5 border-b border-border">
                      <Plus className="h-3.5 w-3.5" /> Adicionar elemento
                    </button>

                    <div className="grid items-center bg-muted/20" style={{ gridTemplateColumns: gridCols }}>
                      <div style={{ backgroundColor: group.color }} className="h-full" />
                      <span className="px-3 py-1.5" />
                      {orderedColumns.map(col => {
                        if (col === 'priority') return (
                          <div key={col} className="px-1 py-1.5 flex gap-0.5">
                            {(['critical', 'high', 'medium', 'low'] as TaskPriority[]).map(p => {
                              const count = group.tasks.filter(t => t.priority === p).length;
                              if (count === 0) return null;
                              return <div key={p} className={`h-5 rounded-sm ${priorityCellColors[p]}`} style={{ flex: count }} title={`${priorityLabels[p]}: ${count}`} />;
                            })}
                          </div>
                        );
                        if (col === 'status') return (
                          <div key={col} className="px-1 py-1.5 flex gap-0.5">
                            {(['done', 'in_progress', 'in_review', 'todo', 'backlog'] as TaskStatus[]).map(s => {
                              const count = group.tasks.filter(t => t.status === s).length;
                              if (count === 0) return null;
                              return <div key={s} className={`h-5 rounded-sm ${statusCellColors[s]}`} style={{ flex: count }} title={`${statusLabels[s]}: ${count}`} />;
                            })}
                          </div>
                        );
                        return <span key={col} className="px-2 py-1.5" />;
                      })}
                      {visibleDynamicColumns.map(col => {
                        const aggregate = getGroupAggregate(group, col);
                        return (
                          <span key={col.id} className="px-2 py-1.5 text-center text-[11px] font-medium text-muted-foreground">
                            {aggregate}
                          </span>
                        );
                      })}
                      <span />
                    </div>
                    </div>
                    </div>
                    <StickyGroupScrollbar
                      groupKey={group.key}
                      targetRefs={groupScrollRefs}
                      color={group.color}
                      refreshKey={`${gridCols}:${orderedColumns.join(',')}:${visibleDynamicColumns.map((column) => column.id).join(',')}:${group.tasks.length}`}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {sortedTasks.length === 0 && !loadingTasks && activeProjectId && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="text-center py-12 text-muted-foreground text-sm">
                {searchText || filterStatus.size || filterPriority.size
                  ? 'Nenhum resultado encontrado com os filtros aplicados.'
                  : 'Nenhuma tarefa ainda. Clique em "Criar elemento" para começar.'}
              </div>
            </div>
          )}
        </div>
      )}

      {sidePanelTask && activeProjectId && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSidePanelTask(null)} />
          <TaskSidePanel
            task={sidePanelTask.task} parentTask={sidePanelTask.parent} projectId={activeProjectId}
            open={!!sidePanelTask} onClose={() => setSidePanelTask(null)}
            onUpdate={(updates) => { updateTask.mutate({ taskId: sidePanelTask.task.id, updates }); }}
            onAddSubtask={(title) => {
              addTask.mutate({ title, status: sidePanelTask.task.status, priority: 'medium', parent_task_id: sidePanelTask.task.id });
            }}
            onUpdateSubtask={(taskId, updates) => { updateTask.mutate({ taskId, updates }); }}
            onDelete={(taskId) => {
              deleteTask.mutate(taskId, {
                onSuccess: () => toast.success('Tarefa excluída!'),
                onError: (e: any) => toast.error(e.message || 'Erro ao excluir'),
              });
            }}
            allTasks={tasks}
          />
        </>
      )}

      <LabelEditorDialog
        open={editingLabelType === 'status'}
        onOpenChange={(open) => !open && setEditingLabelType(null)}
        labels={statusLabelsConfig}
        onSave={handleSaveStatusLabels}
        title="Editar etiquetas de Status"
      />
      <LabelEditorDialog
        open={editingLabelType === 'priority'}
        onOpenChange={(open) => !open && setEditingLabelType(null)}
        labels={priorityLabelsConfig}
        onSave={handleSavePriorityLabels}
        title="Editar etiquetas de Prioridade"
      />
      <PromptDialog
        open={!!promptState}
        title={promptState?.title || ''}
        label={promptState?.label}
        defaultValue={promptState?.defaultValue}
        placeholder={promptState?.placeholder}
        confirmLabel={promptState?.confirmLabel}
        multiline={promptState?.multiline}
        onCancel={() => setPromptState(null)}
        onSubmit={(v) => promptState?.onSubmit(v)}
      />
    </div>
  );
}
