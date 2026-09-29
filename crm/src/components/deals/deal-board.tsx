'use client';

import { useId, useMemo, useState, useTransition } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import { DealCard } from '@/components/deals/deal-card';
import { StageMoveSheet, type StageOption } from '@/components/deals/stage-move';
import { FormNotice } from '@/components/ui/field';
import { moveStageAction } from '@/lib/deals/actions';
import type { DealRow } from '@/lib/deals/queries';
import { cn } from '@/lib/utils';

/**
 * Drag-and-drop kanban, shown from 1024px (requirement 10). Cards are moved by
 * their grip handle (pointer or keyboard: focus the handle, Space, arrows,
 * Space). Moves are optimistic and roll back if the server refuses.
 */
export function DealBoard({ deals, stages, showRep }: { deals: DealRow[]; stages: StageOption[]; showRep: boolean }) {
  // A stable id keeps dnd-kit's accessibility ids identical on server and client.
  const dndId = useId();
  const [rows, setRows] = useState(deals);
  const [notice, setNotice] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ deal: DealRow; target: string; missing?: string[] } | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const byStage = useMemo(() => {
    const map = new Map<string, DealRow[]>(stages.map((stage) => [stage.key, []]));
    for (const row of rows) map.get(row.stage_key)?.push(row);
    return map;
  }, [rows, stages]);

  const setStage = (dealId: string, key: string) =>
    setRows((current) =>
      current.map((row) =>
        row.deal_id === dealId ? { ...row, stage_key: key, stage_name: stages.find((s) => s.key === key)?.name ?? row.stage_name } : row,
      ),
    );

  const onDragEnd = (event: DragEndEvent) => {
    const deal = rows.find((row) => row.deal_id === event.active.id);
    const target = event.over?.id as string | undefined;
    if (!deal || !target || target === deal.stage_key) return;
    setNotice(null);
    if (target === 'cancelled') {
      setSheet({ deal, target });
      return;
    }
    const previous = deal.stage_key;
    setStage(deal.deal_id, target);
    startTransition(async () => {
      const result = await moveStageAction({ dealId: deal.deal_id, stageKey: target });
      if (result.ok) return;
      setStage(deal.deal_id, previous);
      if (result.missing?.length) setSheet({ deal, target, missing: result.missing });
      else setNotice(result.error);
    });
  };

  return (
    <div>
      {notice ? (
        <div className="mb-3">
          <FormNotice>{notice}</FormNotice>
        </div>
      ) : null}
      <DndContext id={dndId} sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <Column key={stage.key} stage={stage} deals={byStage.get(stage.key) ?? []} showRep={showRep} />
          ))}
        </div>
      </DndContext>
      {sheet ? (
        <StageMoveSheet
          key={`${sheet.deal.deal_id}-${sheet.target}`}
          open
          onOpenChange={(open) => !open && setSheet(null)}
          dealId={sheet.deal.deal_id}
          currentKey={sheet.deal.stage_key}
          stages={stages}
          initialTarget={sheet.target}
          initialMissing={sheet.missing}
          onMoved={(key) => setStage(sheet.deal.deal_id, key)}
        />
      ) : null}
    </div>
  );
}

function Column({ stage, deals, showRep }: { stage: StageOption; deals: DealRow[]; showRep: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${stage.name}, ${deals.length} deals`}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-2xl border bg-paper-sunk/60 p-2',
        isOver ? 'border-brand bg-brand-soft/60' : 'border-line',
      )}
    >
      <header className="flex items-center justify-between px-2 py-2">
        <h2 className={cn('text-sm font-semibold', stage.key === 'cancelled' && 'text-danger')}>{stage.name}</h2>
        <span className="rounded-full bg-paper-raised px-2 text-xs font-semibold text-ink-mute">{deals.length}</span>
      </header>
      <ul className="flex min-h-24 flex-col gap-2">
        {deals.map((deal) => (
          <DraggableCard key={deal.deal_id} deal={deal} showRep={showRep} />
        ))}
      </ul>
    </section>
  );
}

function DraggableCard({ deal, showRep }: { deal: DealRow; showRep: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.deal_id });
  return (
    <li
      ref={(el) => {
        setNodeRef(el);
        // Transform is applied through the CSSOM (never a style attribute), so
        // the strict CSP stays intact while dragging.
        if (el) el.style.transform = transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : '';
      }}
      className={cn('relative', isDragging && 'z-10 opacity-80 shadow-lg')}
    >
      <DealCard deal={deal} showStage={false} showRep={showRep} />
      <button
        type="button"
        aria-label={`Move ${deal.customer_name}`}
        className="absolute right-1.5 top-1.5 inline-flex h-10 w-10 cursor-grab items-center justify-center rounded-lg text-ink-mute hover:bg-paper-sunk active:cursor-grabbing"
        {...listeners}
        {...attributes}
      >
        <GripVertical aria-hidden className="h-4 w-4" />
      </button>
    </li>
  );
}
