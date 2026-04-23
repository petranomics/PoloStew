// js/google-sheets-integration.js
// Frontend library for Google Sheets integration
// Usage: Import this file and use the GoogleSheets class

class GoogleSheets {
    constructor(config = {}) {
          this.apiEndpoint = config.apiEndpoint || '/api/sheets';
          this.spreadsheetId = config.spreadsheetId || '';
    }

  /**
     * Read data from a Google Sheet
     * @param {string} range - Sheet range (e.g., 'Sheet1!A1:D10')
     * @returns {Promise<Array>} Array of rows
     */
  async read(range) {
        if (!this.spreadsheetId) {
                throw new Error('Spreadsheet ID not configured');
        }

      try {
              const response = await fetch(this.apiEndpoint, {
                        method: 'POST',
                        headers: {
                                    'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                                    action: 'read',
                                    spreadsheetId: this.spreadsheetId,
                                    range: range,
                        }),
              });

          if (!response.ok) {
                    throw new Error(`API error: ${response.statusText}`);
          }

          const result = await response.json();
              return result.data || [];
      } catch (error) {
              console.error('Error reading from Google Sheets:', error);
              throw error;
      }
  }

  /**
     * Write data to a Google Sheet
     * @param {string} range - Sheet range (e.g., 'Sheet1!A1')
     * @param {Array<Array>} values - 2D array of values to write
     * @returns {Promise<Object>} Write operation result
     */
  async write(range, values) {
        if (!this.spreadsheetId) {
                throw new Error('Spreadsheet ID not configured');
        }

      if (!Array.isArray(values) || !Array.isArray(values[0])) {
              throw new Error('Values must be a 2D array');
      }

      try {
              const response = await fetch(this.apiEndpoint, {
                        method: 'POST',
                        headers: {
                                    'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                                    action: 'write',
                                    spreadsheetId: this.spreadsheetId,
                                    range: range,
                                    values: values,
                        }),
              });

          if (!response.ok) {
                    throw new Error(`API error: ${response.statusText}`);
          }

          return await response.json();
      } catch (error) {
              console.error('Error writing to Google Sheets:', error);
              throw error;
      }
  }

  /**
     * Append data to a Google Sheet (adds new rows)
     * @param {string} range - Sheet range (e.g., 'Sheet1!A:D')
     * @param {Array<Array>} values - Rows to append
     * @returns {Promise<Object>} Append operation result
     */
  async append(range, values) {
        // Note: This uses the write function for now
      // In production, you'd want to implement the append method separately
      return this.write(range, values);
  }

  /**
     * Set the spreadsheet ID
     * @param {string} id - Google Sheets spreadsheet ID
     */
  setSpreadsheetId(id) {
        this.spreadsheetId = id;
  }

  /**
     * Get formatted data for display
     * @param {string} range - Sheet range
     * @returns {Promise<Array<Object>>} Array of objects with column headers as keys
     */
  async getAsObjects(range) {
        const data = await this.read(range);
        if (data.length === 0) return [];

      const headers = data[0];
        return data.slice(1).map(row => {
                const obj = {};
                headers.forEach((header, index) => {
                          obj[header] = row[index] || '';
                });
                return obj;
        });
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoogleSheets;
}
