'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DailyProvider } from '@daily-co/daily-react';
import EnhancedVideoCall from './EnhancedVideoCall';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

interface VideoCallFixProps {
  roomId: string;
  userName: string;
  userId: string;
  isAdmin?: boolean;
}

/**
 * Enhanced Video Call Component with Screen Sharing Visibility Fixes
 * 
 * This component addresses the following issues:
 * 1. Screen sharing not visible to other participants
 * 2. Mobile browser compatibility issues
 * 3. Video element rendering problems
 * 4. Control bar visibility issues
 * 5. Chat and participants panel display problems
 */
export default function VideoCallFix({ roomId, userName, userId, isAdmin = false }: VideoCallFixProps) {
  const router = useRouter();
  const [roomUrl, setRoomUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [callScriptLoaded, setCallScriptLoaded] = useState(false);

  // Load Daily.co script with enhanced error handling
  useEffect(() => {
    const loadDailyScript = () => {
      return new Promise<void>((resolve, reject) => {
        if (typeof window !== 'undefined' && (window as any).DailyIframe) {
          setCallScriptLoaded(true);
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@daily-co/daily-js@0.73.0/dist/daily-iframe.js';
        script.async = true;
        script.onload = () => {
          setCallScriptLoaded(true);
          resolve();
        };
        script.onerror = () => {
          reject(new Error('Failed to load Daily.co script'));
        };
        document.head.appendChild(script);
      });
    };

    loadDailyScript()
      .then(() => {
        console.log('Daily.co script loaded successfully');
      })
      .catch((err) => {
        console.error('Failed to load Daily.co script:', err);
        setError('Failed to load video call functionality');
        toast.error('Failed to load video call functionality');
      });
  }, []);

  // Fetch room URL with enhanced error handling
  useEffect(() => {
    const fetchRoomUrl = async () => {
      if (!roomId || !callScriptLoaded) return;

      setIsLoading(true);
      setError('');

      try {
        // Try multiple methods to get room URL
        const roomUrl = await getRoomUrl(roomId);
        
        if (roomUrl) {
          setRoomUrl(roomUrl);
          console.log('Room URL fetched successfully:', roomUrl);
        } else {
          throw new Error('Room URL not found');
        }
      } catch (error) {
        console.error('Error fetching room URL:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch room URL';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoomUrl();
  }, [roomId, callScriptLoaded]);

  // Get room URL with fallback methods
  const getRoomUrl = async (roomId: string): Promise<string> => {
    try {
      // Method 1: Try to get from database
      const { data, error } = await supabase
        .from('video_calls')
        .select('daily_room_url, room_url')
        .eq('id', roomId)
        .single();

      if (error) {
        console.warn('Database query failed:', error);
      }

      if (data?.daily_room_url) {
        return data.daily_room_url;
      }

      if (data?.room_url) {
        return data.room_url;
      }

      // Method 2: Try to construct from room ID
      if (roomId.startsWith('https://')) {
        return roomId;
      }

      // Method 3: Construct Daily.co URL
      const dailyDomain = process.env.NEXT_PUBLIC_DAILY_DOMAIN || 'https://alphaclone.daily.co';
      return `${dailyDomain}/${roomId}`;

    } catch (error) {
      console.error('Error in getRoomUrl:', error);
      
      // Fallback: construct URL from room ID
      if (roomId.startsWith('https://')) {
        return roomId;
      }
      
      const dailyDomain = process.env.NEXT_PUBLIC_DAILY_DOMAIN || 'https://alphaclone.daily.co';
      return `${dailyDomain}/${roomId}`;
    }
  };

  // Handle call leave with cleanup
  const handleLeaveCall = useCallback(() => {
    try {
      // Clean up any remaining tracks
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then(stream => {
            stream.getTracks().forEach(track => track.stop());
          })
          .catch(() => {
            // Ignore errors during cleanup
          });
      }

      // Navigate back
      router.push('/dashboard');
      toast.success('Left the call');
    } catch (error) {
      console.error('Error during call cleanup:', error);
      router.push('/dashboard');
    }
  }, [router]);

  // Mobile device detection and optimization
  const isMobileDevice = () => {
    if (typeof window === 'undefined') return false;
    
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTablet = /tablet|ipad/i.test(userAgent);
    
    return isMobile || isTablet;
  };

  // Enhanced error recovery
  const handleRetry = () => {
    setError('');
    setIsLoading(true);
    
    // Force reload Daily script
    setCallScriptLoaded(false);
    
    // Retry after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-white text-xl mb-2">Loading Video Call</h2>
          <p className="text-gray-400">Preparing your meeting environment...</p>
          
          {isMobileDevice() && (
            <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
              <p className="text-yellow-400 text-sm">
                📱 Mobile device detected. For best experience, use landscape mode and ensure stable internet connection.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <h2 className="text-white text-xl mb-2">Video Call Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Try Again</span>
            </button>
            
            <button
              onClick={handleLeaveCall}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Return to Dashboard
            </button>
          </div>

          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
            <h3 className="text-blue-400 font-medium mb-2">Troubleshooting Tips:</h3>
            <ul className="text-blue-300 text-sm space-y-1 text-left">
              <li>• Check your internet connection</li>
              <li>• Ensure camera and microphone permissions are granted</li>
              <li>• Try refreshing the page</li>
              <li>• Use a supported browser (Chrome, Firefox, Safari, Edge)</li>
              {isMobileDevice() && <li>• On mobile, ensure you're not in power saving mode</li>}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Render the enhanced video call
  return (
    <DailyProvider>
      <EnhancedVideoCall
        roomUrl={roomUrl}
        userName={userName}
        userId={userId}
        onLeave={handleLeaveCall}
        isAdmin={isAdmin}
      />
    </DailyProvider>
  );
}