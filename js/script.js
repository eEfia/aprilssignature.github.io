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

    if (!form) {
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

    const form =
        document.getElementById("quoteForm");

    if (!form) {
        return;
    }


    /*
       Convert the existing service radio buttons
       into checkboxes so one customer can select
       multiple services in ONE request.
    */

    const serviceInputs =
        form.querySelectorAll(
            'input[name="service"]'
        );


    serviceInputs.forEach(function (input) {

        input.type = "checkbox";

        input.name = "services[]";

        input.required = false;

    });


    const serviceContainer =
        form.querySelector(".service-options");


    if (serviceContainer) {

        const note =
            document.createElement("p");

        note.textContent =
            "You can select more than one service.";

        note.style.marginTop = "12px";
        note.style.fontSize = "14px";
        note.style.color = "#555";

        serviceContainer.appendChild(note);

    }


    /*
       Add extra detail boxes for services
       that currently do not have their own
       detailed selection section.
    */

    const serviceSection =
        serviceContainer?.closest(
            ".form-section"
        );


    if (serviceSection) {

        const extra =
            document.createElement("div");

        extra.id =
            "additionalServiceDetails";

        extra.style.marginTop = "25px";


        extra.innerHTML = `

            <div
                class="form-group"
                data-service-detail="Ladies Wear"
                style="display:none"
            >
                <label>
                    Ladies Wear — Specify Request
                </label>

                <textarea
                    name="ladiesWearDetails"
                    placeholder="Tell us what ladies wear you need, quantity, design or other details."
                ></textarea>
            </div>


            <div
                class="form-group"
                data-service-detail="Kids Wear"
                style="display:none"
            >
                <label>
                    Kids Wear — Specify Request
                </label>

                <textarea
                    name="kidsWearDetails"
                    placeholder="Tell us what kids wear you need, quantity, design or other details."
                ></textarea>
            </div>


            <div
                class="form-group"
                data-service-detail="Practical Fashion Training"
                style="display:none"
            >
                <label>
                    Training Request
                </label>

                <textarea
                    name="trainingDetails"
                    placeholder="Please specify the training/class you are interested in."
                ></textarea>
            </div>

        `;

        serviceSection.appendChild(extra);

    }


    function updateServiceSections() {

        const selected = [];

        form.querySelectorAll(
            'input[name="services[]"]:checked'
        ).forEach(function (input) {

            selected.push(input.value);

        });


        form.querySelectorAll(
            "[data-service-detail]"
        ).forEach(function (box) {

            box.style.display =
                selected.includes(
                    box.getAttribute(
                        "data-service-detail"
                    )
                )
                    ? "block"
                    : "none";

        });


        const streetwear =
            document.getElementById(
                "streetwearSection"
            );

        const embellishment =
            document.getElementById(
                "embellishmentSection"
            );


        if (streetwear) {

            streetwear.style.display =
                selected.includes("Streetwear")
                    ? "block"
                    : "none";

        }


        if (embellishment) {

            embellishment.style.display =
                selected.includes(
                    "Embellishment Services"
                )
                    ? "block"
                    : "none";

        }

    }


    serviceInputs.forEach(function (input) {

        input.addEventListener(
            "change",
            updateServiceSections
        );

    });


    /*
       CAPTURE PHASE

       The old quote page has an older submit
       handler inside quotes.html.

       This handler catches the submission
       first so the old handler cannot create
       a duplicate/broken submission.
    */

    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();
            event.stopImmediatePropagation();


            const message =
                document.getElementById(
                    "quoteFormMessage"
                );


            const button =
                document.getElementById(
                    "quoteSubmitButton"
                );


            const selectedServices =
                Array.from(
                    form.querySelectorAll(
                        'input[name="services[]"]:checked, input[name="service"]:checked'
                    )
                ).map(function (input) {

                    return input.value;

                });


            if (!selectedServices.length) {

                showFormMessage(
                    message,
                    "Please select at least one service.",
                    false
                );

                return;

            }


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
                        "Supabase unavailable."
                    );

                }


                const data =
                    new FormData(form);


                const get =
                    function (name) {

                        return String(
                            data.get(name) || ""
                        ).trim();

                    };


                const streetwearItems = {};

                [
                    "jerseys",
                    "hoodies",
                    "joggers",
                    "tshirts",
                    "poloShirts",
                    "sweatshirts",
                    "sweatpants",
                    "ladiesTankTops",
                    "mensTankTops",
                    "varsityJackets",
                    "cargoPants",
                    "cargoSkirts",
                    "joggerShorts",
                    "hoodiesJoggersSet",
                    "tshirtsShortsSet",
                    "sweatshirtsShortsSet"
                ].forEach(function (name) {

                    streetwearItems[name] =
                        get(name);

                });


                const embellishment =
                    data.getAll(
                        "embellishment[]"
                    );


                const requestDetails = {

                    selectedServices:
                        selectedServices,

                    streetwear:
                        streetwearItems,

                    streetwearOther:
                        get("streetwearOther"),

                    ladiesWear:
                        get("ladiesWearDetails"),

                    kidsWear:
                        get("kidsWearDetails"),

                    training:
                        get("trainingDetails"),

                    embellishment:
                        embellishment,

                    embellishmentOther:
                        get("embellishmentOther"),

                    additionalDetails:
                        get("additionalDetails"),

                    agreement:
                        get("agreement"),

                    mockups:
                        Array.from(
                            document.getElementById(
                                "mockups"
                            )?.files || []
                        ).map(function (file) {

                            return file.name;

                        }),

                    inspiration:
                        Array.from(
                            document.getElementById(
                                "inspiration"
                            )?.files || []
                        ).map(function (file) {

                            return file.name;

                        }),

                    submittedFrom:
                        window.location.href

                };


                const payload = {

                    full_name:
                        get("fullName"),

                    phone:
                        get("phone"),

                    whatsapp:
                        get("whatsapp"),

                    location:
                        get("location"),

                    email:
                        get("email"),

                    service:
                        selectedServices.join(", "),

                    journey:
                        JSON.stringify(
                            requestDetails
                        )

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


                const result =
                    await supabase
                        .from("quote_requests")
                        .insert([payload]);


                if (result.error) {

                    console.error(
                        "QUOTE ERROR:",
                        result.error
                    );

                    throw result.error;

                }


                showFormMessage(
                    message,
                    "Thank you! Your order / quote request has been received successfully. Aprils Signature will review your request and contact you shortly regarding your quotation.",
                    true
                );


                form.reset();

                updateServiceSections();


                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });


            } catch (error) {

                console.error(
                    "QUOTE SUBMISSION ERROR:",
                    error
                );


                showFormMessage(
                    message,
                    "We could not submit your request right now. Please try again. If the problem continues, contact Aprils Signature directly.",
                    false
                );


            } finally {

                if (button) {

                    button.disabled = false;

                    button.textContent =
                        "Submit Order / Request a Quote";

                }

            }

        },
        true
    );

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
        .select("*")
        .eq("active", true);
    if (result.error) {
        console.warn("Public content table unavailable:", table, result.error);
        return [];
    }
    return result.data || [];
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
        content.innerHTML = `<img src="${source}" alt="${alt || ""}">`;
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

    const activeRows = rows.filter(row => row.image_url);
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
            ${row.price ? `<p><strong>GHC ${Number(row.price).toFixed(2)}</strong></p>` : ""}
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

async function loadPublicWebsiteContent() {
    const supabase = await waitForSupabase();
    if (!supabase) return;
    const result = await supabase.from("site_content").select("content_key,content_value");
    if (result.error) return;
    const rows = result.data || [];
    const content = new Map(rows.map(row => [String(row.content_key || "").trim().toLowerCase(), String(row.content_value || "")]));
    const setText = (selector, key) => {
        const value = content.get(key.toLowerCase());
        const el = document.querySelector(selector);
        if (value !== undefined && el) el.textContent = value;
    };
    setText(".home-page .hero h1", "Homepage Hero Heading");
    setText(".home-page .hero .hero-text", "Homepage Tagline");
    setText(".home-page .cta-section h2", "Homepage CTA");
    setText(".home-page .cta-section p", "Homepage CTA Description");
    setText(".about-page .about-section h2 + p", "About Page Introduction");
    setText(".about-page .glimpse-section p", "About Page Shop Introduction");
    const aboutWhat = content.get("about page what we do");
    const whatHeading = [...document.querySelectorAll(".about-page h2")].find(el => el.textContent.trim() === "What We Do");
    if (aboutWhat && whatHeading) {
        let intro = whatHeading.nextElementSibling;
        if (!intro || intro.tagName !== "P") {
            intro = document.createElement("p");
            intro.className = "admin-content-intro";
            whatHeading.insertAdjacentElement("afterend", intro);
        }
        intro.textContent = aboutWhat;
    }
    const aboutWhy = content.get("about page why choose us");
    const whyHeading = [...document.querySelectorAll(".about-page h2")].find(el => el.textContent.trim() === "Why Choose Aprils Signature?");
    if (aboutWhy && whyHeading) {
        let intro = whyHeading.nextElementSibling;
        if (!intro || intro.tagName !== "P") {
            intro = document.createElement("p");
            intro.className = "admin-content-intro";
            whyHeading.insertAdjacentElement("afterend", intro);
        }
        intro.textContent = aboutWhy;
    }
}

async function setupPublicDatabaseContent() {
    await Promise.all([
        loadPublicGallery(),
        loadPublicServices(),
        loadPublicTraining(),
        loadPublicTestimonials(),
        loadPublicFAQs(),
        loadPublicWebsiteContent()
    ]);
    setupMediaInteractions();
}

/* =========================================================
   START
========================================================= */

function start() {

    setupMobileMenu();

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
