const { check,body, validationResult } = require("express-validator");
const User = require("../models/user");
const vender = require("../models/venders");
const Orders = require("../models/orders");
const bcrypt = require("bcryptjs");
const cloudinary = require('cloudinary').v2;
const { fileUploadInCloudinary } = require('../utils/cloudinary');
exports.LoginPage = (req, res, next) => {
    // registervenders ka variable me, find() ko call karenge
    const { email, password } = req.body;
    res.render('./store/logIn', {
        title: "Log Page",
        currentPage: 'logIn',
        isLogedIn: req.isLogedIn,
        oldInput: { email, password },
        errorMessage: [],
        user: req.session.user,
    })

}
exports.PostLogin = async (req, res, next) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email })
    if (!user) {
        return res.status(422).render('./store/logIn', {
            title: "Login Page",
            isLogedIn: false,
            currentPage: 'logIn',
            errorMessage: ['Incorrect email or password'],
            oldInput: { email },
            user: {}
        })
    }
    const isMatched = await bcrypt.compare(password, user.password)
    if (!isMatched) {
        return res.status(422).render('./store/logIn', {
            title: "Login Page",
            isLogedIn: false,
            currentPage: 'logIn',
            errorMessage: ['Incorrect email or password'],
            oldInput: { email },
            user: {}
        })
    }
    req.session.isLogedIn = true;
    req.session.user = user;
    await req.session.save();
    if (user.userType === 'vender') {
        return res.redirect('/vender/venders_list')
    }
    res.redirect('/')
}
exports.PostLogout = (req, res, next) => {
    req.session.destroy(() => {
        res.redirect('/logIn')
    })

}
// we can make middleware in array format also....
exports.postSignUpPage = [
  // ✅ Validations
  check('firstName')
    .notEmpty().withMessage("First name should not be empty")
    .trim().isLength({ min: 2 }).withMessage("Name should be greater than 1 character")
    .matches(/^[a-zA-Z]+$/).withMessage("Should be correct name"),

  check('lastName')
    .trim()
    .matches(/^[a-zA-Z]*$/).withMessage("Should be correct name"),

  check('email')
    .isEmail().withMessage("Email should be in email format")
    .normalizeEmail(),

  check('password')
    .isLength({ min: 6 }).withMessage("The password must be at least 6 characters")
    .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase character")
    .matches(/[0-9]/).withMessage("Password must contain at least one number")
    .trim(),

  check('confirmPassword')
    .trim()
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),

  check('userType')
    .isIn(['guest', 'vender']).withMessage("Please select a valid user type"),

  // ✅ Conditional location validation (only if userType is 'vender')
  body('location')
    .if(body('userType').equals('vender'))
    .notEmpty().withMessage("Location is required for vendors")
    .isLength({ min: 2 }).withMessage("Location should be at least 2 characters long")
    .matches(/^[a-zA-Z\s]+$/).withMessage("Location should only contain letters and spaces"),

  // ✅ Terms required
  check('terms')
    .custom(value => {
      if (value !== 'on') {
        throw new Error("Please accept the terms and conditions");
      }
      return true;
    }),

  // ✅ Handler
  async (req, res) => {
    const { firstName, lastName, email, location, password, userType, canteenName } = req.body;
    const editing = req.query.editing === 'true';
    const errors = validationResult(req);

    const oldInput = {
      firstName,
      lastName,
      email,
      location,
      password,
      userType,
      canteenName
    };

    if (!errors.isEmpty()) {
      return res.status(422).render('store/signup', {
        title: "Sign-Up",
        isLogedIn: false,
        errorMessage: errors.array().map(err => err.msg),
        oldInput,
        editing,
        user: {}
      });
    }

    try {
      const files = req.files;
      let profilePictureUrl = '';
      let profilePicturePublicId = '';

      if (files?.profilePicture && files.profilePicture.length > 0) {
        const profilePictureBuffer = files.profilePicture[0].buffer;
        const profilePictureResult = await fileUploadInCloudinary(profilePictureBuffer);

        if (!profilePictureResult?.secure_url) {
          throw new Error("Cloudinary upload failed");
        }

        profilePictureUrl = profilePictureResult.secure_url;
        profilePicturePublicId = profilePictureResult.public_id;
      }

      const hashedPassword = await bcrypt.hash(password, 8);

      const newUser = new User({
        profilePicture: profilePictureUrl,
        profilePicturePublicId: profilePicturePublicId,
        firstName,
        lastName,
        email,
        location: userType === 'vender' ? location : '',
        password: hashedPassword,
        userType,
        canteenName: userType === 'vender' ? canteenName : ''
      });

      const user = await newUser.save();

      req.session.isLogedIn = true;
      req.session.user = user;
      await req.session.save();

      res.redirect('/');
    } catch (err) {
      console.log("Signup Error:", err.message);
      return res.status(422).render('store/signup', {
        title: "Sign-Up",
        isLogedIn: false,
        errorMessage: [err.message],
        oldInput,
        editing,
        user: {}
      });
    }
  }
];



// GET the edit profile form
exports.getEditPage = async (req, res) => {

    const editing = req.query.editing === 'true';
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).send('User not found');

        res.render('./store/signup', { 
            user,
            editing: editing, 
            title: "Edit Profile", 
            isLogedIn: req.isLogedIn, 
            oldInput: { 
                firstName: user.firstName, 
                lastName: user.lastName,
                email: user.email ,
                location:user.location
            } 
        });
    } catch (err) {
        res.status(500).send('Error fetching user'); 
    }
};

// POST updated profile
exports.postEditPage = async (req, res) => {
  const { firstName, lastName, email,location, id } = req.body;
  const files = req.files;

  try {
    const user = await User.findById(id);
    if (!user) {
      console.error("❌ User not found");
      return res.status(404).send("User not found");
    }

    // ✅ IMAGE update
    if (files?.profilePicture) {
      if (user.profilePicturePublicId) {
        await cloudinary.uploader.destroy(user.profilePicturePublicId).catch(err => {
          console.warn("Error deleting old image:", err.message);
        });
      }

      const imageBuffer = files.profilePicture[0].buffer;
      const imageResult = await fileUploadInCloudinary(imageBuffer);

      if (!imageResult?.secure_url) {
        throw new Error("Image upload failed");
      }

      user.profilePicture = imageResult.secure_url;
      user.profilePicturePublicId = imageResult.public_id;
    }

    // ✅ Update other fields
    user.firstName = firstName;
    user.lastName = lastName;
    user.email = email;
    user.location=location;

    await user.save();

    res.redirect('/');
  } catch (err) {
  console.error('❌ Error updating user:', err);
  res.status(500).send('Error updating user: ' + err.message);
}
};

exports.getSignUpPage = (req, res, next) => {
    const editing = req.query.editing === 'true';
    const { firstName, lastName, email,location, password, userType } = req.body;


    res.render('./store/signup', {
        title: "Sign-UP Page",
        isLogedIn: req.isLogedIn,
        oldInput: {
            firstName,
            lastName,
            email,
            location,
            password,
            userType
        },
        editing
    });
};

exports.deleteUserPage = async (req, res) => {
    const userId = req.params.id;
    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).send('User not found');
        const { email, password } = req.body;

        res.render('./store/delete', {
            title: "Delete Page",
            isLogedIn: req.isLogedIn,
            oldInput: { email, password },
            errorMessage: [],
            user: req.session.user,
        });
    } catch (err) {
        res.status(500).send('Error fetching user');
    }
};
exports.deleteUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send('User not found');

    const isMatched = await bcrypt.compare(password, user.password);
    if (!isMatched) {
      return res.status(401).render('./store/delete', {
        title: "Delete Page",
        isLogedIn: false,
        errorMessage: ['Incorrect password'],
        oldInput: { email },
        user: req.session.user
      });
    }

    // ✅ Delete all related vendors and their data
    const userVenders = await vender.find({ vender: user._id });
    for (const v of userVenders) {
      const promises = [];

      if (v.imagePublicId) promises.push(cloudinary.uploader.destroy(v.imagePublicId));
      if (v.MenuimagePublicId) promises.push(cloudinary.uploader.destroy(v.MenuimagePublicId));
      await Promise.all(promises);

      await Orders.deleteMany({ vender: v._id });

      await vender.findByIdAndDelete(v._id);
    }

    // ✅ Clean up guest & user-related data
    await User.updateMany({}, { $pull: { booked: { $in: userVenders.map(v => v._id) } } });
    await Orders.deleteMany({ guest: user._id });

    // ✅ Delete user's profile image if present
    if (user.profilePicturePublicId) {
      await cloudinary.uploader.destroy(user.profilePicturePublicId).catch(err =>
        console.warn('Error deleting profile image:', err.message)
      );
    }

    // ✅ Finally delete the user
    await User.findByIdAndDelete(user._id);

    // ✅ Clear session AFTER deletion
    if (req.session.user && req.session.user._id.toString() === user._id.toString()) {
      req.session.destroy(err => {
        if (err) {
          console.error('❌ Session destruction error:', err);
          return res.redirect('/');
        }
        return res.redirect('/logIn');
      });
    } else {
      return res.redirect('/');
    }

  } catch (err) {
    console.error('❌ Delete Error:', err);
    return res.status(500).send('Error deleting user');
  }
};
