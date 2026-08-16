/*
============================================================
APRILS SIGNATURE
MAIN WEBSITE SCRIPT
============================================================
*/

(function () {

    "use strict";


    /* ======================================================
       MOBILE MENU
    ====================================================== */

    function setupMobileMenu() {

        const menuButton =
            document.querySelector(".menu-toggle");

        const navigation =
            document.querySelector(".main-navigation");

        if (!menuButton || !navigation) {
            return;
        }

        menuButton.addEventListener("click", function () {

            const isOpen =
                menuButton.getAttribute("aria-expanded") === "true";

            menuButton.setAttribute(
                "aria-expanded",
                String(!isOpen)
            );

            navigation.classList.toggle("open");

        });


        const links =
            navigation.querySelectorAll("a");

        links.forEach(function (link) {

            link.addEventListener("click", function () {

                menuButton.setAttribute(
                    "aria-expanded",
                    "false"
                );

                navigation.classList.remove("open");

            });

        });

    }



    /* ======================================================
       COPYRIGHT YEAR
    ====================================================== */

    function setupCopyrightYear() {

        const year =
            document.getElementById("copyrightYear");

        if (!year) {
            return;
        }

        year.textContent =
            new Date().getFullYear();

    }



    /* ======================================================
       SUPABASE
    ====================================================== */

    function getSupabase() {

        if (window.aprilsSupabase) {
            return window.aprilsSupabase;
        }

        if (window.AprilsSupabase) {
            return window.AprilsSupabase;
        }

        return null;

    }



    function waitForSupabase() {

        return new Promise(function (resolve) {

            const existing =
                getSupabase();

            if (existing) {
                resolve(existing);
                return;
            }

            let attempts = 0;

            const timer =
                setInterval(function () {

                    attempts++;

                    const client =
                        getSupabase();

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



    /* ======================================================
       GENERAL FORM MESSAGE
    ====================================================== */

    function showFormMessage(
        element,
        message,
        success
    ) {

        if (!element) {
            return;
        }

        element.textContent =
            message;

        element.style.display =
            "block";

        element.style.padding =
            "15px";

        element.style.marginTop =
            "15px";

        element.style.borderRadius =
            "5px";

        if (success) {

            element.style.background =
                "#e8f7ee";

            element.style.color =
                "#145c31";

            element.style.borderLeft =
                "4px solid #168544";

        } else {

            element.style.background =
                "#fff0f0";

            element.style.color =
                "#8a0018";

            element.style.borderLeft =
                "4px solid #b00020";

        }

    }



    /* ======================================================
       TRAINING REGISTRATION FORM
    ====================================================== */

    function setupTrainingRegistration() {

        const form =
            document.getElementById(
                "trainingForm"
            );

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


        form.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();


                if (button) {

                    button.disabled = true;

                    button.textContent =
                        "Submitting...";

                }


                if (message) {

                    message.style.display =
                        "none";

                }


                try {

                    const supabase =
                        await waitForSupabase();


                    if (!supabase) {

                        throw new Error(
                            "Supabase is not connected."
                        );

                    }


                    const data =
                        new FormData(form);


                    const fullName =
                        String(
                            data.get("fullName") || ""
                        ).trim();


                    const phone =
                        String(
                            data.get("phone") || ""
                        ).trim();


                    const whatsapp =
                        String(
                            data.get("whatsapp") || ""
                        ).trim();


                    const location =
                        String(
                            data.get("location") || ""
                        ).trim();


                    const course =
                        String(
                            data.get("course") || ""
                        ).trim();


                    const email =
                        String(
                            data.get("email") || ""
                        ).trim();


                    const messageText =
                        String(
                            data.get("message") || ""
                        ).trim();


                    if (!fullName) {

                        throw new Error(
                            "Please enter your full name."
                        );

                    }


                    if (!phone) {

                        throw new Error(
                            "Please enter your phone number."
                        );

                    }


                    if (!whatsapp) {

                        throw new Error(
                            "Please enter your WhatsApp number."
                        );

                    }


                    if (!location) {

                        throw new Error(
                            "Please enter your location."
                        );

                    }


                    if (!course) {

                        throw new Error(
                            "Please select a training course."
                        );

                    }


                    const registration = {

                        full_name: fullName,

                        phone: phone,

                        whatsapp: whatsapp,

                        location: location,

                        course: course,

                        email: email,

                        message: messageText

                    };


                    const response =
                        await supabase
                            .from(
                                "training_registrations"
                            )
                            .insert(
                                [registration]
                            );


                    if (response.error) {

                        console.error(
                            "Supabase training error:",
                            response.error
                        );

                        throw response.error;

                    }


                    showFormMessage(
                        message,
                        "Your training registration has been submitted successfully. Aprils Signature will contact you with the next steps.",
                        true
                    );


                    form.reset();


                } catch (error) {

                    console.error(
                        "Training registration failed:",
                        error
                    );


                    showFormMessage(
                        message,
                        "Your registration could not be submitted. Please try again or contact Aprils Signature on WhatsApp.",
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

            }
        );

    }



    /* ======================================================
       CONTACT / ENQUIRY FORM
    ====================================================== */

    function setupEnquiryForm() {

        const form =
            document.getElementById(
                "enquiryForm"
            );

        if (!form) {
            return;
        }


        const button =
            form.querySelector(
                'button[type="submit"]'
            );


        const message =
            document.getElementById(
                "enquiryFormMessage"
            );


        form.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();


                if (button) {

                    button.disabled = true;

                    button.textContent =
                        "Sending...";

                }


                try {

                    const supabase =
                        await waitForSupabase();


                    if (!supabase) {

                        throw new Error(
                            "Supabase is not connected."
                        );

                    }


                    const formData =
                        new FormData(form);


                    const fullName =
                        String(
                            formData.get("fullName") || ""
                        ).trim();


                    const phone =
                        String(
                            formData.get("phone") || ""
                        ).trim();


                    const whatsapp =
                        String(
                            formData.get("whatsapp") || ""
                        ).trim();


                    const email =
                        String(
                            formData.get("email") || ""
                        ).trim();


                    const subject =
                        String(
                            formData.get("subject") || ""
                        ).trim();


                    const enquiry =
                        String(
                            formData.get("message") ||
                            formData.get("enquiry") ||
                            ""
                        ).trim();


                    const response =
                        await supabase
                            .from(
                                "enquiries"
                            )
                            .insert([
                                {

                                    full_name:
                                        fullName,

                                    phone:
                                        phone,

                                    whatsapp:
                                        whatsapp,

                                    email:
                                        email,

                                    subject:
                                        subject,

                                    message:
                                        enquiry

                                }
                            ]);


                    if (response.error) {

                        throw response.error;

                    }


                    showFormMessage(
                        message,
                        "Your enquiry has been sent successfully. Thank you for contacting Aprils Signature.",
                        true
                    );


                    form.reset();


                } catch (error) {

                    console.error(
                        "Enquiry submission failed:",
                        error
                    );


                    showFormMessage(
                        message,
                        "Your enquiry could not be submitted. Please try again or contact us directly.",
                        false
                    );

                } finally {

                    if (button) {

                        button.disabled = false;

                        button.textContent =
                            "Submit";

                    }

                }

            }
        );

    }



    /* ======================================================
       GOOGLE REVIEW BUTTON
    ====================================================== */

    function setupGoogleReviewLinks() {

        const reviewLinks =
            document.querySelectorAll(
                '[data-google-review]'
            );


        reviewLinks.forEach(function (link) {

            link.setAttribute(
                "href",
                "https://g.page/r/CcD7hxB7NK7pEAE/review"
            );

            link.setAttribute(
                "target",
                "_blank"
            );

            link.setAttribute(
                "rel",
                "noopener noreferrer"
            );

        });

    }



    /* ======================================================
       ACTIVE NAVIGATION
    ====================================================== */

    function setupActiveNavigation() {

        const currentPage =
            window.location.pathname
                .split("/")
                .pop();


        const links =
            document.querySelectorAll(
                ".main-navigation a"
            );


        links.forEach(function (link) {

            const href =
                link.getAttribute("href");


            if (!href) {
                return;
            }


            const linkPage =
                href
                    .split("/")
                    .pop();


            if (
                linkPage === currentPage ||
                (
                    currentPage === "" &&
                    linkPage === "index.html"
                )
            ) {

                link.classList.add(
                    "active"
                );

            }

        });

    }



    /* ======================================================
       SMOOTH SCROLL
    ====================================================== */

    function setupSmoothScrolling() {

        const links =
            document.querySelectorAll(
                'a[href^="#"]'
            );


        links.forEach(function (link) {

            link.addEventListener(
                "click",
                function (event) {

                    const targetId =
                        link.getAttribute("href");


                    if (
                        !targetId ||
                        targetId === "#"
                    ) {

                        return;

                    }


                    const target =
                        document.querySelector(
                            targetId
                        );


                    if (!target) {

                        return;

                    }


                    event.preventDefault();


                    target.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });

                }
            );

        });

    }



    /* ======================================================
       INITIALISE
    ====================================================== */

    function initialize() {

        setupMobileMenu();

        setupCopyrightYear();

        setupTrainingRegistration();

        setupEnquiryForm();

        setupGoogleReviewLinks();

        setupActiveNavigation();

        setupSmoothScrolling();

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize
        );

    } else {

        initialize();

    }

})();
