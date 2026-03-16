import { ALPHA_TOOLS } from './tools';
import { aiService } from '../ai/aiService';

export interface AlphaMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_call_id?: string;
    name?: string;
}

export interface AlphaMissionStatus {
    id: string;
    description: string;
    status: 'idle' | 'running' | 'completed' | 'failed';
    logs: string[];
    startTime?: Date;
    endTime?: Date;
}

class AlphaAgent {
    private activeMissions: Map<string, AlphaMissionStatus> = new Map();

    async startMission(description: string): Promise<string> {
        const missionId = Math.random().toString(36).substring(7);
        const mission: AlphaMissionStatus = {
            id: missionId,
            description,
            status: 'running',
            logs: [`Mission started: ${description}`],
            startTime: new Date()
        };
        this.activeMissions.set(missionId, mission);

        // Run mission asynchronously
        this.executeMission(missionId).catch(err => {
            console.error(`Mission ${missionId} failed:`, err);
            const m = this.activeMissions.get(missionId);
            if (m) {
                m.status = 'failed';
                m.logs.push(`Error: ${err.message}`);
                m.endTime = new Date();
            }
        });

        return missionId;
    }

    private async executeMission(missionId: string) {
        const mission = this.activeMissions.get(missionId);
        if (!mission) return;

        try {
            mission.logs.push('ALPHA ENGINE: Initializing neural mission loop...');
            
            let iteration = 0;
            const maxIterations = 5;
            let missionAccomplished = false;
            let currentContext = mission.description;

            while (iteration < maxIterations && !missionAccomplished) {
                iteration++;
                mission.logs.push(`EXECUTIVE PROTOCOL: Step ${iteration} - Analyzing Execution Path...`);

                const systemPrompt = `You are Alpha, the Executive Productivity Engine for AlphaClone. 
Your goal is INSTANT EXECUTION and PRODUCTIVITY. Do not over-analyze; execute the most efficient path.

Current Mission: ${mission.description}
Available Tools: ${Object.values(ALPHA_TOOLS).map(t => `${t.name}: ${t.description}`).join('\n')}

Response Format:
- If executing a tool: "EXECUTE: tool_name|{args}"
- If mission success: "FINALIZED: [Brief Execution Summary]"
- If reasoning: "LOGIC: [Your executive reasoning]"

Stay focused on productivity and account-specific outreach.`;

                const aiResponse = await aiService.complete({
                    prompt: `Current Mission Status & Logs:\n${mission.logs.join('\n')}\n\nDecision:`,
                    systemPrompt,
                    provider: 'anthropic',
                    model: 'claude-3-5-sonnet-20240620', // Faster response
                    temperature: 0,
                    maxTokens: 500
                });

                const content = aiResponse.content.trim();
                mission.logs.push(`ALPHA: ${content}`);

                if (content.startsWith('EXECUTE:')) {
                    const match = content.match(/EXECUTE:\s*(\w+)\|({.*})/);
                    if (match) {
                        const [, toolName, argsJson] = match;
                        const tool = ALPHA_TOOLS[toolName];
                        if (tool) {
                            mission.logs.push(`EXECUTING PROTOCOL: ${toolName}`);
                            try {
                                const args = JSON.parse(argsJson);
                                const result = await tool.execute(args);
                                mission.logs.push(`OUTPUT [${toolName}]: ${JSON.stringify(result).substring(0, 200)}...`);
                                currentContext += `\nOutput: ${JSON.stringify(result)}`;
                            } catch (e: any) {
                                mission.logs.push(`EXECUTION ERROR [${toolName}]: ${e.message}`);
                            }
                        }
                    }
                } else if (content.startsWith('FINALIZED:')) {
                    missionAccomplished = true;
                    mission.logs.push('MISSION STATUS: FULLY EXECUTED');
                }
 else if (iteration === maxIterations) {
                    mission.logs.push('MISSION WARNING: Max iterations reached. Closing loop.');
                }
            }

            mission.status = 'completed';
            mission.endTime = new Date();
            mission.logs.push('ALPHA ENGINE: Mission cycle complete. Hibernating.');
            
            // Auto-notify on finish if it was a significant mission
            if (mission.logs.length > 5) {
                await ALPHA_TOOLS.outreach.execute({
                    to: 'admin@alphaclone.tech',
                    subject: `Alpha Mission Report: ${mission.id.toUpperCase()}`,
                    body: `Alpha has completed a mission.\n\nMission: ${mission.description}\n\nKey Findings:\n${mission.logs.filter(l => l.includes('RESULT') || l.includes('COMPLETE')).join('\n')}`,
                    provider: 'resend'
                });
            }

        } catch (error: any) {
            mission.status = 'failed';
            mission.logs.push(`SYSTEM CRITICAL: ${error.message}`);
            mission.endTime = new Date();
            throw error;
        }
    }

    getMissionStatus(missionId: string): AlphaMissionStatus | undefined {
        return this.activeMissions.get(missionId);
    }

    getAllMissions(): AlphaMissionStatus[] {
        return Array.from(this.activeMissions.values());
    }
}

export const alphaAgent = new AlphaAgent();
