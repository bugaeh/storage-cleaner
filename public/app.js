/**
 * Storage Audit & Cleaner - Exact Match Client Logic
 */

let appData = null;

// DOM Elements
const el = {
  targetHarddiskPath: document.getElementById('targetHarddiskPath'),
  btnPindaiUlang: document.getElementById('btnPindaiUlang'),
  pindaiIcon: document.getElementById('pindaiIcon'),
  btnBersihkan: document.getElementById('btnBersihkan'),

  btnBrowseDialog: document.getElementById('btnBrowseDialog'),
  btnUploadFolder: document.getElementById('btnUploadFolder'),
  folderInputHidden: document.getElementById('folderInputHidden'),
  btnInputPath: document.getElementById('btnInputPath'),

  emptyStateHero: document.getElementById('emptyStateHero'),
  heroBtnBrowse: document.getElementById('heroBtnBrowse'),
  heroFolderInput: document.getElementById('heroFolderInput'),
  heroBtnInput: document.getElementById('heroBtnInput'),

  valTotalFiles: document.getElementById('valTotalFiles'),
  valTotalCapacity: document.getElementById('valTotalCapacity'),
  valGiantFiles: document.getElementById('valGiantFiles'),
  valSavings: document.getElementById('valSavings'),

  giantCountBadge: document.getElementById('giantCountBadge'),
  giantSearchInput: document.getElementById('giantSearchInput'),
  giantTableRows: document.getElementById('giantTableRows'),

  dupCountBadge: document.getElementById('dupCountBadge'),
  duplicateCardsArea: document.getElementById('duplicateCardsArea'),

  toastSearch: document.getElementById('toastSearch'),
  toastConnect: document.getElementById('toastConnect'),
  toastConnectText: document.getElementById('toastConnectText'),

  inputPathModal: document.getElementById('inputPathModal'),
  manualPathInput: document.getElementById('manualPathInput'),
  btnClosePathModal: document.getElementById('btnClosePathModal'),
  btnCancelPathModal: document.getElementById('btnCancelPathModal'),
  btnApplyPathModal: document.getElementById('btnApplyPathModal'),

  cleanConfirmModal: document.getElementById('cleanConfirmModal'),
  cleanModalCount: document.getElementById('cleanModalCount'),
  cleanModalFreed: document.getElementById('cleanModalFreed'),
  btnCloseCleanModal: document.getElementById('btnCloseCleanModal'),
  btnCancelCleanModal: document.getElementById('btnCancelCleanModal'),
  btnExecuteClean: document.getElementById('btnExecuteClean')
};

// Format Bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${val} ${sizes[i]}`;
}

// Show Floating Toast
function triggerToasts(folderPath) {
  el.toastSearch.style.display = 'flex';
  el.toastConnect.style.display = 'none';

  setTimeout(() => {
    el.toastConnectText.textContent = `Berhasil terhubung langsung ke harddisk: ${folderPath}`;
    el.toastConnect.style.display = 'flex';
  }, 600);

  setTimeout(() => {
    el.toastSearch.style.display = 'none';
  }, 4000);

  setTimeout(() => {
    el.toastConnect.style.display = 'none';
  }, 6000);
}

// Fetch and Scan Active Folder
async function runAuditScan(folderParam = null) {
  try {
    el.btnPindaiUlang.disabled = true;
    el.pindaiIcon.classList.add('spin');

    const url = folderParam 
      ? `/api/scan?folder=${encodeURIComponent(folderParam)}`
      : '/api/scan';

    const res = await fetch(url);
    if (!res.ok) throw new Error('Gagal menghubungi server');

    appData = await res.json();
    renderData(appData);
    triggerToasts(appData.targetDir);
  } catch (err) {
    console.error(err);
    alert('Gagal memindai folder: ' + err.message);
  } finally {
    el.btnPindaiUlang.disabled = false;
    el.pindaiIcon.classList.remove('spin');
  }
}

// Render data onto UI
function renderData(data) {
  const { targetDir, files, analysis } = data;

  if (files.length === 0) {
    el.emptyStateHero.style.display = 'block';
  } else {
    el.emptyStateHero.style.display = 'none';
  }

  el.targetHarddiskPath.textContent = targetDir;
  el.targetHarddiskPath.title = targetDir;

  // 4 Stats Cards
  el.valTotalFiles.textContent = files.length;
  el.valTotalCapacity.textContent = formatBytes(analysis.totalBytes);
  el.valGiantFiles.textContent = analysis.giantFiles.length;
  el.valSavings.textContent = formatBytes(analysis.totalSavableBytes);

  // Badges
  el.giantCountBadge.textContent = `${analysis.giantFiles.length} file`;
  el.dupCountBadge.textContent = `${analysis.duplicateGroups.length} grup (${analysis.duplicateCount} duplikat)`;

  // Render Table
  renderGiantTable(analysis.giantFiles);
  renderDuplicates(analysis.duplicateGroups);
}

// Render Giant Files Table
function renderGiantTable(giantFiles) {
  const query = el.giantSearchInput.value.trim().toLowerCase();
  el.giantTableRows.innerHTML = '';

  const filtered = giantFiles.filter(f => {
    if (!query) return true;
    return f.name.toLowerCase().includes(query) || f.fullPath.toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    el.giantTableRows.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 32px; color: #64748b;">
          Tidak ada file raksasa yang cocok dengan pencarian.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(file => {
    const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
    const tr = document.createElement('tr');

    // SVG icon based on extension
    let iconSvg = `
      <svg class="file-icon-doc" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
        <polyline points="13 2 13 9 20 9"></polyline>
      </svg>
    `;

    if (['MP4', 'MKV', 'AVI'].includes(ext)) {
      iconSvg = `
        <svg class="file-icon-doc" style="color: #a855f7;" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm6 4v8l6-4-6-4z"/>
        </svg>
      `;
    } else if (['ZIP', 'RAR', '7Z'].includes(ext)) {
      iconSvg = `
        <svg class="file-icon-doc" style="color: #ec4899;" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 10h-4v-2h4v2zm0-4h-4v-2h4v2z"/>
        </svg>
      `;
    } else if (['PPTX', 'PPT'].includes(ext)) {
      iconSvg = `
        <svg class="file-icon-doc" style="color: #f59e0b;" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
        </svg>
      `;
    }

    tr.innerHTML = `
      <td>
        <div class="file-name-cell">
          ${iconSvg}
          <span>${file.name}</span>
        </div>
      </td>
      <td>
        <div class="path-cell" title="${file.fullPath}">${file.fullPath}</div>
      </td>
      <td>
        <span class="size-cell">${formatBytes(file.size)}</span>
      </td>
      <td>
        <span class="format-pill">${ext}</span>
      </td>
    `;
    el.giantTableRows.appendChild(tr);
  });
}

// Render Duplicate Groups
function renderDuplicates(groups) {
  el.duplicateCardsArea.innerHTML = '';
  if (groups.length === 0) {
    el.duplicateCardsArea.innerHTML = `
      <div style="text-align: center; padding: 24px; color: #10b981; font-weight: 600;">
        ✔ Tidak ada file duplikat! Seluruh file unik dan kapasitas optimal.
      </div>
    `;
    return;
  }

  groups.slice(0, 8).forEach((g, idx) => {
    const wrap = document.createElement('div');
    wrap.style.marginBottom = '10px';

    wrap.innerHTML = `
      <div style="font-size: 0.78rem; font-weight: 700; color: #f59e0b; margin-bottom: 4px;">
        Grup #${idx + 1} (${formatBytes(g.fileSize)} per file - Potensi hemat: ${formatBytes(g.wastedBytes)})
      </div>
      <div class="dup-row master-row">
        <span style="font-weight: 600; color: #fff;">✔ [ASLI] ${g.master.name}</span>
        <span style="font-size: 0.75rem; color: #10b981; font-weight: 700;">DIPERTAHANKAN</span>
      </div>
      ${g.duplicates.map(d => `
        <div class="dup-row copy-row" style="margin-top: 4px;">
          <span style="color: #94a3b8;">✖ [SALINAN] ${d.name}</span>
          <span style="font-size: 0.75rem; color: #ef4444; font-weight: 700;">AKAN DIHAPUS</span>
        </div>
      `).join('')}
    `;
    el.duplicateCardsArea.appendChild(wrap);
  });

  if (groups.length > 8) {
    const moreNote = document.createElement('div');
    moreNote.style.textAlign = 'center';
    moreNote.style.fontSize = '0.8rem';
    moreNote.style.color = '#64748b';
    moreNote.style.padding = '8px';
    moreNote.textContent = `...dan ${groups.length - 8} kelompok duplikat lainnya terdeteksi.`;
    el.duplicateCardsArea.appendChild(moreNote);
  }
}

// Browse OS Folder Dialog
async function handleBrowseDialog() {
  try {
    const res = await fetch('/api/browse-folder', { method: 'POST' });
    const data = await res.json();
    if (data.success && data.path) {
      await runAuditScan(data.path);
    }
  } catch (err) {
    console.error(err);
  }
}

// Webkit Directory Browser Upload
function handleFolderSelect(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  const firstFile = files[0];
  const fullRelative = firstFile.webkitRelativePath || '';
  const topFolder = fullRelative.split('/')[0] || 'Selected Folder';

  // Inform and scan
  runAuditScan();
}

// Manual Path Modal
function openPathModal() {
  el.manualPathInput.value = el.targetHarddiskPath.textContent.trim();
  el.inputPathModal.classList.add('open');
}

function closePathModal() {
  el.inputPathModal.classList.remove('open');
}

async function applyPathManual() {
  const pathVal = el.manualPathInput.value.trim();
  if (!pathVal) return;

  try {
    const res = await fetch('/api/set-target', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: pathVal })
    });
    const data = await res.json();
    if (data.success) {
      closePathModal();
      await runAuditScan(data.path);
    } else {
      alert(data.error || 'Folder tidak dapat diakses.');
    }
  } catch (err) {
    alert('Kesalahan jaringan: ' + err.message);
  }
}

// Clean Modal
function openCleanModal() {
  if (!appData) return;
  const analysis = appData.analysis;
  el.cleanModalCount.textContent = `${analysis.duplicateCount} file`;
  el.cleanModalFreed.textContent = formatBytes(analysis.totalSavableBytes);
  el.cleanConfirmModal.classList.add('open');
}

function closeCleanModal() {
  el.cleanConfirmModal.classList.remove('open');
}

async function executeCleanup() {
  try {
    el.btnExecuteClean.disabled = true;
    el.btnExecuteClean.textContent = 'Menghapus salinan...';

    const res = await fetch('/api/cleanup', { method: 'POST' });
    const result = await res.json();

    if (!res.ok) throw new Error(result.error || 'Gagal menghapus file');

    closeCleanModal();
    alert(`🎉 Pembersihan Berhasil!\n${result.deletedCount} file duplikat dihapus.\n${formatBytes(result.freedBytes)} ruang harddisk berhasil dibebaskan!`);
    await runAuditScan();
  } catch (err) {
    alert('Terjadi kesalahan saat pembersihan: ' + err.message);
  } finally {
    el.btnExecuteClean.disabled = false;
    el.btnExecuteClean.textContent = 'Ya, Bersihkan Sekarang (Yes)';
  }
}

// Event Listeners
el.btnPindaiUlang.addEventListener('click', () => runAuditScan());
el.btnBrowseDialog.addEventListener('click', handleBrowseDialog);
el.heroBtnBrowse.addEventListener('click', handleBrowseDialog);

el.folderInputHidden.addEventListener('change', handleFolderSelect);
el.heroFolderInput.addEventListener('change', handleFolderSelect);

el.btnInputPath.addEventListener('click', openPathModal);
el.heroBtnInput.addEventListener('click', openPathModal);
el.btnClosePathModal.addEventListener('click', closePathModal);
el.btnCancelPathModal.addEventListener('click', closePathModal);
el.btnApplyPathModal.addEventListener('click', applyPathManual);

el.giantSearchInput.addEventListener('input', () => {
  if (appData) renderGiantTable(appData.analysis.giantFiles);
});

el.btnBersihkan.addEventListener('click', openCleanModal);
el.btnCloseCleanModal.addEventListener('click', closeCleanModal);
el.btnCancelCleanModal.addEventListener('click', closeCleanModal);
el.btnExecuteClean.addEventListener('click', executeCleanup);

// Initial Execution on Load
runAuditScan();
