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
        const { context, date, existingTasks } = req.body;
        const audioFile = req.file;

        if (!audioFile) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        // Read the audio file
        const audioData = fs.readFileSync(audioFile.path);
        const base64Audio = audioData.toString('base64');

        // Determine mime type from file extension or default to webm
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

        // Build the prompt
        const systemPrompt = `You are a smart scheduling assistant. Listen to the user's voice message and manage their schedule.

User Context (preferences, location, etc.):
${context || 'No additional context provided.'}

Current Date: ${date || new Date().toLocaleDateString()}

EXISTING SCHEDULE:
${currentTasks.length > 0 ? JSON.stringify(currentTasks, null, 2) : 'No tasks scheduled yet.'}

IMPORTANT INSTRUCTIONS:
1. Listen to what the user wants to do - they may want to:
   - ADD new tasks
   - MODIFY existing tasks (change time, duration, name, subtasks)
   - DELETE tasks
   - Or a combination of the above
2. For each task operation, specify the action type
3. For modifications, reference the task by its ID
4. For new tasks, determine:
   - The best start time (hour 0-23, and minute 0, 15, 30, or 45)
   - Duration in minutes (15, 30, 45, 60, 90, 120, etc.)
   - A list of subtasks/steps to complete that task
5. If the user says things like "move yoga to 8pm" or "change the time of...", MODIFY the existing task
6. If the user says "cancel", "remove", "delete" a task, DELETE it
7. Generate helpful subtasks for new/modified tasks
8. Return ONLY valid JSON, no other text

Return your response as JSON in this exact format:
{
  "operations": [
    {
      "action": "add",
      "task": {
        "text": "Task name",
        "hour": 8,
        "minute": 0,
        "duration": 60,
        "subtasks": ["Step 1", "Step 2"]
      }
    },
    {
      "action": "update",
      "id": 123,
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
      "id": 456
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
