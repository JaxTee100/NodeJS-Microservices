


const RefreshToken = require('../models/RefreshToken');
const User = require('../models/User');
const generateTokens = require('../utils/generateToken');
const logger = require('../utils/logger');
const { validateRegistration, validateLogin } = require('../utils/validation');
//user registration


const registerUser = async(req, res) => {
    logger.info('registering user');
    try {
        //validate request
        const {error} = validateRegistration(req.body);
        if(error){
            logger.warn('validation error', error.details[0].message);
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
                
            });
        }

        const {username, email, password} = req.body;
        let user = await User.findOne({$or: [{email}, {username}]});
        if(user){
            logger.warn('user already exists');
            return res.status(400).json({
                success: false,
                message: 'user already exists',
            });
        }

        user = new User({username, email, password});
        await user.save();
        logger.warn('user registered successfully', user._id);
        const {accessToken, refreshToken} = await generateTokens(user);

        res.status(201).json({
            success: true,
            message: 'user registered successfully',
            accessToken,
            refreshToken,
        });
    } catch (error) {
        logger.error('error registering user');
        res.status(500).json({
            success: false,
            message: 'internal server register user endpoint',
        });

    }
}

//user login
const loginUser = async(req, res) => {
    logger.info("Login Endpoint  hit.....")
    try {
        const {error} = validateLogin(req.body);
        if(error){
            logger.warn('validation error', error.details[0].message);
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
                
            });
        }

        const {email, password} = req.body;
        const user = await User.findOne({email});
        if(!user){
            logger.warn('user not found');
            return res.status(400).json({
                success: false,
                message: 'invalid email or password',
            });
        }

        //use valid password
        const isValidPassword = await user.comparePassword(password);

        if(!isValidPassword){
            logger.warn('invalid password');
            return res.status(400).json({
                success: false,
                message: 'invalid email or password',
            });
        }

        const {accessToken, refreshToken} = await generateTokens(user);

        res.status(200).json({
            accessToken,
            refreshToken, 
            userId: user._id,
        });
    } catch (error) {
        logger.error('error login user');
        res.status(500).json({
            success: false,
            message: 'internal server error from login endpoint', 
            err: error.message
        });
    }
}


//refresh token
const refreshTokenUser = async(req, res) => {
    logger.info("Refresh Token Endpoint  hit.....")
    try {
        const {refreshToken} = req.body;
        if(!refreshToken){
            logger.warn('refresh token missing');
            return res.status(400).json({
                success: false,
                message: 'refresh token missing',
            });
        }

        const storedToken = await RefreshToken.findOne({token: refreshToken});
        if(!storedToken || storedToken.expiresAt < new Date()){
            logger.warn('invalid or expired refresh token');
            return res.status(401).json({
                success: false,
                message: 'invalid refresh token',
            });
        }

        const user = await User.findById(storedToken.user);
        if(!user){
            logger.warn('user not found');
            return res.status(400).json({
                success: false,
                message: 'user not found',
            });

        }

        const {accessToken: newAccessToken, refreshToken: newRefreshToken} = await generateTokens(user);
         //delete old refresh token
         await RefreshToken.deleteOne({_id: storedToken._id});

         res.status(201).json({
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
         })
    } catch (error) {
        logger.error('error refreshing token');
        res.status(500).json({
            success: false,
            message: 'internal server error from refresh token endpoint',
        });
    }
}


//logout
const logoutUser = async () =>{
    logger.info("Logout Endpoint  hit.....")
    try {
        const {refreshToken} = req.body;
        if(!refreshToken){
            logger.warn('refresh token missing');
            return res.status(400).json({
                success: false,
                message: 'refresh token missing',
            });
        }

        await RefreshToken.deleteOne({token: refreshToken});
        logger.info('refresh token deleted, user logged out successfully');
        res.status(200).json({
            success: true,
            message: 'user logged out successfully',
        });
    } catch (error) {
        logger.error('error logging out user');
        res.status(500).json({
            success: false,
            message: 'internal server error from logout endpoint',
        });
    }
}


module.exports = { registerUser, loginUser, refreshTokenUser, logoutUser };