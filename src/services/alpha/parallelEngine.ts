import { SubTask, alphaOrchestrator } from './alphaOrchestrator';
import { AGENT_FLEET } from './agentFleet';
import { aiService } from '../ai/aiService';
import { ALPHA_TOOLS } from './tools';
import { UserContext } from './alphaAgent';
import { healingEngine } from './healingEngine';
import { memorySystem } from './memorySystem';
import { auditLoggingService } from '../auditLoggingService';

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
                provider: 'auto',
                temperature: 0
            });

            const content = aiResponse.content.trim();
            logCallback(`${agent.id.toUpperCase()}: ${content}`);

            // Robust multi-line extraction for commands
            const executeMatch = content.match(/EXECUTE:\s*(\w+)\|([\s\S]*)/);
            
            if (executeMatch) {
                const [, toolName, rawArgs] = executeMatch;
                const tool = ALPHA_TOOLS[toolName];
                
                if (tool) {
                    try {
                        const jsonStart = rawArgs.indexOf('{');
                        const jsonStr = jsonStart !== -1 ? rawArgs.slice(jsonStart) : rawArgs;
                        const jsonEnd = jsonStr.lastIndexOf('}');
                        const argsJson = jsonEnd !== -1 ? jsonStr.slice(0, jsonEnd + 1) : jsonStr;
                        
                        const args = JSON.parse(argsJson);
                        
                        // Persistent Audit Log for AI Action
                        await auditLoggingService.logAction(
                            `AI_TOOL_EXECUTION: ${toolName}`,
                            'alpha_mission',
                            task.id,
                            { agent: agent.id, task: task.description },
                            { args, missionId: task.parentId }
                        );

                        const result = await tool.execute({ 
                            ...args, 
                            userId: user?.id,
                            tenantId: user?.tenantId,
                            account_id: args.account_id || user?.id 
                        });

                        alphaOrchestrator.updateTaskStatus(task.parentId, task.id, 'completed', result);
                        logCallback(`SUCCESS [${toolName}]: Execution verified.`);

                        // Store pattern in memory
                        await memorySystem.store({
                            tenantId: user?.tenantId || user?.id || 'anonymous',
                            userId: user?.id || 'anonymous',
                            type: 'tool_success',
                            content: { tool: toolName, task: task.description },
                            success: true,
                            timestamp: new Date()
                        }, 'episodic').catch(() => {});

                    } catch (e: any) {
                        const healAction = await healingEngine.heal(e);
                        if (healAction) {
                            logCallback(`SURGERY: Attempting self-heal: ${healAction}`);
                        }
                        alphaOrchestrator.updateTaskStatus(task.parentId, task.id, 'failed', null, e.message);
                        logCallback(`FAILURE [${toolName}]: ${e.message}`);
                    }
                } else {
                    logCallback(`ERROR: Tool ${toolName} not found.`);
                    alphaOrchestrator.updateTaskStatus(task.parentId, task.id, 'failed', null, `Tool ${toolName} not found.`);
                }
            } else if (content.includes('TASK_COMPLETE:')) {
                alphaOrchestrator.updateTaskStatus(task.parentId, task.id, 'completed', content);
            } else {
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

        for (const task of tasks) {
            await this.executeSubTask(task, user, logCallback);
        }
    }
}

export const parallelEngine = new ParallelExecutionEngine();
