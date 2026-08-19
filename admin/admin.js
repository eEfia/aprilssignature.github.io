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

async function checkSession() {
    if (!db) return;
    const result = await db.auth.getSession();
    const login = document.getElementById("loginScreen");
    if (!login) return;

    if (result.data.session) {
        login.style.display = "none";
        await seedInitialPublicContent();
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
        if (id === "training") await loadTraining();
        if (id === "registrations") await loadRegistrations();
        if (id === "orders") await loadQuotes();
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
        const result = await db.from("gallery_collections").select("name,active").order("name");
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
                const result = await db.from("gallery_collections").insert({ name: cleanName, active: true });
                if (result.error) throw result.error;

                await renderGalleryCategorySelect(cleanName);
                message("Collection added.", "success");
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

    list.innerHTML = `
        <div class="admin-actions">
            <button type="button" class="primary" id="newGalleryItemButton">+ Add Gallery Item</button>
            <button type="button" class="secondary" id="newGalleryCollectionButton">+ Add New Collection</button>
        </div>
        ${rows.length ? `
        <table>
            <thead>
                <tr>
                    <th>Image</th>
                    <th>Title</th>
                    <th>Collection</th>
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
                        <td>${escapeHTML(row.category)}</td>
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
}

async function addGalleryCollection() {
    const name = window.prompt("Enter the new collection name:");
    if (!name) return;

    const cleanName = name.trim();
    if (!cleanName) return;

    try {
        const result = await db.from("gallery_collections").insert({ name: cleanName, active: true });
        if (result.error) throw result.error;
        await renderGalleryCategorySelect(cleanName);
        message("Collection added.", "success");
    } catch (error) {
        console.error(error);
        message("Collection could not be added. Check the gallery_collections table and its permissions.", "error");
    }
}

function newGalleryItem() {
    const form = document.getElementById("galleryForm");
    if (!form) return;
    form.reset();
    document.getElementById("galleryId").value = "";
    document.getElementById("galleryActive").checked = true;
    renderGalleryCategorySelect("");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editGallery(row) {
    document.getElementById("galleryId").value = row.id;
    document.getElementById("galleryTitle").value = row.title || "";
    renderGalleryCategorySelect(row.category || "");
    document.getElementById("galleryImage").value = row.image_url || "";
    document.getElementById("galleryDescription").value = row.description || "";
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
            featured: document.getElementById("galleryFeatured").checked,
            active: document.getElementById("galleryActive").checked,
            updated_at: new Date().toISOString()
        };

        if (!data.title) {
            message("Please enter a gallery title.", "error");
            return;
        }

        try {
            const result = id
                ? await db.from("gallery_items").update(data).eq("id", id)
                : await db.from("gallery_items").insert(data);

            if (result.error) throw result.error;

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

async function loadServices() {
    const section = document.getElementById("services");
    if (!section) return;

    let result = await db.from("admin_services").select("*").order("created_at", { ascending: false });
    if (result.error && /created_at/i.test(result.error.message || "")) {
        result = await db.from("admin_services").select("*");
    }
    if (result.error) throw result.error;

    const rows = result.data || [];

    section.innerHTML = `
        <h2>Services</h2>
        <p class="intro">Add, edit and remove the services displayed on the website.</p>

        <div class="form-card">
            <form id="adminServiceForm">
                <input type="hidden" id="adminServiceId">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Service Name</label>
                        <input type="text" id="adminServiceTitle" required placeholder="Service name">
                    </div>
                    <div class="form-group">
                        <label>Category</label>
                        <input type="text" id="adminServiceCategory" placeholder="Category">
                    </div>
                </div>

                <div class="form-group">
                    <label>Description</label>
                    <textarea id="adminServiceDescription" rows="5" placeholder="Describe this service"></textarea>

                <div class="form-group">
                    <label>Price (GHS)</label>
                    <input type="number" id="adminServicePrice" min="0" step="0.01" placeholder="e.g. 900.00">
                </div>
                </div>

                <label class="checkbox">
                    <input type="checkbox" id="adminServiceActive" checked> Active
                </label>
                <br>
                <button class="primary" type="submit">Save Service</button>
                <button class="secondary" type="button" id="adminServiceCancel">Cancel</button>
            </form>
        </div>

        <div id="adminServicesList" class="table-wrap"></div>
    `;

    renderServices(rows);
    setupServiceForm();

    makeCategorySelect("adminServiceCategory", await getServiceCategories(), "", "+ Add New Category");
}

function renderServices(rows) {
    const list = document.getElementById("adminServicesList");
    if (!list) return;

    list.innerHTML = rows.length ? `
        <table>
            <thead><tr>
                <th>Service</th><th>Category</th><th>Description</th><th>Price (GHS)</th><th>Active</th><th>Actions</th>
            </tr></thead>
            <tbody>
                ${rows.map(row => `
                    <tr>
                        <td>${escapeHTML(row.title)}</td>
                        <td>${escapeHTML(row.category)}</td>
                        <td>${escapeHTML(row.description)}</td>
                        <td>${row.price != null && row.price !== "" ? `GHS ${Number(row.price).toFixed(2)}` : "—"}</td>
                        <td>${row.active ? "Yes" : "No"}</td>
                        <td>
                            <button type="button" class="secondary" data-edit-service="${row.id}">Edit</button>
                            <button type="button" class="danger" data-delete-service="${row.id}">Delete</button>
                        </td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    ` : `<div class="empty">No services have been added yet.</div>`;

    list.querySelectorAll("[data-edit-service]").forEach(button => {
        button.onclick = () => {
            const row = rows.find(item => String(item.id) === String(button.dataset.editService));
            if (!row) return;

            document.getElementById("adminServiceId").value = row.id;
            document.getElementById("adminServiceTitle").value = row.title || "";
            makeCategorySelect("adminServiceCategory", [...new Set([...DEFAULT_SERVICE_CATEGORIES, ...(rows.map(r => r.category).filter(Boolean))])], row.category || "", "+ Add New Category");
            document.getElementById("adminServiceDescription").value = row.description || "";
            document.getElementById("adminServicePrice").value = row.price ?? "";
            document.getElementById("adminServiceActive").checked = row.active !== false;
            document.getElementById("services").scrollIntoView({ behavior: "smooth", block: "start" });
        };
    });

    list.querySelectorAll("[data-delete-service]").forEach(button => {
        button.onclick = async () => {
            const row = rows.find(item => String(item.id) === String(button.dataset.deleteService));
            if (!row || !confirm(`Delete "${row.title}"?`)) return;

            const result = await db.from("admin_services").delete().eq("id", button.dataset.deleteService);
            if (result.error) {
                message("Service could not be deleted: " + result.error.message, "error");
                return;
            }

            message("Service deleted.", "success");
            await loadServices();
        };
    });
}

function setupServiceForm() {
    const form = document.getElementById("adminServiceForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const id = document.getElementById("adminServiceId").value.trim();
        const payload = {
            title: document.getElementById("adminServiceTitle").value.trim(),
            category: document.getElementById("adminServiceCategory").value.trim(),
            description: document.getElementById("adminServiceDescription").value.trim(),
            price: document.getElementById("adminServicePrice").value === "" ? null : Number(document.getElementById("adminServicePrice").value),
            active: document.getElementById("adminServiceActive").checked,
            updated_at: new Date().toISOString()
        };

        if (!payload.title) {
            message("Please enter a service name.", "error");
            return;
        }

        try {
            const result = id
                ? await db.from("admin_services").update(payload).eq("id", id)
                : await db.from("admin_services").insert(payload);

            if (result.error) throw result.error;

            form.reset();
            document.getElementById("adminServiceId").value = "";
            document.getElementById("adminServiceActive").checked = true;
            message("Service saved successfully.", "success");
            await loadServices();
        } catch (error) {
            console.error(error);
            message("Service could not be saved: " + error.message, "error");
        }
    });

    document.getElementById("adminServiceCancel")?.addEventListener("click", () => {
        form.reset();
        document.getElementById("adminServiceId").value = "";
        document.getElementById("adminServiceActive").checked = true;
    });
}

/* =========================================================
   TRAINING
========================================================= */

async function loadTraining() {
    const list = document.getElementById("trainingList");
    if (!list) return;

    const rows = await getRows("training_programs");

    list.innerHTML = `
        <div class="admin-actions">
            <button type="button" class="primary" id="newTrainingButton">+ Add Training Programme / Class</button>
        </div>
        ${rows.length ? `
        <table>
            <thead><tr>
                <th>Programme/Class</th><th>Duration</th><th>Price (GHS)</th><th>Category</th><th>Active</th><th>Actions</th>
            </tr></thead>
            <tbody>
                ${rows.map(row => `
                    <tr>
                        <td>${escapeHTML(row.title)}</td>
                        <td>${escapeHTML(row.duration)}</td>
                        <td>${row.price != null && row.price !== "" ? `GHS ${Number(row.price).toFixed(2)}` : "—"}</td>
                        <td>${escapeHTML(row.category)}</td>
                        <td>${row.active ? "Yes" : "No"}</td>
                        <td>
                            <button type="button" class="secondary" data-edit-training="${row.id}">Edit</button>
                            <button type="button" class="danger" data-delete-training="${row.id}">Delete</button>
                        </td>
                    </tr>
                `).join("")}
            </tbody>
        </table>` : `<div class="empty">No training programmes yet.</div>`}
    `;

    document.getElementById("newTrainingButton").onclick = newTraining;

    list.querySelectorAll("[data-edit-training]").forEach(button => {
        button.onclick = () => {
            const row = rows.find(item => String(item.id) === String(button.dataset.editTraining));
            if (row) editTraining(row);
        };
    });

    list.querySelectorAll("[data-delete-training]").forEach(button => {
        button.onclick = () => deleteTraining(button.dataset.deleteTraining);
    });

    makeCategorySelect("trainingCategory", await getTrainingCategories(), document.getElementById("trainingCategory")?.value || "", "+ Add New Category");
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
    document.getElementById("trainingPrice").value = row.price ?? "";
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
        const payload = {
            title: document.getElementById("trainingTitle").value.trim(),
            duration: document.getElementById("trainingDuration").value.trim(),
            price: document.getElementById("trainingPrice").value === "" ? null : Number(document.getElementById("trainingPrice").value),
            category: document.getElementById("trainingCategory").value.trim(),
            description: document.getElementById("trainingDescription").value.trim(),
            active: document.getElementById("trainingActive").checked,
            updated_at: new Date().toISOString()
        };

        try {
            const result = id
                ? await db.from("training_programs").update(payload).eq("id", id)
                : await db.from("training_programs").insert(payload);

            if (result.error) throw result.error;

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
    const excluded = new Set(["journey","request_details","details","message","uploads"]);
    const fields = Object.entries(row || {}).filter(([key]) => !excluded.has(key) && key !== "id").map(([key,value]) => {
        let text = value;
        if (key === "created_at" && value) text = new Date(value).toLocaleString();
        return `<div class="submission-field"><strong>${escapeHTML(key.replace(/_/g," "))}</strong><div>${escapeHTML(text ?? "—")}</div></div>`;
    }).join("");
    let parsed = null;
    try { parsed = typeof detailsText === "string" ? JSON.parse(detailsText) : detailsText; } catch (_) {}
    let details = parsed && typeof parsed === "object" ? Object.entries(parsed).filter(([k])=>k!=="uploads").map(([k,v])=>`<div class="submission-field"><strong>${escapeHTML(k.replace(/([A-Z])/g," $1").replace(/_/g," "))}</strong><div>${escapeHTML(typeof v === "object" ? JSON.stringify(v) : v)}</div></div>`).join("") : (detailsText ? `<div class="submission-field"><strong>Additional details</strong><div>${escapeHTML(detailsText)}</div></div>` : "");
    const uploadHtml = (uploads || []).length ? `<h3>Attached Images</h3><div class="submission-uploads">${uploads.map(u=>`<a href="${escapeHTML(u.url || u.path || u)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHTML(u.url || u.path || u)}" alt="Customer upload"><span>Open image</span></a>`).join("")}</div>` : "<p><strong>Attached Images:</strong> None</p>";
    body.innerHTML = `<h2>${escapeHTML(title)}</h2><div class="submission-fields">${fields}</div>${details}<hr>${uploadHtml}`;
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
            <th>Date</th><th>Name</th><th>Phone</th><th>Course</th><th>Location</th><th>Action</th>
        </tr></thead><tbody>
        ${rows.map(row => `<tr>
            <td>${escapeHTML(row.created_at ? new Date(row.created_at).toLocaleString() : "")}</td>
            <td>${escapeHTML(row.full_name)}</td>
            <td>${escapeHTML(row.phone)}</td>
            <td>${escapeHTML(row.course)}</td>
            <td>${escapeHTML(row.location)}</td>
            <td><button type="button" class="secondary" data-view-registration="${row.id}">View Full Details</button></td>
        </tr>`).join("")}
        </tbody></table>
    ` : `<div class="empty">No training registrations received.</div>`;

    list.querySelectorAll("[data-view-registration]").forEach(button => {
        button.onclick = () => {
            const row = rows.find(item => String(item.id) === String(button.dataset.viewRegistration));
            if (row) showSubmissionDetails("Training Registration Details", row, "");
        };
    });
}


async function loadQuotes() {
    const rows = await getRows("quote_requests");
    const list = document.getElementById("quoteList");
    if (!list) return;

    list.innerHTML = rows.length ? `
        <table><thead><tr>
            <th>Date</th><th>Name</th><th>Phone</th><th>WhatsApp</th><th>Location</th><th>Services</th><th>Details</th><th>Action</th>
        </tr></thead><tbody>
        ${rows.map(row => {
            let details = row.journey || row.request_details || row.details || row.message || "";
            let uploads = [];
            try {
                const parsed = typeof details === "string" ? JSON.parse(details) : details;
                if (parsed && Array.isArray(parsed.uploads)) uploads = parsed.uploads;
            } catch (_) {}
            const preview = typeof details === "object" ? JSON.stringify(details) : String(details);
            return `<tr>
                <td>${escapeHTML(row.created_at ? new Date(row.created_at).toLocaleString() : "")}</td>
                <td>${escapeHTML(row.full_name)}</td>
                <td>${escapeHTML(row.phone)}</td>
                <td>${escapeHTML(row.whatsapp)}</td>
                <td>${escapeHTML(row.location)}</td>
                <td>${escapeHTML(row.service)}</td>
                <td><span style="display:block;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(preview)}</span></td>
                <td><button type="button" class="secondary" data-view-quote="${row.id}">View Full Details</button></td>
            </tr>`;
        }).join("")}
        </tbody></table>
    ` : `<div class="empty">No quote requests received.</div>`;

    list.querySelectorAll("[data-view-quote]").forEach(button => {
        button.onclick = () => {
            const row = rows.find(item => String(item.id) === String(button.dataset.viewQuote));
            if (!row) return;
            let details = row.journey || row.request_details || row.details || row.message || "";
            let uploads = [];
            try {
                const parsed = typeof details === "string" ? JSON.parse(details) : details;
                if (parsed && Array.isArray(parsed.uploads)) uploads = parsed.uploads;
            } catch (_) {}
            showSubmissionDetails("Customer Order / Quote Details", row, typeof details === "object" ? JSON.stringify(details, null, 2) : details, uploads);
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
                <button type="button" class="danger" data-delete-testimonial="${row.id}">Delete</button>
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
                <button type="button" class="danger" data-delete-policy="${row.id}">Delete</button>
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

async function loadContent() {
 const rows=await getRows("site_content"),list=document.getElementById("contentList"); if(!list)return;
 list.innerHTML=rows.length?`<table><thead><tr><th>Content Name</th><th>Current Content</th><th>Actions</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeHTML(r.content_key||"")}</td><td><pre style="white-space:pre-wrap;max-width:650px;font-family:inherit">${escapeHTML(r.content_value||"")}</pre></td><td><button type="button" class="secondary" data-edit-content="${r.id}">Edit</button> <button type="button" class="danger" data-delete-content="${r.id}">Delete</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">No editable website content has been added yet.</div>`;
 list.querySelectorAll("[data-edit-content]").forEach(b=>b.onclick=()=>{const r=rows.find(x=>String(x.id)===String(b.dataset.editContent));if(!r)return;document.getElementById("contentId").value=r.id||"";document.getElementById("contentKey").value=r.content_key||"";document.getElementById("contentValue").value=r.content_value||"";document.getElementById("contentForm").scrollIntoView({behavior:"smooth",block:"start"});});
 list.querySelectorAll("[data-delete-content]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this website content item?"))return;const r=await db.from("site_content").delete().eq("id",b.dataset.deleteContent);if(r.error){message("Website content could not be deleted.","error");return;}message("Website content deleted.","success");await loadContent();});
}
function setupContentForm(){const f=document.getElementById("contentForm");if(!f||f.dataset.bound)return;f.dataset.bound="1";f.addEventListener("submit",async e=>{e.preventDefault();const id=document.getElementById("contentId").value.trim(),key=document.getElementById("contentKey").value.trim(),value=document.getElementById("contentValue").value.trim();if(!key||!value)return;try{const r=id?await db.from("site_content").update({content_key:key,content_value:value,updated_at:new Date().toISOString()}).eq("id",id):await db.from("site_content").insert({content_key:key,content_value:value});if(r.error)throw r.error;f.reset();document.getElementById("contentId").value="";message("Website content saved.","success");await loadContent();}catch(err){console.error(err);message("Website content could not be saved: "+err.message,"error");}});document.getElementById("contentCancel")?.addEventListener("click",()=>{f.reset();document.getElementById("contentId").value="";});}
async function loadSocial(){const rows=await getRows("settings"),sr=rows.filter(r=>String(r.setting_key||"").toLowerCase().startsWith("social_")),list=document.getElementById("socialList");if(!list)return;list.innerHTML=sr.length?`<table><thead><tr><th>Platform</th><th>Link / Number</th><th>Actions</th></tr></thead><tbody>${sr.map(r=>`<tr><td>${escapeHTML(String(r.setting_key).replace(/^social_/i,"").replace(/_/g," "))}</td><td>${escapeHTML(r.setting_value||"")}</td><td><button type="button" class="secondary" data-edit-social="${r.id}">Edit</button> <button type="button" class="danger" data-delete-social="${r.id}">Delete</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">No social links have been added yet.</div>`;list.querySelectorAll("[data-edit-social]").forEach(b=>b.onclick=()=>{const r=sr.find(x=>String(x.id)===String(b.dataset.editSocial));if(!r)return;document.getElementById("socialId").value=r.id||"";const p=String(r.setting_key||"").replace(/^social_/i,"").replace(/_/g," ");document.getElementById("socialPlatform").value=["TikTok","Instagram","Facebook","WhatsApp","Other"].includes(p)?p:"Other";document.getElementById("socialUrl").value=r.setting_value||"";document.getElementById("socialForm").scrollIntoView({behavior:"smooth",block:"start"});});list.querySelectorAll("[data-delete-social]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this social link?"))return;const r=await db.from("settings").delete().eq("id",b.dataset.deleteSocial);if(r.error){message("Social link could not be deleted.","error");return;}message("Social link deleted.","success");await loadSocial();});}
function setupSocialForm(){const f=document.getElementById("socialForm");if(!f||f.dataset.bound)return;f.dataset.bound="1";f.addEventListener("submit",async e=>{e.preventDefault();const id=document.getElementById("socialId").value.trim(),p=document.getElementById("socialPlatform").value.trim(),v=document.getElementById("socialUrl").value.trim(),k="social_"+p.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");try{const r=id?await db.from("settings").update({setting_key:k,setting_value:v,updated_at:new Date().toISOString()}).eq("id",id):await db.from("settings").upsert({setting_key:k,setting_value:v,updated_at:new Date().toISOString()},{onConflict:"setting_key"});if(r.error)throw r.error;f.reset();document.getElementById("socialId").value="";message("Social link saved.","success");await loadSocial();}catch(err){console.error(err);message("Social link could not be saved: "+err.message,"error");}});document.getElementById("socialCancel")?.addEventListener("click",()=>{f.reset();document.getElementById("socialId").value="";});}

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

async function loadSettings() {
    const rows = await getRows("settings");
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

    list.querySelectorAll("[data-edit-setting]").forEach(button => { button.onclick = () => { const row = rows.find(item => String(item.id) === String(button.dataset.editSetting)); if (!row) return; document.getElementById("settingKey").value=row.setting_key||""; document.getElementById("settingValue").value=row.setting_value||""; document.getElementById("settingsForm").scrollIntoView({behavior:"smooth",block:"start"}); }; });

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

        const key = document.getElementById("settingKey").value.trim();
        const value = document.getElementById("settingValue").value.trim();

        try {
            const existing = await db.from("settings").select("id").eq("setting_key", key).maybeSingle();
            const result = existing.data?.id
                ? await db.from("settings").update({ setting_value: value, updated_at: new Date().toISOString() }).eq("id", existing.data.id)
                : await db.from("settings").insert({ setting_key: key, setting_value: value });

            if (result.error) throw result.error;
            form.reset();
            message("Setting saved.", "success");
            await loadSettings();
        } catch (error) {
            console.error(error);
            message("Setting could not be saved: " + error.message, "error");
        }
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
        const gallery = await db.from("gallery_items").select("id,title,image_url");
        if (!gallery.error) {
            const existing = new Set((gallery.data || []).map(r => `${r.title || ""}\u0000${r.image_url || ""}`));
            const missing = INITIAL_GALLERY_ITEMS
                .filter(([title, , image_url]) => !existing.has(`${title}\u0000${image_url}`))
                .map(([title, category, image_url]) => ({ title, category, image_url, featured: category === "Featured Collection", active: true }));
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

    setupGalleryForm();
    setupTrainingForm();
    setupTestimonialForm();
    setupFAQForm();
    setupPolicyForm();
    setupContentForm();
    setupContactForm();
    setupSocialForm();
    setupSettingsForm();

    await checkSession();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startAdmin);
} else {
    startAdmin();
}
