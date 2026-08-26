"use client";
// Deployment trigger: 2026-03-10 - Authentication fixes deployed

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ConnectionStatus } from "./ConnectionStatus";
import { motion, AnimatePresence } from "framer-motion";
import CustomContextMenu from "./common/CustomContextMenu";
import {
  Plus,
  Search,
  Filter,
  Settings,
  Bell,
  LogOut,
  ChevronRight,
  MessageSquare,
  Calendar,
  FileText,
  PieChart,
  Users,
  Briefcase,
  CheckCircle2,
  Clock,
  AlertCircle,
  Menu,
  X,
  Globe,
  Layout,
  Smartphone,
  Mail,
  Phone,
  MapPin,
  Shield,
  CreditCard,
  Zap,
  Brain,
  Rocket,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  BarChart3,
  ChevronDown,
  ArrowRight,
  Download,
  Share2,
  Trash2,
  Copy,
  Edit,
  Trash,
  Eye,
  MoreVertical,
  LayoutGrid,
  List,
  RefreshCw,
  Cpu,
  Layers,
  Code,
  ShieldCheck,
  Edit2,
  ListChecks,
  FileCheck,
  Video,
  DollarSign,
  User as UserIcon,
} from "lucide-react";
import { toast } from "react-hot-toast";
import MilestoneManager from "./dashboard/projects/MilestoneManager";
import { Button, Card, Input, Modal } from "./ui/UIComponents";
import {
  CLIENT_NAV_ITEMS,
  ADMIN_NAV_ITEMS,
  TENANT_ADMIN_NAV_ITEMS,
  LOGO_URL,
  APP_NAME,
} from "../constants";
import { WORKSPACE } from "@/constants/design";
import { isPlatformAdminRole } from "@/lib/platformAdmin";
import { useLanguage } from "../contexts/LanguageContext";
import Image from "next/image";
import {
  User,
  Project,
  ChatMessage,
  DashboardStat,
  GalleryItem,
  Invoice,
  ProjectStage,
  UserRole,
  STAGES,
} from "../types";
import { resolveDashboardPath } from "@/lib/dashboardNavigate";
import InsightsHub from "./dashboard/hubs/InsightsHub";
import { useTenant } from "../contexts/TenantContext";

import AIStudio from "./dashboard/AIStudio";
import AIStudioTab from "./dashboard/AIStudioTab";
import NotificationCenter from "./dashboard/NotificationCenter";
import ThemeToggle from "./ThemeToggle";
import { presenceService } from "../services/presenceService";
import MissedCallsNotification from "./dashboard/MissedCallsNotification";
import EnhancedGlobalSearch from "./dashboard/EnhancedGlobalSearch";
import Sidebar from "./dashboard/Sidebar";
import BottomNav from "./dashboard/BottomNav";
import CommandPalette from "./dashboard/CommandPalette";
import { DashboardAccountMenu } from "./dashboard/DashboardAccountMenu";
import {
  OverviewDashboard,
  CrmDashboard,
  OutreachDashboard,
  InvoicingDashboard,
  ContractsDashboard,
  ProjectsDashboard,
  SocialDashboard,
} from "./dashboard/views/ModuleDashboardView";
import ProjectSubmitTab from "./dashboard/ProjectSubmitTab";
import ExitIntentModal from "./ExitIntentModal";
import IncomingCallModal from "./dashboard/video/IncomingCallModal";
import { generateText } from "../services/unifiedAIService";
import BonnieWidget from "./dashboard/bonnie/BonnieWidget";
import BonnieFullView from "./dashboard/bonnie/BonnieFullView";
import ApprovalCenter from "./dashboard/bonnie/ApprovalCenter";
interface ArchitectData {
  techStack: string;
  developmentPrompt: string;
  architectureDiagram: string;
}

const generateContract = async (
  clientName: string,
  projectName: string,
): Promise<string> => {
  const prompt = `Generate a professional freelance contract for Client: ${clientName}, Project: ${projectName}. Include standard clauses.`;
  const { text } = await generateText(
    prompt,
    2048,
    "claude-sonnet-4-5-20250929",
  );
  return text || "Contract generation failed.";
};
import { useBackgroundTasks } from "../contexts/BackgroundTaskContext";
// Consolidated notification service
import {
  notificationService,
  Notification,
} from "../services/dashboardService";
import { projectService } from "../services/projectService";
import { messageService } from "../services/messageService";
import { paymentService } from "../services/paymentService";
import { userService } from "../services/userService";
import SecurityDashboard from "./dashboard/SecurityDashboard";
import AlphaCloneContractModal from "./contracts/AlphaCloneContractModal";
import SettingsPage from "./dashboard/SettingsPage";
import PwaSettingsScreen from "./pwa/PwaSettingsScreen";
import OnboardingPipelines from "./dashboard/OnboardingPipelines";
import PortfolioShowcase from "./dashboard/PortfolioShowcase";
import WelcomeModal from "./dashboard/WelcomeModal";
import OnboardingFlow from "./onboarding/OnboardingFlow";
import CreateInvoiceModal from "./dashboard/CreateInvoiceModal";
import ProductTour from "./onboarding/ProductTour";
import { WidgetErrorBoundary } from "./dashboard/WidgetErrorBoundary";
import { useOverdueTaskNotifier } from "../hooks/useOverdueTaskNotifier";
import { useMeetingSession } from "../hooks/useMeetingSession";
import { DeletionOverlay } from "./dashboard/DeletionOverlay";
import PullToRefresh from "./common/PullToRefresh";
import SkipToMainContent from "./accessibility/SkipToMainContent";

const ConferenceTab = React.lazy(() => import("./dashboard/ConferenceTab"));
const AnalyticsTab = React.lazy(() => import("./dashboard/AnalyticsTab"));
import CRMTab from "./dashboard/CRMTab";
import MessagesTab from "./dashboard/MessagesTab";
const FinanceTab = React.lazy(() => import("./dashboard/FinanceTab"));
const EnhancedBillingPage = React.lazy(
  () => import("./dashboard/business/EnhancedBillingPage"),
);
const ArticleEditor = React.lazy(() => import("./dashboard/ArticleEditor"));
const CalendarComponent = React.lazy(
  () => import("./dashboard/CalendarComponent"),
);
import { PasswordChangeRequiredModal } from "./auth/PasswordChangeRequiredModal";
const SuperAdminDashboardTab = React.lazy(
  () => import("./dashboard/admin/SuperAdminDashboardTab"),
);
const SuperAdminAuditTab = React.lazy(
  () => import("./dashboard/admin/SuperAdminAuditTab"),
);
const SuperAdminTenantsTab = React.lazy(
  () => import("./dashboard/admin/SuperAdminTenantsTab"),
);
const SuperAdminUsersTab = React.lazy(
  () => import("./dashboard/admin/SuperAdminUsersTab"),
);
const SuperAdminSubscriptionsTab = React.lazy(
  () => import("./dashboard/admin/SuperAdminSubscriptionsTab"),
);
const ImprovementsPage = React.lazy(
  () => import("./dashboard/admin/ImprovementsPage"),
);
const PlatformOwnerHome = React.lazy(
  () => import("./dashboard/admin/PlatformOwnerHome"),
);
const OperatingSystemHome = React.lazy(
  () => import("./dashboard/OperatingSystemHome"),
);
const ContactSubmissionsTab = React.lazy(
  () => import("./dashboard/ContactSubmissionsTab"),
);
import TasksTab from "./dashboard/TasksTab";
import DealsTab from "./dashboard/DealsTab";
import QuotesTab from "./dashboard/QuotesTab";
const SalesForecastTab = React.lazy(
  () => import("./dashboard/SalesForecastTab"),
);
import MailTab from "./dashboard/MailTab";
import CommunicationHub from "./dashboard/communication/CommunicationHub";
const GlobalSettingsTab = React.lazy(
  () => import("./dashboard/admin/GlobalSettingsTab"),
);
const OperationsConsoleTab = React.lazy(
  () => import("./dashboard/admin/OperationsConsoleTab"),
);
import ClientsPage from "./dashboard/business/ClientsPage";
import ProjectsPage from "./dashboard/business/ProjectsPage";
const ContractDashboard = React.lazy(
  () => import("./contracts/ContractDashboard"),
);
const AccountingDashboard = React.lazy(
  () => import("./dashboard/accounting/AccountingDashboard"),
);
const BusinessPerformanceDashboard = React.lazy(
  () => import("./dashboard/business/BusinessPerformanceDashboard"),
);
const GamificationTab = React.lazy(() => import("./dashboard/GamificationTab"));
const AIAgentsTab = React.lazy(() => import("./dashboard/AIAgentsTab"));
const DeepDeskView = React.lazy(
  () => import("./dashboard/tickets/DeepDeskView"),
);
const EmailCampaignsPage = React.lazy(
  () => import("./dashboard/marketing/EmailCampaignsPage"),
);
const SocialMediaComposer = React.lazy(
  () => import("./dashboard/engine/SocialMediaComposer"),
);
const WhatsAppManagementPage = React.lazy(
  () => import("./dashboard/WhatsAppManagementPage"),
);

import { MomentumHUD } from "./dashboard/MomentumHUD";
import { CelebrationOverlay } from "./ui/CelebrationOverlay";
import { TrialBanner } from "./dashboard/TrialBanner";
import { LegacyAccessBanner } from "./dashboard/LegacyAccessBanner";

// Zoho Components
const UnifiedInbox = React.lazy(
  () => import("./dashboard/business/UnifiedInbox"),
);
const ZohoCRMIntegration = React.lazy(
  () => import("./dashboard/zoho/ZohoCRMIntegration"),
);
const TaskScheduler = React.lazy(
  () => import("./dashboard/business/TaskScheduler"),
);
const ScraperCampaignsPage = React.lazy(
  () => import("./dashboard/leads/ScraperCampaignsPage"),
);
const CRMReportsTab = React.lazy(() => import("./dashboard/crm/CRMReportsTab"));
const AccountsPage = React.lazy(() => import("./dashboard/crm/AccountsPage"));
const FollowUpQueue = React.lazy(() => import("./dashboard/crm/FollowUpQueue"));
const WorkflowDashboard = React.lazy(
  () => import("./dashboard/engine/WorkflowDashboard"),
);
const SalesConsole = React.lazy(() => import("./dashboard/crm/SalesConsole"));
const CashFlowForecastTab = React.lazy(
  () => import("./dashboard/business/CashFlowForecastTab"),
);
const ExpenseTrackerTab = React.lazy(
  () => import("./dashboard/business/ExpenseTrackerTab"),
);
const ReportsPage = React.lazy(
  () => import("./dashboard/business/ReportsPage"),
);
const ExecutiveDashboard = React.lazy(
  () => import("./dashboard/ExecutiveDashboard"),
);
const BankingCenterPage = React.lazy(
  () => import("./dashboard/accounting/BankingCenterPage"),
);
const IngestionPanel = React.lazy(
  () => import("./dashboard/engine/IngestionPanel"),
);
const VoiceCaptureFAB = React.lazy(() => import("./dashboard/VoiceCaptureFAB"));
const MarketplacePage = React.lazy(() => import("./dashboard/MarketplacePage"));
import { renderSharedDashboardRoute } from "@/lib/dashboard/sharedDashboardRoutes";
import { GlobalShortcutListener } from "./common/GlobalShortcutListener";
import { QuickTaskOverlay } from "./dashboard/QuickTaskOverlay";

// Import UI components
import { TableSkeleton } from "./ui/Skeleton";
import { TabSkeleton } from "./ui/TabSkeleton";
import { EmptyState } from "./ui/EmptyState";
import {
  EnterpriseTabWrapper,
  isEnterpriseFullBleedTab,
} from "./ui/EnterpriseTabWrapper";

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

// STAGES now imported from ../types

const Dashboard: React.FC<DashboardProps> = ({
  user,
  onLogout,
  projects,
  setProjects,
  messages,
  setMessages,
  galleryItems,
  setGalleryItems,
}) => {
  const location = usePathname() ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentTenant, getDashboardStats, error: tenantError } = useTenant();
  const { t } = useLanguage();
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  // Prevent duplicate data loads per tenant when TenantContext resolves after initial render
  const dataLoadedRef = useRef<string | null>(null);
  const lastTenantIdRef = useRef<string | undefined>(undefined);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Initialize recurring overdue task notifications
  useOverdueTaskNotifier(user);

  // Initialize MS Teams-like Presence
  useEffect(() => {
    if (user?.id) {
      presenceService.initializePresence(user.id, "online");
      return () => {
        presenceService.cleanup(user.id);
      };
    }
  }, [user?.id]);

  // Sync sidebar on mount to avoid hydration mismatch
  useEffect(() => {
    if (typeof window !== "undefined") {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean(
          (window.navigator as Navigator & { standalone?: boolean }).standalone,
        );
      const touchDevice = window.matchMedia("(pointer: coarse)").matches;
      // Installed iPhone/iPad PWAs should use the touch shell even when an
      // iPad reports a desktop-sized CSS viewport.
      setSidebarOpen(window.innerWidth >= 1024 && !(standalone && touchDevice));
    }
  }, []);
  const normalizeTabForRole = (tab: string) => {
    if (!tab) return "/dashboard";
    if (user.role === "tenant_admin") {
      if (tab === "/dashboard/business") return "/dashboard";
      if (tab === "/dashboard/messages") return "/dashboard/business/messages";
      if (tab === "/dashboard/settings") return "/dashboard/business/settings";
      if (tab === "/dashboard/contracts")
        return "/dashboard/business/contracts";
      if (tab === "/dashboard/deals") return "/dashboard/deals";
      if (tab === "/dashboard/finance") return "/dashboard/business/billing";
      if (tab === "/dashboard/projects") return "/dashboard/business/projects";
      if (tab === "/dashboard/quotes") return "/dashboard/business/quotes";
      if (tab === "/dashboard/tickets") return "/dashboard/business/tickets";
      return tab;
    } else {
      if (tab === "/dashboard/business/messages") return "/dashboard/messages";
      if (tab === "/dashboard/business/settings") return "/dashboard/settings";
      if (tab === "/dashboard/business/contracts")
        return "/dashboard/contracts";
      if (tab === "/dashboard/business/billing") return "/dashboard/finance";
      if (tab === "/dashboard/business/projects") return "/dashboard/projects";
      if (tab === "/dashboard/business/tasks") return "/dashboard/tasks";
      if (tab === "/dashboard/business/quotes") return "/dashboard/quotes";
      if (tab === "/dashboard/business/tickets") return "/dashboard/tickets";
      return tab;
    }
  };

  const [activeTab, setActiveTab] = useState(() => {
    const tabStorageKey = `dashboard_active_tab_${user.id}`;
    const fromUrl = location || "/dashboard";
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(tabStorageKey);
      if (
        saved?.startsWith("/dashboard") &&
        (fromUrl === "/dashboard" || fromUrl === saved)
      ) {
        return normalizeTabForRole(saved);
      }
    }
    return normalizeTabForRole(fromUrl);
  });
  const { activeMeetingCallId, startMeeting } = useMeetingSession(
    `${user.id}:${currentTenant?.id || "no-tenant"}`,
  );

  useEffect(() => {
    if (
      activeMeetingCallId &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/meet/")
    ) {
      router.replace(`/meet/${activeMeetingCallId}`);
    }
  }, [activeMeetingCallId, router]);

  // -- PERSISTENT VIDEO CALL STATE --
  // Note: Video calls now use dedicated pages (/meet/[id])

  // Auto-hide sidebar on specific views or states
  useEffect(() => {
    // Only force hide on initial load of conference, otherwise respect user/nav state
    const hiddenRoutes = ["/dashboard/conference"];
    if (hiddenRoutes.includes(activeTab)) {
      setSidebarOpen(false);
    }
  }, [activeTab]);

  const handleJoinCall = (callId: string) => {
    startMeeting(callId);
    router.push(`/meet/${callId}`);
  };

  // Sync activeTab with URL changes (skip no-op updates to avoid re-render churn)
  useEffect(() => {
    if (!location?.startsWith("/dashboard")) return;
    const next = normalizeTabForRole(location);
    setActiveTab((prev) => (prev === next ? prev : next));
  }, [location, user.role]);

  // Persist last dashboard route so switching browser tabs does not reset navigation
  useEffect(() => {
    if (typeof window === "undefined" || !activeTab?.startsWith("/dashboard"))
      return;
    sessionStorage.setItem(`dashboard_active_tab_${user.id}`, activeTab);
  }, [activeTab, user.id]);

  // Deep-link: Bonnie emits bonnie:navigate events to steer the dashboard
  useEffect(() => {
    const handleBonnieNav = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          path?: string;
          label?: string;
          tab?: string;
          focus?: string;
          recordId?: string;
          workflowId?: string;
          reason?: string;
        }>
      ).detail;
      const path = detail?.path;
      if (path?.startsWith("/dashboard")) {
        setActiveTab(normalizeTabForRole(path.split("?")[0]));
        if (typeof window !== "undefined") {
          const url = new URL(path, window.location.origin);
          if (detail?.tab) url.searchParams.set("tab", detail.tab);
          if (detail?.focus) url.searchParams.set("focus", detail.focus);
          if (detail?.recordId) url.searchParams.set("id", detail.recordId);
          if (detail?.workflowId)
            url.searchParams.set("workflow", detail.workflowId);
          if (detail?.reason)
            url.searchParams.set("bonnieReason", detail.reason);
          window.history.replaceState({}, "", url.pathname + url.search);
          window.dispatchEvent(
            new CustomEvent("bonnie:focus", {
              detail: {
                tab: detail?.tab,
                focus: detail?.focus,
                recordId: detail?.recordId,
                workflowId: detail?.workflowId,
                reason: detail?.reason,
              },
            }),
          );
        }
        toast.success(
          detail?.reason ||
            `Navigating to ${detail?.label || path.replace("/dashboard/", "").replace(/\//g, " › ")}`,
          { icon: "🧭", duration: 2800 },
        );
      }
    };
    window.addEventListener("bonnie:navigate", handleBonnieNav);
    return () => window.removeEventListener("bonnie:navigate", handleBonnieNav);
  }, []);
  const [invoices, setInvoices] = useState<Invoice[]>([]); // Initialize empty
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [projectViewMode, setProjectViewMode] = useState<"grid" | "list">(
    "list",
  );
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [taskSchedulerOpen, setTaskSchedulerOpen] = useState(false);
  const [celebration, setCelebration] = useState<{
    show: boolean;
    title: string;
    message: string;
  }>({
    show: false,
    title: "Done!",
    message: "",
  });

  // Celebrate completed work (invoice paid, campaign sent, Bonnie finished, etc.)
  useEffect(() => {
    const onCelebrate = (event: Event) => {
      const detail =
        (event as CustomEvent<{ title?: string; message?: string }>).detail ||
        {};
      setCelebration({
        show: true,
        title: detail.title || "Done!",
        message: detail.message || "Completed successfully.",
      });
    };
    window.addEventListener("action-celebration", onCelebrate as EventListener);
    return () =>
      window.removeEventListener(
        "action-celebration",
        onCelebrate as EventListener,
      );
  }, []);

  // Global Command Palette Hotkey (/)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Onboarding Flow (show only once per user)
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [totalClientCount, setTotalClientCount] = useState<number>(0);

  // Welcome Modal (show only once per user)
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !user?.id) return;

    let cancelled = false;

    const resolveGates = async () => {
      const { resolveOnboardingGate } =
        await import("@/lib/onboarding/resolveOnboardingGate");
      const gate = await resolveOnboardingGate(
        user.id,
        currentTenant?.id,
        (user as { user_metadata?: Record<string, unknown> }).user_metadata,
      );

      if (cancelled) return;

      setWelcomeOpen(!gate.welcomeSeen && !gate.establishedWorkspace);
      setShowOnboarding(!gate.onboardingCompleted);
    };

    resolveGates();
    return () => {
      cancelled = true;
    };
  }, [user.id, currentTenant?.id]);

  const [showProductTour, setShowProductTour] = useState(false);

  // Admin Tool States
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [generatedContract, setGeneratedContract] = useState("");
  const [isGeneratingContract, setIsGeneratingContract] = useState(false);

  const [architectModalOpen, setArchitectModalOpen] = useState(false);
  const [architectData, setArchitectData] = useState<ArchitectData | null>(
    null,
  );
  const [isArchitecting, setIsArchitecting] = useState(false);
  const [selectedProjectForTool, setSelectedProjectForTool] =
    useState<Project | null>(null);

  // Milestone Management
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [selectedProjectForMilestones, setSelectedProjectForMilestones] =
    useState<Project | null>(null);

  const { tasks: bgTasks } = useBackgroundTasks();
  const activeBgTasksCount = (bgTasks || []).filter(
    (t) => t.status === "running",
  ).length;

  const [isVoiceActive, setIsVoiceActive] = useState(false);

  // -- ISOLATION LOGIC --
  // Super Admin: sees ALL data across ALL tenants
  // Tenant Admin: sees all data within their tenant
  // Client: sees only their own data
  const filteredProjects = useMemo(
    () =>
      isPlatformAdminRole(user.role)
        ? projects || [] // Platform super admin sees everything
        : (projects || []).filter((p) => p.ownerId === user.id),
    [user.id, user.role, projects],
  );

  const filteredMessages = useMemo(
    () =>
      isPlatformAdminRole(user.role)
        ? messages || [] // Platform super admin sees everything
        : (messages || []).filter(
            (m) => m.senderId === user.id || m.recipientId === user.id,
          ),
    [user.id, user.role, messages],
  );

  const filteredInvoices = useMemo(
    () =>
      (user.role as UserRole) === "admin" ||
      (user.role as UserRole) === "tenant_admin"
        ? invoices || [] // Admin sees all (cross-tenant), tenant_admin sees tenant-scoped (from service)
        : (invoices || []).filter((i) => i.clientId === user.id),
    [user.id, user.role, invoices],
  );

  // Stats Logic
  const projectDays = useMemo(() => {
    if ((filteredProjects || []).length === 0) return 0;
    const oldest = Math.min(
      ...(filteredProjects || []).map((p) =>
        new Date(p.createdAt || Date.now()).getTime(),
      ),
    );
    return Math.floor((Date.now() - oldest) / (1000 * 60 * 60 * 24));
  }, [filteredProjects]);

  // Stats Logic - PRIORITIZE REAL DATA FROM RPC (No Placeholders)
  const currentStats: DashboardStat[] = useMemo(() => {
    const isAdmin =
      isPlatformAdminRole(user.role) || user.role === "tenant_admin";

    if (isAdmin) {
      return [
        {
          label: "Total Clients",
          value: (dashboardStats?.clientCount ?? 0).toString(),
          icon: Users,
          color: "bg-indigo-600",
        },
        {
          label: "Active Projects",
          value: (dashboardStats?.activeProjects ?? 0).toString(),
          icon: Briefcase,
          color: "bg-teal-600",
        },
        {
          label: "Total Revenue",
          value: `$${(dashboardStats?.totalRevenue ?? 0).toLocaleString()}`,
          icon: DollarSign,
          color: "bg-green-600",
        },
        {
          label: "Pending Revenue",
          value: `$${(dashboardStats?.pendingRevenue ?? 0).toLocaleString()}`,
          icon: AlertCircle,
          color: "bg-orange-600",
        },
      ];
    }

    // Client View
    const myProjectsCount = filteredProjects.length;
    const myMessagesCount =
      dashboardStats?.totalMessages ?? filteredMessages.length;
    const myDueRevenue =
      dashboardStats?.pendingRevenue ??
      filteredInvoices
        .filter((i) => i.status === "Unpaid")
        .reduce((acc: number, curr: Invoice) => acc + curr.amount, 0);

    return [
      {
        label: "My Projects",
        value: myProjectsCount.toString(),
        icon: Briefcase,
        color: "bg-teal-600",
      },
      {
        label: "Messages",
        value: myMessagesCount.toString(),
        icon: MessageSquare,
        color: "bg-blue-600",
      },
      {
        label: "Due Invoices",
        value: `$${myDueRevenue.toLocaleString()}`,
        icon: DollarSign,
        color: "bg-yellow-600",
      },
      {
        label: "Project Days",
        value: projectDays.toString(),
        icon: Clock,
        color: "bg-purple-600",
      },
    ];
  }, [
    user.role,
    dashboardStats,
    totalClientCount,
    projects,
    invoices,
    filteredProjects,
    filteredMessages,
    filteredInvoices,
    projectDays,
  ]);

  // Forms State
  const [newProject, setNewProject] = useState({
    name: "",
    category: "",
    description: "",
    image: "",
  });
  const [newMessage, setNewMessage] = useState("");

  // -- EDIT PROJECT STATE --
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState<Partial<Project>>({});

  // Determine Navigation Items based on Role
  const NAV_ITEMS = React.useMemo(() => {
    if (isPlatformAdminRole(user.role)) return ADMIN_NAV_ITEMS;
    if (user.role === "tenant_admin") return TENANT_ADMIN_NAV_ITEMS;
    return CLIENT_NAV_ITEMS;
  }, [user.role]);

  // Calculate unread message count
  const unreadMessageCount = (filteredMessages || []).filter(
    (m) => m.senderId !== user.id && !m.readAt,
  ).length;

  // Fetch projects function
  const refreshProjects = useCallback(async () => {
    console.log("[Dashboard] Refreshing projects for user:", user.id);
    // Only show loading if no projects (initial load or empty)
    if (projects.length === 0) setIsLoadingProjects(true);

    try {
      const { projects: fetchedProjects, error } =
        await projectService.getProjects(user.id, user.role);
      if (error) {
        console.error("[Dashboard] Project fetch error:", error);
        toast.error("Failed to load projects");
      } else if (fetchedProjects) {
        console.log("[Dashboard] Projects loaded:", fetchedProjects.length);
        setProjects(fetchedProjects);
        localStorage.setItem(
          `dashboard_projects_${user.id}`,
          JSON.stringify(fetchedProjects),
        );
      }
    } catch (err) {
      console.error("[Dashboard] Unexpected project fetch error:", err);
    } finally {
      setIsLoadingProjects(false);
    }
  }, [user.id, user.role, projects.length, setProjects]);

  // Fetch invoices function
  const refreshInvoices = useCallback(async () => {
    console.log("[Dashboard] Refreshing invoices for user:", user.id);
    try {
      let result;
      // Client/TenantAdmin fetches all invoices relevant to their tenant/business view
      if (isPlatformAdminRole(user.role) || user.role === "tenant_admin") {
        result = await paymentService.getAllInvoices(user.role); // Pass role for filtering
      } else {
        result = await paymentService.getUserInvoices(user.id);
      }

      if (result.error) {
        console.error("[Dashboard] Invoice fetch error:", result.error);
        toast.error("Failed to load invoices");
      } else if (result.invoices) {
        console.log("[Dashboard] Invoices loaded:", result.invoices.length);
        // Map to UI Invoice type
        const mappedInvoices = result.invoices.map((inv: any) => ({
          id: inv.id,
          projectId: inv.project_id || "",
          projectName: inv.project?.name || "General Service",
          clientId: inv.user_id,
          amount: inv.amount,
          status:
            inv.status === "paid"
              ? "Paid"
              : new Date(inv.due_date) < new Date()
                ? "Overdue"
                : "Unpaid",
          dueDate: new Date(inv.due_date).toLocaleDateString(),
          description: inv.description,
        })) as Invoice[];
        setInvoices(mappedInvoices);
        localStorage.setItem(
          `dashboard_invoices_${user.id}`,
          JSON.stringify(mappedInvoices),
        );
      }
    } catch (err) {
      console.error("[Dashboard] Unexpected invoice fetch error:", err);
    }
  }, [user.id, user.role, setInvoices]);

  // OPTIMIZED: Load core data once tenant is available (projects, invoices, messages)
  useEffect(() => {
    if (!currentTenant?.id) return;
    if (dataLoadedRef.current === currentTenant.id) return;
    dataLoadedRef.current = currentTenant.id;

    // 1. Restore from cache immediately for instant UI
    try {
      const cachedProjects = localStorage.getItem(
        `dashboard_projects_${user.id}`,
      );
      if (cachedProjects) setProjects(JSON.parse(cachedProjects));

      const cachedInvoices = localStorage.getItem(
        `dashboard_invoices_${user.id}`,
      );
      if (cachedInvoices) setInvoices(JSON.parse(cachedInvoices));

      const cachedMessages = localStorage.getItem(
        `dashboard_messages_${user.id}`,
      );
      if (cachedMessages) setMessages(JSON.parse(cachedMessages));
    } catch (e) {
      console.error("Cache load error", e);
    }

    const loadAllData = async () => {
      const isAdmin =
        isPlatformAdminRole(user.role) || user.role === "tenant_admin";

      const promises: Promise<any>[] = [
        refreshProjects(),
        refreshInvoices(),
        messageService
          .getMessages(user.id, isAdmin, 10)
          .then(({ messages: fetchedMessages, error }) => {
            if (!error && fetchedMessages) {
              setMessages(fetchedMessages);
              localStorage.setItem(
                `dashboard_messages_${user.id}`,
                JSON.stringify(fetchedMessages),
              );
            }
          }),
      ];

      if (isPlatformAdminRole(user.role)) {
        promises.push(
          userService.getUsers().then(({ users, error }) => {
            if (!error && users) {
              const count = (users || []).filter(
                (u) => u.role === "client",
              ).length;
              setTotalClientCount(count);
            }
          }),
        );
      }

      await Promise.all(promises);
    };

    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant?.id, user.id]); // Re-run when tenant becomes available

  const refreshStats = useCallback(async () => {
    if (!currentTenant?.id) return;
    try {
      const { stats } = await getDashboardStats(currentTenant.id, user.id);
      if (stats) setDashboardStats(stats);
    } catch (err) {
      console.error("[Dashboard] Stats refresh error:", err);
    }
  }, [currentTenant?.id, user.id, getDashboardStats]);

  // Load dashboard stats separately — re-runs only when tenant ID changes
  useEffect(() => {
    if (!currentTenant?.id) return;
    if (lastTenantIdRef.current === currentTenant.id) return; // already loaded for this tenant
    lastTenantIdRef.current = currentTenant.id;

    refreshStats();
  }, [currentTenant?.id, user.id, refreshStats]);

  // PRELOAD: Prefetch the most-visited lazy tabs sequentially in the background after mount
  // so they're already downloaded when the user clicks them (eliminates Suspense delay)
  useEffect(() => {
    const preloadTabs = async () => {
      const tabs = [
        () => import("./dashboard/CRMTab"),
        () => import("./dashboard/FinanceTab"),
        () => import("./dashboard/TasksTab"),
        () => import("./dashboard/QuotesTab"),
        () => import("./dashboard/DealsTab"),
        () => import("./dashboard/AnalyticsTab"),
      ];

      for (const preloader of tabs) {
        // Wait for idle or small delay before next chunk
        if ("requestIdleCallback" in window) {
          await new Promise((resolve) =>
            requestIdleCallback(() => resolve(null), { timeout: 2000 }),
          );
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        preloader().catch(() => {}); // Fire and forget
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
    if (!currentTenant?.id) return;
    const isAdmin =
      isPlatformAdminRole(user.role) || user.role === "tenant_admin";
    // ✅ Now uses filtered subscription - gets INSERT + UPDATE for instant read receipts
    const unsubscribe = messageService.subscribeToMessages(
      user.id,
      isAdmin,
      (newMessage, eventType) => {
        setMessages((prev) => {
          if (eventType === "INSERT") {
            // Deduplicate based on ID for new messages
            if (prev.some((m) => m.id === newMessage.id)) return prev;

            // Notification Logic
            if (
              newMessage.senderId !== user.id &&
              activeTabRef.current !== "/dashboard/messages"
            ) {
              import("react-hot-toast").then(({ toast }) => {
                toast.success(`New message from ${newMessage.senderName}`, {
                  duration: 4000,
                  position: "top-right",
                });
              });
            }

            return [...prev, newMessage];
          } else if (eventType === "UPDATE") {
            // Update existing message (for read receipts, delivered status, etc.)
            return prev.map((m: ChatMessage) =>
              m.id === newMessage.id ? newMessage : m,
            );
          }
          return prev;
        });
      },
    );
    return () => unsubscribe();
  }, [user.id, user.role, currentTenant?.id]);

  // Log Navigation - DEFERRED: Don't block dashboard render
  useEffect(() => {
    // Use requestIdleCallback to defer non-critical activity logging
    if ("requestIdleCallback" in window) {
      requestIdleCallback(
        () => {
          import("../services/activityService").then(({ activityService }) => {
            activityService.logNavigation(user.id, activeTab);
          });
        },
        { timeout: 2000 },
      );
    } else {
      setTimeout(() => {
        import("../services/activityService").then(({ activityService }) => {
          activityService.logNavigation(user.id, activeTab);
        });
      }, 100);
    }
  }, [activeTab, user.id]);

  // Subscribe to real-time projects
  useEffect(() => {
    if (!currentTenant?.id) return;
    const unsubscribe = projectService.subscribeToProjects((updatedProject) => {
      setProjects((prev) => {
        const exists = prev.find((p) => p.id === updatedProject.id);
        if (exists) {
          return prev.map((p: Project) =>
            p.id === updatedProject.id ? updatedProject : p,
          );
        } else {
          return [updatedProject, ...prev];
        }
      });
    });
    return () => unsubscribe();
  }, [currentTenant?.id]);

  const handleAddProject = async () => {
    if (!newProject.name) {
      toast.error("Please enter a project name");
      return;
    }

    try {
      const projectData = {
        ownerId: user.id,
        ownerName: user.name,
        name: newProject.name,
        category: newProject.category || "Custom Request",
        status: "Pending" as const,
        currentStage: "Initiation" as const,
        progress: 0,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        team: [],
        image:
          newProject.image ||
          "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1470&auto=format&fit=crop",
        description: newProject.description,
      };

      const { project, error } =
        await projectService.createProject(projectData);

      if (error) {
        console.error("Project creation error:", error);
        toast.error(`Failed to create project: ${error}`);
        return;
      }

      if (project) {
        setProjects((prev) => [project, ...prev]);
        setNewProject({ name: "", category: "", description: "", image: "" });
        toast.success("Project submitted successfully!");

        // Refresh stats to update Momentum HUD
        refreshStats();

        if (user.role === "client") router.push("/dashboard/projects");
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      toast.error("An unexpected error occurred. Please try again.");
    }
  };

  const handleSendMessage = async (
    text: string = newMessage,
    recipientId?: string,
    attachments: any[] = [],
    priority: "normal" | "high" | "urgent" = "normal",
  ) => {
    if (!text.trim() && attachments.length === 0) return;

    // For clients, find admin ID if not provided
    let finalRecipientId = recipientId;
    if (!finalRecipientId && user.role === "client") {
      try {
        const { userService } = await import("../services/userService");
        const { adminId, error } = await userService.getSystemAdmin();

        if (adminId) {
          finalRecipientId = adminId;
        } else {
          console.error("No admin found:", error);
          import("react-hot-toast").then(({ toast }) => {
            toast.error(
              "Unable to find support admin. Please contact support.",
            );
          });
          return;
        }
      } catch (err) {
        console.error("Error fetching admin user:", err);
        import("react-hot-toast").then(({ toast }) => {
          toast.error("Failed to load recipient. Please try again.");
        });
        return;
      }
    }

    if (isPlatformAdminRole(user.role) && !finalRecipientId) {
      import("react-hot-toast").then(({ toast }) => {
        toast.error("Please select a recipient first.");
      });
      return;
    }

    // Ensure we have a valid recipient ID
    if (!finalRecipientId) {
      console.error("No recipient ID provided");
      import("react-hot-toast").then(({ toast }) => {
        toast.error("No recipient selected. Please try again.");
      });
      return;
    }

    console.log("Sending message:", {
      senderId: user.id,
      recipientId: finalRecipientId,
      text: text.substring(0, 50),
    });

    // Optimistic Update
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      role: isPlatformAdminRole(user.role) ? "model" : "user",
      senderId: user.id,
      senderName: user.name,
      recipientId: finalRecipientId,
      text: text,
      timestamp: new Date(),
      attachments: attachments,
      priority: priority,
      readAt: null,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage(""); // Clear immediately

    try {
      const { message, error } = await messageService.sendMessage(
        user.id,
        user.name,
        isPlatformAdminRole(user.role) ? "model" : "user",
        text,
        finalRecipientId,
        attachments,
        priority,
      );

      if (error) {
        console.error("Message send error:", error);
        // Rollback if error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        import("react-hot-toast").then(({ toast }) => {
          if (error.startsWith("UNAUTHORIZED_LINKS:")) {
            toast.error(error.replace("UNAUTHORIZED_LINKS:", "").trim(), {
              duration: 6000,
            });
          } else {
            toast.error(`Failed to send: ${error}`);
          }
        });
      } else if (message) {
        console.log("Message sent successfully:", message.id);
        // Replace temp with real
        setMessages((prev) => prev.map((m) => (m.id === tempId ? message : m)));
        // Play notification sound
        playNotificationSound();

        // Log activity
        import("../services/activityService").then(({ activityService }) => {
          activityService
            .logActivity(
              user.id,
              "Message Sent",
              {
                messageId: message.id,
                recipientId: finalRecipientId,
                hasAttachments: attachments.length > 0,
                priority: priority,
                textLength: text.length,
              },
              currentTenant?.id,
            )
            .catch((err) => console.error("Failed to log activity:", err));
        });
      } else {
        // No message returned but no error - still rollback
        console.error("No message returned from server");
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        import("react-hot-toast").then(({ toast }) => {
          toast.error("Message failed - no response from server");
        });
      }
    } catch (err) {
      console.error("Unexpected error sending message:", err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      import("react-hot-toast").then(({ toast }) => {
        toast.error("Unexpected error. Please try again.");
      });
    }
  };

  // Notification sound function
  const playNotificationSound = () => {
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.5,
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (err) {
      console.log("Could not play notification sound:", err);
    }
  };

  // -- ADMIN ACTIONS --
  const startEditProject = (p: Project) => {
    setEditingProject(p);
    setEditForm({ ...p });
  };

  const saveProjectEdit = async () => {
    if (!editingProject) return;
    const { error } = await projectService.updateProject(
      editingProject.id,
      editForm,
    );
    if (!error) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === editingProject.id ? { ...p, ...editForm } : p,
        ),
      );
      setEditingProject(null);
    }
  };

  const declineProject = async (p: Project) => {
    if (
      confirm("Are you sure you want to decline this project consultation?")
    ) {
      const { error } = await projectService.updateProject(p.id, {
        status: "Declined",
      });
      if (!error) {
        setProjects((prev) =>
          prev.map((proj) =>
            proj.id === p.id ? { ...proj, status: "Declined" } : proj,
          ),
        );
      }
    }
  };

  const openArchitectTool = async (p: Project) => {
    setSelectedProjectForTool(p);
    setArchitectModalOpen(true);
    setIsArchitecting(true);

    const prompt = `Generate technical architecture specs for a ${p.category || "Web Application"} project described as: "${p.description || "A new custom software project"}". Return ONLY a valid JSON object with keys: techStack (string), developmentPrompt (string), architectureDiagram (string description).`;

    const { text } = await generateText(
      prompt,
      1024,
      "claude-sonnet-4-5-20250929",
    );

    try {
      const cleanJson = (text || "{}")
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      const data = JSON.parse(cleanJson);
      setArchitectData(data);
    } catch (e) {
      console.error("Failed to parse architecture specs:", e);
      setArchitectData({
        techStack: "React, Node.js, Supabase",
        developmentPrompt: "Build a scalable app...",
        architectureDiagram: "Client -> CDN -> Server -> DB",
      });
    }

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
          setTimeout(() => reject(new Error("AI generation timeout")), 30000),
        );

        const generationPromise = generateContract(
          p.ownerName || "Client",
          p.name,
        );

        const contract = await Promise.race([
          generationPromise,
          timeoutPromise,
        ]);

        if (contract) {
          setGeneratedContract(contract);
        } else {
          // Fallback to template
          console.warn("AI generation returned empty, using template");
          const template =
            await import("../services/alphacloneContractTemplate").then((m) =>
              m.generateContractFromTemplate(
                p.ownerName || "Client",
                p.name,
                p.description || "",
                currentTenant?.name || "Authorized Service Provider",
              ),
            );
          setGeneratedContract(template);
        }
      } catch (error) {
        console.error("Contract generation error:", error);

        // Fallback to template on any error
        import("react-hot-toast").then(({ toast }) => {
          toast.error("AI generation unavailable, using template");
        });

        const template =
          await import("../services/alphacloneContractTemplate").then((m) =>
            m.generateContractFromTemplate(
              p.ownerName || "Client",
              p.name,
              p.description || "",
              currentTenant?.name || "Authorized Service Provider",
            ),
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
      const { error } = await projectService.updateProject(
        selectedProjectForTool.id,
        {
          contractStatus: "Sent",
          contractText: generatedContract,
        },
      );

      if (!error) {
        // Optimistic / Local update (though subscription might handle it)
        setProjects((prev) =>
          prev.map((p) =>
            p.id === selectedProjectForTool.id
              ? {
                  ...p,
                  contractStatus: "Sent",
                  contractText: generatedContract,
                }
              : p,
          ),
        );
        toast.success(
          `Contract generated and sent to ${selectedProjectForTool.ownerName || "Client"}.`,
        );
        setContractModalOpen(false);
      } else {
        toast.error("Failed to send contract: " + error);
      }
    }
  };

  const updateProjectStage = async (
    projectId: string,
    newStage: ProjectStage,
  ) => {
    // Auto update progress based on stage
    let newProgress = 0;
    if (newStage === "Initiation") newProgress = 10;
    if (newStage === "Planning") newProgress = 30;
    if (newStage === "Execution") newProgress = 60;
    if (newStage === "Review") newProgress = 80;
    if (newStage === "Closure") newProgress = 100;

    const updates: Partial<Project> = {
      currentStage: newStage,
      progress: newProgress,
      status:
        newStage === "Closure" ? ("Completed" as const) : ("Active" as const),
    };

    const { error } = await projectService.updateProject(projectId, updates);
    if (!error) {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id === projectId) {
            return {
              ...p,
              currentStage: newStage,
              progress: newProgress,
              status: (updates.status || p.status) as Project["status"],
            };
          }
          return p;
        }),
      );
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
      const response = await fetch(
        "/api/stripe/create-legacy-invoice-session",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: selectedInvoice.id }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.url)
        throw new Error(payload.error || "Secure checkout is unavailable");
      window.location.assign(payload.url);
    } catch (err) {
      console.error("Payment error:", err);
      import("react-hot-toast").then(({ toast }) => {
        toast.error("Payment processing error. Please try again.");
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
      if ("requestIdleCallback" in window) {
        requestIdleCallback(
          () => {
            import("../services/activityService").then(
              ({ activityService }) => {
                activityService
                  .logActivity(
                    user.id,
                    `Navigated to ${activeTab}`,
                    { path: activeTab },
                    currentTenant?.id,
                  )
                  .catch(() => {});
              },
            );
          },
          { timeout: 3000 },
        );
      } else {
        import("../services/activityService").then(({ activityService }) => {
          activityService
            .logActivity(
              user.id,
              `Navigated to ${activeTab}`,
              { path: activeTab },
              currentTenant?.id,
            )
            .catch(() => {});
        });
      }
    }, 1000); // Wait 1 second before tracking to ensure they actually landed on the tab

    return () => clearTimeout(timer);
  }, [user.id, activeTab]);

  // Global Dashboard Heartbeat (run once on mount, independent of activeTab)
  useEffect(() => {
    const heartbeatInterval = setInterval(
      () => {
        import("../services/activityService").then(({ activityService }) => {
          activityService
            .logActivity(
              user.id,
              "User Active",
              { source: "dashboard_heartbeat" },
              currentTenant?.id,
            )
            .catch(() => {});
        });
      },
      5 * 60 * 1000,
    ); // 5 minutes instead of 2 minutes to reduce DB load

    return () => clearInterval(heartbeatInterval);
  }, [user.id]);

  // -- RENDER CONTENT --
  const handleShareProject = async (projectId: string) => {
    try {
      const { token, error } =
        await projectService.ensurePortalToken(projectId);
      if (error || !token) {
        toast.error("Could not create a secure client link");
        return;
      }
      const url = `${window.location.origin}/p/${token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Client portal link copied");
    } catch {
      toast.error("Failed to copy share link");
    }
  };

  const renderContent = () => {
    const sharedRoute = renderSharedDashboardRoute(activeTab, user);
    if (sharedRoute) return sharedRoute;

    switch (activeTab) {
      case "/dashboard/conference":
      case "/dashboard/meetings":
        return (
          <React.Suspense fallback={<TabSkeleton rows={4} showStats={false} />}>
            <WidgetErrorBoundary
              title={
                activeTab === "/dashboard/meetings"
                  ? "Meetings"
                  : "Video Conference"
              }
            >
              <ConferenceTab user={user} />
            </WidgetErrorBoundary>
          </React.Suspense>
        );

      case "/dashboard/messages":
        return (
          <React.Suspense fallback={<TabSkeleton rows={5} showStats={false} />}>
            <MessagesTab
              user={user}
              filteredMessages={filteredMessages}
              newMessage={newMessage}
              setNewMessage={setNewMessage}
              handleSendMessage={handleSendMessage}
              initialSelectedClientId={searchParams?.get("selectedClientId")}
            />
          </React.Suspense>
        );

      case "/dashboard/comms":
        return (
          <React.Suspense fallback={<TabSkeleton rows={4} showStats={false} />}>
            <CommunicationHub user={user} />
          </React.Suspense>
        );

      case "/dashboard/mail":
        return (
          <React.Suspense fallback={<TabSkeleton rows={4} showStats={false} />}>
            <CommunicationHub user={user} />
          </React.Suspense>
        );

      case "/dashboard/ai-studio":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <AIStudioTab user={user} />
          </React.Suspense>
        );

      case "/dashboard/marketplace":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <MarketplacePage />
          </React.Suspense>
        );

      // New Enterprise Views
      case "/dashboard/admin":
      case "/dashboard/admin/overview":
        return isPlatformAdminRole(user.role) ? (
          <React.Suspense fallback={<TabSkeleton />}>
            <SuperAdminDashboardTab />
          </React.Suspense>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8">
            <ShieldCheck className="w-12 h-12 text-slate-500 mb-4" />
            <h2 className="text-lg font-bold text-white">Access restricted</h2>
            <p className="text-slate-400 text-sm mt-2">
              Platform administrator access required.
            </p>
          </div>
        );

      case "/dashboard/admin/audit":
        return isPlatformAdminRole(user.role) ? (
          <React.Suspense fallback={<TabSkeleton />}>
            <SuperAdminAuditTab />
          </React.Suspense>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8">
            <ShieldCheck className="w-12 h-12 text-slate-500 mb-4" />
            <h2 className="text-lg font-bold text-white">Access restricted</h2>
            <p className="text-slate-400 text-sm mt-2">
              Platform administrator access required.
            </p>
          </div>
        );

      case "/dashboard/admin/tenants":
        return isPlatformAdminRole(user.role) ? (
          <React.Suspense fallback={<TabSkeleton />}>
            <SuperAdminTenantsTab />
          </React.Suspense>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8">
            <ShieldCheck className="w-12 h-12 text-slate-500 mb-4" />
            <h2 className="text-lg font-bold text-white">Access restricted</h2>
            <p className="text-slate-400 text-sm mt-2">
              Platform administrator access required.
            </p>
          </div>
        );

      case "/dashboard/admin/subscriptions":
        return isPlatformAdminRole(user.role) ? (
          <React.Suspense fallback={<TableSkeleton rows={10} columns={5} />}>
            <SuperAdminSubscriptionsTab />
          </React.Suspense>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8">
            <ShieldCheck className="w-12 h-12 text-slate-500 mb-4" />
            <h2 className="text-lg font-bold text-white">Access restricted</h2>
            <p className="text-slate-400 text-sm mt-2">
              Platform administrator access required.
            </p>
          </div>
        );

      case "/dashboard/admin/users":
        return isPlatformAdminRole(user.role) ? (
          <React.Suspense fallback={<TableSkeleton rows={10} columns={4} />}>
            <SuperAdminUsersTab />
          </React.Suspense>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8">
            <ShieldCheck className="w-12 h-12 text-slate-500 mb-4" />
            <h2 className="text-lg font-bold text-white">Access restricted</h2>
            <p className="text-slate-400 text-sm mt-2">
              Platform administrator access required.
            </p>
          </div>
        );

      case "/dashboard/admin/improvements":
        return isPlatformAdminRole(user.role) ? (
          <React.Suspense fallback={<TableSkeleton rows={10} columns={4} />}>
            <ImprovementsPage />
          </React.Suspense>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8">
            <ShieldCheck className="w-12 h-12 text-slate-500 mb-4" />
            <h2 className="text-lg font-bold text-white">Access restricted</h2>
            <p className="text-slate-400 text-sm mt-2">
              Platform administrator access required.
            </p>
          </div>
        );

      case "/dashboard/admin/settings":
        return isPlatformAdminRole(user.role) ? (
          <React.Suspense fallback={<TabSkeleton />}>
            <GlobalSettingsTab />
          </React.Suspense>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8">
            <ShieldCheck className="w-12 h-12 text-slate-500 mb-4" />
            <h2 className="text-lg font-bold text-white">Access restricted</h2>
            <p className="text-slate-400 text-sm mt-2">
              Platform administrator access required.
            </p>
          </div>
        );

      case "/dashboard/admin/operations":
        return isPlatformAdminRole(user.role) ? (
          <React.Suspense fallback={<TabSkeleton />}>
            <OperationsConsoleTab />
          </React.Suspense>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8">
            <ShieldCheck className="w-12 h-12 text-slate-500 mb-4" />
            <h2 className="text-lg font-bold text-white">Access restricted</h2>
            <p className="text-slate-400 text-sm mt-2">
              Platform administrator access required.
            </p>
          </div>
        );

      case "/dashboard/security":
        return isPlatformAdminRole(user.role) ? (
          <React.Suspense fallback={<TabSkeleton />}>
            <SecurityDashboard user={user} />
          </React.Suspense>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8">
            <ShieldCheck className="w-12 h-12 text-slate-500 mb-4" />
            <h2 className="text-lg font-bold text-white">Access restricted</h2>
            <p className="text-slate-400 text-sm mt-2">
              Platform administrator access required.
            </p>
          </div>
        );

      case "/dashboard/analytics":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <InsightsHub>
              <div data-tour="analytics">
                <AnalyticsTab />
              </div>
            </InsightsHub>
          </React.Suspense>
        );

      case "/dashboard/performance":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <InsightsHub>
              <BusinessPerformanceDashboard />
            </InsightsHub>
          </React.Suspense>
        );

      case "/dashboard/clients":
      case "/dashboard/contacts":
      case "/dashboard/leads":
      case "/dashboard/crm/unified-contacts":
        return (
          <React.Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
            <ClientsPage user={user} />
          </React.Suspense>
        );

      case "/dashboard/leads/campaigns":
        return (
          <React.Suspense fallback={<TableSkeleton rows={8} columns={5} />}>
            <ScraperCampaignsPage />
          </React.Suspense>
        );

      case "/dashboard/crm/reports":
        return (
          <React.Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
            <CRMReportsTab />
          </React.Suspense>
        );

      case "/dashboard/crm/console":
        return (
          <React.Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
            <SalesConsole />
          </React.Suspense>
        );

      case "/dashboard/crm/accounts":
        return (
          <React.Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
            <AccountsPage />
          </React.Suspense>
        );

      case "/dashboard/crm/follow-ups":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <FollowUpQueue />
          </React.Suspense>
        );

      case "/dashboard/business/cash-flow":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <CashFlowForecastTab />
          </React.Suspense>
        );

      case "/dashboard/business/expenses":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <ExpenseTrackerTab />
          </React.Suspense>
        );

      case "/dashboard/business/reports":
      case "/dashboard/reporting":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <ReportsPage user={user} />
          </React.Suspense>
        );

      case "/dashboard/business/tasks":
        return (
          <React.Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
            <TaskScheduler />
          </React.Suspense>
        );

      case "/dashboard/business/workflows":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <WorkflowDashboard />
          </React.Suspense>
        );

      case "/dashboard/executive":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <ExecutiveDashboard />
          </React.Suspense>
        );

      case "/dashboard/accounting/banking":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <BankingCenterPage />
          </React.Suspense>
        );

      case "/dashboard/business/ingestion":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <IngestionPanel />
          </React.Suspense>
        );

      case "/dashboard/business/projects":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <ProjectsPage user={user} />
          </React.Suspense>
        );

      case "/dashboard/business/projects/manage":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <ProjectsPage user={user} />
          </React.Suspense>
        );

      case "/dashboard/contact-submissions":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <ContactSubmissionsTab />
          </React.Suspense>
        );

      case "/dashboard/sales-agent":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <AIAgentsTab />
          </React.Suspense>
        );

      case "/dashboard/bonnie":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <BonnieFullView />
          </React.Suspense>
        );

      case "/dashboard/bonnie/approvals":
      case "/dashboard/business/bonnie/approvals":
        return <ApprovalCenter />;

      case "/dashboard/business/bonnie":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <BonnieFullView />
          </React.Suspense>
        );

      case "/dashboard/tickets":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <DeepDeskView />
          </React.Suspense>
        );

      case "/dashboard/gamification":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <GamificationTab />
          </React.Suspense>
        );

      case "/dashboard/zoho/mail":
        return (
          <React.Suspense fallback={<TabSkeleton rows={6} showStats={false} />}>
            <div className="h-full p-3 md:p-5">
              <UnifiedInbox defaultProvider="zoho" />
            </div>
          </React.Suspense>
        );

      case "/dashboard/zoho/crm":
        return (
          <React.Suspense fallback={<TabSkeleton rows={3} />}>
            <ZohoCRMIntegration />
          </React.Suspense>
        );

      case "/dashboard/onboarding":
        return <OnboardingPipelines user={user} />;

      case "/dashboard/tasks":
        return (
          <React.Suspense fallback={<TableSkeleton rows={8} columns={5} />}>
            <TasksTab user={user} />
          </React.Suspense>
        );

      case "/dashboard/deals":
        return (
          <React.Suspense fallback={<TableSkeleton rows={8} columns={5} />}>
            <DealsTab user={user} />
          </React.Suspense>
        );

      case "/dashboard/crm":
        return <CrmDashboard />;

      case "/dashboard/crm/workspace":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <CRMTab user={user} />
          </React.Suspense>
        );

      case "/dashboard/outreach":
        return <OutreachDashboard />;

      case "/dashboard/email-campaigns":
      case "/dashboard/business/campaigns":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <EmailCampaignsPage userId={user.id} />
          </React.Suspense>
        );

      case "/dashboard/whatsapp":
      case "/dashboard/business/whatsapp":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <WhatsAppManagementPage />
          </React.Suspense>
        );

      case "/dashboard/social":
      case "/dashboard/business/social":
        return <SocialDashboard />;

      case "/dashboard/social/compose":
      case "/dashboard/business/social/compose":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <SocialMediaComposer />
          </React.Suspense>
        );

      case "/dashboard/forecast":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <SalesForecastTab />
          </React.Suspense>
        );

      case "/dashboard/quotes":
        return (
          <React.Suspense fallback={<TableSkeleton rows={8} columns={5} />}>
            <QuotesTab user={user} />
          </React.Suspense>
        );

      case "/dashboard/calendar":
        return (
          <React.Suspense fallback={<TabSkeleton rows={4} showStats={false} />}>
            <CalendarComponent user={user} />
          </React.Suspense>
        );

      case "/dashboard/finance":
        return <InvoicingDashboard />;

      case "/dashboard/finance/manage":
        return (
          <React.Suspense fallback={<TableSkeleton rows={8} columns={6} />}>
            <EnhancedBillingPage user={user} />
          </React.Suspense>
        );

      case "/dashboard/contracts":
        return <ContractsDashboard />;

      case "/dashboard/contracts/manage":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <div className="w-full h-full bg-slate-950 p-2 sm:p-4 rounded-3xl overflow-y-auto">
              <ContractDashboard user={user} />
            </div>
          </React.Suspense>
        );

      case "/dashboard/articles":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <ArticleEditor />
          </React.Suspense>
        );

      case "/dashboard/accounting":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <AccountingDashboard />
          </React.Suspense>
        );

      case "/dashboard/settings":
        return <SettingsPage user={user} />;

      case "/dashboard/pwa-settings":
        return (
          <PwaSettingsScreen
            user={user}
            onBack={() => setActiveTab("/dashboard")}
          />
        );

      case "/dashboard/submit":
        return (
          <ProjectSubmitTab
            newProject={newProject}
            setNewProject={setNewProject}
            handleAddProject={handleAddProject}
          />
        );

      case "/dashboard/portfolio-manager":
        return (
          <PortfolioShowcase
            projects={filteredProjects}
            isAdmin={isPlatformAdminRole(user.role)}
            onRefresh={refreshProjects}
            userId={user.id}
          />
        );

      case "/dashboard/projects":
        return (
          <div data-tour="projects">
            <ProjectsDashboard />
          </div>
        );

      case "/dashboard/projects/manage":
        return (
          <React.Suspense fallback={<TabSkeleton />}>
            <ProjectsPage user={user} />
          </React.Suspense>
        );

      default:
        if (location === "/dashboard" || location === "/dashboard/business") {
          if (isPlatformAdminRole(user.role)) {
            return (
              <div data-tour="platform-owner-home">
                <React.Suspense fallback={<TabSkeleton />}>
                  <PlatformOwnerHome />
                </React.Suspense>
              </div>
            );
          }
          return (
            <div data-tour="dashboard-overview">
              <React.Suspense fallback={<TabSkeleton />}>
                <OperatingSystemHome />
              </React.Suspense>
            </div>
          );
        }
        return (
          <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
            <h2 className="text-lg font-bold text-white mb-2">
              This section is not available
            </h2>
            <p className="text-sm text-slate-400 max-w-md mb-6">
              The page{" "}
              <span className="text-slate-300 font-mono text-xs">
                {activeTab}
              </span>{" "}
              could not be loaded for your account role.
            </p>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold"
            >
              Back to dashboard
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen min-w-0 flex overflow-hidden font-sans selection:bg-[var(--brand-blue-500)]/30 ac-dashboard-root ac-workspace-canvas [height:100dvh]">
      <SkipToMainContent />
      <ConnectionStatus />

      <WelcomeModal
        isOpen={welcomeOpen}
        onClose={() => {
          if (typeof window !== "undefined") {
            localStorage.setItem(`welcome_seen_${user.id}`, "true");
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
            if (typeof window !== "undefined") {
              localStorage.setItem(`onboarding_completed_${user.id}`, "true");
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
            <div className="text-2xl sm:text-3xl font-bold text-white">
              ${selectedInvoice?.amount.toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Invoice #{selectedInvoice?.id.toUpperCase()}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
            Card details are collected on Stripe&apos;s hosted checkout and
            never pass through AlphaClone.
          </div>
          <Button
            onClick={processPayment}
            className="w-full h-12 text-lg"
            isLoading={isProcessingPayment}
          >
            <CreditCard className="mr-2 h-5 w-5" />
            {isProcessingPayment
              ? "Opening secure checkout…"
              : `Continue to pay $${selectedInvoice?.amount.toLocaleString()}`}
          </Button>

          <p className="text-center text-xs text-slate-500 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Payments are processed securely
            by Stripe Checkout
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
      <Modal
        isOpen={architectModalOpen}
        onClose={() => setArchitectModalOpen(false)}
        title="Project Architect View"
      >
        {isArchitecting ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-400">
              AI is designing system architecture...
            </p>
          </div>
        ) : architectData ? (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
            <div>
              <h4 className="text-teal-400 font-bold mb-2 flex items-center gap-2">
                <Layers className="w-4 h-4" /> Tech Stack
              </h4>
              <div className="bg-slate-950 p-3 rounded-lg text-sm text-slate-300">
                {architectData.techStack}
              </div>
            </div>

            <div>
              <h4 className="text-blue-400 font-bold mb-2 flex items-center gap-2">
                <Code className="w-4 h-4" /> Development Prompt (Copy for AI)
              </h4>
              <div className="relative">
                <textarea
                  className="w-full h-32 bg-slate-950 text-slate-400 text-xs p-3 rounded-lg font-mono"
                  readOnly
                  value={architectData.developmentPrompt}
                />
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(
                      architectData.developmentPrompt,
                    )
                  }
                  className="absolute top-2 right-2 p-1 bg-slate-800 rounded hover:bg-slate-700"
                >
                  <Copy className="w-3 h-3 text-white" />
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-indigo-400 font-bold mb-2 flex items-center gap-2">
                <Cpu className="w-4 h-4" /> Mermaid.js Architecture
              </h4>
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
        title={`Manage Phases: ${selectedProjectForMilestones?.name || "Project"}`}
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
              value={editForm.name || ""}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-400">Status</label>
            <select
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-teal-500"
              value={editForm.status || "Pending"}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  status: e.target.value as Project["status"],
                })
              }
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
              <span className="text-teal-400 font-bold">
                {editForm.progress}%
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              className="w-full accent-teal-500"
              value={editForm.progress || 0}
              onChange={(e) =>
                setEditForm({ ...editForm, progress: parseInt(e.target.value) })
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-400">Due Date</label>
            <Input
              type="date"
              value={editForm.dueDate || ""}
              onChange={(e) =>
                setEditForm({ ...editForm, dueDate: e.target.value })
              }
            />
          </div>

          <div className="pt-4 flex gap-3">
            <Button onClick={saveProjectEdit} className="flex-1">
              Save Changes
            </Button>
            <Button onClick={() => setEditingProject(null)} variant="outline">
              Cancel
            </Button>
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
        activeBgTasksCount={activeBgTasksCount}
        onStartTour={() => setShowProductTour(true)}
        isVoiceActive={isVoiceActive}
        onToggleVoice={() => setIsVoiceActive(!isVoiceActive)}
        data-tour="navigation"
      />

      {/* Removed "Back to Navigation" button as per user request */}

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onNavigate={(href) => setActiveTab(href)}
        onToggleMenu={() => setSidebarOpen(true)}
        unreadCount={unreadMessageCount}
        userRole={user.role}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden ac-workspace-canvas ac-dashboard-shell-bg [height:100dvh]">
        <LegacyAccessBanner />
        <TrialBanner />
        {/* Header - Visible in all dashboard views */}
        <header
          className={`sticky top-0 z-30 pt-safe ac-dashboard-header ac-workspace-toolbar ${WORKSPACE.toolbar.height} ${activeTab === "/dashboard/pwa-settings" ? "hidden md:block" : ""}`}
        >
          <div
            className={`flex items-center justify-between h-full ${WORKSPACE.toolbar.padding}`}
          >
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Mobile Menu Toggle - Hidden if BottomNav handles it */}
              {/* Mobile Menu Toggle removed - BottomNav handles it */}

              <div className="flex items-center gap-2 sm:gap-3 md:hidden">
                <Image
                  src={LOGO_URL}
                  alt="Logo"
                  width={32}
                  height={32}
                  className="rounded-lg flex-shrink-0"
                />
                <h1 className="pwa-page-title text-white whitespace-nowrap truncate max-w-[150px] sm:max-w-none ac-dashboard-mobile-title">
                  {t(APP_NAME)}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-shrink-0">
              <div className="hidden md:flex items-center shrink-0">
                <MomentumHUD
                  score={dashboardStats?.momentumScore || 0}
                  streak={dashboardStats?.loginStreak || 0}
                  activity24h={dashboardStats?.activity24h || 0}
                  newLeads={dashboardStats?.newLeads24h || 0}
                  variant="global"
                />
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {activeMeetingCallId && (
                  <button
                    onClick={() => router.push(`/meet/${activeMeetingCallId}`)}
                    className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/30 text-teal-300 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-teal-500/20 transition-colors"
                    title="Return to active meeting"
                  >
                    <Video className="w-3.5 h-3.5" />
                    Return to Meeting
                  </button>
                )}
                {activeBgTasksCount > 0 && (
                  <div className="flex items-center gap-2 bg-slate-800/50 text-teal-400 px-3 py-1.5 rounded-full text-xs font-semibold animate-pulse border border-teal-500/30">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">
                      {activeBgTasksCount} Task(s)
                    </span>
                  </div>
                )}
                <EnhancedGlobalSearch user={user} onNavigate={router.push} />
                <ThemeToggle userId={user.id} />
                <MissedCallsNotification
                  userId={user.id}
                  onCallBack={(callerId) => {
                    const roomId = `room-${callerId.slice(0, 8)}`;
                    toast.success("Calling back...");
                    router.push(`/call/${roomId}`);
                  }}
                />
                <NotificationCenter
                  userId={user.id}
                  tenantId={currentTenant?.id || ""}
                />
                <DashboardAccountMenu
                  user={user}
                  onLogout={onLogout}
                  onSettings={() => setActiveTab("/dashboard/settings")}
                  onPwaSettings={() => setActiveTab("/dashboard/pwa-settings")}
                />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main
          id="main-content"
          className={`flex-1 min-h-0 ac-workspace-canvas ac-dashboard-main ${
            [
              "/dashboard/mail",
              "/dashboard/comms",
              "/dashboard/messages",
              "/dashboard/business/messages",
              "/dashboard/business/unified-inbox",
              "/dashboard/zoho/mail",
            ].includes(activeTab)
              ? "overflow-hidden"
              : "overflow-y-auto overflow-x-hidden"
          } w-full scroll-smooth relative pb-safe md:pb-0`}
          role="main"
        >
          {/* Content Wrapper for Max Width & Padding */}
          <div
            className={`${WORKSPACE.canvas.maxWidth} mx-auto ${WORKSPACE.canvas.padding} dashboard-content-padding pb-24 md:pb-6 ${
              activeTab === "/dashboard/pwa-settings"
                ? "p-0 max-w-none"
                : activeTab === "/dashboard/mail" ||
                    activeTab === "/dashboard/comms" ||
                    activeTab === "/dashboard/messages" ||
                    activeTab === "/dashboard/business/messages" ||
                    activeTab === "/dashboard/business/unified-inbox" ||
                    activeTab === "/dashboard/zoho/mail"
                  ? "h-full flex flex-col"
                  : "min-h-full"
            }`}
          >
            <div className="relative z-10 min-h-full">
              <WidgetErrorBoundary title="Dashboard Content Error">
                <EnterpriseTabWrapper
                  fullBleed={isEnterpriseFullBleedTab(activeTab)}
                >
                  {renderContent()}
                </EnterpriseTabWrapper>
              </WidgetErrorBoundary>
            </div>
          </div>
        </main>
      </div>

      {/* Global Task Scheduler FAB */}
      <button
        onClick={() => setTaskSchedulerOpen((prev) => !prev)}
        title="Task Scheduler"
        className={`fixed bottom-24 md:bottom-8 right-5 z-[45] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl transition-all active:scale-95 font-medium text-sm ${
          taskSchedulerOpen
            ? "bg-violet-700 text-white shadow-violet-600/40"
            : "bg-violet-600 hover:bg-violet-500 text-white shadow-violet-600/30"
        }`}
      >
        <Clock className="w-4 h-4" />
        <span className="hidden sm:inline">Scheduler</span>
      </button>

      {/* Task Scheduler Slide-in Panel */}
      <AnimatePresence>
        {taskSchedulerOpen && (
          <>
            <motion.div
              key="scheduler-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[54]"
              onClick={() => setTaskSchedulerOpen(false)}
            />
            <motion.div
              key="scheduler-panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[500px] bg-slate-950 border-l border-white/10 z-[55] flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-slate-900/80 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-violet-500/10 rounded-xl">
                    <Clock className="w-4 h-4 text-violet-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      Task Scheduler
                    </h2>
                    <p className="text-xs text-slate-500">
                      Runs automatically on your schedule
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setTaskSchedulerOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                <React.Suspense
                  fallback={
                    <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
                      Loading...
                    </div>
                  }
                >
                  <TaskScheduler />
                </React.Suspense>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Dashboard Global Elements */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onCreateInvoice={() => setCreateInvoiceOpen(true)}
        onCreateTask={() => setCreateTaskOpen(true)}
        onCreateProject={() =>
          router.push(
            resolveDashboardPath(
              "/dashboard/projects/manage?create=true",
              user.role,
            ),
          )
        }
        userId={user.id}
        userRole={user.role}
      />

      <GlobalShortcutListener
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onOpenQuickTask={() => setCreateTaskOpen(true)}
        onToggleVoice={() => setIsVoiceActive((prev) => !prev)}
      />

      <QuickTaskOverlay
        isOpen={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        userId={user.id}
      />

      <VoiceCaptureFAB
        isActive={isVoiceActive}
        onClose={() => setIsVoiceActive(false)}
      />

      <ProductTour
        isOpen={showProductTour}
        onComplete={() => setShowProductTour(false)}
        userRole={user.role}
      />
      <CelebrationOverlay
        isOpen={celebration.show}
        onClose={() => setCelebration((p) => ({ ...p, show: false }))}
        title={celebration.title}
        message={celebration.message}
      />
      <PasswordChangeRequiredModal
        isOpen={!!(user as any)?.password_change_required}
        onSuccess={() => window.location.reload()}
      />
      {!location.startsWith("/dashboard/bonnie") &&
        location !== "/dashboard/business/bonnie" && <BonnieWidget />}
    </div>
  );
};

export default Dashboard;
