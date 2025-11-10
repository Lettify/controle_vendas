-- Setup database for controle-vendas
USE controle_vendas;

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS `users` (
  `id` varchar(64) NOT NULL,
  `name` text DEFAULT NULL,
  `email` varchar(320) DEFAULT NULL,
  `role` enum('user', 'admin') NOT NULL DEFAULT 'user',
  `createdAt` timestamp NULL DEFAULT current_timestamp(),
  `lastSignedIn` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de códigos de acesso
CREATE TABLE IF NOT EXISTS `access_codes` (
  `id` varchar(64) NOT NULL,
  `code` varchar(20) NOT NULL,
  `companyId` varchar(64) NOT NULL,
  `createdBy` varchar(64) NOT NULL,
  `createdAt` timestamp NULL DEFAULT current_timestamp(),
  `expiresAt` timestamp NULL DEFAULT NULL,
  `usedAt` timestamp NULL DEFAULT NULL,
  `usedBy` varchar(64) DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `description` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `access_codes_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de funcionários
CREATE TABLE IF NOT EXISTS `employees` (
  `id` varchar(64) NOT NULL,
  `companyId` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(320) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `position` varchar(255) DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` timestamp NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de vendas diárias
CREATE TABLE IF NOT EXISTS `daily_sales` (
  `id` varchar(64) NOT NULL,
  `employeeId` varchar(64) NOT NULL,
  `companyId` varchar(64) NOT NULL,
  `date` varchar(10) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `createdAt` timestamp NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
