// Config must refuse to start without a real JWT secret.
describe("config", () => {
  const saved = { ...process.env };

  afterEach(() => {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    jest.dontMock("dotenv");
  });

  const loadConfig = () => {
    let cfg;
    jest.isolateModules(() => {
      // Prevent the developer's .env from re-populating the variable.
      jest.doMock("dotenv", () => ({ config: () => ({ parsed: {} }) }));
      cfg = require("../config");
    });
    return cfg;
  };

  test("loads with the test env", () => {
    const cfg = loadConfig();
    expect(cfg.token.secret).toBe(process.env.JWT_SECRET);
    expect(cfg.db.uri).toBe(process.env.DB_URI);
  });

  test("throws when JWT_SECRET is unset", () => {
    delete process.env.JWT_SECRET;
    expect(() => loadConfig()).toThrow();
  });

  test("throws when secrets are the .env.example placeholders", () => {
    process.env.SESSION_SECRET = "<replace_with_a_strong_session_secret>";
    expect(() => loadConfig()).toThrow(/SESSION_SECRET/);
    process.env.SESSION_SECRET = saved.SESSION_SECRET;
    process.env.JWT_SECRET = "<replace_with_a_strong_JWT_session_secret>";
    expect(() => loadConfig()).toThrow(/JWT_SECRET/);
  });
});
