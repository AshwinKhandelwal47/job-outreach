@echo off
title Job Outreach Campaign Scheduler
cd /d "%~dp0"
echo Starting Job Outreach Campaign Daemon...
node campaign_daemon.js
pause

