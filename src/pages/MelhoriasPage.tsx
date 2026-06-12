import { SectorBoardsPage, type BoardCard } from '@/features/boards';

const boards: BoardCard[] = [
  { key: 'site', label: 'Site Melhorias', color: '#3B82F6', aliases: ['Modulo | Melhorias | Site', '1780430139', '6 Site', 'Site Melhorias'] },
  { key: 'shopify', label: 'Shopify Novo', color: '#22C55E', aliases: ['Modulo | Melhorias | Shopify Novo', '1780430149', 'Site Shopify Novo', 'Shopify'] },
  { key: 'seo_onpage', label: 'SEO On-Page', color: '#F59E0B', aliases: ['Modulo | Melhorias | SEO On-Page', '1780430199', 'SEO On Page', 'SEO On-Page'] },
  { key: 'seo_tecnico', label: 'SEO Tecnico', color: '#8B5CF6', aliases: ['Modulo | Melhorias | SEO Tecnico', '1780430208', 'SEO Tecnico', 'SEO Técnico'] },
];

export default function MelhoriasPage() {
  return (
    <SectorBoardsPage
      title="Melhorias"
      description="Boards Sunday de melhorias de site, Shopify e SEO."
      cards={boards}
    />
  );
}
