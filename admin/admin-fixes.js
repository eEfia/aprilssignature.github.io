"use strict";

/*
 APRILS SIGNATURE — compatibility fixes.
 The main dashboard logic now lives in admin.js.
 This file only keeps the Google Review link correction so older
 deployments that still include Admin-fixes.js remain safe.
*/

(function () {
    const REVIEW_URL = "https://g.page/r/CcD7hxB7NK7pEAE/review";

    function setupGoogleReviewLinks() {
        document.querySelectorAll("a").forEach(link => {
            const text = (link.textContent || "").toLowerCase();
            if (text.includes("google review")) {
                link.href = REVIEW_URL;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupGoogleReviewLinks);
    } else {
        setupGoogleReviewLinks();
    }
})();
