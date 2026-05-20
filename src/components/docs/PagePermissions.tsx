import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Shield, Lock, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { AppRole, DocPage } from '@/hooks/useDocPages';
import { useOrgMembers } from '@/hooks/useChannels';
import { useAuth } from '@/contexts/AuthContext';

const ROLES: { value: AppRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'member', label: 'Member' },
];

export function PagePermissions({
  page, onChange, disabled,
}: {
  page: DocPage;
  onChange: (patch: { can_edit_roles?: AppRole[]; can_delete_roles?: AppRole[]; is_restricted?: boolean; allowed_user_ids?: string[] }) => void;
  disabled?: boolean;
}) {
  const { user } = useAuth();
  const { data: members = [] } = useOrgMembers(page.organization_id);
  const [filter, setFilter] = useState('');

  const toggle = (field: 'can_edit_roles' | 'can_delete_roles', role: AppRole) => {
    const cur = page[field] ?? [];
    const next = cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role];
    onChange({ [field]: next });
  };

  const toggleUser = (uid: string) => {
    const cur = page.allowed_user_ids ?? [];
    const next = cur.includes(uid) ? cur.filter((x) => x !== uid) : [...cur, uid];
    onChange({ allowed_user_ids: next });
  };

  const filtered = members.filter((m) =>
    (m.full_name ?? '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          {page.is_restricted ? (
            <Lock className="h-3.5 w-3.5 mr-2 text-primary" />
          ) : (
            <Shield className="h-3.5 w-3.5 mr-2" />
          )}
          {page.is_restricted ? 'Sigiloso' : 'Permissões'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-[80vh] overflow-y-auto">
        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> Documento sigiloso
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Visível só para autor, admins e pessoas autorizadas.
                </p>
              </div>
              <Switch
                checked={page.is_restricted}
                onCheckedChange={(v) => onChange({ is_restricted: v })}
                disabled={disabled}
              />
            </div>
          </div>

          {page.is_restricted && (
            <div>
              <h4 className="font-medium text-sm mb-2">Pessoas com acesso</h4>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar pessoa…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="h-8 pl-7 text-sm"
                />
              </div>
              <div className="max-h-48 overflow-y-auto -mx-1">
                {filtered.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">Nenhum membro</p>
                )}
                {filtered.map((m) => {
                  const checked = page.allowed_user_ids?.includes(m.id);
                  const initials = (m.full_name ?? '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <label key={m.id} className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-accent cursor-pointer">
                      <Checkbox checked={checked} onCheckedChange={() => toggleUser(m.id)} disabled={disabled} />
                      <Avatar className="h-6 w-6">
                        {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.full_name ?? ''} />}
                        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate flex-1">{m.full_name || 'Sem nome'}</span>
                    </label>
                  );
                })}
              </div>
              {user?.id === page.created_by && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Você é o autor — sempre tem acesso.
                </p>
              )}
            </div>
          )}

          <div>
            <h4 className="font-medium text-sm mb-2">Quem pode editar (por papel)</h4>
            {ROLES.map((r) => (
              <label key={r.value} className="flex items-center gap-2 py-1 cursor-pointer">
                <Checkbox
                  checked={page.can_edit_roles?.includes(r.value)}
                  onCheckedChange={() => toggle('can_edit_roles', r.value)}
                  disabled={disabled}
                />
                <span className="text-sm">{r.label}</span>
              </label>
            ))}
          </div>
          <div>
            <h4 className="font-medium text-sm mb-2">Quem pode excluir (por papel)</h4>
            {ROLES.map((r) => (
              <label key={r.value} className="flex items-center gap-2 py-1 cursor-pointer">
                <Checkbox
                  checked={page.can_delete_roles?.includes(r.value)}
                  onCheckedChange={() => toggle('can_delete_roles', r.value)}
                  disabled={disabled}
                />
                <span className="text-sm">{r.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Admin da organização e o autor sempre podem editar.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
