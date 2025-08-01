import { Request, Response } from 'express';
import {
  getCommentsByVideoIdWithCursor,
  getRepliesWithCursor,
  getRepliesByCommentIds,
  getCommentCountByVideoId,
  getReplyCountByCommentId,
  createComment as createCommentService,
  createReply as createReplyService,
  deleteComment as deleteCommentService,
  deleteReply as deleteReplyService,
  likeIncrementComment,
  likeDecrementComment,
  dislikeIncrementComment,
  dislikeDecrementComment,
  likeIncrementReply,
  likeDecrementReply,
  dislikeIncrementReply,
  dislikeDecrementReply
} from '../services/commentsService';
import {
  getTopComments,
  getCommentsWithReplies,
  getRepliesWithCursor as getRepliesWithCursorUtil,
  decodeCursor
} from '../utils/ranking';
import { PaginationResponse } from '../models/comments';

// GET /api/comments/:videoId - Get comments for a video with cursor pagination
export const getComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { videoId } = req.params;
    const { type, limit = '20', cursor, replies_limit = '5' } = req.query;

    if (!videoId) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameter: videoId'
      });
      return;
    }

    const limitNum = parseInt(limit as string);
    const dbLimit = limitNum + 1; // Over-fetch by 1 for pagination detection
    const repliesLimitNum = parseInt(replies_limit as string);

    let lastCreatedAt, lastId;
    if (cursor) {
      try {
        const parsed = decodeCursor(cursor as string);
        lastCreatedAt = parsed.createdAt;
        lastId = parsed.id;
      } catch (error) {
        res.status(400).json({
          success: false,
          error: 'Invalid cursor format'
        });
        return;
      }
    }

    let result: any;
    let pagination: PaginationResponse;

    if (type === 'top') {
      // Get top-level comments only with cursor pagination
      const comments = await getCommentsByVideoIdWithCursor(videoId, dbLimit, lastCreatedAt, lastId);
      const totalEstimated = await getCommentCountByVideoId(videoId);
      const topCommentsResult = getTopComments(comments, limitNum, cursor as string);

      result = topCommentsResult.comments;
      pagination = {
        next_cursor: topCommentsResult.nextCursor,
        has_more: topCommentsResult.hasMore,
        total_estimated: totalEstimated
      };

    } else if (type === 'nested') {
      // Get comments with their replies
      const comments = await getCommentsByVideoIdWithCursor(videoId, dbLimit, lastCreatedAt, lastId);
      const commentIds = comments.map(c => c.id);
      const replies = await getRepliesByCommentIds(commentIds);
      const totalEstimated = await getCommentCountByVideoId(videoId);

      const nestedResult = getCommentsWithReplies(comments, replies, limitNum, repliesLimitNum, cursor as string);

      result = nestedResult.comments;
      pagination = {
        next_cursor: nestedResult.nextCursor,
        has_more: nestedResult.hasMore,
        total_estimated: totalEstimated
      };

    } else {
      const comments = await getCommentsByVideoIdWithCursor(videoId, dbLimit, lastCreatedAt, lastId);
      const totalEstimated = await getCommentCountByVideoId(videoId);
      const rankedResult = getTopComments(comments, limitNum, cursor as string);

      result = rankedResult.comments;
      pagination = {
        next_cursor: rankedResult.nextCursor,
        has_more: rankedResult.hasMore,
        total_estimated: totalEstimated
      };
    }

    res.json({
      success: true,
      data: result,
      pagination
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch comments'
    });
  }
};

// POST /api/comments - New comment
export const createComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { videoId, userId, content } = req.body;

    if (!videoId || !userId || !content) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: videoId, userId, content'
      });
      return;
    }

    const newComment = await createCommentService({
      video_id: videoId,
      user_id: userId,
      content,
      likes: 0,
      dislikes: 0,
      reply_count: 0
    });

    res.status(201).json({
      success: true,
      data: newComment
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create comment'
    });
  }
};

// POST /api/comments/:id/replies - New reply
export const createReply = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: commentId } = req.params;
    const { userId, content } = req.body;

    if (!commentId || !userId || !content) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: commentId, userId, content'
      });
      return;
    }

    const newReply = await createReplyService({
      comment_id: commentId,
      user_id: userId,
      content,
      likes: 0,
      dislikes: 0
    });

    res.status(201).json({
      success: true,
      data: newReply
    });
  } catch (error) {
    console.error('Error creating reply:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create reply'
    });
  }
};

// DELETE /api/comments/:id - Delete comment
export const deleteComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Missing comment id'
      });
      return;
    }

    await deleteCommentService(id);

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete comment'
    });
  }
};

// DELETE /api/replies/:id - Delete reply
export const deleteReply = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Missing reply id'
      });
      return;
    }

    await deleteReplyService(id);

    res.json({
      success: true,
      message: 'Reply deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting reply:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete reply'
    });
  }
};

// GET /api/comments/:id/replies - Get replies for a comment
export const getReplies = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: commentId } = req.params;
    const { limit = '10', cursor } = req.query;

    if (!commentId) {
      res.status(400).json({
        success: false,
        error: 'Missing comment id'
      });
      return;
    }

    const limitNum = parseInt(limit as string);
    const dbLimit = limitNum + 1; // Over-fetch by 1 for pagination detection

    let lastCreatedAt, lastId;
    if (cursor) {
      try {
        const parsed = decodeCursor(cursor as string);
        lastCreatedAt = parsed.createdAt;
        lastId = parsed.id;
      } catch (error) {
        res.status(400).json({
          success: false,
          error: 'Invalid cursor format'
        });
        return;
      }
    }

    const replies = await getRepliesWithCursor(commentId, dbLimit, lastCreatedAt, lastId);
    const totalEstimated = await getReplyCountByCommentId(commentId);
    const repliesResult = getRepliesWithCursorUtil(replies, limitNum, cursor as string);

    const pagination: PaginationResponse = {
      next_cursor: repliesResult.nextCursor,
      has_more: repliesResult.hasMore,
      total_estimated: totalEstimated
    };

    res.json({
      success: true,
      data: repliesResult.replies,
      pagination
    });
  } catch (error) {
    console.error('Error fetching replies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch replies'
    });
  }
};

// Comment like/dislike handlers
export const increaseLikeComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'Missing comment id' });
      return;
    }
    await likeIncrementComment(id);
    res.json({ success: true, message: 'Comment likes increased successfully' });
  } catch (error) {
    console.error('Error increasing comment likes:', error);
    res.status(500).json({ success: false, error: 'Failed to increase comment likes' });
  }
};

export const decreaseLikeComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'Missing comment id' });
      return;
    }
    await likeDecrementComment(id);
    res.json({ success: true, message: 'Comment likes decreased successfully' });
  } catch (error) {
    console.error('Error decreasing comment likes:', error);
    res.status(500).json({ success: false, error: 'Failed to decrease comment likes' });
  }
};

export const increaseDislikeComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'Missing comment id' });
      return;
    }
    await dislikeIncrementComment(id);
    res.json({ success: true, message: 'Comment dislikes increased successfully' });
  } catch (error) {
    console.error('Error increasing comment dislikes:', error);
    res.status(500).json({ success: false, error: 'Failed to increase comment dislikes' });
  }
};

export const decreaseDislikeComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'Missing comment id' });
      return;
    }
    await dislikeDecrementComment(id);
    res.json({ success: true, message: 'Comment dislikes decreased successfully' });
  } catch (error) {
    console.error('Error decreasing comment dislikes:', error);
    res.status(500).json({ success: false, error: 'Failed to decrease comment dislikes' });
  }
};

// Reply like/dislike handlers
export const increaseLikeReply = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'Missing reply id' });
      return;
    }
    await likeIncrementReply(id);
    res.json({ success: true, message: 'Reply likes increased successfully' });
  } catch (error) {
    console.error('Error increasing reply likes:', error);
    res.status(500).json({ success: false, error: 'Failed to increase reply likes' });
  }
};

export const decreaseLikeReply = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'Missing reply id' });
      return;
    }
    await likeDecrementReply(id);
    res.json({ success: true, message: 'Reply likes decreased successfully' });
  } catch (error) {
    console.error('Error decreasing reply likes:', error);
    res.status(500).json({ success: false, error: 'Failed to decrease reply likes' });
  }
};

export const increaseDislikeReply = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'Missing reply id' });
      return;
    }
    await dislikeIncrementReply(id);
    res.json({ success: true, message: 'Reply dislikes increased successfully' });
  } catch (error) {
    console.error('Error increasing reply dislikes:', error);
    res.status(500).json({ success: false, error: 'Failed to increase reply dislikes' });
  }
};

export const decreaseDislikeReply = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'Missing reply id' });
      return;
    }
    await dislikeDecrementReply(id);
    res.json({ success: true, message: 'Reply dislikes decreased successfully' });
  } catch (error) {
    console.error('Error decreasing reply dislikes:', error);
    res.status(500).json({ success: false, error: 'Failed to decrease reply dislikes' });
  }
};
