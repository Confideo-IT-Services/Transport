# CittaAI School - Login Credentials

This document contains all login credentials for the CittaAI school test data.

## 🔐 Admin Login

**Email:** `admin@cittaai.edu`  
**Password:** `password`

**Access Level:** School Admin (full access to CittaAI school)

---

## 👨‍🏫 Class Teachers (20 Teachers)

These teachers are assigned as class teachers (one per class section).

**Password for all:** `password`

| Username | Class Assignment | Subjects |
|----------|-----------------|----------|
| `teacher_1a` | Class 1 - Section A | English, Hindi |
| `teacher_1b` | Class 1 - Section B | Mathematics, Computer Science |
| `teacher_2a` | Class 2 - Section A | Science, Biology |
| `teacher_2b` | Class 2 - Section B | Physics, Chemistry |
| `teacher_3a` | Class 3 - Section A | Social Studies, English |
| `teacher_3b` | Class 3 - Section B | Mathematics, Science |
| `teacher_4a` | Class 4 - Section A | English, Computer Science |
| `teacher_4b` | Class 4 - Section B | Physical Education, Science |
| `teacher_5a` | Class 5 - Section A | Hindi, Social Studies |
| `teacher_5b` | Class 5 - Section B | Mathematics, Physics |
| `teacher_6a` | Class 6 - Section A | Biology, Chemistry |
| `teacher_6b` | Class 6 - Section B | English, Mathematics |
| `teacher_7a` | Class 7 - Section A | Science, Computer Science |
| `teacher_7b` | Class 7 - Section B | Social Studies, Hindi |
| `teacher_8a` | Class 8 - Section A | Mathematics, English |
| `teacher_8b` | Class 8 - Section B | Physics, Mathematics |
| `teacher_9a` | Class 9 - Section A | Biology, Science |
| `teacher_9b` | Class 9 - Section B | Chemistry, Physics |
| `teacher_10a` | Class 10 - Section A | Computer Science, Mathematics |
| `teacher_10b` | Class 10 - Section B | Physical Education, Hindi |

---

## 👨‍🏫 Subject Teachers (10 Teachers)

These teachers are subject teachers with no specific class assignment.

**Password for all:** `password`

| Username | Subjects |
|----------|----------|
| `teacher_subj_1` | English, Social Studies |
| `teacher_subj_2` | Mathematics, Biology |
| `teacher_subj_3` | Science, Physics |
| `teacher_subj_4` | Computer Science, English |
| `teacher_subj_5` | Hindi, Mathematics |
| `teacher_subj_6` | Social Studies, Science |
| `teacher_subj_7` | English, Physical Education |
| `teacher_subj_8` | Mathematics, Chemistry |
| `teacher_subj_9` | Biology, Physics |
| `teacher_subj_10` | Computer Science, Science |

---

## 📊 School Data Summary

- **School Name:** CittaAI
- **School Code:** CITTA001
- **Total Students:** 500 (25 per class)
- **Total Teachers:** 30 (20 class teachers + 10 subject teachers)
- **Total Classes:** 20 (Class 1-10, Sections A & B)
- **Active Academic Year:** 2025-26
- **Location:** Bangalore

---

## 📝 Notes

1. All passwords are set to: `password`
2. All students are pre-approved and enrolled in the active academic year (2025-26)
3. Student admission numbers follow the format: `CITTA-2025-XXXX` (0001 to 0500)
4. All students have placeholder photos from pravatar.cc
5. All data is stored in the same database as your existing ConventPulse system
6. The CittaAI school is completely separate from any existing schools in the system

---

## 🚀 How to Run the Seed Script

```bash
cd backend
node scripts/seed-cittaai-school.js
```

The script will:
- Connect to your database using credentials from `.env` file
- Create the CittaAI school with all data
- Show progress and summary
- Display all credentials at the end

---

## ⚠️ Important

- This script will NOT affect any existing schools or data
- CittaAI is added as a new school with its own admin, teachers, and students
- All existing functionality remains intact



