import express from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { Message } from "../models/Message";
import { Conversation } from "../models/Conversation";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// POST /api/messages - Send a message (REST fallback, Socket.io preferred)
router.post("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { conversationId, content } = req.body;

    if (!conversationId || !content || !content.trim()) {
      return res.status(400).json({ error: "Conversation ID and content are required" });
    }

    // Validate conversation exists and user is participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Create message
    const messageData = {
      conversation: conversationId,
      sender: userId,
      content: content.trim(),
      readBy: [userId],
    };
    const message = await Message.create(messageData as any);

    // Update conversation's lastMessage
    conversation.lastMessage = {
      content: content.trim().substring(0, 100),
      sender: userId as any,
      createdAt: new Date(),
    };
    await conversation.save();

    const populatedMessage = await Message.findById((message as any)._id).populate(
      "sender",
      "name email"
    );

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// GET /api/messages/:conversationId - Get messages for a conversation
router.get("/:conversationId", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const conversationId = req.params.conversationId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    // Verify user is participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = await Message.find({ conversation: conversationId })
      .populate("sender", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Message.countDocuments({ conversation: conversationId });

    res.json({
      messages: messages.reverse(),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + messages.length < total,
      },
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// PUT /api/messages/read/:conversationId - Mark messages as read
router.put("/read/:conversationId", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const conversationId = req.params.conversationId;

    // Verify user is participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    await Message.updateMany(
      {
        conversation: conversationId,
        readBy: { $ne: userId },
      },
      {
        $addToSet: { readBy: userId },
      }
    );

    res.json({ message: "Messages marked as read" });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({ error: "Failed to mark messages as read" });
  }
});

export default router;
