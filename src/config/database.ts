import { Client, auth } from 'cassandra-driver';
import dotenv from 'dotenv';

dotenv.config();

export interface DatabaseConfig {
  hosts: string[];
  keyspace: string;
  username?: string | undefined;
  password?: string | undefined;
  datacenter: string;
}

let hosts: string[] = ['43.204.81.81'];
try {
  if (process.env.SCYLLA_HOSTS) {
    hosts = JSON.parse(process.env.SCYLLA_HOSTS);
  }
} catch {
  // fallback to split if not JSON
  hosts = process.env.SCYLLA_HOSTS?.replace(/[\[\]"]+/g, '').split(',') || ['43.204.81.81'];
}

export const databaseConfig: DatabaseConfig = {
  hosts,
  keyspace: process.env.SCYLLA_KEYSPACE?.replace(/"/g, '') || 'youtube_comments_cluster',
  username: process.env.SCYLLA_USERNAME?.replace(/"/g, ''),
  password: process.env.SCYLLA_PASSWORD?.replace(/"/g, ''),
  datacenter: process.env.SCYLLA_DATACENTER?.replace(/"/g, '') || 'datacenter1'
};

let client: Client | null = null;

export async function connectToDatabase(): Promise<Client> {
  if (client) {
    return client;
  }

  const clientOptions: any = {
    contactPoints: databaseConfig.hosts,
    localDataCenter: databaseConfig.datacenter,
    keyspace: databaseConfig.keyspace,
  };

  if (databaseConfig.username && databaseConfig.password) {
    clientOptions.authProvider = new auth.PlainTextAuthProvider(
      databaseConfig.username,
      databaseConfig.password
    );
  }

  client = new Client(clientOptions);

  try {
    await client.connect();
    console.log('Database connection established successfully');

    // Create keyspace if it doesn't exist
    await createKeyspace();

    // Create tables and indexing tables
    await createTables();

    return client;
  } catch (error) {
    console.error('Failed to connect to Scylla DB:', error);
    throw error;
  }
}

async function createKeyspace(): Promise<void> {
  if (!client) throw new Error('Database client not initialized');

  const createKeyspaceQuery = `
    CREATE KEYSPACE IF NOT EXISTS ${databaseConfig.keyspace}
    WITH replication = {
      'class': 'SimpleStrategy',
      'replication_factor': 3
    }
  `;

  await client.execute(createKeyspaceQuery);
  console.log(`Keyspace ${databaseConfig.keyspace} ensured`);
}

async function createTables(): Promise<void> {
  if (!client) throw new Error('Database client not initialized');

  // Original Comments table
  const createCommentsTable = `
    CREATE TABLE IF NOT EXISTS ${databaseConfig.keyspace}.comments (
      id UUID PRIMARY KEY,
      video_id TEXT,
      user_id TEXT,
      content TEXT,
      likes BIGINT,
      dislikes BIGINT,
      created_at TIMESTAMP,
      reply_count BIGINT
    )
  `;

  // Original Replies table
  const createRepliesTable = `
    CREATE TABLE IF NOT EXISTS ${databaseConfig.keyspace}.replies (
      id UUID PRIMARY KEY,
      comment_id UUID,
      user_id TEXT,
      content TEXT,
      likes BIGINT,
      dislikes BIGINT,
      created_at TIMESTAMP
    )
  `;

  // Manual indexing table for comments by video and time
  const createCommentsByVideoTimeTable = `
    CREATE TABLE IF NOT EXISTS ${databaseConfig.keyspace}.comments_by_video_time (
      video_id TEXT,
      created_at TIMESTAMP,
      id UUID,
      user_id TEXT,
      content TEXT,
      likes BIGINT,
      dislikes BIGINT,
      reply_count BIGINT,
      PRIMARY KEY (video_id, created_at, id)
    ) WITH CLUSTERING ORDER BY (created_at DESC, id DESC)
  `;

  // Manual indexing table for replies by comment and time
  const createRepliesByCommentTimeTable = `
    CREATE TABLE IF NOT EXISTS ${databaseConfig.keyspace}.replies_by_comment_time (
      comment_id UUID,
      created_at TIMESTAMP,
      id UUID,
      user_id TEXT,
      content TEXT,
      likes BIGINT,
      dislikes BIGINT,
      PRIMARY KEY (comment_id, created_at, id)
    ) WITH CLUSTERING ORDER BY (created_at DESC, id DESC)
  `;

  // Indexes for the original tables
  const createCommentsVideoIdIndex = `
    CREATE INDEX IF NOT EXISTS ON ${databaseConfig.keyspace}.comments (video_id)
  `;
  const createCommentsCreatedAtIndex = `
    CREATE INDEX IF NOT EXISTS ON ${databaseConfig.keyspace}.comments (created_at)
  `;
  const createRepliesCommentIdIndex = `
    CREATE INDEX IF NOT EXISTS ON ${databaseConfig.keyspace}.replies (comment_id)
  `;
  const createRepliesCreatedAtIndex = `
    CREATE INDEX IF NOT EXISTS ON ${databaseConfig.keyspace}.replies (created_at)
  `;

  try {
    // Create original tables first
    await client.execute(createCommentsTable);
    await client.execute(createRepliesTable);
    console.log('Original tables created successfully');

    // Create indexing tables
    await client.execute(createCommentsByVideoTimeTable);
    await client.execute(createRepliesByCommentTimeTable);
    console.log('Indexing tables created successfully');

    // Create indexes
    await client.execute(createCommentsVideoIdIndex);
    await client.execute(createCommentsCreatedAtIndex);
    await client.execute(createRepliesCommentIdIndex);
    await client.execute(createRepliesCreatedAtIndex);
    console.log('Indexes created successfully');

    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error creating database schema:', error);
    throw error;
  }
}

export async function disconnectFromDatabase(): Promise<void> {
  if (client) {
    await client.shutdown();
    client = null;
    console.log('Database connection closed');
  }
}

export function getDatabaseClient(): Client {
  if (!client) {
    throw new Error('Database client not connected. Call connectToDatabase() first.');
  }
  return client;
}

export default {
  connect: connectToDatabase,
  disconnect: disconnectFromDatabase,
  getClient: getDatabaseClient
};