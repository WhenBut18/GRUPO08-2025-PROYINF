CREATE DATABASE IF NOT EXISTS BD08_USUARIOS;
USE BD08_USUARIOS;
-- Recomendado: activar SQL_MODE seguro
SET sql_mode = 'STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- =========================================
-- DB: API_USUARIOS
-- =========================================

-- Tabla de apoyo: users (si usas otro proveedor de auth, omite esta tabla y el trigger)
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),               -- opcional si manejas auth acá
  meta_data JSON,                           -- ej: {"full_name":"..."}
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- PROFILES
CREATE TABLE profiles (
  id CHAR(36) PRIMARY KEY,                  -- mismo id del usuario
  full_name VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  rut VARCHAR(20) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_profiles_user
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Trigger: crear profile en alta de usuario
DELIMITER //
CREATE OR REPLACE TRIGGER trg_users_after_insert_create_profile
AFTER INSERT ON users
FOR EACH ROW
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(JSON_UNQUOTE(JSON_EXTRACT(NEW.meta_data, '$.full_name')), '')
  );
END;
//
DELIMITER ;