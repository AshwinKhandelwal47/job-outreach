const express = require('express');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure file upload storage (in-memory for easy emailing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper to create Nodemailer transporter
function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error('Gmail credentials are missing. Please set GMAIL_USER and GMAIL_APP_PASSWORD in your .env file.');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: user.trim(),
      pass: pass.replace(/\s+/g, '') // remove any spaces in 16-char app password
    }
  });
}

const { extractContacts } = require('./excelExtractor');

// Endpoint to check configuration status
app.get('/api/status', (req, res) => {
  const user = process.env.GMAIL_USER;
  const hasPass = Boolean(process.env.GMAIL_APP_PASSWORD);
  res.json({
    configured: Boolean(user && hasPass),
    senderEmail: user || null
  });
});

// Endpoint to dynamically extract contacts from Excel
app.get('/api/contacts', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    const start = req.query.start ? parseInt(req.query.start, 10) : 1;
    const contacts = extractContacts({ start, limit });
    res.json({
      success: true,
      count: contacts.length,
      contacts
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint to get campaign schedule status
app.get('/api/campaign', (req, res) => {
  try {
    const planFile = path.join(__dirname, 'campaign_plan.json');
    if (fs.existsSync(planFile)) {
      const plan = JSON.parse(fs.readFileSync(planFile, 'utf-8'));
      return res.json({ success: true, plan });
    }
    return res.json({ success: true, plan: [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: Generate professional email body
function generateAutoEmail({ jobRole, companyName, recipientName }) {
  const company = companyName && companyName.trim() ? companyName.trim() : '[Company]';
  const role = jobRole && jobRole.trim() ? jobRole.trim() : 'SDE internship';
  const nameGreeting = recipientName && recipientName.trim() ? recipientName.trim() : 'there';

  const plainText = `Hi ${nameGreeting},

I'm Ashwin Khandelwal, a final-year Computer Science student at Delhi Technological University (CGPA 8.48), looking for an ${role} at ${company}.

I recently interned at JDMR iSchool pvt. ltd., where I built a multi-layer AI guardrail pipeline on AWS Bedrock for a school ERP assistant. Running a cheaper check ahead of the full policy pipeline cut guardrail costs by 62.5% on blocked requests and 37.5% on legitimate ones.

Some other end-to-end, deployed projects I've built:
- TrueDueAI: a RAG-based financial due diligence assistant(LangChain, ChromaDB) with a ReAct agent and automatic LLM failover
- Codeverse: a real-time collaborative code editor handling 500+ live edits per minute using sockets.io

I've also placed in the top positions at HackCBS 8.0, HackVSIT 6.0 and brAInwave, and solved 800+ problems on coding platforms like Codeforces, LeetCode and GeeksforGeeks.

Resume attached. Happy to chat if you're open to it.

Thanks,
Ashwin Khandelwal
+91 8595993411 | https://www.linkedin.com/in/ashwin-khandelwal-5496392a2 | https://www.github.com/AshwinKhandelwal47`;

  const html = `
    <div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #333333; max-width: 650px;">
      <p>Hi ${nameGreeting},</p>
      <p>
        I'm Ashwin Khandelwal, a final-year Computer Science student at Delhi Technological University (CGPA 8.48), looking for an ${role} at <strong>${company}</strong>.
      </p>
      <p>
        I recently interned at JDMR iSchool pvt. ltd., where I built a multi-layer AI guardrail pipeline on AWS Bedrock for a school ERP assistant. Running a cheaper check ahead of the full policy pipeline cut guardrail costs by 62.5% on blocked requests and 37.5% on legitimate ones.
      </p>
      <p style="margin-bottom: 6px;">Some other end-to-end, deployed projects I've built:</p>
      <ul style="padding-left: 20px; margin-top: 0; margin-bottom: 14px;">
        <li style="margin-bottom: 4px;"><strong>TrueDueAI:</strong> a RAG-based financial due diligence assistant (LangChain, ChromaDB) with a ReAct agent and automatic LLM failover</li>
        <li><strong>Codeverse:</strong> a real-time collaborative code editor handling 500+ live edits per minute using sockets.io</li>
      </ul>
      <p>
        I've also placed in the top positions at HackCBS 8.0, HackVSIT 6.0 and brAInwave, and solved 800+ problems on coding platforms like Codeforces, LeetCode and GeeksforGeeks.
      </p>
      <p>Resume attached. Happy to chat if you're open to it.</p>
      <br/>
      <p style="margin-bottom: 2px;">Thanks,<br/><strong>Ashwin Khandelwal</strong></p>
      <p style="font-size: 13.5px; color: #555555; margin-top: 4px;">
        +91 8595993411 | 
        <a href="https://www.linkedin.com/in/ashwin-khandelwal-5496392a2" style="color: #0066cc; text-decoration: underline;">LinkedIn</a> | 
        <a href="https://www.github.com/AshwinKhandelwal47" style="color: #0066cc; text-decoration: underline;">GitHub</a>
      </p>
    </div>
  `;

  return { plainText, html };
}

// Endpoint to send email
app.post('/api/send-email', upload.single('attachment'), async (req, res) => {
  try {
    const {
      mode,
      receiverEmail,
      subject,
      recipientName,
      jobRole,
      companyName,
      senderName,
      customMessage,
      attachResume
    } = req.body;

    // Validation
    if (!receiverEmail) {
      return res.status(400).json({ success: false, error: "Receiver's Gmail / Email is required." });
    }

    const finalSubject = subject && subject.trim()
      ? subject.trim()
      : 'Software Development Intern application - Ashwin Khandelwal';

    let textBody = '';
    let htmlBody = '';

    if (mode === 'auto') {
      if (!companyName || !companyName.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Company Name is required for auto-generated emails.'
        });
      }
      const generated = generateAutoEmail({
        jobRole: jobRole && jobRole.trim() ? jobRole.trim() : 'SDE internship',
        companyName: companyName.trim(),
        recipientName: recipientName && recipientName.trim() ? recipientName.trim() : ''
      });
      textBody = generated.plainText;
      htmlBody = generated.html;
    } else {
      if (!customMessage || !customMessage.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Message content is required for custom emails.'
        });
      }
      textBody = customMessage.trim();
      // Convert plain newlines to HTML paragraphs/breaks
      htmlBody = `<div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #333333; white-space: pre-wrap;">${customMessage.trim()}</div>`;
    }

    const attachments = [];

    // Optional: user uploaded a custom file in the form
    if (req.file) {
      attachments.push({
        filename: req.file.originalname,
        content: req.file.buffer
      });
    }

    // Optional: attach existing resume from workspace if requested
    if (attachResume === 'true' || attachResume === true) {
      const possibleResumes = [
        'Ashwin_Khandelwal_Resume (1).pdf',
        'Ashwin_Khandelwal_Resume.pdf',
        'JULY_21_2026_1785411776.pdf',
        'resume.pdf',
        'Resume.pdf'
      ];
      let resumePath = null;
      for (const p of possibleResumes) {
        const full = path.join(__dirname, p);
        if (fs.existsSync(full)) {
          resumePath = full;
          break;
        }
      }

      if (resumePath) {
        attachments.push({
          filename: 'Ashwin_Khandelwal_Resume.pdf',
          path: resumePath
        });
      }
    }

    const transporter = getTransporter();

    const mailOptions = {
      from: `"${senderName && senderName.trim() ? senderName.trim() : 'Ashwin Khandelwal'}" <${process.env.GMAIL_USER}>`,
      to: receiverEmail.trim(),
      subject: finalSubject,
      text: textBody,
      html: htmlBody,
      attachments
    };

    const info = await transporter.sendMail(mailOptions);

    return res.json({
      success: true,
      message: 'Email sent successfully!',
      messageId: info.messageId,
      accepted: info.accepted
    });
  } catch (error) {
    console.error('Error sending email:', error);

    // Provide friendly error hints
    let errorMessage = error.message || 'Failed to send email.';
    if (error.code === 'EAUTH') {
      errorMessage = 'Gmail Authentication Failed! Ensure 2-Step Verification is ON and you are using a 16-character App Password (not your normal Google account password).';
    }

    return res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

