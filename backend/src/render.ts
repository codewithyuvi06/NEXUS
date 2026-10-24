
import app from './server.js';
import { connectDB } from './db.js';

const port = Number(process.env.PORT) || 10000;

async function startServer() {
  try {
    await connectDB();

    app.listen(port, '0.0.0.0', () => {
      console.log(`NEXUS API listening on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start NEXUS API:', error);
    process.exit(1);
  }
}

startServer();
