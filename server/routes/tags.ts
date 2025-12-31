import { Router, Response } from "express";
import { Tag } from "../models/Tag";
import { Note } from "../models/Note";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all tags for the authenticated user
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const tags = await Tag.find({ userId: req.userId }).sort({ label: 1 });
    res.json(tags);
  } catch (error) {
    console.error("Get tags error:", error);
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});

// Update a tag
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { label } = req.body;

    if (!label) {
      return res.status(400).json({ error: "Label is required" });
    }

    const oldTag = await Tag.findOne({ _id: req.params.id, userId: req.userId });
    if (!oldTag) {
      return res.status(404).json({ error: "Tag not found" });
    }

    const oldLabel = oldTag.label;

    // Update the tag
    const tag = await Tag.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { label },
      { new: true }
    );

    // Update all notes that use this tag
    await Note.updateMany(
      { userId: req.userId, tags: oldLabel },
      { $set: { "tags.$": label } }
    );

    res.json(tag);
  } catch (error) {
    console.error("Update tag error:", error);
    res.status(500).json({ error: "Failed to update tag" });
  }
});

// Delete a tag
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const tag = await Tag.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!tag) {
      return res.status(404).json({ error: "Tag not found" });
    }

    // Remove tag from all notes
    await Note.updateMany(
      { userId: req.userId },
      { $pull: { tags: tag.label } }
    );

    res.json({ message: "Tag deleted successfully" });
  } catch (error) {
    console.error("Delete tag error:", error);
    res.status(500).json({ error: "Failed to delete tag" });
  }
});

export default router;
