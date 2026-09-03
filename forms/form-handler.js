/*
=========================================================
APRILS SIGNATURE
FORMS CONTROLLER
=========================================================

This file prepares the website forms for submission.

Forms covered:
1. Order / Quote Requests
2. Training Registration
3. Contact Messages

IMPORTANT:
This file does NOT pretend to be a dae.
The actual secure storage/submission connection
will be connected separately.
=========================================================
*/


(function () {

    "use strict";


    /* =====================================================
       HELPER: SHOW MESSAGE
    ===================================================== */

    function showMessage(form, message, type) {

        let existingMessage =
            form.querySelector(".form-status");

        if (!existingMessage) {

            existingMessage =
                document.createElement("div");

            existingMessage.className =
                "form-status";

            form.prepend(existingMessage);
        }


        existingMessage.textContent = message;

        existingMessage.classList.remove(
            "success-message",
            "error-message"
        );

        if (type === "success") {

            existingMessage.classList.add(
                "success-message"
            );

        } else {

            existingMessage.classList.add(
                "error-message"
            );

        }

    }


    /* =====================================================
       HELPER: CHECK REQUIRED FIELDS
    ===================================================== */

    function validateRequiredFields(form) {

        const requiredFields =
            form.querySelectorAll("[required]");


        for (const field of requiredFields) {

            if (!field.value.trim()) {

                field.focus();

                showMessage(
                    form,
                    "Please complete all required fields.",
                    "error"
                );

                return false;
            }

        }


        return true;

    }


    /* =====================================================
       HELPER: COLLECT FORM INFORMATION
    ===================================================== */

    function collectFormData(form) {

        const formData =
            new FormData(form);

        const data = {};


        formData.forEach(function (value, key) {

            if (value instanceof File) {

                if (value.name) {

                    data[key] = value.name;

                }

            } else {

                data[key] = value;

            }

        });


        return data;

    }


    /* =====================================================
       ORDER / QUOTE FORM
    ===================================================== */

    const quoteForm =
        document.getElementById("quoteForm");


    if (quoteForm) {

        quoteForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();


                if (
                    !validateRequiredFields(
                        quoteForm
                    )
                ) {

                    return;

                }


                const data =
                    collectFormData(
                        quoteForm
                    );


                console.log(
                    "Aprils Signature Order / Quote Request:",
                    data
                );


                showMessage(
                    quoteForm,
                    "Your order / quote request has been prepared successfully. The submission system will be connected to the website next.",
                    "success"
                );

            }
        );

    }


    /* =====================================================
       TRAINING FORM
    ===================================================== */

    const trainingForm =
        document.getElementById(
            "trainingForm"
        );


    if (trainingForm) {

        trainingForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();


                if (
                    !validateRequiredFields(
                        trainingForm
                    )
                ) {

                    return;

                }


                const data =
                    collectFormData(
                        trainingForm
                    );


                console.log(
                    "Aprils Signature Training Registration:",
                    data
                );


                showMessage(
                    trainingForm,
                    "Your training registration has been prepared successfully. The submission system will be connected to the website next.",
                    "success"
                );

            }
        );

    }


    /* =====================================================
       CONTACT FORM
    ===================================================== */

    const contactForm =
        document.getElementById(
            "contactForm"
        );


    if (contactForm) {

        contactForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();


                if (
                    !validateRequiredFields(
                        contactForm
                    )
                ) {

                    return;

                }


                const data =
                    collectFormData(
                        contactForm
                    );


                console.log(
                    "Aprils Signature Contact Message:",
                    data
                );


                showMessage(
                    contactForm,
                    "Your message has been prepared successfully. The submission system will be connected to the website next.",
                    "success"
                );

            }
        );

    }


})();
