import { useEffect, useState } from 'react';
import { useMyProfile, useUpdateMyName, useUpdateMyEmail, useRemoveAvatar } from '@/hooks/useProfile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AvatarUploadDialog } from '@/components/AvatarUploadDialog';
import { useConfirm } from '@/components/ConfirmDialog';

export function ProfileTab() {
  const { data: profile } = useMyProfile();
  const updateName = useUpdateMyName();
  const updateEmail = useUpdateMyEmail();
  const removeAvatar = useRemoveAvatar();
  const confirm = useConfirm();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [openAvatar, setOpenAvatar] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.full_name ?? '');
      setEmail(profile.email ?? '');
    }
  }, [profile?.full_name, profile?.email]);

  const initials = (profile?.full_name ?? '?')
    .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const handleSaveName = () => {
    if (!name.trim() || name.trim() === profile?.full_name) return;
    updateName.mutate(name.trim(), {
      onSuccess: () => toast.success('Nome atualizado'),
      onError: () => toast.error('Erro ao atualizar nome'),
    });
  };

  const handleSaveEmail = () => {
    const v = email.trim();
    if (!v || v === profile?.email) return;
    if (!/^\S+@\S+\.\S+$/.test(v)) {
      toast.error('E-mail inválido');
      return;
    }
    updateEmail.mutate(v, {
      onSuccess: () => toast.success('Confirme a alteração no novo e-mail'),
      onError: (e: any) => toast.error(e?.message ?? 'Erro ao atualizar e-mail'),
    });
  };

  const handleRemoveAvatar = async () => {
    const ok = await confirm({
      title: 'Remover foto?',
      description: 'Sua foto de perfil será removida.',
      confirmText: 'Remover',
    });
    if (!ok) return;
    removeAvatar.mutate(undefined, {
      onSuccess: () => toast.success('Foto removida'),
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
        <div className="flex-1">
          <h3 className="font-semibold">{profile?.full_name || 'Sem nome'}</h3>
          <p className="text-sm text-muted-foreground">{profile?.email || '—'}</p>
          {profile?.avatar_url && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={handleRemoveAvatar}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover foto
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-2xl space-y-5">
        <div className="space-y-2">
          <Label>Nome completo</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              className="sm:w-28"
              onClick={handleSaveName}
              disabled={!name.trim() || name.trim() === profile?.full_name || updateName.isPending}
            >
              Salvar
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>E-mail</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button
              className="sm:w-28"
              onClick={handleSaveEmail}
              disabled={!email.trim() || email.trim() === profile?.email || updateEmail.isPending}
            >
              Salvar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Alterações de e-mail exigem confirmação no novo endereço.
          </p>
        </div>
      </div>

      <AvatarUploadDialog open={openAvatar} onOpenChange={setOpenAvatar} />
    </div>
  );
}
