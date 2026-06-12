import { SectorBoardsPage, type BoardCard } from '@/features/boards';

const boards: BoardCard[] = [
  // Programação
  { key: 'mooui_kids', label: 'MOOUI Kids', color: '#EC4899', aliases: ['Modulo | Programacao | MOOUI Kids'] },
  { key: 'mooui_home', label: 'MOOUI Home', color: '#F59E0B', aliases: ['Modulo | Programacao | MOOUI Home'] },
  { key: 'amo_mooui', label: 'Amo MOOUI', color: '#F43F5E', aliases: ['Modulo | Programacao | Amo MOOUI'] },
  { key: 'barcelona', label: 'Barcelona', color: '#3B82F6', aliases: ['Modulo | Programacao | Barcelona'] },
  { key: 'outras_redes', label: 'Outras Redes', color: '#64748B', aliases: ['Modulo | Programacao | Outras Redes'] },
  { key: 'pinterest', label: 'Pinterest', color: '#DC2626', aliases: ['Modulo | Programacao | Pinterest'] },
  // Newsletters
  { key: 'nl_brasil', label: 'Newsletter Brasil', color: '#22C55E', aliases: ['Modulo | Newsletters | Brasil'] },
  { key: 'nl_barcelona', label: 'Newsletter Barcelona', color: '#2563EB', aliases: ['Modulo | Newsletters | Barcelona'] },
  // Demandas
  { key: 'demandas', label: 'Demandas Marketing', color: '#8B5CF6', aliases: ['Modulo | Demandas Marketing'] },
];

export default function ConteudoPage() {
  return (
    <SectorBoardsPage
      title="Marketing"
      description="Programacao de posts, newsletters e demandas do time."
      cards={boards}
    />
  );
}
