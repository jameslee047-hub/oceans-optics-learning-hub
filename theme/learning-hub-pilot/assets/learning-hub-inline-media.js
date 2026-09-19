(function () {
  function normalizeKey(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function mediaItems(record) {
    if (!record) return [];
    if (Array.isArray(record.items)) return record.items;
    if (Array.isArray(record.images)) return record.images;
    return [record];
  }

  function prefersReducedMotion() {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  var currentScriptSrc = document.currentScript && document.currentScript.src || '';
  var assetCacheVersion = (function () {
    if (!currentScriptSrc) return '';

    try {
      return new URL(currentScriptSrc, window.location.href).searchParams.get('v') || '';
    } catch (error) {
      var match = /[?&]v=([^&#]+)/.exec(currentScriptSrc);
      return match ? match[1] : '';
    }
  }());
  var assetBase = (function () {
    if (window.OOLearningHubAssetBase) return window.OOLearningHubAssetBase;
    return currentScriptSrc ? currentScriptSrc.replace(/[^/?#]+([?#].*)?$/, '') : '';
  }());

  function resolveAssetUrl(item) {
    if (item.url) return item.url;
    if (!item.asset_filename || !assetBase) return null;

    try {
      return withAssetCacheVersion(new URL(item.asset_filename, assetBase).href);
    } catch (error) {
      return withAssetCacheVersion(assetBase + item.asset_filename);
    }
  }

  function withAssetCacheVersion(url) {
    if (!url || !assetCacheVersion) return url;

    try {
      var resolved = new URL(url, window.location.href);
      if (!resolved.searchParams.has('v')) {
        resolved.searchParams.set('v', assetCacheVersion);
      }
      return resolved.href;
    } catch (error) {
      if (/[?&]v=/.test(url)) return url;
      return url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + encodeURIComponent(assetCacheVersion);
    }
  }

  // A GIF is just an image format and needs no player. media_type "video" is
  // the only branch that needs a <video> element -- swapping a GIF for an
  // optimized looping MP4/WebM later only ever means changing this item's
  // media_type + url in the registry/metaobject, never the [MEDIA: key].
  function createVisual(item) {
    var url = resolveAssetUrl(item);
    if (!item || !url) return null;

    var wrap = document.createElement('div');
    wrap.className = 'learning-media__image';
    if (item.aspect_ratio) {
      wrap.style.setProperty('--learning-media-aspect', item.aspect_ratio);
    }

    if (item.media_type === 'video') {
      if (!item.alt) return null;
      wrap.classList.add('learning-media__image--video');
      var video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('preload', 'metadata');
      video.setAttribute('aria-label', item.alt);
      if (item.width) video.width = Number(item.width);
      if (item.height) video.height = Number(item.height);
      var source = document.createElement('source');
      source.src = url;
      video.appendChild(source);
      wrap.appendChild(video);
      // Respect prefers-reduced-motion: only autoplay when motion is fine;
      // otherwise the video sits on its first frame like a static image.
      if (!prefersReducedMotion()) {
        video.autoplay = true;
        video.play && video.play().catch(function () {});
      }
      return wrap;
    }

    if (!item.alt) return null;
    var image = document.createElement('img');
    image.src = url;
    image.alt = item.alt;
    image.loading = 'lazy';
    image.decoding = 'async';
    if (item.width) image.width = Number(item.width);
    if (item.height) image.height = Number(item.height);
    wrap.appendChild(image);
    return wrap;
  }

  function createItem(item) {
    var visual = createVisual(item);
    if (!visual) return null;

    var element = document.createElement('div');
    element.className = 'learning-media__item';
    element.appendChild(visual);

    if (item.label) {
      var label = document.createElement('p');
      label.className = 'learning-media__label';
      label.textContent = item.label;
      element.appendChild(label);
    }

    if (item.caption) {
      var itemCaption = document.createElement('p');
      itemCaption.className = 'learning-media__item-caption';
      itemCaption.textContent = item.caption;
      element.appendChild(itemCaption);
    }

    if (item.credit_source) {
      var credit = document.createElement('p');
      credit.className = 'learning-media__credit';
      credit.textContent = item.credit_source;
      element.appendChild(credit);
    }

    return element;
  }

  function isResolvableItem(item) {
    return Boolean(item && (item.url || item.asset_filename) && (item.alt || item.media_type === 'video'));
  }

  function createFigure(record) {
    var layout = record.layout || record.type || 'standard';
    var items = mediaItems(record).filter(isResolvableItem);

    if (layout === 'comparison' && items.length < 2) return null;
    if (layout !== 'comparison' && !items.length) return null;

    var figure = document.createElement('figure');
    figure.className = 'learning-media learning-media--' + layout;
    if (record.width_treatment) {
      figure.classList.add('learning-media--' + record.width_treatment);
    }

    if (layout === 'comparison') {
      var comparison = document.createElement('div');
      comparison.className = 'learning-media__comparison';
      items.slice(0, 2).forEach(function (item) {
        var child = createItem(item);
        if (child) comparison.appendChild(child);
      });
      figure.appendChild(comparison);
    } else if (layout === 'gallery') {
      var gallery = document.createElement('div');
      gallery.className = 'learning-media__gallery';
      items.forEach(function (item) {
        var child = createItem(item);
        if (child) gallery.appendChild(child);
      });
      figure.appendChild(gallery);
    } else {
      var single = createItem(items[0]);
      if (single) figure.appendChild(single);
    }

    var caption = record.overall_caption || record.caption;
    if (caption) {
      var figcaption = document.createElement('figcaption');
      figcaption.textContent = caption;
      figure.appendChild(figcaption);
    }

    return figure;
  }

  function replaceMediaMarkers() {
    var registry = window.OOLearningHubMediaRegistry && window.OOLearningHubMediaRegistry.media;
    if (!registry) return;

    document.querySelectorAll('.learning-hub .learning-rich-text p').forEach(function (paragraph) {
      var match = /^\[MEDIA:\s*([^\]]+)\]$/.exec(paragraph.textContent.trim());
      if (!match) return;

      var record = registry[normalizeKey(match[1])];
      var figure = createFigure(record);

      if (figure) {
        paragraph.replaceWith(figure);
      } else {
        // No unresolved [MEDIA:] marker may ever reach a customer: hide the
        // literal text rather than let it render, and flag it for review.
        paragraph.hidden = true;
        paragraph.setAttribute('data-learning-media-unresolved', normalizeKey(match[1]));
      }
    });
  }

  function isActionParagraph(element) {
    if (!element || element.tagName !== 'P') return false;
    if (element.children.length !== 1) return false;
    if (element.textContent.trim() !== element.children[0].textContent.trim()) return false;

    var link = element.children[0];
    if (link.tagName !== 'A') return false;
    if (link.classList.contains('learning-inline-reference')) return false;

    var href = link.getAttribute('href') || '';
    return href && href.indexOf('lesson:') !== 0;
  }

  // When 2+ action links (TOOL:/PRODUCT:/CTA: markers with no other content
  // between them) land next to each other, giving every one of them equal
  // full-width-orange-button weight reads as several equally important
  // asks at once. The last link in the group becomes the single primary
  // button; every earlier one is demoted to a compact inline text link on
  // its own row underneath, separated by middle dots. This is purely a
  // grouped-block presentation rule -- a lone standalone action paragraph
  // elsewhere in a lesson is untouched (isActionParagraph/this grouping
  // only ever fires for 2+ consecutive ones), and no URL or label text
  // changes. "Last is primary" is a structural rule, not specific to any
  // one lesson: it happens to match every current TOOL/PRODUCT/CTA group in
  // the content today, since editors already tend to close a run of
  // supporting resource links with the strongest specific call-to-action.
  function buildPrimarySecondaryGroup(wrap, paragraphs) {
    wrap.classList.add('learning-action-choice-group--primary-secondary');

    var primary = paragraphs[paragraphs.length - 1];
    primary.classList.add('learning-action-choice-group__primary');
    var secondaryParagraphs = paragraphs.slice(0, -1);

    var secondaryRow = document.createElement('p');
    secondaryRow.className = 'learning-action-choice-group__secondary';

    secondaryParagraphs.forEach(function (paragraph, index) {
      var link = paragraph.children[0];
      link.classList.add('learning-inline-reference');
      secondaryRow.appendChild(link);

      if (index < secondaryParagraphs.length - 1) {
        var sep = document.createElement('span');
        sep.className = 'learning-action-choice-group__sep';
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = '·';
        secondaryRow.appendChild(sep);
      }

      paragraph.remove();
    });

    wrap.appendChild(secondaryRow);
    wrap.insertBefore(primary, secondaryRow);
  }

  function groupActionChoices() {
    // Same wrapper as enhanceGoldenRulesList() below: Shopify's
    // `metafield_tag` filter renders a rich_text_field's content inside its
    // own `.metafield-rich_text_field` div, so the actual <p> elements are
    // grandchildren of `.learning-rich-text`, not direct children -- this
    // selector was never updated for that when the wrapper was discovered,
    // so `root.children` here previously only ever found that one wrapper
    // div and never grouped anything.
    document.querySelectorAll('.learning-hub .learning-rich-text .metafield-rich_text_field').forEach(function (root) {
      var group = [];

      function flush() {
        if (group.length < 2) {
          group = [];
          return;
        }

        var wrap = document.createElement('div');
        wrap.className = 'learning-action-choice-group';
        group[0].before(wrap);
        group.forEach(function (paragraph) {
          wrap.appendChild(paragraph);
        });
        buildPrimarySecondaryGroup(wrap, group);
        group = [];
      }

      Array.prototype.slice.call(root.children).forEach(function (child) {
        if (isActionParagraph(child)) {
          group.push(child);
        } else {
          flush();
        }
      });

      flush();
    });
  }

  // Splits one Golden Rule <li> into a bold "title" (the first sentence) and
  // a smaller supporting "body" (any remaining sentences), operating on the
  // actual child nodes rather than flattened text -- rule 2's body contains
  // a real inline link to Breath-Hold Safety
  // ([Breath-Hold Safety, CO2 & Shallow-Water Blackout](lesson:...)), which
  // Shopify renders as a live <a> element mixed in with the plain text
  // nodes. Rebuilding from li.textContent would silently discard that link.
  // Wording is never altered -- only regrouped under <strong>/<span>.
  var SENTENCE_BOUNDARY = /[.!?]\s+/;

  function splitGoldenRuleListItem(li) {
    var childNodes = Array.prototype.slice.call(li.childNodes);
    var titleNodes = [];
    var descriptionNodes = [];
    var splitDone = false;

    childNodes.forEach(function (node) {
      if (splitDone) {
        descriptionNodes.push(node);
        return;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        var match = SENTENCE_BOUNDARY.exec(node.data);
        if (match) {
          var splitIndex = match.index + match[0].length;
          var beforeText = node.data.slice(0, splitIndex);
          var afterText = node.data.slice(splitIndex);
          if (beforeText) titleNodes.push(document.createTextNode(beforeText));
          if (afterText) descriptionNodes.push(document.createTextNode(afterText));
          // The original node is only ever read here (.data), never moved --
          // unlike every other branch below, which reuses/relocates the
          // actual original node (and so implicitly detaches it via
          // appendChild) -- so it must be explicitly removed here, or its
          // untouched full text stays in `li` alongside the two new split
          // nodes and doubles the rendered copy.
          if (node.parentNode) node.parentNode.removeChild(node);
          splitDone = true;
          return;
        }
      }

      titleNodes.push(node);
    });

    // No sentence boundary found anywhere in the rule: it is a single
    // sentence, so it becomes the whole (bold) title with no empty
    // supporting-text element underneath it.
    if (!splitDone) descriptionNodes = [];

    var strong = document.createElement('strong');
    titleNodes.forEach(function (node) {
      strong.appendChild(node);
    });
    li.appendChild(strong);

    if (descriptionNodes.length) {
      var span = document.createElement('span');
      descriptionNodes.forEach(function (node) {
        span.appendChild(node);
      });
      li.appendChild(span);
    }
  }

  function enhanceGoldenRulesList() {
    var article = document.querySelector('.learning-lesson[data-lesson-handle="golden-rules-for-safer-snorkeling"]');
    if (!article) return;

    // Shopify's `metafield_tag` filter wraps a rich_text_field's rendered
    // output in its own `.metafield-rich_text_field` div, so the top-level
    // <ol> is a grandchild of .learning-rich-text, not a direct child.
    var list = article.querySelector('.learning-rich-text .metafield-rich_text_field > ol');
    if (!list || list.classList.contains('learning-rule-list')) return;

    list.classList.add('learning-rule-list');
    Array.prototype.forEach.call(list.children, function (li) {
      if (li.tagName === 'LI') splitGoldenRuleListItem(li);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      replaceMediaMarkers();
      groupActionChoices();
      enhanceGoldenRulesList();
    });
  } else {
    replaceMediaMarkers();
    groupActionChoices();
    enhanceGoldenRulesList();
  }
}());
