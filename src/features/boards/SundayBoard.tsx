import TableViewPage from '@/pages/TableViewPage';

interface SundayBoardProps {
  projectId: string;
  embedded?: boolean;
}

/**
 * SundayBoard — the core board rendering component.
 *
 * Wraps TableViewPage in embedded mode. Module pages and SectorBoardsPage
 * should import this instead of TableViewPage directly.
 *
 * Props:
 * - projectId: required project UUID
 * - embedded: defaults to true (hides project selector, shows board title inline)
 */
export default function SundayBoard({ projectId, embedded = true }: SundayBoardProps) {
  return <TableViewPage projectId={projectId} embedded={embedded} />;
}
