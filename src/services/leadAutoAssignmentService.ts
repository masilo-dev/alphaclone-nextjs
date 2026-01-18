import { supabase } from '../lib/supabase';
import { auditLoggingService } from './auditLoggingService';

export interface Lead {
    id: string;
    name: string;
    email: string;
    phone?: string;
    company?: string;
    source: string;
    status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
    assigned_to?: string;
    score: number;
    created_at: string;
    assigned_at?: string;
    contacted_at?: string;
}

export interface AssignmentRule {
    type: 'round_robin' | 'load_balanced' | 'skill_based' | 'geographic';
    active: boolean;
    priority: number;
}

export interface SLA {
    response_time_minutes: number;
    contact_time_hours: number;
}

class LeadAutoAssignmentService {
    private currentRoundRobinIndex: number = 0;
    private readonly DEFAULT_SLA: SLA = {
        response_time_minutes: 15,
        contact_time_hours: 24,
    };

    /**
     * Auto-assign lead to sales rep
     */
    async autoAssignLead(
        leadId: string,
        assignmentType: AssignmentRule['type'] = 'round_robin'
    ): Promise<{ assigned: boolean; assignedTo?: string; error?: string }> {
        try {
            const { data: lead } = await supabase
                .from('leads')
                .select('*')
                .eq('id', leadId)
                .single();

            if (!lead) {
                return { assigned: false, error: 'Lead not found' };
            }

            if (lead.assigned_to) {
                return { assigned: false, error: 'Lead already assigned' };
            }

            // Get available sales reps
            const salesReps = await this.getAvailableSalesReps();

            if (salesReps.length === 0) {
                return { assigned: false, error: 'No available sales reps' };
            }

            // Assign based on strategy
            let assignedRep: string;

            switch (assignmentType) {
                case 'round_robin':
                    assignedRep = this.assignRoundRobin(salesReps);
                    break;
                case 'load_balanced':
                    assignedRep = await this.assignLoadBalanced(salesReps);
                    break;
                case 'skill_based':
                    assignedRep = await this.assignSkillBased(lead, salesReps);
                    break;
                case 'geographic':
                    assignedRep = await this.assignGeographic(lead, salesReps);
                    break;
                default:
                    assignedRep = this.assignRoundRobin(salesReps);
            }

            // Update lead
            const { error } = await supabase
                .from('leads')
                .update({
                    assigned_to: assignedRep,
                    assigned_at: new Date().toISOString(),
                    status: 'contacted',
                })
                .eq('id', leadId);

            if (error) {
                return { assigned: false, error: error.message };
            }

            // Send notification to assigned rep
            await this.notifyAssignment(assignedRep, lead);

            // Log assignment
            await auditLoggingService.logAction(
                'lead_auto_assigned',
                'lead',
                leadId,
                undefined,
                { assigned_to: assignedRep, assignment_type: assignmentType }
            );

            // Send auto-response to lead
            await this.sendAutoResponse(lead);

            return { assigned: true, assignedTo: assignedRep };
        } catch (error) {
            return { assigned: false, error: String(error) };
        }
    }

    /**
     * Get available sales reps
     */
    private async getAvailableSalesReps(): Promise<string[]> {
        try {
            const { data: reps } = await supabase
                .from('users')
                .select('id')
                .eq('role', 'sales')
                .eq('active', true);

            return reps?.map(r => r.id) || [];
        } catch (error) {
            console.error('Error fetching sales reps:', error);
            return [];
        }
    }

    /**
     * Round-robin assignment
     */
    private assignRoundRobin(salesReps: string[]): string {
        const assigned = salesReps[this.currentRoundRobinIndex];
        this.currentRoundRobinIndex = (this.currentRoundRobinIndex + 1) % salesReps.length;
        return assigned;
    }

    /**
     * Load-balanced assignment (assign to rep with fewest leads)
     */
    private async assignLoadBalanced(salesReps: string[]): Promise<string> {
        try {
            const leadCounts = await Promise.all(
                salesReps.map(async (repId) => {
                    const { count } = await supabase
                        .from('leads')
                        .select('id', { count: 'exact' })
                        .eq('assigned_to', repId)
                        .in('status', ['new', 'contacted', 'qualified']);

                    return { repId, count: count || 0 };
                })
            );

            // Sort by count and return rep with fewest leads
            leadCounts.sort((a, b) => a.count - b.count);
            return leadCounts[0].repId;
        } catch (error) {
            console.error('Error in load-balanced assignment:', error);
            return this.assignRoundRobin(salesReps);
        }
    }

    /**
     * Skill-based assignment (match lead to rep expertise)
     */
    private async assignSkillBased(lead: Lead, salesReps: string[]): Promise<string> {
        // In production, this would match lead industry/needs to rep skills
        // For now, fall back to round-robin
        return this.assignRoundRobin(salesReps);
    }

    /**
     * Geographic assignment (match lead location to rep territory)
     */
    private async assignGeographic(lead: Lead, salesReps: string[]): Promise<string> {
        // In production, this would match lead location to rep territory
        // For now, fall back to round-robin
        return this.assignRoundRobin(salesReps);
    }

    /**
     * Notify sales rep of new assignment
     */
    private async notifyAssignment(repId: string, lead: Lead): Promise<void> {
        try {
            await supabase.from('messages').insert({
                sender_id: 'system',
                recipient_id: repId,
                text: `New lead assigned: ${lead.name} from ${lead.company || 'Unknown Company'}. Contact within ${this.DEFAULT_SLA.contact_time_hours} hours.`,
                priority: 'high',
                created_at: new Date().toISOString(),
            });
        } catch (error) {
            console.error('Error notifying assignment:', error);
        }
    }

    /**
     * Send auto-response email to lead
     */
    private async sendAutoResponse(lead: Lead): Promise<void> {
        try {
            // In production, send actual email via email service
            console.log(`Auto-response sent to ${lead.email}`);

            await auditLoggingService.logAction(
                'lead_auto_response_sent',
                'lead',
                lead.id,
                undefined,
                { email: lead.email }
            );
        } catch (error) {
            console.error('Error sending auto-response:', error);
        }
    }

    /**
     * Track SLA compliance
     */
    async trackSLA(leadId: string): Promise<{
        compliant: boolean;
        responseTime?: number;
        contactTime?: number;
    }> {
        try {
            const { data: lead } = await supabase
                .from('leads')
                .select('*')
                .eq('id', leadId)
                .single();

            if (!lead) {
                return { compliant: false };
            }

            const createdAt = new Date(lead.created_at);
            const now = new Date();

            // Check response time (assignment)
            const responseTime = lead.assigned_at
                ? (new Date(lead.assigned_at).getTime() - createdAt.getTime()) / (1000 * 60)
                : (now.getTime() - createdAt.getTime()) / (1000 * 60);

            // Check contact time
            const contactTime = lead.contacted_at
                ? (new Date(lead.contacted_at).getTime() - createdAt.getTime()) / (1000 * 60 * 60)
                : (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

            const compliant =
                responseTime <= this.DEFAULT_SLA.response_time_minutes &&
                contactTime <= this.DEFAULT_SLA.contact_time_hours;

            return {
                compliant,
                responseTime,
                contactTime,
            };
        } catch (error) {
            console.error('Error tracking SLA:', error);
            return { compliant: false };
        }
    }

    /**
     * Get SLA violations
     */
    async getSLAViolations(): Promise<Lead[]> {
        try {
            const slaDeadline = new Date();
            slaDeadline.setHours(slaDeadline.getHours() - this.DEFAULT_SLA.contact_time_hours);

            const { data: leads } = await supabase
                .from('leads')
                .select('*')
                .is('contacted_at', null)
                .lt('created_at', slaDeadline.toISOString())
                .in('status', ['new', 'contacted']);

            return leads || [];
        } catch (error) {
            console.error('Error fetching SLA violations:', error);
            return [];
        }
    }

    /**
     * Escalate uncontacted leads
     */
    async escalateUncontactedLeads(): Promise<{ escalated: number }> {
        try {
            const violations = await this.getSLAViolations();

            for (const lead of violations) {
                // Notify admin
                const { data: admins } = await supabase
                    .from('users')
                    .select('id')
                    .eq('role', 'admin');

                if (admins) {
                    for (const admin of admins) {
                        await supabase.from('messages').insert({
                            sender_id: 'system',
                            recipient_id: admin.id,
                            text: `SLA Violation: Lead "${lead.name}" has not been contacted within ${this.DEFAULT_SLA.contact_time_hours} hours.`,
                            priority: 'urgent',
                            created_at: new Date().toISOString(),
                        });
                    }
                }
            }

            return { escalated: violations.length };
        } catch (error) {
            console.error('Error escalating leads:', error);
            return { escalated: 0 };
        }
    }

    /**
     * Get lead routing statistics
     */
    async getRoutingStats(): Promise<{
        totalLeads: number;
        assignedLeads: number;
        unassignedLeads: number;
        averageAssignmentTime: number;
        slaCompliance: number;
    }> {
        try {
            const [total, assigned, unassigned] = await Promise.all([
                supabase.from('leads').select('id', { count: 'exact' }),
                supabase.from('leads').select('id', { count: 'exact' }).not('assigned_to', 'is', null),
                supabase.from('leads').select('id', { count: 'exact' }).is('assigned_to', null),
            ]);

            // Calculate average assignment time
            const { data: assignedLeads } = await supabase
                .from('leads')
                .select('created_at, assigned_at')
                .not('assigned_at', 'is', null)
                .limit(100);

            let averageAssignmentTime = 0;
            if (assignedLeads && assignedLeads.length > 0) {
                const totalTime = assignedLeads.reduce((sum, lead) => {
                    const created = new Date(lead.created_at);
                    const assigned = new Date(lead.assigned_at);
                    return sum + (assigned.getTime() - created.getTime()) / (1000 * 60);
                }, 0);
                averageAssignmentTime = totalTime / assignedLeads.length;
            }

            // Calculate SLA compliance
            const violations = await this.getSLAViolations();
            const slaCompliance = total.count
                ? ((total.count - violations.length) / total.count) * 100
                : 100;

            return {
                totalLeads: total.count || 0,
                assignedLeads: assigned.count || 0,
                unassignedLeads: unassigned.count || 0,
                averageAssignmentTime,
                slaCompliance,
            };
        } catch (error) {
            console.error('Error calculating routing stats:', error);
            return {
                totalLeads: 0,
                assignedLeads: 0,
                unassignedLeads: 0,
                averageAssignmentTime: 0,
                slaCompliance: 100,
            };
        }
    }
}

export const leadAutoAssignmentService = new LeadAutoAssignmentService();
