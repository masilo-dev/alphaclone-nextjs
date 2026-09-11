'use client';

import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  HStack,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { Check, Pencil, ShieldAlert, X } from 'lucide-react';
import { BC } from './bonnieChakra';
import { hermeticBonnieActivityLabel } from './BonnieChatPanel';

export type BonnieApprovalCardProps = {
  approvalId: string;
  tool: string;
  riskClass?: string;
  summary?: string;
  reason?: string;
  impact?: string;
  recommendation?: string;
  preview?: { target?: string; draft?: string; previousDraft?: string };
  payloadDiff?: Record<string, { before?: unknown; after?: unknown }>;
  onApprove: (editedArgs?: Record<string, unknown>) => Promise<{ success: boolean; message?: string }>;
  onReject: () => Promise<{ success: boolean }>;
  disabled?: boolean;
};

function DiffLine({ label, before, after }: { label: string; before?: string; after?: string }) {
  if (!before && !after) return null;
  const changed = before !== after;
  return (
    <Box borderWidth="1px" borderColor={BC.border} bg="gray.950" borderRadius={BC.controlRadius} p={2} fontSize="xs">
      <Text mb={1} fontWeight="semibold" textTransform="uppercase" letterSpacing="wide" fontSize="10px" color={BC.subtle}>
        {label}
      </Text>
      {changed && before ? (
        <Text mb={1} whiteSpace="pre-wrap" color="rose.300" textDecoration="line-through">
          {before}
        </Text>
      ) : null}
      {after ? (
        <Text whiteSpace="pre-wrap" color={changed ? 'green.300' : 'gray.300'}>
          {after}
        </Text>
      ) : null}
    </Box>
  );
}

export default function BonnieApprovalCard({
  approvalId,
  tool,
  riskClass,
  summary,
  reason,
  impact,
  recommendation,
  preview,
  payloadDiff,
  onApprove,
  onReject,
  disabled = false,
}: BonnieApprovalCardProps) {
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(preview?.draft || '');
  const [busy, setBusy] = useState(false);

  const draftChanged = useMemo(
    () => editing && draftText !== (preview?.draft || ''),
    [editing, draftText, preview?.draft]
  );

  const hermetic = hermeticBonnieActivityLabel(tool);
  const whatLabel = summary || hermetic.text;
  const whyLabel = reason || 'Bonnie needs your OK before this can change customer or money data.';
  const impactLabel =
    impact ||
    (riskClass === 'financial' || riskClass === 'high' || riskClass === 'critical'
      ? 'May send money-related messages or change invoices.'
      : riskClass === 'send' || riskClass === 'bulk'
        ? 'May contact customers or publish outward-facing content.'
        : 'Updates your workspace records.');
  const recommendationLabel =
    recommendation || 'Approve if this matches what you asked Bonnie to do. Edit first if the draft needs a tweak.';

  const handleApprove = async () => {
    setBusy(true);
    try {
      const editedArgs = draftChanged
        ? { body: draftText, message: draftText, content: draftText, text: draftText }
        : undefined;
      const result = await onApprove(editedArgs);
      if (result.success) setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    try {
      await onReject();
    } finally {
      setBusy(false);
    }
  };

  const diffEntries = Object.entries(payloadDiff || {}).slice(0, 8);

  return (
    <Box
      mt={3}
      borderWidth="1px"
      borderColor="amber.500"
      bg="blackAlpha.400"
      borderRadius={BC.radius}
      p={3}
    >
      <HStack spacing={2} mb={2}>
        <ShieldAlert size={16} color="#FBBF24" />
        <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wider" color="amber.300">
          Approval required
        </Text>
        {riskClass ? (
          <Box as="span" borderRadius="sm" bg="gray.800" px={1.5} py={0.5} fontSize="10px" fontFamily="mono" color="gray.400">
            {riskClass}
          </Box>
        ) : null}
      </HStack>

      <VStack align="stretch" spacing={2} fontSize="xs">
        <Box>
          <Text fontSize="10px" fontWeight="bold" textTransform="uppercase" letterSpacing="wider" color={BC.subtle}>
            What
          </Text>
          <Text mt={0.5} fontSize="sm" fontWeight="medium" color="whiteAlpha.900">
            <Text as="span" fontWeight="semibold" color="teal.300">
              {hermetic.text}
            </Text>
            <Text as="span" color="gray.400">
              {' '}
              — {whatLabel}
            </Text>
          </Text>
        </Box>
        <Box>
          <Text fontSize="10px" fontWeight="bold" textTransform="uppercase" letterSpacing="wider" color={BC.subtle}>
            Why
          </Text>
          <Text mt={0.5} color="gray.300">
            {whyLabel}
          </Text>
        </Box>
        <Box>
          <Text fontSize="10px" fontWeight="bold" textTransform="uppercase" letterSpacing="wider" color={BC.subtle}>
            Impact
          </Text>
          <Text mt={0.5} color="gray.300">
            {impactLabel}
          </Text>
        </Box>
        <Box>
          <Text fontSize="10px" fontWeight="bold" textTransform="uppercase" letterSpacing="wider" color={BC.subtle}>
            Bonnie recommendation
          </Text>
          <Text mt={0.5} color="teal.200">
            {recommendationLabel}
          </Text>
        </Box>
      </VStack>

      {preview?.target ? (
        <Text mt={2} fontSize="xs" color="gray.300">
          <Text as="span" color={BC.subtle}>
            Target:
          </Text>{' '}
          {preview.target}
        </Text>
      ) : null}

      <VStack align="stretch" spacing={2} mt={2}>
        {editing ? (
          <Textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={5}
            borderColor="gray.700"
            bg="gray.900"
            color="gray.100"
            borderRadius={BC.controlRadius}
            fontSize="xs"
            _focus={{ borderColor: 'teal.500', boxShadow: 'none' }}
          />
        ) : (
          <DiffLine label="Proposed content" before={preview?.previousDraft} after={preview?.draft} />
        )}

        {draftChanged ? <DiffLine label="Your edit vs original" before={preview?.draft} after={draftText} /> : null}

        {diffEntries.map(([key, value]) => (
          <DiffLine
            key={key}
            label={key}
            before={value.before != null ? String(value.before) : undefined}
            after={value.after != null ? String(value.after) : undefined}
          />
        ))}
      </VStack>

      <HStack spacing={2} mt={3} flexWrap="wrap">
        <Button
          type="button"
          size="sm"
          bg="teal.600"
          color="white"
          borderRadius={BC.controlRadius}
          fontSize="xs"
          leftIcon={<Check size={14} />}
          isDisabled={disabled || busy}
          _hover={{ bg: 'teal.500' }}
          onClick={() => void handleApprove()}
        >
          Approve
        </Button>
        {(preview?.draft || preview?.previousDraft) && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            borderColor="gray.600"
            color="gray.200"
            borderRadius={BC.controlRadius}
            fontSize="xs"
            leftIcon={<Pencil size={14} />}
            isDisabled={disabled || busy}
            _hover={{ bg: 'gray.800' }}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? 'Preview' : 'Edit'}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          borderColor="rose.500"
          color="rose.300"
          borderRadius={BC.controlRadius}
          fontSize="xs"
          leftIcon={<X size={14} />}
          isDisabled={disabled || busy}
          _hover={{ bg: 'whiteAlpha.100' }}
          onClick={() => void handleReject()}
        >
          Cancel
        </Button>
      </HStack>

      <Text mt={2} fontSize="10px" color="gray.600" fontFamily="mono">
        ID: {approvalId.slice(0, 8)}…
      </Text>
    </Box>
  );
}
