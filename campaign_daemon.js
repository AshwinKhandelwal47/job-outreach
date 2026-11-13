const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { executeBatch, loadPlan, savePlan } = require('./daily_mailer');

console.log('==================================================');
console.log('📬 Job Outreach Campaign Scheduler Daemon Started');
console.log(`Current Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
console.log('Schedule: Every Weekday (Mon-Fri) at 09:00 AM IST');
console.log('==================================================\n');

const plan = loadPlan();
console.log('Active Campaign Schedule:');
plan.forEach((item) => {
  console.log(`• ${item.day} (${item.date}): #${item.start} to #${item.end} [${item.targetCount} emails] - Status: ${item.status}`);
});
console.log('\nWaiting for scheduled trigger at 09:00 AM IST...\n');

// Schedule: At 09:00 AM every Monday to Friday (Asia/Kolkata timezone)
// Cron expression: '0 9 * * 1-5'
cron.schedule(
  '0 9 * * 1-5',
  async () => {
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
    console.log(`\n⏰ [CRON TRIGGER] 09:00 AM reached on ${todayStr} IST!`);

    const currentPlan = loadPlan();
    let todayBatch = currentPlan.find((p) => p.date === todayStr);

    if (!todayBatch || todayBatch.status === 'COMPLETED') {
      const pendingBatch = currentPlan.find((p) => p.status === 'PENDING');
      if (pendingBatch) {
        console.log(`Using next available pending batch for ${pendingBatch.day} (${pendingBatch.date}): #${pendingBatch.start} to #${pendingBatch.end}`);
        todayBatch = pendingBatch;
      }
    }

    if (!todayBatch || todayBatch.status === 'COMPLETED') {
      console.log(`No pending scheduled batch found for date: ${todayStr}.`);
      return;
    }

    console.log(`Executing batch for ${todayBatch.day}: #${todayBatch.start} to #${todayBatch.end}...`);
    try {
      await executeBatch({
        start: todayBatch.start,
        end: todayBatch.end
      });
    } catch (err) {
      console.error(`Error during scheduled batch: ${err.message}`);
    }
  },
  {
    scheduled: true,
    timezone: 'Asia/Kolkata'
  }
);

// Keep process alive and log hourly heartbeat
setInterval(() => {
  const timeStr = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
  console.log(`[Heartbeat] Scheduler active. Local time: ${timeStr} IST`);
}, 60 * 60 * 1000);

