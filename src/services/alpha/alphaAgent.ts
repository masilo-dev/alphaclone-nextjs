import { alphaOrchestrator } from './alphaOrchestrator';
import { parallelEngine } from './parallelEngine';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

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
    tenantId?: string;
}

class AlphaAgent {
    private activeMissions: Map<string, AlphaMissionStatus> = new Map();

    async startMission(description: string, user?: UserContext): Promise<string> {
        if (!user?.id || !user.tenantId) throw new Error('Authenticated workspace context is required');
        const missionId = crypto.randomUUID();
        const mission: AlphaMissionStatus = {
            id: missionId,
            userId: user.id,
            tenantId: user.tenantId,
            description,
            status: 'running',
            logs: [`Mission started: ${description}`, `AUTHORIZED_USER: ${user?.name || 'Anonymous'}`],
            startTime: new Date()
        };
        const admin = createSupabaseAdminClient();
        const { error } = await admin.from('alpha_missions').insert({
            id: mission.id,
            tenant_id: mission.tenantId,
            user_id: mission.userId,
            description: mission.description,
            status: mission.status,
            logs: mission.logs,
            started_at: mission.startTime?.toISOString(),
        });
        if (error) throw error;
        this.activeMissions.set(missionId, mission);

        return missionId;
    }

    async executeMission(missionId: string, user?: UserContext) {
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
            await this.persistMission(mission);
            
        } catch (error: any) {
            mission.status = 'failed';
            mission.logs.push(`CRITICAL SWARM FAILURE: ${error.message}`);
            mission.endTime = new Date();
            await this.persistMission(mission);
            throw error;
        }
    }

    private async persistMission(mission: AlphaMissionStatus) {
        const admin = createSupabaseAdminClient();
        const { error } = await admin.from('alpha_missions').update({
            status: mission.status,
            logs: mission.logs,
            completed_at: mission.endTime?.toISOString() || null,
            updated_at: new Date().toISOString(),
        }).eq('id', mission.id).eq('tenant_id', mission.tenantId).eq('user_id', mission.userId);
        if (error) throw error;
        if (mission.status !== 'running') this.activeMissions.delete(mission.id);
    }

    async getMissionStatus(missionId: string, userId: string, tenantId: string): Promise<AlphaMissionStatus | undefined> {
        const admin = createSupabaseAdminClient();
        const { data, error } = await admin.from('alpha_missions').select('*')
            .eq('id', missionId).eq('user_id', userId).eq('tenant_id', tenantId).maybeSingle();
        if (error) throw error;
        return data ? this.fromRow(data) : undefined;
    }

    async getAllMissions(userId: string, tenantId: string): Promise<AlphaMissionStatus[]> {
        const admin = createSupabaseAdminClient();
        const { data, error } = await admin.from('alpha_missions').select('*')
            .eq('user_id', userId).eq('tenant_id', tenantId)
            .order('started_at', { ascending: false }).limit(100);
        if (error) throw error;
        return (data || []).map(row => this.fromRow(row));
    }

    private fromRow(row: any): AlphaMissionStatus {
        return {
            id: String(row.id),
            userId: String(row.user_id),
            tenantId: String(row.tenant_id),
            description: String(row.description),
            status: row.status,
            logs: Array.isArray(row.logs) ? row.logs.map(String) : [],
            startTime: row.started_at ? new Date(row.started_at) : undefined,
            endTime: row.completed_at ? new Date(row.completed_at) : undefined,
        };
    }
}

export const alphaAgent = new AlphaAgent();
