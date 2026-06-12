import { SectorBoardsPage, type BoardCard } from '@/features/boards';

const boards: BoardCard[] = [
  {
    key: 'demandas',
    label: 'Demandas Marketing',
    color: '#8B5CF6',
    aliases: [
      'Modulo | Demandas Marketing',
      'Excel | marketing demandas (1780430344)',
      'Marketing Demandas 1780430344',
      'Demandas Marketing 1780430344',
    ],
  },
];

export default function DemandasMarketingPage() {
  return (
    <SectorBoardsPage
      title="Demandas Marketing"
      description="Board de demandas internas de marketing."
      cards={boards}
    />
  );
}
