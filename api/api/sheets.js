// api/sheets.js
// Google Sheets API Integration for Vercel
// This handles reading/writing to Google Sheets

const { google } = require('googleapis');

// Initialize the Sheets API
const sheets = google.sheets('v4');

// Get credentials from environment variables
const getAuthClient = () => {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const projectId = process.env.GOOGLE_PROJECT_ID;

    return new google.auth.JWT({
          email: clientEmail,
          key: privateKey,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
};

// Helper function to read from Google Sheets
const readSheet = async (spreadsheetId, range) => {
    try {
          const auth = getAuthClient();
          const response = await sheets.spreadsheets.values.get({
                  auth,
                  spreadsheetId,
                  range,
          });
          return response.data.values || [];
    } catch (error) {
          console.error('Error reading sheet:', error);
          throw error;
    }
};

// Helper function to write to Google Sheets
const writeSheet = async (spreadsheetId, range, values) => {
    try {
          const auth = getAuthClient();
          const response = await sheets.spreadsheets.values.update({
                  auth,
                  spreadsheetId,
                  range,
                  valueInputOption: 'USER_ENTERED',
                  requestBody: {
                            values,
                  },
          });
          return response.data;
    } catch (error) {
          console.error('Error writing to sheet:', error);
          throw error;
    }
};

// Main API handler
export default async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token,X-Requested-With,Accept,Accept-Version,Content-Length,Content-MD5,Content-Type,Date,X-Api-Version');

    if (req.method === 'OPTIONS') {
          res.status(200).end();
          return;
    }

    try {
          const { action, spreadsheetId, range, values } = req.body;

      if (!action || !spreadsheetId) {
              return res.status(400).json({ error: 'Missing required parameters' });
      }

      if (action === 'read') {
              const data = await readSheet(spreadsheetId, range);
              return res.status(200).json({ data });
      } else if (action === 'write') {
              if (!values) {
                        return res.status(400).json({ error: 'Values are required for write action' });
              }
              const result = await writeSheet(spreadsheetId, range, values);
              return res.status(200).json({ success: true, result });
      } else {
              return res.status(400).json({ error: 'Invalid action' });
      }
    } catch (error) {
          console.error('API Error:', error);
          return res.status(500).json({ error: error.message });
    }
};
