import { useCallback, useRef, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Loader2, Upload, Trash2 } from 'lucide-react';
import { useUploadAvatar, useRemoveAvatar, useMyProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

async function getCroppedBlob(src: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const canvas = document.createElement('canvas');
  const size = Math.min(512, Math.max(area.width, area.height));
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size);
  return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.9));
}

export function AvatarUploadDialog({ open, onOpenChange }: Props) {
  const { data: profile } = useMyProfile();
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const fileRef = useRef<HTMLInputElement>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  const reset = () => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast.error('Máx 8MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(f);
  };

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => setCroppedArea(areaPixels), []);

  const handleSave = async () => {
    if (!imageSrc || !croppedArea) return;
    try {
      const blob = await getCroppedBlob(imageSrc, croppedArea);
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      upload.mutate(file, {
        onSuccess: () => {
          toast.success('Foto atualizada');
          reset();
          onOpenChange(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro no upload'),
      });
    } catch {
      toast.error('Erro ao processar imagem');
    }
  };

  const handleRemove = () => {
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.success('Foto removida');
        reset();
        onOpenChange(false);
      },
      onError: () => toast.error('Erro ao remover'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Foto de perfil</DialogTitle>
        </DialogHeader>

        {imageSrc ? (
          <div className="space-y-3">
            <div className="relative h-64 w-full overflow-hidden rounded-md bg-muted">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Zoom</span>
              <Slider value={[zoom]} min={1} max={3} step={0.05} onValueChange={(v) => setZoom(v[0])} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={reset} disabled={upload.isPending}>
                Escolher outra
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={upload.isPending}>
                {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted/30 py-10 hover:bg-muted/50 transition"
            >
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Clique para escolher uma imagem</span>
              <span className="text-xs text-muted-foreground">JPG, PNG (máx 8MB)</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            {profile?.avatar_url && (
              <Button
                variant="outline"
                className="w-full text-destructive hover:text-destructive"
                onClick={handleRemove}
                disabled={remove.isPending}
              >
                {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Remover foto atual
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
