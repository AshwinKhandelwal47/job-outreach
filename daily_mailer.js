const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { extractContacts } = require('./excelExtractor');

dotenv.config();

const PLAN_FILE = path.join(__dirname, 'campaign_plan.json');
const LOGS_DIR = path.join(__dirname, 'campaign_logs');

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Locate resume file
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
  console.error('ERROR: Resume PDF not found.');
  process.exit(1);
}

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

function loadPlan() {
  if (fs.existsSync(PLAN_FILE)) {
    return JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8'));
  }
  return [];
}

function savePlan(plan) {
  fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2), 'utf-8');
}

/**
 * Execute a daily mailing batch
 * @param {Object} batchConfig
 * @param {number} batchConfig.start - Start index
 * @param {number} batchConfig.end - End index
 * @param {number} [batchConfig.delaySeconds] - Delay in seconds between emails
 * @param {boolean} [batchConfig.dryRun=false] - If true, do not send actual emails
 */
async function executeBatch(batchConfig = {}) {
  const {
    start = 101,
    end = 300,
    delaySeconds = null,
    dryRun = false
  } = batchConfig;

  const count = end - start + 1;
  console.log(`\n==================================================`);
  console.log(`Starting Batch Execution: #${start} to #${end} (Target: ${count} emails)`);
  console.log(`Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
  console.log(`Dry Run Mode: ${dryRun}`);
  console.log(`==================================================\n`);

  // Update plan status to RUNNING
  const plan = loadPlan();
  const planIndex = plan.findIndex((p) => p.start === start && p.end === end);
  if (planIndex !== -1) {
    plan[planIndex].status = dryRun ? 'DRY_RUN' : 'RUNNING';
    plan[planIndex].startedAt = new Date().toISOString();
    savePlan(plan);
  }

  // Extract recipients from Excel
  const extracted = extractContacts({ start, limit: count });
  console.log(`Extracted ${extracted.length} valid contacts from Excel.\n`);

  if (extracted.length === 0) {
    console.log('No contacts found for this range.');
    return;
  }

  // Calculate safe delay for 9:00 AM - 12:00 PM IST (3-hour window for 200 emails = ~48-54s delay)
  const defaultDelayMs = Math.floor(Math.random() * 6000) + 48000; // 48 to 54 seconds
  const actualDelayMs = delaySeconds !== null ? delaySeconds * 1000 : defaultDelayMs;

  console.log(`Delay between emails: ${(actualDelayMs / 1000).toFixed(1)} seconds (distributing over 9:00 AM – 12:00 PM IST)`);

  const user = process.env.GMAIL_USER.trim();
  const pass = process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '');

  let transporter = null;
  if (!dryRun) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
      pool: true,
      maxConnections: 1,
      maxMessages: 250
    });
  }

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < extracted.length; i++) {
    const item = extracted[i];
    const currentNum = start + i;
    const { plainText, html } = createEmailContent(item.firstName, item.company);

    const mailOptions = {
      from: `"Ashwin Khandelwal" <${user}>`,
      to: item.primaryEmail,
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

    console.log(`[${i + 1}/${extracted.length}] (#${currentNum}) To: ${item.fullName} <${item.primaryEmail}> at ${item.company}`);

    if (dryRun) {
      console.log(`  [DRY RUN] Would send email with resume attached.`);
      results.push({
        num: currentNum,
        sno: item.sno,
        name: item.fullName,
        company: item.company,
        email: item.primaryEmail,
        status: 'DRY_RUN'
      });
      successCount++;
    } else {
      try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`  ✓ Sent! MessageId: ${info.messageId}`);
        results.push({
          num: currentNum,
          sno: item.sno,
          name: item.fullName,
          company: item.company,
          email: item.primaryEmail,
          status: 'SUCCESS',
          messageId: info.messageId,
          timestamp: new Date().toISOString()
        });
        successCount++;
      } catch (err) {
        console.error(`  ✗ Failed: ${err.message}`);
        results.push({
          num: currentNum,
          sno: item.sno,
          name: item.fullName,
          company: item.company,
          email: item.primaryEmail,
          status: 'FAILED',
          error: err.message,
          timestamp: new Date().toISOString()
        });
        failCount++;
      }
    }

    // Delay before next email
    if (i < extracted.length - 1) {
      await sleep(actualDelayMs);
    }
  }

  if (transporter) {
    transporter.close();
  }

  // Save log file
  const dateStr = new Date().toISOString().slice(0, 10);
  const logFileName = `batch_${start}_to_${end}_${dateStr}.json`;
  const logFilePath = path.join(LOGS_DIR, logFileName);
  fs.writeFileSync(logFilePath, JSON.stringify(results, null, 2), 'utf-8');

  // Update plan status
  if (planIndex !== -1) {
    plan[planIndex].status = dryRun ? 'DRY_RUN_DONE' : (failCount === 0 ? 'COMPLETED' : 'COMPLETED_WITH_ERRORS');
    plan[planIndex].sentCount = successCount;
    plan[planIndex].failedCount = failCount;
    plan[planIndex].completedAt = new Date().toISOString();
    plan[planIndex].logFile = logFileName;
    savePlan(plan);
  }

  console.log(`\n==================================================`);
  console.log(`Batch #${start} to #${end} Finished!`);
  console.log(`Success: ${successCount} | Failed: ${failCount}`);
  console.log(`Detailed report: ${logFilePath}`);
  console.log(`==================================================\n`);

  return { successCount, failCount, logFilePath };
}

// CLI Argument parsing
if (require.main === module) {
  const args = process.argv.slice(2);
  let start = null;
  let end = null;
  let delay = null;
  let dryRun = false;
  let runToday = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start' && args[i + 1]) {
      start = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--end' && args[i + 1]) {
      end = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--count' && args[i + 1]) {
      const count = parseInt(args[i + 1], 10);
      if (start !== null) end = start + count - 1;
      i++;
    } else if (args[i] === '--delay' && args[i + 1]) {
      delay = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--today') {
      runToday = true;
    }
  }

  if (runToday) {
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const plan = loadPlan();
    let todayBatch = plan.find((p) => p.date === todayStr);

    // If today is already completed or not found, fall back to next PENDING batch
    if (!todayBatch || todayBatch.status === 'COMPLETED') {
      const pendingBatch = plan.find((p) => p.status === 'PENDING');
      if (pendingBatch) {
        console.log(`Using next pending batch for ${pendingBatch.day} (${pendingBatch.date}): #${pendingBatch.start} to #${pendingBatch.end}`);
        todayBatch = pendingBatch;
      }
    }

    if (!todayBatch || todayBatch.status === 'COMPLETED') {
      console.log(`No pending scheduled batch found for today (${todayStr}).`);
      process.exit(0);
    }
    start = todayBatch.start;
    end = todayBatch.end;
  }

  if (start === null) start = 101;
  if (end === null) end = 300;

  executeBatch({ start, end, delaySeconds: delay, dryRun }).catch(console.error);
}

module.exports = {
  executeBatch,
  loadPlan,
  savePlan
};

