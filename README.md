# YouTube Comments API

A simple REST API for managing YouTube video comments with a smart ranking system. Built with Node.js, Express, TypeScript, and ScyllaDB.

## What it does

This API lets you store and retrieve YouTube comments with features like:
- Add comments and replies
- Like/dislike comments
- Smart comment ranking (popular comments appear first)
- Get comments in different formats (top comments, nested with replies)

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

### Get Comments
```http
GET /api/comments/:videoId
```
Get all comments for a video with different options:
- `?type=nested` - Get all comments & nested comments 
- `?type=top` -Get all top comments without limit
- `?type=top&topLevelLimit=10` - Get top 10 comments only
- `?type=nested&topLevelLimit=5&repliesLimit=3` - Get comments with replies ** top level max 5 comments and each top comment will have max 3 replies
- No query params - Get all comments ranked by score

### Create Comment
```http
POST /api/comments
```
**Body:**
```json
{
  "videoId": "video123",
  "userId": "user456",
  "content": "Great video!",
  "parentCommentId": "optional-for-replies"
}
```

### Like/Dislike Actions
```http
PUT /api/comments/:id/increaseLike
PUT /api/comments/:id/decreaseLike
PUT /api/comments/:id/increasedislike
PUT /api/comments/:id/decreasedislike
```

### Get Replies
```http
GET /api/comments/:id/replies?limit=5
```

### Delete Comment
```http
DELETE /api/comments/:id
```

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

The API uses a single `comments` table:

```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY,
  video_id TEXT,
  user_id TEXT,
  content TEXT,
  likes INT,
  dislikes INT,
  created_at TIMESTAMP,
  parent_comment_id UUID,
  reply_count INT
);
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

2. **Get top comments:**
   ```bash
   curl "http://localhost:4000/api/comments/abc123?type=top&topLevelLimit=5"
   ```

3. **Like a comment:**
   ```bash
   curl -X PUT http://localhost:4000/api/comments/comment-id/increaseLike
   ```

## Development

- `npm run dev` - Start development server with auto-reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production server

## Notes

- The database schema is automatically created when you first run the app
- All timestamps are stored in UTC
- UUIDs are used for comment IDs
- The ranking algorithm prioritizes recent, liked comments with engagement

## Common Issues

1. **Database connection fails**: Check your ScyllaDB is running and credentials are correct
2. **Port already in use**: Change PORT in .env file
3. **Build errors**: Make sure TypeScript is properly installed

---

That's it! You now have a working YouTube comments API with smart ranking.
