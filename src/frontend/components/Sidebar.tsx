import { useState } from 'react';

interface SidebarProps {
    onCreate: (title: string, start: string, duration: number) => void;
}

export function Sidebar({ onCreate }: SidebarProps) {
    // Manual add state
    const [title, setTitle] = useState('');
    const [start, setStart] = useState('09:00');
    const [duration, setDuration] = useState(60);

    // AI state
    const [prompt, setPrompt] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('openai/gpt-4o');
    const [loading, setLoading] = useState(false);

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title) return;
        onCreate(title, start, duration);
        setTitle('');
    };

    const handleAISubmit = async () => {
        if (!prompt || !apiKey) {
            alert("Please enter a prompt and API Key");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, apiKey, model })
            });
            if (!res.ok) {
                const err = await res.text();
                throw new Error(err);
            }
            // Refresh page to see changes (primitive but effective for prototype)
            window.location.reload();
        } catch (e: any) {
            alert("AI Generation Failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <aside className="w-80 border-r flex flex-col gap-8 p-4 z-20 bg-black text-white overflow-y-auto">
            <div className="text-xl font-bold tracking-widest uppercase border-b pb-2">Skej_System://</div>

            {/* AI Section */}
            <section className="flex flex-col gap-4">
                <div className="text-sm font-bold opacity-50 uppercase">[AI_SCHEDULER]</div>

                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe your day: 'Gym at 9, code till noon, lunch...'"
                    className="h-32 resize-none"
                />

                <div className="flex gap-2">
                    <input
                        type="password"
                        placeholder="OpenRouter Key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full text-xs"
                    />
                </div>

                <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="text-xs"
                >
                    <option value="openai/gpt-4o">GPT-4o</option>
                    <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                    <option value="google/gemini-pro-1.5">Gemini Pro 1.5</option>
                    <option value="mistral/mistral-large">Mistral Large</option>
                </select>

                <button
                    onClick={handleAISubmit}
                    disabled={loading}
                    className="w-full"
                >
                    {loading ? "PROCESSING..." : "EXECUTE_OPTIMIZATION"}
                </button>
            </section>

            <hr className="border-t border-[var(--color-border)]" />

            {/* Manual Section */}
            <section className="flex flex-col gap-4 opacity-80">
                <div className="text-sm font-bold opacity-50 uppercase">[MANUAL_OVERRIDE]</div>
                <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="TASK_NAME"
                    />

                    <div className="flex gap-2">
                        <input
                            type="time"
                            value={start}
                            onChange={(e) => setStart(e.target.value)}
                            className="w-1/2"
                        />
                        <select
                            value={duration}
                            onChange={(e) => setDuration(parseInt(e.target.value))}
                            className="w-1/2"
                        >
                            <option value={15}>15m</option>
                            <option value={30}>30m</option>
                            <option value={60}>1h</option>
                            <option value={120}>2h</option>
                        </select>
                    </div>

                    <button type="submit">INSERT_TASK</button>
                </form>
            </section>

            <div className="mt-auto text-[10px] opacity-40 uppercase">
                Drag blocks to modify timeframe.
                <br />
                Local_DB: Connected.
            </div>
        </aside>
    );
}
