"use strict";
/*
  APRILS SIGNATURE — final compatibility / interaction fixes.
  Keeps the dashboard logic in admin.js and adds visible button feedback
  without changing the existing admin tabs or their actions.
*/
(function () {
    const REVIEW_URL = "https://g.page/r/CcD7hxB7NK7pEAE/review";

    function setupGoogleReviewLinks() {
        document.querySelectorAll("a").forEach(link => {
            const text = (link.textContent || "").toLowerCa;
            if (text.includes("google review")) {
                link.href = REVIEW_URL;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
            }
        });
    }

    function setupButtonFeedback() {
        if (document.documentElement.dataset.aprilsButtonFeedback === "1") return;
        document.documentElement.dataset.aprilsButtonFeedback = "1";

        document.addEventListener("click", event => {
            const button = event.target.closest("button");
            if (!button || button.disabled || button.dataset.noWorkingFeedback === "1") return;
            button.classList.add("button-working");
            button.setAttribute("aria-busy", "true");
            clearTimeout(button._aprilsFeedbackTimer);
            button._aprilsFeedbackTimer = setTimeout(() => {
                if (!button.isConnected) return;
                button.classList.remove("button-working");
                button.removeAttribute("aria-busy");
            }, 850);
        }, true);
    }

    function setup() {
        setupGoogleReviewLinks();
        setupButtonFeedback();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setup);
    } else {
        setup();
    }
})();
