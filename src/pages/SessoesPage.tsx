import { SectorBoardsPage, type BoardCard } from '@/features/boards';

const boards: BoardCard[] = [
  {
    key: 'sessoes',
    label: 'Calendario de Fotos e Videos',
    color: '#8B5CF6',
    aliases: [
      'Modulo | Sessoes | Calendario de Fotos e Videos',
      '1780430231',
      'Calendario de Fotos e Videos',
    ],
  },
];

export default function SessoesPage() {
  return (
    <SectorBoardsPage
      title="Sessoes"
      description="Planejamento de producao de fotos e videos."
      cards={boards}
    />
  );
}
