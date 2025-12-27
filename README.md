# skej

Voice-driven AI scheduler powered by Gemini 3. Just talk about your day and AI automatically schedules it for you.

## Quick Start

1. **Get a Gemini API Key**
   - Go to [Google AI Studio](https://aistudio.google.com/apikey)
   - Create an API key

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your GEMINI_API_KEY
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Run the app**
   ```bash
   npm start
   ```

5. **Open in browser**
   - Frontend: http://localhost:3000
   - API: http://localhost:3001

## Usage

1. Click the ⚙️ button to add context (e.g., "I live in Chicago")
2. Click the 🎤 microphone button and speak
3. Say something like: "Tomorrow I want to do yoga at 7pm and go to Costco as early as possible"
4. AI will automatically add tasks to your schedule
5. Drag tasks to adjust times if needed

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS
- **Backend**: Node.js + Express
- **AI**: Google Gemini 3 Flash

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/schedule` | Upload audio file to schedule tasks |
| POST | `/api/schedule-text` | Text-based scheduling (fallback) |
| GET | `/api/health` | Health check |

## License

MIT
