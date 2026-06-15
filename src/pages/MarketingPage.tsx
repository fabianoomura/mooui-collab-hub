import { SectorBoardsPage, type BoardCard } from '@/features/boards';

const boards: BoardCard[] = [
  {
    key: 'marketing',
    label: 'Marketing',
    color: '#EC4899',
    aliases: [
      'Modulo | Marketing',
      '5 - Marketing',
      '1780430128',
      'Marketing',
    ],
  },
];

export default function MarketingPage() {
  return (
    <SectorBoardsPage
      title="Marketing"
      description="Board geral de marketing."
      cards={boards}
    />
  );
}
