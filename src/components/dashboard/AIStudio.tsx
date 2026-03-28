
import React from 'react';
import AIStudioTab from './AIStudioTab';
import { useAuth } from '../../contexts/AuthContext';

const AIStudio: React.FC = () => {
    const { user } = useAuth();
    if (!user) return null;
    return <AIStudioTab user={user} />;
};

export default AIStudio;

