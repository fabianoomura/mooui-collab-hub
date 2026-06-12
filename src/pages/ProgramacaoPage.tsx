import { SectorBoardsPage, type BoardCard } from '@/features/boards';

const boards: BoardCard[] = [
  { key: 'mooui_kids', label: 'MOOUI Kids', color: '#EC4899', aliases: ['Modulo | Programacao | MOOUI Kids'] },
  { key: 'mooui_home', label: 'MOOUI Home', color: '#F59E0B', aliases: ['Modulo | Programacao | MOOUI Home'] },
  { key: 'amo_mooui', label: 'Amo MOOUI', color: '#F43F5E', aliases: ['Modulo | Programacao | Amo MOOUI'] },
  { key: 'barcelona', label: 'Barcelona', color: '#3B82F6', aliases: ['Modulo | Programacao | Barcelona'] },
  { key: 'outras_redes', label: 'Outras Redes', color: '#64748B', aliases: ['Modulo | Programacao | Outras Redes'] },
  { key: 'pinterest', label: 'Pinterest', color: '#DC2626', aliases: ['Modulo | Programacao | Pinterest'] },
];

export default function ProgramacaoPage() {
  return (
    <SectorBoardsPage
      title="Programacao"
      description="Boards de programacao de conteudo por rede social."
      cards={boards}
    />
  );
}
