CREATE KEYSPACE IF NOT EXISTS comments_db_cluster
WITH replication = {
  'class': 'SimpleStrategy',
  'replication_factor': 3
};

USE comments_db_cluster;

-- Original Comments table (unchanged)
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY,
  video_id TEXT,
  user_id TEXT,
  content TEXT,
  likes BIGINT,
  dislikes BIGINT,
  created_at TIMESTAMP,
  reply_count BIGINT
);

-- Original Replies table (unchanged)
CREATE TABLE IF NOT EXISTS replies (
  id UUID PRIMARY KEY,
  comment_id UUID,
  user_id TEXT,
  content TEXT,
  likes BIGINT,
  dislikes BIGINT,
  created_at TIMESTAMP
);

-- Manual indexing table for comments by video and time
CREATE TABLE IF NOT EXISTS comments_by_video_time (
  video_id TEXT,
  created_at TIMESTAMP,
  id UUID,
  user_id TEXT,
  content TEXT,
  likes BIGINT,
  dislikes BIGINT,
  reply_count BIGINT,
  PRIMARY KEY (video_id, created_at, id)
) WITH CLUSTERING ORDER BY (created_at DESC, id DESC);

-- Manual indexing table for replies by comment and time
CREATE TABLE IF NOT EXISTS replies_by_comment_time (
  comment_id UUID,
  created_at TIMESTAMP,
  id UUID,
  user_id TEXT,
  content TEXT,
  likes BIGINT,
  dislikes BIGINT,
  PRIMARY KEY (comment_id, created_at, id)
) WITH CLUSTERING ORDER BY (created_at DESC, id DESC);

-- Secondary indexes for the original tables (if needed for other queries)
CREATE INDEX IF NOT EXISTS comments_video_id_idx ON comments (video_id);
CREATE INDEX IF NOT EXISTS comments_created_at_idx ON comments (created_at);
CREATE INDEX IF NOT EXISTS replies_comment_id_idx ON replies (comment_id);
CREATE INDEX IF NOT EXISTS replies_created_at_idx ON replies (created_at);