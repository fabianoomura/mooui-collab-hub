import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { UserPlus, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OrgMember = { id: string; full_name: string | null; avatar_url: string | null };

export function useOrgMembers() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['org-members-list', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [] as OrgMember[];
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', currentOrg.id);
      const ids = (members || []).map((m) => m.user_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', ids);
      return (profiles || []) as OrgMember[];
    },
    enabled: !!currentOrg,
  });
}

const initials = (name?: string | null) =>
  (name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

interface Props {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export function AssigneePicker({ value, onChange, size = 'sm', disabled }: Props) {
  const { data: members = [] } = useOrgMembers();
  const current = members.find((m) => m.id === value);
  const dim = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';

  return (
    <Popover>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={current ? `Responsável: ${current.full_name}` : 'Atribuir responsável'}
          className={cn(
            'rounded-full transition-opacity hover:opacity-80 shrink-0',
            !current && 'opacity-60 hover:opacity-100',
          )}
        >
          {current ? (
            <Avatar className={dim}>
              {current.avatar_url && <AvatarImage src={current.avatar_url} />}
              <AvatarFallback className="text-[10px]">{initials(current.full_name)}</AvatarFallback>
            </Avatar>
          ) : (
            <div className={cn(dim, 'rounded-full border border-dashed flex items-center justify-center text-muted-foreground')}>
              <UserPlus className="h-3.5 w-3.5" />
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end" onClick={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput placeholder="Buscar pessoa..." />
          <CommandList>
            <CommandEmpty>Ninguém encontrado.</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem onSelect={() => onChange(null)} className="text-muted-foreground">
                  <X className="h-4 w-4 mr-2" /> Remover atribuição
                </CommandItem>
              )}
              {members.map((m) => (
                <CommandItem key={m.id} value={m.full_name || m.id} onSelect={() => onChange(m.id)}>
                  <Avatar className="h-6 w-6 mr-2">
                    {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                    <AvatarFallback className="text-[9px]">{initials(m.full_name)}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate">{m.full_name || 'Sem nome'}</span>
                  {value === m.id && <Check className="h-4 w-4" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
