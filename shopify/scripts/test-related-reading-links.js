// Tests for `[RELATED] **Lead-in** text [label](https://...)` related-reading
// lines: relatedParagraph() in lib/learning-data.js (what is synced to the
// live learning_lesson rich text) and its mirror in generate-preview-fixture.js.
//
// Run from shopify/: node scripts/test-related-reading-links.js
//
// The preview-fixture parity check runs the real generator against a
// throwaway copy of shopify/, content-development/ and empty theme output
// folders in the OS temp directory, so it never rewrites the theme assets
// tracked in this repository.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { REPO_ROOT, loadLessons, markdownToShopifyRichText } from "./lib/learning-data.js";

const R01_HANDLE = "choosing-a-mask";
const R01_RELATED_LINE =
  "[RELATED] **Want to learn more?** Read our full guide to [clear vs. black snorkel masks](https://oceansoptics.com/blogs/home/clear-vs-black-snorkel-mask).";
const R01_RELATED_URL = "https://oceansoptics.com/blogs/home/clear-vs-black-snorkel-mask";

let passed = 0;
let failed = 0;

function check(label, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failed += 1;
    console.log(`  FAIL: ${label}\n    ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}\n    expected ${e}\n    actual   ${a}`);
}

function blocks(markdown) {
  return markdownToShopifyRichText(markdown).children;
}

function r01Body() {
  const r01 = loadLessons().find((lesson) => lesson.handle === R01_HANDLE);
  assert(r01, "R01 lesson data not found.");
  return r01.fields.lesson_body;
}

// --- 1-4: recognition, bold lead-in, https link, link text -------------------

check("RELATED line becomes exactly one paragraph", () => {
  const out = blocks(R01_RELATED_LINE);
  assert(out.length === 1, `expected 1 block, got ${out.length}`);
  assert(out[0].type === "paragraph", `expected paragraph, got ${out[0].type}`);
});

check("RELATED marker text itself is not rendered", () => {
  assert(!JSON.stringify(blocks(R01_RELATED_LINE)).includes("[RELATED]"), "[RELATED] leaked into output");
});

check("bold lead-in, plain text, https link and trailing text are preserved in order", () => {
  assertDeepEqual(
    blocks(R01_RELATED_LINE)[0].children,
    [
      { type: "text", value: "Want to learn more?", bold: true },
      { type: "text", value: " Read our full guide to " },
      { type: "link", url: R01_RELATED_URL, children: [{ type: "text", value: "clear vs. black snorkel masks" }] },
      { type: "text", value: "." }
    ],
    "R01 RELATED paragraph nodes"
  );
});

check("link has no target (same-tab internal link)", () => {
  const link = blocks(R01_RELATED_LINE)[0].children.find((node) => node.type === "link");
  assert(!("target" in link), "link unexpectedly carries a target");
});

check("multiple bold segments and links on one RELATED line are all kept", () => {
  const out = blocks("[RELATED] **One** and **two**: [a](https://example.com/a) or [b](https://example.com/b)");
  assertDeepEqual(
    out[0].children,
    [
      { type: "text", value: "One", bold: true },
      { type: "text", value: " and " },
      { type: "text", value: "two", bold: true },
      { type: "text", value: ": " },
      { type: "link", url: "https://example.com/a", children: [{ type: "text", value: "a" }] },
      { type: "text", value: " or " },
      { type: "link", url: "https://example.com/b", children: [{ type: "text", value: "b" }] }
    ],
    "multi-segment RELATED nodes"
  );
});

check("RELATED line surrounded by whitespace is still recognised", () => {
  const out = blocks(`   ${R01_RELATED_LINE}   `);
  assert(out.length === 1 && out[0].children[0].bold === true, "indented RELATED line not recognised");
});

// --- 5: ordinary paragraphs unchanged ---------------------------------------

check("ordinary paragraph still strips bold and external links", () => {
  assertDeepEqual(
    blocks("**Want to learn more?** Read [clear vs. black](https://oceansoptics.com/blogs/home/x)."),
    [{ type: "paragraph", children: [{ type: "text", value: "Want to learn more? Read clear vs. black." }] }],
    "ordinary paragraph"
  );
});

check("RELATED only applies at the start of a line", () => {
  const out = blocks("See also [RELATED] **x** [y](https://example.com/y)");
  assertDeepEqual(out, [{ type: "paragraph", children: [{ type: "text", value: "See also [RELATED] x y" }] }], "mid-line marker");
});

check("RELATED line ends the preceding paragraph and does not swallow the next one", () => {
  const out = blocks(["Before line one", "before line two", R01_RELATED_LINE, "After **text**"].join("\n"));
  assert(out.length === 3, `expected 3 blocks, got ${out.length}`);
  assertDeepEqual(out[0], { type: "paragraph", children: [{ type: "text", value: "Before line one before line two" }] }, "preceding paragraph");
  assertDeepEqual(out[2], { type: "paragraph", children: [{ type: "text", value: "After text" }] }, "following paragraph");
});

check("RELATED line closes an open list", () => {
  const out = blocks(["- item one", "- item two", R01_RELATED_LINE].join("\n"));
  assert(out.length === 2 && out[0].type === "list" && out[1].type === "paragraph", "list not closed before RELATED");
});

// --- 6: malformed input degrades safely --------------------------------------

check("bare [RELATED] with nothing after it is an ordinary paragraph", () => {
  assertDeepEqual(blocks("[RELATED]"), [{ type: "paragraph", children: [{ type: "text", value: "[RELATED]" }] }], "bare marker");
});

check("non-https links on a RELATED line are not turned into links", () => {
  for (const url of ["http://example.com/x", "javascript:alert(1)", "/pages/learn/choosing-fins", "lesson:choosing-fins"]) {
    const out = blocks(`[RELATED] Read [label](${url})`);
    assert(!JSON.stringify(out).includes('"type":"link"'), `${url} produced a link`);
    assert(out.length === 1 && out[0].type === "paragraph", `${url} did not stay one paragraph`);
  }
});

check("unclosed bold on a RELATED line is kept as plain text", () => {
  assertDeepEqual(blocks("[RELATED] **Unclosed lead-in"), [{ type: "paragraph", children: [{ type: "text", value: "**Unclosed lead-in" }] }], "unclosed bold");
});

check("malformed RELATED lines never disturb neighbouring blocks", () => {
  const wrap = (line) => ["## Heading", "", "Intro **paragraph**.", "", line, "", "- after item"].join("\n");
  const baseline = blocks(wrap("Plain middle paragraph."));
  for (const line of ["[RELATED]", "[RELATED] **x", "[RELATED] [a](http://x)", "[RELATED] [broken](https://x", "[RELATED] ](https://x)["]) {
    const out = blocks(wrap(line));
    assert(out.length === baseline.length, `${line}: block count ${out.length} != ${baseline.length}`);
    assertDeepEqual(out[0], baseline[0], `${line}: heading changed`);
    assertDeepEqual(out[1], baseline[1], `${line}: intro paragraph changed`);
    assertDeepEqual(out[3], baseline[3], `${line}: following list changed`);
    assert(out[2].type === "paragraph", `${line}: middle block is not a paragraph`);
  }
});

// --- 8: lesson content -------------------------------------------------------

check("R01 contains exactly one RELATED line, the clear-vs-black guide", () => {
  const lines = r01Body().split(/\r?\n/).filter((line) => /^\[RELATED\]\s/.test(line.trim()));
  assertDeepEqual(lines, [R01_RELATED_LINE], "R01 RELATED lines");
});

check("R01 public-copy.md carries the same RELATED line as the lesson data", () => {
  const copy = fs.readFileSync(path.join(REPO_ROOT, "content-development/lessons/R01-choosing-a-mask/public-copy.md"), "utf8");
  assert(copy.split(/\r?\n/).includes(R01_RELATED_LINE), "public-copy.md is missing the RELATED line");
});

check("no other lesson uses RELATED lines", () => {
  const others = loadLessons()
    .filter((lesson) => lesson.handle !== R01_HANDLE)
    .filter((lesson) => Object.values(lesson.fields).some((value) => typeof value === "string" && /^\s*\[RELATED\]/m.test(value)));
  assertDeepEqual(others.map((lesson) => lesson.handle), [], "lessons with RELATED lines");
});

check("removing R01's RELATED line removes only that one paragraph", () => {
  const body = r01Body();
  const withLine = blocks(body);
  const without = blocks(body.replace(`${R01_RELATED_LINE}\n\n`, ""));
  const index = withLine.findIndex((block) => block.children?.some((node) => node.url === R01_RELATED_URL));
  assert(index > 0, "R01 RELATED paragraph not found");
  assert(withLine.length === without.length + 1, `block counts ${withLine.length} vs ${without.length}`);
  assertDeepEqual([...withLine.slice(0, index), ...withLine.slice(index + 1)], without, "other R01 blocks changed");
});

// --- 7: preview fixture mirrors production -----------------------------------

function richTextParagraphToHtml(paragraph) {
  const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<p>${paragraph.children
    .map((node) => {
      if (node.type === "link") return `<a href="${node.url}">${escape(node.children.map((child) => child.value).join(""))}</a>`;
      return node.bold ? `<strong>${escape(node.value)}</strong>` : escape(node.value);
    })
    .join("")}</p>`;
}

const PARITY_LINES = [
  R01_RELATED_LINE,
  "[RELATED] **One** and **two**: [a](https://example.com/a) or [b](https://example.com/b)",
  "[RELATED] Plain text with no bold and [one link](https://oceansoptics.com/blogs/home/x)"
];

function runPreviewGeneratorOnCopy(extraLines) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "oo-related-preview-"));
  try {
    fs.cpSync(path.join(REPO_ROOT, "shopify"), path.join(tmp, "shopify"), {
      recursive: true,
      filter: (source) => !source.includes(`${path.sep}node_modules`)
    });
    fs.cpSync(path.join(REPO_ROOT, "content-development"), path.join(tmp, "content-development"), { recursive: true });
    fs.mkdirSync(path.join(tmp, "theme/learning-hub-pilot/assets"), { recursive: true });
    fs.mkdirSync(path.join(tmp, "theme/learning-hub-pilot/snippets"), { recursive: true });

    const lessonFile = path.join(tmp, "shopify/data/lessons/R01-choosing-a-mask.json");
    const lesson = JSON.parse(fs.readFileSync(lessonFile, "utf8"));
    lesson.fields.lesson_body = `${lesson.fields.lesson_body}\n\n${extraLines.join("\n\n")}`;
    fs.writeFileSync(lessonFile, JSON.stringify(lesson, null, 2));

    const run = spawnSync(process.execPath, ["scripts/generate-preview-fixture.js"], { cwd: path.join(tmp, "shopify"), encoding: "utf8" });
    if (run.status !== 0) throw new Error(`preview generator failed: ${run.stderr || run.stdout}`);

    const assetsDir = path.join(tmp, "theme/learning-hub-pilot/assets");
    const dataFile = fs.readdirSync(assetsDir).find((file) => /^learning-hub-preview-data\.[0-9a-f]{12}\.js$/.test(file));
    const sandbox = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(assetsDir, dataFile), "utf8"), sandbox);
    return { html: sandbox.window.OOLearningHubPreviewData.lessons.find((l) => l.handle === R01_HANDLE).lesson_body_html, body: lesson.fields.lesson_body };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

let preview = null;
check("preview generator runs on a temporary copy", () => {
  preview = runPreviewGeneratorOnCopy(PARITY_LINES.slice(1));
});

if (preview) {
  for (const line of PARITY_LINES) {
    check(`preview HTML matches production rich text: ${line.slice(0, 50)}...`, () => {
      const expected = richTextParagraphToHtml(blocks(line)[0]);
      assert(preview.html.includes(expected), `preview HTML is missing ${expected}`);
    });
  }

  check("preview HTML never shows the [RELATED] marker", () => {
    assert(!preview.html.includes("[RELATED]"), "[RELATED] leaked into preview HTML");
  });
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed) {
  process.exitCode = 1;
} else {
  console.log("All RELATED reading link tests passed.");
}
