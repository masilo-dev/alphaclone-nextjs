'use client';

import { useState, useEffect, useCallback } from 'react';
<<<<<<< HEAD
import { useTenant } from '@/contexts/TenantContext';
import {
  pricingCatalogService,
  PricingCatalogItem,
  PricingUnit,
} from '@/services/pricingCatalogService';
=======
import { v4 as uuidv4 } from 'uuid';
>>>>>>> origin/main

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  defaultPrice: number;
  unit: string;
}

<<<<<<< HEAD
function mapCatalogItem(item: PricingCatalogItem): ServiceItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description || '',
    defaultPrice: Number(item.default_price) || 0,
    unit: item.unit,
  };
}

function toPricingUnit(unit: string): PricingUnit {
  if (unit === 'hour' || unit === 'day' || unit === 'month' || unit === 'project') {
    return unit;
  }
  return 'project';
}

export const useServicesCatalog = () => {
  const { currentTenant } = useTenant();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (!currentTenant?.id) {
      setServices([]);
      setIsLoaded(true);
      return;
    }
    try {
      const items = await pricingCatalogService.getCatalog(currentTenant.id);
      setServices(items.map(mapCatalogItem));
    } catch (e) {
      console.error('[useServicesCatalog] Failed to load catalog:', e);
      setServices([]);
    } finally {
      setIsLoaded(true);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    setIsLoaded(false);
    reload();
  }, [reload]);

  const addService = useCallback(
    async (service: Omit<ServiceItem, 'id'>) => {
      if (!currentTenant?.id) {
        throw new Error('No tenant selected');
      }
      const item = await pricingCatalogService.createCatalogItem({
        tenantId: currentTenant.id,
        name: service.name,
        description: service.description,
        unit: toPricingUnit(service.unit),
        defaultPrice: service.defaultPrice,
      });
      const mapped = mapCatalogItem(item);
      setServices((prev) => [...prev, mapped]);
      return mapped;
    },
    [currentTenant?.id]
  );

  const updateService = useCallback(
    async (id: string, updates: Partial<Omit<ServiceItem, 'id'>>) => {
      if (!currentTenant?.id) {
        throw new Error('No tenant selected');
      }
      const item = await pricingCatalogService.updateCatalogItem({
        tenantId: currentTenant.id,
        id,
        name: updates.name,
        description: updates.description,
        unit: updates.unit ? toPricingUnit(updates.unit) : undefined,
        defaultPrice: updates.defaultPrice,
      });
      const mapped = mapCatalogItem(item);
      setServices((prev) => prev.map((s) => (s.id === id ? mapped : s)));
    },
    [currentTenant?.id]
  );

  const deleteService = useCallback(
    async (id: string) => {
      if (!currentTenant?.id) {
        throw new Error('No tenant selected');
      }
      await pricingCatalogService.archiveCatalogItem(currentTenant.id, id);
      setServices((prev) => prev.filter((s) => s.id !== id));
    },
    [currentTenant?.id]
  );

  const getServiceById = useCallback(
    (id: string) => services.find((s) => s.id === id),
    [services]
  );

  return {
    services,
    isLoaded,
    reload,
=======
const STORAGE_KEY = 'alphaclone_services_catalog';

export const useServicesCatalog = () => {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setServices(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse services catalog:', e);
        setServices([]);
      }
    }
    setIsLoaded(true);
  }, []);

  // Persist to localStorage whenever services change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(services));
    }
  }, [services, isLoaded]);

  const addService = useCallback((service: Omit<ServiceItem, 'id'>) => {
    const newService: ServiceItem = {
      ...service,
      id: uuidv4(),
    };
    setServices(prev => [...prev, newService]);
    return newService;
  }, []);

  const updateService = useCallback((id: string, updates: Partial<Omit<ServiceItem, 'id'>>) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const deleteService = useCallback((id: string) => {
    setServices(prev => prev.filter(s => s.id !== id));
  }, []);

  const getServiceById = useCallback((id: string) => {
    return services.find(s => s.id === id);
  }, [services]);

  return {
    services,
>>>>>>> origin/main
    addService,
    updateService,
    deleteService,
    getServiceById,
<<<<<<< HEAD
=======
    isLoaded,
>>>>>>> origin/main
  };
};
