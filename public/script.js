// State
let currentMode = 'auto'; // 'auto' | 'manual'

// DOM Elements
const tabAuto = document.getElementById('tabAuto');
const tabManual = document.getElementById('tabManual');
const autoFields = document.getElementById('autoFields');
const manualFields = document.getElementById('manualFields');

const emailForm = document.getElementById('emailForm');
const contactSelector = document.getElementById('contactSelector');
const receiverEmailInput = document.getElementById('receiverEmail');
const subjectInput = document.getElementById('subject');
const recipientNameInput = document.getElementById('recipientName');
const jobRoleInput = document.getElementById('jobRole');
const companyNameInput = document.getElementById('companyName');
const senderNameInput = document.getElementById('senderName');
const customMessageInput = document.getElementById('customMessage');
const livePreview = document.getElementById('livePreview');

const attachResumeCheckbox = document.getElementById('attachResume');
const attachmentFileInput = document.getElementById('attachmentFile');
const submitBtn = document.getElementById('submitBtn');
const btnText = submitBtn.querySelector('.btn-text');
const btnSpinner = submitBtn.querySelector('.btn-spinner');
const responseBox = document.getElementById('responseBox');

const statusBanner = document.getElementById('statusBanner');
const statusText = document.getElementById('statusText');
const setupLink = document.getElementById('setupLink');

let loadedContacts = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkServerStatus();
  setupEventListeners();
  loadContactsDropdown();
  loadCampaignStatus();
  updateLivePreview();
});

// Load Weekly Campaign Schedule
async function loadCampaignStatus() {
  const tbody = document.getElementById('campaignTableBody');
  if (!tbody) return;
  try {
    const res = await fetch('/api/campaign');
    const data = await res.json();
    if (data.success && data.plan) {
      tbody.innerHTML = '';
      data.plan.forEach((item) => {
        const tr = document.createElement('tr');
        const statusClass = item.status.toLowerCase().includes('completed')
          ? 'completed'
          : item.status.toLowerCase().includes('running')
          ? 'running'
          : 'pending';

        tr.innerHTML = `
          <td><strong>${item.day}</strong> <small style="color:#64748b">(${item.date})</small></td>
          <td>#${item.start} – #${item.end}</td>
          <td>${item.targetCount}</td>
          <td>${item.window}</td>
          <td><span class="status-pill ${statusClass}">${item.status}</span></td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('Failed to load campaign schedule:', err);
  }
}

// Load extracted contacts from Excel into quick-select dropdown
async function loadContactsDropdown() {
  if (!contactSelector) return;
  try {
    const res = await fetch('/api/contacts?limit=100');
    const data = await res.json();
    if (data.success && data.contacts && data.contacts.length > 0) {
      loadedContacts = data.contacts;
      contactSelector.innerHTML = '<option value="">-- Choose a contact from Excel to auto-fill --</option>';
      data.contacts.forEach((c, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `${c.sno}. ${c.fullName} - ${c.company} (${c.primaryEmail})`;
        contactSelector.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Failed to load contacts from Excel:', err);
  }
}

// Check if credentials are set in .env
async function checkServerStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    if (data.configured) {
      statusBanner.className = 'status-banner connected';
      statusText.innerHTML = `Connected to Gmail sender: <strong>${data.senderEmail}</strong>`;
      setupLink.classList.add('hidden');
    } else {
      statusBanner.className = 'status-banner unconfigured';
      statusText.innerHTML = `⚠️ Gmail credentials not detected in <code>.env</code> file.`;
      setupLink.classList.remove('hidden');
    }
  } catch (err) {
    statusBanner.className = 'status-banner unconfigured';
    statusText.innerText = 'Unable to connect to local server.';
  }
}

// Event Listeners
function setupEventListeners() {
  // Mode tabs
  tabAuto.addEventListener('click', () => setMode('auto'));
  tabManual.addEventListener('click', () => setMode('manual'));

  // Quick select contact from Excel
  if (contactSelector) {
    contactSelector.addEventListener('change', (e) => {
      const idx = e.target.value;
      if (idx !== '' && loadedContacts[idx]) {
        const c = loadedContacts[idx];
        receiverEmailInput.value = c.primaryEmail || '';
        companyNameInput.value = c.company || '';
        recipientNameInput.value = c.firstName || c.fullName || '';
        updateLivePreview();
      }
    });
  }

  // Auto-preview updates
  recipientNameInput.addEventListener('input', updateLivePreview);
  companyNameInput.addEventListener('input', updateLivePreview);
  jobRoleInput.addEventListener('input', updateLivePreview);
  senderNameInput.addEventListener('input', updateLivePreview);

  // Form submit
  emailForm.addEventListener('submit', handleSubmit);
}

// Set Active Mode
function setMode(mode) {
  currentMode = mode;

  if (mode === 'auto') {
    tabAuto.classList.add('active');
    tabManual.classList.remove('active');
    autoFields.classList.remove('hidden-section');
    manualFields.classList.add('hidden-section');

    companyNameInput.setAttribute('required', 'true');
    customMessageInput.removeAttribute('required');
  } else {
    tabManual.classList.add('active');
    tabAuto.classList.remove('active');
    autoFields.classList.add('hidden-section');
    manualFields.classList.remove('hidden-section');

    companyNameInput.removeAttribute('required');
    customMessageInput.setAttribute('required', 'true');
  }

  // Clear previous message
  hideResponse();
}

// Live preview generator
function updateLivePreview() {
  const recipient = recipientNameInput.value.trim() || '[Name]';
  const role = jobRoleInput.value.trim() || 'SDE internship';
  const company = companyNameInput.value.trim() || '[Company]';
  const sender = senderNameInput.value.trim() || 'Ashwin Khandelwal';

  livePreview.innerHTML = `
    Hi <strong>${recipient}</strong>,<br/><br/>
    I'm ${sender}, a final-year Computer Science student at Delhi Technological University (CGPA 8.48), looking for an ${role} at <strong>${company}</strong>.<br/><br/>
    I recently interned at JDMR iSchool pvt. ltd., where I built a multi-layer AI guardrail pipeline on AWS Bedrock for a school ERP assistant. Running a cheaper check ahead of the full policy pipeline cut guardrail costs by 62.5% on blocked requests and 37.5% on legitimate ones.<br/><br/>
    Some other end-to-end, deployed projects I've built:<br/>
    • <strong>TrueDueAI:</strong> a RAG-based financial due diligence assistant (LangChain, ChromaDB) with a ReAct agent and automatic LLM failover<br/>
    • <strong>Codeverse:</strong> a real-time collaborative code editor handling 500+ live edits per minute using sockets.io<br/><br/>
    I've also placed in the top positions at HackCBS 8.0, HackVSIT 6.0 and brAInwave, and solved 800+ problems on coding platforms like Codeforces, LeetCode and GeeksforGeeks.<br/><br/>
    Resume attached. Happy to chat if you're open to it.<br/><br/>
    Thanks,<br/>
    <strong>${sender}</strong><br/>
    <span style="font-size: 12.5px; color: #475569;">+91 8595993411 | <a href="https://www.linkedin.com/in/ashwin-khandelwal-5496392a2" target="_blank" style="color: #2563eb;">LinkedIn</a> | <a href="https://www.github.com/AshwinKhandelwal47" target="_blank" style="color: #2563eb;">GitHub</a></span>
  `;
}

// Handle Form Submission
async function handleSubmit(e) {
  e.preventDefault();
  hideResponse();

  const formData = new FormData();
  formData.append('mode', currentMode);
  formData.append('receiverEmail', receiverEmailInput.value.trim());
  formData.append('subject', subjectInput.value.trim());

  if (currentMode === 'auto') {
    formData.append('recipientName', recipientNameInput.value.trim());
    formData.append('companyName', companyNameInput.value.trim());
    formData.append('jobRole', jobRoleInput.value.trim());
    formData.append('senderName', senderNameInput.value.trim());
  } else {
    formData.append('customMessage', customMessageInput.value.trim());
  }

  formData.append('attachResume', attachResumeCheckbox.checked);

  if (attachmentFileInput.files.length > 0) {
    formData.append('attachment', attachmentFileInput.files[0]);
  }

  // UI loading state
  setLoading(true);

  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showResponse(
        `🎉 <strong>Success!</strong> Email sent to <code>${receiverEmailInput.value.trim()}</code> successfully.`,
        'success'
      );
      // Optional: reset message or form fields
    } else {
      showResponse(
        `❌ <strong>Failed to send email:</strong> ${data.error || 'Unknown error occurred.'}`,
        'error'
      );
    }
  } catch (err) {
    showResponse(
      `❌ <strong>Network / Server Error:</strong> Could not reach the email server. Please make sure <code>node server.js</code> is running.`,
      'error'
    );
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  if (isLoading) {
    submitBtn.disabled = true;
    btnText.textContent = 'Sending Email...';
    btnSpinner.classList.remove('hidden');
  } else {
    submitBtn.disabled = false;
    btnText.textContent = '🚀 Send Email Now';
    btnSpinner.classList.add('hidden');
  }
}

function showResponse(htmlContent, type) {
  responseBox.innerHTML = htmlContent;
  responseBox.className = `response-box ${type}`;
  responseBox.classList.remove('hidden');
  responseBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideResponse() {
  responseBox.classList.add('hidden');
  responseBox.innerHTML = '';
}

