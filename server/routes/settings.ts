import { Router, Response } from "express";
import { User } from "../models/User";
import { Note } from "../models/Note";
import { authenticate, AuthRequest } from "../middleware/auth";
import bcrypt from "bcryptjs";
import { v2 as cloudinary } from "cloudinary";

const router = Router();

// Get user preferences
router.get("/preferences", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).select("preferences");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ preferences: user.preferences || {} });
  } catch (error) {
    console.error("Get preferences error:", error);
    res.status(500).json({ error: "Failed to fetch preferences" });
  }
});

// Update user preferences
router.put("/preferences", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { theme, backgroundImage, backgroundType, defaultBackground } = req.body;

    const updateData: any = {};
    if (theme !== undefined) updateData["preferences.theme"] = theme;
    if (backgroundImage !== undefined) updateData["preferences.backgroundImage"] = backgroundImage;
    if (backgroundType !== undefined) updateData["preferences.backgroundType"] = backgroundType;
    if (defaultBackground !== undefined) updateData["preferences.defaultBackground"] = defaultBackground;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateData },
      { new: true }
    ).select("preferences");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ preferences: user.preferences });
  } catch (error) {
    console.error("Update preferences error:", error);
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

// Update user profile (name)
router.put("/profile", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "Name is required" });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { name: name.trim() },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Change password
router.put("/password", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// Get all user images
router.get("/images", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const notes = await Note.find({ userId: req.userId }).select("images title _id");
    
    // Flatten all images and include note info
    const allImages: { url: string; public_id: string; noteId: string; noteTitle: string }[] = [];
    
    for (const note of notes) {
      if (note.images && note.images.length > 0) {
        for (const image of note.images) {
          allImages.push({
            url: image.url,
            public_id: image.public_id,
            noteId: note._id.toString(),
            noteTitle: note.title,
          });
        }
      }
    }

    res.json({ images: allImages });
  } catch (error) {
    console.error("Get images error:", error);
    res.status(500).json({ error: "Failed to fetch images" });
  }
});

// Delete a specific image
router.delete("/images/:publicId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const publicId = decodeURIComponent(req.params.publicId);
    
    // Find the note containing this image
    const note = await Note.findOne({
      userId: req.userId,
      "images.public_id": publicId,
    });

    if (!note) {
      return res.status(404).json({ error: "Image not found" });
    }

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (cloudinaryError) {
      console.error("Cloudinary delete error:", cloudinaryError);
      // Continue anyway - image may already be deleted from Cloudinary
    }

    // Remove image reference from note
    note.images = note.images.filter(img => img.public_id !== publicId);
    
    // Also remove from markdown if it contains the image URL
    const imageToRemove = note.images.find(img => img.public_id === publicId);
    if (imageToRemove) {
      // Remove markdown image references
      note.markdown = note.markdown.replace(new RegExp(`!\\[.*?\\]\\(${imageToRemove.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g'), '');
    }
    
    await note.save();

    res.json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("Delete image error:", error);
    res.status(500).json({ error: "Failed to delete image" });
  }
});

// Delete account
router.delete("/account", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password is required to delete account" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify password
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: "Password is incorrect" });
    }

    // Get all user's notes to find images
    const notes = await Note.find({ userId: req.userId }).select("images");
    
    // Collect all image public_ids
    const imagePublicIds: string[] = [];
    for (const note of notes) {
      if (note.images && note.images.length > 0) {
        for (const image of note.images) {
          if (image.public_id) {
            imagePublicIds.push(image.public_id);
          }
        }
      }
    }

    // Delete all images from Cloudinary
    if (imagePublicIds.length > 0) {
      try {
        // Cloudinary allows batch delete
        await cloudinary.api.delete_resources(imagePublicIds);
      } catch (cloudinaryError) {
        console.error("Cloudinary batch delete error:", cloudinaryError);
        // Continue with account deletion anyway
      }
    }

    // Also delete custom background if user has one
    if (user.preferences?.backgroundImage && user.preferences?.backgroundType === "custom") {
      // Extract public_id from Cloudinary URL if possible
      const bgUrl = user.preferences.backgroundImage;
      if (bgUrl.includes("cloudinary")) {
        try {
          // Extract public_id from URL (format: .../upload/v123/folder/public_id.ext)
          const match = bgUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
          if (match && match[1]) {
            await cloudinary.uploader.destroy(match[1]);
          }
        } catch (err) {
          console.error("Failed to delete background image:", err);
        }
      }
    }

    // Delete user's notes and tags
    await Note.deleteMany({ userId: req.userId });
    const Tag = require("mongoose").model("Tag");
    await Tag.deleteMany({ user: req.userId });

    // Delete user
    await User.findByIdAndDelete(req.userId);

    res.clearCookie("token");
    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
