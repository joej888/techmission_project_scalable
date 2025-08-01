# YouTube Comments API

A simple REST API for managing YouTube video comments with a smart ranking system and cursor-based pagination. Built with Node.js, Express, TypeScript, and ScyllaDB.

## What it does

This API lets you store and retrieve YouTube comments with features like:
- Add comments and replies
- Like/dislike comments
- Smart comment ranking (popular comments appear first)
- Get comments in different formats (top comments, nested with replies)
- Efficient cursor-based pagination for large datasets

## Tech Stack

- **Backend**: Node.js with Express
- **Database**: ScyllaDB (Cassandra-compatible)
- **Language**: TypeScript
- **Key Libraries**: cassandra-driver, cors, uuid

## Getting Started

### Prerequisites

- Node.js(Latest used)
- ScyllaDB or Cassandra database
- npm or yarn

### Installation

1. **Clone the project**
   ```bash
   git clone https://github.com/joej888/tecmission_project.git
   cd techmission_project
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   PORT=4000
   SCYLLA_HOSTS=["127.0.0.1:9042"]
   SCYLLA_KEYSPACE=youtube_comments
   SCYLLA_USERNAME=your_username
   SCYLLA_PASSWORD=your_password
   SCYLLA_DATACENTER=datacenter1
   ```

4. **Run the project**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm run build
   npm start
   ```

## API Endpoints

### Get Comments with Pagination
```http
GET /api/comments/:videoId
```

The API supports efficient cursor-based pagination for handling large comment datasets. Comments are fetched in chronological order (newest first) with optional ranking applied per page.

**Pagination Parameters:**
- `limit` - Number of comments per page (default: 20, max: 2147483647)
- `cursor` - Base64 encoded cursor for next page (get from previous response)
- `replies_limit` - Number of replies per comment in nested mode (default: 5)
- `sort` - To sort based on rank or chronological.(ranked/chronological)

**Comment Types:**
- **`type=top`** - Get top-level comments only
  ```http
  GET /api/comments/video123?type=top&limit=10
  ```

- **`type=nested`** - Get comments with their replies nested
  ```http
  GET /api/comments/video123?type=nested&limit=5&replies_limit=3
  ```

- **`no type`** - Get ranked comments
  ```http
  GET /api/comments/video123?limit=20
  ```

- **Default (only videoId)** - Get ranked comments 
  ```http
  GET /api/comments/video123
  ```

- **`sort = ranked`** - Get sorted on rank.
  GET /api/comments/:videoId?sort=ranked     # Default behavior, sorts by score


- **`sort = chronological`** - Get sorted chronological.
  GET /api/comments/:videoId?sort=chronological  # Returns in DB order (created_at DESC)


**Pagination Example:**
```bash
# First page
GET /api/comments/video123?type=top&limit=2

# Response includes cursor for next page
{
  "success": true,
  "data": [...],
  "pagination": {
    "next_cursor": "eyJjcmVhdGVkQXQiOiIyMDI1LTA3LTMxVDAzOjU2OjI1Ljc1MFoiLCJpZCI6IjYyODgyMGIyLThhZDUtNDlmYi1iNDUyLWMyNmNjNDE1YzNhMSJ9",
    "has_more": true,
    "total_estimated": 150
  }
}

# Next page using cursor
GET /api/comments/video123?type=top&limit=2&cursor=eyJjcmVhdGVkQXQiOiIyMDI1LTA3LTMxVDAzOjU2OjI1Ljc1MFoiLCJpZCI6IjYyODgyMGIyLThhZDUtNDlmYi1iNDUyLWMyNmNjNDE1YzNhMSJ9
```

### Get Replies with Pagination
```http
GET /api/comments/:commentId/replies
```
Get replies for a specific comment with cursor pagination:
```bash
GET /api/comments/comment-id/replies?limit=10&cursor=xyz
```

### Create Comment
```http
POST /api/comments
```
**Body:**
```json
{
  "videoId": "video123",
  "userId": "user456",
  "content": "Great video!"
}
```

### Create Reply
```http
POST /api/comments/:commentId/replies
```
**Body:**
```json
{
  "userId": "user456",
  "content": "I agree!"
}
```

### Like/Dislike Actions
```http
PUT /api/comments/:id/like/increase
PUT /api/comments/:id/like/decrease
PUT /api/comments/:id/dislike/increase
PUT /api/comments/:id/dislike/decrease

# For replies
PUT /api/comments/replies/:id/like/increase
PUT /api/comments/replies/:id/like/decrease
PUT /api/comments/replies/:id/dislike/increase
PUT /api/comments/replies/:id/dislike/decrease
```

### Delete Operations
```http
DELETE /api/comments/:id           # Delete comment
DELETE /api/comments/replies/:id   # Delete reply
```

## Pagination Logic

The API uses **cursor-based pagination** for efficient traversal of large datasets:

**How it works:**
1. **Chronological Order**: Comments are fetched from database in `created_at DESC` order (newest first)
2. **Cursor Generation**: Each page includes a cursor pointing to the last item's timestamp and ID
3. **Next Page**: Use the cursor to fetch the next batch of chronologically older comments
4. **Consistent Results**: No duplicate or skipped items even when new comments are added
5. **Performance**: Efficient for large datasets unlike offset-based pagination

**Benefits over offset pagination:**
- ✅ No performance degradation with large offsets
- ✅ No duplicate results when data changes
- ✅ Consistent pagination even with real-time updates
- ✅ Database-optimized queries using clustering keys

**Ranking vs Pagination:**
- Comments are fetched in chronological database order for consistent pagination
- Ranking metadata (score, timeAgo, netScore) is calculated and included but doesn't affect pagination order
- This ensures reliable pagination while preserving ranking information for display

## How the Ranking Works

Comments are ranked using a simple scoring system:

**Score = max(0, likes - dislikes) + recency bonus + reply bonus**

- **Recency bonus**: Newer comments get higher scores
  - 0-1 hour: +10 points
  - 1-6 hours: +8 points
  - 6-24 hours: +6 points
  - 1-7 days: +4 points
  - 1-4 weeks: +2 points
  - 4+ weeks: 0 points

- **Reply bonus**: Comments with more replies get slight boost (max +5 points)

- **Negative comments**: Comments with more dislikes than likes don't benefit from recency/reply bonuses

## Database Schema

The API uses optimized tables for both storage and pagination:

```sql
-- Original tables for data integrity
CREATE TABLE comments (
  id UUID PRIMARY KEY,
  video_id TEXT,
  user_id TEXT,
  content TEXT,
  likes BIGINT,
  dislikes BIGINT,
  created_at TIMESTAMP,
  reply_count BIGINT
);

CREATE TABLE replies (
  id UUID PRIMARY KEY,
  comment_id UUID,
  user_id TEXT,
  content TEXT,
  likes BIGINT,
  dislikes BIGINT,
  created_at TIMESTAMP
);

-- Indexing tables for efficient pagination
CREATE TABLE comments_by_video_time (
  video_id TEXT,
  created_at TIMESTAMP,
  id UUID,
  -- ... other fields
  PRIMARY KEY (video_id, created_at, id)
) WITH CLUSTERING ORDER BY (created_at DESC, id DESC);

CREATE TABLE replies_by_comment_time (
  comment_id UUID,
  created_at TIMESTAMP,
  id UUID,
  -- ... other fields
  PRIMARY KEY (comment_id, created_at, id)
) WITH CLUSTERING ORDER BY (created_at DESC, id DESC);
```

## Project Structure

```
src/
├── config/
│   └── database.ts          # Database connection setup
├── controllers/
│   └── commentsController.ts # API route handlers
├── models/
│   └── comments.ts          # TypeScript interfaces
├── routes/
│   └── commentRoutes.ts     # API routes definition
├── services/
│   └── commentsService.ts   # Database operations
├── utils/
│   └── ranking.ts           # Comment ranking logic
└── app.ts                   # Express app setup
```

## Example Usage

1. **Add a comment:**
   ```bash
   curl -X POST http://localhost:4000/api/comments \
     -H "Content-Type: application/json" \
     -d '{"videoId": "abc123", "userId": "user1", "content": "Nice video!"}'
   ```

2. **Get top comments with pagination:**
   ```bash
   curl "http://localhost:4000/api/comments/abc123?type=top&limit=5"
   ```
  ```bash
   curl "http://localhost:4000/api/comments/video_123?type=top&sort=ranked"
  ```
  ```bash
   curl "http://localhost:4000/api/comments/video_123?type=top&sort=chronological"
  ```
  ```bash
   curl "http://localhost:4000/api/comments/video_123?type=top&sort=chronological&limit=2&cursor=eyJjcmVhdGVkQXQiOiIyMDI1LTA3LTMxVDAzOjU5OjM0LjYxN1oiLCJpZCI6IjEyYzUxYThkLWZlMTMtNDM4Zi1iYmNiLWUyNWE2NGUxNWFkYSJ9"
   ```
  
3. **Get nested comments with replies:**
   ```bash
   curl "http://localhost:4000/api/comments/abc123?type=nested&limit=3&replies_limit=2"
   ```

4. **Get next page using cursor:**
   ```bash
   curl "http://localhost:4000/api/comments/abc123?type=top&limit=5&cursor=eyJjcmVhdGVkQXQi..."
   ```

5. **Like a comment:**
   ```bash
   curl -X PUT http://localhost:4000/api/comments/comment-id/like/increase
   ```

## Development

- `npm run dev` - Start development server with auto-reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production server

## Notes

- The database schema is automatically created when you first run the app
- All timestamps are stored in UTC
- UUIDs are used for comment IDs
- Cursor-based pagination provides consistent performance for large datasets
- Comments are stored in dual tables (original + indexing) for optimal query performance

## Common Issues

1. **Database connection fails**: Check your ScyllaDB is running and credentials are correct
2. **Port already in use**: Change PORT in .env file
3. **Build errors**: Make sure TypeScript is properly installed
4. **Invalid cursor error**: Cursors are base64 encoded and expire when data structure changes

