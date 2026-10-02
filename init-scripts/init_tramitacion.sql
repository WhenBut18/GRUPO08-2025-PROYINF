CREATE DATABASE IF NOT EXISTS BD08_TRAMITACION;
USE BD08_TRAMITACION;
-- Recomendado: activar SQL_MODE seguro
SET sql_mode = 'STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- =========================================
-- DB: API_TRAMITACIONES
-- =========================================

-- LOAN_SIMULATIONS
CREATE TABLE loan_simulations (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36),                          -- referencia lógica a API_USUARIOS.users(id)
  amount DECIMAL(12,2) NOT NULL,
  months INT NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL,
  monthly_payment DECIMAL(12,2) NOT NULL,
  total_payment DECIMAL(12,2) NOT NULL,
  total_interest DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE INDEX idx_loan_simulations_user_id ON loan_simulations(user_id);

-- LOAN_APPLICATIONS
CREATE TABLE loan_applications (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,                 -- referencia lógica a API_USUARIOS.users(id)
  simulation_id CHAR(36),                    -- FK interna a esta misma DB
  amount DECIMAL(12,2) NOT NULL,
  months INT NOT NULL,
  monthly_payment DECIMAL(12,2) NOT NULL,
  status ENUM('pending','under_review','approved','rejected','signed', 'payed') DEFAULT 'pending',
  employment_status VARCHAR(100),
  monthly_income DECIMAL(12,2),
  notes TEXT,
  score DECIMAL(5,4),                        -- probabilidad de default del modelo de scoring (0–1)
  scoring_decision VARCHAR(20),              -- hard_filter_edad | hard_filter_dti | model_approve | model_reject | scoring_unavailable
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_app_simulation
    FOREIGN KEY (simulation_id) REFERENCES loan_simulations(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_loan_applications_user_id ON loan_applications(user_id);
CREATE INDEX idx_loan_applications_simulation_id ON loan_applications(simulation_id);

-- WEBPAY_TRANSACTIONS (para transacciones de pago)
CREATE TABLE webpay_transactions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  loan_application_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  buy_order VARCHAR(255) NOT NULL UNIQUE,
  token VARCHAR(255) NOT NULL UNIQUE,
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('initiated','completed','failed','cancelled') DEFAULT 'initiated',
  response_code INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_webpay_app
    FOREIGN KEY (loan_application_id) REFERENCES loan_applications(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_webpay_user_id ON webpay_transactions(user_id);
CREATE INDEX idx_webpay_loan_id ON webpay_transactions(loan_application_id);
CREATE INDEX idx_webpay_status ON webpay_transactions(status);