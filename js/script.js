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
        .replace( "&amp;")
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


                try { if (window.aprilsDispatchNotification) await window.aprilsDispatchNotification("enquiries", result.data?.[0]?.id, payload); } catch (_) {}

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

        const streetwear = document.getElementById("streetwearSection");
        if (streetwear) {
            streetwear.style.display = selected.includes("Streetwear") ? "block" : "none";
        }

        const ladiesWear = document.getElementById("ladiesWearSection");
        if (ladiesWear) ladiesWear.style.display = selected.includes("Ladies Wear") ? "block" : "none";

        const kidsWear = document.getElementById("kidsWearSection");
        if (kidsWear) kidsWear.style.display = selected.includes("Kids Wear") ? "block" : "none";

        const serviceOtherSection = document.getElementById("serviceOtherSection");
        const serviceOtherRequest = document.getElementById("serviceOtherRequest");
        const otherServiceSelected = selected.includes("Others");
        if (serviceOtherSection) serviceOtherSection.style.display = otherServiceSelected ? "block" : "none";
        if (serviceOtherRequest) {
            serviceOtherRequest.required = otherServiceSelected;
            if (!otherServiceSelected) serviceOtherRequest.value = "";
        }

        const embellishment = document.getElementById("embellishmentSection");
        if (embellishment) {
            const showEmbellishment = selected.includes("Embellishment Services");
            embellishment.style.display = showEmbellishment ? "block" : "none";

            const embellishmentOtherWrap = document.getElementById("embellishmentOtherWrap");
            const embellishmentOtherInput = document.getElementById("embellishmentOther");
            const otherEmbellishmentSelected = showEmbellishment && !!embellishment.querySelector('input[name="embellishment[]"][value="Others"]:checked');
            if (embellishmentOtherWrap) embellishmentOtherWrap.style.display = otherEmbellishmentSelected ? "block" : "none";
            if (embellishmentOtherInput) {
                embellishmentOtherInput.required = otherEmbellishmentSelected;
                if (!otherEmbellishmentSelected) embellishmentOtherInput.value = "";
            }
        }

        const addOns = document.getElementById("addOnsSection");
        if (addOns) addOns.style.display = selected.includes("Add-ons") ? "block" : "none";

        // The last service clicked is the current work area. Move it directly
        // below Service Selection so the customer never has to hunt for it.
        if (window._aprilsLastServiceInput && window._aprilsLastServiceInput.checked) {
            const value = window._aprilsLastServiceInput.value;
            const targetMap = {
                "Streetwear":"streetwearSection",
                "Ladies Wear":"ladiesWearSection",
                "Kids Wear":"kidsWearSection",
                "Embellishment Services":"embellishmentSection",
                "Others":"serviceOtherSection",
                "Practical Fashion Training":"trainingServiceLink"
            };
            const target = document.getElementById(targetMap[value] || "");
            if (target && target.parentElement === form) {
                form.insertBefore(target, serviceSection.nextSibling);
            }
        }
    }

    serviceInputs.forEach(function (input) {
        input.addEventListener("change", function () {
            if (this.checked) window._aprilsLastServiceInput = this;
            updateServiceSections();
        });
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

async function loadPublicStreetwearProducts(){
    const container=document.getElementById("streetwearProductsDynamic"); if(!container)return;
    const normal=n=>String(n||"").trim().toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g," ").replace(/\\s+/g," ").trim();
    const groups=[
        ["Tops",["Jersey","Jersey Sample","T-Shirt","T-Shirt Sample","Hoodies","Polo Shirt","Sweatshirt","Varsity Jacket"]],
        ["Tank Top Options",["Ladies Tank Top","Men’s Tank Top"]],
        ["Bottoms",["Super Thick Cotton Joggers","Everyday Wear Type of Joggers","Joggers Short","Sweatpants","Jorts","Cargo Pants","Cargo Skirts"]],
        ["Sets",["Hoodies and Joggers Set","T-shirt and Shorts Set","T-shirt and Sweatpants Set","Sweatshirt and Shorts Sets","Sweatshirts and Sweatpants Set"]]
    ];
    const aliases=new Map([
        ["jerseys","jersey"],["t shirts","t shirt"],["t-shirts","t shirt"],["polo shirts","polo shirt"],["sweatshirts","sweatshirt"],
        ["ladies tank tops","ladies tank top"],["mens tank tops","men’s tank top"],["men's tank tops","men’s tank top"],
        ["joggers super thick cotton joggers","super thick cotton joggers"],["joggers everyday wear type","everyday wear type of joggers"],
        ["jogger shorts","joggers short"],["hoodies joggers set","hoodies and joggers set"],["hoodies and joggers","hoodies and joggers set"],
        ["t shirt shorts set","t-shirt and shorts set"],["t shirts shorts set","t-shirt and shorts set"],
        ["t shirt sweatpants set","t-shirt and sweatpants set"],["sweatshirt shorts set","sweatshirt and shorts sets"],
        ["sweatshirts shorts set","sweatshirt and shorts sets"],["sweatshirt sweatpants set","sweatshirts and sweatpants set"],
        ["sweatshirts sweatpants set","sweatshirts and sweatpants set"]
    ]);
    const canonical=new Map(groups.flatMap(g=>g[1]).map(n=>[normal(n),n]));
    const esc=window.escapeHTML||((v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])));
    function detailBox(rowName,includeRequest=false){
        return `<div class="catalogue-detail-box">${includeRequest?`<div class="form-group"><label>Specify Your Request</label><textarea data-detail="details" name="streetwearOtherRequest" placeholder="Tell us what you need."></textarea></div>`:""}<div class="catalogue-detail-grid streetwear-detail-grid"><div class="form-group"><label>Size (UK) / Measurements</label><textarea data-detail="sizeMeasurements" placeholder="Example: Size 12 (UK), or provide your measurements."></textarea></div><div class="form-group"><label>Colour</label><input type="text" data-detail="colour" placeholder="e.g. Black, Gold"></div></div></div>`;
    }
    function quantitySelect(id, productName, zeroSelected=true){
        const options=Array.from({length:21},(_,i)=>`<option value="${i}" ${zeroSelected&&i===0?"selected":""}>${i}</option>`).join("");
        return `<select id="${esc(id)}" name="${esc(id)}" data-streetwear-product="true" data-product-name="${esc(productName)}" aria-label="Quantity for ${esc(productName)}">${options}</select>`;
    }
    function makeRow(name){
        const id="product_"+normal(name).replace(/ /g,"_");
        const jogger=/jogger/i.test(name);
        return `<div class="quantity-row streetwear-product-row catalogue-product-with-details${jogger?" jogger-product-row":""}"><div class="form-group"><h4 class="catalogue-product-title">${esc(name)}</h4><label for="${esc(id)}">Quantity</label>${quantitySelect(id,name)}</div>${detailBox(name)}</div>`;
    }
    function makeOthers(){
        return `<div class="quantity-row streetwear-product-row catalogue-other-row"><div class="form-group"><label class="others-choice" for="product_others">Others</label><input type="checkbox" id="product_others" name="product_others" value="1" data-streetwear-product="true" data-product-name="Others"></div>${detailBox("Others",true)}</div>`;
    }
    function render(products){
        const by=new Map();
        (products||[]).forEach(r=>{const key=aliases.get(normal(r.name))||normal(r.catalogue_key||r.name);const canon=canonical.get(key);if(canon&&!by.has(canon))by.set(canon,{...r,name:r.name||canon});});
        const labelFor=n=>by.get(n)?.name||n;
        let html="";
        groups.forEach(([title,names])=>{
            html+=`<h3 class="catalogue-group-title">${esc(title)}</h3>`;
            if(title==="Bottoms") html+=`<h4 class="catalogue-subgroup-title joggers-subgroup-title">Joggers</h4>`;
            html+=names.map(n=>makeRow(labelFor(n))).join("");
        });
        html+=makeOthers();
        container.innerHTML=html;
        container.querySelectorAll('input[data-streetwear-product="true"], select[data-streetwear-product="true"]').forEach(input=>input.addEventListener("change",()=>{
            const box=input.closest(".streetwear-product-row")?.querySelector(".catalogue-detail-box");
            const active=input.type==="checkbox"?input.checked:Number(input.value||0)>0;
            if(box)box.classList.toggle("is-open",active);
            if(!active&&box)box.querySelectorAll("input,textarea").forEach(x=>{if(x.type!=="number")x.value="";else x.value="1"});
        }));
    }
    const fallback=groups.flatMap(g=>g[1]).map((name,i)=>({name,category:"Streetwear",active:true,display_order:i+1,catalogue_key:normal(name)}));
    render(fallback);
    try{
        const supabase=await waitForSupabase(); if(!supabase)return;
        const result=await supabase.from("settings").select("setting_key,setting_value").like("setting_key","product_%");
        if(result.error)return;
        const products=(result.data||[]).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(r=>r&&r.name&&r.active!==false&&normal(r.category)==="streetwear");
        if(products.length)render(products);
    }catch(e){console.warn("Public streetwear catalogue unavailable:",e)}
}
async function loadPublicLadiesWearProducts() {
    const container=document.getElementById("ladiesWearProductsDynamic"); if(!container)return;
    const groups=[
        ["Dresses and Gowns",["Short gown/dress","Long gown/dress","Corset gown/dress (short)","Corset gown/dress (long)","Bubu","Customised / Embellished Bubu","Kaftan","Customised / Embellished Kaftan","Bubu Kaftan","Customised / Embellished Bubu Kaftan"]],
        ["Tops & Blouses",["Top/blouse","Corset top","Base corset"]],
        ["Bottoms",["Trousers","Palazzo pants","Palazzo shorts","Wrap shorts"]],
        ["Two-Piece Outfits",["Trousers & short top","Trousers & long top","Skirt & short top","Skirt & long top"]],
        ["Kaba and Slit/Skirt",["Standard kaba and slit/skirt","Kaba & slit/skirt (with corset)","Kaba & slit/skirt (kente)"]]
    ];
    const normal=n=>String(n||"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
    const all=groups.flatMap(g=>g[1]); const canon=new Map(all.concat(["Others"]).map(n=>[normal(n),n]));
    const render=products=>{
        const by=new Map(); products.forEach(r=>{const c=canon.get(r.catalogue_key || normal(r.name));if(c&&!by.has(c))by.set(c,{...r,name:r.name || c});});
        const make=(name)=>`<div class="catalogue-item"><label class="check-option"><input type="checkbox" name="ladiesWearProducts[]" value="${escapeHTML(name)}" data-ladieswear-product="true"> ${escapeHTML(name)}</label><div class="catalogue-detail-box">${name === "Others" ? `<div class="form-group"><label>Specify Your Request</label><textarea data-detail="details" name="ladiesWearOther" placeholder="Tell us what you need."></textarea></div>` : ""}<div class="catalogue-detail-grid"><div class="form-group"><label>Size (UK) / Measurements</label><textarea data-detail="sizeMeasurements" placeholder="Example: Size 12 (UK), or provide your measurements."></textarea></div><div class="form-group"><label>Colour</label><input data-detail="colour" placeholder="e.g. Black, Navy Blue"></div><div class="form-group"><label>Quantity</label><input type="number" min="1" value="1" data-detail="quantity"></div></div></div></div>`;
        const html = groups.map(([title,names])=>`<h3 class="catalogue-group-title">${escapeHTML(title)}</h3>${names.map(n=>make(by.get(n)?.name||n)).join("")}`).join("")+`<h3 class="catalogue-group-title">Others</h3>${make(by.get("Others")?.name||"Others")}`;
        const known = new Set(all.map(normal).concat(["others"]));
        const custom = products.filter(r=>normal(r.category)==="ladies wear" && r.active!==false)
            .filter(r=>!known.has(normal(r.catalogue_key || r.name)))
            .sort((a,b)=>Number(a.display_order||9999)-Number(b.display_order||9999));
        container.innerHTML = html + (custom.length ? `<h3 class="catalogue-group-title">Additional Ladies Wear Options</h3>${custom.map(r=>make(r.name)).join("")}` : "");
        container.querySelectorAll('input[data-ladieswear-product="true"]').forEach(cb=>cb.addEventListener("change",()=>{const box=cb.closest(".catalogue-item")?.querySelector(".catalogue-detail-box");if(box)box.classList.toggle("is-open",cb.checked);if(!cb.checked&&box)box.querySelectorAll("input,textarea").forEach(x=>{if(x.type!=="checkbox")x.value=x.type==="number"?"1":""})}));
    };
    const fallback=all.map((name,i)=>({name,category:"Ladies Wear",active:true,display_order:i+1})); render(fallback);
    try{const supabase=await waitForSupabase();if(!supabase)return;const r=await supabase.from("settings").select("setting_value").like("setting_key","product_%");if(r.error)return;const products=(r.data||[]).map(x=>{try{return JSON.parse(x.setting_value||"{}")}catch(_){return null}}).filter(x=>x&&x.name&&x.active!==false&&normal(x.category)==="ladies wear");render(products.length?products:fallback)}catch(e){console.warn("Ladieswear catalogue unavailable:",e)}
}

async function setupEmbellishmentCatalogue(){
    const container=document.getElementById("embellishmentProductsDynamic"); if(!container)return;
    const names=["Rhinestone Embellishment","Screen Printing","Fabric Painting","Glitter Works","Others"];
    const esc=window.escapeHTML||((v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])));
    container.innerHTML=names.map(name=>`<div class="catalogue-item"><label class="check-option"><input type="checkbox" name="embellishment[]" value="${esc(name)}" data-embellishment-product="true"> ${esc(name)}</label><div class="catalogue-detail-box"><div class="catalogue-detail-grid"><div class="form-group"><label>Size (UK) / Measurements</label><textarea data-detail="sizeMeasurements" placeholder="Example: Size 12 (UK), or provide your measurements."></textarea></div><div class="form-group"><label>Colour</label><input data-detail="colour" placeholder="e.g. Gold"></div><div class="form-group"><label>Quantity</label><input type="number" min="1" value="1" data-detail="quantity"></div><div class="form-group" style="grid-column:1/-1"><label>Specify Your Request</label><textarea data-detail="details" placeholder="Specify what you want us to do."></textarea></div></div></div></div>`).join("");
    container.querySelectorAll('input[data-embellishment-product="true"]').forEach(cb=>cb.addEventListener("change",()=>{
        const box=cb.closest(".catalogue-item")?.querySelector(".catalogue-detail-box");
        if(box)box.classList.toggle("is-open",cb.checked);
        if(!cb.checked&&box)box.querySelectorAll("input,textarea").forEach(x=>{if(x.type!=="checkbox")x.value=x.type==="number"?"1":""});
    }));
}
function setupAddOnsCatalogue(){
    const container=document.getElementById("addOnsProductsDynamic"); if(!container)return;
    const names=["Rhinestone Embellishment","Screen Printing / Fabric Painting","Glitter Works","3D Patches","Hand Cut","All-in-one Fabric Embellishment","Others"];
    container.innerHTML=names.map(name=>`<div class="catalogue-item"><label class="check-option"><input type="checkbox" name="addOns[]" value="${escapeHTML(name)}" data-addon-product="true"> ${escapeHTML(name)}</label><div class="catalogue-detail-box"><div class="catalogue-detail-grid"><div class="form-group"><label>Size (UK) / Measurements</label><textarea data-detail="sizeMeasurements" placeholder="Example: Size 12 (UK), or provide your measurements."></textarea></div><div class="form-group"><label>Colour (S)</label><input data-detail="colour" placeholder="e.g. Gold"></div><div class="form-group"><label>Quantity</label><input type="number" min="1" value="1" data-detail="quantity"></div><div class="form-group" style="grid-column:1/-1"><label>Specify Your Request</label><textarea data-detail="details" placeholder="Specify what you need."></textarea></div></div></div></div>`).join("");
    container.querySelectorAll('input[data-addon-product="true"]').forEach(cb=>cb.addEventListener("change",()=>{const box=cb.closest(".catalogue-item")?.querySelector(".catalogue-detail-box");if(box)box.classList.toggle("is-open",cb.checked);if(!cb.checked&&box)box.querySelectorAll("input,textarea").forEach(x=>{if(x.type!=="checkbox")x.value=x.type==="number"?"1":""})}));
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

async function loadPublicSettings() {
    const supabase = await waitForSupabase();
    if (!supabase) return [];
    const queries = [
        supabase.from("settings").select("setting_key,setting_value").like("setting_key","product_%"),
        supabase.from("settings").select("setting_key,setting_value").like("setting_key","homepage_featured_%"),
        supabase.from("settings").select("setting_key,setting_value").like("setting_key","hidden_content_%"),
        supabase.from("settings").select("setting_key,setting_value").like("setting_key","inventory_item_%"),
        supabase.from("settings").select("setting_key,setting_value").in("setting_key",[
            "contact_extra","site_logo_data","site_logo_removed","site_link_payment"
        ])
    ];
    const results = await Promise.all(queries);
    return results.flatMap(r => r.error ? [] : (r.data || [])).filter((row, index, all) =>
        all.findIndex(x => String(x.setting_key) === String(row.setting_key)) === index
    );
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


function resolvePublicMediaUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^(https?:|data:|blob:|\/)/i.test(raw)) return raw;
    return raw.replace(/^(\.\.\/)+/, "");
}

async function loadPublicFeaturedCollection() {
    if (!document.body.classList.contains("home-page")) return;
    const homeFeatured = document.querySelector(".featured-section");
    if (homeFeatured) homeFeatured.style.visibility = "hidden";

    let featured = [];
    let collectionName = "Featured Collection";
    try {
        const supabase = await waitForSupabase();
        if (supabase) {
            const nameResult = await supabase.from("settings").select("setting_value").eq("setting_key","homepage_featured_collection_name").limit(1).maybeSingle();
            if (!nameResult.error && nameResult.data?.setting_value) collectionName = String(nameResult.data.setting_value);
            const settings = await supabase.from("settings")
                .select("setting_key,setting_value")
                .like("setting_key","homepage_featured_%");

            if (!settings.error) {
                featured = (settings.data || []).map(row => {
                    try { return {...JSON.parse(row.setting_value || "{}"), id:row.id}; }
                    catch (_) { return null; }
                }).filter(row => row && row.url && row.active !== false)
                  .sort((a,b) => Number(a.order || 9999) - Number(b.order || 9999));
            }
        }
    } catch (_) {}

    // Backward-compatible fallback for an installation that has not yet created
    // the separate homepage records.
    if (!featured.length) {
        const rows = await loadPublicRows("gallery_items");
        featured = rows.filter(row => row.featured && row.image_url)
            .sort((a,b) => Number(a.display_order || 9999) - Number(b.display_order || 9999));
    }

    if (!featured.length) {
        if (homeFeatured) homeFeatured.style.visibility = "visible";
        return;
    }

    const main = document.querySelector("main");
    if (!main) return;

    const existing = main.querySelector(".featured-collection, .featured-section");
    if (!existing) {
        if (homeFeatured) homeFeatured.style.visibility = "visible";
        return;
    }

    existing.innerHTML = `
        <div class="container">
            <div class="section-heading">
                <p class="eyebrow">Selected Work</p>
                <h2>${escapeHTML(collectionName)}</h2>
            </div>
            <div class="featured-grid">
                ${featured.map(row => {
                    const mediaUrl = resolvePublicMediaUrl(row.url || row.image_url || "");
                    const media = /\.(mp4|webm|ogg)(\?|$)/i.test(mediaUrl)
                        ? `<div class="featured-video"><video controls preload="metadata" playsinline muted><source src="${escapeHTML(mediaUrl)}" type="video/mp4"></video></div>`
                        : `<div class="featured-video"><img src="${escapeHTML(mediaUrl)}" alt="${escapeHTML(row.title || "Featured Aprils Signature work")}"></div>`;
                    return `<article class="featured-card">
                        ${media}
                        ${row.title ? `<h3>${escapeHTML(row.title)}</h3>` : ""}
                        ${row.description ? `<p>${escapeHTML(row.description)}</p>` : ""}
                    </article>`;
                }).join("")}
            </div>
            <div class="section-button"><a href="gallery.html" class="btn btn-primary">View Full Gallery</a></div>
        </div>`;
    setupMediaInteractions();
    if (homeFeatured) homeFeatured.style.visibility = "visible";
}

async function loadPublicGallery() {
    if (!document.body.classList.contains("gallery-page")) return;
    const galleryMain = document.querySelector("main");
    if (galleryMain) galleryMain.style.visibility = "hidden";
    let rows = [];
    try { rows = await loadPublicRows("gallery_items"); } catch (_) {
        if (galleryMain) galleryMain.style.visibility = "hidden";
        return;
    }
    if (!rows.length) {
        setupMediaInteractions();
        if (galleryMain) galleryMain.style.visibility = "hidden";
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
    if (!activeRows.length) {
        if (galleryMain) galleryMain.style.visibility = "hidden";
        return;
    }

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
        collections.forEach(row => collectionOrder.set(String(row.name || "").trim().toLowerCase(), Number(row.display_order ?? 9999)));
    } catch (_) {}

    const fragment = document.createDocumentFragment();

    Object.keys(groups).sort((a,b) => (collectionOrder.get(String(a).trim().toLowerCase()) ?? Math.min(...groups[a].map(r => Number(r.display_order ?? 9999)))) - (collectionOrder.get(String(b).trim().toLowerCase()) ?? Math.min(...groups[b].map(r => Number(r.display_order ?? 9999)))) || a.localeCompare(b)).forEach(category => {
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
                                ${/\.(mp4|webm|ogg)(\?|$)/i.test(resolvePublicMediaUrl(row.image_url || ""))
                                    ? `<video controls autoplay muted loop playsinline preload="metadata"><source src="${escapeHTML(resolvePublicMediaUrl(row.image_url || ""))}" type="video/mp4"></video>`
                                    : `<img src="${escapeHTML(resolvePublicMediaUrl(row.image_url || ""))}" alt="${escapeHTML(row.title || category)}">`}
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
    if (galleryMain) galleryMain.style.visibility = "visible";
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
    let publicPriceRows = [];
    try {
        const supabase = await waitForSupabase();
        if (supabase) {
            const r = await supabase.from("settings").select("setting_key,setting_value").like("setting_key","public_training_price_%");
            if (!r.error) {
                publicPriceRows = (r.data || []).map(x => {
                    try { return JSON.parse(x.setting_value || "{}"); } catch (_) { return null; }
                }).filter(Boolean);
            }
        }
    } catch (_) {}

    const desired = [
        {
            title: "Three Months Beginners Fashion Training",
            aliases: ["three months beginners fashion training", "3 months beginners fashion training", "3 months beginner's fashion training"],
            fallback: "A practical programme designed for beginners who want to develop foundational fashion skills."
        },
        {
            title: "Six Months Fashion Training",
            aliases: ["six months fashion training", "6 months fashion training"],
            fallback: "A more detailed training programme for learners who want to improve their fashion knowledge and practical skills."
        },
        {
            title: "One Year Fashion Training",
            aliases: ["one year fashion training", "1 year fashion training"],
            fallback: "A comprehensive programme covering a wider range of fashion techniques and production skills."
        },
        {
            title: "Three Years Apprenticeship Training",
            aliases: ["three years apprenticeship training", "3 years apprenticeship training"],
            fallback: "A long-term practical apprenticeship programme focused on developing professional fashion skills."
        },
        {
            title: "1 Month Streetwear Class",
            aliases: ["1 month streetwear class"],
            fallback: "For those who can already cut and sew without supervision and want to upgrade in streetwear."
        },
        {
            title: "3 Months Advanced Streetwear Class",
            aliases: ["3 months advanced streetwear class", "3 months advanced streetwear"],
            fallback: "For those with basic sewing knowledge who want to advance their streetwear skills."
        },
        {
            title: "6 Months Beginners' Streetwear Class",
            aliases: ["6 months beginners' streetwear class", "6 months beginners streetwear class"],
            fallback: "For absolute beginners interested in learning streetwear production."
        }
    ];

    const normalized = value => String(value || "").trim().toLowerCase().replace(/[’']/g, "'");

    const cards = desired.map(item => {
        const match = rows.find(row => item.aliases.includes(normalized(row.title)));
        const publicPrice = publicPriceRows.find(p =>
            normalized(p.name) === normalized(match?.title || item.title)
        );
        return {
            title: item.title,
            description: match?.description || item.fallback,
            price: publicPrice?.price !== undefined ? Number(publicPrice.price) : null,
            active: match?.active !== false
        };
    }).filter(item => item.active);

    const grid = document.querySelector(".training-section .training-grid");
    if (!grid) return;

    // Keep the public training cards to the seven programmes requested for the
    // top card area. Specialty classes below remain separate.
    grid.innerHTML = cards.map(row => `
        <article class="training-card">
            <h3>${escapeHTML(row.title)}</h3>
            ${row.price !== null && row.price !== undefined && !Number.isNaN(row.price) ? `<p class="service-public-price"><strong>Price:</strong> GHS ${Number(row.price).toFixed(2)}</p>` : ""}
            <p>${escapeHTML(row.description)}</p>
        </article>
    `).join("");
}

async function loadPublicTrainingRegistrationOptions(){
    const select=document.getElementById("courseInterested"); if(!select)return;
    try{
        const supabase=await waitForSupabase(); if(!supabase)return;
        const [programs,prices]=await Promise.all([
            supabase.from("training_programs").select("title,category,active,display_order"),
            supabase.from("settings").select("setting_value").like("setting_key","public_training_price_%")
        ]);
        if(programs.error)return;
        const priceRows=(prices.data||[]).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
        const rows=(programs.data||[]).filter(r=>r.active!==false&&r.title).sort((a,b)=>Number(a.display_order||9999)-Number(b.display_order||9999)||String(a.title).localeCompare(String(b.title)));
        if(!rows.length)return;
        select.innerHTML='<option value="">Select a Course/Class</option>';
        rows.forEach(r=>{
            const opt=document.createElement("option");
            const p=priceRows.find(x=>String(x.name||"").trim().toLowerCase()===String(r.title||"").trim().toLowerCase());
            opt.value=r.title;
            opt.textContent=p?.price!==undefined ? `${r.title} — GHS ${Number(p.price).toFixed(2)}` : r.title;
            select.appendChild(opt);
        });
    }catch(e){console.warn("Training registration catalogue unavailable:",e)}
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
        const settings = await loadPublicSettings();

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

        /* Managed public navigation. Core pages are always retained.
           Custom links may be added/edited without ever leaving the public
           site with a one-link header. */
        const coreNavigation = [
            {key:"home", label:"Home", url:"index.html", order:1},
            {key:"about", label:"About", url:"about.html", order:2},
            {key:"services", label:"Services", url:"services.html", order:3},
            {key:"gallery", label:"Gallery", url:"gallery.html", order:4},
            {key:"shop", label:"Shop", url:"shop.html", order:5},
            {key:"training", label:"Training", url:"training.html", order:6},
            {key:"order", label:"Order / Request a Quote", url:"quotes.html", order:7},
            {key:"policies", label:"Policies & Terms", url:"policies.html", order:8},
            {key:"contact", label:"Contact", url:"contact.html", order:9}
        ];
        const managed = settings
            .filter(row => String(row.setting_key || "").startsWith("site_link_"))
            .map(row => {
                try { return { ...JSON.parse(row.setting_value || "{}"), id: row.id }; }
                catch (_) { return null; }
            })
            .filter(item => item && !/payment\.html/i.test(String(item.url || "")) && String(item.label || "").trim().toLowerCase() !== "payment details");

        const managedByUrl = new Map(managed.map(item => [String(item.url || "").trim().toLowerCase(), item]));
        const mergedCore = coreNavigation.map(core => {
            const managedItem = managedByUrl.get(core.url.toLowerCase());
            return managedItem ? {...core, ...managedItem, active:true, url:core.url} : {...core, active:true};
        });
        const customHeaderLinks = managed
            .filter(item => (item.location || "header") === "header")
            .filter(item => !coreNavigation.some(core => core.url.toLowerCase() === String(item.url || "").trim().toLowerCase()))
            .filter(item => item.active !== false);
        const headerLinks = [...mergedCore, ...customHeaderLinks]
            .sort((a,b)=>Number(a.order||999)-Number(b.order||999));
        const nav = document.querySelector(".main-navigation");
        if (nav) {
            nav.innerHTML = headerLinks.map(item => {
                const url = String(item.url || "").trim();
                return `<a href="${escapeHTML(url)}">${escapeHTML(item.label || "")}</a>`;
            }).join("");
        }

        const footerLinks = managed.filter(item => item.location === "footer" && item.active !== false);
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
                    const policyRank = {
                        payment_policy: 1,
                        refund_policy: 2,
                        delivery_collection_policy: 3,
                        privacy_policy: 4
                    };
                    policies
                        .slice()
                        .sort((a, b) => (policyRank[String(a.policy_key || "").toLowerCase()] || 99) - (policyRank[String(b.policy_key || "").toLowerCase()] || 99))
                        .forEach(row => {
                            const policyKey = String(row.policy_key || "").toLowerCase();
                            const policyNumber = policyRank[policyKey] || "";
                            const cleanTitle = String(row.title || "").replace(/^\s*[1-4]\s*\.\s*/, "");
                            const displayTitle = policyNumber ? `${policyNumber}. ${cleanTitle}` : cleanTitle;
                            const section = document.createElement("section");
                            section.className = "policy-section";
                            const container = document.createElement("div");
                            container.className = "container";
                            const heading = document.createElement("h2");
                            heading.textContent = displayTitle;
                            container.appendChild(heading);

                            const rawContent = String(row.content || "");
                            const paragraphs = rawContent.split(/\n\s*\n/);
                            paragraphs.forEach(textBlock => {
                                const clean = textBlock.trim();
                                if (!clean) return;
                                if (policyKey === "privacy_policy" && /the information we may collect includes/i.test(clean)) {
                                    const intro = document.createElement("p");
                                    intro.textContent = "The information we may collect includes:";
                                    container.appendChild(intro);
                                    const ul = document.createElement("ul");
                                    [
                                        "Name",
                                        "Phone number",
                                        "Email address",
                                        "Delivery or pickup details",
                                        "Measurements",
                                        "Uploaded garments photos or mockups",
                                        "Any other information you may choose to provide"
                                    ].forEach(item => {
                                        const li = document.createElement("li");
                                        li.textContent = item;
                                        ul.appendChild(li);
                                    });
                                    container.appendChild(ul);
                                    return;
                                }

                                const trainingMatch = clean.match(/^For any form of (fashion training|training)\s*\n([\s\S]*)$/i);
                                if (trainingMatch) {
                                    const note = document.createElement("div");
                                    note.className = "policy-training-note";
                                    const h3 = document.createElement("h3");
                                    h3.textContent = "For any form of " + trainingMatch[1];
                                    note.appendChild(h3);
                                    const body = trainingMatch[2].trim();
                                    if (body) {
                                        const items = body.split(/\n/).map(x => x.trim()).filter(Boolean);
                                        if (items.length && items.every(item => /^[-•]/.test(item))) {
                                            const ul = document.createElement("ul");
                                            items.forEach(item => {
                                                const li = document.createElement("li");
                                                li.textContent = item.replace(/^[-•]\s*/, "");
                                                ul.appendChild(li);
                                            });
                                            note.appendChild(ul);
                                        } else {
                                            const p = document.createElement("p");
                                            p.textContent = body;
                                            note.appendChild(p);
                                        }
                                    }
                                    container.appendChild(note);
                                } else {
                                    const lines = clean.split(/\n/).map(x => x.trim()).filter(Boolean);
                                    const bulletLines = lines.filter(line => /^[-•]/.test(line));
                                    if (bulletLines.length === lines.length && bulletLines.length) {
                                        const ul = document.createElement("ul");
                                        bulletLines.forEach(item => {
                                            const li = document.createElement("li");
                                            li.textContent = item.replace(/^[-•]\s*/, "");
                                            ul.appendChild(li);
                                        });
                                        container.appendChild(ul);
                                    } else {
                                        const p = document.createElement("p");
                                        p.textContent = clean;
                                        container.appendChild(p);
                                    }
                                }
                            });
                            section.appendChild(container);
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

async function loadPublicContactExtras() {
    try {
        const settings = await loadPublicSettings();
        const row = settings.find(item => String(item.setting_key || "") === "contact_extra");
        if (!row?.setting_value) return;
        let extras = [];
        try { extras = JSON.parse(row.setting_value); } catch (_) { return; }
        if (!Array.isArray(extras) || !extras.length) return;

        document.querySelectorAll(".footer-column").forEach(column => {
            if (!/^contact$/i.test(String(column.querySelector("h3")?.textContent || "").trim())) return;
            if (column.querySelector("[data-public-contact-extras]")) return;
            const box = document.createElement("div");
            box.setAttribute("data-public-contact-extras", "true");
            box.style.marginTop = "12px";
            box.innerHTML = extras.map(item =>
                `<p><strong>${escapeHTML(item.label || "")}:</strong><br>${escapeHTML(item.value || "")}</p>`
            ).join("");
            column.appendChild(box);
        });
    } catch (error) {
        console.warn("Additional public contact details could not be loaded:", error);
    }
}

async function loadPublicLogoSetting() {
    try {
        const settings = await loadPublicSettings();
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
        loadPublicLogoSetting(),
        loadPublicContactExtras()
    ]);
    setupMediaInteractions();
}

function setupAutomaticCapitalisation() {
    if (document.documentElement.dataset.aprilsCapitalisationBound) return;
    document.documentElement.dataset.aprilsCapitalisationBound = "1";
    const skip = new Set(["email","url","password","tel","number","date","time","hidden"]);
    document.addEventListener("input", event => {
        const field = event.target;
        if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
        if (skip.has(String(field.type || "").toLowerCase())) return;
        if (/email|url|password|phone|whatsapp|website|link/i.test(String(field.name || "") + " " + String(field.id || ""))) return;
        field.value = String(field.value || "").replace(/(^|[\s\-\/\(])([a-z])/g, (_, prefix, letter) => prefix + letter.toUpperCase());
    }, true);
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
    setupAutomaticCapitalisation();
    loadPublicStreetwearProducts();
    loadPublicLadiesWearProducts();
    loadPublicTrainingRegistrationOptions();
    setupEmbellishmentCatalogue();
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

/* APRILS FIRST-LETTER CAPITALIZATION */
(function(){
    const skip=new Set(["email","url","password","tel","number","date","time","search","hidden"]);
    document.addEventListener("input",function(e){
        const el=e.target;
        if(!(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement))return;
        if(skip.has(String(el.type||"").toLowerCase()))return;
        if(/email|url|password|phone|whatsapp|website|link/i.test(String(el.name||"")+" "+String(el.id||"")))return;
        el.value=String(el.value||"").replace(/(^|[\s\-\/\(])([a-z])/g,(_,p,c)=>p+c.toUpperCase());
    },true);
})();


/* Strict correction bridge: public pages always re-read current admin-managed
   products/training prices so edits are reflected without rebuilding static HTML. */
(function(){
  async function strictLivePublicSync(){
    try{
      const body=document.body;if(!body)return;
      const db=typeof window.waitForSupabase==='function'?await window.waitForSupabase():null;if(!db)return;
      if(body.classList.contains('training-page')){
        const [tr,pr]=await Promise.all([db.from('training_programs').select('title,category,description,active,display_order'),db.from('settings').select('setting_value').like('setting_key','public_training_price_%')]);
        if(!tr.error){const rows=(tr.data||[]).filter(x=>x.active!==false&&x.title),prices=(pr.data||[]).map(x=>{try{return JSON.parse(x.setting_value||'{}')}catch(_){return null}}).filter(Boolean),norm=x=>String(x||'').toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9]+/g,' ').trim(),getPrice=x=>prices.find(p=>norm(p.name)===norm(x))?.price;
          document.querySelectorAll('.training-category li,.training-category h4').forEach(n=>{const r=rows.find(x=>norm(x.title)===norm(n.textContent.replace(/\s+—\s+GHS\s+[\d,.]+$/,'')));if(r){const p=getPrice(r.title);n.textContent=r.title+(p!==undefined?` — GHS ${Number(p).toFixed(2)}`:'')}});
        }
      }
      if(body.classList.contains('services-page')){
        const r=await db.from('settings').select('setting_value').like('setting_key','product_%');if(!r.error){const products=(r.data||[]).map(x=>{try{return JSON.parse(x.setting_value||'{}')}catch(_){return null}}).filter(x=>x&&x.name&&x.active!==false);let sec=document.getElementById('managedProductCatalogue');if(!sec){sec=document.createElement('section');sec.id='managedProductCatalogue';sec.className='service-section';sec.innerHTML='<div class="container"><h2>Product Catalogue</h2><div class="services-grid" id="managedProductGrid"></div></div>';document.querySelector('main')?.appendChild(sec)}const grid=sec.querySelector('#managedProductGrid');if(grid){const groups=new Map();products.forEach(x=>{const k=x.category||'Products / Services';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x)});grid.innerHTML=[...groups].map(([k,a])=>`<article class="service-card"><h3>${escapeHTML(k)}</h3>${a.sort((x,y)=>Number(x.display_order||9999)-Number(y.display_order||9999)).map(x=>`<div><strong>${escapeHTML(x.name)}</strong>${x.public_price!==null&&x.public_price!==undefined&&x.public_price!==''?`<p class="service-public-price">Price: GHS ${Number(x.public_price).toFixed(2)}</p>`:''}${x.subcategory?`<small>${escapeHTML(x.subcategory)}</small>`:''}${x.notes?`<p>${escapeHTML(x.notes)}</p>`:''}</div>`).join('')}</article>`).join('')}}
      }
    }catch(e){console.warn('Strict live public sync unavailable',e)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(strictLivePublicSync,1200));else setTimeout(strictLivePublicSync,1200);
})();

/* Strict quote-catalogue bridge: every active product saved in Admin is also
   available in the relevant public selection area, including future additions. */
(function(){
  async function strictQuoteCatalogue(){
    try{
      if(!document.querySelector('#streetwearProductsDynamic,#embellishmentProductsDynamic'))return;
      const d=await (typeof window.waitForSupabase==='function'?window.waitForSupabase():Promise.resolve(null));if(!d)return;
      const r=await d.from('settings').select('setting_value').like('setting_key','product_%');if(r.error)return;
      const rows=(r.data||[]).map(x=>{try{return JSON.parse(x.setting_value||'{}')}catch(_){return null}}).filter(x=>x&&x.name&&x.active!==false);
      const norm=x=>String(x||'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
      const addCustom=(containerId,category)=>{
        const c=document.getElementById(containerId);if(!c)return;
        const existing=new Set([...c.querySelectorAll('[data-product-name]')].map(x=>norm(x.dataset.productName)));
        const custom=rows.filter(x=>norm(x.category)===norm(category)&&!existing.has(norm(x.name)));
        if(!custom.length)return;
        let title=c.querySelector('.strict-custom-catalogue-title');if(!title){title=document.createElement('h3');title.className='catalogue-group-title strict-custom-catalogue-title';title.textContent='Additional Options';c.appendChild(title)}
        custom.sort((a,b)=>Number(a.display_order||9999)-Number(b.display_order||9999)).forEach(x=>{
          const row=document.createElement('div');row.className='quantity-row streetwear-product-row catalogue-product-with-details';row.innerHTML=`<div class="form-group"><h4 class="catalogue-product-title">${escapeHTML(x.name)}</h4><label>Quantity</label><select data-streetwear-product="true" data-product-name="${escapeHTML(x.name)}">${Array.from({length:21},(_,i)=>`<option value="${i}">${i}</option>`).join('')}</select></div><div class="catalogue-detail-box"><div class="catalogue-detail-grid"><div class="form-group"><label>Size (UK) / Measurements</label><textarea data-detail="sizeMeasurements"></textarea></div><div class="form-group"><label>Colour</label><input data-detail="colour"></div></div></div>`;c.appendChild(row);
          const sel=row.querySelector('select');sel.addEventListener('change',()=>row.querySelector('.catalogue-detail-box')?.classList.toggle('is-open',Number(sel.value||0)>0));
        });
      };
      addCustom('streetwearProductsDynamic','Streetwear');
      addCustom('embellishmentProductsDynamic','Embellishment Services');
    }catch(e){console.warn('Strict quote catalogue sync unavailable',e)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(strictQuoteCatalogue,1500));else setTimeout(strictQuoteCatalogue,1500);
})();
