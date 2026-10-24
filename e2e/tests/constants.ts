export const PORT = Number(process.env.E2E_PORT || 3200);
export const BASE_URL = `http://localhost:${PORT}`;
export const DB_URI = process.env.E2E_DB_URI || "mongodb://127.0.0.1:27018/tcherly_e2e";
export const RESEARCHER = {
  email: "e2e-researcher@example.test",
  password: "E2e-Researcher-Passw0rd!",
  name: "E2E Researcher",
};
