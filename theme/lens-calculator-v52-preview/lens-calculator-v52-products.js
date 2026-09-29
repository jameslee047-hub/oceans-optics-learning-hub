(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (!root) return;

  root.OOV52Products = api;
  if (root.document) {
    var mount = function () { api.mount(root.document, root.OOV52CalculatorUI); };
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", mount, { once: true });
    } else {
      mount();
    }
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var EPSILON = 1e-9;
  var SHOPIFY_CART_ADD_URL = "https://oceansoptics.com/cart/add";
  var RX_CONFIG_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  // Purchase-source attribution carried to the product page as oo_source.
  // The product-page handoff only accepts allowlisted values.
  var PURCHASE_SOURCE = "lens_calculator_v53";
  var PRIMARY_CTA_LABEL = "View Your Rx Match";
  var PRIMARY_CTA_NOTE = "Your recommended lenses will be carried over.";
  // The direct "Add Mask Only" cart submission is kept for a future restore
  // but is not rendered in the customer journey.
  var SHOW_MASK_ONLY_CTA = false;
  // Plano (0.00) keeps the mask's standard lens, so every active mask can
  // build it. An all-plano pair is routed to the standard (minus) mask
  // family: one Obsidian path (Rx Obsidian Nearsighted, the standard
  // Obsidian listing) plus Rover, Titan and Lumix. Rx Obsidian Farsighted
  // is the dedicated plus-lens listing of the same frame and is not shown
  // again for plano.
  var PLANO_PRODUCT_FAMILY = "minus";
  var PLANO_INTRO = "Your calculated underwater correction falls within the standard lens range, so you can choose from our compatible mask styles.";
  var COLOR_MAP = {
    Aqua: "#38cffa",
    Black: "#1a1a1a",
    Blue: "#005bd3",
    Clear: "#d6eaf8",
    Gold: "#d49a06",
    Pink: "#ffc0cb",
    Red: "#f61f1f",
    "Rose Pink": "#c9637a",
    Silver: "#d3d3d3",
    White: "#ffffff",
    Yellow: "#ffe500"
  };

  var CATALOG = [
    {
      id: "obsidian-nearsighted",
      name: "Rx Obsidian Nearsighted",
      quickNote: "Most balanced all-round mask, fitting a wide range of faces comfortably.",
      lensType: "minus",
      diopterMin: -1,
      diopterMax: -9,
      diopterStep: 0.5,
      defaultFrame: "Black",
      defaultSeal: "Black",
      frameColors: ["Aqua", "Black", "Blue", "Pink", "Red", "Yellow"],
      sealColors: ["Black", "Clear"],
      variantMap: [
        { frame: "Aqua", seal: "Black", url: "https://oceansoptics.com/products/the-rx-obsidian-prescription-mask-for-scuba-dive-snorkeling?variant=50963758547277", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-mask-and-snorkel-set-rx-obsidian-prescription-snorkel-dive-mask-prescription-snorkel-mask-black-medium-diopter-1-50-8-00-aqua-with-black-60219667349837.png?v=1772173654" },
        { frame: "Black", seal: "Black", url: "https://oceansoptics.com/products/the-rx-obsidian-prescription-mask-for-scuba-dive-snorkeling?variant=50148668899661", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-mask-and-snorkel-set-rx-obsidian-prescription-snorkel-dive-mask-prescription-snorkel-mask-black-medium-diopter-1-50-8-00-all-black-60219667284301.png?v=1772173654" },
        { frame: "Blue", seal: "Black", url: "https://oceansoptics.com/products/the-rx-obsidian-prescription-mask-for-scuba-dive-snorkeling?variant=51121887641933", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-mask-and-snorkel-set-rx-obsidian-prescription-snorkel-dive-mask-prescription-snorkel-mask-black-medium-diopter-1-50-8-00-blue-with-black-60219667382605.png?v=1772173654" },
        { frame: "Pink", seal: "Black", url: "https://oceansoptics.com/products/the-rx-obsidian-prescription-mask-for-scuba-dive-snorkeling?variant=50148670112077", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-mask-and-snorkel-set-rx-obsidian-prescription-snorkel-dive-mask-prescription-snorkel-mask-black-medium-diopter-1-50-8-00-pink-with-black-60219667415373.png?v=1772173654" },
        { frame: "Red", seal: "Black", url: "https://oceansoptics.com/products/the-rx-obsidian-prescription-mask-for-scuba-dive-snorkeling?variant=50148669489485", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-snorkel-dive-mask-medium-prescription-snorkel-mask-black-medium-diopter-1-50-8-00-red-with-black-1146123877.png?v=1790401444" },
        { frame: "Yellow", seal: "Black", url: "https://oceansoptics.com/products/the-rx-obsidian-prescription-mask-for-scuba-dive-snorkeling?variant=50148670734669", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-mask-and-snorkel-set-rx-obsidian-prescription-snorkel-dive-mask-prescription-snorkel-mask-black-medium-diopter-1-50-8-00-yellow-with-black-60219667448141.png?v=1772173654" },
        { frame: "Aqua", seal: "Clear", url: "https://oceansoptics.com/products/the-rx-obsidian-prescription-mask-for-scuba-dive-snorkeling?variant=52697208193357", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-diving-mask-medium-prescription-dive-mask-clear-medium-1-50-8-00-aqua-clear-1200392465.png?v=1790571202" },
        { frame: "Black", seal: "Clear", url: "https://oceansoptics.com/products/the-rx-obsidian-prescription-mask-for-scuba-dive-snorkeling?variant=52697208160589", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-diving-mask-medium-prescription-dive-mask-clear-medium-1-50-8-00-black-clear-1200392466.png?v=1790571194" },
        { frame: "Blue", seal: "Clear", url: "https://oceansoptics.com/products/the-rx-obsidian-prescription-mask-for-scuba-dive-snorkeling?variant=52697208258893", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-diving-mask-medium-prescription-dive-mask-clear-medium-1-50-8-00-blue-clear-1200392464.png?v=1790571163" },
        { frame: "Pink", seal: "Clear", url: "https://oceansoptics.com/products/the-rx-obsidian-prescription-mask-for-scuba-dive-snorkeling?variant=52697208291661", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-diving-mask-medium-prescription-dive-mask-clear-medium-1-50-8-00-pink-clear-1200392462.png?v=1790571206" },
        { frame: "Red", seal: "Clear", url: "https://oceansoptics.com/products/the-rx-obsidian-prescription-mask-for-scuba-dive-snorkeling?variant=52697208226125", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-diving-mask-medium-prescription-dive-mask-clear-medium-1-50-8-00-red-clear-1200392463.png?v=1790571183" },
        { frame: "Yellow", seal: "Clear", url: "https://oceansoptics.com/products/the-rx-obsidian-prescription-mask-for-scuba-dive-snorkeling?variant=52697208324429", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-diving-mask-medium-prescription-dive-mask-clear-medium-1-50-8-00-yellow-clear-1200392461.png?v=1790571188" }
      ]
    },
    {
      id: "obsidian-farsighted",
      name: "Rx Obsidian Farsighted",
      quickNote: "Dedicated farsighted mask for clear close-up vision underwater.",
      lensType: "plus",
      diopterMin: 1,
      diopterMax: 5,
      diopterStep: 1,
      defaultFrame: "Black",
      defaultSeal: "Black",
      frameColors: ["Aqua", "Black", "Blue", "Pink", "Red", "Yellow"],
      sealColors: ["Black", "Clear"],
      variantMap: [
        { frame: "Aqua", seal: "Black", url: "https://oceansoptics.com/products/rx-obsidian-farsighted-prescription-snorkel-scuba-dive-mask?variant=53151486443853", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-mask-and-snorkel-set-rx-obsidian-prescription-snorkel-dive-mask-prescription-snorkel-mask-black-medium-diopter-1-50-8-00-aqua-with-black-60219667349837.png?v=1772173654" },
        { frame: "Black", seal: "Black", url: "https://oceansoptics.com/products/rx-obsidian-farsighted-prescription-snorkel-scuba-dive-mask?variant=53151486476621", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-mask-and-snorkel-set-rx-obsidian-prescription-snorkel-dive-mask-prescription-snorkel-mask-black-medium-diopter-1-50-8-00-all-black-60219667284301.png?v=1772173654" },
        { frame: "Blue", seal: "Black", url: "https://oceansoptics.com/products/rx-obsidian-farsighted-prescription-snorkel-scuba-dive-mask?variant=53151486542157", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-mask-and-snorkel-set-rx-obsidian-prescription-snorkel-dive-mask-prescription-snorkel-mask-black-medium-diopter-1-50-8-00-blue-with-black-60219667382605.png?v=1772173654" },
        { frame: "Pink", seal: "Black", url: "https://oceansoptics.com/products/rx-obsidian-farsighted-prescription-snorkel-scuba-dive-mask?variant=53151486509389", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-mask-and-snorkel-set-rx-obsidian-prescription-snorkel-dive-mask-prescription-snorkel-mask-black-medium-diopter-1-50-8-00-pink-with-black-60219667415373.png?v=1772173654" },
        { frame: "Red", seal: "Black", url: "https://oceansoptics.com/products/rx-obsidian-farsighted-prescription-snorkel-scuba-dive-mask?variant=53151486574925", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-snorkel-dive-mask-medium-prescription-snorkel-mask-black-medium-diopter-1-50-8-00-red-with-black-1146123877.png?v=1790401444" },
        { frame: "Yellow", seal: "Black", url: "https://oceansoptics.com/products/rx-obsidian-farsighted-prescription-snorkel-scuba-dive-mask?variant=53151486607693", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-mask-and-snorkel-set-rx-obsidian-prescription-snorkel-dive-mask-prescription-snorkel-mask-black-medium-diopter-1-50-8-00-yellow-with-black-60219667448141.png?v=1772173654" },
        { frame: "Aqua", seal: "Clear", url: "https://oceansoptics.com/products/rx-obsidian-farsighted-prescription-snorkel-scuba-dive-mask?variant=53151486640461", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-diving-mask-medium-prescription-dive-mask-clear-medium-1-50-8-00-aqua-clear-1200392465.png?v=1790571202" },
        { frame: "Black", seal: "Clear", url: "https://oceansoptics.com/products/rx-obsidian-farsighted-prescription-snorkel-scuba-dive-mask?variant=53151486673229", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-diving-mask-medium-prescription-dive-mask-clear-medium-1-50-8-00-black-clear-1200392466.png?v=1790571194" },
        { frame: "Blue", seal: "Clear", url: "https://oceansoptics.com/products/rx-obsidian-farsighted-prescription-snorkel-scuba-dive-mask?variant=53151486738765", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-diving-mask-medium-prescription-dive-mask-clear-medium-1-50-8-00-blue-clear-1200392464.png?v=1790571163" },
        { frame: "Pink", seal: "Clear", url: "https://oceansoptics.com/products/rx-obsidian-farsighted-prescription-snorkel-scuba-dive-mask?variant=53151486705997", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-diving-mask-medium-prescription-dive-mask-clear-medium-1-50-8-00-pink-clear-1200392462.png?v=1790571206" },
        { frame: "Red", seal: "Clear", url: "https://oceansoptics.com/products/rx-obsidian-farsighted-prescription-snorkel-scuba-dive-mask?variant=53151486804301", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-diving-mask-medium-prescription-dive-mask-clear-medium-1-50-8-00-red-clear-1200392463.png?v=1790571183" },
        { frame: "Yellow", seal: "Clear", url: "https://oceansoptics.com/products/rx-obsidian-farsighted-prescription-snorkel-scuba-dive-mask?variant=53151486771533", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-obsidian-prescription-diving-mask-medium-prescription-dive-mask-clear-medium-1-50-8-00-yellow-clear-1200392461.png?v=1790571188" }
      ]
    },
    {
      id: "rover",
      name: "Rx Rover",
      quickNote: "Low volume feel and secure seal, popular with freedivers and smaller profiles.",
      lensType: "minus",
      diopterMin: -1.5,
      diopterMax: -6,
      diopterStep: 0.5,
      defaultFrame: "Black",
      defaultSeal: "Black",
      frameColors: ["Black", "Blue", "Pink", "White", "Yellow"],
      sealColors: ["Black", "White"],
      variantMap: [
        { frame: "Black", seal: "Black", url: "https://oceansoptics.com/products/rx-rover-nearsighted-prescription-freediving-scuba-dive-mask?variant=50139438973261", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-rover-low-volume-prescription-snorkel-dive-mask-prescription-snorkel-mask-black-small-1-50-6-00-60219480539469.png?v=1740542314" },
        { frame: "Blue", seal: "Black", url: "https://oceansoptics.com/products/rx-rover-nearsighted-prescription-freediving-scuba-dive-mask?variant=50139439726925", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-rover-low-volume-prescription-snorkel-dive-mask-prescription-snorkel-mask-black-small-1-50-6-00-60219480277325.png?v=1740542314" },
        { frame: "Pink", seal: "Black", url: "https://oceansoptics.com/products/rx-rover-nearsighted-prescription-freediving-scuba-dive-mask?variant=50139440480589", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-rover-low-volume-prescription-snorkel-dive-mask-prescription-snorkel-mask-black-small-1-50-6-00-60219480375629.png?v=1740542314" },
        { frame: "White", seal: "Black", url: "https://oceansoptics.com/products/rx-rover-nearsighted-prescription-freediving-scuba-dive-mask?variant=50139439333709", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-rover-low-volume-prescription-snorkel-dive-mask-prescription-snorkel-mask-black-small-1-50-6-00-60219480408397.png?v=1740542314" },
        { frame: "Yellow", seal: "Black", url: "https://oceansoptics.com/products/rx-rover-nearsighted-prescription-freediving-scuba-dive-mask?variant=50139440087373", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-rover-low-volume-prescription-snorkel-dive-mask-prescription-snorkel-mask-black-small-1-50-6-00-60219480441165.png?v=1758777238" },
        { frame: "Black", seal: "White", url: "https://oceansoptics.com/products/white-rx-rover-nearsighted-prescription-dive-mask?variant=50144516079949", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-new-rx-rover-nearsighted-prescription-freediving-mask-with-snorkel-case-black-white-1-5-left-1-5-right-59341836747085.png?v=1738036258" },
        { frame: "Blue", seal: "White", url: "https://oceansoptics.com/products/white-rx-rover-nearsighted-prescription-dive-mask?variant=50144515359053", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-new-rx-rover-nearsighted-prescription-freediving-mask-with-snorkel-case-59341836943693.png?v=1758778499" },
        { frame: "Pink", seal: "White", url: "https://oceansoptics.com/products/white-rx-rover-nearsighted-prescription-dive-mask?variant=50144516800845", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-new-rx-rover-nearsighted-prescription-freediving-mask-with-snorkel-case-pink-white-1-5-left-1-5-right-59341836976461.png?v=1738036258" },
        { frame: "White", seal: "White", url: "https://oceansoptics.com/products/white-rx-rover-nearsighted-prescription-dive-mask?variant=50144515719501", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-new-rx-rover-nearsighted-prescription-freediving-mask-with-snorkel-case-all-white-1-5-left-1-5-right-59341836681549.png?v=1738036258" },
        { frame: "Yellow", seal: "White", url: "https://oceansoptics.com/products/white-rx-rover-nearsighted-prescription-dive-mask?variant=50144516440397", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-new-rx-rover-nearsighted-prescription-freediving-mask-with-snorkel-case-yellow-white-1-5-left-1-5-right-59341836714317.png?v=1738036258" }
      ]
    },
    {
      id: "titan",
      name: "Rx Titan",
      quickNote: "Roomier large fit with a wider nose pocket, ideal for medium to large faces.",
      lensType: "minus",
      allowsDifferentEyes: true,
      diopterMin: -1.5,
      diopterMax: -6,
      diopterStep: 0.5,
      defaultFrame: "Blue",
      defaultSeal: "Black",
      frameColors: ["Black", "Blue", "Pink", "Red", "Yellow"],
      sealColors: ["Black", "Clear"],
      variantMap: [
        { frame: "Black", seal: "Black", url: "https://oceansoptics.com/products/the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask?variant=54202866336077", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask-the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask-black-black-1247345221.png?v=1783163293" },
        { frame: "Black", seal: "Clear", url: "https://oceansoptics.com/products/the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask?variant=54202866499917", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask-the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask-black-clear-1248014644.png?v=1783422911" },
        { frame: "Blue", seal: "Black", url: "https://oceansoptics.com/products/the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask?variant=54202866401613", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask-the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask-blue-black-1247345227.png?v=1783163653" },
        { frame: "Blue", seal: "Clear", url: "https://oceansoptics.com/products/the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask?variant=54202866565453", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask-the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask-blue-clear-1248014643.png?v=1783476836" },
        { frame: "Pink", seal: "Black", url: "https://oceansoptics.com/products/the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask?variant=54202866434381", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask-the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask-pink-black-1247345219.png?v=1783163173" },
        { frame: "Pink", seal: "Clear", url: "https://oceansoptics.com/products/the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask?variant=54202866598221", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask-the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask-pink-clear-1248014642.png?v=1783422795" },
        { frame: "Red", seal: "Black", url: "https://oceansoptics.com/products/the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask?variant=54202866467149", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask-the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask-red-black-1247345228.png?v=1783163710" },
        { frame: "Red", seal: "Clear", url: "https://oceansoptics.com/products/the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask?variant=54203206041933", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask-the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask-red-clear-1248014641.png?v=1783422733" },
        { frame: "Yellow", seal: "Black", url: "https://oceansoptics.com/products/the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask?variant=54202866368845", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask-the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask-yellow-black-1247345220.png?v=1783163231" },
        { frame: "Yellow", seal: "Clear", url: "https://oceansoptics.com/products/the-rx-titan-prescription-snorkel-and-scuba-diving-corrective-mask?variant=54202866532685", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/Rx_Titan_Prescription_Snorkel_Scub_Diving_Corrective_Mask_Yellow_Clear.png?v=1783418895" }
      ]
    },
    {
      id: "lumix",
      name: "Rx Lumix",
      quickNote: "Aluminium frame with a forgiving seal that adapts well to many face shapes.",
      lensType: "minus",
      diopterMin: -1.5,
      diopterMax: -6,
      diopterStep: 0.5,
      defaultFrame: "Black",
      defaultSeal: "Black",
      frameColors: ["Aqua", "Black", "Gold", "Rose Pink", "Silver"],
      sealColors: ["Black", "White"],
      variantMap: [
        { frame: "Aqua", seal: "Black", url: "https://oceansoptics.com/products/professional-apollo-like-corrective-scuba-goggles-diving-aluminium-rx-optical-dive-mask-with-diopter-strength-from-1-5-to-6-0?variant=50070250946893", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-lumix-prescription-scuba-dive-mask-aluminum-rx-lumix-prescription-scuba-dive-mask-aluminum-blue-black-1211959643.png?v=1766129013" },
        { frame: "Black", seal: "Black", url: "https://oceansoptics.com/products/professional-apollo-like-corrective-scuba-goggles-diving-aluminium-rx-optical-dive-mask-with-diopter-strength-from-1-5-to-6-0?variant=50461180199245", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-lumix-prescription-scuba-dive-mask-aluminum-rx-lumix-prescription-scuba-dive-mask-aluminum-black-black-1211959645.png?v=1766128771" },
        { frame: "Gold", seal: "Black", url: "https://oceansoptics.com/products/professional-apollo-like-corrective-scuba-goggles-diving-aluminium-rx-optical-dive-mask-with-diopter-strength-from-1-5-to-6-0?variant=50461180264781", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-lumix-prescription-scuba-dive-mask-aluminum-rx-lumix-prescription-scuba-dive-mask-aluminum-gold-black-1211959644.png?v=1766129612" },
        { frame: "Rose Pink", seal: "Black", url: "https://oceansoptics.com/products/professional-apollo-like-corrective-scuba-goggles-diving-aluminium-rx-optical-dive-mask-with-diopter-strength-from-1-5-to-6-0?variant=50461180297549", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-lumix-prescription-scuba-dive-mask-aluminum-rx-lumix-prescription-scuba-dive-mask-aluminum-rose-pink-black-1211959641.png?v=1766129251" },
        { frame: "Silver", seal: "Black", url: "https://oceansoptics.com/products/professional-apollo-like-corrective-scuba-goggles-diving-aluminium-rx-optical-dive-mask-with-diopter-strength-from-1-5-to-6-0?variant=50461180232013", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-lumix-prescription-scuba-dive-mask-aluminum-rx-lumix-prescription-scuba-dive-mask-aluminum-silver-black-1211959642.png?v=1766128652" },
        { frame: "Aqua", seal: "White", url: "https://oceansoptics.com/products/rx-lumix-optical-dive-mask-aluminum-white-series?variant=50461311336781", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-lumix-prescription-snorkel-dive-mask-aluminum-white-rx-lumix-prescription-snorkel-dive-mask-aluminum-white-blue-white-aluminum-1211959654.png?v=1766129131" },
        { frame: "Black", seal: "White", url: "https://oceansoptics.com/products/rx-lumix-optical-dive-mask-aluminum-white-series?variant=50461311369549", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-lumix-prescription-snorkel-dive-mask-aluminum-white-rx-lumix-prescription-snorkel-dive-mask-aluminum-white-black-white-1211959656.png?v=1766129371" },
        { frame: "Gold", seal: "White", url: "https://oceansoptics.com/products/rx-lumix-optical-dive-mask-aluminum-white-series?variant=50461311435085", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-lumix-prescription-snorkel-dive-mask-aluminum-white-rx-lumix-prescription-snorkel-dive-mask-aluminum-white-gold-white-1211959657.png?v=1766129730" },
        { frame: "Rose Pink", seal: "White", url: "https://oceansoptics.com/products/rx-lumix-optical-dive-mask-aluminum-white-series?variant=50461311467853", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-lumix-prescription-snorkel-dive-mask-aluminum-white-rx-lumix-prescription-snorkel-dive-mask-aluminum-white-rose-pink-1211959655.png?v=1766129491" },
        { frame: "Silver", seal: "White", url: "https://oceansoptics.com/products/rx-lumix-optical-dive-mask-aluminum-white-series?variant=50461311402317", img: "https://cdn.shopify.com/s/files/1/0798/8055/2781/files/prescription-dive-mask-rx-lumix-prescription-snorkel-dive-mask-aluminum-white-rx-lumix-prescription-snorkel-dive-mask-aluminum-white-silver-white-1211959652.png?v=1766128892" }
      ]
    }
  ];

  function finitePower(value) {
    var power = Number(value);
    return Number.isFinite(power) ? power : null;
  }

  function formatPower(value) {
    var power = finitePower(value);
    if (power === null) return "--";
    if (Math.abs(power) < EPSILON) return "0.00";
    return (power > 0 ? "+" : "-") + Math.abs(power).toFixed(2);
  }

  function formatLensLabel(value) {
    var power = finitePower(value);
    if (power !== null && Math.abs(power) < EPSILON) return "Plano (0.00)";
    return formatPower(value);
  }

  function powerType(power) {
    if (Math.abs(power) < EPSILON) return "zero";
    return power < 0 ? "minus" : "plus";
  }

  function supportsPower(product, power) {
    var numeric = finitePower(power);
    if (numeric === null) return false;
    if (Math.abs(numeric) < EPSILON) return true;
    if (powerType(numeric) !== product.lensType) return false;

    var magnitude = Math.abs(numeric);
    var low = Math.min(Math.abs(product.diopterMin), Math.abs(product.diopterMax));
    var high = Math.max(Math.abs(product.diopterMin), Math.abs(product.diopterMax));
    if (magnitude < low - EPSILON || magnitude > high + EPSILON) return false;
    return Math.abs((magnitude - low) / product.diopterStep - Math.round((magnitude - low) / product.diopterStep)) < EPSILON;
  }

  function findCompatibleProducts(recommendedRight, recommendedLeft) {
    var right = finitePower(recommendedRight);
    var left = finitePower(recommendedLeft);
    if (right === null || left === null) return { type: "invalid", products: [] };

    var rightType = powerType(right);
    var leftType = powerType(left);
    if (rightType !== "zero" && leftType !== "zero" && rightType !== leftType) {
      return { type: "mixed", products: [] };
    }

    var effectiveType = rightType !== "zero" ? rightType : leftType;
    if (effectiveType === "zero") {
      return {
        type: "plano",
        products: CATALOG.filter(function (product) { return product.lensType === PLANO_PRODUCT_FAMILY; })
      };
    }
    var products = CATALOG.filter(function (product) {
      if (product.lensType !== effectiveType) return false;
      return supportsPower(product, right) && supportsPower(product, left);
    });
    return { type: effectiveType, products: products };
  }

  function element(doc, tagName, className, text) {
    var node = doc.createElement(tagName);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function findVariant(product, frame, seal) {
    return product.variantMap.find(function (variant) {
      return variant.frame === frame && variant.seal === seal;
    }) || null;
  }

  function defaultVariant(product) {
    return findVariant(product, product.defaultFrame, product.defaultSeal) || product.variantMap[0] || null;
  }

  function selectVariant(product, current, field, value) {
    var frame = field === "frame" ? value : current.frame;
    var seal = field === "seal" ? value : current.seal;
    var exact = findVariant(product, frame, seal);
    if (exact) return exact;
    return product.variantMap.find(function (variant) {
      return variant[field] === value;
    }) || current;
  }

  function isOptionAvailable(product, selection, field, value) {
    return product.variantMap.some(function (variant) {
      if (field === "frame") return variant.frame === value && variant.seal === selection.seal;
      return variant.seal === value && variant.frame === selection.frame;
    });
  }

  function appendSwatches(doc, parent, label, colors, field, product, selection, onSelect) {
    var row = element(doc, "div", "oo-v52-products__swatch-row");
    row.appendChild(element(doc, "span", "oo-v52-products__swatch-label", label));
    var swatches = element(doc, "span", "oo-v52-products__swatches");
    colors.forEach(function (color) {
      var swatch = element(doc, "button", "oo-v52-products__swatch");
      swatch.type = "button";
      swatch.style.backgroundColor = COLOR_MAP[color] || "#ffffff";
      swatch.title = label + ": " + color;
      swatch.setAttribute("aria-label", "Choose " + color + " " + label.toLowerCase());
      swatch.setAttribute("aria-pressed", String(selection[field] === color));
      swatch.classList.toggle("is-active", selection[field] === color);
      swatch.disabled = !isOptionAvailable(product, selection, field, color);
      swatch.addEventListener("click", function () { onSelect(field, color); });
      swatches.appendChild(swatch);
    });
    row.appendChild(swatches);
    parent.appendChild(row);
  }

  function lensRange(product) {
    if (product.lensType === "plus") {
      return "+" + product.diopterMin.toFixed(2) + " to +" + product.diopterMax.toFixed(2);
    }
    return product.diopterMin.toFixed(2) + " to " + product.diopterMax.toFixed(2);
  }

  function shopifyVariantId(variantUrl) {
    try {
      return new URL(variantUrl).searchParams.get("variant");
    } catch (error) {
      return null;
    }
  }

  function isConfirmedDurableProfile(profile) {
    return Boolean(
      profile && profile.status === "ready" &&
      RX_CONFIG_ID_PATTERN.test(String(profile.configId || "").trim())
    );
  }

  function buildProductDetailsUrl(variantUrl, configId, source) {
    var url = new URL(variantUrl);
    if (RX_CONFIG_ID_PATTERN.test(String(configId || "").trim())) {
      url.searchParams.set("oo_rx", String(configId).trim().toLowerCase());
      if (source === PURCHASE_SOURCE) url.searchParams.set("oo_source", source);
    }
    return url.toString();
  }

  function resolveCommerceVariant(profile, product, variant) {
    if (!isConfirmedDurableProfile(profile)) {
      throw new Error("Save this prescription before continuing to Shopify.");
    }

    var selected = product && variant
      ? findVariant(product, variant.frame, variant.seal)
      : null;
    var variantId = selected && shopifyVariantId(selected.url);
    if (!selected || !/^\d+$/.test(String(variantId || ""))) {
      throw new Error("Choose an available frame and seal colour before continuing.");
    }
    if (
      !supportsPower(product, profile.recommendedRight) ||
      !supportsPower(product, profile.recommendedLeft)
    ) {
      throw new Error("This mask is not available with both suggested lens strengths.");
    }

    return { variant: selected, variantId: variantId };
  }

  function prepareProductPageUrl(profile, product, variant) {
    var commerce = resolveCommerceVariant(profile, product, variant);
    return buildProductDetailsUrl(commerce.variant.url, profile.configId, PURCHASE_SOURCE);
  }

  function prepareCartSubmission(profile, product, variant) {
    var commerce = resolveCommerceVariant(profile, product, variant);

    var fields = {
      id: commerce.variantId,
      quantity: "1",
      return_to: "/cart",
      "properties[(OD) Right]": formatPower(profile.recommendedRight),
      "properties[(OS) Left]": formatPower(profile.recommendedLeft),
      "properties[_oo_rx_config]": String(profile.configId).trim().toLowerCase(),
      "properties[_oo_source]": PURCHASE_SOURCE,
      "properties[_has_apo]": "true"
    };
    var label = typeof profile.label === "string" ? profile.label.trim() : "";
    if (label) fields["properties[Prescription]"] = label;

    return {
      action: SHOPIFY_CART_ADD_URL,
      method: "post",
      fields: fields
    };
  }

  function submitCartForm(doc, submission, target) {
    var form = doc.createElement("form");
    form.action = submission.action;
    form.method = submission.method;
    form.hidden = true;
    if (target) form.target = target;
    Object.keys(submission.fields).forEach(function (name) {
      var input = doc.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = submission.fields[name];
      form.appendChild(input);
    });
    doc.body.appendChild(form);
    form.submit();
    return form;
  }

  function openNewContext(browserWindow, url) {
    if (!browserWindow || typeof browserWindow.open !== "function") {
      throw new Error("Your browser could not open Shopify. Please allow pop-ups and try again.");
    }
    var opened = browserWindow.open(url, "_blank");
    if (!opened) {
      throw new Error("Your browser blocked the Shopify window. Please allow pop-ups and try again.");
    }
    try { opened.opener = null; } catch (error) { /* Browser controlled. */ }
    try { opened.focus(); } catch (error) { /* Browser controlled. */ }
    return opened;
  }

  function submitCartInNewContext(browserWindow, doc, submission) {
    var opened = openNewContext(browserWindow, "");
    var target = "oo-v52-cart-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    try {
      opened.name = target;
      var form = submitCartForm(doc, submission, target);
      try { opened.focus(); } catch (error) { /* Browser controlled. */ }
      return { window: opened, form: form, target: target };
    } catch (error) {
      try { opened.close(); } catch (closeError) { /* Browser controlled. */ }
      throw error;
    }
  }

  function createSubmissionGuard(task) {
    var submitting = false;
    return function () {
      if (submitting) return false;
      submitting = true;
      try {
        task();
        return true;
      } catch (error) {
        submitting = false;
        throw error;
      }
    };
  }

  function preparedCommerceState(profile, product, variant) {
    return {
      configId: profile.configId,
      prescriptionLabel: profile.label,
      prescriptionDisplayLabel: profile.displayLabel,
      recommendedRight: profile.recommendedRight,
      recommendedLeft: profile.recommendedLeft,
      recommendationStrategy: profile.recommendationStrategy,
      productKey: product.id,
      selectedFrame: variant.frame,
      selectedSeal: variant.seal,
      shopifyVariantId: shopifyVariantId(variant.url),
      selectedVariantUrl: variant.url
    };
  }

  function renderProductCard(doc, product, profile, selection, onSelectionChange) {
    var card = element(doc, "article", "oo-v52-product-card");
    card.dataset.productId = product.id;

    var image = element(doc, "img", "oo-v52-product-card__image");
    image.src = selection.img;
    image.alt = product.name + " in " + selection.frame + " with " + selection.seal + " seal";
    image.loading = "lazy";
    image.width = 420;
    image.height = 320;
    card.appendChild(image);

    var body = element(doc, "div", "oo-v52-product-card__body");
    var heading = element(doc, "div", "oo-v52-product-card__heading");
    heading.appendChild(element(doc, "h3", "", product.name));
    heading.appendChild(element(doc, "span", "oo-v52-product-card__match", "Compatible"));
    body.appendChild(heading);

    body.appendChild(element(doc, "p", "oo-v52-product-card__suggested-label", "Your suggested lenses"));
    var pair = element(doc, "p", "oo-v52-product-card__pair");
    pair.setAttribute("aria-label", "Suggested lenses: right " + formatLensLabel(profile.recommendedRight) + ", left " + formatLensLabel(profile.recommendedLeft));
    pair.appendChild(element(doc, "span", "", "R " + formatLensLabel(profile.recommendedRight)));
    pair.appendChild(element(doc, "span", "", "L " + formatLensLabel(profile.recommendedLeft)));
    body.appendChild(pair);
    body.appendChild(element(doc, "p", "oo-v52-product-card__note", product.quickNote));
    body.appendChild(element(doc, "p", "oo-v52-product-card__range", "Available lenses: " + lensRange(product)));

    var colors = element(doc, "div", "oo-v52-product-card__colors");
    appendSwatches(doc, colors, "Frame", product.frameColors, "frame", product, selection, onSelectionChange);
    appendSwatches(doc, colors, "Seal", product.sealColors, "seal", product, selection, onSelectionChange);
    body.appendChild(colors);

    var actions = element(doc, "div", "oo-v52-product-card__actions");
    var status = element(doc, "p", "oo-v52-product-card__commerce-status");
    status.setAttribute("aria-live", "polite");
    var customizeButton = element(doc, "button", "oo-v52-product-card__customize", PRIMARY_CTA_LABEL);
    customizeButton.type = "button";
    var cartReady = isConfirmedDurableProfile(profile);
    customizeButton.disabled = !cartReady;
    status.hidden = cartReady;
    if (!cartReady) {
      status.textContent = "Save this prescription before adding a mask to your cart.";
    }

    var customizeOnce = createSubmissionGuard(function () {
      var destination = prepareProductPageUrl(profile, product, selection);
      openNewContext(doc.defaultView, destination);
      customizeButton.disabled = true;
      customizeButton.textContent = "Opened in Shopify";
      status.hidden = true;
    });
    customizeButton.addEventListener("click", function () {
      try {
        customizeOnce();
      } catch (error) {
        customizeButton.disabled = !isConfirmedDurableProfile(profile);
        customizeButton.textContent = PRIMARY_CTA_LABEL;
        status.textContent = error && error.message
          ? error.message
          : "We couldn't open Shopify. Please check your selection and try again.";
        status.hidden = false;
      }
    });

    var addButton = SHOW_MASK_ONLY_CTA ? renderMaskOnlyButton(doc, profile, product, selection, status) : null;

    actions.appendChild(customizeButton);
    if (addButton) actions.appendChild(addButton);
    body.appendChild(actions);
    if (cartReady) body.appendChild(element(doc, "p", "oo-v52-product-card__carry-note", PRIMARY_CTA_NOTE));
    body.appendChild(status);
    card.appendChild(body);
    return card;
  }

  function renderMaskOnlyButton(doc, profile, product, selection, status) {
    var addButton = element(doc, "button", "oo-v52-product-card__cart", "Add Mask Only");
    addButton.type = "button";
    addButton.disabled = !isConfirmedDurableProfile(profile);
    var submitOnce = createSubmissionGuard(function () {
      addButton.disabled = true;
      addButton.textContent = "Opening cart...";
      status.hidden = true;
      submitCartInNewContext(
        doc.defaultView,
        doc,
        prepareCartSubmission(profile, product, selection)
      );
      addButton.textContent = "Cart opened";
    });
    addButton.addEventListener("click", function () {
      try {
        submitOnce();
      } catch (error) {
        addButton.disabled = !isConfirmedDurableProfile(profile);
        addButton.textContent = "Add Mask Only";
        status.textContent = error && error.message
          ? error.message
          : "We couldn't prepare this mask. Please check your selection and try again.";
        status.hidden = false;
      }
    });
    return addButton;
  }

  function mount(doc, calculatorUi) {
    var section = doc.getElementById("oo-v52-products");
    if (!section || !calculatorUi || typeof calculatorUi.getActivePrescription !== "function") return null;
    var heading = doc.getElementById("oo-v52-products-title");
    var switcher = doc.getElementById("oo-v52-products-switcher");
    var grid = doc.getElementById("oo-v52-products-grid");
    var empty = doc.getElementById("oo-v52-products-empty");
    var benefits = doc.getElementById("oo-v52-benefits");
    var intro = typeof section.querySelector === "function" ? section.querySelector(".oo-v52-products__intro") : null;
    var defaultIntro = intro ? intro.textContent : "";
    var selections = {};

    CATALOG.forEach(function (product) {
      selections[product.id] = defaultVariant(product);
    });

    function renderSwitcher(profiles, active) {
      switcher.innerHTML = "";
      switcher.hidden = profiles.length < 2;
      if (profiles.length < 2) return;
      switcher.appendChild(element(doc, "span", "oo-v52-products__switch-label", "View mask matches for:"));
      var controls = element(doc, "span", "oo-v52-products__switch-controls");
      profiles.forEach(function (profile) {
        var button = element(doc, "button", "oo-v52-products__switch", profile.displayLabel);
        button.type = "button";
        button.dataset.profileId = profile.localId;
        button.setAttribute("aria-pressed", String(Boolean(active && active.localId === profile.localId)));
        button.addEventListener("click", function () { calculatorUi.setActivePrescription(profile.localId); });
        controls.appendChild(button);
      });
      switcher.appendChild(controls);
    }

    function render() {
      var active = calculatorUi.getActivePrescription();
      var profiles = calculatorUi.getPrescriptionProfiles();
      if (!active) {
        section.hidden = true;
        if (benefits) benefits.hidden = true;
        return;
      }

      section.hidden = false;
      if (benefits) benefits.hidden = false;
      heading.textContent = "Recommended masks for " + active.displayLabel;
      renderSwitcher(profiles, active);
      grid.innerHTML = "";
      var result = findCompatibleProducts(active.recommendedRight, active.recommendedLeft);
      if (intro) intro.textContent = result.type === "plano" ? PLANO_INTRO : defaultIntro;
      empty.hidden = result.products.length > 0;
      if (result.type === "mixed") {
        empty.textContent = "This lens pair mixes nearsighted and farsighted powers. Please contact us so we can check the available options with you.";
      } else if (!result.products.length) {
        empty.textContent = "We could not find an active mask with both selected lens strengths. Please contact us for help with the available options.";
      }
      result.products.forEach(function (product) {
        var selection = selections[product.id] || defaultVariant(product);
        grid.appendChild(renderProductCard(doc, product, active, selection, function (field, value) {
          selections[product.id] = selectVariant(product, selection, field, value);
          render();
        }));
      });
    }

    doc.addEventListener("oo:v52:prescription-changed", render);
    doc.addEventListener("oo:v52:calculation-stale", function () {
      section.hidden = true;
      grid.innerHTML = "";
      if (benefits) benefits.hidden = true;
    });
    render();
    return {
      render: render,
      getPreparedCommerceState: function () {
        var active = calculatorUi.getActivePrescription();
        if (!active) return [];
        return findCompatibleProducts(active.recommendedRight, active.recommendedLeft).products.map(function (product) {
          return preparedCommerceState(active, product, selections[product.id] || defaultVariant(product));
        });
      }
    };
  }

  return {
    CATALOG: CATALOG,
    PURCHASE_SOURCE: PURCHASE_SOURCE,
    PRIMARY_CTA_LABEL: PRIMARY_CTA_LABEL,
    PRIMARY_CTA_NOTE: PRIMARY_CTA_NOTE,
    SHOW_MASK_ONLY_CTA: SHOW_MASK_ONLY_CTA,
    formatPower: formatPower,
    formatLensLabel: formatLensLabel,
    PLANO_INTRO: PLANO_INTRO,
    supportsPower: supportsPower,
    findCompatibleProducts: findCompatibleProducts,
    findVariant: findVariant,
    defaultVariant: defaultVariant,
    selectVariant: selectVariant,
    preparedCommerceState: preparedCommerceState,
    isConfirmedDurableProfile: isConfirmedDurableProfile,
    buildProductDetailsUrl: buildProductDetailsUrl,
    prepareProductPageUrl: prepareProductPageUrl,
    prepareCartSubmission: prepareCartSubmission,
    submitCartForm: submitCartForm,
    openNewContext: openNewContext,
    submitCartInNewContext: submitCartInNewContext,
    createSubmissionGuard: createSubmissionGuard,
    mount: mount
  };
});
