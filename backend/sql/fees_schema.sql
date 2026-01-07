-- ============ FEE CATEGORIES TABLE ============
CREATE TABLE IF NOT EXISTS fee_categories (
    id VARCHAR(36) PRIMARY KEY,
    school_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    frequency ENUM('monthly', 'quarterly', 'yearly') NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    INDEX idx_school_id (school_id),
    INDEX idx_is_active (is_active)
);

-- ============ FEE STRUCTURE TABLE (Class-wise fees) ============
CREATE TABLE IF NOT EXISTS fee_structure (
    id VARCHAR(36) PRIMARY KEY,
    school_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    academic_year_id VARCHAR(36),
    total_fee DECIMAL(10, 2) NOT NULL,
    tuition_fee DECIMAL(10, 2) DEFAULT 0,
    transport_fee DECIMAL(10, 2) DEFAULT 0,
    lab_fee DECIMAL(10, 2) DEFAULT 0,
    other_fees JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
    UNIQUE KEY unique_class_year (class_id, academic_year_id),
    INDEX idx_school_id (school_id),
    INDEX idx_class_id (class_id),
    INDEX idx_academic_year_id (academic_year_id)
);

-- ============ STUDENT FEES TABLE ============
CREATE TABLE IF NOT EXISTS student_fees (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    school_id VARCHAR(36) NOT NULL,
    academic_year_id VARCHAR(36),
    total_fee DECIMAL(10, 2) NOT NULL,
    paid_amount DECIMAL(10, 2) DEFAULT 0,
    pending_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('paid', 'partial', 'unpaid') DEFAULT 'unpaid',
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
    INDEX idx_student_id (student_id),
    INDEX idx_class_id (class_id),
    INDEX idx_status (status),
    INDEX idx_school_id (school_id)
);

-- ============ FEE PAYMENTS TABLE ============
CREATE TABLE IF NOT EXISTS fee_payments (
    id VARCHAR(36) PRIMARY KEY,
    student_fee_id VARCHAR(36) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method ENUM('cash', 'cheque', 'online', 'bank_transfer') DEFAULT 'cash',
    transaction_id VARCHAR(100),
    receipt_number VARCHAR(50),
    remarks TEXT,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_student_fee_id (student_fee_id),
    INDEX idx_payment_date (payment_date),
    INDEX idx_receipt_number (receipt_number)
);


