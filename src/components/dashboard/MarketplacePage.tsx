'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, Star, Download, ExternalLink, Shield, Zap,
  Globe, Mail, Calendar, FileText, Smartphone, MessageSquare,
  TrendingUp, Users, Briefcase, DollarSign, CheckCircle,
  ArrowRight, Heart, Clock, Award, Sparkles, Rocket
} from 'lucide-react';
import { Button, Card, Input, Modal } from '../ui/UIComponents';
import toast from 'react-hot-toast';
import { useCurrentTenantSafe } from '@/hooks/useTenantSafe';
import MCPSetupGuide from './integrations/MCPSetupGuide';

interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  category: 'integration' | 'template' | 'service' | 'automation';
  price: number;
  rating: number;
  downloads: number;
  icon: React.FC<any>;
  features: string[];
  tags: string[];
  developer: string;
  isInstalled?: boolean;
  isPremium?: boolean;
  isComingSoon?: boolean;
  actionUrl?: string;
}

const CATEGORIES = [
  { id: 'all', name: 'All Items', icon: Globe },
  { id: 'integration', name: 'Integrations', icon: Zap },
  { id: 'template', name: 'Templates', icon: FileText },
  { id: 'service', name: 'Services', icon: Briefcase },
  { id: 'automation', name: 'Automations', icon: Sparkles },
];

const MarketplacePage: React.FC = () => {
  const currentTenant = useCurrentTenantSafe();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'newest' | 'price'>('popular');
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [installedItems, setInstalledItems] = useState<Set<string>>(new Set());
  const [showMcpGuide, setShowMcpGuide] = useState(false);

  // Mock marketplace data
  const [marketplaceItems] = useState<MarketplaceItem[]>([
    {
      id: '1',
      name: 'SendGrid Email Integration',
      description: 'Professional email marketing with advanced analytics and automation',
      category: 'integration',
      price: 0,
      rating: 4.8,
      downloads: 1250,
      icon: Mail,
      features: ['Email Templates', 'Automation Rules', 'Analytics Dashboard', 'A/B Testing'],
      tags: ['email', 'marketing', 'automation'],
      developer: 'AlphaClone',
      isInstalled: false,
      isPremium: false,
      actionUrl: '/dashboard/integrations'
    },
    {
      id: '2',
      name: 'AI Lead Generator',
      description: 'Generate high-quality leads using AI-powered search and qualification',
      category: 'service',
      price: 29,
      rating: 4.9,
      downloads: 890,
      icon: Users,
      features: ['AI-Powered Search', 'Lead Qualification', 'CRM Integration', 'Real-time Updates'],
      tags: ['ai', 'leads', 'crm'],
      developer: 'AlphaClone AI',
      isInstalled: false,
      isPremium: true,
      actionUrl: '/dashboard/sales-agent'
    },
    {
      id: '3',
      name: 'Business Proposal Template',
      description: 'Professional proposal templates that win contracts',
      category: 'template',
      price: 0,
      rating: 4.6,
      downloads: 2100,
      icon: FileText,
      features: ['Multiple Designs', 'Custom Branding', 'PDF Export', 'Client Tracking'],
      tags: ['template', 'proposal', 'business'],
      developer: 'Template Hub',
      isInstalled: false,
      isPremium: false,
      actionUrl: '/dashboard/templates'
    },
    {
      id: '4',
      name: 'Social Media Automation',
      description: 'Automate your social media posting and engagement',
      category: 'automation',
      price: 19,
      rating: 4.7,
      downloads: 650,
      icon: MessageSquare,
      features: ['Scheduled Posting', 'Content Calendar', 'Analytics', 'Multi-platform'],
      tags: ['social', 'automation', 'marketing'],
      developer: 'SocialFlow',
      isInstalled: false,
      isPremium: true,
      actionUrl: '/dashboard/automations'
    },
    {
      id: '5',
      name: 'CRM Dashboard Pro',
      description: 'Advanced CRM with pipeline management and forecasting',
      category: 'integration',
      price: 49,
      rating: 4.9,
      downloads: 430,
      icon: TrendingUp,
      features: ['Pipeline Management', 'Sales Forecasting', 'Contact Management', 'Reporting'],
      tags: ['crm', 'sales', 'analytics'],
      developer: 'CRM Solutions',
      isInstalled: false,
      isPremium: true,
      actionUrl: '/dashboard/crm'
    },
    {
      id: '6',
      name: 'Invoice Generator',
      description: 'Create professional invoices with automatic calculations',
      category: 'template',
      price: 0,
      rating: 4.5,
      downloads: 1800,
      icon: DollarSign,
      features: ['Invoice Templates', 'Tax Calculations', 'Payment Tracking', 'Multi-currency'],
      tags: ['invoice', 'finance', 'template'],
      developer: 'Finance Tools',
      isInstalled: false,
      isPremium: false,
      actionUrl: '/dashboard/billing'
    },
    {
      id: 'mcp-claude',
      name: 'Claude Desktop (MCP)',
      description: 'Connect Claude Desktop securely to your CRM database via the Model Context Protocol to orchestrate workflows autonomously.',
      category: 'integration',
      price: 0,
      rating: 5.0,
      downloads: 0,
      icon: Zap,
      features: ['Direct DB queries', 'Automated document processing', 'Lead generation'],
      tags: ['ai', 'mcp', 'claude'],
      developer: 'AlphaClone AI'
    },
    {
      id: 'mcp-manus',
      name: 'Manus AI (MCP)',
      description: 'Let Manus autonomously research leads and execute background tasks for your agency via MCP.',
      category: 'integration',
      price: 0,
      rating: 5.0,
      downloads: 0,
      icon: Sparkles,
      features: ['Autonomous research', 'Data enrichment', 'Task orchestration'],
      tags: ['ai', 'mcp', 'manus'],
      developer: 'AlphaClone AI'
    },
    {
      id: 'integration-hubspot',
      name: 'HubSpot Sync',
      description: 'Two-way synchronization between HubSpot CRM and your AlphaClone dashboard.',
      category: 'integration',
      price: 19,
      rating: 4.8,
      downloads: 420,
      icon: Users,
      features: ['Contact sync', 'Deal pipelines', 'Two-way update tracking'],
      tags: ['crm', 'hubspot', 'integration'],
      developer: 'Integration Provider',
      actionUrl: '/dashboard/business/settings?tab=integrations'
    },
    {
      id: 'integration-calendly',
      name: 'Calendly Booking',
      description: 'Streamline your scheduling by connecting your Calendly account for automated booking.',
      category: 'integration',
      price: 0,
      rating: 4.9,
      downloads: 850,
      icon: Calendar,
      features: ['Automated Scheduling', 'Meeting Sync', 'Custom Booking Pages'],
      tags: ['scheduling', 'booking', 'productivity'],
      developer: 'Calendly',
      actionUrl: '/dashboard/business/settings?tab=booking'
    },
    {
      id: 'integration-resend',
      name: 'Resend Email',
      description: 'The best email API for developers. Integrate Resend for lightning-fast outreach.',
      category: 'integration',
      price: 0,
      rating: 4.7,
      downloads: 320,
      icon: Mail,
      features: ['Email API', 'Webhooks', 'Analytics'],
      tags: ['email', 'outreach', 'api'],
      developer: 'Resend',
      actionUrl: '/dashboard/business/settings?tab=integrations'
    }
  ]);

  const filteredItems = marketplaceItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case 'popular':
        return b.downloads - a.downloads;
      case 'rating':
        return b.rating - a.rating;
      case 'newest':
        return b.id.localeCompare(a.id);
      case 'price':
        return a.price - b.price;
      default:
        return 0;
    }
  });

  const handleInstall = (item: MarketplaceItem) => {
    // MCP items open the plain-English setup guide instead of a generic modal
    if (item.id === 'mcp-claude' || item.id === 'mcp-manus') {
      setShowMcpGuide(true);
      return;
    }
    setSelectedItem(item);
    setShowInstallModal(true);
  };

  const confirmInstall = () => {
    if (!selectedItem) return;

    // Simulate installation
    setInstalledItems(prev => new Set([...prev, selectedItem.id]));
    setShowInstallModal(false);
    
    toast.success(`${selectedItem.name} installed successfully!`);
    
    // Navigate to the item's page if it has an action URL
    if (selectedItem.actionUrl) {
      const actionUrl = selectedItem.actionUrl;
      setTimeout(() => {
        window.location.href = actionUrl;
      }, 1000);
    }
  };

  const ItemCard: React.FC<{ item: MarketplaceItem }> = ({ item }) => {
    const Icon = item.icon;
    const isInstalled = installedItems.has(item.id);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
        className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all group"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-teal-500/20 to-blue-500/20 flex items-center justify-center">
              <Icon className="w-6 h-6 text-teal-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold group-hover:text-teal-400 transition-colors">
                {item.name}
              </h3>
              <p className="text-slate-400 text-sm">by {item.developer}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {item.isComingSoon && (
              <div className="px-2 py-1 bg-teal-500/10 text-teal-400 text-xs rounded-full font-semibold border border-teal-500/20">
                Coming Soon
              </div>
            )}
            {item.isPremium && (
              <div className="px-2 py-1 bg-amber-500/10 text-amber-400 text-xs rounded-full">
                PRO
              </div>
            )}
          </div>
        </div>

        <p className="text-slate-300 text-sm mb-4 line-clamp-2">
          {item.description}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {item.tags.slice(0, 3).map(tag => (
            <span key={tag} className="px-2 py-1 bg-slate-800 text-slate-400 text-xs rounded-md">
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-amber-400 fill-current" />
              <span className="text-slate-300">{item.rating}</span>
            </div>
            <div className="flex items-center gap-1">
              <Download className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300">{item.downloads}</span>
            </div>
          </div>
          <div className="text-right">
            {item.price === 0 ? (
              <span className="text-green-400 font-semibold">Free</span>
            ) : (
              <span className="text-white font-semibold">${item.price}/mo</span>
            )}
          </div>
        </div>

        <Button
          onClick={() => !item.isComingSoon && handleInstall(item)}
          disabled={isInstalled || item.isComingSoon}
          className={`w-full ${isInstalled || item.isComingSoon
            ? 'bg-slate-700 text-slate-300 cursor-not-allowed' 
            : 'bg-teal-600 hover:bg-teal-500 text-white'
          }`}
        >
          {isInstalled ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Installed
            </>
          ) : item.isComingSoon ? (
            <>
              <Clock className="w-4 h-4 mr-2" />
              In Development
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              {item.price === 0 ? 'Install' : 'Subscribe'}
            </>
          )}
        </Button>
      </motion.div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Rocket className="w-8 h-8 text-teal-400" />
          Marketplace
        </h1>
        <p className="text-slate-400">
          Discover integrations, templates, and automations to supercharge your workflow
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search marketplace..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-900/50 border-slate-800 text-white placeholder-slate-400"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 bg-slate-900/50 border border-slate-800 rounded-lg text-white"
          >
            {CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 bg-slate-900/50 border border-slate-800 rounded-lg text-white"
          >
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Newest</option>
            <option value="price">Price</option>
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="mb-4 text-slate-400">
        Found {sortedItems.length} items
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedItems.map(item => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>

      {/* Empty State */}
      {sortedItems.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-white text-lg font-semibold mb-2">No items found</h3>
          <p className="text-slate-400">
            Try adjusting your search or filters to find what you're looking for.
          </p>
        </div>
      )}

      {/* Install Modal */}
      <AnimatePresence>
        {showInstallModal && selectedItem && (
          <Modal
            isOpen={showInstallModal}
            onClose={() => setShowInstallModal(false)}
            title="Install Item"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-teal-500/20 to-blue-500/20 flex items-center justify-center">
                  <selectedItem.icon className="w-6 h-6 text-teal-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">{selectedItem.name}</h3>
                  <p className="text-slate-400 text-sm">by {selectedItem.developer}</p>
                </div>
              </div>

              <p className="text-slate-300">{selectedItem.description}</p>

              <div>
                <h4 className="text-white font-medium mb-2">Features:</h4>
                <ul className="space-y-1">
                  {selectedItem.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-slate-300 text-sm">
                      <CheckCircle className="w-4 h-4 text-teal-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <div>
                  {selectedItem.price === 0 ? (
                    <span className="text-green-400 font-semibold">Free</span>
                  ) : (
                    <span className="text-white font-semibold">${selectedItem.price}/month</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowInstallModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={confirmInstall}>
                    {selectedItem.price === 0 ? 'Install' : 'Subscribe'}
                  </Button>
                </div>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MarketplacePage;
