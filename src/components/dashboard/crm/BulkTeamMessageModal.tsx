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

/** Inline bulk compose — shared "Hello team," greeting, no navigation away from the list. */
export function BulkTeamMessageModal({
  isOpen,
  onClose,
  userId,
  recipients,
  subject = BULK_TEAM_DEFAULT_SUBJECT,
  body,
}: BulkTeamMessageModalProps) {
  if (!isOpen || recipients.length === 0) return null;

  return (
    <ComposeEmailModal
      isOpen={isOpen}
      onClose={onClose}
      userId={userId}
      initialTo={recipients.join(', ')}
      initialSubject={subject}
      initialBody={body ?? buildBulkTeamMessageBody()}
      skipCrmGate
      entityType="direct"
    />
  );
}
