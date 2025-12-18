const cloudinary = require('cloudinary').v2;
const venders = require('../models/venders');
const { fileUploadInCloudinary } = require('../utils/cloudinary');
const User = require('../models/user');
const Order = require('../models/orders');

// for twillio
// const twilio = require('twilio');
// const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
// add vender 
exports.addVender = (req, res, next) => {
    res.render('./admin/editvenders', { 
        editing: false,
        title: "Add vender details",
        currentPage: 'admin',
        isLogedIn: req.isLogedIn,
        user: req.session.user
    });
};

// get edit vender
exports.editvender = (req, res, next) => {
    const venderId = req.params.venderId;
    const editing = req.query.editing === 'true';

    venders.findById(venderId).then(vender => {
        if (!vender) {
            console.log("vender not found");
            return res.redirect('/vender/venders_list');
        }

        console.log("vender vender:", vender.vender); // ✅ Now it's a real value

        res.render('./admin/editvenders', {
            vender: vender,
            editing: editing,
            title: "Edit vender details",
            currentPage: 'admin',
            isLogedIn: req.isLogedIn,
            user: req.session.user
        });
    });
};

// admin vender list
exports.vendersList = async (req, res, next) => {
  const venderId = req.session.user._id;

  try {
    const vendervenders = await venders.find({ vender: venderId }).populate('vender');

    // ✅ Calculate average rating for each vendor
    for (const vender of vendervenders) {
      if (vender.reviews && vender.reviews.length > 0) {
        const validRatings = vender.reviews.filter(r => typeof r.rating === 'number' && !isNaN(r.rating));
        if (validRatings.length > 0) {
          const total = validRatings.reduce((sum, review) => sum + review.rating, 0);
          vender.averageRating = parseFloat((total / validRatings.length).toFixed(1));
        } else {
          vender.averageRating = 0;
        }
      } else {
        vender.averageRating = 0;
      }
    }

    res.render('./admin/venders_list', {
      venders: vendervenders,
      title: "Admin venderList Page",
      currentPage: 'adminvender',
      isLogedIn: req.isLogedIn,
      user: req.session.user
    });
  } catch (err) {
    console.error("Error loading vendor list:", err);
    res.redirect('/dashboard');
  }
};

exports.postaddVender = async (req, res) => {
    const { id, Name, Price, Category, Description } = req.body;
    const files = req.files;

    if (!files || !files.image) {
        console.log("One or more required files are missing or not valid");
        return res.status(400).send("Missing image or menu image.");
    }

    try {
        const imageBuffer = files.image[0].buffer;

        const imageResult = await fileUploadInCloudinary(imageBuffer);

        if (!imageResult?.secure_url) {
            throw new Error("Cloudinary upload failed");
        }

        const venderh = new venders({ 
            id,
            image: imageResult.secure_url,
            imagePublicId: imageResult.public_id,
            Name,
            Price,
            Category,
            Description,
            vender: req.session.user._id
        });
        await venderh.save();
        // ✅ Redirect to /venders_list after successful addition
        return res.redirect('/vender/venders_list');

    
    } catch (err) {
        console.error("Error during vender upload:", err.message);
        return res.status(500).send("Internal server error: " + err.message);
    }
};

// Post edit vender

exports.Posteditvender = async (req, res) => {
    const { Name, Price, Category, Description, id: venderId } = req.body;
    const files = req.files;

    try {
        const vender = await venders.findById(venderId);
        if (!vender || vender.vender.toString() !== req.session.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized to edit this vender" });
        }

        // ✅ IMAGE update
        if (files?.image) {
            if (vender.imagePublicId) {
                await cloudinary.uploader.destroy(vender.imagePublicId).catch(err => {
                    console.warn("Error deleting old image:", err.message);
                });
            }

            const imageBuffer = files.image[0].buffer;
            const imageResult = await fileUploadInCloudinary(imageBuffer);

            if (!imageResult?.secure_url) {
                throw new Error("Image upload failed");
            }

            vender.image = imageResult.secure_url;
            vender.imagePublicId = imageResult.public_id;
        }


        // ✅ Update other fields
        vender.Name = Name;
        vender.Price = Price;
        vender.Category = Category;
        vender.Description = Description;

        await vender.save();
        // ✅ Redirect to /venders_list after successful addition
        return res.redirect('/vender/venders_list');

    } catch (error) {
        console.error("Error during vender update:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error: " + error.message });
    }
};

exports.deletevender = async (req, res, next) => {
  const venderId = req.params.venderId;

  try {
    const vender = await venders.findById(venderId);
    if (!vender) return res.status(404).send("Vendor not found");

    // 🔒 Authorization check
    if (vender.vender.toString() !== req.session.user._id.toString()) {
      return res.status(403).send('Unauthorized');
    }


    // ✅ Pull vendorId from all users' `booked` arrays
    await User.updateMany(
      { booked: venderId },
      { $pull: { booked: venderId } }
    );

    // ✅ Delete all Orders associated with this vendor
    await Order.deleteMany({ vender: venderId });

    // ✅ Delete vendor images from Cloudinary
    const cloudinaryDeletePromises = [];
    if (vender.imagePublicId)
      cloudinaryDeletePromises.push(cloudinary.uploader.destroy(vender.imagePublicId));
    await Promise.all(cloudinaryDeletePromises);

    // ✅ Finally, delete the vendor document
    await venders.findByIdAndDelete(venderId);

    res.redirect('/vender/venders_list');
  } catch (err) {
    console.log("Error deleting vendor:", err);
    res.redirect('/vender/venders_list');
  }
};

exports.getOrders = async (req, res, next) => {
  if (!req.isLogedIn || !req.session.user) return res.redirect('/login');

  try {
    // ✅ Get all listings created by this vendor user
    const allVenders = await venders.find({ vender: req.session.user._id });
    const isVender = allVenders.length > 0;

    if (!isVender) {
      return res.render('./admin/orders', {
        title: "Orders",
        isLogedIn: req.isLogedIn,
        user: req.session.user,
        orders: [],
        currentPage: 'orders',
        isVender
      });
    }

    // ✅ Get all orders where 'vender' is one of this user's listings
    const venderIds = allVenders.map(v => v._id);
    const orders = await Order.find({ vender: { $in: venderIds } })
      .populate('guest')
      .populate('vender');

    // ✅ Render once
    res.render('./admin/orders', {
      title: "Orders",
      isLogedIn: req.isLogedIn,
      user: req.session.user,
      orders,
      currentPage: 'orders',
      isVender
    });

  } catch (err) {
    console.error('Error fetching vendor orders:', err);
    req.flash('error', 'Could not load orders');
    res.redirect('back');
  }
};
