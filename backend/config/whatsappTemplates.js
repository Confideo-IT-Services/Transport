/**
 * WhatsApp Template Configuration
 * Maps message types to their corresponding WhatsApp templates
 */

module.exports = {
  // Homework notifications
  homework: {
    templateName: 'convent_pulse_hw_clone', // or 'convent_pulse_hw' - your existing template
    language: 'en',
    paramCount: 5,
    description: 'Homework alerts with subject details and due dates',
    // Parameters: [student_name, date_formatted, subjects_list, due_date, school_name]
  },

  // Monthly attendance reports
  attendance: {
    templateName: 'convent_pulse_attendance', // Your new approved template
    language: 'en',
    paramCount: 5,
    description: 'Monthly attendance percentage reports to parents',
    // Parameters: [parent_name, month, student_name, attendance_percentage, school_name]
  },

  // Test details notifications
  test: {
    templateName: 'convent_pulse_tests',
    language: 'en',
    paramCount: 8,
    description: 'Test notifications with syllabus details to parents',
    // Parameters: [parent_name, test_name, test_date, class_name, duration, syllabus, student_name, school_name]
  }
};

