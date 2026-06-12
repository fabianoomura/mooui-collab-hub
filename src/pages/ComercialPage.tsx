import { SectorBoardsPage, type BoardCard } from '@/features/boards';

const boards: BoardCard[] = [
  {
    key: 'atacado',
    label: 'Atacado',
    color: '#0EA5E9',
    aliases: [
      'Modulo | Atacado',
      'Excel | 7 Atacado',
      '7 Atacado',
    ],
  },
];

export default function ComercialPage() {
  return (
    <SectorBoardsPage
      title="Comercial"
      description="Feiras, B2B e gestão de atacado."
      cards={boards}
    />
  );
}
