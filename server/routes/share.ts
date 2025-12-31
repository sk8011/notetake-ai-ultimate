import express from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { NoteShare } from "../models/NoteShare";
import { Note } from "../models/Note";
import { Friendship } from "../models/Friendship";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// POST /api/share/note/:noteId - Share note with a user
router.post("/note/:noteId", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const noteId = req.params.noteId;
    const { sharedWithUserId } = req.body;

    if (!sharedWithUserId) {
      return res.status(400).json({ error: "User ID to share with is required" });
    }

    // Verify note exists and belongs to user
    const note = await Note.findOne({ _id: noteId, userId });
    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }

    // Verify they are friends
    const areFriends = await Friendship.findOne({
      $or: [
        { requester: userId, recipient: sharedWithUserId },
        { requester: sharedWithUserId, recipient: userId },
      ],
      status: "accepted",
    });

    if (!areFriends) {
      return res.status(400).json({ error: "Can only share notes with friends" });
    }

    // Check if already shared
    const existing = await NoteShare.findOne({
      note: noteId,
      sharedWith: sharedWithUserId,
    });

    if (existing) {
      // Reactivate if inactive
      if (!existing.active) {
        existing.active = true;
        await existing.save();
        return res.json({ message: "Note access restored", share: existing });
      }
      return res.status(400).json({ error: "Note already shared with this user" });
    }

    const share = await NoteShare.create({
      note: noteId,
      owner: userId,
      sharedWith: sharedWithUserId,
      active: true,
    });

    const populated = await NoteShare.findById(share._id)
      .populate("note", "title")
      .populate("sharedWith", "name email");

    res.status(201).json({ message: "Note shared successfully", share: populated });
  } catch (error) {
    console.error("Error sharing note:", error);
    res.status(500).json({ error: "Failed to share note" });
  }
});

// DELETE /api/share/note/:noteId/:userId - Revoke access permanently
router.delete("/note/:noteId/:userId", async (req: AuthRequest, res) => {
  try {
    const ownerId = req.userId;
    const noteId = req.params.noteId;
    const sharedWithUserId = req.params.userId;

    const result = await NoteShare.findOneAndDelete({
      note: noteId,
      owner: ownerId,
      sharedWith: sharedWithUserId,
    });

    if (!result) {
      return res.status(404).json({ error: "Share not found" });
    }

    res.json({ message: "Access revoked" });
  } catch (error) {
    console.error("Error revoking access:", error);
    res.status(500).json({ error: "Failed to revoke access" });
  }
});

// PUT /api/share/note/:noteId/:userId - Toggle access (active/inactive)
router.put("/note/:noteId/:userId", async (req: AuthRequest, res) => {
  try {
    const ownerId = req.userId;
    const noteId = req.params.noteId;
    const sharedWithUserId = req.params.userId;
    const { active } = req.body;

    if (typeof active !== "boolean") {
      return res.status(400).json({ error: "Active status is required" });
    }

    const share = await NoteShare.findOneAndUpdate(
      {
        note: noteId,
        owner: ownerId,
        sharedWith: sharedWithUserId,
      },
      { active },
      { new: true }
    )
      .populate("note", "title")
      .populate("sharedWith", "name email");

    if (!share) {
      return res.status(404).json({ error: "Share not found" });
    }

    res.json({ message: `Access ${active ? "enabled" : "disabled"}`, share });
  } catch (error) {
    console.error("Error toggling access:", error);
    res.status(500).json({ error: "Failed to toggle access" });
  }
});

// GET /api/share/my-shared - Notes I've shared (by note)
router.get("/my-shared", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;

    // Get all shares grouped by note
    const shares = await NoteShare.find({ owner: userId })
      .populate("note", "title")
      .populate("sharedWith", "name email")
      .sort({ createdAt: -1 });

    // Group by note
    const groupedByNote = shares.reduce((acc, share) => {
      const noteId = share.note?._id?.toString();
      if (!noteId) return acc;

      if (!acc[noteId]) {
        acc[noteId] = {
          note: share.note,
          sharedWith: [],
        };
      }
      acc[noteId].sharedWith.push({
        shareId: share._id,
        user: share.sharedWith,
        active: share.active,
        sharedAt: share.createdAt,
      });
      return acc;
    }, {} as Record<string, any>);

    res.json(Object.values(groupedByNote));
  } catch (error) {
    console.error("Error fetching shared notes:", error);
    res.status(500).json({ error: "Failed to fetch shared notes" });
  }
});

// GET /api/share/shared-with-me - Notes shared with me
router.get("/shared-with-me", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;

    const shares = await NoteShare.find({
      sharedWith: userId,
      active: true,
    })
      .populate({
        path: "note",
        select: "title markdown tags createdAt updatedAt",
      })
      .populate("owner", "name email")
      .sort({ createdAt: -1 });

    // Filter out shares where note was deleted
    const validShares = shares.filter((share) => share.note);

    res.json(
      validShares.map((share) => ({
        shareId: share._id,
        note: share.note,
        owner: share.owner,
        sharedAt: share.createdAt,
      }))
    );
  } catch (error) {
    console.error("Error fetching shared with me:", error);
    res.status(500).json({ error: "Failed to fetch shared notes" });
  }
});

// GET /api/share/note/:noteId/users - Get users a note is shared with
router.get("/note/:noteId/users", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const noteId = req.params.noteId;

    // Verify note belongs to user
    const note = await Note.findOne({ _id: noteId, userId });
    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }

    const shares = await NoteShare.find({ note: noteId })
      .populate("sharedWith", "name email")
      .sort({ createdAt: -1 });

    res.json(
      shares.map((share) => ({
        shareId: share._id,
        user: share.sharedWith,
        active: share.active,
        sharedAt: share.createdAt,
      }))
    );
  } catch (error) {
    console.error("Error fetching note shares:", error);
    res.status(500).json({ error: "Failed to fetch note shares" });
  }
});

export default router;
