import { SectorBoardsPage, type BoardCard } from '@/features/boards';

const boards: BoardCard[] = [
  {
    key: 'internacional',
    label: 'Internacional',
    color: '#6366F1',
    aliases: [
      'Modulo | Internacional',
      'Excel | 9 Internacional',
      '9 Internacional',
    ],
  },
];

export default function InternacionalPage() {
  return (
    <SectorBoardsPage
      title="Internacional"
      description="Expansão internacional e operações globais."
      cards={boards}
    />
  );
}
