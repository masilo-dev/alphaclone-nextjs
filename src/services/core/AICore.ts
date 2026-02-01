import { GoogleGenerativeAI } from '@google/generative-ai';
import { ENV } from '../../config/env';
import { supabase } from '../../lib/supabase';
import { tenantService } from '../tenancy/TenantService';

const GEMINI_API_KEY = ENV.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

interface AIContext {
  tenantId: string;
  userId: string;
  userRole: 'admin' | 'client';
  businessType?: string;
  recentActivity?: any[];
}

export class AICore {
  private model: any;

  constructor() {
    this.model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  /**
   * MARKETING: AI generates marketing strategies
   */
  async generateMarketingStrategy(context: AIContext, goals: string[]): Promise<{
    strategy: string;
    tactics: string[];
    timeline: string;
    budget: string;
    metrics: string[];
  }> {
    const prompt = `
You are a marketing strategist for ${context.businessType || 'a business'}.

Business Context:
- Goals: ${goals.join(', ')}
- Current focus: Growing customer base

Generate a comprehensive marketing strategy including:
1. Overall strategy
2. Specific tactics (5-7)
3. Timeline (3-6 months)
4. Recommended budget
5. Key metrics to track

Format as JSON with these exact keys: strategy, tactics (array), timeline, budget, metrics (array)
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('AI marketing strategy failed:', error);
      throw error;
    }
  }

  /**
   * CONTRACTS: AI generates contracts automatically
   */
  async generateContract(params: {
    clientName: string;
    projectName: string;
    projectType: string;
    deliverables: string[];
    timeline: string;
    budget: number;
    terms: string[];
  }): Promise<string> {
    const prompt = `
Generate a professional service contract with these details:

Client: ${params.clientName}
Project: ${params.projectName}
Type: ${params.projectType}
Deliverables: ${params.deliverables.join(', ')}
Timeline: ${params.timeline}
Budget: $${params.budget}
Terms: ${params.terms.join(', ')}

Include:
1. Introduction
2. Scope of Work
3. Deliverables
4. Timeline & Milestones
5. Payment Terms
6. Intellectual Property Rights
7. Confidentiality
8. Termination Clause
9. Signatures

Make it professional, legally sound, and clear.
`;

    try {
      const result = await this.model.generateContent(prompt);
      const contract = result.response.text();

      // Save to database
      const tenantId = tenantService.getCurrentTenantId();
      await supabase.from('contracts').insert({
        tenant_id: tenantId,
        client_name: params.clientName,
        project_name: params.projectName,
        contract_text: contract,
        status: 'draft',
        generated_by: 'AI',
        created_at: new Date().toISOString()
      });

      return contract;
    } catch (error) {
      console.error('AI contract generation failed:', error);
      throw error;
    }
  }

  /**
   * PROJECT UPDATES: AI generates project status updates
   */
  async generateProjectUpdate(projectId: string, updates: string[]): Promise<{
    summary: string;
    message: string;
    nextSteps: string[];
  }> {
    // Get project details
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (!project) throw new Error('Project not found');

    const prompt = `
Generate a professional project update message for:

Project: ${project.name}
Progress: ${project.progress}%
Status: ${project.status}
Stage: ${project.current_stage}

Recent Updates:
${updates.join('\n')}

Create:
1. Executive Summary (2-3 sentences)
2. Client Message (professional, friendly)
3. Next Steps (3-5 items)

Format as JSON with keys: summary, message, nextSteps (array)
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const update = JSON.parse(jsonMatch[0]);

        // Auto-send to client
        await supabase.from('messages').insert({
          tenant_id: project.tenant_id,
          sender_id: 'system',
          sender_name: 'AlphaClone AI',
          sender_role: 'system',
          recipient_id: project.owner_id,
          text: update.message,
          is_thinking: false
        });

        return update;
      }

      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('AI project update failed:', error);
      throw error;
    }
  }

  /**
   * SMART REPLIES: AI suggests replies to messages
   */
  async suggestReply(messageText: string, context: AIContext): Promise<string[]> {
    const prompt = `
You're helping ${context.userRole === 'admin' ? 'a business admin' : 'a client'} respond to this message:

"${messageText}"

Suggest 3 professional reply options:
1. Positive/Agreeable
2. Neutral/Clarifying
3. Detailed/Thorough

Keep each reply under 100 words. Format as array of strings.
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      // Extract array from response
      const arrayMatch = response.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        return JSON.parse(arrayMatch[0]);
      }

      // Fallback: split by numbered list
      const lines = response.split('\n').filter((l: string) => l.trim());
      return lines.slice(0, 3);
    } catch (error) {
      console.error('AI reply suggestion failed:', error);
      return ['Thank you for your message. I\'ll get back to you shortly.'];
    }
  }

  /**
   * TASK INTELLIGENCE: AI suggests tasks based on project
   */
  async suggestTasks(projectId: string): Promise<Array<{
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    estimatedHours: number;
  }>> {
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (!project) throw new Error('Project not found');

    const prompt = `
Project: ${project.name}
Category: ${project.category}
Current Stage: ${project.current_stage}
Progress: ${project.progress}%

Suggest 5-7 relevant tasks to move this project forward. Consider:
- Current stage of project
- Typical workflow for ${project.category}
- Progress percentage

Return JSON array with: title, description, priority, estimatedHours
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('AI task suggestion failed:', error);
      return [];
    }
  }

  /**
   * INSIGHTS: AI analyzes business data and provides insights
   */
  async generateInsights(context: AIContext): Promise<{
    summary: string;
    strengths: string[];
    improvements: string[];
    recommendations: string[];
  }> {
    const tenantId = context.tenantId;

    // Get tenant data
    const [projectsData, tasksData, dealsData] = await Promise.all([
      supabase.from('projects').select('*').eq('tenant_id', tenantId),
      supabase.from('tasks').select('*').eq('tenant_id', tenantId),
      supabase.from('deals').select('*').eq('tenant_id', tenantId)
    ]);

    const prompt = `
Analyze this business data:

Projects: ${projectsData.data?.length || 0} total
- Active: ${projectsData.data?.filter((p: any) => p.status === 'Active').length || 0}
- Completed: ${projectsData.data?.filter((p: any) => p.status === 'Completed').length || 0}

Tasks: ${tasksData.data?.length || 0} total
- Completed: ${tasksData.data?.filter((t: any) => t.status === 'completed').length || 0}

Deals: ${dealsData.data?.length || 0} total

Provide business insights:
1. Overall Summary (2-3 sentences)
2. Strengths (3-4 points)
3. Areas for Improvement (3-4 points)
4. Actionable Recommendations (4-5 points)

Format as JSON with keys: summary, strengths, improvements, recommendations (all arrays except summary)
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('AI insights failed:', error);
      throw error;
    }
  }

  /**
   * EMAIL CAMPAIGNS: AI writes email copy
   */
  async generateEmailCampaign(params: {
    campaignGoal: string;
    targetAudience: string;
    tone: 'professional' | 'friendly' | 'casual';
    callToAction: string;
  }): Promise<{
    subject: string;
    preview: string;
    body: string;
    variations: Array<{ subject: string; body: string }>;
  }> {
    const prompt = `
Create an email campaign:

Goal: ${params.campaignGoal}
Audience: ${params.targetAudience}
Tone: ${params.tone}
CTA: ${params.callToAction}

Generate:
1. Subject Line (compelling, under 60 chars)
2. Preview Text (engaging, under 90 chars)
3. Email Body (HTML formatted, professional)
4. 2 alternative variations (different angles)

Format as JSON with keys: subject, preview, body, variations (array of {subject, body})
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('AI email campaign failed:', error);
      throw error;
    }
  }

  /**
   * AUTO-RESPOND: AI automatically responds to client messages (when enabled)
   */
  async autoRespond(messageId: string, messageText: string, context: AIContext): Promise<void> {
    // Check if auto-respond is enabled for tenant
    const { data: settings } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', context.tenantId)
      .single();

    if (!settings?.settings?.autoRespond) {
      return; // Auto-respond not enabled
    }

    // Generate smart response
    const replies = await this.suggestReply(messageText, context);
    const bestReply = replies[0]; // Use first suggestion

    // Send auto-response
    await supabase.from('messages').insert({
      tenant_id: context.tenantId,
      sender_id: 'ai-assistant',
      sender_name: 'AI Assistant',
      sender_role: 'system',
      recipient_id: context.userId,
      text: bestReply,
      is_thinking: false,
      metadata: {
        autoGenerated: true,
        originalMessageId: messageId
      }
    });
  }

  /**
   * PREDICTIVE ANALYTICS: AI predicts project success, deal closure, etc.
   */
  async predictProjectSuccess(projectId: string): Promise<{
    successProbability: number;
    factors: Array<{ factor: string; impact: 'positive' | 'negative' }>;
    recommendations: string[];
  }> {
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (!project) throw new Error('Project not found');

    const prompt = `
Analyze project success probability:

Project: ${project.name}
Progress: ${project.progress}%
Status: ${project.status}
Stage: ${project.current_stage}
Due Date: ${project.due_date}
Started: ${project.created_at}

Provide:
1. Success Probability (0-100)
2. Key Factors (positive and negative)
3. Recommendations to improve

Format as JSON with: successProbability (number), factors (array of {factor, impact}), recommendations (array)
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('AI prediction failed:', error);
      throw error;
    }
  }
}

// Singleton instance
export const aiCore = new AICore();

// Export for easy access
export default aiCore;
