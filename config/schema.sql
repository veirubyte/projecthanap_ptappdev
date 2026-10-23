CREATE DATABASE IF NOT EXISTS projecthanap_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE projecthanap_db;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('Admin', 'Staff', 'Student') NOT NULL DEFAULT 'Student',
  department VARCHAR(100) NOT NULL DEFAULT 'General',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Item Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(255)
) ENGINE=InnoDB;

-- Items Registry Table
CREATE TABLE IF NOT EXISTS items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_code VARCHAR(30) NOT NULL UNIQUE,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  category_id INT,
  location_found VARCHAR(150) NOT NULL,
  item_status ENUM('Lost', 'Turned In', 'Claimed', 'Archived') DEFAULT 'Turned In',
  reported_by INT NOT NULL,
  date_logged DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Seed Categories
INSERT IGNORE INTO categories (id, name, description) VALUES
(1, 'Electronics', 'Laptops, phones, chargers, storage devices, and calculators'),
(2, 'Personal Accessories', 'Bottles, umbrellas, eyeglasses, and jewelry'),
(3, 'Documents & Identification', 'Campus IDs, driver licenses, ATM cards, and notebooks'),
(4, 'Apparel & Bags', 'Jackets, backpacks, lab coats, and uniforms');

-- Seed Initial Test Users
INSERT IGNORE INTO users (id, full_name, email, password_hash, role, department) VALUES
(1, 'System Administrator', 'admin@hanap.campus.edu', '$2b$10$wTf7m339gP6aHjB7E20Wbe94WcIuT4f84R71rGz39uW10Vp6XbCke', 'Admin', 'Management Information Systems'),
(2, 'Campus Security Officer', 'staff@hanap.campus.edu', '$2b$10$yF1aX392pQ4bWzV8D31Vee02VbHtS3e73Q60qFy28tV09Uo5WaBjd', 'Staff', 'Campus Security & Custody Office'),
(3, 'Maria Santos', 'student@hanap.campus.edu', '$2b$10$zE2bY403qR5cXxW9E42Wff13WcIuT4f84R71rGz39uW10Vp6XbCke', 'Student', 'College of Computer Studies');
