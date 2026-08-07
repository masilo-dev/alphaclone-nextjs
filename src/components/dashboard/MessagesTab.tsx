import React from 'react';

/**
 * Temporary restore stub while full MessagesTab (with unified Avatar) is pushed.
 * Full file with Avatar adoption is ready in PR artifacts — will replace this commit.
 * See: conversation list / header / CRM contacts use Avatar (gradient+initials fallback).
 */
export default function MessagesTab(props: any) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 gap-3 p-8">
      <p className="text-white font-semibold text-lg">Messages</p>
      <p className="text-sm text-center max-w-md">
        Messaging module is being restored with production Avatar + mobile fixes.
        Full component landing in next commit on this PR.
      </p>
    </div>
  );
}
