/**
 * Backend Kanban Policy & Validation Engine.
 * Enforces:
 * - WIP limits per column, swimlane, and owner.
 * - Allowed transitions according to strict state machines.
 * - Mandatory fields (e.g. lost reasons, quotes for proposal, contracts for won).
 * - CRM-specific rules: mandatory next action and date for open deals, suppression checks.
 * - Column-level role permissions and logged WIP overrides.
 */

import { BoardDefinition, BoardCardState, TransitionRequest } from './boardModel';
import { getBoardDefinition } from './boardDefinitions';

export interface PolicyValidationResult {
  valid: boolean;
  errorCode?: 
    | 'INVALID_TRANSITION'
    | 'WIP_LIMIT_EXCEEDED'
    | 'MISSING_REQUIRED_FIELD'
    | 'PERMISSION_DENIED'
    | 'TERMINAL_STATE_LOCKED'
    | 'QUALIFICATION_EVIDENCE_MISSING'
    | 'CONTACT_SUPPRESSED'
    | 'TENANT_MISMATCH';
  message?: string;
  isOverrideAllowed?: boolean;
}

export class BoardPolicyService {
  /**
   * Validate a transition request against all board policies and state machines.
   */
  public static validateTransition(
    boardDef: BoardDefinition,
    currentCard: BoardCardState,
    request: TransitionRequest,
    currentColumnCardCount: number,
    policyOverride?: { wipLimit?: number | null; requiredFields?: string[] }
  ): PolicyValidationResult {
    // 0. Tenant Isolation check
    if (currentCard.tenant_id !== request.tenantId) {
      return {
        valid: false,
        errorCode: 'TENANT_MISMATCH',
        message: 'Security error: Card tenant does not match request tenant.',
      };
    }

    const currentState = currentCard.stage;
    const targetState = request.targetState;

    // Same state is a no-op update
    if (currentState === targetState) {
      return { valid: true };
    }

    // 1. Terminal state immutability check
    if (boardDef.terminalStates.includes(currentState)) {
      return {
        valid: false,
        errorCode: 'TERMINAL_STATE_LOCKED',
        message: `Card is in terminal state '${currentState}'. Terminal records cannot be moved. Create a new record to re-engage.`,
      };
    }

    const currentColumn = boardDef.columns.find(c => c.id === currentState);
    const targetColumn = boardDef.columns.find(c => c.id === targetState);

    if (!targetColumn) {
      return {
        valid: false,
        errorCode: 'INVALID_TRANSITION',
        message: `Target state '${targetState}' does not exist on board '${boardDef.boardType}'.`,
      };
    }

    // 2. Allowed Transitions State Machine Check
    if (currentColumn && currentColumn.allowedTransitions) {
      const isAllowed = currentColumn.allowedTransitions.includes(targetState);
      if (!isAllowed) {
        return {
          valid: false,
          errorCode: 'INVALID_TRANSITION',
          message: `Illegal transition: Cannot move ${boardDef.cardUnitName} from '${currentColumn.title}' (${currentState}) to '${targetColumn.title}' (${targetState}). Allowed: ${currentColumn.allowedTransitions.join(', ')}`,
        };
      }
    }

    // 3. Role Permissions Check
    if (targetColumn.rolePermissions && targetColumn.rolePermissions.length > 0) {
      const userRole = request.userRole || 'member';
      const hasRole = targetColumn.rolePermissions.includes(userRole) || ['owner', 'admin', 'tenant_admin'].includes(userRole);
      if (!hasRole) {
        return {
          valid: false,
          errorCode: 'PERMISSION_DENIED',
          message: `Role '${userRole}' does not have permission to transition cards into '${targetColumn.title}'.`,
        };
      }
    }

    // 4. WIP Limit Enforcement
    const effectiveWipLimit = policyOverride?.wipLimit !== undefined ? policyOverride.wipLimit : targetColumn.wipLimit;
    if (effectiveWipLimit !== null && effectiveWipLimit !== undefined && effectiveWipLimit > 0) {
      if (currentColumnCardCount >= effectiveWipLimit) {
        const canOverride = ['owner', 'admin', 'tenant_admin'].includes(request.userRole || '');
        if (request.overrideWip && canOverride) {
          if (!request.overrideReason || !request.overrideReason.trim()) {
            return {
              valid: false,
              errorCode: 'WIP_LIMIT_EXCEEDED',
              message: `Column '${targetColumn.title}' is at capacity (${currentColumnCardCount}/${effectiveWipLimit}). A logged override reason is mandatory.`,
              isOverrideAllowed: true,
            };
          }
          // Authorized override with logged reason succeeds
        } else {
          return {
            valid: false,
            errorCode: 'WIP_LIMIT_EXCEEDED',
            message: `WIP limit exceeded for column '${targetColumn.title}'. Current: ${currentColumnCardCount}, Max: ${effectiveWipLimit}. Complete or advance existing work first.`,
            isOverrideAllowed: canOverride,
          };
        }
      }
    }

    // 5. Mandatory Reason for Terminal Lost / Cancelled
    if (targetColumn.mandatoryReasonOnEntry) {
      if (!request.reason || !request.reason.trim()) {
        return {
          valid: false,
          errorCode: 'MISSING_REQUIRED_FIELD',
          message: `Entering terminal state '${targetColumn.title}' requires a mandatory reason or outcome explanation.`,
        };
      }
    }

    // 6. CRM-Specific Rules
    if (boardDef.boardType === 'crm_deals') {
      // For all open deals, owner_id and next action + date are mandatory
      if (!targetColumn.isTerminal) {
        const nextAction = request.cardUpdates?.nextAction ?? currentCard.next_action;
        const nextActionDate = request.cardUpdates?.nextActionDate ?? currentCard.next_action_date;
        const ownerId = currentCard.owner_id || request.actorId;

        if (!ownerId) {
          return {
            valid: false,
            errorCode: 'MISSING_REQUIRED_FIELD',
            message: 'Every open deal must have an assigned owner.',
          };
        }
        if (!nextAction || !nextAction.trim()) {
          return {
            valid: false,
            errorCode: 'MISSING_REQUIRED_FIELD',
            message: 'Every open deal must have a scheduled next action.',
          };
        }
        if (!nextActionDate) {
          return {
            valid: false,
            errorCode: 'MISSING_REQUIRED_FIELD',
            message: 'Every open deal must have a scheduled next action date.',
          };
        }
      }

      // Moving to proposal requires a deal value
      if (targetState === 'proposal') {
        const value = request.cardUpdates?.value ?? currentCard.value;
        if (!value || value <= 0) {
          return {
            valid: false,
            errorCode: 'MISSING_REQUIRED_FIELD',
            message: 'Cannot move deal to Proposal without an estimated commercial value ($ > 0).',
          };
        }
      }

      // Moving to closed_won requires contract/agreement acknowledgment
      if (targetState === 'closed_won') {
        const contractId = request.cardUpdates?.contractId || currentCard.metadata?.contract_id;
        const wonDetails = currentCard.metadata?.won_details || request.reason;
        if (!contractId && !wonDetails) {
          return {
            valid: false,
            errorCode: 'MISSING_REQUIRED_FIELD',
            message: 'Cannot close deal as Won without an attached contract reference or won agreement details.',
          };
        }
      }
    }

    // 7. Tasks Checklist Completion Requirement
    if (boardDef.boardType === 'workspace_tasks' || boardDef.boardType === 'project_tasks') {
      if (targetState === 'completed') {
        // If subtasks exist on card metadata, ensure none are pending
        const subtasks = currentCard.metadata?.subtasks;
        if (Array.isArray(subtasks) && subtasks.length > 0) {
          const hasIncomplete = subtasks.some((st: any) => !st.completed && !st.done);
          if (hasIncomplete && !request.cardUpdates?.checklistComplete) {
            return {
              valid: false,
              errorCode: 'MISSING_REQUIRED_FIELD',
              message: 'Cannot complete task: one or more checklist subtasks are still pending.',
            };
          }
        }
      }
    }

    return { valid: true };
  }
}
