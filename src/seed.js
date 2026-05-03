const { createDatabase, dbRun } = require('./database');

const db = createDatabase();

const sampleContacts = [
  { first_name: 'Alice',  last_name: 'Johnson',  email: 'alice.johnson@example.com',  phone: '555-0101', company: 'Acme Corp',      address: '123 Main St, Springfield, IL' },
  { first_name: 'Bob',    last_name: 'Williams', email: 'bob.williams@example.com',   phone: '555-0102', company: 'TechStart Inc',  address: '456 Oak Ave, Chicago, IL' },
  { first_name: 'Carol',  last_name: 'Martinez', email: 'carol.martinez@example.com', phone: '555-0103', company: 'Design Studio',  address: '789 Elm Rd, Austin, TX' },
  { first_name: 'David',  last_name: 'Lee',      email: 'david.lee@example.com',      phone: '555-0104', company: 'Global Finance', address: '321 Pine St, New York, NY' },
  { first_name: 'Eva',    last_name: 'Brown',    email: 'eva.brown@example.com',      phone: '555-0105', company: 'Health Plus',    address: '654 Maple Dr, Seattle, WA' },
  { first_name: 'Frank',  last_name: 'Garcia',   email: 'frank.garcia@example.com',   phone: '555-0106', company: 'BuildRight LLC', address: '987 Cedar Ln, Denver, CO' },
  { first_name: 'Grace',  last_name: 'Wilson',   email: 'grace.wilson@example.com',   phone: '555-0107', company: 'EduLearn Co',    address: '147 Birch Blvd, Boston, MA' },
  { first_name: 'Henry',  last_name: 'Taylor',   email: 'henry.taylor@example.com',   phone: '555-0108', company: 'RetailMax',      address: '258 Walnut Way, Miami, FL' },
  { first_name: 'Iris',   last_name: 'Anderson', email: 'iris.anderson@example.com',  phone: '555-0109', company: 'CloudSystems',   address: '369 Spruce St, Portland, OR' },
  { first_name: 'James',  last_name: 'Thompson', email: 'james.thompson@example.com', phone: '555-0110', company: 'LegalEagle LLP', address: '741 Aspen Ave, Dallas, TX' },
];

async function seed() {
  let count = 0;
  for (const c of sampleContacts) {
    try {
      await dbRun(db,
        `INSERT OR IGNORE INTO contacts (first_name, last_name, email, phone, company, address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [c.first_name, c.last_name, c.email, c.phone, c.company, c.address]
      );
      count++;
    } catch (e) { /* skip duplicates */ }
  }
  console.log(`Seeded ${count} contact(s). (Existing records skipped.)`);
  db.close();
}

seed();
