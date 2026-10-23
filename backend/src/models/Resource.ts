import { Schema, model, type InferSchemaType } from 'mongoose';

const resourceSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['task', 'project', 'goal', 'habit', 'note', 'focus-session', 'notification', 'event'], required: true, index: true },
  data: { type: Schema.Types.Mixed, required: true, default: {} },
  archived: { type: Boolean, default: false }
}, { timestamps: true, minimize: false });
resourceSchema.index({ userId: 1, kind: 1, createdAt: -1 });
export type ResourceDocument = InferSchemaType<typeof resourceSchema>;
export const Resource = model('Resource', resourceSchema);
