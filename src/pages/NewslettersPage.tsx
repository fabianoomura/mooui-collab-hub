import { SectorBoardsPage, type BoardCard } from '@/features/boards';

const boards: BoardCard[] = [
  { key: 'brasil', label: 'Brasil', color: '#22C55E', aliases: ['Modulo | Newsletters | Brasil'] },
  { key: 'barcelona', label: 'Barcelona', color: '#3B82F6', aliases: ['Modulo | Newsletters | Barcelona'] },
];

export default function NewslettersPage() {
  return (
    <SectorBoardsPage
      title="Newsletters"
      description="Boards de newsletters Brasil e Barcelona."
      cards={boards}
      modulePrefix="Modulo | Newsletters"
    />
  );
}
