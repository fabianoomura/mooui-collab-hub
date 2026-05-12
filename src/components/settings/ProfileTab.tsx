import { useRef, useState } from 'react';
import { useMyProfile, useUploadAvatar, useUpdateMyName } from '@/hooks/useProfile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function ProfileTab() {
  const { data: profile } = useMyProfile();
  const upload = useUploadAvatar();
  const updateName = useUpdateMyName();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');

  const initials = (profile?.full_name ?? '?')
    .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { toast.error('Máx 4MB'); return; }
    upload.mutate(f, {
      onSuccess: () => toast.success('Foto atualizada'),
      onError: (err: any) => toast.error(err?.message ?? 'Erro no upload'),
    });
  };

  const handleSaveName = () => {
    if (!name.trim()) return;
    updateName.mutate(name.trim(), {
      onSuccess: () => toast.success('Nome atualizado'),
      onError: () => toast.error('Erro'),
    });
  };

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="h-20 w-20">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? ''} />}
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:opacity-90"
            aria-label="Trocar foto"
          >
            {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
        <div>
          <h3 className="font-semibold">{profile?.full_name || 'Sem nome'}</h3>
          <p className="text-sm text-muted-foreground">{profile?.position || 'Sem cargo'}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Nome completo</Label>
        <div className="flex gap-2">
          <Input
            placeholder={profile?.full_name ?? ''}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button onClick={handleSaveName} disabled={!name.trim() || updateName.isPending}>Salvar</Button>
        </div>
      </div>
    </div>
  );
}
