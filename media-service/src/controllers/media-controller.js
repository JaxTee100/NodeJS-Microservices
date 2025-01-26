const { uploadMediaToCloudinary } = require("../utils/cloudinary");
const logger = require("../utils/logger")
const Media = require('../models/Media')



const uploadMedia = async (req, res) => {
    logger.info(`starting media upload....`);
    try {
        if(!req.file){
            logger.error(`No file found. Please add a file and try again`);
            return res.status(400).json({
                success: false,
                message: 'No file found. Please add a file and try again'
            })
        }
        const {originalname, mimetype, buffer} = req.file;
        const userId = req.user.userId;

        logger.info(`File details: name=${originalname}, type=${mimetype}`);
        logger.info(`uploading to cloudinary starting....`);

        const cloudinaryUploadResult = await uploadMediaToCloudinary(req.file);
        logger.info(`Cloudinary upload succesful. Public Id: ${cloudinaryUploadResult.public_id}`);

        const newMedia = new Media({
            publicId: cloudinaryUploadResult.public_id,
            originalName: originalname,
            mimeType: mimetype,
            url: cloudinaryUploadResult.secure_url,
            userId
        })

        await newMedia.save();
        res.status(201).json({
            success: true,
            mediaId: newMedia._id,
            url: newMedia.url,
            message: 'Media upload is successfully completed'
        })
    } catch (error) {
        logger.error(`Error uploading media ${error}`);
        res.status(500).json({
            success: false,
            message: "Internal server error from the upload image endpoint",
            err: error.message
        })
    }
}

const getAllMedias = async(req, res) => {
    try {
        const results = await Media.find({});
        res.json({results})
    } catch (error) {
        logger.error(`Error fetching media ${error}`);
        res.status(500).json({
            success: false,
            message: "Error fetching media",
            err: error.message
        })
    }
}


module.exports = { uploadMedia, getAllMedias };