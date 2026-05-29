import { Check, ChevronDown } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
}

export function OrgSwitcher({ className }: Props) {
  const { organizations, currentOrg, setCurrentOrg } = useOrganization();
  if (!currentOrg) return null;

  const initial = currentOrg.name.charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 h-8 px-2 rounded-md border border-border hover:bg-muted/50 transition-colors text-sm',
            className,
          )}
          aria-label="Trocar workspace"
        >
          {currentOrg.logo_url ? (
            <img
              src={currentOrg.logo_url}
              alt={currentOrg.name}
              className="h-5 w-5 rounded object-cover shrink-0"
            />
          ) : (
            <div
              className="h-5 w-5 rounded flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0"
              style={{ backgroundColor: currentOrg.color || 'hsl(var(--primary))' }}
            >
              {initial}
            </div>
          )}
          <span className="font-medium truncate max-w-[120px]">{currentOrg.name}</span>
          <Badge variant="outline" className="hidden sm:inline-flex text-[9px] px-1 py-0 h-4 capitalize">
            {currentOrg.role === 'admin' ? 'Admin' : 'Membro'}
          </Badge>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Trocar workspace
        </DropdownMenuLabel>
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => setCurrentOrg(org)}
            className="flex items-center gap-2"
          >
            <div
              className="h-6 w-6 rounded flex items-center justify-center text-[9px] font-bold text-primary-foreground shrink-0"
              style={{ backgroundColor: org.color || 'hsl(var(--primary))' }}
            >
              {org.name.charAt(0).toUpperCase()}
            </div>
            <span className="flex-1 truncate">{org.name}</span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 capitalize">
              {org.role === 'admin' ? 'Admin' : 'Membro'}
            </Badge>
            {currentOrg.id === org.id && (
              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
