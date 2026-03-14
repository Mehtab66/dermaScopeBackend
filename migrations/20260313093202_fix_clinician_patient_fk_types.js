/**
 * Ensure users.id is INT UNSIGNED, then clinician_patient.clinician_id matches
 * and its foreign key is compatible with users.id.
 *
 * We ensure users.id type first, drop the existing FK, change clinician_id to match, then recreate the FK.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // To make users.id UNSIGNED we must first drop any FKs that reference it
  // with a signed column type (e.g. audit_logs.user_id, clinician_patient.clinician_id, patients.clinician_id).

  // 0) Drop FK from audit_logs.user_id -> users.id if present
  const [auditRows] = await knex.raw(`
    SELECT CONSTRAINT_NAME AS fk_name
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'audit_logs'
      AND COLUMN_NAME = 'user_id'
      AND REFERENCED_TABLE_NAME = 'users'
    LIMIT 1
  `);
  const auditFirst = Array.isArray(auditRows) ? auditRows[0] : null;
  const auditFkName = auditFirst ? (auditFirst.fk_name || auditFirst.FK_NAME) : null;
  if (auditFkName) {
    const safeAudit = '`' + String(auditFkName).replace(/`/g, '``') + '`';
    await knex.raw('ALTER TABLE audit_logs DROP FOREIGN KEY ' + safeAudit);
  }

  // 1) Drop existing FK on clinician_patient.clinician_id if present
  const hasClinicianPatient = await knex.schema.hasTable('clinician_patient');
  if (hasClinicianPatient) {
    const [rows] = await knex.raw(`
      SELECT CONSTRAINT_NAME AS fk_name
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'clinician_patient'
        AND COLUMN_NAME = 'clinician_id'
        AND REFERENCED_TABLE_NAME = 'users'
      LIMIT 1
    `);
    const first = Array.isArray(rows) ? rows[0] : null;
    const fkName = first ? (first.fk_name || first.FK_NAME) : null;
    if (fkName) {
      const safeName = '`' + String(fkName).replace(/`/g, '``') + '`';
      await knex.raw('ALTER TABLE clinician_patient DROP FOREIGN KEY ' + safeName);
    }
  }

  // 2) Drop existing FK on patients.clinician_id if present
  const hasPatients = await knex.schema.hasTable('patients');
  if (hasPatients) {
    const [pRows] = await knex.raw(`
      SELECT CONSTRAINT_NAME AS fk_name
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'patients'
        AND COLUMN_NAME = 'clinician_id'
        AND REFERENCED_TABLE_NAME = 'users'
      LIMIT 1
    `);
    const pFirst = Array.isArray(pRows) ? pRows[0] : null;
    const pFkName = pFirst ? (pFirst.fk_name || pFirst.FK_NAME) : null;
    if (pFkName) {
      const safeP = '`' + String(pFkName).replace(/`/g, '``') + '`';
      await knex.raw('ALTER TABLE patients DROP FOREIGN KEY ' + safeP);
    }
  }

  // 3) Ensure users.id is INT UNSIGNED (must match before we add FKs)
  await knex.raw(`
    ALTER TABLE \`users\` MODIFY \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT
  `);

  // 4) Match clinician_patient.clinician_id to users.id: INT UNSIGNED NOT NULL
  if (hasClinicianPatient) {
    await knex.raw(`
      ALTER TABLE clinician_patient
        MODIFY clinician_id INT UNSIGNED NOT NULL
    `);

    // Recreate the foreign key constraint clinician_patient -> users
    await knex.raw(`
      ALTER TABLE clinician_patient
        ADD CONSTRAINT clinician_patient_clinician_id_foreign
        FOREIGN KEY (clinician_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    `);
  }

  // 5) Match patients.clinician_id to users.id and recreate FK
  if (hasPatients) {
    await knex.raw(`
      ALTER TABLE patients
        MODIFY clinician_id INT UNSIGNED NOT NULL
    `);
    await knex.raw(`
      ALTER TABLE patients
        ADD CONSTRAINT patients_clinician_id_foreign
        FOREIGN KEY (clinician_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    `);
  }

  // 6) Ensure audit_logs.user_id matches users.id type (INT UNSIGNED) and recreate FK
  const hasAudit = await knex.schema.hasTable('audit_logs');
  if (hasAudit) {
    await knex.raw(`
      ALTER TABLE audit_logs
        MODIFY user_id INT UNSIGNED NULL
    `);
    await knex.raw(`
      ALTER TABLE audit_logs
        ADD CONSTRAINT audit_logs_user_id_foreign
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
    `);
  }
};

/**
 * Roll back: make clinician_id signed INT again and restore the FK.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  // Drop the FK we added
  await knex.raw(`
    ALTER TABLE clinician_patient
      DROP FOREIGN KEY clinician_patient_clinician_id_foreign
  `).catch(() => {});

  // Revert clinician_id to signed INT
  await knex.raw(`
    ALTER TABLE clinician_patient
      MODIFY clinician_id INT NOT NULL
  `);

  // Recreate a generic FK name (MySQL-style) for rollback symmetry
  await knex.raw(`
    ALTER TABLE clinician_patient
      ADD CONSTRAINT clinician_patient_ibfk_1
      FOREIGN KEY (clinician_id)
      REFERENCES users(id)
      ON DELETE CASCADE
  `);
};

