# Gmail Quick Mailer

A lightweight Node.js + Nodemailer web application for sending job inquiry emails and custom outreach directly through your Gmail account.

## Features
- **Option 1: Auto Generated Mail**
  - Requires: Receiver Gmail, Job Role, Company Name, Subject.
  - Automatically crafts a professional cover-letter style pitch with live preview.
- **Option 2: Write On Your Own**
  - Requires: Receiver Gmail, Subject, Full custom message.
- **Resume Attachment**:
  - Automatically includes your resume from the workspace or allows uploading a custom file.
- **Real-time Status Banner**:
  - Shows if your Gmail account credentials are properly loaded from `.env`.

---

## Quick Setup

### 1. Generate a Gmail App Password
1. Turn on **2-Step Verification** on your Google Account: [Google Security Settings](https://myaccount.google.com/security).
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords).
3. Create an App name (e.g., `JobSearchApp`) and copy the 16-character password (e.g. `abcd efgh ijkl mnop`).

### 2. Configure `.env`
Open the `.env` file in this directory and fill in your details:
```env
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
PORT=3000
```

### 3. Start the Server
Run:
```bash
npm start
```
or
```bash
node server.js
```

### 4. Open in Browser
Visit: [http://localhost:3000](http://localhost:3000)

