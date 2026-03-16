import { ALPHA_TOOLS } from './tools';
import { aiService } from '../ai/aiService';
import { alphaOrchestrator } from './alphaOrchestrator';
import { parallelEngine } from './parallelEngine';

export interface AlphaMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_call_id?: string;
    name?: string;
}

export interface AlphaMissionStatus {
    id: string;
    userId: string; 
    tenantId: string; // Fortress Isolation
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
            tenantId: user?.id || 'anonymous', // Mocking tenantId as userId for now
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
            mission.logs.push(`ALPHA ORCHESTRATOR: Mapping mission trajectory for ${user?.name || 'Authorized Operator'}...`);
            
            // 1. Plan Mission using Strategist
            const tasks = await alphaOrchestrator.planMission(missionId, mission.description, user);
            mission.logs.push(`PLAN_GENERATED: Decomposed into ${tasks.length} autonomous sub-tasks.`);

            // 2. Execute via Parallel Engine
            await parallelEngine.processMission(missionId, user, (msg: string) => {
                mission.logs.push(msg);
            });

            const allCompleted = tasks.every((t: any) => t.status === 'completed');
            
            if (allCompleted) {
                mission.status = 'completed';
                mission.logs.push(`MISSION_SUCCESS: All agents report task finalization.`);
            } else {
                mission.status = 'failed';
                mission.logs.push(`MISSION_PARTIAL: Verification failed for one or more agents.`);
            }

            mission.endTime = new Date();
            mission.logs.push('ALPHA FLEET: Returning to docking station.');
            
        } catch (error: any) {
            mission.status = 'failed';
            mission.logs.push(`CRITICAL SWARM FAILURE: ${error.message}`);
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
