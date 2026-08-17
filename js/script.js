(function () {

"use strict";


/* =========================================================
   APRILS SIGNATURE - MAIN JAVASCRIPT
========================================================= */


/* =========================================================
   SUPABASE
========================================================= */

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
                        'input[name="services[]"]:checked'
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

async function applyAdminManagedLinks(){
    const supabase=await waitForSupabase();
    if(!supabase)return;
    try{
        const r=await supabase.from("site_content").select("content_key,content_value");
        const map={social_tiktok:"tiktok",social_instagram:"instagram",social_facebook:"facebook",social_whatsapp:"whatsapp"};
        if(!r.error)(r.data||[]).forEach(x=>{const a=map[x.content_key];if(a&&x.content_value)document.querySelectorAll('[data-social="'+a+'"]').forEach(el=>el.href=x.content_value);});
        const c=await supabase.from("contact_settings").select("*").limit(1).maybeSingle();
        if(!c.error&&c.data){
            const x=c.data;
            if(x.email)document.querySelectorAll('a[href^="mailto:"]').forEach(a=>a.href="mailto:"+x.email);
            if(x.phone)document.querySelectorAll('a[href^="tel:"]').forEach(a=>a.href="tel:"+x.phone.replace(/[^\d+]/g,""));
            if(x.whatsapp){const n=x.whatsapp.replace(/[^\d]/g,"");document.querySelectorAll('a[href*="wa.me/"]').forEach(a=>a.href="https://wa.me/"+n);}
        }
    }catch(e){console.warn("Admin-managed links unavailable",e);}
}
applyAdminManagedLinks();
