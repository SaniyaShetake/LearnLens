// CLI helpers for data/generate.js (Node built-ins only: util.parseArgs + util.styleText)
const { parseArgs, styleText } = require("util");

// styleText with several strings joined by spaces (like chalk's variadic helpers)
const style = (format) => (...text) => styleText(format, text.join(" "));
const cyanBright = style("cyanBright");
const whiteBright = style("whiteBright");
const redBright = style("redBright");
const errorTag = redBright("[ ERROR ]");

const parseArguementsIntoOptions = (rawArgs = []) => {
  try {
    const { values } = parseArgs({
      args: rawArgs.slice(2),
      strict: true,
      options: {
        remove: { type: "boolean", short: "r" },
        help: { type: "boolean", short: "h" },
        debug: { type: "boolean", short: "d" },
        email: { type: "string", short: "e" },
        pass: { type: "string", short: "p" },
        name: { type: "string", short: "n" },
      },
    });

    return {
      remove: values.remove || false,
      help: values.help || false,
      debug: values.debug || process.env.DEBUG === "true",
      email: values.email,
      password: values.pass,
      name: values.name,
    };
  } catch (error) {
    if (error.code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE") {
      console.log(errorTag, "Arguement missing, please refer the help below.");
    } else if (error.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION" || error.code === "ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL") {
      console.log(errorTag, "Unknown command, please try one of the following.");
    } else {
      console.log(error);
    }

    return {
      help: true,
    };
  }
};

const printLine = (text = "", char = "-") => {
  if (typeof text === "string" && text.length > 0) {
    const columns = process.stdout.columns || 80;
    const halfLen = Math.max(0, Math.floor(columns / 2 - (text.length / 2 + 1)));

    console.log(cyanBright(char.repeat(halfLen), text, char.repeat(halfLen)));
  } else {
    console.log(char.repeat(process.stdout.columns || 80));
  }
};

const printHelp = (param = "", alias = "", description = "") => {
  console.group();
  console.log("Parameter:\t\t", "--" + param);
  console.log("Alias:\t\t", "-" + alias);
  console.log("Description:\t", description);
  console.groupEnd();
  console.log();
};

const AUTHOR = "localhoax";
const URL = "https://localhoax.in";

const printHelpGuide = () => {
  console.log(cyanBright("USER GENERATION by"), whiteBright(AUTHOR));
  console.log(cyanBright("AUTHOR:", whiteBright(AUTHOR + " ( " + URL + " )")));

  printLine("HELP");
  console.log();

  console.group();
  printHelp("help", "h", "Prints help information about generation script");
  printHelp("debug", "d", "Enable debug logging");
  printHelp("email", "e", `Use this parameter to provide a researcher email using ${cyanBright('--email "example@email.com"')}`);
  printHelp("name", "n", `Use this parameter with --email to provide a researcher name using ${cyanBright('--name "Example Name"')}`);
  printHelp("pass", "p", `Use this parameter with --email to provide a password using ${cyanBright('--pass "someSafePassword"')}`);
  printHelp("remove", "r", `Use this parameter with --email to remove the provided email`);
  console.groupEnd();

  printLine("END ");

  process.exit(0);
};

module.exports = {
  style,
  printLine,
  printHelpGuide,
  parseArguementsIntoOptions,
};
