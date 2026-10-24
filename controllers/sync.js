const syncCourse = async (req, res) => {
  try {
    return res.sendStatus(404);
  } catch (error) {
    console.log(error);
    return res.status(500).send({ message: "Internal server error" });
  }
};

const syncLesson = async (req, res) => {
  try {
    return res.sendStatus(404);
  } catch (error) {
    console.log(error);
    return res.status(500).send({ message: "Internal server error" });
  }
};

module.exports = { syncCourse, syncLesson };
