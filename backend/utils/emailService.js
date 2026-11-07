
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async ({ to, subject, text }) => {
  if (!to || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('Email configuration or recipient missing');
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: `"FindBack" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    });

    console.log('FindBack email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error.message);
    return false;
  }
};

module.exports = { sendEmail };
