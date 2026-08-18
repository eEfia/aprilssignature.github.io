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
                const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                const path = `${Date.now()}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}-${safe}`;
                const result = await supabase.storage.from("quote-uploads").upload(path, file, { upsert: false, contentType: file.type });
                if (result.error) throw result.error;
                const publicResult = supabase.storage.from("quote-uploads").getPublicUrl(path);
                uploads.push({ type: item.label, name: file.name, url: publicResult.data.publicUrl });
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


                const services =
                    Array.from(
                        form.querySelectorAll(
                            'input[name="services[]"]:checked, input[name="service"]:checked'
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
                    additionalDetails: String(data.get("additionalDetails") || "").trim(),
                    submittedFrom: window.location.href,
                    uploads: uploadedFiles,
                    sizeMeasurements: String(data.get("sizeMeasurements") || "").trim()
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

                    email:
                        String(
                            data.get(
                                "email"
                            ) || ""
                        ).trim(),

                    service:
                        services.join(", "),

                    journey:
                        JSON.stringify({
                            ...details,
                            sizeMeasurements: String(data.get("sizeMeasurements") || "").trim()
                        })

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
