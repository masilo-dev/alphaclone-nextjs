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
  let formattedProjects: any[] = [];

  try {
    const supabase = await createSupabaseServerClient();
    
    // Fetch public projects on the server for initial load
    const response = await supabase
      .from('projects')
      .select('*')
      .eq('is_public', true)
      .eq('show_in_portfolio', true)
      .in('status', ['Completed', 'Active'])
      .order('created_at', { ascending: false })
      .limit(20);

    const { data: projects, error } = response;
    
    if (!error && projects && Array.isArray(projects)) {
      formattedProjects = projects.map((p: any) => ({
        id: String(p.id || ''),
        ownerId: p.owner_id ? String(p.owner_id) : undefined,
        ownerName: p.owner_name || '',
        name: p.name || '',
        category: p.category || '',
        status: p.status || '',
        currentStage: p.current_stage || '',
        progress: Number(p.progress) || 0,
        dueDate: p.due_date || null,
        startDate: p.start_date || null,
        team: Array.isArray(p.team) ? p.team : [],
        image: p.image || null,
        description: p.description || '',
        contractStatus: p.contract_status || 'None',
        contractText: p.contract_text || null,
        externalUrl: p.external_url || null,
        isPublic: Boolean(p.is_public),
        showInPortfolio: Boolean(p.show_in_portfolio),
        clientId: p.client_id ? String(p.client_id) : undefined,
        budget: p.budget ? Number(p.budget) : undefined,
        risk: p.risk || 'Low',
        health: p.health || 'On Track',
        resources: Array.isArray(p.resources) ? p.resources : [],
        createdAt: p.created_at || new Date().toISOString(),
      }));
    }
  } catch (error) {
    console.error('Error fetching projects:', error);
    // Continue with empty array
  }

  return (
    <main>
      <Suspense fallback={<div className="min-h-screen bg-[#020D1A]" />}>
        <HomeClient initialProjects={formattedProjects} />
      </Suspense>
    </main>
  );
}
