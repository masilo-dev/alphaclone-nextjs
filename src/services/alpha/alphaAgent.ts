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
    userId: string; // Restricted visibility
    description: string;
    status: 'idle' | 'running' | 'completed' | 'failed';
    logs: string[];
    startTime?: Date;
    endTime?: Date;
}

export interface UserContext {
    id: string;
    name: string;
    role: string;
}

class AlphaAgent {
    private activeMissions: Map<string, AlphaMissionStatus> = new Map();

    async startMission(description: string, user?: UserContext): Promise<string> {
        const missionId = Math.random().toString(36).substring(7);
        const mission: AlphaMissionStatus = {
            id: missionId,
            userId: user?.id || 'anonymous',
            description,
            status: 'running',
            logs: [`Mission started: ${description}`, `AUTHORIZED_USER: ${user?.name || 'Anonymous'}`],
            startTime: new Date()
        };
        this.activeMissions.set(missionId, mission);

        // Run mission asynchronously
        this.executeMission(missionId, user).catch(err => {
            console.error(`Mission ${missionId} failed:`, err);
            const m = this.activeMissions.get(missionId);
            if (m) {
                m.status = 'failed';
                m.logs.push(`SYSTEM ERROR: ${err.message}`);
                m.endTime = new Date();
            }
        });

        return missionId;
    }

    private async executeMission(missionId: string, user?: UserContext) {
        const mission = this.activeMissions.get(missionId);
        if (!mission) return;

        try {
            mission.logs.push(`ALPHA ENGINE: Initializing neural loop for ${user?.name || 'system'}...`);
            
            let iteration = 0;
            const maxIterations = 5;
            let missionAccomplished = false;

            while (iteration < maxIterations && !missionAccomplished) {
                iteration++;
                mission.logs.push(`EXECUTIVE PROTOCOL: [Step ${iteration}] - Calibrating Execution...`);

                const systemPrompt = `You are Alpha, the Executive Productivity Engine for AlphaClone. 
You are currently executing a mission for ${user?.name || 'an authorized operator'} (Role: ${user?.role || 'operator'}).

Mission: ${mission.description}
Available Tools: ${Object.values(ALPHA_TOOLS).map(t => `${t.name}: ${t.description}`).join('\n')}

Response Format:
- If executing a tool: "EXECUTE: tool_name|{args}"
- If mission success: "FINALIZED: [Brief Execution Summary]"
- If reasoning: "LOGIC: [Your executive reasoning]"

Stay focused on high-speed productivity and strict data isolation for this user.`;

                const aiResponse = await aiService.complete({
                    prompt: `Context for ${user?.name}:\n${mission.logs.slice(-3).join('\n')}\n\nDecision:`,
                    systemPrompt,
                    provider: 'anthropic',
                    model: 'claude-3-5-sonnet-20240620',
                    temperature: 0
                });

                const content = aiResponse.content.trim();
                mission.logs.push(`ALPHA: ${content}`);

                if (content.startsWith('EXECUTE:')) {
                    const match = content.match(/EXECUTE:\s*(\w+)\|({.*})/);
                    if (match) {
                        const [, toolName, argsJson] = match;
                        const tool = ALPHA_TOOLS[toolName];
                        if (tool) {
                            mission.logs.push(`DISPATCHING: ${toolName}`);
                            try {
                                const args = JSON.parse(argsJson);
                                // Automatically inject user context into tool args if missing
                                const result = await tool.execute({ ...args, account_id: args.account_id || user?.id });
                                mission.logs.push(`RESULT [${toolName}]: ${JSON.stringify(result).substring(0, 150)}...`);
                            } catch (e: any) {
                                mission.logs.push(`FAILED [${toolName}]: ${e.message}`);
                            }
                        }
                    }
                } else if (content.startsWith('FINALIZED:')) {
                    missionAccomplished = true;
                    mission.logs.push(`PROTOCOL FINALIZED: ${content.split('FINALIZED:')[1].trim()}`);
                }
            }

            mission.status = 'completed';
            mission.endTime = new Date();
            mission.logs.push('ALPHA ENGINE: Cycle complete. Entering power-save mode.');
            
        } catch (error: any) {
            mission.status = 'failed';
            mission.logs.push(`CRITICAL FAILURE: ${error.message}`);
            mission.endTime = new Date();
            throw error;
        }
    }

    getMissionStatus(missionId: string, userId?: string): AlphaMissionStatus | undefined {
        const mission = this.activeMissions.get(missionId);
        if (mission && mission.userId === userId) return mission;
        return undefined;
    }

    getAllMissions(userId?: string): AlphaMissionStatus[] {
        return Array.from(this.activeMissions.values())
            .filter(m => m.userId === userId || m.userId === 'anonymous');
    }
}

export const alphaAgent = new AlphaAgent();
