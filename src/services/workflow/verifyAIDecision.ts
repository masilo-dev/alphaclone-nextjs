import { stepExecutors } from './executors';
import { WorkflowStep, WorkflowContext } from './types';

async function testLeadQualification() {
    console.log('--- Starting AI Decision Verification ---');

    const step: WorkflowStep = {
        id: 'test-decision',
        type: 'ai_decision',
        name: 'Qualify High Value Lead',
        config: {
            decisionType: 'lead_qualification',
            prompt: 'Should we prioritize this lead based on the provided context?',
            options: ['Approve', 'Reject', 'Follow-up']
        }
    };

    const context: WorkflowContext = {
        instanceId: 'test-inst-001',
        workflowId: 'test-wf-001',
        variables: {
            lead_name: 'John Doe',
            industry: 'AI Software',
            budget: '$50,000',
            timeline: 'Ready to start next month',
            role: 'Director of Engineering',
            message: 'We are looking for a comprehensive AI Sales solution to automate our outreach.'
        },
        stepResults: {}
    };

    try {
        const executor = stepExecutors.ai_decision;
        if (!executor) throw new Error('AI Decision executor not found');

        const result = await executor(step, context);
        console.log('AI Decision Results:');
        console.log(JSON.stringify(result, null, 2));

        if (result.decision && ['Approve', 'Reject', 'Follow-up'].includes(result.decision)) {
            console.log('\n✅ Verification Successful: AI returned a valid decision.');
        } else {
            console.log('\n❌ Verification Failed: AI returned an invalid decision.');
        }
    } catch (error) {
        console.error('\n❌ Verification Error:', error);
    }
}

testLeadQualification();
