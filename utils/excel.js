// Helpers shared by the .xlsx exports (controllers/feedback.js, controllers/researcher.js).

const MAX_SHEET_NAME_LENGTH = 31;

// Characters Excel does not allow in worksheet names, plus control characters
const INVALID_SHEET_CHARS = /[\\/?*:[\]\u0000-\u001f\u007f]/g;

// Excel (and exceljs) count UTF-16 code units: slice to `len` units without splitting a surrogate pair
const sliceChars = (str, len) => {
  let out = str.slice(0, len);
  if (/[\uD800-\uDBFF]$/.test(out)) out = out.slice(0, -1);
  return out;
};

/** Cleans a display name into something Excel accepts as a sheet name (may return ""). */
const cleanSheetName = (value) =>
  String(value === undefined || value === null ? "" : value)
    .replace(INVALID_SHEET_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim()
    // a sheet name cannot start or end with an apostrophe
    .replace(/^'+|'+$/g, "")
    .trim();

/**
 * Returns a function that turns arbitrary names into valid, unique (case-insensitive) worksheet
 * names: invalid characters removed, non-ASCII kept, max 31 characters, never empty (uses the
 * `fallback` argument), and a "-N" suffix added *within* the 31-char limit on collisions (so two
 * long names sharing a 31-char prefix still get distinct sheets). `reserved` names are never returned.
 */
const createSheetNamer = (reserved = []) => {
  const used = new Set(reserved.map((n) => String(n).toUpperCase()));

  return (name, fallback = "Sheet") => {
    const base = cleanSheetName(name) || cleanSheetName(fallback) || "Sheet";
    let candidate = sliceChars(base, MAX_SHEET_NAME_LENGTH);
    let i = 1;
    while (used.has(candidate.toUpperCase())) {
      const suffix = "-" + i;
      candidate = sliceChars(base, MAX_SHEET_NAME_LENGTH - suffix.length).trim() + suffix;
      i += 1;
    }
    used.add(candidate.toUpperCase());
    return candidate;
  };
};

/**
 * Error handling for streamed downloads. Before any byte of the body was sent, the attachment
 * headers are dropped and a JSON 500 is sent; once streaming has started the only honest option
 * is to abort the connection (so the client sees a failed download, not a truncated file).
 */
const handleExportError = (res, error) => {
  console.log(error);
  if (!res.headersSent) {
    res.removeHeader("Content-Disposition");
    res.removeHeader("Content-Type");
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
  return res.destroy();
};

module.exports = { MAX_SHEET_NAME_LENGTH, cleanSheetName, createSheetNamer, handleExportError };
