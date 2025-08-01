import { Router } from 'express';
import { 
  getComments, //done
  createComment, // done
  deleteComment, //done
  createReply,  // done
  deleteReply, //done
  getReplies,  //done
  increaseLikeComment, //done
  decreaseLikeComment, //done
  increaseDislikeComment, // done
  decreaseDislikeComment, // done
  increaseLikeReply, //done
  decreaseLikeReply, //done
  increaseDislikeReply, //done
  decreaseDislikeReply //done
} from '../controllers/commentsController';

const router = Router();

// Comment Routes
router.get('/:videoId', getComments); // Get comments for a video with cursor pagination
// http://localhost:4000/api/comments/video_123?type=nested&limit=20&cursor=eyJjcmVhdGVkX2F0IjoiMjAyNC0xMi0xNVQxMDozMDowMC4wMDBaIiwiaWQiOiIxMjM0NSJ9&replies_limit=5

router.post('/', createComment); // Create a new comment
// http://localhost:4000/api/comments/

router.delete('/:id', deleteComment); // Delete a comment
// http://localhost:4000/api/comments/11111111-1111-1111-1111-111111111111

// Comment Like/Dislike Routes
router.put('/:id/like/increase', increaseLikeComment); // Increase like count for a comment
// http://localhost:4000/api/comments/11111111-1111-1111-1111-111111111111/like/increase

router.put('/:id/like/decrease', decreaseLikeComment); // Decrease like count for a comment
// http://localhost:4000/api/comments/11111111-1111-1111-1111-111111111111/like/decrease

router.put('/:id/dislike/increase', increaseDislikeComment); // Increase dislike count for a comment
// http://localhost:4000/api/comments/11111111-1111-1111-1111-111111111111/dislike/increase

router.put('/:id/dislike/decrease', decreaseDislikeComment); // Decrease dislike count for a comment
// http://localhost:4000/api/comments/11111111-1111-1111-1111-111111111111/dislike/decrease

// Reply Routes
router.get('/:id/replies', getReplies); // Get replies for a comment with cursor pagination
// http://localhost:4000/api/comments/11111111-1111-1111-1111-111111111111/replies?limit=10&cursor=eyJjcmVhdGVkX2F0IjoiMjAyNC0xMi0xNVQxMDozMDowMC4wMDBaIiwiaWQiOiIxMjM0NSJ9

router.post('/:id/replies', createReply); // Create a new reply to a comment
// http://localhost:4000/api/comments/11111111-1111-1111-1111-111111111111/replies

router.delete('/replies/:id', deleteReply); // Delete a reply
// http://localhost:4000/api/comments/replies/22222222-2222-2222-2222-222222222222

// Reply Like/Dislike Routes  
router.put('/replies/:id/like/increase', increaseLikeReply); // Increase like count for a reply
// http://localhost:4000/api/comments/replies/22222222-2222-2222-2222-222222222222/like/increase

router.put('/replies/:id/like/decrease', decreaseLikeReply); // Decrease like count for a reply
// http://localhost:4000/api/comments/replies/22222222-2222-2222-2222-222222222222/like/decrease

router.put('/replies/:id/dislike/increase', increaseDislikeReply); // Increase dislike count for a reply
// http://localhost:4000/api/comments/replies/22222222-2222-2222-2222-222222222222/dislike/increase

router.put('/replies/:id/dislike/decrease', decreaseDislikeReply); // Decrease dislike count for a reply
// http://localhost:4000/api/comments/replies/22222222-2222-2222-2222-222222222222/dislike/decrease

export default router;