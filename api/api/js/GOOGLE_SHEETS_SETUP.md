# Google Sheets Integration Setup Guide

## Overview
This project now includes Google Sheets API integration. You can read and write data to Google Sheets directly from your website using the two files that have been created:

- **`api/sheets.js`** - Backend API handler for Vercel
- - **`js/google-sheets-integration.js`** - Frontend JavaScript library
 
  - ## Files Included
 
  - ### 1. Backend API Handler (`api/sheets.js`)
  - Handles all API requests to Google Sheets. Runs on Vercel as a serverless function.
 
  - **Features:**
  - - Read data from Google Sheets
    - - Write data to Google Sheets
      - - CORS enabled for frontend requests
        - - Error handling and logging
         
          - ### 2. Frontend Integration Library (`js/google-sheets-integration.js`)
          - A JavaScript class that makes it easy to interact with Google Sheets from your website.
         
          - **Features:**
          - - Read data from sheets
            - - Write data to sheets
              - - Append data (add new rows)
                - - Format data as objects with headers as keys
                  - - Full error handling
                   
                    - ## Setup Instructions
                   
                    - ### Step 1: Set Up Google Cloud Project
                   
                    - 1. Go to [Google Cloud Console](https://console.cloud.google.com/)
                      2. 2. Create a new project (or use an existing one)
                         3. 3. Enable the **Google Sheets API**:
                            4.    - Search for "Google Sheets API"
                                  -    - Click Enable
                                       - 4. Create a Service Account:
                                         5.    - Go to "Service Accounts" in the left menu
                                               -    - Click "Create Service Account"
                                                    -    - Fill in the service account details
                                                         -    - Click "Create and Continue"
                                                              - 5. Create a JSON Key:
                                                                6.    - In the service account details page, go to the "Keys" tab
                                                                      -    - Click "Add Key" → "Create new key"
                                                                           -    - Choose JSON format
                                                                                -    - Save the downloaded JSON file
                                                                                 
                                                                                     - ### Step 2: Extract Credentials from JSON Key
                                                                                 
                                                                                     - Open the downloaded JSON key file and copy these values:
                                                                                     - - `private_key` - The full private key (includes newlines)
                                                                                       - - `client_email` - The service account email
                                                                                         - - `project_id` - The Google Cloud project ID
                                                                                          
                                                                                           - ### Step 3: Add Environment Variables to Vercel
                                                                                          
                                                                                           - 1. Go to your Vercel project settings
                                                                                             2. 2. Navigate to "Environment Variables"
                                                                                                3. 3. Add these three variables:
                                                                                                  
                                                                                                   4. ```
                                                                                                      GOOGLE_PRIVATE_KEY = [paste the private_key value]
                                                                                                      GOOGLE_CLIENT_EMAIL = [paste the client_email value]
                                                                                                      GOOGLE_PROJECT_ID = [paste the project_id value]
                                                                                                      ```
                                                                                                      
                                                                                                      **Important:** When pasting the `GOOGLE_PRIVATE_KEY`, make sure to paste the entire key including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` parts.
                                                                                                      
                                                                                                      ### Step 4: Install Dependencies
                                                                                                      
                                                                                                      Run this command in your project root:
                                                                                                      ```bash
                                                                                                      npm install googleapis
                                                                                                      ```
                                                                                                      
                                                                                                      ### Step 5: Share Your Google Sheet with the Service Account
                                                                                                      
                                                                                                      1. Open your Google Sheet
                                                                                                      2. 2. Click the "Share" button
                                                                                                         3. 3. Paste the `client_email` from your JSON key
                                                                                                            4. 4. Give it **Editor** access
                                                                                                               5. 5. Click Share
                                                                                                                 
                                                                                                                  6. ### Step 6: Get Your Spreadsheet ID
                                                                                                                 
                                                                                                                  7. 1. Open your Google Sheet in a browser
                                                                                                                     2. 2. Look at the URL: `https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit`
                                                                                                                        3. 3. Copy the `YOUR_SPREADSHEET_ID` part
                                                                                                                          
                                                                                                                           4. ## Usage Examples
                                                                                                                          
                                                                                                                           5. ### Basic Setup in HTML
                                                                                                                          
                                                                                                                           6. ```html
                                                                                                                              <script src="/js/google-sheets-integration.js"></script>
                                                                                                                              <script>
                                                                                                                                // Initialize with your spreadsheet ID
                                                                                                                                const sheets = new GoogleSheets({
                                                                                                                                  spreadsheetId: 'YOUR_SPREADSHEET_ID_HERE'
                                                                                                                                });
                                                                                                                              </script>
                                                                                                                              ```
                                                                                                                              
                                                                                                                              ### Read Data
                                                                                                                              
                                                                                                                              ```javascript
                                                                                                                              // Read a range from your sheet
                                                                                                                              sheets.read('Sheet1!A1:D10').then(data => {
                                                                                                                                console.log('Data from sheet:', data);
                                                                                                                                // data is an array of arrays
                                                                                                                              });
                                                                                                                              ```
                                                                                                                              
                                                                                                                              ### Write Data
                                                                                                                              
                                                                                                                              ```javascript
                                                                                                                              // Write data to a specific range
                                                                                                                              const values = [
                                                                                                                                ['Name', 'Email', 'Phone'],
                                                                                                                                ['John Doe', 'john@example.com', '555-1234'],
                                                                                                                                ['Jane Smith', 'jane@example.com', '555-5678']
                                                                                                                              ];

                                                                                                                              sheets.write('Sheet1!A1', values).then(result => {
                                                                                                                                console.log('Data written successfully:', result);
                                                                                                                              });
                                                                                                                              ```
                                                                                                                              
                                                                                                                              ### Get Data as Objects
                                                                                                                              
                                                                                                                              ```javascript
                                                                                                                              // Read data and get it formatted as objects
                                                                                                                              sheets.getAsObjects('Sheet1!A1:D100').then(data => {
                                                                                                                                data.forEach(item => {
                                                                                                                                  console.log(`${item.Name}: ${item.Email}`);
                                                                                                                                });
                                                                                                                              });
                                                                                                                              ```
                                                                                                                              
                                                                                                                              ### Append Data
                                                                                                                              
                                                                                                                              ```javascript
                                                                                                                              // Add new rows to the sheet
                                                                                                                              const newRows = [
                                                                                                                                ['Alice Johnson', 'alice@example.com', '555-9999'],
                                                                                                                                ['Bob Wilson', 'bob@example.com', '555-8888']
                                                                                                                              ];

                                                                                                                              sheets.append('Sheet1!A:D', newRows).then(result => {
                                                                                                                                console.log('Rows appended:', result);
                                                                                                                              });
                                                                                                                              ```
                                                                                                                              
                                                                                                                              ## Integration with Admin Panel
                                                                                                                              
                                                                                                                              To integrate Google Sheets with your admin panel, add this to your `admin.html`:
                                                                                                                              
                                                                                                                              ```html
                                                                                                                              <script src="/js/google-sheets-integration.js"></script>
                                                                                                                              <script>
                                                                                                                                // In your admin.html JavaScript
                                                                                                                                const sheets = new GoogleSheets({
                                                                                                                                  spreadsheetId: 'YOUR_SPREADSHEET_ID'
                                                                                                                                });

                                                                                                                                // Example: Load inventory from Google Sheets
                                                                                                                                async function loadInventory() {
                                                                                                                                  try {
                                                                                                                                    const inventory = await sheets.getAsObjects('Inventory!A1:Z100');
                                                                                                                                    // Process and display inventory data
                                                                                                                                    console.log('Inventory:', inventory);
                                                                                                                                  } catch (error) {
                                                                                                                                    console.error('Error loading inventory:', error);
                                                                                                                                  }
                                                                                                                                }

                                                                                                                                // Example: Save new item to Google Sheets
                                                                                                                                async function saveNewItem(name, quantity, price) {
                                                                                                                                  try {
                                                                                                                                    const result = await sheets.append('Inventory!A:C', [
                                                                                                                                      [name, quantity, price]
                                                                                                                                    ]);
                                                                                                                                    console.log('Item saved:', result);
                                                                                                                                  } catch (error) {
                                                                                                                                    console.error('Error saving item:', error);
                                                                                                                                  }
                                                                                                                                }

                                                                                                                                // Load inventory on page load
                                                                                                                                loadInventory();
                                                                                                                              </script>
                                                                                                                              ```
                                                                                                                              
                                                                                                                              ## Troubleshooting
                                                                                                                              
                                                                                                                              ### "Spreadsheet ID not configured" Error
                                                                                                                              Make sure you've set the spreadsheet ID when creating the GoogleSheets instance.
                                                                                                                              
                                                                                                                              ### "API error" When Reading/Writing
                                                                                                                              Check that:
                                                                                                                              1. Environment variables are properly set in Vercel
                                                                                                                              2. 2. The Google Sheet is shared with the service account email
                                                                                                                                 3. 3. The range format is correct (e.g., 'Sheet1!A1:D10')
                                                                                                                                   
                                                                                                                                    4. ### 403 Forbidden Error
                                                                                                                                    5. The service account doesn't have access to the sheet. Make sure you've:
                                                                                                                                    6. 1. Shared the Google Sheet with the service account email
                                                                                                                                       2. 2. Given it Editor access (not just Viewer)
                                                                                                                                         
                                                                                                                                          3. ## API Reference
                                                                                                                                         
                                                                                                                                          4. ### GoogleSheets Class
                                                                                                                                         
                                                                                                                                          5. #### Constructor
                                                                                                                                          6. ```javascript
                                                                                                                                             new GoogleSheets({
                                                                                                                                               apiEndpoint: '/api/sheets',      // Default endpoint
                                                                                                                                               spreadsheetId: 'YOUR_SHEET_ID'
                                                                                                                                             })
                                                                                                                                             ```
                                                                                                                                             
                                                                                                                                             #### Methods
                                                                                                                                             
                                                                                                                                             - **`read(range)`** - Read data from a sheet range
                                                                                                                                             - - **`write(range, values)`** - Write data to a range
                                                                                                                                               - - **`append(range, values)`** - Append rows to a range
                                                                                                                                                 - - **`setSpreadsheetId(id)`** - Set or change the spreadsheet ID
                                                                                                                                                   - - **`getAsObjects(range)`** - Read data and format as objects with headers
                                                                                                                                                    
                                                                                                                                                     - All methods are asynchronous and return Promises.
                                                                                                                                                    
                                                                                                                                                     - ## Support
                                                                                                                                                    
                                                                                                                                                     - For more information about the Google Sheets API, visit:
                                                                                                                                                     - - [Google Sheets API Documentation](https://developers.google.com/sheets/api)
                                                                                                                                                       - - [Service Account Setup Guide](https://cloud.google.com/iam/docs/service-accounts)
                                                                                                                                                         - 
