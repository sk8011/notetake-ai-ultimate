import mongoose, { Document, Schema } from "mongoose";

export type FriendshipStatus = "pending" | "accepted" | "declined" | "blocked";

export interface IFriendship extends Document {
  requester: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId;
  status: FriendshipStatus;
  createdAt: Date;
  updatedAt: Date;
}

const friendshipSchema = new Schema<IFriendship>(
  {
    requester: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "blocked"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure unique friendships
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });
// Index for fast lookups
friendshipSchema.index({ recipient: 1, status: 1 });
friendshipSchema.index({ requester: 1, status: 1 });

export const Friendship = mongoose.model<IFriendship>("Friendship", friendshipSchema);
