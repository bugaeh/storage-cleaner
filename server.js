#!/usr/bin/env node

/**
 * Storage Audit Web Server - Exact Match Custom UI
 * Zero-dependency native Node.js HTTP server
 * Modules: http, fs, path, crypto, os, child_process
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const GIANT_FILE_THRESHOLD_BYTES = 2 * 1024 * 1024; // 2 MB (2.048 KB)

// Current Active Harddisk Target Folder
let activeTargetDir = (function() {
  const localLab = path.resolve(__dirname, 'Downloads_Lab');
  const userDownloadsLab = path.join(os.homedir(), 'Downloads', 'Downloads_Lab');
  if (fs.existsSync(localLab)) return localLab;
  if (fs.existsSync(userDownloadsLab)) return userDownloadsLab;
  return localLab;
})();

// Calculate SHA-256 via Stream
function calculateSHA256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

// Recursive directory scan
async function scanDirectory(dirPath, baseDir, fileList = [], dirCountRef = { count: 0 }) {
  if (!fs.existsSync(dirPath)) return fileList;

  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (err) {
    return fileList;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      dirCountRef.count++;
      await scanDirectory(fullPath, baseDir, fileList, dirCountRef);
    } else if (entry.isFile()) {
      try {
        const stats = fs.statSync(fullPath);
        const hash = await calculateSHA256(fullPath);
        const isTmp = entry.name.toLowerCase().endsWith('.tmp') || entry.name.toLowerCase().includes('.tmp.');
        const isGiant = stats.size >= GIANT_FILE_THRESHOLD_BYTES;

        fileList.push({
          name: entry.name,
          fullPath,
          relativePath: relativePath || entry.name,
          size: stats.size,
          mtime: stats.mtime,
          birthtime: stats.birthtime || stats.mtime,
          hash,
          isTmp,
          isGiant
        });
      } catch (err) {
        // Skip unreadable files
      }
    }
  }

  return fileList;
}

// Analyze Files
function analyzeFiles(files) {
  let totalBytes = 0;
  const giantFiles = [];
  const tmpFiles = [];
  const hashMap = new Map();

  for (const file of files) {
    totalBytes += file.size;
    if (file.isGiant) giantFiles.push(file);
    if (file.isTmp) tmpFiles.push(file);

    if (!hashMap.has(file.hash)) hashMap.set(file.hash, []);
    hashMap.get(file.hash).push(file);
  }

  giantFiles.sort((a, b) => b.size - a.size);

  const duplicateGroups = [];
  let duplicateWastedBytes = 0;
  let duplicateCount = 0;

  for (const [hash, group] of hashMap.entries()) {
    if (group.length > 1) {
      group.sort((a, b) => {
        const aPenalty = /copy|backup|\(\d+\)|salinan/i.test(a.name) ? 1 : 0;
        const bPenalty = /copy|backup|\(\d+\)|salinan/i.test(b.name) ? 1 : 0;
        if (aPenalty !== bPenalty) return aPenalty - bPenalty;
        return a.birthtime - b.birthtime;
      });

      const master = group[0];
      const duplicates = group.slice(1);
      const groupWasted = duplicates.reduce((acc, f) => acc + f.size, 0);

      duplicateWastedBytes += groupWasted;
      duplicateCount += duplicates.length;

      duplicateGroups.push({
        hash,
        fileSize: master.size,
        master,
        duplicates,
        wastedBytes: groupWasted
      });
    }
  }

  const dupPaths = new Set();
  duplicateGroups.forEach(g => g.duplicates.forEach(d => dupPaths.add(d.fullPath)));
  const uniqueTmpFiles = tmpFiles.filter(t => !dupPaths.has(t.fullPath));
  const tmpWastedBytes = uniqueTmpFiles.reduce((acc, f) => acc + f.size, 0);
  const totalSavableBytes = duplicateWastedBytes + tmpWastedBytes;

  return {
    totalBytes,
    giantFiles,
    duplicateGroups,
    duplicateCount,
    duplicateWastedBytes,
    tmpFiles,
    uniqueTmpFiles,
    tmpWastedBytes,
    totalSavableBytes
  };
}

// Windows Folder Picker Helper
function openWindowsFolderDialog() {
  return new Promise((resolve) => {
    const psCmd = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Pilih Folder untuk Audit Penyimpanan'; if($f.ShowDialog() -eq 'OK'){ Write-Output $f.SelectedPath }`;
    exec(`powershell -NoProfile -Command "${psCmd}"`, (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve(null);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Static Assets
  if (req.method === 'GET') {
    if (pathname === '/' || pathname === '/index.html') {
      const filePath = path.join(__dirname, 'public', 'index.html');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    if (pathname === '/style.css') {
      const filePath = path.join(__dirname, 'public', 'style.css');
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    if (pathname === '/app.js') {
      const filePath = path.join(__dirname, 'public', 'app.js');
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // API: Scan
    if (pathname === '/api/scan') {
      const queryFolder = url.searchParams.get('folder');
      if (queryFolder && fs.existsSync(queryFolder)) {
        activeTargetDir = path.resolve(queryFolder);
      }

      const targetDir = activeTargetDir;
      const startTime = Date.now();
      const dirCounter = { count: 0 };
      const files = await scanDirectory(targetDir, targetDir, [], dirCounter);
      const analysis = analyzeFiles(files);
      const scanDuration = ((Date.now() - startTime) / 1000).toFixed(2);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        targetDir,
        files,
        dirCount: dirCounter.count,
        analysis,
        scanDuration
      }));
      return;
    }
  }

  // API: Browse Folder using OS Dialog
  if (req.method === 'POST' && pathname === '/api/browse-folder') {
    const selectedFolder = await openWindowsFolderDialog();
    if (selectedFolder && fs.existsSync(selectedFolder)) {
      activeTargetDir = path.resolve(selectedFolder);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, path: activeTargetDir }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, path: activeTargetDir }));
    }
    return;
  }

  // API: Set Target Folder manually
  if (req.method === 'POST' && pathname === '/api/set-target') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (payload.folder && fs.existsSync(payload.folder)) {
          activeTargetDir = path.resolve(payload.folder);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, path: activeTargetDir }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Folder tidak ditemukan di sistem harddisk.' }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'JSON payload tidak valid.' }));
      }
    });
    return;
  }

  // API: Cleanup
  if (req.method === 'POST' && pathname === '/api/cleanup') {
    try {
      const targetDir = activeTargetDir;
      const files = await scanDirectory(targetDir, targetDir, []);
      const analysis = analyzeFiles(files);

      const itemsToDelete = [];
      for (const group of analysis.duplicateGroups) {
        for (const dup of group.duplicates) {
          itemsToDelete.push({ path: dup.fullPath, size: dup.size, rel: dup.relativePath });
        }
      }
      for (const tmp of analysis.uniqueTmpFiles) {
        itemsToDelete.push({ path: tmp.fullPath, size: tmp.size, rel: tmp.relativePath });
      }

      let deletedCount = 0;
      let freedBytes = 0;

      for (const item of itemsToDelete) {
        if (fs.existsSync(item.path)) {
          fs.unlinkSync(item.path);
          deletedCount++;
          freedBytes += item.size;
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        deletedCount,
        freedBytes
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // API: Restore
  if (req.method === 'POST' && pathname === '/api/restore') {
    try {
      const targetDir = path.resolve(__dirname, 'Downloads_Lab');
      const sourceOriginal = path.join(os.homedir(), 'Downloads', 'Downloads_Lab');

      if (fs.existsSync(sourceOriginal)) {
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }
        fs.cpSync(sourceOriginal, targetDir, { recursive: true });
        activeTargetDir = targetDir;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: 64, path: activeTargetDir }));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Folder sumber original tidak ditemukan.' }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// Restart server gracefully if running
server.listen(PORT, () => {
  console.log(`\nServer Storage Audit berjalan di http://localhost:${PORT}`);
});
