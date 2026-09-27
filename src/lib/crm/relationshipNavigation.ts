import type { BonnieRecordContext } from '@/contexts/BonnieDrawerContext';
import type { RelationshipContextValue, RelationshipRef } from '@/contexts/RelationshipContext';

const LABELS: Record<RelationshipRef['type'], string> = {
  customer:'Customer', contact:'Contact', lead:'Lead', deal:'Deal', project:'Project',
  contract:'Contract', invoice:'Invoice', quote:'Quote', meeting:'Meeting', document:'Document', portal:'Portal',
};

export function relationshipBonnieContexts(relationship: RelationshipContextValue | null | undefined): BonnieRecordContext[] {
  if (!relationship) return [];
  return relationship.related.map((ref) => ({ type: LABELS[ref.type], id: ref.id, label: ref.label || LABELS[ref.type] }));
}
