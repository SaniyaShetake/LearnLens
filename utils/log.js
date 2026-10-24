const onLogFail = (data = {}) => {
  if (typeof data === "object") {
    data.createdAt = Date.now();
  }

  console.group("Log failed");
  console.log(JSON.stringify(data));
  console.groupEnd();
};

module.exports = {
  onLogFail,
};
