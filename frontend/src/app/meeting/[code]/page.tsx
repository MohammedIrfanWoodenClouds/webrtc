'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useParams, useRouter } from 'next/navigation';
import Peer from 'simple-peer';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, MessageSquare, Users, X, Send } from 'lucide-react';
import { format } from 'date-fns';
import { throttle } from 'lodash';

interface Participant {
    id: string; // socketId
    stream: MediaStream;
}

interface ChatMessage {
    senderId: string;
    senderName: string;
    text: string;
    timestamp: string;
}

export default function MeetingPage() {
    const { user } = useAuth();
    const { socket, isConnected } = useSocket();
    const router = useRouter();
    const params = useParams();
    const roomId = params.code as string;

    // --- State ---
    const [hasJoined, setHasJoined] = useState(false); // Controls Lobby vs Main Room
    const [myStream, setMyStream] = useState<MediaStream | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);

    // Media State
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCamOn, setIsCamOn] = useState(true);
    const [isSharingScreen, setIsSharingScreen] = useState(false);

    // Sidebar State
    const [activeSidebar, setActiveSidebar] = useState<'chat' | 'people' | null>(null);

    // Chat State
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');

    // Refs
    const myVideoRef = useRef<HTMLVideoElement>(null);
    const peersRef = useRef<{ [socketId: string]: Peer.Instance }>({});
    const chatScrollRef = useRef<HTMLDivElement>(null);

    // --- Media Setup (Pre-join & In-call) ---
    useEffect(() => {
        if (!user) {
            router.push('/login');
            return;
        }

        // Always get media initially for the lobby
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then((stream) => {
                setMyStream(stream);
                if (myVideoRef.current) myVideoRef.current.srcObject = stream;
            })
            .catch(err => console.error("Media error:", err));

        return () => {
            // Unmount cleanup
            stopAllMedia();
            if (socket && hasJoined) {
                socket.emit('disconnect_meeting', roomId);
                socket.emit('leave_meeting_chat', roomId);
                socket.off('user_joined_meeting');
                socket.off('webrtc_offer');
                socket.off('webrtc_answer');
                socket.off('webrtc_ice_candidate');
                socket.off('user_left_meeting');
                socket.off('new_meeting_message');
            }
            Object.values(peersRef.current).forEach(peer => peer.destroy());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, router, roomId]); // Notice `socket` is omitted deliberately so we don't re-run this on socket reconnects

    const stopAllMedia = useCallback(() => {
        if (myStream) myStream.getTracks().forEach(t => t.stop());
    }, [myStream]);


    // --- Join Sequence ---
    const handleJoinMeeting = () => {
        if (!socket || !isConnected || !myStream) return;

        setHasJoined(true);

        // 1. Join Signaling and Chat Rooms
        socket.emit('join_meeting', roomId);
        socket.emit('join_meeting_chat', roomId);

        // 2. Setup WebRTC Listeners
        socket.on('user_joined_meeting', (newUserId) => {
            const peer = createPeer(newUserId, socket.id, myStream);
            peersRef.current[newUserId] = peer;
        });

        socket.on('webrtc_offer', (data: { offer: any, from: string }) => {
            const peer = addPeer(data.offer, data.from, myStream);
            peersRef.current[data.from] = peer;
        });

        socket.on('webrtc_answer', (data: { answer: any, from: string }) => {
            const peer = peersRef.current[data.from];
            if (peer) {
                peer.signal(data.answer);
            }
        });

        socket.on('user_left_meeting', (userId) => {
            if (peersRef.current[userId]) {
                peersRef.current[userId].destroy();
                delete peersRef.current[userId];
            }
            setParticipants(prev => prev.filter(p => p.id !== userId));
        });

        // 3. Setup Chat Listeners
        socket.on('new_meeting_message', (msg: ChatMessage) => {
            setMessages(prev => [...prev, msg]);
            setTimeout(() => {
                chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
            }, 100);
        });
    };

    // --- WebRTC Peer Management ---
    function createPeer(userToSignal: string, callerID: string | undefined, stream: MediaStream) {
        const peer = new Peer({
            initiator: true,
            trickle: false,
            stream,
        });

        peer.on('signal', signal => {
            socket?.emit('webrtc_offer', { to: userToSignal, offer: signal });
        });

        peer.on('stream', remoteStream => {
            addParticipantStream(userToSignal, remoteStream);
        });

        return peer;
    }

    function addPeer(incomingSignal: any, callerID: string, stream: MediaStream) {
        const peer = new Peer({
            initiator: false,
            trickle: false,
            stream,
        });

        peer.on('signal', signal => {
            socket?.emit('webrtc_answer', { to: callerID, answer: signal });
        });

        peer.on('stream', remoteStream => {
            addParticipantStream(callerID, remoteStream);
        });

        peer.signal(incomingSignal);
        return peer;
    }

    function addParticipantStream(id: string, stream: MediaStream) {
        setParticipants(prev => {
            if (prev.find(p => p.id === id)) return prev;
            return [...prev, { id, stream }];
        });
    }

    // --- Controls ---
    const toggleMic = () => {
        if (myStream) {
            myStream.getAudioTracks()[0].enabled = !isMicOn;
            setIsMicOn(!isMicOn);
        }
    };

    const toggleCam = () => {
        if (myStream) {
            myStream.getVideoTracks()[0].enabled = !isCamOn;
            setIsCamOn(!isCamOn);
        }
    };

    const toggleScreenShare = async () => {
        if (!isSharingScreen) {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                setIsSharingScreen(true);

                // Replace video track in all active peer connections
                const screenTrack = screenStream.getVideoTracks()[0];
                const oldTrack = myStream?.getVideoTracks()[0];

                if (oldTrack) {
                    Object.values(peersRef.current).forEach(peer => {
                        peer.replaceTrack(oldTrack, screenTrack, myStream!);
                    });
                }

                // If user stops sharing via browser UI prompt
                screenTrack.onended = () => {
                    stopScreenShare();
                };

                // Update local preview
                if (myVideoRef.current) myVideoRef.current.srcObject = screenStream;

            } catch (err) {
                console.error("Screen share failed", err);
            }
        } else {
            stopScreenShare();
        }
    };

    const stopScreenShare = async () => {
        setIsSharingScreen(false);
        try {
            // Get original camera track back
            const originalStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const oldVideoTrack = originalStream.getVideoTracks()[0];

            // Sync camera state
            oldVideoTrack.enabled = isCamOn;

            // Replace in peers
            const currentVideoTrack = (myVideoRef.current?.srcObject as MediaStream)?.getVideoTracks()[0];
            if (currentVideoTrack) {
                Object.values(peersRef.current).forEach(peer => {
                    peer.replaceTrack(currentVideoTrack, oldVideoTrack, myStream!);
                });
                currentVideoTrack.stop(); // Stop the screen sharing track explicitly
            }

            // Update local stream and preview
            if (myStream) {
                myStream.removeTrack(myStream.getVideoTracks()[0]);
                myStream.addTrack(oldVideoTrack);
            }
            if (myVideoRef.current) myVideoRef.current.srcObject = myStream;

        } catch (err) {
            console.error("Failed to restore camera", err);
        }
    };


    const endCall = () => {
        router.push('/dashboard');
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !socket || !user) return;

        socket.emit('send_meeting_message', {
            roomId,
            senderId: user.id,
            senderName: user.username,
            text: newMessage
        });
        setNewMessage('');
    };

    // --- Layout Calcs ---
    // Mimic Google Meet grid logic
    const totalVideos = participants.length + 1; // +1 for local
    const gridCols = totalVideos === 1 ? 'grid-cols-1' :
        totalVideos === 2 ? 'grid-cols-1 md:grid-cols-2' :
            totalVideos <= 4 ? 'grid-cols-2' :
                totalVideos <= 6 ? 'grid-cols-2 md:grid-cols-3' :
                    'grid-cols-3 md:grid-cols-4';


    // ==========================================
    // RENDER: LOBBY
    // ==========================================
    if (!hasJoined) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6 text-white overflow-hidden">
                <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

                    {/* Left: Video Preview */}
                    <div className="flex flex-col items-center">
                        <div className="w-full aspect-video bg-neutral-900 rounded-2xl overflow-hidden relative shadow-2xl border border-neutral-800">
                            {isCamOn ? (
                                <video ref={myVideoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
                                    <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-4xl text-white font-semibold">
                                        {user?.username.charAt(0).toUpperCase()}
                                    </div>
                                </div>
                            )}

                            {/* Preview Controls overlay */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
                                <button onClick={toggleMic} className={`p-4 rounded-full backdrop-blur-md transition-colors ${isMicOn ? 'bg-neutral-900/50 hover:bg-neutral-900/80 text-white' : 'bg-red-500 text-white hover:bg-red-600 border-red-500'}`}>
                                    {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                                </button>
                                <button onClick={toggleCam} className={`p-4 rounded-full backdrop-blur-md transition-colors ${isCamOn ? 'bg-neutral-900/50 hover:bg-neutral-900/80 text-white' : 'bg-red-500 text-white hover:bg-red-600 border-red-500'}`}>
                                    {isCamOn ? <Video size={20} /> : <VideoOff size={20} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right: Join Form */}
                    <div className="flex flex-col items-center md:items-start text-center md:text-left">
                        <h1 className="text-4xl font-normal mb-2 tracking-tight">Ready to join?</h1>
                        <p className="text-neutral-400 mb-8 font-mono text-sm">Hub: {roomId}</p>

                        <div className="flex gap-4">
                            <button
                                onClick={handleJoinMeeting}
                                disabled={!isConnected}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-800 disabled:text-neutral-500 text-white px-8 py-3 rounded-full font-medium transition-colors text-lg"
                            >
                                {isConnected ? 'Join Now' : 'Connecting...'}
                            </button>
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="bg-transparent hover:bg-neutral-800/50 text-blue-500 font-medium px-8 py-3 rounded-full transition-colors"
                            >
                                Return to Dashboard
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        );
    }

    // ==========================================
    // RENDER: MAIN MEETING ROOM
    // ==========================================
    return (
        <div className="h-screen bg-[#202124] flex overflow-hidden font-sans">

            {/* Main Video Area */}
            <div className={`flex-1 flex flex-col transition-all duration-300 ${activeSidebar ? 'md:pr-80' : ''}`}>

                {/* Grid */}
                <div className="flex-1 p-4 flex items-center justify-center relative overflow-hidden">
                    <div className={`w-full max-h-full aspect-video md:aspect-auto md:w-full md:h-full grid ${gridCols} gap-4 max-w-7xl mx-auto items-center p-4 content-center`}>

                        {/* Local Video */}
                        <div className="relative w-full h-full bg-[#3c4043] rounded-xl overflow-hidden shadow-sm group min-h-[200px]">
                            {isCamOn || isSharingScreen ? (
                                <video ref={myVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${isSharingScreen ? '' : 'scale-x-[-1]'}`} />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-[#3c4043]">
                                    <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-3xl font-medium text-white shadow-lg">
                                        {user?.username.charAt(0).toUpperCase()}
                                    </div>
                                </div>
                            )}
                            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md text-xs text-white font-medium flex items-center gap-2">
                                <span>You {isSharingScreen ? '(Presenting)' : ''}</span>
                                {!isMicOn && <MicOff size={12} className="text-red-400" />}
                            </div>
                        </div>

                        {/* Remote Videos */}
                        {participants.map((p) => (
                            <VideoComponent key={p.id} participant={p} />
                        ))}

                    </div>
                </div>

                {/* Bottom Control Bar */}
                <div className="h-20 bg-[#202124] flex items-center justify-between px-6 border-t border-[#3c4043]/50 shrink-0 z-10 w-full fixed bottom-0 md:relative">

                    {/* Left: Time & Code */}
                    <div className="hidden md:flex items-center text-white font-medium text-sm gap-4">
                        <span>{format(new Date(), 'hh:mm a')}</span>
                        <span className="text-neutral-500">|</span>
                        <span className="uppercase tracking-wider">{roomId}</span>
                    </div>

                    {/* Center: Controls */}
                    <div className="flex items-center gap-3 md:gap-4 flex-1 md:flex-none justify-center">
                        <button onClick={toggleMic} className={`p-3 md:p-4 rounded-full transition-colors ${isMicOn ? 'bg-[#3c4043] hover:bg-[#4d5155] text-white' : 'bg-[#ea4335] text-white hover:bg-[#d93025]'}`}>
                            {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                        </button>

                        <button onClick={toggleCam} className={`p-3 md:p-4 rounded-full transition-colors ${isCamOn ? 'bg-[#3c4043] hover:bg-[#4d5155] text-white' : 'bg-[#ea4335] text-white hover:bg-[#d93025]'}`}>
                            {isCamOn ? <Video size={20} /> : <VideoOff size={20} />}
                        </button>

                        <button onClick={toggleScreenShare} className={`p-3 md:p-4 rounded-full transition-colors ${isSharingScreen ? 'bg-blue-200 text-blue-800' : 'bg-[#3c4043] hover:bg-[#4d5155] text-white'}`}>
                            <MonitorUp size={20} />
                        </button>

                        <button onClick={endCall} className="w-16 md:w-20 py-2.5 md:py-3 rounded-full bg-[#ea4335] hover:bg-[#d93025] text-white transition-colors flex justify-center ml-2 shadow-lg">
                            <PhoneOff size={22} className="rotate-[135deg]" />
                        </button>
                    </div>

                    {/* Right: Sidebar Toggles */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setActiveSidebar(activeSidebar === 'people' ? null : 'people')}
                            className={`p-3 rounded-full transition-colors ${activeSidebar === 'people' ? 'bg-blue-200 text-blue-800' : 'text-neutral-300 hover:bg-[#3c4043]'}`}
                        >
                            <Users size={20} />
                        </button>
                        <button
                            onClick={() => setActiveSidebar(activeSidebar === 'chat' ? null : 'chat')}
                            className={`p-3 rounded-full transition-colors ${activeSidebar === 'chat' ? 'bg-blue-200 text-blue-800' : 'text-neutral-300 hover:bg-[#3c4043]'}`}
                        >
                            <MessageSquare size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Sidebar Overlay/Drawer */}
            <div className={`fixed inset-y-0 right-0 w-full md:w-80 bg-[#ffffff] transform transition-transform duration-300 ease-in-out z-20 flex flex-col ${activeSidebar ? 'translate-x-0 shadow-2xl md:shadow-none' : 'translate-x-full'} md:absolute md:top-4 md:bottom-24 md:h-auto md:rounded-2xl md:mr-4 overflow-hidden border border-neutral-200`}>

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-white shrink-0">
                    <h2 className="text-lg font-medium text-neutral-800">
                        {activeSidebar === 'chat' ? 'In-call messages' : 'People'}
                    </h2>
                    <button onClick={() => setActiveSidebar(null)} className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content: People */}
                {activeSidebar === 'people' && (
                    <div className="flex-1 overflow-y-auto p-2 bg-white text-neutral-800 text-sm">
                        <div className="flex items-center gap-3 p-3 hover:bg-neutral-50 rounded-lg cursor-default">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-medium">
                                {user?.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-neutral-700 flex-1">{user?.username} (You)</span>
                        </div>
                        {participants.map(p => (
                            <div key={p.id} className="flex items-center gap-3 p-3 hover:bg-neutral-50 rounded-lg cursor-default">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-medium">
                                    P
                                </div>
                                <span className="font-medium text-neutral-700 flex-1">Participant</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Content: Chat */}
                {activeSidebar === 'chat' && (
                    <>
                        <div className="p-4 bg-neutral-50 text-xs text-neutral-500 text-center border-b border-neutral-100 shrink-0">
                            Messages can only be seen by people in the call and are deleted when the call ends.
                        </div>
                        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
                            {messages.map((msg, i) => {
                                const isMe = msg.senderId === user?.id;
                                return (
                                    <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-baseline gap-2 mb-1">
                                            <span className="text-xs font-semibold text-neutral-700">{isMe ? 'You' : msg.senderName}</span>
                                            <span className="text-[10px] text-neutral-400">{format(new Date(msg.timestamp), 'hh:mm a')}</span>
                                        </div>
                                        <div className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-blue-500 text-white rounded-tr-sm' : 'bg-neutral-100 text-neutral-800 rounded-tl-sm border border-neutral-200'}`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-4 bg-white border-t border-neutral-100 shrink-0">
                            <form onSubmit={handleSendMessage} className="flex gap-2 relative">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Send a message to everyone"
                                    className="flex-1 bg-neutral-100 border-none rounded-full pl-4 pr-12 py-3 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-neutral-500"
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim()}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-600 disabled:text-neutral-400 transition-colors"
                                >
                                    <Send size={18} className="ml-1 shrink-0" />
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </div>

        </div>
    );
}

// Subcomponent to render remote peers securely without triggering re-renders of the main layout
function VideoComponent({ participant }: { participant: Participant }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = participant.stream;
        }
    }, [participant.stream]);

    return (
        <div className="relative w-full h-full bg-[#3c4043] rounded-xl overflow-hidden shadow-sm min-h-[200px]">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
            />
            {/* If video track is disabled visually, we'd add an avatar overlay here, but simple-peer automatically mutes tracks without metadata, so we rely on stream state. */}
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md text-xs text-white font-medium flex items-center gap-2">
                Participant
            </div>
        </div>
    );
}
