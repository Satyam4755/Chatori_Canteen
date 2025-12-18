const { check, validationResult } = require("express-validator");
const venders = require('../models/venders');
const User = require('../models/user');
const Order = require('../models/orders');
exports.homePage = async (req, res, next) => {
  const locationQuery = req.query.location || '';
  const categoryQuery = req.query.category || '';
  let registervenders = [];
  let user = null;
  let showOptions = false;

  try {
    // Step 1: Find users in the given location
    let userIdsFromLocation = [];
    if (locationQuery.trim()) {
      const usersInLocation = await User.find({
        location: { $regex: locationQuery, $options: 'i' }
      }).select('_id');
      userIdsFromLocation = usersInLocation.map(u => u._id.toString());
    }

    // Step 2: Prepare filters for vender search
    const filters = {};
    if (categoryQuery.trim()) {
      filters.Category = { $regex: categoryQuery, $options: 'i' };
    }
    if (userIdsFromLocation.length > 0) {
      filters.vender = { $in: userIdsFromLocation };
    }

    // Step 3: Fetch venders and populate canteenName and location from User
    registervenders = Object.keys(filters).length > 0
      ? await venders.find(filters).populate('vender', 'canteenName location')
      : await venders.find().populate('vender', 'canteenName location');

    // Step 4: Check user session (no opacity logic now)
    if (req.isLogedIn && req.session.user) {
      user = await User.findById(req.session.user._id);
      if (user.userType === 'guest') {
        showOptions = true;
      }
    }

    // Step 5: Calculate average ratings
    for (const vender of registervenders) {
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

    // Step 6: Get unique categories and locations
    const uniqueCategories = await venders.distinct("Category");
    const uniqueLocations = await User.distinct("location");

    // Step 7: Render home page
    res.render('./store/home', {
      venders: registervenders,
      title: "Chatori-Canteen",
      opacity: {}, // No opacity now
      currentPage: 'home',
      isLogedIn: req.isLogedIn,
      user: user || null,
      showOptions,
      searchLocation: locationQuery,
      selectedCategory: categoryQuery,
      availableCategories: uniqueCategories,
      availableLocations: uniqueLocations
    });

  } catch (err) {
    console.error("Error in homePage:", err);
    res.status(500).send("Internal Server Error");
  }
};

exports.venderOwner = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const searchDish = req.query.dish || '';
    let opacity = {};

    // Get all vendors added by the selected user
    let allVenders = await venders.find({ vender: userId }).populate('reviews');

    // Optional filtering by dish name
    if (searchDish.trim()) {
      const lowerCaseSearch = searchDish.toLowerCase();
      allVenders = allVenders.filter(v => v.Name.toLowerCase().includes(lowerCaseSearch));
    }

    // ✅ Calculate averageRating for each vendor
    allVenders.forEach(v => {
      if (v.reviews && v.reviews.length > 0) {
        const validRatings = v.reviews.filter(r => typeof r.rating === 'number' && !isNaN(r.rating));
        if (validRatings.length > 0) {
          const total = validRatings.reduce((sum, review) => sum + review.rating, 0);
          v.averageRating = parseFloat((total / validRatings.length).toFixed(1));
        } else {
          v.averageRating = 0;
        }
      } else {
        v.averageRating = 0;
      }
    });

    // Fetch the owner/vendor user
    const owner = await User.findById(userId);

    // Fetch current logged-in user from session (if any)
    let currentUser = null;
    let showOptions = false;
    if (req.isLogedIn && req.session.user) {
      currentUser = await User.findById(req.session.user._id);
      if (currentUser && currentUser.userType === 'guest') {
        showOptions = true;

        // ✅ Opacity logic for favorites
        const favIds = currentUser.favourites.map(fav => fav.toString());
        allVenders.forEach(vender => {
          opacity[vender._id.toString()] = favIds.includes(vender._id.toString()) ? 10 : 0;
        });
      }
    }

    // Fallback if user not logged in or not guest
    allVenders.forEach(vender => {
      if (!(vender._id.toString() in opacity)) {
        opacity[vender._id.toString()] = 0;
      }
    });

    // Get all unique dishes
    const uniqueDishes = await venders.distinct("Name");

    res.render('./store/restaurant', {
      venders: allVenders,
      owner: owner || null,
      ownerName: owner?.canteenName || owner?.name || 'Vendor Owner',
      ownerLocation: owner?.location || 'Unknown Location',
      searchDish,
      title: "Vendor Owner Page",
      isLogedIn: req.isLogedIn || false,
      user: currentUser || null,
      showOptions,
      availabledishes: uniqueDishes,
      opacity
    });

  } catch (error) {
    console.error('Error loading vendor owner page:', error);
    res.status(500).send('Internal Server Error');
  }
};
// vender DETAILS
exports.venderDetails = async (req, res, next) => {

  if (!req.isLogedIn || !req.session.user) return res.redirect('/login');
  const venderId = req.params.venderId;
 
  const vender = await venders.findById(venderId)
    .populate('vender')
    .populate('reviews.user');

  if (!vender) return res.redirect('/user/vender-list');

  // ✅ Calculate average rating from reviews
  let averageRating = 0;
  const validRatings = vender.reviews.filter(r => typeof r.rating === 'number' && !isNaN(r.rating));
  if (validRatings.length > 0) {
    const total = validRatings.reduce((sum, review) => sum + review.rating, 0);
    averageRating = parseFloat((total / validRatings.length).toFixed(1));
  }

  const numberOfOrders = vender.orders || 0;
  let showOptions = false;
  let opacity = {};

  if (req.isLogedIn && req.session.user) {
    const user = await User.findById(req.session.user._id);

    if (user.userType === 'guest') {
      showOptions = true;
      const isFavourite = user.favourites.map(id => id.toString()).includes(vender._id.toString());
      opacity[vender._id.toString()] = isFavourite ? 10 : 0;
    } else {
      opacity[vender._id.toString()] = 0;
    }
  } else {
    opacity[vender._id.toString()] = 0;
  }

  res.render('./store/details', {
    vender,
    title: "Item Details",
    opacity,
    isLogedIn: req.isLogedIn,
    user: req.session.user || null,
    showOptions,
    numberOfOrders,
    messages: req.flash(),
    reviews: vender.reviews || [],
    averageRating, // ✅ Pass to EJS
  });
};

// FAVOURITE LIST
exports.favouriteList = async (req, res, next) => {
  if (!req.isLogedIn || !req.session.user) return res.redirect('/login');

  const user = await User.findById(req.session.user._id).populate('favourites');
  const favouriteVendors = user.favourites;

  // Add average rating to each favourite vendor
  for (const vender of favouriteVendors) {
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

  res.render('./store/favourite_list', {
    venders: favouriteVendors,
    title: "favourite list",
    currentPage: 'favourite',
    isLogedIn: req.isLogedIn,
    user: req.session.user,
    messages: req.flash(),
  });
};

// ADD / REMOVE FAVOURITE
exports.postfavouriteList = async (req, res, next) => {
    if (!req.isLogedIn || !req.session.user) return res.redirect('/login');

    const Id = req.body.venderId;
    const user = await User.findById(req.session.user._id);

    if (!user.favourites.includes(Id)) {
        user.favourites.push(Id);
    } else {
        user.favourites.pull(Id); 
    }

    await user.save();
    res.redirect('/user/favourite_list');
};

// UNFAVOURITE FROM FAV PAGE
exports.postUnfavourite = async (req, res, next) => {
    if (!req.isLogedIn || !req.session.user) return res.redirect('/login');

    const venderId = req.params.venderId;
    const user = await User.findById(req.session.user._id);

    user.favourites.pull(venderId);
    await user.save();
    req.flash('success', 'Vendor removed from favourites successfully!');
    res.redirect('/user/favourite_list');
};

// BOOKING PAGE
exports.booking = async (req, res, next) => {
  const venderId = req.params.venderId;

  try {
    const vender = await venders.findById(venderId).populate('vender','location');
    if (!vender) {
      return res.redirect('/user/vender-list');
    }

    // Add average rating
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

    res.render('./store/booking', {
      vender: vender,
      title: "booking",
      isLogedIn: req.isLogedIn,
      currentPage: '',
      user: req.session.user || null,
    });

  } catch (err) {
    console.error('Error loading booking page:', err);
    res.redirect('/user/vender-list');
  }
};

// POST BOOKING
exports.Postbooking = [
  check('phone')
    .isNumeric()
    .withMessage('Phone number should be numeric')
    .isLength({ min: 10, max: 10 })
    .withMessage('Phone number should be 10 digits long'),

  async (req, res, next) => {
    if (!req.isLogedIn || !req.session.user) return res.redirect('/login');

    const venderId = req.params.venderId;
    const {
      name,
      phone,
      payment,
      totalAmount,
      address,
    } = req.body;

    try {
      const guestUser = await User.findById(req.session.user._id);
      const Selectedvender = await venders.findById(venderId).populate('vender');
      const venderOwner = Selectedvender?.vender;

      if (!Selectedvender || !venderOwner) {
        req.flash('error', 'Vendor not found');
        return res.redirect('back');
      }

      // ✅ Address location match check
      const vendorLocation = venderOwner.location?.toLowerCase() || '';
      if (!address.toLowerCase().split(/\s+/).some(word => vendorLocation.split(/\s+/).includes(word))) {
        req.flash(
          'error',
          `We currently only serve in: "${venderOwner.location}"`
        );
        return res.redirect('back');
      }

      // ✅ Set expireAt to 1 day later
      const currentDate = new Date(); // 👈 this is your order date
      const expireAt = new Date(currentDate);
      expireAt.setDate(currentDate.getDate() + 1);

      // ✅ Create new order
      const newOrder = new Order({
        guest: guestUser._id,
        vender: Selectedvender._id,
        name,
        phone,
        address,
        payment,
        totalAmount,
        expireAt: expireAt,
      });

      await newOrder.save();

      // ✅ Increment order count
      await venders.findByIdAndUpdate(venderId, { $inc: { orders: 1 } });

      // ✅ Add to user's booked list if not already added
      if (!guestUser.booked.includes(venderId)) {
        guestUser.booked.push(venderId);
        await guestUser.save();
      }

      res.redirect('/user/submit_booking');
    } catch (err) {
      console.error('❌ Booking Error:', err);
      req.flash('error', 'Something went wrong during booking');
      res.redirect('back');
    }
  }
];

// SUBMIT BOOKING PAGE
exports.submitBooking = (req, res, next) => {
    if (!req.isLogedIn || !req.session.user) return res.redirect('/login');

    res.render('./store/submitBooking', {
        title: "submit booking",
        isLogedIn: req.isLogedIn,
        user: req.session.user
    });
};

// booked LIST

exports.booked = async (req, res, next) => {
  if (!req.isLogedIn || !req.session.user) return res.redirect('/login');

  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId).populate('booked');

    const validBookedVendors = [];

    for (const vendor of user.booked) {
      const existingOrder = await Order.findOne({
        guest: userId,
        vender: vendor._id
      });

      if (existingOrder) {
        // Add average rating
        if (vendor.reviews && vendor.reviews.length > 0) {
          const validRatings = vendor.reviews.filter(r => typeof r.rating === 'number' && !isNaN(r.rating));
          if (validRatings.length > 0) {
            const total = validRatings.reduce((sum, review) => sum + review.rating, 0);
            vendor.averageRating = parseFloat((total / validRatings.length).toFixed(1));
          } else {
            vendor.averageRating = 0;
          }
        } else {
          vendor.averageRating = 0;
        }

        validBookedVendors.push(vendor);
      } else {
        await User.findByIdAndUpdate(userId, {
          $pull: { booked: vendor._id }
        });
      }
    }

    res.render('./store/booked', {
      venders: validBookedVendors,
      title: "Booked Vendor List",
      currentPage: 'reserve',
      isLogedIn: req.isLogedIn,
      user: req.session.user,
      messages: req.flash(),
    });

  } catch (err) {
    console.error('Error loading booked vendors:', err);
    req.flash('error', 'Could not load your booked vendors');
    res.redirect('back');
  }
};

// POST CANCEL BOOKING
exports.postCancelBooking = async (req, res, next) => {
  if (!req.isLogedIn || !req.session.user) return res.redirect('/login');

  const venderId = req.params.venderId;

  try {
    const userId = req.session.user._id;

    // ✅ Remove vendor from user's booked list
    await User.findByIdAndUpdate(userId, {
      $pull: { booked: venderId }
    });

    // ✅ Fetch the vendor document
    const venderh = await venders.findById(venderId);
    if (!venderh) {
      req.flash('error', 'Vendor not found');
      return res.redirect('/user/booked');
    }

    // ✅ Delete the related order from Order collection
    await Order.deleteOne({
      guest: userId,
      vender: venderId
    });

    req.flash('success', 'Booking cancelled!');
    res.redirect('/user/booked');

  } catch (err) {
    console.error('Cancel booking error:', err);
    req.flash('error', 'Something went wrong during cancellation');
    res.redirect('/user/booked');
  }
};

exports.postvenderDetails = async (req, res, next) => {
  if (!req.isLogedIn || !req.session.user) return res.redirect('/login');

  try {
    const user = await User.findById(req.session.user._id);
    const { venderId } = req.params;
    const { Review, Rating } = req.body;

    const vendor = await venders.findById(venderId);
    if (!vendor) {
      req.flash('error', 'Invalid vendor.');
      return res.redirect('/user/vender-list');
    }
    vendor.reviews.push({
      user: user._id,
      rating: parseInt(Rating, 10),
      comment: Review
    });
    await vendor.save();
    console.log(vendor);
    req.flash('success', 'Review submitted successfully!');
    res.redirect('/user/vender-list/' + venderId); // ✅ Remove the colon (:) before the ID
  } catch (err) {
    console.error('Error fetching vendor details:', err);
    req.flash('error', 'Could not load vendor details');
    res.redirect(req.get('Referrer') || '/');
  }
};


exports.postDeleteReview = async (req, res, next) => {
  if (!req.isLogedIn || !req.session.user) return res.redirect('/login');

  const { venderId } = req.params;
  const { reviewId } = req.body;

  try {
    const vendor = await venders.findById(venderId);
    if (!vendor) {
      req.flash('error', 'Vendor not found.');
      return res.redirect('/user/vender-list');
    }

    const review = vendor.reviews.find(
      (rev) => rev._id.toString() === reviewId && rev.user.toString() === req.session.user._id.toString()
    );

    if (!review) {
      req.flash('error', 'Unauthorized or review not found.');
      return res.redirect('/user/vender-list/' + venderId);
    }

    // Filter out the review from the reviews array
    vendor.reviews = vendor.reviews.filter(
      (rev) => rev._id.toString() !== reviewId
    );

    await vendor.save();

    req.flash('success', 'Your review has been deleted successfully.');
    res.redirect('/user/vender-list/' + venderId);
  } catch (err) {
    console.error('Error deleting review:', err);
    req.flash('error', 'An error occurred while deleting the review.');
    res.redirect('/user/vender-list/' + venderId);
  }
};


// ✅ Controller: postHomePage
exports.postHomePage = async (req, res, next) => {
  if (!req.isLogedIn || !req.session.user) return res.redirect('/login');

  const userId = req.session.user._id;
  const themeValue = req.body.theme === 'true'; // convert to boolean

  try {
    await User.findByIdAndUpdate(userId, { theme: themeValue });
    req.session.user.theme = themeValue; // update session also
    res.redirect('/');
  } catch (err) {
    console.error('Theme update failed:', err);
    res.status(500).send('Internal Server Error');
  }
};
