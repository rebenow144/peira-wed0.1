const express = require('express');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());

// 📁 โฟลเดอร์ที่เก็บไฟล์ CSV
const csvDirectory = 'C:/Users/Atipat/Desktop/New_Bang/';

// 🗓️ ฟังก์ชันสร้างชื่อไฟล์ตามวันที่ปัจจุบัน
function getCurrentCsvPath() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  
  const filename = `PM_${day}-${month}-${year}.csv`;
  return path.join(csvDirectory, filename);
}

// 🔍 ฟังก์ชันหาไฟล์ CSV ที่มีอยู่
function findAvailableCsvFile() {
  const todayFile = getCurrentCsvPath();
  
  // ลองไฟล์วันนี้ก่อน
  if (fs.existsSync(todayFile)) {
    console.log(`📁 Using today's file: ${todayFile}`);
    return todayFile;
  }
  
  // ถ้าไม่มี ลองหาไฟล์ล่าสุด
  try {
    const files = fs.readdirSync(csvDirectory)
      .filter(file => file.startsWith('PM_') && file.endsWith('.csv'))
      .sort()
      .reverse();
    
    if (files.length > 0) {
      const latestFile = path.join(csvDirectory, files[0]);
      console.log(`📁 Using latest file: ${latestFile}`);
      return latestFile;
    }
  } catch (error) {
    console.error('❌ Error reading directory:', error.message);
  }
  
  console.error('❌ No CSV files found');
  return null;
}

// 🕐 ฟังก์ชันแปลงวันที่/เวลา
function parseDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  
  try {
    // ลองรูปแบบ DD/MM/YYYY HH:mm:ss
    if (dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/');
      const dateTime = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${timeStr}`);
      if (!isNaN(dateTime.getTime())) {
        return dateTime;
      }
    }
    
    // ลองรูปแบบ DD-MM-YYYY HH:mm:ss
    if (dateStr.includes('-')) {
      const [day, month, year] = dateStr.split('-');
      const dateTime = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${timeStr}`);
      if (!isNaN(dateTime.getTime())) {
        return dateTime;
      }
    }
    
    // ลองรูปแบบ YYYY-MM-DD HH:mm:ss
    const dateTime = new Date(`${dateStr} ${timeStr}`);
    if (!isNaN(dateTime.getTime())) {
      return dateTime;
    }
    
    return null;
  } catch (error) {
    console.error('Date parsing error:', error.message);
    return null;
  }
}

// 📊 ฟังก์ชันคำนวณสถิติ
function calculateStats(values) {
  if (!values || values.length === 0) return null;
  
  const numbers = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
  if (numbers.length === 0) return null;
  
  return {
    min: Math.min(...numbers).toFixed(2),
    max: Math.max(...numbers).toFixed(2),
    avg: (numbers.reduce((a, b) => a + b, 0) / numbers.length).toFixed(2)
  };
}

// 📥 ฟังก์ชันอ่านข้อมูลจาก CSV
function readCsvData(callback) {
  const csvPath = findAvailableCsvFile();
  
  if (!csvPath) {
    return callback(null, 'No CSV file found');
  }
  
  const rows = [];
  
  fs.createReadStream(csvPath)
    .pipe(csv())
    .on('data', (data) => {
      rows.push(data);
    })
    .on('end', () => {
      callback(rows, null, csvPath);
    })
    .on('error', (err) => {
      console.error('CSV read error:', err.message);
      callback(null, 'CSV read error: ' + err.message);
    });
}

// ✅ Endpoint 1: /latest
app.get('/latest', (req, res) => {
  readCsvData((rows, error, csvPath) => {
    if (error) {
      return res.status(500).json({ error: error });
    }
    
    if (!rows || rows.length === 0) {
      return res.status(500).json({ error: 'No data found' });
    }
    
    const latest = rows[rows.length - 1];
    res.json({
      ...latest,
      csvFile: path.basename(csvPath)
    });
  });
});

// ✅ Endpoint 2: /debug
app.get('/debug', (req, res) => {
  readCsvData((rows, error, csvPath) => {
    if (error) {
      return res.status(500).json({ error: error });
    }
    
    if (!rows || rows.length === 0) {
      return res.status(500).json({ error: 'No data found' });
    }
    
    const latest5 = rows.slice(-5).map(row => {
      const timestamp = parseDateTime(row.Date, row.Time);
      return {
        originalDate: row.Date,
        originalTime: row.Time,
        parsedTimestamp: timestamp ? timestamp.toISOString() : 'INVALID',
        isValid: timestamp && !isNaN(timestamp.getTime())
      };
    });
    
    res.json({
      totalRows: rows.length,
      currentTime: new Date().toISOString(),
      csvFile: path.basename(csvPath),
      csvPath: csvPath,
      latest5Rows: latest5,
      sampleRow: rows[0]
    });
  });
});

// ✅ Endpoint 3: /stats/:hours
app.get('/stats/:hours', (req, res) => {
  const hours = parseInt(req.params.hours);
  
  if (isNaN(hours) || hours <= 0) {
    return res.status(400).json({ error: 'Invalid hours parameter' });
  }
  
  readCsvData((rows, error, csvPath) => {
    if (error) {
      return res.status(500).json({ error: error });
    }
    
    if (!rows || rows.length === 0) {
      return res.status(500).json({ error: 'No data found' });
    }
    
    const now = new Date();
    const timeAgo = new Date(now.getTime() - hours * 60 * 60 * 1000);
    
    // กรองข้อมูลที่มี timestamp ถูกต้อง
    const validRows = rows.map(row => {
      const timestamp = parseDateTime(row.Date, row.Time);
      return { ...row, timestamp };
    }).filter(row => row.timestamp && !isNaN(row.timestamp.getTime()));
    
    if (validRows.length === 0) {
      return res.status(500).json({ error: 'No valid timestamp data found' });
    }
    
    // กรองข้อมูลในช่วงเวลาที่ต้องการ
    const recentRows = validRows.filter(row => {
      return row.timestamp >= timeAgo && row.timestamp <= now;
    });
    
    if (recentRows.length === 0) {
      const latestRow = validRows[validRows.length - 1];
      const hoursAgo = Math.round((now - latestRow.timestamp) / (1000 * 60 * 60));
      
      return res.status(404).json({
        error: `No data in last ${hours} hours`,
        debug: {
          latestDataTime: latestRow.timestamp.toISOString(),
          currentTime: now.toISOString(),
          hoursAgo: hoursAgo,
          csvFile: path.basename(csvPath)
        }
      });
    }
    
    // คำนวณสถิติ
    const numericColumns = Object.keys(rows[0]).filter(key => 
      key !== 'Date' && key !== 'Time' && key !== 'timestamp'
    );
    
    const stats = {};
    numericColumns.forEach(column => {
      const values = recentRows.map(row => row[column]);
      const columnStats = calculateStats(values);
      if (columnStats) {
        stats[column] = columnStats;
      }
    });
    
    res.json({
      timeRange: {
        start: timeAgo.toISOString(),
        end: now.toISOString(),
        hours: hours
      },
      dataPoints: recentRows.length,
      stats: stats,
      csvFile: path.basename(csvPath)
    });
  });
});

// ✅ Endpoint 4: /files
app.get('/files', (req, res) => {
  try {
    if (!fs.existsSync(csvDirectory)) {
      return res.status(500).json({ error: 'CSV directory not found' });
    }
    
    const files = fs.readdirSync(csvDirectory)
      .filter(file => file.startsWith('PM_') && file.endsWith('.csv'))
      .map(file => {
        const filePath = path.join(csvDirectory, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          modified: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));
    
    res.json({
      currentFile: getCurrentCsvPath(),
      availableFiles: files,
      directory: csvDirectory
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error reading files', 
      details: error.message 
    });
  }
});

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`📡 Server running at http://localhost:${PORT}`);
  console.log(`🔍 Available endpoints:`);
  console.log(`   - GET /latest        - Latest data row`);
  console.log(`   - GET /debug         - Debug information`);
  console.log(`   - GET /stats/3       - Stats for last 3 hours`);
  console.log(`   - GET /stats/12      - Stats for last 12 hours`);
  console.log(`   - GET /stats/24      - Stats for last 24 hours`);
  console.log(`   - GET /files         - List CSV files`);
  console.log(`📁 CSV Directory: ${csvDirectory}`);
  console.log(`📁 Today's file: ${getCurrentCsvPath()}`);
});