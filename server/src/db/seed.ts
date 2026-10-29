import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

async function runSeed() {
  console.log('--- Initializing Rohan Core Lite Database ---');
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const seedPath = path.join(__dirname, 'seed.sql');

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    const seedSql = fs.readFileSync(seedPath, 'utf8');

    console.log('1. Executing schema.sql (creating tables, enums, indexes, constraints)...');
    await pool.query(schemaSql);
    console.log('   Schema created successfully!');

    console.log('2. Executing seed.sql (inserting 12 units and initial demo customers)...');
    await pool.query(seedSql);
    console.log('   Seed data populated successfully!');

    const unitsCount = await pool.query('SELECT COUNT(*) FROM units');
    console.log(`   Verification: ${unitsCount.rows[0].count} units ready in inventory.`);

    console.log('--- Database Setup Completed Successfully ---');
    process.exit(0);
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  }
}

runSeed();
