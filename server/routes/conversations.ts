import express from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { Conversation, MAX_GROUP_SIZE } from "../models/Conversation";
import { Message } from "../models/Message";
import { Friendship } from "../models/Friendship";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/conversations - List user's conversations
router.get("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate("participants", "name email isOnline lastSeen")
      .populate("admin", "name email")
      .sort({ updatedAt: -1 });

    // Get unread counts for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversation: conv._id,
          readBy: { $ne: userId },
        });
        return {
          ...conv.toObject(),
          unreadCount,
        };
      })
    );

    res.json(conversationsWithUnread);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// POST /api/conversations - Create conversation (personal or group)
router.post("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { type, participantIds, name } = req.body;

    if (!type || !participantIds || !Array.isArray(participantIds)) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    // Add current user to participants
    const allParticipants = [...new Set([userId, ...participantIds])];

    if (type === "personal") {
      if (allParticipants.length !== 2) {
        return res.status(400).json({ error: "Personal chat requires exactly 2 participants" });
      }

      // Check if they are friends
      const areFriends = await Friendship.findOne({
        $or: [
          { requester: userId, recipient: participantIds[0] },
          { requester: participantIds[0], recipient: userId },
        ],
        status: "accepted",
      });

      if (!areFriends) {
        return res.status(400).json({ error: "Can only chat with friends" });
      }

      // Check if conversation already exists
      const existing = await Conversation.findOne({
        type: "personal",
        participants: { $all: allParticipants, $size: 2 },
      }).populate("participants", "name email isOnline lastSeen");

      if (existing) {
        return res.json(existing);
      }

      const conversation = await Conversation.create({
        type: "personal",
        participants: allParticipants,
      });

      const populated = await Conversation.findById(conversation._id).populate(
        "participants",
        "name email isOnline lastSeen"
      );

      return res.status(201).json(populated);
    }

    // Group chat
    if (type === "group") {
      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: "Group name is required" });
      }

      if (allParticipants.length > MAX_GROUP_SIZE) {
        return res.status(400).json({ error: `Group cannot exceed ${MAX_GROUP_SIZE} members` });
      }

      if (allParticipants.length < 2) {
        return res.status(400).json({ error: "Group requires at least 2 members" });
      }

      // Verify all participants are friends with the creator
      for (const participantId of participantIds) {
        const areFriends = await Friendship.findOne({
          $or: [
            { requester: userId, recipient: participantId },
            { requester: participantId, recipient: userId },
          ],
          status: "accepted",
        });

        if (!areFriends) {
          return res.status(400).json({ error: "Can only add friends to group" });
        }
      }

      const conversation = await Conversation.create({
        type: "group",
        participants: allParticipants,
        name: name.trim(),
        admin: userId,
      });

      const populated = await Conversation.findById(conversation._id)
        .populate("participants", "name email isOnline lastSeen")
        .populate("admin", "name email");

      return res.status(201).json(populated);
    }

    res.status(400).json({ error: "Invalid conversation type" });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// GET /api/conversations/:id - Get conversation with messages
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const conversationId = req.params.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    })
      .populate("participants", "name email isOnline lastSeen")
      .populate("admin", "name email");

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Get messages (newest first, then reverse for display)
    const messages = await Message.find({ conversation: conversationId })
      .populate("sender", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalMessages = await Message.countDocuments({ conversation: conversationId });

    res.json({
      conversation,
      messages: messages.reverse(), // Oldest first for display
      pagination: {
        page,
        limit,
        total: totalMessages,
        pages: Math.ceil(totalMessages / limit),
        hasMore: skip + messages.length < totalMessages,
      },
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

// PUT /api/conversations/:id/members - Add/remove group members
router.put("/:id/members", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const conversationId = req.params.id;
    const { action, memberIds } = req.body;

    if (!action || !memberIds || !Array.isArray(memberIds)) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "group",
      admin: userId,
    });

    if (!conversation) {
      return res.status(404).json({ error: "Group not found or not admin" });
    }

    if (action === "add") {
      // Check max size
      const newSize = conversation.participants.length + memberIds.length;
      if (newSize > MAX_GROUP_SIZE) {
        return res.status(400).json({ error: `Group cannot exceed ${MAX_GROUP_SIZE} members` });
      }

      // Verify all new members are friends with admin
      for (const memberId of memberIds) {
        const areFriends = await Friendship.findOne({
          $or: [
            { requester: userId, recipient: memberId },
            { requester: memberId, recipient: userId },
          ],
          status: "accepted",
        });

        if (!areFriends) {
          return res.status(400).json({ error: "Can only add friends to group" });
        }
      }

      conversation.participants = [
        ...new Set([...conversation.participants.map((p) => p.toString()), ...memberIds]),
      ] as any;
    } else if (action === "remove") {
      // Cannot remove admin
      if (memberIds.includes(userId)) {
        return res.status(400).json({ error: "Admin cannot be removed" });
      }

      conversation.participants = conversation.participants.filter(
        (p) => !memberIds.includes(p.toString())
      );

      if (conversation.participants.length < 2) {
        return res.status(400).json({ error: "Group must have at least 2 members" });
      }
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }

    await conversation.save();

    const populated = await Conversation.findById(conversationId)
      .populate("participants", "name email isOnline lastSeen")
      .populate("admin", "name email");

    res.json(populated);
  } catch (error) {
    console.error("Error updating group members:", error);
    res.status(500).json({ error: "Failed to update group members" });
  }
});

// PUT /api/conversations/:id/name - Rename group
router.put("/:id/name", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const conversationId = req.params.id;
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "Group name is required" });
    }

    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: conversationId,
        type: "group",
        admin: userId,
      },
      { name: name.trim() },
      { new: true }
    )
      .populate("participants", "name email isOnline lastSeen")
      .populate("admin", "name email");

    if (!conversation) {
      return res.status(404).json({ error: "Group not found or not admin" });
    }

    res.json(conversation);
  } catch (error) {
    console.error("Error renaming group:", error);
    res.status(500).json({ error: "Failed to rename group" });
  }
});

// DELETE /api/conversations/:id - Leave/delete group
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const conversationId = req.params.id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (conversation.type === "personal") {
      // For personal chats, just remove the conversation
      await Message.deleteMany({ conversation: conversationId });
      await Conversation.findByIdAndDelete(conversationId);
      return res.json({ message: "Conversation deleted" });
    }

    // For groups
    if (conversation.admin?.toString() === userId) {
      // Admin leaving deletes the group
      await Message.deleteMany({ conversation: conversationId });
      await Conversation.findByIdAndDelete(conversationId);
      return res.json({ message: "Group deleted" });
    }

    // Regular member leaving
    conversation.participants = conversation.participants.filter(
      (p) => p.toString() !== userId
    );
    await conversation.save();

    res.json({ message: "Left group" });
  } catch (error) {
    console.error("Error leaving conversation:", error);
    res.status(500).json({ error: "Failed to leave conversation" });
  }
});

export default router;
