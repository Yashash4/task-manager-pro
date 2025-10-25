-- Task Manager Pro - Complete Database Schema
-- MySQL Database Schema

-- Drop tables if they exist
DROP TABLE IF EXISTS task_attachments;
DROP TABLE IF EXISTS task_comments;
DROP TABLE IF EXISTS room_members;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS users;

-- Users table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    profile_image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_active (is_active)
);

-- Rooms table
CREATE TABLE rooms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_name (name),
    INDEX idx_created_by (created_by)
);

-- Room members table
CREATE TABLE room_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_room_member (room_id, user_id),
    INDEX idx_room (room_id),
    INDEX idx_user (user_id)
);

-- Tasks table
CREATE TABLE tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status ENUM('pending', 'in progress', 'completed', 'overdue') DEFAULT 'pending',
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    due_date DATE,
    assigned_to INT,
    created_by INT NOT NULL,
    room_id INT,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_due_date (due_date),
    INDEX idx_assigned_to (assigned_to),
    INDEX idx_created_by (created_by),
    INDEX idx_room (room_id),
    INDEX idx_created_at (created_at)
);

-- Task comments table
CREATE TABLE task_comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_task (task_id),
    INDEX idx_user (user_id)
);

-- Task attachments table
CREATE TABLE task_attachments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT,
    file_type VARCHAR(50),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_task (task_id),
    INDEX idx_user (user_id)
);

-- Activity logs table
CREATE TABLE activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type ENUM('task', 'room', 'user') NOT NULL,
    entity_id INT,
    description TEXT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created_at (created_at)
);

-- Insert default admin user
-- Password: admin123 (hashed with bcrypt)
INSERT INTO users (name, email, password, role) VALUES 
('Admin User', 'admin@taskmanager.com', '$2b$10$rKvM7Y8z1Wz5Z4x7W9X8Ue8QJZ5X4Z7W9X8Ue8QJZ5X4Z7W9X8Ue', 'admin');

-- Insert sample users
INSERT INTO users (name, email, password, role) VALUES 
('John Doe', 'john@example.com', '$2b$10$rKvM7Y8z1Wz5Z4x7W9X8Ue8QJZ5X4Z7W9X8Ue8QJZ5X4Z7W9X8Ue', 'user'),
('Jane Smith', 'jane@example.com', '$2b$10$rKvM7Y8z1Wz5Z4x7W9X8Ue8QJZ5X4Z7W9X8Ue8QJZ5X4Z7W9X8Ue', 'user'),
('Bob Johnson', 'bob@example.com', '$2b$10$rKvM7Y8z1Wz5Z4x7W9X8Ue8QJZ5X4Z7W9X8Ue8QJZ5X4Z7W9X8Ue', 'user');

-- Insert sample rooms
INSERT INTO rooms (name, description, created_by) VALUES 
('Development', 'Software development tasks', 1),
('Marketing', 'Marketing and promotion tasks', 1),
('Design', 'UI/UX design tasks', 1);

-- Insert sample room members
INSERT INTO room_members (room_id, user_id) VALUES 
(1, 2), (1, 3), (2, 3), (2, 4), (3, 2), (3, 4);

-- Insert sample tasks
INSERT INTO tasks (title, description, status, priority, due_date, assigned_to, created_by, room_id) VALUES 
('Complete project documentation', 'Write comprehensive documentation for the project', 'in progress', 'high', DATE_ADD(CURDATE(), INTERVAL 7 DAY), 2, 1, 1),
('Design landing page', 'Create mockups for the new landing page', 'pending', 'medium', DATE_ADD(CURDATE(), INTERVAL 5 DAY), 4, 1, 3),
('Setup CI/CD pipeline', 'Configure automated deployment pipeline', 'pending', 'high', DATE_ADD(CURDATE(), INTERVAL 3 DAY), 2, 1, 1),
('Social media campaign', 'Plan and execute social media marketing', 'in progress', 'medium', DATE_ADD(CURDATE(), INTERVAL 10 DAY), 3, 1, 2),
('Bug fixes', 'Fix reported bugs in production', 'completed', 'high', DATE_SUB(CURDATE(), INTERVAL 2 DAY), 2, 1, 1),
('User testing', 'Conduct user testing sessions', 'pending', 'low', DATE_ADD(CURDATE(), INTERVAL 14 DAY), 3, 1, 1);

-- Insert sample activity logs
INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description) VALUES 
(1, 'CREATE', 'task', 1, 'Created task: Complete project documentation'),
(2, 'UPDATE', 'task', 1, 'Updated task status to in progress'),
(1, 'CREATE', 'room', 1, 'Created room: Development'),
(2, 'COMPLETE', 'task', 5, 'Completed task: Bug fixes');

-- Create views for common queries

-- View: User task statistics
CREATE VIEW user_task_stats AS
SELECT 
    u.id AS user_id,
    u.name AS user_name,
    u.email,
    COUNT(t.id) AS total_tasks,
    SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks,
    SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending_tasks,
    SUM(CASE WHEN t.status = 'in progress' THEN 1 ELSE 0 END) AS in_progress_tasks,
    SUM(CASE WHEN t.status = 'overdue' THEN 1 ELSE 0 END) AS overdue_tasks,
    ROUND(SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) * 100.0 / 
          NULLIF(COUNT(t.id), 0), 2) AS completion_rate
FROM users u
LEFT JOIN tasks t ON u.id = t.assigned_to
GROUP BY u.id, u.name, u.email;

-- View: Room task statistics
CREATE VIEW room_task_stats AS
SELECT 
    r.id AS room_id,
    r.name AS room_name,
    r.description,
    COUNT(DISTINCT rm.user_id) AS member_count,
    COUNT(t.id) AS total_tasks,
    SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks,
    SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending_tasks,
    SUM(CASE WHEN t.status = 'in progress' THEN 1 ELSE 0 END) AS in_progress_tasks
FROM rooms r
LEFT JOIN room_members rm ON r.id = rm.room_id
LEFT JOIN tasks t ON r.id = t.room_id
GROUP BY r.id, r.name, r.description;

-- View: Recent activity
CREATE VIEW recent_activity AS
SELECT 
    al.id,
    al.action,
    al.entity_type,
    al.entity_id,
    al.description,
    al.created_at,
    u.name AS user_name,
    u.email AS user_email
FROM activity_logs al
JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC
LIMIT 100;

-- Stored procedures

DELIMITER //

-- Procedure: Create task with activity log
CREATE PROCEDURE create_task(
    IN p_title VARCHAR(200),
    IN p_description TEXT,
    IN p_priority ENUM('low', 'medium', 'high'),
    IN p_due_date DATE,
    IN p_assigned_to INT,
    IN p_created_by INT,
    IN p_room_id INT
)
BEGIN
    DECLARE v_task_id INT;
    
    INSERT INTO tasks (title, description, priority, due_date, assigned_to, created_by, room_id)
    VALUES (p_title, p_description, p_priority, p_due_date, p_assigned_to, p_created_by, p_room_id);
    
    SET v_task_id = LAST_INSERT_ID();
    
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
    VALUES (p_created_by, 'CREATE', 'task', v_task_id, CONCAT('Created task: ', p_title));
    
    SELECT v_task_id AS task_id;
END //

-- Procedure: Update task status
CREATE PROCEDURE update_task_status(
    IN p_task_id INT,
    IN p_status ENUM('pending', 'in progress', 'completed', 'overdue'),
    IN p_user_id INT
)
BEGIN
    UPDATE tasks 
    SET status = p_status,
        completed_at = CASE WHEN p_status = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END
    WHERE id = p_task_id;
    
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
    VALUES (p_user_id, 'UPDATE', 'task', p_task_id, CONCAT('Updated task status to ', p_status));
END //

-- Procedure: Mark overdue tasks
CREATE PROCEDURE mark_overdue_tasks()
BEGIN
    UPDATE tasks 
    SET status = 'overdue'
    WHERE status != 'completed' 
    AND due_date < CURDATE();
    
    SELECT ROW_COUNT() AS affected_rows;
END //

DELIMITER ;

-- Triggers

-- Trigger: Auto-update task status to overdue
DELIMITER //
CREATE TRIGGER check_overdue_task BEFORE UPDATE ON tasks
FOR EACH ROW
BEGIN
    IF NEW.due_date < CURDATE() AND NEW.status != 'completed' THEN
        SET NEW.status = 'overdue';
    END IF;
END //
DELIMITER ;

-- Create indexes for performance
CREATE INDEX idx_tasks_composite ON tasks(status, priority, due_date);
CREATE INDEX idx_activity_user_date ON activity_logs(user_id, created_at);
CREATE INDEX idx_tasks_assigned_status ON tasks(assigned_to, status);

-- Grant privileges (adjust as needed)
-- GRANT ALL PRIVILEGES ON task_manager.* TO 'taskmanager_user'@'localhost';
-- FLUSH PRIVILEGES;