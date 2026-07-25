export * from './IconBase';
export * from './ModuleIcons';

import type { ModuleId } from '@/constants/brand';
import type { ComponentType } from 'react';
import type { AlphacloneIconProps } from './IconBase';
import {
  IconBonnie,
  IconCalendar,
  IconCrm,
  IconDashboard,
  IconDocuments,
  IconEmail,
  IconGoals,
  IconInvoicing,
  IconLeads,
  IconMarketing,
  IconMoney,
  IconNexus,
  IconOutreach,
  IconPipeline,
  IconProjects,
  IconQuotations,
  IconReports,
  IconSettings,
  IconSocial,
  IconTasks,
} from './ModuleIcons';

export const MODULE_ICONS: Record<ModuleId, ComponentType<AlphacloneIconProps>> = {
  dashboard: IconDashboard,
  crm: IconCrm,
  leads: IconLeads,
  pipeline: IconPipeline,
  email: IconEmail,
  outreach: IconOutreach,
  invoicing: IconInvoicing,
  quotations: IconQuotations,
  money: IconMoney,
  projects: IconProjects,
  tasks: IconTasks,
  calendar: IconCalendar,
  documents: IconDocuments,
  marketing: IconMarketing,
  social: IconSocial,
  reports: IconReports,
  goals: IconGoals,
  nexus: IconNexus,
  bonnie: IconBonnie,
  settings: IconSettings,
};

export function getModuleIcon(id: ModuleId) {
  return MODULE_ICONS[id];
}
