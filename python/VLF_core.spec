# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec file for VLF Core
# This creates a directory-based distribution (onedir) instead of single exe (onefile)
# All DLLs and dependencies are extracted during build, not at runtime

block_cipher = None

a = Analysis(
    ['VLF_core.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        'brotli',
        'base64',
        'json',
        'sys',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# Create exe WITHOUT bundling all dependencies (onedir mode)
# Dependencies will be in _internal folder alongside the exe
exe = EXE(
    pyz,
    a.scripts,
    [],  # Don't bundle binaries, zipfiles, or datas in exe - they go in COLLECT instead
    exclude_binaries=True,  # Critical: this makes it onedir instead of onefile
    name='VLF_core',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # Keep console for debugging output
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None
)

# COLLECT creates the directory structure with exe and _internal folder
# This is what gets distributed with the installer
coll = COLLECT(
    exe,
    a.binaries,  # All DLLs go here
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='VLF_core',  # Creates dist/VLF_core/ directory with exe and _internal/
)
