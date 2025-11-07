# GET RUNNING TONIGHT - Step by Step

## ⏱️ Time Required: 10 minutes

---

## Step 1: Check You Have Prerequisites (2 min)

### Node.js
Open terminal/command prompt and type:
```
node --version
```

✅ **Should see:** v18.x.x or higher  
❌ **If not:** Download from https://nodejs.org/ (get LTS version)

### Python
Type:
```
python --version
```
or
```
python3 --version
```

✅ **Should see:** Python 3.8.x or higher  
❌ **If not:** Download from https://python.org/

---

## Step 2: Extract and Setup (3 min)

### Extract Files
1. Extract the `argus-modern-build` folder to your desktop
2. Open terminal/command prompt
3. Navigate to the folder:
   ```
   cd Desktop/argus-modern-build
   ```

### Run Setup

**Windows:**
```
setup.bat
```

**Mac/Linux:**
```
chmod +x setup.sh
./setup.sh
```

**What happens:**
- Installs Electron (~2 min)
- Installs Python packages (~1 min)
- Creates output folder

**Wait for:** "Setup Complete!" message

---

## Step 3: Launch ARGUS (1 min)

```
npm start
```

**What happens:**
- Electron window opens
- ARGUS interface appears
- Templates load automatically

✅ **Success:** You see the ARGUS window with Shore Mode

---

## Step 4: Test Compression (2 min)

### Shore Mode Test

1. **Verify Shore Mode is active** (🏢 Shore button should be highlighted)

2. **Drag the example file:**
   - Find: `examples/EUCOM_source.gif`
   - Drag it into the gray drop zone
   - File preview appears

3. **Check auto-filled fields:**
   - Template: Should say "EUCOM"
   - DTG: Click "📅 Now" button to fill

4. **Generate message:**
   - Click big blue "📤 Generate VLF Message" button
   - Watch progress bar (takes 3-5 seconds)
   - Success! Green checkmark appears

5. **Find your file:**
   - Click "📁 Open Folder" button
   - Your message file is there!

---

## Step 5: Test Decompression (2 min)

### Submarine Mode Test

1. **Switch modes:**
   - Click "🚢 Submarine" button at top
   - Interface changes

2. **Load message:**
   - Option A: Drag `examples/EUCOM.txt` into drop zone
   - Option B: Click "📝 Paste Message", paste the text

3. **Decode:**
   - Click "🔄 Decode & Display Image" button
   - Watch progress (takes 2-3 seconds)
   - Image appears!

4. **View result:**
   - Weather image displays in the app
   - Also saved to output folder
   - Click "📁 Open Folder" to see it

---

## ✅ Success Checklist

After testing, you should have:
- [x] ARGUS app running
- [x] Compressed a GIF to text message
- [x] Decompressed a message to image
- [x] Both output files in `output/` folder

**If all checked: IT WORKS! 🎉**

---

## 🐛 Common Issues (Quick Fixes)

### "npm not found"
**Problem:** Node.js not installed or not in PATH  
**Fix:**
1. Download Node.js from https://nodejs.org/
2. Install (check "Add to PATH")
3. Restart terminal
4. Try again

### "python not found"
**Problem:** Python not installed or not in PATH  
**Fix:**
1. Download Python from https://python.org/
2. During install, CHECK "Add Python to PATH"
3. Restart terminal
4. Try again

### "Cannot find module 'cv2'"
**Problem:** Python packages not installed  
**Fix:**
```
python -m pip install opencv-python numpy Pillow imageio pyyaml
```

### "Template not found"
**Problem:** Templates folder is empty or wrong location  
**Fix:**
1. Check `templates/` folder exists
2. Should have `EUCOM/`, `LANT/` folders inside
3. Each has `.yaml` and `_template.gif` files

### App window is blank
**Problem:** Renderer not loading  
**Fix:**
1. Press Ctrl+Shift+I (opens DevTools)
2. Check Console tab for errors
3. Try `npm start` again

### Compression fails
**Problem:** Missing dependencies or wrong file  
**Fix:**
1. Make sure file is GIF or JPG
2. Check template exists
3. Check console for Python errors
4. Verify Python packages installed

---

## 🎯 Next Steps After Testing

### Tonight:
1. ✅ Confirmed it works
2. ✅ Tested with examples
3. 🔲 Test with YOUR weather GIFs
4. 🔲 Test creating VLF messages
5. 🔲 Share with colleague for feedback

### Tomorrow:
1. 🔲 Package as portable .exe (`npm run package-portable`)
2. 🔲 Test on different computer
3. 🔲 Document any bugs found
4. 🔲 Plan improvements

### This Week:
1. 🔲 Get operator feedback
2. 🔲 Add template builder UI
3. 🔲 Test on Windows 7/10/11
4. 🔲 Create deployment package
5. 🔲 Contact LCDR Peneyra for blessing

---

## 📁 Where Are My Files?

### Input (Examples):
```
examples/
├── EUCOM_source.gif  ← Test this first
└── EUCOM.txt         ← Decode this
```

### Output (Generated):
```
output/
├── EUCOM_061200ZNOV2025.txt  ← Your VLF message
└── decoded_xxxxx.gif          ← Your decoded image
```

### Templates (Required):
```
templates/
├── EUCOM/
│   ├── EUCOM.yaml
│   └── EUCOM_template.gif
└── LANT/
    ├── LANT.yaml
    └── LANT_template.gif
```

---

## 💡 Pro Tips

### Testing Tips:
- Use example files first (guaranteed to work)
- Check console if something fails (Ctrl+Shift+I)
- Output files go to `output/` folder
- Templates must match between shore and submarine

### Development Tips:
- Keep terminal open to see logs
- Press Ctrl+R to reload app
- DevTools (Ctrl+Shift+I) shows all errors
- Check Python console for compression issues

### Usage Tips:
- DTG format: DDHHMMZMMMYYYY (e.g., 061200ZNOV2025)
- File names can trigger auto-template detection
- Drag & drop is faster than browsing
- Mode toggle remembers your last selection

---

## 🆘 Still Stuck?

1. **Check README.md** for detailed troubleshooting
2. **Open DevTools** (Ctrl+Shift+I) and check Console
3. **Check terminal** output for Python errors
4. **Verify** all prerequisites installed
5. **Try** deleting `node_modules/` and running setup again

---

## 🎉 You're Done!

**Time to celebrate! You now have:**
- ✅ Modern ARGUS interface working
- ✅ Compression tested
- ✅ Decompression tested  
- ✅ Ready to test with real data
- ✅ Foundation for improvements

**Next:** Start testing with your actual weather data!

---

**Questions?** Check the main README.md  
**Found a bug?** Note it down for tomorrow  
**Works great?** Time to show your team!

**Current Time:** [Note when you finished]  
**Total Time:** Should be ~10 minutes  
**Status:** OPERATIONAL ✅
