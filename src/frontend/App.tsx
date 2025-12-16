import { useState, useEffect } from 'react';
import { DayView } from './components/DayView';
import { Sidebar } from './components/Sidebar';
import { SkejEvent } from '../types';
import { format } from 'date-fns';

function App() {
    const [events, setEvents] = useState<SkejEvent[]>([]);

    const fetchEvents = async () => {
        try {
            const res = await fetch('/api/events');
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setEvents(data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    const handleCreate = async (title: string, start: string, duration: number) => {
        // Naive creation for now
        // Calc end time
        // In a real app we'd better parse the date strings
        const today = format(new Date(), "yyyy-MM-dd");
        const startTime = `${today}T${start}:00`;
        // Just helper: we can let backend handle or do it here.
        // Let's assume the API desires full ISO strings.
        const startDate = new Date(startTime);
        const endDate = new Date(startDate.getTime() + duration * 60000);

        await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                start_time: startDate.toISOString(),
                end_time: endDate.toISOString(),
                color: '#3b82f6'
            })
        });
        fetchEvents();
    };

    const handleDelete = async (id: number) => {
        await fetch(`/api/events/${id}`, { method: 'DELETE' });
        setEvents(events.filter(e => e.id !== id));
    };

    const handleUpdate = async (id: number, updates: Partial<SkejEvent>) => {
        await fetch(`/api/events/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        fetchEvents();
    };

    return (
        <div className="flex h-screen bg-bg text-text">
            <Sidebar onCreate={handleCreate} />
            <main className="flex-1 flex flex-col overflow-hidden bg-black text-white">
                <header className="p-4 bg-black border-b flex justify-between items-center z-10">
                    <h1 className="text-xl font-bold flex items-center gap-2 uppercase tracking-widest">
                        <span>[TIMELINE_VIEW]</span>
                    </h1>
                    <div className="text-sm text-dim font-mono">{format(new Date(), "yyyy-MM-dd").toUpperCase()}</div>
                </header>
                <DayView
                    events={events}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                />
            </main>
        </div>
    );
}

export default App;
