// Base interfaces
export interface Comment {
  id: string;
  videoId: string;
  userId: string;
  content: string;
  likes: number;
  dislikes: number;
  createdAt: Date;
  replyCount: number;
}

export interface Reply {
  id: string;
  commentId: string;
  userId: string;
  content: string;
  likes: number;
  dislikes: number;
  createdAt: Date;
}

// Ranked interfaces for display
export interface RankedComment extends Comment {
  score: number;
  timeAgo: string;
  netScore: number;
  replies?: RankedReply[];
}

export interface RankedReply extends Reply {
  score: number;
  timeAgo: string;
  netScore: number;
}

// Database models for Scylla operations
export interface CommentRow {
  id: string;
  video_id: string;
  user_id: string;
  content: string;
  likes: number;
  dislikes: number;
  created_at: Date;
  reply_count: number;
}

export interface ReplyRow {
  id: string;
  comment_id: string;
  user_id: string;
  content: string;
  likes: number;
  dislikes: number;
  created_at: Date;
}

// Pagination types
export interface PaginationResponse {
  next_cursor?: string | undefined;
  has_more: boolean;
  total_estimated?: number;
}

export interface CursorInfo {
  createdAt: Date;
  id: string;
}