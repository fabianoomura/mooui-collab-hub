import { SectorBoardsPage, type BoardCard } from '@/features/boards';

const boards: BoardCard[] = [
  {
    key: 'acoes-mensais',
    label: 'Ações Mensais',
    color: '#0EA5E9',
    aliases: [
      'Modulo | Acoes Mensais',
      '0 - Acoes Mensais',
      '1780430011',
      'Acoes Mensais',
    ],
  },
];

export default function AcoesMensaisPage() {
  return (
    <SectorBoardsPage
      title="Ações Mensais"
      description="Planejamento de ações mensais e calendário."
      cards={boards}
    />
  );
}
