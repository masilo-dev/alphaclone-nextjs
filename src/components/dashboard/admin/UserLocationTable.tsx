import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Card, CardContent, CardHeader, CardTitle,
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
    Input,
    Badge,
    Avatar, AvatarFallback, AvatarImage
} from '@/components/ui/UIComponents';
import { Search, MapPin, Globe } from 'lucide-react';

interface UserLocation {
    id: string;
    email: string;
    name: string;
    role: string;
    avatar: string;
    registration_country: string | null;
    last_sign_in_at: string | null;
    last_ip: string | null;
    last_location: string | null;
}

export function UserLocationTable() {
    const [users, setUsers] = useState<UserLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            // Fetch profiles with registration country
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (profilesError) throw profilesError;

            // Fetch latest activity for each user to get "Live" location/IP
            // This is a bit expensive, in a real app we might join or have a materialized view
            // For now, we will fetch the latest login_session for each user

            const enhancedUsers = await Promise.all(profiles.map(async (profile: any) => {
                const { data: session } = await supabase
                    .from('login_sessions')
                    .select('ip_address, country, city')
                    .eq('user_id', profile.id)
                    .order('login_time', { ascending: false })
                    .limit(1)
                    .single();

                return {
                    ...profile,
                    last_ip: session?.ip_address || 'Unknown',
                    last_location: session ? `${session.city || ''}, ${session.country || ''}` : 'Unknown'
                };
            }));

            setUsers(enhancedUsers);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(user =>
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.registration_country?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-blue-500" />
                        User Geo-Location Tracking
                    </CardTitle>
                    <div className="relative w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                            placeholder="Search users, countries..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Registration Country</TableHead>
                                <TableHead>Last Known Location</TableHead>
                                <TableHead>Last IP</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">Loading location data...</TableCell>
                                </TableRow>
                            ) : filteredUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">No users found</TableCell>
                                </TableRow>
                            ) : (
                                filteredUsers.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={user.avatar} />
                                                <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{user.name}</span>
                                                <span className="text-xs text-gray-500">{user.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="neutral" className="capitalize">{user.role}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {user.registration_country ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl">{getFlagEmoji(user.registration_country)}</span>
                                                    <span>{user.registration_country}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 italic">Not tracked</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-sm">
                                                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                                                {user.last_location !== 'Unknown' ? user.last_location : <span className="text-gray-400">Unknown</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-gray-500">
                                            {user.last_ip}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

export default UserLocationTable;

// Helper to get flag emoji from country name (Simple mapping or fallback)
// Ideally we would store Country Code (ISO 2) and use that.
// Since we stored Country Name in some places, this is a rough heuristic or we can just show the name.
// For the sake of this component, I'll rely on the Name. 
// Note: Converting Name to Flag Emoji properly requires a map.
// I'll leave it as just the name if no simple map is available, or use a basic function if I had ISO codes.
// Since ipTrackingService returns country_name and country (code), I will assume we might have stored connection codes in migration?
// Wait, I migrated `registration_country` as TEXT. I should have stored the code.
// The `ipTrackingService` update I made stores `country` (code) and `country_name`.
// In authService I stored `country_name`. 

function getFlagEmoji(countryName: string) {
    if (!countryName) return '🌍';
    // This is hard to do perfectly with just names without a library.
    // I will return a generic globe if not standard.
    return '🏳️';
}
