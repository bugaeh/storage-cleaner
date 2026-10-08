const fs = require('fs');
const path = require('path');
const os = require('os');

const targetDir = path.join(__dirname, 'Downloads_Lab');
const sourceOriginal = path.join(os.homedir(), 'Downloads', 'Downloads_Lab');

function restoreLab() {
  if (fs.existsSync(sourceOriginal)) {
    console.log(`Menyinkronkan data laboratorium asli dari: ${sourceOriginal}`);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.cpSync(sourceOriginal, targetDir, { recursive: true });
    console.log(`Berhasil memulihkan 64 file asli ke: ${targetDir}`);
  } else {
    console.log(`Folder asli tidak ditemukan di ${sourceOriginal}.`);
  }
}

restoreLab();
