import { useState } from 'react';
import { useMyProfile, useUpdateMyName } from '@/hooks/useProfile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera } from 'lucide-react';
import { toast } from 'sonner';
import { AvatarUploadDialog } from '@/components/AvatarUploadDialog';

export function ProfileTab() {
  const { data: profile } = useMyProfile();
  const updateName = useUpdateMyName();
  const [name, setName] = useState('');
  const [openAvatar, setOpenAvatar] = useState(false);

  const initials = (profile?.full_name ?? '?')
    .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const handleSaveName = () => {
    if (!name.trim()) return;
    updateName.mutate(name.trim(), {
      onSuccess: () => toast.success('Nome atualizado'),
      onError: () => toast.error('Erro'),
    });
  };

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-6">
      <div className="mb-6 flex items-center gap-4 border-b pb-6">
        <div className="relative">
          <Avatar className="h-20 w-20">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? ''} />}
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <button
            onClick={() => setOpenAvatar(true)}
            className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:opacity-90"
            aria-label="Trocar foto"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
        </div>
        <div>
          <h3 className="font-semibold">{profile?.full_name || 'Sem nome'}</h3>
          <p className="text-sm text-muted-foreground">{profile?.position || 'Sem cargo'}</p>
        </div>
      </div>

      <div className="max-w-2xl space-y-2">
        <Label>Nome completo</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder={profile?.full_name ?? ''}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button className="sm:w-28" onClick={handleSaveName} disabled={!name.trim() || updateName.isPending}>Salvar</Button>
        </div>
      </div>

      <AvatarUploadDialog open={openAvatar} onOpenChange={setOpenAvatar} />
    </div>
  );
}

