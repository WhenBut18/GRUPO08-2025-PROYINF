CREATE DATABASE IF NOT EXISTS BD08_VALIDACION;
USE BD08_VALIDACION;
-- Recomendado: activar SQL_MODE seguro
SET sql_mode = 'STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- =========================================
-- DB: API_VALIDACION
-- =========================================

-- PAYMENTS
CREATE TABLE payments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  loan_application_id CHAR(36) NOT NULL,     -- referencia lógica a API_TRAMITACIONES.loan_applications(id)
  user_id CHAR(36) NOT NULL,                 -- referencia lógica a API_USUARIOS.users(id)
  amount DECIMAL(12,2) NOT NULL,
  payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  payment_method VARCHAR(100) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_loan_application_id ON payments(loan_application_id);