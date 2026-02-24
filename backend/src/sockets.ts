import { Server, Socket } from 'socket.io';
import Message from '../models/Message';

export const setupSockets = (io: Server) => {
    io.on('connection', (socket: Socket) => {
        console.log(`User connected: ${socket.id}`);

        // --- Global Chat ---
        socket.on('join_global', () => {
            socket.join('global_chat');
        });

        socket.on('send_message', async (data) => {
            try {
                const { senderId, senderName, text } = data;
                const msg = await Message.create({ senderId, senderName, text });
                io.to('global_chat').emit('new_message', msg);
            } catch (err) {
                console.error('Message error:', err);
            }
        });

        // --- WebRTC Video Calling ---
        socket.on('join_meeting', (roomId: string) => {
            socket.join(roomId);
            socket.to(roomId).emit('user_joined_meeting', socket.id);
        });

        socket.on('webrtc_offer', (data: { offer: any, to: string }) => {
            socket.to(data.to).emit('webrtc_offer', { offer: data.offer, from: socket.id });
        });

        socket.on('webrtc_answer', (data: { answer: any, to: string }) => {
            socket.to(data.to).emit('webrtc_answer', { answer: data.answer, from: socket.id });
        });

        socket.on('webrtc_ice_candidate', (data: { candidate: any, to: string }) => {
            socket.to(data.to).emit('webrtc_ice_candidate', { candidate: data.candidate, from: socket.id });
        });

        socket.on('disconnect_meeting', (roomId: string) => {
            socket.leave(roomId);
            socket.to(roomId).emit('user_left_meeting', socket.id);
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
            // Notify all rooms the user was in
            socket.rooms.forEach((room) => {
                socket.to(room).emit('user_left_meeting', socket.id);
            });
        });
    });
};
