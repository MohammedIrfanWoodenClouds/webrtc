'use client';

import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { LogOut, Video, Send } from 'lucide-react';

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const { socket, isConnected } = useSocket();
    const router = useRouter();

    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [meetingCode, setMeetingCode] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!user) {
            router.push('/login');
            return;
        }

        if (socket && isConnected) {
            socket.emit('join_global');
            socket.on('new_message', (msg) => {
                setMessages(prev => [...prev, msg]);
                setTimeout(() => {
                    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
                }, 100);
            });
        }

        return () => {
            if (socket) socket.off('new_message');
        };
    }, [user, socket, isConnected, router]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !socket) return;

        socket.emit('send_message', {
            senderId: user?.id,
            senderName: user?.username,
            text: newMessage
        });
        setNewMessage('');
    };

    const handleCreateMeeting = () => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        router.push(`/meeting/${code}`);
    };

    const handleJoinMeeting = (e: React.FormEvent) => {
        e.preventDefault();
        if (meetingCode.trim().length > 3) {
            router.push(`/meeting/${meetingCode.toUpperCase()}`);
        }
    };

    if (!user) return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">Loading...</div>;

    return (
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col md:flex-row">

            {/* Sidebar / Left Panel */}
            <div className="w-full md:w-80 border-r border-neutral-800 bg-neutral-900/50 p-6 flex flex-col h-auto md:h-screen shrink-0">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl font-bold tracking-tight text-blue-500">SkySync</h1>
                    <button onClick={logout} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-red-400 transition-colors">
                        <LogOut size={20} />
                    </button>
                </div>

                <div className="mb-8">
                    <p className="text-sm text-neutral-400 mb-1">Logged in as</p>
                    <p className="font-semibold text-lg">{user.username}</p>
                    <div className="flex items-center gap-2 mt-2 text-sm text-neutral-500">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        {isConnected ? 'Connected to Signaling' : 'Disconnected'}
                    </div>
                </div>

                <div className="bg-neutral-800/50 rounded-xl p-5 mb-6 border border-neutral-700/50">
                    <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-4">Start a Meeting</h2>
                    <button
                        onClick={handleCreateMeeting}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors mb-4"
                    >
                        <Video size={18} />
                        New Hub
                    </button>

                    <form onSubmit={handleJoinMeeting} className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Enter Code"
                            value={meetingCode}
                            onChange={(e) => setMeetingCode(e.target.value)}
                            className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 w-full focus:outline-none focus:border-blue-500 transition-colors uppercase"
                        />
                        <button type="submit" className="bg-neutral-700 hover:bg-neutral-600 px-4 rounded-lg font-medium transition-colors">
                            Join
                        </button>
                    </form>
                </div>
            </div>

            {/* Chat Area / Right Panel */}
            <div className="flex-1 flex flex-col h-[calc(100vh-theme(spacing.80))] md:h-screen bg-neutral-950 relative">
                <div className="p-6 border-b border-neutral-800 bg-neutral-900/30 backdrop-blur-md sticky top-0 z-10">
                    <h2 className="text-xl font-semibold">Global Transmission Feed</h2>
                    <p className="text-sm text-neutral-500">Public messages visible to all connected clients.</p>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-neutral-600 text-sm">
                            No messages yet. Say hello!
                        </div>
                    ) : (
                        messages.map((msg, i) => (
                            <div key={i} className={`flex flex-col ${msg.senderId === user.id ? 'items-end' : 'items-start'}`}>
                                <span className="text-xs text-neutral-500 mb-1 ml-1">{msg.senderName}</span>
                                <div className={`px-4 py-2.5 rounded-2xl max-w-[80%] ${msg.senderId === user.id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-neutral-800 text-neutral-200 rounded-tl-none'}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-neutral-800 bg-neutral-900/30">
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message to the global feed..."
                            className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim() || !isConnected}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-800 disabled:text-neutral-500 w-12 flex items-center justify-center rounded-xl transition-colors"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            </div>

        </div>
    );
}
