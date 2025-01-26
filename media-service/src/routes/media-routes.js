const express = require('express');
const multer = require('multer');


const { uploadMedia, getAllMedias} = require('../controllers/media-controller');
const { authenticateRequest } = require('../middleware/auth-middleware');
const logger = require('../utils/logger');
const router = express.Router();



const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5* 1024 * 1024
    }
}).single('file')


router.post('/upload', authenticateRequest, (req, res, next) => {
    upload(req, res, function(err){
        if(err instanceof multer.MulterError){
            logger.error(`multer error while uploading`);
            res.status(400).json({
                success: false,
                message: `error uploading file from the media service, ${err.message}`,
                stack: err.stack
            })
        }else if(err){
            logger.error(`unknown error occured while uploading`);
            res.status(500).json({
                success: false,
                message: err.message,
                stack: err.stack
            })
        }

        if(!req.file){
            logger.error(`multer error while uploading`);
            res.status(400).json({
                success: false,
                message: "Nofile found",
            })
        }
        next();
    })
}, uploadMedia);

router.get('/get',authenticateRequest,  getAllMedias);

module.exports = router;