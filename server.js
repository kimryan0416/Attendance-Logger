const express = require("express");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = 3000;

/* ===== CHANGE THESE ===== */
/*
To get this, go to your google form and in the "..." in the top-right, select "Pre-filled".
Fill up the form fields you want to pre-fill (just fill them with example responses that lets you identify them easily) and select "Get link" at the bottom.
Copy the URL and identify the field entries based on your example responses.
For example, with a timestamp field and a unique form ID field, we may get this link (don't actually use this URL, you should do this on your end):
https://docs.google.com/forms/d/e/1FAIpQLSceJ9HPFCPAeE9malL-O9ha8i5VEg6RheiOWPDF8suHm403Iw/viewform?usp=pp_url&entry.1113798872=started&entry.689310151=id
*/
const FORM_URL = `https://docs.google.com/forms/d/e/1FAIpQLSceJ9HPFCPAeE9malL-O9ha8i5VEg6RheiOWPDF8suHm403Iw/viewform`;
const ENTRY_TIMESTAMP = "entry.1113798872";
const ENTRY_UNIQUEID  = "entry.689310151";
const LOG_FILEPATH = "records/attendance.csv";
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

app.listen(3000, "0.0.0.0", () => {
  console.log("Running on http://[IP ADDRESS]:3000\nTo access your IP address, you can use `ipconfig` in your command line.");
});