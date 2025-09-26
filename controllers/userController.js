const userModel = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  signUpTemplate,
  verificationTemplate,
  resetPasswordTemplate,
} = require("../utils/emailTemplate");
const emailSender = require("../middleware/nodemailer");

exports.signUp = async (req, res) => {
  try {
    const { firstname, lastname, email, password } = req.body;
    const userExists = await userModel.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({
        message: "User already exists",
      });
    }
    //Encrypt the user's password
    const saltedRounds = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, saltedRounds);

    //Instantiate the user model
    const user = new userModel({
      firstname,
      lastname,
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    //Saving the user object
    await user.save();

    //Generate a token for the user
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const link = `${req.protocol}://${req.get("host")}/users/verify/${token}`;
    console.log("link: ", link);

    //Email options for sending email
    const emailOption = {
      email: user.email,
      subject: "Graduation Note",
      html: signUpTemplate(link, user.firstname),
    };

    //send the email to the user
    await emailSender(emailOption);
    //Send a success response
    return res.status(201).json({
      message: "User registered successfully",
      data: user,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

exports.verifyUser = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({
        message: "Token not found",
      });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(decoded.id);
    if (!user) {
      return res.status(400).json({
        message: "User not found",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        message: "User already verified, please proceed to login",
      });
    }

    user.isVerified = true;
    await user.save();

    res.status(200).json({
      message: "User verified successfully",
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(500).json({
        message: "Session expired, please resend verification",
      });
    }
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }
    //Throw a response if the user has been verified already
    if (user.isVerified) {
      return res.status(400).json({
        message: "User already verified. Please proceed to login",
      });
    }
    //Generate a new token and a new link
    const token = jwt.sign(
      {
        email: email.toLowerCase(),
        id: user._id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "30 mins" }
    );
    const link = `${req.protocol}://${req.get("host")}/users/verify/${token}`;
    //Create the options for the email sender
    const options = {
      email: user.email,
      subject: "Verification Email",
      html: verificationTemplate(link, user.firstname),
    };
    //Send the email to the user
    await emailSender(options);
    //Send a success response
    return res.status(200).json({
      message:
        "Verification email sent successfully, please check your email to verify",
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    //Extract the required fields
    const { email, password } = req.body;
    //Find the user with the email and check is the user exists
    const user = await userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }
    //Check if the password is correct
    const passwordCorrect = await bcrypt.compare(password, user.password);
    if (!passwordCorrect) {
      return res.status(400).json({
        message: "Incorrect Password",
      });
    }

    if (user.isVerified === false) {
      return res.status(401).json({
        message:
          "User not verified, please check your email for verification link",
      });
    }
    //Generate a token for the user
    const token = jwt.sign(
      {
        email: user.email,
        id: user._id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1hr" }
    );

    //Send a success response
    res.status(200).json({
      message: "Login successful",
      data: user,
      token,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    //Extract the user's email from the request body
    const { email } = req.body;
    //Find the user with the email and check if they exists
    const user = await userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({
        message: "User not found",
      });
    }
    //Generate a token
    const token = jwt.sign(
      {
        email: user.email,
        id: user._id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "10 mins" }
    );
    const link = `${req.protocol}://${req.get(
      "host"
    )}/users/reset/password/${token}`;

    //Create email options
    const options = {
      email: user.email,
      subject: "Reset Password",
      html: resetPasswordTemplate(link, user.firstname),
    };
    await emailSender(options);

    //Send a success response
    res.status(200).json({
      message: "Reset password request is successful",
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    //Get token from the params
    const { token } = req.params;
    //Extract the passwords from the request body
    const { newPassword, confirmPassword } = req.body;
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "Password does not match",
      });
    }
    //Verify the token with JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    //Find the user decoded
    const user = await userModel.findById(decoded.id);
    //Check if the user is still in the database
    if (!user) {
      res.status(404).json({
        message: "User not found",
      });
    }
    //Encrypt the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    //Update the user's password to the new password
    user.password = hashedPassword;
    await user.save();
    //Send a success response
    res.status(200).json({
      message: "Password reset successful",
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(400).json({
        message: "Link expired, please request a new link",
      });
    }
    return res.status(500).json({
      message: error.message,
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    //Get token from the params
    const { token } = req.params;
    //Extract the old, new, and confirm password from the request body
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "New password and confirm password do not match",
      });
    }

    //Verify the token with JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    //Find the user decoded
    const user = await userModel.findById(decoded.id);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    //Compare old password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: "Incorrect old password",
      });
    }

    //Compare new and confirm password
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "Password mismatch",
      });
    }

    //Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    //Save the new password
    user.password = hashedPassword;
    await user.save();

    //Send a success response
    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(400).json({
        message: "Session expired, please login again",
      });
    }
    return res.status(500).json({
      message: error.message,
    });
  }
};

exports.getAll = async (req, res) => {
  try {
    const users = await userModel.find();
    res.status(200).json({
      message: `All users gotten successfully, the total is ${users.length}`,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

exports.changedPassword = async (req, res) => {
  try {
    //Get the user's ID
    const userId = req.user.id;
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "Password does not match",
      });
    }
    const passwordCorrect = await bcrypt.compare(oldPassword, user.password);
    if (!passwordCorrect) {
      return res.status(400).json({
        message: "Old Password Incorrect",
      });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      message: "Password changed successful",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
