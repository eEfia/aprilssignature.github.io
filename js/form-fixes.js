"use strict";

/*
=========================================================
APRILS SIGNATURE
PUBLIC FORM FIXES
=========================================================
*/

(function () {

    function getSupabase() {
        return window.aprilsSupabase || window.AprilsSupabase || null;
    }

    function waitForSupabase(timeout = 15000) {
        const ready = getSupabase();
        if (ready) return Promise.resolve(ready);
        return new Promise(resolve => {
            let done = false;
            const finish = value => {
                if (done) return;
                done = true;
                window.removeEventListener("aprilsSupabaseReady", onReady);
                clearTimeout(timer);
                resolve(value || getSupabase());
            };
            const onReady = () => finish(getSupabase());
            const timer = setTimeout(() => finish(getSupabase()), timeout);
            window.addEventListener("aprilsSupabaseReady", onReady, { once: true });
        });
    }


    function message(element, text, success) {

        if (!element) return;

        element.textContent =
            text;

        element.style.display =
            "block";

        element.style.color =
            success
                ? "green"
                : "red";

    }



    async function uploadQuoteFiles(supabase, form) {
        const inputs = [
            { selector: 'input[name="mockups[]"]', label: "mockup" },
            { selector: 'input[name="inspiration[]"]', label: "inspiration" }
        ];
        const uploads = [];
        for (const item of inputs) {
            const files = Array.from(form.querySelector(item.selector)?.files || []);
            for (const file of files) {
                if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) throw new Error("Only JPG, PNG, WEBP and GIF images can be uploaded.");
                if (file.size > 5 * 1024 * 1024) throw new Error("Each uploaded image must be 5 MB or smaller.");
                const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                const path = `${Date.now()}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}-${safe}`;
                const result = await supabase.storage.from("quote-uploads").upload(path, file, { upsert: false, contentType: file.type });
                if (result.error) throw result.error;
                uploads.push({ type: item.label, name: file.name, path });
            }
        }
        return uploads;
    }

    /* =====================================================
       QUOTE FORM
       ===================================================== */

    function setupQuote() {

        const form =
            document.getElementById(
                "quoteForm"
            );

        if (!form) return;
        form.dataset.formFixesBound = "1";


        form.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();

                event.stopImmediatePropagation();


                const button =
                    document.getElementById(
                        "quoteSubmitButton"
                    );


                const output =
                    document.getElementById(
                        "quoteFormMessage"
                    );


                const supabase =
                    await waitForSupabase();


                if (!supabase) {

                    message(
                        output,
                        "The submission system is temporarily unavailable. Please contact Aprils Signature directly.",
                        false
                    );

                    return;

                }


                const data =
                    new FormData(form);

                const splitSizeOrMeasurements = value => {
                    const text = String(value || "").trim();
                    if (!text) return { size: "", measurements: "" };
                    return /^(size\s*[:\-]?\s*\d+|uk\s*size\s*[:\-]?\s*\d+)/i.test(text)
                        ? { size: text, measurements: "" }
                        : { size: "", measurements: text };
                };


                const services =
                    Array.from(
                        form.querySelectorAll(
                            'input[name="services[]"]:checked'
                        )
                    ).map(function (input) {

                        return input.value;

                    });


                if (!services.length) {

                    message(
                        output,
                        "Please select at least one service.",
                        false
                    );

                    return;

                }


                let uploadedFiles = [];
                if (form.querySelector('input[type="file"]')) {
                    try { uploadedFiles = await uploadQuoteFiles(supabase, form); }
                    catch (uploadError) {
                        console.error("QUOTE UPLOAD ERROR:", uploadError);
                        throw new Error("The image upload could not be completed. Please try again.");
                    }
                }

                const details = {
                    selectedServices: services,
                    streetwear: {},
                    streetwearSizeMeasurements: String(data.get("streetwearSizeMeasurements") || "").trim(),
                    streetwearColour: String(data.get("streetwearColour") || "").trim(),
                    streetwearOther: String(data.get("streetwearOtherRequest") || data.get("streetwearOther") || "").trim(),
                    ladiesWear: String(data.get("ladiesWearDetails") || "").trim(),
                    ladiesWearSize: String(data.get("ladiesWearSize") || "").trim(),
                    ladiesWearColour: String(data.get("ladiesWearColour") || "").trim(),
                    ladiesWearQuantity: String(data.get("ladiesWearQuantity") || "0").trim(),
                    ladiesWearProducts: {},
                    ladiesWearOther: String(data.get("ladiesWearOther") || "").trim(),
                    kidsWear: String(data.get("kidsWearDetails") || "").trim(),
                    kidsWearAge: String(data.get("kidsWearAge") || "").trim(),
                    kidsWearSize: String(data.get("kidsWearSize") || "").trim(),
                    kidsWearMeasurements: String(data.get("kidsWearMeasurements") || "").trim(),
                    kidsWearColour: String(data.get("kidsWearColour") || "").trim(),
                    kidsWearQuantity: String(data.get("kidsWearQuantity") || "0").trim(),
                    training: String(data.get("trainingDetails") || "").trim(),
                    embellishment: data.getAll("embellishment[]").filter(Boolean),
                    embellishmentOther: String(data.get("embellishmentOther") || "").trim(),
                    embellishmentDetails: {},
                    address: {},
                    serviceOther: String(data.get("serviceOtherRequest") || "").trim(),
                    serviceOtherSizeMeasurements: String(data.get("serviceOtherSizeMeasurements") || "").trim(),
                    serviceOtherColour: String(data.get("serviceOtherColour") || "").trim(),
                    serviceOtherQuantity: String(data.get("serviceOtherQuantity") || "1").trim(),
                    additionalDetails: String(data.get("additionalDetails") || "").trim(),
                    deliveryDate: String(data.get("deliveryDate") || "").trim(),
                    deliveryTime: String(data.get("deliveryTime") || "").trim(),
                    uploads: uploadedFiles,
                    mockups: Array.from(document.getElementById("mockups")?.files || []).map(file => file.name),
                    inspiration: Array.from(document.getElementById("inspiration")?.files || []).map(file => file.name),
                    submittedFrom: window.location.href
                };

                if (details.embellishment.length) {
                    details.embellishmentDetails = {
                        selected: details.embellishment,
                        other: details.embellishmentOther
                    };
                }



                Array.from(form.querySelectorAll('input[data-streetwear-product="true"]')).forEach(function(input) {
                    const product = input.getAttribute("data-product-name") || input.name;
                    const active = input.type === "checkbox" ? input.checked : Number(String(data.get(input.name) || "").trim() || 0) > 0;
                    if (!active) return;
                    const box = input.closest(".streetwear-product-row")?.querySelector(".catalogue-detail-box");
                    const rawSizeMeasurements = String(box?.querySelector('[data-detail="sizeMeasurements"]')?.value || details.streetwearSizeMeasurements).trim();
                    const detected = splitSizeOrMeasurements(rawSizeMeasurements);
                    const localColour = String(box?.querySelector('[data-detail="colour"]')?.value || details.streetwearColour).trim();
                    const localQuantity = String(box?.querySelector('[data-detail="quantity"]')?.value || (input.type === "checkbox" ? "1" : data.get(input.name) || "1")).trim();
                    const localDetails = String(box?.querySelector('[data-detail="details"]')?.value || "").trim();
                    details.streetwear[input.name] = { product, quantity: localQuantity, size: detected.size, measurements: detected.measurements, colour: localColour, details: localDetails };
                    if (product === "Others" && localDetails) details.streetwearOther = localDetails;
                });

                // Compatibility with older/static product fields if the dynamic catalogue
                // has not loaded yet. The same streetwear size/measurements and colour(s)
                // apply to the whole streetwear request.
                [
                    "jerseys", "hoodies", "joggersSuperThick", "joggersEveryday", "tshirts", "poloShirts",
                    "sweatshirts", "sweatpants", "ladiesTankTops", "mensTankTops",
                    "varsityJackets", "cargoPants", "cargoSkirts", "joggerShorts",
                    "tshirtsShortsSet", "tshirtSweatpantsSet", "sweatshirtsShortsSet", "sweatshirtsSweatpantsSet"
                ].forEach(function(name) {
                    if (form.querySelector('input[name="' + name + '"][data-streetwear-product="true"]')) return;
                    const raw = String(data.get(name) || "").trim();
                    if (raw !== "" && Number(raw) > 0) {
                        const input = form.querySelector('input[name="' + name + '"]');
                        const label = input?.closest(".form-group")?.querySelector("label")?.textContent?.trim();
                        const productNames = {
                            jerseys: "Jerseys",
                            hoodies: "Hoodies",
                            joggersSuperThick: "Joggers — Super Thick Cotton Joggers",
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
                            tshirtSweatpantsSet: "T-shirt & Sweatpants Set",
                            sweatshirtsShortsSet: "Sweatshirts & Shorts Set",
                            sweatshirtsSweatpantsSet: "Sweatshirts & Sweatpants Set"
                        };
                        details.streetwear[name] = {
                            product: productNames[name] || label || name,
                            quantity: raw,
                            size: details.streetwearSizeMeasurements,
                            measurements: "",
                            colour: details.streetwearColour
                        };
                    }
                });


                Array.from(form.querySelectorAll('input[data-ladieswear-product="true"]:checked')).forEach(function(input) {
                    const item = input.closest(".catalogue-item");
                    const box = item?.querySelector(".catalogue-detail-box");
                    const get = key => String(box?.querySelector(`[data-detail="${key}"]`)?.value || "").trim();
                    const itemSize = get("size") || details.ladiesWearSize;
                    const itemMeasurements = get("measurements") || "";
                    const itemDetails = get("details");
                    details.ladiesWearProducts[input.value] = {
                        product: input.value,
                        size: itemSize,
                        measurements: itemMeasurements,
                        colour: get("colour") || details.ladiesWearColour,
                        quantity: get("quantity") || details.ladiesWearQuantity || "1",
                        details: itemDetails
                    };
                    if (input.value === "Others" && itemDetails) details.ladiesWearOther = itemDetails;
                });

                Array.from(form.querySelectorAll('input[data-embellishment-product="true"]:checked')).forEach(function(input) {
                    const item = input.closest(".catalogue-item");
                    const box = item?.querySelector(".catalogue-detail-box");
                    const get = key => String(box?.querySelector(`[data-detail="${key}"]`)?.value || "").trim();
                    const sizeMeasurements = get("sizeMeasurements");
                    details.embellishmentDetails[input.value] = {
                        service: input.value, size: sizeMeasurements, measurements: "",
                        colour: get("colour"), quantity: get("quantity") || "1", details: get("details")
                    };
                });



                if (services.includes("Others")) {
                    const rawOther = String(data.get("serviceOtherSizeMeasurements") || "").trim();
                    const detectedOther = splitSizeOrMeasurements(rawOther);
                    details.serviceOtherDetails = {
                        size: detectedOther.size,
                        measurements: detectedOther.measurements,
                        colour: String(data.get("serviceOtherColour") || "").trim(),
                        quantity: String(data.get("serviceOtherQuantity") || "1").trim(),
                        details: String(data.get("serviceOtherRequest") || "").trim()
                    };
                }

                const payload = {

                    full_name:
                        String(
                            data.get(
                                "fullName"
                            ) || ""
                        ).trim(),

                    phone:
                        String(
                            data.get(
                                "phone"
                            ) || ""
                        ).trim(),

                    whatsapp:
                        String(
                            data.get(
                                "whatsapp"
                            ) || ""
                        ).trim(),

                    location:
                        String(
                            data.get(
                                "location"
                            ) || ""
                        ).trim(),

                    email:
                        String(
                            data.get(
                                "email"
                            ) || ""
                        ).trim(),

                    service:
                        services.join(", "),

                    journey:
                        JSON.stringify(details)

                };


                if (
                    !payload.full_name ||
                    !payload.phone ||
                    !payload.location
                ) {

                    message(
                        output,
                        "Please complete the required fields.",
                        false
                    );

                    return;

                }


                if (button) {

                    button.disabled =
                        true;

                    button.textContent =
                        "Submitting...";

                }


                try {

                    let result =
                        await supabase
                            .from("quote_requests")
                            .insert([payload]);

                    if (result.error && /journey|column/i.test(result.error.message || "")) {
                        const fallbackPayload = { ...payload };
                        delete fallbackPayload.journey;
                        result = await supabase.from("quote_requests").insert([fallbackPayload]);
                    }

                    if (result.error) {
                        console.error("QUOTE ERROR:", result.error);
                        throw result.error;
                    }

                    try { if (window.aprilsDispatchNotification) await window.aprilsDispatchNotification("quote_requests", result.data?.[0]?.id, payload); } catch (_) {}

                    try {
                        const cached = JSON.parse(localStorage.getItem("aprils_cache_quote_requests") || "[]");
                        cached.push({...payload, id: result.data?.[0]?.id || ("local-" + Date.now()), created_at: new Date().toISOString()});
                        localStorage.setItem("aprils_cache_quote_requests", JSON.stringify(cached.slice(-200)));
                    } catch (_) {}


                    message(
                        output,
                        "Thank you! Your order / quote request has been received successfully. Aprils Signature will contact you shortly.",
                        true
                    );


                    form.reset();


                } catch (error) {

                    console.error(
                        "QUOTE SUBMISSION ERROR:",
                        error
                    );


                    message(
                        output,
                        "We could not submit your request right now. Please try again.",
                        false
                    );


                } finally {

                    if (button) {

                        button.disabled =
                            false;

                        button.textContent =
                            "Submit Order / Request a Quote";

                    }

                }

            },
            true
        );

    }


    /* =====================================================
       TRAINING
       ===================================================== */

    function setupTraining() {

        const form =
            document.getElementById(
                "trainingForm"
            );

        if (!form) return;
        form.dataset.formFixesBound = "1";


        form.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();

                event.stopImmediatePropagation();


                const button =
                    document.getElementById(
                        "trainingSubmitButton"
                    );


                const output =
                    document.getElementById(
                        "trainingFormMessage"
                    );


                const supabase =
                    await waitForSupabase();


                if (!supabase) {

                    message(
                        output,
                        "The submission system is temporarily unavailable.",
                        false
                    );

                    return;

                }


                const data =
                    new FormData(form);

                const splitSizeOrMeasurements = value => {
                    const text = String(value || "").trim();
                    if (!text) return { size: "", measurements: "" };
                    return /^(size\s*[:\-]?\s*\d+|uk\s*size\s*[:\-]?\s*\d+)/i.test(text)
                        ? { size: text, measurements: "" }
                        : { size: "", measurements: text };
                };


                const payload = {

                    full_name:
                        String(
                            data.get(
                                "fullName"
                            ) || ""
                        ).trim(),

                    phone:
                        String(
                            data.get(
                                "phone"
                            ) || ""
                        ).trim(),

                    whatsapp:
                        String(
                            data.get(
                                "whatsapp"
                            ) || ""
                        ).trim(),

                    location:
                        String(
                            data.get(
                                "location"
                            ) || ""
                        ).trim(),

                    course:
                        String(
                            data.get(
                                "course"
                            ) || ""
                        ).trim(),

                    email:
                        String(
                            data.get(
                                "email"
                            ) || ""
                        ).trim(),

                    message:
                        String(
                            data.get(
                                "message"
                            ) || ""
                        ).trim()

                };


                if (
                    !payload.full_name ||
                    !payload.phone ||
                    !payload.location ||
                    !payload.course
                ) {

                    message(
                        output,
                        "Please complete all required fields.",
                        false
                    );

                    return;

                }


                if (button) {

                    button.disabled =
                        true;

                    button.textContent =
                        "Submitting...";

                }


                try {

                    let result =
                        await supabase
                            .from("training_registrations")
                            .insert([payload]);

                    if (result.error && /message|column/i.test(result.error.message || "")) {
                        const fallbackPayload = { ...payload };
                        delete fallbackPayload.message;
                        result = await supabase.from("training_registrations").insert([fallbackPayload]);
                    }

                    if (result.error) {
                        console.error("TRAINING ERROR:", result.error);
                        throw result.error;
                    }

                    try { if (window.aprilsDispatchNotification) await window.aprilsDispatchNotification("training_registrations", result.data?.[0]?.id, payload); } catch (_) {}

                    try {
                        const cached = JSON.parse(localStorage.getItem("aprils_cache_training_registrations") || "[]");
                        cached.push({...payload, id: result.data?.[0]?.id || ("local-" + Date.now()), created_at: new Date().toISOString()});
                        localStorage.setItem("aprils_cache_training_registrations", JSON.stringify(cached.slice(-200)));
                    } catch (_) {}


                    message(
                        output,
                        "Thank you! Your training registration has been received successfully. Aprils Signature will contact you shortly.",
                        true
                    );


                    form.reset();


                } catch (error) {

                    console.error(
                        "TRAINING SUBMISSION ERROR:",
                        error
                    );


                    message(
                        output,
                        "We could not submit your registration right now. Please try again.",
                        false
                    );


                } finally {

                    if (button) {

                        button.disabled =
                            false;

                        button.textContent =
                            "Submit Training Registration";

                    }

                }

            },
            true
        );

    }


    /* =====================================================
       START
       ===================================================== */

    function start() {

        setupQuote();

        setupTraining();

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            start
        );

    } else {

        start();

    }

})();
