import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from server or root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const connectionString = process.env.DATABASE_URL;

const poolConfig: PoolConfig = connectionString
  ? {
      connectionString,
      ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false }, // Necessary for Supabase & cloud PostgreSQL
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      user: process.env.PGUSER || 'postgres',
      host: process.env.PGHOST || 'localhost',
      database: process.env.PGDATABASE || 'rohan_core',
      password: process.env.PGPASSWORD || 'postgres',
      port: Number(process.env.PGPORT) || 5432,
    };

export const pool = new Pool(poolConfig);

// Helper for single query execution
export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

// Helper for managing database transactions
export const getClient = async () => {
  const client = await pool.connect();
  return client;
};

// Test connection
pool.on('connect', () => {
  // Connected successfully
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});
