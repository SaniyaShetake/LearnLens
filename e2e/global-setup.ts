import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import { DB_URI, RESEARCHER } from "./tests/constants";

/**
 * Researchers cannot sign up through the app, so the suite seeds one directly
 * in the test database (bcrypt hash, 13 rounds, like the app does).
 * This is the only place the suite touches the database.
 */
export default async function globalSetup() {
  const client = new MongoClient(DB_URI, { serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  try {
    const hash = await bcrypt.hash(RESEARCHER.password, 13);
    await client
      .db()
      .collection("researchers")
      .updateOne(
        { email: RESEARCHER.email },
        { $set: { email: RESEARCHER.email, password: hash, name: RESEARCHER.name, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
      );
  } finally {
    await client.close();
  }
}
