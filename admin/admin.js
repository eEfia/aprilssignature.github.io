"use strict";

/* =========================================================
   APRILS SIGNATURE — ADMIN DASHBOARD
   One Supabase client. No duplicate inline dashboard code.
========================================================= */

let db = null;

const DEFAULT_GALLERY_COLLECTIONS = [
    "Streetwear Collection",
    "Rhinestone Embellishment",
    "Fashion Creations",
    "Featured Collection",
    "Embellishment Projects"
];

const DEFAULT_SERVICE_CATEGORIES = [
    "Streetwear",
    "Ladies Wear",
    "Kids Wear",
    "Rhinestone Embellishment",
    "T-Shirt Printing",
    "Dressmaking Training",
    "Screen Painting",
    "Glitter Works",
    "Practical Fashion Training"
];

const DEFAULT_TRAINING_CATEGORIES = [
    "Main Training Programmes",
    "Specialty Classes",
    "Add-On Classes"
];

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function resolveAdminMediaUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^(https?:|data:|blob:|\/)/i.test(raw)) return raw;
    if (/^(images|videos)\//i.test(raw)) return "../" + raw;
    return raw;
}

function message(text, type = "success") {
    const box = document.getElementById("globalStatus");
    if (!box) return;
    box.textContent = text;
    box.className = "status " + type;
    setTimeout(() => {
        box.className = "status";
    }, 5000);
}

async function waitForSupabase() {
    for (let i = 0; i < 100; i++) {
        if (window.aprilsSupabase) return window.aprilsSupabase;
        if (window.AprilsSupabase) return window.AprilsSupabase;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
}

async function getRows(table) {
    if (!db) return [];
    // Never assume created_at exists. The live schema uses different timestamp
    // columns across tables. Read first, then sort client-side when possible.
    let result = await db.from(table).select("*");
    if (result.error) throw result.error;
    const rows = result.data || [];
    rows.sort((a,b) => {
        const ad = String(a.updated_at || a.updatedAt || a.created_at || a.createdAt || "");
        const bd = String(b.updated_at || b.updatedAt || b.created_at || b.createdAt || "");
        return bd.localeCompare(ad);
    });
    return rows;
}

async function countRows(table) {
    if (!db) return 0;
    const result = await db.from(table).select("*", { count: "exact", head: true });
    if (result.error) return 0;
    return result.count || 0;
}

async function cleanupExactDuplicates() {
    // Remove only exact-content duplicates. The first/oldest row is kept.
    // This prevents repeated saves/imports from creating visible duplicates.
    const configs = [
        ["settings", ["setting_key", "setting_value"]],
        ["gallery_collections", ["name"]],
        ["gallery_items", ["title", "image_url"]],
        ["training_programs", ["title", "duration", "category", "description"]],
        ["testimonials", ["customer_name", "testimonial"]],
        ["faqs", ["question", "answer"]],
        ["site_content", ["content_key", "content_value"]],
        ["policies", ["policy_key", "content"]],
        ["admin_services", ["title", "category", "description"]]
    ];
    for (const [table, fields] of configs) {
        try {
            let q = db.from(table).select("id," + fields.join(","));
            const result = await q;
            if (result.error || !result.data?.length) continue;
            const seen = new Map(); const duplicateIds=[];
            for (const row of result.data) {
                const key = fields.map(f => String(row[f] ?? "").trim().toLowerCase()).join("\\u0000");
                if (seen.has(key)) duplicateIds.push(row.id); else seen.set(key, row.id);
            }
            if (duplicateIds.length) {
                const del = await db.from(table).delete().in("id", duplicateIds);
                if (del.error) console.warn("Duplicate cleanup failed for", table, del.error.message);
            }
        } catch (e) { console.warn("Duplicate cleanup skipped for", table, e); }
    }

    // Customer submissions can also be duplicated by older save handlers. Keep
    // only one exact-content copy so the dashboard count and request list stay clean.
    for (const table of ["quote_requests", "training_registrations"]) {
        try {
            const result = await db.from(table).select("*");
            if (result.error || !result.data?.length) continue;
            const seen = new Set();
            const duplicateIds = [];
            for (const row of result.data) {
                const copy = {...row};
                delete copy.id;
                delete copy.created_at;
                delete copy.updated_at;
                const key = JSON.stringify(copy, Object.keys(copy).sort());
                if (seen.has(key)) duplicateIds.push(row.id);
                else seen.add(key);
            }
            if (duplicateIds.length) {
                const del = await db.from(table).delete().in("id", duplicateIds);
                if (del.error) console.warn("Submission duplicate cleanup failed for", table, del.error.message);
            }
        } catch (e) {
            console.warn("Submission duplicate cleanup skipped for", table, e);
        }
    }

    // Remove duplicate gallery media by normalized media URL.
    try {
        const result = await db.from("gallery_items").select("id,image_url,created_at,updated_at");
        if (!result.error) {
            const groups = new Map();
            for (const row of result.data || []) {
                const key = String(row.image_url || "").trim().toLowerCase();
                if (!key) continue;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(row);
            }
            for (const group of groups.values()) {
                if (group.length <= 1) continue;
                group.sort((a,b)=>String(a.updated_at||"").localeCompare(String(b.updated_at||"")));
                await db.from("gallery_items").delete().in("id", group.slice(1).map(r=>r.id));
            }
        }
    } catch (e) { console.warn("Gallery media duplicate cleanup skipped:", e); }

    // Settings keys are intended to be unique in practice. Clean duplicate
    // records for managed prefixes so editing an item never leaves a second copy.
    try {
        const result = await db.from("settings").select("id,setting_key,setting_value,updated_at");
        if (!result.error) {
            const uniquePrefixes = ["product_","invoice_price_","site_link_","social_","homepage_featured_","public_training_price_","inventory_item_"];
            const groups = new Map();
            (result.data || []).forEach(row => {
                const key = String(row.setting_key || "");
                if (!uniquePrefixes.some(prefix => key.startsWith(prefix))) return;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(row);
            });
            for (const group of groups.values()) {
                if (group.length <= 1) continue;
                group.sort((a,b) => String(a.updated_at || "").localeCompare(String(b.updated_at || "")));
                const duplicateIds = group.slice(1).map(r => r.id);
                if (duplicateIds.length) await db.from("settings").delete().in("id", duplicateIds);
            }
            const productGroups = new Map();
            for (const row of result.data || []) {
                if (!String(row.setting_key || "").startsWith("product_")) continue;
                try {
                    const item = JSON.parse(row.setting_value || "{}");
                    const key = String(item.category||"").trim().toLowerCase() + "\u0000" + String(item.name||"").trim().toLowerCase();
                    if (!item.name) continue;
                    if (!productGroups.has(key)) productGroups.set(key, []);
                    productGroups.get(key).push(row);
                } catch (_) {}
            }
            for (const group of productGroups.values()) {
                if (group.length <= 1) continue;
                group.sort((a,b)=>String(a.updated_at||"").localeCompare(String(b.updated_at||"")));
                await db.from("settings").delete().in("id", group.slice(1).map(r=>r.id));
            }
        }
    } catch (e) { console.warn("Managed settings duplicate cleanup skipped:", e); }
}

function hasCachedAdminSession() {
    try {
        return Object.keys(localStorage).some(key => /auth-token/i.test(key));
    } catch (_) {
        return false;
    }
}

async function syncOfflineInvoiceRecords() {
    if (!db) return;
    try {
        const invoices = JSON.parse(localStorage.getItem("aprils_offline_invoices") || "[]");
        for (const record of invoices) {
            if (record.invoiceNumber) {
                const key = "invoice_record_" + contentSlug(record.invoiceNumber);
                await safeSettingUpsert(key, JSON.stringify(record));
            }
        }
        if (invoices.length) localStorage.removeItem("aprils_offline_invoices");

        const payments = JSON.parse(localStorage.getItem("aprils_offline_payments") || "[]");
        for (const payment of payments) {
            if (payment.invoiceNumber) {
                await safeSettingUpsert(invoicePaymentStorageKey(payment.invoiceNumber, Date.now()), JSON.stringify(payment));
                try { if (window.syncInventoryFromPayment) await window.syncInventoryFromPayment(payment.invoiceNumber); } catch (_) {}
                try {
                    const inv = await getInvoiceSavedRecord(payment.invoiceNumber);
                    if (inv?.sourceId && inv.sourceType === "quote_requests") await setAdminRecordStatus("quote_status", inv.sourceId, "in_production");
                } catch (_) {}
            }
        }
        if (payments.length) localStorage.removeItem("aprils_offline_payments");

        const expenses = JSON.parse(localStorage.getItem("aprils_offline_expenses") || "[]");
        for (const expense of expenses) {
            const key = "accounting_expense_" + contentSlug(String(expense.date || "") + "_" + String(expense.category || "") + "_" + String(expense.description || "") + "_" + String(expense.id || Date.now()));
            await safeSettingUpsert(key, JSON.stringify(expense));
        }
        if (expenses.length) localStorage.removeItem("aprils_offline_expenses");
    } catch (error) {
        console.warn("Offline invoice synchronisation will retry later:", error);
    }
}

async function applyCurrentUserAccess(user){
    try{
        const email=String(user?.email||"").trim().toLowerCase(); if(!email)return;
        const row=await db.from("settings").select("setting_value").eq("setting_key",accessKey(email)).maybeSingle();
        if(row.error||!row.data)return; // owner accounts without a profile retain full access
        let p={}; try{p=JSON.parse(row.data.setting_value||"{}")}catch(_){return;}
        if(p.active===false){await db.auth.signOut();document.getElementById("loginScreen").style.display="flex";message("This admin account is currently inactive.","error");return;}
        const allowed=new Set(p.sections||[]);
        document.querySelectorAll(".sidebar button[data-section]").forEach(b=>{if(!allowed.has(b.dataset.section))b.style.display="none"});
        document.querySelectorAll(".section").forEach(sec=>{if(sec.id!=="dashboard"&&!allowed.has(sec.id))sec.dataset.accessHidden="true"});
    }catch(e){console.warn("Admin access profile could not be applied:",e)}
}

async function restoreAdminSection() {
    let id = "dashboard";
    try { id = sessionStorage.getItem("aprils_admin_current_section") || "dashboard"; } catch (_) {}
    const button = document.querySelector(`.sidebar button[data-section="${CSS.escape(id)}"]`) || document.querySelector('.sidebar button[data-section="dashboard"]');
    if (!button) return;
    document.querySelectorAll(".sidebar button").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    document.querySelectorAll(".section").forEach(section => section.classList.remove("active"));
    const section = document.getElementById(button.dataset.section);
    if (section) section.classList.add("active");
    await loadSection(button.dataset.section);
}

async function checkSession() {
    const login = document.getElementById("loginScreen");
    if (!login) return;

    if (!db) {
        login.style.display = "flex";
        message("The secure admin connection is unavailable. Please reconnect to Supabase before accessing customer or financial records.", "error");
        return;
    }

    try {
        const result = await db.auth.getSession();
        if (result.data.session) {
            window._aprilsAdminUser = result.data.session.user;
            login.style.display = "none";
            try { await seedInitialPublicContent(); } catch (_) {}
            try { await cleanupExactDuplicates(); } catch (_) {}
            await syncOfflineInvoiceRecords();
            await applyCurrentUserAccess(result.data.session.user);
            window._aprilsAuditReady = true;
            await restoreAdminSection();
        } else {
            login.style.display = "flex";
        }
    } catch (error) {
        console.warn("Admin session check failed:", error);
        login.style.display = "flex";
        message("The secure admin session could not be verified. Please reconnect and sign in again.", "error");
    }
}

function setupLogin() {
    const form = document.getElementById("loginForm");
    if (!form) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;
        const box = document.getElementById("loginMessage");

        try {
            const result = await db.auth.signInWithPassword({ email, password });
            if (result.error) throw result.error;

            box.textContent = "Login successful.";
            box.className = "status success";
            document.getElementById("loginScreen").style.display = "none";
            await loadDashboard();
        } catch (error) {
            console.error(error);
            box.textContent = "Login failed. Check your email and password.";
            box.className = "status error";
        }
    });
}

function setupLogout() {
    const button = document.getElementById("logoutButton");
    if (!button) return;

    button.addEventListener("click", async () => {
        if (db) await db.auth.signOut();
        location.reload();
    });
}

function setupNavigation() {
    document.querySelectorAll(".sidebar button[data-section]").forEach(button => {
        button.addEventListener("click", async () => {
            document.querySelectorAll(".sidebar button").forEach(b => b.classList.remove("active"));
            button.classList.add("active");
            button.classList.add("button-working");
            setTimeout(() => button.classList.remove("button-working"), 350);
            try { sessionStorage.setItem("aprils_admin_current_section", button.dataset.section || "dashboard"); } catch (_) {}

            document.querySelectorAll(".section").forEach(section => section.classList.remove("active"));

            const id = button.dataset.section;
            const section = document.getElementById(id);
            if (section) section.classList.add("active");

            await loadSection(id);
        });
    });
}

async function countUniqueRows(table, keyFn) {
    if (!db) return 0;
    try {
        const rows = await getRows(table);
        const keys = new Set();
        rows.forEach(row => keys.add(keyFn(row)));
        return keys.size;
    } catch (_) {
        return 0;
    }
}

async function loadDashboard() {
    const counters = {
        galleryCount: ["gallery_items", row => [
            String(row.title || "").trim().toLowerCase(),
            String(row.image_url || "").trim().toLowerCase()
        ].join("\u0000")],
        trainingCount: ["training_programs", row => [
            String(row.title || "").trim().toLowerCase(),
            String(row.duration || "").trim().toLowerCase(),
            String(row.category || "").trim().toLowerCase()
        ].join("\u0000")],
        testimonialCount: ["testimonials", row => [
            String(row.customer_name || "").trim().toLowerCase(),
            String(row.testimonial || "").trim().toLowerCase()
        ].join("\u0000")],
        faqCount: ["faqs", row => [
            String(row.question || "").trim().toLowerCase(),
            String(row.answer || "").trim().toLowerCase()
        ].join("\u0000")],
        registrationCount: ["training_registrations", row => {
            const copy = {...row}; delete copy.id; delete copy.created_at; delete copy.updated_at;
            return JSON.stringify(copy, Object.keys(copy).sort());
        }],
        quoteCount: ["quote_requests", row => {
            const copy = {...row}; delete copy.id; delete copy.created_at; delete copy.updated_at;
            return JSON.stringify(copy, Object.keys(copy).sort());
        }]
    };

    for (const id in counters) {
        const element = document.getElementById(id);
        if (!element) continue;
        const [table, keyFn] = counters[id];
        element.textContent = await countUniqueRows(table, keyFn);
    }
}

async function loadSection(id) {
    try {
        if (id === "dashboard") await loadDashboard();
        if (id === "gallery") await loadGallery();
        if (id === "homepage") await loadHomepageMedia();
        if (id === "training") await loadTraining();
        if (id === "registrations") await loadRegistrations();
        if (id === "orders") await loadQuotes();
        if (id === "orderTracking") await loadOrderTracking();
        if (id === "trainees") await loadTrainees();
        if (id === "invoice") await loadInvoicePricing();
        if (id === "manualInvoice") await loadSavedInvoiceReceiptRecords();
        if (id === "usersInvoice") await loadSavedInvoiceReceiptRecords();
        if (id === "collectionForms") await loadCollectionInvoiceOptions();
        if (id === "inventory" && window.loadInventory) await window.loadInventory();
        if (id === "checkout" && window.loadCheckoutOrders) await window.loadCheckoutOrders();
        if (id === "errors" && window.loadErrorLog) await window.loadErrorLog();
        if (id === "auditLog") await loadAuditLog();
        if (id === "notifications") await loadNotifications();
        if (id === "shopAdmin") setupShopAdmin();
        if (id === "accounting") await loadAccounting();
        if (id === "discounts") await loadDiscountCodes();
        if (id === "links") await loadWebsiteLinks();
        if (id === "testimonials") await loadTestimonials();
        if (id === "faq") await loadFAQs();
        if (id === "policies") await loadPolicies();
        if (id === "content") await loadContent();
        if (id === "social") await loadSocial();
        if (id === "services") await loadServices();
        if (id === "contact") await loadContact();
        if (id === "settings") await loadSettings();
        if (id === "users") await loadUserAccess();
    } catch (error) {
        console.error("ADMIN SECTION ERROR:", id, error);
        message("Could not load this section. Check your Supabase tables and policies.", "error");
    }
}

/* =========================================================
   GALLERY
========================================================= */

async function getGalleryCollections() {
    const names = new Set(DEFAULT_GALLERY_COLLECTIONS);

    try {
        const result = await db.from("gallery_collections").select("id,name,active,display_order").order("display_order", { ascending: true }).order("name");
        if (!result.error) {
            (result.data || []).forEach(row => {
                if (row.active !== false && row.name) names.add(row.name);
            });
        }
    } catch (error) {
        console.warn("Gallery collections table unavailable:", error);
    }

    try {
        const rows = await db.from("gallery_items").select("category");
        if (!rows.error) {
            (rows.data || []).forEach(row => {
                if (row.category) names.add(row.category);
            });
        }
    } catch (error) {
        console.warn("Could not read gallery categories:", error);
    }

    return [...names].sort((a, b) => a.localeCompare(b));
}

async function renderGalleryCategorySelect(currentValue = "") {
    const input = document.getElementById("galleryCategory");
    if (!input) return;

    const select = document.createElement("select");
    select.id = "galleryCategory";
    select.name = "galleryCategory";

    const collections = await getGalleryCollections();

    select.innerHTML =
        `<option value="">Select Collection</option>` +
        collections.map(name =>
            `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`
        ).join("");

    select.value = currentValue || "";

    input.replaceWith(select);

    const wrapper = select.parentElement;
    let add = wrapper.querySelector("#addGalleryCollection");

    if (!add) {
        add = document.createElement("button");
        add.type = "button";
        add.id = "addGalleryCollection";
        add.className = "secondary";
        add.style.marginTop = "10px";
        add.textContent = "+ Add New Collection";

        add.addEventListener("click", async () => {
            const name = window.prompt("Enter the new collection name:");
            if (!name) return;

            const cleanName = name.trim();
            if (!cleanName) return;

            try {
                const duplicate = await db.from("gallery_collections").select("id").ilike("name", cleanName).limit(1);
                if (duplicate.error) throw duplicate.error;
                if (duplicate.data?.length) {
                    message("That collection already exists.", "error");
                    return;
                }
                const current = await db.from("gallery_collections").select("display_order").order("display_order", { ascending: false }).limit(1);
                const nextOrder = (current.data?.[0]?.display_order || 0) + 1;
                const result = await db.from("gallery_collections").insert({ name: cleanName, active: true, display_order: nextOrder });
                if (result.error) throw result.error;

                await renderGalleryCategorySelect(cleanName);
                message("Collection added.", "success");
                await loadGallery();
            } catch (error) {
                console.error(error);
                message("Collection could not be added. You can still use the new name after saving the gallery item.", "error");

                const current = document.getElementById("galleryCategory");
                if (current && ![...current.options].some(o => o.value === cleanName)) {
                    current.add(new Option(cleanName, cleanName));
                    current.value = cleanName;
                }
            }
        });

        wrapper.appendChild(add);
    }
}

async function loadGallery() {
    const list = document.getElementById("galleryList");
    if (!list) return;
    const galleryPolicyRank = {payment_policy:1, refund_policy:2, delivery_collection_policy:3, privacy_policy:4};

    let rows = [];
    try {
        rows = await getRows("gallery_items");
    } catch (error) {
        console.error("GALLERY ITEMS LOAD FAILED:", error);
        message("Gallery items could not be loaded. The gallery controls remain available; check the Supabase policy shown in SUPABASE_FIXES.sql.", "error");
    }
    rows.sort((a,b)=>String(a.category||"").localeCompare(String(b.category||"")) ||
        Number(a.display_order||9999)-Number(b.display_order||9999) ||
        String(a.title||"").localeCompare(String(b.title||"")));

    list.innerHTML = `
        <div class="admin-actions">
            <button type="button" class="primary" id="newGalleryItemButton">+ Add Gallery Item</button>
            <button type="button" class="secondary" id="newGalleryCollectionButton">+ Add New Collection</button>
        </div>
        <div id="galleryCollectionOrderList" style="margin:15px 0;"><strong>Collection Order</strong><div class="empty">Loading collections…</div></div>
        ${rows.length ? `
        <table>
            <thead>
                <tr>
                    <th>Image</th>
                    <th>Title</th>
                    <th>Collection</th><th>Order</th>
                    <th>Price (GHS)</th>
                    <th>Featured</th>
                    <th>Active</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(row => `
                    <tr>
                        <td>${row.image_url ? (/\.(mp4|webm|ogg)(\?|$)/i.test(row.image_url) ? `<video src="${escapeHTML(resolveAdminMediaUrl(row.image_url))}" muted loop autoplay playsinline style="width:90px;height:70px;object-fit:cover;border-radius:4px"></video>` : `<img src="${escapeHTML(resolveAdminMediaUrl(row.image_url))}" alt="" style="width:90px;height:70px;object-fit:cover;border-radius:4px">`) : "No media"}</td>
                        <td>${escapeHTML((galleryPolicyRank[String(row.policy_key||"").toLowerCase()] ? galleryPolicyRank[String(row.policy_key||"").toLowerCase()] + ". " : "") + String(row.title || "").replace(/^\s*[1-4]\s*\.\s*/, ""))}</td>
                        <td>${escapeHTML(row.category)}</td><td><input type="number" min="1" value="${escapeHTML(row.display_order ?? 1)}" data-gallery-order="${escapeHTML(row.id)}" style="max-width:90px"></td>
                        <td>${row.price != null && row.price !== "" ? `GHS ${Number(row.price).toFixed(2)}` : "—"}</td>
                        <td>${row.featured ? "Yes" : "No"}</td>
                        <td>${row.active ? "Yes" : "No"}</td>
                        <td>
                            <button type="button" class="secondary" data-save-gallery-order="${escapeHTML(row.id)}">Save Order</button>
                            <button type="button" class="secondary" data-edit-gallery="${row.id}">Edit</button>
                            <button type="button" class="danger" data-delete-gallery="${row.id}">Delete</button>
                        </td>
                    </tr>
                `).join("")}
            </tbody>
        </table>` : `<div class="empty">No gallery items yet. Add your first item above.</div>`}
    `;

    document.getElementById("newGalleryItemButton").onclick = newGalleryItem;
    document.getElementById("newGalleryCollectionButton").onclick = addGalleryCollection;

    try {
        let collectionResult = await db.from("gallery_collections").select("id,name,active,display_order").order("display_order", {ascending:true}).order("name");
        // Make sure every category currently used by gallery items has one real
        // collection record. Missing collection rows were the main reason some
        // collection orders appeared not to respond on the public gallery.
        if (!collectionResult.error) {
            const existingCollections = collectionResult.data || [];
            const usedCategories = [...new Set(rows.map(r => String(r.category || "").trim()).filter(Boolean))];
            let maxOrder = Math.max(0, ...existingCollections.map(c => Number(c.display_order || 0)));
            for (const category of usedCategories) {
                const exists = existingCollections.some(c => String(c.name || "").trim().toLowerCase() === category.toLowerCase());
                if (!exists) {
                    maxOrder += 1;
                    const created = await db.from("gallery_collections").insert({name:category, active:true, display_order:maxOrder});
                    if (!created.error) existingCollections.push({id:created.data?.[0]?.id, name:category, active:true, display_order:maxOrder});
                }
            }
            // Remove duplicate collection rows with the same name, keeping the first.
            const seenCollections = new Map();
            for (const c of existingCollections.slice()) {
                const key = String(c.name || "").trim().toLowerCase();
                if (!key) continue;
                if (seenCollections.has(key) && c.id) {
                    try { await db.from("gallery_collections").delete().eq("id", c.id); } catch (_) {}
                } else {
                    seenCollections.set(key, c.id);
                }
            }
            collectionResult = await db.from("gallery_collections").select("id,name,active,display_order").order("display_order", {ascending:true}).order("name");
        }
        const collectionBox = document.getElementById("galleryCollectionOrderList");
        if (!collectionResult.error && collectionBox) {
            const collections = collectionResult.data || [];
            collectionBox.innerHTML = collections.length ? `<strong>Collection Order</strong><table><thead><tr><th>Collection</th><th>Order</th><th>Move</th><th>Save Order</th><th>Edit</th><th>Delete</th></tr></thead><tbody>${collections.map(c=>`<tr><td>${escapeHTML(c.name||"")}</td><td><input type="number" min="1" value="${escapeHTML(c.display_order??1)}" data-collection-order="${escapeHTML(c.id)}" style="max-width:90px"></td>
<td><button type="button" class="secondary" data-move-collection="${escapeHTML(c.id)}" data-direction="-1">↑</button> <button type="button" class="secondary" data-move-collection="${escapeHTML(c.id)}" data-direction="1">↓</button></td>
<td><button type="button" class="secondary" data-save-collection-order="${escapeHTML(c.id)}">Save Order</button></td><td><button type="button" class="secondary" data-edit-collection="${escapeHTML(c.id)}">Edit</button></td><td><button type="button" class="danger" data-delete-collection="${escapeHTML(c.id)}">Delete</button></td></tr>`).join("")}</tbody></table>` : `<strong>Collection Order</strong><div class="empty">No collections yet.</div>`;
            collectionBox.querySelectorAll("[data-save-collection-order]").forEach(btn=>btn.onclick=async()=>{
                const id=btn.dataset.saveCollectionOrder;
                const input=collectionBox.querySelector(`[data-collection-order="${id}"]`);
                const value=Number(input?.value)||1;
                const r=await db.from("gallery_collections").update({display_order:value}).eq("id",id);
                if(r.error) message("Collection order could not be saved: "+r.error.message,"error");
                else { message("Collection order saved.","success"); await loadGallery(); }
            });
            collectionBox.querySelectorAll("[data-move-collection]").forEach(btn=>btn.onclick=async()=>{
                const id = btn.dataset.moveCollection;
                const direction = Number(btn.dataset.direction) || 0;
                const index = collections.findIndex(c => String(c.id) === String(id));
                const targetIndex = index + direction;
                if (index < 0 || targetIndex < 0 || targetIndex >= collections.length) return;

                const reordered = collections.slice();
                const [moved] = reordered.splice(index, 1);
                reordered.splice(targetIndex, 0, moved);

                try {
                    for (let i = 0; i < reordered.length; i++) {
                        const result = await db.from("gallery_collections")
                            .update({display_order: i + 1})
                            .eq("id", reordered[i].id);
                        if (result.error) throw result.error;
                    }
                    message("Collection order updated.", "success");
                    await loadGallery();
                } catch (error) {
                    message("Collection order could not be changed: " + error.message, "error");
                }
            });

            collectionBox.querySelectorAll("[data-edit-collection]").forEach(btn=>btn.onclick=async()=>{
                const id=btn.dataset.editCollection;
                const row=collections.find(c=>String(c.id)===String(id));
                if(!row)return;
                const next=window.prompt("Change collection name:",row.name||"");
                if(next===null)return;
                const name=next.trim();
                if(!name || name===row.name)return;
                const duplicate=collections.find(c=>String(c.id)!==String(id) && String(c.name||"").trim().toLowerCase()===name.toLowerCase());
                if(duplicate){message("A collection with that name already exists.","error");return;}
                const r=await db.from("gallery_collections").update({name}).eq("id",id);
                if(r.error){message("Collection name could not be changed: "+r.error.message,"error");return;}
                const moved=await db.from("gallery_items").update({category:name}).eq("category",row.name);
                if(moved.error){console.warn("Gallery items could not all be renamed:",moved.error);}
                message("Collection name updated.","success"); await loadGallery();
            });
            collectionBox.querySelectorAll("[data-delete-collection]").forEach(btn=>btn.onclick=async()=>{
                const id=btn.dataset.deleteCollection;
                const row=collections.find(c=>String(c.id)===String(id));
                if(!row || !confirm(`Delete collection "${row.name}"? Gallery items will remain but will no longer be tied to this collection.`))return;
                const r=await db.from("gallery_collections").delete().eq("id",id);
                if(r.error){message("Collection could not be deleted: "+r.error.message,"error");return;}
                message("Collection deleted.","success"); await loadGallery();
            });
        }
    } catch(error) { console.warn("Gallery collection ordering unavailable:",error); }

    list.querySelectorAll("[data-save-gallery-order]").forEach(button => {
        button.onclick = async () => {
            const id = button.dataset.saveGalleryOrder;
            const input = list.querySelector(`[data-gallery-order="${id}"]`);
            const value = Math.max(1, Number(input?.value || 1));
            const result = await db.from("gallery_items").update({display_order:value}).eq("id",id);
            if (result.error) {
                message("Gallery item order could not be saved: " + result.error.message, "error");
                return;
            }
            message("Gallery item order saved.", "success");
            await loadGallery();
        };
    });

    list.querySelectorAll("[data-edit-gallery]").forEach(button => {
        button.onclick = () => {
            const row = rows.find(item => String(item.id) === String(button.dataset.editGallery));
            if (row) editGallery(row);
        };
    });

    list.querySelectorAll("[data-delete-gallery]").forEach(button => {
        button.onclick = () => deleteGallery(button.dataset.deleteGallery);
    });

    await renderGalleryCategorySelect(document.getElementById("galleryCategory")?.value || "");
    renderHomepageFeaturedMedia(rows);
}

function renderHomepageFeaturedMedia(rows) {
    const box=document.getElementById("homepageFeaturedList"); if(!box)return;
    const featured=(rows||[]).filter(r=>r.featured && r.active!==false).sort((a,b)=>Number(a.display_order||9999)-Number(b.display_order||9999)||String(a.title||"").localeCompare(String(b.title||"")));
    box.innerHTML=featured.length?`<table><thead><tr><th>Media</th><th>Title</th><th>Collection</th><th>Order</th><th>Actions</th></tr></thead><tbody>${featured.map(r=>`<tr><td>${r.image_url?(/\.(mp4|webm|ogg)(\?|$)/i.test(r.image_url)?`<video src="${escapeHTML(resolveAdminMediaUrl(r.image_url))}" muted loop autoplay playsinline style="width:90px;height:70px;object-fit:cover"></video>`:`<img src="${escapeHTML(resolveAdminMediaUrl(r.image_url))}" style="width:90px;height:70px;object-fit:cover">`):"—"}</td><td>${escapeHTML(r.title||"")}</td><td>${escapeHTML(r.category||"")}</td><td><input type="number" min="1" value="${escapeHTML(r.display_order??1)}" data-featured-order="${escapeHTML(r.id)}" style="max-width:90px"></td><td><button type="button" class="secondary" data-featured-edit="${escapeHTML(r.id)}">Edit</button> <button type="button" class="danger" data-featured-delete="${escapeHTML(r.id)}">Delete</button> <button type="button" class="secondary" data-featured-save="${escapeHTML(r.id)}">Save Order</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">No homepage featured media yet. Use “Add Gallery Item” above and tick “Show in Featured Collection”.</div>`;
    box.querySelectorAll("[data-featured-save]").forEach(b=>b.onclick=async()=>{
        const id=b.dataset.featuredSave;
        const input=box.querySelector(`[data-featured-order="${id}"]`);
        const value=Number(input?.value)||1;
        const galleryRow=featured.find(x=>String(x.id)===String(id));
        try{
            const r=await db.from("gallery_items").update({display_order:value}).eq("id",id);
            if(r.error)throw r.error;
            const homeRows=await getHomepageMediaRows();
            const home=homeRows.find(x=>String(x.url||"").trim()===String(galleryRow?.image_url||"").trim() && String(x.title||"").trim().toLowerCase()===String(galleryRow?.title||"").trim().toLowerCase());
            if(home) await safeSettingUpsert(homepageMediaKey(home.title,home.url),JSON.stringify({...home,order:value}));
            message("Homepage featured order saved.","success");
            await loadGallery();
        }catch(error){message("Featured media order could not be saved: "+error.message,"error");}
    });
    box.querySelectorAll("[data-featured-edit]").forEach(b=>b.onclick=()=>{const r=featured.find(x=>String(x.id)===String(b.dataset.featuredEdit));if(r)editGallery(r);});
    box.querySelectorAll("[data-featured-delete]").forEach(b=>b.onclick=()=>deleteGallery(b.dataset.featuredDelete));
}

async function addGalleryCollection() {
    const name = window.prompt("Enter the new collection name:");
    if (!name) return;
    const cleanName = name.trim();
    if (!cleanName) return;

    try {
        const duplicate = await db.from("gallery_collections").select("id").ilike("name",cleanName).limit(1);
        if (duplicate.error) throw duplicate.error;
        if (duplicate.data?.length) {
            message("That collection already exists.","error");
            return;
        }
        const current = await db.from("gallery_collections").select("display_order")
            .order("display_order", { ascending: false }).limit(1);
        const nextOrder = (current.data?.[0]?.display_order || 0) + 1;
        const result = await db.from("gallery_collections").insert({
            name: cleanName, active: true, display_order: nextOrder
        });
        if (result.error) throw result.error;
        await renderGalleryCategorySelect(cleanName);
        message("Collection added.", "success");
        await loadGallery();
    } catch (error) {
        console.error(error);
        message("Collection could not be added: " + error.message, "error");
    }
}


function newGalleryItem() {
    const form = document.getElementById("galleryForm");
    if (!form) return;
    form.reset();
    document.getElementById("galleryId").value = "";
    document.getElementById("galleryActive").checked = true;
    document.getElementById("galleryOrder").value = 1;
    renderGalleryCategorySelect("");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editGallery(row) {
    document.getElementById("galleryId").value = row.id;
    document.getElementById("galleryTitle").value = row.title || "";
    renderGalleryCategorySelect(row.category || "");
    document.getElementById("galleryImage").value = row.image_url || "";
    document.getElementById("galleryDescription").value = row.description || "";
    document.getElementById("galleryPrice").value = row.price ?? "";
    document.getElementById("galleryOrder").value = row.display_order ?? 1;
    document.getElementById("galleryFeatured").checked = !!row.featured;
    document.getElementById("galleryActive").checked = row.active !== false;
    document.getElementById("galleryForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteGallery(id) {
    if (!confirm("Delete this gallery item?")) return;
    let oldGalleryRow = null;
    try { const old = await db.from("gallery_items").select("title,image_url,featured").eq("id",id).maybeSingle(); oldGalleryRow = old.data || null; } catch (_) {}
    const result = await db.from("gallery_items").delete().eq("id", id);
    if (result.error) {
        console.error(result.error);
        message("Gallery item could not be deleted.", "error");
        return;
    }
    if (oldGalleryRow?.featured) {
        try { await db.from("settings").delete().eq("setting_key", homepageMediaKey(oldGalleryRow.title || "", oldGalleryRow.image_url || "")); } catch (_) {}
    }
    message("Gallery item deleted.", "success");
    await loadGallery();
    await loadDashboard();
}

function setupGalleryForm() {
    const form = document.getElementById("galleryForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const id = document.getElementById("galleryId").value.trim();
        const data = {
            title: document.getElementById("galleryTitle").value.trim(),
            category: document.getElementById("galleryCategory").value.trim(),
            image_url: document.getElementById("galleryImage").value.trim(),
            description: document.getElementById("galleryDescription").value.trim(),
            price: document.getElementById("galleryPrice").value === "" ? null : Number(document.getElementById("galleryPrice").value),
            display_order: Number(document.getElementById("galleryOrder").value) || 1,
            featured: document.getElementById("galleryFeatured").checked,
            active: document.getElementById("galleryActive").checked,
            updated_at: new Date().toISOString()
        };

        if (!data.title) {
            message("Please enter a gallery title.", "error");
            return;
        }

        try {
            let result;
            let oldGalleryRow = null;
            if (id) {
                const oldResult = await db.from("gallery_items").select("*").eq("id", id).maybeSingle();
                if (!oldResult.error) oldGalleryRow = oldResult.data;
                result = await db.from("gallery_items").update(data).eq("id", id).select("id").single();
            } else {
                // Do not create a second database record for the same media in the same collection.
                const existing = await db.from("gallery_items")
                    .select("id")
                    .eq("category", data.category)
                    .eq("image_url", data.image_url)
                    .limit(1);
                if (existing.error) throw existing.error;
                if (existing.data?.length) {
                    result = await db.from("gallery_items").update(data).eq("id", existing.data[0].id);
                } else {
                    result = await db.from("gallery_items").insert(data).select("id").single();
                }
            }

            if (result.error) throw result.error;

            // Keep every gallery category represented by a real collection record so
            // the public page can honour the collection display order.
            if (data.category) {
                const collection = await db.from("gallery_collections").select("id").ilike("name", data.category).limit(1);
                if (!collection.error && !collection.data?.length) {
                    const maxOrder = await db.from("gallery_collections").select("display_order").order("display_order", {ascending:false}).limit(1);
                    const nextOrder = Number(maxOrder.data?.[0]?.display_order || 0) + 1;
                    await db.from("gallery_collections").insert({name:data.category, active:true, display_order:nextOrder});
                }
            }

            // Clean up exact duplicates created previously, keeping the record just saved.
            const duplicateQuery = db.from("gallery_items")
                .select("id")
                .eq("category", data.category)
                .eq("image_url", data.image_url);
            const duplicateResult = await duplicateQuery;
            if (!duplicateResult.error && duplicateResult.data?.length > 1) {
                const keepId = id || result.data?.[0]?.id || duplicateResult.data[0].id;
                const duplicateIds = duplicateResult.data
                    .map(r => r.id)
                    .filter(rowId => String(rowId) !== String(keepId));
                if (duplicateIds.length) {
                    await db.from("gallery_items").delete().in("id", duplicateIds);
                }
            }

            // Keep the separate homepage Featured Collection synchronized with gallery edits.
            if (oldGalleryRow?.featured) {
                const oldHomeKey = homepageMediaKey(oldGalleryRow.title || "", oldGalleryRow.image_url || "");
                try { await db.from("settings").delete().eq("setting_key", oldHomeKey); } catch (_) {}
            }
            if (data.featured && data.active) {
                const homeValue = JSON.stringify({
                    title:data.title, url:data.image_url, order:data.display_order,
                    description:data.description, active:true
                });
                await safeSettingUpsert(homepageMediaKey(data.title,data.image_url), homeValue);
            }

            form.reset();
            document.getElementById("galleryId").value = "";
            document.getElementById("galleryActive").checked = true;

            message("Gallery item saved successfully.", "success");
            await loadGallery();
            await loadDashboard();
            returnToAdminList("[data-edit-gallery]", id || null);
        } catch (error) {
            console.error(error);
            message("Gallery item could not be saved: " + error.message, "error");
        }
    });

    document.getElementById("galleryCancel")?.addEventListener("click", newGalleryItem);
}

/* =========================================================
   CATEGORY HELPERS
========================================================= */

function makeCategorySelect(inputId, categories, currentValue, addLabel, onAdd) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const select = document.createElement("select");
    select.id = inputId;
    select.name = inputId;
    select.innerHTML =
        `<option value="">Select Category</option>` +
        categories.map(name => `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`).join("");
    select.value = currentValue || "";
    input.replaceWith(select);

    const wrapper = select.parentElement;
    let button = wrapper.querySelector(`[data-add-category="${inputId}"]`);

    if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "secondary";
        button.dataset.addCategory = inputId;
        button.style.marginTop = "10px";
        button.textContent = addLabel;

        button.addEventListener("click", async () => {
            const name = prompt("Enter the new category name:");
            if (!name) return;

            const clean = name.trim();
            if (!clean) return;

            const updated = [...new Set([...categories, clean])].sort((a, b) => a.localeCompare(b));
            makeCategorySelect(inputId, updated, clean, addLabel, onAdd);

            if (onAdd) await onAdd(clean);
        });

        wrapper.appendChild(button);
    }
}

async function getServiceCategories() {
    const categories = new Set(DEFAULT_SERVICE_CATEGORIES);
    try {
        const result = await db.from("admin_services").select("category");
        if (!result.error) (result.data || []).forEach(r => r.category && categories.add(r.category));
    } catch {}
    return [...categories];
}

async function getTrainingCategories() {
    const categories = new Set(DEFAULT_TRAINING_CATEGORIES);
    try {
        const result = await db.from("training_programs").select("category");
        if (!result.error) (result.data || []).forEach(r => r.category && categories.add(r.category));
    } catch {}
    return [...categories];
}

/* =========================================================
   SERVICES
========================================================= */


/* =========================================================
   PRODUCTS CATALOGUE
   Stored in settings so no extra database table is required.
========================================================= */

const DEFAULT_PRODUCTS = [
    ["Streetwear","Jersey",1,"Tops"],["Streetwear","Jersey Sample",2,"Tops"],["Streetwear","T-Shirt",3,"Tops"],["Streetwear","T-Shirt Sample",4,"Tops"],["Streetwear","Hoodies",5,"Tops"],["Streetwear","Polo Shirt",6,"Tops"],["Streetwear","Sweatshirt",7,"Tops"],["Streetwear","Varsity Jacket",8,"Tops"],
    ["Streetwear","Ladies Tank Top",9,"Tank Top Options"],["Streetwear","Men’s Tank Top",10,"Tank Top Options"],
    ["Streetwear","Super Thick Cotton Joggers",11,"Joggers"],["Streetwear","Everyday Wear Type of Joggers",12,"Joggers"],["Streetwear","Joggers Short",13,"Bottoms"],["Streetwear","Sweatpants",14,"Bottoms"],["Streetwear","Jorts",15,"Bottoms"],["Streetwear","Cargo Pants",16,"Bottoms"],["Streetwear","Cargo Skirts",17,"Bottoms"],
    ["Streetwear","Hoodies and Joggers Set",18,"Sets"],["Streetwear","T-shirt and Shorts Set",19,"Sets"],["Streetwear","T-shirt and Sweatpants Set",20,"Sets"],["Streetwear","Sweatshirt and Shorts Sets",21,"Sets"],["Streetwear","Sweatshirts and Sweatpants Set",22,"Sets"],
    ["Streetwear","Others",23,"Others"]
];

const DEFAULT_LADIES_PRODUCTS = [
    ["Ladies Wear","Short gown/dress",1,"Dresses and Gowns"],["Ladies Wear","Long gown/dress",2,"Dresses and Gowns"],["Ladies Wear","Corset gown/dress (short)",3,"Dresses and Gowns"],["Ladies Wear","Corset gown/dress (long)",4,"Dresses and Gowns"],["Ladies Wear","Bubu",5,"Dresses and Gowns"],["Ladies Wear","Kaftan",6,"Dresses and Gowns"],["Ladies Wear","Bubu Kaftan",7,"Dresses and Gowns"],
    ["Ladies Wear","Top/blouse",8,"Tops & Blouses"],["Ladies Wear","Corset top",9,"Tops & Blouses"],["Ladies Wear","Base corset",10,"Tops & Blouses"],
    ["Ladies Wear","Trousers",11,"Bottoms"],["Ladies Wear","Palazzo pants",12,"Bottoms"],["Ladies Wear","Palazzo shorts",13,"Bottoms"],["Ladies Wear","Wrap shorts",14,"Bottoms"],
    ["Ladies Wear","Trousers & short top",15,"Two-Piece Outfits"],["Ladies Wear","Trousers & long top",16,"Two-Piece Outfits"],["Ladies Wear","Skirt & short top",17,"Two-Piece Outfits"],["Ladies Wear","Skirt & long top",18,"Two-Piece Outfits"],
    ["Ladies Wear","Standard kaba and slit/skirt",19,"Kaba and Slit/Skirt"],["Ladies Wear","Kaba & slit/skirt (with corset)",20,"Kaba and Slit/Skirt"],["Ladies Wear","Kaba & slit/skirt (kente)",21,"Kaba and Slit/Skirt"],["Ladies Wear","Others",22,"Others"]
];
const DEFAULT_EMBELLISHMENT_PRODUCTS = [
    ["Embellishment Services","Rhinestone Embellishment",1,"Embellishment"],["Embellishment Services","Screen Printing",2,"Embellishment"],["Embellishment Services","Fabric Painting",3,"Embellishment"],["Embellishment Services","Glitter Works",4,"Embellishment"],["Embellishment Services","Others",5,"Embellishment"]
];

const STREETWEAR_CANONICAL_NAMES = DEFAULT_PRODUCTS.map(item => item[1]);

const LEGACY_STREETWEAR_NAMES = new Set([
    "jerseys", "joggers — super thick cotton joggers", "joggers — everyday wear type",
    "t-shirts", "t-shirt sample", "polo shirts", "sweatshirts", "ladies tank tops", "men's tank tops",
    "varsity jackets", "jogger shorts",
    "hoodies & joggers set", "hoodies and joggers", "t-shirts & shorts set", "t-shirt & sweatpants set",
    "sweatshirts & shorts set", "sweatshirts & sweatpants set"
]);

function productKeyFromName(name) {
    return "product_" + String(name || "").toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
}

function catalogueKeyFromName(name) {
    return String(name || "").toLowerCase().trim().replace(/&/g,"and").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
}

async function safeSettingUpsert(key, value) {
    const now = new Date().toISOString();
    const existing = await db.from("settings").select("id").eq("setting_key", key).order("id", {ascending:true});
    if (existing.error) throw existing.error;
    const ids = (existing.data || []).map(r => r.id);
    let result;
    if (ids.length) {
        result = await db.from("settings").update({setting_value:value, updated_at:now}).eq("id", ids[0]);
        if (result.error) throw result.error;
        if (ids.length > 1) {
            const dup = await db.from("settings").delete().in("id", ids.slice(1));
            if (dup.error) console.warn("Duplicate setting cleanup failed:", dup.error);
        }
    } else {
        result = await db.from("settings").insert({setting_key:key, setting_value:value, updated_at:now});
        if (result.error) throw result.error;
    }
    if (window._aprilsAuditReady && !String(key || "").startsWith("audit_event_")) {
        try {
            const actor = await getCurrentStaffIdentity();
            const eventId = makeAprilsUniqueId("AUD");
            await db.from("settings").insert({
                setting_key: "audit_event_" + contentSlug(eventId),
                setting_value: JSON.stringify({
                    eventId,
                    entityType: "settings",
                    entityId: String(key || ""),
                    action: "saved",
                    actorId: actor.staffId,
                    actorEmail: actor.email,
                    at: now
                }),
                updated_at: now
            });
        } catch (_) {}
    }
    return result;
}

function makeAprilsUniqueId(prefix = "ENT") {
    const stamp = Date.now().toString(36).toUpperCase();
    const random = (crypto?.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2)).slice(0, 8).toUpperCase();
    return `${prefix}-${stamp}-${random}`;
}

async function getCurrentStaffIdentity() {
    try {
        const sessionResult = await db?.auth?.getSession();
        const user = sessionResult?.data?.session?.user;
        if (!user?.id) return { staffId: "CUSTOMER", email: "", name: "Customer" };
        const key = "staff_identity_" + user.id;
        const existing = await db.from("settings").select("id,setting_value").eq("setting_key", key).maybeSingle();
        if (!existing.error && existing.data?.setting_value) {
            try {
                const parsed = JSON.parse(existing.data.setting_value);
                if (parsed.staffId) return {...parsed, email: parsed.email || user.email || ""};
            } catch (_) {}
        }
        const identity = {
            staffId: makeAprilsUniqueId("STF"),
            email: String(user.email || "").trim().toLowerCase(),
            name: String(user.user_metadata?.full_name || user.email || "Staff").trim(),
            createdAt: new Date().toISOString()
        };
        await db.from("settings").upsert({
            setting_key: key,
            setting_value: JSON.stringify(identity),
            updated_at: new Date().toISOString()
        }, {onConflict:"setting_key"});
        return identity;
    } catch (_) {
        return { staffId: "STAFF-UNAVAILABLE", email: "", name: "Staff" };
    }
}

async function auditSystemEvent(entityType, entityId, action, details = {}) {
    try {
        if (!db) return;
        const actor = await getCurrentStaffIdentity();
        const eventId = makeAprilsUniqueId("AUD");
        await safeSettingUpsert("audit_event_" + contentSlug(eventId), JSON.stringify({
            eventId,
            entityType,
            entityId: String(entityId || ""),
            action,
            actorId: actor.staffId,
            actorEmail: actor.email,
            details,
            at: new Date().toISOString()
        }));
    } catch (_) {}
}

async function seedDefaultProducts() {
    try {
        const marker = await db.from("settings").select("id").eq("setting_key","products_catalogue_seeded").limit(1);
        if (marker.error) return;
        const existingProducts = await db.from("settings").select("id").like("setting_key","product_%");
        if (existingProducts.error) return;
        // Seed defaults only when there are no product records at all. Do not
        // recreate products a user intentionally deleted.
        if ((existingProducts.data || []).length > 0) return;
        for (const [category,name,order,subcategory] of [...DEFAULT_PRODUCTS, ...DEFAULT_LADIES_PRODUCTS, ...DEFAULT_EMBELLISHMENT_PRODUCTS]) {
            const key = productKeyFromName(name);
            const existing = await db.from("settings").select("id").eq("setting_key",key).limit(1);
            if (existing.error || existing.data?.length) continue;
            await db.from("settings").insert({
                setting_key:key,
                setting_value:JSON.stringify({name,category,price:null,public_price:null,subcategory:subcategory||"",notes:"",display_order:order,active:true}),
                updated_at:new Date().toISOString()
            });
        }
        await db.from("settings").insert({
            setting_key:"products_catalogue_seeded",
            setting_value:"true",
            updated_at:new Date().toISOString()
        });
    } catch (e) {
        console.warn("Product catalogue seed unavailable:", e);
    }
}


async function ensureStreetwearCatalogue() {
    try {
        const result = await db.from("settings").select("id,setting_key,setting_value,created_at,updated_at").like("setting_key","product_%");
        if (result.error) return;
        const rows = result.data || [];
        const legacyRenames = new Map([
            ["everyday wear type", "Everyday Wear Type of Joggers"],
            ["joggers — everyday wear type", "Everyday Wear Type of Joggers"],
            ["joggers everyday wear type", "Everyday Wear Type of Joggers"],
            ["joggers — super thick cotton joggers", "Super Thick Cotton Joggers"],
            ["jerseys", "Jersey"], ["t-shirts", "T-Shirt"], ["polo shirts", "Polo Shirt"],
            ["sweatshirts", "Sweatshirt"], ["ladies tank tops", "Ladies Tank Top"], ["men's tank tops", "Men's tank top"],
            ["varsity jackets", "Varsity Jacket"], ["jogger shorts", "Joggers Short"],
            ["t shirts and shorts", "T-shirt and shorts"], ["t shirt sweatpants set", "T-shirt and sweatpants"],
            ["sweatshirts and shorts", "Sweatshirt and shorts"], ["sweatshirts and sweatpants", "Sweatshirt and sweatpants"]
        ]);
        for (const row of rows) {
            let item={}; try{item=JSON.parse(row.setting_value||"{}")}catch(_){}
            const name=String(item.name||"").trim(); const lower=name.toLowerCase();
            if (lower === "add-ons" || lower === "addons") { await db.from("settings").delete().eq("id",row.id); continue; }
            const rename=legacyRenames.get(lower);
            if (rename && rename !== name) {
                const newKey=productKeyFromName(rename);
                const existing=await db.from("settings").select("id").eq("setting_key",newKey).limit(1);
                if (existing.data?.length) await db.from("settings").delete().eq("id",row.id);
                else await db.from("settings").update({setting_key:newKey,setting_value:JSON.stringify({...item,name:rename}),updated_at:new Date().toISOString()}).eq("id",row.id);
            }
        }
        // These two public sample options are explicitly part of the current
        // Streetwear catalogue. Add them once if they are not already present.
        for (const [category,name,order,subcategory] of [["Streetwear","Jersey Sample",1.5,"Tops"],["Streetwear","T-Shirt Sample",2.5,"Tops"]]) {
            const key = productKeyFromName(name);
            const exists = await db.from("settings").select("id").eq("setting_key",key).limit(1);
            if (!exists.error && !exists.data?.length) {
                await db.from("settings").insert({
                    setting_key:key,
                    setting_value:JSON.stringify({name,category,public_price:null,subcategory,notes:"",display_order:order,active:true,catalogue_key:catalogueKeyFromName(name)}),
                    updated_at:new Date().toISOString()
                });
            }
        }

        // Add the specifically requested new catalogue items once. These are
        // new catalogue entries, not a recreation of any product the admin may
        // have deliberately deleted from the older catalogue.
        const requestedNewProducts = [
            ["Streetwear","Hoodies and Joggers Set",18,"Sets"],
            ["Streetwear","T-shirt and Shorts Set",19,"Sets"],
            ["Streetwear","T-shirt and Sweatpants Set",20,"Sets"],
            ["Streetwear","Sweatshirt and Shorts Sets",21,"Sets"],
            ["Streetwear","Sweatshirts and Sweatpants Set",22,"Sets"],
            ["Ladies Wear","Customised / Embellished Bubu",6,"Dresses and Gowns"],
            ["Ladies Wear","Customised / Embellished Kaftan",8,"Dresses and Gowns"],
            ["Ladies Wear","Customised / Embellished Bubu Kaftan",10,"Dresses and Gowns"],
        ];
        for (const [category,name,order,subcategory] of requestedNewProducts) {
            const key = productKeyFromName(name);
            const exists = await db.from("settings").select("id").eq("setting_key",key).limit(1);
            if (!exists.error && !exists.data?.length) {
                await db.from("settings").insert({
                    setting_key:key,
                    setting_value:JSON.stringify({name,category,public_price:null,subcategory,notes:"",display_order:order,active:true,catalogue_key:catalogueKeyFromName(name)}),
                    updated_at:new Date().toISOString()
                });
            }
        }

        const obsoleteStreetwear = new Set(["hoodies and sweatpants", "hoodies & sweatpants set", "hoodies sweatpants set"]);
        for (const row of rows) {
            let item={}; try{item=JSON.parse(row.setting_value||"{}")}catch(_){continue;}
            if (String(item.category||"").trim().toLowerCase()==="streetwear" && obsoleteStreetwear.has(String(item.name||"").trim().toLowerCase())) {
                try { await db.from("settings").delete().eq("id",row.id); } catch (_) {}
            }
        }

        // Do not recreate products removed from the existing catalogue. Existing
        // rows are normalised only.
        const knownOrders = new Map([...DEFAULT_PRODUCTS,...DEFAULT_LADIES_PRODUCTS,...DEFAULT_EMBELLISHMENT_PRODUCTS].map(x=>[x[1].toLowerCase(),x]));
        for (const row of rows) {
            let current={}; try{current=JSON.parse(row.setting_value||"{}")}catch(_){continue;}
            const canonical=knownOrders.get(String(current.name||"").trim().toLowerCase());
            if (!canonical) continue;
            const [category,name,order,subcategory]=canonical;
            const next={...current,name,category,subcategory,display_order:current.display_order ?? order,catalogue_key:current.catalogue_key || catalogueKeyFromName(name)};
            await db.from("settings").update({setting_value:JSON.stringify(next),updated_at:new Date().toISOString()}).eq("id",row.id);
        }
        await safeSettingUpsert("streetwear_catalogue_normalized_v4","true");
    } catch (e) { console.warn("Catalogue normalisation skipped:", e); }
}

async function getProducts() {
    await seedDefaultProducts();
    const result = await db.from("settings").select("id,setting_key,setting_value,updated_at")
        .like("setting_key","product_%").order("updated_at",{ascending:true});
    if (result.error) throw result.error;
    return (result.data || []).map(row => {
        let item={};
        try { item=JSON.parse(row.setting_value || "{}"); } catch (_) {}
        return {...item,id:row.id,setting_key:row.setting_key};
    }).filter(row => row.name);
}

function focusAdminForm(formId, focusId) {
    const form = document.getElementById(formId);
    if (!form) return false;
    form.scrollIntoView({behavior:"smooth", block:"center", inline:"nearest"});
    setTimeout(() => document.getElementById(focusId)?.focus(), 250);
    return true;
}

function returnToAdminList(selector, id) {
    setTimeout(() => {
        const target = id ? document.querySelector(`${selector}="${CSS.escape(String(id))}"`) : null;
        const list = target || document.querySelector(selector.replace(/\[data-[^=]+=[^\]]+\]/,""));
        (target || list)?.scrollIntoView({behavior:"smooth", block:"center", inline:"nearest"});
        if (target) {
            target.classList.add("admin-return-highlight");
            setTimeout(() => target.classList.remove("admin-return-highlight"), 1800);
        }
    }, 80);
}

async function loadProducts() {
    const list=document.getElementById("adminProductsList"); if(!list)return;
    await ensureStreetwearCatalogue();
    const rows=await getProducts();
    const settings=await getRows("settings"); const invoiceMap=new Map();
    settings.filter(r=>String(r.setting_key||"").startsWith("invoice_price_")).forEach(r=>{try{const x=JSON.parse(r.setting_value||"{}");if(x.name)invoiceMap.set(String(x.name).trim().toLowerCase(),x);}catch(_){}});
    rows.sort((a,b)=>Number(a.display_order||9999)-Number(b.display_order||9999));
    list.innerHTML=rows.length?`<table><thead><tr><th>Product / Service</th><th>Category</th><th>Group</th><th>Public Price (GHS)</th><th>Invoice Price (GHS)</th><th>Order</th><th>Active</th><th>Actions</th></tr></thead><tbody>${rows.map(r=>{const i=invoiceMap.get(String(r.name||"").trim().toLowerCase());return `<tr><td>${escapeHTML(r.name)}</td><td>${escapeHTML(r.category||"")}</td><td>${escapeHTML(r.subcategory||"")}</td><td>${r.public_price!==undefined && r.public_price!==null && r.public_price!==""?`GHS ${Number(r.public_price).toFixed(2)}`:"—"}</td><td>${i?.price!==undefined?`GHS ${Number(i.price).toFixed(2)}`:"—"}</td><td>${escapeHTML(r.display_order??1)}</td><td>${r.active!==false?"Yes":"No"}</td><td><button type="button" class="secondary" data-edit-product="${escapeHTML(r.id)}">Edit</button> <button type="button" class="danger" data-delete-product="${escapeHTML(r.id)}">Delete</button></td></tr>`;}).join("")}</tbody></table>`:`<div class="empty">No products / services have been added yet.</div>`;
    list.querySelectorAll("[data-edit-product]").forEach(b=>b.onclick=()=>{const r=rows.find(x=>String(x.id)===String(b.dataset.editProduct));if(!r)return;const i=invoiceMap.get(String(r.name||"").trim().toLowerCase());document.getElementById("adminProductId").value=r.id;document.getElementById("adminProductTitle").value=r.name||"";document.getElementById("adminProductCategory").value=r.category||"Streetwear";document.getElementById("adminProductPublicPrice").value=r.public_price??"";document.getElementById("adminProductInvoicePrice").value=i?.price??"";document.getElementById("adminProductOrder").value=r.display_order??1;document.getElementById("adminProductSubcategory").value=r.subcategory||"";document.getElementById("adminProductNotes").value=i?.notes||r.notes||"";document.getElementById("adminProductActive").checked=r.active!==false;focusAdminForm("adminProductForm","adminProductTitle");});
    list.querySelectorAll("[data-delete-product]").forEach(b=>b.onclick=async()=>{const r=rows.find(x=>String(x.id)===String(b.dataset.deleteProduct));if(!r||!confirm(`Delete "${r.name}"?`))return;const q=await db.from("settings").delete().eq("id",b.dataset.deleteProduct);if(q.error){message("Product / service could not be deleted: "+q.error.message,"error");return;}try{await db.from("settings").delete().eq("setting_key",invoiceStorageKey(r.name));}catch(_){}message("Product / service deleted.","success");await loadProducts();});
}

function setupProductForm() {
    const form = document.getElementById("adminProductForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const getEl = id => document.getElementById(id);
        const required = ["adminProductId","adminProductTitle","adminProductCategory","adminProductPublicPrice","adminProductOrder","adminProductNotes","adminProductActive"];
        const missing = required.filter(id => !getEl(id));
        if (missing.length) { message("Product form is incomplete: " + missing.join(", "), "error"); return; }
        const id = getEl("adminProductId").value.trim();
        const name = getEl("adminProductTitle").value.trim();
        const category = getEl("adminProductCategory").value.trim();
        const publicPriceValue = getEl("adminProductPublicPrice").value;
        const publicPrice = publicPriceValue === "" ? null : Number(publicPriceValue);
        const invoicePriceValue = getEl("adminProductInvoicePrice")?.value ?? "";
        const invoicePrice = invoicePriceValue === "" ? null : Number(invoicePriceValue);
        const payload = {
            name,
            category,
            public_price: publicPrice,
            subcategory: getEl("adminProductSubcategory")?.value.trim() || "",
            notes: getEl("adminProductNotes").value.trim(),
            display_order: Number(getEl("adminProductOrder").value) || 1,
            active: getEl("adminProductActive").checked
        };

        if (!name) {
            message("Please enter a product name.", "error");
            return;
        }

        try {
            let oldKey = "";

            let oldItem = {};
            if (id) {
                const old = await db.from("settings").select("setting_key,setting_value").eq("id", id).maybeSingle();
                if (old.error) throw old.error;
                oldKey = old.data?.setting_key || "";
                try { oldItem = JSON.parse(old.data?.setting_value || "{}"); } catch (_) { oldItem = {}; }
            }

            const newKey = productKeyFromName(name);
            const sameKeyRows = await db.from("settings").select("id").eq("setting_key", newKey);
            if (sameKeyRows.error) throw sameKeyRows.error;
            const conflicting = (sameKeyRows.data || []).some(r => String(r.id) !== String(id));
            if (conflicting) {
                message("A product with that name already exists. Edit the existing product instead.", "error");
                return;
            }

            if (id) {
                const savedPayload = {...payload, catalogue_key: oldItem.catalogue_key || catalogueKeyFromName(oldItem.name || name)};
                const updated = await db.from("settings")
                    .update({setting_key:newKey, setting_value:JSON.stringify(savedPayload), updated_at:new Date().toISOString()})
                    .eq("id", id);
                if (updated.error) throw updated.error;
            } else {
                await safeSettingUpsert(newKey, JSON.stringify({...payload, catalogue_key: catalogueKeyFromName(name)}));
            }

            // Keep the private invoice price synchronized with this product form.
            const oldInvoiceKey = oldItem.name ? invoiceStorageKey(oldItem.name) : "";
            const newInvoiceKey = invoiceStorageKey(name);
            if (oldInvoiceKey && oldInvoiceKey !== newInvoiceKey) {
                const oldInvoice = await db.from("settings").select("id,setting_value").eq("setting_key", oldInvoiceKey).limit(1);
                if (!oldInvoice.error && oldInvoice.data?.length) {
                    await db.from("settings").delete().eq("id", oldInvoice.data[0].id);
                }
            }
            if (invoicePrice === null) {
                await db.from("settings").delete().eq("setting_key", newInvoiceKey);
            } else {
                await safeSettingUpsert(newInvoiceKey, JSON.stringify({name,category:category||"Products / Services",price:invoicePrice,notes:payload.notes||"",active:payload.active}));
            }

            // Remove any remaining exact-key duplicates while retaining the record just saved.
            const duplicateRows = await db.from("settings").select("id").eq("setting_key", newKey);
            if (duplicateRows.error) throw duplicateRows.error;
            const duplicateIds = (duplicateRows.data || []).map(r=>r.id).filter(rowId=>String(rowId)!==String(id));
            if (duplicateIds.length) {
                const del = await db.from("settings").delete().in("id", duplicateIds);
                if (del.error) throw del.error;
            }

            // Invoice pricing is intentionally separate from the public product catalogue.
            form.reset();
            document.getElementById("adminProductId").value = "";
            document.getElementById("adminProductActive").checked = true;
            document.getElementById("adminProductOrder").value = 1;
            document.getElementById("adminProductInvoicePrice").value = "";
            document.getElementById("adminProductSubcategory").value = "";
            message("Product saved successfully.", "success");
            await loadProducts();
            returnToAdminList("[data-edit-product]", id || null);
        } catch (error) {
            console.error(error);
            message("Product could not be saved: " + error.message, "error");
        }
    });

    document.getElementById("adminProductCancel")?.addEventListener("click", () => {
        form.reset();
        document.getElementById("adminProductId").value = "";
        document.getElementById("adminProductActive").checked = true;
        document.getElementById("adminProductOrder").value = 1;
        document.getElementById("adminProductSubcategory").value = "";
    });
}


/* =========================================================
   HOMEPAGE FEATURED MEDIA — SEPARATE FROM GALLERY
   Stored in settings as homepage_featured_* records.
========================================================= */

function homepageMediaKey(title, url = "") {
    return "homepage_featured_" + contentSlug(String(title || "") + "_" + String(url || ""));
}

async function getHomepageMediaRows() {
    const rows = await getRows("settings");
    const source = rows.filter(r => String(r.setting_key || "").startsWith("homepage_featured_"))
        .map(r => {
            let item = {};
            try { item = JSON.parse(r.setting_value || "{}"); } catch (_) {}
            return { ...item, id: r.id, setting_key: r.setting_key };
        })
        .filter(r => r.title && r.url);

    // Remove exact homepage duplicates created by earlier versions.
    const seen = new Map();
    const unique = [];
    for (const row of source) {
        const key = String(row.title).trim().toLowerCase() + "\u0000" + String(row.url).trim();
        if (seen.has(key)) {
            try { await db.from("settings").delete().eq("id", row.id); } catch (_) {}
            continue;
        }
        seen.set(key, row.id);
        unique.push(row);
    }

    // If the separate homepage library has not yet been created, import the
    // current featured gallery media once so the admin never starts empty.
    if (!unique.length) {
        try {
            const featured = await db.from("gallery_items")
                .select("title,image_url,description,display_order,featured,active")
                .eq("featured", true).eq("active", true)
                .order("display_order", {ascending:true});
            if (!featured.error && featured.data?.length) {
                for (const row of featured.data) {
                    const key = homepageMediaKey(row.title || "Featured Media", row.image_url || "");
                    const value = JSON.stringify({
                        title: row.title || "Featured Collection",
                        url: row.image_url || "",
                        order: row.display_order || 1,
                        description: row.description || "",
                        active: true
                    });
                    await safeSettingUpsert(key, value);
                }
                return getHomepageMediaRows();
            }
        } catch (_) {}
    }
    return unique;
}

async function loadHomepageCollectionName() {
    const input = document.getElementById("homepageCollectionName");
    if (!input) return;
    try {
        const row = await getSettingValue("homepage_featured_collection_name");
        input.value = row?.setting_value || "Featured Collection";
    } catch (_) {
        input.value = "Featured Collection";
    }
}

function setupHomepageCollectionNameForm() {
    const form = document.getElementById("homepageCollectionNameForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";
    form.addEventListener("submit", async event => {
        event.preventDefault();
        const value = document.getElementById("homepageCollectionName").value.trim() || "Featured Collection";
        try {
            await safeSettingUpsert("homepage_featured_collection_name", value);
            message("Homepage collection name saved.", "success");
        } catch (error) {
            message("Homepage collection name could not be saved: " + error.message, "error");
        }
    });
    loadHomepageCollectionName();
}

async function loadHomepageMedia() {
    const list = document.getElementById("homepageMediaList");
    if (!list) return;

    const rows = await getHomepageMediaRows();
    rows.sort((a,b) => Number(a.order || 9999) - Number(b.order || 9999));

    list.innerHTML = rows.length ? `
        <table>
            <thead><tr><th>Media</th><th>Title</th><th>Order</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
            ${rows.map(r => `
                <tr>
                    <td>${/\.(mp4|webm|ogg)(\?|$)/i.test(r.url || "")
                        ? `<video src="${escapeHTML(resolveAdminMediaUrl(r.url))}" muted loop autoplay playsinline style="width:110px;height:75px;object-fit:cover"></video>`
                        : `<img src="${escapeHTML(resolveAdminMediaUrl(r.url))}" alt="" style="width:110px;height:75px;object-fit:cover">`}
                    </td>
                    <td>${escapeHTML(r.title)}</td>
                    <td><input type="number" min="1" value="${escapeHTML(r.order ?? 1)}" data-homepage-order="${escapeHTML(r.id)}" style="max-width:90px"></td>
                    <td>${r.active === false ? "Hidden" : "Visible"}</td>
                    <td>
                        <button type="button" class="secondary" data-save-homepage-order="${escapeHTML(r.id)}">Save Order</button>
                        <button type="button" class="secondary" data-edit-homepage="${escapeHTML(r.id)}">Edit</button>
                        <button type="button" class="danger" data-delete-homepage="${escapeHTML(r.id)}">Delete</button>
                    </td>
                </tr>`).join("")}
            </tbody>
        </table>
    ` : `<div class="empty">No homepage featured media has been added yet.</div>`;

    list.querySelectorAll("[data-save-homepage-order]").forEach(button => {
        button.onclick = async () => {
            const id = button.dataset.saveHomepageOrder;
            const input = list.querySelector(`[data-homepage-order="${id}"]`);
            const row = rows.find(r => String(r.id) === String(id));
            if (!row) return;
            const value = Math.max(1, Number(input?.value || 1));
            try {
                const result = await db.from("settings").update({
                    setting_value: JSON.stringify({...row, id:undefined, order:value})
                }).eq("id", id);
                if (result.error) throw result.error;
                message("Homepage featured order saved.", "success");
                await loadHomepageMedia();
            } catch (error) {
                message("Homepage featured order could not be saved: " + error.message, "error");
            }
        };
    });

    list.querySelectorAll("[data-edit-homepage]").forEach(button => {
        button.onclick = () => {
            const row = rows.find(r => String(r.id) === String(button.dataset.editHomepage));
            if (!row) return;
            document.getElementById("homepageMediaId").value = row.id || "";
            document.getElementById("homepageMediaTitle").value = row.title || "";
            document.getElementById("homepageMediaUrl").value = row.url || "";
            document.getElementById("homepageMediaOrder").value = row.order ?? 1;
            document.getElementById("homepageMediaDescription").value = row.description || "";
            document.getElementById("homepageMediaActive").checked = row.active !== false;
            document.getElementById("homepageMediaForm").scrollIntoView({behavior:"smooth",block:"start"});
        };
    });

    list.querySelectorAll("[data-delete-homepage]").forEach(button => {
        button.onclick = async () => {
            if (!confirm("Delete this homepage featured media?")) return;
            const result = await db.from("settings").delete().eq("id", button.dataset.deleteHomepage);
            if (result.error) {
                message("Homepage media could not be deleted: " + result.error.message, "error");
                return;
            }
            message("Homepage media deleted.", "success");
            await loadHomepageMedia();
        };
    });
}

function setupHomepageMediaForm() {
    const form = document.getElementById("homepageMediaForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const id = document.getElementById("homepageMediaId").value.trim();
        const title = document.getElementById("homepageMediaTitle").value.trim();
        const url = document.getElementById("homepageMediaUrl").value.trim();
        const order = Number(document.getElementById("homepageMediaOrder").value) || 1;
        const description = document.getElementById("homepageMediaDescription").value.trim();
        const active = document.getElementById("homepageMediaActive").checked;

        if (!title || !url) {
            message("Please enter a title and image/video URL.", "error");
            return;
        }

        const value = JSON.stringify({title, url, order, description, active});
        try {
            if (id) {
                const result = await db.from("settings")
                    .update({setting_value:value, updated_at:new Date().toISOString()})
                    .eq("id", id);
                if (result.error) throw result.error;
            } else {
                await safeSettingUpsert(homepageMediaKey(title, url), value);
            }

            form.reset();
            document.getElementById("homepageMediaId").value = "";
            document.getElementById("homepageMediaOrder").value = 1;
            document.getElementById("homepageMediaActive").checked = true;
            message("Homepage featured media saved.", "success");
            await loadHomepageMedia();
        } catch (error) {
            message("Homepage media could not be saved: " + error.message, "error");
        }
    });

    document.getElementById("homepageMediaCancel")?.addEventListener("click", () => {
        form.reset();
        document.getElementById("homepageMediaId").value = "";
        document.getElementById("homepageMediaOrder").value = 1;
        document.getElementById("homepageMediaActive").checked = true;
    });
}

/* =========================================================
   QUICK CUSTOMER LINKS
========================================================= */

function setupDirectCustomerLinks() {
    const links = {
        website: new URL("../index.html", window.location.href).href,
        order: new URL("../quotes.html", window.location.href).href,
        training: new URL("../training.html", window.location.href).href,
        gallery: new URL("../gallery.html", window.location.href).href,
        contact: new URL("../contact.html", window.location.href).href,
        policies: new URL("../policies.html", window.location.href).href,
        discount: new URL("../redeem.html", window.location.href).href,
        payment: new URL("../payment.html", window.location.href).href,
        shop: new URL("../shop.html", window.location.href).href,
        googleReview: "https://g.page/r/CcD7hxB7NK7pEAE/review"
    };

    const labels = {
        website: "Main Website",
        order: "Order / Request a Quote",
        training: "Training Registration",
        gallery: "Gallery",
        contact: "Contact",
        policies: "Policies & Terms",
        discount: "Discount Redemption",
        payment: "Payment Details",
        shop: "Shop",
        googleReview: "Leave Us a Google Review"
    };

    const list = document.getElementById("directLinksList");
    if (list) {
        list.innerHTML = Object.entries(links).map(([key, url]) =>
            `<div class="direct-link-row" style="margin:10px 0;padding:10px;border:1px solid #aaa;border-radius:5px;">
                <strong>${labels[key]}:</strong><br>
                <a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(url)}</a>
                <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
                    <button type="button" class="secondary" data-copy-direct-link="${key}">Copy</button>
                    <button type="button" class="secondary" data-share-direct-link="${key}">Share</button>
                </div>
            </div>`
        ).join("");
    }

    document.querySelectorAll("[data-copy-direct-link]").forEach(button => {
        button.onclick = async () => {
            let url = links[button.dataset.copyDirectLink];
            if (!url) return;
            const key = button.dataset.copyDirectLink;
            if (key === "payment") {
                try {
                    const saved = await getSettingValue("invoice_payment_accounts");
                    const accounts = JSON.parse(saved || "[]");
                    if (Array.isArray(accounts) && accounts.length) {
                        url = new URL("../payment.html", window.location.href).href;
                    } else {
                        message("Save the payment details first.", "error");
                        return;
                    }
                } catch (_) { message("The saved payment details could not be read.", "error"); return; }
            }
            try {
                await navigator.clipboard.writeText(url);
                message(key === "payment" ? "Payment link copied with the current payment details." : "Link copied.", "success");
            } catch (_) {
                window.prompt("Copy this direct link:", url);
            }
        };
    });

    document.querySelectorAll("[data-share-direct-link]").forEach(button => {
        button.onclick = async () => {
            let url = links[button.dataset.shareDirectLink];
            if (!url) return;
            const key = button.dataset.shareDirectLink;
            const title = labels[key] || "Aprils Signature";
            if (key === "payment") {
                try {
                    const saved = await getSettingValue("invoice_payment_accounts");
                    const accounts = JSON.parse(saved || "[]");
                    if (Array.isArray(accounts) && accounts.length) {
                        url = new URL("../payment.html", window.location.href).href;
                    }
                } catch (_) {}
            }
            if (navigator.share) {
                try {
                    await navigator.share({title, text: "Aprils Signature — " + title, url});
                    return;
                } catch (_) {}
            }
            window.open("https://wa.me/?text=" + encodeURIComponent("Aprils Signature — " + title + "\n" + url), "_blank", "noopener,noreferrer");
        };
    });
}

/* =========================================================
   MANUAL INVOICE GENERATOR
========================================================= */

function normalizeInvoiceName(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function getInvoicePriceMap() {
    const rows = await getRows("settings");
    const map = new Map();

    rows.filter(r => String(r.setting_key || "").startsWith("invoice_price_")).forEach(r => {
        try {
            const item = JSON.parse(r.setting_value || "{}");
            if (item.name) map.set(normalizeInvoiceName(item.name), Number(item.price) || 0);
        } catch (_) {}
    });

    return map;
}

function invoicePriceFor(map, name) {
    const normalized = normalizeInvoiceName(name);
    if (map.has(normalized)) return map.get(normalized) ?? 0;

    // Training prices are stored as "Training - Programme Name".
    const trainingKey = normalizeInvoiceName("Training - " + name);
    if (map.has(trainingKey)) return map.get(trainingKey) ?? 0;

    // Be tolerant of common product-name punctuation / set-name differences.
    const aliases = {
        "three months beginners fashion training": ["3 months beginners fashion training", "three months beginners fashion training"],
        "six months fashion training": ["6 months fashion training", "six months fashion training"],
        "one year fashion training": ["1 year fashion training", "one year fashion training"],
        "three years apprenticeship training": ["3 years apprenticeship training", "three years apprenticeship training"],
        "jersey": ["jerseys", "jersey"],
        "t shirt": ["t shirts", "t shirt"],
        "t shirts": ["t shirts", "t shirt"],
        "polo shirt": ["polo shirts", "polo shirt"],
        "hoodies joggers set": ["hoodies joggers set", "hoodies and joggers"],
        "hoodies and joggers": ["hoodies joggers set", "hoodies and joggers"],
        "joggers super thick cotton joggers": ["joggers super thick cutting joggers", "joggers super thick cotton joggers", "super thick cutting joggers"],
        "super thick cutting joggers": ["joggers super thick cutting joggers", "joggers super thick cotton joggers", "super thick cutting joggers"],
        "everyday wear type": ["joggers everyday wear type", "everyday wear type"],
        "joggers shorts": ["jogger shorts", "joggers shorts"],
        "t shirt shorts set": ["t shirts shorts set", "t shirt shorts set", "t-shirt and shorts"],
        "t shirt sweatpants set": ["t shirt sweatpants set", "t-shirt and sweatpants"],
        "sweatshirt shorts set": ["sweatshirts shorts set", "sweatshirt and shorts"],
        "sweatshirt sweatpants set": ["sweatshirts sweatpants set", "sweatshirt and sweatpants"]
    };
    for (const alias of (aliases[normalized] || [])) {
        const key = normalizeInvoiceName(alias);
        if (map.has(key)) return map.get(key) ?? 0;
    }
    // Last-resort exact word-normalised matching for legacy names.
    for (const [key, value] of map.entries()) {
        if (key === normalized || key.replace(/^training /, "") === normalized) return value ?? 0;
    }
    return 0;
}

function buildInvoiceLinesFromQuote(row, details, priceMap) {
    if (Array.isArray(details?.manualLines)) {
        return details.manualLines.map(line => ({
            description: String(line.description || "").trim(),
            quantity: Math.max(1, Number(line.quantity || 1)),
            unitPrice: Number(line.unitPrice || invoicePriceFor(priceMap, line.description) || 0),
            details: String(line.details || "")
        })).filter(line => line.description);
    }

    const lines = [];

    if (details?.streetwear && typeof details.streetwear === "object") {
        Object.values(details.streetwear).forEach(item => {
            if (!item) return;
            const product = typeof item === "object" ? (item.product || "") : "";
            const quantity = typeof item === "object" ? Number(item.quantity || 0) : Number(item || 0);
            if (!product || quantity <= 0) return;
            lines.push({
                description: product,
                quantity,
                unitPrice: invoicePriceFor(priceMap, product),
                details: [item.size, item.measurements, item.colour, item.details].filter(Boolean).join(" • ")
            });
        });
    }

    if (details?.ladiesWearProducts && typeof details.ladiesWearProducts === "object") {
        Object.values(details.ladiesWearProducts).forEach(item => {
            if (!item) return;
            const product = item.product || "Ladies Wear";
            const quantity = Math.max(1, Number(item.quantity || 1));
            lines.push({description: product, quantity, unitPrice: invoicePriceFor(priceMap, product), details: [item.size, (item.measurements && String(item.measurements).trim() !== String(item.size || "").trim() ? item.measurements : ""), item.colour, item.details].filter(Boolean).join(" • ")});
        });
    }

    const simpleLines = [
        ["Ladies Wear", details?.ladiesWearQuantity, details?.ladiesWear, details?.ladiesWearSize, details?.ladiesWearColour],
        ["Kids Wear", details?.kidsWearQuantity, details?.kidsWear, details?.kidsWearSize, details?.kidsWearColour]
    ];
    simpleLines.forEach(([name, qty, request, size, colour]) => {
        if (name === "Ladies Wear" && details?.ladiesWearProducts && Object.keys(details.ladiesWearProducts).length) return;
        const quantity = Number(qty || 0);
        if (quantity > 0 || request) {
            lines.push({
                description: name,
                quantity: quantity || 1,
                unitPrice: invoicePriceFor(priceMap, name),
                details: [size, colour, request].filter(Boolean).join(" • ")
            });
        }
    });

    if (details?.serviceOtherDetails && (details.serviceOtherDetails.quantity || details.serviceOtherDetails.details || details.serviceOtherDetails.size || details.serviceOtherDetails.measurements || details.serviceOtherDetails.colour)) {
        const a=details.serviceOtherDetails;
        lines.push({description:"Others",quantity:Math.max(1,Number(a.quantity||1)),unitPrice:invoicePriceFor(priceMap,"Others"),details:[a.size || a.measurements,a.colour,a.details].filter(Boolean).join(" • ")});
    }

    if (Array.isArray(details?.embellishment)) {
        details.embellishment.forEach(serviceName => {
            const item = details.embellishmentDetails?.[serviceName] || {};
            const request = item.details || details.embellishmentOther || "";
            lines.push({
                description: serviceName,
                quantity: Math.max(1, Number(item.quantity || 1)),
                unitPrice: invoicePriceFor(priceMap, serviceName),
                details: [item.size, item.measurements, item.colour, request].filter(Boolean).join(" • ")
            });
        });
    }

    if (details?.training) {
        const trainingName = String(row?.course || details.training || "").trim();
        lines.push({
            description: trainingName || "Training / Programme / Class",
            quantity: 1,
            unitPrice: invoicePriceFor(priceMap, trainingName) || invoicePriceFor(priceMap, "Training - " + trainingName),
            details: details.training
        });
    }

    return lines;
}


function invoicePaymentStorageKey(invoiceNumber, stamp) {
    return "invoice_payment_record_" + contentSlug(invoiceNumber) + "_" + String(stamp || Date.now());
}

async function getInvoicePayments(invoiceNumber) {
    let rows = [];
    try { rows = await getRows("settings"); } catch (_) {}
    const online = rows
        .filter(r => String(r.setting_key || "").startsWith("invoice_payment_record_"))
        .map(r => {
            try { return { ...JSON.parse(r.setting_value || "{}"), id: r.id, key: r.setting_key }; }
            catch (_) { return null; }
        })
        .filter(r => r && String(r.invoiceNumber || "") === String(invoiceNumber || ""));
    let offline = [];
    try {
        offline = JSON.parse(localStorage.getItem("aprils_offline_payments") || "[]")
            .filter(r => String(r.invoiceNumber || "") === String(invoiceNumber || ""));
    } catch (_) {}
    return [...online, ...offline].sort((a,b) => String(a.date || "").localeCompare(String(b.date || "")));
}

async function saveInvoicePayment(payment) {
    const key = invoicePaymentStorageKey(payment.invoiceNumber, contentSlug(payment.receiptNumber) || Date.now());
    try {
        if (!db) throw new Error("offline");
        const result = await safeSettingUpsert(key, JSON.stringify(payment));
        // Keep the training workflow synchronized with payment entry.
        // Once the saved training invoice is fully paid, the trainee is in class
        // unless an admin has deliberately marked the registration stopped/completed.
        try {
            const invoice = await getInvoiceSavedRecord(payment.invoiceNumber);
            if (invoice?.sourceId) {
                const payments = await getInvoicePayments(payment.invoiceNumber);
                const paid = payments.reduce((sum,row)=>sum+Number(row.amount||0),0);
                const total = Number(invoice.total||0);
                const training = !!invoice.training;
                const statusPrefix = training ? "training_status" : "quote_status";
                const paymentPrefix = training ? "payment_status_training_" : "payment_status_quote_";
                if (total > 0) {
                    const current = await getAdminRecordStatus(statusPrefix, invoice.sourceId);
                    let paymentStatus = paid >= total ? "paid_in_full" : paid >= total * .75 ? "deposit_paid" : paid > 0 ? "part_paid" : "unpaid";
                    await setAdminRecordStatus(paymentPrefix.replace(/_$/,""), invoice.sourceId, paymentStatus);
                    if (training) {
                        if (!["stopped","completed","in_class"].includes(current)) {
                            await setAdminRecordStatus(statusPrefix, invoice.sourceId, paid >= total ? "fully_paid" : paid > 0 ? "part_paid" : current);
                        }
                    } else if (!["cancelled","completed","ready","dispatched","received","in_production"].includes(current) && paid > 0) {
                        await setAdminRecordStatus(statusPrefix, invoice.sourceId, "order_taken");
                    }
                }
            }
        } catch (_) {}
        return result;
    } catch (error) {
        try {
            const items = JSON.parse(localStorage.getItem("aprils_offline_payments") || "[]");
            items.push({...payment, offlineId:key, savedAt:new Date().toISOString()});
            localStorage.setItem("aprils_offline_payments", JSON.stringify(items));
            message("Payment saved on this device while offline. It can be synchronised when the server is available.", "success");
            return {data:null,error:null,offline:true};
        } catch (_) {
            throw error;
        }
    }
}

async function getInvoiceSavedRecord(invoiceNumber) {
    try {
        const row = await getSettingValue("invoice_record_" + contentSlug(invoiceNumber));
        if (!row?.setting_value) return null;
        return JSON.parse(row.setting_value);
    } catch (_) { return null; }
}

async function saveInvoiceRecord(invoiceNumber, record) {
    const key = "invoice_record_" + contentSlug(invoiceNumber);
    try {
        if (!db) throw new Error("offline");
        return await safeSettingUpsert(key, JSON.stringify(record));
    } catch (error) {
        try {
            const items = JSON.parse(localStorage.getItem("aprils_offline_invoices") || "[]");
            const copy = {...record, offlineKey:key, savedAt:new Date().toISOString()};
            const index = items.findIndex(item => String(item.invoiceNumber) === String(invoiceNumber));
            if (index >= 0) items[index] = copy; else items.push(copy);
            localStorage.setItem("aprils_offline_invoices", JSON.stringify(items));
            message("Invoice saved on this device while offline. It can be synchronised when the server is available.", "success");
            return {data:null,error:null,offline:true};
        } catch (_) {
            throw error;
        }
    }
}


async function setupAccountingForm() {
    const form = document.getElementById("accountingExpenseForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const id = document.getElementById("accountingExpenseId").value.trim();
        const date = document.getElementById("accountingExpenseDate").value || new Date().toISOString().slice(0,10);
        const category = document.getElementById("accountingExpenseCategory").value.trim();
        const amount = Number(document.getElementById("accountingExpenseAmount").value || 0);
        const description = document.getElementById("accountingExpenseDescription").value.trim();
        if (!category || amount <= 0 || !description) {
            message("Enter the expense date, category, amount and description.", "error");
            return;
        }

        const record = JSON.stringify({date, category, amount, description, savedAt:new Date().toISOString()});
        try {
            if (id) {
                const result = await db.from("settings").update({setting_value:record, updated_at:new Date().toISOString()}).eq("id",id);
                if (result.error) throw result.error;
            } else {
                await safeSettingUpsert("accounting_expense_" + contentSlug(date + "_" + category + "_" + description + "_" + Date.now()), record);
            }
            form.reset();
            document.getElementById("accountingExpenseId").value = "";
            document.getElementById("accountingExpenseDate").value = new Date().toISOString().slice(0,10);
            message("Expense saved.", "success");
            await loadAccounting();
        } catch (error) {
            try {
                const local = JSON.parse(localStorage.getItem("aprils_offline_expenses") || "[]");
                const item = {id:id || ("offline-" + Date.now()), date, category, amount, description, savedAt:new Date().toISOString()};
                const index = local.findIndex(x => String(x.id) === String(id));
                if (index >= 0) local[index] = item; else local.push(item);
                localStorage.setItem("aprils_offline_expenses", JSON.stringify(local));
                form.reset();
                document.getElementById("accountingExpenseId").value = "";
                document.getElementById("accountingExpenseDate").value = new Date().toISOString().slice(0,10);
                message("Expense saved on this device while offline.", "success");
                await loadAccounting();
            } catch (_) {
                message("Expense could not be saved: " + error.message, "error");
            }
        }
    });

    document.getElementById("accountingExpenseCancel")?.addEventListener("click", () => {
        form.reset();
        document.getElementById("accountingExpenseId").value = "";
        document.getElementById("accountingExpenseDate").value = new Date().toISOString().slice(0,10);
    });

    const date = document.getElementById("accountingExpenseDate");
    if (date && !date.value) date.value = new Date().toISOString().slice(0,10);
}

async function exportAccountingPdf(kind="sales",share=true){
    const root=document.createElement("div");root.style.cssText="background:#fff;padding:24px;font-family:Arial,sans-serif;color:#222;width:190mm";const source=kind==="expenses"?document.getElementById("accountingExpenseList"):document.getElementById("accountingList");const title=kind==="expenses"?"Aprils Signature — Business Expenses":"Aprils Signature — Sales & Accounting";root.innerHTML=`<h1>Aprils Signature</h1><h2>${title}</h2><p>Elegance in Every Stitch</p><p>Generated: ${new Date().toLocaleString("en-GB", {timeZone:"UTC"}) + " GMT"}</p>`;if(kind==="sales")root.innerHTML+=`<p><strong>Total Sales:</strong> ${escapeHTML(document.getElementById("accountingSales")?.textContent||"")} &nbsp; <strong>Money Received:</strong> ${escapeHTML(document.getElementById("accountingReceived")?.textContent||"")} &nbsp; <strong>Outstanding:</strong> ${escapeHTML(document.getElementById("accountingOutstanding")?.textContent||"")}</p>`;if(source)root.appendChild(source.cloneNode(true));document.body.appendChild(root);try{const html2pdf=await ensureHtml2Pdf();if(!html2pdf)throw new Error("PDF library unavailable");const filename=`Aprils-Signature-${kind}-${new Date().toISOString().slice(0,10)}.pdf`;const options={margin:.35,filename,image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"mm",format:"a4",orientation:"landscape"}};const blob=await pdfFromVisibleElement(root,options);if(share&&navigator.share&&navigator.canShare){const file=new File([blob],filename,{type:"application/pdf"});if(navigator.canShare({files:[file]})){await navigator.share({title:title,text:"Aprils Signature accounting PDF",files:[file]});return;}}const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);message("PDF exported successfully.","success");}catch(error){console.error(error);message("The PDF could not be created. Use Print and choose Save as PDF.","error");}finally{root.remove();}}

async function loadNotifications() {
    const list = document.getElementById("notificationList");
    if (!list) return;

    try {
        let contact = null;
        try {
            const r = await db.from("contact_settings").select("*").limit(1).maybeSingle();
            if (!r.error) contact = r.data;
        } catch (_) {}

        const savedWhatsApp = await getSettingValue("notification_whatsapp").catch(() => null);
        const savedEmail = await getSettingValue("notification_email").catch(() => null);
        const waInput = document.getElementById("notificationWhatsApp");
        const emailInput = document.getElementById("notificationEmail");
        if (waInput && !waInput.value) waInput.value = savedWhatsApp?.setting_value || contact?.whatsapp || contact?.phone || "";
        if (emailInput && !emailInput.value) emailInput.value = savedEmail?.setting_value || contact?.email || "info@aprilssignature.com";

        const events = [];
        const readTable = async (table, type, getDetails) => {
            try {
                const r = await db.from(table).select("*").order("created_at", {ascending:false}).limit(40);
                if (r.error) return;
                (r.data || []).forEach(row => events.push({
                    id: `${table}-${row.id}`,
                    type,
                    date: row.created_at || row.updated_at || "",
                    name: row.full_name || row.customer_name || row.name || "Customer",
                    phone: row.whatsapp || row.phone || "",
                    email: row.email || "",
                    details: getDetails(row)
                }));
            } catch (_) {}
        };

        await readTable("quote_requests", "Order / Quote", row => row.service || "New order / quote request");
        await readTable("training_registrations", "Training Registration", row => row.course || "New training registration");
        await readTable("enquiries", "Enquiry", row => row.subject || "New customer enquiry");

        try {
            const r = await db.from("quote_requests").select("*").order("created_at",{ascending:false}).limit(40);
            if (!r.error) (r.data || []).filter(row => {
                try { return JSON.parse(row.journey || "{}").checkout; } catch (_) { return false; }
            }).forEach(row => events.push({
                id:`checkout-${row.id}`, type:"Checkout Order", date:row.created_at||"",
                name:row.full_name||"Customer", phone:row.whatsapp||row.phone||"", email:row.email||"",
                details:"Checkout order received"
            }));
        } catch (_) {}

        const seen = new Set();
        const unique = events.filter(e => !seen.has(e.id) && seen.add(e.id))
            .sort((a,b)=>String(b.date).localeCompare(String(a.date)));

        list.innerHTML = unique.length ? `<table><thead><tr><th>Date</th><th>Type</th><th>Customer</th><th>Contact</th><th>Details</th><th>Actions</th></tr></thead><tbody>${
            unique.map(e => `<tr>
                <td>${escapeHTML(e.date ? new Date(e.date).toLocaleString("en-GB", {timeZone:"UTC"}) + " GMT" : "")}</td>
                <td>${escapeHTML(e.type)}</td>
                <td>${escapeHTML(e.name)}</td>
                <td>${escapeHTML([e.phone,e.email].filter(Boolean).join(" • "))}</td>
                <td>${escapeHTML(e.details)}</td>
                <td>
                    <button type="button" class="secondary" data-notify-whatsapp="${escapeHTML(e.id)}">WhatsApp</button>
                    <button type="button" class="secondary" data-notify-email="${escapeHTML(e.id)}">Email</button>
                </td>
            </tr>`).join("")
        }</tbody></table>` : `<div class="empty">No recent customer activity was found.</div>`;

        const notificationMessage = e => `Aprils Signature — ${e.type}\nCustomer: ${e.name}\nPhone: ${e.phone}\nEmail: ${e.email}\nDetails: ${e.details}`;
        list.querySelectorAll("[data-notify-whatsapp]").forEach(button => {
            button.onclick = () => {
                const e = unique.find(x => x.id === button.dataset.notifyWhatsapp);
                if (!e) return;
                const number = normalizeWhatsAppNumber(waInput?.value || "");
                if (!number) { message("Save the website WhatsApp number first.","error"); return; }
                window.location.href = `https://wa.me/${number}?text=${encodeURIComponent(notificationMessage(e))}`;
            };
        });
        list.querySelectorAll("[data-notify-email]").forEach(button => {
            button.onclick = () => {
                const e = unique.find(x => x.id === button.dataset.notifyEmail);
                if (!e) return;
                const address = emailInput?.value || "info@aprilssignature.com";
                window.location.href = `mailto:${encodeURIComponent(address)}?subject=${encodeURIComponent("Aprils Signature — " + e.type)}&body=${encodeURIComponent(notificationMessage(e))}`;
            };
        });

        const save = document.getElementById("saveNotificationSettings");
        if (save && !save.dataset.bound) {
            save.dataset.bound = "1";
            save.onclick = async () => {
                try {
                    await safeSettingUpsert("notification_whatsapp", waInput?.value.trim() || "");
                    await safeSettingUpsert("notification_email", emailInput?.value.trim() || "");
                    message("Notification settings saved.","success");
                } catch (error) { message("Notification settings could not be saved: " + error.message,"error"); }
            };
        }

        const enable = document.getElementById("enableBrowserNotifications");
        if (enable && !enable.dataset.bound) {
            enable.dataset.bound = "1";
            enable.onclick = async () => {
                if (!("Notification" in window)) { message("This browser does not support notifications.","error"); return; }
                const permission = await Notification.requestPermission();
                message(permission === "granted" ? "Browser notifications are enabled while this admin dashboard is open." : "Browser notifications were not enabled.","success");
            };
        }
        const refresh = document.getElementById("refreshNotifications");
        if (refresh && !refresh.dataset.bound) {
            refresh.dataset.bound = "1";
            refresh.onclick = () => loadNotifications();
        }
    } catch (error) {
        list.innerHTML = `<div class="empty">Notifications could not be loaded: ${escapeHTML(error.message || "")}</div>`;
    }
}

async function loadAccounting() {
    const list = document.getElementById("accountingList");
    if (!list) return;

    const offlineInvoices = (() => {
        try { return JSON.parse(localStorage.getItem("aprils_offline_invoices") || "[]"); } catch (_) { return []; }
    })();
    const offlinePayments = (() => {
        try { return JSON.parse(localStorage.getItem("aprils_offline_payments") || "[]"); } catch (_) { return []; }
    })();

    let rows = [];
    try {
        const settings = await getRows("settings");
        rows = settings;
    } catch (_) {}

    const invoices = rows.filter(r => String(r.setting_key || "").startsWith("invoice_record_")).map(r => {
        try { return {id:r.id, key:r.setting_key, ...JSON.parse(r.setting_value || "{}")}; } catch (_) { return null; }
    }).filter(Boolean);

    const payments = rows.filter(r => String(r.setting_key || "").startsWith("invoice_payment_record_")).map(r => {
        try { return {id:r.id, key:r.setting_key, ...JSON.parse(r.setting_value || "{}")}; } catch (_) { return null; }
    }).filter(Boolean);

    const expenses = rows.filter(r => String(r.setting_key || "").startsWith("accounting_expense_")).map(r => {
        try { return {id:r.id, key:r.setting_key, ...JSON.parse(r.setting_value || "{}")}; } catch (_) { return null; }
    }).filter(Boolean);
    let offlineExpenses = [];
    try { offlineExpenses = JSON.parse(localStorage.getItem("aprils_offline_expenses") || "[]"); } catch (_) {}

    const invoiceMap = new Map();
    [...invoices, ...offlineInvoices].forEach(item => {
        if (item.invoiceNumber) invoiceMap.set(String(item.invoiceNumber), item);
    });

    const paymentMap = new Map();
    [...payments, ...offlinePayments].forEach(item => {
        const key = String(item.invoiceNumber || "");
        if (!key) return;
        if (!paymentMap.has(key)) paymentMap.set(key, []);
        paymentMap.get(key).push(item);
    });

    const records = [...invoiceMap.values()]
        .filter(invoice => (paymentMap.get(String(invoice.invoiceNumber)) || []).reduce((sum,p) => sum + Number(p.amount || 0), 0) > 0)
        .sort((a,b) => String(b.date || b.savedAt || "").localeCompare(String(a.date || a.savedAt || "")));
    let totalSales = 0, totalReceived = 0, totalOutstanding = 0, totalDiscounts = 0;
    const allExpenses = [...expenses, ...offlineExpenses];
    const totalExpenses = allExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const inventoryRows = rows.filter(r => String(r.setting_key || "").startsWith("inventory_item_")).map(r => {
        try { return {id:r.id, ...JSON.parse(r.setting_value || "{}")}; } catch (_) { return null; }
    }).filter(Boolean);
    const stockValue = inventoryRows.reduce((sum,item) => sum + Number(item.price||0) * Number(item.quantity||0), 0);

    const body = records.map(invoice => {
        const total = Number(invoice.total || 0);
        const discount = Number(invoice.discount || 0);
        const paid = (paymentMap.get(String(invoice.invoiceNumber)) || []).reduce((sum,p) => sum + Number(p.amount || 0), 0);
        const balance = Math.max(0, total - paid);
        totalSales += total;
        totalReceived += paid;
        totalOutstanding += balance;
        totalDiscounts += discount;

        return `<tr>
            <td>${escapeHTML(invoice.date || "")}</td>
            <td>${escapeHTML(invoice.invoiceNumber || "")}</td>
            <td>${escapeHTML(invoice.training ? "Training" : "Order / Quote")}</td>
            <td>${escapeHTML(invoice.customer || "")}</td>
            <td>GHS ${total.toFixed(2)}</td>
            <td>GHS ${discount.toFixed(2)}</td>
            <td>GHS ${paid.toFixed(2)}</td>
            <td>GHS ${balance.toFixed(2)}</td>
            <td>${balance <= 0 && total > 0 ? "Paid in full" : paid > 0 ? "Part payment" : "Unpaid"}</td>
        </tr>`;
    }).join("");

    const emptyNote = offlineInvoices.length && !records.length
        ? "No paid or part-paid sales are recorded yet. Offline invoice records remain available on this device."
        : "No paid or part-paid invoices have been recorded yet.";

    list.innerHTML = records.length ? `
        <table>
            <thead><tr><th>Date</th><th>Invoice</th><th>Type</th><th>Customer</th><th>Sale</th><th>Discount</th><th>Received</th><th>Balance</th><th>Status</th></tr></thead>
            <tbody>${body}</tbody>
        </table>` : `<div class="empty">${escapeHTML(emptyNote)}</div>`;

    document.getElementById("accountingSales").textContent = `GHS ${totalSales.toFixed(2)}`;
    document.getElementById("accountingReceived").textContent = `GHS ${totalReceived.toFixed(2)}`;
    document.getElementById("accountingOutstanding").textContent = `GHS ${totalOutstanding.toFixed(2)}`;
    document.getElementById("accountingDiscounts").textContent = `GHS ${totalDiscounts.toFixed(2)}`;
    document.getElementById("accountingExpenses").textContent = `GHS ${totalExpenses.toFixed(2)}`;
    document.getElementById("accountingNetCash").textContent = `GHS ${(totalReceived - totalExpenses).toFixed(2)}`;
    const stockValueEl = document.getElementById("accountingStockValue");
    if (stockValueEl) stockValueEl.textContent = `GHS ${stockValue.toFixed(2)}`;

    const inventoryList = document.getElementById("accountingInventoryList");
    if (inventoryList) {
        inventoryList.innerHTML = inventoryRows.length ? `<table><thead><tr><th>Collection</th><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Stock Value</th></tr></thead><tbody>${inventoryRows.sort((a,b)=>Number(a.display_order||9999)-Number(b.display_order||9999)).map(item=>`<tr><td>${escapeHTML(item.collection||"")}</td><td>${escapeHTML(item.name||"")}</td><td>${Number(item.quantity||0)}</td><td>GHS ${Number(item.price||0).toFixed(2)}</td><td>GHS ${(Number(item.price||0)*Number(item.quantity||0)).toFixed(2)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No inventory records yet.</div>`;
    }

    const expenseList = document.getElementById("accountingExpenseList");
    if (expenseList) {
        expenseList.innerHTML = allExpenses.length ? `<table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Actions</th></tr></thead><tbody>
            ${allExpenses.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).map(item => `<tr>
                <td>${escapeHTML(item.date || "")}</td>
                <td>${escapeHTML(item.category || "")}</td>
                <td>${escapeHTML(item.description || "")}</td>
                <td>GHS ${Number(item.amount || 0).toFixed(2)}</td>
                <td>
                    <button type="button" class="secondary" data-edit-expense="${escapeHTML(item.id || "")}">Edit</button>
                    ${String(item.id || "").startsWith("offline-") ? `<button type="button" class="danger" data-delete-offline-expense="${escapeHTML(item.id)}">Delete</button>` : `<button type="button" class="danger" data-delete-expense="${escapeHTML(item.id)}">Delete</button>`}
                </td>
            </tr>`).join("")}</tbody></table>` : `<div class="empty">No business expenses recorded yet.</div>`;

        expenseList.querySelectorAll("[data-edit-expense]").forEach(button => {
            button.onclick = () => {
                const item = allExpenses.find(x => String(x.id || "") === String(button.dataset.editExpense));
                if (!item) return;
                document.getElementById("accountingExpenseId").value = item.id || "";
                document.getElementById("accountingExpenseDate").value = item.date || "";
                document.getElementById("accountingExpenseCategory").value = item.category || "";
                document.getElementById("accountingExpenseAmount").value = Number(item.amount || 0);
                document.getElementById("accountingExpenseDescription").value = item.description || "";
                document.getElementById("accountingExpenseForm").scrollIntoView({behavior:"smooth",block:"start"});
            };
        });

        expenseList.querySelectorAll("[data-delete-expense]").forEach(button => {
            button.onclick = async () => {
                if (!confirm("Delete this expense?")) return;
                const result = await db.from("settings").delete().eq("id",button.dataset.deleteExpense);
                if (result.error) { message("Expense could not be deleted: " + result.error.message,"error"); return; }
                await loadAccounting();
            };
        });
        expenseList.querySelectorAll("[data-delete-offline-expense]").forEach(button => {
            button.onclick = async () => {
                if (!confirm("Delete this offline expense?")) return;
                const local = JSON.parse(localStorage.getItem("aprils_offline_expenses") || "[]").filter(x => String(x.id) !== String(button.dataset.deleteOfflineExpense));
                localStorage.setItem("aprils_offline_expenses", JSON.stringify(local));
                await loadAccounting();
            };
        });
    }

    const exportButton = document.getElementById("accountingExport");
    if (exportButton && !exportButton.dataset.bound) {
        exportButton.dataset.bound = "1";
        exportButton.onclick = () => {
            const header = ["Date","Invoice","Type","Customer","Sale (GHS)","Discount (GHS)","Received (GHS)","Balance (GHS)","Status"];
            const csv = [header, ...records.map(invoice => {
                const total = Number(invoice.total || 0);
                const discount = Number(invoice.discount || 0);
                const paid = (paymentMap.get(String(invoice.invoiceNumber)) || []).reduce((sum,p) => sum + Number(p.amount || 0), 0);
                const balance = Math.max(0, total - paid);
                return [invoice.date || "", invoice.invoiceNumber || "", invoice.training ? "Training" : "Order / Quote", invoice.customer || "", total.toFixed(2), discount.toFixed(2), paid.toFixed(2), balance.toFixed(2), balance <= 0 && total > 0 ? "Paid in full" : paid > 0 ? "Part payment" : "Unpaid"];
            })].map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
            const blob = new Blob(["\ufeff" + csv.replace(/\n/g,"\r\n")], {type:"text/csv;charset=utf-8"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Aprils-Signature-Accounting-${new Date().toISOString().slice(0,10)}.csv`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
    }
    document.getElementById("accountingSharePdf")?.addEventListener("click",()=>exportAccountingPdf("sales",true));
    document.getElementById("accountingExpensesPdf")?.addEventListener("click",()=>exportAccountingPdf("expenses",true));
    document.getElementById("accountingRefresh")?.addEventListener("click", () => loadAccounting(), {once:true});
}

async function openSavedReceiptRecord(row) {
    const invoiceNumber = row.invoiceNumber || "";
    let invoice = null;
    try { invoice = await getInvoiceSavedRecord(invoiceNumber); } catch (_) {}
    if (!invoice) { message("The invoice linked to this receipt could not be found, so the receipt cannot be reopened safely.","error"); return; }
    const customerRow = {full_name:row.customer||invoice.customer||"",phone:row.phone||invoice.phone||"",whatsapp:row.phone||invoice.phone||"",email:row.email||invoice.email||"",location:invoice.address||""};
    await openInvoiceGenerator(customerRow,{manualLines:invoice.lines||[],notes:invoice.notes||"",training:!!invoice.training,invoiceNumber,discountPercent:Number(invoice.discountPercent||0)});
    setTimeout(()=>openReceiptGenerator(),150);
}

async function loadSavedInvoiceReceiptRecords() {
    const invoiceList=document.getElementById("savedInvoiceList");
    const receiptList=document.getElementById("savedReceiptList");
    const userInvoiceList=document.getElementById("userInvoiceSavedList");
    if(!invoiceList && !receiptList && !userInvoiceList)return;
    try{
        const rows=await getRows("settings");
        const allInvoices=rows.filter(r=>String(r.setting_key||"").startsWith("invoice_record_")).map(r=>{try{return{type:"Invoice",id:r.id,key:r.setting_key,...JSON.parse(r.setting_value||"{}")}}catch(_){return null}}).filter(Boolean);
        const invoices=[...allInvoices];
        const userInvoices=allInvoices.filter(r=>!!r.userInvoice);
        try{
            const offline=JSON.parse(localStorage.getItem("aprils_offline_invoices")||"[]");
            offline.forEach(r=>invoices.push({type:"Invoice",id:"offline-"+(r.invoiceNumber||Math.random()),key:r.offlineKey||("offline_invoice_"+contentSlug(r.invoiceNumber)),...r,offline:true}));
        }catch(_){}
        const receipts=rows.filter(r=>String(r.setting_key||"").startsWith("receipt_record_")).map(r=>{try{return{type:"Receipt",id:r.id,key:r.setting_key,...JSON.parse(r.setting_value||"{}")}}catch(_){return null}}).filter(Boolean);
        for(const r of invoices){try{r._paymentTotal=(await getInvoicePayments(r.invoiceNumber)).reduce((sum,p)=>sum+Number(p.amount||0),0)}catch(_){r._paymentTotal=0}}
        const renderUserInvoiceTable=(records)=>`<table><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>${records.map(r=>{const paid=Number(r._paymentTotal||0),total=Number(r.total||0);const status=paid>=total&&total>0?"Paid in full":paid>0?"Part payment":"Payment pending";return `<tr><td>${escapeHTML(r.invoiceNumber||"")}</td><td>${escapeHTML(r.date||"")}</td><td>${escapeHTML(r.customer||"")}</td><td>GHS ${total.toFixed(2)}</td><td>${escapeHTML(status)}</td><td><button type="button" class="secondary" data-user-view="${escapeHTML(r.key)}">View</button><button type="button" class="secondary" data-user-edit="${escapeHTML(r.key)}">Edit / Correct</button><button type="button" class="secondary" data-user-share="${escapeHTML(r.key)}">Share PDF</button></td></tr>`;}).join("")}</tbody></table>`;

        const renderTable=(records,type)=>{
            if(!records.length)return `<div class="empty">No saved ${type.toLowerCase()}s yet.</div>`;
            return `<table><thead><tr><th>Number</th><th>Date</th><th>Customer</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>${records.map(r=>{
                const amount=type==="Receipt"?Number(r.amount||0):Number(r.total||0);
                const status=type==="Receipt"?(r.status||"Payment recorded"):(r._paymentTotal>=Number(r.total||0)&&Number(r.total||0)>0?"Paid in full":r._paymentTotal>0?"Part payment":"Draft — payment not yet recorded");
                return `<tr><td>${escapeHTML(r.invoiceNumber||r.receiptNumber||"")}</td><td>${escapeHTML(r.date||"")}</td><td>${escapeHTML(r.customer||r.full_name||"")}</td><td>GHS ${amount.toFixed(2)}</td><td>${escapeHTML(status)}</td><td><button type="button" class="secondary" data-open-saved-record="${escapeHTML(r.key)}" data-record-type="${type}">Open</button><button type="button" class="secondary" data-edit-saved-record="${escapeHTML(r.key)}" data-record-type="${type}">Edit</button><button type="button" class="secondary" data-share-saved-record="${escapeHTML(r.key)}" data-record-type="${type}">Share PDF</button><button type="button" class="danger" data-delete-saved-record="${escapeHTML(r.id)}" data-record-type="${type}" data-record-key="${escapeHTML(r.key)}" data-record-number="${escapeHTML(r.invoiceNumber||r.receiptNumber||"")}">Delete</button></td></tr>`;
            }).join("")}</tbody></table>`;
        };
        if(invoiceList)invoiceList.innerHTML=renderTable(invoices,"Invoice");
        if(receiptList)receiptList.innerHTML=renderTable(receipts,"Receipt");
        if(userInvoiceList)userInvoiceList.innerHTML=userInvoices.length ? renderUserInvoiceTable(userInvoices) : `<div class="empty">No user invoices have been saved yet.</div>`;
        const root=document;
        [invoiceList,receiptList,userInvoiceList].filter(Boolean).forEach(list=>{
            list.querySelectorAll("[data-open-saved-record],[data-edit-saved-record]").forEach(button=>button.onclick=async()=>{
                const type=button.dataset.recordType, row=(type==="Invoice"?invoices:receipts).find(r=>r.key===button.dataset[button.dataset.openSavedRecord!==undefined?"openSavedRecord":"editSavedRecord"]);
                if(!row)return;
                if(type==="Invoice"){
                    await openInvoiceGenerator({id:row.sourceId||"",full_name:row.customer||"",phone:row.phone||"",whatsapp:row.phone||"",email:row.email||"",location:row.address||""},{manualLines:row.lines||[],notes:row.notes||"",training:!!row.training,userInvoice:!!row.userInvoice,invoiceNumber:row.invoiceNumber,discountPercent:Number(row.discountPercent||0),entryId:row.entryId||"",existingRecord:row});
                }else await openSavedReceiptRecord(row);
            });
            list.querySelectorAll("[data-share-saved-record]").forEach(button=>button.onclick=async()=>{
                const type=button.dataset.recordType, row=(type==="Invoice"?invoices:receipts).find(r=>r.key===button.dataset.shareSavedRecord);
                if(!row)return;
                if(type==="Invoice"){
                    await openInvoiceGenerator({id:row.sourceId||"",full_name:row.customer||"",phone:row.phone||"",whatsapp:row.phone||"",email:row.email||"",location:row.address||""},{manualLines:row.lines||[],notes:row.notes||"",training:!!row.training,userInvoice:!!row.userInvoice,invoiceNumber:row.invoiceNumber,discountPercent:Number(row.discountPercent||0),entryId:row.entryId||"",existingRecord:row});
                    await generateInvoicePdf(true);
                }else{
                    await openSavedReceiptRecord(row);
                    await generateReceiptPdf(true);
                }
            });
            list.querySelectorAll("[data-user-view]").forEach(button=>button.onclick=async()=>{
                const row=userInvoices.find(r=>r.key===button.dataset.userView); if(!row)return;
                await openSavedUserInvoiceReadOnly(row);
            });
            list.querySelectorAll("[data-user-edit]").forEach(button=>button.onclick=async()=>{
                const row=userInvoices.find(r=>r.key===button.dataset.userEdit); if(!row)return;
                await openInvoiceGenerator({id:row.sourceId||"",full_name:row.customer||"",phone:row.phone||"",whatsapp:row.phone||"",email:row.email||"",location:row.address||""},{manualLines:row.lines||[],notes:row.notes||"",training:!!row.training,userInvoice:true,invoiceNumber:row.invoiceNumber,discountPercent:Number(row.discountPercent||0),entryId:row.entryId||"",existingRecord:row});
            });
            list.querySelectorAll("[data-user-share]").forEach(button=>button.onclick=async()=>{
                const row=userInvoices.find(r=>r.key===button.dataset.userShare); if(!row)return;
await openSavedUserInvoiceReadOnly(row);
                await generateInvoicePdf(true);
            });
            list.querySelectorAll("[data-delete-saved-record]").forEach(button=>button.onclick=async()=>{
                const type=button.dataset.recordType,number=button.dataset.recordNumber;
                if(!confirm(`Delete this saved ${type.toLowerCase()}${number?` ${number}`:""}?`))return;
                try{
                    if(String(button.dataset.deleteSavedRecord).startsWith("offline-")){
                        const offline=JSON.parse(localStorage.getItem("aprils_offline_invoices")||"[]").filter(r=>String(r.invoiceNumber)!==String(number));
                        const offlinePayments=JSON.parse(localStorage.getItem("aprils_offline_payments")||"[]").filter(r=>String(r.invoiceNumber)!==String(number));
                        localStorage.setItem("aprils_offline_invoices",JSON.stringify(offline));
                        localStorage.setItem("aprils_offline_payments",JSON.stringify(offlinePayments));
                    }else{
                        const result=await db.from("settings").delete().eq("id",button.dataset.deleteSavedRecord);if(result.error)throw result.error;
                        if(type==="Invoice"&&number){
                            const paymentRows=await getRows("settings");
                            const ids=paymentRows.filter(r=>String(r.setting_key||"").startsWith("invoice_payment_record_")).filter(r=>{try{return String(JSON.parse(r.setting_value||"{}").invoiceNumber)===String(number)}catch(_){return false}}).map(r=>r.id);
                            if(ids.length)await db.from("settings").delete().in("id",ids);
                        }
                    }
                    message(`${type} deleted.`,"success");await loadSavedInvoiceReceiptRecords();await loadAccounting();
                }catch(error){message(`${type} could not be deleted: ${error.message}`,"error")}
            });
        });
    }catch(error){
        if(invoiceList)invoiceList.innerHTML=`<div class="empty">Saved invoices could not be loaded.</div>`;
        if(receiptList)receiptList.innerHTML=`<div class="empty">Saved receipts could not be loaded.</div>`;
        console.error(error);
    }
}

async function getDiscountForCustomer(row) {
    const phone = String(row?.phone || row?.whatsapp || "").replace(/\D/g, "");
    const email = String(row?.email || "").trim().toLowerCase();
    if (!phone && !email) return null;

    try {
        const codes = (await getRows("settings"))
            .filter(r => String(r.setting_key || "").startsWith("discount_code_"))
            .map(r => {
                try { return { ...JSON.parse(r.setting_value || "{}"), id: r.id }; } catch (_) { return null; }
            }).filter(r => r && r.code && r.active !== false);

        const redemptionResult = await db.from("discount_redemptions").select("*").eq("status", "pending").order("created_at", {ascending:false});
        if (redemptionResult.error) return null;

        for (const redemption of redemptionResult.data || []) {
            const samePhone = phone && String(redemption.phone || "").replace(/\D/g, "") === phone;
            const sameEmail = email && String(redemption.email || "").trim().toLowerCase() === email;
            if (!samePhone && !sameEmail) continue;

            const code = codes.find(c => String(c.code).trim().toLowerCase() === String(redemption.code || "").trim().toLowerCase());
            if (!code) continue;

            const percent = Math.max(0, Math.min(100, Number(code.percent || 0)));
            if (!percent) continue;
            return { ...code, redemptionId: redemption.id, percent };
        }
    } catch (_) {}
    return null;
}

function normalizeWhatsAppNumber(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = "233" + digits.slice(1);
    if (digits.length >= 9 && !digits.startsWith("233")) digits = "233" + digits;
    return digits;
}

function customerWhatsAppUrl(value, text) {
    const number = normalizeWhatsAppNumber(value);
    return number ? `https://wa.me/${number}?text=${encodeURIComponent(text || "")}` : `https://wa.me/?text=${encodeURIComponent(text || "")}`;
}

async function openInvoiceGenerator(row, details) {
    const priceMap = await getInvoicePriceMap();
    const discountOffer = await getDiscountForCustomer(row);
    const isTrainingInvoice = !!details?.training || String(details?.invoiceType || "").toLowerCase() === "training";
    const paymentAccounts = await getInvoicePaymentAccounts();

    let modal = document.getElementById("invoiceGeneratorModal");
    let backdrop = document.getElementById("invoiceGeneratorBackdrop");
    if (!modal) {
        backdrop = document.createElement("div");
        backdrop.id = "invoiceGeneratorBackdrop";
        backdrop.className = "invoice-generator-backdrop";
        backdrop.onclick = closeInvoiceGenerator;
        document.body.appendChild(backdrop);

        modal = document.createElement("div");
        modal.id = "invoiceGeneratorModal";
        modal.className = "invoice-generator-modal";
        document.body.appendChild(modal);
    }

    const invoiceNumber = details?.invoiceNumber || ("AS-" + new Date().toISOString().slice(0,10).replace(/-/g,"") + "-" + Math.random().toString(36).slice(2,7).toUpperCase());
    const detailsLines = buildInvoiceLinesFromQuote(row, details, priceMap).map(line => ({
        ...line,
        unitPrice: Number(line.unitPrice || invoicePriceFor(priceMap, line.description) || 0)
    }));
    const savedPayments = await getInvoicePayments(invoiceNumber);

    modal.innerHTML = `
        <div class="invoice-generator-toolbar">
            <button type="button" class="submission-modal-close" onclick="closeInvoiceGenerator()" aria-label="Close">&times;</button>
            <h2>Generate Invoice</h2>
            <div class="invoice-action-buttons">
                <button type="button" class="primary" id="invoiceDownloadPdf">Download PDF</button>
                <button type="button" class="primary" id="invoiceSharePdf">Share PDF</button>
                <button type="button" class="secondary" id="invoicePrint">Print</button>
                <button type="button" class="secondary" id="invoiceWhatsApp">WhatsApp</button>
                <button type="button" class="secondary" id="invoiceEmail">Email</button>
                <button type="button" class="primary" id="saveGeneratedInvoice">Save Invoice</button>
                <button type="button" class="primary" id="generateReceiptFromInvoice">Generate Receipt</button>
            </div>
        </div>
        <div class="invoice-generator-editor">
            <div class="form-grid">
                <div class="form-group"><label>Invoice Number</label><input id="generatedInvoiceNumber" value="${escapeHTML(invoiceNumber)}"></div>
                <div class="form-group"><label>Invoice Date</label><input id="generatedInvoiceDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
                <div class="form-group"><label>Due Date</label><input id="generatedInvoiceDueDate" type="date"></div>
                <div class="form-group" id="generatedInvoiceDepositRow"><label>Deposit / Payment %</label><input id="generatedInvoiceDeposit" type="number" min="0" max="100" step="1" value="${isTrainingInvoice ? "100" : "75"}"></div>
            </div>
            <div class="form-grid">
                <div class="form-group"><label>Customer Name</label><input id="generatedInvoiceCustomer" value="${escapeHTML(row.full_name || "")}"></div>
                <div class="form-group"><label>Phone / WhatsApp</label><input id="generatedInvoicePhone" value="${escapeHTML(row.whatsapp || row.phone || "")}"></div>
                <div class="form-group"><label>Email</label><input id="generatedInvoiceEmail" value="${escapeHTML(row.email || "")}"></div>
                <div class="form-group"><label>Location / Address</label><input id="generatedInvoiceAddress" value="${escapeHTML(row.location || "")}"></div>
            </div>
            <div class="form-group"><label>Payment Notes</label><textarea id="generatedInvoiceNotes">${escapeHTML((details?.notes || "").split(/\n\s*Thank you for choosing Aprils Signature\.?/i)[0].trim() || (isTrainingInvoice ? "Kindly note that full payment is expected to be made before class begins." : "Kindly note that production begins only after the initial deposit of 75% has been paid and confirmed."))}</textarea></div>
        </div>
        <div id="generatedInvoicePreview"></div>
    `;

    const preview = modal.querySelector("#generatedInvoicePreview");
    const depositRow = modal.querySelector("#generatedInvoiceDepositRow");
    if (depositRow && isTrainingInvoice) depositRow.style.display = "none";
    function renderInvoice() {
        const depositPercent = isTrainingInvoice ? 100 : Math.max(0, Math.min(100, Number(document.getElementById("generatedInvoiceDeposit").value) || 0));
        const discountPercent = Math.max(0, Math.min(100, Number(document.getElementById("generatedInvoiceDiscountPercent")?.value || 0)));
        const lines = Array.from(modal.querySelectorAll("#invoiceLineRows .invoice-edit-row")).map(rowEl => ({
            description: rowEl.querySelector(".invoice-line-description")?.value || "",
            quantity: Number(rowEl.querySelector(".invoice-line-qty")?.value || 0),
            unitPrice: Number(rowEl.querySelector(".invoice-line-price")?.value || 0),
            details: rowEl.querySelector(".invoice-line-details")?.value || ""
        }));
        const subtotal = lines.reduce((sum, l) => sum + (l.quantity * l.unitPrice), 0);
        const discount = subtotal * discountPercent / 100;
        const total = Math.max(0, subtotal - discount);
        const deposit = total * depositPercent / 100;
        const balance = total - deposit;
        const paidAmount = Number(savedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
        const outstanding = Math.max(0, total - paidAmount);
        const paymentStatus = paidAmount >= total && total > 0 ? "PAID IN FULL" : (paidAmount > 0 ? "PART PAYMENT RECEIVED" : "PAYMENT PENDING");

        const logoSrc = new URL("../icons/Aprils Signature logo.jpeg", window.location.href).href;
        preview.innerHTML = `
            <div class="invoice-paper" id="invoicePaper">
                <div class="invoice-brand-row">
                    <img src="${escapeHTML(logoSrc)}" alt="Aprils Signature logo">
                    <div><h1>Aprils Signature</h1><p>Elegance in Every Stitch</p></div>
                    <div class="invoice-meta"><strong>INVOICE</strong><span>${escapeHTML(document.getElementById("generatedInvoiceNumber").value)}</span><span>${escapeHTML(document.getElementById("generatedInvoiceDate").value)}</span></div>
                </div>
                <div class="invoice-customer"><div><strong>Bill To</strong><br>${escapeHTML(document.getElementById("generatedInvoiceCustomer").value)}<br>${escapeHTML(document.getElementById("generatedInvoicePhone").value)}<br>${escapeHTML(document.getElementById("generatedInvoiceEmail").value)}<br>${escapeHTML(document.getElementById("generatedInvoiceAddress").value)}</div></div>
                <table class="invoice-lines"><thead><tr><th>#</th><th>Item / Description</th><th>Details</th><th>Qty</th><th>Unit Price (GHS)</th><th>Total (GHS)</th></tr></thead>
                <tbody>${lines.map((l,i)=>`<tr data-invoice-line="${i}"><td>${i+1}</td><td>${escapeHTML(l.description)}</td><td>${escapeHTML(l.details)}</td><td>${l.quantity}</td><td>${l.unitPrice.toFixed(2)}</td><td>${(l.quantity*l.unitPrice).toFixed(2)}</td></tr>`).join("")}</tbody></table>
                <div class="invoice-summary">
                    <p>Subtotal: <strong>GHS ${subtotal.toFixed(2)}</strong></p>
                    <p>Discount ${discountOffer?.code ? `(${escapeHTML(discountOffer.code)} — ${discountPercent.toFixed(2)}%)` : `(${discountPercent.toFixed(2)}%)`}: <strong>GHS ${discount.toFixed(2)}</strong></p>
                    <p>Grand Total: <strong>GHS ${total.toFixed(2)}</strong></p>
                    ${isTrainingInvoice ? "" : `<p>Payment Due (${depositPercent}%): <strong>GHS ${deposit.toFixed(2)}</strong></p>`}
                    <p>Amount Paid: <strong>GHS ${paidAmount.toFixed(2)}</strong></p>
                    <p>Balance: <strong>GHS ${outstanding.toFixed(2)}</strong></p>
                    <p class="invoice-payment-status"><strong>${paymentStatus}</strong></p>
                </div>
                <div class="invoice-payment"><strong>Payment Details</strong>
                    <div class="invoice-payment-grid ${paymentAccounts.length > 1 ? "two" : "one"}">
                        ${paymentAccounts.map(item=>`<div class="invoice-payment-account">
                            <strong>${escapeHTML([item.network,item.number].filter(Boolean).join(" "))}</strong><br>
                            <span>${escapeHTML(item.name || "")}</span>${item.branch ? `<br><span>Branch: ${escapeHTML(item.branch)}</span>` : ""}
                        </div>`).join("")}
                    </div>
                    </div>
                <div class="invoice-note invoice-payment-note"><strong>*** Payment Notes ***</strong><br><em>${escapeHTML(document.getElementById("generatedInvoiceNotes").value)}</em></div>
                <div class="invoice-note invoice-thank-you"><strong>Thank you for choosing Aprils Signature.</strong></div>
                <div class="invoice-footer">Aprils Signature • Elegance in Every Stitch</div>
            </div>
        `;
    }

    // Build editable line editor immediately above preview.
    const editor = modal.querySelector(".invoice-generator-editor");
    const lineEditor = document.createElement("div");
    lineEditor.className = "invoice-line-editor";
    lineEditor.innerHTML = `
        <h3>Invoice Items</h3>
        <div id="invoiceLineRows"></div>
        <div class="form-grid">
            <div class="form-group"><label>Discount (%)</label><input id="generatedInvoiceDiscountPercent" type="number" min="0" max="100" step="0.01" value="${Number(discountOffer?.percent ?? details?.discountPercent ?? 0)}"></div>
        </div>
        <button type="button" class="secondary" id="invoiceAddLine">+ Add Line</button>
    `;
    editor.appendChild(lineEditor);
    const deliveryEditor = document.createElement("div");
    deliveryEditor.className = "form-grid";
    deliveryEditor.innerHTML = `<div class="form-group"><label>Delivery / Collection Date</label><input id="generatedInvoiceDeliveryDate" type="date" value="${escapeHTML(details?.deliveryDate || "")}"></div><div class="form-group"><label>Delivery / Collection Time</label><input id="generatedInvoiceDeliveryTime" type="time" value="${escapeHTML(details?.deliveryTime || "")}"></div>`;
    editor.appendChild(deliveryEditor);

    const lineRows = lineEditor.querySelector("#invoiceLineRows");
    function addLine(line = {description:"",quantity:1,unitPrice:0,details:""}) {
        const el = document.createElement("div");
        el.className = "invoice-edit-row";
        el.innerHTML = `
            <input class="invoice-line-description" placeholder="Item / Service" value="${escapeHTML(line.description)}">
            <input class="invoice-line-details" placeholder="Details" value="${escapeHTML(line.details || "")}">
            <input class="invoice-line-qty" type="number" min="1" step="1" value="${Number(line.quantity)||1}">
            <input class="invoice-line-price" type="number" min="0" step="0.01" value="${Number(line.unitPrice)||0}">
            <button type="button" class="danger">Remove</button>
        `;
        el.querySelector("button").onclick = () => { el.remove(); renderInvoice(); };
        const descriptionInput = el.querySelector(".invoice-line-description");
        const priceInput = el.querySelector(".invoice-line-price");
        ["input","change"].forEach(evt => el.addEventListener(evt, renderInvoice));
        descriptionInput?.addEventListener("change", () => {
            const suggested = invoicePriceFor(priceMap, descriptionInput.value || "");
            if (suggested > 0 && Number(priceInput?.value || 0) === 0) {
                priceInput.value = suggested.toFixed(2);
                renderInvoice();
            }
        });
        lineRows.appendChild(el);
    }
    detailsLines.forEach(addLine);
    if (!detailsLines.length) addLine();
    lineEditor.querySelector("#invoiceAddLine").onclick = () => { addLine(); renderInvoice(); };

    // First render after all lines exist.
    ["input","change"].forEach(evt => modal.addEventListener(evt, () => {
        renderInvoice();
        clearTimeout(window._aprilsAutoSaveInvoiceTimer);
        window._aprilsAutoSaveInvoiceTimer = setTimeout(autoSaveInvoice, 900);
    }));
    renderInvoice();

    window._aprilsAutoSaveInvoiceTimer && clearTimeout(window._aprilsAutoSaveInvoiceTimer);
    const autoSaveInvoice = async () => {
        try { await statefulSaveGeneratedInvoice(row, details, savedPayments, true); } catch (error) { console.warn("Automatic invoice save skipped:", error); }
    };

    modal.querySelector("#invoiceDownloadPdf").onclick = () => generateInvoicePdf(false);
    modal.querySelector("#invoiceSharePdf").onclick = () => generateInvoicePdf(true);
    modal.querySelector("#invoicePrint").onclick = () => printGeneratedInvoice();
    modal.querySelector("#invoiceWhatsApp").onclick = () => shareGeneratedInvoiceWhatsApp();
    modal.querySelector("#invoiceEmail").onclick = () => shareGeneratedInvoiceEmail();
    modal.querySelector("#saveGeneratedInvoice").onclick = async () => {
        try {
            await statefulSaveGeneratedInvoice(row, details, savedPayments);
        } catch (error) {
            message("Invoice could not be saved: " + error.message, "error");
        }
    };
    modal.querySelector("#generateReceiptFromInvoice").onclick = () => openReceiptGenerator();

    backdrop.style.display = "block";
    modal.classList.add("open");

    window._aprilsCurrentInvoice = { modal, preview, renderInvoice, row, details, paymentAccounts, savedPayments, discountOffer, isTrainingInvoice, entryId: details?.entryId || makeAprilsUniqueId("INV"), originalRecord: details?.existingRecord || null, attachments: Array.isArray(details?.existingRecord?.attachments) ? details.existingRecord.attachments : [] };
    setTimeout(autoSaveInvoice, 150);
}


async function statefulSaveGeneratedInvoice(row, details, savedPayments, automatic = false) {
    const state = window._aprilsCurrentInvoice;
    if (!state) return;
    state.renderInvoice();
    const invoiceNumber = document.getElementById("generatedInvoiceNumber")?.value || "";
    const lines = Array.from(document.querySelectorAll("#invoiceLineRows .invoice-edit-row")).map(el => ({
        description: el.querySelector(".invoice-line-description")?.value || "",
        details: el.querySelector(".invoice-line-details")?.value || "",
        quantity: Number(el.querySelector(".invoice-line-qty")?.value || 0),
        unitPrice: Number(el.querySelector(".invoice-line-price")?.value || 0)
    })).filter(x => x.description);
    const subtotal = lines.reduce((sum,l) => sum + l.quantity*l.unitPrice, 0);
    const discountPercent = Math.max(0, Math.min(100, Number(document.getElementById("generatedInvoiceDiscountPercent")?.value || 0)));
    const discount = subtotal * discountPercent / 100;
    const total = Math.max(0, subtotal - discount);
    const actor = await getCurrentStaffIdentity();
    const previous = state.originalRecord || null;
    const isUpdate = !!previous;
    const now = new Date().toISOString();
    const record = {
        entryId: state.entryId || previous?.entryId || makeAprilsUniqueId("INV"),
        enteredBy: previous?.enteredBy || actor.staffId,
        createdBy: previous?.createdBy || previous?.enteredBy || actor.staffId,
        createdAt: previous?.createdAt || previous?.savedAt || now,
        updatedBy: actor.staffId,
        updatedAt: now,
        invoiceNumber,
        date: document.getElementById("generatedInvoiceDate")?.value || "",
        dueDate: document.getElementById("generatedInvoiceDueDate")?.value || "",
        depositPercent: state.isTrainingInvoice ? 100 : Number(document.getElementById("generatedInvoiceDeposit")?.value || 75),
        training: !!state.isTrainingInvoice,
        customer: document.getElementById("generatedInvoiceCustomer")?.value || "",
        phone: document.getElementById("generatedInvoicePhone")?.value || "",
        email: document.getElementById("generatedInvoiceEmail")?.value || "",
        address: document.getElementById("generatedInvoiceAddress")?.value || "",
        notes: document.getElementById("generatedInvoiceNotes")?.value || "",
        lines, discount, discountPercent, total,
        attachments: Array.isArray(state.attachments) ? state.attachments : [],
        sourceId: row?.id || "",
        sourceType: details?.checkout ? "checkout_orders" : (state.isTrainingInvoice ? "training_registrations" : (details?.userInvoice ? "user_invoices" : "quote_requests")),
        userInvoice: !!details?.userInvoice,
        checkout: !!details?.checkout,
        savedAt: now,
        saveType: automatic ? "automatic" : "manual",
        revision: Number(previous?.revision || 0) + (isUpdate ? 1 : 0)
    };
    await saveInvoiceRecord(invoiceNumber, record);
    try {
        if (record.sourceId && (record.sourceType === "quote_requests" || record.sourceType === "checkout_orders")) {
            const current = await getAdminRecordStatus("quote_status", record.sourceId);
            if (!isUpdate && (!current || current === "under_review")) await setAdminRecordStatus("quote_status", record.sourceId, "invoice_generated");
        } else if (record.sourceId && record.sourceType === "training_registrations") {
            const current = await getAdminRecordStatus("training_status", record.sourceId);
            if (!isUpdate && (!current || current === "under_review")) await setAdminRecordStatus("training_status", record.sourceId, "invoice_generated");
        }
    } catch (_) {}
    await auditSystemEvent(record.sourceType || "invoice", record.entryId, isUpdate ? "invoice_updated" : "invoice_created", {invoiceNumber, customer:record.customer, revision:record.revision || 0});
    if (details?.checkout && row?.id) {
        try {
            const checkoutRow = await db.from("quote_requests").select("journey").eq("id", row.id).maybeSingle();
            if (!checkoutRow.error) { let journey={}; try{journey=JSON.parse(checkoutRow.data?.journey||"{}")}catch(_){} journey.invoiceNumber=invoiceNumber; journey.orderStatus=journey.orderStatus||"invoice_generated"; await db.from("quote_requests").update({journey:JSON.stringify(journey)}).eq("id",row.id); await safeSettingUpsert("checkout_status_"+row.id,journey.orderStatus); }
        } catch (_) {}
    }
    if (!automatic && state.discountOffer?.redemptionId) {
        try { await db.from("discount_redemptions").update({status:"used"}).eq("id", state.discountOffer.redemptionId); } catch (_) {}
    }
    if (!automatic) {
        message("Invoice " + invoiceNumber + " saved.", "success");
        await loadSavedInvoiceReceiptRecords();
    }
}
function closeInvoiceGenerator() {
    document.getElementById("invoiceGeneratorBackdrop")?.remove();
    document.getElementById("invoiceGeneratorModal")?.remove();
    window._aprilsCurrentInvoice = null;
}

async function ensureHtml2Pdf() {
    if (window.html2pdf) return window.html2pdf;
    return new Promise(resolve => {
        const existing = document.querySelector('script[data-aprils-html2pdf]');
        if (existing) { existing.addEventListener("load", () => resolve(window.html2pdf)); setTimeout(() => resolve(window.html2pdf), 4000); return; }
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        script.async = true; script.dataset.aprilsHtml2pdf = "1";
        script.onload = () => resolve(window.html2pdf); script.onerror = () => resolve(null);
        document.head.appendChild(script);
    });
}

async function pdfFromVisibleElement(element, options){
    if (!element) throw new Error("PDF content is missing.");
    const clone=element.cloneNode(true);
    clone.id=element.id+"-pdf-copy";
    clone.style.position="absolute";
    clone.style.left="-100000px";
    clone.style.top="0";
    clone.style.zIndex="2147483647";
    clone.style.display="block";
    clone.style.visibility="visible";
    clone.style.opacity="1";
    clone.style.width="210mm";
    clone.style.maxWidth="210mm";
    clone.style.minHeight="297mm";
    clone.style.background="#fff";
    clone.style.boxShadow="none";
    clone.style.margin="0";
    clone.style.overflow="visible";
    document.body.appendChild(clone);
    try{
        if (document.fonts?.ready) await document.fonts.ready;
        const images=[...clone.querySelectorAll("img")];
        await Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
            img.addEventListener("load",resolve,{once:true});
            img.addEventListener("error",resolve,{once:true});
        })));
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        const blob=await window.html2pdf().set({...options, pagebreak:{mode:["css","legacy"]}}).from(clone).outputPdf("blob");
        if (!blob || blob.size < 5000) throw new Error("The generated PDF is empty or incomplete.");
        return blob;
    }finally{clone.remove();}
}

async function generateInvoicePdf(share) {
    const state = window._aprilsCurrentInvoice;
    if (!state) return false;
    state.renderInvoice();
    const paper = document.getElementById("invoicePaper");
    if (!paper) return false;
    const html2pdf = await ensureHtml2Pdf();
    if (!html2pdf) {
        if (share) { message("PDF sharing is unavailable because the PDF service could not be loaded. No PDF page was opened.", "error"); return false; }
        printGeneratedInvoice();
        return false;
    }
    try {
        const options = {
            margin: 0,
            filename: (document.getElementById("generatedInvoiceNumber").value || "Aprils-Signature-Invoice") + ".pdf",
            image: {type:"jpeg",quality:0.98},
            html2canvas: {scale:2,useCORS:true},
            jsPDF: {unit:"in",format:"a4",orientation:"portrait"}
        };
        const blob = await pdfFromVisibleElement(paper, options);
        if (share) {
            const file = new File([blob], options.filename, {type:"application/pdf"});
            if (navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))) {
                await navigator.share({title: options.filename, text:"Aprils Signature Invoice", files:[file]});
                return true;
            }
            message("Your device/browser does not provide a file-sharing menu. No PDF page was opened. Try this button on a phone/tablet or a browser that supports file sharing.", "error");
            return false;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href=url; a.download=options.filename; a.click();
        setTimeout(()=>URL.revokeObjectURL(url),1500);
        message("Invoice PDF downloaded.", "success");
        return false;
    } catch (error) {
        console.error(error);
        if (share) { message("The invoice could not be shared as a PDF. No PDF page was opened.", "error"); return false; }
        printGeneratedInvoice();
        message("The invoice PDF could not be downloaded directly, so a print-safe invoice was opened.", "success");
        return false;
    }
}

function getGeneratedInvoiceShareText() {
    const state = window._aprilsCurrentInvoice;
    if (!state) return "";
    state.renderInvoice();
    const customer = document.getElementById("generatedInvoiceCustomer")?.value || "";
    const number = document.getElementById("generatedInvoiceNumber")?.value || "";
    return `Aprils Signature Invoice ${number}\nCustomer: ${customer}\nPlease see the attached invoice PDF for the full details.`;
}

async function sharePdfToWhatsApp(paper, filename, phone, title) {
    const html2pdf = await ensureHtml2Pdf();
    if (!html2pdf || !paper) { message("The PDF could not be prepared for sharing. No PDF page was opened.", "error"); return false; }
    const options = {margin:0,filename,image:{type:"jpeg",quality:0.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"in",format:"a4",orientation:"portrait"}};
    try {
        const blob = await pdfFromVisibleElement(paper, options);
        const file = new File([blob], filename, {type:"application/pdf"});
        if (navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))) {
            await navigator.share({title, text:`${title} — Aprils Signature`, files:[file]});
            return true;
        }
        // A browser cannot attach a local PDF to a WhatsApp wa.me URL. Do not
        // open a PDF/download page; open WhatsApp only as a last-resort text chat.
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href=url; a.download=filename; a.click();
        setTimeout(()=>URL.revokeObjectURL(url),1500);
        const number = normalizeWhatsAppNumber(phone);
        if (number) {
            window.open(`https://wa.me/${number}?text=${encodeURIComponent(`${title} — The PDF has been generated and downloaded. Please attach the downloaded PDF before sending.`)}`, "_blank", "noopener,noreferrer");
            message("The original PDF was generated and downloaded. WhatsApp was opened for the customer chat.", "success");
            return false;
        }
        message("The original PDF was generated and downloaded. Your browser does not provide a file-sharing menu.", "success");
        return false;
    } catch (error) {
        if (error?.name === "AbortError") return false;
        console.warn("WhatsApp PDF sharing unavailable:", error);
        message("The PDF could not be shared. No PDF page was opened.", "error");
        return false;
    }
}

async function shareGeneratedInvoiceWhatsApp(){const phone=document.getElementById("generatedInvoicePhone")?.value||"";const state=window._aprilsCurrentInvoice;if(!state)return;state.renderInvoice();await sharePdfToWhatsApp(document.getElementById("invoicePaper"),`${document.getElementById("generatedInvoiceNumber")?.value||"Aprils-Signature-Invoice"}.pdf`,phone,`Aprils Signature Invoice ${document.getElementById("generatedInvoiceNumber")?.value||""}`);}
function shareGeneratedInvoiceEmail() {
    const subject = encodeURIComponent("Aprils Signature Invoice " + (document.getElementById("generatedInvoiceNumber")?.value || ""));
    const body = encodeURIComponent(getGeneratedInvoiceShareText());
    window.location.href = `mailto:${encodeURIComponent(document.getElementById("generatedInvoiceEmail")?.value || "")}?subject=${subject}&body=${body}`;
}

function printGeneratedInvoice() {
    const state = window._aprilsCurrentInvoice;
    if (!state) return;
    state.renderInvoice();
    const paper = document.getElementById("invoicePaper");
    if (!paper) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
        message("Please allow pop-ups for the admin page to print the invoice.", "error");
        return;
    }
    printWindow.document.write(`<html><head><title>Aprils Signature Invoice</title><style>
        @page{size:A4 portrait;margin:0}body{font-family:Arial,sans-serif;padding:0;margin:0;color:#222}.invoice-paper{width:210mm;max-width:210mm;margin:0 auto;box-sizing:border-box}.invoice-brand-row{display:flex;align-items:center;gap:15px;border-bottom:3px solid #0f7775;padding-bottom:15px}.invoice-brand-row img{width:85px;height:85px;object-fit:contain}.invoice-brand-row h1{color:#0f7775;margin:0}.invoice-meta{margin-left:auto;text-align:right}.invoice-lines{width:100%;border-collapse:collapse;margin-top:25px}.invoice-lines th,.invoice-lines td{border:1px solid #777;padding:8px;text-align:left}.invoice-lines th{background:#0f7775;color:#fff}.invoice-summary{margin-left:auto;max-width:300px;margin-top:20px}.invoice-payment,.invoice-note{margin-top:20px;padding:12px;border:1px solid #aaa}.invoice-footer{text-align:center;margin-top:28px;padding-top:12px;border-top:1px solid #aaa;font-size:12px;font-style:italic;color:#555}.invoice-thank-you{text-align:center}</style></head><body>${paper.outerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
}

/* =========================================================
   PROFESSIONAL RECEIPT GENERATOR
   A receipt is generated manually after payment has actually been received.
========================================================= */

function getCurrentInvoiceTotals() {
    const state = window._aprilsCurrentInvoice;
    if (!state) return { total: 0, paidDue: 0, balance: 0, lines: [] };
    state.renderInvoice();
    const rows = Array.from(document.querySelectorAll("#invoiceLineRows .invoice-edit-row"));
    const lines = rows.map(rowEl => ({
        description: rowEl.querySelector(".invoice-line-description")?.value || "",
        quantity: Number(rowEl.querySelector(".invoice-line-qty")?.value || 0),
        unitPrice: Number(rowEl.querySelector(".invoice-line-price")?.value || 0),
        details: rowEl.querySelector(".invoice-line-details")?.value || ""
    })).filter(x => x.description || x.quantity || x.unitPrice);
    const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
    const discountPercent = Math.max(0, Math.min(100, Number(document.getElementById("generatedInvoiceDiscountPercent")?.value || 0)));
    const discount = subtotal * discountPercent / 100;
    const total = Math.max(0, subtotal - discount);
    const depositPercent = Math.max(0, Math.min(100, Number(document.getElementById("generatedInvoiceDeposit")?.value || 0)));
    return { subtotal, discount, discountPercent, total, paidDue: total * depositPercent / 100, balance: total * (1 - depositPercent / 100), lines };
}

async function saveReceiptRecordDraft() {
    const state = window._aprilsCurrentReceipt;
    if (!state) return;
    const receiptNumber = document.getElementById("generatedReceiptNumber")?.value || "";
    if (!receiptNumber) return;
    const invoiceNumber = document.getElementById("generatedReceiptInvoiceNumber")?.value || "";
    const amount = Number(document.getElementById("generatedReceiptAmount")?.value || 0);
    const actor = await getCurrentStaffIdentity();
    const record = {
        receiptNumber, invoiceNumber,
        enteredBy: actor.staffId,
        createdBy: actor.staffId,
        createdAt: new Date().toISOString(),
        customer: document.getElementById("generatedReceiptCustomer")?.value || "",
        phone: document.getElementById("generatedReceiptPhone")?.value || "",
        email: document.getElementById("generatedReceiptEmail")?.value || "",
        amount,
        method: document.getElementById("generatedReceiptMethod")?.value || "",
        reference: document.getElementById("generatedReceiptReference")?.value || "",
        date: document.getElementById("generatedReceiptDate")?.value || new Date().toISOString().slice(0,10),
        status: "Draft — payment not yet recorded",
        savedAt: new Date().toISOString(),
        saveType: "automatic"
    };
    await safeSettingUpsert("receipt_record_" + contentSlug(receiptNumber), JSON.stringify(record));
}

function openReceiptGenerator() {
    const invoiceState = window._aprilsCurrentInvoice;
    if (!invoiceState) {
        message("Please generate an invoice first before generating a receipt.", "error");
        return;
    }

    const totals = getCurrentInvoiceTotals();
    let modal = document.getElementById("receiptGeneratorModal");
    let backdrop = document.getElementById("receiptGeneratorBackdrop");
    if (!modal) {
        backdrop = document.createElement("div");
        backdrop.id = "receiptGeneratorBackdrop";
        backdrop.className = "invoice-generator-backdrop receipt-generator-backdrop";
        backdrop.onclick = closeReceiptGenerator;
        document.body.appendChild(backdrop);
        modal = document.createElement("div");
        modal.id = "receiptGeneratorModal";
        modal.className = "invoice-generator-modal receipt-generator-modal";
        document.body.appendChild(modal);
    }

    const receiptNumber = "AS-RC-" + new Date().toISOString().slice(0,10).replace(/-/g,"") + "-" + Math.random().toString(36).slice(2,7).toUpperCase();
    const invoiceNumber = document.getElementById("generatedInvoiceNumber")?.value || "";
    const customer = document.getElementById("generatedInvoiceCustomer")?.value || "";
    const phone = document.getElementById("generatedInvoicePhone")?.value || "";
    const email = document.getElementById("generatedInvoiceEmail")?.value || "";
    const invoiceDate = document.getElementById("generatedInvoiceDate")?.value || "";

    modal.innerHTML = `
        <div class="invoice-generator-toolbar">
            <button type="button" class="submission-modal-close" onclick="closeReceiptGenerator()" aria-label="Close">&times;</button>
            <h2>Generate Payment Receipt</h2>
            <p class="receipt-intro">Generate this receipt only after payment has been received. It records the amount actually paid by the customer.</p>
            <div class="invoice-action-buttons">
                <button type="button" class="primary" id="receiptDownloadPdf">Download PDF</button>
                <button type="button" class="primary" id="receiptSharePdf">Share PDF</button>
                <button type="button" class="secondary" id="receiptPrint">Print</button>
                <button type="button" class="secondary" id="receiptWhatsApp">WhatsApp</button>
                <button type="button" class="secondary" id="receiptEmail">Email</button>
                <button type="button" class="primary" id="receiptSavePayment">Save Payment</button>
            </div>
        </div>
        <div class="invoice-generator-editor receipt-editor">
            <div class="form-grid">
                <div class="form-group"><label>Receipt Number</label><input id="generatedReceiptNumber" value="${escapeHTML(receiptNumber)}"></div>
                <div class="form-group"><label>Receipt Date</label><input id="generatedReceiptDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
                <div class="form-group"><label>Invoice Number</label><input id="generatedReceiptInvoiceNumber" value="${escapeHTML(invoiceNumber)}" readonly></div>
                <div class="form-group"><label>Amount Received (GHS)</label><input id="generatedReceiptAmount" type="number" min="0" step="0.01" value="${Math.min(totals.paidDue, Math.max(0, totals.total - Number((invoiceState.savedPayments || []).reduce((s,p)=>s+Number(p.amount||0),0)))).toFixed(2)}"></div>
                <div class="form-group"><label>Payment Method</label><select id="generatedReceiptMethod"><option>Mobile Money</option><option>Bank Transfer</option><option>Cash</option><option>Card</option><option>Other</option></select></div>
                <div class="form-group"><label>Transaction / Reference</label><input id="generatedReceiptReference" placeholder="Optional transaction reference"></div>
            </div>
            <div class="form-grid">
                <div class="form-group"><label>Customer Name</label><input id="generatedReceiptCustomer" value="${escapeHTML(customer)}"></div>
                <div class="form-group"><label>Phone / WhatsApp</label><input id="generatedReceiptPhone" value="${escapeHTML(phone)}"></div>
                <div class="form-group"><label>Email</label><input id="generatedReceiptEmail" value="${escapeHTML(email)}"></div>
                <div class="form-group"><label>Original Invoice Date</label><input value="${escapeHTML(invoiceDate)}" readonly></div>
            </div>
            <div class="form-group"><label>Receipt Note</label><textarea id="generatedReceiptNote">Payment received by Aprils Signature. Thank you for your business.</textarea></div>
        </div>
        <div id="generatedReceiptPreview"></div>
    `;

    const preview = modal.querySelector("#generatedReceiptPreview");
    function renderReceipt() {
        const amount = Math.max(0, Number(document.getElementById("generatedReceiptAmount")?.value || 0));
        const remaining = Math.max(0, totals.total - amount);
        const logoSrc = new URL("../icons/Aprils Signature logo.jpeg", window.location.href).href;
        preview.innerHTML = `
            <div class="receipt-paper" id="receiptPaper">
                <div class="receipt-brand-row">
                    <img src="${escapeHTML(logoSrc)}" alt="Aprils Signature logo">
                    <div><h1>Aprils Signature</h1><p>Elegance in Every Stitch</p></div>
                    <div class="receipt-meta"><strong>PAYMENT RECEIPT</strong><span>Receipt No: ${escapeHTML(document.getElementById("generatedReceiptNumber").value)}</span><span>Date: ${escapeHTML(document.getElementById("generatedReceiptDate").value)}</span></div>
                </div>
                <div class="receipt-status">PAYMENT RECEIVED</div>
                <div class="receipt-customer">
                    <div><strong>Received From</strong><br>${escapeHTML(document.getElementById("generatedReceiptCustomer").value)}<br>${escapeHTML(document.getElementById("generatedReceiptPhone").value)}<br>${escapeHTML(document.getElementById("generatedReceiptEmail").value)}</div>
                    <div><strong>Reference Invoice</strong><br>${escapeHTML(document.getElementById("generatedReceiptInvoiceNumber").value)}<br><strong>Payment Method</strong><br>${escapeHTML(document.getElementById("generatedReceiptMethod").value)}<br><strong>Transaction Reference</strong><br>${escapeHTML(document.getElementById("generatedReceiptReference").value || "—")}</div>
                </div>
                <table class="receipt-lines"><thead><tr><th>#</th><th>Item / Description</th><th>Qty</th><th>Amount (GHS)</th></tr></thead><tbody>
                    ${totals.lines.map((l,i) => `<tr><td>${i+1}</td><td>${escapeHTML(l.description)}${l.details ? `<small>${escapeHTML(l.details)}</small>` : ""}</td><td>${l.quantity}</td><td>${(l.quantity*l.unitPrice).toFixed(2)}</td></tr>`).join("")}
                </tbody></table>
                <div class="receipt-summary">
                    <p>Subtotal: <strong>GHS ${totals.subtotal.toFixed(2)}</strong></p>
                    <p>Discount (${totals.discountPercent.toFixed(2)}%): <strong>GHS ${totals.discount.toFixed(2)}</strong></p>
                    <p>Invoice Total: <strong>GHS ${totals.total.toFixed(2)}</strong></p>
                    <p>Amount Received: <strong>GHS ${amount.toFixed(2)}</strong></p>
                    <p>Balance Remaining: <strong>GHS ${remaining.toFixed(2)}</strong></p>
                </div>
                <div class="receipt-payment"><strong>Payment Details</strong>
                    <div class="invoice-payment-grid ${(invoiceState.paymentAccounts || []).length > 1 ? "two" : "one"}">
                        ${(invoiceState.paymentAccounts || []).map(item=>`<div class="invoice-payment-account">
                            <strong>${escapeHTML([item.network,item.number].filter(Boolean).join(" "))}</strong><br>
                            <span>${escapeHTML(item.name || "")}</span>${item.branch ? `<br><span>Branch: ${escapeHTML(item.branch)}</span>` : ""}
                        </div>`).join("")}
                    </div>
                </div>
                <div class="receipt-note"><strong>Note</strong><br><em>${escapeHTML(document.getElementById("generatedReceiptNote").value)}</em></div>
                <div class="receipt-footer">Aprils Signature • Elegance in Every Stitch<br>This receipt confirms the payment recorded above.</div>
            </div>
        `;
    }

    ["input","change"].forEach(evt => modal.addEventListener(evt, () => { renderReceipt(); }));
    renderReceipt();
    modal.querySelector("#receiptDownloadPdf").onclick = () => generateReceiptPdf(false);
    modal.querySelector("#receiptSharePdf").onclick = () => generateReceiptPdf(true);
    modal.querySelector("#receiptPrint").onclick = () => printGeneratedReceipt();
    modal.querySelector("#receiptWhatsApp").onclick = () => shareGeneratedReceiptWhatsApp();
    modal.querySelector("#receiptEmail").onclick = () => shareGeneratedReceiptEmail();
    modal.querySelector("#receiptSavePayment").onclick = async () => {
        const amount = Number(document.getElementById("generatedReceiptAmount")?.value || 0);
        if (amount <= 0) { message("Enter the amount actually received before saving the payment.", "error"); return; }
        if (invoiceState.isTrainingInvoice && amount < totals.total) {
            message("Training registration invoices require full payment before a receipt can be recorded.", "error");
            return;
        }
        try {
            await saveInvoicePayment({
                invoiceNumber: document.getElementById("generatedReceiptInvoiceNumber")?.value || "",
                receiptNumber: document.getElementById("generatedReceiptNumber")?.value || "",
                customer: document.getElementById("generatedReceiptCustomer")?.value || "",
                phone: document.getElementById("generatedReceiptPhone")?.value || "",
                email: document.getElementById("generatedReceiptEmail")?.value || "",
                amount,
                method: document.getElementById("generatedReceiptMethod")?.value || "",
                reference: document.getElementById("generatedReceiptReference")?.value || "",
                date: document.getElementById("generatedReceiptDate")?.value || new Date().toISOString().slice(0,10)
            });
            await safeSettingUpsert(
                "receipt_record_" + contentSlug(document.getElementById("generatedReceiptNumber")?.value || ""),
                JSON.stringify({
                    receiptNumber: document.getElementById("generatedReceiptNumber")?.value || "",
                    invoiceNumber: document.getElementById("generatedReceiptInvoiceNumber")?.value || "",
                    customer: document.getElementById("generatedReceiptCustomer")?.value || "",
                    phone: document.getElementById("generatedReceiptPhone")?.value || "",
                    email: document.getElementById("generatedReceiptEmail")?.value || "",
                    amount,
                    lines: totals.lines || [],
                    total: Number(totals.total || 0),
                    discount: Number(totals.discount || 0),
                    balance: Math.max(0, Number(totals.total || 0) - amount),
                    method: document.getElementById("generatedReceiptMethod")?.value || "",
                    reference: document.getElementById("generatedReceiptReference")?.value || "",
                    date: document.getElementById("generatedReceiptDate")?.value || new Date().toISOString().slice(0,10),
                    status: "Payment recorded",
                    savedAt: new Date().toISOString(),
                    saveType: "manual"
                })
            );
            try { if (window.syncInventoryFromPayment) await window.syncInventoryFromPayment(document.getElementById("generatedReceiptInvoiceNumber")?.value || ""); } catch (inventoryError) { console.warn("Inventory sync after payment skipped:", inventoryError); }
            const latest = await getInvoicePayments(document.getElementById("generatedReceiptInvoiceNumber")?.value || "");
            if (invoiceState) {
                invoiceState.savedPayments = latest;
                try {
                    let record = invoiceState.row || {};
                    const currentInvoiceNumber = document.getElementById("generatedReceiptInvoiceNumber")?.value || "";
                    if (!record.id && currentInvoiceNumber) {
                        try {
                            const savedRecord = await getInvoiceSavedRecord(currentInvoiceNumber);
                            if (savedRecord) record = {...savedRecord, id: savedRecord.sourceId || ""};
                        } catch (_) {}
                    }
                    if (record.id) {
                        const total = Number(totals.total || 0);
                        const payments = await getInvoicePayments(currentInvoiceNumber);
                        const paidTotal = payments.reduce((sum,p)=>sum+Number(p.amount||0),0);
                        const depositDue = Number(totals.paidDue || 0);
                        const paymentStage = paidTotal >= total && total > 0
                            ? "fully_paid"
                            : (invoiceState.isTrainingInvoice
                                ? (paidTotal > 0 ? "part_paid" : "unpaid")
                                : (paidTotal >= depositDue && depositDue > 0 ? "deposit_paid" : (paidTotal > 0 ? "part_paid" : "unpaid")));
                        await safeSettingUpsert((invoiceState.isTrainingInvoice ? "payment_status_training_" : "payment_status_quote_") + record.id, paymentStage);
                        if (invoiceState.isTrainingInvoice && paidTotal >= total && total > 0) {
                            await setAdminRecordStatus("training_status", record.id, "fully_paid");
                        } else if (invoiceState.isTrainingInvoice && paidTotal > 0) {
                            await setAdminRecordStatus("training_status", record.id, "part_paid");
                        }
                        if (!invoiceState.isTrainingInvoice && paidTotal >= depositDue && depositDue > 0) {
                            await setAdminRecordStatus("quote_status", record.id, "order_taken");
                        } else if (!invoiceState.isTrainingInvoice && paidTotal > 0) {
                            await setAdminRecordStatus("quote_status", record.id, "under_review");
                        }
                        await auditSystemEvent(invoiceState.isTrainingInvoice ? "training_registration" : "quote_request", record.id, "payment_saved", {invoiceNumber: currentInvoiceNumber, amount, paidTotal, paymentStage});
                    }
                } catch (_) {}
            }
            message("Payment saved. The invoice balance will update when the invoice is reopened.", "success");
            await loadSavedInvoiceReceiptRecords();
            renderReceipt();
        } catch (error) {
            message("Payment could not be saved: " + error.message, "error");
        }
    };
    backdrop.style.display = "block";
    modal.classList.add("open");
    window._aprilsCurrentReceipt = { modal, preview, renderReceipt, invoiceState, totals };
    
}

function closeReceiptGenerator() {
    document.getElementById("receiptGeneratorBackdrop")?.remove();
    document.getElementById("receiptGeneratorModal")?.remove();
    window._aprilsCurrentReceipt = null;
}

async function generateReceiptPdf(share) {
    const state = window._aprilsCurrentReceipt;
    if (!state) return false;
    state.renderReceipt();
    const paper = document.getElementById("receiptPaper");
    if (!paper) return false;
    const html2pdf = await ensureHtml2Pdf();
    if (!html2pdf) {
        if (share) { message("PDF sharing is unavailable because the PDF service could not be loaded. No PDF page was opened.", "error"); return false; }
        printGeneratedReceipt();
        return false;
    }
    try {
        const options = {
            margin: 0,
            filename: (document.getElementById("generatedReceiptNumber").value || "Aprils-Signature-Receipt") + ".pdf",
            image: {type:"jpeg",quality:0.98},
            html2canvas: {scale:2,useCORS:true},
            jsPDF: {unit:"in",format:"a4",orientation:"portrait"}
        };
        const blob = await pdfFromVisibleElement(paper, options);
        if (share) {
            const file = new File([blob], options.filename, {type:"application/pdf"});
            if (navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))) {
                await navigator.share({title: options.filename, text:"Aprils Signature Payment Receipt", files:[file]});
                return true;
            }
            message("Your device/browser does not provide a file-sharing menu. No PDF page was opened. Try this button on a phone/tablet or a browser that supports file sharing.", "error");
            return false;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href=url; a.download=options.filename; a.click();
        setTimeout(()=>URL.revokeObjectURL(url),1500);
        message("Receipt PDF downloaded.", "success");
        return false;
    } catch (error) {
        console.error(error);
        if (share) { message("The receipt could not be shared as a PDF. No PDF page was opened.", "error"); return false; }
        printGeneratedReceipt();
        message("The receipt PDF could not be downloaded directly, so a print-safe receipt was opened.", "success");
        return false;
    }
}

async function shareGeneratedReceiptWhatsApp(){const phone=document.getElementById("generatedReceiptPhone")?.value||"";const state=window._aprilsCurrentReceipt;if(!state)return;state.renderReceipt();await sharePdfToWhatsApp(document.getElementById("receiptPaper"),`${document.getElementById("generatedReceiptNumber")?.value||"Aprils-Signature-Receipt"}.pdf`,phone,`Aprils Signature Receipt ${document.getElementById("generatedReceiptNumber")?.value||""}`);}

function shareGeneratedReceiptEmail() {
    const subject = encodeURIComponent("Aprils Signature Payment Receipt " + (document.getElementById("generatedReceiptNumber")?.value || ""));
    const body = encodeURIComponent(getGeneratedReceiptShareText());
    window.location.href = `mailto:${encodeURIComponent(document.getElementById("generatedReceiptEmail")?.value || "")}?subject=${subject}&body=${body}`;
}

function printGeneratedReceipt() {
    const state = window._aprilsCurrentReceipt;
    if (!state) return;
    state.renderReceipt();
    const paper = document.getElementById("receiptPaper");
    if (!paper) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
        message("Please allow pop-ups for the admin page to print the receipt.", "error");
        return;
    }
    printWindow.document.write(`<html><head><title>Aprils Signature Payment Receipt</title><style>
        @page{size:A4 portrait;margin:0}body{font-family:Arial,sans-serif;padding:0;margin:0;color:#222}.receipt-paper{width:210mm;max-width:210mm;margin:0 auto;box-sizing:border-box}.receipt-brand-row{display:flex;align-items:center;gap:15px;border-bottom:3px solid #0f7775;padding-bottom:15px}.receipt-brand-row img{width:85px;height:85px;object-fit:contain}.receipt-brand-row h1{color:#0f7775;margin:0}.receipt-meta{margin-left:auto;text-align:right}.receipt-status{margin:25px 0;padding:12px;text-align:center;border:2px solid #0f7775;font-weight:bold;color:#0f7775}.receipt-customer{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:15px;border:1px solid #aaa}.receipt-lines{width:100%;border-collapse:collapse;margin-top:25px}.receipt-lines th,.receipt-lines td{border:1px solid #777;padding:9px;text-align:left}.receipt-lines th{background:#0f7775;color:#fff}.receipt-lines small{display:block;margin-top:4px;color:#555}.receipt-summary{margin-left:auto;max-width:320px;margin-top:20px;text-align:right}.receipt-note{margin-top:20px;padding:12px;border:1px solid #aaa}.receipt-footer{text-align:center;margin-top:35px;color:#555;font-size:12px}</style></head><body>${paper.outerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
}

/* =========================================================
   END MANUAL INVOICE GENERATOR
========================================================= */

function setupShopAdmin(){
    const input=document.getElementById("publicShopUrl");if(!input)return;const url=new URL("../shop.html",window.location.href).href;input.value=url;const open=document.getElementById("openPublicShop");if(open)open.href=url;
    setTimeout(()=>window.renderShopPreview?.(),0);
    document.getElementById("copyPublicShop")?.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(url);message("Shop link copied.","success");}catch(_){input.select();document.execCommand("copy");message("Shop link copied.","success");}});
    document.getElementById("sharePublicShop")?.addEventListener("click",async()=>{try{if(navigator.share)await navigator.share({title:"Aprils Signature Shop",text:"Shop Aprils Signature online",url});else{await navigator.clipboard.writeText(url);message("Shop link copied.","success");}}catch(error){if(error?.name!=="AbortError")message("The Shop link could not be shared on this device.","error");}});
}

async function loadAdminServices() {
    const list=document.getElementById("adminServicesList"); if(!list)return;
    try { const result=await db.from("admin_services").select("*").order("display_order",{ascending:true}).order("title"); if(result.error)throw result.error; const rows=result.data||[];
        list.innerHTML=rows.length?`<table><thead><tr><th>Service</th><th>Category</th><th>Order</th><th>Active</th><th>Actions</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeHTML(r.title)}</td><td>${escapeHTML(r.category||"")}</td><td>${escapeHTML(r.display_order??1)}</td><td>${r.active!==false?"Yes":"No"}</td><td><button type="button" class="secondary" data-edit-service="${escapeHTML(r.id)}">Edit</button> <button type="button" class="danger" data-delete-service="${escapeHTML(r.id)}">Delete</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">No services have been added yet.</div>`;
        list.querySelectorAll("[data-edit-service]").forEach(b=>b.onclick=()=>{const r=rows.find(x=>String(x.id)===String(b.dataset.editService));if(!r)return;document.getElementById("adminServiceId").value=r.id;document.getElementById("adminServiceTitle").value=r.title||"";document.getElementById("adminServiceCategory").value=r.category||"";document.getElementById("adminServiceOrder").value=r.display_order??1;document.getElementById("adminServiceDescription").value=r.description||"";document.getElementById("adminServiceActive").checked=r.active!==false;focusAdminForm("adminServiceForm","adminServiceTitle");});
        list.querySelectorAll("[data-delete-service]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this service?"))return;const r=await db.from("admin_services").delete().eq("id",b.dataset.deleteService);if(r.error){message("Service could not be deleted: "+r.error.message,"error");return;}await loadAdminServices();});
    } catch(error) { list.innerHTML=`<div class="empty">Services could not be loaded. Check the Supabase table/policy. ${escapeHTML(error.message||"")}</div>`; }
}
function setupAdminServiceForm(){
    const form=document.getElementById("adminServiceForm");if(!form||form.dataset.bound)return;form.dataset.bound="1";
    form.addEventListener("submit",async e=>{e.preventDefault();const id=document.getElementById("adminServiceId").value.trim();const payload={title:document.getElementById("adminServiceTitle").value.trim(),category:document.getElementById("adminServiceCategory").value.trim(),display_order:Number(document.getElementById("adminServiceOrder").value||1),description:document.getElementById("adminServiceDescription").value.trim(),active:document.getElementById("adminServiceActive").checked,updated_at:new Date().toISOString()};if(!payload.title){message("Enter a service name.","error");return;}try{const r=id?await db.from("admin_services").update(payload).eq("id",id):await db.from("admin_services").insert(payload);if(r.error)throw r.error;form.reset();document.getElementById("adminServiceId").value="";document.getElementById("adminServiceActive").checked=true;message("Service saved successfully.","success");await loadAdminServices();returnToAdminList("[data-edit-service]", id);}catch(error){message("Service could not be saved: "+error.message,"error");}});
    document.getElementById("adminServiceCancel")?.addEventListener("click",()=>{form.reset();document.getElementById("adminServiceId").value="";document.getElementById("adminServiceActive").checked=true;});
}
function newAdminService(){const f=document.getElementById("adminServiceForm");if(!f)return;f.reset();document.getElementById("adminServiceId").value="";document.getElementById("adminServiceActive").checked=true;f.scrollIntoView({behavior:"smooth",block:"center"});document.getElementById("adminServiceTitle")?.focus();}

async function loadServices() {
    const section = document.getElementById("services");
    if (!section) return;

    section.innerHTML = `
        <h2>Products / Services &amp; Training</h2>
        <p class="intro">Manage the public product/service catalogue and training programmes. Public and invoice prices are saved together here so each item can be used correctly when an invoice is generated.</p>

        <div class="form-card">
            <h3 style="color:#008c95;margin-bottom:10px;">Products / Services</h3>
            <p class="intro">Add, edit, delete, rename and reorder products/services. Both the public price and internal invoice price can be entered here.</p>
            <form id="adminProductForm">
                <input type="hidden" id="adminProductId">
                <div class="form-grid">
                    <div class="form-group"><label>Product / Service Name</label><input type="text" id="adminProductTitle" required placeholder="e.g. Custom Hoodie"></div>
                    <div class="form-group"><label for="adminProductCategory">Category</label><input type="text" id="adminProductCategory" list="serviceCategoryOptions" placeholder="e.g. Streetwear">
                        <datalist id="serviceCategoryOptions">
                            <option value="Streetwear"></option><option value="Ladies Wear"></option><option value="Kids Wear"></option>
                            <option value="Rhinestone Embellishment"></option><option value="T-Shirt Printing"></option><option value="Screen Printing"></option>
                            <option value="Fabric Painting"></option><option value="Glitter Works"></option><option value="Practical Fashion Training"></option>
                        </datalist>
                    </div>
                    <div class="form-group"><label>Public Price (GHS)</label><input type="number" id="adminProductPublicPrice" min="0" step="0.01" placeholder="Optional public price"></div>
                    <div class="form-group"><label>Invoice Price (GHS)</label><input type="number" id="adminProductInvoicePrice" min="0" step="0.01" placeholder="Optional invoice price"></div>
                    <div class="form-group"><label>Display Order</label><input type="number" id="adminProductOrder" min="1" value="1"></div>
                </div>
                <div class="form-group"><label>Product / Service Group</label><input type="text" id="adminProductSubcategory" placeholder="e.g. Tops, Bottoms, Sets, Dresses and Gowns"></div>
                <div class="form-group"><label>Product Details / Notes</label><textarea id="adminProductNotes" rows="4" placeholder="Optional details."></textarea></div>
                <label class="checkbox"><input type="checkbox" id="adminProductActive" checked> Active / Available for selection</label><br>
                <button class="primary" type="submit">Save Product / Service</button>
                <button class="secondary" type="button" id="adminProductCancel">Cancel</button>
            </form>
        </div>
        <div id="adminProductsList" class="table-wrap"></div>

        <div class="form-card" style="margin-top:20px;">
            <h3 style="color:#008c95;margin-bottom:10px;">Training / Programme / Class</h3>
            <p class="intro">Add, edit, delete and reorder training programmes/classes. Public and invoice prices are both available.</p>
            <form id="trainingForm">
                <input type="hidden" id="trainingId">
                <div class="form-grid">
                    <div class="form-group"><label>Training / Programme / Class</label><input id="trainingTitle" required placeholder="e.g. One Month Corset Training"></div>
                    <div class="form-group"><label>Duration</label><input id="trainingDuration" placeholder="e.g. 1 month"></div>
                    <div class="form-group"><label>Category</label><input id="trainingCategory" placeholder="e.g. Specialty Class"></div>
                    <div class="form-group"><label>Public Price (GHS)</label><input id="trainingPublicPrice" type="number" min="0" step="0.01" placeholder="Optional public price"></div>
                    <div class="form-group"><label>Invoice Price (GHS)</label><input id="trainingPrice" type="number" min="0" step="0.01" placeholder="Optional invoice price"></div>
                </div>
                <div class="form-group"><label>Description</label><textarea id="trainingDescription" rows="4"></textarea></div>
                <label class="checkbox"><input type="checkbox" id="trainingActive" checked> Active / Available for selection</label><br>
                <button class="primary" type="submit">Save Training / Programme / Class</button>
                <button type="button" class="secondary" id="trainingCancel">Cancel</button>
            </form>
        </div>
        <div id="trainingList" class="table-wrap"></div>`;

    await loadProducts();
    setupProductForm();
    await loadTraining();
    setupTrainingForm();
}

async function loadTraining() {
    const list=document.getElementById("trainingList"); if(!list)return;
    const rows=await getRows("training_programs"); const settings=await getRows("settings"); const invoiceMap=new Map(); const publicMap=new Map();
    settings.filter(r=>String(r.setting_key||"").startsWith("invoice_price_")).forEach(r=>{try{const x=JSON.parse(r.setting_value||"{}");if(x.name)invoiceMap.set(String(x.name).trim().toLowerCase(),x);}catch(_){}});
    settings.filter(r=>String(r.setting_key||"").startsWith("public_training_price_")).forEach(r=>{try{const x=JSON.parse(r.setting_value||"{}");if(x.name)publicMap.set(String(x.name).trim().toLowerCase(),x);}catch(_){}});
    rows.sort((a,b)=>String(a.category||"").localeCompare(String(b.category||""))||String(a.title||"").localeCompare(String(b.title||"")));
    list.innerHTML=rows.length?`<table><thead><tr><th>Programme</th><th>Duration</th><th>Category</th><th>Public Price (GHS)</th><th>Invoice Price (GHS)</th><th>Active</th><th>Actions</th></tr></thead><tbody>${rows.map(r=>{const i=invoiceMap.get(("Training - "+String(r.title||"")).toLowerCase()) || invoiceMap.get(String(r.title||"").trim().toLowerCase()); const p=publicMap.get(String(r.title||"").trim().toLowerCase()); return `<tr><td>${escapeHTML(r.title)}</td><td>${escapeHTML(r.duration||"")}</td><td>${escapeHTML(r.category||"")}</td><td>${p?.price!==undefined?`GHS ${Number(p.price).toFixed(2)}`:"—"}</td><td>${i?.price!==undefined?`GHS ${Number(i.price).toFixed(2)}`:"—"}</td><td>${r.active!==false?"Yes":"No"}</td><td><button type="button" class="secondary" data-edit-training="${escapeHTML(r.id)}">Edit</button> <button type="button" class="danger" data-delete-training="${escapeHTML(r.id)}">Delete</button></td></tr>`;}).join("")}</tbody></table>`:`<div class="empty">No training programmes have been added yet.</div>`;
    list.querySelectorAll("[data-edit-training]").forEach(b=>b.onclick=()=>{const r=rows.find(x=>String(x.id)===String(b.dataset.editTraining));if(!r)return;const i=invoiceMap.get(("Training - "+String(r.title||"")).toLowerCase()) || invoiceMap.get(String(r.title||"").trim().toLowerCase()); const p=publicMap.get(String(r.title||"").trim().toLowerCase()); document.getElementById("trainingId").value=r.id;document.getElementById("trainingTitle").value=r.title||"";document.getElementById("trainingDuration").value=r.duration||"";document.getElementById("trainingPublicPrice").value=p?.price??""; document.getElementById("trainingPrice").value=i?.price??"";document.getElementById("trainingCategory").value=r.category||"";document.getElementById("trainingDescription").value=r.description||"";document.getElementById("trainingActive").checked=r.active!==false;focusAdminForm("trainingForm","trainingTitle");});
    list.querySelectorAll("[data-delete-training]").forEach(b=>b.onclick=async()=>{const r=rows.find(x=>String(x.id)===String(b.dataset.deleteTraining));if(!r||!confirm(`Delete "${r.title}"?`))return;const q=await db.from("training_programs").delete().eq("id",b.dataset.deleteTraining);if(q.error){message("Training programme could not be deleted: "+q.error.message,"error");return;}await db.from("settings").delete().eq("setting_key",invoiceStorageKey("Training - "+r.title));await db.from("settings").delete().eq("setting_key","public_training_price_"+contentSlug(r.title));message("Training programme deleted.","success");await loadTraining();await loadDashboard();});
}

function newTraining() {
    const form = document.getElementById("trainingForm");
    if (!form) return;
    form.reset();
    document.getElementById("trainingId").value = "";
    document.getElementById("trainingActive").checked = true;
    makeCategorySelect("trainingCategory", DEFAULT_TRAINING_CATEGORIES, "", "+ Add New Category");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editTraining(row) {
    document.getElementById("trainingId").value = row.id;
    document.getElementById("trainingTitle").value = row.title || "";
    document.getElementById("trainingDuration").value = row.duration || "";
    document.getElementById("trainingPublicPrice").value = ""; document.getElementById("trainingPrice").value = "";
    makeCategorySelect("trainingCategory", DEFAULT_TRAINING_CATEGORIES, row.category || "", "+ Add New Category");
    document.getElementById("trainingDescription").value = row.description || "";
    document.getElementById("trainingActive").checked = row.active !== false;
    document.getElementById("trainingForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteTraining(id) {
    if (!confirm("Delete this training programme/class?")) return;

    const result = await db.from("training_programs").delete().eq("id", id);
    if (result.error) {
        message("Training programme could not be deleted.", "error");
        return;
    }

    message("Training programme deleted.", "success");
    await loadTraining();
    await loadDashboard();
}

function setupTrainingForm() {
    const form = document.getElementById("trainingForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const id = document.getElementById("trainingId").value.trim();
        let oldTrainingTitle = "";
        if (id) { const oldRow = await db.from("training_programs").select("title").eq("id", id).maybeSingle(); if (!oldRow.error) oldTrainingTitle = oldRow.data?.title || ""; }
        const trainingPublicPrice = document.getElementById("trainingPublicPrice").value === "" ? null : Number(document.getElementById("trainingPublicPrice").value);
        const trainingPrice = document.getElementById("trainingPrice").value === "" ? null : Number(document.getElementById("trainingPrice").value);
        const payload = {
            title: document.getElementById("trainingTitle").value.trim(),
            duration: document.getElementById("trainingDuration").value.trim(),
            category: document.getElementById("trainingCategory").value.trim(),
            description: document.getElementById("trainingDescription").value.trim(),
            active: document.getElementById("trainingActive").checked,
            updated_at: new Date().toISOString()
        };

        try {
            const duplicate = await db.from("training_programs")
                .select("id")
                .ilike("title", payload.title)
                .eq("duration", payload.duration)
                .limit(10);
            if (duplicate.error) throw duplicate.error;
            const duplicateOther = (duplicate.data || []).find(r => String(r.id) !== String(id));
            if (duplicateOther) {
                message("That training programme already exists. Edit the existing one instead.","error");
                return;
            }
            const result = id
                ? await db.from("training_programs").update(payload).eq("id", id)
                : await db.from("training_programs").insert(payload);

            if (result.error) throw result.error;
            await auditSystemEvent("training_program", id || (result.data?.[0]?.id || "new"), id ? "updated" : "created", {title:payload.title,category:payload.category});
            const trainingInvoiceKey = invoiceStorageKey("Training - " + payload.title);
            if (oldTrainingTitle && oldTrainingTitle !== payload.title) { await db.from("settings").delete().eq("setting_key", invoiceStorageKey("Training - " + oldTrainingTitle)); await db.from("settings").delete().eq("setting_key", "public_training_price_" + contentSlug(oldTrainingTitle)); }
            const trainingPublicKey = "public_training_price_" + contentSlug(payload.title);
            if (trainingPublicPrice === null) await db.from("settings").delete().eq("setting_key", trainingPublicKey);
            else await safeSettingUpsert(trainingPublicKey, JSON.stringify({name:payload.title,category:payload.category||"Training",price:trainingPublicPrice,notes:payload.duration||"",active:payload.active}));
            if (trainingPrice === null) await db.from("settings").delete().eq("setting_key", trainingInvoiceKey);
            else await safeSettingUpsert(trainingInvoiceKey, JSON.stringify({name:payload.title,category:payload.category||"Training",price:trainingPrice,notes:payload.duration||"",active:payload.active}));

            form.reset();
            document.getElementById("trainingId").value = "";
            document.getElementById("trainingActive").checked = true;
            message("Training programme saved successfully.", "success");
            await loadTraining();
            await loadDashboard();
            returnToAdminList("[data-edit-training]", id || null);
        } catch (error) {
            console.error(error);
            message("Training programme could not be saved: " + error.message, "error");
        }
    });

    document.getElementById("trainingCancel")?.addEventListener("click", newTraining);
}


function formatDetailLabel(key) {
    return String(key || "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase())
        .replace(/\bGHS\b/i, "GHS");
}

function parseSubmissionDetails(value) {
    if (!value) return {};
    if (typeof value === "object") return value;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : { additionalDetails: String(value) };
    } catch (_) {
        return { additionalDetails: String(value) };
    }
}

function humanizeProductName(name) {
    const labels = {
        jerseys: "Jerseys",
        hoodies: "Hoodies",
        joggers: "Joggers",
        tshirts: "T-shirts",
        poloShirts: "Polo Shirts",
        sweatshirts: "Sweatshirts",
        sweatpants: "Sweatpants",
        ladiesTankTops: "Ladies Tank Tops",
        mensTankTops: "Men's Tank Tops",
        varsityJackets: "Varsity Jackets",
        cargoPants: "Cargo Pants",
        cargoSkirts: "Cargo Skirts",
        joggerShorts: "Jogger Shorts",
        hoodiesJoggersSet: "Hoodies and Joggers Set",
        tshirtsShortsSet: "T-shirts & Shorts Set",
        sweatshirtsShortsSet: "Sweatshirts & Shorts Set"
    };
    return labels[name] || formatDetailLabel(name);
}

function buildQuoteDetailRows(row, details) {
    const rows = [];
    const add = (label, value) => {
        if (value === undefined || value === null || String(value).trim() === "") return;
        rows.push({ label, value: String(value) });
    };

    add("Full Name", row.full_name);
    add("Phone", row.phone);
    add("WhatsApp", row.whatsapp);
    add("Email", row.email);
    add("Location", row.location);
    if (row.created_at) add("Submitted", new Date(row.created_at).toLocaleString("en-GB", {timeZone:"UTC"}) + " GMT");

    const selected = Array.isArray(details.selectedServices)
        ? details.selectedServices
        : String(row.service || "").split(",").map(v => v.trim()).filter(Boolean);

    add("Selected Services", selected.join(", "));

    if (selected.includes("Streetwear") && details.streetwear && typeof details.streetwear === "object") {
        Object.entries(details.streetwear).forEach(([key, item]) => {
            if (!item) return;
            const product = typeof item === "object" ? (item.product || humanizeProductName(key)) : humanizeProductName(key);
            const quantity = typeof item === "object" ? item.quantity : item;
            const detailText = typeof item === "object"
                ? [item.size ? `Size: ${item.size}` : "", item.measurements ? `Measurements: ${item.measurements}` : "", item.colour ? `Colour: ${item.colour}` : ""].filter(Boolean).join(" • ")
                : "";
            add(product, `${quantity}${detailText ? " • " + detailText : ""}`);
        });
        add("Streetwear Other Request", details.streetwearOther);
    }

    if (selected.includes("Ladies Wear")) {
        add("Ladies Wear Size (UK)", details.ladiesWearSize);
        add("Ladies Wear Colour", details.ladiesWearColour);
        add("Ladies Wear General Quantity", details.ladiesWearQuantity);
        if (details.ladiesWearProducts && typeof details.ladiesWearProducts === "object") {
            Object.entries(details.ladiesWearProducts).forEach(([name,item]) => {
                if (!item) return;
                add("Ladies Wear — " + name, [item.quantity ? `Quantity: ${item.quantity}` : "", item.size ? `Size: ${item.size}` : "", item.measurements && String(item.measurements).trim() !== String(item.size || "").trim() ? `Measurements: ${item.measurements}` : "", item.colour ? `Colour: ${item.colour}` : "", item.details ? `Details: ${item.details}` : ""].filter(Boolean).join(" • "));
            });
        }
        add("Ladies Wear Other Request", details.ladiesWearOther);
        add("Ladies Wear Details / Style Request", details.ladiesWear);
    }

    if (selected.includes("Kids Wear")) {
        add("Kids Wear Age", details.kidsWearAge);
        add("Kids Wear Size (UK)", details.kidsWearSize);
        add("Kids Wear Measurements", details.kidsWearMeasurements);
        add("Kids Wear Colour", details.kidsWearColour);
        add("Kids Wear Quantity", details.kidsWearQuantity);
        add("Kids Wear Details / Style Request", details.kidsWear);
    }

    if (selected.includes("Embellishment Services")) {
        const embellishments = Array.isArray(details.embellishment) ? details.embellishment.filter(Boolean) : [];
        add("Embellishment Services", embellishments.join(", "));
        embellishments.forEach(serviceName => {
            const item = details.embellishmentDetails?.[serviceName] || {};
            add(`${serviceName} — Size (UK)`, item.size || details.embellishmentSize);
            if (String(item.measurements || "").trim() && String(item.measurements || "").trim() !== String(item.size || "").trim()) add(`${serviceName} — Measurements`, item.measurements);
            add(`${serviceName} — Colour`, item.colour);
            add(`${serviceName} — Quantity`, item.quantity || details.embellishmentQuantity);
            add(`${serviceName} — Details / Style Request`, item.details || details.embellishmentOther);
        });
    }

    if (details.training) add("Training Request", details.training);
    add("Other Service Request", details.serviceOther);
    if (details.serviceOtherDetails) { const other=details.serviceOtherDetails; add("Others — Size (UK)",other.size); add("Others — Measurements",other.measurements); add("Others — Colour",other.colour); add("Others — Quantity",other.quantity); add("Others — Specify Your Request",other.details); }
    add("Additional Request Details", details.additionalDetails);

    const attachmentNames = []
        .concat(Array.isArray(details.mockups) ? details.mockups : [])
        .concat(Array.isArray(details.inspiration) ? details.inspiration : [])
        .filter(Boolean);
    if (attachmentNames.length) add("Uploaded File Names", attachmentNames.join(", "));

    return rows;
}


function exportSubmissionDetails(title, row = {}, detailsText = "", uploads = []) {
    const details = parseSubmissionDetails(detailsText);
    const lines = [];
    lines.push(title);
    lines.push("=".repeat(title.length));
    lines.push("");

    Object.entries(row || {})
        .filter(([key]) => !["id", "journey", "request_details", "details", "message", "uploads"].includes(key))
        .forEach(([key, value]) => {
            if (value === undefined || value === null || String(value).trim() === "") return;
            lines.push(`${formatDetailLabel(key)}: ${key === "created_at" && value ? new Date(value).toLocaleString("en-GB", {timeZone:"UTC"}) + " GMT" : value}`);
        });

    if (detailsText) {
        lines.push("");
        lines.push("Additional Details");
        lines.push("------------------");
        Object.entries(details || {})
            .filter(([key]) => key !== "uploads" && valueIsExportable(details[key]))
            .forEach(([key, value]) => {
                lines.push(`${formatDetailLabel(key)}: ${typeof value === "object" ? JSON.stringify(value, null, 2) : value}`);
            });
    }

    if (uploads && uploads.length) {
        lines.push("");
        lines.push("Attached Images");
        uploads.forEach(upload => {
            const url = upload?.url || upload?.path || upload;
            if (url) lines.push(String(url));
        });
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${contentSlug(row?.full_name || "submission")}-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

function valueIsExportable(value) {
    return value !== undefined && value !== null && String(value).trim() !== "";
}

async function shareText(title, text) {
    try {
        if (navigator.share) { await navigator.share({ title, text }); return; }
        await navigator.clipboard.writeText(text);
        message("Share is not available on this device. The details were copied to the clipboard.", "success");
    } catch (error) {
        if (error?.name === "AbortError") return;
        try { await navigator.clipboard.writeText(text); message("Details copied to the clipboard. You can paste them into WhatsApp, email or another app.", "success"); } catch (_) { message("Unable to share these details on this device.", "error"); }
    }
}

function buildShareText(title, row = {}, detailsText = "") {
    const details = parseSubmissionDetails(detailsText);
    const lines=[title,""];
    Object.entries(row||{}).filter(([k])=>!["id","journey","request_details","details","message","uploads"].includes(k)).forEach(([k,v])=>{if(v!==undefined&&v!==null&&String(v).trim()) lines.push(`${formatDetailLabel(k)}: ${v}`);});
    Object.entries(details||{}).filter(([k])=>k!=="uploads"&&valueIsExportable(details[k])).forEach(([k,v])=>lines.push(`${formatDetailLabel(k)}: ${typeof v==="object"?JSON.stringify(v):v}`));
    return lines.join("\n");
}

async function resolveSubmissionUploads(uploads = []) {
    if (!Array.isArray(uploads) || !uploads.length || !db) return uploads || [];
    const resolved = [];
    for (const item of uploads) {
        const raw = item?.path || item?.url || item;
        let url = item?.url || "";
        let path = item?.path || "";
        if (!path && typeof raw === "string" && /quote-uploads/i.test(raw)) {
            const match = raw.match(/quote-uploads\/(.+)$/i);
            if (match) path = decodeURIComponent(match[1].split(/[?#]/)[0]);
        }
        if (path) {
            try { const signed = await db.storage.from("quote-uploads").createSignedUrl(path, 3600); if (!signed.error) url = signed.data?.signedUrl || url; } catch (_) {}
        }
        resolved.push({...((item && typeof item === "object") ? item : {name:String(item||"")}), url, path});
    }
    return resolved;
}

async function showSubmissionDetails(title, row, detailsText = "", uploads = []) {
    let modal = document.getElementById("submissionDetailsModal");
    let backdrop = document.getElementById("submissionDetailsBackdrop");

    if (!modal) {
        backdrop = document.createElement("div");
        backdrop.id = "submissionDetailsBackdrop";
        backdrop.className = "submission-modal-backdrop";
        backdrop.addEventListener("click", closeSubmissionDetails);
        document.body.appendChild(backdrop);

        modal = document.createElement("div");
        modal.id = "submissionDetailsModal";
        modal.className = "submission-modal";
        modal.innerHTML = '<button type="button" class="submission-modal-close" aria-label="Close">&times;</button><div class="submission-modal-body"></div>';
        modal.querySelector(".submission-modal-close").addEventListener("click", closeSubmissionDetails);
        document.body.appendChild(modal);
    }

    const body = modal.querySelector(".submission-modal-body");
    uploads = await resolveSubmissionUploads(uploads);
    const details = parseSubmissionDetails(detailsText);
    const isQuote = /quote|order/i.test(title);
    const isTraining = /training/i.test(title);
    let rows;

    if (isQuote) {
        rows = buildQuoteDetailRows(row || {}, details);
    } else {
        rows = Object.entries(row || {})
            .filter(([key]) => !["id", "journey", "request_details", "details", "message", "uploads"].includes(key))
            .map(([key, value]) => ({
                label: formatDetailLabel(key),
                value: key === "created_at" && value ? new Date(value).toLocaleString("en-GB", {timeZone:"UTC"}) + " GMT" : (value ?? "—")
            }));

        if (detailsText) {
            Object.entries(details)
                .filter(([key]) => key !== "uploads")
                .forEach(([key, value]) => {
                    if (value === undefined || value === null || String(value).trim() === "") return;
                    rows.push({
                        label: formatDetailLabel(key),
                        value: typeof value === "object" ? JSON.stringify(value) : String(value)
                    });
                });
        }
    }

    const fields = rows.length ? `
        <div class="submission-table-wrap">
            <table class="submission-details-table">
                <thead><tr><th>Field</th><th>Details</th></tr></thead>
                <tbody>
                    ${rows.map(item => `
                        <tr>
                            <th>${escapeHTML(item.label)}</th>
                            <td>${escapeHTML(item.value)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    ` : '<div class="submission-field"><strong>Details</strong><div>No additional details were supplied.</div></div>';

    const uploadHtml = (uploads || []).length
        ? `<h3 class="submission-subheading">Attached Images</h3><div class="submission-uploads">${uploads.map(u => {
            const url = u?.url || u?.path || u;
            return `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHTML(url)}" alt="Customer upload"><span>Open image</span></a>`;
        }).join("")}</div>`
        : (isQuote ? `<p class="submission-no-uploads"><strong>Attached Images:</strong> None</p>` : "");

    body.innerHTML = `
        <div class="submission-modal-header">
            <h2>${escapeHTML(title)}</h2>
            <div class="submission-modal-actions">
                <button type="button" class="primary submission-export-button" id="exportSubmissionDetails">Export Details</button>
                <button type="button" class="secondary" id="shareSubmissionDetails">Share</button>
                ${(isQuote || isTraining) ? '<button type="button" class="primary" id="generateInvoiceFromOrder">Generate Invoice</button>' : ''}
            </div>
        </div>
        <div class="submission-fields">${fields || '<div class="submission-field"><strong>Details</strong><div>No additional details were supplied.</div></div>'}</div>
        ${uploadHtml}
    `;

    document.getElementById("exportSubmissionDetails")?.addEventListener("click", () => {
        exportSubmissionDetails(title, row || {}, detailsText, uploads || []);
    });
    document.getElementById("shareSubmissionDetails")?.addEventListener("click", () => {
        shareText(title, buildShareText(title, row || {}, detailsText));
    });
    document.getElementById("generateInvoiceFromOrder")?.addEventListener("click", () => {
        openInvoiceGenerator(row || {}, {...details, training: isTraining});
    });

    backdrop.style.display = "block";
    modal.classList.add("open");
}
function closeSubmissionDetails(){
    document.getElementById("submissionDetailsModal")?.classList.remove("open");
    const b=document.getElementById("submissionDetailsBackdrop"); if(b) b.style.display="none";
}

/* =========================================================
   READ-ONLY CUSTOMER SUBMISSIONS
========================================================= */


const ORDER_STATUS_OPTIONS = [
    ["under_review", "New Customer — Under Review"],
    ["invoice_generated", "Invoice Generated"],
    ["deposit_paid", "Deposit Paid"],
    ["part_paid", "Part Paid"],
    ["order_taken", "Confirmed / Order Taken"],
    ["in_production", "In Production"],
    ["completed", "Completed"],
    ["ready", "Ready for Collection / Delivery"],
    ["fully_paid", "Full Payment"],
    ["dispatched", "Dispatched"],
    ["received", "Received by Customer"],
    ["cancelled", "Cancelled"]
];

const TRAINING_STATUS_OPTIONS = [
    ["under_review", "New Customer — Under Review"],
    ["invoice_generated", "Invoice Generated"],
    ["part_paid", "Part Paid"],
    ["fully_paid", "Fully Paid"],
    ["in_class", "In Class"],
    ["completed", "Completed"],
    ["stopped", "Stopped"],
    ["cancelled", "Cancelled"]
];
const CHECKOUT_STATUS_OPTIONS = ORDER_STATUS_OPTIONS;

function statusOptionsForPrefix(prefix) {
    if (String(prefix || "").startsWith("training_status")) return TRAINING_STATUS_OPTIONS;
    if (String(prefix || "").startsWith("checkout_tracking_status")) return CHECKOUT_STATUS_OPTIONS;
    return ORDER_STATUS_OPTIONS;
}

async function getAdminRecordStatus(prefix, id) {
    try {
        const row = await getSettingValue(prefix + "_" + id);
        return row?.setting_value || "under_review";
    } catch (_) { return "under_review"; }
}

async function setAdminRecordStatus(prefix, id, status) {
    return safeSettingUpsert(prefix + "_" + id, status);
}

function statusSelectHTML(prefix, id, value) {
    const legacy = {request_received:"under_review",reviewed:"under_review",invoice_sent:"invoice_generated",payment_received:"order_taken",work_in_progress:"in_production",delivered:"received",fully_paid:"order_taken"};
    value = legacy[value] || value || "under_review";
    return `<div class="status-control"><select class="admin-status-select" data-status-prefix="${escapeHTML(prefix)}" data-status-id="${escapeHTML(id)}">
        ${statusOptionsForPrefix(prefix).map(([key,label]) => `<option value="${key}" ${key === value ? "selected" : ""}>${label}</option>`).join("")}
    </select><button type="button" class="secondary save-status-button" data-save-status-prefix="${escapeHTML(prefix)}" data-save-status-id="${escapeHTML(id)}">Save</button></div>`;
}

function readOfflineCache(key) {
    try { return JSON.parse(localStorage.getItem("aprils_cache_" + key) || "[]"); } catch (_) { return []; }
}

function writeOfflineCache(key, rows) {
    try { localStorage.setItem("aprils_cache_" + key, JSON.stringify(rows || [])); } catch (_) {}
}

function humanStatus(value) {
    const found = (String(value || "").startsWith("in_class") || String(value || "").startsWith("stopped") || String(value || "").startsWith("completed") ? TRAINING_STATUS_OPTIONS : ORDER_STATUS_OPTIONS).find(([key]) => key === value);
    return found ? found[1] : String(value || "Under Review").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
}

async function getInvoiceSummaryForSubmission(row, training=false) {
    const keys = [];
    try {
        const settings = await getRows("settings");
        const invoices = settings.filter(r=>String(r.setting_key||"").startsWith("invoice_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
        const name=String(row.full_name||"").trim().toLowerCase(), phone=String(row.phone||"").trim();
        const candidates=invoices.filter(inv=>String(inv.customer||"").trim().toLowerCase()===name || String(inv.phone||"").trim()===phone);
        const inv=candidates.sort((a,b)=>String(b.savedAt||"").localeCompare(String(a.savedAt||"")))[0];
        if(!inv) return {invoice:"—",receipt:"—",amount:0,paid:0,balance:0};
        const payments=settings.filter(r=>String(r.setting_key||"").startsWith("invoice_payment_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean).filter(p=>String(p.invoiceNumber||"")===String(inv.invoiceNumber||""));
        const paid=payments.reduce((sum,p)=>sum+Number(p.amount||0),0);
        const receipts=settings.filter(r=>String(r.setting_key||"").startsWith("receipt_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean).filter(rc=>String(rc.invoiceNumber||"")===String(inv.invoiceNumber||""));
        return {invoice:inv.invoiceNumber||"—",receipt:receipts[0]?.receiptNumber||"—",amount:Number(inv.total||0),paid,balance:Math.max(0,Number(inv.total||0)-paid)};
    } catch (_) { return {invoice:"—",receipt:"—",amount:0,paid:0,balance:0}; }
}

async function loadRegistrations() {
    let rows = [];
    try { rows = await getRows("training_registrations"); } catch (_) {}
    if (rows.length) writeOfflineCache("training_registrations", rows);
    else rows = readOfflineCache("training_registrations");
    const list = document.getElementById("registrationList");
    if (!list) return;

    const allSettings = await getRows("settings");
    const statuses = new Map(), paymentStatuses = new Map();
    const invoices = allSettings.filter(r=>String(r.setting_key||"").startsWith("invoice_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
    const payments = allSettings.filter(r=>String(r.setting_key||"").startsWith("invoice_payment_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
    const receipts = allSettings.filter(r=>String(r.setting_key||"").startsWith("receipt_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
    const paymentsByInvoice=new Map();payments.forEach(p=>{const k=String(p.invoiceNumber||"");if(!paymentsByInvoice.has(k))paymentsByInvoice.set(k,[]);paymentsByInvoice.get(k).push(p);});
    allSettings.filter(r=>String(r.setting_key||"").startsWith("training_status_")).forEach(r=>statuses.set(String(r.setting_key).replace("training_status_",""),String(r.setting_value||"")));
    allSettings.filter(r=>String(r.setting_key||"").startsWith("payment_status_training_")).forEach(r=>paymentStatuses.set(String(r.setting_key).replace("payment_status_training_",""),String(r.setting_value||"")));
    const summaries = new Map();
    for (const row of rows) {
        const candidates=invoices.filter(inv=>String(inv.sourceId||"")===String(row.id)||String(inv.customer||"").trim().toLowerCase()===String(row.full_name||"").trim().toLowerCase());
        const inv=candidates.sort((a,b)=>String(b.savedAt||"").localeCompare(String(a.savedAt||"")))[0];
        const invoiceNumber=String(inv?.invoiceNumber||"");
        const paid=(paymentsByInvoice.get(invoiceNumber)||[]).reduce((sum,p)=>sum+Number(p.amount||0),0);
        const total=Number(inv?.total||0);
        const receipt=receipts.find(rc=>String(rc.invoiceNumber||"")===invoiceNumber);
        summaries.set(String(row.id),{invoice:invoiceNumber||"—",receipt:receipt?.receiptNumber||"—",amount:total,paid,balance:Math.max(0,total-paid)});
    }
    list.innerHTML = rows.length ? `<div class="submission-card-grid">${rows.map(row => {
        const summary=summaries.get(String(row.id))||{};
        let effectiveStatus=statuses.get(String(row.id))||"under_review";
        if(!["in_class","stopped","completed"].includes(effectiveStatus) && Number(summary.paid||0)>0){
            effectiveStatus=Number(summary.balance||0)<=0&&Number(summary.amount||0)>0?"fully_paid":"part_paid";
        }
        return `<article class="submission-card">
            <div class="submission-card-top"><div><strong>${escapeHTML(row.full_name||"Customer")}</strong><span>${escapeHTML(row.course||"Training Registration")}</span></div><time>${escapeHTML(row.created_at ? new Date(row.created_at).toLocaleString("en-GB", {timeZone:"UTC"}) + " GMT" : "")}</time></div>
            <div class="submission-card-gridline"><span><b>Phone</b>${escapeHTML(row.phone||"—")}</span><span><b>Location</b>${escapeHTML(row.location||"—")}</span><span><b>Details</b>${escapeHTML(row.message||row.request_details||row.details||"—")}</span></div>
            <div class="submission-status-strip"><span><b>Order Status</b>${statusSelectHTML("training_status", row.id, effectiveStatus)}</span><span><b>Payment Status</b>${escapeHTML((paymentStatuses.get(String(row.id))||"unpaid").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()))}</span><span><b>Invoice</b>${escapeHTML(summary.invoice||"—")}</span><span><b>Receipt</b>${escapeHTML(summary.receipt||"—")}</span><span><b>Amount</b>GHS ${Number(summary.amount||0).toFixed(2)}</span><span><b>Paid</b>GHS ${Number(summary.paid||0).toFixed(2)}</span><span><b>Balance</b>GHS ${Number(summary.balance||0).toFixed(2)}</span></div>
            <div class="submission-card-actions"><button type="button" class="secondary" data-view-registration="${escapeHTML(row.id)}">View Full Details</button><button type="button" class="primary" data-generate-training-invoice="${escapeHTML(row.id)}">Generate Invoice</button><button type="button" class="danger" data-delete-registration="${escapeHTML(row.id)}">Delete</button></div>
        </article>`;
    }).join("")}</div>` : `<div class="empty">No training registrations received.</div>`;

    list.querySelectorAll("[data-save-status-prefix]").forEach(button => {
        button.onclick = async () => {
            const select = button.parentElement?.querySelector(".admin-status-select");
            if (!select) return;
            try {
                await setAdminRecordStatus(button.dataset.saveStatusPrefix, button.dataset.saveStatusId, select.value);
                message("Status updated to " + humanStatus(select.value) + ".", "success");
                button.classList.add("button-working");
                setTimeout(()=>button.classList.remove("button-working"),450);
            } catch (error) { message("Status could not be updated: " + error.message, "error"); }
        };
    });

    list.querySelectorAll("[data-view-registration]").forEach(button => {
        button.onclick = () => {
            const row = rows.find(item => String(item.id) === String(button.dataset.viewRegistration));
            if (row) showSubmissionDetails("Training Registration Details", row, row.message || row.request_details || row.details || "");
        };
    });

    list.querySelectorAll("[data-generate-training-invoice]").forEach(button => {
        button.onclick = async () => {
            const row = rows.find(item => String(item.id) === String(button.dataset.generateTrainingInvoice));
            if (!row) return;
            const priceMap = await getInvoicePriceMap();
            const course = row.course || "Practical Fashion Training";
            const unitPrice = invoicePriceFor(priceMap, "Training - " + course) || invoicePriceFor(priceMap, course);
            const notes = row.message || row.request_details || row.details || "";
            await openInvoiceGenerator(row, {
                manualLines: [{description: course, quantity: 1, unitPrice, details: notes}],
                training: course
            });
            try { await setAdminRecordStatus("training_status", row.id, "invoice_generated"); } catch (_) {}
        };
    });

    list.querySelectorAll("[data-delete-registration]").forEach(button => {
        button.onclick = async () => {
            if (!confirm("Delete this training registration permanently?")) return;
            const result = await db.from("training_registrations").delete().eq("id", button.dataset.deleteRegistration);
            if (result.error) {
                console.error(result.error);
                message("Training registration could not be deleted.", "error");
                return;
            }
            await db.from("settings").delete().eq("setting_key", "training_status_" + button.dataset.deleteRegistration);
            message("Training registration deleted.", "success");
            await loadRegistrations();
            await loadDashboard();
        };
    });
}


function summarizeQuoteQuantities(row) {
    const details = parseSubmissionDetails(row?.journey || row?.request_details || row?.details || row?.message || "");
    const quantities = [];

    if (details?.streetwear && typeof details.streetwear === "object") {
        Object.values(details.streetwear).forEach(item => {
            if (!item) return;
            const product = typeof item === "object" ? item.product : "";
            const quantity = typeof item === "object" ? item.quantity : item;
            if (product && quantity) quantities.push(`${product}: Quantity: ${quantity}`);
        });
    }
    if (details?.ladiesWearProducts && typeof details.ladiesWearProducts === "object" && Object.keys(details.ladiesWearProducts).length) {
        Object.values(details.ladiesWearProducts).forEach(item => { if (item?.product && item?.quantity) quantities.push(`${item.product}: Quantity: ${item.quantity}`); });
    } else if (details?.ladiesWearQuantity) quantities.push(`Ladies Wear: Quantity: ${details.ladiesWearQuantity}`);
    if (details?.kidsWearQuantity) quantities.push(`Kids Wear: Quantity: ${details.kidsWearQuantity}`);
    if (details?.embellishmentDetails) {
        Object.entries(details.embellishmentDetails).forEach(([name,item]) => {
            if (item?.quantity) quantities.push(`${name}: Quantity: ${item.quantity}`);
        });
    }
    return quantities.join(" • ") || "—";
}


function summarizeQuoteDetails(row) {
    const details = parseSubmissionDetails(row?.journey || row?.request_details || row?.details || row?.message || "");
    const selected = Array.isArray(details.selectedServices)
        ? details.selectedServices
        : String(row?.service || "").split(",").map(v => v.trim()).filter(Boolean);
    const parts = [selected.join(", ")];

    if (selected.includes("Streetwear")) {
        const globalStreetwear = [details.streetwearSizeMeasurements, details.streetwearColour].filter(Boolean).join(" • ");
        if (globalStreetwear) parts.push("Streetwear: " + globalStreetwear);
    }

    if (selected.includes("Streetwear") && details.streetwear) {
        Object.values(details.streetwear).forEach(item => {
            if (!item) return;
            const product = typeof item === "object" ? item.product : "";
            const size = typeof item === "object" ? String(item.size || "").trim() : "";
            const measurements = typeof item === "object" ? String(item.measurements || "").trim() : "";
            const detailText = typeof item === "object" ? [size || measurements, item.colour].filter(Boolean).join(" • ") : "";
            if (product) parts.push(`${product}: ${detailText}`.replace(/: $/,""));
        });
    }
    if (selected.includes("Ladies Wear")) parts.push(["Ladies Wear", details.ladiesWearSize, details.ladiesWearColour, details.ladiesWear].filter(Boolean).join(" • "));
    if (selected.includes("Kids Wear")) parts.push(["Kids Wear", details.kidsWearSize, details.kidsWearColour, details.kidsWear].filter(Boolean).join(" • "));
    if (selected.includes("Address") && details.address) {
        const a=details.address; parts.push(["Address", a.size || a.measurements, a.colour, a.quantity, a.details].filter(Boolean).join(" • "));
    }
    if (details.deliveryDate || details.deliveryTime) parts.push(["Delivery / Collection", details.deliveryDate, details.deliveryTime].filter(Boolean).join(" • "));
    if (selected.includes("Embellishment Services") && Array.isArray(details.embellishment)) {
        details.embellishment.forEach(name => {
            const item = details.embellishmentDetails?.[name] || {};
            const detail = item.details || (name === "Others" ? details.embellishmentOther : "");
            parts.push(`${name}${detail ? ": " + detail : ""}`);
        });
        if (details.embellishmentOther && !details.embellishment.includes("Others")) {
            parts.push("Embellishment request: " + details.embellishmentOther);
        }
    }
    if (details.additionalDetails) parts.push(details.additionalDetails);

    return parts.filter(Boolean).join(" | ");
}


function groupDuplicateQuotes(rawRows){
    const groups=new Map();
    for(const row of (rawRows||[])){
        const copy={...row}; delete copy.id; delete copy.created_at; delete copy.updated_at;
        const key=JSON.stringify(copy,Object.keys(copy).sort());
        if(!groups.has(key)) groups.set(key,{...row,_ids:[row.id],_duplicateCount:1});
        else {const g=groups.get(key);g._ids.push(row.id);g._duplicateCount=g._ids.length;}
    }
    return [...groups.values()].sort((a,b)=>String(b.created_at||b.updated_at||"").localeCompare(String(a.created_at||a.updated_at||"")));
}

async function getDeliveryTracking(id) {
    try { const row=await getSettingValue("delivery_tracking_"+id); return row?.setting_value ? JSON.parse(row.setting_value) : {}; } catch (_) { return {}; }
}
async function saveDeliveryTracking(id, value) {
    const actor = await getCurrentStaffIdentity();
    const payload = {...(value||{}), entryId: value?.entryId || makeAprilsUniqueId("DLV"), updatedBy: actor.staffId, updatedAt: new Date().toISOString()};
    await safeSettingUpsert("delivery_tracking_"+id, JSON.stringify(payload));
    await auditSystemEvent("delivery_tracking", id, "saved", payload);
}

async function loadQuotes() {
    let rawRows = [];
    try {
        rawRows = await getRows("quote_requests");
    } catch (error) {
        console.warn("QUOTE REQUEST LOAD ERROR:", error);
    }
    if (rawRows.length) writeOfflineCache("quote_requests", rawRows);
    else rawRows = readOfflineCache("quote_requests");

    const rows = groupDuplicateQuotes(rawRows);
    const list = document.getElementById("quoteList");
    if (!list) return;

    const allSettings = await getRows("settings");
    const statuses = new Map(), paymentStatuses = new Map(), deliveryTracking = new Map();
    const invoices = allSettings.filter(r=>String(r.setting_key||"").startsWith("invoice_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
    const payments = allSettings.filter(r=>String(r.setting_key||"").startsWith("invoice_payment_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
    allSettings.filter(r=>String(r.setting_key||"").startsWith("quote_status_")).forEach(r=>statuses.set(String(r.setting_key).replace("quote_status_",""),String(r.setting_value||"")));
    allSettings.filter(r=>String(r.setting_key||"").startsWith("payment_status_quote_")).forEach(r=>paymentStatuses.set(String(r.setting_key).replace("payment_status_quote_",""),String(r.setting_value||"")));
    allSettings.filter(r=>String(r.setting_key||"").startsWith("delivery_tracking_")).forEach(r=>{try{deliveryTracking.set(String(r.setting_key).replace("delivery_tracking_",""),JSON.parse(r.setting_value||"{}"))}catch(_){}});
    const paymentsByInvoice = new Map();
    payments.forEach(p=>{const k=String(p.invoiceNumber||"");if(!paymentsByInvoice.has(k))paymentsByInvoice.set(k,[]);paymentsByInvoice.get(k).push(p);});
    const quoteSummaries = new Map();
    for (const row of rows) {
        const candidates=invoices.filter(inv=>String(inv.customer||"").trim().toLowerCase()===String(row.full_name||"").trim().toLowerCase() || String(inv.phone||"").trim()===String(row.phone||"").trim());
        const inv=candidates.sort((a,b)=>String(b.savedAt||"").localeCompare(String(a.savedAt||"")))[0];
        const invPays=paymentsByInvoice.get(String(inv?.invoiceNumber||""))||[];
        const paid=invPays.reduce((sum,p)=>sum+Number(p.amount||0),0);
        const total=Number(inv?.total||0);
        quoteSummaries.set(String(row.id),{invoice:inv?.invoiceNumber||"—",receipt:allSettings.map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).find(x=>x&&String(x.invoiceNumber||"")===String(inv?.invoiceNumber||"")&&x.receiptNumber)?.receiptNumber||"—",amount:total,paid,balance:Math.max(0,total-paid)});
    }
    list.innerHTML = rows.length ? `<div class="submission-card-grid">${rows.map(row => {
        let details = row.journey || row.request_details || row.details || row.message || "";
        const summary=quoteSummaries.get(String(row.id))||{};
        let effectiveStatus=statuses.get(String(row.id))||"under_review";
        if(Number(summary.paid||0)>0 && ["under_review","invoice_generated","receipt_generated","deposit_paid","part_paid"].includes(effectiveStatus)){
            effectiveStatus=Number(summary.amount||0)>0 && Number(summary.paid||0)>=Number(summary.amount||0) ? "order_taken" : (Number(summary.amount||0)>0 && Number(summary.paid||0)>=Number(summary.amount||0)*0.75 ? "order_taken" : "under_review");
        }
        const preview = summarizeQuoteDetails(row);
        const duplicateNote = row._duplicateCount > 1 ? ` <small class="duplicate-note">${row._duplicateCount} identical records grouped as one request</small>` : "";
        return `<article class="submission-card">
            <div class="submission-card-top"><div><strong>${escapeHTML(row.full_name||"Customer")}</strong><span>${escapeHTML(row.service||"Order / Quote")}${duplicateNote}</span></div><time>${escapeHTML(row.created_at ? new Date(row.created_at).toLocaleString("en-GB", {timeZone:"UTC"}) + " GMT" : "")}</time></div>
            <div class="submission-card-gridline"><span><b>Phone / WhatsApp</b>${escapeHTML([row.phone,row.whatsapp].filter(Boolean).join(" • ")||"—")}</span><span><b>Location</b>${escapeHTML(row.location||"—")}</span><span><b>Quantity</b>${escapeHTML(summarizeQuoteQuantities(row))}</span><span class="wide"><b>Details</b>${escapeHTML(preview||"—")}</span></div>
            <div class="submission-status-strip"><span><b>Order Status</b>${statusSelectHTML("quote_status", row.id, effectiveStatus)}</span><span><b>Payment Status</b>${escapeHTML((paymentStatuses.get(String(row.id))||"unpaid").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()))}</span><span><b>Invoice</b>${escapeHTML(summary.invoice||"—")}</span><span><b>Receipt</b>${escapeHTML(summary.receipt||"—")}</span><span><b>Amount</b>GHS ${Number(summary.amount||0).toFixed(2)}</span><span><b>Paid</b>GHS ${Number(summary.paid||0).toFixed(2)}</span><span><b>Balance</b>GHS ${Number(summary.balance||0).toFixed(2)}</span><span><b>Delivery / Collection</b>${escapeHTML(deliveryTracking.get(String(row.id))?.date||"—")}${deliveryTracking.get(String(row.id))?.time?" • "+escapeHTML(deliveryTracking.get(String(row.id)).time):""}${deliveryTracking.get(String(row.id))?.location?" • "+escapeHTML(deliveryTracking.get(String(row.id)).location):""}</span></div>
            <div class="delivery-tracking" style="margin:12px 0;padding:12px;border:1px solid #aaa;border-radius:6px;display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:end;"><div><label style="display:block;font-weight:600;margin-bottom:5px;">Delivery / Collection Date</label><input type="date" data-delivery-date="${escapeHTML(row.id)}" value="${escapeHTML(deliveryTracking.get(String(row.id))?.date || "")}"></div><div><label style="display:block;font-weight:600;margin-bottom:5px;">Delivery / Collection Time</label><input type="time" data-delivery-time="${escapeHTML(row.id)}" value="${escapeHTML(deliveryTracking.get(String(row.id))?.time || "")}"></div><div><label style="display:block;font-weight:600;margin-bottom:5px;">Delivery Location</label><input type="text" data-delivery-location="${escapeHTML(row.id)}" value="${escapeHTML(deliveryTracking.get(String(row.id))?.location || "")}" placeholder="Enter delivery / collection location"></div><button type="button" class="secondary" data-save-delivery="${escapeHTML(row.id)}">Save Delivery Details</button></div>
            <div class="submission-card-actions"><button type="button" class="secondary" data-view-quote="${escapeHTML(row.id)}">View Full Details</button><button type="button" class="primary" data-generate-invoice="${escapeHTML(row.id)}">Generate Invoice</button><button type="button" class="danger" data-delete-quote="${escapeHTML(row.id)}">Delete</button></div>
        </article>`;
    }).join("")}</div>` : `<div class="empty">No quote requests received.</div>`;

    list.querySelectorAll("[data-save-status-prefix]").forEach(button => {
        button.onclick = async () => {
            const select = button.parentElement?.querySelector(".admin-status-select");
            if (!select) return;
            try {
                await setAdminRecordStatus(button.dataset.saveStatusPrefix, button.dataset.saveStatusId, select.value);
                message("Status updated to " + humanStatus(select.value) + ".", "success");
                button.classList.add("button-working");
                setTimeout(()=>button.classList.remove("button-working"),450);
            } catch (error) { message("Status could not be updated: " + error.message, "error"); }
        };
    });

    list.querySelectorAll("[data-save-delivery]").forEach(button => {
        button.onclick = async () => {
            const id=button.dataset.saveDelivery;
            try {
                await saveDeliveryTracking(id,{date:list.querySelector(`[data-delivery-date="${CSS.escape(id)}"]`)?.value||"",time:list.querySelector(`[data-delivery-time="${CSS.escape(id)}"]`)?.value||"",location:list.querySelector(`[data-delivery-location="${CSS.escape(id)}"]`)?.value||""});
                message("Delivery / collection details saved.","success");
            } catch(error) { message("Delivery details could not be saved: "+error.message,"error"); }
        };
    });

    list.querySelectorAll("[data-view-quote]").forEach(button => {
        button.onclick = () => {
            const row = rows.find(item => String(item.id) === String(button.dataset.viewQuote));
            if (!row) return;
            const details = row.journey || row.request_details || row.details || row.message || "";
            let uploads = [];
            try {
                const parsed = parseSubmissionDetails(details);
                if (parsed && Array.isArray(parsed.uploads)) uploads = parsed.uploads;
            } catch (_) {}
            showSubmissionDetails("Customer Order / Quote Details", row, details, uploads);
        };
    });

    list.querySelectorAll("[data-generate-invoice]").forEach(button => {
        button.onclick = async () => {
            const row = rows.find(item => String(item.id) === String(button.dataset.generateInvoice));
            if (!row) return;
            const details = parseSubmissionDetails(row.journey || row.request_details || row.details || row.message || "");
            await openInvoiceGenerator(row, details);
            try { await setAdminRecordStatus("quote_status", row.id, "invoice_generated"); } catch (_) {}
        };
    });

    list.querySelectorAll("[data-delete-quote]").forEach(button => {
        button.onclick = async () => {
            const row = rows.find(item => String(item.id) === String(button.dataset.deleteQuote));
            if (!row) return;
            const count = row._ids?.length || 1;
            if (!confirm(count > 1
                ? `Delete this grouped request and all ${count} identical records permanently?`
                : "Delete this order / quote request permanently?")) return;

            try {
                for (const id of row._ids || [row.id]) {
                    const result = await db.from("quote_requests").delete().eq("id", id);
                    if (result.error) throw result.error;
                    await db.from("settings").delete().eq("setting_key", "quote_status_" + id);
                }
                message(count > 1 ? "Grouped duplicate quote records deleted." : "Order / quote request deleted.", "success");
                await loadQuotes();
                await loadDashboard();
            } catch (error) {
                console.error(error);
                message("Order / quote request could not be deleted: " + error.message, "error");
            }
        };
    });
}



/* =========================================================
   ORDER TRACKING & TRAINEES
========================================================= */
async function loadOrderTracking(){
 const list=document.getElementById("orderTrackingList");if(!list)return;
 try{
  const [qr,settings,trainingRows]=await Promise.all([db.from("quote_requests").select("*"),getRows("settings"),getRows("training_registrations")]);
  if(qr.error)throw qr.error;
  const invs=settings.filter(r=>String(r.setting_key||"").startsWith("invoice_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
  const pays=settings.filter(r=>String(r.setting_key||"").startsWith("invoice_payment_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
  const rows=(qr.data||[]).map(r=>{let j={};try{j=JSON.parse(r.journey||"{}")}catch(_){}return{...r,j}});
  const track=[],paymentsByInvoice=new Map(),deliveryById=new Map(),statusById=new Map();
  pays.forEach(p=>{const k=String(p.invoiceNumber||"");if(!paymentsByInvoice.has(k))paymentsByInvoice.set(k,[]);paymentsByInvoice.get(k).push(p);});
  settings.filter(r=>String(r.setting_key||"").startsWith("delivery_tracking_")).forEach(r=>{try{deliveryById.set(String(r.setting_key).replace("delivery_tracking_",""),JSON.parse(r.setting_value||"{}"))}catch(_){}});
  settings.filter(r=>String(r.setting_key||"").startsWith("quote_status_")).forEach(r=>statusById.set(String(r.setting_key).replace("quote_status_",""),String(r.setting_value||"")));
  for(const row of rows){
   const checkout=!!row.j.checkout;
   const invoice=invs.filter(i=>String(i.sourceId||"")===String(row.id)||String(i.customer||"").trim().toLowerCase()===String(row.full_name||"").trim().toLowerCase()).sort((x,y)=>String(y.savedAt||"").localeCompare(String(x.savedAt||"")))[0];
   const invoiceNumber=invoice?.invoiceNumber||row.j.invoiceNumber||"";
   const paid=(paymentsByInvoice.get(String(invoiceNumber))||[]).reduce((sum,x)=>sum+Number(x.amount||0),0);
   const total=Number(invoice?.total??row.j.total??0);
   let status=checkout?(row.j.orderStatus||"under_review"):(statusById.get(String(row.id))||"under_review");
   const legacyTracking={fully_paid:"order_taken",receipt_generated:"order_taken",deposit_paid:"under_review",invoice_generated:"under_review"};
   status=legacyTracking[status]||status;
   const delivery=checkout?{date:row.j.deliveryDate||"",time:row.j.deliveryTime||"",location:row.j.deliveryLocation||""}:(deliveryById.get(String(row.id))||{});
   const confirmed=paid>0 || ["order_taken","in_production","completed","ready","dispatched","received"].includes(status);
   if(confirmed)track.push({row,checkout,invoice,invoiceNumber,paid,total,status,delivery});
  }
  track.sort((x,y)=>String(y.row.created_at||"").localeCompare(String(x.row.created_at||"")));
  const columns=[
   ["pending","Pending",x=>x.status==="under_review"||x.status==="invoice_generated"||x.status==="deposit_paid"||x.status==="part_paid"||x.status==="receipt_generated"],
   ["confirmed","Confirmed / Order Taken",x=>x.status==="order_taken"],
   ["production","In Production",x=>x.status==="in_production"],
   ["completed","Completed",x=>x.status==="completed"],
   ["ready","Ready for Collection / Delivery",x=>x.status==="ready"],
   ["dispatched","Dispatched",x=>x.status==="dispatched"],
   ["received","Received by Customer",x=>x.status==="received"]
  ];
  const card=x=>{
   const balance=Math.max(0,x.total-x.paid);
   const items=x.checkout?(x.row.j.items||[]).map(i=>`${i.name} × ${i.quantity}`).join(", "):summarizeQuoteDetails(x.row);
   return `<article class="tracking-order-card"><div class="tracking-card-head"><div><strong>${escapeHTML(x.row.full_name||"Customer")}</strong><small>${escapeHTML(x.checkout?"Checkout Order":x.row.service||"Order / Quote")}</small></div><time>${escapeHTML(x.row.created_at?new Date(x.row.created_at).toLocaleString("en-GB", {timeZone:"UTC", day:"2-digit", month:"2-digit", year:"numeric"}):"")}</time></div><div class="tracking-card-data"><span><b>Items</b>${escapeHTML(items||"—")}</span><span><b>Paid</b>GHS ${x.paid.toFixed(2)}</span><span><b>Balance</b>GHS ${balance.toFixed(2)}</span><span><b>Due</b>${escapeHTML(x.delivery.date||"Not set")}${x.delivery.time?" • "+escapeHTML(x.delivery.time):""}</span><span><b>Location</b>${escapeHTML(x.delivery.location||"Not set")}</span></div><div class="tracking-card-status">${statusSelectHTML(x.checkout?"checkout_tracking_status":"quote_status",x.row.id,x.status)}</div><div class="tracking-card-due"><label>Collection / Delivery Date<input type="date" data-track-date="${escapeHTML(x.row.id)}" value="${escapeHTML(x.delivery.date||"")}"></label><label>Time<input type="time" data-track-time="${escapeHTML(x.row.id)}" value="${escapeHTML(x.delivery.time||"")}"></label><label>Location<input type="text" data-track-location="${escapeHTML(x.row.id)}" value="${escapeHTML(x.delivery.location||"")}" placeholder="Delivery / collection location"></label></div><div class="submission-card-actions"><button type="button" class="secondary" data-save-tracking="${escapeHTML(x.row.id)}" data-checkout="${x.checkout?"1":"0"}">Save</button><button type="button" class="secondary" data-view-tracking="${escapeHTML(x.row.id)}">View Full Details</button></div></article>`;
  };
  list.innerHTML=track.length?`<div class="tracking-board">${columns.map(([key,title,test])=>{const items=track.filter(test);return `<section class="tracking-column tracking-${key}"><header><h3>${title}</h3><strong>${items.length}</strong></header><div class="tracking-column-body">${items.length?items.map(card).join(""):`<div class="tracking-empty">No confirmed orders</div>`}</div></section>`}).join("")}</div>`:`<div class="empty">No confirmed customer orders are available for tracking. Orders appear here after a payment has been recorded.</div>`;
  list.querySelectorAll("[data-save-tracking]").forEach(b=>b.onclick=async()=>{
   const id=b.dataset.saveTracking,checkout=b.dataset.checkout==="1",select=b.closest(".tracking-order-card")?.querySelector(".admin-status-select");
   try{
    const status=select?.value||"under_review",cardRow=track.find(v=>String(v.row.id)===String(id));
    const date=b.closest(".tracking-order-card")?.querySelector("[data-track-date]")?.value||"",time=b.closest(".tracking-order-card")?.querySelector("[data-track-time]")?.value||"",location=b.closest(".tracking-order-card")?.querySelector("[data-track-location]")?.value||"";
    if(checkout){cardRow.row.j.orderStatus=status;await db.from("quote_requests").update({journey:JSON.stringify(cardRow.row.j)}).eq("id",id);await safeSettingUpsert("checkout_status_"+id,status)}
    else await setAdminRecordStatus("quote_status",id,status);
    await saveDeliveryTracking(id,{date,time,location});await auditSystemEvent(checkout?"checkout_order":"quote_request",id,"tracking_updated",{status,date,time,location});message("Order tracking updated.","success");await loadOrderTracking();
   }catch(e){message("Order tracking could not be updated: "+e.message,"error")}
  });
  list.querySelectorAll("[data-view-tracking]").forEach(b=>{
   const x=track.find(v=>String(v.row.id)===String(b.dataset.viewTracking)); if(!x)return;
   const details=`Customer: ${x.row.full_name||""}\nPhone: ${x.row.phone||""}\nWhatsApp: ${x.row.whatsapp||""}\nEmail: ${x.row.email||""}\nOriginal Location: ${x.row.location||""}\nItems: ${x.checkout?(x.row.j.items||[]).map(i=>`${i.name} × ${i.quantity}`).join(", "):summarizeQuoteDetails(x.row)}\nInvoice: ${x.invoiceNumber||""}\nTotal: GHS ${Number(x.total||0).toFixed(2)}\nPaid: GHS ${Number(x.paid||0).toFixed(2)}\nBalance: GHS ${Math.max(0,Number(x.total||0)-Number(x.paid||0)).toFixed(2)}\nStatus: ${humanStatus(x.status)}\nDelivery / Collection Date: ${x.delivery.date||""}\nTime: ${x.delivery.time||""}\nLocation: ${x.delivery.location||""}`;
   showSubmissionDetails("Order Tracking Details",x.row,details,[]);
  });
 }catch(e){list.innerHTML=`<div class="empty">Order tracking could not be loaded: ${escapeHTML(e.message||"")}</div>`}
}
function traineeStatusSelectHTML(id,value){
 const options=[["part_paid","Part Paid"],["fully_paid","Fully Paid"],["in_class","In Class"],["stopped","Stopped"],["completed","Completed"]];
 return `<div class="status-control"><select class="admin-status-select" data-status-prefix="training_status" data-status-id="${escapeHTML(id)}">${options.map(([k,l])=>`<option value="${k}" ${k===value?"selected":""}>${l}</option>`).join("")}</select><button type="button" class="secondary save-status-button" data-save-status-prefix="training_status" data-save-status-id="${escapeHTML(id)}">Save</button></div>`;
}
async function loadTrainees(){
 const list=document.getElementById("traineesList");if(!list)return;
 try{
  const rows=await getRows("training_registrations"),settings=await getRows("settings");
  const invoices=settings.filter(r=>String(r.setting_key||"").startsWith("invoice_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
  const payments=settings.filter(r=>String(r.setting_key||"").startsWith("invoice_payment_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
  const statusMap=new Map();
  settings.filter(r=>String(r.setting_key||"").startsWith("training_status_")).forEach(r=>statusMap.set(String(r.setting_key).replace("training_status_",""),String(r.setting_value||"")));
  const paid=[];
  for(const row of rows){
   const inv=invoices.filter(i=>String(i.sourceId||"")===String(row.id)||String(i.customer||"").trim().toLowerCase()===String(row.full_name||"").trim().toLowerCase()).sort((a,b)=>String(b.savedAt||"").localeCompare(String(a.savedAt||"")))[0];
   const invoiceNumber=inv?.invoiceNumber||"";
   const paidAmount=payments.filter(p=>String(p.invoiceNumber||"")===String(invoiceNumber)).reduce((sum,p)=>sum+Number(p.amount||0),0);
   if(paidAmount<=0)continue;
   const total=Number(inv?.total||0),balance=Math.max(0,total-paidAmount);
   let status=statusMap.get(String(row.id))||"";
   if(!["in_class","stopped","completed"].includes(status)) status=balance<=0&&total>0?"fully_paid":"part_paid";
   paid.push({row,invoice:inv,paid:paidAmount,total,balance,status});
  }
  const columns=[["part_paid","Part Paid",x=>x.status==="part_paid"],["fully_paid","Fully Paid",x=>x.status==="fully_paid"],["in_class","In Class",x=>x.status==="in_class"],["stopped","Stopped",x=>x.status==="stopped"],["completed","Completed",x=>x.status==="completed"]];
  const card=x=>`<article class="tracking-order-card"><div class="tracking-card-head"><div><strong>${escapeHTML(x.row.full_name||"Trainee")}</strong><small>${escapeHTML(x.row.course||"Training")}</small></div><time>${escapeHTML(x.row.created_at?new Date(x.row.created_at).toLocaleString("en-GB", {timeZone:"UTC", day:"2-digit", month:"2-digit", year:"numeric"}):"")}</time></div><div class="tracking-card-data"><span><b>Phone</b>${escapeHTML(x.row.phone||"—")}</span><span><b>Paid</b>GHS ${x.paid.toFixed(2)}</span><span><b>Balance</b>GHS ${x.balance.toFixed(2)}</span><span><b>Invoice</b>${escapeHTML(x.invoice?.invoiceNumber||"—")}</span></div><div class="tracking-card-status">${traineeStatusSelectHTML(x.row.id,x.status)}</div><button type="button" class="secondary" data-view-trainee="${escapeHTML(x.row.id)}">View Full Details</button></article>`;
  list.innerHTML=paid.length?`<div class="tracking-board trainee-board">${columns.map(([key,title,test])=>{const items=paid.filter(test);return `<section class="tracking-column tracking-${key}"><header><h3>${title}</h3><strong>${items.length}</strong></header><div class="tracking-column-body">${items.length?items.map(card).join(""):`<div class="tracking-empty">No trainees</div>`}</div></section>`}).join("")}</div>`:`<div class="empty">No paid trainees have been recorded yet.</div>`;
  list.querySelectorAll("[data-save-status-prefix]").forEach(b=>b.onclick=async()=>{const select=b.closest(".status-control")?.querySelector(".admin-status-select");try{await setAdminRecordStatus("training_status",b.dataset.saveStatusId,select?.value||"part_paid");await auditSystemEvent("training_registration",b.dataset.saveStatusId,"status_updated",{status:select?.value||"part_paid"});message("Trainee status updated.","success");await loadTrainees()}catch(e){message("Trainee status could not be updated: "+e.message,"error")}});
  list.querySelectorAll("[data-view-trainee]").forEach(b=>b.onclick=()=>{const x=paid.find(v=>String(v.row.id)===String(b.dataset.viewTrainee));if(x)showSubmissionDetails("Trainee Details",x.row,x.row.message||x.row.request_details||x.row.details||"",[])});
 }catch(e){list.innerHTML=`<div class="empty">Trainees could not be loaded: ${escapeHTML(e.message||"")}</div>`}
}
async function loadEnquiries() {
    const rows = await getRows("enquiries");
    const list = document.getElementById("enquiryList");
    if (!list) return;

    list.innerHTML = rows.length ? `
        <table><thead><tr>
            <th>Date</th><th>Name</th><th>Phone</th><th>WhatsApp</th><th>Email</th><th>Subject</th><th>Message</th>
        </tr></thead><tbody>
        ${rows.map(row => `<tr>
            <td>${escapeHTML(row.created_at ? new Date(row.created_at).toLocaleString("en-GB", {timeZone:"UTC"}) + " GMT" : "")}</td>
            <td>${escapeHTML(row.full_name)}</td>
            <td>${escapeHTML(row.phone)}</td>
            <td>${escapeHTML(row.whatsapp)}</td>
            <td>${escapeHTML(row.email)}</td>
            <td>${escapeHTML(row.subject)}</td>
            <td>${escapeHTML(row.message)}</td>
        </tr>`).join("")}
        </tbody></table>
    ` : `<div class="empty">No customer enquiries received.</div>`;
}

/* =========================================================
   TESTIMONIALS
   Admin enters a customer's actual/approved testimonial.
========================================================= */

async function loadTestimonials() {
    const rows = await getRows("testimonials");
    const list = document.getElementById("testimonialList");
    if (!list) return;

    list.innerHTML = rows.length ? `
        <table><thead><tr>
            <th>Customer</th><th>Testimonial</th><th>Active</th><th>Actions</th>
        </tr></thead><tbody>
        ${rows.map(row => `<tr>
            <td>${escapeHTML(row.customer_name)}</td>
            <td>${escapeHTML(row.testimonial)}</td>
            <td>${row.active ? "Yes" : "No"}</td>
            <td>
                <button type="button" class="secondary" data-edit-testimonial="${row.id}">Edit</button>
                <button type="button" class="danger" data-delete-testimonial="${row.id}">Delete</button> <button type="button" class="secondary" data-share-testimonial="${row.id}">Share</button>
            </td>
        </tr>`).join("")}
        </tbody></table>
    ` : `<div class="empty">No testimonials yet. Add one only after you have the customer's testimonial/permission to publish it.</div>`;

    list.querySelectorAll("[data-edit-testimonial]").forEach(button => {
        button.onclick = () => {
            const row = rows.find(item => String(item.id) === String(button.dataset.editTestimonial));
            if (!row) return;
            document.getElementById("testimonialId").value = row.id;
            document.getElementById("testimonialName").value = row.customer_name || "";
            document.getElementById("testimonialText").value = row.testimonial || "";
            document.getElementById("testimonialActive").checked = row.active !== false;
            document.getElementById("testimonialForm").scrollIntoView({ behavior: "smooth", block: "start" });
        };
    });

    list.querySelectorAll("[data-share-testimonial]").forEach(button => {
        button.onclick=()=>{const row=rows.find(item=>String(item.id)===String(button.dataset.shareTestimonial)); if(row) shareText("Aprils Signature Testimonial", `“${row.testimonial||""}”\n— ${row.customer_name||"Customer"}`);};
    });

    list.querySelectorAll("[data-delete-testimonial]").forEach(button => {
        button.onclick = async () => {
            if (!confirm("Delete this testimonial?")) return;
            const result = await db.from("testimonials").delete().eq("id", button.dataset.deleteTestimonial);
            if (result.error) {
                message("Testimonial could not be deleted.", "error");
                return;
            }
            message("Testimonial deleted.", "success");
            await loadTestimonials();
            await loadDashboard();
        };
    });
}

function setupTestimonialForm() {
    const form = document.getElementById("testimonialForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const id = document.getElementById("testimonialId").value.trim();
        const payload = {
            customer_name: document.getElementById("testimonialName").value.trim(),
            testimonial: document.getElementById("testimonialText").value.trim(),
            active: document.getElementById("testimonialActive").checked,
            updated_at: new Date().toISOString()
        };

        try {
            const result = id
                ? await db.from("testimonials").update(payload).eq("id", id)
                : await db.from("testimonials").insert(payload);

            if (result.error) throw result.error;

            form.reset();
            document.getElementById("testimonialId").value = "";
            document.getElementById("testimonialActive").checked = true;
            message("Testimonial saved.", "success");
            await loadTestimonials();
            await loadDashboard();
        } catch (error) {
            console.error(error);
            message("Testimonial could not be saved: " + error.message, "error");
        }
    });

    document.getElementById("testimonialCancel")?.addEventListener("click", () => {
        form.reset();
        document.getElementById("testimonialId").value = "";
        document.getElementById("testimonialActive").checked = true;
    });
}

/* =========================================================
   FAQ
========================================================= */

async function loadFAQs() {
    const rows = await getRows("faqs");
    const list = document.getElementById("faqList");
    if (!list) return;

    list.innerHTML = rows.length ? `
        <table><thead><tr>
            <th>Question</th><th>Answer</th><th>Active</th><th>Actions</th>
        </tr></thead><tbody>
        ${rows.map(row => `<tr>
            <td>${escapeHTML(row.question)}</td>
            <td>${escapeHTML(row.answer)}</td>
            <td>${row.active ? "Yes" : "No"}</td>
            <td>
                <button type="button" class="secondary" data-edit-faq="${row.id}">Edit</button>
                <button type="button" class="danger" data-delete-faq="${row.id}">Delete</button>
            </td>
        </tr>`).join("")}
        </tbody></table>
    ` : `<div class="empty">No FAQs yet.</div>`;

    list.querySelectorAll("[data-edit-faq]").forEach(button => {
        button.onclick = () => {
            const row = rows.find(item => String(item.id) === String(button.dataset.editFaq));
            if (!row) return;
            document.getElementById("faqId").value = row.id;
            document.getElementById("faqQuestion").value = row.question || "";
            document.getElementById("faqAnswer").value = row.answer || "";
            document.getElementById("faqActive").checked = row.active !== false;
            document.getElementById("faqForm").scrollIntoView({ behavior: "smooth", block: "start" });
        };
    });

    list.querySelectorAll("[data-delete-faq]").forEach(button => {
        button.onclick = async () => {
            if (!confirm("Delete this FAQ?")) return;
            const result = await db.from("faqs").delete().eq("id", button.dataset.deleteFaq);
            if (result.error) {
                message("FAQ could not be deleted.", "error");
                return;
            }
            message("FAQ deleted.", "success");
            await loadFAQs();
            await loadDashboard();
        };
    });
}

function setupFAQForm() {
    const form = document.getElementById("faqForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const id = document.getElementById("faqId").value.trim();
        const payload = {
            question: document.getElementById("faqQuestion").value.trim(),
            answer: document.getElementById("faqAnswer").value.trim(),
            active: document.getElementById("faqActive").checked,
            updated_at: new Date().toISOString()
        };

        try {
            const result = id
                ? await db.from("faqs").update(payload).eq("id", id)
                : await db.from("faqs").insert(payload);

            if (result.error) throw result.error;

            form.reset();
            document.getElementById("faqId").value = "";
            document.getElementById("faqActive").checked = true;
            message("FAQ saved.", "success");
            await loadFAQs();
            await loadDashboard();
        } catch (error) {
            console.error(error);
            message("FAQ could not be saved: " + error.message, "error");
        }
    });

    document.getElementById("faqCancel")?.addEventListener("click", () => {
        form.reset();
        document.getElementById("faqId").value = "";
        document.getElementById("faqActive").checked = true;
    });
}

/* =========================================================
   POLICIES / CONTENT / SETTINGS / CONTACT
========================================================= */

async function loadPolicies() {
    const rows = await getRows("policies");
    const policyRank = {payment_policy:1, refund_policy:2, delivery_collection_policy:3, privacy_policy:4};
    rows.sort((a,b)=>(policyRank[String(a.policy_key||"").toLowerCase()]||99)-(policyRank[String(b.policy_key||"").toLowerCase()]||99));
    const list = document.getElementById("policyList");
    if (!list) return;

    list.innerHTML = rows.length ? `
        <table><thead><tr><th>Policy</th><th>Key</th><th>Content</th><th>Actions</th></tr></thead><tbody>
        ${rows.map(row => `<tr>
            <td><span class="policy-number-badge">${policyRank[String(row.policy_key||"").toLowerCase()] || ""}</span>${escapeHTML(String(row.title || "").replace(/^\s*[1-4]\s*\.\s*/, ""))}</td>
            <td>${escapeHTML(row.policy_key)}</td>
            <td><pre style="white-space:pre-wrap;max-width:550px;font-family:inherit">${escapeHTML(row.content)}</pre></td>
            <td>
                <button type="button" class="secondary" data-edit-policy="${row.id}">Edit</button>
                <button type="button" class="danger" data-delete-policy="${row.id}">Delete</button> <button type="button" class="secondary" data-share-policy="${row.id}">Share</button>
            </td>
        </tr>`).join("")}
        </tbody></table>
    ` : `<div class="empty">No policy records yet.</div>`;

    list.querySelectorAll("[data-edit-policy]").forEach(button => {
        button.onclick = () => {
            const row = rows.find(item => String(item.id) === String(button.dataset.editPolicy));
            if (!row) return;
            document.getElementById("policyId").value = row.id;
            document.getElementById("policyTitle").value = row.title || "";
            document.getElementById("policyKey").value = row.policy_key || "";
            document.getElementById("policyContent").value = row.content || "";
            document.getElementById("policyForm").scrollIntoView({ behavior: "smooth", block: "start" });
        };
    });

    list.querySelectorAll("[data-share-policy]").forEach(button=>{button.onclick=()=>{const row=rows.find(item=>String(item.id)===String(button.dataset.sharePolicy));if(row)shareText(row.title||"Policy",`${row.title||"Policy"}\n\n${row.content||""}`);};});

    list.querySelectorAll("[data-delete-policy]").forEach(button => {
        button.onclick = async () => {
            if (!confirm("Delete this policy?")) return;
            const result = await db.from("policies").delete().eq("id", button.dataset.deletePolicy);
            if (result.error) {
                message("Policy could not be deleted.", "error");
                return;
            }
            message("Policy deleted.", "success");
            await loadPolicies();
        };
    });
}

function setupPolicyForm() {
    const form = document.getElementById("policyForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const id = document.getElementById("policyId").value.trim();
        const payload = {
            title: document.getElementById("policyTitle").value.trim(),
            policy_key: document.getElementById("policyKey").value.trim(),
            content: document.getElementById("policyContent").value.trim(),
            updated_at: new Date().toISOString()
        };

        try {
            const result = id
                ? await db.from("policies").update(payload).eq("id", id)
                : await db.from("policies").insert(payload);
            if (result.error) throw result.error;

            form.reset();
            document.getElementById("policyId").value = "";
            message("Policy saved.", "success");
            await loadPolicies();
        } catch (error) {
            console.error(error);
            message("Policy could not be saved: " + error.message, "error");
        }
    });

    document.getElementById("policyCancel")?.addEventListener("click", () => {
        form.reset();
        document.getElementById("policyId").value = "";
    });
}


function contentSlug(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 80);
}

function parseDynamicContentKey(key) {
    const parts = String(key || "").split("::");
    if (parts[0] !== "dynamic") return null;
    return {
        page: parts[1] || "all",
        type: parts[2] || "paragraph",
        name: parts.slice(3).join("::").replace(/_/g, " ") || "Website Content"
    };
}

async function getHiddenContentKeys() {
    try {
        const result = await db.from("settings").select("setting_key,setting_value").like("setting_key", "hidden_content_%");
        if (result.error) return new Set();
        return new Set((result.data || [])
            .filter(r => String(r.setting_value).toLowerCase() === "true")
            .map(r => String(r.setting_key).replace(/^hidden_content_/, "")));
    } catch (_) {
        return new Set();
    }
}

async function setHiddenContentKey(key, hidden) {
    const storage = contentSlug(key);
    if (!storage) return;
    if (hidden) {
        await safeSettingUpsert("hidden_content_" + storage, "true");
    } else {
        await db.from("settings").delete().eq("setting_key", "hidden_content_" + storage);
    }
}

async function loadContent() {
    const rows = await getRows("site_content");
    const list = document.getElementById("contentList");
    if (!list) return;

    const hidden = await getHiddenContentKeys();

    list.innerHTML = rows.length ? `
        <table>
            <thead>
                <tr><th>Page</th><th>Type</th><th>Content Name</th><th>Current Content</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${rows.map(r => {
                    const dynamic = parseDynamicContentKey(r.content_key);
                    const page = dynamic ? dynamic.page : "managed";
                    const type = dynamic ? dynamic.type : "existing";
                    const isHidden = hidden.has(contentSlug(r.content_key));
                    return `
                    <tr>
                        <td>${escapeHTML(page)}</td>
                        <td>${escapeHTML(type)}</td>
                        <td>${escapeHTML(dynamic?.name || r.content_key || "")}</td>
                        <td><pre style="white-space:pre-wrap;max-width:600px;font-family:inherit">${escapeHTML(r.content_value || "")}</pre></td>
                        <td>${isHidden ? "Hidden" : "Visible"}</td>
                        <td>
                            <button type="button" class="secondary" data-edit-content="${r.id}">Edit</button>
                            <button type="button" class="secondary" data-toggle-content="${r.id}" data-hidden="${isHidden ? "true" : "false"}">${isHidden ? "Show" : "Hide"}</button>
                            <button type="button" class="danger" data-delete-content="${r.id}">Remove</button>
                        </td>
                    </tr>`;
                }).join("")}
            </tbody>
        </table>
    ` : `<div class="empty">No website content has been added yet. Use the form above to add the first item.</div>`;

    list.querySelectorAll("[data-edit-content]").forEach(button => {
        button.onclick = () => {
            const row = rows.find(item => String(item.id) === String(button.dataset.editContent));
            if (!row) return;

            const dynamic = parseDynamicContentKey(row.content_key);
            document.getElementById("contentId").value = row.id || "";
            document.getElementById("contentStorageKey").value = row.content_key || "";
            document.getElementById("contentKey").value = dynamic?.name || row.content_key || "";
            document.getElementById("contentValue").value = row.content_value || "";
            document.getElementById("contentPage").value = dynamic?.page || "all";
            document.getElementById("contentType").value = dynamic?.type || "paragraph";
            document.getElementById("contentActive").checked = !hidden.has(contentSlug(row.content_key));
            document.getElementById("contentForm").scrollIntoView({ behavior: "smooth", block: "start" });
        };
    });

    list.querySelectorAll("[data-toggle-content]").forEach(button => {
        button.onclick = async () => {
            const row = rows.find(item => String(item.id) === String(button.dataset.toggleContent));
            if (!row) return;
            const currentlyHidden = button.dataset.hidden === "true";
            try {
                await setHiddenContentKey(row.content_key, !currentlyHidden);
                message(currentlyHidden ? "Website content is visible again." : "Website content hidden from the public website.", "success");
                await loadContent();
            } catch (error) {
                message("Website content visibility could not be changed: " + error.message, "error");
            }
        };
    });

    list.querySelectorAll("[data-delete-content]").forEach(button => {
        button.onclick = async () => {
            const row = rows.find(item => String(item.id) === String(button.dataset.deleteContent));
            if (!row || !confirm("Remove this website content item from the public website and the admin list?")) return;

            try {
                await setHiddenContentKey(row.content_key, true);
                const result = await db.from("site_content").delete().eq("id", button.dataset.deleteContent);
                if (result.error) throw result.error;
                message("Website content removed.", "success");
                await loadContent();
            } catch (error) {
                message("Website content could not be removed: " + error.message, "error");
            }
        };
    });
}

function setupContentForm() {
    const form = document.getElementById("contentForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const id = document.getElementById("contentId").value.trim();
        const oldStorageKey = document.getElementById("contentStorageKey").value.trim();
        const name = document.getElementById("contentKey").value.trim();
        const value = document.getElementById("contentValue").value.trim();
        const page = document.getElementById("contentPage").value;
        const type = document.getElementById("contentType").value;
        const active = document.getElementById("contentActive").checked;

        if (!name || !value) {
            message("Please enter a content name and content.", "error");
            return;
        }

        const storageKey = oldStorageKey && !oldStorageKey.startsWith("dynamic::")
            ? oldStorageKey
            : `dynamic::${page}::${type}::${contentSlug(name)}`;

        try {
            const payload = {
                content_key: storageKey,
                content_value: value,
                updated_at: new Date().toISOString()
            };

            const result = id
                ? await db.from("site_content").update(payload).eq("id", id)
                : await db.from("site_content").insert(payload);

            if (result.error) throw result.error;

            if (oldStorageKey && oldStorageKey !== storageKey) {
                await setHiddenContentKey(oldStorageKey, false);
            }
            await setHiddenContentKey(storageKey, !active);

            form.reset();
            document.getElementById("contentId").value = "";
            document.getElementById("contentStorageKey").value = "";
            document.getElementById("contentActive").checked = true;
            document.getElementById("contentPage").value = "home";
            document.getElementById("contentType").value = "paragraph";

            message("Website content saved. Changes are connected to the public website.", "success");
            await loadContent();
        } catch (error) {
            console.error(error);
            message("Website content could not be saved: " + error.message, "error");
        }
    });

    document.getElementById("newContentButton")?.addEventListener("click", () => {
        form.reset();
        document.getElementById("contentId").value = "";
        document.getElementById("contentStorageKey").value = "";
        document.getElementById("contentActive").checked = true;
        document.getElementById("contentPage").value = "home";
        document.getElementById("contentType").value = "paragraph";
        form.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    document.getElementById("contentCancel")?.addEventListener("click", () => {
        form.reset();
        document.getElementById("contentId").value = "";
        document.getElementById("contentStorageKey").value = "";
        document.getElementById("contentActive").checked = true;
    });
}

/* =========================================================
   INVOICE PRICING — INTERNAL ONLY
   Stored in the existing settings table with invoice_price_
   keys, so it remains separate from public pricing.
========================================================= */

function invoiceStorageKey(id) {
    return "invoice_price_" + contentSlug(id);
}

async function loadInvoicePricing() {
    const rows = await getRows("settings");
    const invoiceRows = rows.filter(r => String(r.setting_key || "").startsWith("invoice_price_"));
    const seen = new Set();
    const invoices = invoiceRows.filter(r => {
        const key = String(r.setting_key || "");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const productInvoices = invoices.filter(r => !String(r.setting_key || "").startsWith("invoice_price_training_"));
    const trainingInvoices = invoices.filter(r => String(r.setting_key || "").startsWith("invoice_price_training_"));

    const renderRows = (items, emptyText, editAttr, sharePrefix) => items.length ? `
        <table>
            <thead><tr><th>Products and Services</th><th>Category</th><th>Price (GHS)</th><th>Notes</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
                ${items.map(r => {
                    let item = {name:"",category:"",price:"",notes:"",active:true};
                    try { item = {...item,...JSON.parse(r.setting_value||"{}")}; } catch (_) {}
                    return `<tr>
                        <td>${escapeHTML(item.name)}</td>
                        <td>${escapeHTML(item.category)}</td>
                        <td>GHS ${Number(item.price||0).toFixed(2)}</td>
                        <td>${escapeHTML(item.notes)}</td>
                        <td>${item.active === false ? "Inactive" : "Active"}</td>
                        <td>
                            <button type="button" class="secondary" ${editAttr}="${escapeHTML(r.id)}">Edit</button>
                            <button type="button" class="danger" data-delete-invoice="${escapeHTML(r.id)}">Delete</button>
                            <button type="button" class="secondary" data-share-invoice="${escapeHTML(r.id)}">Share</button>
                        </td>
                    </tr>`;
                }).join("")}
            </tbody>
        </table>` : `<div class="empty">${emptyText}</div>`;

    const productList = document.getElementById("invoiceProductList");
    if (productList) productList.innerHTML = renderRows(productInvoices, "No item or service invoice prices have been added yet.", "data-edit-invoice", "product");

    const trainingList = document.getElementById("invoiceTrainingList");
    if (trainingList) trainingList.innerHTML = renderRows(trainingInvoices, "No training invoice prices have been added yet.", "data-edit-training-invoice", "training").replace("<th>Products and Services</th>","<th>Programme / Class</th>");

    const bindList = list => {
        if (!list) return;

        list.querySelectorAll("[data-edit-invoice]").forEach(button => {
            button.onclick = () => {
                const row = invoices.find(r => String(r.id) === String(button.dataset.editInvoice));
                if (!row) return;
                let item = {};
                try { item = JSON.parse(row.setting_value || "{}"); } catch (_) {}
                document.getElementById("invoiceId").value = row.id || "";
                document.getElementById("invoiceItem").value = item.name || "";
                document.getElementById("invoiceCategory").value = item.category || "";
                document.getElementById("invoicePrice").value = item.price ?? "";
                document.getElementById("invoiceNotes").value = item.notes || "";
                document.getElementById("invoiceActive").checked = item.active !== false;
                document.getElementById("invoiceForm").scrollIntoView({behavior:"smooth",block:"start"});
            };
        });

        list.querySelectorAll("[data-edit-training-invoice]").forEach(button => {
            button.onclick = () => {
                const row = invoices.find(r => String(r.id) === String(button.dataset.editTrainingInvoice));
                if (!row) return;
                let item = {};
                try { item = JSON.parse(row.setting_value || "{}"); } catch (_) {}
                document.getElementById("trainingInvoiceId").value = row.id || "";
                document.getElementById("trainingInvoiceItem").value = item.name || "";
                document.getElementById("trainingInvoiceCategory").value = item.category || "";
                document.getElementById("trainingInvoiceDuration").value = item.duration || item.notes || "";
                document.getElementById("trainingInvoicePrice").value = item.price ?? "";
                document.getElementById("trainingInvoiceNotes").value = item.notes || "";
                document.getElementById("trainingInvoiceActive").checked = item.active !== false;
                document.getElementById("trainingInvoiceForm").scrollIntoView({behavior:"smooth",block:"start"});
            };
        });

        list.querySelectorAll("[data-share-invoice]").forEach(button => {
            button.onclick = () => {
                const row = invoices.find(r => String(r.id) === String(button.dataset.shareInvoice));
                if (!row) return;
                let item = {};
                try { item = JSON.parse(row.setting_value || "{}"); } catch (_) {}
                shareText("Aprils Signature Invoice Price", `Item / Programme: ${item.name||""}\nCategory: ${item.category||""}\nPrice: GHS ${Number(item.price||0).toFixed(2)}\nNotes: ${item.notes||""}`);
            };
        });

        list.querySelectorAll("[data-delete-invoice]").forEach(button => {
            button.onclick = async () => {
                if (!confirm("Delete this internal invoice price?")) return;
                const result = await db.from("settings").delete().eq("id", button.dataset.deleteInvoice);
                if (result.error) {
                    message("Invoice price could not be deleted: " + result.error.message, "error");
                    return;
                }
                message("Invoice price deleted.", "success");
                await loadInvoicePricing();
                await loadProducts();
                await loadTraining();
            };
        });
    };

    bindList(productList);
    bindList(trainingList);
    await loadInvoicePaymentDetails();
}

function paymentRowTemplate(item = {}) {
    return `
        <div class="invoice-payment-row" data-payment-row style="border:1px solid #aaa;border-radius:6px;padding:12px;margin-bottom:12px;">
            <div class="form-grid">
                <div class="form-group"><label>Payment Method / Network</label><input class="invoice-payment-network" value="${escapeHTML(item.network || "")}" placeholder="MTN MoMo, Telecel, Bank, etc."></div>
                <div class="form-group"><label>Account / Payment Number</label><input class="invoice-payment-number" value="${escapeHTML(item.number || "")}" placeholder="e.g. 024... or account number"></div>
                <div class="form-group"><label>Account Name</label><input class="invoice-payment-name" value="${escapeHTML(item.name || "")}" placeholder="Name on the account"></div>
                <div class="form-group"><label>Bank Branch</label><input class="invoice-payment-branch" value="${escapeHTML(item.branch || "")}" placeholder="For bank accounts"></div>
            </div>
            <div class="form-group"><label>Payment Note</label><textarea class="invoice-payment-note" placeholder="Payment instruction to appear on invoices.">${escapeHTML(item.note || "")}</textarea></div>
            <button type="button" class="danger remove-invoice-payment">Remove This Payment Detail</button>
        </div>`;
}

async function getInvoicePaymentAccounts() {
    const rows = await getRows("settings");
    const accountRow = rows.find(r => String(r.setting_key || "") === "invoice_payment_accounts");
    if (accountRow?.setting_value) {
        try {
            const parsed = JSON.parse(accountRow.setting_value);
            if (Array.isArray(parsed)) return parsed;
        } catch (_) {}
    }

    const legacy = {};
    rows.filter(r => ["invoice_payment_number","invoice_payment_name","invoice_payment_network","invoice_payment_branch","invoice_payment_note"].includes(String(r.setting_key||"")))
        .forEach(r => legacy[r.setting_key] = r.setting_value || "");

    if (legacy.invoice_payment_number || legacy.invoice_payment_name || legacy.invoice_payment_network || legacy.invoice_payment_note) {
        return [{
            number: legacy.invoice_payment_number || "",
            name: legacy.invoice_payment_name || "",
            network: legacy.invoice_payment_network || "",
            branch: legacy.invoice_payment_branch || "",
            note: legacy.invoice_payment_note || ""
        }];
    }
    return [];
}

function renderInvoicePaymentRows(accounts) {
    const wrap = document.getElementById("invoicePaymentRows");
    if (!wrap) return;
    const items = accounts.length ? accounts : [{}];
    wrap.innerHTML = items.map(paymentRowTemplate).join("");
    wrap.querySelectorAll(".remove-invoice-payment").forEach(button => {
        button.onclick = () => {
            const rows = wrap.querySelectorAll("[data-payment-row]");
            if (rows.length <= 1) {
                rows[0]?.remove();
                wrap.insertAdjacentHTML("beforeend", paymentRowTemplate({}));
            } else {
                button.closest("[data-payment-row]")?.remove();
            }
        };
    });
}

async function loadInvoicePaymentDetails() {
    const accounts = await getInvoicePaymentAccounts();
    renderInvoicePaymentRows(accounts);

    const saved = document.getElementById("invoicePaymentSaved");
    if (saved) {
        saved.innerHTML = accounts.length ? `
            <div class="payment-details-list">
                ${accounts.map((item,index) => `
                    <div style="border:1px solid #aaa;border-radius:6px;padding:12px;margin-bottom:10px;">
                        <strong>Payment Detail ${index+1}</strong><br>
                        ${escapeHTML(item.network || "")} ${escapeHTML(item.number || "")}<br>
                        ${escapeHTML(item.name || "")}${item.branch ? `<br>Branch: ${escapeHTML(item.branch)}` : ""}<br>
                        <div style="margin-top:8px;font-weight:700;border-left:4px solid #c9a227;padding:8px 10px;">
                            <strong>*** Payment Note ***</strong><br>
                            ${escapeHTML(item.note || "No payment note saved.")}
                        </div>
                    </div>`).join("")}
            </div>` : `<div class="empty">No invoice payment details have been saved yet. Add your first payment detail above.</div>`;
    }
}

function setupInvoicePaymentForm(){
    const form = document.getElementById("invoicePaymentForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    document.getElementById("addInvoicePaymentDetail")?.addEventListener("click", () => {
        const wrap = document.getElementById("invoicePaymentRows");
        if (!wrap) return;
        wrap.insertAdjacentHTML("beforeend", paymentRowTemplate({}));
        renderInvoicePaymentRowsFromCurrentDom();
    });

    function renderInvoicePaymentRowsFromCurrentDom() {
        const wrap = document.getElementById("invoicePaymentRows");
        if (!wrap) return;
        wrap.querySelectorAll(".remove-invoice-payment").forEach(button => {
            button.onclick = () => {
                const rows = wrap.querySelectorAll("[data-payment-row]");
                if (rows.length <= 1) {
                    rows[0]?.remove();
                    wrap.insertAdjacentHTML("beforeend", paymentRowTemplate({}));
                } else {
                    button.closest("[data-payment-row]")?.remove();
                }
            };
        });
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const wrap = document.getElementById("invoicePaymentRows");
        const accounts = Array.from(wrap?.querySelectorAll("[data-payment-row]") || []).map(row => ({
            number: row.querySelector(".invoice-payment-number")?.value.trim() || "",
            name: row.querySelector(".invoice-payment-name")?.value.trim() || "",
            network: row.querySelector(".invoice-payment-network")?.value.trim() || "",
            branch: row.querySelector(".invoice-payment-branch")?.value.trim() || "",
            note: row.querySelector(".invoice-payment-note")?.value.trim() || ""
        })).filter(item => item.number || item.name || item.network || item.note);

        try {
            await safeSettingUpsert("invoice_payment_accounts", JSON.stringify(accounts));
            // Publish only the payment fields intended for the public payment page.
            // Customer/invoice settings remain private to authenticated admins.
            try {
                const existingPublic = await db.from("public_payment_details").select("id");
                if (!existingPublic.error && existingPublic.data?.length) {
                    const deleted = await db.from("public_payment_details").delete().in("id", existingPublic.data.map(x=>x.id));
                    if (deleted.error) throw deleted.error;
                }
                const publicRows = accounts.map((item,index)=>({
                    network:item.network || "", number:item.number || "", name:item.name || "", branch:item.branch || "",
                    active:true, display_order:index+1, updated_at:new Date().toISOString()
                })).filter(item=>item.number || item.name || item.network);
                if (publicRows.length) {
                    const inserted = await db.from("public_payment_details").insert(publicRows);
                    if (inserted.error) throw inserted.error;
                }
            } catch (publicSyncError) {
                console.warn("Public payment detail sync unavailable:", publicSyncError);
            }
            // Keep the older single-value settings in sync for backward compatibility.
            const first = accounts[0] || {};
            await safeSettingUpsert("invoice_payment_number", first.number || "");
            await safeSettingUpsert("invoice_payment_name", first.name || "");
            await safeSettingUpsert("invoice_payment_network", first.network || "");
            await safeSettingUpsert("invoice_payment_branch", first.branch || "");
            await safeSettingUpsert("invoice_payment_note", first.note || "");
            await safeSettingUpsert("site_link_payment", JSON.stringify({label:"Payment Details",url:"payment.html",accounts}));
            // Saving publishes the entered accounts; clear the entry form so the
            // next payment detail starts blank instead of showing saved values.
            const paymentWrap = document.getElementById("invoicePaymentRows");
            if (paymentWrap) paymentWrap.innerHTML = paymentRowTemplate({});
            renderInvoicePaymentRowsFromCurrentDom();
            message("Invoice payment details saved.", "success");
            // Keep the saved records visible below, but leave the entry fields blank for the next record.
            renderInvoicePaymentRows([{}]);
            await loadInvoicePaymentDetails();
            renderInvoicePaymentRows([{}]);
        } catch (error) {
            message("Invoice payment details could not be saved: " + error.message, "error");
        }
    });

    loadInvoicePaymentDetails();
}

function setupTrainingInvoicePricingForm() {
    const form = document.getElementById("trainingInvoiceForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const id = document.getElementById("trainingInvoiceId").value.trim();
        const name = document.getElementById("trainingInvoiceItem").value.trim();
        const category = document.getElementById("trainingInvoiceCategory").value.trim();
        const duration = document.getElementById("trainingInvoiceDuration").value.trim();
        const priceValue = document.getElementById("trainingInvoicePrice").value;
        const price = Number(priceValue);
        const notes = document.getElementById("trainingInvoiceNotes").value.trim();
        const active = document.getElementById("trainingInvoiceActive").checked;

        if (!name || priceValue === "" || Number.isNaN(price)) {
            message("Please enter a training programme/class and a valid price.", "error");
            return;
        }

        try {
            const key = invoiceStorageKey("Training - " + name);
            const value = JSON.stringify({
                name,
                category: category || "Training",
                duration,
                price,
                notes,
                active
            });

            if (id) {
                const old = await db.from("settings").select("id,setting_key").eq("id", id).maybeSingle();
                if (old.error) throw old.error;
                if (old.data?.setting_key && old.data.setting_key !== key) {
                    await db.from("settings").delete().eq("id", id);
                    await safeSettingUpsert(key, value);
                } else {
                    const result = await db.from("settings").update({
                        setting_key:key,
                        setting_value:value,
                        updated_at:new Date().toISOString()
                    }).eq("id", id);
                    if (result.error) throw result.error;
                }
            } else {
                await safeSettingUpsert(key, value);
            }

            form.reset();
            document.getElementById("trainingInvoiceId").value = "";
            document.getElementById("trainingInvoiceActive").checked = true;
            message("Training invoice price saved.", "success");
            await loadInvoicePricing();
            await loadTraining();
            document.getElementById("invoiceTrainingList")?.scrollIntoView({behavior:"smooth",block:"start"});
        } catch (error) {
            message("Training invoice price could not be saved: " + error.message, "error");
        }
    });

    document.getElementById("trainingInvoiceCancel")?.addEventListener("click", () => {
        form.reset();
        document.getElementById("trainingInvoiceId").value = "";
        document.getElementById("trainingInvoiceActive").checked = true;
    });
}

function setupInvoiceForm() {
    const form = document.getElementById("invoiceForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const id = document.getElementById("invoiceId").value.trim();
        const name = document.getElementById("invoiceItem").value.trim();
        const category = document.getElementById("invoiceCategory").value.trim();
        const priceValue = document.getElementById("invoicePrice").value;
        const price = Number(priceValue);
        const notes = document.getElementById("invoiceNotes").value.trim();
        const active = document.getElementById("invoiceActive").checked;

        if (!name || priceValue === "" || Number.isNaN(price)) {
            message("Please enter an item/service and a valid price.", "error");
            return;
        }

        try {
            const key = invoiceStorageKey(name);
            const value = JSON.stringify({ name, category, price, notes, active });

            if (id) {
                const current = await db.from("settings").select("id,setting_key").eq("id", id).maybeSingle();
                if (current.error) throw current.error;

                const result = await db.from("settings")
                    .update({ setting_key: key, setting_value: value, updated_at: new Date().toISOString() })
                    .eq("id", id);
                if (result.error) throw result.error;
            } else {
                await safeSettingUpsert(key, value);
            }

            // Keep exactly one record for this invoice item.
            const duplicates = await db.from("settings").select("id").eq("setting_key", key).order("id", { ascending: true });
            if (!duplicates.error && (duplicates.data || []).length > 1) {
                await db.from("settings").delete().in("id", duplicates.data.slice(1).map(r => r.id));
            }

            form.reset();
            document.getElementById("invoiceId").value = "";
            document.getElementById("invoiceActive").checked = true;
            message("Invoice price saved.", "success");
            await loadInvoicePricing();
            await loadProducts();
            document.getElementById("invoiceProductList")?.scrollIntoView({behavior:"smooth",block:"start"});
        } catch (error) {
            console.error(error);
            message("Invoice price could not be saved: " + error.message, "error");
        }
    });

    document.getElementById("newInvoiceButton")?.addEventListener("click", () => {
        form.reset();
        document.getElementById("invoiceId").value = "";
        document.getElementById("invoiceActive").checked = true;
        form.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    document.getElementById("invoiceCancel")?.addEventListener("click", () => {
        form.reset();
        document.getElementById("invoiceId").value = "";
        document.getElementById("invoiceActive").checked = true;
    });
}


/* =========================================================
   WEBSITE LINKS — HEADER / FOOTER
========================================================= */

function linkStorageKey(label) {
    return "site_link_" + contentSlug(label);
}

async function loadWebsiteLinks() {
    const rows = await getRows("settings");
    const links = rows.filter(r => String(r.setting_key || "").startsWith("site_link_"));
    const list = document.getElementById("linkList");
    if (!list) return;

    list.innerHTML = links.length ? `
        <table>
            <thead><tr><th>Link Name</th><th>URL</th><th>Location</th><th>Order</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
                ${links.map(r => {
                    let item = {};
                    try { item = JSON.parse(r.setting_value || "{}"); } catch (_) {}
                    return `<tr>
                        <td>${escapeHTML(item.label || "")}</td>
                        <td>${escapeHTML(item.url || "")}</td>
                        <td>${escapeHTML(item.location || "header")}</td>
                        <td>${escapeHTML(item.order ?? "")}</td>
                        <td>${item.active === false ? "Inactive" : "Active"}</td>
                        <td>
                            <button type="button" class="secondary" data-edit-link="${escapeHTML(r.id)}">Edit</button>
                            <button type="button" class="danger" data-delete-link="${escapeHTML(r.id)}">Delete</button>
                        </td>
                    </tr>`;
                }).join("")}
            </tbody>
        </table>
    ` : `<div class="empty">No managed website links have been added yet.</div>`;

    list.querySelectorAll("[data-edit-link]").forEach(button => {
        button.onclick = () => {
            const row = links.find(r => String(r.id) === String(button.dataset.editLink));
            if (!row) return;
            let item = {};
            try { item = JSON.parse(row.setting_value || "{}"); } catch (_) {}
            document.getElementById("linkId").value = row.id || "";
            document.getElementById("linkLabel").value = item.label || "";
            document.getElementById("linkUrl").value = item.url || "";
            document.getElementById("linkOrder").value = item.order ?? 1;
            document.getElementById("linkLocation").value = item.location || "header";
            document.getElementById("linkActive").checked = item.active !== false;
            document.getElementById("linkForm").scrollIntoView({ behavior: "smooth", block: "start" });
        };
    });

    list.querySelectorAll("[data-delete-link]").forEach(button => {
        button.onclick = async () => {
            if (!confirm("Delete this website link?")) return;
            const result = await db.from("settings").delete().eq("id", button.dataset.deleteLink);
            if (result.error) {
                message("Website link could not be deleted.", "error");
                return;
            }
            message("Website link deleted.", "success");
            await loadWebsiteLinks();
        };
    });
}

function setupWebsiteLinksForm() {
    const form = document.getElementById("linkForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const id = document.getElementById("linkId").value.trim();
        const label = document.getElementById("linkLabel").value.trim();
        const url = document.getElementById("linkUrl").value.trim();
        const order = Number(document.getElementById("linkOrder").value) || 1;
        const location = document.getElementById("linkLocation").value;
        const active = document.getElementById("linkActive").checked;

        if (!label || !url) {
            message("Please enter a link name and URL.", "error");
            return;
        }

        const payload = {
            setting_key: linkStorageKey(label),
            setting_value: JSON.stringify({ label, url, order, location, active }),
            updated_at: new Date().toISOString()
        };

        try {
            let result;
            if (id) {
                result = await db.from("settings").update(payload).eq("id", id);
            } else {
                result = await db.from("settings").upsert(payload, { onConflict: "setting_key" });
            }
            if (result.error) throw result.error;

            form.reset();
            document.getElementById("linkId").value = "";
            document.getElementById("linkOrder").value = 1;
            document.getElementById("linkActive").checked = true;
            message("Website link saved.", "success");
            await loadWebsiteLinks();
        } catch (error) {
            message("Website link could not be saved: " + error.message, "error");
        }
    });

    document.getElementById("newLinkButton")?.addEventListener("click", () => {
        form.reset();
        document.getElementById("linkId").value = "";
        document.getElementById("linkOrder").value = 1;
        document.getElementById("linkActive").checked = true;
        form.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    document.getElementById("linkCancel")?.addEventListener("click", () => {
        form.reset();
        document.getElementById("linkId").value = "";
        document.getElementById("linkOrder").value = 1;
        document.getElementById("linkActive").checked = true;
    });
}

async function loadSocial() {
    const rows = await getRows("settings");
    const sr = rows.filter(r => String(r.setting_key || "").toLowerCase().startsWith("social_"));
    const list = document.getElementById("socialList");
    if (!list) return;

    list.innerHTML = sr.length ? `<table><thead><tr><th>Platform</th><th>Link / Number</th><th>Actions</th></tr></thead><tbody>
    ${sr.map(r => `<tr><td>${escapeHTML(String(r.setting_key).replace(/^social_/i,"").replace(/_/g," "))}</td><td>${escapeHTML(r.setting_value || "")}</td>
    <td><button type="button" class="secondary" data-edit-social="${escapeHTML(r.id)}">Edit</button> <button type="button" class="danger" data-delete-social="${escapeHTML(r.id)}">Delete</button></td></tr>`).join("")}
    </tbody></table>` : `<div class="empty">No social links have been added yet.</div>`;

    list.querySelectorAll("[data-edit-social]").forEach(b => b.onclick = () => {
        const r = sr.find(x => String(x.id) === String(b.dataset.editSocial));
        if (!r) return;
        document.getElementById("socialId").value = r.id || "";
        const p = String(r.setting_key || "").replace(/^social_/i,"").replace(/_/g," ");
        const select = document.getElementById("socialPlatform");
        const known = ["TikTok","Instagram","Facebook","WhatsApp"];
        select.value = known.includes(p) ? p : "Other";
        const custom = document.getElementById("socialCustomName");
        const wrap = document.getElementById("socialCustomNameWrap");
        if (custom) custom.value = known.includes(p) ? "" : p;
        if (wrap) wrap.style.display = known.includes(p) ? "none" : "block";
        document.getElementById("socialUrl").value = r.setting_value || "";
        document.getElementById("socialForm").scrollIntoView({behavior:"smooth",block:"start"});
    });
    list.querySelectorAll("[data-delete-social]").forEach(b => b.onclick = async () => {
        if (!confirm("Delete this social link?")) return;
        const r = await db.from("settings").delete().eq("id", b.dataset.deleteSocial);
        if (r.error) { message("Social link could not be deleted.","error"); return; }
        message("Social link deleted.","success");
        await loadSocial();
    });
}

function setupSocialForm() {
    const f = document.getElementById("socialForm");
    if (!f || f.dataset.bound) return;
    f.dataset.bound = "1";
    const platform = document.getElementById("socialPlatform");
    const custom = document.getElementById("socialCustomName");
    const wrap = document.getElementById("socialCustomNameWrap");

    const updateCustom = () => {
        const show = platform?.value === "Other";
        if (wrap) wrap.style.display = show ? "block" : "none";
        if (custom) custom.required = show;
    };
    platform?.addEventListener("change", updateCustom);
    updateCustom();

    f.addEventListener("submit", async e => {
        e.preventDefault();
        const id = document.getElementById("socialId").value.trim();
        const p = platform.value.trim();
        const customName = custom?.value.trim() || "";
        const label = p === "Other" ? customName : p;
        const v = document.getElementById("socialUrl").value.trim();
        if (!label || !v) { message("Please enter the platform name and link / number.","error"); return; }
        const k = "social_" + label.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
        try {
            let r;
            if (id) {
                r = await db.from("settings").update({setting_key:k,setting_value:v,updated_at:new Date().toISOString()}).eq("id",id);
                if (r.error) throw r.error;
            } else {
                await safeSettingUpsert(k,v);
            }
            f.reset();
            document.getElementById("socialId").value = "";
            updateCustom();
            message("Social link saved.","success");
            await loadSocial();
        } catch (err) {
            console.error(err);
            message("Social link could not be saved: " + err.message,"error");
        }
    });
    document.getElementById("newSocialButton")?.addEventListener("click", () => {
        f.reset();
        document.getElementById("socialId").value = "";
        updateCustom();
        f.scrollIntoView({behavior:"smooth",block:"start"});
    });
    document.getElementById("socialCancel")?.addEventListener("click",() => {
        f.reset();
        document.getElementById("socialId").value = "";
        updateCustom();
    });
}

function contactExtraTemplate(item = {}) {
    return `<div class="contact-extra-row" data-contact-extra style="display:grid;grid-template-columns:1fr 2fr auto;gap:10px;align-items:end;margin-bottom:10px;">
        <div class="form-group"><label>Label</label><input class="contact-extra-label" value="${escapeHTML(item.label || "")}" placeholder="e.g. Second Phone"></div>
        <div class="form-group"><label>Value</label><input class="contact-extra-value" value="${escapeHTML(item.value || "")}" placeholder="e.g. +233 ..."></div>
        <button type="button" class="danger remove-contact-extra">Remove</button>
    </div>`;
}

async function getContactExtras() {
    try {
        const row = await getSettingValue("contact_extra");
        if (!row?.setting_value) return [];
        const parsed = JSON.parse(row.setting_value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
}

function renderContactExtras(items = []) {
    const wrap = document.getElementById("contactExtraRows");
    if (!wrap) return;
    wrap.innerHTML = (items.length ? items : [{}]).map(contactExtraTemplate).join("");
    wrap.querySelectorAll(".remove-contact-extra").forEach(button => {
        button.onclick = () => {
            const rows = wrap.querySelectorAll("[data-contact-extra]");
            if (rows.length <= 1) rows[0]?.remove();
            else button.closest("[data-contact-extra]")?.remove();
        };
    });
}

async function loadContact() {
    try {
        const result = await db.from("contact_settings").select("*").limit(1).maybeSingle();
        if (result.error || !result.data) return;
        const row = result.data;
        document.getElementById("contactId").value = row.id || "";
        document.getElementById("contactBusiness").value = row.business_name || "";
        document.getElementById("contactPhone").value = row.phone || "";
        document.getElementById("contactWhatsapp").value = row.whatsapp || "";
        document.getElementById("contactEmail").value = row.email || "";
        document.getElementById("contactAddress").value = row.address || "";
        document.getElementById("contactHours").value = row.opening_hours || "";
        renderContactExtras(await getContactExtras());
    } catch (error) {
        console.warn("Contact settings could not be loaded:", error);
    }
}

function setupContactForm() {
    const form = document.getElementById("contactForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const data = {
            business_name: document.getElementById("contactBusiness").value.trim(),
            phone: document.getElementById("contactPhone").value.trim(),
            whatsapp: document.getElementById("contactWhatsapp").value.trim(),
            email: document.getElementById("contactEmail").value.trim(),
            address: document.getElementById("contactAddress").value.trim(),
            opening_hours: document.getElementById("contactHours").value.trim(),
            updated_at: new Date().toISOString()
        };

        try {
            const existing = await db.from("contact_settings").select("id").limit(1).maybeSingle();
            const result = existing.data?.id
                ? await db.from("contact_settings").update(data).eq("id", existing.data.id)
                : await db.from("contact_settings").insert(data);

            if (result.error) throw result.error;

            const extraWrap = document.getElementById("contactExtraRows");
            const extras = Array.from(extraWrap?.querySelectorAll("[data-contact-extra]") || []).map(row => ({
                label: row.querySelector(".contact-extra-label")?.value.trim() || "",
                value: row.querySelector(".contact-extra-value")?.value.trim() || ""
            })).filter(item => item.label || item.value);
            await safeSettingUpsert("contact_extra", JSON.stringify(extras));
            message("Contact information saved.", "success");
        } catch (error) {
            console.error(error);
            message("Contact information could not be saved: " + error.message, "error");
        }
    });

    document.getElementById("addContactExtra")?.addEventListener("click", () => {
        const wrap = document.getElementById("contactExtraRows");
        if (!wrap) return;
        wrap.insertAdjacentHTML("beforeend", contactExtraTemplate({}));
        renderContactExtrasFromCurrentDom();
    });

    function renderContactExtrasFromCurrentDom() {
        const wrap = document.getElementById("contactExtraRows");
        if (!wrap) return;
        wrap.querySelectorAll(".remove-contact-extra").forEach(button => {
            button.onclick = () => {
                const rows = wrap.querySelectorAll("[data-contact-extra]");
                if (rows.length <= 1) rows[0]?.remove();
                else button.closest("[data-contact-extra]")?.remove();
            };
        });
    }
}

async function getSettingValue(key) {
    const result = await db.from("settings").select("*").eq("setting_key", key).limit(1).maybeSingle();
    if (result.error) throw result.error;
    return result.data || null;
}

async function saveSettingValue(key, value) {
    await safeSettingUpsert(key, value);
}

async function getLogoLibrary() {
    const result = await db
        .from("settings")
        .select("id,setting_key,setting_value,updated_at")
        .like("setting_key", "site_logo_library_%")
        .order("updated_at", { ascending: false });

    if (result.error) throw result.error;
    let rows = result.data || [];
    if (!rows.length) {
        const projectLogo = "icons/Aprils Signature logo.jpeg";
        const created = await db.from("settings").insert({
            setting_key: "site_logo_library_project",
            setting_value: projectLogo,
            updated_at: new Date().toISOString()
        }).select("id,setting_key,setting_value,updated_at").single();
        if (!created.error && created.data) rows = [created.data];
    }
    return rows;
}

async function renderLogoLibrary() {
    const library = document.getElementById("logoLibrary");
    if (!library) return;

    try {
        const rows = await getLogoLibrary();
        const current = await getSettingValue("site_logo_data");

        if (!rows.length) {
            library.innerHTML = `<div class="empty">No saved logo library items yet.</div>`;
            return;
        }

        library.innerHTML = `
            <div class="logo-library-grid">
                ${rows.map((row, index) => {
                    const isCurrent = String(current?.setting_value || "") === String(row.setting_value || "");
                    const safeKey = escapeHTML(row.setting_key || "");
                    return `
                        <article class="logo-library-item">
                            <div class="logo-library-image">
                                <img src="${escapeHTML(resolveAdminMediaUrl(row.setting_value).replace(/^icons\//, "../icons/"))}" alt="Saved logo ${index + 1}">
                            </div>
                            <div class="logo-library-meta">
                                <strong>${isCurrent ? "Current Public Logo" : "Saved Logo"}</strong>
                                ${row.updated_at ? `<small>Saved ${escapeHTML(new Date(row.updated_at).toLocaleString("en-GB", {timeZone:"UTC"}) + " GMT")}</small>` : ""}
                            </div>
                            <div class="logo-library-actions">
                                ${isCurrent ? "" : `<button type="button" class="secondary" data-use-logo="${safeKey}">Use This Logo</button>`}
                                <button type="button" class="danger" data-delete-logo="${safeKey}" data-current-logo="${isCurrent ? "true" : "false"}">Delete</button>
                            </div>
                        </article>
                    `;
                }).join("")}
            </div>
        `;

        library.querySelectorAll("[data-use-logo]").forEach(button => {
            button.onclick = async () => {
                try {
                    const key = button.dataset.useLogo;
                    const row = rows.find(item => String(item.setting_key) === String(key));
                    if (!row) return;

                    await saveSettingValue("site_logo_data", String(row.setting_value));
                    await saveSettingValue("site_logo_removed", "false");

                    const remove = document.getElementById("logoRemove");
                    if (remove) remove.checked = false;

                    message("Saved logo is now the public logo.", "success");
                    await loadLogoSettings();
                } catch (error) {
                    console.error("USE LOGO ERROR:", error);
                    message("The selected logo could not be applied: " + (error.message || "Unknown error"), "error");
                }
            };
        });

        library.querySelectorAll("[data-delete-logo]").forEach(button => {
            button.onclick = async () => {
                const key = button.dataset.deleteLogo;
                const isCurrent = button.dataset.currentLogo === "true";

                if (!confirm(isCurrent
                    ? "Delete this current logo? The public website will show no logo until another logo is selected."
                    : "Delete this saved logo permanently?")) {
                    return;
                }

                try {
                    const result = await db.from("settings").delete().eq("setting_key", key);
                    if (result.error) throw result.error;

                    if (isCurrent) {
                        await db.from("settings").delete().eq("setting_key", "site_logo_data");
                        await saveSettingValue("site_logo_removed", "true");
                    }

                    message("Logo deleted.", "success");
                    await loadLogoSettings();
                } catch (error) {
                    console.error("DELETE LOGO ERROR:", error);
                    message("The logo could not be deleted: " + (error.message || "Unknown error"), "error");
                }
            };
        });
    } catch (error) {
        console.error("LOGO LIBRARY ERROR:", error);
        library.innerHTML = `<div class="empty">Saved logos could not be loaded.</div>`;
    }
}

async function loadLogoSettings() {
    const preview = document.getElementById("logoPreview");
    const remove = document.getElementById("logoRemove");
    if (!preview || !remove) return;

    try {
        const logo = await getSettingValue("site_logo_data");
        const removed = await getSettingValue("site_logo_removed");

        remove.checked =
            String(removed?.setting_value || "").toLowerCase() === "true";

        if (logo?.setting_value) {
            preview.innerHTML = `
                <div class="current-logo-preview">
                    <strong>Current Public Logo</strong>
                    <img src="${escapeHTML(resolveAdminMediaUrl(logo.setting_value).replace(/^icons\//, "../icons/"))}" alt="Current saved logo">
                    <button type="button" class="danger" id="deleteCurrentLogo">Delete Current Logo</button>
                </div>`;
        } else {
            preview.innerHTML = `
                <div class="current-logo-preview">
                    <strong>Project Logo — Currently Available</strong>
                    <img src="../icons/Aprils Signature logo.jpeg" alt="Aprils Signature project logo">
                    <span>The logo above is the original project logo used by the website. You do not need to save it manually just to keep using it.</span>
                </div>`;
        }

        document.getElementById("deleteCurrentLogo")?.addEventListener("click", async () => {
            if (!confirm("Delete the current public logo? The public website will show no logo until another logo is selected.")) {
                return;
            }

            try {
                await db.from("settings").delete().eq("setting_key", "site_logo_data");
                await saveSettingValue("site_logo_removed", "true");
                remove.checked = true;
                message("Current logo deleted.", "success");
                await loadLogoSettings();
            } catch (error) {
                console.error("DELETE CURRENT LOGO ERROR:", error);
                message("The current logo could not be deleted.", "error");
            }
        });

        await renderLogoLibrary();
    } catch (error) {
        console.warn("Logo settings could not be loaded:", error);
        preview.innerHTML = `<p class="small">Logo settings could not be loaded.</p>`;
    }
}

function setupLogoForm() {
    const form = document.getElementById("logoForm");
    const fileInput = document.getElementById("logoFile");
    const remove = document.getElementById("logoRemove");
    const reset = document.getElementById("logoReset");
    const preview = document.getElementById("logoPreview");

    if (!form || !fileInput || !remove) return;

    fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (!file || !preview) return;

        const reader = new FileReader();
        reader.onload = () => {
            preview.innerHTML = `
                <div class="current-logo-preview">
                    <strong>New Logo Preview</strong>
                    <img src="${escapeHTML(reader.result)}" alt="New logo preview">
                </div>`;
        };
        reader.readAsDataURL(file);
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();

        try {
            const file = fileInput.files?.[0];

            if (file) {
                if (file.size > 2 * 1024 * 1024) {
                    message("Please choose a logo image smaller than 2 MB.", "error");
                    return;
                }

                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                const value = String(dataUrl);
                const libraryKey =
                    "site_logo_library_" +
                    Date.now() +
                    "_" +
                    Math.random().toString(36).slice(2, 8);

                await saveSettingValue(libraryKey, value);
                await saveSettingValue("site_logo_data", value);
                await saveSettingValue("site_logo_removed", remove.checked ? "true" : "false");
            } else {
                await saveSettingValue(
                    "site_logo_removed",
                    remove.checked ? "true" : "false"
                );
            }

            message("Logo saved successfully. Refresh the public website to see the change.", "success");
            fileInput.value = "";
            await loadLogoSettings();
        } catch (error) {
            console.error("LOGO SETTINGS ERROR:", error);
            message(
                "Logo settings could not be saved: " + (error.message || "Unknown error"),
                "error"
            );
        }
    });

    reset?.addEventListener("click", async () => {
        try {
            await db.from("settings").delete().eq("setting_key", "site_logo_data");
            await saveSettingValue("site_logo_removed", "false");

            fileInput.value = "";
            remove.checked = false;

            message("The original project logo is restored.", "success");
            await loadLogoSettings();
        } catch (error) {
            console.error("LOGO RESET ERROR:", error);
            message("The project logo could not be restored.", "error");
        }
    });

    loadLogoSettings();
}

async function loadSettings() {
    const allRows = await getRows("settings");
    const rows = allRows.filter(row => {
        const key = String(row.setting_key || "");
        return !key.startsWith("invoice_price_")
            && !key.startsWith("invoice_record_")
            && !key.startsWith("invoice_payment_record_")
            && !key.startsWith("site_link_")
            && !key.startsWith("hidden_content_")
            && !key.startsWith("social_")
            && !key.startsWith("quote_status_")
            && !key.startsWith("training_status")
            && !key.startsWith("homepage_featured_")
            && !key.startsWith("site_logo_library_")
            && !key.startsWith("accounting_expense_")
            && !key.startsWith("system_error_")
            && !key.startsWith("inventory_item_")
            && !key.startsWith("admin_user_access_")
            && !key.startsWith("receipt_record_")
            && !key.startsWith("invoice_payment_accounts")
            && !key.startsWith("invoice_payment_")
            && !key.startsWith("payment_status_")
            && !key.startsWith("products_catalogue_seeded")
            && !key.startsWith("streetwear_catalogue_normalized_v3");
    });
    const list = document.getElementById("settingsList");
    if (!list) return;

    list.innerHTML = rows.length ? `
        <table><thead><tr><th>Setting</th><th>Value</th><th>Actions</th></tr></thead><tbody>
        ${rows.map(row => `<tr>
            <td>${escapeHTML(String(row.setting_key || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()))}</td>
            <td>${escapeHTML(row.setting_value || "")}</td>
            <td><button type="button" class="secondary" data-edit-setting="${row.id}">Edit</button> <button type="button" class="danger" data-delete-setting="${row.id}">Delete</button></td>
        </tr>`).join("")}
        </tbody></table>
    ` : `<div class="empty">No website settings records yet.</div>`;

    list.querySelectorAll("[data-edit-setting]").forEach(button => { button.onclick = () => { const row = rows.find(item => String(item.id) === String(button.dataset.editSetting)); if (!row) return; document.getElementById("settingId").value=row.id||""; document.getElementById("settingKey").value=row.setting_key||""; document.getElementById("settingValue").value=row.setting_value||""; document.getElementById("settingsForm").scrollIntoView({behavior:"smooth",block:"start"}); }; });

    list.querySelectorAll("[data-delete-setting]").forEach(button => {
        button.onclick = async () => {
            if (!confirm("Delete this setting?")) return;
            const result = await db.from("settings").delete().eq("id", button.dataset.deleteSetting);
            if (result.error) {
                message("Setting could not be deleted.", "error");
                return;
            }
            message("Setting deleted.", "success");
            await loadSettings();
        };
    });
}

function setupSettingsForm() {
    const form = document.getElementById("settingsForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const id = document.getElementById("settingId").value.trim();
        const key = document.getElementById("settingKey").value.trim();
        const value = document.getElementById("settingValue").value.trim();

        if (!key) {
            message("Please enter a setting name.", "error");
            return;
        }

        try {
            let result;
            if (id) {
                result = await db.from("settings").update({ setting_key: key, setting_value: value, updated_at: new Date().toISOString() }).eq("id", id);
            } else {
                await safeSettingUpsert(key, value);
                result = { error: null };
            }

            if (result.error) throw result.error;
            form.reset();
            document.getElementById("settingId").value = "";
            message("Setting saved.", "success");
            await loadSettings();
        } catch (error) {
            console.error(error);
            message("Setting could not be saved: " + error.message, "error");
        }
    });

    document.getElementById("newSettingButton")?.addEventListener("click", () => {
        form.reset();
        document.getElementById("settingId").value = "";
        form.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    document.getElementById("settingCancel")?.addEventListener("click", () => {
        form.reset();
        document.getElementById("settingId").value = "";
    });
}

/* =========================================================
   INITIAL PUBLIC-CONTENT IMPORT
   Converts the existing static gallery/services/FAQ content
   into database-managed records once, so the admin can edit/delete it.
========================================================= */
const INITIAL_GALLERY_ITEMS = [
    ["Hoodie Set","Streetwear Collection","images/photo (6).jpeg"],
    ["Hoodie","Streetwear Collection","images/photo (7).jpeg"],
    ["T-Shirt & Shorts","Streetwear Collection","images/photo (8).jpeg"],
    ["T-Shirt — Back View","Streetwear Collection","images/photo (9).jpeg"],
    ["Tank Top & Joggers","Streetwear Collection","images/photo (10).jpeg"],
    ["Jersey","Streetwear Collection","images/photo (11).jpeg"],
    ["Rhinestone Kaftan","Rhinestone Embellishment","images/photo (12).jpeg"],
    ["Rhinestone Dress","Rhinestone Embellishment","images/photo (1).jpeg"],
    ["Elegant Rhinestone Kaftan","Rhinestone Embellishment","images/photo (4).jpeg"],
    ["Printed Kaftan","Fashion Creations","images/photo (2).jpeg"],
    ["Fashion Creation","Fashion Creations","images/photo (3).jpeg"],
    ["Printed Kaftan","Featured Collection","videos/video (2).mp4"],
    ["Elegant Rhinestone Kaftan","Featured Collection","videos/video (3).mp4"],
    ["Rhinestone Varsity Jackets & Cargo Skirts","Featured Collection","videos/video (4).mp4"],
    ["Rhinestone Embellishment","Embellishment Projects","videos/video (1).mp4"],
    ["Graphic T-Shirts","Embellishment Projects","videos/video (5).mp4"]
];

const INITIAL_GALLERY_COLLECTIONS = [
    ["Streetwear Collection",1],
    ["Featured Collection",2],
    ["Embellishment Projects",3],
    ["Fashion Creations",4],
    ["Rhinestone Embellishment",5]
];

const INITIAL_SERVICES = [
    ["Streetwear","Streetwear","We produce plain and customised unisex streetwear pieces, including Jerseys, Hoodies, Joggers, T-shirts, Sweatshirts, Sweatpants, Varsity Jackets, Cargo Pants, Cargo Skirts and more."],
    ["Ladies Wear","Ladies Wear","We create Custom & Made-to-Order ladies wear designed according to individual styles, preferences and occasions."],
    ["Kids Wear","Kids Wear","We create Custom & Made-to-Order kids wear with quality craftsmanship, comfort and attention to detail."],
    ["Embellishment Services","Rhinestone Embellishment","Add a distinctive finish to your garments with our specialised embellishment and customisation services including Rhinestone Embellishment, Screen Printing/Fabric Painting and Glitter Works."],
    ["Practical Fashion Training","Practical Fashion Training","Aprils Signature offers hands-on practical fashion training designed to help participants develop real fashion skills through practical learning and production experience."]
];

const INITIAL_FAQS = [
    ["Do you make custom designs?","Yes. Aprils Signature specialises in custom and made-to-order fashion tailored to customers’ preferences."],
    ["Can I provide my own design or mock-up?","Yes. Customers can provide their own designs, mock-ups, or inspiration images where available."],
    ["Do you offer practical fashion training?","Yes. We offer practical fashion training programmes and specialty classes designed to build real fashion skills."],
    ["How much deposit is required?","A minimum of 75% of the total cost is required before production begins."],
    ["How long does production take?","Turnaround time varies depending on the design, order complexity, and workload. An estimated completion date will be communicated after confirmation."],
    ["Do you deliver outside Winneba?","Yes. We offer delivery across Ghana."],
    ["How do I register for training?","Prospective trainees can register through the Training Registration Form available on the website."]
];

async function seedInitialPublicContent() {
    try {
        const collections = await db.from("gallery_collections").select("id,name");
        if (!collections.error) {
            const existing = new Set((collections.data || []).map(r => String(r.name || "").trim().toLowerCase()));
            const missing = INITIAL_GALLERY_COLLECTIONS
                .filter(([name]) => !existing.has(name.toLowerCase()))
                .map(([name, display_order]) => ({name, display_order, active:true}));
            if (missing.length) {
                const result = await db.from("gallery_collections").insert(missing);
                if (result.error) console.warn("Gallery collections initial import skipped:", result.error);
            }
            // Apply the requested default order once. After that, the admin is
            // free to change the collection order without the seed resetting it.
            const orderMarker = await db.from("settings").select("id").eq("setting_key","gallery_collection_default_order_v2").limit(1);
            if (!orderMarker.error && !orderMarker.data?.length) {
                const currentRows = collections.data || [];
                for (const [name, display_order] of INITIAL_GALLERY_COLLECTIONS) {
                    const row = currentRows.find(r => String(r.name || "").trim().toLowerCase() === name.toLowerCase());
                    if (row && Number(row.display_order) !== display_order) {
                        await db.from("gallery_collections").update({display_order}).eq("id", row.id);
                    }
                }
                await safeSettingUpsert("gallery_collection_default_order_v2", "true");
            }
        }
    } catch (e) { console.warn("Gallery collections initial import unavailable:", e); }

    try {
        const gallery = await db.from("gallery_items").select("id,title,image_url");
        if (!gallery.error) {
            const existing = new Set((gallery.data || []).map(r => `${r.title || ""}\u0000${r.image_url || ""}`));
            const missing = INITIAL_GALLERY_ITEMS
                .map(([title, category, image_url], index) => ({ title, category, image_url, featured: category === "Featured Collection", active: true, display_order: index + 1 }))
                .filter(row => !existing.has(`${row.title}\u0000${row.image_url}`));
            if (missing.length) {
                const result = await db.from("gallery_items").insert(missing);
                if (result.error) console.warn("Gallery initial import skipped:", result.error);
            }
        }
    } catch (e) { console.warn("Gallery initial import unavailable:", e); }

    try {
        const collectionName = await db.from("settings").select("id").eq("setting_key","homepage_featured_collection_name").limit(1);
        if (!collectionName.error && !collectionName.data?.length) {
            await db.from("settings").insert({
                setting_key:"homepage_featured_collection_name",
                setting_value:"Featured Collection",
                updated_at:new Date().toISOString()
            });
        }
    } catch (e) { console.warn("Homepage collection name initial import unavailable:", e); }

    // Create the separate homepage Featured Collection from the current featured
    // gallery media once. Future homepage edits use only homepage_featured_* settings.
    try {
        const existingHomepage = await db.from("settings").select("id").like("setting_key", "homepage_featured_%").limit(1);
        if (!existingHomepage.error && !existingHomepage.data?.length) {
            const featured = await db.from("gallery_items").select("title,image_url,description,display_order,featured,active")
                .eq("featured", true).eq("active", true).order("display_order", {ascending:true});
            if (!featured.error && featured.data?.length) {
                for (const row of featured.data) {
                    const key = homepageMediaKey(row.title || "Featured Media", row.image_url || "");
                    await db.from("settings").insert({
                        setting_key: key,
                        setting_value: JSON.stringify({
                            title: row.title || "Featured Collection",
                            url: row.image_url || "",
                            order: row.display_order || 1,
                            description: row.description || "",
                            active: true
                        }),
                        updated_at: new Date().toISOString()
                    });
                }
            }
        }
    } catch (e) { console.warn("Homepage featured media initial import unavailable:", e); }

    try {
        const services = await db.from("admin_services").select("id,title");
        if (!services.error) {
            const existing = new Set((services.data || []).map(r => (r.title || "").trim().toLowerCase()));
            const missing = INITIAL_SERVICES
                .filter(([title]) => !existing.has(title.toLowerCase()))
                .map(([title, category, description]) => ({ title, category, description, active: true }));
            if (missing.length) {
                const result = await db.from("admin_services").insert(missing);
                if (result.error) console.warn("Services initial import skipped:", result.error);
            }
        }
    } catch (e) { console.warn("Services initial import unavailable:", e); }

    try {
        const faqs = await db.from("faqs").select("id,question");
        if (!faqs.error) {
            const existing = new Set((faqs.data || []).map(r => (r.question || "").trim().toLowerCase()));
            const missing = INITIAL_FAQS
                .filter(([question]) => !existing.has(question.toLowerCase()))
                .map(([question, answer]) => ({ question, answer, active: true }));
            if (missing.length) {
                const result = await db.from("faqs").insert(missing);
                if (result.error) console.warn("FAQ initial import skipped:", result.error);
            }
        }
    } catch (e) { console.warn("FAQ initial import unavailable:", e); }

    // Seed the editable admin sections from the current live website content.
    const INITIAL_CONTENT = [
        ["Homepage Hero Heading", "Custom & Made-to-Order Fashion Brand"],
        ["Homepage Tagline", "Elegance In Every Stitch"],
        ["About Page Introduction", "Aprils Signature is a Custom & Made-to-Order Fashion Brand specialising in Streetwear, Ladies Wear, and Kids Wear."],
        ["About Page What We Do", "Streetwear, Ladies Wear, Kids Wear, Embellishment Services and Practical Fashion Training."],
        ["About Page Why Choose Us", "Custom & Made-to-Order Fashion; Premium Quality; Reliable Turnaround Time; Nationwide Delivery; Practical Fashion Training."],
        ["About Page Shop Introduction", "A Glimpse Inside Aprils Signature — Visit our shop in Winneba, where creativity, quality craftsmanship, and personalised fashion services come together."],
        ["Homepage CTA", "Ready to bring your ideas to life?"],
        ["Homepage CTA Description", "Whether you're ordering a custom outfit, looking for professional embellishment services, or enrolling in a training programme, Aprils Signature is here to help."]
    ];
    try {
        const existing = await db.from("site_content").select("id,content_key");
        if (!existing.error) {
            const keys = new Set((existing.data || []).map(r => String(r.content_key || "").toLowerCase()));
            const missing = INITIAL_CONTENT.filter(([k]) => !keys.has(k.toLowerCase())).map(([content_key, content_value]) => ({content_key, content_value}));
            if (missing.length) await db.from("site_content").insert(missing);
        }
    } catch (e) { console.warn("Website content initial import unavailable:", e); }

    const INITIAL_POLICIES = [
        ["Payment Policy", "payment_policy", "A minimum of 75% of the total cost must be paid before production begins.\n\nFor orders being picked up or collected, the remaining balance must be paid before or at the time of collection.\n\nFor delivery orders, the remaining balance must be paid in full before the order is dispatched.\n\nFor any form of fashion training\nFull payment must be made before start of class or section."],
        ["Refund Policy", "refund_policy", "At Aprils Signature, every order is custom-made or made-to-order with care and attention to detail. For this reason, we encourage customers to review all order details carefully before confirming their orders.\n\nThe 75% deposit paid before production begins is non-refundable once production has started.\n\nIf a customer chooses to cancel an order before production begins, any refund will be considered on a case-by-case basis, depending on any costs already incurred.\n\nRefunds will not be issued for changes of mind after production has commenced.\n\nIf an item is found to have a genuine workmanship defect, customers should contact us within 48 hours of receiving the item so we can assess the issue and provide an appropriate solution, which may include alterations, repairs, or another suitable remedy where applicable.\n\nRefunds do not apply to issues arising from incorrect measurements or information provided by the customer.\n\nCustomer satisfaction is important to us. We encourage all customers to communicate any concerns as soon as possible so that we can work together to find a fair and satisfactory solution.\n\nFor any form of training\nPayments made are not refundable or transferrable as such, prospective trainees must do their due diligence and be certain of taking the class before any payment is made."],
        ["Delivery & Collection Policy", "delivery_collection_policy", "At Aprils Signature, every item is custom-made or made-to-order. Completion and delivery times vary depending on the design, order complexity, and current workload.\n\nCustomers will be informed of the estimated completion date after their order has been confirmed.\n\nCustomers who choose pickup/collection will be notified when their order is ready.\n\nFor delivery orders, dispatch will be arranged after the order has been completed and the outstanding balance has been paid in full.\n\nDelivery charges, where applicable, will be communicated before dispatch.\n\nWhile we make every effort to meet agreed timelines, unforeseen circumstances may occasionally cause delays. In such cases, customers will be informed promptly.\n\nWe also encourage customers to provide accurate delivery information to ensure a smooth delivery process."],
        ["Privacy Policy", "privacy_policy", "At Aprils Signature, we value your privacy and are committed to protecting your personal information.\n\nAny information you provide through our website, including contact forms, quote requests, training applications, and order enquiries, is used solely to provide our services and communicate with you regarding your request.\n\nThe information we may collect includes:\n- Name\n- Phone number\n- Email address\n- Delivery or pickup details\n- Measurements\n- Uploaded garments photos or mockups\n- Any other information you may choose to provide\n\nYour personal information will not be sold, rented, or shared with third parties except where necessary to provide our services or where required by law.\n\nWe take reasonable steps to keep your information secure and use it only for legitimate business purposes.\n\nIf you have any questions about how your personal information is used, please contact us and we will be happy to assist you.\n\nBy using our website and submitting your information, you agree to the terms of this Privacy Policy."],
    ];
    try {
        const existing = await db.from("policies").select("id,policy_key,content");
        if (!existing.error) {
            const keys = new Set((existing.data || []).map(r => String(r.policy_key || "").toLowerCase()));
            const missing = INITIAL_POLICIES.filter(([,k]) => !keys.has(k.toLowerCase())).map(([title, policy_key, content]) => ({title, policy_key, content}));
            if (missing.length) await db.from("policies").insert(missing);

            // Bring the privacy-policy record in line with the approved public wording
            // only when the older version is still present. Once the admin has made a
            // deliberate edit, do not overwrite it.
            const privacy = (existing.data || []).find(r => String(r.policy_key || "").toLowerCase() === "privacy_policy");
            if (privacy && /order request code from the selection area/i.test(String(privacy.content || ""))) {
                const approved = INITIAL_POLICIES.find(([,k]) => k === "privacy_policy");
                if (approved) await db.from("policies").update({content: approved[2], updated_at:new Date().toISOString()}).eq("id", privacy.id);
            }
        }
    } catch (e) { console.warn("Policy initial import unavailable:", e); }

    const INITIAL_SOCIALS = [
        ["social_tiktok", "https://www.tiktok.com/@aprilssignature"],
        ["social_instagram", "https://www.instagram.com/aprilssignature_/"],
        ["social_facebook", "https://www.facebook.com/share/1BwqEnbUkU/"],
        ["social_whatsapp", "https://wa.me/233592983027"]
    ];
    try {
        const existing = await db.from("settings").select("id,setting_key");
        if (!existing.error) {
            const keys = new Set((existing.data || []).map(r => String(r.setting_key || "").toLowerCase()));
            const missing = INITIAL_SOCIALS.filter(([k]) => !keys.has(k.toLowerCase())).map(([setting_key, setting_value]) => ({setting_key, setting_value}));
            if (missing.length) await db.from("settings").insert(missing);
        }
    } catch (e) { console.warn("Social links initial import unavailable:", e); }

    const INITIAL_SITE_LINKS = [
        ["site_link_home", { label: "Home", url: "index.html", order: 1, location: "header", active: true }],
        ["site_link_about", { label: "About", url: "about.html", order: 2, location: "header", active: true }],
        ["site_link_services", { label: "Services", url: "services.html", order: 3, location: "header", active: true }],
        ["site_link_gallery", { label: "Gallery", url: "gallery.html", order: 4, location: "header", active: true }],
        ["site_link_shop", { label: "Shop", url: "shop.html", order: 5, location: "header", active: true }],
        ["site_link_training", { label: "Training", url: "training.html", order: 6, location: "header", active: true }],
        ["site_link_order_request", { label: "Order / Request a Quote", url: "quotes.html", order: 7, location: "header", active: true }],
        ["site_link_policies_terms", { label: "Policies & Terms", url: "policies.html", order: 8, location: "header", active: true }],
        ["site_link_contact", { label: "Contact", url: "contact.html", order: 9, location: "header", active: true }],
        ["site_link_google_review", { label: "Send Us a Google Review", url: "https://g.page/r/CcD7hxB7NK7pEAE/review", order: 1, location: "footer", active: true }]
    ];
    try {
        const existing = await db.from("settings").select("setting_key").like("setting_key", "site_link_%");
        if (!existing.error) {
            const keys = new Set((existing.data || []).map(r => String(r.setting_key || "").toLowerCase()));
            const missing = INITIAL_SITE_LINKS
                .filter(([key]) => !keys.has(key.toLowerCase()))
                .map(([setting_key, value]) => ({
                    setting_key,
                    setting_value: JSON.stringify(value),
                    updated_at: new Date().toISOString()
                }));
            if (missing.length) await db.from("settings").insert(missing);
        }
    } catch (e) { console.warn("Website links initial import unavailable:", e); }

    try {
        const existing = await db.from("contact_settings").select("id").limit(1).maybeSingle();
        if (!existing.error && !existing.data) {
            await db.from("contact_settings").insert({
                business_name: "Aprils Signature", phone: "+233 59 298 3027", whatsapp: "+233 59 298 3027", email: "info@aprilssignature.com",
                address: "CE-003-0009 AL174 Windy Avenue\nOpposite Former Perez Chapel International\nWinneba, Central Region, Ghana.",
                opening_hours: "Monday – Friday: 8:00 AM – 5:30 PM\nSaturday: Closed\nSunday: Closed"
            });
        }
    } catch (e) { console.warn("Contact information initial import unavailable:", e); }
}



/* =========================================================
   DISCOUNT CODES
========================================================= */

function discountStorageKey(code) {
    return "discount_code_" + contentSlug(code);
}

async function loadDiscountCodes() {
    const list = document.getElementById("discountList");
    const linkBox = document.getElementById("discountRedemptionLink");
    if (!list) return;

    const rows = await getRows("settings");
    const codes = rows.filter(r => String(r.setting_key || "").startsWith("discount_code_")).map(r => {
        try { return { ...JSON.parse(r.setting_value || "{}"), id: r.id, setting_key: r.setting_key }; }
        catch (_) { return null; }
    }).filter(Boolean);

    list.innerHTML = codes.length ? `<table><thead><tr><th>Code</th><th>Percentage</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        ${codes.map(r => `<tr><td>${escapeHTML(r.code)}</td><td>${Number(r.percent || 0).toFixed(2)}%</td><td>${r.active === false ? "Inactive" : "Active"}</td>
        <td><button type="button" class="secondary" data-edit-discount="${escapeHTML(r.id)}">Edit</button>
        <button type="button" class="danger" data-delete-discount="${escapeHTML(r.id)}">Delete</button></td></tr>`).join("")}
    </tbody></table>` : `<div class="empty">No discount codes have been added yet.</div>`;

    list.querySelectorAll("[data-edit-discount]").forEach(btn => {
        btn.onclick = () => {
            const r = codes.find(x => String(x.id) === String(btn.dataset.editDiscount));
            if (!r) return;
            document.getElementById("discountId").value = r.id || "";
            document.getElementById("discountCode").value = r.code || "";
            document.getElementById("discountPercent").value = r.percent ?? "";
            document.getElementById("discountActive").value = r.active === false ? "false" : "true";
            document.getElementById("discountForm").scrollIntoView({behavior:"smooth",block:"start"});
        };
    });
    list.querySelectorAll("[data-delete-discount]").forEach(btn => {
        btn.onclick = async () => {
            if (!confirm("Delete this discount code?")) return;
            const result = await db.from("settings").delete().eq("id", btn.dataset.deleteDiscount);
            if (result.error) { message("Discount code could not be deleted: " + result.error.message, "error"); return; }
            message("Discount code deleted.", "success");
            await loadDiscountCodes();
        };
    });

    const redemptionList = document.getElementById("discountRedemptionList");
    if (redemptionList) {
        try {
            const redemptionResult = await db.from("discount_redemptions").select("*").order("created_at", {ascending:false});
            let redemptions = redemptionResult.error ? [] : (redemptionResult.data || []);
            // Older versions accepted any code. Mark those legacy pending entries as rejected
            // when the code is not currently registered and active.
            if (redemptions.length && codes.length) {
                const validCodes = new Set(codes.map(c => String(c.code || "").trim().toLowerCase()));
                for (const redemption of redemptions) {
                    if (String(redemption.status || "pending") === "pending" && !validCodes.has(String(redemption.code || "").trim().toLowerCase())) {
                        try { await db.from("discount_redemptions").update({status:"rejected"}).eq("id", redemption.id); redemption.status = "rejected"; } catch (_) {}
                    }
                }
            }
            redemptionList.innerHTML = redemptions.length ? `<table><thead><tr><th>Date</th><th>Customer</th><th>Phone</th><th>Email</th><th>Code</th><th>Reference</th><th>Status</th><th>Action</th></tr></thead><tbody>
            ${redemptions.map(r => `<tr><td>${escapeHTML(r.created_at ? new Date(r.created_at).toLocaleString("en-GB", {timeZone:"UTC"}) + " GMT" : "")}</td><td>${escapeHTML(r.full_name)}</td><td>${escapeHTML(r.phone)}</td><td>${escapeHTML(r.email || "")}</td><td>${escapeHTML(r.code)}</td><td>${escapeHTML(r.order_reference || "")}</td><td>${escapeHTML(r.status || "pending")}</td><td><button type="button" class="danger" data-delete-redemption="${escapeHTML(r.id)}">Delete</button></td></tr>`).join("")}
            </tbody></table>` : `<div class="empty">No customer discount redemptions have been received yet.</div>`;
            redemptionList.querySelectorAll("[data-delete-redemption]").forEach(btn => btn.onclick = async () => {
                if (!confirm("Delete this redemption record?")) return;
                const result = await db.from("discount_redemptions").delete().eq("id", btn.dataset.deleteRedemption);
                if (result.error) { message("Redemption could not be deleted: " + result.error.message, "error"); return; }
                await loadDiscountCodes();
            });
        } catch (_) {
            redemptionList.innerHTML = `<div class="empty">The redemption table is not available yet. Run the included discount-redemption.sql file in Supabase.</div>`;
        }
    }

    if (linkBox) {
        const url = new URL("../redeem.html", window.location.href).href;
        linkBox.innerHTML = `<p><a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(url)}</a></p>
        <button type="button" class="secondary" id="copyDiscountPage">Copy Redemption Page Link</button>
        <button type="button" class="secondary" id="shareDiscountPage">Share Redemption Page Link</button>`;
        document.getElementById("copyDiscountPage")?.addEventListener("click", async () => {
            try { await navigator.clipboard.writeText(url); message("Discount page link copied.", "success"); }
            catch (_) { window.prompt("Copy this link:", url); }
        });
        document.getElementById("shareDiscountPage")?.addEventListener("click", async () => {
            if (navigator.share) {
                try { await navigator.share({title:"Aprils Signature Discount", url}); return; } catch (_) {}
            }
            window.open("https://wa.me/?text=" + encodeURIComponent("Aprils Signature discount redemption page:\n" + url), "_blank", "noopener,noreferrer");
        });
    }
}

function setupDiscountForm() {
    const form = document.getElementById("discountForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";
    form.addEventListener("submit", async event => {
        event.preventDefault();
        const id = document.getElementById("discountId").value.trim();
        const code = document.getElementById("discountCode").value.trim();
        const percent = Number(document.getElementById("discountPercent").value);
        const active = document.getElementById("discountActive").value === "true";
        if (!code || Number.isNaN(percent) || percent < 0 || percent > 100) {
            message("Enter a valid code and a percentage between 0 and 100.", "error");
            return;
        }
        const payload = {
            setting_key: discountStorageKey(code),
            setting_value: JSON.stringify({code, percent, active, updatedAt:new Date().toISOString()}),
            updated_at: new Date().toISOString()
        };
        try {
            if (id) {
                const result = await db.from("settings").update(payload).eq("id", id);
                if (result.error) throw result.error;
            } else {
                await safeSettingUpsert(payload.setting_key, payload.setting_value);
            }
            form.reset();
            document.getElementById("discountId").value = "";
            document.getElementById("discountActive").value = "true";
            message("Discount code saved.", "success");
            await loadDiscountCodes();
        } catch (error) {
            message("Discount code could not be saved: " + error.message, "error");
        }
    });
    document.getElementById("discountCancel")?.addEventListener("click", () => {
        form.reset();
        document.getElementById("discountId").value = "";
        document.getElementById("discountActive").value = "true";
    });
}

/* =========================================================
   MANUAL INVOICE
========================================================= */

function addManualInvoiceLine(line = {}) {
    const wrap = document.getElementById("manualInvoiceLines");
    if (!wrap) return;
    const row = document.createElement("div");
    row.className = "manual-invoice-line";
    row.innerHTML = `
        <div><label>Item / Service</label><input class="manual-line-description" value="${escapeHTML(line.description || "")}" placeholder="e.g. Custom Dress"></div>
        <div><label>Details</label><input class="manual-line-details" value="${escapeHTML(line.details || "")}" placeholder="Optional"></div>
        <div><label>Quantity</label><input class="manual-line-qty" type="number" min="1" value="${Number(line.quantity || 1)}"></div>
        <div><label>Unit Price (GHS)</label><input class="manual-line-price" type="number" min="0" step="0.01" value="${Number(line.unitPrice || 0)}" placeholder="0.00"></div>
        <button type="button" class="danger manual-line-remove">Remove</button>
    `;
    row.querySelector(".manual-line-remove").onclick = () => row.remove();
    const descriptionInput = row.querySelector(".manual-line-description");
    const priceInput = row.querySelector(".manual-line-price");
    descriptionInput?.addEventListener("change", async () => {
        if (Number(priceInput?.value || 0) > 0) return;
        try {
            const map = await getInvoicePriceMap();
            const suggested = invoicePriceFor(map, descriptionInput.value || "");
            if (suggested > 0 && priceInput) priceInput.value = suggested.toFixed(2);
        } catch (_) {}
    });
    wrap.appendChild(row);
}

function setupManualInvoiceForm() {
    const form = document.getElementById("manualInvoiceForm");
    const wrap = document.getElementById("manualInvoiceLines");
    if (!form || !wrap || form.dataset.bound) return;
    form.dataset.bound = "1";

    if (!wrap.children.length) addManualInvoiceLine();

    document.getElementById("manualAddLine")?.addEventListener("click", () => addManualInvoiceLine());

    document.getElementById("manualInvoiceReset")?.addEventListener("click", () => {
        form.reset();
        wrap.innerHTML = "";
        addManualInvoiceLine();
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const lines = Array.from(wrap.querySelectorAll(".manual-invoice-line")).map(row => ({
            description: row.querySelector(".manual-line-description")?.value.trim() || "",
            details: row.querySelector(".manual-line-details")?.value.trim() || "",
            quantity: Number(row.querySelector(".manual-line-qty")?.value || 1),
            unitPrice: Number(row.querySelector(".manual-line-price")?.value || 0)
        })).filter(line => line.description);

        if (!lines.length) {
            message("Please add at least one invoice item.", "error");
            return;
        }

        const row = {
            full_name: document.getElementById("manualInvoiceCustomer").value.trim(),
            phone: document.getElementById("manualInvoicePhone").value.trim(),
            whatsapp: document.getElementById("manualInvoicePhone").value.trim(),
            email: document.getElementById("manualInvoiceEmail").value.trim(),
            location: document.getElementById("manualInvoiceAddress").value.trim()
        };
        if (!row.full_name) {
            message("Please enter the customer's name.", "error");
            return;
        }

        await openInvoiceGenerator(row, {
            manualLines: lines,
            notes: document.getElementById("manualInvoiceNotes").value.trim()
        });
    });
}


async function openSavedUserInvoiceReadOnly(row){
    await openInvoiceGenerator({id:row.sourceId||"",full_name:row.customer||"",phone:row.phone||"",whatsapp:row.phone||"",email:row.email||"",location:row.address||""},{manualLines:row.lines||[],notes:row.notes||"",training:!!row.training,userInvoice:true,invoiceNumber:row.invoiceNumber,discountPercent:Number(row.discountPercent||0)});
    const modal=document.getElementById("invoiceGeneratorModal");
    if(!modal)return;
    modal.querySelector(".invoice-generator-editor")?.remove();
    modal.querySelector("#saveGeneratedInvoice")?.remove();
    modal.querySelector("#generateReceiptFromInvoice")?.remove();
}

/* =========================================================
   USERS INVOICE — walk-in / direct customers
========================================================= */
function setupUsersInvoiceForm(){
    const form=document.getElementById("usersInvoiceForm");
    const wrap=document.getElementById("usersInvoiceLines");
    if(!form||!wrap||form.dataset.bound)return;
    form.dataset.bound="1";
    const add=()=>{const n=wrap.querySelectorAll(".manual-invoice-line").length+1;wrap.insertAdjacentHTML("beforeend",`<div class="manual-invoice-line"><input class="manual-line-description" placeholder="Item / Service" required><input class="manual-line-details" placeholder="Details"><input class="manual-line-qty" type="number" min="1" value="1"><input class="manual-line-price" type="number" min="0" step="0.01" placeholder="Price" required><button type="button" class="danger manual-line-remove">Remove</button></div>`);};
    wrap.addEventListener("blur",async e=>{
        if(!e.target.classList.contains("manual-line-description"))return;
        const line=e.target.closest(".manual-invoice-line"),price=line?.querySelector(".manual-line-price");if(!line||!price||price.value)return;
        try{const map=await getInvoicePriceMap();const found=invoicePriceFor(map,e.target.value.trim());if(found>0)price.value=found.toFixed(2);}catch(_){}
    },true);
    add();
    document.getElementById("usersInvoiceAddLine")?.addEventListener("click",add);
    wrap.addEventListener("click",e=>{if(e.target.closest(".manual-line-remove")){e.target.closest(".manual-invoice-line")?.remove();if(!wrap.children.length)add();}});
    document.getElementById("usersInvoiceReset")?.addEventListener("click",()=>{form.reset();wrap.innerHTML="";add();});
    form.addEventListener("submit",async e=>{
        e.preventDefault();
        const lines=[...wrap.querySelectorAll(".manual-invoice-line")].map(r=>({description:r.querySelector(".manual-line-description")?.value.trim()||"",details:r.querySelector(".manual-line-details")?.value.trim()||"",quantity:Number(r.querySelector(".manual-line-qty")?.value||1),unitPrice:Number(r.querySelector(".manual-line-price")?.value||0)})).filter(x=>x.description);
        if(!lines.length){message("Add at least one invoice item.","error");return;}
        const row={full_name:document.getElementById("usersInvoiceCustomer").value.trim(),phone:document.getElementById("usersInvoicePhone").value.trim(),whatsapp:document.getElementById("usersInvoicePhone").value.trim(),email:document.getElementById("usersInvoiceEmail").value.trim(),location:document.getElementById("usersInvoiceAddress").value.trim()};
        if(!row.full_name){message("Enter the customer's name.","error");return;}
        await openInvoiceGenerator(row,{manualLines:lines,notes:document.getElementById("usersInvoiceNotes").value.trim(),userInvoice:true});
        form.reset();wrap.innerHTML="";add();
    });
}

async function loadCollectionInvoiceOptions(){
    const select=document.getElementById("collectionInvoiceSelect");if(!select)return;
    try{
        const rows=await getRows("settings");
        const invoices=rows.filter(r=>String(r.setting_key||"").startsWith("invoice_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean).sort((a,b)=>String(b.savedAt||"").localeCompare(String(a.savedAt||"")));
        select.innerHTML=`<option value="">Select saved invoice</option>`+invoices.map(i=>`<option value="${escapeHTML(i.invoiceNumber||"")}">${escapeHTML(i.invoiceNumber||"")} — ${escapeHTML(i.customer||"Customer")}</option>`).join("");
        window._aprilsCollectionInvoices=invoices;
    }catch(e){select.innerHTML='<option value="">Saved invoices could not be loaded</option>';}
}

function renderCollectionPreview(){
    const select=document.getElementById("collectionInvoiceSelect"),box=document.getElementById("collectionPreview");if(!select||!box)return;
    const row=(window._aprilsCollectionInvoices||[]).find(i=>String(i.invoiceNumber)===String(select.value));
    if(!row){box.innerHTML="";return;}
    const lines=row.lines||[];const total=Number(row.total||0);
    box.innerHTML=`<div class="collection-preview-card"><h3>Collection / Delivery Form Preview</h3><p><strong>Customer:</strong> ${escapeHTML(row.customer||"")}</p><p><strong>Invoice:</strong> ${escapeHTML(row.invoiceNumber||"")}</p><table><thead><tr><th>Item</th><th>Quantity</th></tr></thead><tbody>${lines.map(l=>`<tr><td>${escapeHTML(l.description||"")}</td><td>${escapeHTML(l.quantity||1)}</td></tr>`).join("")}</tbody></table><p><strong>Total Invoice Amount:</strong> GHS ${total.toFixed(2)}</p><p><strong>Payment:</strong> GHS <span id="collectionPreviewPaid">0.00</span></p><p><strong>Balance:</strong> GHS <span id="collectionPreviewBalance">${total.toFixed(2)}</span></p></div>`;
    getInvoicePayments(row.invoiceNumber).then(payments=>{const paid=payments.reduce((sum,p)=>sum+Number(p.amount||0),0);const p=document.getElementById("collectionPreviewPaid"),b=document.getElementById("collectionPreviewBalance");if(p)p.textContent=paid.toFixed(2);if(b)b.textContent=Math.max(0,total-paid).toFixed(2);});
}

function setupCollectionForm(){
    const form=document.getElementById("collectionForm");if(!form||form.dataset.bound)return;form.dataset.bound="1";
    form.dataset.bound="1";
    document.getElementById("collectionInvoiceSelect")?.addEventListener("change",renderCollectionPreview);
    document.getElementById("collectionGenerate")?.addEventListener("click",()=>generateCollectionForm(false));
    document.getElementById("collectionShare")?.addEventListener("click",()=>generateCollectionForm(true));
    document.getElementById("collectionWhatsApp")?.addEventListener("click",()=>generateCollectionForm(true,"whatsapp"));
    loadCollectionInvoiceOptions();
}
async function generateCollectionForm(share,mode){
    const invoice=(window._aprilsCollectionInvoices||[]).find(i=>String(i.invoiceNumber)===String(document.getElementById("collectionInvoiceSelect")?.value||""));
    if(!invoice){message("Select a saved invoice first.","error");return;}
    const date=document.getElementById("collectionDate")?.value||"",time=document.getElementById("collectionTime")?.value||"",location=document.getElementById("collectionLocation")?.value.trim()||"";
    if(!date||!time||!location){message("Enter the collection / delivery date, time and location.","error");return;}
    const payments=await getInvoicePayments(invoice.invoiceNumber);const paid=payments.reduce((sum,p)=>sum+Number(p.amount||0),0);const balance=Math.max(0,Number(invoice.total||0)-paid);
    const entryId=makeAprilsUniqueId("COL");const actor=await getCurrentStaffIdentity();
    const root=document.createElement("div");root.className="collection-form-paper";root.innerHTML=`<div class="collection-brand"><img src="${escapeHTML(new URL("../icons/Aprils Signature logo.jpeg",window.location.href).href)}" alt="Aprils Signature logo"><div><h1>Aprils Signature</h1><p>Elegance in Every Stitch</p></div><div class="collection-title"><strong>COLLECTION / DELIVERY FORM</strong><span>${escapeHTML(invoice.invoiceNumber||"")}</span></div></div><div class="collection-customer"><p><strong>Customer:</strong> ${escapeHTML(invoice.customer||"")}</p><p><strong>Phone:</strong> ${escapeHTML(invoice.phone||"")}</p></div><table><thead><tr><th>Item</th><th>Quantity</th></tr></thead><tbody>${(invoice.lines||[]).map(l=>`<tr><td>${escapeHTML(l.description||"")}</td><td>${escapeHTML(l.quantity||1)}</td></tr>`).join("")}</tbody></table><div class="collection-summary"><p><strong>Total Invoice Amount:</strong> GHS ${Number(invoice.total||0).toFixed(2)}</p><p><strong>Payment:</strong> GHS ${paid.toFixed(2)}</p><p><strong>Balance to be Paid:</strong> GHS ${balance.toFixed(2)}</p></div><div class="collection-details"><h3>Collection / Delivery Details</h3><p><strong>Date:</strong> ${escapeHTML(date)}</p><p><strong>Time:</strong> ${escapeHTML(time)}</p><p><strong>Location:</strong> ${escapeHTML(location)}</p></div><p class="collection-note">Please bring this form when collecting your item.</p><p class="collection-id">Form ID: ${escapeHTML(entryId)}</p></div>`;
    document.body.appendChild(root);
    try{
        const html2pdf=await ensureHtml2Pdf();if(!html2pdf)throw new Error("PDF service unavailable");
        const blob=await pdfFromVisibleElement(root,{margin:0,filename:`Aprils-Signature-Collection-${invoice.invoiceNumber}.pdf`,image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"in",format:"a4",orientation:"portrait"}});
        const file=new File([blob],`Aprils-Signature-Collection-${invoice.invoiceNumber}.pdf`,{type:"application/pdf"});
        if(share&&navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:"Aprils Signature Collection / Delivery Form",text:"Aprils Signature collection / delivery form",files:[file]});return;}
        const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
        if(mode==="whatsapp"){const number=normalizeWhatsAppNumber(invoice.phone||"");window.open(number?`https://wa.me/${number}?text=${encodeURIComponent("Aprils Signature Collection / Delivery Form — please attach the downloaded PDF.")}`:"https://wa.me/","_blank","noopener,noreferrer");}
        message("Collection / delivery PDF generated.","success");
        await auditSystemEvent("collection_delivery_form",entryId,"generated",{invoiceNumber:invoice.invoiceNumber,customer:invoice.customer,date,time,location,enteredBy:actor.staffId});
    }catch(e){console.error(e);message("The collection / delivery PDF could not be generated: "+e.message,"error");}finally{root.remove();}
}

/* =========================================================
   STAFF ACTIVITY / AUDIT LOG
========================================================= */
async function loadAuditLog(){
    const list=document.getElementById("auditLogList");
    if(!list)return;
    try{
        const rows=(await getRows("settings")).filter(r=>String(r.setting_key||"").startsWith("audit_event_"));
        const events=rows.map(r=>{try{return {...JSON.parse(r.setting_value||"{}"),_id:r.id}}catch(_){return null}}).filter(Boolean).sort((a,b)=>String(b.at||"").localeCompare(String(a.at||"")));
        const staffIds=[...new Set(events.map(e=>String(e.actorId||"")).filter(Boolean))];
        const staffSelect=document.getElementById("auditStaffFilter");
        if(staffSelect){const current=staffSelect.value;staffSelect.innerHTML='<option value="">All staff</option>'+staffIds.map(id=>`<option value="${escapeHTML(id)}">${escapeHTML(id)}</option>`).join("");staffSelect.value=staffIds.includes(current)?current:"";}
        const selected=String(staffSelect?.value||"");
        const action=String(document.getElementById("auditActionFilter")?.value||"").trim().toLowerCase();
        const term=String(document.getElementById("auditSearch")?.value||"").trim().toLowerCase();
        const filtered=events.filter(e=>{const hay=JSON.stringify(e).toLowerCase();return(!selected||String(e.actorId||"")===selected)&&(!action||String(e.action||"").toLowerCase().includes(action))&&(!term||hay.includes(term));});
        list.innerHTML=filtered.length?`<table><thead><tr><th>Date / Time</th><th>Staff ID</th><th>Staff Email</th><th>Action</th><th>Record</th><th>Details</th></tr></thead><tbody>${filtered.map(e=>`<tr><td>${escapeHTML(e.at||"")}</td><td><strong>${escapeHTML(e.actorId||"—")}</strong></td><td>${escapeHTML(e.actorEmail||"")}</td><td>${escapeHTML(e.action||"")}</td><td>${escapeHTML(String(e.entityType||"")+" / "+String(e.entityId||""))}</td><td><pre style="white-space:pre-wrap;margin:0;max-width:460px;">${escapeHTML(JSON.stringify(e.details||{},null,2))}</pre></td></tr>`).join("")}</tbody></table>`:`<div class="empty">No matching staff activity found.</div>`;
    }catch(e){list.innerHTML=`<div class="empty">Staff activity could not be loaded: ${escapeHTML(e.message||"")}</div>`;}
}
function setupAuditLog(){
    const list=document.getElementById("auditLogList");if(!list||list.dataset.bound)return;list.dataset.bound="1";
    document.getElementById("auditRefresh")?.addEventListener("click",loadAuditLog);
    document.getElementById("auditStaffFilter")?.addEventListener("change",loadAuditLog);
    document.getElementById("auditActionFilter")?.addEventListener("input",loadAuditLog);
    document.getElementById("auditSearch")?.addEventListener("input",loadAuditLog);
    loadAuditLog();
}

/* =========================================================
   ADMIN USER ACCESS
   Uses a small settings-based permission registry. Auth accounts
   themselves are created in Supabase Authentication; this page
   controls which signed-in staff member may use which sections.
========================================================= */
const ADMIN_ACCESS_SECTIONS = [
    ["dashboard","Dashboard"],["gallery","Gallery & Media"],["homepage","Homepage Media"],["services","Products / Services / Training"],
    ["registrations","Training Registrations"],["orders","Order / Quote Requests"],["orderStatusUpdates","Order Status / Payment Updates"],["orderTracking","Order Tracking"],["refund","Refund"],["trainees","Trainees"],["staffHR","Staff / HR"],["invoice","Invoice Pricing"],["usersInvoice","Users Invoice"],["collectionForms","Delivery/Pickup Form"],["manualInvoice","Invoices & Receipts"],
    ["shopAdmin","Shop"],["inventory","Inventory / Stock"],["checkout","Checkout Orders"],["errors","System Error Log"], ["auditLog","Staff Activity / Audit Log"],["accounting","Sales & Accounting"],
    ["links","Website Links"],["testimonials","Testimonials"],["faq","FAQs"],["content","Website Content"],["policies","Policies & Terms"],
    ["contact","Contact"],["social","Social Links"],["discounts","Discount Codes"],["settings","Website Settings"],["users","Admin Users & Access"]
];
function accessKey(email){return "admin_user_access_" + contentSlug(email);}
function accessDefaultSections(role){
    if(role==="owner"||role==="manager") return ADMIN_ACCESS_SECTIONS.map(x=>x[0]);
    if(role==="sales") return ["dashboard","orders","orderTracking","invoice","usersInvoice","collectionForms","manualInvoice","accounting","checkout"];
    if(role==="training") return ["dashboard","registrations","orders","orderTracking","trainees","usersInvoice","collectionForms","manualInvoice","invoice"];
    if(role==="inventory") return ["dashboard","shopAdmin","inventory","checkout","accounting"];
    if(role==="front_desk") return ["dashboard","orders","checkout","collectionForms"];
    if(role==="customer_service") return ["dashboard","orders","orderTracking","usersInvoice","collectionForms","testimonials"];
    if(role==="accounting") return ["dashboard","invoice","usersInvoice","manualInvoice","accounting","refund","orderStatusUpdates"];
    if(role==="hr") return ["dashboard","staffHR","auditLog","accounting"];
    return ["dashboard","gallery","homepage","services","content","policies","testimonials","faq"];
}
async function loadUserAccess(){
    const list=document.getElementById("userAccessList"); const checks=document.getElementById("userAccessChecks"); if(!list||!checks)return;
    checks.innerHTML=ADMIN_ACCESS_SECTIONS.map(([id,label])=>`<label class="checkbox"><input type="checkbox" value="${escapeHTML(id)}"> ${escapeHTML(label)}</label>`).join("");
    try{
        const rows=(await getRows("settings")).filter(r=>String(r.setting_key||"").startsWith("admin_user_access_"));
        const users=rows.map(r=>{try{return{...JSON.parse(r.setting_value||"{}"),id:r.id,key:r.setting_key}}catch(_){return null}}).filter(Boolean);
        for(const u of users){
            if(!u.staffId){
                u.staffId=makeAprilsUniqueId("STF");
                try{await db.from("settings").update({setting_value:JSON.stringify(u),updated_at:new Date().toISOString()}).eq("id",u.id)}catch(_){}
            }
        }
        list.innerHTML=users.length?`<table><thead><tr><th>Staff ID</th><th>Email</th><th>Name</th><th>Role</th><th>Active</th><th>Actions</th></tr></thead><tbody>${users.map(u=>`<tr><td>${escapeHTML(u.staffId||"—")}</td><td>${escapeHTML(u.email)}</td><td>${escapeHTML(u.name||"")}</td><td>${escapeHTML(u.role||"")}</td><td>${u.active!==false?"Yes":"No"}</td><td><button type="button" class="secondary" data-edit-user-access="${escapeHTML(u.id)}">Edit</button> <button type="button" class="danger" data-delete-user-access="${escapeHTML(u.id)}">Delete</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">No staff access profiles have been added yet.</div>`;
        list.querySelectorAll("[data-edit-user-access]").forEach(b=>b.onclick=()=>{const u=users.find(x=>String(x.id)===String(b.dataset.editUserAccess));if(!u)return;document.getElementById("userAccessId").value=u.id;document.getElementById("userAccessEmail").value=u.email||"";document.getElementById("userAccessName").value=u.name||"";document.getElementById("userAccessRole").value=u.role||"owner";document.getElementById("userAccessActive").checked=u.active!==false;checks.querySelectorAll("input").forEach(c=>c.checked=(u.sections||[]).includes(c.value));focusAdminForm("userAccessForm","userAccessEmail")});
        list.querySelectorAll("[data-delete-user-access]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this staff access profile?"))return;const r=await db.from("settings").delete().eq("id",b.dataset.deleteUserAccess);if(r.error){message("User access could not be deleted: "+r.error.message,"error");return}await loadUserAccess();});
    }catch(e){list.innerHTML=`<div class="empty">User access could not be loaded: ${escapeHTML(e.message||"")}</div>`}
}
function setupUserAccess(){
    const form=document.getElementById("userAccessForm"); if(!form||form.dataset.bound)return; form.dataset.bound="1";
    form.addEventListener("submit",async e=>{e.preventDefault();const email=document.getElementById("userAccessEmail").value.trim().toLowerCase();if(!email){message("Enter a staff email address.","error");return}const role=document.getElementById("userAccessRole").value;const sections=[...document.querySelectorAll("#userAccessChecks input:checked")].map(x=>x.value);const identity=await getCurrentStaffIdentity();const editId=document.getElementById("userAccessId").value.trim();let existingProfile={};if(editId){try{const r=await db.from("settings").select("setting_value").eq("id",editId).maybeSingle();if(!r.error&&r.data?.setting_value)existingProfile=JSON.parse(r.data.setting_value||"{}")}catch(_){}}const payload={email,name:document.getElementById("userAccessName").value.trim(),role,sections:sections.length?sections:accessDefaultSections(role),active:document.getElementById("userAccessActive").checked,staffId:existingProfile.staffId||makeAprilsUniqueId("STF"),updatedAt:new Date().toISOString(),createdBy:existingProfile.createdBy||identity.staffId};try{if(editId){const r=await db.from("settings").update({setting_key:accessKey(email),setting_value:JSON.stringify(payload),updated_at:new Date().toISOString()}).eq("id",editId);if(r.error)throw r.error}else await safeSettingUpsert(accessKey(email),JSON.stringify(payload));await auditSystemEvent("admin_user_access",payload.staffId,editId?"updated":"created",{email,role});message("Staff access saved. The user must also have an account in Supabase Authentication.","success");form.reset();document.getElementById("userAccessId").value="";document.getElementById("userAccessActive").checked=true;await loadUserAccess()}catch(err){message("User access could not be saved: "+err.message,"error")}});
    document.getElementById("userAccessCancel")?.addEventListener("click",()=>{form.reset();document.getElementById("userAccessId").value="";document.getElementById("userAccessActive").checked=true});
}

// Public bridge for the commerce admin module. The invoice generator itself
// remains unchanged; checkout/inventory can open the exact same generator.
window.aprilsOpenInvoiceGenerator = openInvoiceGenerator;
window.aprilsShowSubmissionDetails = showSubmissionDetails;

/* =========================================================
   STARTUP
========================================================= */

function setupAdminAutomaticCapitalisation(){
    if(document.documentElement.dataset.adminCapitalisationBound)return;
    document.documentElement.dataset.adminCapitalisationBound="1";
    const skip=new Set(["email","url","password","tel","number","date","time","hidden"]);
    document.addEventListener("input",event=>{
        const field=event.target;
        if(!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement))return;
        if(skip.has(String(field.type||"").toLowerCase()))return;
        if(/email|url|password|phone|whatsapp|website|link/i.test(String(field.name||"")+" "+String(field.id||"")))return;
        field.value=String(field.value||"").replace(/(^|[\s\-\/\(])([a-z])/g,(_,p,c)=>p+c.toUpperCase());
    },true);
}

async function startAdmin() {
    db = await waitForSupabase();

    setupLogin();
    setupLogout();
    setupNavigation();

    setupGalleryForm();
    setupHomepageMediaForm();
    setupHomepageCollectionNameForm();
    setupTrainingForm();
    setupTestimonialForm();
    setupFAQForm();
    setupPolicyForm();
    setupContentForm();
    setupInvoiceForm();
    setupTrainingInvoicePricingForm();
    setupInvoicePaymentForm();
    setupManualInvoiceForm();
    setupUsersInvoiceForm();
    setupCollectionForm();
    setupDiscountForm();
    setupAccountingForm();
    setupWebsiteLinksForm();
    setupDirectCustomerLinks();
    setupContactForm();
    setupSocialForm();
    setupSettingsForm();
    setupLogoForm();
    setupUserAccess();
    setupAuditLog();
    document.getElementById("orderTrackingRefresh")?.addEventListener("click", () => loadOrderTracking());
    document.getElementById("traineesRefresh")?.addEventListener("click", () => loadTrainees());
    setupAdminAutomaticCapitalisation();
    if (window.setupCommerceAdmin) window.setupCommerceAdmin();

    if (!db) {
        if (hasCachedAdminSession()) {
            document.getElementById("loginScreen").style.display = "none";
            window._aprilsOfflineMode = true;
            message("Offline admin mode is active. You can still work with saved customer/invoice data on this device.", "success");
        } else {
            message("Supabase is unavailable. Log in once while online before using offline admin mode.", "error");
        }
        return;
    }

    await checkSession();
}


if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startAdmin);
} else {
    startAdmin();
}

