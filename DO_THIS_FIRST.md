# 🚨 DO THIS FIRST - CRITICAL SETUP (5 minutes)

## ⚠️ YOUR APP WON'T WORK WITHOUT THESE 2 STEPS!

The errors you're seeing ("Upload failed", "404 Not Found") are because the database and storage aren't set up yet.

---

## ✅ STEP 1: Run SQL in Supabase (2 minutes)

### Do this NOW:

1. **Open Supabase Dashboard:**
   ```
   https://kvedawllemtyfkxeenll.supabase.co
   ```

2. **Click "SQL Editor"** in the left sidebar

3. **Click "New Query"** button (top right)

4. **Open this file on your computer:**
   ```
   C:\Users\Kowstubha Tirumal\Cloud E-Learning\database-schema.sql
   ```

5. **Select ALL the SQL** (Ctrl+A)

6. **Copy it** (Ctrl+C)

7. **Paste into Supabase SQL Editor**

8. **Click RUN** button (or press Ctrl+Enter)

9. **Wait ~5 seconds** - You should see:
   ```
   ✅ DATABASE SETUP COMPLETE!
   ✅ Tables created with pgvector support
   ✅ Demo course inserted
   ```

---

## ✅ STEP 2: Create Storage Bucket (1 minute)

### Do this NOW:

1. **In Supabase Dashboard**, click **"Storage"** (left sidebar)

2. **Click "New Bucket"** button

3. **Fill in:**
   - Name: `course-materials`
   - Toggle **"Public bucket"** = **ON** ✅
   - Leave other settings default

4. **Click "Create bucket"**

5. **Verify:** You should see "course-materials" in the list

---

## ✅ STEP 3: Verify Setup

### Check if everything works:

1. **Go to:** http://localhost:8080/setup

2. **Click "Run Setup Check"**

3. **All items should be GREEN ✅**

4. **If any are RED ❌:**
   - Read the "Fix" instructions
   - Complete the missing step
   - Run check again

---

## 🎯 AFTER SETUP IS COMPLETE:

### Test PDF Upload:
1. Go to: http://localhost:8080/demo
2. Click "PDF → Course" tab
3. Upload any PDF (your Cloud Computing Notes.pdf will work!)
4. Watch the AI transform it

### Test AI Tutor:
1. After uploading PDF, click "AI Tutor (RAG)" tab
2. Ask: "What is Federated Learning?"
3. You'll get a real AI response from Gemini

---

## 🐛 TROUBLESHOOTING

### "Upload failed" error:
→ **Storage bucket doesn't exist or isn't PUBLIC**
→ Complete Step 2 above

### "404 Not Found" error:
→ **Database tables don't exist**
→ Complete Step 1 above

### PDF upload still fails:
→ Go to http://localhost:8080/setup
→ Check which item is RED
→ Fix it

---

## 📋 WHAT THE SETUP DOES:

### SQL Script Creates:
- ✅ 10 database tables (courses, modules, embeddings, quizzes, etc.)
- ✅ pgvector extension for AI search
- ✅ Row Level Security policies
- ✅ Vector similarity search functions
- ✅ Sample course for testing

### Storage Bucket:
- ✅ Stores uploaded PDF files
- ✅ Must be PUBLIC so demo can access files
- ✅ Used by PDF upload feature

---

## ⏱️ TIME REQUIRED:

- Step 1 (SQL): **2 minutes**
- Step 2 (Storage): **1 minute**
- Step 3 (Verify): **30 seconds**
- **Total: 3.5 minutes**

---

## ✅ AFTER COMPLETING THESE STEPS:

Your platform will be **FULLY FUNCTIONAL**:
- ✅ PDF upload works
- ✅ Manual course creation works
- ✅ AI Tutor with Gemini works
- ✅ Quiz generation works
- ✅ All features enabled

---

## 🚀 VERIFICATION:

Run this to verify everything:
```
http://localhost:8080/setup
```

All checks should be **GREEN** ✅

Then go to demo:
```
http://localhost:8080/demo
```

And start uploading PDFs!

---

**DO THESE 2 STEPS NOW - IT TAKES 3 MINUTES!** ⏰
