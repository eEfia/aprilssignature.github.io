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
    let result = await db.from(table).select("*").order("created_at", { ascending: false });
    if (result.error && /created_at/i.test(result.error.message || "")) {
        result = await db.from(table).select("*");
    }
    if (result.error) throw result.error;
    return result.data || [];
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
        ["gallery_items", ["title", "image_url", "category"]],
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

    // Settings keys are intended to be unique in practice. Clean duplicate
    // records for managed prefixes so editing an item never leaves a second copy.
    try {
        const result = await db.from("settings").select("id,setting_key,created_at,updated_at");
        if (!result.error) {
            const uniquePrefixes = ["product_","invoice_price_","site_link_","social_","homepage_featured_"];
            const groups = new Map();
            (result.data || []).forEach(row => {
                const key = String(row.setting_key || "");
                if (!uniquePrefixes.some(prefix => key.startsWith(prefix))) return;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(row);
            });
            for (const group of groups.values()) {
                if (group.length <= 1) continue;
                group.sort((a,b) => String(a.created_at || a.updated_at || "").localeCompare(String(b.created_at || b.updated_at || "")));
                const duplicateIds = group.slice(1).map(r => r.id);
                if (duplicateIds.length) await db.from("settings").delete().in("id", duplicateIds);
            }
        }
    } catch (e) { console.warn("Managed settings duplicate cleanup skipped:", e); }
}

async function checkSession() {
    if (!db) return;
    const result = await db.auth.getSession();
    const login = document.getElementById("loginScreen");
    if (!login) return;

    if (result.data.session) {
        login.style.display = "none";
        await seedInitialPublicContent();
        await cleanupExactDuplicates();
        await loadDashboard();
    } else {
        login.style.display = "flex";
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

            document.querySelectorAll(".section").forEach(section => section.classList.remove("active"));

            const id = button.dataset.section;
            const section = document.getElementById(id);
            if (section) section.classList.add("active");

            await loadSection(id);
        });
    });
}

async function loadDashboard() {
    const counters = {
        galleryCount: "gallery_items",
        trainingCount: "training_programs",
        testimonialCount: "testimonials",
        faqCount: "faqs",
        registrationCount: "training_registrations",
        quoteCount: "quote_requests",
        enquiryCount: "enquiries"
    };

    for (const id in counters) {
        const element = document.getElementById(id);
        if (element) element.textContent = await countRows(counters[id]);
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
        if (id === "invoice") await loadInvoicePricing();
        if (id === "manualInvoice") await loadSavedInvoiceReceiptRecords();
        if (id === "discounts") await loadDiscountCodes();
        if (id === "links") await loadWebsiteLinks();
        if (id === "testimonials") await loadTestimonials();
        if (id === "faq") await loadFAQs();
        if (id === "policies") await loadPolicies();
        if (id === "content") await loadContent();
        if (id === "social") await loadSocial();
        if (id === "services") { await loadServices(); await loadTraining(); }
        if (id === "contact") await loadContact();
        if (id === "settings") await loadSettings();
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

    const rows = await getRows("gallery_items");
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
                        <td>${escapeHTML((policyRank[String(row.policy_key||"").toLowerCase()] ? policyRank[String(row.policy_key||"").toLowerCase()] + ". " : "") + String(row.title || "").replace(/^\s*[1-4]\s*\.\s*/, ""))}</td>
                        <td>${escapeHTML(row.category)}</td><td>${escapeHTML(row.display_order ?? 1)}</td>
                        <td>${row.price != null && row.price !== "" ? `GHS ${Number(row.price).toFixed(2)}` : "—"}</td>
                        <td>${row.featured ? "Yes" : "No"}</td>
                        <td>${row.active ? "Yes" : "No"}</td>
                        <td>
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
    box.querySelectorAll("[data-featured-save]").forEach(b=>b.onclick=async()=>{const id=b.dataset.featuredSave;const input=box.querySelector(`[data-featured-order="${id}"]`);const key="featured_order_"+id;const r=await safeSettingUpsert(key,String(Number(input?.value)||1));if(r.error)message("Featured media order could not be saved: "+r.error.message,"error");else{message("Homepage featured order saved.","success");await loadGallery();}});
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
    const result = await db.from("gallery_items").delete().eq("id", id);
    if (result.error) {
        console.error(result.error);
        message("Gallery item could not be deleted.", "error");
        return;
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
            if (id) {
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

            form.reset();
            document.getElementById("galleryId").value = "";
            document.getElementById("galleryActive").checked = true;

            message("Gallery item saved successfully.", "success");
            await loadGallery();
            await loadDashboard();
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
    ["Streetwear","Jerseys",1],
    ["Streetwear","Hoodies",2],
    ["Streetwear","Joggers — Super Thick Cotton Joggers",3],
    ["Streetwear","Joggers — Everyday Wear Type",4],
    ["Streetwear","T-shirts",5],
    ["Streetwear","Polo Shirts",6],
    ["Streetwear","Sweatshirts",7],
    ["Streetwear","Sweatpants",8],
    ["Streetwear","Ladies Tank Tops",9],
    ["Streetwear","Men's Tank Tops",10],
    ["Streetwear","Varsity Jackets",11],
    ["Streetwear","Cargo Pants",12],
    ["Streetwear","Cargo Skirts",13],
    ["Streetwear","Jogger Shorts",14],
    ["Streetwear","Hoodies & Joggers Set",15],
    ["Streetwear","T-shirts & Shorts Set",16],
    ["Streetwear","T-shirt & Sweatpants Set",17],
    ["Streetwear","Sweatshirts & Shorts Set",18],
    ["Streetwear","Sweatshirts & Sweatpants Set",19]
];

function productKeyFromName(name) {
    return "product_" + String(name || "").toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
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
    return result;
}

async function seedDefaultProducts() {
    try {
        const marker = await db.from("settings").select("id").eq("setting_key","products_catalogue_seeded").limit(1);
        if (marker.error) return;
        if (marker.data?.length) return;
        for (const [category,name,order] of DEFAULT_PRODUCTS) {
            const key = productKeyFromName(name);
            const existing = await db.from("settings").select("id").eq("setting_key",key).limit(1);
            if (existing.error || existing.data?.length) continue;
            await db.from("settings").insert({
                setting_key:key,
                setting_value:JSON.stringify({name,category,price:null,notes:"",display_order:order,active:true}),
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

async function loadProducts() {
    const list=document.getElementById("adminProductsList"); if(!list)return;
    const rows=await getProducts();
    const settings=await getRows("settings"); const invoiceMap=new Map();
    settings.filter(r=>String(r.setting_key||"").startsWith("invoice_price_")).forEach(r=>{try{const x=JSON.parse(r.setting_value||"{}");if(x.name)invoiceMap.set(String(x.name).trim().toLowerCase(),x);}catch(_){}});
    rows.sort((a,b)=>Number(a.display_order||9999)-Number(b.display_order||9999));
    list.innerHTML=rows.length?`<table><thead><tr><th>Product / Service</th><th>Category</th><th>Public Price (GHS)</th><th>Invoice Price (GHS)</th><th>Order</th><th>Active</th><th>Actions</th></tr></thead><tbody>${rows.map(r=>{const i=invoiceMap.get(String(r.name||"").trim().toLowerCase());return `<tr><td>${escapeHTML(r.name)}</td><td>${escapeHTML(r.category||"")}</td><td>${r.public_price!==undefined && r.public_price!==null && r.public_price!==""?`GHS ${Number(r.public_price).toFixed(2)}`:"—"}</td><td>${i?.price!==undefined?`GHS ${Number(i.price).toFixed(2)}`:"—"}</td><td>${escapeHTML(r.display_order??1)}</td><td>${r.active!==false?"Yes":"No"}</td><td><button type="button" class="secondary" data-edit-product="${escapeHTML(r.id)}">Edit</button> <button type="button" class="danger" data-delete-product="${escapeHTML(r.id)}">Delete</button></td></tr>`;}).join("")}</tbody></table>`:`<div class="empty">No products / services have been added yet.</div>`;
    list.querySelectorAll("[data-edit-product]").forEach(b=>b.onclick=()=>{const r=rows.find(x=>String(x.id)===String(b.dataset.editProduct));if(!r)return;const i=invoiceMap.get(String(r.name||"").trim().toLowerCase());document.getElementById("adminProductId").value=r.id;document.getElementById("adminProductTitle").value=r.name||"";document.getElementById("adminProductCategory").value=r.category||"Streetwear";document.getElementById("adminProductPublicPrice").value=r.public_price??""; document.getElementById("adminProductInvoicePrice").value=i?.price??"";document.getElementById("adminProductOrder").value=r.display_order??1;document.getElementById("adminProductNotes").value=i?.notes||r.notes||"";document.getElementById("adminProductActive").checked=r.active!==false;document.getElementById("services").scrollIntoView({behavior:"smooth",block:"start"});});
    list.querySelectorAll("[data-delete-product]").forEach(b=>b.onclick=async()=>{const r=rows.find(x=>String(x.id)===String(b.dataset.deleteProduct));if(!r||!confirm(`Delete "${r.name}"?`))return;const q=await db.from("settings").delete().eq("id",b.dataset.deleteProduct);if(q.error){message("Product / service could not be deleted: "+q.error.message,"error");return;}await db.from("settings").delete().eq("setting_key",invoiceStorageKey(r.name));message("Product / service deleted.","success");await loadProducts();});
}

function setupProductForm() {
    const form = document.getElementById("adminProductForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const id = document.getElementById("adminProductId").value.trim();
        const name = document.getElementById("adminProductTitle").value.trim();
        const category = document.getElementById("adminProductCategory").value.trim();
        const publicPriceValue = document.getElementById("adminProductPublicPrice").value;
        const invoicePriceValue = document.getElementById("adminProductInvoicePrice").value;
        const publicPrice = publicPriceValue === "" ? null : Number(publicPriceValue);
        const invoicePrice = invoicePriceValue === "" ? null : Number(invoicePriceValue);
        const payload = {
            name,
            category,
            public_price: publicPrice,
            notes: document.getElementById("adminProductNotes").value.trim(),
            display_order: Number(document.getElementById("adminProductOrder").value) || 1,
            active: document.getElementById("adminProductActive").checked
        };

        if (!name) {
            message("Please enter a product name.", "error");
            return;
        }

        try {
            let oldKey = "";
            let oldName = "";

            if (id) {
                const old = await db.from("settings").select("setting_key,setting_value").eq("id", id).maybeSingle();
                if (old.error) throw old.error;
                oldKey = old.data?.setting_key || "";
                try {
                    const oldItem = JSON.parse(old.data?.setting_value || "{}");
                    oldName = oldItem.name || "";
                } catch (_) {}
            }

            const newKey = productKeyFromName(name);
            const sameKeyRows = await db.from("settings").select("id").eq("setting_key", newKey);
            if (sameKeyRows.error) throw sameKeyRows.error;
            const conflicting = (sameKeyRows.data || []).some(r => String(r.id) !== String(id));
            if (conflicting) {
                message("A product with that name already exists. Edit the existing product instead.", "error");
                return;
            }

            if (id && oldKey === newKey) {
                const updated = await db.from("settings")
                    .update({setting_value: JSON.stringify(payload), updated_at: new Date().toISOString()})
                    .eq("id", id);
                if (updated.error) throw updated.error;

                const duplicateRows = await db.from("settings").select("id").eq("setting_key", newKey);
                if (!duplicateRows.error) {
                    const duplicateIds = (duplicateRows.data || [])
                        .map(r => r.id)
                        .filter(rowId => String(rowId) !== String(id));
                    if (duplicateIds.length) await db.from("settings").delete().in("id", duplicateIds);
                }
            } else {
                await safeSettingUpsert(newKey, JSON.stringify(payload));
                if (oldKey && oldKey !== newKey) {
                    const oldDelete = await db.from("settings").delete().eq("id", id);
                    if (oldDelete.error) throw oldDelete.error;
                }
            }

            if (oldName && oldName.toLowerCase() !== name.toLowerCase()) {
                await db.from("settings").delete().eq("setting_key", invoiceStorageKey(oldName));
            }

            const invoiceKey = invoiceStorageKey(name);
            if (invoicePrice === null) {
                await db.from("settings").delete().eq("setting_key", invoiceKey);
            } else {
                await safeSettingUpsert(
                    invoiceKey,
                    JSON.stringify({
                        name,
                        category,
                        price: invoicePrice,
                        notes: payload.notes,
                        active: payload.active
                    })
                );
            }

            form.reset();
            document.getElementById("adminProductId").value = "";
            document.getElementById("adminProductActive").checked = true;
            document.getElementById("adminProductOrder").value = 1;
            message("Product saved successfully.", "success");
            await loadProducts();
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
                    <td>${escapeHTML(r.order ?? 1)}</td>
                    <td>${r.active === false ? "Hidden" : "Visible"}</td>
                    <td>
                        <button type="button" class="secondary" data-edit-homepage="${escapeHTML(r.id)}">Edit</button>
                        <button type="button" class="danger" data-delete-homepage="${escapeHTML(r.id)}">Delete</button>
                    </td>
                </tr>`).join("")}
            </tbody>
        </table>
    ` : `<div class="empty">No homepage featured media has been added yet.</div>`;

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
        order: new URL("../quotes.html#quoteForm", window.location.href).href,
        training: new URL("../training.html#training-registration-form", window.location.href).href,
        gallery: new URL("../gallery.html", window.location.href).href,
        contact: new URL("../contact.html", window.location.href).href,
        policies: new URL("../policies.html", window.location.href).href,
        discount: new URL("../redeem.html", window.location.href).href
    };

    const labels = {
        website: "Main Website",
        order: "Order / Request a Quote",
        training: "Training Registration",
        gallery: "Gallery",
        contact: "Contact",
        policies: "Policies & Terms",
        discount: "Discount Redemption"
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
            const url = links[button.dataset.copyDirectLink];
            if (!url) return;
            try {
                await navigator.clipboard.writeText(url);
                message("Link copied. You can send it to the customer.", "success");
            } catch (_) {
                window.prompt("Copy this direct link:", url);
            }
        };
    });

    document.querySelectorAll("[data-share-direct-link]").forEach(button => {
        button.onclick = async () => {
            const url = links[button.dataset.shareDirectLink];
            if (!url) return;
            const title = labels[button.dataset.shareDirectLink] || "Aprils Signature";
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
        "t shirt": ["t shirts", "t shirt"],
        "t shirts": ["t shirts", "t shirt"],
        "hoodies joggers set": ["hoodies joggers set"],
        "joggers super thick cotton joggers": ["joggers super thick cutting joggers", "joggers super thick cotton joggers"],
        "t shirt shorts set": ["t shirts shorts set", "t shirt shorts set"],
        "t shirt sweatpants set": ["t shirt sweatpants set"]
    };
    for (const alias of (aliases[normalized] || [])) {
        if (map.has(alias)) return map.get(alias) ?? 0;
    }
    return 0;
}

function buildInvoiceLinesFromQuote(row, details, priceMap) {
    if (Array.isArray(details?.manualLines)) {
        return details.manualLines.map(line => ({
            description: String(line.description || "").trim(),
            quantity: Math.max(1, Number(line.quantity || 1)),
            unitPrice: Number(line.unitPrice || 0),
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
                details: [item.size, item.measurements, item.colour].filter(Boolean).join(" • ")
            });
        });
    }

    const simpleLines = [
        ["Ladies Wear", details?.ladiesWearQuantity, details?.ladiesWear, details?.ladiesWearSize, details?.ladiesWearColour],
        ["Kids Wear", details?.kidsWearQuantity, details?.kidsWear, details?.kidsWearSize, details?.kidsWearColour]
    ];
    simpleLines.forEach(([name, qty, request, size, colour]) => {
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

    if (Array.isArray(details?.embellishment)) {
        details.embellishment.forEach(serviceName => {
            const item = details.embellishmentDetails?.[serviceName] || {};
            const legacyQuantity = Number(details.embellishmentQuantity || 0);
            const quantity = Number(item.quantity || 0) || legacyQuantity;
            if (quantity <= 0 && !item.details && !details.embellishmentOther) return;
            lines.push({
                description: serviceName,
                quantity: quantity || 1,
                unitPrice: invoicePriceFor(priceMap, serviceName),
                details: [item.size || details.embellishmentSize, item.measurements, item.colour, item.details || details.embellishmentOther].filter(Boolean).join(" • ")
            });
        });
    }

    if (details?.training) {
        lines.push({
            description: "Practical Fashion Training",
            quantity: 1,
            unitPrice: invoicePriceFor(priceMap, "Training - Practical Fashion Training") || invoicePriceFor(priceMap, "Practical Fashion Training"),
            details: details.training
        });
    }

    return lines;
}


function invoicePaymentStorageKey(invoiceNumber, stamp) {
    return "invoice_payment_record_" + contentSlug(invoiceNumber) + "_" + String(stamp || Date.now());
}

async function getInvoicePayments(invoiceNumber) {
    const rows = await getRows("settings");
    return rows
        .filter(r => String(r.setting_key || "").startsWith("invoice_payment_record_"))
        .map(r => {
            try { return { ...JSON.parse(r.setting_value || "{}"), id: r.id, key: r.setting_key }; }
            catch (_) { return null; }
        })
        .filter(r => r && String(r.invoiceNumber || "") === String(invoiceNumber || ""))
        .sort((a,b) => String(a.date || "").localeCompare(String(b.date || "")));
}

async function saveInvoicePayment(payment) {
    const key = invoicePaymentStorageKey(payment.invoiceNumber, Date.now());
    return safeSettingUpsert(key, JSON.stringify(payment));
}

async function getInvoiceSavedRecord(invoiceNumber) {
    try {
        const row = await getSettingValue("invoice_record_" + contentSlug(invoiceNumber));
        if (!row?.setting_value) return null;
        return JSON.parse(row.setting_value);
    } catch (_) { return null; }
}

async function saveInvoiceRecord(invoiceNumber, record) {
    return safeSettingUpsert("invoice_record_" + contentSlug(invoiceNumber), JSON.stringify(record));
}


async function loadSavedInvoiceReceiptRecords() {
    const list = document.getElementById("savedInvoiceReceiptList");
    if (!list) return;

    try {
        const rows = await getRows("settings");
        const invoices = rows.filter(r => String(r.setting_key || "").startsWith("invoice_record_")).map(r => {
            try { return {type:"Invoice", id:r.id, key:r.setting_key, ...JSON.parse(r.setting_value || "{}")}; } catch (_) { return null; }
        }).filter(Boolean);
        const receipts = rows.filter(r => String(r.setting_key || "").startsWith("receipt_record_")).map(r => {
            try { return {type:"Receipt", id:r.id, key:r.setting_key, ...JSON.parse(r.setting_value || "{}")}; } catch (_) { return null; }
        }).filter(Boolean);

        const records = [...invoices, ...receipts].sort((a,b) => String(b.savedAt || b.date || "").localeCompare(String(a.savedAt || a.date || "")));

        list.innerHTML = records.length ? `
            <table>
                <thead><tr><th>Type</th><th>Number</th><th>Date</th><th>Customer</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                ${records.map(r => {
                    const amount = r.type === "Receipt" ? Number(r.amount || 0) : Number(r.total || 0);
                    const status = r.type === "Receipt" ? "Payment recorded" : (r.training ? "Training • Full payment" : "Invoice saved");
                    return `<tr>
                        <td>${escapeHTML(r.type)}</td>
                        <td>${escapeHTML(r.invoiceNumber || r.receiptNumber || "")}</td>
                        <td>${escapeHTML(r.date || "")}</td>
                        <td>${escapeHTML(r.customer || r.full_name || "")}</td>
                        <td>GHS ${amount.toFixed(2)}</td>
                        <td>${escapeHTML(status)}</td>
                        <td>
                            ${r.type === "Invoice" ? `<button type="button" class="secondary" data-open-saved-invoice="${escapeHTML(r.key)}">Edit / Open</button>` : ""}
                            <button type="button" class="danger" data-delete-saved-record="${escapeHTML(r.id)}" data-record-type="${escapeHTML(r.type)}" data-record-key="${escapeHTML(r.key)}" data-record-number="${escapeHTML(r.invoiceNumber || r.receiptNumber || "")}">Delete</button>
                        </td>
                    </tr>`;
                }).join("")}
                </tbody>
            </table>` : `<div class="empty">No saved invoices or receipts yet.</div>`;

        list.querySelectorAll("[data-open-saved-invoice]").forEach(button => {
            button.onclick = async () => {
                const row = records.find(r => r.key === button.dataset.openSavedInvoice);
                if (!row) return;
                const customerRow = {
                    full_name: row.customer || "",
                    phone: row.phone || "",
                    whatsapp: row.phone || "",
                    email: row.email || "",
                    location: row.address || ""
                };
                await openInvoiceGenerator(customerRow, {
                    manualLines: row.lines || [],
                    notes: row.notes || "",
                    training: !!row.training,
                    invoiceNumber: row.invoiceNumber
                });
            };
        });

        list.querySelectorAll("[data-delete-saved-record]").forEach(button => {
            button.onclick = async () => {
                const type = button.dataset.recordType;
                const number = button.dataset.recordNumber;
                if (!confirm(`Delete this saved ${type.toLowerCase()}${number ? ` ${number}` : ""}?`)) return;
                try {
                    const result = await db.from("settings").delete().eq("id", button.dataset.deleteSavedRecord);
                    if (result.error) throw result.error;

                    if (type === "Invoice" && number) {
                        const paymentRows = await getRows("settings");
                        const ids = paymentRows.filter(r => String(r.setting_key || "").startsWith("invoice_payment_record_"))
                            .filter(r => {
                                try { return String(JSON.parse(r.setting_value || "{}").invoiceNumber || "") === String(number); }
                                catch (_) { return false; }
                            }).map(r => r.id);
                        if (ids.length) await db.from("settings").delete().in("id", ids);
                    }

                    if (type === "Receipt" && number) {
                        const paymentRows = await getRows("settings");
                        const ids = paymentRows.filter(r => String(r.setting_key || "").startsWith("invoice_payment_record_"))
                            .filter(r => {
                                try { return String(JSON.parse(r.setting_value || "{}").receiptNumber || "") === String(number); }
                                catch (_) { return false; }
                            }).map(r => r.id);
                        if (ids.length) await db.from("settings").delete().in("id", ids);
                    }

                    message(`${type} deleted.`, "success");
                    await loadSavedInvoiceReceiptRecords();
                } catch (error) {
                    message(`${type} could not be deleted: ${error.message}`, "error");
                }
            };
        });
    } catch (error) {
        console.error("Saved invoice/receipt records could not load:", error);
        list.innerHTML = `<div class="empty">Saved invoice and receipt records could not be loaded.</div>`;
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
    const detailsLines = buildInvoiceLinesFromQuote(row, details, priceMap);
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
            <div class="form-group"><label>Invoice Notes</label><textarea id="generatedInvoiceNotes">${escapeHTML(details?.notes || "Thank you for choosing Aprils Signature.")}</textarea></div>
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
                    ${isTrainingInvoice ? "" : `<p>Payment Due (${depositPercent}%): <strong>GHS ${deposit.toFixed(2)}</strong></p>
                    <p>Amount Paid: <strong>GHS ${paidAmount.toFixed(2)}</strong></p>
                    <p>Balance: <strong>GHS ${outstanding.toFixed(2)}</strong></p>`}
                    <p class="invoice-payment-status"><strong>${paymentStatus}</strong></p>
                </div>
                <div class="invoice-payment"><strong>Payment Details</strong>
                    ${paymentAccounts.map((item,index)=>`<div style="margin-top:10px;padding-top:8px;border-top:${index ? "1px solid #ccc" : "0"};">
                        <strong>${escapeHTML(item.network || "")} ${escapeHTML(item.number || "")}</strong><br>
                        ${escapeHTML(item.name || "")}<br>
                        <div class="invoice-payment-note" style="margin-top:6px;font-weight:700;border-left:4px solid #c9a227;padding:7px 10px;">
                            *** Payment Note ***<br>${escapeHTML(item.note || "")}
                        </div>
                    </div>`).join("")}
                </div>
                <div class="invoice-note">${escapeHTML(document.getElementById("generatedInvoiceNotes").value)}</div>
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
            <div class="form-group"><label>Discount (%)</label><input id="generatedInvoiceDiscountPercent" type="number" min="0" max="100" step="0.01" value="${Number(discountOffer?.percent || 0)}"></div>
        </div>
        <button type="button" class="secondary" id="invoiceAddLine">+ Add Line</button>
    `;
    editor.appendChild(lineEditor);

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
    ["input","change"].forEach(evt => modal.addEventListener(evt, renderInvoice));
    renderInvoice();

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

    window._aprilsCurrentInvoice = { modal, preview, renderInvoice, row, details, paymentAccounts, savedPayments, discountOffer, isTrainingInvoice };
}


async function statefulSaveGeneratedInvoice(row, details, savedPayments) {
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
    const record = {
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
        savedAt: new Date().toISOString()
    };
    await saveInvoiceRecord(invoiceNumber, record);
    if (state.discountOffer?.redemptionId) {
        try { await db.from("discount_redemptions").update({status:"used"}).eq("id", state.discountOffer.redemptionId); } catch (_) {}
    }
    message("Invoice " + invoiceNumber + " saved.", "success");
    await loadSavedInvoiceReceiptRecords();
}
function closeInvoiceGenerator() {
    document.getElementById("invoiceGeneratorBackdrop")?.remove();
    document.getElementById("invoiceGeneratorModal")?.remove();
    window._aprilsCurrentInvoice = null;
}

async function generateInvoicePdf(share) {
    const state = window._aprilsCurrentInvoice;
    if (!state) return false;
    state.renderInvoice();
    const paper = document.getElementById("invoicePaper");
    if (!paper) return false;

    if (!window.html2pdf) {
        printGeneratedInvoice();
        message("PDF library is unavailable, so the invoice has been opened in print view. Choose Save as PDF there.", "success");
        return false;
    }

    try {
        const options = {
            margin: 0.35,
            filename: (document.getElementById("generatedInvoiceNumber").value || "Aprils-Signature-Invoice") + ".pdf",
            image: {type:"jpeg",quality:0.98},
            html2canvas: {scale:2, useCORS:true},
            jsPDF: {unit:"in", format:"a4", orientation:"portrait"}
        };
        const worker = window.html2pdf().set(options).from(paper);
        if (share && navigator.share && navigator.canShare) {
            const blob = await worker.outputPdf("blob");
            const file = new File([blob], options.filename, {type:"application/pdf"});
            if (navigator.canShare({files:[file]})) {
                await navigator.share({title:options.filename, text:"Aprils Signature Invoice", files:[file]});
                return true;
            }
        }
        await worker.save();
        if (share) message("PDF saved. If your device supports file sharing, use the PDF's Share option to send it through WhatsApp or another app.", "success");
        return false;
    } catch (error) {
        console.error(error);
        message("The PDF could not be created. Use Print and choose Save as PDF.", "error");
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

async function shareGeneratedInvoiceWhatsApp() {
    try {
        const sharedFile = await generateInvoicePdf(true);
        if (!sharedFile) {
            const text = encodeURIComponent(getGeneratedInvoiceShareText());
            window.open("https://wa.me/?text=" + text, "_blank", "noopener,noreferrer");
        }
    } catch (_) {
        const text = encodeURIComponent(getGeneratedInvoiceShareText());
        window.open("https://wa.me/?text=" + text, "_blank", "noopener,noreferrer");
    }
}

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
        body{font-family:Arial,sans-serif;padding:25px;color:#222}.invoice-paper{max-width:800px;margin:auto}.invoice-brand-row{display:flex;align-items:center;gap:15px;border-bottom:3px solid #0f7775;padding-bottom:15px}.invoice-brand-row img{width:85px;height:85px;object-fit:contain}.invoice-brand-row h1{color:#0f7775;margin:0}.invoice-meta{margin-left:auto;text-align:right}.invoice-lines{width:100%;border-collapse:collapse;margin-top:25px}.invoice-lines th,.invoice-lines td{border:1px solid #777;padding:8px;text-align:left}.invoice-lines th{background:#0f7775;color:#fff}.invoice-summary{margin-left:auto;max-width:300px;margin-top:20px}.invoice-payment,.invoice-note{margin-top:20px;padding:12px;border:1px solid #aaa}</style></head><body>${paper.outerHTML}</body></html>`);
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
    return { total, paidDue: total * depositPercent / 100, balance: total * (1 - depositPercent / 100), lines };
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
                    <p>Invoice Total: <strong>GHS ${totals.total.toFixed(2)}</strong></p>
                    <p>Amount Received: <strong>GHS ${amount.toFixed(2)}</strong></p>
                    <p>Balance Remaining: <strong>GHS ${remaining.toFixed(2)}</strong></p>
                </div>
                <div class="receipt-note"><strong>Note</strong><br>${escapeHTML(document.getElementById("generatedReceiptNote").value)}</div>
                <div class="receipt-footer">Aprils Signature • Elegance in Every Stitch<br>This receipt confirms the payment recorded above.</div>
            </div>
        `;
    }

    ["input","change"].forEach(evt => modal.addEventListener(evt, renderReceipt));
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
                    method: document.getElementById("generatedReceiptMethod")?.value || "",
                    reference: document.getElementById("generatedReceiptReference")?.value || "",
                    date: document.getElementById("generatedReceiptDate")?.value || new Date().toISOString().slice(0,10),
                    savedAt: new Date().toISOString()
                })
            );
            const latest = await getInvoicePayments(document.getElementById("generatedReceiptInvoiceNumber")?.value || "");
            if (invoiceState) {
                invoiceState.savedPayments = latest;
                try {
                    const record = invoiceState.row || {};
                    if (record.id) {
                        await setAdminRecordStatus(record.course ? "training_status" : "quote_status", record.id, "payment_received");
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
    if (!window.html2pdf) {
        printGeneratedReceipt();
        message("PDF library is unavailable, so the receipt has been opened in print view. Choose Save as PDF there.", "success");
        return false;
    }
    try {
        const options = {
            margin: 0.35,
            filename: (document.getElementById("generatedReceiptNumber").value || "Aprils-Signature-Receipt") + ".pdf",
            image: {type:"jpeg",quality:0.98},
            html2canvas: {scale:2,useCORS:true},
            jsPDF: {unit:"in",format:"a4",orientation:"portrait"}
        };
        const worker = window.html2pdf().set(options).from(paper);
        if (share && navigator.share && navigator.canShare) {
            const blob = await worker.outputPdf("blob");
            const file = new File([blob], options.filename, {type:"application/pdf"});
            if (navigator.canShare({files:[file]})) {
                await navigator.share({title:options.filename,text:"Aprils Signature Payment Receipt",files:[file]});
                return true;
            }
        }
        await worker.save();
        if (share) message("Receipt PDF saved. You can use the PDF's Share option to send it through WhatsApp or another app.", "success");
        return false;
    } catch (error) {
        console.error(error);
        message("The receipt PDF could not be created. Use Print and choose Save as PDF.", "error");
        return false;
    }
}

function getGeneratedReceiptShareText() {
    const state = window._aprilsCurrentReceipt;
    if (!state) return "";
    state.renderReceipt();
    return `Aprils Signature Payment Receipt ${document.getElementById("generatedReceiptNumber")?.value || ""}\nCustomer: ${document.getElementById("generatedReceiptCustomer")?.value || ""}\nAmount Received: GHS ${Number(document.getElementById("generatedReceiptAmount")?.value || 0).toFixed(2)}\nInvoice: ${document.getElementById("generatedReceiptInvoiceNumber")?.value || ""}\nPlease see the attached receipt PDF for the full details.`;
}

async function shareGeneratedReceiptWhatsApp() {
    try {
        const sharedFile = await generateReceiptPdf(true);
        if (!sharedFile) {
            window.open("https://wa.me/?text=" + encodeURIComponent(getGeneratedReceiptShareText()), "_blank", "noopener,noreferrer");
        }
    } catch (_) {
        window.open("https://wa.me/?text=" + encodeURIComponent(getGeneratedReceiptShareText()), "_blank", "noopener,noreferrer");
    }
}

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
        body{font-family:Arial,sans-serif;padding:25px;color:#222}.receipt-paper{max-width:800px;margin:auto}.receipt-brand-row{display:flex;align-items:center;gap:15px;border-bottom:3px solid #0f7775;padding-bottom:15px}.receipt-brand-row img{width:85px;height:85px;object-fit:contain}.receipt-brand-row h1{color:#0f7775;margin:0}.receipt-meta{margin-left:auto;text-align:right}.receipt-status{margin:25px 0;padding:12px;text-align:center;border:2px solid #0f7775;font-weight:bold;color:#0f7775}.receipt-customer{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:15px;border:1px solid #aaa}.receipt-lines{width:100%;border-collapse:collapse;margin-top:25px}.receipt-lines th,.receipt-lines td{border:1px solid #777;padding:9px;text-align:left}.receipt-lines th{background:#0f7775;color:#fff}.receipt-lines small{display:block;margin-top:4px;color:#555}.receipt-summary{margin-left:auto;max-width:320px;margin-top:20px;text-align:right}.receipt-note{margin-top:20px;padding:12px;border:1px solid #aaa}.receipt-footer{text-align:center;margin-top:35px;color:#555;font-size:12px}</style></head><body>${paper.outerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
}

/* =========================================================
   END MANUAL INVOICE GENERATOR
========================================================= */

async function loadServices() {
    const section = document.getElementById("services");
    if (!section) return;
    section.innerHTML = `
        <h2>Products / Services &amp; Training</h2>
        <p class="intro">Manage the products/services visitors can choose and the training programmes. Public prices are optional and appear on the public website when entered. Invoice prices are separate and remain admin-only.</p>
        <div class="form-card">
            <h3 style="color:#008c95;margin-bottom:10px;">Products / Services</h3>
            <p class="intro">Add, edit, delete, rename and reorder the product/service choices used by the public request form.</p>
            <form id="adminProductForm">
                <input type="hidden" id="adminProductId">
                <div class="form-grid">
                    <div class="form-group"><label>Product / Service Name</label><input type="text" id="adminProductTitle" required placeholder="e.g. Custom Hoodie"></div>
                    <div class="form-group"><label>Category</label><select id="adminProductCategory">
<option>Streetwear</option>
<option>Ladies Wear</option>
<option>Kids Wear</option>
<option>Embellishment Services</option>
<option>Rhinestone Embellishment</option>
<option>Screen Printing</option>
<option>Fabric Painting</option>
<option>Glitter Works</option>
<option>Other Products</option>
</select></div>
                    <div class="form-group"><label>Public Price (GHS)</label><input type="number" id="adminProductPublicPrice" min="0" step="0.01" placeholder="Optional public price"></div>
                    <div class="form-group"><label>Invoice Price (GHS) — Internal Only</label><input type="number" id="adminProductInvoicePrice" min="0" step="0.01" placeholder="Optional invoice rate"></div>
                    <div class="form-group"><label>Display Order</label><input type="number" id="adminProductOrder" min="1" value="1"></div>
                </div>
                <div class="form-group"><label>Notes</label><textarea id="adminProductNotes" rows="4" placeholder="Optional internal note."></textarea></div>
                <label class="checkbox"><input type="checkbox" id="adminProductActive" checked> Active / Available for selection</label><br>
                <button class="primary" type="submit">Save Product / Service</button>
                <button class="secondary" type="button" id="adminProductCancel">Cancel</button>
            </form>
        </div>
        <div id="adminProductsList" class="table-wrap"></div>
        <div class="form-card" style="margin-top:20px;">
            <h3 style="color:#008c95;margin-bottom:10px;">Training</h3>
            <p class="intro">Add, edit, delete and price training programmes. Public prices are optional and will appear on the public Training page when entered. Invoice prices are separate and admin-only.</p>
            <form id="trainingForm">
                <input type="hidden" id="trainingId">
                <div class="form-grid">
                    <div class="form-group"><label>Programme Name</label><input id="trainingTitle" required></div>
                    <div class="form-group"><label>Duration</label><input id="trainingDuration"></div>
                    <div class="form-group"><label>Public Price (GHS)</label><input id="trainingPublicPrice" type="number" min="0" step="0.01" placeholder="Optional public price"></div>
                    <div class="form-group"><label>Invoice Price (GHS) — Internal Only</label><input id="trainingPrice" type="number" min="0" step="0.01" placeholder="Optional invoice rate"></div>
                    <div class="form-group"><label>Category</label><input id="trainingCategory"></div>
                </div>
                <div class="form-group"><label>Description</label><textarea id="trainingDescription"></textarea></div>
                <label class="checkbox"><input type="checkbox" id="trainingActive" checked> Active</label><br>
                <button class="primary" type="submit">Save Training Programme</button>
                <button type="button" class="secondary" id="trainingCancel">Cancel</button>
            </form>
        </div>
        <div id="trainingList" class="table-wrap"></div>`;
    await loadProducts(); setupProductForm(); await loadTraining(); setupTrainingForm();
}

async function loadTraining() {
    const list=document.getElementById("trainingList"); if(!list)return;
    const rows=await getRows("training_programs"); const settings=await getRows("settings"); const invoiceMap=new Map(); const publicMap=new Map();
    settings.filter(r=>String(r.setting_key||"").startsWith("invoice_price_")).forEach(r=>{try{const x=JSON.parse(r.setting_value||"{}");if(x.name)invoiceMap.set(String(x.name).trim().toLowerCase(),x);}catch(_){}});
    settings.filter(r=>String(r.setting_key||"").startsWith("public_training_price_")).forEach(r=>{try{const x=JSON.parse(r.setting_value||"{}");if(x.name)publicMap.set(String(x.name).trim().toLowerCase(),x);}catch(_){}});
    rows.sort((a,b)=>String(a.category||"").localeCompare(String(b.category||""))||String(a.title||"").localeCompare(String(b.title||"")));
    list.innerHTML=rows.length?`<table><thead><tr><th>Programme</th><th>Duration</th><th>Category</th><th>Public Price (GHS)</th><th>Invoice Price (GHS)</th><th>Active</th><th>Actions</th></tr></thead><tbody>${rows.map(r=>{const i=invoiceMap.get(("Training - "+String(r.title||"")).toLowerCase()); const p=publicMap.get(String(r.title||"").trim().toLowerCase()); return `<tr><td>${escapeHTML(r.title)}</td><td>${escapeHTML(r.duration||"")}</td><td>${escapeHTML(r.category||"")}</td><td>${p?.price!==undefined?`GHS ${Number(p.price).toFixed(2)}`:"—"}</td><td>${i?.price!==undefined?`GHS ${Number(i.price).toFixed(2)}`:"—"}</td><td>${r.active!==false?"Yes":"No"}</td><td><button type="button" class="secondary" data-edit-training="${escapeHTML(r.id)}">Edit</button> <button type="button" class="danger" data-delete-training="${escapeHTML(r.id)}">Delete</button></td></tr>`;}).join("")}</tbody></table>`:`<div class="empty">No training programmes have been added yet.</div>`;
    list.querySelectorAll("[data-edit-training]").forEach(b=>b.onclick=()=>{const r=rows.find(x=>String(x.id)===String(b.dataset.editTraining));if(!r)return;const i=invoiceMap.get(("Training - "+String(r.title||"")).toLowerCase()); const p=publicMap.get(String(r.title||"").trim().toLowerCase()); document.getElementById("trainingId").value=r.id;document.getElementById("trainingTitle").value=r.title||"";document.getElementById("trainingDuration").value=r.duration||"";document.getElementById("trainingPublicPrice").value=p?.price??""; document.getElementById("trainingPrice").value=i?.price??"";document.getElementById("trainingCategory").value=r.category||"";document.getElementById("trainingDescription").value=r.description||"";document.getElementById("trainingActive").checked=r.active!==false;document.getElementById("trainingForm").scrollIntoView({behavior:"smooth",block:"start"});});
    list.querySelectorAll("[data-delete-training]").forEach(b=>b.onclick=async()=>{const r=rows.find(x=>String(x.id)===String(b.dataset.deleteTraining));if(!r||!confirm(`Delete "${r.title}"?`))return;const q=await db.from("training_programs").delete().eq("id",b.dataset.deleteTraining);if(q.error){message("Training programme could not be deleted: "+q.error.message,"error");return;}await db.from("settings").delete().eq("setting_key",invoiceStorageKey("Training - "+r.title));message("Training programme deleted.","success");await loadTraining();await loadDashboard();});
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
        hoodiesJoggersSet: "Hoodies & Joggers Set",
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
    if (row.created_at) add("Submitted", new Date(row.created_at).toLocaleString());

    const selected = Array.isArray(details.selectedServices)
        ? details.selectedServices
        : String(row.service || "").split(",").map(v => v.trim()).filter(Boolean);

    add("Selected Services", selected.join(", "));

    if (selected.includes("Streetwear")) {
        add("Streetwear Size (UK) / Measurements", details.streetwearSizeMeasurements);
        add("Streetwear Colour (S)", details.streetwearColour);
    }

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
        add("Ladies Wear Quantity", details.ladiesWearQuantity);
        add("Ladies Wear Details / Style Request", details.ladiesWear);
    }

    if (selected.includes("Kids Wear")) {
        add("Kids Wear Size (UK) / Age", details.kidsWearSize);
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
            add(`${serviceName} — Measurements`, item.measurements);
            add(`${serviceName} — Colour`, item.colour);
            add(`${serviceName} — Quantity`, item.quantity || details.embellishmentQuantity);
            add(`${serviceName} — Details / Style Request`, item.details || details.embellishmentOther);
        });
    }

    if (details.training) add("Training Request", details.training);
    add("Other Service Request", details.serviceOther);
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
            lines.push(`${formatDetailLabel(key)}: ${key === "created_at" && value ? new Date(value).toLocaleString() : value}`);
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

function showSubmissionDetails(title, row, detailsText = "", uploads = []) {
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
    const details = parseSubmissionDetails(detailsText);
    const isQuote = /quote|order/i.test(title);
    let rows;

    if (isQuote) {
        rows = buildQuoteDetailRows(row || {}, details);
    } else {
        rows = Object.entries(row || {})
            .filter(([key]) => !["id", "journey", "request_details", "details", "message", "uploads"].includes(key))
            .map(([key, value]) => ({
                label: formatDetailLabel(key),
                value: key === "created_at" && value ? new Date(value).toLocaleString() : (value ?? "—")
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
                ${isQuote ? '<button type="button" class="primary" id="generateInvoiceFromOrder">Generate Invoice</button>' : ''}
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
        openInvoiceGenerator(row || {}, details);
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


const ADMIN_STATUS_OPTIONS = [
    ["request_received", "Request Received"],
    ["reviewed", "Reviewed"],
    ["invoice_sent", "Invoice Sent"],
    ["payment_received", "Payment Received"],
    ["work_in_progress", "Work in Progress"],
    ["completed", "Completed"],
    ["delivered", "Delivered"]
];

async function getAdminRecordStatus(prefix, id) {
    try {
        const row = await getSettingValue(prefix + "_" + id);
        return row?.setting_value || "request_received";
    } catch (_) { return "request_received"; }
}

async function setAdminRecordStatus(prefix, id, status) {
    return safeSettingUpsert(prefix + "_" + id, status);
}

function statusSelectHTML(prefix, id, value) {
    return `<select class="admin-status-select" data-status-prefix="${escapeHTML(prefix)}" data-status-id="${escapeHTML(id)}">
        ${ADMIN_STATUS_OPTIONS.map(([key,label]) => `<option value="${key}" ${key === value ? "selected" : ""}>${label}</option>`).join("")}
    </select>`;
}

async function loadRegistrations() {
    const rows = await getRows("training_registrations");
    const list = document.getElementById("registrationList");
    if (!list) return;

    const statuses = new Map();
    for (const row of rows) statuses.set(String(row.id), await getAdminRecordStatus("training_status", row.id));

    list.innerHTML = rows.length ? `
        <table><thead><tr>
            <th>Date</th><th>Name</th><th>Phone</th><th>Course</th><th>Location</th><th>Details</th><th>Status</th><th>Action</th>
        </tr></thead><tbody>
        ${rows.map(row => `<tr>
            <td>${escapeHTML(row.created_at ? new Date(row.created_at).toLocaleString() : "")}</td>
            <td>${escapeHTML(row.full_name)}</td>
            <td>${escapeHTML(row.phone)}</td>
            <td>${escapeHTML(row.course)}</td>
            <td>${escapeHTML(row.location)}</td>
            <td><span class="admin-details-preview">${escapeHTML(row.message || row.request_details || row.details || "—")}</span></td>
            <td>${statusSelectHTML("training_status", row.id, statuses.get(String(row.id)))}</td>
            <td>
                <button type="button" class="secondary" data-view-registration="${escapeHTML(row.id)}">View Full Details</button>
                <button type="button" class="primary" data-generate-training-invoice="${escapeHTML(row.id)}">Generate Invoice</button>
                <button type="button" class="danger" data-delete-registration="${escapeHTML(row.id)}">Delete</button>
            </td>
        </tr>`).join("")}
        </tbody></table>
    ` : `<div class="empty">No training registrations received.</div>`;

    list.querySelectorAll("[data-status-id]").forEach(select => {
        select.addEventListener("change", async () => {
            try {
                await setAdminRecordStatus(select.dataset.statusPrefix, select.dataset.statusId, select.value);
                message("Status updated.", "success");
            } catch (error) {
                message("Status could not be updated: " + error.message, "error");
            }
        });
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
            try { await setAdminRecordStatus("training_status", row.id, "invoice_sent"); } catch (_) {}
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
            if (product && quantity) quantities.push(`${product}: ${quantity}`);
        });
    }
    if (details?.ladiesWearQuantity) quantities.push(`Ladies Wear: ${details.ladiesWearQuantity}`);
    if (details?.kidsWearQuantity) quantities.push(`Kids Wear: ${details.kidsWearQuantity}`);
    if (details?.embellishmentDetails) {
        Object.entries(details.embellishmentDetails).forEach(([name,item]) => {
            if (item?.quantity) quantities.push(`${name}: ${item.quantity}`);
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
            const detailText = typeof item === "object" ? [item.size, item.measurements, item.colour].filter(Boolean).join(" • ") : "";
            if (product) parts.push(`${product}: ${detailText}`.replace(/: $/,""));
        });
    }
    if (selected.includes("Ladies Wear")) parts.push(["Ladies Wear", details.ladiesWearSize, details.ladiesWearColour, details.ladiesWear].filter(Boolean).join(" • "));
    if (selected.includes("Kids Wear")) parts.push(["Kids Wear", details.kidsWearSize, details.kidsWearColour, details.kidsWear].filter(Boolean).join(" • "));
    if (selected.includes("Embellishment Services") && Array.isArray(details.embellishment)) {
        details.embellishment.forEach(name => {
            const item = details.embellishmentDetails?.[name] || {};
            parts.push(`${name}: ${[item.size, item.measurements, item.colour, item.details].filter(Boolean).join(" • ")}`);
        });
    }
    if (details.additionalDetails) parts.push(details.additionalDetails);

    return parts.filter(Boolean).join(" | ");
}


async function loadQuotes() {
    let rawRows;
    try {
        rawRows = await getRows("quote_requests");
    } catch (error) {
        console.error("QUOTE REQUEST LOAD ERROR:", error);
        const list = document.getElementById("quoteList");
        if (list) list.innerHTML = `<div class="empty"><strong>Order / quote requests could not be loaded.</strong><br><small>${escapeHTML(error.message || "Supabase could not load this section.")}</small><br><button type="button" class="primary" id="retryQuotes">Retry</button></div>`;
        document.getElementById("retryQuotes")?.addEventListener("click", loadQuotes);
        throw error;
    }

    const rows = groupDuplicateQuotes(rawRows);
    const list = document.getElementById("quoteList");
    if (!list) return;

    const statuses = new Map();
    for (const row of rows) statuses.set(String(row.id), await getAdminRecordStatus("quote_status", row.id));

    list.innerHTML = rows.length ? `
        <table>
            <thead><tr>
                <th>Date</th><th>Name</th><th>Phone</th><th>WhatsApp</th><th>Location</th><th>Services</th><th>Quantity</th><th>Details</th><th>Status</th><th>Action</th>
            </tr></thead>
            <tbody>
            ${rows.map(row => {
                let details = row.journey || row.request_details || row.details || row.message || "";
                let uploads = [];
                try {
                    const parsed = parseSubmissionDetails(details);
                    if (parsed && Array.isArray(parsed.uploads)) uploads = parsed.uploads;
                } catch (_) {}
                const preview = summarizeQuoteDetails(row);
                const duplicateNote = row._duplicateCount > 1
                    ? ` <small style="display:block;margin-top:5px;color:#b00020;font-weight:bold;">${row._duplicateCount} identical records grouped as one request</small>`
                    : "";
                return `<tr>
                    <td>${escapeHTML(row.created_at ? new Date(row.created_at).toLocaleString() : "")}</td>
                    <td>${escapeHTML(row.full_name)}</td>
                    <td>${escapeHTML(row.phone)}</td>
                    <td>${escapeHTML(row.whatsapp)}</td>
                    <td>${escapeHTML(row.location)}</td>
                    <td>${escapeHTML(row.service)}${duplicateNote}</td>
                    <td><span style="display:block;white-space:normal">${escapeHTML(summarizeQuoteQuantities(row))}</span></td>
                    <td><span style="display:block;white-space:normal">${escapeHTML(preview)}</span></td>
                    <td>${statusSelectHTML("quote_status", row.id, statuses.get(String(row.id)))}</td>
                    <td>
                        <button type="button" class="secondary" data-view-quote="${escapeHTML(row.id)}">View Full Details</button>
                        <button type="button" class="primary" data-generate-invoice="${escapeHTML(row.id)}">Generate Invoice</button>
                        <button type="button" class="danger" data-delete-quote="${escapeHTML(row.id)}">Delete</button>
                    </td>
                </tr>`;
            }).join("")}
            </tbody>
        </table>
    ` : `<div class="empty">No quote requests received.</div>`;

    list.querySelectorAll("[data-status-id]").forEach(select => {
        select.addEventListener("change", async () => {
            try {
                await setAdminRecordStatus(select.dataset.statusPrefix, select.dataset.statusId, select.value);
                message("Status updated.", "success");
            } catch (error) {
                message("Status could not be updated: " + error.message, "error");
            }
        });
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
            try { await setAdminRecordStatus("quote_status", row.id, "invoice_sent"); } catch (_) {}
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


async function loadEnquiries() {
    const rows = await getRows("enquiries");
    const list = document.getElementById("enquiryList");
    if (!list) return;

    list.innerHTML = rows.length ? `
        <table><thead><tr>
            <th>Date</th><th>Name</th><th>Phone</th><th>WhatsApp</th><th>Email</th><th>Subject</th><th>Message</th>
        </tr></thead><tbody>
        ${rows.map(row => `<tr>
            <td>${escapeHTML(row.created_at ? new Date(row.created_at).toLocaleString() : "")}</td>
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
            <td>${escapeHTML(String(row.title || "").replace(/^\s*[1-4]\s*\.\s*/, ""))}</td>
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
            <thead><tr><th>Item / Programme</th><th>Category</th><th>Price (GHS)</th><th>Notes</th><th>Status</th><th>Actions</th></tr></thead>
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
    if (trainingList) trainingList.innerHTML = renderRows(trainingInvoices, "No training invoice prices have been added yet.", "data-edit-training-invoice", "training");

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
                <div class="form-group"><label>MoMo / Payment Number</label><input class="invoice-payment-number" value="${escapeHTML(item.number || "")}" placeholder="e.g. 024..."></div>
                <div class="form-group"><label>Account / MoMo Name</label><input class="invoice-payment-name" value="${escapeHTML(item.name || "")}" placeholder="Name on the account"></div>
                <div class="form-group"><label>Network / Payment Method</label><input class="invoice-payment-network" value="${escapeHTML(item.network || "")}" placeholder="MTN MoMo, Telecel, Bank, etc."></div>
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
    rows.filter(r => ["invoice_payment_number","invoice_payment_name","invoice_payment_network","invoice_payment_note"].includes(String(r.setting_key||"")))
        .forEach(r => legacy[r.setting_key] = r.setting_value || "");

    if (legacy.invoice_payment_number || legacy.invoice_payment_name || legacy.invoice_payment_network || legacy.invoice_payment_note) {
        return [{
            number: legacy.invoice_payment_number || "",
            name: legacy.invoice_payment_name || "",
            network: legacy.invoice_payment_network || "",
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
                        ${escapeHTML(item.name || "")}<br>
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
            note: row.querySelector(".invoice-payment-note")?.value.trim() || ""
        })).filter(item => item.number || item.name || item.network || item.note);

        try {
            await safeSettingUpsert("invoice_payment_accounts", JSON.stringify(accounts));
            // Keep the older single-value settings in sync for backward compatibility.
            const first = accounts[0] || {};
            await safeSettingUpsert("invoice_payment_number", first.number || "");
            await safeSettingUpsert("invoice_payment_name", first.name || "");
            await safeSettingUpsert("invoice_payment_network", first.network || "");
            await safeSettingUpsert("invoice_payment_note", first.note || "");
            message("Invoice payment details saved.", "success");
            await loadInvoicePaymentDetails();
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
    return result.data || [];
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
                                <img src="${escapeHTML(row.setting_value)}" alt="Saved logo ${index + 1}">
                            </div>
                            <div class="logo-library-meta">
                                <strong>${isCurrent ? "Current Public Logo" : "Saved Logo"}</strong>
                                ${row.updated_at ? `<small>Saved ${escapeHTML(new Date(row.updated_at).toLocaleString())}</small>` : ""}
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
                    <img src="${escapeHTML(logo.setting_value)}" alt="Current saved logo">
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
            && !key.startsWith("training_status_")
            && !key.startsWith("homepage_featured_");
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
        ["Privacy Policy", "privacy_policy", "At Aprils Signature, we value your privacy and are committed to protecting your personal information.\n\nAny information you provide through our website, including contact forms, quote requests, training applications, and order enquiries, is used solely to provide our services and communicate with you regarding your request.\n\nThe information we may collect includes: Name; Phone number; Email address; Delivery or pickup details; Measurements; Uploaded photos or mock-ups; Any other information you choose to provide.\n\nYour personal information will not be sold, rented, or shared with third parties except where necessary to provide our services or where required by law.\n\nWe take reasonable steps to keep your information secure and use it only for legitimate business purposes.\n\nIf you have any questions about how your personal information is used, please contact us and we will be happy to assist you.\n\nBy using our website and submitting your information, you agree to the terms of this Privacy Policy."]
    ];
    try {
        const existing = await db.from("policies").select("id,policy_key");
        if (!existing.error) {
            const keys = new Set((existing.data || []).map(r => String(r.policy_key || "").toLowerCase()));
            const missing = INITIAL_POLICIES.filter(([,k]) => !keys.has(k.toLowerCase())).map(([title, policy_key, content]) => ({title, policy_key, content}));
            if (missing.length) await db.from("policies").insert(missing);
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
        ["site_link_training", { label: "Training", url: "training.html", order: 5, location: "header", active: true }],
        ["site_link_order_request", { label: "Order / Request a Quote", url: "quotes.html", order: 6, location: "header", active: true }],
        ["site_link_policies_terms", { label: "Policies & Terms", url: "policies.html", order: 7, location: "header", active: true }],
        ["site_link_contact", { label: "Contact", url: "contact.html", order: 8, location: "header", active: true }]
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
            const redemptions = redemptionResult.error ? [] : (redemptionResult.data || []);
            redemptionList.innerHTML = redemptions.length ? `<table><thead><tr><th>Date</th><th>Customer</th><th>Phone</th><th>Email</th><th>Code</th><th>Reference</th><th>Status</th><th>Action</th></tr></thead><tbody>
            ${redemptions.map(r => `<tr><td>${escapeHTML(r.created_at ? new Date(r.created_at).toLocaleString() : "")}</td><td>${escapeHTML(r.full_name)}</td><td>${escapeHTML(r.phone)}</td><td>${escapeHTML(r.email || "")}</td><td>${escapeHTML(r.code)}</td><td>${escapeHTML(r.order_reference || "")}</td><td>${escapeHTML(r.status || "pending")}</td><td><button type="button" class="danger" data-delete-redemption="${escapeHTML(r.id)}">Delete</button></td></tr>`).join("")}
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

/* =========================================================
   STARTUP
========================================================= */

async function startAdmin() {
    db = await waitForSupabase();

    if (!db) {
        message("Supabase could not be loaded.", "error");
        return;
    }

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
    setupDiscountForm();
    setupWebsiteLinksForm();
    setupDirectCustomerLinks();
    setupContactForm();
    setupSocialForm();
    setupSettingsForm();
    setupLogoForm();

    await checkSession();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startAdmin);
} else {
    startAdmin();
}
