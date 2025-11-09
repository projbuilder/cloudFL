# Phase 1 Implementation Guide
**Status:** In Progress  
**Updated:** November 8, 2025

---

## ✅ **What We Just Fixed**

### **1. Schema Error: "Could not find 'category' column"** ✅
**Problem:** Supabase database missing required columns

**Solution:** Created migration `20251108000002_ensure_courses_schema.sql`

**To Fix:**
```sql
-- In Supabase SQL Editor, run this migration:
-- File: supabase/migrations/20251108000002_ensure_courses_schema.sql

-- This will:
-- ✅ Add missing columns (category, difficulty_level, is_published, metadata)
-- ✅ Create enrollments table for M:N relationships
-- ✅ Create course_modules table
-- ✅ Add proper indexes
-- ✅ Set up RLS policies
```

**Steps:**
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20251108000002_ensure_courses_schema.sql`
3. Paste and run
4. Verify: Should see success message

---

### **2. Type System Update: number → string (UUID)** ✅
**Problem:** Code used `number` IDs, database uses UUID `string`

**Fixed Files:**
- ✅ `src/services/courseService.ts` - All interfaces updated
- ✅ `src/services/aiTutorService.ts` - courseId, conversationId
- ✅ `src/components/AITutorChat.tsx` - Props and state
- ✅ `src/pages/StudentDashboard.tsx` - enrollInCourse function

**Changes:**
```typescript
// BEFORE
interface Course {
  id: number
  ...
}

// AFTER
interface Course {
  id: string // UUID
  category?: string | null
  difficulty_level?: number | null
  is_published?: boolean | null
  metadata?: any
  ...
}
```

---

### **3. Phase 1B: Course Visibility & Enrollment** ✅ (Already Implemented!)
**Status:** Already working in StudentDashboard

**Features:**
- ✅ Students can see all published courses
- ✅ "Enroll Now" button works
- ✅ M:N relationship (students ↔ courses)
- ✅ Progress tracking per course

**Location:** `src/pages/StudentDashboard.tsx` lines 218-263

---

## 🚀 **Next Steps: Complete Phase 1**

### **Phase 1A: Test PDF Upload** (Today, 30 min)

**Test Instructions:**
1. Start dev server: `npm run dev`
2. Login as instructor
3. Click "AI Course from PDF"
4. Upload PDF (test file: `PPTs-Classes-29-Design-for-trust-delay-based-methods.pdf`)
5. Fill in course title
6. Click "Generate Course with AI"
7. Wait for processing (2-5 minutes)
8. Verify:
   - Course appears in instructor dashboard
   - Modules created in database
   - Course visible to students (after publishing)

**Expected Result:**
- ✅ No schema errors
- ✅ Modules generated dynamically (no limit)
- ✅ Course stored with UUID
- ✅ Students can enroll

---

### **Phase 1C: Clickable Module Cards** (Today, 4 hours)

**What to Build:**
Create a modal that shows full module content when clicked.

**Implementation:**
```typescript
// StudentCourseViewPage.tsx

const [selectedModule, setSelectedModule] = useState<Module | null>(null)

// Module card (make it clickable)
<div 
  onClick={() => setSelectedModule(module)}
  className="cursor-pointer hover:shadow-lg transition-all"
>
  <h3>{module.title}</h3>
  <p className="line-clamp-2">{module.content}</p>
  <button>View Full Content →</button>
</div>

// Module content modal
{selectedModule && (
  <div className="fixed inset-0 bg-black/60 z-50">
    <div className="bg-background max-w-4xl mx-auto mt-20 p-8 rounded-xl">
      <h2>{selectedModule.title}</h2>
      <div className="prose">
        {/* Render with markdown/formatting */}
        <ReactMarkdown>{selectedModule.content}</ReactMarkdown>
      </div>
      <button onClick={() => setSelectedModule(null)}>Close</button>
    </div>
  </div>
)}
```

**Install Dependencies:**
```bash
npm install react-markdown rehype-highlight
```

---

### **Phase 1D: Multi-Module Quiz Selection** (Today, 2 hours)

**Current State:** `QuizCustomizer` supports single module

**Enhancement:**
```typescript
// QuizCustomizer.tsx

const [selectedModules, setSelectedModules] = useState<string[]>([])
const [questionCount, setQuestionCount] = useState(5)

// Multi-select UI
{modules.map(module => (
  <div key={module.id}>
    <input 
      type="checkbox"
      checked={selectedModules.includes(module.id)}
      onChange={(e) => {
        if (e.target.checked) {
          setSelectedModules([...selectedModules, module.id])
        } else {
          setSelectedModules(selectedModules.filter(id => id !== module.id))
        }
      }}
    />
    <label>{module.title}</label>
  </div>
))}

// Question count slider (3-50)
<input 
  type="range" 
  min={3} 
  max={50} 
  value={questionCount}
  onChange={(e) => setQuestionCount(Number(e.target.value))}
/>
<span>{questionCount} questions</span>

// Generate quiz from multiple modules
<button onClick={() => {
  if (selectedModules.length === 0) {
    alert('Select at least one module')
    return
  }
  onStartQuiz(selectedModules, questionCount)
}}>
  Generate Quiz
</button>
```

**Update Quiz Service:**
```typescript
// quizService.ts

export async function generateQuizForMultipleModules(
  moduleIds: string[],
  difficulty: 'easy' | 'medium' | 'hard',
  totalQuestions: number
): Promise<{ success: boolean; quiz?: any }> {
  // Fetch all selected modules
  const modules = await Promise.all(
    moduleIds.map(id => supabase.from('course_modules').select('*').eq('id', id).single())
  )
  
  // Combine content
  const combinedContent = modules.map(m => m.data?.content).join('\n\n---\n\n')
  const combinedKeyPoints = modules.flatMap(m => m.data?.key_points || [])
  
  // Generate questions
  const questions = await generateQuestionsWithAI(
    combinedContent,
    combinedKeyPoints,
    difficulty,
    totalQuestions
  )
  
  return { success: true, quiz: { questions } }
}
```

---

## 📋 **Phase 1 Checklist**

### **Today (Day 1)**
- [x] Fix schema error (migration created)
- [x] Fix type system (UUID support)
- [x] Course visibility (already working!)
- [ ] Test PDF upload end-to-end
- [ ] Implement clickable module cards
- [ ] Multi-module quiz selection

### **Testing Checklist**
- [ ] Instructor can upload PDF → Modules created
- [ ] Student can see published courses
- [ ] Student can enroll in course
- [ ] Student can click module → See full content
- [ ] Student can select multiple modules for quiz
- [ ] Quiz generates 3-50 questions
- [ ] Quiz options are shuffled

---

## 🐛 **Troubleshooting**

### **Issue: "Category column not found"**
**Solution:** Run migration `20251108000002_ensure_courses_schema.sql`

### **Issue: TypeScript errors about number vs string**
**Solution:** Already fixed! Make sure to restart TypeScript server:
- VS Code: Ctrl+Shift+P → "TypeScript: Restart TS Server"

### **Issue: Enrollment fails**
**Check:**
1. Is course `is_published = true`?
2. Does user have student role?
3. Check browser console for errors

### **Issue: No modules appear**
**Check:**
1. Did PDF processing complete?
2. Check `course_modules` table in Supabase
3. Verify `course_id` matches

---

## 📊 **Database Structure (After Migration)**

```sql
-- courses
CREATE TABLE courses (
  id UUID PRIMARY KEY,
  instructor_id UUID REFERENCES profiles(user_id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  difficulty_level INTEGER CHECK (1-5),
  is_published BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- course_modules
CREATE TABLE course_modules (
  id UUID PRIMARY KEY,
  course_id UUID REFERENCES courses(id),
  module_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  key_points TEXT[],
  estimated_duration INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(course_id, module_number)
);

-- enrollments (M:N)
CREATE TABLE enrollments (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES profiles(user_id),
  course_id UUID REFERENCES courses(id),
  enrolled_at TIMESTAMP,
  status TEXT CHECK ('active', 'completed', 'dropped'),
  UNIQUE(student_id, course_id)
);

-- student_progress
CREATE TABLE student_progress (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES profiles(user_id),
  course_id UUID REFERENCES courses(id),
  progress_percentage DECIMAL(5,2),
  last_accessed_at TIMESTAMP,
  performance_metrics JSONB,
  UNIQUE(student_id, course_id)
);
```

---

## ✅ **Success Criteria for Phase 1**

By end of today, you should have:

1. ✅ **Schema Fixed** - No more "category not found" errors
2. ✅ **Course Visibility** - Students see all published courses
3. ✅ **Enrollment** - Students can enroll with one click
4. ✅ **PDF Upload** - Instructor can upload, AI generates modules
5. ✅ **Module Display** - Clickable cards with full content modal
6. ✅ **Multi-Module Quiz** - Select multiple modules, 3-50 questions

---

## 🚀 **Ready to Start?**

**Run this command first:**
```bash
# Make sure database is up to date
# Then start dev server
npm run dev
```

**Then:**
1. Open Supabase Dashboard
2. Run migration SQL
3. Test PDF upload
4. Implement clickable modules
5. Implement multi-module quiz

---

**Questions? Check the error console first, then:**
- Schema issues → Check Supabase SQL Editor
- Type errors → Restart TS server
- Runtime errors → Check browser console

**Good luck! 🎯**
