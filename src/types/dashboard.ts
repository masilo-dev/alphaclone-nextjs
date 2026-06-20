export interface DashboardMetric {
  label: string;
  value: number;
  trend: number;
  icon: string;
  color: string;
  critical?: boolean;
}

export interface RevenueDataPoint {
  month: string;
  revenue: number;
}

export interface PipelineStage {
  stage: string;
  count: number;
  value: number;
  color: string;
}

export interface ActivityLog {
  id: string;
  entity_type: string;
  action: string;
  created_at: string;
  tenant_id: string;
}

export interface Deal {
  id: string;
  name: string;
  stage: string;
  value: number;
  client_name?: string;
  created_at: string;
}

export interface SocialPost {
  id: string;
  platform: string;
  content: string;
  scheduled_for: string;
  status: string;
  created_at: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}
