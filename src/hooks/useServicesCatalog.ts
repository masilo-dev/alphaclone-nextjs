'use client';

import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  defaultPrice: number;
  unit: string;
}

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
    addService,
    updateService,
    deleteService,
    getServiceById,
    isLoaded,
  };
};
