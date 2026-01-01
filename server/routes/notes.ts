import { Router, Response } from "express";
import { Note } from "../models/Note";
import { Tag } from "../models/Tag";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all notes for the authenticated user
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const notes = await Note.find({ userId: req.userId }).sort({ updatedAt: -1 });
    res.json(notes);
  } catch (error) {
    console.error("Get notes error:", error);
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

// Export all notes as ZIP of Markdown files (must be before /:id route)
router.get("/export-all", async (req: AuthRequest, res: Response) => {
  try {
    const archiver = require("archiver");
    
    const notes = await Note.find({ userId: req.userId });
    
    if (notes.length === 0) {
      return res.status(404).json({ error: "No notes to export" });
    }

    // Set up response headers for ZIP download
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=notes-export.zip");

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    // Track filename occurrences to handle duplicates
    const fileNameCounts: Record<string, number> = {};

    for (const note of notes) {
      // Sanitize filename - remove special characters
      let sanitizedTitle = note.title
        .replace(/[<>:"/\\|?*]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 100); // Limit filename length
      
      if (!sanitizedTitle) {
        sanitizedTitle = "Untitled";
      }

      // Handle duplicate names
      if (fileNameCounts[sanitizedTitle]) {
        fileNameCounts[sanitizedTitle]++;
        sanitizedTitle = `${sanitizedTitle} (${fileNameCounts[sanitizedTitle]})`;
      } else {
        fileNameCounts[sanitizedTitle] = 1;
      }

      // Add markdown file to archive
      archive.append(note.markdown, { name: `${sanitizedTitle}.md` });
    }

    await archive.finalize();
  } catch (error) {
    console.error("Export notes error:", error);
    res.status(500).json({ error: "Failed to export notes" });
  }
});

// Bulk delete notes (must be before /:id route)
router.delete("/bulk", async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Note IDs array is required" });
    }

    const result = await Note.deleteMany({
      _id: { $in: ids },
      userId: req.userId,
    });

    res.json({ 
      message: `${result.deletedCount} note(s) deleted successfully`,
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error("Bulk delete notes error:", error);
    res.status(500).json({ error: "Failed to delete notes" });
  }
});

// Get a single note
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }

    res.json(note);
  } catch (error) {
    console.error("Get note error:", error);
    res.status(500).json({ error: "Failed to fetch note" });
  }
});

// Create a new note
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { title, markdown, tags, images } = req.body;

    if (!title || !markdown) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    const note = new Note({
      title,
      markdown,
      tags: tags || [],
      images: images || [],
      userId: req.userId,
    });

    await note.save();

    // Create tags if they don't exist
    if (tags && tags.length > 0) {
      for (const tagLabel of tags) {
        try {
          await Tag.findOneAndUpdate(
            { label: tagLabel, userId: req.userId },
            { label: tagLabel, userId: req.userId },
            { upsert: true, new: true }
          );
        } catch (error) {
          // Tag might already exist, ignore duplicate key error
        }
      }
    }

    res.status(201).json(note);
  } catch (error) {
    console.error("Create note error:", error);
    res.status(500).json({ error: "Failed to create note" });
  }
});

// Update a note
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { title, markdown, tags, images } = req.body;

    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { title, markdown, tags, images },
      { new: true, runValidators: true }
    );

    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }

    // Update tags
    if (tags && tags.length > 0) {
      for (const tagLabel of tags) {
        try {
          await Tag.findOneAndUpdate(
            { label: tagLabel, userId: req.userId },
            { label: tagLabel, userId: req.userId },
            { upsert: true, new: true }
          );
        } catch (error) {
          // Tag might already exist, ignore duplicate key error
        }
      }
    }

    res.json(note);
  } catch (error) {
    console.error("Update note error:", error);
    res.status(500).json({ error: "Failed to update note" });
  }
});

// Delete a note
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const note = await Note.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }

    res.json({ message: "Note deleted successfully" });
  } catch (error) {
    console.error("Delete note error:", error);
    res.status(500).json({ error: "Failed to delete note" });
  }
});

export default router;
