import { EventModel } from "./db";
import type { CreateEventInput, UpdateEventInput } from "./types";
import { generateSchedule } from "./ai";

// Simple CORS middleware for development if needed, though we serve from same origin usually
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

export function startServer(port: number = 3000) {
    Bun.serve({
        port,
        async fetch(req) {
            const url = new URL(req.url);

            // CORS preflight
            if (req.method === "OPTIONS") {
                return new Response(null, { headers: CORS_HEADERS });
            }

            // API Routes
            if (url.pathname.startsWith("/api/events")) {
                try {
                    if (req.method === "GET") {
                        const events = EventModel.findAll();
                        return Response.json(events, { headers: CORS_HEADERS });
                    }

                    if (req.method === "POST") {
                        const body = await req.json() as CreateEventInput;
                        const newEvent = EventModel.create(body);
                        return Response.json(newEvent, { headers: CORS_HEADERS });
                    }

                    if (req.method === "PUT") {
                        // Extract ID from URL if we supported /api/events/:id, but simpler to expect ID in body or query for now?
                        // Actually let's use path params properly
                        // But for now, let's just handle update via POST to /api/events/:id/update or slightly hacky
                    }
                } catch (e: any) {
                    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS_HEADERS });
                }
            }


            // POST /api/generate
            if (url.pathname === "/api/generate" && req.method === "POST") {
                const body = await req.json();
                // Basic validation
                if (!body.prompt || !body.apiKey) {
                    return new Response(JSON.stringify({ error: "Missing prompt or apiKey" }), { status: 400, headers: CORS_HEADERS });
                }

                try {
                    // 1. Generate schedule via AI
                    const aiEvents = await generateSchedule({
                        prompt: body.prompt,
                        model: body.model || "openai/gpt-3.5-turbo",
                        apiKey: body.apiKey
                    });

                    // 2. Clear existing events for today (simplification: clear ALL events? prompt said "make that the day")
                    // The user said "schedule the next day... singular day... make that the day"
                    // Let's assume we clear everything for the specific range generated, or just clear DB for prototype as it's a "single day app".
                    // Since the app is built as a single day view, clearing all events is safest to match "make that the day".
                    // But let's be nicer: clear events that overlap with today.
                    // For now, let's keep it simple: the user wants to "make that the day". We'll clear all events.

                    // Actually, let's just delete everything.
                    const allEvents = EventModel.findAll();
                    allEvents.forEach(e => EventModel.delete(e.id));

                    // 3. Insert new events
                    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
                    const createdEvents = [];

                    for (const e of aiEvents) {
                        // Convert HH:mm to ISO date for today
                        // Warning: e.start_time must be HH:mm
                        const startIso = `${today}T${e.start_time}:00`;
                        const endIso = `${today}T${e.end_time}:00`;

                        const newEvent = EventModel.create({
                            title: e.title,
                            start_time: startIso,
                            end_time: endIso,
                            color: "#ffffff", // White for hacker theme
                            description: e.description
                        });
                        createdEvents.push(newEvent);
                    }

                    return Response.json(createdEvents, { headers: CORS_HEADERS });

                } catch (error: any) {
                    console.error(error);
                    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS });
                }
            }

            // Handle specific ID routes manually since Bun serves doesn't have a router by default
            // DELETE /api/events/:id
            const deleteMatch = url.pathname.match(/^\/api\/events\/(\d+)$/);
            if (deleteMatch && req.method === "DELETE") {
                const id = parseInt(deleteMatch[1] || "0");
                EventModel.delete(id);
                return new Response(null, { status: 204, headers: CORS_HEADERS });
            }

            // PUT /api/events/:id
            if (deleteMatch && req.method === "PUT") {
                const id = parseInt(deleteMatch[1] || "0");
                const body = await req.json() as UpdateEventInput;
                const updated = EventModel.update(id, body);
                return Response.json(updated, { headers: CORS_HEADERS });
            }

            // Static Files Serving
            // We will assume the frontend is built into `dist` or we just serve `index.html` for SPA 
            // For development, we might want to proxy to Vite, but user asked for "run on browser", not necessarily "dev mode with HMR"
            // However, to make it easy to develop, we can serve the Vite build output.

            // Let's defer static serving logic to the fact that we might run `bun run dev` (Vite) for frontend dev
            // BUT, the request said "run on browser... save everything locally... full system".
            // Best approach: This CLI starts the API server. We can ALSO start Vite.
            // Or we can simple serve the `dist` folder if it exists.

            const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
            const file = Bun.file(`dist${filePath}`);
            if (await file.exists()) {
                return new Response(file);
            }

            // Fallback for SPA routing
            const index = Bun.file("dist/index.html");
            if (await index.exists()) {
                return new Response(index);
            }

            return new Response("Frontend not built. Run `bun run build` or start vite server.", { status: 404 });
        },
    });
    console.log(`Server listening on http://localhost:${port}`);
}
