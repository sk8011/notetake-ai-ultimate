import express from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { Friendship } from "../models/Friendship";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/users - Browse/search all users (excluding self and existing friends)
router.get("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const search = req.query.search as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Get list of users already connected (friends or pending)
    const existingConnections = await Friendship.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: { $in: ["pending", "accepted"] },
    });

    const connectedUserIds = existingConnections.map((f) =>
      f.requester.toString() === userId
        ? f.recipient.toString()
        : f.requester.toString()
    );

    // Build query
    const query: any = {
      _id: { $nin: [userId, ...connectedUserIds] },
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .select("name email isOnline lastSeen")
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// GET /api/users/:id - Get user profile
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "name email isOnline lastSeen createdAt"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
