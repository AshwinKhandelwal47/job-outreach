const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Regex for extracting emails
const EMAIL_REGEX = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;

// Generic email prefixes that refer to a team rather than an individual person
const GENERIC_EMAIL_PREFIXES = [
  'career', 'careers', 'job', 'jobs', 'talent', 'talentacquisition',
  'hr', 'info', 'support', 'contact', 'connect', 'team', 'reach',
  'work', 'hello', 'recruitment', 'allrecruiter', 'hire', 'hiring',
  'founders', 'applicant', 'applications', 'admin', 'projectsnightlight',
  'tech-applications'
];

/**
 * Infer human name or Hiring Team from an email address when Name column is missing
 * e.g. 'suryansh.tiwari@spinny.com' -> 'Suryansh Tiwari', 'jobs@medial.app' -> 'Hiring Team'
 */
function nameFromEmail(email) {
  if (!email || !email.includes('@')) {
    return { fullName: 'Hiring Team', firstName: 'Hiring Team' };
  }
  const userPart = email.split('@')[0].toLowerCase();
  const cleanUser = userPart.replace(/[0-9_+]+/g, '').trim();

  // If matches any generic prefix
  for (const prefix of GENERIC_EMAIL_PREFIXES) {
    if (cleanUser === prefix || cleanUser.startsWith(prefix + '.') || cleanUser.endsWith('.' + prefix)) {
      return { fullName: 'Hiring Team', firstName: 'Hiring Team' };
    }
  }

  const parts = cleanUser.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 1 && parts.every((p) => p.length >= 2 && !GENERIC_EMAIL_PREFIXES.includes(p))) {
    const fullName = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    return { fullName, firstName };
  }

  return { fullName: 'Hiring Team', firstName: 'Hiring Team' };
}

/**
 * Clean and format person's name into proper Title Case
 * e.g., 'jveevitha mohan' -> 'Jeevitha Mohan', 'Prachi -kulkarni' -> 'Prachi Kulkarni'
 */
function cleanName(rawName, fallbackEmail = '') {
  if (!rawName || typeof rawName !== 'string' || rawName.includes('@') || /\.[a-z]{2,}/i.test(rawName)) {
    return nameFromEmail(fallbackEmail).fullName;
  }
  let cleaned = rawName
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s*-\s*/g, ' ')
    .replace(/[^a-zA-Z\s.]/g, '')
    .trim();

  if (!cleaned || cleaned.length < 2) {
    return nameFromEmail(fallbackEmail).fullName;
  }

  // Convert to Title Case
  cleaned = cleaned
    .split(/\s+/)
    .map((w) => {
      if (w.length === 1) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');

  return cleaned;
}

/**
 * Extract first name for email salutation ("Hi [FirstName],")
 * Handles initials like "Jhenson A J" -> "Jhenson"
 */
function extractFirstName(cleanFullName, fallbackEmail = '') {
  if (!cleanFullName || cleanFullName === 'Hiring Team') {
    return nameFromEmail(fallbackEmail).firstName;
  }
  const parts = cleanFullName.trim().split(/\s+/);
  return parts[0] || 'there';
}

/**
 * Clean company name
 * Fixes common typos like 'Rozar Pay ' -> 'Razorpay'
 */
function cleanCompany(rawCompany) {
  if (!rawCompany || typeof rawCompany !== 'string') return '';
  let company = rawCompany.replace(/[\r\n\t]+/g, ' ').trim();

  // Known typo corrections from common sheets
  const corrections = {
    'rozar pay': 'Razorpay',
    'rozarpay': 'Razorpay',
    'razor pay': 'Razorpay',
    'humors tech': 'Humors Tech',
    'futureik technologies': 'FutureIK Technologies',
    'lbm solutions pvt.ltd': 'LBM Solutions',
    'lbm solutions pvt. ltd': 'LBM Solutions',
    'innoviti technologies pvt ltd': 'Innoviti Technologies'
  };

  const lower = company.toLowerCase().replace(/[.,\s]+$/, '');
  if (corrections[lower]) {
    return corrections[lower];
  }

  // Remove trailing commas/dashes
  return company.replace(/[,-\s]+$/, '').trim();
}

/**
 * Extracts and deduplicates emails from a string or cell value
 */
function extractEmails(val) {
  if (!val) return [];
  const text = String(val);
  const matches = text.match(EMAIL_REGEX) || [];
  const unique = [];
  for (const m of matches) {
    const cleanEmail = m.toLowerCase().trim();
    if (!unique.includes(cleanEmail)) {
      unique.push(cleanEmail);
    }
  }
  return unique;
}

/**
 * Automatically detects the default Excel file in the directory
 */
function findDefaultExcelFile(dir = __dirname) {
  const preferred = 'enekrPywKv9VMVTmjZ364J.xlsx';
  const preferredPath = path.join(dir, preferred);
  if (fs.existsSync(preferredPath)) {
    return preferredPath;
  }

  const files = fs.readdirSync(dir);
  const xlsxFiles = files.filter(
    (f) => f.endsWith('.xlsx') && !f.startsWith('~$')
  );
  if (xlsxFiles.length > 0) {
    return path.join(dir, xlsxFiles[0]);
  }
  return null;
}

function isHeaderRow(row) {
  const rowStr = row.map((cell) => String(cell).toLowerCase().trim()).join(' ');
  return (
    (rowStr.includes('s.no') || rowStr.includes('sno') || rowStr.includes('startup nme')) &&
    (rowStr.includes('email') || rowStr.includes('mail') || rowStr.includes('company') || rowStr.includes('hiring'))
  );
}

function parseHeaders(row) {
  const map = {
    sno: 0,
    company: 1,
    name: -1,
    recruiterEmail: -1,
    personalEmail: -1,
    founderEmail: -1,
    location: -1,
    website: -1,
    industry: -1
  };

  row.forEach((cell, colIdx) => {
    const text = String(cell).toLowerCase().trim();
    if (/^(s\.?no|#|id|serial)/i.test(text)) {
      map.sno = colIdx;
    } else if (/website|url/i.test(text)) {
      map.website = colIdx;
    } else if (/location|city/i.test(text)) {
      map.location = colIdx;
    } else if (/industry|sector/i.test(text)) {
      map.industry = colIdx;
    } else if (/startup\s*nme|company\s*name|^company$|^startup$/i.test(text)) {
      map.company = colIdx;
    } else if (/^name|contact\s*name|recruiter\s*name/i.test(text)) {
      map.name = colIdx;
    } else if (/recruiter.*email|talent.*email|hiring.*mail|hiring.*email/i.test(text)) {
      map.recruiterEmail = colIdx;
    } else if (/personal.*email/i.test(text)) {
      map.personalEmail = colIdx;
    } else if (/founder.*email/i.test(text)) {
      map.founderEmail = colIdx;
    }
  });

  // If recruiterEmail is still -1, check if column has 'mail' or 'email'
  if (map.recruiterEmail === -1) {
    row.forEach((cell, colIdx) => {
      const text = String(cell).toLowerCase().trim();
      if ((text.includes('mail') || text.includes('email')) && colIdx !== map.personalEmail && colIdx !== map.founderEmail) {
        map.recruiterEmail = colIdx;
      }
    });
  }

  return map;
}

/**
 * Main Extractor Function
 * Reads the Excel workbook, dynamically identifies header columns,
 * and extracts structured contact records.
 *
 * @param {Object} options
 * @param {string} [options.filePath] - Path to excel file
 * @param {number} [options.start=1] - 1-based index of contacts to start from
 * @param {number} [options.limit] - Maximum number of contacts to return
 * @param {boolean} [options.requireEmail=true] - Only return contacts with at least one email
 * @returns {Array<Object>} List of extracted contacts
 */
function extractContacts(options = {}) {
  const {
    filePath = findDefaultExcelFile(),
    start = 1,
    limit = null,
    requireEmail = true
  } = options;

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Excel file not found at: ${filePath}`);
  }

  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  let colMap = {
    sno: 0,
    company: 1,
    name: 2,
    recruiterEmail: 3,
    personalEmail: 4,
    location: 5,
    website: 6,
    industry: 7,
    founderEmail: 8
  };

  const contacts = [];
  let validContactCount = 0;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => String(c).trim() === '')) continue;

    // Check if this row is a header row (supports multiple sections)
    if (isHeaderRow(row)) {
      colMap = parseHeaders(row);
      continue;
    }

    const rawSno = colMap.sno !== -1 ? row[colMap.sno] : row[0];
    const rawCompany = colMap.company !== -1 ? row[colMap.company] : '';
    const rawName = colMap.name !== -1 ? row[colMap.name] : '';

    const recruiterEmails = colMap.recruiterEmail !== -1 ? extractEmails(row[colMap.recruiterEmail]) : [];
    const personalEmails = colMap.personalEmail !== -1 ? extractEmails(row[colMap.personalEmail]) : [];
    const founderEmails = colMap.founderEmail !== -1 ? extractEmails(row[colMap.founderEmail]) : [];

    // Also scan entire row for any stray emails
    const allRowEmails = extractEmails(row.join(' '));

    const combinedEmails = Array.from(
      new Set([
        ...recruiterEmails,
        ...personalEmails,
        ...founderEmails,
        ...allRowEmails
      ])
    );

    if (requireEmail && combinedEmails.length === 0) {
      continue;
    }

    validContactCount++;

    // Skip if before requested start index
    if (validContactCount < start) {
      continue;
    }

    // Primary email preference: recruiter/work email first, else personal, else first found
    const primaryEmail = recruiterEmails[0] || personalEmails[0] || combinedEmails[0];

    const cleanedFullName = cleanName(rawName, primaryEmail);
    const firstName = extractFirstName(cleanedFullName, primaryEmail);
    let cleanedCompany = cleanCompany(rawCompany);

    if (!cleanedCompany || cleanedCompany.toLowerCase() === 'startup') {
      cleanedCompany = 'your startup';
    } else if (cleanedCompany.toLowerCase() === 'generative ai product intern') {
      cleanedCompany = 'your AI team';
    } else if (cleanedCompany.toLowerCase() === 'paid gig') {
      cleanedCompany = 'your company';
    }

    contacts.push({
      sno: Number(rawSno) || validContactCount,
      globalIndex: validContactCount,
      rowIndex: r + 1,
      company: cleanedCompany,
      fullName: cleanedFullName || 'Hiring Team',
      firstName: firstName || 'Hiring Team',
      primaryEmail,
      recruiterEmails,
      personalEmails,
      founderEmails,
      allEmails: combinedEmails,
      location: colMap.location !== -1 ? String(row[colMap.location] || '').trim() : '',
      website: colMap.website !== -1 ? String(row[colMap.website] || '').trim() : '',
      industry: colMap.industry !== -1 ? String(row[colMap.industry] || '').trim() : ''
    });

    if (limit && contacts.length >= limit) {
      break;
    }
  }

  return contacts;
}

// CLI Execution Helper
if (require.main === module) {
  const args = process.argv.slice(2);
  let limit = 10;
  let start = 1;
  let exportPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--start' && args[i + 1]) {
      start = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--export' && args[i + 1]) {
      exportPath = args[i + 1];
      i++;
    } else if (args[i] === '--all') {
      limit = null;
    }
  }

  console.log(`Extracting contacts (start: ${start}, limit: ${limit || 'ALL'})...`);
  const contacts = extractContacts({ start, limit });

  console.log(`\nSuccessfully extracted ${contacts.length} contacts:\n`);
  contacts.forEach((c, idx) => {
    console.log(
      `${idx + 1}. [SNo: ${c.sno}] ${c.firstName} (${c.fullName}) | ${c.company} | Primary: ${c.primaryEmail} | Total emails: ${c.allEmails.length}`
    );
  });

  if (exportPath) {
    fs.writeFileSync(exportPath, JSON.stringify(contacts, null, 2), 'utf-8');
    console.log(`\nExported contacts to: ${exportPath}`);
  }
}

module.exports = {
  extractContacts,
  cleanName,
  extractFirstName,
  cleanCompany,
  extractEmails
};

