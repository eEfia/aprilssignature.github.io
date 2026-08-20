(function () {

"use strict";


/* =========================================================
   APRILS SIGNATURE - MAIN JAVASCRIPT
========================================================= */


/* =========================================================
   SUPABASE
========================================================= */


function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getSupabase() {

    return (
        window.aprilsSupabase ||
        window.AprilsSupabase ||
        null
    );

}


function waitForSupabase() {

    return new Promise(function (resolve) {

        const existing = getSupabase();

        if (existing) {
            resolve(existing);
            return;
        }

        let attempts = 0;

        const timer = setInterval(function () {

            attempts++;

            const client = getSupabase();

            if (client) {

                clearInterval(timer);
                resolve(client);
                return;

            }

            if (attempts >= 100) {

                clearInterval(timer);
                resolve(null);

            }

        }, 100);

    });

}


/* =========================================================
   MOBILE MENU
========================================================= */


function normalizeEmailLinks() {
    document.querySelectorAll("a").forEach(function (link) {
        const text = (link.textContent || "").trim();
        const href = String(link.getAttribute("href") || "");
        const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/i);

        if (match || /^mailto:/i.test(href) || /mail\.google\.com/i.test(href)) {
            const email = match ? match[0] : "info@aprilssignature.com";
            link.setAttribute("href", "mailto:" + email);
            link.removeAttribute("target");
            link.removeAttribute("rel");
        }
    });
}

function setupMobileMenu() {

    const button =
        document.querySelector(".menu-toggle");

    const navigation =
        document.querySelector(".main-navigation");

    if (!button || !navigation) {
        return;
    }

    button.addEventListener("click", function () {

        const open =
            button.getAttribute("aria-expanded") === "true";

        button.setAttribute(
            "aria-expanded",
            String(!open)
        );

        navigation.classList.toggle("open");

    });


    navigation
        .querySelectorAll("a")
        .forEach(function (link) {

            link.addEventListener("click", function () {

                button.setAttribute(
                    "aria-expanded",
                    "false"
                );

                navigation.classList.remove("open");

            });

        });

}


/* =========================================================
   COPYRIGHT
========================================================= */

function setupCopyright() {

    const element =
        document.getElementById("copyrightYear");

    if (element) {

        element.textContent =
            new Date().getFullYear();

    }

}


/* =========================================================
   GOOGLE REVIEW
========================================================= */

function setupGoogleReview() {

    const reviewURL =
        "https://g.page/r/CcD7hxB7NK7pEAE/review";

    document
        .querySelectorAll("[data-google-review]")
        .forEach(function (link) {

            link.href = reviewURL;
            link.target = "_blank";
            link.rel = "noopener noreferrer";

        });

}


/* =========================================================
   COMMON MESSAGE
========================================================= */

function showFormMessage(element, text, success) {

    if (!element) {
        return;
    }

    element.textContent = text;

    element.style.display = "block";

    element.style.background =
        success
            ? "#e8f7ee"
            : "#fff0f0";

    element.style.color =
        success
            ? "#145c31"
            : "#8a0018";

    element.style.borderLeft =
        success
            ? "4px solid #168544"
            : "4px solid #b00020";

    element.style.padding = "16px";

    element.style.marginTop = "20px";

    element.style.borderRadius = "5px";

}


/* =========================================================
   REMOVE REQUIRED FROM TRAINING WHATSAPP
========================================================= */

function setupTrainingWhatsApp() {

    const field =
        document.getElementById("trainingWhatsapp");

    if (!field) {
        return;
    }

    field.required = false;

    const label =
        field.closest(".form-group")
            ?.querySelector("label");

    if (label) {

        label.innerHTML =
            label.innerHTML.replace(
                /<span[^>]*class=["']required["'][^>]*>\s*\*\s*<\/span>/i,
                ""
            );

    }

}


/* =========================================================
   TRAINING REGISTRATION
========================================================= */

function setupTrainingForm() {

    const form =
        document.getElementById("trainingForm");

    if (!form || form.dataset.formFixesBound === "1") {
        return;
    }


    const button =
        document.getElementById(
            "trainingSubmitButton"
        );


    const message =
        document.getElementById(
            "trainingFormMessage"
        );


    setupTrainingWhatsApp();


    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            if (button) {

                button.disabled = true;

                button.textContent =
                    "Submitting...";

            }


            try {

                const supabase =
                    await waitForSupabase();

                if (!supabase) {

                    throw new Error(
                        "Supabase connection unavailable."
                    );

                }


                const data =
                    new FormData(form);


                const payload = {

                    full_name:
                        String(
                            data.get("fullName") || ""
                        ).trim(),

                    phone:
                        String(
                            data.get("phone") || ""
                        ).trim(),

                    whatsapp:
                        String(
                            data.get("whatsapp") || ""
                        ).trim(),

                    location:
                        String(
                            data.get("location") || ""
                        ).trim(),

                    course:
                        String(
                            data.get("course") || ""
                        ).trim(),

                    email:
                        String(
                            data.get("email") || ""
                        ).trim(),

                    message:
                        String(
                            data.get("message") || ""
                        ).trim()

                };


                if (!payload.full_name) {
                    throw new Error(
                        "Full name is required."
                    );
                }

                if (!payload.phone) {
                    throw new Error(
                        "Phone number is required."
                    );
                }

                if (!payload.location) {
                    throw new Error(
                        "Location is required."
                    );
                }

                if (!payload.course) {
                    throw new Error(
                        "Course is required."
                    );
                }


                const result =
                    await supabase
                        .from(
                            "training_registrations"
                        )
                        .insert([payload]);


                if (result.error) {

                    console.error(
                        "Training registration error:",
                        result.error
                    );

                    throw result.error;

                }


                showFormMessage(
                    message,
                    "Thank you! Your training registration has been received successfully. Aprils Signature will review your registration and contact you shortly with the next steps.",
                    true
                );


                form.reset();

                setupTrainingWhatsApp();


                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });


            } catch (error) {

                console.error(
                    "TRAINING ERROR:",
                    error
                );


                showFormMessage(
                    message,
                    "We could not submit your registration right now. Please try again. If the problem continues, contact Aprils Signature directly.",
                    false
                );


            } finally {

                if (button) {

                    button.disabled = false;

                    button.textContent =
                        "Submit Training Registration";

                }

            }

        }
    );

}


/* =========================================================
   ENQUIRY
========================================================= */

function setupEnquiryForm() {

    const form =
        document.getElementById("enquiryForm");

    if (!form) {
        return;
    }


    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const button =
                form.querySelector(
                    'button[type="submit"]'
                );


            const message =
                document.getElementById(
                    "enquiryFormMessage"
                );


            if (button) {

                button.disabled = true;
                button.textContent = "Sending...";

            }


            try {

                const supabase =
                    await waitForSupabase();

                if (!supabase) {
                    throw new Error(
                        "Supabase unavailable."
                    );
                }


                const data =
                    new FormData(form);


                const payload = {

                    full_name:
                        String(
                            data.get("fullName") || ""
                        ).trim(),

                    phone:
                        String(
                            data.get("phone") || ""
                        ).trim(),

                    whatsapp:
                        String(
                            data.get("whatsapp") || ""
                        ).trim(),

                    email:
                        String(
                            data.get("email") || ""
                        ).trim(),

                    subject:
                        String(
                            data.get("subject") || ""
                        ).trim(),

                    message:
                        String(
                            data.get("message") ||
                            data.get("enquiry") ||
                            ""
                        ).trim()

                };


                const result =
                    await supabase
                        .from("enquiries")
                        .insert([payload]);


                if (result.error) {
                    throw result.error;
                }


                showFormMessage(
                    message,
                    "Thank you for contacting Aprils Signature. Your enquiry has been received successfully. We will get back to you shortly.",
                    true
                );


                form.reset();


            } catch (error) {

                console.error(
                    "ENQUIRY ERROR:",
                    error
                );


                showFormMessage(
                    message,
                    "Your enquiry could not be submitted right now. Please try again.",
                    false
                );


            } finally {

                if (button) {

                    button.disabled = false;
                    button.textContent = "Submit";

                }

            }

        }
    );

}


/* =========================================================
   QUOTE FORM
   MULTIPLE SERVICES IN ONE REQUEST
========================================================= */

function setupQuoteForm() {

    const form = document.getElementById("quoteForm");
    if (!form || form.dataset.quoteUiBound === "1") return;
    form.dataset.quoteUiBound = "1";

    /*
       Service Selection
       -----------------
       The form supports multiple services in one request. Older HTML
       versions used name="service"; newer versions use services[].
       Normalize both so the page remains compatible.
    */
    const serviceInputs = form.querySelectorAll(
        'input[name="service"], input[name="services[]"]'
    );

    serviceInputs.forEach(function (input) {
        input.type = "checkbox";
        input.name = "services[]";
        input.required = false;
    });

    const serviceContainer = form.querySelector(".service-options");
    const serviceSection = serviceContainer
        ? serviceContainer.closest(".form-section")
        : null;

    if (!serviceContainer || !serviceSection) return;

    if (!serviceContainer.querySelector(".multi-service-note")) {
        const note = document.createElement("p");
        note.className = "multi-service-note";
        note.textContent = "You can select more than one service.";
        serviceContainer.appendChild(note);
    }

    /*
       Size / Measurements
       -------------------
       A separate field is maintained for each selected service so entering
       a second service never overwrites the first service's size/measurements.
    */
    let sizeContainer = document.getElementById("serviceSizeContainer");

    if (!sizeContainer) {
        sizeContainer = document.createElement("div");
        sizeContainer.id = "serviceSizeContainer";
        sizeContainer.className = "service-size-container";

        sizeContainer.innerHTML = `
            <h3 class="service-size-heading">Size (UK) / Measurements</h3>

            <div class="form-group service-size-field"
                 data-size-service="Streetwear"
                 style="display:none">
                <label for="streetwearSize">
                    Streetwear — Size (UK) / Measurements
                </label>
                <input
                    type="text"
                    id="streetwearSize"
                    name="streetwearSize"
                    placeholder="Size 12 (UK) or provide your measurements"
                    autocomplete="off"
                >
            </div>

            <div class="form-group service-size-field"
                 data-size-service="Ladies Wear"
                 style="display:none">
                <label for="ladiesWearSize">
                    Ladies Wear — Size (UK) / Measurements
                </label>
                <input
                    type="text"
                    id="ladiesWearSize"
                    name="ladiesWearSize"
                    placeholder="Size 12 (UK) or provide your measurements"
                    autocomplete="off"
                >
            </div>

            <div class="form-group service-size-field"
                 data-size-service="Kids Wear"
                 style="display:none">
                <label for="kidsWearSize">
                    Kids Wear — Size (UK) / Measurements
                </label>
                <input
                    type="text"
                    id="kidsWearSize"
                    name="kidsWearSize"
                    placeholder="Size 12 (UK) or provide your measurements"
                    autocomplete="off"
                >
            </div>

            <div class="form-group service-size-field"
                 data-size-service="Embellishment Services"
                 style="display:none">
                <label for="embellishmentSize">
                    Embellishment Services — Size (UK) / Measurements
                </label>
                <input
                    type="text"
                    id="embellishmentSize"
                    name="embellishmentSize"
                    placeholder="Size 12 (UK) or provide your measurements"
                    autocomplete="off"
                >
            </div>
        `;

        serviceSection.appendChild(sizeContainer);
    }

    /*
       Extra detail fields for services that do not have a dedicated
       product-selection panel.
    */
    let extraDetails = document.getElementById("additionalServiceDetails");

    if (!extraDetails) {
        extraDetails = document.createElement("div");
        extraDetails.id = "additionalServiceDetails";
        extraDetails.className = "additional-service-details";

        extraDetails.innerHTML = `
            <div class="form-group"
                 data-service-detail="Ladies Wear"
                 style="display:none">
                <label for="ladiesWearDetails">
                    Ladies Wear — Specify Request
                </label>
                <textarea
                    id="ladiesWearDetails"
                    name="ladiesWearDetails"
                    placeholder="Tell us what ladies wear you need, quantity, design or other details."
                ></textarea>
            </div>

            <div class="form-group"
                 data-service-detail="Kids Wear"
                 style="display:none">
                <label for="kidsWearDetails">
                    Kids Wear — Specify Request
                </label>
                <textarea
                    id="kidsWearDetails"
                    name="kidsWearDetails"
                    placeholder="Tell us what kids wear you need, quantity, design or other details."
                ></textarea>
            </div>

            <div class="form-group"
                 data-service-detail="Practical Fashion Training"
                 style="display:none">
                <label for="trainingDetails">
                    Training Request
                </label>
                <textarea
                    id="trainingDetails"
                    name="trainingDetails"
                    placeholder="Please specify the training/class you are interested in."
                ></textarea>
            </div>
        `;

        serviceSection.appendChild(extraDetails);
    }

    function updateServiceSections() {
        const selected = Array.from(
            form.querySelectorAll('input[name="services[]"]:checked')
        ).map(input => input.value);

        form.querySelectorAll(".service-size-field").forEach(function (field) {
            const serviceName = field.getAttribute("data-size-service");
            field.style.display = selected.includes(serviceName) ? "block" : "none";
            /*
               Do NOT clear another service's size simply because another
               service was selected. Each service keeps its own value.
            */
        });

        form.querySelectorAll("[data-service-detail]").forEach(function (field) {
            const serviceName = field.getAttribute("data-service-detail");
            field.style.display = selected.includes(serviceName) ? "block" : "none";
        });

        const streetwear = document.getElementById("streetwearSection");
        if (streetwear) {
            streetwear.style.display = selected.includes("Streetwear") ? "block" : "none";
        }

        const embellishment = document.getElementById("embellishmentSection");
        if (embellishment) {
            embellishment.style.display =
                selected.includes("Embellishment Services") ? "block" : "none";
        }
    }

    serviceInputs.forEach(function (input) {
        input.addEventListener("change", updateServiceSections);
    });

    form.addEventListener("reset", function () {
        window.setTimeout(updateServiceSections, 0);
    });

    updateServiceSections();
}

/* =========================================================
   PUBLIC SITE — DATABASE-LINKED CONTENT
   Falls back to the existing static HTML when a table has
   no active rows, so the public design is never left blank.
========================================================= */

async function loadPublicRows(table) {
    const supabase = await waitForSupabase();
    if (!supabase) return [];
    const result = await supabase
        .from(table)
        .select("*");
    if (result.error) {
        console.warn("Public content table unavailable:", table, result.error);
        return [];
    }
    return (result.data || []).filter(row => row.active !== false);
}

function ensureLightbox() {
    let viewer = document.getElementById("galleryViewer");
    if (viewer) return viewer;

    viewer = document.createElement("div");
    viewer.id = "galleryViewer";
    viewer.innerHTML = `
        <button id="galleryViewerClose" type="button" aria-label="Close">×</button>
        <div id="galleryViewerContent"></div>
    `;
    document.body.appendChild(viewer);

    viewer.addEventListener("click", function (event) {
        if (event.target === viewer || event.target.id === "galleryViewerClose") {
            viewer.classList.remove("active");
        }
    });

    return viewer;
}

function openMediaViewer(source, type, alt) {
    const viewer = ensureLightbox();
    const content = document.getElementById("galleryViewerContent");
    if (!content) return;

    if (type === "video") {
        content.innerHTML = `<video controls autoplay muted loop playsinline><source src="${source}" type="video/mp4"></video>`;
    } else {
        content.innerHTML = `<img class="${String(alt || "").toLowerCase().includes("photo 5") || String(alt || "").toLowerCase().includes("glimpse inside") ? "gallery-photo5-wide" : ""}" src="${source}" alt="${alt || ""}">`;
    }

    viewer.classList.add("active");
}

function setupMediaInteractions() {
    document.querySelectorAll(".gallery-image img, .location-image img").forEach(img => {
        if (img.dataset.mediaBound) return;
        img.dataset.mediaBound = "1";
        img.addEventListener("click", function (event) {
            event.preventDefault();
            openMediaViewer(this.currentSrc || this.src, "image", this.alt);
        });
    });

    document.querySelectorAll(".gallery-image video, .featured-video video").forEach(video => {
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.play().catch(() => {});
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;

        if (!video.dataset.mediaBound) {
            video.dataset.mediaBound = "1";
            video.addEventListener("click", function () {
                const source = this.querySelector("source");
                if (source) openMediaViewer(source.src, "video", "");
            });
        }
    });
}

async function loadPublicGallery() {
    if (!document.body.classList.contains("gallery-page")) return;

    const rows = await loadPublicRows("gallery_items");
    if (!rows.length) {
        setupMediaInteractions();
        return;
    }

    const activeRows = [];
    const seenMedia = new Set();
    rows.filter(row => row.image_url && row.active !== false).forEach(row => {
        const key = `${row.category || "Gallery"}\u0000${row.image_url}`;
        if (!seenMedia.has(key)) { seenMedia.add(key); activeRows.push(row); }
    });
    if (!activeRows.length) return;

    const main = document.querySelector("main");
    if (!main) return;

    const intro = main.querySelector(".page-intro");
    const existingSections = main.querySelectorAll(".full-gallery, .featured-collection, .gallery-note");

    existingSections.forEach(section => section.remove());

    const groups = {};
    activeRows.forEach(row => {
        const category = row.category || "Gallery";
        if (!groups[category]) groups[category] = [];
        groups[category].push(row);
    });

    const fragment = document.createDocumentFragment();

    Object.keys(groups).sort().forEach(category => {
        const section = document.createElement("section");
        section.className = "full-gallery";
        section.innerHTML = `
            <div class="container">
                <h2>${escapeHTML(category)}</h2>
                <div class="gallery-grid">
                    ${groups[category].map(row => `
                        <article class="gallery-item">
                            <div class="gallery-image">
                                ${/\.(mp4|webm|ogg)(\?|$)/i.test(row.image_url || "")
                                    ? `<video controls autoplay muted loop playsinline preload="metadata"><source src="${escapeHTML(row.image_url)}" type="video/mp4"></video>`
                                    : `<img src="${escapeHTML(row.image_url)}" alt="${escapeHTML(row.title || category)}">`}
                            </div>
                            ${row.title ? `<h3>${escapeHTML(row.title)}</h3>` : ""}
                            ${row.description ? `<p>${escapeHTML(row.description)}</p>` : ""}
                        </article>
                    `).join("")}
                </div>
            </div>
        `;
        fragment.appendChild(section);
    });

    const note = document.createElement("section");
    note.className = "gallery-note";
    note.innerHTML = `
        <div class="container">
            <h2>Elegance in Every Stitch</h2>
            <p>Every creation is made with attention to detail, creativity and the Aprils Signature standard.</p>
            <div class="cta-buttons">
                <a href="quotes.html" class="button gold">Order / Request a Quote</a>
                <a href="contact.html" class="button">Contact Us</a>
            </div>
        </div>
    `;
    fragment.appendChild(note);

    if (intro) intro.after(fragment);
    setupMediaInteractions();
}

async function loadPublicServices() {
    if (!document.body.classList.contains("services-page")) return;

    const rows = await loadPublicRows("admin_services");
    if (!rows.length) return;

    const sections = document.querySelectorAll(".service-section");
    if (!sections.length) return;

    sections.forEach(section => section.remove());

    const main = document.querySelector("main");
    const intro = main?.querySelector(".page-intro");
    if (!main || !intro) return;

    const fragment = document.createDocumentFragment();

    rows.forEach(row => {
        const section = document.createElement("section");
        section.className = "service-section";
        section.innerHTML = `
            <div class="container">
                <h2>${escapeHTML(row.title)}</h2>
                ${row.category ? `<p class="eyebrow">${escapeHTML(row.category)}</p>` : ""}
                <p>${escapeHTML(row.description || "")}</p>
                <a href="quotes.html" class="button">Order / Request a Quote</a>
            </div>
        `;
        fragment.appendChild(section);
    });

    intro.after(fragment);
}

async function loadPublicTraining() {
    if (!document.body.classList.contains("training-page")) return;

    const rows = await loadPublicRows("training_programs");
    if (!rows.length) return;

    const grid = document.querySelector(".training-section .training-grid");
    if (!grid) return;

    grid.innerHTML = rows.map(row => `
        <article class="training-card">
            <h3>${escapeHTML(row.title)}</h3>
            ${row.duration ? `<p><strong>Duration:</strong> ${escapeHTML(row.duration)}</p>` : ""}
            ${row.description ? `<p>${escapeHTML(row.description)}</p>` : ""}
            
        </article>
    `).join("");
}

async function loadPublicTestimonials() {
    if (!document.body.classList.contains("home-page")) return;

    const rows = await loadPublicRows("testimonials");
    const placeholder = document.querySelector(".testimonial-placeholder");
    if (!placeholder || !rows.length) return;

    placeholder.innerHTML = rows.map(row => `
        <blockquote>
            <p>“${escapeHTML(row.testimonial || "")}”</p>
            <cite>— ${escapeHTML(row.customer_name || "Customer")}</cite>
        </blockquote>
    `).join("");
}

async function loadPublicFAQs() {
    if (!document.body.classList.contains("policies-page")) return;

    const rows = await loadPublicRows("faqs");
    const section = document.querySelector(".faq-section .container");
    if (!section || !rows.length) return;

    section.innerHTML = `
        <h2>Frequently Asked Questions</h2>
        ${rows.map(row => `
            <details>
                <summary>${escapeHTML(row.question || "")}</summary>
                <p>${escapeHTML(row.answer || "")}</p>
            </details>
        `).join("")}
    `;
}


async function loadPublicManagedContent() {
    try {
        const contentRows = await loadPublicRows("site_content");
        const content = {};
        contentRows.forEach(row => {
            content[String(row.content_key || "").trim().toLowerCase()] = String(row.content_value || "");
        });

        const setText = (selector, value) => {
            if (value === undefined) return;
            const el = document.querySelector(selector);
            if (el) el.textContent = value;
        };

        /*
           Any public element marked data-content-key is automatically
           connected to the matching Website Content record.
        */
        document.querySelectorAll("[data-content-key]").forEach(function (el) {
            const key = String(el.getAttribute("data-content-key") || "").trim().toLowerCase();
            if (key && content[key] !== undefined) {
                el.textContent = content[key];
            }
        });

        setText(".home-page .hero h1", content["homepage hero heading"]);
        setText(".home-page .hero-text", content["homepage tagline"]);
        setText(".home-page .cta-section h2", content["homepage cta"]);
        setText(".home-page .cta-section p", content["homepage cta description"]);

        if (document.body.classList.contains("about-page")) {
            setText(".about-section p:first-of-type", content["about page introduction"]);
        }
    } catch (error) {
        console.warn("Public website content could not be loaded:", error);
    }

    try {
        const contact = await loadPublicRows("contact_settings");
        const row = contact[0];
        if (row) {
            document.querySelectorAll(".footer-column").forEach(column => {
                const text = (column.textContent || "").toLowerCase();
                if (text.includes("contact")) {
                    const phone = column.querySelector('a[href^="tel:"]');
                    const whatsapp = column.querySelector('a[href*="wa.me"]');
                    const email = column.querySelector('a[href^="mailto:"]');
                    if (phone && row.phone) { phone.textContent = row.phone; phone.href = "tel:" + row.phone.replace(/\s+/g, ""); }
                    if (whatsapp && row.whatsapp) { whatsapp.textContent = row.whatsapp; whatsapp.href = "https://wa.me/" + row.whatsapp.replace(/\D/g, ""); }
                    if (email && row.email) { email.textContent = row.email; email.href = "mailto:" + row.email; }
                    const address = column.querySelector("p:last-of-type");
                    if (address && row.address) {
                        const strong = address.querySelector("strong");
                        address.innerHTML = strong ? strong.outerHTML + "<br>" + escapeHTML(row.address).replace(/\n/g, "<br>") : escapeHTML(row.address).replace(/\n/g, "<br>");
                    }
                }
                if (text.includes("opening hours") && row.opening_hours) {
                    const p = Array.from(column.querySelectorAll("p")).find(x => (x.textContent || "").toLowerCase().includes("monday"));
                    if (p) p.innerHTML = escapeHTML(row.opening_hours).replace(/\n/g, "<br>");
                }
            });
        }
    } catch (error) {
        console.warn("Public contact settings could not be loaded:", error);
    }

    try {
        const settings = await loadPublicRows("settings");
        const socials = settings.filter(row => String(row.setting_key || "").toLowerCase().startsWith("social_"));
        if (socials.length) {
            const map = {};
            socials.forEach(row => map[String(row.setting_key).replace(/^social_/i, "").toLowerCase()] = row.setting_value || "");
            document.querySelectorAll(".footer-social a").forEach(link => {
                const img = link.querySelector("img");
                const platform = String(img?.alt || link.textContent || "").trim().toLowerCase().replace(/\s+/g, "");
                const url = map[platform];
                if (url) {
                    link.href = url;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                }
            });
        }
    } catch (error) {
        console.warn("Public social links could not be loaded:", error);
    }

    try {
        if (document.body.classList.contains("policies-page")) {
            const policies = await loadPublicRows("policies");
            if (policies.length) {
                const main = document.querySelector("main");
                const intro = main?.querySelector(".page-intro");
                const old = main?.querySelectorAll(".policy-section");
                if (main && intro && old?.length) {
                    old.forEach(section => section.remove());
                    const frag = document.createDocumentFragment();
                    policies.forEach(row => {
                        const section = document.createElement("section");
                        section.className = "policy-section";
                        section.innerHTML = `<div class="container"><h2>${escapeHTML(row.title || "")}</h2><p>${escapeHTML(row.content || "").replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p></div>`;
                        frag.appendChild(section);
                    });
                    intro.after(frag);
                }
            }
        }
    } catch (error) {
        console.warn("Public policies could not be loaded:", error);
    }
}

async function loadPublicLogoSetting() {
    try {
        const settings = await loadPublicRows("settings");
        const logoSetting = settings.find(row =>
            String(row.setting_key || "").toLowerCase() === "site_logo_data"
        );
        const removeSetting = settings.find(row =>
            String(row.setting_key || "").toLowerCase() === "site_logo_removed"
        );

        const logos = document.querySelectorAll(".brand-logo");
        if (!logos.length) return;

        if (String(removeSetting?.setting_value || "").toLowerCase() === "true") {
            logos.forEach(img => {
                img.style.display = "none";
                img.setAttribute("aria-hidden", "true");
            });
            return;
        }

        if (logoSetting?.setting_value) {
            logos.forEach(img => {
                img.src = logoSetting.setting_value;
                img.style.display = "";
                img.removeAttribute("aria-hidden");
            });
        }
    } catch (error) {
        console.warn("Public logo setting could not be loaded:", error);
    }
}

async function setupPublicDatabaseContent() {
    await Promise.all([
        loadPublicGallery(),
        loadPublicServices(),
        loadPublicTraining(),
        loadPublicTestimonials(),
        loadPublicFAQs(),
        loadPublicManagedContent(),
        loadPublicLogoSetting()
    ]);
    setupMediaInteractions();
}

/* =========================================================
   START
========================================================= */

function start() {

    setupMobileMenu();
    normalizeEmailLinks();

    setupCopyright();

    setupGoogleReview();

    setupTrainingWhatsApp();

    setupTrainingForm();

    setupEnquiryForm();

    setupQuoteForm();

    setupPublicDatabaseContent();

}


if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        start
    );

} else {

    start();

}


})();
