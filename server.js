import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import os from "os";
import QRCode from "qrcode";

// Set up express and maxmind (for IP geologging)
dotenv.config();
const app = express();

/* ===== Environment Variables ===== */
/*
To get this, go to your google form and in the "..." in the top-right, select "Pre-filled".
Fill up the form fields you want to pre-fill (just fill them with example responses that lets you identify them easily) and select "Get link" at the bottom.
Copy the URL and identify the field entries based on your example responses.
For example, with a timestamp field and a unique form ID field, we may get this link (don't actually use this URL, you should do this on your end):
https://docs.google.com/forms/d/e/1FAIpQLSceJ9HPFCPAeE9malL-O9ha8i5VEg6RheiOWPDF8suHm403Iw/viewform?usp=pp_url&entry.1113798872=started&entry.689310151=id
Aside from PORT (which is up to you), you must modify variables in there.
*/
const PORT = process.env.PORT || 3000;
const FORM_ID = process.env.FORM_ID;
const ENTRY_TIMESTAMP = process.env.ENTRY_TIMESTAMP;
const ENTRY_UNIQUEID  = process.env.ENTRY_UNIQUEID;
const LOG_FILEPATH = process.env.LOG_FILEPATH || "records/attendance.csv";
const QR_FILEPATH = process.env.QR_FILEPATH || "records/qr.png";
const SUPER_SECRET = process.env.SUPER_SECRET;
/* ======================== */

/* ===== HELPERS ===== */
function getLocalIpAddress() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      const isIPv4 = net.family === "IPv4" || net.family === 4;

      if (isIPv4 && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}
function initializeLogFile(log_filepath) {
  const fullPath = path.resolve(process.cwd(), log_filepath);
  const dir = path.dirname(fullPath);
  
  // Create folder(s) if needed
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Create CSV if missing
  if (!fs.existsSync(fullPath)) {
    const headers =
      "timestamp,unique_id,qr_code,IP,user_agent\n";

    fs.writeFileSync(fullPath, headers, "utf8");

    console.log(`Created log file: "${fullPath}"`);
  } else {
    console.log(`Using existing log file: "${fullPath}"`);
  }
}
async function generateQrCode(qr_filepath, url) {
  const outputPath = path.resolve(process.cwd(), qr_filepath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await QRCode.toFile(outputPath, url, {
    width: 400,
    margin: 2
  });
  console.log(`QR code saved to: "${outputPath}"`);
  console.log(`This QR code points to: "${url}"`);
}
/* ======================== */

// These are auto-generated
const local_ip = getLocalIpAddress();
const ATTENDEES_URL = `http://${local_ip}:3000/go?code=${SUPER_SECRET}`;
const ADMIN_URL = `http://${local_ip}:3000/admin`;
const FORM_URL = `https://docs.google.com/forms/d/e/${FORM_ID}/viewform`;
initializeLogFile(LOG_FILEPATH);
generateQrCode(QR_FILEPATH, ATTENDEES_URL);
/* ======================== */



app.get("/go", (req, res) => {
  
  // Get the QR Code from the user's url. If not present, cannot grab it
  const qrCode = 
    req.query.code 
    || "";
 
  // These are auto-generated. UUID random id is limited to 16 characters
  const timestamp = Date.now().toString();
  const uniqueId = crypto.randomUUID().toString().substring(0,16);
  
  // Grab IP-specific stuff
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress ||
    "unknown";
  
  // Get the user agent data (e.g. hardware)
  const userAgent = 
    req.headers["user-agent"] 
    || "";
  
  // Append to our logger file. Make sure the logger file has the appropriate columns
  const row =
    `${timestamp},${uniqueId},${qrCode},${ip},"${userAgent}"\n`;
  fs.appendFileSync(LOG_FILEPATH, row);
  
  // Redirection
  const redirectUrl =
    FORM_URL +
    "?usp=pp_url" +
    `&${ENTRY_TIMESTAMP}=${encodeURIComponent(timestamp)}` +
    `&${ENTRY_UNIQUEID}=${encodeURIComponent(uniqueId)}`;

  res.redirect(302, redirectUrl);
});

app.get("/admin", (req, res) => {
  const filePath = path.join(process.cwd(), LOG_FILEPATH);

  if (!fs.existsSync(filePath)) {
    return res.send(`"Logging filepath ${LOG_FILEPATH} not found.`);
  }

  const csv = fs.readFileSync(filePath, "utf8").trim();

  const lines = csv.split("\n");
  const rows = lines.map(line => line.split(","));

  let html = `
  <html>
  <head>
    <meta http-equiv="refresh" content="5">
    <title>Attendance Records</title>
    <style>
      body { font-family: Arial; padding: 20px; }
      table { border-collapse: collapse; width: 100%; }
      th, td {
        border: 1px solid #ccc;
        padding: 8px;
        font-size: 14px;
        text-align: left;
      }
      th {
        background: #f2f2f2;
        position: sticky;
        top: 0;
      }
      tr:nth-child(even) { background: #fafafa; }
    </style>
  </head>
  <body>
    <h1>Attendance Records</h1>
    <table>
  `;

  rows.forEach((row, index) => {
    html += "<tr>";

    row.forEach(cell => {
      if (index === 0) {
        html += `<th>${cell}</th>`;
      } else {
        html += `<td>${cell}</td>`;
      }
    });

    html += "</tr>";
  });

  html += `
    </table>
  </body>
  </html>
  `;

  res.send(html);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Running on http://${local_ip}:3000` +
    "\nThe following webpages are key to you:"+
    `\n- ${ATTENDEES_URL} <- attendees access this QR code` +
    `\n- ${ADMIN_URL} <- you can access this to observe logs in real-time`
  );
});