#!/usr/bin/env python3
"""
Storage Audit Utility - Downloads_Lab
Systems Engineering & Storage Optimizer

Standalone Python CLI Application (Zero external pip dependencies)
Standard libraries used: os, hashlib, sys, time, datetime
"""

import os
import sys
import hashlib
import time
from datetime import datetime

# Ambang Batas Ukuran File Raksasa: 2 MB (2 * 1024 * 1024 = 2.097.152 bytes / 2.048 KB)
GIANT_FILE_THRESHOLD_BYTES = 2 * 1024 * 1024

# ANSI Color Codes
class Colors:
    RESET = '\033[0m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    
    RED = '\033[31m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    BLUE = '\033[34m'
    MAGENTA = '\033[35m'
    CYAN = '\033[36m'
    WHITE = '\033[37m'
    GRAY = '\033[90m'
    
    BRIGHT_RED = '\033[91m'
    BRIGHT_GREEN = '\033[92m'
    BRIGHT_YELLOW = '\033[93m'
    BRIGHT_CYAN = '\033[96m'
    BRIGHT_WHITE = '\033[97m'

def format_bytes(b):
    if b == 0:
        return "0 B"
    units = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    val = float(b)
    while val >= 1024 and i < len(units) - 1:
        val /= 1024
        i += 1
    return f"{val:.2f} {units[i]}"

def draw_line(char='─', length=76, color=Colors.GRAY):
    print(f"{color}{char * length}{Colors.RESET}")

def render_header(target_folder):
    if sys.stdout.isatty():
        os.system('cls' if os.name == 'nt' else 'clear')
    print(f"{Colors.BRIGHT_CYAN}╔════════════════════════════════════════════════════════════════════════════╗{Colors.RESET}")
    print(f"{Colors.BRIGHT_CYAN}║ {Colors.BOLD}{Colors.BRIGHT_WHITE}  ⚡ STORAGE AUDIT & DE-DUPLICATION ENGINE (PYTHON)       {Colors.RESET}           {Colors.BRIGHT_CYAN}║{Colors.RESET}")
    print(f"{Colors.BRIGHT_CYAN}║ {Colors.DIM}  Systems Engineering & Storage Cleaner v1.0.0 (Zero-Dependency)           {Colors.RESET}{Colors.BRIGHT_CYAN}║{Colors.RESET}")
    print(f"{Colors.BRIGHT_CYAN}╚════════════════════════════════════════════════════════════════════════════╝{Colors.RESET}")
    print(f"{Colors.CYAN}Target Audit Folder :{Colors.RESET} {Colors.BOLD}{Colors.BRIGHT_YELLOW}{target_folder}{Colors.RESET}")
    print(f"{Colors.CYAN}Ambang File Raksasa :{Colors.RESET} {Colors.BOLD}> 2.048 KB (2,00 MB){Colors.RESET}")
    print(f"{Colors.CYAN}Waktu Scan          :{Colors.RESET} {datetime.now().strftime('%d/%m/%Y, %H:%M:%S')}")
    draw_line('━', 76, Colors.BLUE)

def calculate_sha256(file_path):
    sha = hashlib.sha256()
    with open(file_path, 'rb') as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            sha.update(chunk)
    return sha.hexdigest()

def scan_directory(target_dir):
    file_list = []
    dir_count = 0

    for root, dirs, files in os.walk(target_dir):
        dir_count += len(dirs)
        for name in files:
            full_path = os.path.join(root, name)
            rel_path = os.path.relpath(full_path, target_dir)
            try:
                stat = os.stat(full_path)
                sys.stdout.write(f"\r{Colors.DIM}Memindai file: {rel_path[:55].ljust(55)}{Colors.RESET}")
                sys.stdout.flush()

                file_hash = calculate_sha256(full_path)
                is_tmp = name.lower().endswith('.tmp') or '.tmp.' in name.lower()
                is_giant = stat.st_size >= GIANT_FILE_THRESHOLD_BYTES

                file_list.append({
                    'name': name,
                    'full_path': full_path,
                    'rel_path': rel_path,
                    'size': stat.st_size,
                    'ctime': stat.st_ctime,
                    'hash': file_hash,
                    'is_tmp': is_tmp,
                    'is_giant': is_giant
                })
            except Exception as e:
                print(f"\n{Colors.YELLOW}[LEWATI] Tidak dapat mengakses {rel_path}: {e}{Colors.RESET}")

    return file_list, dir_count

def analyze_files(files):
    total_bytes = 0
    giant_files = []
    tmp_files = []
    hash_map = {}

    for f in files:
        total_bytes += f['size']
        if f['is_giant']:
            giant_files.append(f)
        if f['is_tmp']:
            tmp_files.append(f)

        hash_map.setdefault(f['hash'], []).append(f)

    giant_files.sort(key=lambda x: x['size'], reverse=True)

    duplicate_groups = []
    duplicate_wasted_bytes = 0
    duplicate_count = 0

    for f_hash, group in hash_map.items():
        if len(group) > 1:
            # Sort: Prioritaskan file master yang tidak ada kata copy/backup
            def penalty_key(item):
                n = item['name'].lower()
                pen = 1 if any(k in n for k in ['copy', 'backup', '(1)', 'salinan']) else 0
                return (pen, item['ctime'])

            group.sort(key=penalty_key)
            master = group[0]
            duplicates = group[1:]

            wasted = sum(d['size'] for d in duplicates)
            duplicate_wasted_bytes += wasted
            duplicate_count += len(duplicates)

            duplicate_groups.append({
                'hash': f_hash,
                'file_size': master['size'],
                'master': master,
                'duplicates': duplicates,
                'wasted_bytes': wasted
            })

    dup_paths = {d['full_path'] for g in duplicate_groups for d in g['duplicates']}
    unique_tmp = [t for t in tmp_files if t['full_path'] not in dup_paths]
    tmp_wasted_bytes = sum(t['size'] for t in unique_tmp)

    total_savable = duplicate_wasted_bytes + tmp_wasted_bytes

    return {
        'total_bytes': total_bytes,
        'giant_files': giant_files,
        'duplicate_groups': duplicate_groups,
        'duplicate_count': duplicate_count,
        'duplicate_wasted_bytes': duplicate_wasted_bytes,
        'tmp_files': tmp_files,
        'unique_tmp': unique_tmp,
        'tmp_wasted_bytes': tmp_wasted_bytes,
        'total_savable': total_savable
    }

def print_report(files, dir_count, analysis):
    sys.stdout.write('\r' + ' ' * 76 + '\r')

    print(f"\n{Colors.BOLD}{Colors.BRIGHT_WHITE}┌─ 📊 RINGKASAN AUDIT PENYIMPANAN ──────────────────────────────────────────┐{Colors.RESET}")
    
    def row(label, val, highlight=Colors.BRIGHT_WHITE):
        padded = (label + ':').ljust(28)
        print(f"{Colors.DIM}│{Colors.RESET}  {Colors.CYAN}{padded}{Colors.RESET} {highlight}{val}{Colors.RESET}")

    row('Total File Dipindai', f"{len(files)} file")
    row('Total Subdirektori', f"{dir_count} folder")
    row('Total Kapasitas Folder', format_bytes(analysis['total_bytes']), Colors.BRIGHT_YELLOW)
    row('File Raksasa (> 2 MB)', f"{len(analysis['giant_files'])} file", Colors.BRIGHT_MAGENTA if analysis['giant_files'] else Colors.GREEN)
    row('Kelompok Duplikat', f"{len(analysis['duplicate_groups'])} grup ({analysis['duplicate_count']} file salinan)", Colors.BRIGHT_RED if analysis['duplicate_groups'] else Colors.GREEN)
    row('File Sampah (.tmp)', f"{len(analysis['tmp_files'])} file", Colors.YELLOW if analysis['tmp_files'] else Colors.GREEN)

    pct = ((analysis['total_savable'] / analysis['total_bytes']) * 100) if analysis['total_bytes'] > 0 else 0.0

    print(f"{Colors.DIM}├────────────────────────────────────────────────────────────────────────────┤{Colors.RESET}")
    print(f"{Colors.DIM}│{Colors.RESET}  {Colors.BOLD}{Colors.BRIGHT_GREEN}ESTIMASI PENGHEMATAN RUANG : {format_bytes(analysis['total_savable'])} ({pct:.1f}% dari total){Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BRIGHT_WHITE}└────────────────────────────────────────────────────────────────────────────┘{Colors.RESET}\n")

    # [1] File Raksasa
    print(f"{Colors.BOLD}{Colors.BRIGHT_MAGENTA}📦 [1] DAFTAR FILE RAKSASA (Ukuran > 2 MB / 2.048 KB){Colors.RESET}")
    if not analysis['giant_files']:
        print(f"   {Colors.GREEN}✔ Tidak ada file yang melebihi ambang batas 2 MB.{Colors.RESET}\n")
    else:
        draw_line('-', 76, Colors.GRAY)
        print(f"   {Colors.DIM}No.{Colors.RESET}  {Colors.DIM}{'Ukuran'.ljust(12)}{Colors.RESET}  {Colors.DIM}Path & Nama File{Colors.RESET}")
        draw_line('-', 76, Colors.GRAY)
        for idx, f in enumerate(analysis['giant_files']):
            print(f"   {Colors.BRIGHT_MAGENTA}[{idx+1}]  {Colors.RESET} {Colors.BOLD}{Colors.BRIGHT_YELLOW}{format_bytes(f['size']).ljust(12)}{Colors.RESET} {Colors.BRIGHT_WHITE}{f['rel_path']}{Colors.RESET}")
        draw_line('-', 76, Colors.GRAY)
        print()

    # [2] Kelompok Duplikat
    print(f"{Colors.BOLD}{Colors.BRIGHT_RED}👥 [2] DAFTAR KELOMPOK FILE DUPLIKAT (Hash SHA-256 Identik){Colors.RESET}")
    if not analysis['duplicate_groups']:
        print(f"   {Colors.GREEN}✔ Tidak ditemukan file duplikat.{Colors.RESET}\n")
    else:
        for g_idx, g in enumerate(analysis['duplicate_groups']):
            short_h = g['hash'][:16] + '...'
            print(f"\n   {Colors.BOLD}{Colors.YELLOW}Grup #{g_idx+1}{Colors.RESET} {Colors.GRAY}[SHA-256: {short_h}]{Colors.RESET} - Ukuran: {Colors.BOLD}{format_bytes(g['file_size'])}{Colors.RESET} (Potensi hemat: {Colors.BRIGHT_RED}{format_bytes(g['wasted_bytes'])}{Colors.RESET})")
            print(f"   {Colors.GREEN}  ✔ [ASLI DIPERTAHANKAN] : {Colors.BRIGHT_WHITE}{g['master']['rel_path']}{Colors.RESET}")
            for d in g['duplicates']:
                print(f"   {Colors.RED}  ✖ [SALINAN DUPLIKAT]   : {Colors.DIM}{d['rel_path']}{Colors.RESET}")
        print()

    # [3] File Sampah .tmp
    if analysis['tmp_files']:
        print(f"{Colors.BOLD}{Colors.YELLOW}🗑️  [3] FILE SAMPAH SEMENTARA (.tmp){Colors.RESET}")
        for t in analysis['tmp_files']:
            print(f"   {Colors.YELLOW}  • {t['rel_path']} {Colors.DIM}({format_bytes(t['size'])}){Colors.RESET}")
        print()

def execute_cleanup(analysis):
    items_to_delete = []

    for g in analysis['duplicate_groups']:
        for d in g['duplicates']:
            items_to_delete.append({
                'type': 'DUPLIKAT',
                'path': d['full_path'],
                'rel_path': d['rel_path'],
                'size': d['size']
            })

    for t in analysis['unique_tmp']:
        items_to_delete.append({
            'type': 'SAMPAH_TMP',
            'path': t['full_path'],
            'rel_path': t['rel_path'],
            'size': t['size']
        })

    if not items_to_delete:
        print(f"\n{Colors.GREEN}✔ Tidak ada file yang perlu dihapus.{Colors.RESET}\n")
        return

    print(f"\n{Colors.BOLD}{Colors.BRIGHT_CYAN}Menginisialisasi pembersihan aman...{Colors.RESET}")
    draw_line('-', 76, Colors.GRAY)

    deleted_count = 0
    freed_bytes = 0
    failed_count = 0

    for item in items_to_delete:
        try:
            if os.path.exists(item['path']):
                os.remove(item['path'])
                deleted_count += 1
                freed_bytes += item['size']
                print(f"   {Colors.RED}[DIHAPUS]{Colors.RESET} [{item['type']}] {item['rel_path']} {Colors.DIM}(-{format_bytes(item['size'])}){Colors.RESET}")
        except Exception as e:
            failed_count += 1
            print(f"   {Colors.BRIGHT_RED}[GAGAL]{Colors.RESET} Tidak dapat menghapus {item['rel_path']}: {e}")

    draw_line('━', 76, Colors.BRIGHT_GREEN)
    print(f"{Colors.BOLD}{Colors.BRIGHT_GREEN}🎉 PEMBERSIHAN SELESAI DENGAN SUKSES!{Colors.RESET}")
    print(f"   {Colors.CYAN}Total File Dihapus  :{Colors.RESET} {Colors.BOLD}{deleted_count} file{Colors.RESET}")
    if failed_count > 0:
        print(f"   {Colors.RED}File Gagal Dihapus  :{Colors.RESET} {Colors.BOLD}{failed_count} file{Colors.RESET}")
    print(f"   {Colors.CYAN}Ruang Disk Bebas    :{Colors.RESET} {Colors.BOLD}{Colors.BRIGHT_YELLOW}{format_bytes(freed_bytes)}{Colors.RESET}")
    print(f"   {Colors.GREEN}Semua 1 file asli per kelompok duplikat dan file penting tetap utuh aman.{Colors.RESET}\n")

def main():
    custom_target = sys.argv[1] if len(sys.argv) > 1 else None
    target_dir = os.path.abspath(custom_target) if custom_target else os.path.abspath('Downloads_Lab')

    render_header(target_dir)

    if not os.path.exists(target_dir):
        print(f"\n{Colors.RED}❌ Folder target tidak ditemukan:{Colors.RESET} {target_dir}")
        print(f"{Colors.YELLOW}Petunjuk:{Colors.RESET} Pastikan folder 'Downloads_Lab' berada di direktori ini atau tentukan path:")
        print(f"  {Colors.CYAN}python storage_audit.py <path_folder>{Colors.RESET}\n")
        sys.exit(1)

    if not os.path.isdir(target_dir):
        print(f"\n{Colors.RED}❌ Path target bukan sebuah folder:{Colors.RESET} {target_dir}\n")
        sys.exit(1)

    print(f"{Colors.BOLD}{Colors.CYAN}Memulai proses audit & hashing SHA-256 rekursif...{Colors.RESET}")
    t0 = time.time()
    files, dir_count = scan_directory(target_dir)
    elapsed = time.time() - t0

    if not files:
        sys.stdout.write('\r' + ' ' * 76 + '\r')
        print(f"\n{Colors.YELLOW}ℹ️ Folder 'Downloads_Lab' kosong. Tidak ada file untuk diaudit.{Colors.RESET}\n")
        sys.exit(0)

    analysis = analyze_files(files)
    print_report(files, dir_count, analysis)

    print(f"{Colors.DIM}Audit selesai dalam waktu {elapsed:.2f} detik.{Colors.RESET}\n")

    total_removable = analysis['duplicate_count'] + len(analysis['unique_tmp'])
    if total_removable > 0:
        prompt_text = f"{Colors.BOLD}{Colors.BRIGHT_YELLOW}❓ Apakah kamu ingin menghapus file duplikat yang tidak terpakai? (Yes/No): {Colors.RESET}"
        try:
            ans = input(prompt_text).strip().lower()
        except (KeyboardInterrupt, EOFError):
            print(f"\n\n{Colors.YELLOW}Operasi dibatalkan.{Colors.RESET}\n")
            sys.exit(0)

        if ans in ['yes', 'y']:
            execute_cleanup(analysis)
        else:
            print(f"\n{Colors.YELLOW}Operasi dibatalkan oleh pengguna. Tidak ada file yang dihapus.{Colors.RESET}\n")
    else:
        print(f"{Colors.BRIGHT_GREEN}✨ Sistem penyimpanan Anda sudah optimal! Tidak ditemukan duplikat atau file sampah.{Colors.RESET}\n")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}Audit dihentikan oleh pengguna (SIGINT). Keluar...{Colors.RESET}\n")
        sys.exit(0)
