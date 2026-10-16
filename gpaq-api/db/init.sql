-- Script de inicialización de Base de Datos para Gestión de FAQ con IA
-- Base de Datos: gestion_faq_bd

-- 1. Tabla de usuarios administradores
CREATE TABLE IF NOT EXISTS `usuarios` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `nombre` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `activo` TINYINT DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de configuración del bot
CREATE TABLE IF NOT EXISTS `configuraciones_bot` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `bot_nombre` VARCHAR(100) NOT NULL DEFAULT 'FAQ Bot',
    `mensaje_bienvenida` VARCHAR(255) NOT NULL DEFAULT '¡Hola! ¿En qué puedo ayudarte hoy?',
    `mensaje_fallback` VARCHAR(255) NOT NULL DEFAULT 'Lo siento, no tengo información sobre eso. ¿Te gustaría que te comunique con un agente?',
    `sector` VARCHAR(100) NOT NULL DEFAULT 'General',
    `temperatura` DECIMAL(2,1) NOT NULL DEFAULT 0.2,
    `system_prompt` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabla de base de conocimiento (FAQs)
CREATE TABLE IF NOT EXISTS `faqs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `pregunta` VARCHAR(255) NOT NULL,
    `respuesta` TEXT NOT NULL,
    `categoria` VARCHAR(100) NOT NULL DEFAULT 'General',
    `activo` TINYINT NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FULLTEXT KEY `pregunta_respuesta_idx` (`pregunta`, `respuesta`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabla de conversaciones
CREATE TABLE IF NOT EXISTS `conversaciones` (
    `id` VARCHAR(36) PRIMARY KEY,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabla de mensajes
CREATE TABLE IF NOT EXISTS `mensajes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `conversacion_id` VARCHAR(36) NOT NULL,
    `remitente` ENUM('user', 'assistant') NOT NULL,
    `contenido` TEXT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`conversacion_id`) REFERENCES `conversaciones`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

