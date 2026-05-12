import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield } from 'lucide-react';
import type { AppRole, DocPage } from '@/hooks/useDocPages';

const ROLES: { value: AppRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'member', label: 'Member' },
];

export function PagePermissions({
  page, onChange, disabled,
}: {
  page: DocPage;
  onChange: (patch: { can_edit_roles?: AppRole[]; can_delete_roles?: AppRole[] }) => void;
  disabled?: boolean;
}) {
  const toggle = (field: 'can_edit_roles' | 'can_delete_roles', role: AppRole) => {
    const cur = page[field] ?? [];
    const next = cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role];
    onChange({ [field]: next });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Shield className="h-3.5 w-3.5 mr-2" /> Permissões
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm mb-2">Quem pode editar</h4>
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
            <h4 className="font-medium text-sm mb-2">Quem pode excluir</h4>
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
