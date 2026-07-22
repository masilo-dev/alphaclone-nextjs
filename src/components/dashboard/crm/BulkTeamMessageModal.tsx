'use client';

import React from 'react';
import ComposeEmailModal from '@/components/dashboard/business/ComposeEmailModal';
import { BULK_TEAM_DEFAULT_SUBJECT, buildBulkTeamMessageBody } from '@/lib/email/bulkTeamMessage';

type BulkTeamMessageModalProps = {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  recipients: string[];
  subject?: string;
  body?: string;
};

/** Inline compose for team/bulk messaging — skip CRM gate so selected tenant emails can send. */
export function BulkTeamMessageModal({
  isOpen,
  onClose,
  userId,
  recipients,
  subject = BULK_TEAM_DEFAULT_SUBJECT,
  body,
}: BulkTeamMessageModalProps) {
  if (!isOpen) return null;

  return (
    <ComposeEmailModal
      isOpen={isOpen}
      onClose={onClose}
      userId={userId}
      initialTo={recipients.join(', ')}
      initialSubject={subject}
      initialBody={body ?? (recipients.length > 1 ? buildBulkTeamMessageBody() : '')}
      skipCrmGate
      entityType="direct"
    />
  );
}
