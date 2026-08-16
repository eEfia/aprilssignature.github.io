"use strict";

/*
=========================================================
APRILS SIGNATURE
PUBLIC FORM FIXES
=========================================================
*/

(function () {

    function getSupabase() {

        return (
            window.aprilsSupabase ||
            window.AprilsSupabase ||
            null
        );

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


    /* =====================================================
       QUOTE FORM
       ===================================================== */

    function setupQuote() {

        const form =
            document.getElementById(
                "quoteForm"
            );

        if (!form) return;


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
                    getSupabase();


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


                const details = {

                    selectedServices:
                        services,

                    additionalDetails:
                        String(
                            data.get(
                                "additionalDetails"
                            ) || ""
                        ).trim(),

                    submittedFrom:
                        window.location.href

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
                        JSON.stringify(
                            details
                        )

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

                    const result =
                        await supabase
                            .from(
                                "quote_requests"
                            )
                            .insert([
                                payload
                            ]);


                    if (result.error) {

                        console.error(
                            "QUOTE ERROR:",
                            result.error
                        );

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
                    getSupabase();


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

                    const result =
                        await supabase
                            .from(
                                "training_registrations"
                            )
                            .insert([
                                payload
                            ]);


                    if (result.error) {

                        console.error(
                            "TRAINING ERROR:",
                            result.error
                        );

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
