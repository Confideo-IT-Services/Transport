-- ============================================================================
-- ConventPulse Demo Data - One school, Nursery to Class 10, sections A & B
-- ============================================================================
-- Run AFTER complete_schema.sql:
--   mysql -h HOST -u USER -p DATABASE < backend/sql/seed_demo_data.sql
--
-- DEMO CREDENTIALS:
--   Admin:  admin@democonvent.com  /  password
--   Teachers: teacher_nur_a, teacher_1a, ... (see list below) / password
-- ============================================================================
USE allpulse;

-- Bcrypt hash for plain text "password"
SET @pwd = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

-- ----------------------------------------------------------------------------
-- 1) School
-- ----------------------------------------------------------------------------
SET @school_id = UUID();
INSERT INTO schools (id, name, code, type, location, address, phone, email, status)
VALUES (@school_id, 'Demo Convent School', 'DCS001', 'K-12', 'Demo City', '123 School Lane', '9876543210', 'admin@democonvent.com', 'active');

-- ----------------------------------------------------------------------------
-- 2) School admin user
-- ----------------------------------------------------------------------------
SET @admin_id = UUID();
INSERT INTO users (id, email, password, name, role, school_id, is_active)
VALUES (@admin_id, 'admin@democonvent.com', @pwd, 'Demo Admin', 'admin', @school_id, TRUE);

-- ----------------------------------------------------------------------------
-- 3) Academic years
-- ----------------------------------------------------------------------------
SET @ay_2024 = UUID();
SET @ay_2025 = UUID();
INSERT INTO academic_years (id, name, start_date, end_date, status, school_id)
VALUES
  (@ay_2024, '2024-25', '2024-04-01', '2025-03-31', 'completed', @school_id),
  (@ay_2025, '2025-26', '2025-04-01', '2026-03-31', 'active', @school_id);

-- ----------------------------------------------------------------------------
-- 4) Subjects
-- ----------------------------------------------------------------------------
INSERT INTO subjects (id, school_id, code, name, color) VALUES
(UUID(), @school_id, 'ENG', 'English', 'bg-blue-100 text-blue-800'),
(UUID(), @school_id, 'MATH', 'Mathematics', 'bg-green-100 text-green-800'),
(UUID(), @school_id, 'SCI', 'Science', 'bg-purple-100 text-purple-800'),
(UUID(), @school_id, 'EVS', 'EVS', 'bg-amber-100 text-amber-800'),
(UUID(), @school_id, 'HIN', 'Hindi', 'bg-orange-100 text-orange-800'),
(UUID(), @school_id, 'SOC', 'Social Studies', 'bg-teal-100 text-teal-800'),
(UUID(), @school_id, 'COMP', 'Computer', 'bg-gray-100 text-gray-800'),
(UUID(), @school_id, 'PE', 'Physical Education', 'bg-red-100 text-red-800');

-- ----------------------------------------------------------------------------
-- 5) Classes (Nursery, LKG, UKG, Class 1-10, each with sections A & B)
-- ----------------------------------------------------------------------------
INSERT INTO classes (id, name, section, school_id) VALUES
(@c_nur_a := UUID(), 'Nursery', 'A', @school_id),
(@c_nur_b := UUID(), 'Nursery', 'B', @school_id),
(@c_lkg_a := UUID(), 'LKG', 'A', @school_id),
(@c_lkg_b := UUID(), 'LKG', 'B', @school_id),
(@c_ukg_a := UUID(), 'UKG', 'A', @school_id),
(@c_ukg_b := UUID(), 'UKG', 'B', @school_id),
(@c1a := UUID(), 'Class 1', 'A', @school_id),
(@c1b := UUID(), 'Class 1', 'B', @school_id),
(@c2a := UUID(), 'Class 2', 'A', @school_id),
(@c2b := UUID(), 'Class 2', 'B', @school_id),
(@c3a := UUID(), 'Class 3', 'A', @school_id),
(@c3b := UUID(), 'Class 3', 'B', @school_id),
(@c4a := UUID(), 'Class 4', 'A', @school_id),
(@c4b := UUID(), 'Class 4', 'B', @school_id),
(@c5a := UUID(), 'Class 5', 'A', @school_id),
(@c5b := UUID(), 'Class 5', 'B', @school_id),
(@c6a := UUID(), 'Class 6', 'A', @school_id),
(@c6b := UUID(), 'Class 6', 'B', @school_id),
(@c7a := UUID(), 'Class 7', 'A', @school_id),
(@c7b := UUID(), 'Class 7', 'B', @school_id),
(@c8a := UUID(), 'Class 8', 'A', @school_id),
(@c8b := UUID(), 'Class 8', 'B', @school_id),
(@c9a := UUID(), 'Class 9', 'A', @school_id),
(@c9b := UUID(), 'Class 9', 'B', @school_id),
(@c10a := UUID(), 'Class 10', 'A', @school_id),
(@c10b := UUID(), 'Class 10', 'B', @school_id);

-- ----------------------------------------------------------------------------
-- 6) Teachers (one per class, same order as classes)
-- ----------------------------------------------------------------------------
INSERT INTO teachers (id, username, password, name, email, school_id, class_id, is_active) VALUES
(@t_nur_a := UUID(), 'teacher_nur_a', @pwd, 'Teacher Nursery A', 'tnur.a@democonvent.com', @school_id, @c_nur_a, TRUE),
(@t_nur_b := UUID(), 'teacher_nur_b', @pwd, 'Teacher Nursery B', 'tnur.b@democonvent.com', @school_id, @c_nur_b, TRUE),
(@t_lkg_a := UUID(), 'teacher_lkg_a', @pwd, 'Teacher LKG A', 'tlkg.a@democonvent.com', @school_id, @c_lkg_a, TRUE),
(@t_lkg_b := UUID(), 'teacher_lkg_b', @pwd, 'Teacher LKG B', 'tlkg.b@democonvent.com', @school_id, @c_lkg_b, TRUE),
(@t_ukg_a := UUID(), 'teacher_ukg_a', @pwd, 'Teacher UKG A', 'tukg.a@democonvent.com', @school_id, @c_ukg_a, TRUE),
(@t_ukg_b := UUID(), 'teacher_ukg_b', @pwd, 'Teacher UKG B', 'tukg.b@democonvent.com', @school_id, @c_ukg_b, TRUE),
(@t1a := UUID(), 'teacher_1a', @pwd, 'Teacher Class 1A', 't1a@democonvent.com', @school_id, @c1a, TRUE),
(@t1b := UUID(), 'teacher_1b', @pwd, 'Teacher Class 1B', 't1b@democonvent.com', @school_id, @c1b, TRUE),
(@t2a := UUID(), 'teacher_2a', @pwd, 'Teacher Class 2A', 't2a@democonvent.com', @school_id, @c2a, TRUE),
(@t2b := UUID(), 'teacher_2b', @pwd, 'Teacher Class 2B', 't2b@democonvent.com', @school_id, @c2b, TRUE),
(@t3a := UUID(), 'teacher_3a', @pwd, 'Teacher Class 3A', 't3a@democonvent.com', @school_id, @c3a, TRUE),
(@t3b := UUID(), 'teacher_3b', @pwd, 'Teacher Class 3B', 't3b@democonvent.com', @school_id, @c3b, TRUE),
(@t4a := UUID(), 'teacher_4a', @pwd, 'Teacher Class 4A', 't4a@democonvent.com', @school_id, @c4a, TRUE),
(@t4b := UUID(), 'teacher_4b', @pwd, 'Teacher Class 4B', 't4b@democonvent.com', @school_id, @c4b, TRUE),
(@t5a := UUID(), 'teacher_5a', @pwd, 'Teacher Class 5A', 't5a@democonvent.com', @school_id, @c5a, TRUE),
(@t5b := UUID(), 'teacher_5b', @pwd, 'Teacher Class 5B', 't5b@democonvent.com', @school_id, @c5b, TRUE),
(@t6a := UUID(), 'teacher_6a', @pwd, 'Teacher Class 6A', 't6a@democonvent.com', @school_id, @c6a, TRUE),
(@t6b := UUID(), 'teacher_6b', @pwd, 'Teacher Class 6B', 't6b@democonvent.com', @school_id, @c6b, TRUE),
(@t7a := UUID(), 'teacher_7a', @pwd, 'Teacher Class 7A', 't7a@democonvent.com', @school_id, @c7a, TRUE),
(@t7b := UUID(), 'teacher_7b', @pwd, 'Teacher Class 7B', 't7b@democonvent.com', @school_id, @c7b, TRUE),
(@t8a := UUID(), 'teacher_8a', @pwd, 'Teacher Class 8A', 't8a@democonvent.com', @school_id, @c8a, TRUE),
(@t8b := UUID(), 'teacher_8b', @pwd, 'Teacher Class 8B', 't8b@democonvent.com', @school_id, @c8b, TRUE),
(@t9a := UUID(), 'teacher_9a', @pwd, 'Teacher Class 9A', 't9a@democonvent.com', @school_id, @c9a, TRUE),
(@t9b := UUID(), 'teacher_9b', @pwd, 'Teacher Class 9B', 't9b@democonvent.com', @school_id, @c9b, TRUE),
(@t10a := UUID(), 'teacher_10a', @pwd, 'Teacher Class 10A', 't10a@democonvent.com', @school_id, @c10a, TRUE),
(@t10b := UUID(), 'teacher_10b', @pwd, 'Teacher Class 10B', 't10b@democonvent.com', @school_id, @c10b, TRUE);

UPDATE classes SET class_teacher_id = @t_nur_a WHERE id = @c_nur_a;
UPDATE classes SET class_teacher_id = @t_nur_b WHERE id = @c_nur_b;
UPDATE classes SET class_teacher_id = @t_lkg_a WHERE id = @c_lkg_a;
UPDATE classes SET class_teacher_id = @t_lkg_b WHERE id = @c_lkg_b;
UPDATE classes SET class_teacher_id = @t_ukg_a WHERE id = @c_ukg_a;
UPDATE classes SET class_teacher_id = @t_ukg_b WHERE id = @c_ukg_b;
UPDATE classes SET class_teacher_id = @t1a WHERE id = @c1a;
UPDATE classes SET class_teacher_id = @t1b WHERE id = @c1b;
UPDATE classes SET class_teacher_id = @t2a WHERE id = @c2a;
UPDATE classes SET class_teacher_id = @t2b WHERE id = @c2b;
UPDATE classes SET class_teacher_id = @t3a WHERE id = @c3a;
UPDATE classes SET class_teacher_id = @t3b WHERE id = @c3b;
UPDATE classes SET class_teacher_id = @t4a WHERE id = @c4a;
UPDATE classes SET class_teacher_id = @t4b WHERE id = @c4b;
UPDATE classes SET class_teacher_id = @t5a WHERE id = @c5a;
UPDATE classes SET class_teacher_id = @t5b WHERE id = @c5b;
UPDATE classes SET class_teacher_id = @t6a WHERE id = @c6a;
UPDATE classes SET class_teacher_id = @t6b WHERE id = @c6b;
UPDATE classes SET class_teacher_id = @t7a WHERE id = @c7a;
UPDATE classes SET class_teacher_id = @t7b WHERE id = @c7b;
UPDATE classes SET class_teacher_id = @t8a WHERE id = @c8a;
UPDATE classes SET class_teacher_id = @t8b WHERE id = @c8b;
UPDATE classes SET class_teacher_id = @t9a WHERE id = @c9a;
UPDATE classes SET class_teacher_id = @t9b WHERE id = @c9b;
UPDATE classes SET class_teacher_id = @t10a WHERE id = @c10a;
UPDATE classes SET class_teacher_id = @t10b WHERE id = @c10b;

-- ----------------------------------------------------------------------------
-- 7) Students (3–4 per class, approved, with admission numbers)
-- ----------------------------------------------------------------------------
INSERT INTO students (id, name, roll_no, class_id, school_id, parent_name, parent_phone, parent_email, address, date_of_birth, gender, status, admission_number) VALUES
(UUID(), 'Arjun Kumar', '1', @c1a, @school_id, 'Ramesh Kumar', '9991111001', 'r.kumar@demo.com', '101 Street 1', '2018-04-01', 'male', 'approved', 'ADM-DEMO-001'),
(UUID(), 'Priya Sharma', '2', @c1a, @school_id, 'Suresh Sharma', '9991111002', 's.sharma@demo.com', '102 Street 2', '2018-05-02', 'female', 'approved', 'ADM-DEMO-002'),
(UUID(), 'Vikram Singh', '3', @c1a, @school_id, 'Raj Singh', '9991111003', 'raj.s@demo.com', '103 Street 3', '2018-06-01', 'male', 'approved', 'ADM-DEMO-003'),
(UUID(), 'Ananya Reddy', '1', @c1b, @school_id, 'Kiran Reddy', '9991111004', 'k.reddy@demo.com', '104 Street 4', '2018-07-15', 'female', 'approved', 'ADM-DEMO-004'),
(UUID(), 'Rohan Mehta', '2', @c1b, @school_id, 'Amit Mehta', '9991111005', 'a.mehta@demo.com', '105 Street 5', '2018-08-20', 'male', 'approved', 'ADM-DEMO-005'),
(UUID(), 'Kavya Nair', '3', @c1b, @school_id, 'Deepak Nair', '9991111006', 'd.nair@demo.com', '106 Street 6', '2018-09-10', 'female', 'approved', 'ADM-DEMO-006'),
(UUID(), 'Aditya Patel', '1', @c2a, @school_id, 'Sanjay Patel', '9992222001', 's.patel@demo.com', '201 Street 1', '2017-03-01', 'male', 'approved', 'ADM-DEMO-007'),
(UUID(), 'Isha Gupta', '2', @c2a, @school_id, 'Rahul Gupta', '9992222002', 'r.gupta@demo.com', '202 Street 2', '2017-04-15', 'female', 'approved', 'ADM-DEMO-008'),
(UUID(), 'Rahul Verma', '3', @c2a, @school_id, 'Vikram Verma', '9992222003', 'v.verma@demo.com', '203 Street 3', '2017-05-20', 'male', 'approved', 'ADM-DEMO-009'),
(UUID(), 'Sneha Joshi', '1', @c2b, @school_id, 'Anil Joshi', '9992222004', 'a.joshi@demo.com', '204 Street 4', '2017-06-01', 'female', 'approved', 'ADM-DEMO-010'),
(UUID(), 'Karan Malhotra', '2', @c2b, @school_id, 'Ravi Malhotra', '9992222005', 'r.malhotra@demo.com', '205 Street 5', '2017-07-10', 'male', 'approved', 'ADM-DEMO-011'),
(UUID(), 'Neha Kapoor', '1', @c3a, @school_id, 'Rajesh Kapoor', '9993333001', 'r.kapoor@demo.com', '301 Street 1', '2016-01-05', 'female', 'approved', 'ADM-DEMO-012'),
(UUID(), 'Aarav Iyer', '2', @c3a, @school_id, 'Suresh Iyer', '9993333002', 's.iyer@demo.com', '302 Street 2', '2016-02-10', 'male', 'approved', 'ADM-DEMO-013'),
(UUID(), 'Diya Menon', '3', @c3a, @school_id, 'Kumar Menon', '9993333003', 'k.menon@demo.com', '303 Street 3', '2016-03-15', 'female', 'approved', 'ADM-DEMO-014'),
(UUID(), 'Arnav Desai', '1', @c3b, @school_id, 'Manoj Desai', '9993333004', 'm.desai@demo.com', '304 Street 4', '2016-04-20', 'male', 'approved', 'ADM-DEMO-015'),
(UUID(), 'Riya Rao', '2', @c3b, @school_id, 'Venkat Rao', '9993333005', 'v.rao@demo.com', '305 Street 5', '2016-05-25', 'female', 'approved', 'ADM-DEMO-016'),
(UUID(), 'Vivaan Bhat', '1', @c4a, @school_id, 'Srinivas Bhat', '9994444001', 's.bhat@demo.com', '401 Street 1', '2015-06-01', 'male', 'approved', 'ADM-DEMO-017'),
(UUID(), 'Anika Krishnan', '2', @c4a, @school_id, 'Lakshman Krishnan', '9994444002', 'l.krishnan@demo.com', '402 Street 2', '2015-07-10', 'female', 'approved', 'ADM-DEMO-018'),
(UUID(), 'Reyansh Pillai', '1', @c4b, @school_id, 'Gopal Pillai', '9994444003', 'g.pillai@demo.com', '403 Street 3', '2015-08-15', 'male', 'approved', 'ADM-DEMO-019'),
(UUID(), 'Aadhya Nambiar', '2', @c4b, @school_id, 'Raj Nambiar', '9994444004', 'r.nambiar@demo.com', '404 Street 4', '2015-09-20', 'female', 'approved', 'ADM-DEMO-020'),
(UUID(), 'Vihaan Choudhury', '1', @c5a, @school_id, 'Anup Choudhury', '9995555001', 'a.choudhury@demo.com', '501 Street 1', '2014-10-01', 'male', 'approved', 'ADM-DEMO-021'),
(UUID(), 'Myra Banerjee', '2', @c5a, @school_id, 'Subhash Banerjee', '9995555002', 's.banerjee@demo.com', '502 Street 2', '2014-11-05', 'female', 'approved', 'ADM-DEMO-022'),
(UUID(), 'Advik Ghosh', '1', @c5b, @school_id, 'Bimal Ghosh', '9995555003', 'b.ghosh@demo.com', '503 Street 3', '2014-12-10', 'male', 'approved', 'ADM-DEMO-023'),
(UUID(), 'Ishita Mukherjee', '2', @c5b, @school_id, 'Deb Mukherjee', '9995555004', 'd.mukherjee@demo.com', '504 Street 4', '2015-01-15', 'female', 'approved', 'ADM-DEMO-024'),
(UUID(), 'Rudra Chatterjee', '1', @c6a, @school_id, 'Pranab Chatterjee', '9996666001', 'p.chatterjee@demo.com', '601 Street 1', '2013-02-20', 'male', 'approved', 'ADM-DEMO-025'),
(UUID(), 'Saanvi Das', '2', @c6a, @school_id, 'Nitin Das', '9996666002', 'n.das@demo.com', '602 Street 2', '2013-03-25', 'female', 'approved', 'ADM-DEMO-026'),
(UUID(), 'Ayaan Roy', '1', @c6b, @school_id, 'Sourav Roy', '9996666003', 's.roy@demo.com', '603 Street 3', '2013-04-30', 'male', 'approved', 'ADM-DEMO-027'),
(UUID(), 'Kiara Sengupta', '2', @c6b, @school_id, 'Arindam Sengupta', '9996666004', 'a.sengupta@demo.com', '604 Street 4', '2013-05-05', 'female', 'approved', 'ADM-DEMO-028'),
(UUID(), 'Aarush Basu', '1', @c7a, @school_id, 'Pradip Basu', '9997777001', 'p.basu@demo.com', '701 Street 1', '2012-06-10', 'male', 'approved', 'ADM-DEMO-029'),
(UUID(), 'Avni Bose', '2', @c7a, @school_id, 'Sankar Bose', '9997777002', 's.bose@demo.com', '702 Street 2', '2012-07-15', 'female', 'approved', 'ADM-DEMO-030'),
(UUID(), 'Kabir Dutta', '1', @c7b, @school_id, 'Bikram Dutta', '9997777003', 'b.dutta@demo.com', '703 Street 3', '2012-08-20', 'male', 'approved', 'ADM-DEMO-031'),
(UUID(), 'Zara Sinha', '2', @c7b, @school_id, 'Naveen Sinha', '9997777004', 'n.sinha@demo.com', '704 Street 4', '2012-09-25', 'female', 'approved', 'ADM-DEMO-032'),
(UUID(), 'Aryan Tiwari', '1', @c8a, @school_id, 'Vijay Tiwari', '9998888001', 'v.tiwari@demo.com', '801 Street 1', '2011-10-01', 'male', 'approved', 'ADM-DEMO-033'),
(UUID(), 'Pari Dubey', '2', @c8a, @school_id, 'Ramesh Dubey', '9998888002', 'r.dubey@demo.com', '802 Street 2', '2011-11-05', 'female', 'approved', 'ADM-DEMO-034'),
(UUID(), 'Ishaan Mishra', '1', @c8b, @school_id, 'Sunil Mishra', '9998888003', 's.mishra@demo.com', '803 Street 3', '2011-12-10', 'male', 'approved', 'ADM-DEMO-035'),
(UUID(), 'Anvi Trivedi', '2', @c8b, @school_id, 'Ashok Trivedi', '9998888004', 'a.trivedi@demo.com', '804 Street 4', '2012-01-15', 'female', 'approved', 'ADM-DEMO-036'),
(UUID(), 'Rohan Shukla', '1', @c9a, @school_id, 'Mohan Shukla', '9999999001', 'm.shukla@demo.com', '901 Street 1', '2010-02-20', 'male', 'approved', 'ADM-DEMO-037'),
(UUID(), 'Tanya Pandey', '2', @c9a, @school_id, 'Rakesh Pandey', '9999999002', 'r.pandey@demo.com', '902 Street 2', '2010-03-25', 'female', 'approved', 'ADM-DEMO-038'),
(UUID(), 'Kartik Saxena', '1', @c9b, @school_id, 'Vikram Saxena', '9999999003', 'v.saxena@demo.com', '903 Street 3', '2010-04-30', 'male', 'approved', 'ADM-DEMO-039'),
(UUID(), 'Nisha Agarwal', '2', @c9b, @school_id, 'Rajat Agarwal', '9999999004', 'r.agarwal@demo.com', '904 Street 4', '2010-05-05', 'female', 'approved', 'ADM-DEMO-040'),
(UUID(), 'Rahul Garg', '1', @c10a, @school_id, 'Suresh Garg', '9990000001', 's.garg@demo.com', '1001 Street 1', '2009-06-10', 'male', 'approved', 'ADM-DEMO-041'),
(UUID(), 'Pooja Bansal', '2', @c10a, @school_id, 'Anil Bansal', '9990000002', 'a.bansal@demo.com', '1002 Street 2', '2009-07-15', 'female', 'approved', 'ADM-DEMO-042'),
(UUID(), 'Nikhil Goel', '1', @c10b, @school_id, 'Ravi Goel', '9990000003', 'r.goel@demo.com', '1003 Street 3', '2009-08-20', 'male', 'approved', 'ADM-DEMO-043'),
(UUID(), 'Shreya Mittal', '2', @c10b, @school_id, 'Rajesh Mittal', '9990000004', 'r.mittal@demo.com', '1004 Street 4', '2009-09-25', 'female', 'approved', 'ADM-DEMO-044');

-- Nursery/LKG/UKG: a few students each so those classes are not empty
INSERT INTO students (id, name, roll_no, class_id, school_id, parent_name, parent_phone, status, admission_number) VALUES
(UUID(), 'Baby N1', '1', @c_nur_a, @school_id, 'Parent N1', '9980001001', 'approved', 'ADM-DEMO-N01'),
(UUID(), 'Baby N2', '2', @c_nur_a, @school_id, 'Parent N2', '9980001002', 'approved', 'ADM-DEMO-N02'),
(UUID(), 'Baby L1', '1', @c_lkg_a, @school_id, 'Parent L1', '9980002001', 'approved', 'ADM-DEMO-L01'),
(UUID(), 'Baby U1', '1', @c_ukg_a, @school_id, 'Parent U1', '9980003001', 'approved', 'ADM-DEMO-U01');

-- ----------------------------------------------------------------------------
-- 8) Student enrollments (current + previous year for all students)
-- ----------------------------------------------------------------------------
INSERT INTO student_enrollments (id, student_id, academic_year_id, class_id, roll_no, school_id)
SELECT UUID(), s.id, @ay_2024, s.class_id, s.roll_no, @school_id FROM students s WHERE s.school_id = @school_id;
INSERT INTO student_enrollments (id, student_id, academic_year_id, class_id, roll_no, school_id)
SELECT UUID(), s.id, @ay_2025, s.class_id, s.roll_no, @school_id FROM students s WHERE s.school_id = @school_id;

-- ----------------------------------------------------------------------------
-- 9) Registration links
-- ----------------------------------------------------------------------------
INSERT INTO registration_links (id, school_id, class_id, link_code, is_active)
VALUES (UUID(), @school_id, @c1a, 'REG-DEMO-C1A', TRUE), (UUID(), @school_id, @c2a, 'REG-DEMO-C2A', TRUE);

-- ----------------------------------------------------------------------------
-- 10) Time slots
-- ----------------------------------------------------------------------------
INSERT INTO time_slots (id, school_id, start_time, end_time, type, display_order) VALUES
(UUID(), @school_id, '08:00:00', '08:45:00', 'class', 1),
(UUID(), @school_id, '08:45:00', '09:30:00', 'class', 2),
(UUID(), @school_id, '09:30:00', '09:45:00', 'break', 3),
(UUID(), @school_id, '09:45:00', '10:30:00', 'class', 4),
(UUID(), @school_id, '10:30:00', '11:15:00', 'class', 5),
(UUID(), @school_id, '11:15:00', '12:00:00', 'lunch', 6);

-- ----------------------------------------------------------------------------
-- 11) Timetable (sample: Class 1A Mon first slot)
-- ----------------------------------------------------------------------------
SET @slot1 = (SELECT id FROM time_slots WHERE school_id = @school_id LIMIT 1);
INSERT INTO timetable_entries (id, school_id, class_id, time_slot_id, day_of_week, subject_code, subject_name, teacher_id, teacher_name)
VALUES (UUID(), @school_id, @c1a, @slot1, 'Monday', 'ENG', 'English', @t1a, 'Teacher Class 1A');

-- ----------------------------------------------------------------------------
-- 12) Holidays
-- ----------------------------------------------------------------------------
INSERT INTO holidays (id, school_id, date, name, type) VALUES
(UUID(), @school_id, '2025-08-15', 'Independence Day', 'public'),
(UUID(), @school_id, '2025-10-02', 'Gandhi Jayanti', 'public');

-- ----------------------------------------------------------------------------
-- 13) Teacher leave (sample)
-- ----------------------------------------------------------------------------
INSERT INTO teacher_leaves (id, school_id, teacher_id, teacher_name, start_date, end_date, reason, status)
VALUES (UUID(), @school_id, @t1a, 'Teacher Class 1A', '2025-09-01', '2025-09-02', 'Personal', 'approved');

-- ----------------------------------------------------------------------------
-- 14) Attendance (sample: one day for Class 1A)
-- ----------------------------------------------------------------------------
INSERT INTO attendance (id, student_id, class_id, date, status, marked_by)
SELECT UUID(), s.id, @c1a, '2025-09-15', 'present', @t1a FROM students s WHERE s.class_id = @c1a;

-- ----------------------------------------------------------------------------
-- 15) Teacher attendance (sample)
-- ----------------------------------------------------------------------------
INSERT INTO teacher_attendance (id, teacher_id, school_id, date, status, marked_by)
VALUES (UUID(), @t1a, @school_id, '2025-09-15', 'present', @admin_id);

-- ----------------------------------------------------------------------------
-- 16) Homework
-- ----------------------------------------------------------------------------
SET @hw1 = UUID();
INSERT INTO homework (id, title, description, subject, class_id, teacher_id, school_id, due_date, status)
VALUES (@hw1, 'English Chapter 1', 'Read and write new words', 'English', @c1a, @t1a, @school_id, '2025-10-01', 'active');
INSERT INTO homework_submissions (id, homework_id, student_id, is_completed)
SELECT UUID(), @hw1, s.id, FALSE FROM students s WHERE s.class_id = @c1a;

-- ----------------------------------------------------------------------------
-- 17) Tests & results
-- ----------------------------------------------------------------------------
SET @test1 = UUID();
INSERT INTO tests (id, name, test_time, test_date, class_id, teacher_id, school_id)
VALUES (@test1, 'Class 1A Unit Test 1', '10:00', '2025-09-20', @c1a, @t1a, @school_id);
SET @subj_eng = (SELECT id FROM subjects WHERE school_id = @school_id AND code = 'ENG' LIMIT 1);
INSERT INTO test_subjects (id, test_id, subject_id, max_marks) VALUES (UUID(), @test1, @subj_eng, 25);
INSERT INTO test_results (id, test_id, student_id, subject_id, marks_obtained, max_marks)
SELECT UUID(), @test1, s.id, @subj_eng, 20, 25 FROM students s WHERE s.class_id = @c1a;

-- ----------------------------------------------------------------------------
-- 18) Fee categories
-- ----------------------------------------------------------------------------
INSERT INTO fee_categories (id, school_id, name, amount, frequency, is_active)
VALUES (UUID(), @school_id, 'Tuition', 5000, 'monthly', TRUE), (UUID(), @school_id, 'Transport', 1500, 'monthly', TRUE);

-- ----------------------------------------------------------------------------
-- 19) Fee structure (Class 1A, current year)
-- ----------------------------------------------------------------------------
INSERT INTO fee_structure (id, school_id, class_id, academic_year_id, total_fee, tuition_fee, transport_fee)
VALUES (UUID(), @school_id, @c1a, @ay_2025, 6500, 5000, 1500);

-- ----------------------------------------------------------------------------
-- 20) Student fees (Class 1A students, current year)
-- ----------------------------------------------------------------------------
INSERT INTO student_fees (id, student_id, class_id, school_id, academic_year_id, total_fee, paid_amount, pending_amount, status, due_date)
SELECT UUID(), s.id, @c1a, @school_id, @ay_2025, 6500, 0, 6500, 'unpaid', '2025-10-31' FROM students s WHERE s.class_id = @c1a;

-- ----------------------------------------------------------------------------
-- 21) Fee payment (one sample)
-- ----------------------------------------------------------------------------
SET @sf_id = (SELECT id FROM student_fees WHERE school_id = @school_id LIMIT 1);
INSERT INTO fee_payments (id, student_fee_id, amount, payment_date, payment_method, receipt_number, created_by)
VALUES (UUID(), @sf_id, 2000, '2025-09-01', 'cash', 'RCP-DEMO-001', @admin_id);

-- ----------------------------------------------------------------------------
-- 22) Notifications
-- ----------------------------------------------------------------------------
SET @notif1 = UUID();
INSERT INTO notifications (id, school_id, sender_id, sender_role, title, message, target_type, priority, status, sent_count)
VALUES (@notif1, @school_id, @admin_id, 'admin', 'Welcome 2025-26', 'New session has started. Check timetable.', 'all_classes', 'normal', 'sent', 0);
INSERT INTO notification_recipients (id, notification_id, recipient_type, recipient_id, is_read)
VALUES (UUID(), @notif1, 'teacher', @t1a, FALSE);

-- ----------------------------------------------------------------------------
-- 23) Notification template
-- ----------------------------------------------------------------------------
INSERT INTO notification_templates (id, school_id, name, title, message, created_by)
VALUES (UUID(), @school_id, 'Holiday', 'Holiday Notice', 'School will remain closed.', @admin_id);

-- ----------------------------------------------------------------------------
-- 24) ID card template
-- ----------------------------------------------------------------------------
INSERT INTO id_card_templates (id, school_id, name, template_data, is_default)
VALUES (UUID(), @school_id, 'Default ID Card', '{}', TRUE);

-- ============================================================================
-- DEMO DATA COMPLETE
-- ============================================================================
-- Admin:  admin@democonvent.com  /  password
-- Teachers: teacher_nur_a, teacher_1a, teacher_2a, ... teacher_10b  /  password
-- ============================================================================
