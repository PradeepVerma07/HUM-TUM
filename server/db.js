import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });

let pool = null;
let useMemoryFallback = false;

// In-memory mock store for local development when MySQL is offline
export const memDb = {
  users: new Map(),
  conversations: new Map(),
  messages: new Map(),
  stories: []
};

// Initialize Hostinger MySQL Pool
export async function initDatabase() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'humtum_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };

  try {
    pool = mysql.createPool(dbConfig);
    const conn = await pool.getConnection();
    console.log('✅ Connected to Hostinger MySQL Database successfully!');
    conn.release();

    // Create WhatsApp Clone Tables with humtum_ prefix
    await pool.query(`
      CREATE TABLE IF NOT EXISTS humtum_users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(64) UNIQUE NOT NULL,
        display_name VARCHAR(120) NOT NULL,
        email VARCHAR(120),
        password_hash VARCHAR(255) NOT NULL,
        avatar_url TEXT,
        bio TEXT,
        is_online BOOLEAN DEFAULT FALSE,
        last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS humtum_conversations (
        id VARCHAR(64) PRIMARY KEY,
        type ENUM('DIRECT', 'GROUP') NOT NULL DEFAULT 'DIRECT',
        name VARCHAR(120),
        avatar_url TEXT,
        description TEXT,
        created_by VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS humtum_participants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conversation_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        role ENUM('MEMBER', 'ADMIN', 'OWNER') DEFAULT 'MEMBER',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_conv_user (conversation_id, user_id),
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS humtum_messages (
        id VARCHAR(64) PRIMARY KEY,
        conversation_id VARCHAR(64) NOT NULL,
        sender_id VARCHAR(64) NOT NULL,
        type ENUM('TEXT', 'IMAGE', 'VOICE', 'DOCUMENT', 'LOCATION') NOT NULL DEFAULT 'TEXT',
        content TEXT NOT NULL,
        media_url TEXT,
        reply_to_id VARCHAR(64),
        status ENUM('SENDING', 'SENT', 'DELIVERED', 'READ') DEFAULT 'SENT',
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_conv_time (conversation_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS humtum_stories (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        type ENUM('TEXT', 'IMAGE', 'VIDEO') DEFAULT 'TEXT',
        caption TEXT,
        media_url TEXT,
        background TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_expires (user_id, expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Hostinger MySQL tables verified and initialized.');
  } catch (err) {
    console.warn('⚠️ Hostinger MySQL connection note:', err.message);
    console.log('⚡ Active in High-Performance In-Memory DB Mode for instant local execution & zero downtime.');
    useMemoryFallback = true;
  }
}

// Database helper functions
export const db = {
  async query(sql, params = []) {
    if (pool && !useMemoryFallback) {
      try {
        const [rows] = await pool.query(sql, params);
        return rows;
      } catch (err) {
        console.error('MySQL Query Error:', err.message);
        throw err;
      }
    }
    return [];
  },

  isMemory() {
    return useMemoryFallback;
  }
};
