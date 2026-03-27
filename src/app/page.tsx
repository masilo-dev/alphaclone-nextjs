import React, { Suspense } from 'react';
import HomeClient from '@/components/home/HomeClient';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * AlphaClone Home Page (Server Component)
 * 
 * Performance Optimized: Fetches initial portfolio data on the server
 * and delegates client-side logic (auth, search params) to HomeClient.
 */
export default async function Home() {
  const supabase = await createSupabaseServerClient();
  
  // Fetch public projects on the server for initial load
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('is_public', true)
    .eq('show_in_portfolio', true)
    .in('status', ['Completed', 'Active'])
    .order('created_at', { ascending: false })
    .limit(20);

  // Format data to match our Project interface
  const formattedProjects = (projects || []).map((p: any) => ({
    id: p.id,
    ownerId: p.owner_id,
    ownerName: p.owner_name,
    name: p.name,
    category: p.category,
    status: p.status,
    currentStage: p.current_stage,
    progress: p.progress,
    dueDate: p.due_date,
    startDate: p.start_date,
    team: p.team || [],
    image: p.image,
    description: p.description,
    contractStatus: p.contract_status,
    contractText: p.contract_text,
    externalUrl: p.external_url,
    isPublic: p.is_public,
    showInPortfolio: p.show_in_portfolio,
    clientId: p.client_id,
    budget: p.budget,
    risk: p.risk,
    health: p.health,
    resources: p.resources || [],
    createdAt: p.created_at,
  }));

  return (
    <main>
      <Suspense fallback={<div className="min-h-screen bg-[#020D1A]" />}>
        <HomeClient initialProjects={formattedProjects as any} />
      </Suspense>
    </main>
  );
}
