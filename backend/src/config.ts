import 'dotenv/config';

const secret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32)) {
  throw new Error('JWT_SECRET must be set to at least 32 characters in production.');
}
export const config = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/nexus',
  jwtSecret: secret ?? 'development-only-change-this-secret-before-deploying',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  clientOrigin: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(',').map(v => v.trim()),
  nodeEnv: process.env.NODE_ENV ?? 'development'
};
