import { SectorBoardsPage, type BoardCard } from '@/features/boards';

const boards: BoardCard[] = [
  {
    key: 'producao',
    label: 'Produção',
    color: '#F97316',
    aliases: [
      'Modulo | Producao',
      'Modulo | Produção',
      'Excel | 1 Producao',
      '1 Producao',
    ],
  },
];

export default function ProducaoBoardsPage() {
  return (
    <SectorBoardsPage
      title="Produção — Boards"
      description="Boards de controle de produção (folders, compras). Lançamentos e checagens ficam nos módulos especializados."
      cards={boards}
    />
  );
}
