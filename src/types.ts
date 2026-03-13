
import React from 'react';

export type UserRole = 'admin' | 'client' | 'visitor' | 'tenant_admin' | 'business_dashboard';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar: string;
  user_metadata?: any;
  company?: string;
  account_status?: 'active' | 'pending_deletion';
  scheduled_deletion_at?: string;
  sectors?: string[];
  services?: string[];
  status?: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<any>;
  subItems?: NavItem[];
  comingSoon?: boolean;
}

export interface ServiceItem {
  title: string;
  description: string;
  price: string;
  features: string[];
  icon: React.ComponentType<any>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  senderName?: string;
  senderId?: string;
  recipientId?: string; // New: target user (null = system/broadcast)
  text: string;
  timestamp: Date;
  isThinking?: boolean;
  attachments?: {
    id: string;
    url: string;
    type: 'image' | 'file';
    name: string;
  }[];
  readAt?: Date | null;
  deliveredAt?: Date | null; // Timestamp when message was delivered
  priority?: 'normal' | 'high' | 'urgent';
  reactions?: Record<string, string[]>;
  reply_to?: string;
  edited_at?: string;
  group_id?: string;
}

export type ProjectStage = 'Initiation' | 'Planning' | 'Execution' | 'Review' | 'Closure';

export interface Project {
  id: string;
  ownerId?: string;
  ownerName?: string; // Helper for contract generation
  name: string;
  category: string;
  status: 'Active' | 'Pending' | 'Completed' | 'Declined' | 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
  currentStage: ProjectStage; // Detailed stage
  progress: number;
  dueDate?: string;
  startDate?: string;
  team: string[];
  image?: string;
  description?: string;
  email?: string; // Derived from owner profile
  budget?: number;
  contractStatus?: 'None' | 'Drafted' | 'Sent' | 'Signed';
  contractText?: string;
  externalUrl?: string;
  isPublic?: boolean;
  showInPortfolio?: boolean;
  clientId?: string;
  location?: string;
  risk?: 'Low' | 'Medium' | 'High';
  health?: 'On Track' | 'At Risk' | 'Delayed';
  resources?: string[];
  createdAt?: string; // ISO Date
}

export interface Invoice {
  id: string;
  projectId: string;
  projectName: string;
  clientId: string;
  amount: number;
  status: 'Paid' | 'Unpaid' | 'Overdue';
  dueDate: string;
  description: string;
}

export interface DashboardStat {
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ComponentType<any>;
  color?: string;
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  message: string;
  date: string;
  status: 'New' | 'Read' | 'Replied';
}

export interface GalleryItem {
  id: string;
  userId: string;
  type: 'image' | 'video';
  url: string;
  prompt: string;
  createdAt: Date;
}

export interface Improvement {
  id: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  source: string;
  channel: string;
  page_url: string;
  screenshot_url?: string;
  user_type: 'visitor' | 'client' | 'tenant_admin' | 'admin';
  user_id?: string;
  is_pwa: boolean;
  status: 'new' | 'reviewed' | 'in_progress' | 'resolved';
  admin_notes?: string;
  created_at: Date;
  updated_at: Date;
}
