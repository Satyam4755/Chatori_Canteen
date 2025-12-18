const express = require('express');
const venderRouter = express.Router();

// Import multer middleware for handling image uploads
const multiFileUpload = require('../middleware/multer');

// Controller methods
const { 
    addVender, 
    vendersList, 
    editvender, 
    postaddVender, 
    Posteditvender, 
    deletevender,
    getOrders
} = require('../controller/vender');

// ---------------- GET ROUTES ---------------- //
venderRouter.get('/addVenderShip', addVender);
venderRouter.get('/venders_list', vendersList);  
venderRouter.get('/venders_list/:venderId', editvender);
venderRouter.get('/orders', getOrders);
venderRouter.get('/edit_vender/:venderId', editvender);


// ---------------- POST ROUTES ---------------- //
// ⚠️ Add multer upload middleware to handle 'image'.
venderRouter.post('/addVenderShip', multiFileUpload, postaddVender);
venderRouter.post('/edit_vender', multiFileUpload, Posteditvender);

venderRouter.post('/delete_vender/:venderId', deletevender);

// Export router
exports.venderRouter = venderRouter;
