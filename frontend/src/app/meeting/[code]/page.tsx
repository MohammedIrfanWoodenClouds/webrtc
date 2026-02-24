'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useParams, useRouter } from 'next/navigation';
import Peer from 'simple-peer';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

interface Participant {
    id: string; // socketId
    stream: MediaStream;
}

export default function MeetingPage() {
    const { user } = useAuth();
    const { socket, isConnected } = useSocket();
    const router = useRouter();
    const params = useParams();
    const roomId = params.code as string;

    const [myStream, setMyStream] = useState<MediaStream | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);

    // Controls State
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCamOn, setIsCamOn] = useState(true);

    const myVideoRef = useRef<HTMLVideoElement>(null);
    const peersRef = useRef<{ [socketId: string]: Peer.Instance }>({});

    useEffect(() => {
        if (!user || (!socket && !isConnected)) {
            // Need to be logged in to join meetings
            if (!user) router.push('/login');
            return;
        }

        // 1. Get Local Media
        navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
            setMyStream(stream);
            if (myVideoRef.current) myVideoRef.current.srcObject = stream;

            // 2. Join the Socket.io room for signaling
            socket.emit('join_meeting', roomId);

            // 3. New User Joined -> We initiate an offer to them
            socket.on('user_joined_meeting', (newUserId) => {
                const peer = createPeer(newUserId, socket.id, stream);
                peersRef.current[newUserId] = peer;
            });

            // 4. We receive an offer from someone already in the room -> We answer
            socket.on('webrtc_offer', (data: { offer: any, from: string }) => {
                const peer = addPeer(data.offer, data.from, stream);
                peersRef.current[data.from] = peer;
            });

            // 5. We receive an answer to an offer we sent
            socket.on('webrtc_answer', (data: { answer: any, from: string }) => {
                const peer = peersRef.current[data.from];
                if (peer) {
                    peer.signal(data.answer);
                }
            });

            // 6. User Left
            socket.on('user_left_meeting', (userId) => {
                if (peersRef.current[userId]) {
                    peersRef.current[userId].destroy();
                    delete peersRef.current[userId];
                }
                setParticipants(prev => prev.filter(p => p.id !== userId));
            });
        });

        return () => {
            // Cleanup on unmount
            if (socket) {
                socket.emit('disconnect_meeting', roomId);
                socket.off('user_joined_meeting');
                socket.off('webrtc_offer');
                socket.off('webrtc_answer');
                socket.off('user_left_meeting');
            }
            // Stop media tracks
            myStream?.getTracks().forEach(track => track.stop());
            // Destroy peers
            Object.values(peersRef.current).forEach(peer => peer.destroy());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, socket, isConnected, roomId]);

    // peer initialization for when we are the initiator (someone else joined)
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

    // peer initialization for when we receive an offer (we joined an existing room)
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
            if (prev.find(p => p.id === id)) return prev; // Avoid duplicates
            return [...prev, { id, stream }];
        });
    }

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

    const endCall = () => {
        router.push('/dashboard');
    };

    return (
        <div className="min-h-screen bg-neutral-950 flex flex-col">

            {/* Header */}
            <header className="p-4 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-white tracking-tight">SkySync Hub</h1>
                    <div className="bg-neutral-800 px-3 py-1 rounded-full text-xs font-mono text-neutral-300 border border-neutral-700">
                        {roomId}
                    </div>
                </div>
            </header>

            {/* Video Grid Area */}
            <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-center justify-center overflow-auto pb-32">
                {/* Local Video */}
                <div className="relative aspect-video bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800 shadow-xl group">
                    <video
                        ref={myVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm text-white border border-white/10 flex items-center gap-2">
                        You (Host)
                        {!isMicOn && <MicOff size={14} className="text-red-400" />}
                    </div>
                </div>

                {/* Remote Videos */}
                {participants.map((p) => (
                    <VideoComponent key={p.id} participant={p} />
                ))}
            </div>

            {/* Control Bar (Fixed Bottom) */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-neutral-900/80 backdrop-blur-xl border border-neutral-700/50 px-8 py-4 rounded-full flex items-center gap-6 shadow-2xl">
                <button
                    onClick={toggleMic}
                    className={`p-4 rounded-full transition-all ${isMicOn ? 'bg-neutral-700 hover:bg-neutral-600 text-white' : 'bg-red-500/20 text-red-500 border border-red-500/50'}`}
                >
                    {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
                </button>

                <button
                    onClick={toggleCam}
                    className={`p-4 rounded-full transition-all ${isCamOn ? 'bg-neutral-700 hover:bg-neutral-600 text-white' : 'bg-red-500/20 text-red-500 border border-red-500/50'}`}
                >
                    {isCamOn ? <Video size={24} /> : <VideoOff size={24} />}
                </button>

                <div className="w-px h-8 bg-neutral-700 mx-2"></div>

                <button
                    onClick={endCall}
                    className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all shadow-lg shadow-red-600/20"
                >
                    <PhoneOff size={24} />
                </button>
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
        <div className="relative aspect-video bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800 shadow-xl">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm text-white border border-white/10">
                Participant
            </div>
        </div>
    );
}
