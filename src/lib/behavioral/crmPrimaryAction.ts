/**
 * Von Restorff: one primary CRM action per workspace state.
 */

export type CrmActionVariant = 'primary' | 'secondary';

export interface CrmCommandAction {
  id: string;
  label: string;
  href?: string;
  action?: 'quickAdd' | 'compose';
  variant: CrmActionVariant;
}

export interface CrmPrimaryActionContext {
  totalLeads: number;
  activeClients: number;
  qualifiedLeads?: number;
}

export function resolveCrmCommandActions(ctx: CrmPrimaryActionContext): {
  primary: CrmCommandAction;
  secondary: CrmCommandAction[];
} {
  const { totalLeads, activeClients, qualifiedLeads = 0 } = ctx;

  const compose: CrmCommandAction = {
    id: 'compose',
    label: 'Compose Email',
    action: 'compose',
    variant: 'secondary',
  };
  const quickAdd: CrmCommandAction = {
    id: 'quick-add',
    label: 'Quick Add',
    action: 'quickAdd',
    variant: 'secondary',
  };
  const leadBoard: CrmCommandAction = {
    id: 'lead-board',
    label: 'Lead Board',
    href: '/dashboard/leads',
    variant: 'secondary',
  };

  if (totalLeads === 0 && activeClients === 0) {
    return {
      primary: {
        id: 'add-first',
        label: 'Add first contact',
        action: 'quickAdd',
        variant: 'primary',
      },
      secondary: [
        { id: 'import-leads', label: 'Find leads', href: '/dashboard/business/lead-finder', variant: 'secondary' },
        leadBoard,
      ],
    };
  }

  if (totalLeads > 0 && qualifiedLeads === 0) {
    return {
      primary: {
        id: 'qualify',
        label: 'Qualify leads',
        href: '/dashboard/leads',
        variant: 'primary',
      },
      secondary: [quickAdd, compose],
    };
  }

  if (qualifiedLeads > 0 && activeClients === 0) {
    return {
      primary: {
        id: 'outreach',
        label: 'Start outreach',
        href: '/dashboard/business/campaigns',
        variant: 'primary',
      },
      secondary: [quickAdd, leadBoard],
    };
  }

  if (activeClients > 0) {
    return {
      primary: {
        id: 'create-deal',
        label: 'Create deal',
        href: '/dashboard/deals',
        variant: 'primary',
      },
      secondary: [compose, quickAdd],
    };
  }

  return {
    primary: quickAdd,
    secondary: [compose, leadBoard],
  };
}
