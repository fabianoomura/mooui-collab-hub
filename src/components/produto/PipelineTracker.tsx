import { CheckCircle2, Circle, Loader2, OctagonAlert } from 'lucide-react';
import {
  produtoStageLabels,
  produtoStageOrder,
  type ProdutoStage,
  type ProdutoStageKey,
  type ProdutoStageStatus,
} from '@/hooks/useProdutos';
import { cn } from '@/lib/utils';

const statusClasses: Record<ProdutoStageStatus, string> = {
  nao_iniciado: 'border-muted bg-background text-muted-foreground',
  em_andamento: 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  bloqueado: 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300',
  finalizado: 'border-emerald-500 bg-emerald-500 text-white',
};

function StageIcon({ status }: { status: ProdutoStageStatus }) {
  if (status === 'finalizado') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === 'em_andamento') return <Loader2 className="h-3.5 w-3.5" />;
  if (status === 'bloqueado') return <OctagonAlert className="h-3.5 w-3.5" />;
  return <Circle className="h-3.5 w-3.5" />;
}

export function PipelineTracker({
  stages,
  selectedStageId,
  onSelectStage,
}: {
  stages: ProdutoStage[];
  selectedStageId?: string | null;
  onSelectStage?: (stage: ProdutoStage) => void;
}) {
  const stageMap = new Map(stages.map((stage) => [stage.stage_key, stage]));
  const ordered = produtoStageOrder
    .map((key) => stageMap.get(key as ProdutoStageKey))
    .filter(Boolean) as ProdutoStage[];

  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-2">
      {ordered.map((stage, index) => (
        <button
          key={stage.id}
          type="button"
          onClick={() => onSelectStage?.(stage)}
          className={cn(
            'min-h-[72px] rounded-md border p-2 text-left transition-colors hover:border-primary/50',
            selectedStageId === stage.id && 'border-primary ring-1 ring-primary/30',
          )}
        >
          <div className="flex items-start gap-2">
            <div className={cn('h-7 w-7 rounded-full border flex items-center justify-center shrink-0', statusClasses[stage.status])}>
              <StageIcon status={stage.status} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground font-mono">#{String(index + 1).padStart(2, '0')}</div>
              <div className="text-xs font-medium leading-tight">{produtoStageLabels[stage.stage_key]}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
