import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server.js";
import { createDatabase } from "../src/database.js";
import path from "path";
import fs from "fs";

// Use an in-memory SQLite DB for tests
const TEST_DB_PATH = path.join(process.cwd(), "test.db");

let app, db;

beforeAll(() => {
  process.env.DB_PATH = TEST_DB_PATH;
  db = createDatabase(TEST_DB_PATH);
  app = createApp(db);
});

afterAll(async () => {
  db.close();
  await new Promise((r) => setTimeout(r, 500));
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

beforeEach(() => {
  db.exec("DELETE FROM contacts");
  db.exec("DELETE FROM sqlite_sequence WHERE name='contacts'");
});

const sampleContact = {
  first_name: "John",
  last_name: "Doe",
  email: "john.doe@test.com",
  phone: "555-1234",
  company: "Test Corp",
  address: "100 Test St",
};

// ─── CREATE ────────────────────────────────────────────────────────────────

describe("POST /api/contacts", () => {
  it("creates a new contact and returns 201", async () => {
    const res = await request(app).post("/api/contacts").send(sampleContact);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      first_name: "John",
      last_name: "Doe",
      email: "john.doe@test.com",
    });
    expect(res.body.id).toBeDefined();
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/contacts")
      .send({ first_name: "Jane" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email format", async () => {
    const res = await request(app)
      .post("/api/contacts")
      .send({ ...sampleContact, email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("returns 409 on duplicate email", async () => {
    await request(app).post("/api/contacts").send(sampleContact);
    const res = await request(app).post("/api/contacts").send(sampleContact);
    expect(res.status).toBe(409);
  });
});

// ─── READ ──────────────────────────────────────────────────────────────────

describe("GET /api/contacts", () => {
  it("returns empty list initially", async () => {
    const res = await request(app).get("/api/contacts");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it("returns all contacts", async () => {
    await request(app).post("/api/contacts").send(sampleContact);
    await request(app)
      .post("/api/contacts")
      .send({ ...sampleContact, email: "jane@test.com", first_name: "Jane" });

    const res = await request(app).get("/api/contacts");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it("supports search by name", async () => {
    await request(app).post("/api/contacts").send(sampleContact);
    await request(app)
      .post("/api/contacts")
      .send({
        ...sampleContact,
        email: "jane@test.com",
        first_name: "Jane",
        last_name: "Smith",
      });

    const res = await request(app).get("/api/contacts?search=Smith");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].last_name).toBe("Smith");
  });

  it("supports pagination", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/contacts")
        .send({ ...sampleContact, email: `user${i}@test.com` });
    }
    const res = await request(app).get("/api/contacts?limit=2&page=2");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.page).toBe(2);
  });
});

describe("GET /api/contacts/:id", () => {
  it("returns a contact by id", async () => {
    const created = await request(app)
      .post("/api/contacts")
      .send(sampleContact);
    const res = await request(app).get(`/api/contacts/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("john.doe@test.com");
  });

  it("returns 404 for missing contact", async () => {
    const res = await request(app).get("/api/contacts/999");
    expect(res.status).toBe(404);
  });
});

// ─── UPDATE ────────────────────────────────────────────────────────────────

describe("PUT /api/contacts/:id", () => {
  it("updates all fields", async () => {
    const created = await request(app)
      .post("/api/contacts")
      .send(sampleContact);
    const res = await request(app)
      .put(`/api/contacts/${created.body.id}`)
      .send({
        ...sampleContact,
        first_name: "Updated",
        company: "New Corp",
      });
    expect(res.status).toBe(200);
    expect(res.body.first_name).toBe("Updated");
    expect(res.body.company).toBe("New Corp");
  });

  it("returns 404 for missing contact", async () => {
    const res = await request(app).put("/api/contacts/999").send(sampleContact);
    expect(res.status).toBe(404);
  });

  it("returns 409 on email conflict", async () => {
    const c1 = await request(app).post("/api/contacts").send(sampleContact);
    await request(app)
      .post("/api/contacts")
      .send({ ...sampleContact, email: "other@test.com" });
    const res = await request(app)
      .put(`/api/contacts/${c1.body.id}`)
      .send({ ...sampleContact, email: "other@test.com" });
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/contacts/:id", () => {
  it("partially updates a contact", async () => {
    const created = await request(app)
      .post("/api/contacts")
      .send(sampleContact);
    const res = await request(app)
      .patch(`/api/contacts/${created.body.id}`)
      .send({ phone: "999-9999" });
    expect(res.status).toBe(200);
    expect(res.body.phone).toBe("999-9999");
    expect(res.body.first_name).toBe("John"); // unchanged
  });

  it("returns 400 when no valid fields sent", async () => {
    const created = await request(app)
      .post("/api/contacts")
      .send(sampleContact);
    const res = await request(app)
      .patch(`/api/contacts/${created.body.id}`)
      .send({ unknown: "x" });
    expect(res.status).toBe(400);
  });
});

// ─── DELETE ────────────────────────────────────────────────────────────────

describe("DELETE /api/contacts/:id", () => {
  it("deletes a contact and returns 204", async () => {
    const created = await request(app)
      .post("/api/contacts")
      .send(sampleContact);
    const res = await request(app).delete(`/api/contacts/${created.body.id}`);
    expect(res.status).toBe(204);

    const verify = await request(app).get(`/api/contacts/${created.body.id}`);
    expect(verify.status).toBe(404);
  });

  it("returns 404 for missing contact", async () => {
    const res = await request(app).delete("/api/contacts/999");
    expect(res.status).toBe(404);
  });
});

// ─── HEALTH ────────────────────────────────────────────────────────────────

describe("GET /api/health", () => {
  it("returns ok status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
