/* =========================================================
   APRILS SIGNATURE
   FINAL WEBSITE JAVASCRIPT
   ========================================================= */

(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", function () {

        initializeCopyrightYear();
        initializeMobileNavigation();
        initializeSmoothLinks();
        initializeImageFallbacks();
        initializeExternalLinks();
        initializeAccessibility();
        initializeQuoteForm();
        initializeTrainingForm();
        initializeGalleryViewer();
        initializeAboutPhotoViewer();

    });


    /* =====================================================
       COPYRIGHT YEAR
       ===================================================== */

    function initializeCopyrightYear() {

        document.querySelectorAll("#copyrightYear").forEach(function (element) {

            element.textContent = new Date().getFullYear();

        });

    }


    /* =====================================================
       MOBILE NAVIGATION
       ===================================================== */

    function initializeMobileNavigation() {

        const toggle = document.querySelector(".menu-toggle");
        const navigation = document.querySelector(".main-navigation");

        if (!toggle || !navigation) return;

        toggle.addEventListener("click", function () {

            const isOpen =
                navigation.classList.toggle("is-open");

            toggle.setAttribute(
                "aria-expanded",
                String(isOpen)
            );

            toggle.setAttribute(
                "aria-label",
                isOpen
                    ? "Close navigation"
                    : "Open navigation"
            );

        });


        navigation.querySelectorAll("a").forEach(function (link) {

            link.addEventListener("click", function () {

                navigation.classList.remove("is-open");

                toggle.setAttribute(
                    "aria-expanded",
                    "false"
                );

                toggle.setAttribute(
                    "aria-label",
                    "Open navigation"
                );

            });

        });

    }


    /* =====================================================
       SMOOTH INTERNAL LINKS
       ===================================================== */

    function initializeSmoothLinks() {

        document.querySelectorAll('a[href^="#"]').forEach(function (link) {

            link.addEventListener("click", function (event) {

                const targetId =
                    link.getAttribute("href");

                if (!targetId || targetId === "#") {
                    return;
                }

                const target =
                    document.querySelector(targetId);

                if (target) {

                    event.preventDefault();

                    target.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });

                }

            });

        });

    }


    /* =====================================================
       IMAGE FALLBACK
       ===================================================== */

    function initializeImageFallbacks() {

        document.querySelectorAll("img").forEach(function (image) {

            image.addEventListener("error", function () {

                image.classList.add("image-not-found");

                if (!image.alt) {
                    image.alt = "Aprils Signature image";
                }

            });

        });

    }


    /* =====================================================
       EXTERNAL LINKS
       ===================================================== */

    function initializeExternalLinks() {

        document
            .querySelectorAll('a[target="_blank"]')
            .forEach(function (link) {

                link.setAttribute(
                    "rel",
                    "noopener noreferrer"
                );

            });

    }


    /* =====================================================
       ACCESSIBILITY
       ===================================================== */

    function initializeAccessibility() {

        document.querySelectorAll("button").forEach(function (button) {

            if (
                !button.getAttribute("aria-label") &&
                !button.textContent.trim()
            ) {

                button.setAttribute(
                    "aria-label",
                    "Website button"
                );

            }

        });

    }


    /* =====================================================
       QUOTE FORM
       ===================================================== */

    function initializeQuoteForm() {

        const form =
            document.getElementById("quoteForm");

        if (!form) return;

        const serviceInputs =
            form.querySelectorAll(
                'input[name="service"]'
            );

        const streetwearSection =
            document.getElementById(
                "streetwearSection"
            );

        const embellishmentSection =
            document.getElementById(
                "embellishmentSection"
            );


        serviceInputs.forEach(function (input) {

            input.addEventListener(
                "change",
                function () {

                    if (streetwearSection) {
                        streetwearSection.style.display =
                            "none";
                    }

                    if (embellishmentSection) {
                        embellishmentSection.style.display =
                            "none";
                    }


                    if (
                        this.value === "Streetwear" &&
                        streetwearSection
                    ) {

                        streetwearSection.style.display =
                            "block";

                    }


                    if (
                        this.value === "Embellishment Services" &&
                        embellishmentSection
                    ) {

                        embellishmentSection.style.display =
                            "block";

                    }


                    if (
                        this.value ===
                        "Practical Fashion Training"
                    ) {

                        window.location.href =
                            "training.html";

                    }

                }
            );

        });


        form.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();

                alert(
                    "Your Order / Request a Quote form is ready. The final submission connection will connect it to the Aprils Signature Admin Dashboard and Google Sheets."
                );

            }
        );

    }


    /* =====================================================
       TRAINING FORM
       ===================================================== */

    function initializeTrainingForm() {

        const form =
            document.getElementById("trainingForm");

        if (!form) return;

        form.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();

                alert(
                    "Your Training Registration form is ready. The final submission connection will connect it to the Aprils Signature Admin Dashboard and Google Sheets."
                );

            }
        );

    }


    /* =====================================================
       GALLERY VIEWER
       ===================================================== */

    function initializeGalleryViewer() {

        const galleryItems =
            document.querySelectorAll(
                ".gallery-item"
            );

        if (!galleryItems.length) return;


        const viewer =
            document.createElement("div");

        viewer.id = "galleryViewer";

        viewer.innerHTML = `
            <button
                id="galleryViewerClose"
                type="button"
                aria-label="Close viewer"
            >
                &times;
            </button>

            <div id="galleryViewerContent"></div>
        `;

        document.body.appendChild(viewer);


        const content =
            viewer.querySelector(
                "#galleryViewerContent"
            );

        const close =
            viewer.querySelector(
                "#galleryViewerClose"
            );


        function closeViewer() {

            viewer.classList.remove("active");

            content.innerHTML = "";

            document.body.style.overflow = "";

        }


        function openImage(image) {

            content.innerHTML = "";

            const enlarged =
                document.createElement("img");

            enlarged.src =
                image.currentSrc ||
                image.src;

            enlarged.alt =
                image.alt || "";

            content.appendChild(enlarged);

            viewer.classList.add("active");

            document.body.style.overflow =
                "hidden";

        }


        function openVideo(video) {

            content.innerHTML = "";

            const enlarged =
                document.createElement("video");

            enlarged.controls = true;
            enlarged.autoplay = true;
            enlarged.playsInline = true;

            const source =
                video.querySelector("source");

            if (source) {

                const newSource =
                    document.createElement("source");

                newSource.src =
                    source.src;

                newSource.type =
                    source.type ||
                    "video/mp4";

                enlarged.appendChild(
                    newSource
                );

            }

            content.appendChild(enlarged);

            viewer.classList.add("active");

            document.body.style.overflow =
                "hidden";

            enlarged
                .play()
                .catch(function () {});

        }


        galleryItems.forEach(function (item) {

            const image =
                item.querySelector(
                    ".gallery-image img"
                );

            const video =
                item.querySelector(
                    ".gallery-image video"
                );


            if (image) {

                image.addEventListener(
                    "click",
                    function () {

                        openImage(image);

                    }
                );

            }


            if (video) {

                video.addEventListener(
                    "dblclick",
                    function (event) {

                        event.preventDefault();

                        openVideo(video);

                    }
                );

            }

        });


        close.addEventListener(
            "click",
            closeViewer
        );


        viewer.addEventListener(
            "click",
            function (event) {

                if (event.target === viewer) {

                    closeViewer();

                }

            }
        );


        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Escape" &&
                    viewer.classList.contains("active")
                ) {

                    closeViewer();

                }

            }
        );

    }


    /* =====================================================
       ABOUT PAGE — PHOTO 5 VIEWER
       ===================================================== */

    function initializeAboutPhotoViewer() {

        const image =
            document.querySelector(
                ".shop-photo img"
            );

        if (!image) return;


        const viewer =
            document.createElement("div");

        viewer.id =
            "locationImageViewer";

        viewer.innerHTML = `
            <button
                id="locationImageViewerClose"
                type="button"
                aria-label="Close image"
            >
                &times;
            </button>

            <img
                id="locationImageViewerImage"
                alt=""
            >
        `;

        document.body.appendChild(viewer);


        const largeImage =
            document.getElementById(
                "locationImageViewerImage"
            );

        const closeButton =
            document.getElementById(
                "locationImageViewerClose"
            );


        image.addEventListener(
            "click",
            function () {

                largeImage.src =
                    image.currentSrc ||
                    image.src;

                largeImage.alt =
                    image.alt ||
                    "Aprils Signature shop";

                viewer.classList.add("active");

                document.body.style.overflow =
                    "hidden";

            }
        );


        function closeViewer() {

            viewer.classList.remove("active");

            largeImage.src = "";

            document.body.style.overflow =
                "";

        }


        closeButton.addEventListener(
            "click",
            closeViewer
        );


        viewer.addEventListener(
            "click",
            function (event) {

                if (event.target === viewer) {

                    closeViewer();

                }

            }
        );


        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Escape" &&
                    viewer.classList.contains("active")
                ) {

                    closeViewer();

                }

            }
        );

    }

})();