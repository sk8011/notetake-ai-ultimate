import mongoose, { Document, Schema } from "mongoose";

export interface INoteShare extends Document {
  note: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  sharedWith: mongoose.Types.ObjectId;
  active: boolean; // Easy toggle for access
  createdAt: Date;
  updatedAt: Date;
}

const noteShareSchema = new Schema<INoteShare>(
  {
    note: {
      type: Schema.Types.ObjectId,
      ref: "Note",
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sharedWith: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure unique shares
noteShareSchema.index({ note: 1, sharedWith: 1 }, { unique: true });
// Index for fast lookups
noteShareSchema.index({ owner: 1 });
noteShareSchema.index({ sharedWith: 1, active: 1 });

export const NoteShare = mongoose.model<INoteShare>("NoteShare", noteShareSchema);
