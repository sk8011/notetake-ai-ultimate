import mongoose, { Document, Schema } from "mongoose";

export interface INote extends Document {
  title: string;
  markdown: string;
  tags: string[];
  images: { url: string; public_id: string }[];
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const noteSchema = new Schema<INote>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    markdown: {
      type: String,
      required: true,
    },
    tags: [{
      type: String,
      trim: true,
    }],
    images: [{
      url: String,
      public_id: String,
    }],
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
noteSchema.index({ userId: 1, createdAt: -1 });
noteSchema.index({ userId: 1, tags: 1 });

export const Note = mongoose.model<INote>("Note", noteSchema);
