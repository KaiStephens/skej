export interface GenerateScheduleInput {
    prompt: string;
    model: string;
    apiKey: string;
}

export interface AIEvent {
    title: string;
    start_time: string; // HH:mm
    end_time: string; // HH:mm
    description?: string;
}

export async function generateSchedule(input: GenerateScheduleInput): Promise<AIEvent[]> {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${input.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/skej",
        },
        body: JSON.stringify({
            model: input.model,
            messages: [
                {
                    role: "system",
                    content: `You are a productivity expert AI. Your goal is to plan a precise daily schedule based on the user's input.
          
          You MUST return a JSON object with a single key "events" which is an array of event objects.
          
          Rule:
          1. Convert relative times (e.g. "lunch at 1") to 24-hour HH:mm format (e.g. "13:00").
          2. Infer durations if not specified (default to 30m or 1h depending on task).
          3. Ensure the schedule is logical (no overlapping events unless specified).
          4. Output JSON ONLY. No markdown, no explanations.
          
          Example Output:
          {
            "events": [
              { "title": "Math Class", "start_time": "13:00", "end_time": "14:00", "description": "Study algebra" },
              { "title": "Trash", "start_time": "14:00", "end_time": "14:15", "description": "Take out trash" }
            ]
          }`
                },
                {
                    role: "user",
                    content: input.prompt
                }
            ]
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenRouter API Error: ${err}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    try {
        // Attempt to parse strictly, or loose JSON parse if markdown is included
        const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(jsonStr);
        return parsed.events;
    } catch (e) {
        console.error("Failed to parse AI response:", content);
        throw new Error("Failed to parse AI schedule. Try again.");
    }
}
