import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import cookie from 'cookie';
import { env } from './env';
import { verifyToken } from '../utils/token';

let io: SocketIOServer;

export const initSocket = (httpServer: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const cookies = cookie.parse(socket.handshake.headers.cookie || '');
    const token = socket.handshake.auth.token || cookies.locoverse_token;
    const decoded = token ? verifyToken(token) : null;
    if (!decoded?.userId) {
      return next(new Error('Invalid token'));
    }
    (socket as any).userId = decoded.userId;
    next();
  });

  const onlineUsers = new Map<string, string>();

  io.on('connection', (socket) => {
    const userId = (socket as any).userId;

    if (userId) {
      onlineUsers.set(userId, socket.id);
      socket.join(userId);
      io.emit('user_online', { userId });
    }

    socket.on('join', (data: { userId: string }) => {
      if (data.userId !== userId) {
        return;
      }
      onlineUsers.set(data.userId, socket.id);
      socket.join(data.userId);
      io.emit('user_online', { userId: data.userId });
    });

    socket.on('typing', (data: { senderId: string; receiverId: string }) => {
      if (data.senderId !== userId) return;
      io.to(data.receiverId).emit('user_typing', { userId: data.senderId });
    });

    socket.on('typing_stop', (data: { senderId: string; receiverId: string }) => {
      if (data.senderId !== userId) return;
      io.to(data.receiverId).emit('user_typing_stop', { userId: data.senderId });
    });

    socket.on('disconnect', () => {
      if (userId) {
        onlineUsers.delete(userId);
        io.emit('user_offline', { userId });
      }
    });
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};
