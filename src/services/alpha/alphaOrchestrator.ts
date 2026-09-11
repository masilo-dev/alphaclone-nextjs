import { AGENT_FLEET, AgentConfig } from './agentFleet';
import { aiService } from '../ai/aiService';
import { UserContext } from './alphaAgent';
import { memorySystem } from './memorySystem';
import { healingEngine } from './healingEngine';
import { tenantFortress } from './fortressLayer';
import { userContextService } from './UserContextService';

export interface SubTask {
    id: string;
    parentId: string;
    assignedTo: keyof typeof AGENT_FLEET;
    description: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: any;
    error?: string;
}

export class AlphaOrchestrator {
    private missionTasks: Map<string, SubTask[]> = new Map();

    async planMission(missionId: string, description: string, user: UserContext | undefined): Promise<SubTask[]> {
        const strategist = AGENT_FLEET.strategist;
        
        // FORTRESS VALIDATION: Enforce tenant isolation at the entry point
        const tenantId = user?.tenantId || user?.id || 'anonymous'; 
        await tenantFortress.validateAccess(user || { id: 'anonymous', name: 'Anonymous', role: 'operator' }, tenantId);
        
        // Recall past successful patterns for THIS tenant ONLY
        const pastPatterns = await memorySystem.getPatterns(tenantId);
        
        // Fetch User's Historical Context (Tasks, Projects, Calendar) for Prediction
        const userHistory = await userContextService.getFullContext(user?.id || '', tenantId);

        const prompt = `Decompose the following mission into a sequence of sub-tasks for our agent fleet.
MISSION: ${description}
USER_CONTEXT: ${user?.name} (${user?.role})
USER_HISTORY: ${JSON.stringify(userHistory)}
FLEET_CAPABILITIES: ${JSON.stringify(AGENT_FLEET)}
LEARNED_PATTERNS: ${JSON.stringify(pastPatterns)}

FORMAT: JSON array of objects: { "assignedTo": "role", "description": "concise task" }`;

        const response = await aiService.complete({
            prompt,
            systemPrompt: `You are the Alpha Strategist. Break down missions for a specialized digital workforce.`,
            provider: 'auto',
            temperature: 0
        });

        try {
            // Robust JSON extraction — handles markdown fences, direct arrays, nested objects
            const raw = response.content;
            let tasksJson: string | null = null;

            // 1. Try stripping ```json ... ``` fence
            const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (fenced) tasksJson = fenced[1].trim();

            // 2. Try bare array [...] spanning multiple lines
            if (!tasksJson) {
                const arrMatch = raw.match(/(\[[\s\S]*?\])/);
                if (arrMatch) tasksJson = arrMatch[1];
            }

            // 3. Try object wrapping array { "tasks": [...] }
            if (!tasksJson) {
                const objMatch = raw.match(/"(?:tasks|subtasks|plan)"\s*:\s*(\[[\s\S]*?\])/i);
                if (objMatch) tasksJson = objMatch[1];
            }

            if (!tasksJson) throw new Error("Could not parse mission plan from AI response");

            const plannedTasks = JSON.parse(tasksJson);
            const subTasks: SubTask[] = plannedTasks.map((t: any, index: number) => ({
                id: `${missionId}_t${index}`,
                parentId: missionId,
                assignedTo: t.assignedTo,
                description: t.description,
                status: 'pending'
            }));

            this.missionTasks.set(missionId, subTasks);
            return subTasks;
        } catch (e) {
            console.error("Orchestrator planning failed:", e);
            return [
                {
                    id: `${missionId}_fallback`,
                    parentId: missionId,
                    assignedTo: 'executor',
                    description: `Direct execution: ${description}`,
                    status: 'pending'
                }
            ];
        }
    }

    getTasks(missionId: string): SubTask[] {
        return this.missionTasks.get(missionId) || [];
    }

    updateTaskStatus(missionId: string, taskId: string, status: SubTask['status'], result?: any, error?: string) {
        const tasks = this.missionTasks.get(missionId);
        if (tasks) {
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                task.status = status;
                if (result) task.result = result;
                if (error) task.error = error;
            }
        }
    }
}

export const alphaOrchestrator = new AlphaOrchestrator();
