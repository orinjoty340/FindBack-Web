const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function testEmail() {
  try {
    await transporter.verify();
    console.log('Gmail SMTP connection successful!');

    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'FindBack Email Test',
      text: 'Congratulations! FindBack email configuration is working.',
    });

    console.log('Email sent successfully:', info.messageId);
  } catch (error) {
    console.error('Email Error:', error);
  }
}

testEmail();