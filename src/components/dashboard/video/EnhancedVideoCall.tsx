'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video,
  Mic,
  MicOff,
  VideoOff,
  Monitor,
  Phone,
  MessageSquare,
  Users,
  Settings,
  Maximize2,
  Minimize2,
  X,
  AlertCircle,
  RefreshCw,
  Share2,
  StopCircle
} from 'lucide-react';
import { useDaily } from '@daily-co/daily-react';
import { cn } from '@/lib/utils';

interface EnhancedVideoCallProps {
  roomUrl: string;
  userName: string;
  userId: string;
  onLeave: () => void;
  isAdmin?: boolean;
}

interface Participant {
  id: string;
  name: string;
  video: boolean;
  audio: boolean;
  screen: boolean;
  local: boolean;
}

export default function EnhancedVideoCall({
  roomUrl,
  userName,
  userId,
  onLeave,
  isAdmin = false
}: EnhancedVideoCallProps) {
  const daily = useDaily();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localParticipant, setLocalParticipant] = useState<Participant | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [screenShareVisible, setScreenShareVisible] = useState(false);
  const [dominantSpeaker, setDominantSpeaker] = useState<string | null>(null);

  const videoGridRef = useRef<HTMLDivElement>(null);
  const screenShareRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);

  // Enhanced screen share detection with multiple fallback methods
  const detectScreenShare = useCallback(() => {
    if (!daily) return false;

    try {
      const participants = daily.participants();
      let hasScreenShare = false;

      Object.values(participants).forEach((participant: any) => {
        // Method 1: Check screenVideo track state
        const screenVideoState = participant.tracks?.screenVideo?.state;
        const hasScreenVideo = screenVideoState === 'playable' || screenVideoState === 'loading';

        // Method 2: Check persistentTrack
        const hasPersistentTrack = !!participant.tracks?.screenVideo?.persistentTrack;

        // Method 3: Check track object
        const hasTrack = !!participant.tracks?.screenVideo?.track;

        // Method 4: Check screenAudio (some browsers)
        const screenAudioState = participant.tracks?.screenAudio?.state;
        const hasScreenAudio = screenAudioState === 'playable';

        if (hasScreenVideo || hasPersistentTrack || hasTrack || hasScreenAudio) {
          hasScreenShare = true;
          console.log(`Screen share detected for participant ${participant.user_id}:`, {
            screenVideoState,
            hasPersistentTrack,
            hasTrack,
            hasScreenAudio
          });
        }
      });

      return hasScreenShare;
    } catch (error) {
      console.error('Error detecting screen share:', error);
      return false;
    }
  }, [daily]);

  // Initialize Daily.co
  useEffect(() => {
    if (!daily || !roomUrl) return;

    const initCall = async () => {
      try {
        setConnectionState('connecting');

        await daily.join({
          url: roomUrl,
          userName: userName
        });

        setConnectionState('connected');
        console.log('Successfully joined call');
      } catch (error) {
        console.error('Failed to join call:', error);
        setConnectionState('error');
        setErrorMessage(error instanceof Error ? error.message : 'Failed to join call');
      }
    };

    initCall();

    return () => {
      daily.leave();
    };
  }, [daily, roomUrl, userName, userId]);

  // Update participants and screen share detection
  useEffect(() => {
    if (!daily) return;

    const updateParticipants = () => {
      const participantsObj = daily.participants();
      const participantList: Participant[] = [];
      let local: Participant | null = null;

      Object.values(participantsObj).forEach((p: any) => {
        const participant: Participant = {
          id: p.user_id || p.session_id,
          name: p.user_name || 'Anonymous',
          video: p.video && p.tracks?.video?.state === 'playable',
          audio: p.audio && p.tracks?.audio?.state === 'playable',
          screen: p.screen && p.tracks?.screenVideo?.state === 'playable',
          local: p.local || false,
        };

        if (participant.local) {
          local = participant;
        } else {
          participantList.push(participant);
        }
      });

      setParticipants(participantList);
      setLocalParticipant(local);

      // Enhanced screen share detection
      const hasScreenShare = detectScreenShare();
      setScreenShareVisible(hasScreenShare);
    };

    // Initial update
    updateParticipants();

    // Listen for participant updates
    daily.on('participant-joined', updateParticipants);
    daily.on('participant-left', updateParticipants);
    daily.on('participant-updated', updateParticipants);
    daily.on('track-started', updateParticipants);
    daily.on('track-stopped', updateParticipants);

    return () => {
      daily.off('participant-joined', updateParticipants);
      daily.off('participant-left', updateParticipants);
      daily.off('participant-updated', updateParticipants);
      daily.off('track-started', updateParticipants);
      daily.off('track-stopped', updateParticipants);
    };
  }, [daily, detectScreenShare]);

  // Handle screen share events
  useEffect(() => {
    if (!daily) return;

    const handleScreenShareStarted = (event: any) => {
      console.log('Screen share started:', event);
      setIsScreenSharing(true);
      setScreenShareVisible(true);
    };

    const handleScreenShareStopped = (event: any) => {
      console.log('Screen share stopped:', event);
      setIsScreenSharing(false);
      setScreenShareVisible(false);
    };

    daily.on('screen-share-started' as any, handleScreenShareStarted);
    daily.on('screen-share-stopped' as any, handleScreenShareStopped);

    return () => {
      daily.off('screen-share-started' as any, handleScreenShareStarted);
      daily.off('screen-share-stopped' as any, handleScreenShareStopped);
    };
  }, [daily]);

  // Handle dominant speaker
  useEffect(() => {
    if (!daily) return;

    const handleActiveSpeakerChange = (event: any) => {
      setDominantSpeaker(event.activeSpeaker.peerId);
    };

    daily.on('active-speaker-change', handleActiveSpeakerChange);

    return () => {
      daily.off('active-speaker-change', handleActiveSpeakerChange);
    };
  }, [daily]);

  // Media control functions
  const toggleVideo = async () => {
    if (!daily) return;
    try {
      await daily.setLocalVideo(!isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    } catch (error) {
      console.error('Failed to toggle video:', error);
    }
  };

  const toggleAudio = async () => {
    if (!daily) return;
    try {
      await daily.setLocalAudio(!isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
    } catch (error) {
      console.error('Failed to toggle audio:', error);
    }
  };

  const toggleScreenShare = async () => {
    if (!daily) return;
    try {
      if (isScreenSharing) {
        await daily.stopScreenShare();
        setIsScreenSharing(false);
        setScreenShareVisible(false);
      } else {
        await daily.startScreenShare();
        setIsScreenSharing(true);
        setScreenShareVisible(true);
      }
    } catch (error) {
      console.error('Failed to toggle screen share:', error);
      setErrorMessage('Failed to start screen sharing. Please check your browser permissions.');
    }
  };

  const sendMessage = async () => {
    if (!daily || !newMessage.trim()) return;

    try {
      await daily.sendAppMessage({
        type: 'chat',
        text: newMessage.trim(),
        sender: userName,
        timestamp: new Date().toISOString()
      });

      setMessages(prev => [...prev, {
        text: newMessage.trim(),
        sender: userName,
        timestamp: new Date().toISOString(),
        isOwn: true
      }]);

      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Render video tiles with enhanced visibility
  const renderVideoTiles = () => {
    const allParticipants = localParticipant ? [localParticipant, ...participants] : participants;

    return allParticipants.map((participant) => (
      <div
        key={participant.id}
        className={cn(
          "relative rounded-lg overflow-hidden bg-gray-900",
          "border-2 transition-all duration-200",
          dominantSpeaker === participant.id ? "border-blue-500 shadow-lg" : "border-gray-700",
          participant.screen ? "col-span-full row-span-2" : ""
        )}
      >
        <div
          className="w-full h-full flex items-center justify-center"
          ref={(el) => {
            if (el && daily) {
              try {
                const participantObj = daily.participants()[participant.id];
                if (participantObj?.videoTrack) {
                  // Standard way to attach track in Daily
                  const videoEl = document.createElement('video');
                  videoEl.autoplay = true;
                  videoEl.playsInline = true;
                  videoEl.muted = participant.local;
                  videoEl.className = 'w-full h-full object-cover';
                  videoEl.srcObject = new MediaStream([participantObj.videoTrack]);
                  el.innerHTML = '';
                  el.appendChild(videoEl);
                }
              } catch (error) {
                console.error('Error attaching video track:', error);
              }
            }
          }}
        >
          {!participant.video && (
            <div className="flex flex-col items-center justify-center text-white">
              <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mb-2">
                <span className="text-xl font-semibold">
                  {participant.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm">{participant.name}</span>
            </div>
          )}
        </div>

        {/* Participant info overlay */}
        <div className="absolute bottom-2 left-2 flex items-center space-x-2 bg-black bg-opacity-50 px-2 py-1 rounded">
          <span className="text-white text-xs">{participant.name}</span>
          {!participant.audio && (
            <MicOff className="w-3 h-3 text-red-400" />
          )}
          {participant.screen && (
            <Monitor className="w-3 h-3 text-green-400" />
          )}
        </div>
      </div>
    ));
  };

  // Enhanced screen share detection and rendering
  const renderScreenShare = () => {
    if (!screenShareVisible || !daily) return null;

    const screenShareParticipant = Object.values(daily.participants()).find((p: any) => {
      return p.tracks?.screenVideo?.state === 'playable' ||
        p.tracks?.screenVideo?.persistentTrack ||
        p.tracks?.screenVideo?.track;
    });

    if (!screenShareParticipant) return null;

    return (
      <div
        className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden border-2 border-green-500"
        ref={(el) => {
          if (el && daily) {
            try {
              const screenTrack = screenShareParticipant.tracks?.screenVideo?.track;
              if (screenTrack) {
                const videoEl = document.createElement('video');
                videoEl.autoplay = true;
                videoEl.playsInline = true;
                videoEl.className = 'w-full h-full object-contain';
                videoEl.srcObject = new MediaStream([screenTrack]);
                el.innerHTML = ''; // Clear previous content
                el.appendChild(videoEl);
              }
            } catch (error) {
              console.error('Error attaching screen share track:', error);
            }
          }
        }}
      >
        {/* Screen share indicator */}
        <div className="absolute top-4 left-4 flex items-center space-x-2 bg-green-600 text-white px-3 py-1 rounded-full text-sm">
          <Monitor className="w-4 h-4" />
          <span>{screenShareParticipant.user_name || 'Someone'} is sharing their screen</span>
        </div>
      </div>
    );
  };

  if (connectionState === 'connecting') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white">Connecting to call...</p>
        </div>
      </div>
    );
  }

  if (connectionState === 'error') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-white text-lg mb-2">Connection Error</h3>
          <p className="text-gray-400 mb-4">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "fixed inset-0 bg-gray-900 flex flex-col",
      isMinimized && "inset-auto bottom-4 right-4 w-80 h-60"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <Video className="w-6 h-6 text-blue-500" />
          <span className="text-white font-semibold">Video Call</span>
          {isMinimized && (
            <span className="text-gray-400 text-sm">
              {participants.length + 1} participants
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {!isMinimized && (
            <>
              <button
                onClick={() => setShowChat(!showChat)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowParticipants(!showParticipants)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
              >
                <Users className="w-5 h-5" />
              </button>
            </>
          )}

          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
          >
            {isMinimized ? <Maximize2 className="w-5 h-5" /> : <Minimize2 className="w-5 h-5" />}
          </button>

          <button
            onClick={onLeave}
            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {!isMinimized ? (
        <div className="flex-1 flex">
          {/* Main Video Area */}
          <div className="flex-1 relative">
            {/* Screen Share Area */}
            {screenShareVisible && renderScreenShare()}

            {/* Video Grid */}
            <div
              ref={videoGridRef}
              className={cn(
                "grid gap-2 p-4 h-full",
                screenShareVisible ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              )}
            >
              {renderVideoTiles()}
            </div>

            {/* Controls */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
              <div className="flex items-center space-x-3 bg-gray-800/90 backdrop-blur px-4 py-3 rounded-full">
                <button
                  onClick={toggleAudio}
                  className={cn(
                    "p-3 rounded-full transition-colors",
                    isAudioEnabled ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"
                  )}
                >
                  {isAudioEnabled ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
                </button>

                <button
                  onClick={toggleVideo}
                  className={cn(
                    "p-3 rounded-full transition-colors",
                    isVideoEnabled ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"
                  )}
                >
                  {isVideoEnabled ? <Video className="w-5 h-5 text-white" /> : <VideoOff className="w-5 h-5 text-white" />}
                </button>

                <button
                  onClick={toggleScreenShare}
                  className={cn(
                    "p-3 rounded-full transition-colors",
                    isScreenSharing ? "bg-green-600 hover:bg-green-700" : "bg-gray-600 hover:bg-gray-700"
                  )}
                >
                  {isScreenSharing ? <StopCircle className="w-5 h-5 text-white" /> : <Monitor className="w-5 h-5 text-white" />}
                </button>

                <button
                  onClick={onLeave}
                  className="p-3 bg-red-600 hover:bg-red-700 rounded-full transition-colors"
                >
                  <Phone className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>

          {/* Side Panels */}
          <div className="w-80 bg-gray-800 border-l border-gray-700">
            {/* Chat Panel */}
            {showChat && (
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-gray-700">
                  <h3 className="text-white font-semibold">Chat</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {messages.map((msg, index) => (
                    <div key={index} className={cn(
                      "p-2 rounded-lg",
                      msg.isOwn ? "bg-blue-600 ml-8" : "bg-gray-700 mr-8"
                    )}>
                      <div className="text-xs text-gray-300 mb-1">{msg.sender}</div>
                      <div className="text-white text-sm">{msg.text}</div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-gray-700">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Type a message..."
                      className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={sendMessage}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Participants Panel */}
            {showParticipants && (
              <div className="h-full">
                <div className="p-4 border-b border-gray-700">
                  <h3 className="text-white font-semibold">Participants ({participants.length + 1})</h3>
                </div>
                <div className="p-4 space-y-2">
                  {localParticipant && (
                    <div className="flex items-center space-x-3 text-white">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-sm">{localParticipant.name.charAt(0)}</span>
                      </div>
                      <span>{localParticipant.name} (You)</span>
                    </div>
                  )}
                  {participants.map((participant) => (
                    <div key={participant.id} className="flex items-center space-x-3 text-white">
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                        <span className="text-sm">{participant.name.charAt(0)}</span>
                      </div>
                      <span>{participant.name}</span>
                      {participant.screen && <Monitor className="w-4 h-4 text-green-400" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Minimized View */
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-white">
            <Video className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">In call with {participants.length} others</p>
            <div className="flex justify-center space-x-2 mt-3">
              <button
                onClick={toggleAudio}
                className="p-2 rounded-full bg-gray-700 hover:bg-gray-600"
              >
                {isAudioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              <button
                onClick={toggleVideo}
                className="p-2 rounded-full bg-gray-700 hover:bg-gray-600"
              >
                {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>
              <button
                onClick={onLeave}
                className="p-2 rounded-full bg-red-600 hover:bg-red-700"
              >
                <Phone className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}