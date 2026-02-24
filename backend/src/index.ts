import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';

import authRoutes from './routes/auth';
import { setupSockets } from './sockets';

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/webrtc_platform';

const app = express();
app.use(express.json());
app.use(cors({ origin: true, credentials: true })); // Allow all origins

app.use('/api/auth', authRoutes);

app.get('/', (req, res) => res.send('SkySync Backend Online'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

setupSockets(io);

server.listen(PORT, '0.0.0.0', async () => {
    console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('🍃 MongoDB Connected');
    } catch (err: any) {
        console.error('❌ DB Error:', err.message);
    }
});

process.on('uncaughtException', (err) => console.error('CRITICAL ERROR:', err));
process.on('unhandledRejection', (err) => console.error('UNHANDLED REJECTION:', err));
