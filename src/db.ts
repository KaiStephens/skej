import { Database } from "bun:sqlite";
import type { SkejEvent, CreateEventInput, UpdateEventInput } from "./types";

const db = new Database("skej.db", { create: true });

// Initialize schema
db.query(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    description TEXT,
    is_done INTEGER DEFAULT 0
  )
`).run();

export const EventModel = {
    findAll: (): SkejEvent[] => {
        return db.query("SELECT * FROM events ORDER BY start_time ASC").all() as SkejEvent[];
    },

    findById: (id: number): SkejEvent | null => {
        return db.query("SELECT * FROM events WHERE id = $id").get({ $id: id }) as SkejEvent | null;
    },

    create: (event: CreateEventInput): SkejEvent => {
        const result = db.query(`
      INSERT INTO events (title, start_time, end_time, color, description)
      VALUES ($title, $start_time, $end_time, $color, $description)
      RETURNING *
    `).get({
            $title: event.title,
            $start_time: event.start_time,
            $end_time: event.end_time,
            $color: event.color || '#3b82f6',
            $description: event.description || null
        }) as SkejEvent;
        return result;
    },

    update: (id: number, event: UpdateEventInput): SkejEvent | null => {
        // Dynamic update query
        const updates: string[] = [];
        const params: any = { $id: id };

        if (event.title !== undefined) { updates.push("title = $title"); params.$title = event.title; }
        if (event.start_time !== undefined) { updates.push("start_time = $start_time"); params.$start_time = event.start_time; }
        if (event.end_time !== undefined) { updates.push("end_time = $end_time"); params.$end_time = event.end_time; }
        if (event.color !== undefined) { updates.push("color = $color"); params.$color = event.color; }
        if (event.description !== undefined) { updates.push("description = $description"); params.$description = event.description; }
        if (event.is_done !== undefined) { updates.push("is_done = $is_done"); params.$is_done = event.is_done ? 1 : 0; }

        if (updates.length === 0) return EventModel.findById(id);

        const result = db.query(`
      UPDATE events
      SET ${updates.join(", ")}
      WHERE id = $id
      RETURNING *
    `).get(params) as SkejEvent | null;

        return result;
    },

    delete: (id: number): void => {
        db.query("DELETE FROM events WHERE id = $id").run({ $id: id });
    },

    // For precise day scheduling
    findByDay: (dayStartIso: string, dayEndIso: string): SkejEvent[] => {
        // Basic string comparison works for ISO dates
        return db.query(`
      SELECT * FROM events 
      WHERE start_time >= $start AND start_time < $end
      ORDER BY start_time ASC
    `).all({ $start: dayStartIso, $end: dayEndIso }) as SkejEvent[];
    }
};
