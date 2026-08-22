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

function setupCustomerDirectLinks() {
    const orderUrl = () => getPublicPageUrl("quotes.html");
    const trainingUrl = () => getPublicPageUrl("training.html");
    const copy = async (url, label) => {
        try { await navigator.clipboard.writeText(url); message(`${label} copied to the clipboard.`, "success"); }
        catch (_) { window.prompt(`Copy the ${label.toLowerCase()}:`, url); }
    };
    document.getElementById("shareOrderFormLink")?.addEventListener("click", () => sharePublicPageLink("Aprils Signature Order / Request a Quote", "quotes.html", "Aprils Signature — Order / Request a Quote\nPlease use this direct form to send your request:"));
    document.getElementById("shareTrainingFormLink")?.addEventListener("click", () => sharePublicPageLink("Aprils Signature Training Registration", "training.html", "Aprils Signature — Training Registration\nPlease use this direct form to register:"));
    document.getElementById("copyOrderFormLink")?.addEventListener("click", () => copy(orderUrl(), "Order / Request a Quote link"));
    document.getElementById("copyTrainingFormLink")?.addEventListener("click", () => copy(trainingUrl(), "Training Registration link"));
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
        if (id === "training") await loadTraining();
        if (id === "registrations") await loadRegistrations();
        if (id === "orders") await loadQuotes();
        if (id === "invoice") await loadInvoicePricing();
        if (id === "links") await loadWebsiteLinks();
        if (id === "testimonials") await loadTestimonials();
        if (id === "faq") await loadFAQs();
        if (id === "policies") await loadPolicies();
        if (id === "content") await loadContent();
        if (id === "social") await loadSocial();
        if (id === "services") await loadServices();
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
                        <td>${escapeHTML(row.title)}</td>
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
        const collectionResult = await db.from("gallery_collections").select("id,name,active,display_order").order("display_order", {ascending:true}).order("name");
        const collectionBox = document.getElementById("galleryCollectionOrderList");
        if (!collectionResult.error && collectionBox) {
            const collections = collectionResult.data || [];
            collectionBox.innerHTML = collections.length ? `<strong>Collection Order</strong><table><thead><tr><th>Collection</th><th>Order</th><th>Save Order</th><th>Edit</th><th>Delete</th></tr></thead><tbody>${collections.map(c=>`<tr><td>${escapeHTML(c.name||"")}</td><td><input type="number" min="1" value="${escapeHTML(c.display_order??1)}" data-collection-order="${escapeHTML(c.id)}" style="max-width:90px"></td><td><button type="button" class="secondary" data-save-collection-order="${escapeHTML(c.id)}">Save Order</button></td><td><button type="button" class="secondary" data-edit-collection="${escapeHTML(c.id)}">Edit</button></td><td><button type="button" class="danger" data-delete-collection="${escapeHTML(c.id)}">Delete</button></td></tr>`).join("")}</tbody></table>` : `<strong>Collection Order</strong><div class="empty">No collections yet.</div>`;
            collectionBox.querySelectorAll("[data-save-collection-order]").forEach(btn=>btn.onclick=async()=>{
                const id=btn.dataset.saveCollectionOrder;
                const input=collectionBox.querySelector(`[data-collection-order="${id}"]`);
                const value=Number(input?.value)||1;
                const r=await db.from("gallery_collections").update({display_order:value}).eq("id",id);
                if(r.error) message("Collection order could not be saved: "+r.error.message,"error");
                else { message("Collection order saved.","success"); await loadGallery(); }
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
    renderGalleryMediaOrder(rows);
}


async function renderGalleryMediaOrder(rows) {
    const box = document.getElementById("galleryMediaOrderList");
    if (!box) return;

    const mediaRows = [...(rows || [])].sort((a, b) =>
        Number(a.display_order || 9999) - Number(b.display_order || 9999) ||
        String(a.category || "").localeCompare(String(b.category || "")) ||
        String(a.title || "").localeCompare(String(b.title || ""))
    );

    if (!mediaRows.length) {
        box.innerHTML = `<div class="empty">No gallery media yet. Add an image or video above.</div>`;
        return;
    }

    box.innerHTML = `
        <div class="admin-actions" style="margin-bottom:14px;">
            <button type="button" class="primary" id="addMediaFromOrderManager">+ Add New Media</button>
            <span class="muted" style="align-self:center;">Use this area to manage the homepage Featured Collection and media order.</span>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Preview</th>
                    <th>Title</th>
                    <th>Collection</th>
                    <th>Gallery Order</th>
                    <th>Featured</th>
                    <th>Featured Order</th>
                    <th>Active</th>
                    <th>Save</th>
                </tr>
            </thead>
            <tbody>
                ${mediaRows.map(row => {
                    const media = row.image_url
                        ? (/\.(mp4|webm|ogg)(\?|$)/i.test(row.image_url)
                            ? `<video src="${escapeHTML(resolveAdminMediaUrl(row.image_url))}" muted controls playsinline style="width:90px;height:70px;object-fit:cover"></video>`
                            : `<img src="${escapeHTML(resolveAdminMediaUrl(row.image_url))}" alt="" style="width:90px;height:70px;object-fit:cover">`)
                        : "—";
                    return `
                        <tr>
                            <td>${media}</td>
                            <td>${escapeHTML(row.title || "")}</td>
                            <td>${escapeHTML(row.category || "")}</td>
                            <td><input type="number" min="1" value="${escapeHTML(row.display_order ?? 1)}" data-media-order="${escapeHTML(row.id)}" style="max-width:90px"></td>
                            <td><input type="checkbox" ${row.featured ? "checked" : ""} data-media-featured="${escapeHTML(row.id)}"></td>
                            <td><input type="number" min="1" value="${escapeHTML(row.display_order ?? 1)}" data-media-featured-order="${escapeHTML(row.id)}" style="max-width:90px"></td>
                            <td><input type="checkbox" ${row.active !== false ? "checked" : ""} data-media-active="${escapeHTML(row.id)}"></td>
                            <td>
                                <button type="button" class="secondary" data-media-save="${escapeHTML(row.id)}">Save</button>
                                <button type="button" class="secondary" data-media-edit="${escapeHTML(row.id)}">Edit</button>
                                <button type="button" class="danger" data-media-delete="${escapeHTML(row.id)}">Delete</button>
                            </td>
                        </tr>`;
                }).join("")}
            </tbody>
        </table>
    `;

    box.querySelectorAll("[data-media-save]").forEach(button => {
        button.onclick = async () => {
            const id = button.dataset.mediaSave;
            const order = Number(box.querySelector(`[data-media-order="${id}"]`)?.value) || 1;
            const featured = !!box.querySelector(`[data-media-featured="${id}"]`)?.checked;
            const featuredOrder = Number(box.querySelector(`[data-media-featured-order="${id}"]`)?.value) || order;
            const active = !!box.querySelector(`[data-media-active="${id}"]`)?.checked;

            try {
                const result = await db.from("gallery_items")
                    .update({ display_order: order, featured, active, updated_at: new Date().toISOString() })
                    .eq("id", id);
                if (result.error) throw result.error;

                if (featured) {
                    await safeSettingUpsert("featured_order_" + id, String(featuredOrder));
                } else {
                    await db.from("settings").delete().eq("setting_key", "featured_order_" + id);
                }

                message("Gallery media order and settings saved.", "success");
                await loadGallery();
            } catch (error) {
                console.error(error);
                message("Gallery media could not be saved: " + error.message, "error");
            }
        };
    });

    box.querySelectorAll("[data-media-edit]").forEach(button => {
        button.onclick = () => {
            const row = mediaRows.find(item => String(item.id) === String(button.dataset.mediaEdit));
            if (row) editGallery(row);
        };
    });

    box.querySelectorAll("[data-media-delete]").forEach(button => {
        button.onclick = () => deleteGallery(button.dataset.mediaDelete);
    });

    box.querySelector("#addMediaFromOrderManager")?.addEventListener("click", () => {
        document.getElementById("newGalleryItemButton")?.click();
    });
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
    ["Streetwear","Joggers — Super Thick Cutting Joggers",3],
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
    rows.sort((a,b)=>String(a.category||"").localeCompare(String(b.category||""))||Number(a.display_order||9999)-Number(b.display_order||9999)||String(a.name||"").localeCompare(String(b.name||"")));
    list.innerHTML=rows.length?`<table><thead><tr><th>Product / Service</th><th>Category</th><th>Public Price (GHS)</th><th>Invoice Price (GHS)</th><th>Order</th><th>Active</th><th>Actions</th></tr></thead><tbody>${rows.map(r=>{const i=invoiceMap.get(String(r.name||"").trim().toLowerCase());return `<tr><td>${escapeHTML(r.name)}</td><td>${escapeHTML(r.category||"")}</td><td>${r.public_price!==undefined && r.public_price!==null && r.public_price!==""?`GHS ${Number(r.public_price).toFixed(2)}`:"—"}</td><td>${i?.price!==undefined?`GHS ${Number(i.price).toFixed(2)}`:"—"}</td><td>${escapeHTML(r.display_order??1)}</td><td>${r.active!==false?"Yes":"No"}</td><td><button type="button" class="secondary" data-edit-product="${escapeHTML(r.id)}">Edit</button> <button type="button" class="danger" data-delete-product="${escapeHTML(r.id)}">Delete</button></td></tr>`;}).join("")}</tbody></table>`:`<div class="empty">No products / services have been added yet.</div>`;
    list.querySelectorAll("[data-edit-product]").forEach(b=>b.onclick=()=>{const r=rows.find(x=>String(x.id)===String(b.dataset.editProduct));if(!r)return;const i=invoiceMap.get(String(r.name||"").trim().toLowerCase());document.getElementById("adminProductId").value=r.id;document.getElementById("adminProductTitle").value=r.name||"";document.getElementById("adminProductCategory").value=r.category||"Streetwear";document.getElementById("adminProductPublicPrice").value=r.public_price??""; document.getElementById("adminProductInvoicePrice").value=i?.price??"";document.getElementById("adminProductOrder").value=r.display_order??1;document.getElementById("adminProductNotes").value=i?.notes||r.notes||"";document.getElementById("adminProductActive").checked=r.active!==false;document.getElementById("services").scrollIntoView({behavior:"smooth",block:"start"});});
    list.querySelectorAll("[data-delete-product]").forEach(b=>b.onclick=async()=>{const r=rows.find(x=>String(x.id)===String(b.dataset.deleteProduct));if(!r||!confirm(`Delete "${r.name}"?`))return;const q=await db.from("settings").delete().eq("id",b.dataset.deleteProduct);if(q.error){message("Product / service could not be deleted: "+q.error.message,"error");return;}await db.from("settings").delete().eq("setting_key",invoiceStorageKey(r.name));message("Product / service deleted.","success");await loadProducts();});
}

function setupProductForm() {
    const form=document.getElementById("adminProductForm"); if(!form || form.dataset.bound)return;
    form.dataset.bound="1";
    form.addEventListener("submit",async e=>{
        e.preventDefault();
        const id=document.getElementById("adminProductId").value.trim();
        const name=document.getElementById("adminProductTitle").value.trim();
        const category=document.getElementById("adminProductCategory").value.trim();
        const publicPriceValue=document.getElementById("adminProductPublicPrice").value;
        const invoicePriceValue=document.getElementById("adminProductInvoicePrice").value;
        const publicPrice = publicPriceValue === "" ? null : Number(publicPriceValue);
        const invoicePrice = invoicePriceValue === "" ? null : Number(invoicePriceValue);
        const payload={name,category,
            public_price: publicPrice,
            notes:document.getElementById("adminProductNotes").value.trim(),
            display_order:Number(document.getElementById("adminProductOrder").value)||1,
            active:document.getElementById("adminProductActive").checked};
        if(!name){message("Please enter a product name.","error");return;}
        try{
            const key=productKeyFromName(name);
            let oldItem = {};
            let oldSettingKey = "";
            if(id){
                const old=await db.from("settings").select("setting_key,setting_value").eq("id",id).maybeSingle();
                if(old.error)throw old.error;
                oldSettingKey = old.data?.setting_key || "";
                try { oldItem=JSON.parse(old.data?.setting_value||"{}"); } catch(_) { oldItem={}; }
                await safeSettingUpsert(oldSettingKey || key,JSON.stringify(payload));
                if(oldSettingKey && oldSettingKey!==key) await db.from("settings").delete().eq("setting_key",key);
            }else{
                await safeSettingUpsert(key,JSON.stringify(payload));
            }
            const invoiceKey = invoiceStorageKey(name);
            if (id && oldItem?.name && String(oldItem.name).trim().toLowerCase() !== String(name).trim().toLowerCase()) { await db.from("settings").delete().eq("setting_key", invoiceStorageKey(oldItem.name)); }
            if (invoicePrice === null) { await db.from("settings").delete().eq("setting_key", invoiceKey); }
            else { await safeSettingUpsert(invoiceKey, JSON.stringify({name,category,price:invoicePrice,notes:payload.notes,active:payload.active})); }
            form.reset();
            document.getElementById("adminProductId").value="";
            document.getElementById("adminProductActive").checked=true;
            message("Product saved successfully.","success");
            await loadProducts();
        }catch(error){console.error(error);message("Product could not be saved: "+error.message,"error");}
    });
    document.getElementById("adminProductCancel")?.addEventListener("click",()=>{
        form.reset(); document.getElementById("adminProductId").value="";
        document.getElementById("adminProductActive").checked=true;
    });
}

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
                    <div class="form-group"><label>Category</label><select id="adminProductCategory"><option>Streetwear</option><option>Ladies Wear</option><option>Kids Wear</option><option>Other Products</option></select></div>
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
    list.querySelectorAll("[data-edit-training]").forEach(b=>b.onclick=()=>{const r=rows.find(x=>String(x.id)===String(b.dataset.editTraining));if(!r)return;const i=invoiceMap.get(("Training - "+String(r.title||"")).toLowerCase()); const p=publicMap.get(String(r.title||"").trim().toLowerCase()); document.getElementById("trainingId").value=r.id;document.getElementById("trainingTitle").value=r.title||"";document.getElementById("trainingDuration").value=r.duration||"";document.getElementById("trainingPublicPrice").value=p?.price??""; document.getElementById("trainingPrice").value=i?.price??"";document.getElementById("trainingCategory").value=r.category||"";document.getElementById("trainingDescription").value=r.description||"";document.getElementById("trainingActive").checked=r.active!==false;document.getElementById("trainingForm")?.scrollIntoView({behavior:"smooth",block:"start"});});
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
            if (!id) {
                const duplicate = await db.from("training_programs").select("id").ilike("title",payload.title).eq("duration",payload.duration).limit(1);
                if (duplicate.error) throw duplicate.error;
                if (duplicate.data?.length) {
                    message("That training programme already exists. Edit the existing one instead.","error");
                    return;
                }
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
        joggersSuperThick: "Joggers — Super Thick Cutting Joggers",
        joggersEveryday: "Joggers — Everyday Wear Type",
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
        sweatshirtsShortsSet: "Sweatshirts & Shorts Set",
        sweatshirtsSweatpantsSet: "Sweatshirts & Sweatpants Set",
        tshirtsShortsSet: "T-shirts & Shorts Set",
        tshirtSweatpantsSet: "T-shirt & Sweatpants Set"
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
    add("Service", row.service);
    if (row.created_at) add("Submitted", new Date(row.created_at).toLocaleString());

    const selected = Array.isArray(details.selectedServices)
        ? details.selectedServices
        : String(row.service || "").split(",").map(v => v.trim()).filter(Boolean);

    add("Selected Services", selected.join(", "));

    if (selected.includes("Streetwear") && details.streetwear && typeof details.streetwear === "object") {
        const items = Object.entries(details.streetwear)
            .map(([name, value]) => {
                const quantity = value && typeof value === "object" ? (value.quantity ?? value.qty ?? "") : value;
                const product = value && typeof value === "object" ? (value.product || value.name || humanizeProductName(name)) : humanizeProductName(name);
                const n = Number(quantity);
                if (!String(quantity ?? "").trim() || (!Number.isNaN(n) && n <= 0)) return "";
                return `${product}: ${quantity}`;
            })
            .filter(Boolean);

        if (items.length) add("Streetwear Items & Quantities", items.join(" • "));
    }

    if (selected.includes("Streetwear")) {
        add("Streetwear Size / Measurements", details.streetwearSize);
        add("Streetwear Colour", details.streetwearColour);
        add("Streetwear Other Request", details.streetwearOther);
    }

    if (selected.includes("Ladies Wear")) {
        add("Ladies Wear Quantity", details.ladiesWearQuantity);
        add("Ladies Wear Request", details.ladiesWear);
        add("Ladies Wear Size / Measurements", details.ladiesWearSize);
        add("Ladies Wear Colour", details.ladiesWearColour);
    }

    if (selected.includes("Kids Wear")) {
        add("Kids Wear Quantity", details.kidsWearQuantity);
        add("Kids Wear Request", details.kidsWear);
        add("Kids Wear Size / Measurements", details.kidsWearSize);
        add("Kids Wear Colour", details.kidsWearColour);
    }

    if (selected.includes("Embellishment Services")) {
        const embellishments = Array.isArray(details.embellishment)
            ? details.embellishment.filter(Boolean)
            : [];
        add("Embellishment Services", embellishments.join(", "));

        if (details.embellishmentDetails && typeof details.embellishmentDetails === "object") {
            Object.entries(details.embellishmentDetails).forEach(([service, info]) => {
                if (!info || typeof info !== "object") return;
                add(service + " — Quantity", info.quantity);
                add(service + " — Size / Measurements", info.size);
                add(service + " — Colour", info.colour);
                add(service + " — Details / Style Request", info.details);
            });
        } else {
            add("Embellishment Quantity", details.embellishmentQuantity);
            add("Embellishment Request", details.embellishmentOther);
            add("Embellishment Size / Measurements", details.embellishmentSize);
        }
    }

    if (selected.includes("Practical Fashion Training")) {
        add("Training Request", details.training);
    }

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

function getPublicPageUrl(fileName) {
    try {
        return new URL("../" + fileName, window.location.href).href;
    } catch (_) {
        return fileName;
    }
}

async function sharePublicPageLink(title, fileName, messageText) {
    const url = getPublicPageUrl(fileName);
    const text = messageText ? `${messageText}\n\n${url}` : url;
    try {
        if (navigator.share) {
            await navigator.share({ title, text, url });
            return;
        }
    } catch (error) {
        if (error?.name === "AbortError") return;
    }
    try {
        await navigator.clipboard.writeText(url);
        message("The direct page link has been copied. You can paste it into WhatsApp, SMS, email or any other message.", "success");
    } catch (_) {
        window.prompt("Copy this direct page link:", url);
    }
}

function normalizeWhatsAppNumber(value) {
    let digits = String(value || "").replace(/[^0-9]/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("0") && digits.length === 10) digits = "233" + digits.slice(1);
    return digits;
}

function buildInvoiceShareText(data) {
    const lines = [
        "Aprils Signature — Invoice",
        `Invoice No.: ${data.invoiceNumber}`,
        `Customer: ${data.customer}`,
        data.phone ? `Phone: ${data.phone}` : "",
        data.invoiceDate ? `Date: ${data.invoiceDate}` : "",
        "",
        "Items:"
    ];
    data.lines.forEach(item => lines.push(`${item.description} — Qty ${item.quantity} × GHS ${item.unitPrice.toFixed(2)} = GHS ${item.amount.toFixed(2)}`));
    lines.push("", `Total: GHS ${data.subtotal.toFixed(2)}`);
    if (data.paymentText) lines.push("", "Payment details:", data.paymentText);
    lines.push("", "Thank you for choosing Aprils Signature.", "Elegance in Every Stitch");
    return lines.filter((line, index) => !(line === "" && lines[index - 1] === "")).join("\n");
}

function collectManualInvoiceData() {
    const modal = document.getElementById("manualInvoiceModal");
    if (!modal) return null;
    const body = modal.querySelector(".submission-modal-body");
    const lines = [];
    body.querySelectorAll("[data-invoice-row]").forEach(tr => {
        const description = tr.querySelector(".manual-invoice-description")?.value.trim() || "";
        const quantity = Number(tr.querySelector(".manual-invoice-quantity")?.value) || 0;
        const unitPrice = Number(tr.querySelector(".manual-invoice-price")?.value) || 0;
        if (description && quantity > 0) lines.push({ description, quantity, unitPrice, amount: quantity * unitPrice });
    });
    return {
        invoiceNumber: body.querySelector("#manualInvoiceNumber")?.value.trim() || "",
        invoiceDate: body.querySelector("#manualInvoiceDate")?.value || "",
        customer: body.querySelector("#manualInvoiceCustomer")?.value.trim() || "",
        phone: body.querySelector("#manualInvoicePhone")?.value.trim() || "",
        email: body.querySelector("#manualInvoiceEmail")?.value.trim() || "",
        lines,
        subtotal: lines.reduce((sum, item) => sum + item.amount, 0),
        paymentText: document.getElementById("manualInvoicePaymentPreview")?.innerText.replace(/^Payment details that will appear on the invoice\s*/i, "").trim() || ""
    };
}

async function shareGeneratedInvoice(mode = "native") {
    const data = collectManualInvoiceData();
    if (!data) return;
    if (!data.lines.length) { message("Add at least one invoice item before sharing the invoice.", "error"); return; }
    const text = buildInvoiceShareText(data);
    const number = normalizeWhatsAppNumber(data.phone);

    if (mode === "whatsapp") {
        if (!number) { message("No valid customer phone number is available for WhatsApp.", "error"); return; }
        window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
        return;
    }

    if (mode === "email") {
        if (!data.email) { message("No customer email address is available.", "error"); return; }
        window.location.href = `mailto:${encodeURIComponent(data.email)}?subject=${encodeURIComponent("Aprils Signature Invoice " + data.invoiceNumber)}&body=${encodeURIComponent(text)}`;
        return;
    }

    try {
        if (navigator.share) {
            await navigator.share({ title: "Aprils Signature Invoice " + data.invoiceNumber, text });
            return;
        }
    } catch (error) {
        if (error?.name === "AbortError") return;
    }
    try {
        await navigator.clipboard.writeText(text);
        message("Invoice details copied. You can paste them into WhatsApp, SMS or email.", "success");
    } catch (_) {
        window.prompt("Copy the invoice message:", text);
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
            <div class="submission-modal-actions"><button type="button" class="primary submission-export-button" id="exportSubmissionDetails">Export Details</button><button type="button" class="secondary" id="shareSubmissionDetails">Share</button></div>
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

async function loadRegistrations() {
    const rows = await getRows("training_registrations");
    const list = document.getElementById("registrationList");
    if (!list) return;

    list.innerHTML = rows.length ? `
        <table><thead><tr>
            <th>Date</th><th>Name</th><th>Phone</th><th>Course</th><th>Location</th><th>Details</th><th>Action</th>
        </tr></thead><tbody>
        ${rows.map(row => `<tr>
            <td>${escapeHTML(row.created_at ? new Date(row.created_at).toLocaleString() : "")}</td>
            <td>${escapeHTML(row.full_name)}</td>
            <td>${escapeHTML(row.phone)}</td>
            <td>${escapeHTML(row.course)}</td>
            <td>${escapeHTML(row.location)}</td>
            <td><span class="admin-details-preview">${escapeHTML(row.message || row.request_details || row.details || "—")}</span></td>
            <td>
    <button type="button" class="secondary" data-view-registration="${row.id}">View Full Details</button>
    <button type="button" class="primary" data-generate-training-invoice="${row.id}">Generate Invoice</button>
    <button type="button" class="danger" data-delete-registration="${row.id}">Delete</button>
</td>
        </tr>`).join("")}
        </tbody></table>
    ` : `<div class="empty">No training registrations received.</div>`;

    list.querySelectorAll("[data-view-registration]").forEach(button => {
        button.onclick = () => {
            const row = rows.find(item => String(item.id) === String(button.dataset.viewRegistration));
            if (row) showSubmissionDetails("Training Registration Details", row, row.message || row.request_details || row.details || "");
        };
    });

    list.querySelectorAll("[data-generate-training-invoice]").forEach(button => {
        button.onclick = () => {
            const row = rows.find(item => String(item.id) === String(button.dataset.generateTrainingInvoice));
            if (!row) return;
            const invoiceRow = { ...row, _invoiceType: "training", _invoiceItems: getInvoiceLineItemsFromTraining(row) };
            showManualInvoiceBuilder(invoiceRow);
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
            message("Training registration deleted.", "success");
            await loadRegistrations();
            await loadDashboard();
        };
    });
}


function summarizeQuoteQuantities(row) {
    const detailsText = row?.journey || row?.request_details || row?.details || row?.message || "";
    const details = parseSubmissionDetails(detailsText);
    const streetwear = details?.streetwear;

    if (!streetwear || typeof streetwear !== "object") return "—";

    const items = Object.entries(streetwear)
        .map(([name, value]) => {
            const quantity = value && typeof value === "object" ? (value.quantity ?? value.qty ?? "") : value;
            const product = value && typeof value === "object" ? (value.product || value.name || humanizeProductName(name)) : humanizeProductName(name);
            const number = Number(quantity);
            if (!String(quantity ?? "").trim() || (!Number.isNaN(number) && number <= 0)) return "";
            return `${product}: ${quantity}`;
        })
        .filter(Boolean);

    return items.length ? items.join(" • ") : "—";
}

function summarizeQuoteDetails(row) {
    const detailsText = row?.journey || row?.request_details || row?.details || row?.message || "";
    const details = parseSubmissionDetails(detailsText);
    const selected = Array.isArray(details.selectedServices)
        ? details.selectedServices
        : String(row?.service || "").split(",").map(v => v.trim()).filter(Boolean);

    const parts = [];
    if (selected.length) parts.push(selected.join(", "));

    if (selected.includes("Streetwear") && details.streetwear && typeof details.streetwear === "object") {
        const items = Object.entries(details.streetwear)
            .map(([name, value]) => {
                const q = value && typeof value === "object" ? (value.quantity ?? value.qty ?? "") : value;
                const product = value && typeof value === "object" ? (value.product || value.name || humanizeProductName(name)) : humanizeProductName(name);
                const n = Number(q);
                if (!String(q ?? "").trim() || (!Number.isNaN(n) && n <= 0)) return "";
                return `${product}: ${q}`;
            })
            .filter(Boolean);
        if (items.length) parts.push(items.join(" • "));
        if (details.streetwearSize) parts.push(`Size: ${details.streetwearSize}`);
        if (details.streetwearColour) parts.push(`Colour: ${details.streetwearColour}`);
    }

    if (selected.includes("Ladies Wear")) {
        if (details.ladiesWear) parts.push(`Ladies Wear: ${details.ladiesWear}`);
        if (details.ladiesWearSize) parts.push(`Size: ${details.ladiesWearSize}`);
        if (details.ladiesWearColour) parts.push(`Colour: ${details.ladiesWearColour}`);
    }

    if (selected.includes("Kids Wear")) {
        if (details.kidsWear) parts.push(`Kids Wear: ${details.kidsWear}`);
        if (details.kidsWearSize) parts.push(`Size: ${details.kidsWearSize}`);
        if (details.kidsWearColour) parts.push(`Colour: ${details.kidsWearColour}`);
    }

    if (selected.includes("Embellishment Services")) {
        if (Array.isArray(details.embellishment) && details.embellishment.length) {
            parts.push(details.embellishment.join(", "));
        }
        if (details.embellishmentOther) parts.push(details.embellishmentOther);
        if (details.embellishmentSize) parts.push(`Size: ${details.embellishmentSize}`);
    }

    if (selected.includes("Practical Fashion Training") && details.training) {
        parts.push(details.training);
    }

    if (details.additionalDetails) parts.push(details.additionalDetails);

    return parts.join(" | ");
}


function quoteDuplicateSignature(row) {
    return [
        row.full_name,
        row.phone,
        row.whatsapp,
        row.location,
        row.email,
        row.service,
        row.journey || row.request_details || row.details || row.message || ""
    ].map(v => String(v ?? "").trim().toLowerCase()).join("\u001f");
}

function groupDuplicateQuotes(rows) {
    const groups = new Map();

    rows.forEach(row => {
        const signature = quoteDuplicateSignature(row);
        if (!groups.has(signature)) {
            groups.set(signature, { ...row, _ids: [row.id], _duplicateCount: 1 });
        } else {
            const group = groups.get(signature);
            group._ids.push(row.id);
            group._duplicateCount += 1;
        }
    });

    return Array.from(groups.values());
}


function invoiceNameKey(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[–—]/g, "-")
        .replace(/\s+/g, " ");
}

function getInvoiceLineItemsFromQuote(row) {
    const detailsText = row?.journey || row?.request_details || row?.details || row?.message || "";
    const details = parseSubmissionDetails(detailsText);
    const selected = Array.isArray(details.selectedServices)
        ? details.selectedServices
        : String(row?.service || "").split(",").map(v => v.trim()).filter(Boolean);
    const items = [];

    const add = (description, quantity = 1, unitPrice = "") => {
        if (!description) return;
        const q = Number(quantity);
        items.push({
            description: String(description),
            quantity: Number.isFinite(q) && q > 0 ? q : 1,
            unitPrice: unitPrice === "" ? "" : Number(unitPrice) || 0
        });
    };

    if (details.streetwear && typeof details.streetwear === "object") {
        Object.entries(details.streetwear).forEach(([key, value]) => {
            let quantity = value;
            let product = humanizeProductName(key);
            if (value && typeof value === "object") {
                quantity = value.quantity ?? value.qty ?? 1;
                product = value.product || value.name || product;
            }
            const n = Number(quantity);
            if (String(quantity ?? "").trim() && (Number.isNaN(n) || n > 0)) add(product, n);
        });
    }

    if (selected.includes("Ladies Wear")) {
        add(details.ladiesWear || "Ladies Wear", details.ladiesWearQuantity || 1);
    }
    if (selected.includes("Kids Wear")) {
        add(details.kidsWear || "Kids Wear", details.kidsWearQuantity || 1);
    }

    if (details.embellishmentDetails && typeof details.embellishmentDetails === "object") {
        Object.entries(details.embellishmentDetails).forEach(([service, info]) => {
            if (!info || typeof info !== "object") return;
            const quantity = Number(info.quantity) > 0 ? Number(info.quantity) : 1;
            const description = info.details
                ? `${service} — ${info.details}`
                : service;
            add(description, quantity);
        });
    } else if (Array.isArray(details.embellishment)) {
        details.embellishment.filter(Boolean).forEach(service => {
            add(service, details.embellishmentQuantity || 1);
        });
    }

    if (selected.includes("Practical Fashion Training") && details.training) {
        add(details.training, 1);
    }

    if (!items.length) {
        selected.forEach(service => add(service, 1));
    }

    return items;
}

async function getInvoicePriceMaps() {
    const rows = await getRows("settings");
    const invoice = new Map();
    const products = new Map();

    rows.forEach(row => {
        const key = String(row.setting_key || "");
        let value = {};
        try { value = JSON.parse(row.setting_value || "{}"); } catch (_) {}

        if (key.startsWith("invoice_price_") && value.name) {
            invoice.set(invoiceNameKey(value.name), Number(value.price) || 0);
        }
        if (key.startsWith("product_") && value.name && value.public_price !== null && value.public_price !== undefined && value.public_price !== "") {
            products.set(invoiceNameKey(value.name), Number(value.public_price) || 0);
        }
        if (key.startsWith("public_training_price_") && value.name) {
            products.set(invoiceNameKey(value.name), Number(value.price) || 0);
        }
        if (key.startsWith("invoice_price_Training - ")) {
            const trainingName = String(value.name || "").replace(/^Training - /i, "").trim();
            if (trainingName) invoice.set(invoiceNameKey(trainingName), Number(value.price) || 0);
        }
    });

    return { invoice, products };
}

async function getSavedInvoicePaymentValues() {
    const rows = await getRows("settings");
    const values = {};
    rows.filter(r => String(r.setting_key || "").startsWith("invoice_payment_"))
        .forEach(r => { values[r.setting_key] = r.setting_value || ""; });
    return values;
}

function getInvoiceLineItemsFromTraining(row) {
    const detailsText = row?.message || row?.request_details || row?.details || "";
    let course = String(row?.course || row?.training || "Training Registration").trim();
    if (!course) course = "Training Registration";
    return [{ description: course, quantity: 1, unitPrice: "" }];
}

function showManualInvoiceBuilder(row) {
    let modal = document.getElementById("manualInvoiceModal");
    let backdrop = document.getElementById("manualInvoiceBackdrop");

    if (!modal) {
        backdrop = document.createElement("div");
        backdrop.id = "manualInvoiceBackdrop";
        backdrop.className = "submission-modal-backdrop";
        backdrop.addEventListener("click", closeManualInvoiceBuilder);

        modal = document.createElement("div");
        modal.id = "manualInvoiceModal";
        modal.className = "submission-modal";
        modal.style.maxWidth = "1100px";
        modal.innerHTML = '<button type="button" class="submission-modal-close" aria-label="Close">&times;</button><div class="submission-modal-body"></div>';
        modal.querySelector(".submission-modal-close").addEventListener("click", closeManualInvoiceBuilder);
        document.body.appendChild(modal);
    }

    const body = modal.querySelector(".submission-modal-body");
    const detailsText = row.journey || row.request_details || row.details || row.message || "";
    const isTrainingInvoice = row._invoiceType === "training";
    const items = Array.isArray(row._invoiceItems) ? row._invoiceItems : getInvoiceLineItemsFromQuote(row);
    const invoiceNumber = "AS-" + new Date().toISOString().slice(0,10).replace(/-/g,"") + "-" + String(row.id || "").replace(/[^a-zA-Z0-9]/g,"").slice(-6).toUpperCase();

    body.innerHTML = `
        <div class="submission-modal-header">
            <h2>${isTrainingInvoice ? "Generate Training Invoice" : "Generate Invoice"}</h2>
            <div class="submission-modal-actions">
                <button type="button" class="primary" id="preparePrintableInvoice">Print / Save Invoice as PDF</button>
                <button type="button" class="primary" id="shareInvoiceNative">Share Invoice</button>
                <button type="button" class="secondary" id="shareInvoiceWhatsApp">Send via WhatsApp</button>
                <button type="button" class="secondary" id="shareInvoiceEmail">Send by Email</button>
                <button type="button" class="secondary" id="closeManualInvoice">Close</button>
            </div>
        </div>
        <div class="form-card" style="box-shadow:none;padding:0;">
            <div class="form-grid">
                <div class="form-group"><label>Invoice Number</label><input id="manualInvoiceNumber" value="${escapeHTML(invoiceNumber)}"></div>
                <div class="form-group"><label>Invoice Date</label><input id="manualInvoiceDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
                <div class="form-group"><label>Customer Name</label><input id="manualInvoiceCustomer" value="${escapeHTML(row.full_name || "")}"></div>
                <div class="form-group"><label>Phone</label><input id="manualInvoicePhone" value="${escapeHTML(row.phone || "")}"></div>
                <div class="form-group"><label>Email</label><input id="manualInvoiceEmail" value="${escapeHTML(row.email || "")}"></div>
                <div class="form-group"><label>Location</label><input id="manualInvoiceLocation" value="${escapeHTML(row.location || "")}"></div>
            </div>
            <div class="form-group"><label>Notes / Customer Request</label><textarea id="manualInvoiceNotes" rows="3">${escapeHTML(detailsText && !/^\s*\{/.test(detailsText) ? detailsText : "")}</textarea></div>
        </div>
        <div class="table-wrap">
            <table id="manualInvoiceItemsTable">
                <thead><tr><th>Description</th><th style="width:110px;">Quantity</th><th style="width:160px;">Unit Price (GHS)</th><th style="width:160px;">Amount (GHS)</th><th></th></tr></thead>
                <tbody>
                    ${items.map((item, index) => `
                        <tr data-invoice-row>
                            <td><input class="manual-invoice-description" value="${escapeHTML(item.description)}"></td>
                            <td><input class="manual-invoice-quantity" type="number" min="1" step="1" value="${escapeHTML(item.quantity)}"></td>
                            <td><input class="manual-invoice-price" type="number" min="0" step="0.01" value="${item.unitPrice === "" ? "" : Number(item.unitPrice).toFixed(2)}"></td>
                            <td class="manual-invoice-amount">GHS 0.00</td>
                            <td><button type="button" class="danger manual-invoice-remove">Remove</button></td>
                        </tr>`).join("")}
                </tbody>
                <tfoot>
                    <tr><th colspan="3" style="text-align:right;">Subtotal</th><th id="manualInvoiceSubtotal">GHS 0.00</th><th></th></tr>
                </tfoot>
            </table>
        </div>
        <div style="margin-top:12px;">
            <button type="button" class="secondary" id="manualInvoiceAddItem">+ Add Line Item</button>
        </div>
        <div id="manualInvoicePaymentPreview" class="notice" style="margin-top:18px;">Loading saved payment details…</div>
    `;

    const recalc = () => {
        let subtotal = 0;
        body.querySelectorAll("[data-invoice-row]").forEach(tr => {
            const quantity = Number(tr.querySelector(".manual-invoice-quantity")?.value) || 0;
            const price = Number(tr.querySelector(".manual-invoice-price")?.value) || 0;
            const amount = quantity * price;
            subtotal += amount;
            const amountCell = tr.querySelector(".manual-invoice-amount");
            if (amountCell) amountCell.textContent = "GHS " + amount.toFixed(2);
        });
        const subtotalCell = body.querySelector("#manualInvoiceSubtotal");
        if (subtotalCell) subtotalCell.textContent = "GHS " + subtotal.toFixed(2);
    };

    const bindRow = tr => {
        tr.querySelectorAll("input").forEach(input => input.addEventListener("input", recalc));
        tr.querySelector(".manual-invoice-remove")?.addEventListener("click", () => { tr.remove(); recalc(); });
    };

    body.querySelectorAll("[data-invoice-row]").forEach(bindRow);

    body.querySelector("#manualInvoiceAddItem")?.addEventListener("click", () => {
        const tr = document.createElement("tr");
        tr.setAttribute("data-invoice-row", "");
        tr.innerHTML = `<td><input class="manual-invoice-description" placeholder="Item / Service"></td><td><input class="manual-invoice-quantity" type="number" min="1" value="1"></td><td><input class="manual-invoice-price" type="number" min="0" step="0.01" placeholder="0.00"></td><td class="manual-invoice-amount">GHS 0.00</td><td><button type="button" class="danger manual-invoice-remove">Remove</button></td>`;
        body.querySelector("#manualInvoiceItemsTable tbody").appendChild(tr);
        bindRow(tr);
        recalc();
    });

    body.querySelector("#closeManualInvoice")?.addEventListener("click", closeManualInvoiceBuilder);
    body.querySelector("#preparePrintableInvoice")?.addEventListener("click", () => printManualInvoice(row));
    body.querySelector("#shareInvoiceNative")?.addEventListener("click", () => shareGeneratedInvoice("native"));
    body.querySelector("#shareInvoiceWhatsApp")?.addEventListener("click", () => shareGeneratedInvoice("whatsapp"));
    body.querySelector("#shareInvoiceEmail")?.addEventListener("click", () => shareGeneratedInvoice("email"));

    (async () => {
        const maps = await getInvoicePriceMaps();
        body.querySelectorAll("[data-invoice-row]").forEach(tr => {
            const description = tr.querySelector(".manual-invoice-description")?.value || "";
            const priceInput = tr.querySelector(".manual-invoice-price");
            if (priceInput && priceInput.value === "") {
                const key = invoiceNameKey(description);
                const price = maps.invoice.get(key) ?? maps.products.get(key);
                if (price !== undefined) priceInput.value = Number(price).toFixed(2);
            }
        });
        const payment = await getSavedInvoicePaymentValues();
        const preview = body.querySelector("#manualInvoicePaymentPreview");
        if (preview) {
            preview.innerHTML = `
                <strong>Payment details that will appear on the invoice</strong><br>
                ${escapeHTML(payment.invoice_payment_network || "")}
                ${payment.invoice_payment_name ? " — " + escapeHTML(payment.invoice_payment_name) : ""}
                ${payment.invoice_payment_number ? " — " + escapeHTML(payment.invoice_payment_number) : ""}
                ${payment.invoice_payment_note ? "<br>" + escapeHTML(payment.invoice_payment_note) : ""}
            `;
        }
        recalc();
    })();

    backdrop.style.display = "block";
    modal.classList.add("open");
}

function closeManualInvoiceBuilder() {
    document.getElementById("manualInvoiceModal")?.classList.remove("open");
    const backdrop = document.getElementById("manualInvoiceBackdrop");
    if (backdrop) backdrop.style.display = "none";
}

async function printManualInvoice(row) {
    const modal = document.getElementById("manualInvoiceModal");
    if (!modal) return;

    const body = modal.querySelector(".submission-modal-body");
    const payment = await getSavedInvoicePaymentValues();
    const lines = [];

    body.querySelectorAll("[data-invoice-row]").forEach(tr => {
        const description = tr.querySelector(".manual-invoice-description")?.value.trim() || "";
        const quantity = Number(tr.querySelector(".manual-invoice-quantity")?.value) || 0;
        const unitPrice = Number(tr.querySelector(".manual-invoice-price")?.value) || 0;
        if (description && quantity > 0) {
            lines.push({ description, quantity, unitPrice, amount: quantity * unitPrice });
        }
    });

    const subtotal = lines.reduce((sum, item) => sum + item.amount, 0);
    const invoiceNumber = body.querySelector("#manualInvoiceNumber")?.value.trim() || "";
    const invoiceDate = body.querySelector("#manualInvoiceDate")?.value || "";
    const customer = body.querySelector("#manualInvoiceCustomer")?.value.trim() || "";
    const phone = body.querySelector("#manualInvoicePhone")?.value.trim() || "";
    const email = body.querySelector("#manualInvoiceEmail")?.value.trim() || "";
    const location = body.querySelector("#manualInvoiceLocation")?.value.trim() || "";
    const notes = body.querySelector("#manualInvoiceNotes")?.value.trim() || "";

    const win = window.open("", "_blank");
    if (!win) {
        message("The invoice window was blocked. Please allow pop-ups for the admin page.", "error");
        return;
    }

    const rowsHtml = lines.map(item => `
        <tr>
            <td>${escapeHTML(item.description)}</td>
            <td style="text-align:center">${item.quantity}</td>
            <td style="text-align:right">GHS ${item.unitPrice.toFixed(2)}</td>
            <td style="text-align:right">GHS ${item.amount.toFixed(2)}</td>
        </tr>`).join("");

    win.document.write(`<!doctype html><html><head><title>${escapeHTML(invoiceNumber)}</title>
        <style>
            :root{--teal:#075957;--teal2:#0f7775;--gold:#d6a542;--ink:#171717;--line:#b7b7b7;--light:#f5faf9}
            *{box-sizing:border-box}
            body{font-family:Arial,Helvetica,sans-serif;color:var(--ink);padding:30px;max-width:920px;margin:auto;background:#fff}
            .invoice-shell{border:2px solid var(--teal);padding:28px}
            .brandbar{height:8px;background:var(--gold);margin:-28px -28px 24px}
            h1{margin:0 0 5px;color:var(--teal);font-size:30px;letter-spacing:.2px}.tagline{font-weight:700}.muted{color:#555}
            .top{display:flex;justify-content:space-between;gap:30px;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid var(--teal)}
            .invoice-title{text-align:right}.invoice-title strong{font-size:24px;color:var(--teal);letter-spacing:1px}
            .billto{border:1.5px solid var(--line);padding:14px 16px;margin-bottom:22px;background:var(--light)}
            .section-title{font-weight:700;color:var(--teal);text-transform:uppercase;font-size:12px;letter-spacing:.8px;margin-bottom:6px}
            table{width:100%;border-collapse:collapse;margin-top:10px;border:2px solid var(--teal)}
            th,td{border:1.5px solid var(--line);padding:11px 12px;text-align:left}
            th{background:#e9f5f4;color:var(--teal);font-weight:700;border-bottom:2px solid var(--teal)}
            tbody tr:nth-child(even){background:#fafafa}
            .totalbox{display:flex;justify-content:flex-end;margin-top:16px}.total{border:2px solid var(--gold);padding:13px 18px;font-size:20px;font-weight:bold;min-width:240px;text-align:right}
            .payment{margin-top:28px;border:2px solid var(--teal);padding:16px;background:var(--light)}
            .footer{margin-top:26px;padding-top:15px;border-top:1.5px solid var(--line);text-align:center}
            .print-btn{margin-top:20px;padding:12px 20px;background:var(--teal);color:#fff;border:0;border-radius:4px;font-weight:700;cursor:pointer}
            @media print{body{padding:0}.invoice-shell{border:0;padding:0}.brandbar{margin:0 0 20px}.no-print{display:none}}
        </style></head><body>
        <div class="invoice-shell"><div class="brandbar"></div>
        <div class="top">
            <div><h1>Aprils Signature</h1><div>Elegance in Every Stitch</div><div class="muted">Winneba, Central Region, Ghana</div></div>
            <div><strong>INVOICE</strong><br>Invoice No: ${escapeHTML(invoiceNumber)}<br>Date: ${escapeHTML(invoiceDate)}</div>
        </div>
        <div class="billto"><div class="section-title">Bill To</div><strong>${escapeHTML(customer)}</strong><br>${escapeHTML(phone)}${email ? "<br>" + escapeHTML(email) : ""}${location ? "<br>" + escapeHTML(location) : ""}</div>
        <table><thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead><tbody>${rowsHtml || "<tr><td colspan='4'>No line items added.</td></tr>"}</tbody></table>
        <div class="totalbox"><div class="total">Total: GHS ${subtotal.toFixed(2)}</div></div>
        ${notes ? `<div style="margin-top:22px"><strong>Notes:</strong><br>${escapeHTML(notes).replace(/\n/g,"<br>")}</div>` : ""}
        <div class="payment"><strong>Payment Details</strong><br>
            ${escapeHTML(payment.invoice_payment_network || "")}
            ${payment.invoice_payment_name ? " — " + escapeHTML(payment.invoice_payment_name) : ""}
            ${payment.invoice_payment_number ? " — " + escapeHTML(payment.invoice_payment_number) : ""}
            ${payment.invoice_payment_note ? "<br>" + escapeHTML(payment.invoice_payment_note).replace(/\n/g,"<br>") : ""}
        </div>
        <div class="footer"><strong>Thank you for choosing Aprils Signature.</strong><div class="muted" style="margin-top:5px">Elegance in Every Stitch</div></div>
        <button class="no-print print-btn" onclick="window.print()">Print / Save Invoice as PDF</button>
        </div></body></html>`);
    win.document.close();
    win.focus();
}

async function loadQuotes() {
    const rawRows = await getRows("quote_requests");
    const rows = groupDuplicateQuotes(rawRows);
    const list = document.getElementById("quoteList");
    if (!list) return;

    list.innerHTML = rows.length ? `
        <table>
            <thead><tr>
                <th>Date</th><th>Name</th><th>Phone</th><th>WhatsApp</th><th>Location</th><th>Services</th><th>Quantity</th><th>Details</th><th>Action</th>
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
                    <td><span style="display:block;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(summarizeQuoteQuantities(row))}</span></td>
                    <td><span style="display:block;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(preview)}</span></td>
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
        button.onclick = () => {
            const row = rows.find(item => String(item.id) === String(button.dataset.generateInvoice));
            if (row) showManualInvoiceBuilder(row);
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
    const rows = (await getRows("policies")).sort((a,b)=>{const na=Number((String(a.title||"").match(/^\s*(\d+)/)||[])[1]||9999); const nb=Number((String(b.title||"").match(/^\s*(\d+)/)||[])[1]||9999); return na-nb||String(a.title||"").localeCompare(String(b.title||""));});
    const list = document.getElementById("policyList");
    if (!list) return;

    list.innerHTML = rows.length ? `
        <table><thead><tr><th>Policy</th><th>Key</th><th>Content</th><th>Actions</th></tr></thead><tbody>
        ${rows.map(row => `<tr>
            <td>${escapeHTML(row.title)}</td>
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
    const invoices = rows.filter(r => String(r.setting_key || "").startsWith("invoice_price_"));
    const list = document.getElementById("invoiceList");
    if (!list) return;

    list.innerHTML = invoices.length ? `
        <table>
            <thead><tr><th>Item / Service</th><th>Category</th><th>Invoice Price (GHS)</th><th>Notes</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
                ${invoices.map(r => {
                    let item = { name: "", category: "", price: "", notes: "", active: true };
                    try { item = { ...item, ...JSON.parse(r.setting_value || "{}") }; } catch (_) {}
                    return `<tr>
                        <td>${escapeHTML(item.name)}</td>
                        <td>${escapeHTML(item.category)}</td>
                        <td>GHS ${Number(item.price || 0).toFixed(2)}</td>
                        <td>${escapeHTML(item.notes)}</td>
                        <td>${item.active === false ? "Inactive" : "Active"}</td>
                        <td>
                            <button type="button" class="secondary" data-edit-invoice="${escapeHTML(r.id)}">Edit</button>
                            <button type="button" class="danger" data-delete-invoice="${escapeHTML(r.id)}">Delete</button> <button type="button" class="secondary" data-share-invoice="${escapeHTML(r.id)}">Share</button>
                        </td>
                    </tr>`;
                }).join("")}
            </tbody>
        </table>
    ` : `<div class="empty"><strong>No internal invoice prices have been added yet.</strong><br>Use “+ Add Invoice Price” above. Once a price is saved, every invoice-price row will have its own <strong>Edit</strong> and <strong>Delete</strong> buttons.</div>`;

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
            document.getElementById("invoiceForm").scrollIntoView({ behavior: "smooth", block: "start" });
        };
    });

    list.querySelectorAll("[data-share-invoice]").forEach(button=>{button.onclick=()=>{const row=invoices.find(r=>String(r.id)===String(button.dataset.shareInvoice));if(!row)return;let item={};try{item=JSON.parse(row.setting_value||"{}");}catch(_){} shareText("Aprils Signature Invoice Price",`Item / Service: ${item.name||""}\nCategory: ${item.category||""}\nUnit Price: GHS ${Number(item.price||0).toFixed(2)}\nNotes: ${item.notes||""}`);};});

    list.querySelectorAll("[data-delete-invoice]").forEach(button => {
        button.onclick = async () => {
            if (!confirm("Delete this internal invoice price?")) return;
            const result = await db.from("settings").delete().eq("id", button.dataset.deleteInvoice);
            if (result.error) {
                message("Invoice price could not be deleted.", "error");
                return;
            }
            message("Invoice price deleted.", "success");
            await loadInvoicePricing();
        };
    });
}

async function loadInvoicePaymentDetails() {
    const rows = await getRows("settings");
    const values = {};
    rows
        .filter(r => ["invoice_payment_number","invoice_payment_name","invoice_payment_network","invoice_payment_note"].includes(String(r.setting_key || "")))
        .forEach(r => { values[r.setting_key] = r.setting_value || ""; });

    const map = {
        invoicePaymentNumber: "invoice_payment_number",
        invoicePaymentName: "invoice_payment_name",
        invoicePaymentNetwork: "invoice_payment_network",
        invoicePaymentNote: "invoice_payment_note"
    };

    Object.entries(map).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) el.value = values[key] || "";
    });

    const box = document.getElementById("invoicePaymentSaved");
    if (!box) return;

    const hasSaved = Object.values(values).some(value => String(value || "").trim() !== "");
    box.innerHTML = hasSaved ? `
        <div class="notice" style="margin-top:12px;">
            <strong>Saved invoice payment details</strong>
            <table style="margin-top:10px;width:100%;border-collapse:collapse;">
                <tbody>
                    <tr><th style="padding:8px;border:1px solid #ccc;text-align:left;">Payment Number</th><td style="padding:8px;border:1px solid #ccc;">${escapeHTML(values.invoice_payment_number || "—")}</td></tr>
                    <tr><th style="padding:8px;border:1px solid #ccc;text-align:left;">Account / MoMo Name</th><td style="padding:8px;border:1px solid #ccc;">${escapeHTML(values.invoice_payment_name || "—")}</td></tr>
                    <tr><th style="padding:8px;border:1px solid #ccc;text-align:left;">Network / Method</th><td style="padding:8px;border:1px solid #ccc;">${escapeHTML(values.invoice_payment_network || "—")}</td></tr>
                    <tr><th style="padding:8px;border:1px solid #ccc;text-align:left;">Payment Note</th><td style="padding:8px;border:1px solid #ccc;">${escapeHTML(values.invoice_payment_note || "—")}</td></tr>
                </tbody>
            </table>
            <div style="margin-top:10px;">
                <button type="button" class="secondary" id="editSavedInvoicePayment">Edit Saved Details</button>
                <button type="button" class="danger" id="deleteSavedInvoicePayment">Delete Saved Details</button>
            </div>
        </div>
    ` : `<div class="empty" style="margin-top:12px;">No invoice payment details have been saved yet.</div>`;

    document.getElementById("editSavedInvoicePayment")?.addEventListener("click", () => {
        document.getElementById("invoicePaymentForm")?.scrollIntoView({behavior:"smooth", block:"start"});
    });

    document.getElementById("deleteSavedInvoicePayment")?.addEventListener("click", async () => {
        if (!confirm("Delete the saved invoice payment details?")) return;
        try {
            for (const key of Object.values(map)) {
                const result = await db.from("settings").delete().eq("setting_key", key);
                if (result.error) throw result.error;
            }
            Object.keys(map).forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = "";
            });
            message("Saved invoice payment details deleted.", "success");
            await loadInvoicePaymentDetails();
        } catch (error) {
            message("Invoice payment details could not be deleted: " + error.message, "error");
        }
    });
}

function setupInvoicePaymentForm(){
    const form=document.getElementById("invoicePaymentForm");if(!form||form.dataset.bound)return;form.dataset.bound="1";
    form.addEventListener("submit",async e=>{
        e.preventDefault();
        const map={invoicePaymentNumber:"invoice_payment_number",invoicePaymentName:"invoice_payment_name",invoicePaymentNetwork:"invoice_payment_network",invoicePaymentNote:"invoice_payment_note"};
        try{
            for(const [id,key] of Object.entries(map)){
                const value=document.getElementById(id)?.value.trim()||"";
                await safeSettingUpsert(key,value);
            }
            message("Invoice payment details saved.","success");
            await loadInvoicePaymentDetails();
        }catch(error){message("Invoice payment details could not be saved: "+error.message,"error");}
    });
    loadInvoicePaymentDetails();
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
        const price = Number(document.getElementById("invoicePrice").value);
        const notes = document.getElementById("invoiceNotes").value.trim();
        const active = document.getElementById("invoiceActive").checked;

        if (!name || Number.isNaN(price)) {
            message("Please enter an item/service and a valid price.", "error");
            return;
        }

        const payload = {
            setting_key: invoiceStorageKey(name),
            setting_value: JSON.stringify({ name, category, price, notes, active }),
            updated_at: new Date().toISOString()
        };

        try {
            await safeSettingUpsert(payload.setting_key, payload.setting_value);
            if (id) {
                const oldRow = await db.from("settings").select("setting_key").eq("id",id).maybeSingle();
                if (!oldRow.error && oldRow.data?.setting_key && oldRow.data.setting_key !== payload.setting_key) {
                    await db.from("settings").delete().eq("id",id);
                }
            }

            form.reset();
            document.getElementById("invoiceId").value = "";
            document.getElementById("invoiceActive").checked = true;
            message("Invoice price saved separately from public pricing.", "success");
            await loadInvoicePricing();
        } catch (error) {
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

async function loadSocial(){const rows=await getRows("settings"),sr=rows.filter(r=>String(r.setting_key||"").toLowerCase().startsWith("social_")),list=document.getElementById("socialList");if(!list)return;list.innerHTML=sr.length?`<table><thead><tr><th>Platform</th><th>Link / Number</th><th>Actions</th></tr></thead><tbody>${sr.map(r=>`<tr><td>${escapeHTML(String(r.setting_key).replace(/^social_/i,"").replace(/_/g," "))}</td><td>${escapeHTML(r.setting_value||"")}</td><td><button type="button" class="secondary" data-edit-social="${r.id}">Edit</button> <button type="button" class="danger" data-delete-social="${r.id}">Delete</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">No social links have been added yet.</div>`;list.querySelectorAll("[data-edit-social]").forEach(b=>b.onclick=()=>{const r=sr.find(x=>String(x.id)===String(b.dataset.editSocial));if(!r)return;document.getElementById("socialId").value=r.id||"";const p=String(r.setting_key||"").replace(/^social_/i,"").replace(/_/g," ");document.getElementById("socialPlatform").value=["TikTok","Instagram","Facebook","WhatsApp","Other"].includes(p)?p:"Other";document.getElementById("socialUrl").value=r.setting_value||"";document.getElementById("socialForm").scrollIntoView({behavior:"smooth",block:"start"});});list.querySelectorAll("[data-delete-social]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this social link?"))return;const r=await db.from("settings").delete().eq("id",b.dataset.deleteSocial);if(r.error){message("Social link could not be deleted.","error");return;}message("Social link deleted.","success");await loadSocial();});}
function setupSocialForm(){const f=document.getElementById("socialForm");if(!f||f.dataset.bound)return;f.dataset.bound="1";f.addEventListener("submit",async e=>{e.preventDefault();const id=document.getElementById("socialId").value.trim(),p=document.getElementById("socialPlatform").value.trim(),v=document.getElementById("socialUrl").value.trim(),k="social_"+p.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");try{let r;if(id){r=await db.from("settings").update({setting_key:k,setting_value:v,updated_at:new Date().toISOString()}).eq("id",id);if(r.error)throw r.error;}else{await safeSettingUpsert(k,v);}f.reset();document.getElementById("socialId").value="";message("Social link saved.","success");await loadSocial();}catch(err){console.error(err);message("Social link could not be saved: "+err.message,"error");}});document.getElementById("socialCancel")?.addEventListener("click",()=>{f.reset();document.getElementById("socialId").value="";});}

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
            message("Contact information saved.", "success");
        } catch (error) {
            console.error(error);
            message("Contact information could not be saved: " + error.message, "error");
        }
    });
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
                    <img src="${escapeHTML(logo.setting_value)}"
                         alt="Current saved logo">
                    <button type="button" class="danger" id="deleteCurrentLogo">
                        Delete Current Logo
                    </button>
                </div>`;
        } else {
            preview.innerHTML = `
                <div class="current-logo-preview empty-logo">
                    <strong>No saved public logo</strong>
                    <span>The original project logo remains available as a project file.</span>
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
            && !key.startsWith("site_link_")
            && !key.startsWith("hidden_content_")
            && !key.startsWith("social_");
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
    ["Rhinestone Embellishment",2],
    ["Fashion Creations",3],
    ["Featured Collection",4],
    ["Embellishment Projects",5]
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
        ["1. Payment Policy", "payment_policy", "A minimum of 75% of the total cost must be paid before production begins.\n\nFor orders being picked up or collected, the remaining balance must be paid before or at the time of collection.\n\nFor delivery orders, the remaining balance must be paid in full before the order is dispatched.\n\nFor any form of fashion training\nFull payment must be made before start of class or section."],
        ["2. Refund Policy", "refund_policy", "At Aprils Signature, every order is custom-made or made-to-order with care and attention to detail. For this reason, we encourage customers to review all order details carefully before confirming their orders.\n\nThe 75% deposit paid before production begins is non-refundable once production has started.\n\nIf a customer chooses to cancel an order before production begins, any refund will be considered on a case-by-case basis, depending on any costs already incurred.\n\nRefunds will not be issued for changes of mind after production has commenced.\n\nIf an item is found to have a genuine workmanship defect, customers should contact us within 48 hours of receiving the item so we can assess the issue and provide an appropriate solution, which may include alterations, repairs, or another suitable remedy where applicable.\n\nRefunds do not apply to issues arising from incorrect measurements or information provided by the customer.\n\nCustomer satisfaction is important to us. We encourage all customers to communicate any concerns as soon as possible so that we can work together to find a fair and satisfactory solution.\n\nFor any form of training\nPayments made are not refundable or transferrable as such, prospective trainees must do their due diligence and be certain of taking the class before any payment is made."],
        ["3. Delivery & Collection Policy", "delivery_collection_policy", "At Aprils Signature, every item is custom-made or made-to-order. Completion and delivery times vary depending on the design, order complexity, and current workload.\n\nCustomers will be informed of the estimated completion date after their order has been confirmed.\n\nCustomers who choose pickup/collection will be notified when their order is ready.\n\nFor delivery orders, dispatch will be arranged after the order has been completed and the outstanding balance has been paid in full.\n\nDelivery charges, where applicable, will be communicated before dispatch.\n\nWhile we make every effort to meet agreed timelines, unforeseen circumstances may occasionally cause delays. In such cases, customers will be informed promptly.\n\nWe also encourage customers to provide accurate delivery information to ensure a smooth delivery process."],
        ["4. Privacy Policy", "privacy_policy", "At Aprils Signature, we value your privacy and are committed to protecting your personal information.\n\nAny information you provide through our website, including contact forms, quote requests, training applications, and order enquiries, is used solely to provide our services and communicate with you regarding your request.\n\nThe information we may collect includes: Name; Phone number; Email address; Delivery or pickup details; Measurements; Uploaded photos or mock-ups; Any other information you choose to provide.\n\nYour personal information will not be sold, rented, or shared with third parties except where necessary to provide our services or where required by law.\n\nWe take reasonable steps to keep your information secure and use it only for legitimate business purposes.\n\nIf you have any questions about how your personal information is used, please contact us and we will be happy to assist you.\n\nBy using our website and submitting your information, you agree to the terms of this Privacy Policy."]
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
    setupCustomerDirectLinks();

    setupGalleryForm();
    setupTrainingForm();
    setupTestimonialForm();
    setupFAQForm();
    setupPolicyForm();
    setupContentForm();
    setupInvoiceForm();
    setupInvoicePaymentForm();
    setupWebsiteLinksForm();
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
