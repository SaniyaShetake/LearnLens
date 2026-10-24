const router = require("express").Router();

const { getColumns } = require("../controllers/misc");

router.get("/columns", getColumns)

module.exports = router