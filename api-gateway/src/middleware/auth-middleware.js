const logger = require("../utils/logger");
const jwt = require('jsonwebtoken');



const validateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if(!authHeader){
        logger.warn(`Login to try again`)
        res.status(401).json({
            success: false,
            message: "Please login and try again"
        })
    }
    const token = authHeader.split(" ")[1];
    if(!token){
        logger.warn(`Access attempt without valid token`);
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        })
    }
jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if(err){
        logger.warn(`Invalid token`);
        return res.status(429).json({
            success: false,
            message: 'Invalid token'
        })
    }
    req.user = user;
    next();
})
}


module.exports = {validateToken}