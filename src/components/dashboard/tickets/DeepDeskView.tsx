'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  IconButton,
  Select,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import {
  Loader2,
  Plus,
  MessageSquare,
  Clock,
  AlertCircle,
  CheckCircle,
  Search,
  Send,
  ArrowLeft,
  Bot,
  Activity,
  RefreshCw,
} from 'lucide-react';
import {
  ticketService,
  isSupportChannelTicket,
  type Ticket,
  type TicketComment,
  type TicketPriority,
  type TicketStatus,
  type TicketSource,
} from '@/services/ticketService';
import { draftTicketReply, summarizeTicket } from '@/services/bonnieCopilotService';
import toast from 'react-hot-toast';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { Input } from '@/components/ui/UIComponents';
import { EmptyState, EmptyStateFromPreset } from '@/components/ui/EmptyState';
import {
  StatusBadge,
  ticketPriorityVariant,
  ticketStatusVariant,
} from '@/components/ui/StatusBadge';
import { ModuleStatCards, type ModuleStat } from '../common/ModuleStatCards';
import { useTenant } from '@/contexts/TenantContext';
import { BonnieModulePageShell } from '../bonnie/BonnieModulePageShell';
import { AC } from '@/theme/chakraTheme';

const formatSla = (ticket: Ticket) => {
  if (!ticket.sla_due_at || ['resolved', 'closed'].includes(ticket.status)) return null;
  const remainingMs = new Date(ticket.sla_due_at).getTime() - Date.now();
  if (remainingMs <= 0) return { label: 'SLA breached', breached: true };
  const hours = Math.floor(remainingMs / 3_600_000);
  const minutes = Math.max(1, Math.ceil((remainingMs % 3_600_000) / 60_000));
  return {
    label: hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`,
    breached: false,
  };
};

export default function DeepDeskView() {
  const { currentTenant } = useTenant();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const [newComment, setNewComment] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<TicketPriority>('medium');
  const [newSource, setNewSource] = useState<TicketSource>('general');
  const [newSourceName, setNewSourceName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);

  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState('');

  const [fbLeadQuery, setFbLeadQuery] = useState('');
  const [fbLeadResults, setFbLeadResults] = useState<any[]>([]);
  const [fbGraphResults, setFbGraphResults] = useState<any[]>([]);
  const [searchingFbLeads, setSearchingFbLeads] = useState(false);
  const [showFbSearch, setShowFbSearch] = useState(false);

  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAllTickets();
  }, []);

  useEffect(() => {
    if (selectedTicket) {
      loadTicketComments(selectedTicket.id, selectedTicket);
    }
  }, [selectedTicket]);

  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

  const loadAllTickets = async () => {
    try {
      setLoading(true);
      const data = await ticketService.getAll({} as any);
      setTickets(data || []);
    } catch (error) {
      console.error('Failed to load tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const loadTicketComments = async (ticketId: string, ticketOverride?: Ticket) => {
    try {
      setCommentsLoading(true);
      const ticket = ticketOverride || tickets.find((t) => t.id === ticketId) || selectedTicket;
      if (ticket && isSupportChannelTicket(ticket)) {
        setComments(ticketService.buildSupportTicketThread(ticket));
        return;
      }
      const data = await ticketService.getComments(ticketId);
      setComments(data || []);
    } catch (error) {
      console.error('Failed to load comments:', error);
      toast.error('Failed to load conversation');
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) {
      toast.error('Title and description are required');
      return;
    }

    try {
      setCreatingTicket(true);
      const ticket = await ticketService.create({
        title: newTitle,
        description: newDescription,
        priority: newPriority,
        source: newSource,
        source_id: 'manual_' + Date.now(),
        source_name: newSourceName || 'Dashboard Agent',
        customerEmail: newCustomerEmail.trim() || undefined,
      });

      setTickets((prev) => [ticket, ...prev]);
      setSelectedTicket(ticket);
      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
      setNewPriority('medium');
      setNewSource('general');
      setNewSourceName('');
      setNewCustomerEmail('');
      toast.success(
        newCustomerEmail.trim()
          ? 'Ticket created — confirmation email sent'
          : 'Ticket created successfully'
      );
    } catch (error) {
      console.error('Failed to create ticket:', error);
      toast.error('Failed to create ticket');
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedTicket) return;

    if (isSupportChannelTicket(selectedTicket)) {
      toast.error('Replies for WhatsApp/API tickets are managed in the channel inbox');
      return;
    }

    try {
      const comment = await ticketService.addComment(
        selectedTicket.id,
        newComment,
        isInternalNote
      );
      setComments((prev) => [...prev, comment]);
      setNewComment('');
      toast.success(isInternalNote ? 'Internal note added' : 'Public reply sent');
    } catch (error) {
      console.error('Failed to add comment:', error);
      toast.error('Failed to submit response');
    }
  };

  const handleStatusChange = async (status: TicketStatus) => {
    if (!selectedTicket) return;
    const origin = isSupportChannelTicket(selectedTicket) ? 'support_tickets' : 'tickets';
    try {
      await ticketService.updateStatus(selectedTicket.id, status, origin);
      setTickets((prev) =>
        prev.map((t) => (t.id === selectedTicket.id ? { ...t, status } : t))
      );
      setSelectedTicket((prev) => (prev ? { ...prev, status } : null));
      toast.success(`Ticket status updated to ${status.replace('_', ' ')}`);
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    }
  };

  const handlePriorityChange = async (priority: TicketPriority) => {
    if (!selectedTicket) return;
    const origin = isSupportChannelTicket(selectedTicket) ? 'support_tickets' : 'tickets';
    try {
      await ticketService.updatePriority(selectedTicket.id, priority, origin);
      setTickets((prev) =>
        prev.map((t) => (t.id === selectedTicket.id ? { ...t, priority } : t))
      );
      setSelectedTicket((prev) => (prev ? { ...prev, priority } : null));
      toast.success(`Ticket priority set to ${priority}`);
    } catch (error) {
      console.error('Failed to update priority:', error);
      toast.error('Failed to update priority');
    }
  };

  const handleAIDraftReply = async () => {
    if (!selectedTicket || !currentTenant?.id) return;
    try {
      setAiGenerating(true);
      setAiResult('');

      const conversationSnippet = comments
        .slice(-5)
        .map(
          (c) =>
            `${c.is_internal ? '[Internal Note]' : '[Public]'} User(${c.user_id.slice(0, 8)}): ${c.content}`
        )
        .join('\n');

      const res = await draftTicketReply({
        tenantId: currentTenant.id,
        title: selectedTicket.title,
        description: selectedTicket.description || '',
        priority: selectedTicket.priority,
        conversationSnippet,
      });
      if (res.success && res.text) {
        setAiResult(res.text.trim());
      } else {
        toast.error(res.error || 'Failed to draft reply');
      }
    } catch (error) {
      console.error('AI generate error:', error);
      toast.error('AI Generation error');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAISummarize = async () => {
    if (!selectedTicket || !currentTenant?.id) return;
    try {
      setAiGenerating(true);
      setAiResult('');

      const conversationSnippet = comments
        .map(
          (c) =>
            `${c.is_internal ? '[Internal Note]' : '[Public]'} User(${c.user_id.slice(0, 8)}): ${c.content}`
        )
        .join('\n');

      const res = await summarizeTicket({
        tenantId: currentTenant.id,
        title: selectedTicket.title,
        description: selectedTicket.description || '',
        conversationSnippet,
      });
      if (res.success && res.text) {
        setAiResult(res.text.trim());
      } else {
        toast.error(res.error || 'Failed to summarize ticket');
      }
    } catch (error) {
      console.error('AI generate error:', error);
      toast.error('AI Generation error');
    } finally {
      setAiGenerating(false);
    }
  };

  const applyAIDraft = () => {
    if (aiResult) {
      setNewComment((prev) => (prev ? prev + '\n' + aiResult : aiResult));
      toast.success('Applied draft to editor');
    }
  };

  const handleFacebookLeadSearch = async () => {
    if (!currentTenant?.id) {
      toast.error('No active workspace');
      return;
    }
    setSearchingFbLeads(true);
    try {
      const res = await fetch(
        `/api/facebook/leads/search?tenantId=${encodeURIComponent(currentTenant.id)}&q=${encodeURIComponent(fbLeadQuery.trim())}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Search failed');
      setFbLeadResults(data.local || []);
      setFbGraphResults(data.graph || []);
      toast.success(`Found ${data.total || 0} Facebook lead(s)`);
    } catch (err: any) {
      toast.error(err.message || 'Facebook lead search failed');
    } finally {
      setSearchingFbLeads(false);
    }
  };

  const createTicketFromFbLead = (lead: any) => {
    const name =
      [lead.first_name, lead.last_name].filter(Boolean).join(' ') ||
      lead.company ||
      'Facebook Lead';
    setNewTitle(`Facebook lead: ${name}`);
    setNewDescription(
      [
        lead.email ? `Email: ${lead.email}` : null,
        lead.phone ? `Phone: ${lead.phone}` : null,
        lead.company ? `Company: ${lead.company}` : null,
        lead.campaign_name ? `Campaign: ${lead.campaign_name}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    );
    setNewSource('lead');
    setNewSourceName(`Facebook: ${name}`);
    setNewCustomerEmail(lead.email || '');
    setShowCreateModal(true);
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ticket.source_name &&
        ticket.source_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const ticketStats = useMemo<ModuleStat[]>(() => {
    const open = tickets.filter((t) => t.status === 'open').length;
    const inProgress = tickets.filter((t) => t.status === 'in_progress').length;
    const unresolved = tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed');
    const needsAttention = unresolved.filter(
      (t) => t.priority === 'high' || t.priority === 'urgent'
    ).length;
    const resolved = tickets.filter(
      (t) => t.status === 'resolved' || t.status === 'closed'
    ).length;
    const resolutionRate =
      tickets.length > 0 ? Math.round((resolved / tickets.length) * 100) : 0;
    return [
      {
        label: 'Open',
        value: open,
        sub: 'Awaiting first action',
        Icon: MessageSquare,
        accent: 'blue',
      },
      {
        label: 'In Progress',
        value: inProgress,
        sub: 'Being worked',
        Icon: Clock,
        accent: 'amber',
      },
      {
        label: 'Needs Attention',
        value: needsAttention,
        sub: 'High / urgent open',
        Icon: AlertCircle,
        accent: needsAttention > 0 ? 'rose' : 'emerald',
      },
      {
        label: 'Resolution Rate',
        value: `${resolutionRate}%`,
        sub: `${resolved} resolved`,
        Icon: CheckCircle,
        accent: 'teal',
      },
    ];
  }, [tickets]);

  const slaLive = selectedTicket ? formatSla(selectedTicket) : null;

  return (
    <BonnieModulePageShell>
      <Flex
        direction="column"
        minH={0}
        className="ac-scroll-full ac-enterprise-module"
        bg={AC.bg}
        color={AC.ink}
        borderWidth="1px"
        borderColor={AC.border}
        borderRadius={AC.radius}
        overflow="hidden"
      >
        <Flex
          direction={{ base: 'column', md: 'row' }}
          align={{ md: 'center' }}
          justify="space-between"
          p={4}
          borderBottomWidth="1px"
          borderColor={AC.border}
          bg="gray.900"
          gap={4}
          flexShrink={0}
        >
          <HStack spacing={3} minW={0}>
            <Flex
              align="center"
              justify="center"
              w={9}
              h={9}
              borderRadius={AC.control}
              bg="teal.900"
              color="teal.300"
              borderWidth="1px"
              borderColor="teal.700"
              flexShrink={0}
            >
              <Activity size={18} />
            </Flex>
            <Box minW={0}>
              <Heading size="sm" color="white" fontWeight="semibold" letterSpacing="-0.02em">
                Support desk
              </Heading>
              <Text fontSize="xs" color={AC.subtle}>
                Tickets, SLAs, and customer replies
              </Text>
            </Box>
          </HStack>

          <HStack spacing={2} flexWrap="wrap">
            <Button
              size="sm"
              bg={AC.tealSolid}
              color="white"
              borderRadius={AC.control}
              leftIcon={<Plus size={16} />}
              _hover={{ bg: 'teal.500' }}
              onClick={() => setShowCreateModal(true)}
            >
              Create ticket
            </Button>
            <IconButton
              aria-label="Reload tickets"
              size="sm"
              variant="outline"
              borderColor={AC.border}
              color={AC.muted}
              borderRadius={AC.control}
              icon={<RefreshCw size={16} />}
              onClick={loadAllTickets}
            />
          </HStack>
        </Flex>

        {!loading && tickets.length > 0 && (
          <Box p={4} borderBottomWidth="1px" borderColor={AC.border} flexShrink={0}>
            <ModuleStatCards stats={ticketStats} />
          </Box>
        )}

        <Flex flex={1} overflow="hidden" position="relative" minH={0}>
          {/* Ticket list */}
          <Flex
            direction="column"
            w={{ base: 'full', md: '320px' }}
            borderRightWidth="1px"
            borderColor={AC.border}
            bg={AC.bg}
            display={selectedTicket ? { base: 'none', md: 'flex' } : 'flex'}
            flexShrink={0}
          >
            <VStack align="stretch" spacing={3} p={3} borderBottomWidth="1px" borderColor={AC.border}>
              <Box position="relative">
                <Box position="absolute" left={3} top="10px" color="gray.500" pointerEvents="none">
                  <Search size={16} />
                </Box>
                <Input
                  type="text"
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="!pl-9 !rounded-md !bg-slate-900 !border-slate-700 !text-xs"
                />
              </Box>

              <Button
                type="button"
                variant="ghost"
                size="xs"
                justifyContent="flex-start"
                color="teal.400"
                fontWeight="semibold"
                px={0}
                onClick={() => setShowFbSearch((prev) => !prev)}
              >
                {showFbSearch ? 'Hide Facebook lead search' : 'Search Facebook leads'}
              </Button>

              {showFbSearch && (
                <VStack
                  align="stretch"
                  spacing={2}
                  p={2}
                  borderWidth="1px"
                  borderColor="teal.800"
                  bg="teal.950"
                  borderRadius={AC.control}
                >
                  <HStack>
                    <Input
                      type="text"
                      placeholder="Name, email, campaign..."
                      value={fbLeadQuery}
                      onChange={(e) => setFbLeadQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleFacebookLeadSearch()}
                      className="!text-xs !rounded-md"
                    />
                    <Button
                      size="sm"
                      bg={AC.tealSolid}
                      color="white"
                      isDisabled={searchingFbLeads}
                      onClick={handleFacebookLeadSearch}
                      borderRadius={AC.control}
                    >
                      {searchingFbLeads ? '…' : 'Find'}
                    </Button>
                  </HStack>
                  {[...fbLeadResults, ...fbGraphResults].slice(0, 5).map((lead, idx) => (
                    <Button
                      key={lead.id || lead.lead_id || idx}
                      type="button"
                      variant="outline"
                      h="auto"
                      py={2}
                      px={2}
                      borderColor={AC.border}
                      borderRadius={AC.control}
                      justifyContent="flex-start"
                      textAlign="left"
                      whiteSpace="normal"
                      onClick={() => createTicketFromFbLead(lead)}
                    >
                      <VStack align="start" spacing={0}>
                        <Text fontSize="xs" fontWeight="semibold" color="white" noOfLines={1}>
                          {[lead.first_name, lead.last_name].filter(Boolean).join(' ') ||
                            lead.full_name ||
                            lead.company ||
                            'Lead'}
                        </Text>
                        <Text fontSize="10px" color={AC.subtle} noOfLines={1}>
                          {lead.email || lead.phone || lead.campaign_name || 'Facebook'}
                        </Text>
                      </VStack>
                    </Button>
                  ))}
                </VStack>
              )}

              <HStack spacing={2} align="end">
                <Box flex={1}>
                  <Text fontSize="10px" fontWeight="semibold" color={AC.subtle} mb={1}>
                    Status
                  </Text>
                  <Select
                    size="sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    borderRadius={AC.control}
                  >
                    <option value="all">All statuses</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                    <option value="reopened">Reopened</option>
                  </Select>
                </Box>
                <Box flex={1}>
                  <Text fontSize="10px" fontWeight="semibold" color={AC.subtle} mb={1}>
                    Priority
                  </Text>
                  <Select
                    size="sm"
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value as any)}
                    borderRadius={AC.control}
                  >
                    <option value="all">All priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </Select>
                </Box>
              </HStack>
            </VStack>

            <Box flex={1} overflowY="auto" p={2}>
              {loading ? (
                <VStack py={12} color={AC.subtle} spacing={2}>
                  <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
                  <Text fontSize="xs">Loading tickets…</Text>
                </VStack>
              ) : tickets.length === 0 ? (
                <EmptyStateFromPreset
                  moduleId="tickets"
                  onAction={() => setShowCreateModal(true)}
                />
              ) : filteredTickets.length === 0 ? (
                <EmptyState
                  title="No tickets match"
                  description="Try clearing filters or searching a different phrase."
                  icon={MessageSquare}
                />
              ) : (
                <VStack align="stretch" spacing={1}>
                  {filteredTickets.map((t) => {
                    const isSelected = selectedTicket?.id === t.id;
                    const sla = formatSla(t);
                    return (
                      <Box
                        key={t.id}
                        as="button"
                        type="button"
                        textAlign="left"
                        p={3}
                        borderRadius={AC.control}
                        borderWidth="1px"
                        borderColor={isSelected ? 'teal.500' : 'transparent'}
                        bg={isSelected ? 'gray.900' : 'transparent'}
                        _hover={{ bg: 'whiteAlpha.50', borderColor: AC.border }}
                        onClick={() => setSelectedTicket(t)}
                      >
                        <Flex justify="space-between" align="center" mb={1.5} gap={2}>
                          <Text fontSize="10px" fontWeight="semibold" color={AC.subtle}>
                            #{t.id.slice(0, 8)}
                          </Text>
                          <StatusBadge variant={ticketStatusVariant(t.status)}>
                            {t.status.replace('_', ' ')}
                          </StatusBadge>
                        </Flex>
                        <Text fontSize="xs" fontWeight="semibold" color="white" noOfLines={1} mb={1}>
                          {t.title}
                        </Text>
                        <Text fontSize="11px" color={AC.muted} noOfLines={2} mb={2}>
                          {t.description}
                        </Text>
                        <Flex
                          justify="space-between"
                          align="center"
                          pt={2}
                          borderTopWidth="1px"
                          borderColor="whiteAlpha.100"
                          gap={2}
                        >
                          <StatusBadge variant={ticketPriorityVariant(t.priority)}>
                            {t.priority}
                          </StatusBadge>
                          {sla && (
                            <HStack
                              spacing={1}
                              fontSize="10px"
                              color={sla.breached ? 'rose.400' : 'amber.400'}
                            >
                              <Clock size={10} />
                              <Text as="span">{sla.label}</Text>
                            </HStack>
                          )}
                        </Flex>
                      </Box>
                    );
                  })}
                </VStack>
              )}
            </Box>
          </Flex>

          {/* Detail pane */}
          <Flex
            flex={1}
            direction="column"
            bg="gray.950"
            overflow="hidden"
            display={selectedTicket ? 'flex' : { base: 'none', md: 'flex' }}
            align={selectedTicket ? 'stretch' : 'center'}
            justify={selectedTicket ? 'flex-start' : 'center'}
          >
            {selectedTicket ? (
              <Flex flex={1} direction="column" overflow="hidden" minH={0}>
                <Flex
                  align="center"
                  justify="space-between"
                  p={4}
                  borderBottomWidth="1px"
                  borderColor={AC.border}
                  gap={4}
                  flexShrink={0}
                >
                  <HStack spacing={3} minW={0}>
                    <IconButton
                      aria-label="Back to list"
                      display={{ base: 'inline-flex', md: 'none' }}
                      size="sm"
                      variant="ghost"
                      borderRadius={AC.control}
                      icon={<ArrowLeft size={16} />}
                      onClick={() => setSelectedTicket(null)}
                    />
                    <Box minW={0}>
                      <HStack spacing={2} mb={1}>
                        <Text fontSize="xs" fontWeight="semibold" color="teal.400">
                          Ticket
                        </Text>
                        <Text fontSize="xs" color={AC.subtle} fontFamily="mono" noOfLines={1}>
                          #{selectedTicket.id.slice(0, 8)}
                        </Text>
                      </HStack>
                      <Heading size="xs" color="white" noOfLines={1} fontWeight="semibold">
                        {selectedTicket.title}
                      </Heading>
                      {selectedTicket.metadata?.customerEmail ? (
                        <Text fontSize="xs" color="teal.400" mt={0.5}>
                          Email updates → {String(selectedTicket.metadata.customerEmail)}
                        </Text>
                      ) : null}
                    </Box>
                  </HStack>

                  <Select
                    size="sm"
                    w="auto"
                    minW="140px"
                    value={selectedTicket.status}
                    onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                    borderRadius={AC.control}
                    flexShrink={0}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                    <option value="reopened">Reopened</option>
                  </Select>
                </Flex>

                <Flex flex={1} overflow="hidden" minH={0}>
                  <Flex flex={1} direction="column" overflow="hidden" minW={0}>
                    <Box flex={1} overflowY="auto" p={4}>
                      <VStack align="stretch" spacing={3}>
                        <Box
                          bg="gray.900"
                          borderRadius={AC.radius}
                          p={4}
                          borderWidth="1px"
                          borderColor={AC.border}
                        >
                          <Flex justify="space-between" align="center" mb={2} gap={2}>
                            <HStack spacing={2}>
                              <Flex
                                w={7}
                                h={7}
                                borderRadius="full"
                                bg="gray.800"
                                align="center"
                                justify="center"
                                fontSize="xs"
                                fontWeight="bold"
                                color="gray.300"
                                borderWidth="1px"
                                borderColor="gray.700"
                              >
                                {selectedTicket.source_name
                                  ? selectedTicket.source_name.charAt(0).toUpperCase()
                                  : 'U'}
                              </Flex>
                              <Box>
                                <Text fontSize="xs" fontWeight="semibold" color="white">
                                  {selectedTicket.source_name || 'Client'}
                                </Text>
                                <Text fontSize="10px" color={AC.subtle}>
                                  Submitted via {selectedTicket.source}
                                </Text>
                              </Box>
                            </HStack>
                            <Text fontSize="10px" color={AC.subtle}>
                              {new Date(selectedTicket.created_at).toLocaleString()}
                            </Text>
                          </Flex>
                          <Text fontSize="xs" color="gray.200" whiteSpace="pre-wrap" lineHeight="tall">
                            {selectedTicket.description}
                          </Text>
                        </Box>

                        {commentsLoading ? (
                          <Flex justify="center" py={6}>
                            <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
                          </Flex>
                        ) : (
                          comments.map((c) => {
                            const isInternal = c.is_internal;
                            return (
                              <Box
                                key={c.id}
                                borderRadius={AC.radius}
                                p={4}
                                borderWidth="1px"
                                borderColor={isInternal ? 'amber.700' : AC.border}
                                bg={isInternal ? 'blackAlpha.400' : 'gray.900'}
                              >
                                <Flex justify="space-between" mb={2} gap={2}>
                                  <HStack spacing={2}>
                                    <Text fontSize="xs" fontWeight="semibold" color="white">
                                      User ({c.user_id?.slice(0, 8) || 'Agent'})
                                    </Text>
                                    {isInternal ? (
                                      <StatusBadge variant="warning">Internal note</StatusBadge>
                                    ) : null}
                                  </HStack>
                                  <Text fontSize="10px" color={AC.subtle}>
                                    {new Date(c.created_at).toLocaleString()}
                                  </Text>
                                </Flex>
                                <Text fontSize="xs" color="gray.300" whiteSpace="pre-wrap">
                                  {c.content}
                                </Text>
                              </Box>
                            );
                          })
                        )}
                        <div ref={commentsEndRef} />
                      </VStack>
                    </Box>

                    <Box p={4} borderTopWidth="1px" borderColor={AC.border} flexShrink={0}>
                      <form onSubmit={handleAddComment}>
                        <VStack align="stretch" spacing={3}>
                          <Flex justify="space-between" align="center" gap={2} flexWrap="wrap">
                            <HStack
                              spacing={0}
                              bg="gray.900"
                              p={0.5}
                              borderRadius={AC.control}
                              borderWidth="1px"
                              borderColor={AC.border}
                            >
                              <Button
                                type="button"
                                size="xs"
                                borderRadius="sm"
                                bg={!isInternalNote ? AC.tealSolid : 'transparent'}
                                color={!isInternalNote ? 'white' : AC.muted}
                                onClick={() => setIsInternalNote(false)}
                              >
                                Public reply
                              </Button>
                              <Button
                                type="button"
                                size="xs"
                                borderRadius="sm"
                                bg={isInternalNote ? 'amber.600' : 'transparent'}
                                color={isInternalNote ? 'white' : AC.muted}
                                onClick={() => setIsInternalNote(true)}
                              >
                                Internal note
                              </Button>
                            </HStack>

                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              borderColor="teal.700"
                              color="teal.300"
                              borderRadius={AC.control}
                              leftIcon={<Bot size={12} />}
                              onClick={handleAIDraftReply}
                              isDisabled={aiGenerating}
                            >
                              Draft reply
                            </Button>
                          </Flex>

                          {aiGenerating && (
                            <HStack
                              p={3}
                              bg="gray.900"
                              borderWidth="1px"
                              borderColor="teal.800"
                              borderRadius={AC.control}
                              spacing={2}
                            >
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
                              <Text fontSize="xs" color="teal.300">
                                Drafting reply…
                              </Text>
                            </HStack>
                          )}

                          {aiResult && !aiGenerating && (
                            <Box
                              p={3}
                              bg="teal.950"
                              borderWidth="1px"
                              borderColor="teal.800"
                              borderRadius={AC.control}
                            >
                              <Flex justify="space-between" mb={2} gap={2}>
                                <HStack spacing={1} color="teal.300">
                                  <Bot size={14} />
                                  <Text fontSize="10px" fontWeight="semibold">
                                    Suggested draft
                                  </Text>
                                </HStack>
                                <HStack spacing={2}>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="ghost"
                                    color={AC.subtle}
                                    onClick={() => setAiResult('')}
                                  >
                                    Dismiss
                                  </Button>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="ghost"
                                    color="teal.300"
                                    onClick={applyAIDraft}
                                  >
                                    Insert draft
                                  </Button>
                                </HStack>
                              </Flex>
                              <Text fontSize="xs" color="gray.300" noOfLines={3}>
                                {aiResult}
                              </Text>
                            </Box>
                          )}

                          <Box position="relative">
                            <Textarea
                              rows={3}
                              placeholder={
                                isInternalNote
                                  ? 'Internal note visible only to agents…'
                                  : 'Reply to the customer…'
                              }
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              borderRadius={AC.control}
                              fontSize="xs"
                              pr={12}
                              resize="none"
                            />
                            <IconButton
                              type="submit"
                              aria-label="Send"
                              position="absolute"
                              right={2}
                              bottom={2}
                              size="sm"
                              bg={AC.tealSolid}
                              color="white"
                              borderRadius={AC.control}
                              icon={<Send size={14} />}
                              isDisabled={!newComment.trim()}
                              _hover={{ bg: 'teal.500' }}
                            />
                          </Box>
                        </VStack>
                      </form>
                    </Box>
                  </Flex>

                  <VStack
                    display={{ base: 'none', lg: 'flex' }}
                    w="256px"
                    align="stretch"
                    spacing={4}
                    borderLeftWidth="1px"
                    borderColor={AC.border}
                    bg={AC.bg}
                    p={4}
                    overflowY="auto"
                    flexShrink={0}
                  >
                    <Text fontSize="11px" fontWeight="semibold" color={AC.subtle} textTransform="uppercase" letterSpacing="0.06em">
                      Properties
                    </Text>

                    <Box>
                      <Text fontSize="10px" fontWeight="semibold" color={AC.subtle} mb={1}>
                        Priority
                      </Text>
                      <Select
                        size="sm"
                        value={selectedTicket.priority}
                        onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
                        borderRadius={AC.control}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </Select>
                    </Box>

                    <Box>
                      <Text fontSize="10px" fontWeight="semibold" color={AC.subtle} mb={1}>
                        Source
                      </Text>
                      <Box
                        px={3}
                        py={2}
                        bg="gray.900"
                        borderWidth="1px"
                        borderColor={AC.border}
                        borderRadius={AC.control}
                      >
                        <Text fontSize="xs" fontWeight="semibold" color="white" textTransform="capitalize">
                          {selectedTicket.source}
                        </Text>
                        <Text fontSize="10px" color={AC.subtle}>
                          {selectedTicket.source_name || 'N/A'}
                        </Text>
                      </Box>
                    </Box>

                    <Box>
                      <Text fontSize="10px" fontWeight="semibold" color={AC.subtle} mb={1}>
                        Created
                      </Text>
                      <Box
                        px={3}
                        py={2}
                        bg="gray.900"
                        borderWidth="1px"
                        borderColor={AC.border}
                        borderRadius={AC.control}
                        fontSize="xs"
                        color={AC.muted}
                      >
                        {new Date(selectedTicket.created_at).toLocaleString()}
                      </Box>
                    </Box>

                    <Box
                      p={3}
                      borderWidth="1px"
                      borderColor={slaLive?.breached ? 'rose.700' : 'amber.800'}
                      bg={slaLive?.breached ? 'rose.950' : 'blackAlpha.400'}
                      borderRadius={AC.control}
                    >
                      <HStack spacing={1} mb={1} color={slaLive?.breached ? 'rose.300' : 'amber.300'}>
                        <Clock size={14} />
                        <Text fontSize="xs" fontWeight="semibold">
                          {slaLive ? slaLive.label : 'SLA tracking'}
                        </Text>
                      </HStack>
                      <Text fontSize="11px" color={AC.muted}>
                        {selectedTicket.sla_due_at
                          ? `Due ${new Date(selectedTicket.sla_due_at).toLocaleString()}`
                          : 'No SLA deadline set on this ticket.'}
                      </Text>
                    </Box>

                    <Box pt={2} borderTopWidth="1px" borderColor={AC.border}>
                      <Text fontSize="10px" fontWeight="semibold" color={AC.subtle} mb={2}>
                        Assist
                      </Text>
                      <Button
                        type="button"
                        w="full"
                        size="sm"
                        variant="outline"
                        borderColor="teal.700"
                        color="teal.300"
                        borderRadius={AC.control}
                        leftIcon={<Bot size={14} />}
                        onClick={handleAISummarize}
                        isDisabled={aiGenerating}
                      >
                        Summarize ticket
                      </Button>
                    </Box>
                  </VStack>
                </Flex>
              </Flex>
            ) : (
              <EmptyState
                title="Select a ticket"
                description="Choose a ticket from the list or create a new one to start working."
                icon={MessageSquare}
                actionLabel="Create ticket"
                onAction={() => setShowCreateModal(true)}
              />
            )}
          </Flex>
        </Flex>

        <DetailDrawer
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          title="Create support ticket"
          size="wide"
        >
          <form onSubmit={handleCreateTicket} className="space-y-4 pt-2">
            <Input
              label="Ticket title"
              type="text"
              placeholder="Enter a descriptive issue title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              validate={(v) => (!v.trim() ? 'Ticket title is required' : undefined)}
            />

            <Box>
              <Text fontSize="xs" fontWeight="semibold" color={AC.muted} mb={1}>
                Description
              </Text>
              <Textarea
                required
                rows={4}
                placeholder="Detail the issue or request…"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                borderRadius={AC.control}
                fontSize="xs"
                resize="none"
              />
            </Box>

            <HStack spacing={4} align="start">
              <Box flex={1}>
                <Text fontSize="xs" fontWeight="semibold" color={AC.muted} mb={1}>
                  Priority
                </Text>
                <Select
                  size="sm"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as TicketPriority)}
                  borderRadius={AC.control}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </Box>
              <Box flex={1}>
                <Text fontSize="xs" fontWeight="semibold" color={AC.muted} mb={1}>
                  Source
                </Text>
                <Select
                  size="sm"
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value as TicketSource)}
                  borderRadius={AC.control}
                >
                  <option value="general">General</option>
                  <option value="lead">Lead</option>
                  <option value="client">Client</option>
                  <option value="project">Project</option>
                  <option value="contract">Contract</option>
                </Select>
              </Box>
            </HStack>

            <Input
              label="Client / lead name"
              type="text"
              placeholder="e.g. John Doe"
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
            />

            <Box>
              <Input
                label="Customer email (for updates)"
                type="email"
                placeholder="customer@example.com"
                value={newCustomerEmail}
                onChange={(e) => setNewCustomerEmail(e.target.value)}
              />
              <Text fontSize="10px" color={AC.subtle} mt={1}>
                Sends confirmation, status changes, and public replies to this address.
              </Text>
            </Box>

            <HStack justify="flex-end" spacing={2} pt={2}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                borderRadius={AC.control}
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                bg={AC.tealSolid}
                color="white"
                borderRadius={AC.control}
                isDisabled={creatingTicket}
                leftIcon={
                  creatingTicket ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined
                }
                _hover={{ bg: 'teal.500' }}
              >
                Create ticket
              </Button>
            </HStack>
          </form>
        </DetailDrawer>
      </Flex>
    </BonnieModulePageShell>
  );
}
