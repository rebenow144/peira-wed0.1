const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());

// 🔧 ใส่ path ไฟล์ CSV ให้ถูกต้อง
const csvFilePath = 'C:/Users/Atipat/Desktop/New_Bang/PM_11-07-2025.csv';

// 📥 ฟังก์ชันอ่านแถวล่าสุด
function getLatestRow(callback) {
  const rows = [];
  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (data) => {
      rows.push(data);
    })
    .on('end', () => {
      if (rows.length > 0) {
        callback(rows[rows.length - 1]);
      } else {
        callback(null);
      }
    })
    .on('error', (err) => {
      console.error('CSV read error:', err.message);
      callback(null);
    });
}

// 🕐 ฟังก์ชันแปลงวันที่/เวลา (ปรับปรุงแล้ว)
function parseDateTime(dateStr, timeStr) {
  try {
    // ลองหลายรูปแบบ
    const formats = [
      // รูปแบบ: DD/MM/YYYY HH:mm:ss
      () => {
        const [day, month, year] = dateStr.split('/');
        return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${timeStr}`);
      },
      // รูปแบบ: MM/DD/YYYY HH:mm:ss
      () => {
        const [month, day, year] = dateStr.split('/');
        return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${timeStr}`);
      },
      // รูปแบบ: YYYY-MM-DD HH:mm:ss
      () => new Date(`${dateStr} ${timeStr}`),
      // รูปแบบ: DD-MM-YYYY HH:mm:ss
      () => {
        const [day, month, year] = dateStr.split('-');
        return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${timeStr}`);
      }
    ];

    for (const format of formats) {
      const date = format();
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // หากไม่สำเร็จ ลองแปลงแบบง่าย
    return new Date(`${dateStr} ${timeStr}`);
  } catch (error) {
    console.error('Date parsing error:', error.message);
    return null;
  }
}

// ✅ Endpoint 1: /latest — แสดงแถวล่าสุด
app.get('/latest', (req, res) => {
  getLatestRow((latest) => {
    if (latest) {
      res.json(latest);
    } else {
      res.status(500).json({ error: 'No data found' });
    }
  });
});

// ✅ Endpoint 2: /debug — ตรวจสอบข้อมูล (เพิ่มใหม่)
app.get('/debug', (req, res) => {
  const rows = [];
  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (data) => {
      rows.push(data);
    })
    .on('end', () => {
      if (rows.length === 0) {
        return res.status(500).json({ error: 'No data found' });
      }

      // ดูข้อมูล 5 แถวล่าสุด
      const latest5 = rows.slice(-5).map(row => {
        const timestamp = parseDateTime(row.Date, row.Time);
        return {
          originalDate: row.Date,
          originalTime: row.Time,
          parsedTimestamp: timestamp ? timestamp.toISOString() : 'INVALID',
          isValid: timestamp && !isNaN(timestamp.getTime())
        };
      });

      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);

      res.json({
        totalRows: rows.length,
        currentTime: now.toISOString(),
        fiveMinutesAgo: fiveMinutesAgo.toISOString(),
        latest5Rows: latest5,
        sampleRow: rows[0] // ดูโครงสร้างข้อมูล
      });
    })
    .on('error', (err) => {
      console.error('CSV read error:', err.message);
      res.status(500).json({ error: 'CSV read error' });
    });
});

// ✅ Endpoint 3: /latest-summary — คำนวณค่าสถิติ (ปรับปรุงแล้ว)
app.get('/latest-summary', (req, res) => {
  const rows = [];
  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (data) => {
      rows.push(data);
    })
    .on('end', () => {
      if (rows.length === 0) {
        return res.status(500).json({ error: 'No data found' });
      }

      // เวลาปัจจุบันของระบบ (Thailand timezone)
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);

      console.log('🕐 Current time:', now.toISOString());
      console.log('🕐 Five minutes ago:', fiveMinutesAgo.toISOString());

      // รวมข้อมูล timestamp ใหม่ในแต่ละแถว
      const enrichedRows = rows.map(row => {
        const timestamp = parseDateTime(row.Date, row.Time);
        return { ...row, timestamp };
      }).filter(row => row.timestamp && !isNaN(row.timestamp.getTime()));

      console.log('✅ Total valid rows:', enrichedRows.length);

      if (enrichedRows.length === 0) {
        return res.status(500).json({ error: 'No valid timestamp data found' });
      }

      // ดึงเฉพาะข้อมูลในช่วง 5 นาที
      const recentRows = enrichedRows.filter(row => {
        const isInRange = row.timestamp >= fiveMinutesAgo && row.timestamp <= now;
        if (isInRange) {
          console.log('📊 Found recent row:', row.Date, row.Time, row.timestamp.toISOString());
        }
        return isInRange;
      });

      console.log('📊 Recent rows count:', recentRows.length);

      if (recentRows.length === 0) {
        // แสดงข้อมูลล่าสุดเพื่อ debug
        const latestRow = enrichedRows[enrichedRows.length - 1];
        console.log('🔍 Latest row timestamp:', latestRow.timestamp.toISOString());
        console.log('🔍 Time difference (minutes):', (now - latestRow.timestamp) / 60000);
        
        return res.status(404).json({ 
          error: 'No data in last 5 minutes',
          debug: {
            latestDataTime: latestRow.timestamp.toISOString(),
            currentTime: now.toISOString(),
            minutesAgo: Math.round((now - latestRow.timestamp) / 60000)
          }
        });
      }

      // คำนวณค่าเฉลี่ย min max
      const numericKeys = Object.keys(rows[0]).filter(k => k !== 'Date' && k !== 'Time');
      const stats = {};

      numericKeys.forEach(key => {
        const values = recentRows.map(row => parseFloat(row[key])).filter(v => !isNaN(v));
        if (values.length > 0) {
          stats[key] = {
            min: Math.min(...values).toFixed(2),
            max: Math.max(...values).toFixed(2),
            avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)
          };
        }
      });

      res.json({
        timeRange: {
          start: fiveMinutesAgo.toISOString(),
          end: now.toISOString()
        },
        dataPoints: recentRows.length,
        stats
      });
    })
    .on('error', (err) => {
      console.error('CSV read error:', err.message);
      res.status(500).json({ error: 'CSV read error' });
    });
});

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`📡 Server running at http://localhost:${PORT}`);
  console.log(`🔍 Debug endpoint: http://localhost:${PORT}/debug`);
  console.log(`📊 Latest data: http://localhost:${PORT}/latest`);
  console.log(`📈 Summary: http://localhost:${PORT}/latest-summary`);
});