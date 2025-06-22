const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "ecah120715@gmail.com",     
    pass: "rkbc nnsf aulu mvlm"           
  }
});

async function sendEmail(to, subject, html) {
  const mailOptions = {
    from: "Booking System <ecah120715@gmail.com>",
    to,
    subject,
    html
  };

  await transporter.sendMail(mailOptions);
}

module.exports = sendEmail;
