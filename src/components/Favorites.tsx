import React, { useState, useEffect } from 'react';
import { Star, X } from 'lucide-react';
import { useToast } from './Toast';

interface FavoriteButtonProps {
    userId: string;
    entityType: 'project' | 'message' | 'document' | 'contact';
    entityId: string;
    className?: string;
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
    className = '',
}) => {
    const [isFavorite, setIsFavorite] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const toast = useToast();

    const toggleFavorite = async () => {
        setIsLoading(true);
        try {
            // Mock toggle - replace with actual service call
            setIsFavorite(!isFavorite);
            toast.success(isFavorite ? 'Removed from favorites' : 'Added to favorites');
        } catch (error) {
            toast.error('Failed to update favorites');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={toggleFavorite}
            disabled={isLoading}
            className={`p-2 rounded-lg transition-colors ${isFavorite
                    ? 'text-yellow-400 hover:text-yellow-300 bg-yellow-400/10'
                    : 'text-slate-400 hover:text-yellow-400 hover:bg-slate-800'
                } ${className}`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
            <Star className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
    );
};

interface Favorite {
    id: string;
    entity_type: string;
    entity_id: string;
}

interface FavoritesListProps {
    userId: string;
}

export const FavoritesList: React.FC<FavoritesListProps> = ({ userId }) => {
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const toast = useToast();

    useEffect(() => {
        loadFavorites();
    }, [userId]);

    const loadFavorites = async () => {
        setIsLoading(true);
        // Mock data - replace with actual service call
        setFavorites([]);
        setIsLoading(false);
    };

    const removeFavorite = async (favoriteId: string) => {
        setFavorites(favorites.filter(f => f.id !== favoriteId));
        toast.success('Removed from favorites');
    };

    const getIcon = (type: string) => {
        const icons: Record<string, string> = {
            project: '📁',
            message: '💬',
            document: '📄',
            contact: '👤',
        };
        return icons[type] || '⭐';
    };

    if (isLoading) {
        return (
            <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-slate-800 rounded-lg animate-pulse" />
                ))}
            </div>
        );
    }

    if (favorites.length === 0) {
        return (
            <div className="text-center py-8 text-slate-400">
                <Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No favorites yet</p>
                <p className="text-xs mt-1">Click the star icon to add favorites</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {favorites.map((favorite) => (
                <div
                    key={favorite.id}
                    className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors group"
                >
                    <span className="text-2xl">{getIcon(favorite.entity_type)}</span>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">
                            {favorite.entity_type}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                            ID: {favorite.entity_id.substring(0, 8)}...
                        </p>
                    </div>
                    <button
                        onClick={() => removeFavorite(favorite.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-400 transition-all"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default FavoriteButton;
