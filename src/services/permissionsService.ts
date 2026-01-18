import { supabase } from '../lib/supabase';

export interface Permission {
    id: string;
    name: string;
    resource: string;
    action: 'create' | 'read' | 'update' | 'delete' | 'manage';
    description?: string;
}

export interface Role {
    id: string;
    name: string;
    description?: string;
    permissions: string[]; // Permission IDs
    isSystem: boolean;
    createdAt: string;
}

export interface UserRole {
    userId: string;
    roleId: string;
    projectId?: string; // For project-specific roles
    assignedBy: string;
    assignedAt: string;
}

export const permissionsService = {
    /**
     * Check if user has permission
     */
    async hasPermission(
        userId: string,
        resource: string,
        action: 'create' | 'read' | 'update' | 'delete' | 'manage'
    ): Promise<boolean> {
        try {
            // Get user roles
            const { data: userRoles } = await supabase
                .from('user_roles')
                .select('role_id')
                .eq('user_id', userId);

            if (!userRoles || userRoles.length === 0) {
                return false;
            }

            const roleIds = userRoles.map(ur => ur.role_id);

            // Get permissions for these roles
            const { data: roles } = await supabase
                .from('roles')
                .select('permissions')
                .in('id', roleIds);

            if (!roles) {
                return false;
            }

            // Flatten permissions
            const allPermissionIds = new Set<string>();
            roles.forEach(role => {
                (role.permissions || []).forEach((permId: string) => allPermissionIds.add(permId));
            });

            // Get permission details
            const { data: permissions } = await supabase
                .from('permissions')
                .select('*')
                .in('id', Array.from(allPermissionIds));

            // Check if any permission matches
            return (permissions || []).some(
                (perm: Permission) =>
                    perm.resource === resource &&
                    (perm.action === action || perm.action === 'manage')
            );
        } catch (error) {
            console.error('Permission check failed:', error);
            return false;
        }
    },

    /**
     * Create a new role
     */
    async createRole(role: Omit<Role, 'id' | 'createdAt'>): Promise<{ role: Role | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('roles')
                .insert({
                    name: role.name,
                    description: role.description,
                    permissions: role.permissions,
                    is_system: role.isSystem,
                })
                .select()
                .single();

            if (error) throw error;

            return {
                role: {
                    id: data.id,
                    name: data.name,
                    description: data.description,
                    permissions: data.permissions || [],
                    isSystem: data.is_system,
                    createdAt: data.created_at,
                },
                error: null,
            };
        } catch (error) {
            return {
                role: null,
                error: error instanceof Error ? error.message : 'Failed to create role',
            };
        }
    },

    /**
     * Assign role to user
     */
    async assignRole(
        userId: string,
        roleId: string,
        assignedBy: string,
        projectId?: string
    ): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase.from('user_roles').insert({
                user_id: userId,
                role_id: roleId,
                project_id: projectId,
                assigned_by: assignedBy,
            });

            if (error) throw error;

            return { success: true, error: null };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to assign role',
            };
        }
    },

    /**
     * Get user roles
     */
    async getUserRoles(userId: string, projectId?: string): Promise<{ roles: Role[]; error: string | null }> {
        try {
            let query = supabase
                .from('user_roles')
                .select('role_id, roles(*)')
                .eq('user_id', userId);

            if (projectId) {
                query = query.or(`project_id.eq.${projectId},project_id.is.null`);
            } else {
                query = query.is('project_id', null);
            }

            const { data, error } = await query;

            if (error) throw error;

            return {
                roles: (data || []).map((ur: any) => ({
                    id: ur.roles.id,
                    name: ur.roles.name,
                    description: ur.roles.description,
                    permissions: ur.roles.permissions || [],
                    isSystem: ur.roles.is_system,
                    createdAt: ur.roles.created_at,
                })),
                error: null,
            };
        } catch (error) {
            return {
                roles: [],
                error: error instanceof Error ? error.message : 'Failed to fetch roles',
            };
        }
    },

    /**
     * Get all permissions
     */
    async getPermissions(): Promise<{ permissions: Permission[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('permissions')
                .select('*')
                .order('resource', { ascending: true });

            if (error) throw error;

            return {
                permissions: (data || []).map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    resource: p.resource,
                    action: p.action,
                    description: p.description,
                })),
                error: null,
            };
        } catch (error) {
            return {
                permissions: [],
                error: error instanceof Error ? error.message : 'Failed to fetch permissions',
            };
        }
    },

    /**
     * Get all roles
     */
    async getRoles(): Promise<{ roles: Role[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('roles')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;

            return {
                roles: (data || []).map((r: any) => ({
                    id: r.id,
                    name: r.name,
                    description: r.description,
                    permissions: r.permissions || [],
                    isSystem: r.is_system,
                    createdAt: r.created_at,
                })),
                error: null,
            };
        } catch (error) {
            return {
                roles: [],
                error: error instanceof Error ? error.message : 'Failed to fetch roles',
            };
        }
    },

    /**
     * Update role permissions
     */
    async updateRolePermissions(roleId: string, permissions: string[]): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase
                .from('roles')
                .update({ permissions })
                .eq('id', roleId);

            if (error) throw error;

            return { success: true, error: null };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update role',
            };
        }
    },

    /**
     * Remove role from user
     */
    async removeRole(userId: string, roleId: string, projectId?: string): Promise<{ success: boolean; error: string | null }> {
        try {
            let query = supabase
                .from('user_roles')
                .delete()
                .eq('user_id', userId)
                .eq('role_id', roleId);

            if (projectId) {
                query = query.eq('project_id', projectId);
            } else {
                query = query.is('project_id', null);
            }

            const { error } = await query;

            if (error) throw error;

            return { success: true, error: null };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to remove role',
            };
        }
    },

    /**
     * Check project-level permission
     */
    async hasProjectPermission(
        userId: string,
        projectId: string,
        action: 'create' | 'read' | 'update' | 'delete' | 'manage'
    ): Promise<boolean> {
        // Check project-specific role first
        const hasProjectRole = await this.hasPermission(userId, `project:${projectId}`, action);
        if (hasProjectRole) {
            return true;
        }

        // Fall back to global project permission
        return this.hasPermission(userId, 'projects', action);
    },
};

