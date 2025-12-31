import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUserPreferences {
  theme: "light" | "dark";
  backgroundImage: string | null; // URL to user's custom background
  backgroundType: "none" | "default" | "custom"; // Type of background
  defaultBackground: string | null; // Key for default backgrounds
}

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  createdAt: Date;
  preferences: IUserPreferences;
  isOnline: boolean;
  lastSeen: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  preferences: {
    theme: {
      type: String,
      enum: ["light", "dark"],
      default: "dark",
    },
    backgroundImage: {
      type: String,
      default: null,
    },
    backgroundType: {
      type: String,
      enum: ["none", "default", "custom"],
      default: "none",
    },
    defaultBackground: {
      type: String,
      default: null,
    },
  },
  isOnline: {
    type: Boolean,
    default: false,
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>("User", userSchema);
