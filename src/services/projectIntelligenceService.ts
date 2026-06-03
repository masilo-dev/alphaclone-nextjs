import { supabase } from '../lib/supabase';

export interface BurndownDataPoint {
  date: string;
  idealRemainingHours: number;
  actualRemainingHours: number;
}

export interface BudgetStatus {
  used: number;
  total: number;
  pct: number;
  alert: boolean;
}

class ProjectIntelligenceService {
  /**
   * Calculates the velocity score of a project.
   * Score is calculated as tasks completed vs total active tasks, weighted by elapsed time.
   */
  async calculateVelocityScore(projectId: string, tenantId: string): Promise<{ score: number; status: 'ON TRACK' | 'AT RISK' | 'BEHIND' }> {
    try {
      // Fetch tasks for the project
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('id, status, estimated_hours, actual_hours, start_date, due_date')
        .eq('project_id', projectId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      if (!tasks || tasks.length === 0) {
        return { score: 100, status: 'ON TRACK' };
      }

      const totalTasks = tasks.length;
      const completedTasks = (tasks as any[]).filter((t: any) => t.status === 'completed' || t.status === 'done').length;

      // Project timeframe
      const { data: project } = await supabase
        .from('projects')
        .select('created_at, due_date')
        .eq('id', projectId)
        .eq('tenant_id', tenantId)
        .single();

      const createdDate = project?.created_at ? new Date(project.created_at) : new Date();
      const dueDate = project?.due_date ? new Date(project.due_date) : new Date();
      
      const totalDurationDays = Math.max(1, Math.ceil((dueDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));
      const elapsedDays = Math.max(1, Math.ceil((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));

      // Expected progress ratio based on time
      const timeRatio = Math.min(1, elapsedDays / totalDurationDays);
      const completionRatio = completedTasks / totalTasks;

      // Velocity score is (actual progress / expected progress) * 100
      let score = 100;
      if (timeRatio > 0) {
        score = Math.min(100, Math.round((completionRatio / timeRatio) * 100));
      }

      // If project is done, velocity score is based on hours spent vs estimated
      if (completionRatio === 1) {
        const totalEst = (tasks as any[]).reduce((sum: number, t: any) => sum + Number(t.estimated_hours || 0), 0);
        const totalAct = (tasks as any[]).reduce((sum: number, t: any) => sum + Number(t.actual_hours || 0), 0);
        if (totalEst > 0) {
          score = Math.min(100, Math.round((totalEst / Math.max(totalAct, 1)) * 100));
        } else {
          score = 100;
        }
      }

      let status: 'ON TRACK' | 'AT RISK' | 'BEHIND' = 'ON TRACK';
      if (score < 50) {
        status = 'BEHIND';
      } else if (score < 80) {
        status = 'AT RISK';
      }

      // Update in DB
      await supabase
        .from('projects')
        .update({ velocity_score: score })
        .eq('id', projectId)
        .eq('tenant_id', tenantId);

      return { score, status };
    } catch (err) {
      console.error('Error calculating velocity score:', err);
      return { score: 0, status: 'BEHIND' };
    }
  }

  /**
   * Calculates overall project health score (0-100) based on budget performance, velocity, and dependency blocks.
   */
  async calculateProjectHealth(projectId: string, tenantId: string): Promise<number> {
    try {
      const { data: project, error: projError } = await supabase
        .from('projects')
        .select('budget_total, budget_used, velocity_score')
        .eq('id', projectId)
        .eq('tenant_id', tenantId)
        .single();

      if (projError || !project) throw projError || new Error('Project not found');

      // Get velocity score (fallback to calculate if null)
      let velocity = Number(project.velocity_score);
      if (project.velocity_score === null) {
        const vRes = await this.calculateVelocityScore(projectId, tenantId);
        velocity = vRes.score;
      }

      // Budget health
      let budgetHealth = 100;
      const budgetTotal = Number(project.budget_total || 0);
      const budgetUsed = Number(project.budget_used || 0);
      if (budgetTotal > 0) {
        const budgetPct = budgetUsed / budgetTotal;
        if (budgetPct > 1) {
          budgetHealth = Math.max(0, 100 - Math.round((budgetPct - 1) * 100));
        } else if (budgetPct > 0.8) {
          // Warning zone
          budgetHealth = 80;
        }
      }

      // Blocking health (tasks that are blocked)
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, status, depends_on')
        .eq('project_id', projectId)
        .eq('tenant_id', tenantId);

      let blockedTasksCount = 0;
      if (tasks && tasks.length > 0) {
        const completedIds = new Set(
          (tasks as any[]).filter((t: any) => t.status === 'completed' || t.status === 'done').map((t: any) => t.id)
        );
        for (const task of tasks) {
          if (task.depends_on && task.depends_on.length > 0) {
            // If any dependency is not completed, it's blocked
            const isBlocked = task.depends_on.some((depId: string) => !completedIds.has(depId));
            if (isBlocked && task.status !== 'completed' && task.status !== 'done') {
              blockedTasksCount++;
            }
          }
        }
      }

      const blockedPenalty = Math.min(40, blockedTasksCount * 10);
      const blockedHealth = 100 - blockedPenalty;

      // Weighted overall health score: 40% velocity, 40% budget, 20% blocked/dependency health
      const overallHealth = Math.round(
        (velocity * 0.4) + (budgetHealth * 0.4) + (blockedHealth * 0.2)
      );

      // Save to database
      await supabase
        .from('projects')
        .update({ health_score: overallHealth })
        .eq('id', projectId)
        .eq('tenant_id', tenantId);

      return overallHealth;
    } catch (err) {
      console.error('Error calculating project health:', err);
      return 0;
    }
  }

  /**
   * Captures a daily snapshot of the project for burndown charts.
   */
  async snapshotProject(projectId: string, tenantId: string): Promise<void> {
    try {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('status')
        .eq('project_id', projectId)
        .eq('tenant_id', tenantId);

      const { data: project } = await supabase
        .from('projects')
        .select('budget_used')
        .eq('id', projectId)
        .eq('tenant_id', tenantId)
        .single();

      const tasksTotal = tasks?.length || 0;
      const tasksComplete = (tasks as any[])?.filter((t: any) => t.status === 'completed' || t.status === 'done').length || 0;
      const budgetUsed = Number(project?.budget_used || 0);

      await supabase
        .from('project_snapshots')
        .insert({
          project_id: projectId,
          tenant_id: tenantId,
          tasks_total: tasksTotal,
          tasks_complete: tasksComplete,
          budget_used: budgetUsed,
          snapshot_date: new Date().toISOString().split('T')[0]
        })
        .onConflict('project_id, snapshot_date')
        .ignore();
    } catch (err) {
      console.error('Error snapshotted project:', err);
    }
  }

  /**
   * Fetches burndown data.
   */
  async getBurndownData(projectId: string, tenantId: string): Promise<BurndownDataPoint[]> {
    try {
      // 1. Get project timeline
      const { data: project } = await supabase
        .from('projects')
        .select('created_at, due_date')
        .eq('id', projectId)
        .eq('tenant_id', tenantId)
        .single();

      if (!project) return [];

      const start = new Date(project.created_at);
      const end = project.due_date ? new Date(project.due_date) : new Date();

      // 2. Fetch tasks for total hours estimation
      const { data: tasks } = await supabase
        .from('tasks')
        .select('estimated_hours, actual_hours, created_at, status')
        .eq('project_id', projectId)
        .eq('tenant_id', tenantId);

      const totalHours = (tasks as any[])?.reduce((sum: number, t: any) => sum + Number(t.estimated_hours || 0), 0) || 0;

      // 3. Fetch snapshots
      const { data: snapshots } = await supabase
        .from('project_snapshots')
        .select('snapshot_date, tasks_total, tasks_complete')
        .eq('project_id', projectId)
        .eq('tenant_id', tenantId)
        .order('snapshot_date', { ascending: true });

      // Generate daily sequence
      const dataPoints: BurndownDataPoint[] = [];
      const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

      const snapshotMap = new Map<string, any>();
      (snapshots as any[])?.forEach((s: any) => {
        snapshotMap.set(s.snapshot_date, s);
      });

      let currentActualHours = totalHours;

      for (let i = 0; i <= totalDays; i++) {
        const currentDate = new Date(start.getTime() + i * (1000 * 60 * 60 * 24));
        const dateStr = currentDate.toISOString().split('T')[0]!;

        // Ideal burndown decreases linearly
        const ideal = Math.max(0, round(totalHours * (1 - i / totalDays)));

        // Actual burndown based on snapshot tasks complete ratio
        const snap = snapshotMap.get(dateStr);
        if (snap) {
          const completedRatio = snap.tasks_total > 0 ? (snap.tasks_complete / snap.tasks_total) : 0;
          currentActualHours = Math.max(0, round(totalHours * (1 - completedRatio)));
        } else if (currentDate > new Date()) {
          // Future dates: no actual data
          currentActualHours = null as any;
        }

        dataPoints.push({
          date: dateStr,
          idealRemainingHours: ideal,
          actualRemainingHours: currentActualHours
        });
      }

      return dataPoints;
    } catch (err) {
      console.error('Error getting burndown data:', err);
      return [];
    }
  }

  /**
   * Fetches budget tracker data.
   */
  async getBudgetStatus(projectId: string, tenantId: string): Promise<BudgetStatus> {
    try {
      const { data: project } = await supabase
        .from('projects')
        .select('budget_total, budget_used')
        .eq('id', projectId)
        .eq('tenant_id', tenantId)
        .single();

      if (!project) {
        return { used: 0, total: 0, pct: 0, alert: false };
      }

      const total = Number(project.budget_total || 0);
      const used = Number(project.budget_used || 0);
      const pct = total > 0 ? round((used / total) * 100) : 0;
      const alert = pct >= 80;

      return { used, total, pct, alert };
    } catch (err) {
      console.error('Error getting budget status:', err);
      return { used: 0, total: 0, pct: 0, alert: false };
    }
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export const projectIntelligenceService = new ProjectIntelligenceService();
