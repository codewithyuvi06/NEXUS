import { Schema, model } from 'mongoose';

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  preferences: {
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    weekStartsOn: { type: Number, min: 0, max: 6, default: 1 },
    notificationsEnabled: { type: Boolean, default: true }
  }
}, { timestamps: true });
export const User = model('User', userSchema);
