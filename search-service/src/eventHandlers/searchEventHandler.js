const Search = require("../models/Search");
const logger = require('../utils/logger')

async function handlePostCreated(event){
    try {
        const newSearchPost = Search({
            postId: event.postId,
            userId: event.userId,
            content: event.content,
            createdAt: event.createdAt

        })

        await newSearchPost.save();

        logger.info(`Search Post created: ${event.postId}, ${newSearchPost._id.toString()}`)
    } catch (error) {
        logger.error(`${error} Error handling post creation event`)
    }
}


async function postDeleted(event){
    try {
        await Search.findOneAndDelete({postId: event.postId});
        logger.info(`Search Post deleted: ${event.postId}`)
    } catch (error) {
        logger.error(`${error} Error handling post deletion event`)
    }
}

module.exports = {handlePostCreated, postDeleted}