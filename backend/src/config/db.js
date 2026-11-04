const mongoose = require('mongoose');

let mongoServer = null;

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/puttum_kadalayum';

  try {
    // Attempt connecting to the configured URI first
    console.log(`[DB] Attempting connection to MongoDB at: ${mongoUri}`);
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 2500, // Quick timeout to fallback to in-memory if no daemon is running
    });
    console.log(`[DB] Connected to external MongoDB: ${conn.connection.host}`);
  } catch (err) {
    console.warn(`[DB] Could not connect to local MongoDB instance: ${err.message}`);
    if (process.env.NODE_ENV === 'production') {
      // Never silently swap a production database for a throwaway seeded one.
      console.error('[DB] Refusing in-memory fallback in production.');
      process.exit(1);
    }
    console.log('[DB] Launching fallback in-memory MongoDB server for testing...');

    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongoServer = await MongoMemoryServer.create();
      const memUri = mongoServer.getUri();

      const conn = await mongoose.connect(memUri);
      console.log(`[DB] Connected to in-memory MongoDB: ${conn.connection.name}`);

      // Auto-seed data into in-memory instance
      const { seedData } = require('../seed');
      console.log('[DB] Seeding in-memory database with Kerala dishes, menus and demo users...');
      await seedData(false);
      console.log('[DB] Database ready with demo data!');
    } catch (memErr) {
      console.error('[DB] Failed to start in-memory MongoDB:', memErr.message);
      process.exit(1);
    }
  }

  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    if (mongoServer) {
      await mongoServer.stop();
    }
    console.log('[DB] MongoDB connection closed.');
    process.exit(0);
  });
};

module.exports = connectDB;
