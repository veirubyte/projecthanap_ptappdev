-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 23, 2026 at 02:13 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `project_hanap`
--

-- --------------------------------------------------------

--
-- Table structure for table `account_roles`
--

CREATE TABLE `account_roles` (
  `id` int(10) UNSIGNED NOT NULL,
  `role_code` varchar(32) NOT NULL,
  `display_name` varchar(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `account_roles`
--

INSERT INTO `account_roles` (`id`, `role_code`, `display_name`) VALUES
(1, 'student', 'Student'),
(2, 'staff', 'Staff'),
(3, 'parent', 'Parent / Guardian'),
(4, 'guest', 'Guest'),
(5, 'admin', 'Administrator'),
(6, 'legacy_institutional', 'Unclassified institutional account');

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL,
  `admin_id` int(11) NOT NULL,
  `action_description` varchar(255) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `audit_logs`
--

INSERT INTO `audit_logs` (`id`, `admin_id`, `action_description`, `ip_address`, `timestamp`) VALUES
(1, 1, 'Admin changed role of user #3 to staff', '::1', '2026-10-22 21:57:18');

-- --------------------------------------------------------

--
-- Table structure for table `claims`
--

CREATE TABLE `claims` (
  `id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `claimant_id` int(11) NOT NULL,
  `proof_details` text NOT NULL,
  `status` enum('pending','approved','rejected','escalated','returned') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `claims`
--

INSERT INTO `claims` (`id`, `item_id`, `claimant_id`, `proof_details`, `status`, `created_at`) VALUES
(1, 1, 3, 'My student ID is inside with name Maria Santos, 3rd year CCS.', 'pending', '2026-10-15 05:39:27'),
(4, 1, 9, ',hjgyrr', 'pending', '2026-10-18 02:50:21');

-- --------------------------------------------------------

--
-- Table structure for table `claim_messages`
--

CREATE TABLE `claim_messages` (
  `id` int(11) NOT NULL,
  `claim_id` int(11) NOT NULL,
  `sender_id` int(11) NOT NULL,
  `message` text NOT NULL,
  `sent_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `claim_messages`
--

INSERT INTO `claim_messages` (`id`, `claim_id`, `sender_id`, `message`, `sent_at`) VALUES
(1, 1, 3, 'Hi! I lost this lanyard yesterday in the library. My ID card is inside.', '2026-10-15 05:39:27'),
(5, 4, 9, 'Ownership Claim Filed:\n\",hjgyrr\"', '2026-10-18 02:50:21');

-- --------------------------------------------------------

--
-- Table structure for table `departments`
--

CREATE TABLE `departments` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `guardian_student_links`
--

CREATE TABLE `guardian_student_links` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `guardian_user_id` int(11) NOT NULL,
  `student_user_id` int(11) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `requested_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `responded_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `item_reports`
--

CREATE TABLE `item_reports` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `report_type` enum('lost','found') NOT NULL,
  `item_name` varchar(100) NOT NULL,
  `category` varchar(50) NOT NULL,
  `description` text NOT NULL,
  `location_found_lost` varchar(150) NOT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  `status` enum('active','claimed','returned','archived','pending_review') DEFAULT 'active',
  `date_reported` timestamp NOT NULL DEFAULT current_timestamp(),
  `secret_challenge` varchar(500) DEFAULT NULL,
  `custody_mode` enum('peer_meetup','security_desk') DEFAULT 'peer_meetup',
  `secret_answer` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `item_reports`
--

INSERT INTO `item_reports` (`id`, `user_id`, `report_type`, `item_name`, `category`, `description`, `location_found_lost`, `image_path`, `status`, `date_reported`, `secret_challenge`, `custody_mode`, `secret_answer`) VALUES
(1, 2, 'found', 'Blue CSPC CCS Department ID Lanyard', 'Keys & Lanyards', 'Official CSPC CCS department lanyard with transparent badge holder.', 'Main Library', NULL, 'active', '2026-10-15 05:39:27', 'What pin is attached to the clip?', 'peer_meetup', 'College of Computer Studies'),
(2, 3, 'lost', 'Black SanDisk 32GB Flash Drive', 'Electronics', 'Contains IT capstone files and research drafts.', 'ComLab 2', NULL, 'active', '2026-10-15 05:39:27', NULL, 'peer_meetup', NULL),
(3, 1, 'found', 'Casio fx-991EX Calculator', 'Electronics', 'Silver scientific calculator with initials inscribed.', 'Engineering Rm 304', NULL, 'claimed', '2026-10-15 05:39:27', NULL, 'peer_meetup', NULL),
(4, 2, 'found', 'Silver Water Bottle', 'Tumblers & Bottles', 'Stainless steel with stickers', 'Gym Bench', NULL, 'active', '2026-10-15 05:39:28', 'What color is the lid?', 'security_desk', 'Black'),
(5, 9, 'lost', 'PurchaseSubscription', 'Electronics', 'ghbntrh', 'g trj tj', '/uploads/1792327986336-e31db6c8e112.jpeg', 'active', '2026-10-18 12:53:06', ',mgrt h', 'peer_meetup', 'vfdbn');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `role_id` int(10) UNSIGNED NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `phone_number` varchar(50) DEFAULT NULL,
  `student_id` varchar(50) DEFAULT NULL,
  `department_id` int(11) DEFAULT NULL,
  `mfa_enabled` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `role_id`, `full_name`, `email`, `password_hash`, `created_at`, `phone_number`, `student_id`, `department_id`, `mfa_enabled`) VALUES
(1, 5, 'Admin User', 'admin@cspc.edu.ph', '$2b$10$tA84vPOy50ZVHkLWROKJF.UDd7tA5qZuAftoYjX6KjsNG12VB9VZ.', '2026-10-15 05:39:27', NULL, NULL, NULL, 0),
(2, 6, 'Juan Dela Cruz', 'juan@my.cspc.edu.ph', '$2b$10$tA84vPOy50ZVHkLWROKJF.UDd7tA5qZuAftoYjX6KjsNG12VB9VZ.', '2026-10-15 05:39:27', NULL, NULL, NULL, 0),
(3, 2, 'Maria Santos', 'maria@my.cspc.edu.ph', '$2b$10$tA84vPOy50ZVHkLWROKJF.UDd7tA5qZuAftoYjX6KjsNG12VB9VZ.', '2026-10-15 05:39:27', NULL, NULL, NULL, 0),
(4, 4, 'Parent Guest', 'parent@gmail.com', '$2b$10$tA84vPOy50ZVHkLWROKJF.UDd7tA5qZuAftoYjX6KjsNG12VB9VZ.', '2026-10-15 05:39:27', NULL, NULL, NULL, 0),
(5, 6, 'Valid Student', 'new_1792042767909@my.cspc.edu.ph', '$2b$10$slqgN.mSCIAQwcCZqA4BIe09fB6iQoEVvN0JRugnUgmk53gEkRhq2', '2026-10-15 05:39:27', NULL, NULL, NULL, 0),
(6, 4, 'Valid Guest', 'guest_1792042767976@yahoo.com', '$2b$10$YBiOFJGW.FqmDHF6k2jrp.Wmw0BCyvgeHmWntb1M3JXznTTHAqirO', '2026-10-15 05:39:28', NULL, NULL, NULL, 0),
(7, 6, 'Hacker', 'hacker_1792042768039@my.cspc.edu.ph', '$2b$10$V.AU0bH9ySFS9f.RfZKiAefedkJtt/pXwv/hM3zghzB4l9Bu3TfKO', '2026-10-15 05:39:28', NULL, NULL, NULL, 0),
(9, 1, 'marta', 'marta@my.cspc.edu.ph', '$2b$10$pMiiE4tT2wjj8sYmkXl0..VtVMKGemmJiYwzZAUalLydOBRGxxgkq', '2026-10-18 01:45:39', '', '2410979', NULL, 0),
(10, 2, 'Janel Laynes', 'jalaynes@my.cspc.edu.ph', '$2b$10$OOy7CfG1LBH.gnzJB1S5X.OxOkJADg3UpYWK8o5mXbTmjUsj257SK', '2026-10-18 12:58:08', NULL, NULL, NULL, 1),
(11, 4, 'esabel', 'esable@gmail.com', '$2b$10$pMEAZc47a50WD18iGi3NHeGdSny2s4UEKmEc3P7ShySvkDOuWSkYy', '2026-10-18 13:01:35', NULL, NULL, NULL, 0);

-- --------------------------------------------------------

--
-- Table structure for table `user_mfa`
--

CREATE TABLE `user_mfa` (
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 0,
  `code_hash` varchar(60) DEFAULT NULL,
  `code_expires_at` datetime DEFAULT NULL,
  `attempts` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `last_sent_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_mfa`
--

INSERT INTO `user_mfa` (`user_id`, `enabled`, `code_hash`, `code_expires_at`, `attempts`, `last_sent_at`) VALUES
(9, 0, NULL, NULL, 0, '2026-10-22 23:32:23'),
(10, 0, NULL, NULL, 0, NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `account_roles`
--
ALTER TABLE `account_roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_account_roles_code` (`role_code`);

--
-- Indexes for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `admin_id` (`admin_id`);

--
-- Indexes for table `claims`
--
ALTER TABLE `claims`
  ADD PRIMARY KEY (`id`),
  ADD KEY `item_id` (`item_id`),
  ADD KEY `claimant_id` (`claimant_id`);

--
-- Indexes for table `claim_messages`
--
ALTER TABLE `claim_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `claim_id` (`claim_id`),
  ADD KEY `sender_id` (`sender_id`);

--
-- Indexes for table `departments`
--
ALTER TABLE `departments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_departments_name` (`name`);

--
-- Indexes for table `guardian_student_links`
--
ALTER TABLE `guardian_student_links`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_guardian_student` (`guardian_user_id`,`student_user_id`),
  ADD KEY `idx_guardian_links_student_status` (`student_user_id`,`status`);

--
-- Indexes for table `item_reports`
--
ALTER TABLE `item_reports`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `fk_users_account_role` (`role_id`),
  ADD KEY `fk_users_department` (`department_id`);

--
-- Indexes for table `user_mfa`
--
ALTER TABLE `user_mfa`
  ADD PRIMARY KEY (`user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `account_roles`
--
ALTER TABLE `account_roles`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `claims`
--
ALTER TABLE `claims`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `claim_messages`
--
ALTER TABLE `claim_messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `departments`
--
ALTER TABLE `departments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `guardian_student_links`
--
ALTER TABLE `guardian_student_links`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `item_reports`
--
ALTER TABLE `item_reports`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `claims`
--
ALTER TABLE `claims`
  ADD CONSTRAINT `claims_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `item_reports` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `claims_ibfk_2` FOREIGN KEY (`claimant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `claim_messages`
--
ALTER TABLE `claim_messages`
  ADD CONSTRAINT `claim_messages_ibfk_1` FOREIGN KEY (`claim_id`) REFERENCES `claims` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `claim_messages_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `guardian_student_links`
--
ALTER TABLE `guardian_student_links`
  ADD CONSTRAINT `fk_guardian_links_guardian` FOREIGN KEY (`guardian_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_guardian_links_student` FOREIGN KEY (`student_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `item_reports`
--
ALTER TABLE `item_reports`
  ADD CONSTRAINT `item_reports_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_account_role` FOREIGN KEY (`role_id`) REFERENCES `account_roles` (`id`),
  ADD CONSTRAINT `fk_users_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
