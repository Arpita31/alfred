import { ReactNode } from 'react';
import { Card } from './Card';
import { SectionLabel } from './SectionLabel';
import { EmptyState } from './EmptyState';
import { ViewStyle } from 'react-native';

interface Props {
  label: string;
  isEmpty: boolean;
  emptyIcon?: string;
  emptyMessage: string;
  children: ReactNode;
  style?: ViewStyle;
}

/**
 * A Card with a SectionLabel that renders either `children` or an EmptyState.
 * Eliminates the repeated conditional pattern used in 5+ screens:
 *
 *   {history.length > 0 ? (
 *     <Card><SectionLabel label="x" />{history.map(...)}</Card>
 *   ) : (
 *     <EmptyState ... />
 *   )}
 *
 * Usage:
 *   <DataCard label="recent" isEmpty={!history.length} emptyMessage="Log your first workout">
 *     {history.slice(0,5).map(...)}
 *   </DataCard>
 */
export function DataCard({ label, isEmpty, emptyIcon, emptyMessage, children, style }: Props) {
  if (isEmpty) return <EmptyState icon={emptyIcon} message={emptyMessage} />;
  return (
    <Card style={style}>
      <SectionLabel label={label} />
      {children}
    </Card>
  );
}
