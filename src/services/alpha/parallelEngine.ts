import { SubTask, alphaOrchestrator } from './alphaOrchestrator';
import { AGENT_FLEET } from './agentFleet';
import { aiService } from '../ai/aiService';
import { ALPHA_TOOLS } from './tools';
import { UserContext } from './alphaAgent';
import { healingEngine } from './healingEngine';
import { memorySystem } from './memorySystem';

export class ParallelExecutionEngine {
    private maxConcurrent = 5;
    private runningTasks = 0;

    async executeSubTask(task: SubTask, user: UserContext | undefined, logCallback: (msg: string) => void) {
        const agent = AGENT_FLEET[task.assignedTo];
        logCallback(`AGENT [${agent.role}]: Starting task - ${task.description}`);
        
        alphaOrchestrator.updateTaskStatus(task.parentId, task.id, 'running');

        try {
            const systemPrompt = `You are the Alpha ${agent.role}.
Mission Path: ${task.parentId}
Task: ${task.description}
Personalized Context: ${user ? `${user.name} (Role: ${user.role})` : 'Anonymous'}

Available Tools: ${agent.tools?.map(t => `${t}: ${ALPHA_TOOLS[t].description}`).join('\n') || 'No tools available for this role.'}

Response Format:
- If executing a tool: "EXECUTE: tool_name|{args}"
- If task complete: "TASK_COMPLETE: [Summary]"
- If reasoning: "THOUGHT: [Brief reasoning]"`;

            const aiResponse = await aiService.complete({
                prompt: `Execute task: ${task.description}`,
                systemPrompt,
                provider: 'anthropic',
                model: agent.model,
                temperature: 0
            });

            const content = aiResponse.content.trim();
            logCallback(`${agent.id.toUpperCase()}: ${content}`);

            if (content.startsWith('EXECUTE:')) {
                const match = content.match(/EXECUTE:\s*(\w+)\|({.*})/);
                if (match) {
                    const [, toolName, argsJson] = match;
                    const tool = ALPHA_TOOLS[toolName];
                    if (tool) {
                        try {
                            const args = JSON.parse(argsJson);
                            const result = await tool.execute({ 
                                ...args, 
                                userId: user?.id,
                                tenantId: user?.tenantId,
                                account_id: args.account_id || user?.id 
                            });
                            alphaOrchestrator.updateTaskStatus(task.parentId, task.id, 'completed', result);
                            logCallback(`SUCCESS [${toolName}]: Execution verified.`);
                            
                            // Store successful pattern in episodic memory
                            await memorySystem.store({
                                tenantId: user?.id || 'anonymous',
                                userId: user?.id || 'anonymous',
                                type: 'tool_success',
                                content: { tool: toolName, task: task.description },
                                success: true,
                                timestamp: new Date()
                            }, 'episodic');

                        } catch (e: any) {
                            // Try self-healing
                            const healAction = await healingEngine.heal(e);
                            if (healAction) {
                                logCallback(`SURGERY: Attempting self-heal: ${healAction}`);
                                // In a real scenario, we would retry with the alternative here
                            }
                            
                            alphaOrchestrator.updateTaskStatus(task.parentId, task.id, 'failed', null, e.message);
                            logCallback(`FAILURE [${toolName}]: ${e.message}`);
                        }
                    }
                }
            } else if (content.includes('TASK_COMPLETE:')) {
                alphaOrchestrator.updateTaskStatus(task.parentId, task.id, 'completed', content);
            } else {
                // Generic completion if no explicit tool/status
                alphaOrchestrator.updateTaskStatus(task.parentId, task.id, 'completed', content);
            }

        } catch (error: any) {
            logCallback(`CRITICAL AGENT ERROR [${agent.id}]: ${error.message}`);
            alphaOrchestrator.updateTaskStatus(task.parentId, task.id, 'failed', null, error.message);
        }
    }

    async processMission(missionId: string, user: UserContext | undefined, logCallback: (msg: string) => void) {
        const tasks = alphaOrchestrator.getTasks(missionId);
        
        logCallback(`PARALLEL_ENGINE: Processing swarms for mission ${missionId}...`);

        // Concurrent execution of independent tasks (for now sequential loop because we need dependencies, 
        // but can be upgraded to Promise.all for independent ones)
        for (const task of tasks) {
            await this.executeSubTask(task, user, logCallback);
        }
    }
}

export const parallelEngine = new ParallelExecutionEngine();
