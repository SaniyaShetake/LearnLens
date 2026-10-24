const { db } = require("../database");

(async () => {
  try {
    await db.connect();

    // Generate mock data from array
  } catch (error) {
    console.log(error);
  }
})();
