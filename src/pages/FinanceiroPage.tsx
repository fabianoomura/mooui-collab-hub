import { SectorBoardsPage, type BoardCard } from '@/features/boards';

const boards: BoardCard[] = [
  {
    key: 'financeiro',
    label: 'Financeiro',
    color: '#16A34A',
    aliases: [
      'Modulo | Financeiro',
      'Excel | 3 Financeiro',
      '3 Financeiro',
    ],
  },
];

export default function FinanceiroPage() {
  return (
    <SectorBoardsPage
      title="Financeiro"
      description="Controle financeiro e fluxo de caixa."
      cards={boards}
    />
  );
}
