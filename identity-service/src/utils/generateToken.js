const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');

const generateTokens = async (user) => {
    try {
        const accessToken = jwt.sign({
            userId: user._id,
            username: user.username,
        }, 
        process.env.JWT_SECRET, {expiresIn: '35m'});
    
        const refreshToken = crypto.randomBytes(40).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); //refresh token expires in 7 days
    
        await RefreshToken.create({
            token: refreshToken,
            user: user._id,
            expiresAt,
        });
    
        return {accessToken, refreshToken};
    } catch (error) {
        logger.error('error generating tokens or saving refresh token', error.message);

        // Throw an error to be caught by the calling function
        throw new Error('Error generating tokens or saving refresh token: ' + error.message);
    }
    
}

module.exports = generateTokens;