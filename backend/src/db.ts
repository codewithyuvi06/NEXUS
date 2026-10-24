
import mongoose from 'mongoose';
import { config } from './config.js';

let connectionPromise: Promise<typeof mongoose> | null = null;

export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(config.mongoUri).catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }

  return connectionPromise;
}
