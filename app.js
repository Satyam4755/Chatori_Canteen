require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const app = express();
const flash = require('connect-flash');

app.use(flash());

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routers wala part
const userRouter = require('./routes/user');
const authRouter = require('./routes/auth');
const { venderRouter } = require('./routes/vender');

// Middleware imports wala part
const createSession = require('./middleware/session');
const loginFlag = require('./middleware/loginFlag');
const protectUserRoutes = require('./middleware/protectUserRoutes');
const protectvenderRoutes = require('./middleware/protectvenderRoutes');

// Env variables...
const dbPath = process.env.MONGO_URI;
const sessionSecret = process.env.SESSION_SECRET;
const PORT = process.env.PORT || 3407;

// Middleware usage:-
app.use(createSession(dbPath, sessionSecret));
app.use(loginFlag);
app.use(express.static(path.join(__dirname, 'public')));

// Protected user routes
const chekingRoutes = [
    '/user/favourite_list',
    '/user/booked',
    '/user/booking/:venderId',
    '/user/submit_booking'
];
app.use(chekingRoutes, protectUserRoutes);

// Routes
app.use(userRouter);
app.use(authRouter);

// Protected vender routes
app.use('/vender', protectvenderRoutes, venderRouter);

// View engine
app.set('view engine', 'ejs');
app.set('views', 'views');

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', { title: "error", isLogedIn: req.isLogedIn });
});

// DB connection
mongoose.connect(dbPath).then(async () => {
    console.log('Connected to MongoDB');

    // TTL for sessions
    try {
        await mongoose.connection.db.collection('sessions').createIndex(
            { expiresAt: 1 },
            { expireAfterSeconds: 0 }
        );
        console.log('TTL index ensured on sessions collection.');
    } catch (err) {
        console.error('Error creating TTL index for sessions:', err);
    }

    // Start the server
    app.listen(PORT, () => {
        console.log(`Server started at port ${PORT}`);
    });
});
