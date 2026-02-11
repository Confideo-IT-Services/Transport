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
| `cittaai_teacher_1a` | Class 1 - Section A | English, Hindi |
| `cittaai_teacher_1b` | Class 1 - Section B | Mathematics, Computer Science |
| `cittaai_teacher_2a` | Class 2 - Section A | Science, Biology |
| `cittaai_teacher_2b` | Class 2 - Section B | Physics, Chemistry |
| `cittaai_teacher_3a` | Class 3 - Section A | Social Studies, English |
| `cittaai_teacher_3b` | Class 3 - Section B | Mathematics, Science |
| `cittaai_teacher_4a` | Class 4 - Section A | English, Computer Science |
| `cittaai_teacher_4b` | Class 4 - Section B | Physical Education, Science |
| `cittaai_teacher_5a` | Class 5 - Section A | Hindi, Social Studies |
| `cittaai_teacher_5b` | Class 5 - Section B | Mathematics, Physics |
| `cittaai_teacher_6a` | Class 6 - Section A | Biology, Chemistry |
| `cittaai_teacher_6b` | Class 6 - Section B | English, Mathematics |
| `cittaai_teacher_7a` | Class 7 - Section A | Science, Computer Science |
| `cittaai_teacher_7b` | Class 7 - Section B | Social Studies, Hindi |
| `cittaai_teacher_8a` | Class 8 - Section A | Mathematics, English |
| `cittaai_teacher_8b` | Class 8 - Section B | Physics, Mathematics |
| `cittaai_teacher_9a` | Class 9 - Section A | Biology, Science |
| `cittaai_teacher_9b` | Class 9 - Section B | Chemistry, Physics |
| `cittaai_teacher_10a` | Class 10 - Section A | Computer Science, Mathematics |
| `cittaai_teacher_10b` | Class 10 - Section B | Physical Education, Hindi |

---

## 👨‍🏫 Subject Teachers (10 Teachers)

These teachers are subject teachers with no specific class assignment.

**Password for all:** `password`

| Username | Subjects |
|----------|----------|
| `cittaai_teacher_subj_1` | English, Social Studies |
| `cittaai_teacher_subj_2` | Mathematics, Biology |
| `cittaai_teacher_subj_3` | Science, Physics |
| `cittaai_teacher_subj_4` | Computer Science, English |
| `cittaai_teacher_subj_5` | Hindi, Mathematics |
| `cittaai_teacher_subj_6` | Social Studies, Science |
| `cittaai_teacher_subj_7` | English, Physical Education |
| `cittaai_teacher_subj_8` | Mathematics, Chemistry |
| `cittaai_teacher_subj_9` | Biology, Physics |
| `cittaai_teacher_subj_10` | Computer Science, Science |

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
7. **Usernames are prefixed with `cittaai_` to avoid conflicts with other schools**

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
- Usernames are unique (prefixed with `cittaai_`) to avoid conflicts with Demo Convent school
