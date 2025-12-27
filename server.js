import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Initialize Gemini with API key from .env
if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not found in .env file');
    console.error('   Create a .env file with: GEMINI_API_KEY=your_key_here');
    console.error('   Get a key at: https://aistudio.google.com/apikey');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for audio uploads
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Schedule endpoint - receives audio and returns scheduled tasks
app.post('/api/schedule', upload.single('audio'), async (req, res) => {
    try {
        const { context, date, existingTasks, viewMode, weekDates } = req.body;
        const audioFile = req.file;

        if (!audioFile) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        // Read the audio file
        const audioData = fs.readFileSync(audioFile.path);
        const base64Audio = audioData.toString('base64');

        // Determine mime type
        let mimeType = 'audio/webm';
        if (audioFile.originalname) {
            const ext = path.extname(audioFile.originalname).toLowerCase();
            if (ext === '.mp3') mimeType = 'audio/mp3';
            else if (ext === '.wav') mimeType = 'audio/wav';
            else if (ext === '.m4a') mimeType = 'audio/m4a';
            else if (ext === '.ogg') mimeType = 'audio/ogg';
        }

        // Parse existing tasks
        let currentTasks = [];
        try {
            currentTasks = JSON.parse(existingTasks || '[]');
        } catch (e) {
            currentTasks = [];
        }

        // Parse historical tasks for pattern recognition
        let historicalTasks = [];
        try {
            historicalTasks = JSON.parse(req.body.historicalTasks || '[]');
        } catch (e) {
            historicalTasks = [];
        }

        // Parse week dates if in weekly mode
        let weekInfo = '';
        if (viewMode === 'weekly') {
            try {
                const dates = JSON.parse(weekDates || '[]');
                weekInfo = `\nAVAILABLE DAYS THIS WEEK:\n${dates.map(d => `- ${d.dayName} (${d.date})`).join('\n')}\n`;

                // Also parse next week dates for future scheduling
                const nextWeekDates = req.body.nextWeekDates;
                if (nextWeekDates) {
                    const nextDates = JSON.parse(nextWeekDates);
                    weekInfo += `\nNEXT WEEK (for "schedule next week" requests):\n${nextDates.map(d => `- ${d.dayName} (${d.date})`).join('\n')}\n`;
                }
            } catch (e) { }
        }

        // Build historical patterns summary
        let patternInfo = '';
        if (historicalTasks.length > 0) {
            // Group by task name and day of week to find patterns
            const patterns = {};
            historicalTasks.forEach(t => {
                const key = `${t.text}|${t.dayOfWeek}`;
                if (!patterns[key]) {
                    patterns[key] = { text: t.text, dayOfWeek: t.dayOfWeek, count: 0, hour: t.hour };
                }
                patterns[key].count++;
            });

            const recurringTasks = Object.values(patterns).filter(p => p.count >= 1);
            if (recurringTasks.length > 0) {
                patternInfo = `\nHISTORICAL PATTERNS (from past 2 weeks - use these as defaults for recurring tasks):
${recurringTasks.map(p => `- "${p.text}" on ${p.dayOfWeek}s at ${p.hour > 12 ? p.hour - 12 : p.hour}${p.hour >= 12 ? 'PM' : 'AM'} (occurred ${p.count}x)`).join('\n')}\n`;
            }
        }

        // Build the prompt
        const isWeekly = viewMode === 'weekly';
        const systemPrompt = `You are a smart scheduling assistant. Listen to the user's voice message and manage their ${isWeekly ? 'weekly' : 'daily'} schedule.

User Context (preferences, location, etc.):
${context || 'No additional context provided.'}
${patternInfo}
${isWeekly ? 'Current Week' : 'Current Date'}: ${date || new Date().toLocaleDateString()}
${weekInfo}
EXISTING SCHEDULE FOR THIS ${isWeekly ? 'WEEK' : 'DAY'}:
${currentTasks.length > 0 ? JSON.stringify(currentTasks, null, 2) : 'No tasks scheduled yet.'}

IMPORTANT INSTRUCTIONS:
1. Listen to what the user wants to do - they may want to:
   - ADD new tasks
   - MODIFY existing tasks (change time, duration, name, subtasks)
   - DELETE tasks
   - Schedule their ENTIRE week with multiple tasks per day
   - Schedule a FUTURE week (next week, week after, etc.) - use appropriate future dates
2. For each task operation, specify the action type
3. For modifications, reference the task by its ID${isWeekly ? ' and date' : ''}
4. For new tasks, determine:
   - ${isWeekly ? 'The date (YYYY-MM-DD format) - CRITICAL: use correct dates from AVAILABLE DAYS list' : ''}
   - The best start time (hour 0-23, and minute 0, 15, 30, or 45)
   - Duration in minutes (15, 30, 45, 60, 90, 120, etc.)
   - A list of subtasks/steps to complete that task
${isWeekly ? `5. WEEKLY SCHEDULING RULES:
   - When user says "plan my week" or "schedule my entire week", create tasks for EVERY DAY (Sunday through Saturday)
   - Use the HISTORICAL PATTERNS to add recurring tasks (like school, work) to appropriate days
   - Each day should have multiple tasks scheduled based on user context and patterns
   - If user mentions "next week" - calculate dates for the FOLLOWING week
   - ALWAYS include a date (YYYY-MM-DD) for each task in weekly mode
   - Schedule realistically - morning routines, meals, activities, evening wind-down` : ''}
6. If the user mentions a day of the week (Monday, Tuesday, etc.), schedule on that day
7. If the user says "move yoga to 8pm" or "change the time of...", MODIFY the existing task
8. If the user says "cancel", "remove", "delete" a task, DELETE it
9. Generate helpful subtasks for complex tasks (getting ready, workouts, etc.)
10. Return ONLY valid JSON, no other text

Return your response as JSON in this exact format:
{
  "operations": [
    {
      "action": "add",
      ${isWeekly ? '"date": "YYYY-MM-DD",' : ''}
      "task": {
        "text": "Task name",
        ${isWeekly ? '"date": "YYYY-MM-DD",' : ''}
        "hour": 8,
        "minute": 0,
        "duration": 60,
        "subtasks": ["Step 1", "Step 2"]
      }
    },
    {
      "action": "update",
      "id": 123,
      ${isWeekly ? '"date": "YYYY-MM-DD",' : ''}
      "changes": {
        "hour": 19,
        "minute": 30,
        "text": "Updated name",
        "duration": 45,
        "subtasks": ["New step 1", "New step 2"]
      }
    },
    {
      "action": "delete",
      "id": 456${isWeekly ? ',\n      "date": "YYYY-MM-DD"' : ''}
    }
  ],
  "message": "Brief confirmation of what was done"
}`;

        // Call Gemini 3 Flash with the audio
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [
                {
                    parts: [
                        { text: systemPrompt },
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: base64Audio
                            }
                        }
                    ]
                }
            ],
            config: {
                thinkingConfig: {
                    thinkingLevel: 'low'
                },
                responseMimeType: 'application/json'
            }
        });

        // Clean up uploaded file
        fs.unlinkSync(audioFile.path);

        // Parse the response
        const responseText = response.text;
        console.log('Gemini response:', responseText);

        let parsed;
        try {
            parsed = JSON.parse(responseText);
        } catch (e) {
            // Try to extract JSON from the response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Could not parse AI response as JSON');
            }
        }

        res.json(parsed);

    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({
            error: 'Failed to process audio',
            details: error.message
        });
    }
});

// Text-based schedule endpoint (fallback)
app.post('/api/schedule-text', async (req, res) => {
    try {
        const { text, context, date } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'No text provided' });
        }

        const systemPrompt = `You are a smart scheduling assistant. Parse the user's request into scheduled tasks.

User Context: ${context || 'None'}
Current Date: ${date || new Date().toLocaleDateString()}

User Request: "${text}"

Rules:
- For specific times mentioned, use that hour (7 PM = 19)
- For "early" or "as early as possible", use 8 AM
- For stores/businesses, assume typical opening hours (Costco opens at 10 AM)
- Return ONLY valid JSON

Return JSON:
{
  "tasks": [{ "text": "...", "hour": 0-23 }],
  "message": "Brief confirmation"
}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: systemPrompt,
            config: {
                thinkingConfig: {
                    thinkingLevel: 'low'
                },
                responseMimeType: 'application/json'
            }
        });

        const parsed = JSON.parse(response.text);
        res.json(parsed);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', model: 'gemini-3-flash-preview' });
});

app.listen(PORT, () => {
    console.log(`🚀 skej server running on http://localhost:${PORT}`);
    console.log('📍 Endpoints:');
    console.log('   POST /api/schedule - Upload audio to schedule tasks');
    console.log('   POST /api/schedule-text - Text-based scheduling');
    console.log('   GET  /api/health - Health check');
});
