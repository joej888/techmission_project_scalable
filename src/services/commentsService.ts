import { connectToDatabase } from '../config/database';
import { Comment, Reply, CommentRow, ReplyRow } from '../models/comments';
import { v4 as uuidv4 } from 'uuid';

// Helper function to map Scylla DB Row to CommentRow
const mapDbRowToCommentRow = (row: any): CommentRow => ({
  id: row.id,
  video_id: row.video_id,
  user_id: row.user_id,
  content: row.content,
  likes: typeof row.likes === 'object' ? row.likes.toNumber() : row.likes,
  dislikes: typeof row.dislikes === 'object' ? row.dislikes.toNumber() : row.dislikes,
  created_at: row.created_at,
  reply_count: typeof row.reply_count === 'object' ? row.reply_count.toNumber() : row.reply_count
});

// Helper function to map Scylla DB Row to ReplyRow
const mapDbRowToReplyRow = (row: any): ReplyRow => ({
  id: row.id,
  comment_id: row.comment_id,
  user_id: row.user_id,
  content: row.content,
  likes: typeof row.likes === 'object' ? row.likes.toNumber() : row.likes,
  dislikes: typeof row.dislikes === 'object' ? row.dislikes.toNumber() : row.dislikes,
  created_at: row.created_at
});

// Helper function to map CommentRow to Comment
const mapRowToComment = (row: CommentRow): Comment => ({
  id: row.id,
  videoId: row.video_id,
  userId: row.user_id,
  content: row.content,
  likes: row.likes,
  dislikes: row.dislikes,
  createdAt: row.created_at,
  replyCount: row.reply_count
});

// Helper function to map ReplyRow to Reply
const mapRowToReply = (row: ReplyRow): Reply => ({
  id: row.id,
  commentId: row.comment_id,
  userId: row.user_id,
  content: row.content,
  likes: row.likes,
  dislikes: row.dislikes,
  createdAt: row.created_at
});

// Get comments with cursor-based pagination using indexing table
export const getCommentsByVideoIdWithCursor = async (
  videoId: string,
  limit: number,
  lastCreatedAt?: Date,
  lastId?: string
): Promise<Comment[]> => {
  const client = await connectToDatabase();
  
  let query: string;
  let params: any[];

  if (lastCreatedAt && lastId) {
    query = `
      SELECT * FROM comments_by_video_time 
      WHERE video_id = ? AND (created_at, id) < (?, ?)
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `,
    params = [videoId, lastCreatedAt, lastId, limit]
  } else {
    // First page
    query = `
      SELECT * FROM comments_by_video_time 
      WHERE video_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `,
    params = [videoId, limit]
  }
  const result = await client.execute(query, params, { prepare: true });
  return result.rows.map(mapDbRowToCommentRow).map(mapRowToComment);
};

// Get replies with cursor-based pagination using indexing table
export const getRepliesWithCursor = async (
  commentId: string,
  limit: number,
  lastCreatedAt?: Date,
  lastId?: string
): Promise<Reply[]> => {
  const client = await connectToDatabase();
  
  let query: string;
  let params: any[];
  
  if (lastCreatedAt && lastId) {
    // Use cursor-based pagination
    query = `
      SELECT * FROM replies_by_comment_time 
      WHERE comment_id = ? AND (created_at, id) < (?, ?)
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `,
      params = [commentId, lastCreatedAt, lastId, limit],
    {
      hints: ['uuid', 'timestamp', 'string', 'counter'],
      prepare: true
    }
  } else {
    // First page
    query = `
      SELECT * FROM replies_by_comment_time 
      WHERE comment_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `,
    params = [commentId, limit],
    {
      hints: ['uuid', 'counter'],
      prepare: true
    }
  }
  
  const result = await client.execute(query, params, { prepare: true });
  return result.rows.map(mapDbRowToReplyRow).map(mapRowToReply);
};

// Get all comments for a video (for nested structure - when we need all data)
export const getCommentsByVideoId = async (videoId: string): Promise<Comment[]> => {
  const client = await connectToDatabase();
  const query = 'SELECT * FROM comments WHERE video_id = ? ORDER BY created_at DESC';
  const result = await client.execute(query, [videoId]);
  return result.rows.map(mapDbRowToCommentRow).map(mapRowToComment);
};

// Get all replies for multiple comments (for nested structure)
export const getRepliesByCommentIds = async (commentIds: string[]): Promise<Reply[]> => {
 if (commentIds.length === 0) return [];
 
 const client = await connectToDatabase();
 
 // Use the indexing table instead of original table with ORDER BY
 const queries = commentIds.map(commentId => 
   client.execute('SELECT * FROM replies_by_comment_time WHERE comment_id = ?', [commentId])
 );
 
 const results = await Promise.all(queries);
 const allReplies: Reply[] = [];
 
 results.forEach(result => {
   const replies = result.rows.map(mapDbRowToReplyRow).map(mapRowToReply);
   allReplies.push(...replies);
 });
 
 return allReplies;
};

// Get specific comment by ID
export const getCommentById = async (commentId: string): Promise<Comment | null> => {
  const client = await connectToDatabase();
  const query = 'SELECT * FROM comments WHERE id = ?';
  const result = await client.execute(query, [commentId]);
  if (result.rows.length === 0) return null;
  return mapRowToComment(mapDbRowToCommentRow(result.rows[0]));
};

// Get specific reply by ID
export const getReplyById = async (replyId: string): Promise<Reply | null> => {
  const client = await connectToDatabase();
  const query = 'SELECT * FROM replies WHERE id = ?';
  const result = await client.execute(query, [replyId]);
  if (result.rows.length === 0) return null;
  return mapRowToReply(mapDbRowToReplyRow(result.rows[0]));
};

// Get comment count for estimated totals
export const getCommentCountByVideoId = async (videoId: string): Promise<number> => {
  const client = await connectToDatabase();
  const query = 'SELECT COUNT(*) as count FROM comments WHERE video_id = ?';
  const result = await client.execute(query, [videoId]);
  if (!result.rows || result.rows.length === 0 || !result.rows[0]) {
    return 0;
  }
  const count = result.rows[0].count;
  return typeof count === 'object' ? count.toNumber() : count;
};

// Get reply count for a comment
export const getReplyCountByCommentId = async (commentId: string): Promise<number> => {
  const client = await connectToDatabase();
  const query = 'SELECT COUNT(*) as count FROM replies WHERE comment_id = ?';
  const result = await client.execute(query, [commentId]);
  if (!result.rows || result.rows.length === 0 || !result.rows[0]) {
    return 0;
  }
  const count = result.rows[0].count;
  return typeof count === 'object' ? count.toNumber() : count;
};

// Create new comment
export const createComment = async (comment: Omit<CommentRow, 'id' | 'created_at'>): Promise<CommentRow> => {
  const client = await connectToDatabase();
  const newCommentRow: CommentRow = {
    id: uuidv4(),
    created_at: new Date(),
    ...comment,
  };

  // Insert into both tables (original and indexing table)
  const insertCommentQuery = `
    INSERT INTO comments (id, video_id, user_id, content, likes, dislikes, created_at, reply_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const insertCommentIndexQuery = `
    INSERT INTO comments_by_video_time (video_id, created_at, id, user_id, content, likes, dislikes, reply_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    newCommentRow.id,
    newCommentRow.video_id,
    newCommentRow.user_id,
    newCommentRow.content,
    newCommentRow.likes,
    newCommentRow.dislikes,
    newCommentRow.created_at,
    newCommentRow.reply_count
  ];

  const indexParams = [
    newCommentRow.video_id,
    newCommentRow.created_at,
    newCommentRow.id,
    newCommentRow.user_id,
    newCommentRow.content,
    newCommentRow.likes,
    newCommentRow.dislikes,
    newCommentRow.reply_count
  ];

  // Execute both inserts
  await Promise.all([
    client.execute(insertCommentQuery, params),
    client.execute(insertCommentIndexQuery, indexParams)
  ]);

  return newCommentRow;
};

// Create new reply
export const createReply = async (reply: Omit<ReplyRow, 'id' | 'created_at'>): Promise<ReplyRow> => {
  const client = await connectToDatabase();
  const newReplyRow: ReplyRow = {
    id: uuidv4(),
    created_at: new Date(),
    ...reply,
  };

  // Insert into both tables (original and indexing table)
  const insertReplyQuery = `
    INSERT INTO replies (id, comment_id, user_id, content, likes, dislikes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const insertReplyIndexQuery = `
    INSERT INTO replies_by_comment_time (comment_id, created_at, id, user_id, content, likes, dislikes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    newReplyRow.id,
    newReplyRow.comment_id,
    newReplyRow.user_id,
    newReplyRow.content,
    newReplyRow.likes,
    newReplyRow.dislikes,
    newReplyRow.created_at
  ];

  const indexParams = [
    newReplyRow.comment_id,
    newReplyRow.created_at,
    newReplyRow.id,
    newReplyRow.user_id,
    newReplyRow.content,
    newReplyRow.likes,
    newReplyRow.dislikes
  ];

  // Execute both inserts
  await Promise.all([
    client.execute(insertReplyQuery, params),
    client.execute(insertReplyIndexQuery, indexParams)
  ]);

  // Increment reply count for parent comment
  await increaseReplyCount(newReplyRow.comment_id);

  return newReplyRow;
};

// Delete comment (and all its replies)
export const deleteComment = async (commentId: string): Promise<void> => {
  const client = await connectToDatabase();
  
  // Get the comment first to get video_id and created_at for indexing table
  const comment = await getCommentById(commentId);
  if (!comment) {
    throw new Error(`Comment with id ${commentId} not found`);
  }
  
  // Delete all replies for this comment from both tables
  const replies = await getRepliesByCommentIds([commentId]);
  for (const reply of replies) {
    await client.execute('DELETE FROM replies WHERE id = ?', [reply.id]);
    await client.execute('DELETE FROM replies_by_comment_time WHERE comment_id = ? AND created_at = ? AND id = ?', 
      [reply.commentId, reply.createdAt, reply.id]);
  }
  
  // Delete the comment from both tables
  await Promise.all([
    client.execute('DELETE FROM comments WHERE id = ?', [commentId]),
    client.execute('DELETE FROM comments_by_video_time WHERE video_id = ? AND created_at = ? AND id = ?', 
      [comment.videoId, comment.createdAt, comment.id])
  ]);
};

// Delete reply
export const deleteReply = async (replyId: string): Promise<void> => {
  const client = await connectToDatabase();
  
  // Get the reply to find parent comment and other details
  const reply = await getReplyById(replyId);
  if (!reply) {
    throw new Error(`Reply with id ${replyId} not found`);
  }
  
  // Delete the reply from both tables
  await Promise.all([
    client.execute('DELETE FROM replies WHERE id = ?', [replyId]),
    client.execute('DELETE FROM replies_by_comment_time WHERE comment_id = ? AND created_at = ? AND id = ?', 
      [reply.commentId, reply.createdAt, reply.id])
  ]);
  
  // Decrease reply count for parent comment
  await decreaseReplyCount(reply.commentId);
};

// Helper function to update both tables when modifying likes/dislikes
const updateCommentInBothTables = async (commentId: string, field: string, newValue: number): Promise<void> => {
  const client = await connectToDatabase();
  const comment = await getCommentById(commentId);
  if (!comment) {
    throw new Error(`Comment with id ${commentId} not found`);
  }

  await Promise.all([
  client.execute(`UPDATE comments SET ${field} = ? WHERE id = ?`, [newValue, commentId], { 
    hints: ['counter', 'uuid'], 
    prepare: true 
  }),
  client.execute(`UPDATE comments_by_video_time SET ${field} = ? WHERE video_id = ? AND created_at = ? AND id = ?`, 
    [newValue, comment.videoId, comment.createdAt, comment.id], { 
    hints: ['counter', 'uuid', 'timestamp', 'uuid'], 
    prepare: true 
  })
]);
};

const updateReplyInBothTables = async (replyId: string, field: string, newValue: number): Promise<void> => {
  const client = await connectToDatabase();
  const reply = await getReplyById(replyId);
  if (!reply) {
    throw new Error(`Reply with id ${replyId} not found`);
  }
  client.execute(`UPDATE replies SET ${field} = ? WHERE id = ?`, [newValue, replyId], { 
    hints: ['counter', 'uuid'], 
    prepare: true 
  }),
  client.execute(`UPDATE replies_by_comment_time SET ${field} = ? WHERE comment_id = ? AND created_at = ? AND id = ?`, 
    [newValue, reply.commentId, reply.createdAt, reply.id], { 
    hints: ['counter', 'uuid', 'timestamp', 'uuid'], 
    prepare: true 
  })
};

// Increase reply count for a comment
export const increaseReplyCount = async (commentId: string): Promise<void> => {
  const client = await connectToDatabase();
  
  const selectQuery = 'SELECT reply_count FROM comments WHERE id = ?';
  const result = await client.execute(selectQuery, [commentId]);
  
  if (!result.rows[0]) {
    throw new Error(`Comment with id ${commentId} not found`);
  }
  
    let currentCount = result.rows[0].reply_count.toNumber();

  currentCount = currentCount + 1; // Increment reply count ++
  
  await updateCommentInBothTables(commentId, 'reply_count', currentCount);
};

// Decrease reply count for a comment
export const decreaseReplyCount = async (commentId: string): Promise<void> => {
  const client = await connectToDatabase();
  
  const selectQuery = 'SELECT reply_count FROM comments WHERE id = ?';
  const result = await client.execute(selectQuery, [commentId]);
  
  if (!result.rows[0]) {
    throw new Error(`Comment with id ${commentId} not found`);
  }
  
  let currentCount = result.rows[0].reply_count.toNumber();
  if (currentCount > 0) {
    currentCount = currentCount - 1;
    await updateCommentInBothTables(commentId, 'reply_count', currentCount);
  }
};

// Like/Dislike operations for comments
export const likeIncrementComment = async (commentId: string): Promise<void> => {
  const client = await connectToDatabase();
  const selectQuery = 'SELECT likes FROM comments WHERE id = ?';
  const result = await client.execute(selectQuery, [commentId]);
  
  if (!result.rows[0]) {
    throw new Error(`Comment with id ${commentId} not found`);
  }
  
  let likesCount = result.rows[0].likes.toNumber();
  likesCount = likesCount + 1;
  
  await updateCommentInBothTables(commentId, 'likes', likesCount);
};

export const likeDecrementComment = async (commentId: string): Promise<void> => {
  const client = await connectToDatabase();
  const selectQuery = 'SELECT likes FROM comments WHERE id = ?';
  const result = await client.execute(selectQuery, [commentId]);
  
  if (!result.rows[0]) {
    throw new Error(`Comment with id ${commentId} not found`);
  }
  
  let likesCount = result.rows[0].likes.toNumber();
  if (likesCount > 0) {
    likesCount = likesCount - 1;
    await updateCommentInBothTables(commentId, 'likes', likesCount);
  }
};

export const dislikeIncrementComment = async (commentId: string): Promise<void> => {
  const client = await connectToDatabase();
  const selectQuery = 'SELECT dislikes FROM comments WHERE id = ?';
  const result = await client.execute(selectQuery, [commentId]);
  
  if (!result.rows[0]) {
    throw new Error(`Comment with id ${commentId} not found`);
  }
  
  let dislikesCount = result.rows[0].dislikes.toNumber();
  dislikesCount = dislikesCount + 1;
  
  await updateCommentInBothTables(commentId, 'dislikes', dislikesCount);
};

export const dislikeDecrementComment = async (commentId: string): Promise<void> => {
  const client = await connectToDatabase();
  const selectQuery = 'SELECT dislikes FROM comments WHERE id = ?';
  const result = await client.execute(selectQuery, [commentId]);
  
  if (!result.rows[0]) {
    throw new Error(`Comment with id ${commentId} not found`);
  }
  
  let dislikesCount = result.rows[0].dislikes.toNumber();
  if (dislikesCount > 0) {
    dislikesCount = dislikesCount - 1;
    await updateCommentInBothTables(commentId, 'dislikes', dislikesCount);
  }
};

// Like/Dislike operations for replies
export const likeIncrementReply = async (replyId: string): Promise<void> => {
  const client = await connectToDatabase();
  const selectQuery = 'SELECT likes FROM replies WHERE id = ?';
  const result = await client.execute(selectQuery, [replyId]);
  
  if (!result.rows[0]) {
    throw new Error(`Reply with id ${replyId} not found`);
  }
  
  let likesCount = result.rows[0].likes.toNumber();
  likesCount = likesCount + 1;
  
  await updateReplyInBothTables(replyId, 'likes', likesCount);
};

export const likeDecrementReply = async (replyId: string): Promise<void> => {
  const client = await connectToDatabase();
  const selectQuery = 'SELECT likes FROM replies WHERE id = ?';
  const result = await client.execute(selectQuery, [replyId]);
  
  if (!result.rows[0]) {
    throw new Error(`Reply with id ${replyId} not found`);
  }
  
  let likesCount = result.rows[0].likes.toNumber();
  if (likesCount > 0) {
    likesCount = likesCount - 1;
    await updateReplyInBothTables(replyId, 'likes', likesCount);
  }
};

export const dislikeIncrementReply = async (replyId: string): Promise<void> => {
  const client = await connectToDatabase();
  const selectQuery = 'SELECT dislikes FROM replies WHERE id = ?';
  const result = await client.execute(selectQuery, [replyId]);
  
  if (!result.rows[0]) {
    throw new Error(`Reply with id ${replyId} not found`);
  }
  
  let dislikesCount = result.rows[0].dislikes.toNumber();
  dislikesCount = dislikesCount + 1;
  
  await updateReplyInBothTables(replyId, 'dislikes', dislikesCount);
};

export const dislikeDecrementReply = async (replyId: string): Promise<void> => {
  const client = await connectToDatabase();
  const selectQuery = 'SELECT dislikes FROM replies WHERE id = ?';
  const result = await client.execute(selectQuery, [replyId]);
  
  if (!result.rows[0]) {
    throw new Error(`Reply with id ${replyId} not found`);
  }
  
  let dislikesCount = result.rows[0].dislikes.toNumber();
  if (dislikesCount > 0) {
    dislikesCount = dislikesCount - 1;
    await updateReplyInBothTables(replyId, 'dislikes', dislikesCount);
  }
}