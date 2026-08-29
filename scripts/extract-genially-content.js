#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const sourceDir = path.resolve(
  process.env.SOURCE_GENIALLY_DIR || "/Users/jameslee/Downloads/Ocean Wise Ebook",
);
const htmlPath = path.join(sourceDir, "genially.html");
const outputDir = path.join(projectRoot, "extracted-content");
const pagesDir = path.join(outputDir, "pages");

const SOURCE_NOTE =
  "Source: `/Users/jameslee/Downloads/Ocean Wise Ebook/genially.html` -> `window.dataBase64` decoded JSON.";

function readData() {
  const html = fs.readFileSync(htmlPath, "utf8");
  const match = html.match(/window\.dataBase64="([^"]+)"/);
  if (!match) {
    throw new Error("Could not find window.dataBase64 in genially.html");
  }
  return {
    html,
    data: JSON.parse(Buffer.from(match[1], "base64").toString("utf8")),
  };
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function htmlToBlocks(value) {
  const input = String(value || "");
  if (!input.trim()) return [];
  const withBreaks = input
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(div|p|li|h[1-6])>/gi, "\n")
    .replace(/<(div|p|li|h[1-6])[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "");

  return decodeEntities(withBreaks)
    .replace(/\u00a0/g, " ")
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

function oneLine(value) {
  return htmlToBlocks(value).join(" ").replace(/[ \t]+/g, " ").trim();
}

function mdEscape(value) {
  return String(value || "").replace(/\|/g, "\\|");
}

function code(value) {
  return `\`${String(value || "N/A").replace(/`/g, "\\`")}\``;
}

function px(value) {
  const n = Number.parseFloat(String(value || "0").replace("px", ""));
  return Number.isFinite(n) ? n : 0;
}

function posTop(item) {
  return px(item.Position && item.Position.PositionTop);
}

function posLeft(item) {
  return px(item.Position && item.Position.PositionLeft);
}

function itemSort(a, b) {
  return posTop(a) - posTop(b) || posLeft(a) - posLeft(b) || Number(a.ZIndex || 0) - Number(b.ZIndex || 0);
}

function fontSize(item) {
  return px(item.FontSize);
}

function slugify(value, fallback) {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 58);
  return slug || fallback;
}

function relPathFromSource(localSource) {
  if (!localSource) return null;
  const cleaned = String(localSource).replace(/^\.\//, "");
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return cleaned;
}

function resolveSmartTarget(slide, action, slidesByOrder) {
  const smart = action.target && action.target.smartLink;
  if (!smart) return null;
  if (smart === "nextPage") return slidesByOrder.get(slide.Order + 1) || null;
  if (smart === "previousPage") return slidesByOrder.get(slide.Order - 1) || null;
  if (smart === "firstPage") return slidesByOrder.get(1) || null;
  if (smart === "lastPage") return slidesByOrder.get(Math.max(...slidesByOrder.keys())) || null;
  return null;
}

function getTargetSlideId(action) {
  return action.targetSlideId || (action.target && action.target.slideId) || null;
}

function fileType(filePath) {
  const ext = path.extname(filePath).replace(".", "").toLowerCase();
  if (!ext) return "unknown";
  return ext;
}

function imageDimensions(buffer, type) {
  try {
    if (type === "png" && buffer.toString("ascii", 1, 4) === "PNG") {
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
      };
    }
    if (type === "gif") {
      return {
        width: buffer.readUInt16LE(6),
        height: buffer.readUInt16LE(8),
      };
    }
    if (type === "jpg" || type === "jpeg") {
      let offset = 2;
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        const length = buffer.readUInt16BE(offset + 2);
        if (
          marker === 0xc0 ||
          marker === 0xc1 ||
          marker === 0xc2 ||
          marker === 0xc3 ||
          marker === 0xc5 ||
          marker === 0xc6 ||
          marker === 0xc7 ||
          marker === 0xc9 ||
          marker === 0xca ||
          marker === 0xcb ||
          marker === 0xcd ||
          marker === 0xce ||
          marker === 0xcf
        ) {
          return {
            width: buffer.readUInt16BE(offset + 7),
            height: buffer.readUInt16BE(offset + 5),
          };
        }
        offset += 2 + length;
      }
    }
  } catch (_) {
    return null;
  }
  return null;
}

function listFilesRecursive(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function ensureOutput() {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(pagesDir, { recursive: true });
  for (const file of fs.readdirSync(pagesDir)) {
    if (/^\d{3}-.+\.md$/.test(file)) {
      fs.unlinkSync(path.join(pagesDir, file));
    }
  }
}

function buildModel(data) {
  const slides = [...data.Slides].sort((a, b) => Number(a.Order) - Number(b.Order));
  const slidesById = new Map(slides.map((slide) => [slide.Id, slide]));
  const slidesByOrder = new Map(slides.map((slide) => [Number(slide.Order), slide]));

  const textBySlide = new Map();
  const imageBySlide = new Map();
  const svgBySlide = new Map();
  const groupBySlide = new Map();
  const objectById = new Map();

  for (const item of data.Texts || []) {
    objectById.set(item.Id, { type: "text", item });
    if (!textBySlide.has(item.IdSlide)) textBySlide.set(item.IdSlide, []);
    textBySlide.get(item.IdSlide).push(item);
  }
  for (const item of data.Images || []) {
    objectById.set(item.Id, { type: "image", item });
    if (!imageBySlide.has(item.IdSlide)) imageBySlide.set(item.IdSlide, []);
    imageBySlide.get(item.IdSlide).push(item);
  }
  for (const item of data.Svgs || []) {
    objectById.set(item.Id, { type: "svg", item });
    if (!svgBySlide.has(item.IdSlide)) svgBySlide.set(item.IdSlide, []);
    svgBySlide.get(item.IdSlide).push(item);
  }
  for (const item of data.Groups || []) {
    objectById.set(item.Id, { type: "group", item });
    if (!groupBySlide.has(item.IdSlide)) groupBySlide.set(item.IdSlide, []);
    groupBySlide.get(item.IdSlide).push(item);
  }

  for (const map of [textBySlide, imageBySlide, svgBySlide, groupBySlide]) {
    for (const list of map.values()) list.sort(itemSort);
  }

  const actions = data.interactivityActions || {};
  const outgoingBySlide = new Map();
  const incomingBySlide = new Map();
  const popupSourceById = new Map();
  const audioUses = [];

  function addOutgoing(slideId, source, eventName, actionId, action) {
    if (!outgoingBySlide.has(slideId)) outgoingBySlide.set(slideId, []);
    const record = { slideId, source, eventName, actionId, action };
    outgoingBySlide.get(slideId).push(record);

    const targetSlideId = getTargetSlideId(action);
    if (targetSlideId) {
      if (!incomingBySlide.has(targetSlideId)) incomingBySlide.set(targetSlideId, []);
      incomingBySlide.get(targetSlideId).push(record);
      if (action.type === "slidePopup" && !popupSourceById.has(targetSlideId)) {
        popupSourceById.set(targetSlideId, record);
      }
    }
    if (action.type === "playAudio") {
      audioUses.push(record);
    }
  }

  for (const object of objectById.values()) {
    const slideId = object.item.IdSlide;
    for (const [eventName, actionId] of Object.entries(object.item.interactivities || {})) {
      const action = actions[actionId];
      if (slideId && action) addOutgoing(slideId, object, eventName, actionId, action);
    }
  }

  for (const list of outgoingBySlide.values()) {
    list.sort((a, b) => itemSort(a.source.item, b.source.item));
  }

  const primarySlides = slides.filter((slide) => Number(slide.Order) <= 32);
  const popupSlides = slides.filter((slide) => Number(slide.Order) > 32 || popupSourceById.has(slide.Id));

  const explicitSectionMenus = new Map([
    [3, "Introduction"],
    [8, "Equipment"],
    [13, "Academics"],
    [20, "Open Water"],
    [26, "Extra Tips & Resources"],
  ]);

  const sectionBySlideId = new Map();
  for (const slide of slides) {
    let section = "Unsectioned";
    if (slide.Order === 1) section = "Cover";
    else if (slide.Order === 2) section = "Main Menu";
    else if (slide.Order >= 3 && slide.Order <= 7) section = "Introduction";
    else if (slide.Order >= 8 && slide.Order <= 12) section = "Equipment";
    else if (slide.Order >= 13 && slide.Order <= 19) section = "Academics";
    else if (slide.Order >= 20 && slide.Order <= 25) section = "Open Water";
    else if (slide.Order >= 26 && slide.Order <= 32) section = "Extra Tips & Resources";
    sectionBySlideId.set(slide.Id, section);
  }

  for (const popup of popupSlides) {
    const sourceRecord = popupSourceById.get(popup.Id);
    if (sourceRecord) {
      sectionBySlideId.set(popup.Id, sectionBySlideId.get(sourceRecord.slideId) || "Popup");
    }
  }

  function textRecords(slideId) {
    return (textBySlide.get(slideId) || []).map((item) => ({
      id: item.Id,
      role: item.LayerTitle || item.DisplayHtmlAs || "text",
      blocks: htmlToBlocks(item.TextMessage),
      text: oneLine(item.TextMessage),
      item,
    }));
  }

  function titleForSlide(slide) {
    const records = textRecords(slide.Id).filter((record) => record.text);
    const candidateBlocks = [];
    for (const record of records) {
      const firstBlock = record.blocks[0] || record.text;
      candidateBlocks.push({
        record,
        text: firstBlock.trim(),
      });
    }
    const titleish = candidateBlocks
      .filter(({ record, text }) => {
        if (!text || text.length > 140) return false;
        if (/^(start|leavecoated mask|vs|1 vs 2)$/i.test(text)) return false;
        if (slide.Order <= 32 && !/title/i.test(record.role) && fontSize(record.item) < 45) return false;
        return true;
      })
      .sort((a, b) => {
        const titleRoleA = /title/i.test(a.record.role) ? 1 : 0;
        const titleRoleB = /title/i.test(b.record.role) ? 1 : 0;
        return (
          (slide.Order <= 32 ? posTop(a.record.item) - posTop(b.record.item) : 0) ||
          titleRoleB - titleRoleA ||
          fontSize(b.record.item) - fontSize(a.record.item) ||
          posTop(a.record.item) - posTop(b.record.item)
        );
      });

    const named = String(slide.Name || "").trim();
    if (named === "COVER") return "Ocean Wise";
    if (slide.Order === 2) return "INDEX";
    if (explicitSectionMenus.has(slide.Order)) {
      const zone = records.find((record) => /\bZone\b/i.test(record.text));
      if (zone) return zone.text;
    }
    if (titleish.length) return titleish[0].text;
    const firstBlock = candidateBlocks.find(({ text }) => text && !/^(start|leavecoated mask)$/i.test(text));
    if (firstBlock) return firstBlock.text.slice(0, 120);
    return named && !/^Copy/i.test(named) ? named : `Slide ${slide.Order}`;
  }

  const titleBySlideId = new Map(slides.map((slide) => [slide.Id, titleForSlide(slide)]));

  function slideKind(slide) {
    if (popupSourceById.has(slide.Id) || Number(slide.Order) > 32) return "Popup/modal slide";
    if (slide.Order === 1) return "Cover";
    if (slide.Order === 2) return "Main menu";
    if (explicitSectionMenus.has(slide.Order)) return "Section menu";
    return "Content page";
  }

  function actionLabel(record, currentSlide) {
    const action = record.action;
    const targetSlideId = getTargetSlideId(action);
    if (targetSlideId && slidesById.has(targetSlideId)) {
      const target = slidesById.get(targetSlideId);
      return `${action.type}: ${titleBySlideId.get(targetSlideId)} (slide ${target.Order}, ${target.Id})`;
    }
    const smartTarget = resolveSmartTarget(currentSlide, action, slidesByOrder);
    if (smartTarget) {
      return `${action.type}: ${action.target.smartLink} -> ${titleBySlideId.get(smartTarget.Id)} (slide ${smartTarget.Order}, ${smartTarget.Id})`;
    }
    if (action.type === "openLink") {
      return `openLink: ${action.link} (${action.linkTarget || "_self"})`;
    }
    if (action.type === "playAudio") {
      return `playAudio: ${action.name || "audio"} -> ${action.source}`;
    }
    if (action.type === "zoom") {
      return `zoom: source element ${action.refId || record.source.item.Id}`;
    }
    if (action.type === "showElements") {
      return `showElements: source element ${action.refId || record.source.item.Id}`;
    }
    if (action.type === "closeSlidePopup") {
      return "closeSlidePopup";
    }
    return `${action.type}: ${JSON.stringify(action)}`;
  }

  return {
    data,
    slides,
    slidesById,
    slidesByOrder,
    primarySlides,
    popupSlides,
    textBySlide,
    imageBySlide,
    svgBySlide,
    groupBySlide,
    outgoingBySlide,
    incomingBySlide,
    popupSourceById,
    audioUses,
    sectionBySlideId,
    titleBySlideId,
    textRecords,
    slideKind,
    actionLabel,
  };
}

function mediaForSlide(model, slide) {
  const images = [];
  const background = relPathFromSource(slide.Background);
  if (background) {
    images.push({
      kind: "background",
      path: background,
      id: "slide.Background",
      title: "Slide background",
    });
  }
  for (const image of model.imageBySlide.get(slide.Id) || []) {
    images.push({
      kind: "image",
      path: relPathFromSource(image.Source),
      id: image.Id,
      title: image.LayerTitle || image.Name || "",
      size: image.Size,
      position: image.Position,
    });
  }
  return images;
}

function audioForSlide(model, slide) {
  return (model.outgoingBySlide.get(slide.Id) || [])
    .filter((record) => record.action.type === "playAudio")
    .map((record) => ({
      actionId: record.actionId,
      source: relPathFromSource(record.action.source),
      name: record.action.name || "",
      mode: record.action.playMode || "",
    }));
}

function externalLinksForSlide(model, slide) {
  return (model.outgoingBySlide.get(slide.Id) || [])
    .filter((record) => record.action.type === "openLink")
    .map((record) => ({
      actionId: record.actionId,
      link: record.action.link,
      target: record.action.linkTarget || "",
    }));
}

function interactionRows(model, slide) {
  return (model.outgoingBySlide.get(slide.Id) || []).map((record) => {
    const sourceItem = record.source.item;
    const sourceText =
      record.source.type === "text"
        ? oneLine(sourceItem.TextMessage)
        : sourceItem.LayerTitle || sourceItem.Name || sourceItem.Source || sourceItem.SourceSvg || sourceItem.Id;
    return {
      event: record.eventName,
      sourceType: record.source.type,
      sourceId: sourceItem.Id,
      sourceText,
      action: model.actionLabel(record, slide),
    };
  });
}

function writeContentInventory(model) {
  const lines = [];
  lines.push("# Content Inventory");
  lines.push("");
  lines.push("This inventory preserves the recovered Genially guide content in `Slides.Order` order.");
  lines.push("");
  lines.push("## Investigation Summary");
  lines.push("");
  lines.push("- `genially.html` is an offline Genially shell with a large `window.dataBase64` payload and links to Genially runtime assets in `static/js` and `css`.");
  lines.push("- The main recoverable content is in the decoded JSON top-level arrays: `Slides`, `Texts`, `Images`, `Svgs`, and `interactivityActions`.");
  lines.push(`- Detected ${model.slides.length} slide records: ${model.primarySlides.length} main/menu/content screens and ${model.popupSlides.length} popup/modal-style slides.`);
  lines.push("- Page order is recoverable from `Slides[*].Order`.");
  lines.push("- Navigation is recoverable from `interactivityActions`, especially `goToSlide`, `slidePopup`, `closeSlidePopup`, `zoom`, `showElements`, `openLink`, and `playAudio`.");
  lines.push("- Text is recoverable programmatically from `Texts[*].TextMessage` HTML.");
  lines.push("- Local images map through `Slides[*].Background` and `Images[*].Source`; the local audio is referenced by a raw `playAudio` action, but its source slide was not recoverably mapped.");
  lines.push("- Manual review is still needed for text embedded directly in image pixels, unlabeled SVG icon meaning, and exact animation/visual sequencing.");
  lines.push("");
  lines.push("## Pages, Screens, and Popups");
  lines.push("");

  for (const slide of model.slides) {
    const title = model.titleBySlideId.get(slide.Id);
    const section = model.sectionBySlideId.get(slide.Id);
    const textRecords = model.textRecords(slide.Id).filter((record) => record.blocks.length);
    const images = mediaForSlide(model, slide);
    const audios = audioForSlide(model, slide);
    const links = externalLinksForSlide(model, slide);
    const interactions = interactionRows(model, slide);
    const sourceRecord = model.popupSourceById.get(slide.Id);

    lines.push(`### ${String(slide.Order).padStart(3, "0")} - ${title}`);
    lines.push("");
    lines.push(`- Page/scene number: ${slide.Order}`);
    lines.push(`- Scene ID: ${code(slide.Id)}`);
    lines.push(`- Original Genially name: ${code(slide.Name || "")}`);
    lines.push(`- Type: ${model.slideKind(slide)}`);
    lines.push(`- Original section: ${section}`);
    if (sourceRecord) {
      const sourceSlide = model.slidesById.get(sourceRecord.slideId);
      lines.push(
        `- Popup source: ${model.titleBySlideId.get(sourceSlide.Id)} (slide ${sourceSlide.Order}, action ${code(sourceRecord.actionId)})`,
      );
    }
    lines.push(`- Source location: ${SOURCE_NOTE} Slide object with ID ${code(slide.Id)}; related ` +
      `Texts/Images/Svgs filtered by \`IdSlide\`.`);
    lines.push("");

    lines.push("#### Title / Subtitle / Body Copy");
    lines.push("");
    if (!textRecords.length) {
      lines.push("- No text objects recovered for this slide.");
    } else {
      for (const record of textRecords) {
        lines.push(`- Text object ${code(record.id)} (${record.role}):`);
        for (const block of record.blocks) {
          lines.push(`  - ${block}`);
        }
      }
    }
    lines.push("");

    lines.push("#### Media");
    lines.push("");
    if (!images.length && !audios.length) {
      lines.push("- No local image/audio/video references recovered for this slide.");
    }
    for (const image of images) {
      lines.push(`- ${image.kind}: ${code(image.path)} (source ${code(image.id)})`);
    }
    for (const audio of audios) {
      lines.push(`- audio: ${code(audio.source)} (${audio.name || "unnamed"}, action ${code(audio.actionId)})`);
    }
    lines.push("- video: none recovered in `Videos`; no local video objects detected.");
    lines.push("");

    lines.push("#### Links and Navigation");
    lines.push("");
    if (!interactions.length) {
      lines.push("- No outgoing interactions recovered.");
    } else {
      for (const interaction of interactions) {
        lines.push(
          `- ${interaction.event} on ${interaction.sourceType} ${code(interaction.sourceId)} ` +
            `(${interaction.sourceText || "unlabeled"}): ${interaction.action}`,
        );
      }
    }
    if (links.length) {
      lines.push("");
      lines.push("External links:");
      for (const link of links) lines.push(`- ${link.link} (${link.target || "_self"})`);
    }
    lines.push("");
  }

  fs.writeFileSync(path.join(outputDir, "CONTENT-INVENTORY.md"), lines.join("\n"));
}

function writeStructure(model) {
  const lines = [];
  lines.push("# Structure");
  lines.push("");
  lines.push("The existing guide is a mobile-format Genially deck. The order below is reconstructed from `Slides.Order`, with hierarchy inferred from menu screens and `goToSlide` / `slidePopup` actions.");
  lines.push("");

  function pageLine(slide) {
    return `- ${String(slide.Order).padStart(3, "0")} ${model.titleBySlideId.get(slide.Id)} (${model.slideKind(slide)}, ID ${slide.Id})`;
  }

  const byOrder = (from, to) => model.slides.filter((slide) => slide.Order >= from && slide.Order <= to);
  const sections = [
    { name: "Introduction", menuOrder: 3, from: 4, to: 7 },
    { name: "Equipment", menuOrder: 8, from: 9, to: 12 },
    { name: "Academics", menuOrder: 13, from: 14, to: 19 },
    { name: "Open Water", menuOrder: 20, from: 21, to: 25 },
    { name: "Extra Tips & Resources", menuOrder: 26, from: 27, to: 32 },
  ];

  lines.push("## Main Flow");
  lines.push("");
  lines.push(pageLine(model.slidesByOrder.get(1)));
  lines.push(pageLine(model.slidesByOrder.get(2)));
  lines.push("");
  lines.push("## Main Menu");
  lines.push("");
  const mainMenu = model.slidesByOrder.get(2);
  const mainMenuTargets = new Map();
  for (const record of (model.outgoingBySlide.get(mainMenu.Id) || []).filter((record) => record.action.type === "goToSlide")) {
    const targetId = getTargetSlideId(record.action);
    if (targetId && !mainMenuTargets.has(targetId) && model.slidesById.has(targetId)) {
      const target = model.slidesById.get(targetId);
      mainMenuTargets.set(targetId, target);
    }
  }
  for (const target of [...mainMenuTargets.values()].sort((a, b) => a.Order - b.Order)) {
    lines.push(`- ${model.titleBySlideId.get(target.Id)} (slide ${target.Order}, ${target.Id})`);
  }
  lines.push("");

  lines.push("## Sections");
  lines.push("");
  for (const section of sections) {
    const menu = model.slidesByOrder.get(section.menuOrder);
    lines.push(`### ${section.name}`);
    lines.push("");
    lines.push(`- Menu: ${String(menu.Order).padStart(3, "0")} ${model.titleBySlideId.get(menu.Id)} (${menu.Id})`);
    for (const slide of byOrder(section.from, section.to)) {
      lines.push(pageLine(slide));
      const popups = (model.outgoingBySlide.get(slide.Id) || [])
        .filter((record) => record.action.type === "slidePopup")
        .map((record) => model.slidesById.get(getTargetSlideId(record.action)))
        .filter(Boolean);
      for (const popup of popups) {
        lines.push(`  - Popup: ${String(popup.Order).padStart(3, "0")} ${model.titleBySlideId.get(popup.Id)} (${popup.Id})`);
      }
    }
    lines.push("");
  }

  lines.push("## Branching and Repeated Navigation");
  lines.push("");
  lines.push("- Most main content pages include a home/index icon or button returning to slide 002 `INDEX`.");
  lines.push("- Section menus branch to their child pages and back to the main menu.");
  lines.push("- Popup/modal slides are reached by `slidePopup` actions and usually close through `closeSlidePopup` actions.");
  lines.push("- `zoom` actions appear on some image/icon elements and should be manually reviewed for visual intent.");
  lines.push("- `showElements` actions appear in the data and may represent staged/revealed content.");
  lines.push("- One `playAudio` action references the local MPGA file in `/audios`.");
  lines.push("- External `openLink` actions reference Genially/LinkedIn URLs and are catalogued in the content inventory.");
  lines.push("");

  fs.writeFileSync(path.join(outputDir, "STRUCTURE.md"), lines.join("\n"));
}

function writePageFiles(model) {
  const usedNames = new Set();
  for (const slide of model.slides) {
    const title = model.titleBySlideId.get(slide.Id);
    let base = `${String(slide.Order).padStart(3, "0")}-${slugify(title, `slide-${slide.Order}`)}`;
    while (usedNames.has(base)) base = `${base}-${slide.Id.slice(0, 4)}`;
    usedNames.add(base);

    const lines = [];
    const textRecords = model.textRecords(slide.Id).filter((record) => record.blocks.length);
    const images = mediaForSlide(model, slide);
    const audios = audioForSlide(model, slide);
    const interactions = interactionRows(model, slide);

    lines.push(`# ${title}`);
    lines.push("");
    lines.push(`- Page number / scene order: ${slide.Order}`);
    lines.push(`- Scene ID: ${code(slide.Id)}`);
    lines.push(`- Original section: ${model.sectionBySlideId.get(slide.Id)}`);
    lines.push(`- Type: ${model.slideKind(slide)}`);
    lines.push(`- Original Genially name: ${code(slide.Name || "")}`);
    lines.push(`- Source location: ${SOURCE_NOTE}`);
    lines.push("");

    lines.push("## Original Copy");
    lines.push("");
    if (!textRecords.length) {
      lines.push("No text objects recovered for this slide.");
    } else {
      for (const record of textRecords) {
        lines.push(`### Text Object ${record.id}`);
        lines.push("");
        lines.push(`Role/layer: ${record.role}`);
        lines.push("");
        for (const block of record.blocks) lines.push(block);
        lines.push("");
      }
    }

    lines.push("## Referenced Images");
    lines.push("");
    if (!images.length) {
      lines.push("None recovered.");
    } else {
      for (const image of images) {
        lines.push(`- ${image.kind}: ${code(image.path)} (source ${code(image.id)})`);
      }
    }
    lines.push("");

    lines.push("## Referenced Media");
    lines.push("");
    if (!audios.length) {
      lines.push("- Audio: none recovered on this slide.");
    } else {
      for (const audio of audios) {
        lines.push(`- Audio: ${code(audio.source)} (${audio.name || "unnamed"}, action ${code(audio.actionId)})`);
      }
    }
    lines.push("- Video: none recovered.");
    lines.push("");

    lines.push("## Links and Interactions");
    lines.push("");
    if (!interactions.length) {
      lines.push("No outgoing interactions recovered.");
    } else {
      for (const interaction of interactions) {
        lines.push(
          `- ${interaction.event} on ${interaction.sourceType} ${code(interaction.sourceId)} ` +
            `(${interaction.sourceText || "unlabeled"}): ${interaction.action}`,
        );
      }
    }
    lines.push("");

    fs.writeFileSync(path.join(pagesDir, `${base}.md`), lines.join("\n"));
  }
}

function writeAssetInventory(model, html) {
  const allFiles = [
    ...listFilesRecursive(path.join(sourceDir, "images")),
    ...listFilesRecursive(path.join(sourceDir, "audios")),
    ...listFilesRecursive(path.join(sourceDir, "static")),
    ...listFilesRecursive(path.join(sourceDir, "css")),
    ...listFilesRecursive(path.join(sourceDir, "fonts")),
    path.join(sourceDir, "genially.html"),
    path.join(sourceDir, "favicon.ico"),
    path.join(sourceDir, "Instructions for use.pdf"),
  ].filter((file, index, arr) => fs.existsSync(file) && arr.indexOf(file) === index);

  const imageUsage = new Map();
  const audioUsage = new Map();
  const rawAudioUsage = new Map();

  function addUsage(map, assetPath, slide, usage) {
    if (!assetPath) return;
    const key = assetPath.replace(/^\.\//, "");
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({
      slideOrder: slide.Order,
      slideId: slide.Id,
      title: model.titleBySlideId.get(slide.Id),
      usage,
    });
  }

  for (const slide of model.slides) {
    if (slide.Background) addUsage(imageUsage, slide.Background, slide, "background");
    for (const image of model.imageBySlide.get(slide.Id) || []) {
      addUsage(imageUsage, image.Source, slide, image.LayerTitle || image.Name || "image object");
    }
    for (const audio of audioForSlide(model, slide)) {
      addUsage(audioUsage, audio.source, slide, `playAudio ${audio.actionId}`);
    }
  }

  for (const [actionId, action] of Object.entries(model.data.interactivityActions || {})) {
    if (action.type !== "playAudio" || !action.source) continue;
    const rel = relPathFromSource(action.source);
    if (!rawAudioUsage.has(rel)) rawAudioUsage.set(rel, []);
    rawAudioUsage.get(rel).push({
      actionId,
      name: action.name || "",
      source: rel,
    });
  }

  const hashGroups = new Map();
  const assetRows = allFiles.map((file) => {
    const rel = path.relative(sourceDir, file);
    const buffer = fs.readFileSync(file);
    const hash = crypto.createHash("sha1").update(buffer).digest("hex");
    if (!hashGroups.has(hash)) hashGroups.set(hash, []);
    hashGroups.get(hash).push(rel);
    const type = fileType(file);
    return {
      rel,
      type,
      size: buffer.length,
      hash,
      dimensions: imageDimensions(buffer, type),
      imageUses: imageUsage.get(rel) || [],
      audioUses: audioUsage.get(rel) || [],
    };
  });

  const lines = [];
  lines.push("# Asset Inventory");
  lines.push("");
  lines.push("Assets are catalogued in place from the original Genially export. No assets were copied or renamed.");
  lines.push("");

  const missingRefs = [];
  const srcRegex = /\b(?:src|href)="([^"]+)"/g;
  let match;
  while ((match = srcRegex.exec(html))) {
    const ref = match[1];
    if (/^(https?:)?\/\//.test(ref) || /^data:/i.test(ref)) continue;
    const refPath = path.join(sourceDir, ref);
    if (!fs.existsSync(refPath)) missingRefs.push(ref);
  }

  lines.push("## Summary");
  lines.push("");
  lines.push(`- Files catalogued: ${assetRows.length}`);
  lines.push(`- Image files: ${assetRows.filter((row) => ["png", "jpg", "jpeg", "gif", "svg"].includes(row.type)).length}`);
  lines.push(`- Audio files: ${assetRows.filter((row) => ["mp3", "mpga", "wav", "ogg"].includes(row.type)).length}`);
  lines.push(`- Static JS files: ${assetRows.filter((row) => row.rel.startsWith("static/js/")).length}`);
  lines.push(`- CSS files: ${assetRows.filter((row) => row.rel.startsWith("css/")).length}`);
  lines.push(`- Missing local refs in HTML: ${missingRefs.length ? missingRefs.map(code).join(", ") : "none detected"}`);
  lines.push("");

  lines.push("## Images");
  lines.push("");
  for (const row of assetRows.filter((row) => row.rel.startsWith("images/"))) {
    const duplicateGroup = hashGroups.get(row.hash).filter((rel) => rel !== row.rel);
    const uses = row.imageUses;
    lines.push(`### ${row.rel}`);
    lines.push("");
    lines.push(`- File type: ${row.type}`);
    lines.push(`- Dimensions: ${row.dimensions ? `${row.dimensions.width} x ${row.dimensions.height}` : "not detected"}`);
    lines.push(`- Used: ${uses.length ? "yes" : "not referenced by decoded slide/image data"}`);
    lines.push(`- Pages used: ${uses.length ? uses.map((use) => `${String(use.slideOrder).padStart(3, "0")} ${use.title} (${use.usage})`).join("; ") : "none detected"}`);
    lines.push(`- Appears to depict/contain: inferred from surrounding page context only; manual visual review recommended.`);
    lines.push(`- Duplicate files by SHA-1: ${duplicateGroup.length ? duplicateGroup.join(", ") : "none detected"}`);
    lines.push("");
  }

  lines.push("## Audio");
  lines.push("");
  for (const row of assetRows.filter((row) => row.rel.startsWith("audios/"))) {
    const uses = row.audioUses;
    const rawUses = rawAudioUsage.get(row.rel) || [];
    const directHtmlUse = html.includes(row.rel);
    lines.push(`### ${row.rel}`);
    lines.push("");
    lines.push(`- File type: ${row.type}`);
    lines.push(`- Used: ${uses.length || rawUses.length || directHtmlUse ? "yes" : "not referenced by decoded actions"}`);
    lines.push(`- Pages used: ${uses.length ? uses.map((use) => `${String(use.slideOrder).padStart(3, "0")} ${use.title} (${use.usage})`).join("; ") : "none mapped to a specific slide"}`);
    if (rawUses.length) {
      lines.push(`- Raw actions: ${rawUses.map((use) => `${use.actionId}${use.name ? ` (${use.name})` : ""}`).join("; ")}`);
    }
    if (directHtmlUse) {
      lines.push("- Direct HTML usage: referenced by hidden/preload audio markup in `genially.html`.");
    }
    lines.push("- Appears to contain: audio content requires manual listening review.");
    lines.push("");
  }

  lines.push("## Static, CSS, Fonts, and Other Files");
  lines.push("");
  lines.push("| File | Type | Size | Used / note | Duplicate files |");
  lines.push("| --- | --- | ---: | --- | --- |");
  for (const row of assetRows.filter((row) => !row.rel.startsWith("images/") && !row.rel.startsWith("audios/"))) {
    const duplicateGroup = hashGroups.get(row.hash).filter((rel) => rel !== row.rel);
    let note = "export support file";
    if (html.includes(row.rel)) note = "directly referenced by genially.html";
    if (row.rel.startsWith("static/js/")) note = "Genially runtime/chunk";
    if (row.rel.startsWith("css/")) note = html.includes(row.rel) ? "stylesheet referenced by genially.html" : "stylesheet support file";
    if (row.rel.startsWith("fonts/")) note = "font file";
    lines.push(`| ${mdEscape(row.rel)} | ${row.type} | ${row.size} | ${mdEscape(note)} | ${duplicateGroup.length ? mdEscape(duplicateGroup.join(", ")) : "none"} |`);
  }
  lines.push("");

  fs.writeFileSync(path.join(outputDir, "ASSET-INVENTORY.md"), lines.join("\n"));

  return { missingRefs };
}

function writeIssues(model, missingRefs) {
  const lines = [];
  lines.push("# Extraction Issues");
  lines.push("");
  lines.push("These are the known recovery limitations and items needing manual review.");
  lines.push("");
  lines.push("## Missing or Broken Local Resources");
  lines.push("");
  if (!missingRefs.length) {
    lines.push("- No missing local `src`/`href` references were detected in `genially.html`.");
  } else {
    for (const ref of missingRefs) {
      lines.push(`- ${code(ref)} is referenced by ` + "`genially.html` but was not found in the export folder.");
    }
  }
  lines.push("");
  lines.push("## Data Model Limitations");
  lines.push("");
  lines.push("- The visible HTML does not contain the rendered pages; content was extracted from `window.dataBase64` instead.");
  lines.push("- `Audios` and `Videos` arrays are empty even though one raw `playAudio` interactivity action references a local MPGA file; that action is not clearly attached to a recovered slide object.");
  lines.push("- Text embedded directly inside raster image pixels is not recoverable from the JSON text layer and requires manual visual review.");
  lines.push("- SVG icon/shape meaning is not always named in the data; icon intent should be checked visually.");
  lines.push("- `zoom` and `showElements` actions identify interactive behavior, but their exact visual timing/meaning may require running the Genially viewer.");
  lines.push("- Popup ordering is recoverable from `Slides.Order` and `slidePopup` targets, but some popup slide names are blank or generic copies.");
  lines.push("- Some labels and words appear misspelled in the source content; they were preserved rather than corrected.");
  lines.push("");
  lines.push("## External Resources");
  lines.push("");
  lines.push(`- Published Genially URL in metadata: ${model.data.Genially && model.data.Genially.FriendlyUrl ? model.data.Genially.FriendlyUrl : "not present"}`);
  lines.push(`- Thumbnail/render URL in metadata: ${model.data.Genially && model.data.Genially.ImageRender ? model.data.Genially.ImageRender : "not present"}`);
  const externalLinks = Object.values(model.data.interactivityActions || [])
    .filter((action) => action.type === "openLink" && action.link)
    .map((action) => action.link);
  if (externalLinks.length) {
    lines.push("- Raw `openLink` actions in decoded action table:");
    for (const link of [...new Set(externalLinks)]) lines.push(`  - ${link}`);
    lines.push("- These links are not clearly attached to recovered slide objects in the local data and appear to be Genially social/template links.");
  } else {
    lines.push("- No external openLink actions detected.");
  }
  lines.push("");

  fs.writeFileSync(path.join(outputDir, "EXTRACTION-ISSUES.md"), lines.join("\n"));
}

function main() {
  ensureOutput();
  const { html, data } = readData();
  const model = buildModel(data);

  writeContentInventory(model);
  writeStructure(model);
  writePageFiles(model);
  const { missingRefs } = writeAssetInventory(model, html);
  writeIssues(model, missingRefs);

  console.log(JSON.stringify({
    sourceDir,
    outputDir,
    slides: model.slides.length,
    primarySlides: model.primarySlides.length,
    popupSlides: model.popupSlides.length,
    textObjects: data.Texts.length,
    imageObjects: data.Images.length,
    svgObjects: data.Svgs.length,
    actions: Object.keys(data.interactivityActions || {}).length,
    missingRefs,
  }, null, 2));
}

main();
