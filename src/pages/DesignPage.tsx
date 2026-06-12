import { SectorBoardsPage, type BoardCard } from '@/features/boards';

const boards: BoardCard[] = [
  {
    key: 'design-colecao',
    label: 'Design Coleção',
    color: '#EC4899',
    aliases: [
      'Modulo | Design',
      'Excel | 2 Design',
      '2 Design',
    ],
  },
  {
    key: 'demandas-design',
    label: 'Demandas Design',
    color: '#F472B6',
    aliases: [
      'Modulo | Demandas Design',
      'Demandas Design',
    ],
  },
];

export default function DesignPage() {
  return (
    <SectorBoardsPage
      title="Design"
      description="Design de coleção e demandas internas do setor."
      cards={boards}
    />
  );
}
