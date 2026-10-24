const { db } = require("../database");
const ResearchUser = require("../database/models/researcher");
const { parseArguementsIntoOptions, printHelpGuide, style } = require("../utils/generate");

const formatError = style("red");
const formatHighlight = style("cyanBright");
const formatSuccess = style("greenBright");
const tag = style("magentaBright")("[GENERATE]");
const errorTag = style("bgRed")("[ERROR]");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const lengthBetween = (value, min, max) => typeof value === "string" && value.length >= min && value.length <= max;

/** Returns the list of validation messages for a new researcher (empty when valid). */
const validateResearcher = ({ name, email, password }) => {
  const errors = [];
  if (!name) errors.push("Please provide a name using `--name name`");
  else if (!lengthBetween(name, 3, 24)) errors.push("Please provide a name between 3 to 24 characters");
  if (!email) errors.push("Please provide a email using `--email example@email.com`");
  else if (!EMAIL_PATTERN.test(email)) errors.push("Please provide a valid email using " + formatHighlight(`--email example@email.com`));
  if (!password) errors.push("Please provide a password using `--pass password`");
  else if (!lengthBetween(password, 6, 24)) errors.push("Please provide a password between 6 to 24 characters");
  return errors;
};

async function generateResearchUser() {
  try {
    const { help, password, email, name, debug, remove } = parseArguementsIntoOptions(process.argv);

    const debugLog = (e) => {
      if (debug) console.log(e);
    };

    if (help) printHelpGuide();

    try {
      if (remove) {
        if (email) {
          const researcher = await ResearchUser.findOne({ email: email });

          if (researcher) {
            const { deletedCount } = await researcher.deleteOne();

            if (deletedCount) {
              console.log(tag, formatHighlight(researcher.name || researcher.email), formatSuccess("successfully removed from researchers."));
            }
          } else {
            console.log(tag, errorTag, formatHighlight(email), formatError("does not exist. Hence, no changes were made."));
          }
        } else {
          console.log(tag, errorTag, formatError("Please provide a valid email using"), formatHighlight(`--email example@email.com`));
        }
      } else {
        if (email) {
          const researcherExists = await ResearchUser.findOne({ email: email });

          if (researcherExists) {
            console.log(tag, errorTag, formatHighlight(email), formatError("already exists. Hence, no changes were made."));
          } else {
            const errors = validateResearcher({ email, password, name });
            if (errors.length > 0) {
              errors.forEach((error) => console.log(tag, errorTag, formatError(error)));
            } else {
              const newResearcher = new ResearchUser({
                email: email,
                name: name,
              });

              const hashedPassword = await newResearcher.hashPassword(password);

              newResearcher.password = hashedPassword;
              const saved = await newResearcher.save();

              if (saved) {
                console.log(tag, formatSuccess("Created researcher account for"), formatHighlight(name || email));
              } else {
                console.log(tag, formatError("Couldn't create researcher account for"), formatHighlight(name || email));
              }
            }
          }
        } else {
          console.log(tag, errorTag, formatError("Please provide a valid email using"), formatHighlight(`--email example@email.com`));
        }
      }
    } catch (error) {
      debugLog(error);
    }
  } catch (e) {
    debugLog(e);
    console.log(tag, errorTag, formatError("Some error occured, Please try again"));
  }
}

(async () => {
  try {
    await db.connect();

    await generateResearchUser();
  } catch (error) {
    console.log(tag, errorTag, error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
