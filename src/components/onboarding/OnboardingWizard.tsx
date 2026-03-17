'use client';

import { useState } from 'react';
import { Check, ChevronRight, Users, FolderPlus, Settings, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    icon: any;
    completed: boolean;
}

export function OnboardingWizard() {
    const router = useRouter();
    const { user } = useAuth();
    const { currentTenant: tenant } = useTenant();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // Onboarding steps
    const [steps, setSteps] = useState<OnboardingStep[]>([
        {
            id: 'welcome',
            title: 'Welcome to AlphaClone',
            description: 'Let\'s get you set up in just a few minutes',
            icon: Sparkles,
            completed: false,
        },
        {
            id: 'profile',
            title: 'Complete Your Profile',
            description: 'Tell us a bit about yourself',
            icon: Settings,
            completed: false,
        },
        {
            id: 'team',
            title: 'Invite Your Team',
            description: 'Collaborate with teammates',
            icon: Users,
            completed: false,
        },
        {
            id: 'project',
            title: 'Create First Project',
            description: 'Start tracking your work',
            icon: FolderPlus,
            completed: false,
        },
    ]);

    // Form state
    const [profileData, setProfileData] = useState({
        fullName: '',
        company: '',
        role: '',
        phone: '',
    });

    const [teamInvites, setTeamInvites] = useState<string[]>(['']);

    const [projectData, setProjectData] = useState({
        name: '',
        description: '',
    });

    const markStepComplete = (stepIndex: number) => {
        const newSteps = [...steps];
        newSteps[stepIndex].completed = true;
        setSteps(newSteps);
    };

    const handleNext = async () => {
        switch (currentStep) {
            case 0:
                // Welcome - just proceed
                markStepComplete(0);
                setCurrentStep(1);
                break;

            case 1:
                // Save profile
                await saveProfile();
                break;

            case 2:
                // Invite team (optional)
                await inviteTeam();
                break;

            case 3:
                // Create project
                await createProject();
                break;

            default:
                break;
        }
    };

    const handleSkip = () => {
        markStepComplete(currentStep);
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            completeOnboarding();
        }
    };

    const saveProfile = async () => {
        if (!profileData.fullName) {
            toast.error('Please enter your name');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: profileData.fullName,
                    company: profileData.company,
                    role: profileData.role,
                    phone: profileData.phone,
                })
                .eq('id', user?.id);

            if (error) throw error;

            markStepComplete(1);
            setCurrentStep(2);
            toast.success('Profile updated!');
        } catch (error) {
            console.error('Error saving profile:', error);
            toast.error('Failed to save profile');
        } finally {
            setLoading(false);
        }
    };

    const inviteTeam = async () => {
        const validEmails = teamInvites.filter(email =>
            email && email.includes('@')
        );

        if (validEmails.length === 0) {
            // Skip if no emails
            markStepComplete(2);
            setCurrentStep(3);
            return;
        }

        setLoading(true);
        try {
            // Send invitations
            for (const email of validEmails) {
                await supabase.from('tenant_users').insert({
                    tenant_id: tenant?.id,
                    email,
                    role: 'client',
                    status: 'invited',
                });
            }

            markStepComplete(2);
            setCurrentStep(3);
            toast.success(`Invited ${validEmails.length} team member(s)!`);
        } catch (error) {
            console.error('Error inviting team:', error);
            toast.error('Failed to send invitations');
        } finally {
            setLoading(false);
        }
    };

    const createProject = async () => {
        if (!projectData.name) {
            toast.error('Please enter a project name');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.from('projects').insert({
                tenant_id: tenant?.id,
                name: projectData.name,
                description: projectData.description,
                status: 'Active',
                created_by: user?.id,
            });

            if (error) throw error;

            markStepComplete(3);
            toast.success('Project created!');

            // Complete onboarding
            await completeOnboarding();
        } catch (error) {
            console.error('Error creating project:', error);
            toast.error('Failed to create project');
        } finally {
            setLoading(false);
        }
    };

    const completeOnboarding = async () => {
        try {
            // Mark onboarding as complete
            await supabase
                .from('profiles')
                .update({ onboarding_completed: true })
                .eq('id', user?.id);

            toast.success('Setup complete! Welcome aboard! 🎉');

            // Redirect to dashboard
            setTimeout(() => {
                router.push('/dashboard');
            }, 1000);
        } catch (error) {
            console.error('Error completing onboarding:', error);
        }
    };

    const progress = ((currentStep + 1) / steps.length) * 100;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
                {/* Progress bar */}
                <div className="h-2 bg-gray-200">
                    <div
                        className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Content */}
                <div className="p-8">
                    {/* Step indicator */}
                    <div className="flex items-center justify-between mb-8">
                        {steps.map((step, index) => {
                            const Icon = step.icon;
                            const isCurrent = index === currentStep;
                            const isCompleted = step.completed;

                            return (
                                <div key={step.id} className="flex items-center">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                                            isCompleted
                                                ? 'bg-green-600 text-white'
                                                : isCurrent
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-200 text-gray-500'
                                        }`}
                                    >
                                        {isCompleted ? (
                                            <Check className="h-5 w-5" />
                                        ) : (
                                            <Icon className="h-5 w-5" />
                                        )}
                                    </div>
                                    {index < steps.length - 1 && (
                                        <div
                                            className={`w-16 h-1 mx-2 ${
                                                isCompleted ? 'bg-green-600' : 'bg-gray-200'
                                            }`}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Current step content */}
                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">
                            {steps[currentStep].title}
                        </h2>
                        <p className="text-gray-600">{steps[currentStep].description}</p>
                    </div>

                    {/* Step forms */}
                    <div className="mb-8">
                        {/* Welcome step */}
                        {currentStep === 0 && (
                            <div className="text-center py-8">
                                <Sparkles className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                                <p className="text-lg text-gray-700 mb-6">
                                    We're thrilled to have you here! Let's get your account set up
                                    so you can start managing your business operations seamlessly.
                                </p>
                                <p className="text-sm text-gray-500">
                                    This will only take 2-3 minutes
                                </p>
                            </div>
                        )}

                        {/* Profile step */}
                        {currentStep === 1 && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Full Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={profileData.fullName}
                                        onChange={e =>
                                            setProfileData({ ...profileData, fullName: e.target.value })
                                        }
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Company Name
                                    </label>
                                    <input
                                        type="text"
                                        value={profileData.company}
                                        onChange={e =>
                                            setProfileData({ ...profileData, company: e.target.value })
                                        }
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Acme Corp"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Your Role
                                    </label>
                                    <select
                                        value={profileData.role}
                                        onChange={e =>
                                            setProfileData({ ...profileData, role: e.target.value })
                                        }
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="">Select a role</option>
                                        <option value="founder">Founder/CEO</option>
                                        <option value="manager">Project Manager</option>
                                        <option value="developer">Developer</option>
                                        <option value="designer">Designer</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={profileData.phone}
                                        onChange={e =>
                                            setProfileData({ ...profileData, phone: e.target.value })
                                        }
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="+1 (555) 123-4567"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Team invitations step */}
                        {currentStep === 2 && (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-600 mb-4">
                                    Invite team members to collaborate (optional)
                                </p>
                                {teamInvites.map((email, index) => (
                                    <div key={index} className="flex gap-2">
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => {
                                                const newInvites = [...teamInvites];
                                                newInvites[index] = e.target.value;
                                                setTeamInvites(newInvites);
                                            }}
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="teammate@example.com"
                                        />
                                    </div>
                                ))}
                                <button
                                    onClick={() => setTeamInvites([...teamInvites, ''])}
                                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    + Add another
                                </button>
                            </div>
                        )}

                        {/* Project creation step */}
                        {currentStep === 3 && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Project Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={projectData.name}
                                        onChange={e =>
                                            setProjectData({ ...projectData, name: e.target.value })
                                        }
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Website Redesign"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description (optional)
                                    </label>
                                    <textarea
                                        value={projectData.description}
                                        onChange={e =>
                                            setProjectData({
                                                ...projectData,
                                                description: e.target.value,
                                            })
                                        }
                                        rows={3}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="A brief description of your project..."
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={handleSkip}
                            className="text-gray-600 hover:text-gray-800 font-medium"
                        >
                            Skip
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={loading}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-colors flex items-center disabled:opacity-50"
                        >
                            {loading ? (
                                'Processing...'
                            ) : currentStep === steps.length - 1 ? (
                                'Complete Setup'
                            ) : (
                                <>
                                    Continue
                                    <ChevronRight className="h-5 w-5 ml-1" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
