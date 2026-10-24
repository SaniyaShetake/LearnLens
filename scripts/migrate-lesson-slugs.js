#!/usr/bin/env node
/**
 * Lesson slug migration (lesson.id, used in student links /l/:slug).
 *
 *   yarn migrate:slugs            # dry run: only reports problems, changes nothing
 *   yarn migrate:slugs --apply    # fixes them
 *
 * Reports lessons whose slug is null/missing/empty and slugs shared by several lessons. With
 * --apply it gives every slug-less lesson a fresh unique slug, and for each duplicated slug keeps
 * it on the OLDEST lesson and re-slugs the others (old -> new mapping is printed so teachers whose
 * shared links changed can be told). Finally it replaces an outdated `id_1` index (e.g. the old
 * sparse one) with the partial unique index declared in database/models/lesson.js.
 *
 * Uses DB_URI from the environment / .env (same as the server). Back up the database first.
 */
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const Lesson = require("../database/models/lesson");
const { genSlug } = require("../utils/slug");

const INDEX_NAME = "id_1";
const EXPECTED_PARTIAL = { id: { $type: "string" } };

const hasValidSlug = { id: { $type: "string", $ne: "" } };

const isExpectedIndex = (index) =>
  !!index &&
  index.unique === true &&
  !index.sparse &&
  JSON.stringify(index.partialFilterExpression || null) === JSON.stringify(EXPECTED_PARTIAL);

const describe = (lesson) => `${lesson._id} ("${lesson.name || ""}", created ${lesson.createdAt ? new Date(lesson.createdAt).toISOString() : "unknown"})`;

/**
 * Runs the migration on the current mongoose connection.
 * @param {{ apply?: boolean, log?: (line: string) => void }} options
 * @returns {Promise<{ missing: object[], duplicates: { id: string, keep: object, others: object[] }[], changes: { _id: string, old: any, new: string }[], index: string }>}
 */
const migrateLessonSlugs = async ({ apply = false, log = console.log } = {}) => {
  const coll = Lesson.collection;

  const missing = await coll
    .find({ $nor: [hasValidSlug] }, { projection: { _id: 1, id: 1, name: 1, createdAt: 1 } })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();

  const dupGroups = await coll
    .aggregate([
      { $match: hasValidSlug },
      { $sort: { createdAt: 1, _id: 1 } },
      { $group: { _id: "$id", docs: { $push: { _id: "$_id", id: "$id", name: "$name", createdAt: "$createdAt" } }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();
  const duplicates = dupGroups.map((g) => ({ id: g._id, keep: g.docs[0], others: g.docs.slice(1) }));

  const indexes = await coll.indexes().catch(() => []);
  const currentIndex = indexes.find((i) => i.name === INDEX_NAME);
  const indexOk = isExpectedIndex(currentIndex);

  log(`[migrate:slugs] mode: ${apply ? "APPLY" : "DRY RUN (use --apply to change data)"}`);
  log(`[migrate:slugs] lessons without a slug: ${missing.length}`);
  missing.forEach((l) => log(`  - ${describe(l)} id=${JSON.stringify(l.id === undefined ? null : l.id)}`));
  log(`[migrate:slugs] duplicated slugs: ${duplicates.length}`);
  duplicates.forEach((d) => {
    log(`  - "${d.id}": kept by oldest ${describe(d.keep)}`);
    d.others.forEach((o) => log(`      re-slug ${describe(o)}`));
  });
  log(
    `[migrate:slugs] index ${INDEX_NAME}: ${
      indexOk ? "ok (unique, partial on string ids)" : currentIndex ? "OUTDATED " + JSON.stringify(currentIndex) : "missing"
    }`
  );

  const changes = [];
  let index = indexOk ? "ok" : currentIndex ? "outdated" : "missing";

  if (!apply) {
    log("[migrate:slugs] dry run finished, nothing was changed.");
    return { missing, duplicates, changes, index };
  }

  const taken = new Set();
  const freshSlug = async (name) => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const slug = genSlug(typeof name === "string" ? name : "");
      if (!taken.has(slug) && !(await coll.findOne({ id: slug }, { projection: { _id: 1 } }))) {
        taken.add(slug);
        return slug;
      }
    }
    throw new Error("Could not generate a unique slug");
  };

  const toReslug = [...missing, ...duplicates.reduce((acc, d) => acc.concat(d.others), [])];
  for (const lesson of toReslug) {
    const slug = await freshSlug(lesson.name);
    await coll.updateOne({ _id: lesson._id }, { $set: { id: slug } });
    changes.push({ _id: String(lesson._id), old: lesson.id === undefined ? null : lesson.id, new: slug });
  }

  if (changes.length) {
    log("[migrate:slugs] slug changes (old -> new); links using the old slug no longer work:");
    changes.forEach((c) => log(`  ${c._id}: ${JSON.stringify(c.old)} -> "${c.new}"`));
  }

  if (!indexOk) {
    if (currentIndex) {
      await coll.dropIndex(INDEX_NAME);
      log(`[migrate:slugs] dropped outdated index ${INDEX_NAME}`);
    }
    await coll.createIndex({ id: 1 }, { name: INDEX_NAME, unique: true, partialFilterExpression: EXPECTED_PARTIAL, background: true });
    log(`[migrate:slugs] created index ${INDEX_NAME} (unique, partial on string ids)`);
    index = "created";
  }

  log(`[migrate:slugs] done: ${changes.length} lesson(s) re-slugged.`);
  return { missing, duplicates, changes, index };
};

const main = async () => {
  const apply = process.argv.includes("--apply");
  const uri = process.env.DB_URI || "mongodb://localhost:27017/test-debe";
  // Don't let mongoose build the (new) index on its own before duplicates are fixed
  await mongoose.connect(uri, { autoIndex: false });
  try {
    await migrateLessonSlugs({ apply });
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error("[migrate:slugs] failed:", error);
    process.exit(1);
  });
}

module.exports = { migrateLessonSlugs };
