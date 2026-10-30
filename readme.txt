SPAR DEMO - COMMANDS TO RUN
===========================
Paste into PowerShell. Full paths, so they work from any folder.
Leave each window open while presenting. Ctrl+C stops it.


FLOW DEMO  ->  http://localhost:5173
-------------------------------------
cd "D:\Projects (Prospect)\SPAR\ERP system\john-henry-supermarkets\app"
npm run dev

  Scenarios:  http://localhost:5173/?scenario=S1   (S2, S3, S4 the same way)
  One person: http://localhost:5173/?role=jamal    (aisha, emily, priya)


PLATFORM DEMO  ->  http://localhost:8080
-----------------------------------------
cd "D:\Projects (Prospect)\SPAR\ERP system\john-henry-supermarkets\reference"
python -m http.server 8080


BOTH AT ONCE
------------
Run each block above in its own PowerShell window.
