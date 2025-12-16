import { useRef } from 'react';
import { DndContext, useDraggable, useDroppable, DragEndEvent } from '@dnd-kit/core';
import { format, differenceInMinutes, parseISO, addMinutes, startOfDay } from 'date-fns';
import { SkejEvent } from '../../types';
import clsx from 'clsx';
import { Trash2 } from 'lucide-react';

/* 
  CONSTANTS 
  1 hour = 60px
  1 min = 1px
*/
const PX_PER_MIN = 1;
const HOUR_HEIGHT = 60;

interface DayViewProps {
    events: SkejEvent[];
    onUpdate: (id: number, updates: Partial<SkejEvent>) => void;
    onDelete: (id: number) => void;
}

export function DayView({ events, onUpdate, onDelete }: DayViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // We make the drop area the entire day track
    const { setNodeRef } = useDroppable({
        id: 'day-track',
    });

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, delta } = event;
        const draggingId = active.id as number;
        const movedY = delta.y;

        // Convert pixels to minutes (1px = 1min)
        const minutesMoved = Math.round(movedY / PX_PER_MIN);

        // Snap to 15 mins? Let's snap to 5 mins
        const snappedMinutes = Math.round(minutesMoved / 5) * 5;

        if (snappedMinutes === 0) return;

        const originalEvent = events.find(e => e.id === draggingId);
        if (!originalEvent) return;

        const newStart = addMinutes(parseISO(originalEvent.start_time), snappedMinutes);
        const newEnd = addMinutes(parseISO(originalEvent.end_time), snappedMinutes);

        onUpdate(draggingId, {
            start_time: newStart.toISOString(),
            end_time: newEnd.toISOString()
        });
    };

    return (
        <div className="flex-1 overflow-y-auto bg-white relative">
            <div className="day-grid" style={{ height: 24 * HOUR_HEIGHT }}>
                {/* Time Labels */}
                <div className="flex flex-col select-none">
                    {Array.from({ length: 24 }).map((_, i) => (
                        <div key={i} className="time-label">
                            {format(new Date().setHours(i, 0, 0, 0), "h a")}
                        </div>
                    ))}
                </div>

                {/* Day Track */}
                <DndContext onDragEnd={handleDragEnd}>
                    <div ref={setNodeRef} className="day-track h-full w-full relative">
                        {/* Grid Lines helper can be done via CSS background (already in index.css) */}

                        {events.map(event => (
                            <DraggableEvent
                                key={event.id}
                                event={event}
                                onDelete={() => onDelete(event.id)}
                            />
                        ))}
                    </div>
                </DndContext>
            </div>
        </div>
    );
}

function DraggableEvent({ event, onDelete }: { event: SkejEvent, onDelete: () => void }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: event.id,
    });

    const start = parseISO(event.start_time);
    const end = parseISO(event.end_time);
    const today = startOfDay(new Date());

    // Calculate top position based on minutes from start of day (local time, simplified)
    // Note: This relies on the event being on the "current day" displayed.
    // If we want to support any day, we should normalize.
    // For this prototype, we assume the event date matches current view or we just extract hours/mins.

    const minutesFromMidnight = start.getHours() * 60 + start.getMinutes();
    const duration = differenceInMinutes(end, start);

    const style = {
        top: `${minutesFromMidnight * PX_PER_MIN}px`,
        height: `${duration * PX_PER_MIN}px`,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging ? 50 : 10,
        opacity: isDragging ? 0.8 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={clsx("event-card flex flex-col justify-center", event.is_done && "opacity-50 grayscale")}
        >
            <div className="font-semibold text-sm leading-tight">{event.title}</div>
            <div className="text-xs opacity-90 flex justify-between items-center group">
                <span>{format(start, "h:mm")} - {format(end, "h:mm")}</span>
                <button
                    className="p-1 hover:bg-black/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    onPointerDown={(e) => {
                        e.stopPropagation(); // prevent drag
                        onDelete();
                    }}
                >
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    );
}
