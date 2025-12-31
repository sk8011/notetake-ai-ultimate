import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { Message } from "../models/Message";
import { Conversation } from "../models/Conversation";

interface SocketUser {
  userId: string;
  socketId: string;
}

// Track online users
const onlineUsers = new Map<string, string>(); // userId -> socketId

export const initializeSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback-secret") as { userId: string };
      socket.data.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const userId = socket.data.userId;
    console.log(`User connected: ${userId}`);

    // Add to online users
    onlineUsers.set(userId, socket.id);

    // Update user online status
    await User.findByIdAndUpdate(userId, { isOnline: true });

    // Join user's personal room for direct notifications
    socket.join(`user:${userId}`);

    // Join all conversation rooms the user is part of
    const conversations = await Conversation.find({ participants: userId });
    conversations.forEach((conv) => {
      socket.join(`conversation:${conv._id}`);
    });

    // Broadcast online status to friends
    socket.broadcast.emit("user:online", { userId });

    // Handle joining a conversation room
    socket.on("conversation:join", (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    // Handle leaving a conversation room
    socket.on("conversation:leave", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Handle sending a message
    socket.on("message:send", async (data: { conversationId: string; content: string }) => {
      try {
        const { conversationId, content } = data;

        // Validate conversation exists and user is participant
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: userId,
        });

        if (!conversation) {
          socket.emit("error", { message: "Conversation not found" });
          return;
        }

        // Create message
        const message = await Message.create({
          conversation: conversationId,
          sender: userId,
          content: content.trim(),
          readBy: [userId],
        });

        // Update conversation's lastMessage
        conversation.lastMessage = {
          content: content.trim().substring(0, 100),
          sender: userId,
          createdAt: new Date(),
        };
        await conversation.save();

        // Populate sender info
        const populatedMessage = await Message.findById(message._id).populate(
          "sender",
          "name email"
        );

        // Emit to all participants in the conversation
        io.to(`conversation:${conversationId}`).emit("message:receive", {
          message: populatedMessage,
          conversationId,
        });

        // Note: message:notification is not needed separately since all participants
        // are already in the conversation room and will receive message:receive
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Handle typing indicator
    socket.on("typing:start", (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit("typing:update", {
        userId,
        conversationId,
        isTyping: true,
      });
    });

    socket.on("typing:stop", (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit("typing:update", {
        userId,
        conversationId,
        isTyping: false,
      });
    });

    // Handle marking messages as read
    socket.on("messages:read", async (conversationId: string) => {
      try {
        await Message.updateMany(
          {
            conversation: conversationId,
            readBy: { $ne: userId },
          },
          {
            $addToSet: { readBy: userId },
          }
        );

        io.to(`conversation:${conversationId}`).emit("messages:read:update", {
          conversationId,
          userId,
        });
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log(`User disconnected: ${userId}`);
      onlineUsers.delete(userId);

      // Update user offline status
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date(),
      });

      // Broadcast offline status
      socket.broadcast.emit("user:offline", { userId });
    });
  });

  return io;
};

// Helper function to check if user is online
export const isUserOnline = (userId: string): boolean => {
  return onlineUsers.has(userId);
};

// Helper function to get socket ID for a user
export const getSocketId = (userId: string): string | undefined => {
  return onlineUsers.get(userId);
};
