const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { extractContacts } = require('./excelExtractor');

dotenv.config();

// Locate resume
const possibleResumes = [
  'Ashwin_Khandelwal_Resume (1).pdf',
  'Ashwin_Khandelwal_Resume.pdf',
  'JULY_21_2026_1785411776.pdf'
];

let resumePath = null;
for (const f of possibleResumes) {
  const p = path.join(__dirname, f);
  if (fs.existsSync(p)) {
    resumePath = p;
    break;
  }
}

if (!resumePath) {
  console.error('ERROR: No resume PDF found in current folder.');
  process.exit(1);
}

// Parse command line arguments: e.g. `node send_batch_10.js --start 1 --limit 10`
const args = process.argv.slice(2);
let limit = 10;
let start = 1;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit' && args[i + 1]) {
    limit = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--start' && args[i + 1]) {
    start = parseInt(args[i + 1], 10);
    i++;
  }
}

// Dynamically extract contacts without any hardcoding
console.log(`Extracting contacts from Excel (start: ${start}, limit: ${limit})...`);
const extracted = extractContacts({ start, limit });

if (!extracted || extracted.length === 0) {
  console.log('No contacts found in Excel file.');
  process.exit(0);
}

const recipients = extracted.map((c) => ({
  sno: c.sno,
  company: c.company,
  name: c.firstName,
  fullName: c.fullName,
  email: c.primaryEmail
}));

console.log(`Successfully loaded ${recipients.length} recipients dynamically.\n`);

function createEmailContent(name, company) {
  const plainText = `Hi ${name},

I'm Ashwin Khandelwal, a final-year Computer Science student at Delhi Technological University (CGPA 8.48), looking for an SDE internship at ${company}.

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
      <p>Hi ${name},</p>
      <p>
        I'm Ashwin Khandelwal, a final-year Computer Science student at Delhi Technological University (CGPA 8.48), looking for an SDE internship at <strong>${company}</strong>.
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runBatch() {
  const user = process.env.GMAIL_USER.trim();
  const pass = process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '');

  console.log(`Starting batch sending from: ${user}`);
  console.log(`Resume attached: ${resumePath}\n`);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });

  const results = [];

  for (let i = 0; i < recipients.length; i++) {
    const item = recipients[i];
    const { plainText, html } = createEmailContent(item.name, item.company);

    const mailOptions = {
      from: `"Ashwin Khandelwal" <${user}>`,
      to: item.email,
      subject: 'Software Development Intern application - Ashwin Khandelwal',
      text: plainText,
      html: html,
      attachments: [
        {
          filename: 'Ashwin_Khandelwal_Resume.pdf',
          path: resumePath
        }
      ]
    };

    console.log(`[${i + 1}/${recipients.length}] Sending to: ${item.fullName} (${item.email}) at ${item.company}...`);

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`  ✓ Sent! MessageId: ${info.messageId}`);
      results.push({
        sno: item.sno,
        name: item.fullName,
        company: item.company,
        email: item.email,
        status: 'SUCCESS',
        messageId: info.messageId,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error(`  ✗ Error sending to ${item.email}: ${err.message}`);
      results.push({
        sno: item.sno,
        name: item.fullName,
        company: item.company,
        email: item.email,
        status: 'FAILED',
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }

    // Delay 2.5 seconds between emails to respect rate limits
    if (i < recipients.length - 1) {
      console.log('  Waiting 2.5s before next email...\n');
      await sleep(2500);
    }
  }

  fs.writeFileSync(
    path.join(__dirname, 'batch_send_report.json'),
    JSON.stringify(results, null, 2),
    'utf-8'
  );

  console.log('\n========================================');
  console.log('Batch sending completed!');
  console.log(`Success: ${results.filter((r) => r.status === 'SUCCESS').length}`);
  console.log(`Failed: ${results.filter((r) => r.status === 'FAILED').length}`);
  console.log('Detailed report saved to: batch_send_report.json');
  console.log('========================================');
}

runBatch().catch(console.error);
