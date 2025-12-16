# Skej - A Precise Day Scheduler

Skej is a full-featured scheduling application built with Bun, React, SQLite, and Vanilla CSS. It works both as a CLI tool and a local web application.

## Features
- **Local First**: All data is stored in a local `skej.db` SQLite file.
- **Precise Scheduling**: Drag and drop interface for day planning.
- **CLI Support**: Add and list events directly from the terminal.
- **Modern UI**: Clean, glassmorphism-inspired design.

## Getting Started

### Prerequisites
- [Bun](https://bun.sh) (v1.0+)

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   bun install
   ```
3. Build the frontend:
   ```bash
   bun run build
   ```

## Usage

### Web Interface
Start the unified server (API + Frontend):
```bash
bun run start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

- **Add Events**: Use the sidebar to create tasks.
- **Drag & Drop**: Drag events on the timeline to reschedule them.
- **Persistence**: Everything is saved to `skej.db` instantly.

### CLI Interface
You can interact with your schedule via the command line.

**List Events:**
```bash
bun run cli list
```

**Add Event:**
```bash
bun run cli add -t "My Meeting" -s "14:00" -d 60
```
- `-t`: Title
- `-s`: Start time (HH:mm)
- `-d`: Duration in minutes (default 60)

### Development
To run the frontend with Hot Module Replacement (HMR):
```bash
bun run dev
```
Note: You will also need to run `bun run start` (on port 3000) in another terminal to serve the API, as the Vite dev server proxies `/api` requests to it.
