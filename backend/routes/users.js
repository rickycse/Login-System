console.clear();

// To create a route, we need the Router.
const router = require('express').Router();
const Reset = require('../schemas/resetModel');
const User = require('../schemas/userModels');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

require('dotenv').config();
const GMAIL = process.env.EMAIL_USER;
const PASS = process.env.EMAIL_PASS;

const mailFunction = (email, token) => {
    const mailOptions = {
        from: GMAIL,
        to: email,
        subject: 'Password Reset',
        html: `
            <p>You have requested to reset your password. Please follow the link below to reset your password:</p>
            <a href="http://localhost:5000/reset-password/${token}">Reset Password</a>
            `
    }
    return mailOptions;
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: GMAIL,
        pass: PASS,
    }
})

// First endpoint (root) to handle GET requests
// Will be seen as localhost:5000/users/
router.route('/').get((req, res) => {
    // Find all the Users in MongoDB
    User.find()
        // Return the Users in the DB.
        .then(users => res.json(users))
        .catch(err => res.status(400).json('Error: ' + err));
});

// Adding a new user to the DB with a POST request.
router.route('/register').post((req, res) => {
    // Creates the new User
    const newUser = new User({
        username: req.body.username,
        email: req.body.email,
        password: req.body.password,
    });
    // Saves it to the DB.
    newUser.save()
        .then(() => res.json('User registered!'))
        .catch(err => res.status(400).json('Error ' + err));
});

router.route('/login').post( async (req, res) => {
    const user = await User.findOne({
        email: req.body.email,
        password: req.body.password,
    })
    if (user) {
        return res.json({status: 'Success', user: true})
    } else {
        return res.json({status: 'Error', user: false})
    }
});

router.route('/:id').get((req, res) => {
    User.findById(req.params.id)
        .then(users => res.json(users))
        .catch(err => res.status(400).json('Error: ' + err));
});

router.route('/:id').delete((req, res) => {
    User.findByIdAndDelete(req.params.id)
    .then(() => res.json('User deleted'))
    .catch(err => res.status(400).json('Error ' + err));
});

router.route('/forgot-password').post( async(req, res) => {
    const email = req.body.email;
    // Find if the user exists via email search in MongoDB.
    let user = User.findOne({
        email: email,
    })
    if (user){
        // Create the unique token
        const buffer = await crypto.randomBytes(32);
        const token = buffer.toString('hex');
        // New document for reset
        const resetToken = new Reset({
            token: token,
            expiry: Date.now() + 3600000, // 1 hour expiry
        });
        // Save the reset token into DB.
        resetToken.save()
            .then(() => {
                // Send the email for reset
                res.status(200).json('Reset token added!')
                const mail = mailFunction(email, token);
                transporter.sendMail(mail, (error, info) => {
                    if(error) {
                        console.log(error);
                    } else {
                        console.log('Email sent: ' + info.response);
                    }
                });
            })
            .catch(err => res.status(400).json('Error ' + err));
    } else {
        return res.status(400).json({ error: 'Invalid user' });
    }
});

router.route('/reset-password/:token').post( async(req, res) => {
    const token = req.body.token;
    const reset = await Reset.findOne({
        token: token,
        expiry: { $gt: Date.now() } // ensures the expiry date is still ahead of the current date
    });
    if(reset){
        res.render('reset-password', { token });
    } else {
        return res.status(400).json({error: 'Invalid or expired token'})
    }
});

module.exports = router;