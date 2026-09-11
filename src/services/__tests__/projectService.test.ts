/**
 * Test Suite for Project Service
 * 
 * Tests for project CRUD operations and business logic
 */

import { projectService } from '../projectService';

// Mock Supabase client
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

describe('Project Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProjects', () => {
    it('should fetch projects for a tenant', async () => {
      const mockData = [
        { id: '1', name: 'Project A', status: 'active' },
        { id: '2', name: 'Project B', status: 'completed' },
      ];

      const { supabase } = require('../../lib/supabase');
      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: mockData, error: null })),
          })),
        })),
      });

      const result = await projectService.getProjects('tenant-1');
      
      expect(result.data).toEqual(mockData);
      expect(result.error).toBeNull();
    });

    it('should handle errors when fetching projects', async () => {
      const { supabase } = require('../../lib/supabase');
      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: null, error: 'Database error' })),
          })),
        })),
      });

      const result = await projectService.getProjects('tenant-1');
      
      expect(result.error).toBe('Database error');
    });
  });

  describe('createProject', () => {
    it('should create a new project', async () => {
      const newProject = {
        name: 'Test Project',
        description: 'Test Description',
        status: 'active' as const,
        tenant_id: 'tenant-1',
      };

      const mockCreatedProject = { id: '1', ...newProject };

      const { supabase } = require('../../lib/supabase');
      supabase.from.mockReturnValue({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: mockCreatedProject, error: null })),
          })),
        })),
      });

      const result = await projectService.createProject(newProject);
      
      expect(result.data).toEqual(mockCreatedProject);
      expect(result.error).toBeNull();
    });

    it('should handle validation errors', async () => {
      const invalidProject = {
        name: '', // Invalid: empty name
        description: 'Test',
        status: 'active' as const,
        tenant_id: 'tenant-1',
      };

      const result = await projectService.createProject(invalidProject);
      
      expect(result.error).toBeTruthy();
    });
  });

  describe('updateProject', () => {
    it('should update an existing project', async () => {
      const updates = { name: 'Updated Project Name' };
      const mockUpdatedProject = { id: '1', ...updates };

      const { supabase } = require('../../lib/supabase');
      supabase.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: mockUpdatedProject, error: null })),
            })),
          })),
        })),
      });

      const result = await projectService.updateProject('1', updates);
      
      expect(result.data).toEqual(mockUpdatedProject);
    });
  });

  describe('deleteProject', () => {
    it('should delete a project', async () => {
      const { supabase } = require('../../lib/supabase');
      supabase.from.mockReturnValue({
        delete: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ error: null })),
        })),
      });

      const result = await projectService.deleteProject('1');
      
      expect(result.error).toBeNull();
    });
  });

  describe('getProjectById', () => {
    it('should fetch a single project by ID', async () => {
      const mockProject = { id: '1', name: 'Project A', status: 'active' };

      const { supabase } = require('../../lib/supabase');
      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: mockProject, error: null })),
          })),
        })),
      });

      const result = await projectService.getProjectById('1');
      
      expect(result.data).toEqual(mockProject);
    });

    it('should return null for non-existent project', async () => {
      const { supabase } = require('../../lib/supabase');
      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      });

      const result = await projectService.getProjectById('non-existent');
      
      expect(result.data).toBeNull();
    });
  });
});
