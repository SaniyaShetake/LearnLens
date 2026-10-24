const mongoose = require("mongoose");
const { DB_URI } = require("./env");

module.exports = async () => {
  const conn = await mongoose.createConnection(DB_URI).asPromise();
  await conn.dropDatabase();
  await conn.close();
};
