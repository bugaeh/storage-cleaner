#!/usr/bin/env node

/**
 * Storage Audit Utility - Downloads_Lab
 * Systems Engineering & Storage Optimizer
 * 
 * Standalone Node.js CLI Application (Zero external npm dependencies)
 * Native modules used: fs, path, crypto, readline, os
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const os = require('os');

// Ambang Batas Ukuran File Raksasa: 2 MB (2 * 1024 * 1024 = 2.097.152 bytes / 2.048 KB)
const GIANT_FILE_THRESHOLD_BYTES = 2 * 1024 * 1024;

// ANSI Colors & Text Styling
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  
  // Foreground
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // Bright Foreground
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  
  // Background
  bgBlue: '\x1b[44m',
  bgDarkGray: '\x1b[100m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
};

// Helper: Format Bytes ke format manusiawi (B, KB, MB, GB)
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${val.toLocaleString('id-ID')} ${sizes[i]}`;
}

// Helper: Garis pembatas
function drawLine(char = '─', length = 76, color = colors.gray) {
  console.log(`${color}${char.repeat(length)}${colors.reset}`);
}

// Helper: Header Banner
function renderHeader(targetFolder) {
  if (process.stdout.isTTY) {
    console.clear();
  }
  console.log(`${colors.brightCyan}╔════════════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.brightCyan}║ ${colors.bold}${colors.brightWhite}  ⚡ STORAGE AUDIT & DE-DUPLICATION ENGINE  ${colors.reset}                                 ${colors.brightCyan}║${colors.reset}`);
  console.log(`${colors.brightCyan}║ ${colors.dim}  Systems Engineering & Storage Cleaner v1.0.0 (Zero-Dependency)           ${colors.reset}${colors.brightCyan}║${colors.reset}`);
  console.log(`${colors.brightCyan}╚════════════════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`${colors.cyan}Target Audit Folder :${colors.reset} ${colors.bold}${colors.brightYellow}${targetFolder}${colors.reset}`);
  console.log(`${colors.cyan}Ambang File Raksasa :${colors.reset} ${colors.bold}> 2.048 KB (2,00 MB)${colors.reset}`);
  console.log(`${colors.cyan}Waktu Scan          :${colors.reset} ${new Date().toLocaleString('id-ID')}`);
  drawLine('━', 76, colors.blue);
}

// Helper: Hitung Hash SHA-256 secara streaming (Aman untuk file besar)
function calculateSHA256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

// Helper: Pindai direktori secara rekursif
async function scanDirectory(dirPath, baseDir, fileList = [], dirCountRef = { count: 0 }) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (err) {
    console.error(`${colors.red}[PERINGATAN] Gagal membaca direktori: ${dirPath} (${err.message})${colors.reset}`);
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
        if (process.stdout.isTTY) {
          process.stdout.write(`\r${colors.dim}Memindai: ${relativePath.padEnd(60).slice(0, 60)}${colors.reset}`);
        }
        const hash = await calculateSHA256(fullPath);

        const isTmp = entry.name.toLowerCase().endsWith('.tmp') || entry.name.toLowerCase().includes('.tmp.');
        const isGiant = stats.size >= GIANT_FILE_THRESHOLD_BYTES;

        fileList.push({
          name: entry.name,
          fullPath,
          relativePath,
          size: stats.size,
          mtime: stats.mtime,
          birthtime: stats.birthtime || stats.mtime,
          hash,
          isTmp,
          isGiant
        });
      } catch (fileErr) {
        // Lewati jika file terkunci atau gagal dibaca
        console.error(`\n${colors.yellow}[LEWATI] Tidak dapat mengakses ${relativePath}: ${fileErr.message}${colors.reset}`);
      }
    }
  }

  return fileList;
}

// Helper: Kelompokkan duplikat dan analisis
function analyzeFiles(files) {
  let totalBytes = 0;
  const giantFiles = [];
  const tmpFiles = [];
  const hashMap = new Map();

  for (const file of files) {
    totalBytes += file.size;

    if (file.isGiant) {
      giantFiles.push(file);
    }

    if (file.isTmp) {
      tmpFiles.push(file);
    }

    if (!hashMap.has(file.hash)) {
      hashMap.set(file.hash, []);
    }
    hashMap.get(file.hash).push(file);
  }

  // Sort giant files descending by size
  giantFiles.sort((a, b) => b.size - a.size);

  // Filter kelompok yang memiliki lebih dari 1 file (duplikat murni)
  const duplicateGroups = [];
  let duplicateWastedBytes = 0;
  let duplicateCount = 0;

  for (const [hash, group] of hashMap.entries()) {
    if (group.length > 1) {
      // Urutkan untuk menentukan file asli yang dipertahankan:
      // Prioritaskan file tanpa kata "copy", "backup", "_backup", " (1)" dll, lalu waktu pembuatan terawal
      group.sort((a, b) => {
        const aPenalty = /copy|backup|\(\d+\)|salinan/i.test(a.name) ? 1 : 0;
        const bPenalty = /copy|backup|\(\d+\)|salinan/i.test(b.name) ? 1 : 0;
        if (aPenalty !== bPenalty) return aPenalty - bPenalty;
        return a.birthtime - b.birthtime;
      });

      const master = group[0];
      const duplicates = group.slice(1);

      // Hitung kapasitas terbuang (ukuran duplikat saja, bukan file master)
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

  // Hitung ukuran file .tmp (hindari hitung ganda jika ada .tmp yang juga masuk duplikat)
  const duplicatePathsSet = new Set();
  duplicateGroups.forEach(g => g.duplicates.forEach(d => duplicatePathsSet.add(d.fullPath)));
  
  const uniqueTmpFiles = tmpFiles.filter(t => !duplicatePathsSet.has(t.fullPath));
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

// Render Laporan Terminal yang Rapi & Informatif
function printReport(files, dirCount, analysis) {
  if (process.stdout.isTTY) {
    process.stdout.write('\r' + ' '.repeat(76) + '\r'); // Clear scanning line
  }

  console.log(`\n${colors.bold}${colors.brightWhite}┌─ 📊 RINGKASAN AUDIT PENYIMPANAN ──────────────────────────────────────────┐${colors.reset}`);
  
  const colW = 28;
  const row = (label, val, highlight = colors.brightWhite) => {
    const paddedLabel = (label + ':').padEnd(colW);
    console.log(`${colors.dim}│${colors.reset}  ${colors.cyan}${paddedLabel}${colors.reset} ${highlight}${val}${colors.reset}`);
  };

  row('Total File Dipindai', `${files.length} file`);
  row('Total Subdirektori', `${dirCount} folder`);
  row('Total Kapasitas Folder', formatBytes(analysis.totalBytes), colors.brightYellow);
  row('File Raksasa (> 2 MB)', `${analysis.giantFiles.length} file`, analysis.giantFiles.length > 0 ? colors.brightMagenta : colors.green);
  row('Kelompok Duplikat', `${analysis.duplicateGroups.length} grup (${analysis.duplicateCount} file salinan)`, analysis.duplicateGroups.length > 0 ? colors.brightRed : colors.green);
  row('File Sampah (.tmp)', `${analysis.tmpFiles.length} file`, analysis.tmpFiles.length > 0 ? colors.yellow : colors.green);

  const savingsPercent = analysis.totalBytes > 0 
    ? ((analysis.totalSavableBytes / analysis.totalBytes) * 100).toFixed(1)
    : '0.0';

  console.log(`${colors.dim}├────────────────────────────────────────────────────────────────────────────┤${colors.reset}`);
  console.log(`${colors.dim}│${colors.reset}  ${colors.bold}${colors.brightGreen}ESTIMASI PENGHEMATAN RUANG : ${formatBytes(analysis.totalSavableBytes)} (${savingsPercent}% dari total)${colors.reset}`);
  console.log(`${colors.bold}${colors.brightWhite}└────────────────────────────────────────────────────────────────────────────┘${colors.reset}\n`);

  // 1. DAFTAR FILE RAKSASA
  console.log(`${colors.bold}${colors.brightMagenta}📦 [1] DAFTAR FILE RAKSASA (Ukuran > 2 MB / 2.048 KB)${colors.reset}`);
  if (analysis.giantFiles.length === 0) {
    console.log(`   ${colors.green}✔ Tidak ada file yang melebihi ambang batas 2 MB.${colors.reset}\n`);
  } else {
    drawLine('-', 76, colors.gray);
    console.log(`   ${colors.dim}No.${colors.reset}  ${colors.dim}${'Ukuran'.padEnd(12)}${colors.reset}  ${colors.dim}Path & Nama File${colors.reset}`);
    drawLine('-', 76, colors.gray);
    analysis.giantFiles.forEach((file, idx) => {
      const idxStr = `[${idx + 1}]`.padEnd(5);
      const sizeStr = formatBytes(file.size).padEnd(12);
      console.log(`   ${colors.brightMagenta}${idxStr}${colors.reset} ${colors.bold}${colors.brightYellow}${sizeStr}${colors.reset} ${colors.brightWhite}${file.relativePath}${colors.reset}`);
    });
    drawLine('-', 76, colors.gray);
    console.log('');
  }

  // 2. DAFTAR KELOMPOK DUPLIKAT
  console.log(`${colors.bold}${colors.brightRed}👥 [2] DAFTAR KELOMPOK FILE DUPLIKAT (Hash SHA-256 Identik)${colors.reset}`);
  if (analysis.duplicateGroups.length === 0) {
    console.log(`   ${colors.green}✔ Tidak ditemukan file duplikat.${colors.reset}\n`);
  } else {
    analysis.duplicateGroups.forEach((group, gIdx) => {
      const shortHash = group.hash.substring(0, 16) + '...';
      console.log(`\n   ${colors.bold}${colors.yellow}Grup #${gIdx + 1}${colors.reset} ${colors.gray}[SHA-256: ${shortHash}]${colors.reset} - Ukuran: ${colors.bold}${formatBytes(group.fileSize)}${colors.reset} (Potensi hemat: ${colors.brightRed}${formatBytes(group.wastedBytes)}${colors.reset})`);
      console.log(`   ${colors.green}  ✔ [ASLI DIPERTAHANKAN] : ${colors.brightWhite}${group.master.relativePath}${colors.reset}`);
      group.duplicates.forEach((dup) => {
        console.log(`   ${colors.red}  ✖ [SALINAN DUPLIKAT]   : ${colors.dim}${dup.relativePath}${colors.reset}`);
      });
    });
    console.log('');
  }

  // 3. DAFTAR FILE SAMPAH (.TMP)
  if (analysis.tmpFiles.length > 0) {
    console.log(`${colors.bold}${colors.yellow}🗑️  [3] FILE SAMPAH SEMENTARA (.tmp)${colors.reset}`);
    analysis.tmpFiles.forEach((tmp, idx) => {
      console.log(`   ${colors.yellow}  • ${tmp.relativePath} ${colors.dim}(${formatBytes(tmp.size)})${colors.reset}`);
    });
    console.log('');
  }
}

// Konfirmasi Interaktif Menggunakan readline
function promptConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Eksekusi Penghapusan Duplikat dan .tmp Sampah
function executeCleanup(analysis) {
  const itemsToDelete = [];

  // 1. Tambahkan semua salinan duplikat (TIDAK menyertakan file master asli!)
  for (const group of analysis.duplicateGroups) {
    for (const dup of group.duplicates) {
      itemsToDelete.push({
        type: 'DUPLIKAT',
        path: dup.fullPath,
        relPath: dup.relativePath,
        size: dup.size
      });
    }
  }

  // 2. Tambahkan file .tmp yang belum termasuk dalam duplikat
  for (const tmp of analysis.uniqueTmpFiles) {
    itemsToDelete.push({
      type: 'SAMPAH_TMP',
      path: tmp.fullPath,
      relPath: tmp.relativePath,
      size: tmp.size
    });
  }

  if (itemsToDelete.length === 0) {
    console.log(`\n${colors.green}✔ Tidak ada file yang perlu dihapus.${colors.reset}\n`);
    return;
  }

  console.log(`\n${colors.bold}${colors.brightCyan}Menginisialisasi pembersihan aman...${colors.reset}`);
  drawLine('-', 76, colors.gray);

  let deletedCount = 0;
  let freedBytes = 0;
  let failedCount = 0;

  for (const item of itemsToDelete) {
    try {
      if (fs.existsSync(item.path)) {
        fs.unlinkSync(item.path);
        deletedCount++;
        freedBytes += item.size;
        console.log(`   ${colors.red}[DIHAPUS]${colors.reset} [${item.type}] ${item.relPath} ${colors.dim}(-${formatBytes(item.size)})${colors.reset}`);
      }
    } catch (err) {
      failedCount++;
      console.error(`   ${colors.brightRed}[GAGAL]${colors.reset} Tidak dapat menghapus ${item.relPath}: ${err.message}`);
    }
  }

  drawLine('━', 76, colors.brightGreen);
  console.log(`${colors.bold}${colors.brightGreen}🎉 PEMBERSIHAN SELESAI DENGAN SUKSES!${colors.reset}`);
  console.log(`   ${colors.cyan}Total File Dihapus  :${colors.reset} ${colors.bold}${deletedCount} file${colors.reset}`);
  if (failedCount > 0) {
    console.log(`   ${colors.red}File Gagal Dihapus  :${colors.reset} ${colors.bold}${failedCount} file${colors.reset}`);
  }
  console.log(`   ${colors.cyan}Ruang Disk Bebas    :${colors.reset} ${colors.bold}${colors.brightYellow}${formatBytes(freedBytes)}${colors.reset}`);
  console.log(`   ${colors.green}Semua 1 file asli per kelompok duplikat dan file penting tetap utuh aman.${colors.reset}\n`);
}

// MAIN EXECUTION FLOW
async function main() {
  if (process.argv.includes('--web') || process.argv.includes('-w')) {
    require('./server.js');
    return;
  }

  const customTarget = process.argv.slice(2).find(arg => !arg.startsWith('-'));
  const targetDir = customTarget 
    ? path.resolve(process.cwd(), customTarget) 
    : path.resolve(process.cwd(), 'Downloads_Lab');

  renderHeader(targetDir);

  if (!fs.existsSync(targetDir)) {
    console.log(`\n${colors.red}❌ Folder target tidak ditemukan:${colors.reset} ${targetDir}`);
    console.log(`${colors.yellow}Petunjuk:${colors.reset} Pastikan folder "Downloads_Lab" berada di direktori ini atau tentukan path folder:`);
    console.log(`  ${colors.cyan}node storage_audit.js <path_folder>${colors.reset}\n`);
    process.exit(1);
  }

  const dirStat = fs.statSync(targetDir);
  if (!dirStat.isDirectory()) {
    console.log(`\n${colors.red}❌ Path target bukan sebuah folder:${colors.reset} ${targetDir}\n`);
    process.exit(1);
  }

  console.log(`${colors.bold}${colors.cyan}Memulai proses audit & hashing SHA-256 rekursif...${colors.reset}`);
  const startTime = Date.now();

  const dirCounter = { count: 0 };
  const files = await scanDirectory(targetDir, targetDir, [], dirCounter);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  if (files.length === 0) {
    process.stdout.write('\r' + ' '.repeat(76) + '\r');
    console.log(`\n${colors.yellow}ℹ️ Folder "Downloads_Lab" kosong. Tidak ada file untuk diaudit.${colors.reset}\n`);
    process.exit(0);
  }

  const analysis = analyzeFiles(files);
  printReport(files, dirCounter.count, analysis);

  console.log(`${colors.dim}Audit selesai dalam waktu ${durationSec} detik.${colors.reset}\n`);

  // Prompt Konfirmasi Interaktif jika ada duplikat atau sampah .tmp
  const totalItemsRemovable = analysis.duplicateCount + analysis.uniqueTmpFiles.length;

  if (totalItemsRemovable > 0) {
    const questionText = `${colors.bold}${colors.brightYellow}❓ Apakah kamu ingin menghapus file duplikat yang tidak terpakai? (Yes/No): ${colors.reset}`;
    const answer = await promptConfirmation(questionText);

    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      executeCleanup(analysis);
    } else {
      console.log(`\n${colors.yellow}Operasi dibatalkan oleh pengguna. Tidak ada file yang dihapus.${colors.reset}\n`);
    }
  } else {
    console.log(`${colors.brightGreen}✨ Sistem penyimpanan Anda sudah optimal! Tidak ditemukan duplikat atau file sampah.${colors.reset}\n`);
  }
}

// Tangani interupsi sinyal Ctrl+C dengan rapi
process.on('SIGINT', () => {
  console.log(`\n\n${colors.yellow}Audit dihentikan oleh pengguna (SIGINT). Keluar...${colors.reset}\n`);
  process.exit(0);
});

// Jalankan program
main().catch((err) => {
  console.error(`\n${colors.brightRed}Terjadi kesalahan fatal:${colors.reset}`, err);
  process.exit(1);
});
