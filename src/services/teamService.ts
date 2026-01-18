import { supabase } from '../lib/supabase';


export const teamService = {
    /**
     * Fetch all team members (admins and employees)
     * This replaces the hardcoded placeholders in the dashboard.
     */
    async getTeamMembers(): Promise<{ team: any[]; error: string | null }> {
        try {
            // Fetch profiles with roles that are not 'client' or 'visitor'
            // Adjust this fitler based on your actual roles
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .in('role', ['admin', 'employee', 'manager']); // Assuming these roles exist or will exist

            if (error) throw error;

            // If no "employee" roles exist yet, fetch admins to show something real
            if (!data || data.length === 0) {
                const { data: adminData, error: adminError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('role', 'admin');

                if (adminError) throw adminError;

                return {
                    team: (adminData || []).map(transformProfileToMember),
                    error: null
                };
            }

            return {
                team: data.map(transformProfileToMember),
                error: null
            };

        } catch (err) {
            console.error('Error fetching team members:', err);
            return { team: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    }
};

// Helper to transform DB profile to the Dashboard Member format
const transformProfileToMember = (profile: any) => ({
    id: profile.id,
    name: profile.name,
    role: profile.role === 'admin' ? 'Administrator' : 'Team Member',
    skills: ['General Access'], // Since we don't have a skills table yet, we default this or add a column later
    status: 'Available', // Default status
    avatar: profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=random`,
    capacity: Math.floor(Math.random() * 100) // Placeholder until we have a real capacity/workload table
});
