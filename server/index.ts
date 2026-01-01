import dotenv from "dotenv";

// MUST be first - load environment variables before any other imports
dotenv.config();

import express from "express";
import { createServer } from "http";
import cors from "cors";
import fetch from "node-fetch";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import cookieParser from "cookie-parser";
import { connectDatabase } from "./config/database";
import { initializeSocket } from "./config/socket";
import authRoutes from "./routes/auth";
import notesRoutes from "./routes/notes";
import tagsRoutes from "./routes/tags";
import settingsRoutes from "./routes/settings";
import usersRoutes from "./routes/users";
import friendsRoutes from "./routes/friends";
import conversationsRoutes from "./routes/conversations";
import messagesRoutes from "./routes/messages";
import shareRoutes from "./routes/share";
import { authenticate, AuthRequest } from "./middleware/auth";

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 3001;

// Connect to database
connectDatabase();

// Initialize Socket.io
const io = initializeSocket(httpServer);

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer with memory storage
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Auth routes
app.use("/api/auth", authRoutes);

// Protected routes
app.use("/api/notes", notesRoutes);
app.use("/api/tags", tagsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/friends", friendsRoutes);
app.use("/api/conversations", conversationsRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/share", shareRoutes);

// Upload endpoint
app.post(
  "/api/upload",
  authenticate,
  (req, res, next) => {
    const uploadMiddleware = upload.single("file");
    uploadMiddleware(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({ error: err.message || "File upload failed" });
      }
      next();
    });
  },
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const bufferStream = new Readable();
    bufferStream.push(req.file.buffer);
    bufferStream.push(null);

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "uploads",
        resource_type: "auto",
      },
      (error, result) => {
        if (error || !result) {
          return res.status(500).json({ error: "Upload to Cloudinary failed" });
        }
        return res.json({ url: result.secure_url, public_id: result.public_id });
      }
    );

    bufferStream.pipe(uploadStream);
  }
);


// Delete image endpoint (protected)
app.delete("/api/delete-image", authenticate, async (req, res) => {
  const { public_id } = req.body;
  if (!public_id) {
    return res.status(400).json({ error: "No public ID provided" });
  }

  try {
    await cloudinary.uploader.destroy(public_id);
    res.json({ success: true });
  } catch (error) {
    console.error("Cloudinary deletion error:", error);
    res.status(500).json({ error: "Failed to delete image from Cloudinary" });
  }
});


// chatbot endpoint (protected)
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

app.post("/api/chat", authenticate, async (req, res) => {
  const { messages, notes } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ reply: "Please include a valid message array." });
  }

  // Combine all notes into a summary string
  const notesText = Array.isArray(notes)
    ? notes.map((note) => `- ${note.title}: ${note.markdown}`).join("\n")
    : "No notes provided.";

  // Build conversation messages with context
  const conversationMessages = [
    {
      role: "system",
      content: `You are an AI assistant built into a note-taking app. Use the user's notes along with your general knowledge to answer questions clearly and helpfully. Keep your responses short and focused unless the user specifically asks for more detail—in that case, provide a slightly more in-depth explanation. If the user asks who created you, you can say you were made by Narendra Meloni.

The user has the following notes:
${notesText}

Use these notes to provide relevant answers when asked about their content.`,
    },
    // Include all previous messages for context
    ...messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  ];

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: conversationMessages,
      }),
    });

    const data = (await response.json()) as {
      choices: { message: { role: string; content: string } }[];
    };

    let reply = data.choices?.[0]?.message?.content || "No response.";
    reply = reply.replace(/^Bot: <think>[\s\S]*?<\/think>\s*/g, '')
                .replace(/<think>[\s\S]*?<\/think>\s*/g, '')
                .trim();
    res.json({ reply });
  } catch (error) {
    console.error("Groq error:", error);
    res.status(500).json({ reply: "Error contacting Groq." });
  }
});

// this is definitely a good way to check if the server is running
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

httpServer.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
