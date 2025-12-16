#!/usr/bin/env bun
import { Command } from "commander";
import { EventModel } from "./db";
import { startServer } from "./server";
import { format, addHours, parseISO } from "date-fns";

const program = new Command();

program
    .name("skej")
    .description("CLI for the Skej scheduling app")
    .version("1.0.0");

program.command("list")
    .description("List all events")
    .action(() => {
        const events = EventModel.findAll();
        if (events.length === 0) {
            console.log("No events found.");
            return;
        }
        console.log("Your Schedule:");
        events.forEach(e => {
            const start = format(new Date(e.start_time), "HH:mm");
            const end = format(new Date(e.end_time), "HH:mm");
            console.log(`[${e.id}] ${start} - ${end}: ${e.title} ${e.is_done ? "(DONE)" : ""}`);
        });
    });

program.command("add")
    .description("Add a new event")
    .requiredOption("-t, --title <title>", "Event title")
    .requiredOption("-s, --start <time>", "Start time (HH:mm) today")
    .option("-d, --duration <minutes>", "Duration in minutes", "60")
    .action((options) => {
        const today = format(new Date(), "yyyy-MM-dd");
        const startIso = `${today}T${options.start}:00`;
        const startDate = new Date(startIso);
        const endDate = addHours(startDate, parseInt(options.duration) / 60); // approximate
        // better date math needed if duration isn't exact hours, but simple for now

        // Create accurate End ISO
        // actually let's just use date math
        const endTime = new Date(startDate.getTime() + parseInt(options.duration) * 60000);

        const event = EventModel.create({
            title: options.title,
            start_time: startDate.toISOString(),
            end_time: endTime.toISOString(),
            color: "#3b82f6",
            description: ""
        });
        console.log("Event created:", event);
    });

program.command("web")
    .description("Start the web server")
    .option("-p, --port <number>", "Port to run on", "3000")
    .action((options) => {
        startServer(parseInt(options.port));
    });

program.parse();
