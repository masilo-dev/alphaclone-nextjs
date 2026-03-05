import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';

async function getProject(id: string) {
    const { data } = await supabase
        .from('projects')
        .select('name, description, current_stage, status, image')
        .eq('id', id)
        .single();
    return data;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const project = await getProject(id);

    if (!project) {
        return {
            title: 'Project Not Found | AlphaClone Systems',
        };
    }

    const projectName = project.name || 'Project';
    const stage = project.current_stage || 'In Progress';

    return {
        title: `${projectName} | Project Ops | AlphaClone Systems`,
        description: project.description || `Real-time mission control for ${projectName}. Phase: ${stage}. Powered by AlphaClone Business OS.`,
        openGraph: {
            title: `${projectName} | AlphaClone Project Ops`,
            description: project.description || `Real-time execution tracking for ${projectName}.`,
            images: project.image ? [project.image] : [],
        }
    };
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
