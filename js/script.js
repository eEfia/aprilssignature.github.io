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
    const fallbackEmail = "info@aprilssignature.com";
    const gmailComposeBase = "https://mail.google.com/mail/?view=cm&fs=1&tf=1";

    document.querySelectorAll("a").forEach(function (link) {
        const text = (link.textContent || "").trim();
        const href = String(link.getAttribute("href") || "");
        const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);

        if (match || /^mailto:/i.test(href) || /mail\.google\.com/i.test(href) || /gmail\.com/i.test(href)) {
            const email = (match ? match[0] : (href.match(/[?&]to=([^&]+)/i)?.[1] || fallbackEmail)).trim();
            link.dataset.aprilsEmail = email;
            link.href = "mailto:" + encodeURIComponent(email);
            link.removeAttribute("target");
            link.removeAttribute("rel");
            link.setAttribute("aria-label", "Email Aprils Signature");

            // A mailto link is the correct universal standard. If the device/browser
            // has no mail handler, offer Gmail as a web fallback instead of silently failing.
            link.addEventListener("click", function (event) {
                if (link.dataset.emailFallbackBusy === "1") return;
                event.preventDefault();
                link.dataset.emailFallbackBusy = "1";

                const mailto = "mailto:" + email;
                const gmail = gmailComposeBase + "&to=" + encodeURIComponent(email);

                let fallbackTimer = window.setTimeout(function () {
                    showEmailFallback(email, gmail);
                    link.dataset.emailFallbackBusy = "0";
                }, 1200);

                const cleanup = function () {
                    window.clearTimeout(fallbackTimer);
                    window.removeEventListener("blur", cleanup);
                    window.setTimeout(function () {
                        link.dataset.emailFallbackBusy = "0";
                    }, 100);
                };

                window.addEventListener("blur", cleanup);
                window.location.href = mailto;
            }, { once: false });
        }
    });
}

function showEmailFallback(email, gmailURL) {
    let modal = document.getElementById("aprilsEmailFallback");
    if (modal) {
        modal.classList.add("is-open");
        return;
    }

    modal = document.createElement("div");
    modal.id = "aprilsEmailFallback";
    modal.className = "aprils-email-fallback";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `
        <div class="aprils-email-fallback-card">
            <button type="button" class="aprils-email-close" aria-label="Close">&times;</button>
            <div class="aprils-email-icon" aria-hidden="true">✉</div>
            <h3>Choose how to email us</h3>
            <p>Your device did not open an email app automatically. You can use Gmail in your browser or copy our email address.</p>
            <a class="aprils-email-gmail" href="${gmailURL}" target="_blank" rel="noopener noreferrer">Open Gmail</a>
            <button type="button" class="aprils-email-copy">Copy ${escapeHTML(email)}</button>
            <p class="aprils-email-small">Email: <strong>${escapeHTML(email)}</strong></p>
        </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(function () {
        modal.classList.add("is-open");
    });

    const close = function () {
        modal.classList.remove("is-open");
        window.setTimeout(function () { modal.remove(); }, 220);
    };

    modal.querySelector(".aprils-email-close").addEventListener("click", close);
    modal.addEventListener("click", function (event) {
        if (event.target === modal) close();
    });

    modal.querySelector(".aprils-email-copy").addEventListener("click", async function () {
        try {
            await navigator.clipboard.writeText(email);
            this.textContent = "Email copied ✓";
        } catch (_) {
            window.prompt("Copy this email address:", email);
        }
    });
}

/* =========================================================
   SITE-WIDE HELP / CHAT POPUP
========================================================= */

function setupHelpChat() {
    if (document.getElementById("aprilsHelpWidget")) return;

    const whatsappNumber = "233592983027";
    const widget = document.createElement("div");
    widget.id = "aprilsHelpWidget";
    widget.innerHTML = `
        <button type="button" class="aprils-chat-launcher" aria-label="Open Aprils Signature help chat" aria-expanded="false">
            <span class="aprils-chat-pulse" aria-hidden="true"></span>
            <span class="aprils-chat-bubble-icon" aria-hidden="true">💬</span>
            <span class="aprils-chat-launcher-text">Need help?</span>
        </button>

        <section class="aprils-chat-panel" aria-label="Aprils Signature help chat" hidden>
            <div class="aprils-chat-header">
                <div>
                    <strong>Aprils Signature</strong>
                    <span><i></i> Usually responds on WhatsApp</span>
                </div>
                <button type="button" class="aprils-chat-close" aria-label="Close chat">&times;</button>
            </div>

            <div class="aprils-chat-body">
                <div class="aprils-chat-welcome">
                    <strong>Hello! 👋</strong>
                    <p>Need help with an order, training, sizing or our services? Send us a message and we'll help you.</p>
                </div>
                <div class="aprils-chat-actions">
                    <a href="https://wa.me/${whatsappNumber}" target="_blank" rel="noopener noreferrer" class="aprils-chat-whatsapp">Chat with us on WhatsApp</a>
                    <a href="mailto:info@aprilssignature.com" class="aprils-chat-email">Email us</a>
                </div>
                <label class="aprils-chat-label" for="aprilsChatMessage">Quick message</label>
                <textarea id="aprilsChatMessage" rows="3" maxlength="500" placeholder="Type your message here..."></textarea>
                <button type="button" class="aprils-chat-send">Send message on WhatsApp</button>
                <small class="aprils-chat-note">This is a direct WhatsApp chat, so you can continue the conversation privately.</small>
            </div>
        </section>
    `;

    document.body.appendChild(widget);

    const launcher = widget.querySelector(".aprils-chat-launcher");
    const panel = widget.querySelector(".aprils-chat-panel");
    const close = widget.querySelector(".aprils-chat-close");
    const message = widget.querySelector("#aprilsChatMessage");
    const send = widget.querySelector(".aprils-chat-send");

    function openChat() {
        panel.hidden = false;
        requestAnimationFrame(function () { panel.classList.add("is-open"); });
        launcher.setAttribute("aria-expanded", "true");
        window.setTimeout(function () { message.focus(); }, 180);
    }

    function closeChat() {
        panel.classList.remove("is-open");
        launcher.setAttribute("aria-expanded", "false");
        window.setTimeout(function () { panel.hidden = true; }, 220);
    }

    launcher.addEventListener("click", function () {
        if (panel.hidden) openChat();
        else closeChat();
    });

    close.addEventListener("click", closeChat);

    send.addEventListener("click", function () {
        const text = message.value.trim();
        const greeting = text
            ? text
            : "Hello Aprils Signature, I need some help with your website/services.";
        const url = "https://wa.me/" + whatsappNumber + "?text=" + encodeURIComponent(greeting);
        window.open(url, "_blank", "noopener,noreferrer");
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !panel.hidden) closeChat();
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
       Size, measurements and quantity fields are intentionally kept inside
       each service's own detail section in quotes.html. Older versions also
       injected duplicate fields here; that caused duplicate inputs and could
       make the admin “View Full” record miss the value the visitor entered.
    */

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

        form.querySelectorAll(".service-quantity-field").forEach(function (field) {
            const serviceName = field.getAttribute("data-quantity-service");
            field.style.display = selected.includes(serviceName) ? "block" : "none";
        });

        const streetwear = document.getElementById("streetwearSection");
        if (streetwear) {
            streetwear.style.display = selected.includes("Streetwear") ? "block" : "none";
        }

        const ladiesWear = document.getElementById("ladiesWearSection");
        if (ladiesWear) ladiesWear.style.display = selected.includes("Ladies Wear") ? "block" : "none";

        const kidsWear = document.getElementById("kidsWearSection");
        if (kidsWear) kidsWear.style.display = selected.includes("Kids Wear") ? "block" : "none";

        const serviceOtherWrap = document.getElementById("serviceOtherWrap");
        const serviceOtherInput = document.getElementById("serviceOther");
        const otherServiceSelected = selected.includes("Others");
        if (serviceOtherWrap) serviceOtherWrap.style.display = otherServiceSelected ? "block" : "none";
        if (serviceOtherInput) {
            serviceOtherInput.required = otherServiceSelected;
            if (!otherServiceSelected) serviceOtherInput.value = "";
        }

        const embellishment = document.getElementById("embellishmentSection");
        if (embellishment) {
            const showEmbellishment = selected.includes("Embellishment Services");
            embellishment.style.display = showEmbellishment ? "block" : "none";

            const otherWrap = document.getElementById("embellishmentOtherWrap");
            const otherInput = document.getElementById("embellishmentOther");
            const otherSelected = Array.from(embellishment.querySelectorAll('input[name="embellishment[]"]'))
                .some(input => input.checked && input.value === "Others");

            if (otherWrap) otherWrap.style.display = showEmbellishment && otherSelected ? "block" : "none";
            if (otherInput) {
                otherInput.required = showEmbellishment && otherSelected;
                if (!otherSelected) otherInput.value = "";
            }
        }
    }

    serviceInputs.forEach(function (input) {
        input.addEventListener("change", updateServiceSections);
    });

    form.querySelectorAll('input[name="embellishment[]"]').forEach(function (input) {
        input.addEventListener("change", updateServiceSections);
    });

    form.addEventListener("reset", function () {
        window.setTimeout(updateServiceSections, 0);
    });

    updateServiceSections();
}


/* =========================================================
   PUBLIC QUOTE — STREETWEAR PRODUCT CATALOGUE
========================================================= */

async function loadPublicStreetwearProducts() {
    const container = document.getElementById("streetwearProductsDynamic");
    if (!container) return;

    try {
        const supabase = await waitForSupabase();
        if (!supabase) return;
        const result = await supabase.from("settings")
            .select("setting_key,setting_value")
            .like("setting_key","product_%");
        if (result.error) return;

        const products = (result.data || []).map(row => {
            try { return {...JSON.parse(row.setting_value || "{}"), setting_key:row.setting_key}; }
            catch (_) { return null; }
        }).filter(row => row && row.name && row.active !== false);

        const streetwear = products
            .filter(row => String(row.category || "").toLowerCase() === "streetwear")
            .sort((a,b)=>Number(a.display_order||9999)-Number(b.display_order||9999) ||
                String(a.name).localeCompare(String(b.name)));

        if (!streetwear.length) return;

        const slug = name => String(name).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
        container.innerHTML = streetwear.map(row => {
            const id = "product_" + slug(row.name);
            return `<div class="quantity-row">
                <div class="form-group">
                    <label for="${escapeHTML(id)}">${escapeHTML(row.name)}</label>
                    <input type="number" id="${escapeHTML(id)}" name="${escapeHTML(id)}" min="0" value="0" data-streetwear-product="true" data-product-name="${escapeHTML(row.name)}">
                </div>
            </div>`;
        }).join("");
    } catch (error) {
        console.warn("Public streetwear catalogue unavailable:", error);
    }
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
        console.error("PUBLIC SUPABASE READ FAILED:", table, result.error);
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


async function loadPublicFeaturedCollection() {
    if (!document.body.classList.contains("home-page")) return;
    const rows = await loadPublicRows("gallery_items");
    let featuredOrder = new Map();
    try {
        const supabase = await waitForSupabase();
        if (supabase) {
            const settings = await supabase.from("settings").select("setting_key,setting_value").like("setting_key","featured_order_%");
            if (!settings.error) (settings.data || []).forEach(r => featuredOrder.set(String(r.setting_key).replace("featured_order_", ""), Number(r.setting_value) || 9999));
        }
    } catch (_) {}
    const featured = rows.filter(row => row.featured && row.image_url)
        .sort((a,b)=>(featuredOrder.get(String(a.id)) ?? Number(a.display_order||9999))-(featuredOrder.get(String(b.id)) ?? Number(b.display_order||9999)) ||
            String(a.title||"").localeCompare(String(b.title||"")));
    if (!featured.length) return;

    const main = document.querySelector("main");
    if (!main) return;
    const existing = main.querySelector(".featured-collection");
    if (!existing) return;

    existing.innerHTML = `
        <div class="container">
            <div class="section-heading">
                <p class="eyebrow">Selected Work</p>
                <h2>Featured Collection</h2>
            </div>
            <div class="featured-grid">
                ${featured.map(row => {
                    const media = /\.(mp4|webm|ogg)(\?|$)/i.test(row.image_url || "")
                        ? `<div class="featured-video"><video controls preload="metadata" playsinline muted><source src="${escapeHTML(row.image_url)}" type="video/mp4"></video></div>`
                        : `<div class="featured-video"><img src="${escapeHTML(row.image_url)}" alt="${escapeHTML(row.title || "Featured Aprils Signature work")}"></div>`;
                    return `<article class="featured-card">
                        ${media}
                        ${row.title ? `<h3>${escapeHTML(row.title)}</h3>` : ""}
                        ${row.price !== null && row.price !== undefined && row.price !== "" ? `<p class="gallery-public-price"><strong>Price:</strong> GHS ${Number(row.price).toFixed(2)}</p>` : ""}
                        ${row.description ? `<p>${escapeHTML(row.description)}</p>` : ""}
                    </article>`;
                }).join("")}
            </div>
            <div class="section-button"><a href="gallery.html" class="btn btn-primary">View Full Gallery</a></div>
        </div>`;
    setupMediaInteractions();
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
        const normalizedUrl = String(row.image_url).trim().replace(/\s+/g, " ");
        const normalizedCategory = String(row.category || "Gallery").trim().toLowerCase();
        const key = `${normalizedCategory}\u0000${normalizedUrl}`;
        if (!seenMedia.has(key)) {
            seenMedia.add(key);
            activeRows.push(row);
        }
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

    const collectionOrder = new Map();
    try {
        const collections = await loadPublicRows("gallery_collections");
        collections.forEach(row => collectionOrder.set(String(row.name || ""), Number(row.display_order ?? 9999)));
    } catch (_) {}

    const fragment = document.createDocumentFragment();

    Object.keys(groups).sort((a,b) => (collectionOrder.get(a) ?? 9999) - (collectionOrder.get(b) ?? 9999) || a.localeCompare(b)).forEach(category => {
        groups[category].sort((a,b) => Number(a.display_order ?? 9999) - Number(b.display_order ?? 9999) || String(a.title || "").localeCompare(String(b.title || "")));
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
                            ${row.price !== null && row.price !== undefined && row.price !== "" ? `<p class="gallery-public-price"><strong>Price:</strong> GHS ${Number(row.price).toFixed(2)}</p>` : ""}
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
                ${row.price !== null && row.price !== undefined && row.price !== "" ? `<p class="service-public-price"><strong>Price:</strong> GHS ${Number(row.price).toFixed(2)}</p>` : ""}
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

    const supabase = await waitForSupabase();
    let publicPrices = {};
    if (supabase) {
        const settingsResult = await supabase.from("settings").select("setting_key,setting_value").like("setting_key", "public_training_price_%");
        if (!settingsResult.error) {
            (settingsResult.data || []).forEach(r => { try { const x = JSON.parse(r.setting_value || "{}"); if (x.name) publicPrices[String(x.name).trim().toLowerCase()] = x.price; } catch (_) {} });
        }
    }

    const grid = document.querySelector(".training-section .training-grid");
    if (!grid) return;

    grid.innerHTML = rows.map(row => `
        <article class="training-card">
            <h3>${escapeHTML(row.title)}</h3>
            ${row.duration ? `<p><strong>Duration:</strong> ${escapeHTML(row.duration)}</p>` : ""}
            ${row.description ? `<p>${escapeHTML(row.description)}</p>` : ""}
            ${publicPrices[String(row.title || "").trim().toLowerCase()] !== undefined && publicPrices[String(row.title || "").trim().toLowerCase()] !== null && publicPrices[String(row.title || "").trim().toLowerCase()] !== "" ? `<p class="service-public-price"><strong>Price:</strong> GHS ${Number(publicPrices[String(row.title || "").trim().toLowerCase()]).toFixed(2)}</p>` : ""}
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



function getPublicPageKey() {
    const classes = Array.from(document.body.classList);
    const found = classes.find(c => c.endsWith("-page"));
    return found ? found.replace(/-page$/, "") : "home";
}

function contentKeySlug(value) {
    return String(value || "").trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 80);
}

function getManagedContentContainer(page) {
    let container = document.querySelector(".admin-managed-content");
    if (!container) {
        container = document.createElement("section");
        container.className = "admin-managed-content";
        const inner = document.createElement("div");
        inner.className = "container";
        container.appendChild(inner);

        const main = document.querySelector("main");
        const intro = main?.querySelector(".page-intro");
        if (main && intro) intro.after(container);
        else if (main) main.appendChild(container);
    }
    return container.querySelector(".container") || container;
}

function renderDynamicManagedContent(rows, page) {
    const dynamic = rows
        .map(row => ({ row, parts: String(row.content_key || "").split("::") }))
        .filter(item => item.parts[0] === "dynamic" && (item.parts[1] === page || item.parts[1] === "all"));

    if (!dynamic.length) return;

    const target = getManagedContentContainer(page);
    target.innerHTML = "";

    dynamic.forEach(({ row, parts }) => {
        const type = parts[2] || "paragraph";
        const name = parts.slice(3).join(" ").replace(/_/g, " ") || "Website Content";
        const value = String(row.content_value || "");

        if (type === "heading") {
            const h = document.createElement("h2");
            h.textContent = value;
            target.appendChild(h);
            return;
        }

        if (type === "notice") {
            const box = document.createElement("div");
            box.className = "admin-managed-notice";
            box.textContent = value;
            target.appendChild(box);
            return;
        }

        if (type === "button") {
            const parts = value.split("|");
            const label = (parts[0] || name).trim();
            const url = (parts[1] || "quotes.html").trim();
            const a = document.createElement("a");
            a.className = "button";
            a.textContent = label;
            a.href = url;
            target.appendChild(a);
            return;
        }

        const p = document.createElement("p");
        p.textContent = value;
        target.appendChild(p);
    });

    if (target.children.length) {
        target.parentElement.classList.add("has-admin-content");
    }
}

async function loadPublicManagedContent() {
    try {
        const contentRows = await loadPublicRows("site_content");
        const settings = await loadPublicRows("settings");

        const hidden = new Set(
            settings
                .filter(row => String(row.setting_key || "").startsWith("hidden_content_"))
                .filter(row => String(row.setting_value || "").toLowerCase() === "true")
                .map(row => String(row.setting_key).replace(/^hidden_content_/, ""))
        );

        const content = {};
        contentRows.forEach(row => {
            const key = String(row.content_key || "").trim().toLowerCase();
            if (!key) return;
            if (hidden.has(contentKeySlug(key))) return;
            content[key] = String(row.content_value || "");
        });

        document.querySelectorAll("[data-content-key]").forEach(function (el) {
            const key = String(el.getAttribute("data-content-key") || "").trim().toLowerCase();
            const storage = contentKeySlug(key);
            if (hidden.has(storage)) {
                el.style.display = "none";
                return;
            }
            if (content[key] !== undefined) {
                el.textContent = content[key];
            }
        });

        const setText = (selector, value) => {
            if (value === undefined) return;
            const el = document.querySelector(selector);
            if (el) el.textContent = value;
        };

        setText(".home-page .hero h1", content["homepage hero heading"]);
        setText(".home-page .hero-text", content["homepage tagline"]);
        setText(".home-page .cta-section h2", content["homepage cta"]);
        setText(".home-page .cta-section p", content["homepage cta description"]);

        if (document.body.classList.contains("about-page")) {
            setText(".about-section p:first-of-type", content["about page introduction"]);
        }

        renderDynamicManagedContent(contentRows.filter(row => !hidden.has(contentKeySlug(row.content_key))), getPublicPageKey());

        /* Contact information is a single managed source used by every public footer. */
        const contact = await loadPublicRows("contact_settings");
        const row = contact[0];
        if (row) {
            document.querySelectorAll(".footer-column").forEach(column => {
                const text = (column.textContent || "").toLowerCase();
                if (text.includes("contact")) {
                    const phone = column.querySelector('a[href^="tel:"]');
                    const whatsapp = column.querySelector('a[href*="wa.me"]');
                    const email = column.querySelector('a[href^="mailto:"], a[href*="mail.google.com"]');
                    if (phone && row.phone) {
                        phone.textContent = row.phone;
                        phone.href = "tel:" + row.phone.replace(/\s+/g, "");
                    }
                    if (whatsapp && row.whatsapp) {
                        whatsapp.textContent = row.whatsapp;
                        whatsapp.href = "https://wa.me/" + row.whatsapp.replace(/\D/g, "");
                    }
                    if (email && row.email) {
                        email.textContent = row.email;
                        email.href = "mailto:" + row.email;
                        email.removeAttribute("target");
                        email.removeAttribute("rel");
                    }
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

        /* Managed public navigation and future links. */
        const links = settings
            .filter(row => String(row.setting_key || "").startsWith("site_link_"))
            .map(row => {
                try { return { ...JSON.parse(row.setting_value || "{}"), id: row.id }; }
                catch (_) { return null; }
            })
            .filter(Boolean)
            .filter(item => item.active !== false)
            .sort((a, b) => Number(a.order || 999) - Number(b.order || 999));

        const headerLinks = links.filter(item => (item.location || "header") === "header");
        const nav = document.querySelector(".main-navigation");
        if (nav && headerLinks.length) {
            nav.innerHTML = headerLinks.map(item => {
                const url = String(item.url || "").trim();
                return `<a href="${escapeHTML(url)}">${escapeHTML(item.label || "")}</a>`;
            }).join("");
        }

        const footerLinks = links.filter(item => item.location === "footer");
        if (footerLinks.length) {
            let footer = document.querySelector(".footer-managed-links");
            if (!footer) {
                footer = document.createElement("div");
                footer.className = "footer-managed-links";
                const footerTop = document.querySelector(".footer-top");
                if (footerTop) footerTop.appendChild(footer);
            }
            footer.innerHTML = footerLinks.map(item => `<a href="${escapeHTML(item.url || "")}">${escapeHTML(item.label || "")}</a>`).join("");
        }

        document.querySelectorAll("a").forEach(link => {
            const href = String(link.getAttribute("href") || "");
            if (/^mailto:/i.test(href)) {
                link.removeAttribute("target");
                link.removeAttribute("rel");
            }
        });
    } catch (error) {
        console.warn("Public website content could not be loaded:", error);
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
    setupHelpChat();

    setupCopyright();

    setupGoogleReview();

    setupTrainingWhatsApp();

    setupTrainingForm();

    setupEnquiryForm();

    setupQuoteForm();
    loadPublicStreetwearProducts();
    loadPublicFeaturedCollection();

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
