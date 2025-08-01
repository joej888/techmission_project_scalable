import { Comment, Reply, RankedComment, RankedReply, CursorInfo } from '../models/comments';

/**
 * Top Comments Ranking Algorithm with Cursor Support
 */

// Calculate recency factor based on how recent the comment/reply is
function calculateRecencyFactor(createdAt: Date): number {
  const now = new Date();
  const hoursSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

  if (hoursSinceCreated <= 1) return 10;
  if (hoursSinceCreated <= 6) return 8;
  if (hoursSinceCreated <= 24) return 6;
  if (hoursSinceCreated <= 168) return 4; // 7 days
  if (hoursSinceCreated <= 672) return 2; // 4 weeks
  return 0;
}

// Calculate net score (likes - dislikes)
function calculateNetScore(item: Comment | Reply): number {
  return item.likes - item.dislikes;
}

// Calculate final score for a comment
function calculateCommentScore(comment: Comment): number {
  const netScore = calculateNetScore(comment);
  const recencyFactor = calculateRecencyFactor(comment.createdAt);
  const replyBoost = Math.min(comment.replyCount * 0.5, 5);
  return Math.max(0, netScore) + recencyFactor + replyBoost;
}

// Calculate final score for a reply
function calculateReplyScore(reply: Reply): number {
  const netScore = calculateNetScore(reply);
  const recencyFactor = calculateRecencyFactor(reply.createdAt);
  return Math.max(0, netScore) + recencyFactor;
}

// Format timestamp to human-readable time
function formatTimeAgo(createdAt: Date): string {
  const now = new Date();
  const secondsAgo = Math.floor((now.getTime() - createdAt.getTime()) / 1000);

  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 }
  ];

  for (const interval of intervals) {
    const count = Math.floor(secondsAgo / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
    }
  }

  return 'just now';
}

export function rankReplies(replies: Reply[]): RankedReply[] {
  return replies
    .map(reply => ({
      ...reply,
      netScore: calculateNetScore(reply),
      score: calculateReplyScore(reply),
      timeAgo: formatTimeAgo(reply.createdAt)
    }))
    .sort((a, b) => b.score - a.score);
}

export function encodeCursor(createdAt: Date, id: string): string {
  const cursorData = {
    createdAt: createdAt.toISOString(),
    id: id
  };
  return Buffer.from(JSON.stringify(cursorData)).toString('base64');
}

export function decodeCursor(cursor: string): CursorInfo {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
    return {
      createdAt: new Date(decoded.createdAt),
      id: decoded.id
    };
  } catch (error) {
    throw new Error('Invalid cursor format');
  }
}

export function generateNextCursor(chronologicalItems: Comment[] | Reply[]): string | undefined {
  if (chronologicalItems.length === 0) return undefined;
  const lastItem = chronologicalItems[chronologicalItems.length - 1];
  if (!lastItem) return undefined;
  return encodeCursor(lastItem.createdAt, lastItem.id);
}

export function getTopComments(
  comments: Comment[], 
  limit: number, 
  lastCursor?: string,
  sort: string = 'ranked'
): { comments: RankedComment[], nextCursor?: string | undefined, hasMore: boolean } {
  // Keep chronological DB order for pagination
  const hasMore = comments.length > limit;
  const chronologicalSlice = comments.slice(0, limit);
  
  // Convert to RankedComment format 
  const commentsWithMetadata = chronologicalSlice.map(comment => ({
    ...comment,
    netScore: calculateNetScore(comment),
    score: calculateCommentScore(comment),
    timeAgo: formatTimeAgo(comment.createdAt)
  }));

  // Apply sorting - default is now ranked by score
  let sortedComments = commentsWithMetadata;
  if (sort === 'chronological') {
    // Keep DB order when explicitly requested
    sortedComments = commentsWithMetadata;
  } else {
    // Default: sort by score (ranked)
    sortedComments = [...commentsWithMetadata].sort((a, b) => b.score - a.score);
  }
  
  return {
    comments: sortedComments,
    nextCursor: hasMore ? generateNextCursor(comments.slice(0, limit)) : undefined,
    hasMore: hasMore
  };
}

export function getCommentsWithReplies(
  comments: Comment[], 
  replies: Reply[],
  limit: number, 
  repliesLimit: number, 
  lastCursor?: string,
  sort: string = 'ranked'
): { comments: RankedComment[], nextCursor?: string | undefined, hasMore: boolean } {
  const hasMore = comments.length > limit;
  const chronologicalSlice = comments.slice(0, limit);
  
  const commentsWithMetadata = chronologicalSlice.map(comment => ({
    ...comment,
    netScore: calculateNetScore(comment),
    score: calculateCommentScore(comment),
    timeAgo: formatTimeAgo(comment.createdAt)
  }));
  
  let sortedComments = commentsWithMetadata;
  if (sort === 'chronological') {
    sortedComments = commentsWithMetadata;
  } else {
    sortedComments = [...commentsWithMetadata].sort((a, b) => b.score - a.score);
  }

  const commentsWithReplies = sortedComments.map(comment => {
    const commentReplies = replies.filter(
      r => r.commentId.toString() === comment.id.toString()
    );
    // Always rank replies within each comment for better UX
    const rankedReplies = rankReplies(commentReplies);
    const limitedReplies = rankedReplies.slice(0, repliesLimit);

    return {
      ...comment,
      replies: limitedReplies
    };
  });

  return {
    comments: commentsWithReplies,
    nextCursor: hasMore ? generateNextCursor(comments.slice(0, limit)) : undefined,
    hasMore
  };
}

export function getRepliesWithCursor(
  replies: Reply[],
  limit: number,
  lastCursor?: string
): { replies: RankedReply[], nextCursor?: string | undefined, hasMore: boolean } {
  const hasMore = replies.length > limit;
  const chronologicalSlice = replies.slice(0, limit);
  const repliesWithMetadata = chronologicalSlice.map(reply => ({
    ...reply,
    netScore: calculateNetScore(reply),
    score: calculateReplyScore(reply),
    timeAgo: formatTimeAgo(reply.createdAt)
  }));

  return {
    replies: repliesWithMetadata,
    nextCursor: hasMore ? generateNextCursor(replies.slice(0, limit)) : undefined,
    hasMore: hasMore
  };
}
