export interface Tenant {
  id: string;
  name: string;
  slug: string;
  role: string;
  joined_at?: string;
}

export interface MobileProject {
  id: string;
  title: string;
  client: string;
  status: string;
  progress: number;
  deadline?: string;
  budget?: number;
  description?: string;
}

export interface MobileLead {
  id: string;
  name: string;
  email?: string;
  company?: string;
  status: string;
  value?: number;
  phone?: string;
  notes?: string;
  lastContact?: string;
}

export interface MobileInvoice {
  id: string;
  number: string;
  client?: string;
  amount: number;
  status: string;
  dueDate?: string;
  issueDate?: string;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    price: number;
    total: number;
  }>;
}

export interface MobileActivity {
  id: string;
  title: string;
  time: string;
  type: 'calendar' | 'lead' | 'project' | 'finance';
}

export interface MobileDashboardStats {
  activeProjects: number;
  totalLeads: number;
  revenue: number;
  tasks: number;
  recentActivity: MobileActivity[];
}
