'use client';

import React from 'react';
import { Loader2, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';

interface MicrosoftConnectButtonProps {
  connected: boolean;
  loading?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export default function MicrosoftConnectButton({
  connected,
  loading = false,
  onConnect,
  onDisconnect,
}: MicrosoftConnectButtonProps) {
  return connected ? (
    <Button
      type="button"
      variant="outline"
      disabled={loading}
      onClick={onDisconnect}
      className="border-slate-700 text-rose-300 hover:bg-rose-500/10"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Unplug className="w-4 h-4 mr-2" />}
      Disconnect
    </Button>
  ) : (
    <Button
      type="button"
      disabled={loading}
      onClick={onConnect}
      className="bg-blue-600 hover:bg-blue-500 text-white font-bold"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
      Connect Microsoft 365
    </Button>
  );
}
