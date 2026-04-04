// Add to TenantService.ts - Automatic demo data creation
private async ensureDemoData(tenantId: string, userId: string): Promise<void> {
  // Check if tenant has any data
  const { data: projects, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1);

  if (!projectError && projects && projects.length === 0) {
    console.log('[TenantService] Creating demo data for new tenant');
    
    // Create demo projects, leads, clients, etc.
    await this.createDemoData(tenantId, userId);
  }
}

private async createDemoData(tenantId: string, userId: string): Promise<void> {
  const demoData = [
    // Demo projects
    { name: 'Website Redesign', category: 'Web Development', status: 'Active', progress: 65 },
    { name: 'Mobile App Development', category: 'Mobile Development', status: 'Active', progress: 35 },
    // Demo leads
    { company: 'Tech Corp Inc', contact: 'John Smith', email: 'john@techcorp.com', value: 15000 },
    { company: 'StartupXYZ', contact: 'Sarah Johnson', email: 'sarah@startupxyz.com', value: 8500 },
  ];

  // Insert demo data...
  console.log('[TenantService] Demo data created successfully');
}
