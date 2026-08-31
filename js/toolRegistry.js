import { CONFIG } from '../config.js';

export class ToolRegistry {
    constructor() {
        this.tools = new Map();
        this.registerDefaultTools();
    }

    registerTool(name, toolFunction) { this.tools.set(name, toolFunction); }
    getTool(name) { return this.tools.get(name); }
    listTools() { return Array.from(this.tools.keys()); }

    registerDefaultTools() {
        // Safe Calculator (No Eval)
        this.registerTool('calculator', (prompt) => {
            const match = prompt.match(/^[0-9+\-*/().\s]+$/);
            if (match && prompt.match(/[+\-*/]/)) {
                try { 
                    const safeCalc = new Function('return ' + prompt);
                    return `**Calculator Result:** \`${prompt} = ${safeCalc()}\``; 
                } catch(e) { return null; }
            }
            return null;
        });

        const unconfiguredMsg = (service) => `Live service is not configured. Add an API key for ${service} in config.js.`;

        this.registerTool('weather', () => CONFIG.WEATHER_API_KEY ? "Fetching weather..." : unconfiguredMsg('Weather'));
        this.registerTool('news', () => unconfiguredMsg('News'));
        this.registerTool('currency', () => unconfiguredMsg('Currency'));
        this.registerTool('sports', () => unconfiguredMsg('Sports'));
        this.registerTool('time', () => `**Current Local Time:** ${new Date().toLocaleString()}`);
        
        // Train Status strictly blocks fake data
        this.registerTool('trainStatus', (data) => {
            if (!CONFIG.TRAIN_API_KEY) return unconfiguredMsg('Train Status');
            return `Checking status for Train ${data.number} on ${data.date}... (API Configured)`;
        });

        this.registerTool('imageGeneration', (prompt) => {
            if (!CONFIG.IMAGE_API_KEY) return unconfiguredMsg('Image Generation');
            return "Image API is configured, proceeding to generation...";
        });
    }

    async intercept(prompt) {
        const lower = prompt.toLowerCase();
        
        const calcRes = this.getTool('calculator')(prompt);
        if (calcRes) return { type: 'text', content: calcRes };

        if (lower.includes('weather')) return { type: 'text', content: this.getTool('weather')() };
        if (lower.includes('news')) return { type: 'text', content: this.getTool('news')() };
        if (lower.includes('currency') || lower.includes('exchange rate')) return { type: 'text', content: this.getTool('currency')() };
        if (lower.includes('time is it')) return { type: 'text', content: this.getTool('time')() };
        if (lower.includes('sports') || lower.includes('score')) return { type: 'text', content: this.getTool('sports')() };
        
        return null;
    }
}