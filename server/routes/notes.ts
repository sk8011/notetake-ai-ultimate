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

// Export all notes as ZIP of PDFs (must be before /:id route)
router.get("/export-all", async (req: AuthRequest, res: Response) => {
  try {
    const archiver = require("archiver");
    const PDFDocument = require("pdfkit");
    
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

    // Helper function to render markdown to PDF
    const renderMarkdownToPdf = (doc: any, markdown: string) => {
      const lines = markdown.split("\n");
      
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Skip empty lines but add spacing
        if (line.trim() === "") {
          doc.moveDown(0.5);
          continue;
        }

        // Headers
        if (line.startsWith("### ")) {
          doc.fontSize(14).font("Helvetica-Bold").fillColor("#333333")
            .text(line.substring(4), { align: "left" });
          doc.moveDown(0.3);
          continue;
        }
        if (line.startsWith("## ")) {
          doc.fontSize(16).font("Helvetica-Bold").fillColor("#222222")
            .text(line.substring(3), { align: "left" });
          doc.moveDown(0.3);
          continue;
        }
        if (line.startsWith("# ")) {
          doc.fontSize(18).font("Helvetica-Bold").fillColor("#111111")
            .text(line.substring(2), { align: "left" });
          doc.moveDown(0.3);
          continue;
        }

        // Numbered lists (1. 2. 3. etc)
        const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);
        if (numberedMatch) {
          doc.fontSize(12).font("Helvetica").fillColor("#000000")
            .text(`${numberedMatch[1]}. ${numberedMatch[2]}`, { 
              align: "left", 
              indent: 20,
              lineGap: 2
            });
          continue;
        }

        // Bullet points (- or *)
        if (line.match(/^[\-\*]\s+/)) {
          const bulletContent = line.replace(/^[\-\*]\s+/, "");
          doc.fontSize(12).font("Helvetica").fillColor("#000000")
            .text(`•  ${bulletContent}`, { 
              align: "left", 
              indent: 20,
              lineGap: 2
            });
          continue;
        }

        // Code blocks (``` or indented)
        if (line.startsWith("```")) {
          // Skip the opening ```
          i++;
          let codeContent = [];
          while (i < lines.length && !lines[i].startsWith("```")) {
            codeContent.push(lines[i]);
            i++;
          }
          if (codeContent.length > 0) {
            doc.fontSize(10).font("Courier").fillColor("#6366f1")
              .text(codeContent.join("\n"), { 
                align: "left",
                indent: 10,
                lineGap: 2
              });
            doc.moveDown(0.5);
          }
          continue;
        }

        // Inline code - simple rendering
        if (line.includes("`")) {
          line = line.replace(/`([^`]+)`/g, "[$1]");
        }

        // Bold and italic - strip markers for plain text
        line = line.replace(/\*\*\*([^*]+)\*\*\*/g, "$1"); // bold italic
        line = line.replace(/\*\*([^*]+)\*\*/g, "$1"); // bold
        line = line.replace(/\*([^*]+)\*/g, "$1"); // italic
        line = line.replace(/__([^_]+)__/g, "$1"); // bold
        line = line.replace(/_([^_]+)_/g, "$1"); // italic

        // Regular paragraph
        doc.fontSize(12).font("Helvetica").fillColor("#000000")
          .text(line, { align: "left", lineGap: 2 });
      }
    };

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

      // Create PDF for this note
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      
      // Title
      doc.fontSize(20).font("Helvetica-Bold").text(note.title, { align: "center" });
      doc.moveDown();
      
      // Date
      doc.fontSize(10).font("Helvetica").fillColor("#666666")
        .text(`Created: ${new Date(note.createdAt).toLocaleDateString()}`, { align: "center" });
      doc.moveDown(2);
      
      // Content - render markdown properly
      renderMarkdownToPdf(doc, note.markdown);

      // Tags at the bottom
      if (note.tags && note.tags.length > 0) {
        doc.moveDown(2);
        doc.fontSize(10).fillColor("#6366f1")
          .text(`Tags: ${note.tags.join(", ")}`, { align: "left" });
      }

      doc.end();

      await new Promise<void>((resolve) => {
        doc.on("end", () => {
          const pdfBuffer = Buffer.concat(chunks);
          archive.append(pdfBuffer, { name: `${sanitizedTitle}.pdf` });
          resolve();
        });
      });
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
