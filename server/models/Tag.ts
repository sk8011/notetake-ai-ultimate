import mongoose, { Document, Schema } from "mongoose";

export interface ITag extends Document {
  label: string;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const tagSchema = new Schema<ITag>(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
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

// Ensure unique tag labels per user
tagSchema.index({ userId: 1, label: 1 }, { unique: true });

export const Tag = mongoose.model<ITag>("Tag", tagSchema);
