const { feedbackOptions } = require("../data/data");

const getColumns = async (_, res) => {
  try {
    if (feedbackOptions) {
      return res.send({ success: true, options: feedbackOptions });
    }

    return res.status(404).send({ message: "Not found" });
  } catch (error) {
    console.log(error);
    return res.status(500).send({ message: "Internal server error" });
  }
};

module.exports = { getColumns };
