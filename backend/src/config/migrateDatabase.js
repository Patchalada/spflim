const db = require('./db');

const expectedColumns = {
  m_users: {
    user_id: 'id', username: 'text', password: 'text', first_name: 'text', last_name: 'text',
    phone: 'text', role: 'text', status: 'text', kyc_document: 'text',
    profile_image: 'text', pdpa_consent_at: 'timestamp', pdpa_policy_version: 'text',
    is_primary_admin: 'boolean', created_at: 'timestamp', requested_room_id: 'id'
  },
  m_rooms: {
    room_id: 'id', room_number: 'text', floor: 'integer', room_type: 'text',
    base_price: 'numeric', status: 'text'
  },
  m_contracts: {
    contract_id: 'id', room_id: 'id', tenant_id: 'id', start_date: 'date',
    end_date: 'date', deposit: 'numeric', status: 'text',
    admin_signature: 'text', admin_signed_at: 'timestamp',
    tenant_signature: 'text', tenant_signed_at: 'timestamp',
    signed_document: 'text', agreement_document: 'text'
  },
  t_bills: {
    bill_id: 'id', contract_id: 'id', month: 'integer', year: 'integer', rent_amount: 'numeric',
    water_old_meter: 'numeric', water_new_meter: 'numeric', water_unit: 'numeric',
    water_amount: 'numeric', electric_old_meter: 'numeric', electric_new_meter: 'numeric',
    electric_unit: 'numeric', electric_amount: 'numeric', total_amount: 'numeric',
    water_rate: 'numeric', electric_rate: 'numeric',
    payment_status: 'text', due_date: 'date', slip_image: 'text',
    slip_verification_status: 'text', slip_verification_message: 'text',
    slip_trans_ref: 'text', slip_verified_at: 'timestamp',
    extra_charges: 'jsonb', created_at: 'timestamp'
  },
  t_transactions: {
    transaction_id: 'id', type: 'text', category: 'text', amount: 'numeric',
    description: 'text', transaction_date: 'date', payment_method: 'text',
    payment_reference: 'text', notes: 'text', bill_id: 'id'
  },
  m_billing_settings: {
    setting_id: 'integer', water_rate: 'numeric', electric_rate: 'numeric',
    dormitory_name: 'text', dormitory_address: 'text', contact_phone: 'text',
    payment_instructions: 'text', promptpay_number: 'text'
  },
  m_room_types: {
    type_id: 'id', room_type: 'text', base_price: 'numeric'
  },
  m_contract_renewal_requests: {
    request_id: 'id', contract_id: 'id', tenant_id: 'id', proposed_end_date: 'date',
    signed_document: 'text', agreement_document: 'text', tenant_note: 'text', status: 'text', admin_note: 'text',
    submitted_at: 'timestamp', reviewed_at: 'timestamp', reviewed_by: 'id'
  },
  t_maintenance_tickets: {
    ticket_id: 'id', tenant_id: 'id', contract_id: 'id', category: 'text', subject: 'text',
    description: 'text', priority: 'text', status: 'text', admin_response: 'text',
    created_at: 'timestamp', updated_at: 'timestamp', closed_at: 'timestamp'
  },
  t_notifications: {
    notification_id: 'id', user_id: 'id', target_role: 'text', title: 'text',
    message: 'text', type: 'text', link: 'text', is_read: 'boolean', created_at: 'timestamp'
  },
  m_kyc_reviews: {
    review_id: 'id', user_id: 'id', reviewed_by: 'id', status: 'text', note: 'text',
    requested_room_id: 'id', assigned_room_id: 'id', contract_id: 'id', reviewed_at: 'timestamp'
  }
};

function typeMatches(expected, actual) {
  if (!actual) return false;
  if (expected === 'id' || expected === 'integer') {
    return ['smallint', 'integer', 'bigint'].includes(actual.data_type);
  }
  if (expected === 'text') {
    return ['text', 'character varying', 'character'].includes(actual.data_type);
  }
  if (expected === 'jsonb') return actual.data_type === 'jsonb';
  if (expected === 'numeric') {
    return ['numeric', 'smallint', 'integer', 'bigint', 'real', 'double precision'].includes(actual.data_type);
  }
  if (expected === 'date') return actual.data_type === 'date';
  if (expected === 'boolean') return actual.data_type === 'boolean';
  if (expected === 'timestamp') {
    return ['timestamp with time zone', 'timestamp without time zone'].includes(actual.data_type);
  }
  return false;
}

async function inspectSchema(client, phase) {
  const tableNames = Object.keys(expectedColumns);
  const result = await client.query(
    `SELECT table_name, column_name, data_type, udt_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = ANY($1::text[])`,
    [tableNames]
  );
  const actualColumns = new Map(
    result.rows.map(({ table_name, column_name, data_type, udt_name }) => [
      `${table_name}.${column_name}`,
      { data_type, udt_name }
    ])
  );
  const existingTables = new Set(result.rows.map(({ table_name }) => table_name));
  const issues = [];

  console.log(`[DB SCHEMA] ${phase}: comparing tables and columns with project schema...`);
  for (const [table, columns] of Object.entries(expectedColumns)) {
    if (!existingTables.has(table)) {
      const issue = `${table} table is missing`;
      issues.push(issue);
      console.log(`[DB SCHEMA] MISMATCH ${table}: table is missing`);
      continue;
    }

    const mismatches = Object.entries(columns).flatMap(([column, expectedType]) => {
      const actual = actualColumns.get(`${table}.${column}`);
      if (!actual) return [`${column} is missing (expected ${expectedType})`];
      if (typeMatches(expectedType, actual)) return [];
      return [`${column} expected ${expectedType}, found ${actual.data_type} (${actual.udt_name})`];
    });

    if (mismatches.length > 0) {
      issues.push(...mismatches.map((mismatch) => `${table}.${mismatch}`));
      console.log(`[DB SCHEMA] MISMATCH ${table}: ${mismatches.join('; ')}`);
    } else {
      console.log(`[DB SCHEMA] MATCH ${table}: all ${Object.keys(columns).length} expected columns and types match`);
    }
  }

  return issues;
}

const migrations = [
  {
    version: 1,
    name: 'core dormitory tables',
    statements: [
      `CREATE TABLE IF NOT EXISTS m_users (
        user_id BIGSERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'tenant',
        status TEXT,
        kyc_document TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS m_rooms (
        room_id BIGSERIAL PRIMARY KEY,
        room_number TEXT NOT NULL UNIQUE,
        floor INTEGER NOT NULL,
        room_type TEXT NOT NULL DEFAULT 'Standard',
        base_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'vacant'
      )`,
      `CREATE TABLE IF NOT EXISTS t_transactions (
        transaction_id BIGSERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        description TEXT NOT NULL,
        transaction_date DATE NOT NULL DEFAULT CURRENT_DATE
      )`,
      `CREATE TABLE IF NOT EXISTS m_billing_settings (
        setting_id SMALLINT PRIMARY KEY CHECK (setting_id = 1),
        water_rate NUMERIC(10, 2) NOT NULL CHECK (water_rate >= 0),
        electric_rate NUMERIC(10, 2) NOT NULL CHECK (electric_rate >= 0)
      )`,
      `CREATE TABLE IF NOT EXISTS m_room_types (
        type_id BIGSERIAL PRIMARY KEY,
        room_type TEXT NOT NULL UNIQUE,
        base_price NUMERIC(10, 2) NOT NULL CHECK (base_price >= 0)
      )`,
      `ALTER TABLE m_users ADD COLUMN IF NOT EXISTS user_id BIGINT GENERATED BY DEFAULT AS IDENTITY`,
      `ALTER TABLE m_users ADD COLUMN IF NOT EXISTS username TEXT`,
      `ALTER TABLE m_users ADD COLUMN IF NOT EXISTS password TEXT`,
      `ALTER TABLE m_users ADD COLUMN IF NOT EXISTS first_name TEXT`,
      `ALTER TABLE m_users ADD COLUMN IF NOT EXISTS last_name TEXT`,
      `ALTER TABLE m_users ADD COLUMN IF NOT EXISTS phone TEXT`,
      `ALTER TABLE m_users ADD COLUMN IF NOT EXISTS role TEXT`,
      `ALTER TABLE m_users ADD COLUMN IF NOT EXISTS status TEXT`,
      `ALTER TABLE m_users ADD COLUMN IF NOT EXISTS kyc_document TEXT`,
      `ALTER TABLE m_users ADD COLUMN IF NOT EXISTS profile_image TEXT`,
      `ALTER TABLE m_users ADD COLUMN IF NOT EXISTS pdpa_consent_at TIMESTAMPTZ`,
      `ALTER TABLE m_users ADD COLUMN IF NOT EXISTS pdpa_policy_version TEXT`,
      `ALTER TABLE m_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`,
      `ALTER TABLE m_rooms ADD COLUMN IF NOT EXISTS room_id BIGINT GENERATED BY DEFAULT AS IDENTITY`,
      `ALTER TABLE m_rooms ADD COLUMN IF NOT EXISTS room_number TEXT`,
      `ALTER TABLE m_rooms ADD COLUMN IF NOT EXISTS floor INTEGER`,
      `ALTER TABLE m_rooms ADD COLUMN IF NOT EXISTS room_type TEXT DEFAULT 'Standard'`,
      `ALTER TABLE m_rooms ADD COLUMN IF NOT EXISTS base_price NUMERIC(10, 2) DEFAULT 0`,
      `ALTER TABLE m_rooms ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'vacant'`,
      'CREATE UNIQUE INDEX IF NOT EXISTS m_users_user_id_migration_uidx ON m_users (user_id)',
      'CREATE UNIQUE INDEX IF NOT EXISTS m_rooms_room_id_migration_uidx ON m_rooms (room_id)',
      `CREATE TABLE IF NOT EXISTS m_contracts (
        contract_id BIGSERIAL PRIMARY KEY,
        room_id BIGINT NOT NULL REFERENCES m_rooms(room_id),
        tenant_id BIGINT NOT NULL REFERENCES m_users(user_id),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        deposit NUMERIC(10, 2) NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active'
      )`,
      `ALTER TABLE m_contracts ADD COLUMN IF NOT EXISTS contract_id BIGINT GENERATED BY DEFAULT AS IDENTITY`,
      `ALTER TABLE m_contracts ADD COLUMN IF NOT EXISTS room_id BIGINT`,
      `ALTER TABLE m_contracts ADD COLUMN IF NOT EXISTS tenant_id BIGINT`,
      `ALTER TABLE m_contracts ADD COLUMN IF NOT EXISTS start_date DATE`,
      `ALTER TABLE m_contracts ADD COLUMN IF NOT EXISTS end_date DATE`,
      `ALTER TABLE m_contracts ADD COLUMN IF NOT EXISTS deposit NUMERIC(10, 2) DEFAULT 0`,
      `ALTER TABLE m_contracts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`,
      'CREATE UNIQUE INDEX IF NOT EXISTS m_contracts_contract_id_migration_uidx ON m_contracts (contract_id)',
      `CREATE TABLE IF NOT EXISTS t_bills (
        bill_id BIGSERIAL PRIMARY KEY,
        contract_id BIGINT NOT NULL REFERENCES m_contracts(contract_id),
        month SMALLINT NOT NULL,
        year INTEGER NOT NULL,
        rent_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
        water_old_meter NUMERIC(12, 2) NOT NULL DEFAULT 0,
        water_new_meter NUMERIC(12, 2) NOT NULL DEFAULT 0,
        water_unit NUMERIC(12, 2) NOT NULL DEFAULT 0,
        water_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
        electric_old_meter NUMERIC(12, 2) NOT NULL DEFAULT 0,
        electric_new_meter NUMERIC(12, 2) NOT NULL DEFAULT 0,
        electric_unit NUMERIC(12, 2) NOT NULL DEFAULT 0,
        electric_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
        total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
        payment_status TEXT NOT NULL DEFAULT 'pending',
        due_date DATE NOT NULL,
        slip_image TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE t_bills ADD COLUMN IF NOT EXISTS bill_id BIGINT GENERATED BY DEFAULT AS IDENTITY`,
      `ALTER TABLE t_bills ADD COLUMN IF NOT EXISTS contract_id BIGINT`,
      `ALTER TABLE t_bills ADD COLUMN IF NOT EXISTS month SMALLINT`,
      `ALTER TABLE t_bills ADD COLUMN IF NOT EXISTS year INTEGER`,
      `ALTER TABLE t_bills ADD COLUMN IF NOT EXISTS rent_amount NUMERIC(10, 2) DEFAULT 0`,
      `ALTER TABLE t_bills ADD COLUMN IF NOT EXISTS water_old_meter NUMERIC(12, 2) DEFAULT 0`,
      `ALTER TABLE t_bills ADD COLUMN IF NOT EXISTS water_new_meter NUMERIC(12, 2) DEFAULT 0`,
      `ALTER TABLE t_bills ADD COLUMN IF NOT EXISTS water_unit NUMERIC(12, 2) DEFAULT 0`,
      `ALTER TABLE t_bills ADD COLUMN IF NOT EXISTS water_amount NUMERIC(10, 2) DEFAULT 0`,
      `ALTER TABLE t_bills ADD COLUMN IF NOT EXISTS electric_old_meter NUMERIC(12, 2) DEFAULT 0`,
      `ALTER TABLE t_bills ADD COLUMN IF NOT EXISTS electric_new_meter NUMERIC(12, 2) DEFAULT 0`,
      `ALTER TABLE t_bills ADD COLUMN IF NOT EXISTS electric_unit NUMERIC(12, 2) DEFAULT 0`,
      `ALTER TABLE t_bills ADD COLUMN IF NOT EXISTS electric_amount NUMERIC(10, 2) DEFAULT 0`,
      `ALTER TABLE t_bills ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2) DEFAULT 0`,
      `ALTER TABLE t_bills ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending'`,
      `ALTER TABLE t_bills ADD COLUMN IF NOT EXISTS due_date DATE`,
      `ALTER TABLE t_bills ADD COLUMN IF NOT EXISTS slip_image TEXT`,
      `ALTER TABLE t_bills ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`,
      `ALTER TABLE t_transactions ADD COLUMN IF NOT EXISTS transaction_id BIGINT GENERATED BY DEFAULT AS IDENTITY`,
      `ALTER TABLE t_transactions ADD COLUMN IF NOT EXISTS type TEXT`,
      `ALTER TABLE t_transactions ADD COLUMN IF NOT EXISTS category TEXT`,
      `ALTER TABLE t_transactions ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2)`,
      `ALTER TABLE t_transactions ADD COLUMN IF NOT EXISTS description TEXT`,
      `ALTER TABLE t_transactions ADD COLUMN IF NOT EXISTS transaction_date DATE DEFAULT CURRENT_DATE`,
      `ALTER TABLE m_billing_settings ADD COLUMN IF NOT EXISTS setting_id SMALLINT`,
      `ALTER TABLE m_billing_settings ADD COLUMN IF NOT EXISTS water_rate NUMERIC(10, 2) DEFAULT 18`,
      `ALTER TABLE m_billing_settings ADD COLUMN IF NOT EXISTS electric_rate NUMERIC(10, 2) DEFAULT 8`,
      `ALTER TABLE m_room_types ADD COLUMN IF NOT EXISTS type_id BIGINT GENERATED BY DEFAULT AS IDENTITY`,
      `ALTER TABLE m_room_types ADD COLUMN IF NOT EXISTS room_type TEXT`,
      `ALTER TABLE m_room_types ADD COLUMN IF NOT EXISTS base_price NUMERIC(10, 2) DEFAULT 0`,
      'CREATE UNIQUE INDEX IF NOT EXISTS m_room_types_type_id_migration_uidx ON m_room_types (type_id)',
      'CREATE UNIQUE INDEX IF NOT EXISTS m_billing_settings_setting_id_migration_uidx ON m_billing_settings (setting_id)',
      'CREATE UNIQUE INDEX IF NOT EXISTS t_bills_bill_id_migration_uidx ON t_bills (bill_id)',
      'CREATE UNIQUE INDEX IF NOT EXISTS t_transactions_transaction_id_migration_uidx ON t_transactions (transaction_id)',
      'CREATE UNIQUE INDEX IF NOT EXISTS m_users_username_migration_uidx ON m_users (username)',
      'CREATE UNIQUE INDEX IF NOT EXISTS m_rooms_room_number_migration_uidx ON m_rooms (room_number)',
      'CREATE UNIQUE INDEX IF NOT EXISTS m_room_types_room_type_migration_uidx ON m_room_types (room_type)',
      'CREATE INDEX IF NOT EXISTS m_contracts_tenant_id_migration_idx ON m_contracts (tenant_id)',
      'CREATE INDEX IF NOT EXISTS m_contracts_room_id_migration_idx ON m_contracts (room_id)',
      'CREATE INDEX IF NOT EXISTS t_bills_contract_period_migration_idx ON t_bills (contract_id, year, month)',
      'CREATE INDEX IF NOT EXISTS t_transactions_date_migration_idx ON t_transactions (transaction_date)',
      `INSERT INTO m_billing_settings (setting_id, water_rate, electric_rate)
       VALUES (1, 18, 8)
       ON CONFLICT (setting_id) DO NOTHING`,
      `INSERT INTO m_room_types (room_type, base_price)
       SELECT room_type, COALESCE(MAX(base_price), 0)
       FROM m_rooms
       WHERE room_type IS NOT NULL AND BTRIM(room_type) <> ''
       GROUP BY room_type
       ON CONFLICT (room_type) DO NOTHING`
    ]
  },
  {
    version: 2,
    name: 'dormitory details and bill payment information',
    statements: [
      `ALTER TABLE m_billing_settings ADD COLUMN IF NOT EXISTS dormitory_name TEXT NOT NULL DEFAULT 'ระบบจัดการหอพัก'`,
      `ALTER TABLE m_billing_settings ADD COLUMN IF NOT EXISTS dormitory_address TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE m_billing_settings ADD COLUMN IF NOT EXISTS contact_phone TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE m_billing_settings ADD COLUMN IF NOT EXISTS payment_instructions TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE t_transactions ADD COLUMN IF NOT EXISTS payment_method TEXT`,
      `ALTER TABLE t_transactions ADD COLUMN IF NOT EXISTS payment_reference TEXT`,
      `ALTER TABLE t_transactions ADD COLUMN IF NOT EXISTS notes TEXT`,
      `ALTER TABLE t_transactions ADD COLUMN IF NOT EXISTS bill_id BIGINT REFERENCES t_bills(bill_id)`,
      'CREATE UNIQUE INDEX IF NOT EXISTS t_transactions_bill_id_migration_uidx ON t_transactions (bill_id) WHERE bill_id IS NOT NULL'
    ]
  },
  {
    version: 3,
    name: 'primary admin account management',
    statements: [
      `ALTER TABLE m_users ADD COLUMN IF NOT EXISTS is_primary_admin BOOLEAN NOT NULL DEFAULT FALSE`,
      `CREATE UNIQUE INDEX IF NOT EXISTS m_users_single_primary_admin_migration_uidx
       ON m_users (is_primary_admin) WHERE is_primary_admin = TRUE AND role = 'admin'`,
      `UPDATE m_users
       SET is_primary_admin = TRUE
       WHERE user_id = (
         SELECT user_id FROM m_users
         WHERE role = 'admin' AND is_primary_admin = FALSE
         ORDER BY user_id ASC
         LIMIT 1
       )
       AND NOT EXISTS (
         SELECT 1 FROM m_users WHERE role = 'admin' AND is_primary_admin = TRUE
       )`
    ]
  },
  {
    version: 4,
    name: 'itemized additional bill charges',
    statements: [
       `ALTER TABLE t_bills
        ADD COLUMN IF NOT EXISTS extra_charges JSONB NOT NULL DEFAULT '[]'::jsonb`
    ]
  },
  {
    version: 5,
    name: 'user profile photos and privacy notice acknowledgement',
    statements: [
      `ALTER TABLE m_users ADD COLUMN IF NOT EXISTS profile_image TEXT`,
      `ALTER TABLE m_users ADD COLUMN IF NOT EXISTS pdpa_consent_at TIMESTAMPTZ`,
      `ALTER TABLE m_users ADD COLUMN IF NOT EXISTS pdpa_policy_version TEXT`
    ]
  },
  {
    version: 6,
    name: 'tenant contract renewals and maintenance support cases',
    statements: [
      `CREATE TABLE IF NOT EXISTS m_contract_renewal_requests (
        request_id BIGSERIAL PRIMARY KEY,
        contract_id BIGINT NOT NULL REFERENCES m_contracts(contract_id),
        tenant_id BIGINT NOT NULL REFERENCES m_users(user_id),
        proposed_end_date DATE,
        signed_document TEXT,
        agreement_document TEXT,
        tenant_note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        admin_note TEXT NOT NULL DEFAULT '',
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMPTZ,
        reviewed_by BIGINT REFERENCES m_users(user_id)
      )`,
      `ALTER TABLE m_contract_renewal_requests ALTER COLUMN proposed_end_date DROP NOT NULL`,
      `ALTER TABLE m_contract_renewal_requests ALTER COLUMN signed_document DROP NOT NULL`,
      `ALTER TABLE m_contract_renewal_requests ADD COLUMN IF NOT EXISTS agreement_document TEXT`,
      `ALTER TABLE m_contract_renewal_requests DROP CONSTRAINT IF EXISTS m_contract_renewal_requests_status_check`,
      `ALTER TABLE m_contract_renewal_requests DROP CONSTRAINT IF EXISTS m_contract_renewal_requests_status_valid_check`,
      `ALTER TABLE m_contract_renewal_requests
       ADD CONSTRAINT m_contract_renewal_requests_status_valid_check
       CHECK (status IN ('pending', 'awaiting_tenant', 'approved', 'rejected'))`,
      `CREATE INDEX IF NOT EXISTS m_contract_renewal_requests_status_submitted_idx
       ON m_contract_renewal_requests (status, submitted_at DESC)`,
      `CREATE TABLE IF NOT EXISTS t_maintenance_tickets (
        ticket_id BIGSERIAL PRIMARY KEY,
        tenant_id BIGINT NOT NULL REFERENCES m_users(user_id),
        contract_id BIGINT REFERENCES m_contracts(contract_id),
        category TEXT NOT NULL,
        subject TEXT NOT NULL,
        description TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
        admin_response TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMPTZ
      )`,
      `CREATE INDEX IF NOT EXISTS t_maintenance_tickets_status_created_idx
       ON t_maintenance_tickets (status, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS t_maintenance_tickets_tenant_created_idx
       ON t_maintenance_tickets (tenant_id, created_at DESC)`
    ]
  },
  {
    version: 7,
    name: 'signed tenant renewal agreement review workflow',
    statements: [
      `ALTER TABLE m_contract_renewal_requests
       DROP CONSTRAINT IF EXISTS m_contract_renewal_requests_status_valid_check`,
      `ALTER TABLE m_contract_renewal_requests
       ADD CONSTRAINT m_contract_renewal_requests_status_valid_check
       CHECK (status IN ('pending', 'awaiting_tenant', 'awaiting_admin', 'approved', 'rejected'))`
    ]
  },
  {
    version: 8,
    name: 'slip verification result tracking',
    statements: [
      `ALTER TABLE t_bills
       ADD COLUMN IF NOT EXISTS slip_verification_status TEXT NOT NULL DEFAULT 'not_submitted'`,
      `ALTER TABLE t_bills
       ADD COLUMN IF NOT EXISTS slip_verification_message TEXT`,
      `ALTER TABLE t_bills
       ADD COLUMN IF NOT EXISTS slip_trans_ref TEXT`,
      `ALTER TABLE t_bills
       ADD COLUMN IF NOT EXISTS slip_verified_at TIMESTAMPTZ`,
      `CREATE UNIQUE INDEX IF NOT EXISTS t_bills_slip_trans_ref_uidx
       ON t_bills (slip_trans_ref) WHERE slip_trans_ref IS NOT NULL`
    ]
  },
  {
    version: 9,
    name: 'bill utility rates and unit price history',
    statements: [
      `ALTER TABLE t_bills ADD COLUMN IF NOT EXISTS water_rate NUMERIC(10, 2)`,
      `ALTER TABLE t_bills ADD COLUMN IF NOT EXISTS electric_rate NUMERIC(10, 2)`
    ]
  },
  {
    version: 10,
    name: 'configurable PromptPay payment number',
    statements: [
      `ALTER TABLE m_billing_settings
       ADD COLUMN IF NOT EXISTS promptpay_number TEXT NOT NULL DEFAULT '0948860469'`
    ]
  },
  {
    version: 11,
    name: 'in-app real-time notifications',
    statements: [
      `CREATE TABLE IF NOT EXISTS t_notifications (
        notification_id BIGSERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES m_users(user_id) ON DELETE CASCADE,
        target_role TEXT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'info',
        link TEXT,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE t_notifications ADD COLUMN IF NOT EXISTS notification_id BIGINT GENERATED BY DEFAULT AS IDENTITY`,
      `ALTER TABLE t_notifications ADD COLUMN IF NOT EXISTS user_id BIGINT`,
      `ALTER TABLE t_notifications ADD COLUMN IF NOT EXISTS target_role TEXT`,
      `ALTER TABLE t_notifications ADD COLUMN IF NOT EXISTS title TEXT`,
      `ALTER TABLE t_notifications ADD COLUMN IF NOT EXISTS message TEXT`,
      `ALTER TABLE t_notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'info'`,
      `ALTER TABLE t_notifications ADD COLUMN IF NOT EXISTS link TEXT`,
      `ALTER TABLE t_notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE t_notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`,
      'CREATE UNIQUE INDEX IF NOT EXISTS t_notifications_notification_id_migration_uidx ON t_notifications (notification_id)',
      'CREATE INDEX IF NOT EXISTS t_notifications_user_role_idx ON t_notifications (user_id, target_role, is_read)'
    ]
  },
  {
    version: 12,
    name: 'room requests and KYC review history',
    statements: [
      `ALTER TABLE m_users
       ADD COLUMN IF NOT EXISTS requested_room_id BIGINT REFERENCES m_rooms(room_id)`,
      `CREATE TABLE IF NOT EXISTS m_kyc_reviews (
        review_id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES m_users(user_id),
        reviewed_by BIGINT NOT NULL REFERENCES m_users(user_id),
        status TEXT NOT NULL CHECK (status IN ('approved', 'rejected')),
        note TEXT NOT NULL DEFAULT '',
        requested_room_id BIGINT REFERENCES m_rooms(room_id),
        assigned_room_id BIGINT REFERENCES m_rooms(room_id),
        contract_id BIGINT REFERENCES m_contracts(contract_id),
        reviewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE m_kyc_reviews
       ADD COLUMN IF NOT EXISTS assigned_room_id BIGINT REFERENCES m_rooms(room_id)`,
      `CREATE INDEX IF NOT EXISTS m_kyc_reviews_reviewed_at_idx
       ON m_kyc_reviews (reviewed_at DESC)`,
      `CREATE INDEX IF NOT EXISTS m_kyc_reviews_user_reviewed_at_idx
       ON m_kyc_reviews (user_id, reviewed_at DESC)`
    ]
  },
  {
    version: 13,
    name: 'contract signatures and documents',
    statements: [
      `ALTER TABLE m_contracts ADD COLUMN IF NOT EXISTS admin_signature TEXT`,
      `ALTER TABLE m_contracts ADD COLUMN IF NOT EXISTS admin_signed_at TIMESTAMPTZ`,
      `ALTER TABLE m_contracts ADD COLUMN IF NOT EXISTS tenant_signature TEXT`,
      `ALTER TABLE m_contracts ADD COLUMN IF NOT EXISTS tenant_signed_at TIMESTAMPTZ`,
      `ALTER TABLE m_contracts ADD COLUMN IF NOT EXISTS signed_document TEXT`,
      `ALTER TABLE m_contracts ADD COLUMN IF NOT EXISTS agreement_document TEXT`
    ]
  }
];

async function migrateDatabase() {
  await db.withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [727385110]);
    console.log('[DB SCHEMA] Checking current database tables and columns...');
    const beforeIssues = await inspectSchema(client, 'BEFORE MIGRATION');
    if (beforeIssues.length > 0) {
      console.log(`[DB SCHEMA] BEFORE MIGRATION: ${beforeIssues.length} mismatch(es); attempting safe, additive migrations`);
    } else {
      console.log('[DB SCHEMA] BEFORE MIGRATION: schema already matches the project');
    }

    console.log('[DB SCHEMA] Applying missing tables, columns, indexes, and default rows...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    for (const migration of migrations) {
      for (const statement of migration.statements) {
        await client.query(statement);
      }
      await client.query(
        `INSERT INTO app_schema_migrations (version, name)
         VALUES ($1, $2)
         ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name`,
        [migration.version, migration.name]
      );
      console.log(`Database schema checked: ${migration.name}`);
    }

    console.log('[DB SCHEMA] Verifying database structure after migration...');
    const afterIssues = await inspectSchema(client, 'AFTER MIGRATION');
    if (afterIssues.length > 0) {
      console.error(`[DB SCHEMA] FAIL: ${afterIssues.length} schema mismatch(es) remain`);
      throw new Error(`Schema verification failed: ${afterIssues.join('; ')}`);
    }
    console.log('[DB SCHEMA] PASS: all application tables and columns match the expected schema');
  });
}

module.exports = migrateDatabase;
