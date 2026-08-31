import { CONFIG } from '../config.js';

export class GeminiProvider {
    constructor() {
        this.baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent";

        this.systemPrompt = `You are Nova AI, a highly advanced, universally capable AI assistant. 

CORE PROTOCOL: UNIVERSAL RESEARCH & REASONING ENGINE
For every user query, first understand the intent, context, entities, ambiguity, and whether fresh/current information is required.
Then:
1. Break complex queries into smaller reasoning tasks.
2. Detect contradictions, outdated information, rumors, and uncertainty.
3. Separate confirmed facts, reported information, assumptions, and opinions.
4. Never present unverified information as fact.
5. Adapt reasoning depth automatically: simple query -> concise answer; complex query -> deep step-by-step reasoning.
6. Synthesize findings logically instead of just listing them.
7. Before answering, perform a final accuracy, relevance, completeness, and hallucination check.
8. If information is insufficient, clearly say what is unknown instead of guessing.

SPECIALIZED ROLES:
- Master Tech Support Expert: Deeply analyze images of laptop screens/errors. Extract error codes, diagnose exactly, and provide step-by-step solutions.
- Senior Software Engineer: Write flawless, clean, and perfectly working code in any language. Fix bugs with deep technical reasoning.
- News & Calendar Expert: Provide fresh, up-to-date news, events, and calendar details logically.

Always be direct, professional, and format your responses beautifully using Markdown (bolding, lists, code blocks).`;
    }

    async streamResponse(prompt, history = [], attachment = null, onChunk, signal) {
        if (!CONFIG.GEMINI_API_KEY) throw new Error("API_KEY_MISSING");

        let contents = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        let currentParts = [{ text: prompt || "Please analyze the attached information." }];

        if (attachment && attachment.type.startsWith('image/')) {
            const base64Data = attachment.data.split(',')[1];
            currentParts.unshift({ inline_data: { mime_type: attachment.type, data: base64Data } });
        } else if (attachment && (attachment.type === 'application/pdf' || attachment.type === 'text/plain' || attachment.type.includes('csv') || attachment.type.includes('wordprocessing'))) {
            currentParts[0].text = `Document Content:\n${attachment.data}\n\nUser Question: ${prompt}`;
        }

        contents.push({ role: 'user', parts: currentParts });

        const now = new Date();
        const dateString = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        const dynamicSystemInstruction = `${this.systemPrompt}\n\n[CRITICAL SYSTEM INFO]\nCurrent Date: ${dateString}\nCurrent Time: ${timeString}`;

        try {
            const response = await fetch(`${this.baseUrl}?alt=sse&key=${CONFIG.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    system_instruction: { parts: [{ text: dynamicSystemInstruction }] },
                    contents: contents 
                }),
                signal 
            });

            if (!response.ok) throw new Error("API_CONNECTION_ERROR");

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let fullText = '';
            let buffer = '';

            // True real-time chunk reading loop
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const textChunk = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                            if (textChunk) {
                                fullText += textChunk;
                                onChunk(fullText, textChunk); // Passing full text for markdown rendering
                            }
                        } catch (e) {}
                    }
                }
            }
            return fullText;
        } catch (error) {
            throw error;
        }
    }
}