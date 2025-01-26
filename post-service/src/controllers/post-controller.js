const logger = require('../utils/logger');
const Post = require('../models/Post');
const { validateCreatePost } = require('../utils/validation');
const { publishEvent } = require('../utils/rabbitmq');

//invalidate post cache

async function invalidatePostsCache(req, input){
    const cachedKey = `post:${input}`;
    await req.redisClient.del(cachedKey)


    const keys = await req.redisClient.keys("posts:*");
    if(keys.length > 0){
        await req.redisClient.del(keys)
    }
}

const createPost = async (req, res) => {
    logger.info('Create post endpoint hit');

    try {
        //validate request
        const {error} = validateCreatePost(req.body);
        if(error){
            logger.warn('validation error at create post', error.details[0].message);
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
                
            });
        }
        const { content, mediaIds} = req.body;
        const newPost = new Post({
            user: req.user.userId,
            content,
            mediaIds: mediaIds || [],
        });

        await newPost.save();

        //publish an event for the search service
        await publishEvent('post.created', {
            postId : newPost._id.toString(),
            userId: newPost.user.toString(),
            content: newPost.content,
            createdAt: newPost.createdAt,
        })



        await invalidatePostsCache(req, newPost._id.toString())
        logger.info("Post created successfully", newPost);
        res.status(201).json({
            success: true,
            message: "Post created successfully",
            data: newPost,
        });
    } catch (error) {
        logger.error("Error creating post in the post content block", error);
        res.status(500).json({
            success: false,
            message: "Error creating post in the createPost block",
            err: error.message
        });
    }
}

const getAllPosts = async (req, res) => {
    try {
        
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const startIndex = (page - 1) * limit;
  
      const cacheKey = `posts:${page}:${limit}`;
      const cachedPosts = await req.redisClient.get(cacheKey);
  
      if (cachedPosts) {
        return res.json(JSON.parse(cachedPosts));
      }
  
      const posts = await Post.find({})
        .sort({ createdAt: -1 })
        .skip(startIndex)
        .limit(limit);
  
      const totalNoOfPosts = await Post.countDocuments();
  
      const result = {
        posts,
        currentpage: page,
        totalPages: Math.ceil(totalNoOfPosts / limit),
        totalPosts: totalNoOfPosts,
      };
  
      //save your posts in redis cache
      await req.redisClient.setex(cacheKey, 300, JSON.stringify(result));
  
      res.json(result);
    } catch (e) {
      logger.error("Error fetching posts", error);
      res.status(500).json({
        success: false,
        message: "Error fetching posts",
      });
    }
  };
  


const getPost = async (req, res) => {
    try {
        const postId = req.params.id;
        const cacheKey = `post:${postId}`;
        const cachedPost = await req.redisClient.get(cacheKey)
        if(cachedPost){
            return res.json(JSON.parse(cachedPost));
        }

        const singlePost = await Post.findById(postId);
        if(!singlePost){
            return res.status(404).json({
                message: "Post not found",
                success: false
            })
        }

        await req.redisClient.setex(cachedPost, 3600, JSON.stringify(singlePost));
        res.json(singlePost)
    } catch (error) {
        logger.error("Error getting post in the getPost block", error);
        res.status(500).json({
            success: false,
            message: "Error getting post by ID in the getPost block",
            err: error.message
        });
    }
}

const deletePost = async (req, res) => {
    try {
        const post = await Post.findOneAndDelete({
            _id: req.params.id,
            user: req.user.userId
        });
        if(!post){
            return res.status(404).json({
                message: 'Post not found',
                success: false
            })
        }

        //publish post delete method
        await publishEvent('post.deleted', {
            postId: post._id.toString(),
            userId: req.user.userId,
            mediaIds: post.mediaIds
        })

        await invalidatePostsCache(req, req.params.id);

        res.json({
            success: true,
            message: "deleted succesfully"
        })
    } catch (error) {
        logger.error("Error deleting post in the deletePost block", error);
        res.status(500).json({
            success: false,
            message: "Error deleting post in the deletePost block",
        });
    }
}



module.exports = { createPost, getAllPosts, getPost, deletePost };