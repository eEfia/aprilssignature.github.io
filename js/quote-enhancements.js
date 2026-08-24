(function () {
"use strict";

const STREETWEAR_STRUCTURE = [
  {heading:"Tops", items:["Jersey","T-shirt","Polo shirt","Hoodies","Ladies tank top","Men's tank top","Sweatshirt","Varsity jacket"]},
  {heading:"Bottoms", subgroups:[
    {heading:"Joggers", items:["Super thick cotton joggers","Everyday wear joggers"]},
    {heading:null, items:["Jogger shorts","Sweatpants","Cargo pants","Cargo skirts","Jorts"]}
  ]},
  {heading:"Sets", items:["T-shirt and shorts set","T-shirt and sweatpants set","Sweatshirt and shorts set","Sweatshirt and sweatpants set"]}
];

const LADIES_STRUCTURE = [
  {heading:"Dresses and Gowns", items:[
    "Short gown / dress","Long gown / dress","Corset dress (short)","Corset dress (long)","Bubu","Kaftan","Bubu kaftan"
  ]},
  {heading:"Tops and Blouses", items:["Top / blouse","Corset top","Base corset"]},
  {heading:"Bottoms", items:["Trousers","Palazzo pants","Palazzo shorts","Wrap shorts"]},
  {heading:"Two-piece Outfits", items:[
    "Trousers and short top","Trousers and long top","Skirt and short top","Skirt and long top"
  ]},
  {heading:"Kaba and Slit / Skirts", items:[
    "Standard kaba and slit / skirts","Kaba and slit / skirts (corset)","Kaba and slit / skirts (kente)"
  ]}
];

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
    return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
  });
}
function slug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
}
function normal(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g," ");
}
function canonicalize(name) {
  const n = normal(name);
  const map = {
    "jerseys":"Jersey","t-shirts":"T-shirt","polo shirts":"Polo shirt","hoodies":"Hoodies",
    "ladies tank tops":"Ladies tank top","men's tank tops":"Men's tank top",
    "sweatshirts":"Sweatshirt","varsity jackets":"Varsity jacket",
    "joggers — super thick cotton joggers":"Super thick cotton joggers",
    "joggers - super thick cotton joggers":"Super thick cotton joggers",
    "super thick cutting joggers":"Super thick cotton joggers",
    "everyday wear type":"Everyday wear joggers","joggers — everyday wear type":"Everyday wear joggers",
    "joggers - everyday wear type":"Everyday wear joggers","jogger shorts":"Jogger shorts",
    "cargo pants":"Cargo pants","cargo skirts":"Cargo skirts","sweatpants":"Sweatpants","jorts":"Jorts",
    "t-shirts & shorts set":"T-shirt and shorts set","t-shirt & shorts set":"T-shirt and shorts set",
    "t-shirt & sweatpants set":"T-shirt and sweatpants set","sweatshirt & shorts set":"Sweatshirt and shorts set",
    "sweatshirts & shorts set":"Sweatshirt and shorts set","sweatshirt & sweatpants set":"Sweatshirt and sweatpants set",
    "sweatshirts & sweatpants set":"Sweatshirt and sweatpants set"
  };
  return map[n] || String(name || "").trim();
}

async function getProducts() {
  if (!window.db) return [];
  try {
    const result = await db.from("settings").select("id,setting_key,setting_value,created_at,updated_at").like("setting_key","product_%");
    if (result.error) throw result.error;
    return (result.data || []).map(row => {
      let item = {};
      try { item = JSON.parse(row.setting_value || "{}"); } catch (_) {}
      return {...item, id:row.id, setting_key:row.setting_key, created_at:row.created_at, updated_at:row.updated_at};
    }).filter(x => x.name && x.active !== false);
  } catch (_) {
    return [];
  }
}

function findProduct(products, name) {
  const wanted = normal(name);
  const aliases = products.filter(p => {
    const n = normal(p.name);
    return n === wanted || normal(canonicalize(n)) === wanted || normal(canonicalize(n)) === normal(canonicalize(name));
  });
  return aliases.sort((a,b) => Number(a.display_order || 9999) - Number(b.display_order || 9999))[0] || {name:name, active:true};
}

function inputFor(product, prefix, index, attrs) {
  const label = product.name || "";
  const id = prefix + "_" + slug(label) + "_" + index;
  return '<div class="quote-product-row">' +
    '<div class="quote-product-name">' + esc(label) + '</div>' +
    '<label class="quote-product-qty" for="' + esc(id) + '">Quantity' +
    '<input id="' + esc(id) + '" type="number" min="0" step="1" value="0" name="' + esc(prefix + "_" + slug(label) + "_" + index) + '" data-' + attrs + '="true" data-product-name="' + esc(label) + '">' +
    '</label></div>';
}

function renderStructure(container, structure, products, prefix, dataAttr) {
  let html = "";
  const canonicalNames = new Set(structure.flatMap(section => section.subgroups ? section.subgroups.flatMap(g => g.items) : section.items).map(normal));
  structure.forEach(section => {
    html += '<div class="quote-product-group"><h3>' + esc(section.heading) + '</h3>';
    if (section.subgroups) {
      section.subgroups.forEach(group => {
        if (group.heading) html += '<h4>' + esc(group.heading) + '</h4>';
        group.items.forEach(name => {
          const p = findProduct(products,name);
          html += inputFor(p,prefix,Math.random().toString(36).slice(2,7),dataAttr);
        });
      });
    } else {
      section.items.forEach(name => {
        const p = findProduct(products,name);
        html += inputFor(p,prefix,Math.random().toString(36).slice(2,7),dataAttr);
      });
    }
    html += '</div>';
  });
  const blocked = new Set(["hoodies and joggers","hoodies & joggers set","hoodies and joggers set"]);
  const extras = products.filter(p => !canonicalNames.has(normal(canonicalize(p.name))) && !blocked.has(normal(p.name)));
  if (extras.length) {
    html += '<div class="quote-product-group"><h3>Additional Options</h3>';
    extras.sort((a,b) => Number(a.display_order || 9999) - Number(b.display_order || 9999)).forEach((p,i) => {
      html += inputFor(p,prefix,i + "_extra",dataAttr);
    });
    html += '</div>';
  }
  html += '<div class="quote-product-group"><h3>Others</h3>' +
    '<div class="form-group"><label for="' + prefix + 'Other">Specify your request</label><textarea id="' + prefix + 'Other" name="' + prefix + 'Other" placeholder="Specify what you need."></textarea></div>' +
    '<div class="form-grid"><div class="form-group"><label>Size / Measurements</label><textarea id="' + prefix + 'OtherSize" name="' + prefix + 'OtherSize" placeholder="Enter size or measurements."></textarea></div>' +
    '<div class="form-group"><label>Colour (S)</label><input id="' + prefix + 'OtherColour" name="' + prefix + 'OtherColour" type="text" placeholder="Enter colour(s)."></div>' +
    '<div class="form-group"><label>Quantity</label><input id="' + prefix + 'OtherQuantity" name="' + prefix + 'OtherQuantity" type="number" min="1" value="1"></div></div></div>';
  container.innerHTML = html;
}

async function loadStreetwear() {
  const container = document.getElementById("streetwearProductsDynamic");
  if (!container) return;
  const products = await getProducts();
  renderStructure(container, STREETWEAR_STRUCTURE, products.filter(p => normal(p.category) === "streetwear"), "streetwearProduct", "streetwear-product");
  container.querySelectorAll("input[data-streetwear-product]").forEach(i => {
    i.addEventListener("input", updateHiddenSelections);
  });
  updateHiddenSelections();
}

async function loadLadieswear() {
  const container = document.getElementById("ladiesWearProductsDynamic");
  if (!container) return;
  const products = await getProducts();
  renderStructure(container, LADIES_STRUCTURE, products.filter(p => normal(p.category) === "ladies wear"), "ladiesWearProduct", "ladieswear-product");
  container.querySelectorAll("input[data-ladieswear-product]").forEach(i => {
    i.addEventListener("input", updateHiddenSelections);
  });
  updateHiddenSelections();
}

function updateHiddenSelections() {
  const form = document.getElementById("quoteForm");
  if (!form) return;
  function values(selector) {
    return Array.from(form.querySelectorAll(selector)).map(input => ({
      product: input.dataset.productName || "",
      quantity: Number(input.value || 0)
    })).filter(x => x.quantity > 0);
  }
  let street = form.querySelector("#streetwearProductsJson");
  if (!street) {
    street = document.createElement("input"); street.type="hidden"; street.id="streetwearProductsJson"; street.name="streetwearProductsJson"; form.appendChild(street);
  }
  street.value = JSON.stringify(values("input[data-streetwear-product='true']"));

  let ladies = form.querySelector("#ladiesWearProductsJson");
  if (!ladies) {
    ladies = document.createElement("input"); ladies.type="hidden"; ladies.id="ladiesWearProductsJson"; ladies.name="ladiesWearProductsJson"; form.appendChild(ladies);
  }
  ladies.value = JSON.stringify(values("input[data-ladieswear-product='true']"));

  const otherPayload = {
    streetwear: {
      request: form.querySelector("#streetwearProductOther")?.value || "",
      sizeMeasurements: form.querySelector("#streetwearProductOtherSize")?.value || "",
      colour: form.querySelector("#streetwearProductOtherColour")?.value || "",
      quantity: Number(form.querySelector("#streetwearProductOtherQuantity")?.value || 0)
    },
    ladiesWear: {
      request: form.querySelector("#ladiesWearProductOther")?.value || "",
      sizeMeasurements: form.querySelector("#ladiesWearProductOtherSize")?.value || "",
      colour: form.querySelector("#ladiesWearProductOtherColour")?.value || "",
      quantity: Number(form.querySelector("#ladiesWearProductOtherQuantity")?.value || 0)
    }
  };
  let other = form.querySelector("#quoteOtherProductsJson");
  if (!other) {
    other = document.createElement("input"); other.type="hidden"; other.id="quoteOtherProductsJson"; other.name="quoteOtherProductsJson"; form.appendChild(other);
  }
  other.value = JSON.stringify(otherPayload);

  let emb = form.querySelector("#embellishmentDetailsJson");
  if (!emb) {
    emb = document.createElement("input"); emb.type="hidden"; emb.id="embellishmentDetailsJson"; emb.name="embellishmentDetailsJson"; form.appendChild(emb);
  }
  emb.value = JSON.stringify(getEmbellishmentDetails());
}

function getEmbellishmentDetails() {
  return Array.from(document.querySelectorAll(".embellishment-detail-card")).map(card => ({
    service: card.dataset.service || "",
    sizeMeasurements: card.querySelector("[data-detail='size']")?.value || "",
    colour: card.querySelector("[data-detail='colour']")?.value || "",
    quantity: Number(card.querySelector("[data-detail='quantity']")?.value || 0),
    specification: card.querySelector("[data-detail='specification']")?.value || ""
  })).filter(x => x.service);
}

function setupEmbellishment() {
  const section = document.getElementById("embellishmentSection");
  if (!section) return;
  const options = section.querySelector(".product-options");
  if (!options) return;

  options.innerHTML = [
    "Rhinestone Embellishment",
    "Screen Printing / Fabric Painting",
    "Glitter Works",
    "Add-ons"
  ].map(v => '<label class="check-option"><input type="checkbox" name="embellishment[]" value="' + esc(v) + '">' + esc(v) + '</label>').join("") +
  '<label class="check-option"><input type="checkbox" name="embellishment[]" value="Others">Others</label>';

  const detailsWrap = document.createElement("div");
  detailsWrap.id = "embellishmentDetailsWrap";
  detailsWrap.className = "embellishment-details-wrap";
  options.after(detailsWrap);

  function sync() {
    const checked = Array.from(options.querySelectorAll('input[name="embellishment[]"]:checked')).map(x => x.value);
    detailsWrap.innerHTML = checked.map(service => {
      const other = service === "Others";
      return '<div class="embellishment-detail-card" data-service="' + esc(service) + '">' +
        '<h4>' + esc(service) + '</h4>' +
        (other ? '<div class="form-group"><label>Specify your request</label><textarea data-detail="specification" placeholder="Specify your request."></textarea></div>' : '') +
        '<div class="form-grid">' +
        '<div class="form-group"><label>Size / Measurements</label><textarea data-detail="size" placeholder="Enter size or measurements."></textarea></div>' +
        '<div class="form-group"><label>Colour (S)</label><input data-detail="colour" type="text" placeholder="Enter colour(s)."></div>' +
        '<div class="form-group"><label>Quantity</label><input data-detail="quantity" type="number" min="1" value="1"></div>' +
        '</div></div>';
    }).join("");
    detailsWrap.querySelectorAll("input,textarea").forEach(el => el.addEventListener("input",updateHiddenSelections));
    updateHiddenSelections();
  }
  options.querySelectorAll("input").forEach(i => i.addEventListener("change",sync));
  sync();
}

function setupLadiesGlobalFields() {
  const section = document.getElementById("ladiesWearSection");
  if (!section || section.dataset.enhanced) return;
  section.dataset.enhanced = "1";
  const old = section.querySelector("#ladiesWearDetails")?.closest(".form-group");
  if (old) old.remove();
  const size = section.querySelector("#ladiesWearSize");
  if (size) size.placeholder = "Example: Size 12 (UK), or provide your measurements.";
}

function setupQuote() {
  if (!document.getElementById("quoteForm")) return;
  loadStreetwear();
  loadLadieswear();
  setupEmbellishment();
  setupLadiesGlobalFields();

  const serviceInputs = document.querySelectorAll('#quoteForm input[name="services[]"], #quoteForm input[name="service"]');
  serviceInputs.forEach(input => input.addEventListener("change", function() {
    const value = input.value;
    const checked = input.checked;
    if (value === "Streetwear") {
      const s = document.getElementById("streetwearSection"); if (s) s.style.display = checked ? "block" : "none";
    }
    if (value === "Ladies Wear") {
      const s = document.getElementById("ladiesWearSection"); if (s) s.style.display = checked ? "block" : "none";
    }
    updateHiddenSelections();
  }));

  // Re-run after the legacy catalogue loader has finished its asynchronous
  // Supabase read so its older product list cannot overwrite this corrected order.
  [800, 1600, 2800].forEach(delay => setTimeout(loadStreetwear, delay));
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupQuote);
else setupQuote();
})();