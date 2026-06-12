import { SectorBoardsPage, type BoardCard } from '@/features/boards';

const boards: BoardCard[] = [
  {
    key: 'produtos',
    label: 'Novos Produtos',
    color: '#F97316',
    aliases: [
      'Modulo | Produtos',
      '1780430319',
      '4 - novos produtos',
    ],
  },
];

export default function ProdutoPage() {
  return (
    <SectorBoardsPage
      title="Novos Produtos"
      description="Pipeline de desenvolvimento da concepcao a apresentacao."
      cards={boards}
    />
  );
}
