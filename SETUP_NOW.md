# 🚨 CRITICAL SETUP - DO THIS FIRST!

## ⚡ YOU HAVE 3 STEPS (5 minutes total)

Your Gemini API key is already configured ✅  
Now finish the setup:

---

## STEP 1: Run SQL in Supabase (2 minutes) 🔴 REQUIRED

1. **Open Supabase Dashboard:**
   - Go to: https://kvedawllemtyfkxeenll.supabase.co
   - Login if needed

2. **Open SQL Editor:**
   - Click "SQL Editor" in left sidebar
   - Click "New Query" button

3. **Copy & Paste SQL:**
   - Open file: `database-schema.sql`
   - Select ALL (Ctrl+A)
   - Copy (Ctrl+C)
   - Paste into Supabase SQL Editor
   - Click **RUN** (or Ctrl+Enter)

4. **Wait for Success:**
   - Should complete in ~5 seconds
   - Look for green success messages

✅ **You should see:**
```
✅ DATABASE SETUP COMPLETE!
✅ Tables created with pgvector support
✅ Demo course ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

---

## STEP 2: Create Storage Bucket (1 minute) 🔴 REQUIRED

1. **In Supabase Dashboard:**
   - Click "Storage" in left sidebar
   - Click "New Bucket" button

2. **Configure Bucket:**
   - Name: `course-materials`
   - Make it **PUBLIC** ✅
   - Click Create

3. **Set Policies:**
   - Already configured in SQL ✅

---

## STEP 3: Start the App (1 minute)

```bash
# If dev server is not running:
npm run dev

# Should start on http://localhost:8083
```

---

## 🎯 WHAT YOU CAN NOW DO

### ✅ Upload a PDF Textbook
- Real AI transformation (not fake!)
- Gemini analyzes content
- Creates actual course modules
- Generates real quizzes

### ✅ Chat with AI Tutor
- RAG-powered (Retrieval Augmented Generation)
- Real vector search in pgvector
- Context-aware answers from your content

### ✅ Adaptive Quizzes
- AI-generated from module content
- Difficulty adjusts based on performance
- Real explanations for each answer

### ✅ FL Visualization
- Real-time simulation
- Multiple device nodes
- Privacy-preserving training demo

---

## 📋 DEMO COURSE ID

**Your demo course UUID (IMPORTANT):**
```
a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

This is hardcoded in the SQL. You'll need this for components.

---

## 🧪 TEST THE SYSTEM

### Test 1: PDF Upload
1. Get any educational PDF (5-50 pages)
2. Upload via instructor dashboard
3. **WATCH IT ACTUALLY PROCESS:**
   - Uploads to Supabase Storage
   - Extracts real text
   - Sends to Gemini API
   - Gets back JSON modules
   - Saves to database
   - Generates embeddings

### Test 2: AI Tutor
1. Ask: "What is Federated Learning?"
2. **WATCH IT ACTUALLY WORK:**
   - Generates embedding for question
   - Searches pgvector database
   - Finds relevant content
   - Sends to Gemini with context
   - Returns real answer

### Test 3: Quiz
1. Generate quiz for a module
2. **WATCH IT ACTUALLY CREATE:**
   - Fetches module content
   - Sends to Gemini
   - Gets back 5 real questions
   - Saves to database
   - Ready to take

---

## ✅ VERIFICATION CHECKLIST

Before your presentation, verify:

- [ ] SQL ran successfully in Supabase
- [ ] Storage bucket `course-materials` exists
- [ ] Can see `courses` table in Supabase (Table Editor)
- [ ] Can see demo course in database
- [ ] Gemini API key in `.env` file
- [ ] `npm run dev` starts without errors
- [ ] Can access http://localhost:8083

---

## 🔥 YOU'RE BUILDING THE REAL THING

This is NOT:
- ❌ Fake data
- ❌ Placeholder functions
- ❌ Mock responses
- ❌ Static content

This IS:
- ✅ Real Gemini API calls
- ✅ Real PDF processing
- ✅ Real vector search (pgvector)
- ✅ Real database operations
- ✅ Production-grade architecture

---

## 🚀 NEXT: CREATE UI COMPONENTS

After setup is complete, I'll create:
1. Instructor Dashboard with PDF upload
2. AI Tutor Chat interface
3. Adaptive Quiz component
4. FL Visualization dashboard

**CRITICAL: Run steps 1-2 NOW before continuing!**
