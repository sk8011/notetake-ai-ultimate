import mongoose, { Document, Schema } from "mongoose";

export type ConversationType = "personal" | "group";

export interface IConversation extends Document {
  type: ConversationType;
  participants: mongoose.Types.ObjectId[];
  name: string | null; // For groups only
  admin: mongoose.Types.ObjectId | null; // For groups only
  lastMessage: {
    content: string;
    sender: mongoose.Types.ObjectId;
    createdAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

// Max group size for small-scale app (20 members is practical for 512MB storage)
export const MAX_GROUP_SIZE = 20;

const conversationSchema = new Schema<IConversation>(
  {
    type: {
      type: String,
      enum: ["personal", "group"],
      required: true,
    },
    participants: [{
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }],
    name: {
      type: String,
      trim: true,
      default: null,
      maxlength: 50,
    },
    admin: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastMessage: {
      content: String,
      sender: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      createdAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast lookups
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

export const Conversation = mongoose.model<IConversation>("Conversation", conversationSchema);
