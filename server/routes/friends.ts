import express from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { Friendship } from "../models/Friendship";
import { User } from "../models/User";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/friends - List friends and pending requests
router.get("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;

    // Get accepted friendships
    const friendships = await Friendship.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: "accepted",
    }).populate("requester recipient", "name email isOnline lastSeen");

    const friends = friendships.map((f) => {
      const friend =
        f.requester._id.toString() === userId ? f.recipient : f.requester;
      return {
        friendshipId: f._id,
        user: friend,
        since: f.updatedAt,
      };
    });

    // Get pending requests received
    const pendingReceived = await Friendship.find({
      recipient: userId,
      status: "pending",
    }).populate("requester", "name email isOnline lastSeen");

    // Get pending requests sent
    const pendingSent = await Friendship.find({
      requester: userId,
      status: "pending",
    }).populate("recipient", "name email isOnline lastSeen");

    res.json({
      friends,
      pendingReceived: pendingReceived.map((f) => ({
        friendshipId: f._id,
        user: f.requester,
        sentAt: f.createdAt,
      })),
      pendingSent: pendingSent.map((f) => ({
        friendshipId: f._id,
        user: f.recipient,
        sentAt: f.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching friends:", error);
    res.status(500).json({ error: "Failed to fetch friends" });
  }
});

// POST /api/friends/request/:userId - Send friend request
router.post("/request/:userId", async (req: AuthRequest, res) => {
  try {
    const requesterId = req.userId;
    const recipientId = req.params.userId;

    if (requesterId === recipientId) {
      return res.status(400).json({ error: "Cannot send friend request to yourself" });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if friendship already exists
    const existing = await Friendship.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId },
      ],
    });

    if (existing) {
      if (existing.status === "accepted") {
        return res.status(400).json({ error: "Already friends" });
      }
      if (existing.status === "pending") {
        return res.status(400).json({ error: "Friend request already pending" });
      }
      if (existing.status === "blocked") {
        return res.status(400).json({ error: "Cannot send request to this user" });
      }
      // If declined, allow re-request
      existing.status = "pending";
      existing.requester = requesterId as any;
      existing.recipient = recipientId as any;
      await existing.save();
      return res.json({ message: "Friend request sent", friendship: existing });
    }

    const friendship = await Friendship.create({
      requester: requesterId,
      recipient: recipientId,
      status: "pending",
    });

    res.status(201).json({ message: "Friend request sent", friendship });
  } catch (error) {
    console.error("Error sending friend request:", error);
    res.status(500).json({ error: "Failed to send friend request" });
  }
});

// PUT /api/friends/accept/:friendshipId - Accept friend request
router.put("/accept/:friendshipId", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const friendshipId = req.params.friendshipId;

    const friendship = await Friendship.findOne({
      _id: friendshipId,
      recipient: userId,
      status: "pending",
    });

    if (!friendship) {
      return res.status(404).json({ error: "Friend request not found" });
    }

    friendship.status = "accepted";
    await friendship.save();

    const populatedFriendship = await Friendship.findById(friendshipId).populate(
      "requester recipient",
      "name email isOnline lastSeen"
    );

    res.json({ message: "Friend request accepted", friendship: populatedFriendship });
  } catch (error) {
    console.error("Error accepting friend request:", error);
    res.status(500).json({ error: "Failed to accept friend request" });
  }
});

// PUT /api/friends/decline/:friendshipId - Decline friend request
router.put("/decline/:friendshipId", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const friendshipId = req.params.friendshipId;

    const friendship = await Friendship.findOne({
      _id: friendshipId,
      recipient: userId,
      status: "pending",
    });

    if (!friendship) {
      return res.status(404).json({ error: "Friend request not found" });
    }

    friendship.status = "declined";
    await friendship.save();

    res.json({ message: "Friend request declined" });
  } catch (error) {
    console.error("Error declining friend request:", error);
    res.status(500).json({ error: "Failed to decline friend request" });
  }
});

// DELETE /api/friends/:userId - Remove friend
router.delete("/:userId", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const friendId = req.params.userId;

    const result = await Friendship.findOneAndDelete({
      $or: [
        { requester: userId, recipient: friendId },
        { requester: friendId, recipient: userId },
      ],
      status: "accepted",
    });

    if (!result) {
      return res.status(404).json({ error: "Friendship not found" });
    }

    res.json({ message: "Friend removed" });
  } catch (error) {
    console.error("Error removing friend:", error);
    res.status(500).json({ error: "Failed to remove friend" });
  }
});

// DELETE /api/friends/request/:friendshipId - Cancel sent friend request
router.delete("/request/:friendshipId", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const friendshipId = req.params.friendshipId;

    const result = await Friendship.findOneAndDelete({
      _id: friendshipId,
      requester: userId,
      status: "pending",
    });

    if (!result) {
      return res.status(404).json({ error: "Friend request not found" });
    }

    res.json({ message: "Friend request cancelled" });
  } catch (error) {
    console.error("Error cancelling friend request:", error);
    res.status(500).json({ error: "Failed to cancel friend request" });
  }
});

export default router;
