import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

const COMMON = [
  '📄','📁','📚','📝','📋','📊','📈','📌','🔖','⭐',
  '✅','💡','🚀','🎯','🛠️','⚙️','🔧','📞','💬','📧',
  '🏢','👥','💼','💰','🍕','☕','🎉','🔒','🔑','📅',
];

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" type="button" className="text-2xl h-12 w-12 p-0">
          {value || '📄'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="grid grid-cols-6 gap-1 mb-2">
          {COMMON.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => { onChange(e); setOpen(false); }}
              className="text-xl h-9 w-9 rounded hover:bg-accent flex items-center justify-center"
            >
              {e}
            </button>
          ))}
        </div>
        <Input
          placeholder="Ou cole um emoji"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, 4))}
          className="h-8 text-sm"
        />
      </PopoverContent>
    </Popover>
  );
}
