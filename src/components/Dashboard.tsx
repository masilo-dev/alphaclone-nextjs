'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ConnectionStatus } from './ConnectionStatus';
import CustomContextMenu from './common/CustomContextMenu';
import {
  Plus, Search, Filter, Settings, Bell, LogOut, ChevronRight,
  MessageSquare, Calendar, FileText, PieChart, Users,
  Briefcase, CheckCircle2, Clock, AlertCircle, Menu, X,
  Globe, Layout, Smartphone, Mail, Phone, MapPin,
  Shield, CreditCard, Wallet, Zap, Brain, Rocket,
  Sparkles, Star, Target, TrendingUp, BarChart3,
  ChevronDown, ArrowRight, Download, Share2, Trash2,
  Copy, Edit, Trash, Eye, MoreVertical, LayoutGrid,
  List, RefreshCw, Cpu, Layers, Code, ShieldCheck,
  Edit2, ListChecks, FileCheck, Video, DollarSign, User as UserIcon
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import MilestoneManager from './dashboard/projects/MilestoneManager';
import { Button, Card, Input, Modal } from './ui/UIComponents';
import { CLIENT_NAV_ITEMS, ADMIN_NAV_ITEMS, TENANT_ADMIN_NAV_ITEMS, LOGO_URL } from '../constants';
import { User, Project, ChatMessage, DashboardStat, GalleryItem, Invoice, ProjectStage, UserRole } from '../types';
import BusinessDashboard from './dashboard/business/BusinessDashboard';
import { useTenant } from '../contexts/TenantContext';

import AIStudio from './dashboard/AIStudio';
import NotificationCenter from './dashboard/NotificationCenter';
import ThemeToggle from './ThemeToggle';
import EnhancedGlobalSearch from './dashboard/EnhancedGlobalSearch';
import Sidebar from './dashboard/Sidebar';
import BottomNav from './dashboard/BottomNav';
import CommandPalette from './dashboard/CommandPalette';
import HomeTab from './dashboard/HomeTab';
import ProjectSubmitTab from './dashboard/ProjectSubmitTab';
import ExitIntentModal from './ExitIntentModal';
import IncomingCallModal from './dashboard/video/IncomingCallModal';
import { generateContract as generateContractAI, generateArchitectSpecs } from '../services/geminiService';
interface ArchitectData {
  techStack: string;
  developmentPrompt: string;
  architectureDiagram: string;
}


const generateContract = async (clientName: string, projectName: string): Promise<string> => {
  return await generateContractAI(clientName, projectName, 0);
};
import { useBackgroundTasks } from '../contexts/BackgroundTaskContext';
// Consolidated notification service
import { notificationService, Notification } from '../services/dashboardService';
import { projectService } from '../services/projectService';
import { messageService } from '../services/messageService';
import { paymentService } from '../services/paymentService';
import { userService } from '../services/userService';
import SecurityDashboard from './dashboard/SecurityDashboard';
import ContractDashboard from './contracts/ContractDashboard';
import AlphaCloneContractModal from './contracts/AlphaCloneContractModal';
import SettingsPage from './dashboard/SettingsPage';
import OnboardingPipelines from './dashboard/OnboardingPipelines';
import PortfolioShowcase from './dashboard/PortfolioShowcase';
import SalesAgent from './dashboard/SalesAgent';
import WelcomeModal from './dashboard/WelcomeModal';
import OnboardingFlow from './onboarding/OnboardingFlow';
import CreateInvoiceModal from './dashboard/CreateInvoiceModal';
import { WidgetErrorBoundary } from './dashboard/WidgetErrorBoundary';
import ResourceAllocationView from '@/components/dashboard/ResourceAllocationView';
import { useOverdueTaskNotifier } from '../hooks/useOverdueTaskNotifier';
import { DeletionOverlay } from './dashboard/DeletionOverlay';
import PullToRefresh from './common/PullToRefresh';

const ConferenceTab = React.lazy(() => import('./dashboard/ConferenceTab'));
const AnalyticsTab = React.lazy(() => import('./dashboard/AnalyticsTab'));
const CRMTab = React.lazy(() => import('./dashboard/CRMTab'));
const MessagesTab = React.lazy(() => import('./dashboard/MessagesTab'));
const FinanceTab = React.lazy(() => import('./dashboard/FinanceTab'));
const ArticleEditor = React.lazy(() => import('./dashboard/ArticleEditor'));
const CalendarComponent = React.lazy(() => import('./dashboard/CalendarComponent'));
const SuperAdminTenantsTab = React.lazy(() => import('./dashboard/admin/SuperAdminTenantsTab'));
const SuperAdminUsersTab = React.lazy(() => import('./dashboard/admin/SuperAdminUsersTab'));
const ImprovementsPage = React.lazy(() => import('./dashboard/admin/ImprovementsPage'));
const ContactSubmissionsTab = React.lazy(() => import('./dashboard/ContactSubmissionsTab'));
const TasksTab = React.lazy(() => import('./dashboard/TasksTab'));
const DealsTab = React.lazy(() => import('./dashboard/DealsTab'));
const QuotesTab = React.lazy(() => import('./dashboard/QuotesTab'));
const SalesForecastTab = React.lazy(() => import('./dashboard/SalesForecastTab'));
const UserLocationTable = React.lazy(() => import('./dashboard/admin/UserLocationTable'));
const MailTab = React.lazy(() => import('./dashboard/MailTab'));

const CustomVideoRoom = React.lazy(() => import('./dashboard/video/CustomVideoRoom'));

// Import UI components
import { TableSkeleton } from './ui/Skeleton';
import { TabSkeleton } from './ui/TabSkeleton';
import { EmptyState } from './ui/EmptyState';

interface DashboardProps {
  user: User;
  onLogout: () => void;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  galleryItems: GalleryItem[];
  setGalleryItems: React.Dispatch<React.SetStateAction<GalleryItem[]>>;
}

// Mock Invoices Removed

const STAGES: ProjectStage[] = ['Initiation', 'Planning', 'Execution', 'Review', 'Closure'];

const Dashboard: React.FC<DashboardProps> = ({
  user,
  onLogout,
  projects,
  setProjects,
  messages,
  setMessages,
  galleryItems,
  setGalleryItems
}) => {
  const location = usePathname();
  const router = useRouter();
  const { currentTenant, getDashboardStats, error: tenantError } = useTenant();
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  // Prevent duplicate data loads when TenantContext resolves after initial render
  const dataLoadedRef = useRef(false);
  const lastTenantIdRef = useRef<string | undefined>(undefined);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Initialize recurring overdue task notifications
  useOverdueTaskNotifier(user);

  // Sync sidebar on mount to avoid hydration mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSidebarOpen(window.innerWidth >= 1024);
    }
  }, []);
  const [activeTab, setActiveTab] = useState(location || '/dashboard');

  // -- PERSISTENT VIDEO CALL STATE --
  // Note: Video calls now use dedicated pages (/meet/[id])

  // Auto-hide sidebar on specific views or states
  useEffect(() => {
    // Only force hide on initial load of conference, otherwise respect user/nav state
    const hiddenRoutes = ['/dashboard/conference'];
    if (hiddenRoutes.includes(activeTab)) {
      setSidebarOpen(false);
    }
  }, [activeTab]);

  const handleJoinCall = (callId: string) => {
    router.push(`/meet/${callId}`);
  };


  // Sync activeTab with URL changes
  useEffect(() => {
    // location is a string in Next.js usePathname
    if (location?.startsWith('/dashboard')) {
      setActiveTab(location);
    }
  }, [location]);
  const [invoices, setInvoices] = useState<Invoice[]>([]); // Initialize empty
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [projectViewMode, setProjectViewMode] = useState<'grid' | 'list'>('list');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'paypal'>('card');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Global Command Palette Hotkey (/)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Onboarding Flow (show only once per user)
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [totalClientCount, setTotalClientCount] = useState<number>(0);

  // Welcome Modal (show only once per user)
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && user?.id) {
      setWelcomeOpen(!localStorage.getItem(`welcome_seen_${user.id}`));
      setShowOnboarding(!localStorage.getItem(`onboarding_completed_${user.id}`));
    }
  }, [user.id]);

  // Admin Tool States
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [generatedContract, setGeneratedContract] = useState('');
  const [isGeneratingContract, setIsGeneratingContract] = useState(false);

  const [architectModalOpen, setArchitectModalOpen] = useState(false);
  const [architectData, setArchitectData] = useState<ArchitectData | null>(null);
  const [isArchitecting, setIsArchitecting] = useState(false);
  const [selectedProjectForTool, setSelectedProjectForTool] = useState<Project | null>(null);

  // Milestone Management
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [selectedProjectForMilestones, setSelectedProjectForMilestones] = useState<Project | null>(null);

  const { tasks: bgTasks } = useBackgroundTasks();
  const activeBgTasksCount = bgTasks.filter(t => t.status === 'running').length;

  // -- ISOLATION LOGIC --
  // Super Admin: sees ALL data across ALL tenants
  // Tenant Admin: sees all data within their tenant
  // Client: sees only their own data
  const filteredProjects = useMemo(() => user.role === 'admin'
    ? projects // Super Admin sees everything
    : projects.filter(p => p.ownerId === user.id), [user.id, user.role, projects]);

  const filteredMessages = useMemo(() => user.role === 'admin'
    ? messages // Super Admin sees everything
    : messages.filter(m => m.senderId === user.id || m.recipientId === user.id), [user.id, user.role, messages]);

  const filteredInvoices = useMemo(() => (user.role as UserRole) === 'admin' || (user.role as UserRole) === 'tenant_admin'
    ? invoices // Admin sees all (cross-tenant), tenant_admin sees tenant-scoped (from service)
    : invoices.filter(i => i.clientId === user.id), [user.id, user.role, invoices]);

  // Stats Logic
  // Stats Logic - REAL DATA ONLY (No Placeholders)
  const projectDays = useMemo(() => {
    if (filteredProjects.length === 0) return 0;
    const oldest = Math.min(...filteredProjects.map(p => new Date(p.createdAt || Date.now()).getTime()));
    return Math.floor((Date.now() - oldest) / (1000 * 60 * 60 * 24));
  }, [filteredProjects]);

  const currentStats: DashboardStat[] = useMemo(() => user.role === 'admin' ? [
    {
      label: 'Total Clients',
      value: (dashboardStats?.clientCount || totalClientCount).toString(),
      icon: Users,
      color: 'bg-indigo-600'
    },
    {
      label: 'Active Projects',
      value: (dashboardStats?.activeProjects || projects.filter(p => p.status === 'Active').length).toString(),
      icon: Briefcase,
      color: 'bg-teal-600'
    },
    {
      label: 'Total Revenue',
      value: `$${(dashboardStats?.totalRevenue || invoices.filter(i => i.status === 'Paid').reduce((acc: number, curr: Invoice) => acc + curr.amount, 0)).toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-green-600'
    },
    {
      label: 'Pending Requests',
      value: (projects.filter(p => p.status === 'Pending').length).toString(),
      icon: AlertCircle,
      color: 'bg-orange-600'
    },
  ] : [
    {
      label: 'My Projects',
      value: (filteredProjects.length).toString(),
      icon: Briefcase,
      color: 'bg-teal-600'
    },
    {
      label: 'Messages',
      value: (dashboardStats?.totalMessages || filteredMessages.length).toString(),
      icon: UserIcon,
      color: 'bg-blue-600'
    },
    {
      label: 'Due Invoices',
      value: `$${(dashboardStats?.pendingRevenue || filteredInvoices.filter(i => i.status === 'Unpaid').reduce((acc: number, curr: Invoice) => acc + curr.amount, 0)).toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-yellow-600'
    },
    {
      label: 'Project Days',
      value: projectDays.toString(),
      icon: Clock,
      color: 'bg-purple-600'
    }
  ], [user.role, user.id, dashboardStats, totalClientCount, projects, invoices, filteredProjects, filteredMessages, filteredInvoices, projectDays]);

  // Forms State
  const [newProject, setNewProject] = useState({ name: '', category: '', description: '', image: '' });
  const [newMessage, setNewMessage] = useState('');

  // -- EDIT PROJECT STATE --
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState<Partial<Project>>({});

  // Determine Navigation Items based on Role
  const NAV_ITEMS = React.useMemo(() => {
    if (user.role === 'admin') return ADMIN_NAV_ITEMS;
    if (user.role === 'tenant_admin') return TENANT_ADMIN_NAV_ITEMS;
    return CLIENT_NAV_ITEMS;
  }, [user.role]);

  // Calculate unread message count
  const unreadMessageCount = filteredMessages.filter(m =>
    m.senderId !== user.id && !m.readAt
  ).length;

  // Fetch projects function
  const refreshProjects = useCallback(async () => {
    console.log('[Dashboard] Refreshing projects for user:', user.id);
    // Only show loading if no projects (initial load or empty)
    if (projects.length === 0) setIsLoadingProjects(true);

    try {
      const { projects: fetchedProjects, error } = await projectService.getProjects(user.id, user.role);
      if (error) {
        console.error('[Dashboard] Project fetch error:', error);
        toast.error('Failed to load projects');
      } else if (fetchedProjects) {
        console.log('[Dashboard] Projects loaded:', fetchedProjects.length);
        setProjects(fetchedProjects);
        localStorage.setItem(`dashboard_projects_${user.id}`, JSON.stringify(fetchedProjects));
      }
    } catch (err) {
      console.error('[Dashboard] Unexpected project fetch error:', err);
    } finally {
      setIsLoadingProjects(false);
    }
  }, [user.id, user.role, projects.length, setProjects]);

  // Fetch invoices function
  const refreshInvoices = useCallback(async () => {
    console.log('[Dashboard] Refreshing invoices for user:', user.id);
    try {
      let result;
      // Client/TenantAdmin fetches all invoices relevant to their tenant/business view
      if (user.role === 'admin' || user.role === 'tenant_admin') {
        result = await paymentService.getAllInvoices(user.role); // Pass role for filtering
      } else {
        result = await paymentService.getUserInvoices(user.id);
      }

      if (result.error) {
        console.error('[Dashboard] Invoice fetch error:', result.error);
        toast.error('Failed to load invoices');
      } else if (result.invoices) {
        console.log('[Dashboard] Invoices loaded:', result.invoices.length);
        // Map to UI Invoice type
        const mappedInvoices = result.invoices.map((inv: any) => ({
          id: inv.id,
          projectId: inv.project_id || '',
          projectName: inv.project?.name || 'General Service',
          clientId: inv.user_id,
          amount: inv.amount,
          status: inv.status === 'paid' ? 'Paid' : (new Date(inv.due_date) < new Date() ? 'Overdue' : 'Unpaid'),
          dueDate: new Date(inv.due_date).toLocaleDateString(),
          description: inv.description
        })) as Invoice[];
        setInvoices(mappedInvoices);
        localStorage.setItem(`dashboard_invoices_${user.id}`, JSON.stringify(mappedInvoices));
      }
    } catch (err) {
      console.error('[Dashboard] Unexpected invoice fetch error:', err);
    }
  }, [user.id, user.role, setInvoices]);

  // OPTIMIZED: Load core data ONCE on mount (projects, invoices, messages)
  useEffect(() => {
    if (dataLoadedRef.current) return; // prevent double-fire in StrictMode/dev
    dataLoadedRef.current = true;

    // 1. Restore from cache immediately for instant UI
    try {
      const cachedProjects = localStorage.getItem(`dashboard_projects_${user.id}`);
      if (cachedProjects) setProjects(JSON.parse(cachedProjects));

      const cachedInvoices = localStorage.getItem(`dashboard_invoices_${user.id}`);
      if (cachedInvoices) setInvoices(JSON.parse(cachedInvoices));

      const cachedMessages = localStorage.getItem(`dashboard_messages_${user.id}`);
      if (cachedMessages) setMessages(JSON.parse(cachedMessages));
    } catch (e) { console.error('Cache load error', e); }

    const loadAllData = async () => {
      const isAdmin = user.role === 'admin' || user.role === 'tenant_admin';

      const promises: Promise<any>[] = [
        refreshProjects(),
        refreshInvoices(),
        messageService.getMessages(user.id, isAdmin, 10).then(({ messages: fetchedMessages, error }) => {
          if (!error && fetchedMessages) {
            setMessages(fetchedMessages);
            localStorage.setItem(`dashboard_messages_${user.id}`, JSON.stringify(fetchedMessages));
          }
        })
      ];

      if (user.role === 'admin') {
        promises.push(userService.getUsers().then(({ users, error }) => {
          if (!error && users) {
            const count = users.filter(u => u.role === 'client').length;
            setTotalClientCount(count);
          }
        }));
      }

      await Promise.all(promises);
    };

    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]); // Only re-run if user changes (not on every tenant update)

  // Load dashboard stats separately — re-runs only when tenant ID changes
  useEffect(() => {
    if (!currentTenant?.id) return;
    if (lastTenantIdRef.current === currentTenant.id) return; // already loaded for this tenant
    lastTenantIdRef.current = currentTenant.id;

    getDashboardStats(currentTenant.id).then(({ stats }) => {
      if (stats) setDashboardStats(stats);
    }).catch(() => { /* stats are non-critical */ });
  }, [currentTenant?.id]);

  // PRELOAD: Prefetch the most-visited lazy tabs sequentially in the background after mount
  // so they're already downloaded when the user clicks them (eliminates Suspense delay)
  useEffect(() => {
    const preloadTabs = async () => {
      const tabs = [
        () => import('./dashboard/CRMTab'),
        () => import('./dashboard/FinanceTab'),
        () => import('./dashboard/TasksTab'),
        () => import('./dashboard/QuotesTab'),
        () => import('./dashboard/DealsTab'),
        () => import('./dashboard/AnalyticsTab')
      ];

      for (const preloader of tabs) {
        // Wait for idle or small delay before next chunk
        if ('requestIdleCallback' in window) {
          await new Promise(resolve => requestIdleCallback(() => resolve(null), { timeout: 2000 }));
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        preloader().catch(() => { }); // Fire and forget
      }
    };

    // Defer the start of preloading until 3s after mount
    const timer = setTimeout(preloadTabs, 3000);
    return () => clearTimeout(timer);
  }, []); // Only run once on mount


  // Use ref for activeTab to avoid breaking message subscription on tab change
  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Subscribe to real-time messages with filtering for performance
  useEffect(() => {
    const isAdmin = user.role === 'admin' || user.role === 'tenant_admin';
    // ✅ Now uses filtered subscription - gets INSERT + UPDATE for instant read receipts
    const unsubscribe = messageService.subscribeToMessages(
      user.id,
      isAdmin,
      (newMessage, eventType) => {
        setMessages(prev => {
          if (eventType === 'INSERT') {
            // Deduplicate based on ID for new messages
            if (prev.some(m => m.id === newMessage.id)) return prev;

            // Notification Logic
            if (newMessage.senderId !== user.id && activeTabRef.current !== '/dashboard/messages') {
              import('react-hot-toast').then(({ toast }) => {
                toast.success(`New message from ${newMessage.senderName}`, {
                  duration: 4000,
                  position: 'top-right'
                });
              });
              // Increment unread count (simple memory-based for now)
              // setUnreadCount(prev => prev + 1); // If we had this state
            }

            return [...prev, newMessage];
          } else if (eventType === 'UPDATE') {
            // Update existing message (for read receipts, delivered status, etc.)
            return prev.map((m: ChatMessage) => m.id === newMessage.id ? newMessage : m);
          }
          return prev;
        });
      }
    );
    return () => unsubscribe();
  }, [user.id, user.role]);

  // Log Navigation - DEFERRED: Don't block dashboard render
  useEffect(() => {
    // Use requestIdleCallback to defer non-critical activity logging
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        import('../services/activityService').then(({ activityService }) => {
          activityService.logNavigation(user.id, activeTab);
        });
      }, { timeout: 2000 });
    } else {
      setTimeout(() => {
        import('../services/activityService').then(({ activityService }) => {
          activityService.logNavigation(user.id, activeTab);
        });
      }, 100);
    }
  }, [activeTab, user.id]);

  // Subscribe to real-time projects
  useEffect(() => {
    const unsubscribe = projectService.subscribeToProjects((updatedProject) => {
      setProjects(prev => {
        const exists = prev.find(p => p.id === updatedProject.id);
        if (exists) {
          return prev.map((p: Project) => p.id === updatedProject.id ? updatedProject : p);
        } else {
          return [updatedProject, ...prev];
        }
      });
    });
    return () => unsubscribe();
  }, []);

  const handleAddProject = async () => {
    if (!newProject.name) {
      alert('Please enter a project name');
      return;
    }

    try {
      const projectData = {
        ownerId: user.id,
        ownerName: user.name,
        name: newProject.name,
        category: newProject.category || 'Custom Request',
        status: 'Pending' as const,
        currentStage: 'Initiation' as const,
        progress: 0,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        team: [],
        image: newProject.image || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1470&auto=format&fit=crop',
        description: newProject.description
      };

      const { project, error } = await projectService.createProject(projectData);

      if (error) {
        console.error('Project creation error:', error);
        alert(`Failed to create project: ${error}`);
        return;
      }

      if (project) {
        setProjects(prev => [project, ...prev]);
        setNewProject({ name: '', category: '', description: '', image: '' });
        alert('Project submitted successfully!');
        if (user.role === 'client') router.push('/dashboard/projects');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('An unexpected error occurred. Please try again.');
    }
  };

  const handleSendMessage = async (text: string = newMessage, recipientId?: string, attachments: any[] = [], priority: 'normal' | 'high' | 'urgent' = 'normal') => {
    if (!text.trim() && attachments.length === 0) return;

    // For clients, find admin ID if not provided
    let finalRecipientId = recipientId;
    if (!finalRecipientId && user.role === 'client') {
      try {
        const { userService } = await import('../services/userService');
        const { adminId, error } = await userService.getSystemAdmin();

        if (adminId) {
          finalRecipientId = adminId;
        } else {
          console.error('No admin found:', error);
          import('react-hot-toast').then(({ toast }) => {
            toast.error('Unable to find support admin. Please contact support.');
          });
          return;
        }
      } catch (err) {
        console.error('Error fetching admin user:', err);
        import('react-hot-toast').then(({ toast }) => {
          toast.error('Failed to load recipient. Please try again.');
        });
        return;
      }
    }

    if (user.role === 'admin' && !finalRecipientId) {
      import('react-hot-toast').then(({ toast }) => {
        toast.error('Please select a recipient first.');
      });
      return;
    }

    // Ensure we have a valid recipient ID
    if (!finalRecipientId) {
      console.error('No recipient ID provided');
      import('react-hot-toast').then(({ toast }) => {
        toast.error('No recipient selected. Please try again.');
      });
      return;
    }

    console.log('Sending message:', { senderId: user.id, recipientId: finalRecipientId, text: text.substring(0, 50) });

    // Optimistic Update
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      role: user.role === 'admin' ? 'model' : 'user',
      senderId: user.id,
      senderName: user.name,
      recipientId: finalRecipientId,
      text: text,
      timestamp: new Date(),
      attachments: attachments,
      priority: priority,
      readAt: null
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage(''); // Clear immediately

    try {
      const { message, error } = await messageService.sendMessage(
        user.id,
        user.name,
        user.role === 'admin' ? 'model' : 'user',
        text,
        finalRecipientId,
        attachments,
        priority
      );

      if (error) {
        console.error('Message send error:', error);
        // Rollback if error
        setMessages(prev => prev.filter(m => m.id !== tempId));
        import('react-hot-toast').then(({ toast }) => {
          if (error.startsWith('UNAUTHORIZED_LINKS:')) {
            toast.error(error.replace('UNAUTHORIZED_LINKS:', '').trim(), { duration: 6000 });
          } else {
            toast.error(`Failed to send: ${error}`);
          }
        });
      } else if (message) {
        console.log('Message sent successfully:', message.id);
        // Replace temp with real
        setMessages(prev => prev.map(m => m.id === tempId ? message : m));
        // Play notification sound
        playNotificationSound();

        // Log activity
        import('../services/activityService').then(({ activityService }) => {
          activityService.logActivity(user.id, 'Message Sent', {
            messageId: message.id,
            recipientId: finalRecipientId,
            hasAttachments: attachments.length > 0,
            priority: priority,
            textLength: text.length
          }, currentTenant?.id).catch(err => console.error('Failed to log activity:', err));
        });
      } else {
        // No message returned but no error - still rollback
        console.error('No message returned from server');
        setMessages(prev => prev.filter(m => m.id !== tempId));
        import('react-hot-toast').then(({ toast }) => {
          toast.error('Message failed - no response from server');
        });
      }
    } catch (err) {
      console.error('Unexpected error sending message:', err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      import('react-hot-toast').then(({ toast }) => {
        toast.error('Unexpected error. Please try again.');
      });
    }
  };

  // Notification sound function
  const playNotificationSound = () => {
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (err) {
      console.log('Could not play notification sound:', err);
    }
  };

  // -- ADMIN ACTIONS --
  const startEditProject = (p: Project) => {
    setEditingProject(p);
    setEditForm({ ...p });
  };

  const saveProjectEdit = async () => {
    if (!editingProject) return;
    const { error } = await projectService.updateProject(editingProject.id, editForm);
    if (!error) {
      setProjects(prev => prev.map(p => p.id === editingProject.id ? { ...p, ...editForm } : p));
      setEditingProject(null);
    }
  };

  const declineProject = async (p: Project) => {
    if (confirm('Are you sure you want to decline this project consultation?')) {
      const { error } = await projectService.updateProject(p.id, { status: 'Declined' });
      if (!error) {
        setProjects(prev => prev.map(proj => proj.id === p.id ? { ...proj, status: 'Declined' } : proj));
      }
    }
  };

  const openArchitectTool = async (p: Project) => {
    setSelectedProjectForTool(p);
    setArchitectModalOpen(true);
    setIsArchitecting(true);
    const data = await generateArchitectSpecs(p.description || "A new custom software project", p.category || "Web Application");
    setArchitectData(data);
    setIsArchitecting(false);
  };

  const openContractGenerator = async (p: Project) => {
    setSelectedProjectForTool(p);
    setContractModalOpen(true);

    // If contract already exists, load it instead of generating new one
    if (p.contractText) {
      setGeneratedContract(p.contractText);
      setIsGeneratingContract(false);
    } else {
      setIsGeneratingContract(true);

      try {
        // Add 30-second timeout for AI generation
        const timeoutPromise = new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('AI generation timeout')), 30000)
        );

        const generationPromise = generateContract(p.ownerName || 'Client', p.name);

        const contract = await Promise.race([generationPromise, timeoutPromise]);

        if (contract) {
          setGeneratedContract(contract);
        } else {
          // Fallback to template
          console.warn('AI generation returned empty, using template');
          const template = await import('../services/alphacloneContractTemplate').then(m =>
            m.generateContractFromTemplate(
              p.ownerName || 'Client',
              p.name,
              p.description || '',
              currentTenant?.name || 'Authorized Service Provider'
            )
          );
          setGeneratedContract(template);
        }
      } catch (error) {
        console.error('Contract generation error:', error);

        // Fallback to template on any error
        import('react-hot-toast').then(({ toast }) => {
          toast.error('AI generation unavailable, using template');
        });

        const template = await import('../services/alphacloneContractTemplate').then(m =>
          m.generateContractFromTemplate(
            p.ownerName || 'Client',
            p.name,
            p.description || '',
            currentTenant?.name || 'Authorized Service Provider'
          )
        );
        setGeneratedContract(template);
      } finally {
        setIsGeneratingContract(false);
      }
    }
  };

  const sendContract = async () => {
    if (selectedProjectForTool) {
      // Save to Supabase
      const { error } = await projectService.updateProject(selectedProjectForTool.id, {
        contractStatus: 'Sent',
        contractText: generatedContract
      });

      if (!error) {
        // Optimistic / Local update (though subscription might handle it)
        setProjects(prev => prev.map(p => p.id === selectedProjectForTool.id ? { ...p, contractStatus: 'Sent', contractText: generatedContract } : p));
        alert(`Contract generated and sent to ${selectedProjectForTool.ownerName || 'Client'}.`);
        setContractModalOpen(false);
      } else {
        alert('Failed to send contract: ' + error);
      }
    }
  };

  const updateProjectStage = async (projectId: string, newStage: ProjectStage) => {
    // Auto update progress based on stage
    let newProgress = 0;
    if (newStage === 'Initiation') newProgress = 10;
    if (newStage === 'Planning') newProgress = 30;
    if (newStage === 'Execution') newProgress = 60;
    if (newStage === 'Review') newProgress = 80;
    if (newStage === 'Closure') newProgress = 100;

    const updates: Partial<Project> = {
      currentStage: newStage,
      progress: newProgress,
      status: newStage === 'Closure' ? 'Completed' as const : 'Active' as const
    };

    const { error } = await projectService.updateProject(projectId, updates);
    if (!error) {
      setProjects(prev => prev.map(p => {
        if (p.id === projectId) {
          return { ...p, currentStage: newStage, progress: newProgress, status: (updates.status || p.status) as Project['status'] };
        }
        return p;
      }));
    }
  };

  // -- PAYMENT LOGIC --
  const handlePayClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentModalOpen(true);
  };

  const processPayment = async () => {
    if (!selectedInvoice) return;
    setIsProcessingPayment(true);

    try {
      // Use real Stripe payment processing
      const { success, error } = await paymentService.processPayment(
        selectedInvoice.id,
        paymentMethod // This would be the payment method ID from Stripe Elements
      );

      if (success) {
        // Update invoice status locally
        setInvoices(prev => prev.map(inv =>
          inv.id === selectedInvoice.id ? { ...inv, status: 'Paid' } : inv
        ));

        // Update project status if it was pending
        const project = projects.find(p => p.id === selectedInvoice.projectId);
        if (project && project.status === 'Pending') {
          const { error: projectError } = await projectService.updateProject(project.id, {
            status: 'Active',
            currentStage: 'Planning',
            progress: 15
          });

          if (!projectError) {
            setProjects(prev => prev.map(p =>
              p.id === project.id ? { ...p, status: 'Active', currentStage: 'Planning', progress: 15 } : p
            ));

            import('react-hot-toast').then(({ toast }) => {
              toast.success(`Payment Successful! Project "${project.name}" is now Active.`);
            });
          }
        } else {
          import('react-hot-toast').then(({ toast }) => {
            toast.success('Payment Successful! Thank you.');
          });
        }

        // Send payment receipt
        paymentService.sendPaymentReceipt(selectedInvoice.id).catch(err =>
          console.error('Failed to send receipt:', err)
        );

        setPaymentModalOpen(false);
        setSelectedInvoice(null);
      } else {
        // Payment failed
        import('react-hot-toast').then(({ toast }) => {
          toast.error(error || 'Payment failed. Please try again.');
        });
      }
    } catch (err) {
      console.error('Payment error:', err);
      import('react-hot-toast').then(({ toast }) => {
        toast.error('Payment processing error. Please try again.');
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // --- SUB-RENDERERS REMOVED (Moved to separate components) ---

  // -- ACTIVITY TRACKING (DEFERRED) --
  useEffect(() => {
    // Debounce the activity logging so rapid clicking doesn't spam the network
    const timer = setTimeout(() => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          import('../services/activityService').then(({ activityService }) => {
            activityService.logActivity(user.id, `Navigated to ${activeTab}`, { path: activeTab }, currentTenant?.id).catch(() => { });
          });
        }, { timeout: 3000 });
      } else {
        import('../services/activityService').then(({ activityService }) => {
          activityService.logActivity(user.id, `Navigated to ${activeTab}`, { path: activeTab }, currentTenant?.id).catch(() => { });
        });
      }
    }, 1000); // Wait 1 second before tracking to ensure they actually landed on the tab

    return () => clearTimeout(timer);
  }, [user.id, activeTab]);

  // Global Dashboard Heartbeat (run once on mount, independent of activeTab)
  useEffect(() => {
    const heartbeatInterval = setInterval(() => {
      import('../services/activityService').then(({ activityService }) => {
        activityService.logActivity(user.id, 'User Active', { source: 'dashboard_heartbeat' }, currentTenant?.id).catch(() => { });
      });
    }, 5 * 60 * 1000); // 5 minutes instead of 2 minutes to reduce DB load

    return () => clearInterval(heartbeatInterval);
  }, [user.id]);

  // -- RENDER CONTENT --
  const handleShareProject = (projectId: string) => {
    const url = `${window.location.origin}/p/${projectId}`;
    navigator.clipboard.writeText(url);
    toast.success('Public link copied to clipboard');
  };

  const renderContent = () => {
    switch (activeTab) {
      case '/dashboard/conference':
      case '/dashboard/meetings':
        return (
          <React.Suspense fallback={<TabSkeleton rows={4} showStats={false} />}>
            <WidgetErrorBoundary title={activeTab === '/dashboard/meetings' ? 'Meetings' : 'Video Conference'}>
              <ConferenceTab
                user={user}
                onJoinRoom={handleJoinCall}
              />
            </WidgetErrorBoundary>
          </React.Suspense>
        );


      case '/dashboard/messages':
        return (
          <React.Suspense fallback={<TabSkeleton rows={5} showStats={false} />}>
            <MessagesTab
              user={user}
              filteredMessages={filteredMessages}
              newMessage={newMessage}
              setNewMessage={setNewMessage}
              handleSendMessage={handleSendMessage}
            />
          </React.Suspense>
        );

      case '/dashboard/mail':
      case '/dashboard/gmail': // Keep for backward compatibility/redirect
        return (
          <React.Suspense fallback={<TabSkeleton rows={4} showStats={false} />}>
            <MailTab user={user} />
          </React.Suspense>
        );

      case '/dashboard/ai-studio':
        return <AIStudio />;

      // New Enterprise Views
      case '/dashboard/admin/tenants':
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <SuperAdminTenantsTab />
          </React.Suspense>
        );

      case '/dashboard/admin/users':
        return (
          <React.Suspense fallback={<TableSkeleton rows={10} columns={4} />}>
            <SuperAdminUsersTab />
          </React.Suspense>
        );

      case '/dashboard/admin/improvements':
        return (
          <React.Suspense fallback={<TableSkeleton rows={10} columns={4} />}>
            <ImprovementsPage />
          </React.Suspense>
        );

      case '/dashboard/security':
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <SecurityDashboard user={user} />
          </React.Suspense>
        );

      case '/dashboard/analytics':
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <div data-tour="analytics">
              <AnalyticsTab />
            </div>
          </React.Suspense>
        );

      case '/dashboard/clients':
        return (
          <React.Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
            <CRMTab
              userId={user.id}
              userRole={user.role}
            />
          </React.Suspense>
        );

      case '/dashboard/contact-submissions':
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <ContactSubmissionsTab />
          </React.Suspense>
        );

      case '/dashboard/sales-agent':
        return <SalesAgent />;

      case '/dashboard/onboarding':
        return <OnboardingPipelines user={user} />;



      case '/dashboard/tasks':
        return (
          <React.Suspense fallback={<TableSkeleton rows={8} columns={5} />}>
            <TasksTab userId={user.id} userRole={user.role} />
          </React.Suspense>
        );

      case '/dashboard/deals':
        return (
          <React.Suspense fallback={<TableSkeleton rows={8} columns={5} />}>
            <DealsTab userId={user.id} userRole={user.role} />
          </React.Suspense>
        );

      case '/dashboard/forecast':
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <SalesForecastTab />
          </React.Suspense>
        );

      case '/dashboard/quotes':
        return (
          <React.Suspense fallback={<TableSkeleton rows={8} columns={5} />}>
            <QuotesTab userId={user.id} userRole={user.role} />
          </React.Suspense>
        );

      case '/dashboard/calendar':
        return (
          <React.Suspense fallback={<TabSkeleton rows={4} showStats={false} />}>
            <CalendarComponent user={user} />
          </React.Suspense>
        );

      case '/dashboard/finance':
        // Clients see read-only invoice view, tenant_admin sees full billing/subscription management
        return (
          <React.Suspense fallback={<TableSkeleton rows={8} columns={6} />}>
            <FinanceTab
              user={user}
              filteredInvoices={filteredInvoices}
              handlePayClick={handlePayClick}
              onCreateInvoice={() => setCreateInvoiceOpen(true)}
            />
          </React.Suspense>
        );

      case '/dashboard/contracts':
        return <ContractDashboard user={user} />;

      case '/dashboard/articles':
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <ArticleEditor />
          </React.Suspense>
        );

      case '/dashboard/settings':
        return <SettingsPage user={user} />;

      case '/dashboard/allocation':
        return (
          <WidgetErrorBoundary title="Resource Allocation">
            <ResourceAllocationView user={user} initialProjects={projects} />
          </WidgetErrorBoundary>
        );

      case '/dashboard/submit':
        return (
          <ProjectSubmitTab
            newProject={newProject}
            setNewProject={setNewProject}
            handleAddProject={handleAddProject}
          />
        );

      case '/dashboard/portfolio-manager':
        return <PortfolioShowcase projects={filteredProjects} isAdmin={user.role === 'admin'} onRefresh={refreshProjects} userId={user.id} />;

      case '/dashboard/projects': // Shared route name for lists
        return (
          <div className="space-y-6 animate-fade-in" data-tour={user.role === 'admin' ? 'projects' : 'my-projects'}>
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">
                {user.role === 'admin' ? 'Project Manager' : 'My Active Projects'}
              </h2>
              {user.role === 'client' && <Button onClick={() => router.push('/dashboard/submit')} variant="secondary">Add New Item</Button>}
              <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-lg border border-white/5">
                <button onClick={() => setProjectViewMode('list')} className={`p-2 rounded-md ${projectViewMode === 'list' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-slate-400 hover:bg-white/5'}`} title="List View">
                  <List className="w-4 h-4" />
                </button>
                <button onClick={() => setProjectViewMode('grid')} className={`p-2 rounded-md ${projectViewMode === 'grid' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-slate-400 hover:bg-white/5'}`} title="Grid View">
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>

            {projectViewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProjects.map(p => (
                  <CustomContextMenu
                    key={p.id}
                    items={[
                      { label: 'AI Architect', icon: <Cpu className="w-4 h-4" />, onClick: () => openArchitectTool(p) },
                      { label: 'Edit Project', icon: <Edit2 className="w-4 h-4" />, onClick: () => startEditProject(p) },
                      { label: 'Manage Phases', icon: <ListChecks className="w-4 h-4" />, onClick: () => { setSelectedProjectForMilestones(p); setMilestoneModalOpen(true); } },
                      { label: 'Share Link', icon: <Share2 className="w-4 h-4" />, onClick: () => handleShareProject(p.id) },
                      { label: 'Message Client', icon: <MessageSquare className="w-4 h-4" />, onClick: () => router.push(`/dashboard/messages?selectedClientId=${p.ownerId}`) },
                      { label: 'Decline Project', icon: <X className="w-4 h-4" />, onClick: () => declineProject(p), destructive: true },
                    ]}
                  >
                    <div className={`group relative bg-slate-900 rounded-xl overflow-hidden border transition-all flex flex-col h-full ${p.status === 'Declined' ? 'border-red-900 opacity-60' : 'border-slate-800 hover:border-teal-500/50'}`}>
                      <div className="aspect-video relative">
                        <img src={p.image} className="w-full h-full object-cover" />
                        <div className={`absolute top-2 right-2 backdrop-blur px-2 py-1 rounded text-xs text-white font-bold border ${p.status === 'Active' ? 'bg-green-500/20 border-green-500/50' : p.status === 'Declined' ? 'bg-red-500/20 border-red-500' : 'bg-black/60 border-white/10'}`}>
                          {p.status}
                        </div>
                      </div>
                      <div className="p-3 flex-1 flex flex-col">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-white text-sm leading-tight">{p.name}</h4>
                          {user.role === 'admin' && (
                            <div className="flex gap-1">
                              <button onClick={() => openArchitectTool(p)} className="text-slate-500 hover:text-teal-400 p-1" title="AI Architect"><Cpu className="w-3.5 h-3.5" /></button>
                              <button onClick={() => startEditProject(p)} className="text-slate-500 hover:text-white p-1" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mb-2">{p.category}</p>

                        {/* Stage Indicator */}
                        <div className="mt-2 mb-4">
                          <div className="flex justify-between text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                            <span>Current Stage</span>
                            <span className="text-teal-400">{p.currentStage}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full flex gap-0.5">
                            {STAGES.map((s, i) => {
                              const stageIndex = STAGES.indexOf(p.currentStage || 'Initiation');
                              return (
                                <div
                                  key={s}
                                  className={`h-full flex-1 rounded-full ${i <= stageIndex ? 'bg-teal-500' : 'bg-slate-700'}`}
                                />
                              );
                            })}
                          </div>
                        </div>

                        <div className="mt-auto pt-4 border-t border-slate-800">
                          {/* Quick Communication Actions */}
                          <div className="flex gap-2 mb-3">
                            {user.role === 'admin' ? (
                              <button
                                onClick={() => router.push(`/dashboard/messages?selectedClientId=${p.ownerId}`)}
                                className="flex-1 px-2 py-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 text-[10px] rounded-lg border border-teal-500/20 transition-colors flex items-center justify-center gap-1"
                                title="Message client about this project"
                              >
                                <MessageSquare className="w-3 h-3" />
                                Message
                              </button>
                            ) : (
                              <button
                                onClick={() => router.push('/dashboard/messages')}
                                className="flex-1 px-2 py-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 text-[10px] rounded-lg border border-teal-500/20 transition-colors flex items-center justify-center gap-1"
                                title="Message admin about this project"
                              >
                                <MessageSquare className="w-3 h-3" />
                                Message Admin
                              </button>
                            )}
                            <button
                              onClick={() => router.push('/dashboard/conference')}
                              className="flex-1 px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[10px] rounded-lg border border-blue-500/20 transition-colors flex items-center justify-center gap-1"
                              title="Start video call"
                            >
                              <Video className="w-3 h-3" />
                              Call
                            </button>
                          </div>
                          {user.role === 'admin' && (
                            <div className="space-y-3 mb-3">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedProjectForMilestones(p);
                                    setMilestoneModalOpen(true);
                                  }}
                                  className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-1"
                                  title="Manage Project Phases"
                                >
                                  <ListChecks className="w-3 h-3" />
                                  Phases
                                </button>
                                <button
                                  onClick={() => handleShareProject(p.id)}
                                  className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs rounded-lg border border-blue-500/20 transition-colors flex items-center justify-center gap-1"
                                  title="Copy Public Link"
                                >
                                  <Share2 className="w-3 h-3" />
                                </button>
                              </div>

                              {p.status === 'Active' && (
                                <button
                                  onClick={() => openContractGenerator(p)}
                                  className="w-full px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs rounded-lg border border-purple-500/20 transition-colors flex items-center justify-center gap-1"
                                  title="Generate or edit contract"
                                >
                                  <FileCheck className="w-3 h-3" />
                                  {p.contractStatus === 'Sent' || p.contractStatus === 'Signed' ? 'View Contract' : 'Generate Contract'}
                                </button>
                              )}
                            </div>
                          )}

                          {user.role === 'admin' ? (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <label className="text-xs text-slate-500">Update Stage</label>
                                {p.status === 'Pending' && (
                                  <button onClick={() => declineProject(p)} className="text-[10px] text-red-400 hover:underline">Decline</button>
                                )}
                              </div>
                              <select
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                                value={p.currentStage || 'Initiation'}
                                onChange={(e) => updateProjectStage(p.id, e.target.value as ProjectStage)}
                              >
                                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                          ) : (
                            <div className="flex justify-between items-end mb-1">
                              <span className="text-xs text-slate-500">Progress</span>
                              <span className="text-sm font-bold text-teal-400">{p.progress}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CustomContextMenu>
                ))}
              </div>
            ) : (
              <div className="bg-slate-900/40 rounded-2xl border border-white/5 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-slate-900/60 font-mono">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Project</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Stage</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredProjects.map(p => (
                      <CustomContextMenu
                        as="tr"
                        key={p.id}
                        items={[
                          { label: 'AI Architect', icon: <Cpu className="w-4 h-4" />, onClick: () => openArchitectTool(p) },
                          { label: 'Edit Project', icon: <Edit2 className="w-4 h-4" />, onClick: () => startEditProject(p) },
                          { label: 'Manage Phases', icon: <ListChecks className="w-4 h-4" />, onClick: () => { setSelectedProjectForMilestones(p); setMilestoneModalOpen(true); } },
                          { label: 'Share Link', icon: <Share2 className="w-4 h-4" />, onClick: () => handleShareProject(p.id) },
                          { label: 'Message Client', icon: <MessageSquare className="w-4 h-4" />, onClick: () => router.push(`/dashboard/messages?selectedClientId=${p.ownerId}`) },
                          { label: 'Decline Project', icon: <X className="w-4 h-4" />, onClick: () => declineProject(p), destructive: true },
                        ]}
                      >
                        <tr className="group hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <img src={p.image} className="w-10 h-10 rounded-lg object-cover border border-white/5" />
                              <div>
                                <span className="text-sm font-bold text-slate-200 block">{p.name}</span>
                                <span className="text-[10px] text-slate-500 uppercase font-mono">{p.category}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 text-[10px] rounded-md font-bold uppercase tracking-wider ${p.status === 'Active' ? 'bg-green-500/20 text-green-400' :
                              p.status === 'Declined' ? 'bg-red-500/20 text-red-400' :
                                'bg-slate-700 text-slate-400'
                              }`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-teal-400 bg-teal-500/10 px-2 py-1 rounded-md border border-teal-500/20">
                              {p.currentStage || 'Initiation'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500">
                            <div className="flex items-center gap-2">
                              {user.role === 'admin' && (
                                <>
                                  <button onClick={() => openArchitectTool(p)} className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors" title="AI Architect"><Cpu className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => startEditProject(p)} className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                                </>
                              )}
                              <button
                                onClick={() => router.push(user.role === 'admin' ? `/dashboard/messages?selectedClientId=${p.ownerId}` : '/dashboard/messages')}
                                className="p-1.5 hover:bg-teal-500/10 text-teal-400 rounded-lg transition-colors"
                                title="Message"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      </CustomContextMenu>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      default:
        return (
          <HomeTab
            user={user}
            currentStats={currentStats}
            filteredProjects={filteredProjects}
            isLoadingProjects={isLoadingProjects}
            updateProjectStage={updateProjectStage}
            STAGES={STAGES}
            onProjectClick={(id) => {
              const project = filteredProjects.find(p => p.id === id);
              if (project) {
                if (user.role === 'admin') {
                  setSelectedProjectForMilestones(project);
                  setMilestoneModalOpen(true);
                } else {
                  router.push('/dashboard/projects');
                }
              }
            }}
          />
        );
    }
  };

  // -- CRITICAL FIX: ISOLATED TENANT DASHBOARD --
  // Return early for Tenant Admins to avoid double-shell layout collisions
  if (user.role === 'tenant_admin') {
    return (
      <BusinessDashboard
        user={user}
        currentTenant={currentTenant}
        onLogout={onLogout}
        activeTab={location || '/dashboard'}
        setActiveTab={(tab) => router.push(tab)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex overflow-hidden font-sans selection:bg-teal-500/30">
      <ConnectionStatus />

      <WelcomeModal
        isOpen={welcomeOpen}
        onClose={() => {
          if (typeof window !== 'undefined') {
            localStorage.setItem(`welcome_seen_${user.id}`, 'true');
          }
          setWelcomeOpen(false);
        }}
        userName={user.name}
      />

      {showOnboarding && (
        <OnboardingFlow
          user={user}
          onComplete={() => {
            setShowOnboarding(false);
            if (typeof window !== 'undefined') {
              localStorage.setItem(`onboarding_completed_${user.id}`, 'true');
            }
          }}
        />
      )}

      <CreateInvoiceModal
        isOpen={createInvoiceOpen}
        onClose={() => setCreateInvoiceOpen(false)}
        onInvoiceCreated={refreshInvoices}
        projects={projects}
      />

      {/* Payment Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Secure Checkout"
      >
        <div className="space-y-6">
          <div className="text-center p-4 bg-slate-950 rounded-lg border border-slate-800">
            <p className="text-slate-400 text-sm">Total Amount Due</p>
            <div className="text-2xl sm:text-3xl font-bold text-white">${selectedInvoice?.amount.toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1">Invoice #{selectedInvoice?.id.toUpperCase()}</p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300">Select Payment Method</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setPaymentMethod('card')}
                className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'card' ? 'bg-teal-600/10 border-teal-500 text-teal-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}
              >
                <CreditCard className="w-6 h-6" />
                <span className="text-sm font-bold">Bank Card</span>
              </button>
              <button
                onClick={() => setPaymentMethod('paypal')}
                className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'paypal' ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}
              >
                <Wallet className="w-6 h-6" />
                <span className="text-sm font-bold">PayPal</span>
              </button>
            </div>
          </div>

          {paymentMethod === 'card' && (
            <div className="space-y-4 animate-fade-in">
              <Input label="Cardholder Name" placeholder="John Doe" />
              <Input label="Card Number" placeholder="0000 0000 0000 0000" />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Expiry Date" placeholder="MM/YY" />
                <Input label="CVC" placeholder="123" />
              </div>
            </div>
          )}

          {paymentMethod === 'paypal' && (
            <div className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center animate-fade-in">
              <p className="text-blue-200 text-sm mb-4">You will be redirected to PayPal to complete your purchase securely.</p>
              <Button className="w-full bg-[#0070BA] hover:bg-[#003087]">Log in to PayPal</Button>
            </div>
          )}

          {paymentMethod === 'card' && (
            <Button onClick={processPayment} className="w-full h-12 text-lg" isLoading={isProcessingPayment}>
              {isProcessingPayment ? 'Processing...' : `Pay $${selectedInvoice?.amount.toLocaleString()}`}
            </Button>
          )}

          <p className="text-center text-[10px] text-slate-500 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Payments processed securely via Global Payment SSL
          </p>
        </div>
      </Modal>

      {/* AlphaClone Contract System */}
      {selectedProjectForTool && (
        <AlphaCloneContractModal
          isOpen={contractModalOpen}
          onClose={() => {
            setContractModalOpen(false);
            setSelectedProjectForTool(null);
          }}
          project={selectedProjectForTool}
          user={user}
          existingContractText={selectedProjectForTool.contractText}
        />
      )}

      {/* AI Architect Modal */}
      <Modal isOpen={architectModalOpen} onClose={() => setArchitectModalOpen(false)} title="Project Architect View">
        {isArchitecting ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-400">AI is designing system architecture...</p>
          </div>
        ) : architectData ? (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
            <div>
              <h4 className="text-teal-400 font-bold mb-2 flex items-center gap-2"><Layers className="w-4 h-4" /> Tech Stack</h4>
              <div className="bg-slate-950 p-3 rounded-lg text-sm text-slate-300">{architectData.techStack}</div>
            </div>

            <div>
              <h4 className="text-blue-400 font-bold mb-2 flex items-center gap-2"><Code className="w-4 h-4" /> Development Prompt (Copy for AI)</h4>
              <div className="relative">
                <textarea className="w-full h-32 bg-slate-950 text-slate-400 text-xs p-3 rounded-lg font-mono" readOnly value={architectData.developmentPrompt} />
                <button onClick={() => navigator.clipboard.writeText(architectData.developmentPrompt)} className="absolute top-2 right-2 p-1 bg-slate-800 rounded hover:bg-slate-700"><Copy className="w-3 h-3 text-white" /></button>
              </div>
            </div>

            <div>
              <h4 className="text-purple-400 font-bold mb-2 flex items-center gap-2"><Cpu className="w-4 h-4" /> Mermaid.js Architecture</h4>
              <pre className="bg-slate-950 p-3 rounded-lg text-xs text-green-400 overflow-x-auto font-mono">
                {architectData.architectureDiagram}
              </pre>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Milestone Manager Modal */}
      <Modal
        isOpen={milestoneModalOpen}
        onClose={() => setMilestoneModalOpen(false)}
        title={`Manage Phases: ${selectedProjectForMilestones?.name || 'Project'}`}
      >
        {selectedProjectForMilestones && (
          <div className="max-h-[70vh] overflow-y-auto custom-scrollbar px-1">
            <MilestoneManager
              projectId={selectedProjectForMilestones.id}
              onClose={() => setMilestoneModalOpen(false)}
            />
          </div>
        )}
      </Modal>

      {/* Edit Project Modal */}
      <Modal
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        title={`Edit Project: ${editingProject?.name}`}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-slate-400">Project Name</label>
            <Input
              value={editForm.name || ''}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-400">Status</label>
            <select
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-teal-500"
              value={editForm.status || 'Pending'}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value as Project['status'] })}
            >
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
              <option value="Declined">Declined</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-400 flex justify-between">
              <span>Progress</span>
              <span className="text-teal-400 font-bold">{editForm.progress}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              className="w-full accent-teal-500"
              value={editForm.progress || 0}
              onChange={(e) => setEditForm({ ...editForm, progress: parseInt(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-400">Due Date</label>
            <Input
              type="date"
              value={editForm.dueDate || ''}
              onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
            />
          </div>

          <div className="pt-4 flex gap-3">
            <Button onClick={saveProjectEdit} className="flex-1">Save Changes</Button>
            <Button onClick={() => setEditingProject(null)} variant="outline">Cancel</Button>
          </div>
        </div>
      </Modal>



      {/* Exit Intent Modal */}
      <ExitIntentModal user={user} />

      {/* Incoming Call Modal (Global Listener) */}
      <IncomingCallModal userId={user.id} userName={user.name} />

      <DeletionOverlay />

      {/* Sidebar - Extracted & Memoized */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        user={user}
        navItems={NAV_ITEMS}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unreadMessageCount={unreadMessageCount}
        onLogout={onLogout}
      />

      {/* Removed "Back to Navigation" button as per user request */}

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onNavigate={(href) => setActiveTab(href)}
        onToggleMenu={() => setSidebarOpen(true)}
        unreadCount={unreadMessageCount}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-950">
        {/* Header - Visible in all dashboard views */}
        <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-sm bg-slate-900/95 pt-safe">
          <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Mobile Menu Toggle - Hidden if BottomNav handles it */}
              {/* Mobile Menu Toggle removed - BottomNav handles it */}

              <div className="flex items-center gap-2 sm:gap-3 md:hidden">
                <img src={LOGO_URL} alt="Logo" className="w-8 h-8 rounded-lg flex-shrink-0" />
                <h1 className="text-base sm:text-lg font-bold text-white whitespace-nowrap truncate max-w-[150px] sm:max-w-none">AlphaClone Systems</h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {activeBgTasksCount > 0 && (
                <div className="flex items-center gap-2 bg-slate-800/50 text-teal-400 px-3 py-1.5 rounded-full text-xs font-semibold animate-pulse border border-teal-500/30">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">{activeBgTasksCount} Task(s)</span>
                </div>
              )}
              <EnhancedGlobalSearch
                user={user}
                onNavigate={router.push}
              />
              <ThemeToggle userId={user.id} />
              <NotificationCenter userId={user.id} tenantId={currentTenant?.id || ''} />
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main id="main-content" className={`flex-1 ${['/dashboard/mail', '/dashboard/gmail'].includes(activeTab) ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'} w-full bg-slate-950 scroll-smooth relative pb-safe md:pb-0`} role="main">
          {/* Content Wrapper for Max Width & Padding */}
          <div className={`max-w-[1240px] mx-auto p-4 md:p-8 dashboard-content-padding pb-24 md:pb-8 ${activeTab === '/dashboard/gmail' || activeTab === '/dashboard/messages' ? 'h-full flex flex-col' : 'min-h-full'}`}>
            {/* Background decorative elements */}
            <div className="fixed top-20 left-1/3 w-96 h-96 bg-teal-600/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 max-w-7xl mx-auto min-h-full">
              <WidgetErrorBoundary title="Dashboard Content Error">
                {renderContent()}
              </WidgetErrorBoundary>
            </div>
          </div>
        </main>
      </div>



      {/* Dashboard Global Elements */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onCreateInvoice={() => setCreateInvoiceOpen(true)}
        onCreateTask={() => setCreateTaskOpen(true)}
        onCreateProject={() => setCreateProjectOpen(true)}
      />

      {createInvoiceOpen && (
        <CreateInvoiceModal
          isOpen={createInvoiceOpen}
          onClose={() => setCreateInvoiceOpen(false)}
          projects={projects}
          onInvoiceCreated={() => {
            setCreateInvoiceOpen(false);
            if (typeof refreshInvoices === 'function') refreshInvoices();
          }}
        />
      )}

      {createTaskOpen && (
        <Modal isOpen={createTaskOpen} onClose={() => setCreateTaskOpen(false)} title="Intelligence Capture">
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-teal-500/10 rounded-full flex items-center justify-center mx-auto text-teal-400">
              <Zap className="w-8 h-8 animate-pulse" />
            </div>
            <p className="text-slate-300 text-sm">Please navigate to the <b>Tasks</b> tab to use the full neural capture engine for new objectives.</p>
            <Button onClick={() => { setCreateTaskOpen(false); setActiveTab('/dashboard/tasks'); router.push('/dashboard/tasks'); }} className="w-full bg-teal-500 hover:bg-teal-400">Initialize Neural Sync</Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Dashboard;
