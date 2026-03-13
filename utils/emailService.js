const nodemailer = require('nodemailer');

const sendOTP = async (email, otp) => {
    // Create transporter fresh each call so env vars are always loaded
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS,
        },
    });

    // Verify connection before sending
    await transporter.verify();

    const mailOptions = {
        from: `"DermaScope" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'DermaScope - Email Verification Code',
        text: `Your OTP verification code is: ${otp}\n\nThis code will expire in 5 minutes.\n\nIf you did not request this, please ignore this email.`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 400px; margin: auto;">
                <h2 style="color: #22B2A6;">DermaScope Verification</h2>
                <p>Your one-time verification code is:</p>
                <h1 style="letter-spacing: 8px; color: #333;">${otp}</h1>
                <p style="color: #999;">This code expires in <strong>5 minutes</strong>.</p>
                <p style="color: #bbb; font-size: 12px;">If you did not request this, please ignore this email.</p>
            </div>
        `,
    };

    return await transporter.sendMail(mailOptions);
};

const sendPasswordResetOTP = async (email, otp) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS,
        },
    });
    await transporter.verify();
    const mailOptions = {
        from: `"DermaScope" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'DermaScope - Password Reset Code',
        text: `Your password reset code is: ${otp}\n\nThis code will expire in 5 minutes.\n\nIf you did not request this, please ignore this email.`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 400px; margin: auto;">
                <h2 style="color: #22B2A6;">DermaScope Password Reset</h2>
                <p>Your one-time password reset code is:</p>
                <h1 style="letter-spacing: 8px; color: #333;">${otp}</h1>
                <p style="color: #999;">This code expires in <strong>5 minutes</strong>.</p>
                <p style="color: #bbb; font-size: 12px;">If you did not request this, please ignore this email.</p>
            </div>
        `,
    };
    return await transporter.sendMail(mailOptions);
};

const sendChangePasswordOTP = async (email, otp) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS,
        },
    });
    await transporter.verify();
    const mailOptions = {
        from: `"DermaScope" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'DermaScope - Change Password Verification Code',
        text: `Your change password code is: ${otp}\n\nThis code will expire in 5 minutes.\n\nIf you did not request this, please ignore this email.`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 400px; margin: auto;">
                <h2 style="color: #22B2A6;">DermaScope Change Password</h2>
                <p>Your verification code is:</p>
                <h1 style="letter-spacing: 8px; color: #333;">${otp}</h1>
                <p style="color: #999;">This code expires in <strong>5 minutes</strong>.</p>
                <p style="color: #bbb; font-size: 12px;">If you did not request this, please ignore this email.</p>
            </div>
        `,
    };
    return await transporter.sendMail(mailOptions);
};

module.exports = { sendOTP, sendPasswordResetOTP, sendChangePasswordOTP };
