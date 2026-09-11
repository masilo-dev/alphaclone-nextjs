'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Monitor, AlertCircle, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScreenShareManagerProps {
  daily: any;
  onScreenShareStart?: () => void;
  onScreenShareStop?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export default function ScreenShareManager({ 
  daily, 
  onScreenShareStart, 
  onScreenShareStop, 
  onError,
  className 
}: ScreenShareManagerProps) {
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isScreenShareVisible, setIsScreenShareVisible] = useState(false);
  const [screenShareParticipant, setScreenShareParticipant] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const screenShareRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  // Enhanced screen share detection
  const detectScreenShare = () => {
    if (!daily) return;

    try {
      const participants = daily.participants();
      let detectedParticipant = null;
      let hasActiveScreenShare = false;

      Object.values(participants).forEach((participant: any) => {
        // Multiple detection methods for reliability
        const screenVideoState = participant.tracks?.screenVideo?.state;
        const hasScreenVideo = screenVideoState === 'playable' || screenVideoState === 'loading';
        
        const hasPersistentTrack = !!participant.tracks?.screenVideo?.persistentTrack;
        const hasTrack = !!participant.tracks?.screenVideo?.track;
        const hasScreenAudio = participant.tracks?.screenAudio?.state === 'playable';

        if (hasScreenVideo || hasPersistentTrack || hasTrack || hasScreenAudio) {
          detectedParticipant = participant;
          hasActiveScreenShare = true;
          
          console.log(`Screen share detected for ${participant.user_name}:`, {
            screenVideoState,
            hasPersistentTrack,
            hasTrack,
            hasScreenAudio,
            participantId: participant.user_id
          });
        }
      });

      setScreenShareParticipant(detectedParticipant);
      setIsScreenShareVisible(hasActiveScreenShare);
      
      return hasActiveScreenShare;
    } catch (error) {
      console.error('Error detecting screen share:', error);
      return false;
    }
  };

  // Attach screen share track with enhanced error handling
  const attachScreenShareTrack = () => {
    if (!screenShareParticipant || !screenShareRef.current || !daily) return;

    try {
      const screenTrack = screenShareParticipant.tracks?.screenVideo?.track;
      
      if (screenTrack) {
        // Clear previous content
        screenShareRef.current.innerHTML = '';
        
        // Attach the track
        const videoElement = screenTrack.attach();
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'contain';
        
        screenShareRef.current.appendChild(videoElement);
        
        // Monitor track state changes
        const checkTrackState = () => {
          if (screenTrack.readyState === 'ended') {
            console.log('Screen share track ended');
            handleScreenShareStop();
          }
        };
        
        const handleEnded = () => {
          console.log('Screen share track onended fired');
          handleScreenShareStop();
        };
        screenTrack.addEventListener('ended', handleEnded);
        
        // Set up periodic checks
        const interval = setInterval(checkTrackState, 1000);
        
        // Clean up function
        return () => {
          clearInterval(interval);
          screenTrack.removeEventListener('ended', handleEnded);
        };
      }
    } catch (error) {
      console.error('Error attaching screen share track:', error);
      setError('Failed to display screen share. Please try again.');
      onError?.('Failed to display screen share');
    }
  };

  // Handle screen share start
  const handleScreenShareStart = () => {
    console.log('Screen share started');
    setIsScreenSharing(true);
    setIsScreenShareVisible(true);
    setError('');
    onScreenShareStart?.();
    
    // Attach track after a short delay to ensure it's ready
    setTimeout(() => {
      attachScreenShareTrack();
    }, 500);
  };

  // Handle screen share stop
  const handleScreenShareStop = () => {
    console.log('Screen share stopped');
    setIsScreenSharing(false);
    setIsScreenShareVisible(false);
    setScreenShareParticipant(null);
    
    if (screenShareRef.current) {
      screenShareRef.current.innerHTML = '';
    }
    
    onScreenShareStop?.();
  };

  // Toggle fullscreen
  const toggleFullscreen = async () => {
    if (!screenShareRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await screenShareRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  // Set up event listeners
  useEffect(() => {
    if (!daily) return;

    // Initial detection
    detectScreenShare();

    // Event listeners
    daily.on('screen-share-started', handleScreenShareStart);
    daily.on('screen-share-stopped', handleScreenShareStop);
    daily.on('participant-updated', detectScreenShare);
    daily.on('track-started', detectScreenShare);
    daily.on('track-stopped', detectScreenShare);

    return () => {
      daily.off('screen-share-started', handleScreenShareStart);
      daily.off('screen-share-stopped', handleScreenShareStop);
      daily.off('participant-updated', detectScreenShare);
      daily.off('track-started', detectScreenShare);
      daily.off('track-stopped', detectScreenShare);
    };
  }, [daily]);

  // Monitor screen share participant changes
  useEffect(() => {
    if (screenShareParticipant) {
      attachScreenShareTrack();
    }
  }, [screenShareParticipant]);

  // Monitor fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Periodic detection for reliability
  useEffect(() => {
    const interval = setInterval(() => {
      detectScreenShare();
    }, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, [daily]);

  if (!isScreenShareVisible) {
    return null;
  }

  return (
    <div className={cn(
      "relative bg-gray-900 rounded-lg overflow-hidden border-2 border-green-500",
      isFullscreen ? "fixed inset-4 z-50" : "",
      className
    )}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center space-x-2">
          <Monitor className="w-5 h-5 text-green-400" />
          <span className="text-white text-sm font-medium">
            {screenShareParticipant?.user_name || 'Someone'} is sharing their screen
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleFullscreen}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Screen Share Content */}
      <div 
        ref={screenShareRef}
        className="w-full h-full min-h-[400px] flex items-center justify-center bg-gray-800"
      >
        {/* Loading state */}
        {!screenShareParticipant && (
          <div className="text-center text-gray-400">
            <Monitor className="w-12 h-12 mx-auto mb-2 animate-pulse" />
            <p>Loading screen share...</p>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90">
          <div className="text-center text-red-400">
            <AlertCircle className="w-12 h-12 mx-auto mb-2" />
            <p className="mb-2">{error}</p>
            <button
              onClick={() => {
                setError('');
                detectScreenShare();
              }}
              className="flex items-center space-x-2 mx-auto px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}