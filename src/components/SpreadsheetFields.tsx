import { cn } from '@/lib/utils';

type SpreadsheetFieldsProps = {
  fields?: Record<string, unknown> | null;
  className?: string;
};

function formatValue(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function SpreadsheetFields({ fields, className }: SpreadsheetFieldsProps) {
  const entries = Object.entries(fields || {}).filter(([, value]) => formatValue(value).trim());
  if (!entries.length) return null;

  return (
    <div className={cn('rounded-md border bg-muted/20 p-3', className)}>
      <div className="mb-2 text-xs font-medium text-muted-foreground">Campos da planilha</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {entries.map(([key, value]) => (
          <div key={key} className="min-w-0 rounded border bg-background px-2 py-1.5">
            <div className="text-[10px] font-medium uppercase tracking-normal text-muted-foreground">{key}</div>
            <div className="mt-0.5 break-words text-xs">{formatValue(value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
