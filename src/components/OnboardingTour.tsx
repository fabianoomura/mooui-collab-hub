import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Rocket,
  Table2,
  MessageSquare,
  Briefcase,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

const steps = [
  {
    title: 'Bem-vindo ao Collab Hub!',
    description:
      'Sua plataforma de operações integrada. Vamos conhecer os principais módulos.',
    icon: Rocket,
  },
  {
    title: 'Sunday — Gestão de Tarefas',
    description:
      'Organize projetos com kanban, tabela, subtarefas e dependências. Tudo num só lugar.',
    icon: Table2,
  },
  {
    title: 'Speaks — Mensagens',
    description:
      'Comunique-se com a equipe por canais. Menções, threads, reações e anexos.',
    icon: MessageSquare,
  },
  {
    title: 'Produção — Lançamentos',
    description:
      'Acompanhe etapas de cada lançamento com Gantt, responsáveis e prazos.',
    icon: Rocket,
  },
  {
    title: 'Pedidos & Tickets',
    description:
      'Gerencie pedidos problemáticos e chamados de TI com workflow e SLA.',
    icon: Briefcase,
  },
  {
    title: 'Pronto para começar!',
    description:
      'Use Ctrl+K a qualquer momento para busca rápida e navegação.',
    icon: Sparkles,
  },
];

export function OnboardingTour() {
  const alreadyDone = localStorage.getItem('onboarding_complete') === 'true';
  const [open, setOpen] = useState(!alreadyDone);
  const [step, setStep] = useState(0);

  if (alreadyDone) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const Icon = current.icon;

  function complete() {
    localStorage.setItem('onboarding_complete', 'true');
    setOpen(false);
  }

  function next() {
    if (isLast) {
      complete();
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) complete(); }}>
      <DialogContent className="sm:max-w-md">
        {/* Step indicator dots */}
        <div className="flex justify-center gap-1.5 pt-2">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === step ? 'bg-primary' : 'bg-muted-foreground/25'
              }`}
            />
          ))}
        </div>

        <DialogHeader className="items-center text-center pt-4">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-7 w-7" />
          </div>
          <DialogTitle className="text-lg">{current.title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            {current.description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 pt-4 pb-2">
          <Button onClick={next} className="w-full gap-2">
            {isLast ? 'Começar' : 'Próximo'}
            {!isLast && <ChevronRight className="h-4 w-4" />}
          </Button>

          {!isLast && (
            <button
              type="button"
              onClick={complete}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Pular
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
