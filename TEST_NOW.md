# TEST NOW - 2 MINUTES

## Quick Test (Right Now)

### 1. Shore Mode - Compress
```bash
npm start
```

1. Drag `examples/EUCOM_source.gif` into drop zone
2. Template: Should show "EUCOM"
3. DTG: Click "📅 Now" 
4. Click "📤 Generate VLF Message"
5. **SUCCESS:** Check `output/` folder for .txt file

### 2. Submarine Mode - Decompress

1. Click "🚢 Submarine" button
2. Drop `examples/EUCOM.txt` into drop zone
3. Click "🔄 Decode & Display Image"
4. **SUCCESS:** Image appears and saves to `output/`

### 3. Test LANT Too

**Shore:**
- Drag `examples/LANT_source.gif`
- Generate message

**Submarine:**  
- Drop `examples/LANT.txt`
- Decode

## Files Included

```
examples/
├── EUCOM_source.gif  ← Compress this
├── EUCOM.txt         ← Decode this
├── LANT_source.gif   ← Compress this
└── LANT.txt          ← Decode this

templates/
├── EUCOM/
│   ├── EUCOM.yaml
│   └── EUCOM_template.gif
└── LANT/
    ├── LANT.yaml
    └── LANT_template.gif
```

## If Errors

**Python not found:**
```bash
# Set in main.js line 13:
return 'python3';  # Mac/Linux
# or
return 'python';   # Windows
```

**Can't decode:**
- Check templates/ folder has EUCOM/ and LANT/
- Each must have .yaml and _template.gif files

**That's it! Should work perfectly now.**
