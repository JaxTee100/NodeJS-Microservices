const Media = require("../models/Media");
const { deleteMediaFromCloudinary } = require("../utils/cloudinary");
const logger = require("../utils/logger");

const handlePostDeleted = async(event) => {
    console.log(event, "Eventeventevent")
    const  {postId, mediaIds}= event;
    try {
        const mediaTodelete = await Media.find({_id: {$in: mediaIds}});
        for(const media of mediaTodelete){
            await deleteMediaFromCloudinary(media.publicId);
            await Media.findByIdAndDelete(media._id);

            logger.info(`deleted media ${media._id} associated with this deleted post ${postId}`)
        }
        logger.info(`processed deletion of media for post id ${postId}`)
    } catch (error) {
        logger.error(`${error} Error occured while media deletion`)
    }
}

module.exports = {handlePostDeleted}