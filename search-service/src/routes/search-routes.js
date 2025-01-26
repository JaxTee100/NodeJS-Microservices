const express = require('express');
const { authenticateRequest } = require('../../../media-service/src/middleware/auth-middleware');
const { searchPostController } = require('../controllers/search-controller');


const router = express.Router();


router.use(authenticateRequest);

router.get('/posts', searchPostController);

module.exports = router