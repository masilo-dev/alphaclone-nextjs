import { Metadata } from 'next';
import { projectService } from '@/services/projectService';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const { project } = await projectService.getPublicProjectStatus(id);

    if (!project) {
        return {
            title: 'Project Not Found | AlphaClone Systems',
            robots: { index: false, follow: false },
        };
    }

    const projectName = project.name || 'Project';
    const status = project.status || 'Active';
    const stage = project.currentStage || 'In Progress';

    return {
        title: `${projectName} | Mission Control | AlphaClone Systems`,
        description: `Real-time status for ${projectName}. Current Phase: ${stage}. Status: ${status}. Unified project intelligence powered by AlphaClone Systems.`,
        // Client project pages must never be indexed as AlphaClone marketing content
        robots: { index: false, follow: false },
        openGraph: {
            title: `${projectName} | AlphaClone Mission Control`,
            description: `Transparent project execution and real-time updates for ${projectName}.`,
            images: project.image ? [project.image] : [],
        }
    };
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
