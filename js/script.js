/* =========================================================
   APRILS SIGNATURE
   FINAL WEBSITE JAVASCRIPT + SUPABASE CONNECTION
   ========================================================= */

(function () {
  "use strict";

  const SUPABASE_URL = "https://dftljtpebiozagvclfwv.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_SMSVcooUHVx6Vi2FzFNP9A_VrFcTaZm";

  const GOOGLE_REVIEW_URL =
    "https://g.page/r/CcD7hxB7NK7pEAE/review";

  let supabaseClient = null;

  document.addEventListener("DOMContentLoaded", async function () {
    initializeCopyrightYear();
    initializeMobileNavigation();
    initializeSmoothLinks();
    initializeImageFallbacks();
    initializeExternalLinks();
    initializeAccessibility();
    initializeGoogleReviewLinks();
    initializeGalleryViewer();
    initializeAboutPhotoViewer();

    try {
      await initializeSupabase();
      initializeQuoteForm();
      initializeTrainingForm();
    } catch (error) {
      console.error("Supabase initialization failed:", error);
      initializeQuoteForm();
      initializeTrainingForm();
    }
  });

  /* =====================================================
     SUPABASE
     ===================================================== */

  function loadSupabaseLibrary() {
    return new Promise(function (resolve, reject) {
      if (window.supabase && typeof window.supabase.createClient === "function") {
        resolve();
        return;
      }

      const existing = document.querySelector(
        'script[data-aprils-supabase-library="true"]'
      );

      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.async = true;
      script.dataset.aprilsSupabaseLibrary = "true";

      script.onload = resolve;
      script.onerror = function () {
        reject(new Error("Could not load the Supabase JavaScript library."));
      };

      document.head.appendChild(script);
    });
  }

  async function initializeSupabase() {
    await loadSupabaseLibrary();

    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    window.aprilsSupabase = supabaseClient;
    return supabaseClient;
  }

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
      const isOpen = navigation.classList.toggle("is-open");

      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute(
        "aria-label",
        isOpen ? "Close navigation" : "Open navigation"
      );
    });

    navigation.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navigation.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open navigation");
      });
    });
  }

  /* =====================================================
     SMOOTH INTERNAL LINKS
     ===================================================== */

  function initializeSmoothLinks() {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener("click", function (event) {
        const targetId = link.getAttribute("href");

        if (!targetId || targetId === "#") {
          return;
        }

        const target = document.querySelector(targetId);

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
        link.setAttribute("rel", "noopener noreferrer");
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
        button.setAttribute("aria-label", "Website button");
      }
    });
  }

  /* =====================================================
     GOOGLE REVIEW LINKS
     ===================================================== */

  function initializeGoogleReviewLinks() {
    document.querySelectorAll("a").forEach(function (link) {
      const text = link.textContent.trim().toLowerCase();

      if (
        text.includes("leave us a google review") ||
        text === "leave a google review"
      ) {
        link.href = GOOGLE_REVIEW_URL;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
    });
  }

  /* =====================================================
     QUOTE FORM
     ===================================================== */

  function initializeQuoteForm() {
    const form = document.getElementById("quoteForm");
    if (!form) return;

    const serviceInputs = form.querySelectorAll(
      'input[name="service"]'
    );

    const streetwearSection =
      document.getElementById("streetwearSection");

    const embellishmentSection =
      document.getElementById("embellishmentSection");

    serviceInputs.forEach(function (input) {
      input.addEventListener("change", function () {
        if (streetwearSection) {
          streetwearSection.style.display = "none";
        }

        if (embellishmentSection) {
          embellishmentSection.style.display = "none";
        }

        if (
          this.value === "Streetwear" &&
          streetwearSection
        ) {
          streetwearSection.style.display = "block";
        }

        if (
          this.value === "Embellishment Services" &&
          embellishmentSection
        ) {
          embellishmentSection.style.display = "block";
        }

        if (this.value === "Practical Fashion Training") {
          window.location.href = "training.html";
        }
      });
    });

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      const submitButton = form.querySelector(
        'button[type="submit"]'
      );

      setButtonState(
        submitButton,
        true,
        "Submitting..."
      );

      try {
        await ensureSupabaseReady();

        const formData = new FormData(form);

        const quote = {
          full_name: cleanText(formData.get("fullName")),
          phone: cleanText(formData.get("phone")),
          whatsapp: cleanText(formData.get("whatsapp")),
          location: cleanText(formData.get("location")),
          email: cleanText(formData.get("email")),

          service: cleanText(formData.get("service")),

          jerseys: toNumber(formData.get("jerseys")),
          hoodies: toNumber(formData.get("hoodies")),
          joggers: toNumber(formData.get("joggers")),
          tshirts: toNumber(formData.get("tshirts")),
          polo_shirts: toNumber(formData.get("poloShirts")),
          sweatshirts: toNumber(formData.get("sweatshirts")),
          sweatpants: toNumber(formData.get("sweatpants")),
          ladies_tank_tops: toNumber(formData.get("ladiesTankTops")),
          mens_tank_tops: toNumber(formData.get("mensTankTops")),
          varsity_jackets: toNumber(formData.get("varsityJackets")),
          cargo_pants: toNumber(formData.get("cargoPants")),
          cargo_skirts: toNumber(formData.get("cargoSkirts")),
          jogger_shorts: toNumber(formData.get("joggerShorts")),
          hoodies_joggers_set: toNumber(
            formData.get("hoodiesJoggersSet")
          ),
          tshirts_shorts_set: toNumber(
            formData.get("tshirtsShortsSet")
          ),
          sweatshirts_shorts_set: toNumber(
            formData.get("sweatshirtsShortsSet")
          ),

          streetwear_other: cleanText(
            formData.get("streetwearOther")
          ),

          embellishment: formData.getAll("embellishment[]")
            .map(cleanText)
            .filter(Boolean),

          embellishment_other: cleanText(
            formData.get("embellishmentOther")
          ),

          additional_details: cleanText(
            formData.get("additionalDetails")
          ),

          agreement: formData.get("agreement") === "Agreed"
            ? "Agreed"
            : "Not Agreed"
        };

        if (!quote.full_name || !quote.phone || !quote.location) {
          throw new Error(
            "Please complete the required customer details."
          );
        }

        if (!quote.service) {
          throw new Error(
            "Please select a service."
          );
        }

        if (quote.agreement !== "Agreed") {
          throw new Error(
            "Please agree to the Policies & Terms."
          );
        }

        const { data, error } = await supabaseClient
          .from("quote_requests")
          .insert(quote)
          .select("id")
          .single();

        if (error) {
          throw error;
        }

        const quoteId = data.id;

        const uploadedFiles = await uploadQuoteFiles(
          formData,
          quoteId
        );

        if (uploadedFiles.length > 0) {
          const { error: updateError } = await supabaseClient
            .from("quote_requests")
            .update({
              upload_files: uploadedFiles
            })
            .eq("id", quoteId);

          if (updateError) {
            console.error(
              "Quote saved but upload metadata could not be saved:",
              updateError
            );
          }
        }

        showFormMessage(
          form,
          "success",
          "Thank you. Your Order / Quote request has been submitted successfully. Aprils Signature will review your request and contact you."
        );

        form.reset();

        if (streetwearSection) {
          streetwearSection.style.display = "none";
        }

        if (embellishmentSection) {
          embellishmentSection.style.display = "none";
        }

      } catch (error) {
        console.error("Quote submission error:", error);

        showFormMessage(
          form,
          "error",
          "We could not submit your request right now. Please check your internet connection and try again. If the problem continues, contact Aprils Signature directly."
        );
      } finally {
        setButtonState(
          submitButton,
          false,
          "Submit Order / Request a Quote"
        );
      }
    });
  }

  /* =====================================================
     TRAINING FORM
     ===================================================== */

  function initializeTrainingForm() {
    const form = document.getElementById("trainingForm");
    if (!form) return;

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      const submitButton = form.querySelector(
        'button[type="submit"]'
      );

      setButtonState(
        submitButton,
        true,
        "Submitting..."
      );

      try {
        await ensureSupabaseReady();

        const formData = new FormData(form);

        const registration = {
          full_name: cleanText(formData.get("fullName")),
          phone: cleanText(formData.get("phone")),
          whatsapp: cleanText(formData.get("whatsapp")),
          location: cleanText(formData.get("location")),
          course: cleanText(formData.get("course")),
          email: cleanText(formData.get("email")),
          agreement: formData.get("agreement")
            ? "Agreed"
            : "Not Agreed"
        };

        if (
          !registration.full_name ||
          !registration.phone ||
          !registration.whatsapp ||
          !registration.location ||
          !registration.course
        ) {
          throw new Error(
            "Please complete all required registration fields."
          );
        }

        if (registration.agreement !== "Agreed") {
          throw new Error(
            "Please agree to the Policies & Terms."
          );
        }

        const { error } = await supabaseClient
          .from("training_registrations")
          .insert(registration);

        if (error) {
          throw error;
        }

        showFormMessage(
          form,
          "success",
          "Thank you. Your Training Registration has been submitted successfully. Aprils Signature will contact you regarding the next steps."
        );

        form.reset();

      } catch (error) {
        console.error(
          "Training registration error:",
          error
        );

        showFormMessage(
          form,
          "error",
          "We could not submit your registration right now. Please check your internet connection and try again. If the problem continues, contact Aprils Signature directly."
        );
      } finally {
        setButtonState(
          submitButton,
          false,
          "Submit Training Registration"
        );
      }
    });
  }

  /* =====================================================
     QUOTE FILE UPLOADS
     ===================================================== */

  async function uploadQuoteFiles(formData, quoteId) {
    const fileInputs = [
      {
        field: "mockups[]",
        label: "Mock-up"
      },
      {
        field: "inspiration[]",
        label: "Inspiration Photo"
      }
    ];

    const uploadedFiles = [];

    for (const input of fileInputs) {
      const files = formData.getAll(input.field);

      for (const file of files) {
        if (!file || !file.name || file.size === 0) {
          continue;
        }

        if (file.size > 6 * 1024 * 1024) {
          throw new Error(
            "Each uploaded image must be 6 MB or smaller."
          );
        }

        if (!file.type.startsWith("image/")) {
          throw new Error(
            "Only image files can be uploaded."
          );
        }

        const safeName = sanitizeFileName(file.name);
        const path =
          "quotes/" +
          quoteId +
          "/" +
          crypto.randomUUID() +
          "-" +
          safeName;

        const { error } = await supabaseClient
          .storage
          .from("quote-uploads")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
          });

        if (error) {
          throw error;
        }

        uploadedFiles.push({
          type: input.label,
          path: path,
          original_name: file.name,
          content_type: file.type,
          size: file.size
        });
      }
    }

    return uploadedFiles;
  }

  /* =====================================================
     SUPABASE READINESS
     ===================================================== */

  async function ensureSupabaseReady() {
    if (supabaseClient) {
      return supabaseClient;
    }

    await initializeSupabase();

    if (!supabaseClient) {
      throw new Error(
        "Supabase is not available."
      );
    }

    return supabaseClient;
  }

  /* =====================================================
     FORM HELPERS
     ===================================================== */

  function cleanText(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim();
  }

  function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0
      ? Math.floor(number)
      : 0;
  }

  function sanitizeFileName(name) {
    return String(name)
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 120);
  }

  function setButtonState(button, disabled, text) {
    if (!button) return;

    button.disabled = disabled;
    button.textContent = text;
    button.style.opacity = disabled ? "0.7" : "";
    button.style.cursor = disabled ? "wait" : "";
  }

  function showFormMessage(form, type, message) {
    const oldMessage = form.querySelector(
      ".supabase-form-message"
    );

    if (oldMessage) {
      oldMessage.remove();
    }

    const box = document.createElement("div");

    box.className =
      "supabase-form-message " +
      (type === "success"
        ? "success-message"
        : "error-message");

    box.setAttribute("role", "alert");
    box.textContent = message;

    form.insertBefore(box, form.firstChild);

    box.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  /* =====================================================
     GALLERY VIEWER
     ===================================================== */

  function initializeGalleryViewer() {
    const galleryItems =
      document.querySelectorAll(".gallery-item");

    if (!galleryItems.length) return;

    const viewer = document.createElement("div");

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
      viewer.querySelector("#galleryViewerContent");

    const close =
      viewer.querySelector("#galleryViewerClose");

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
        image.currentSrc || image.src;

      enlarged.alt =
        image.alt || "";

      content.appendChild(enlarged);

      viewer.classList.add("active");
      document.body.style.overflow = "hidden";
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

        newSource.src = source.src;
        newSource.type =
          source.type || "video/mp4";

        enlarged.appendChild(newSource);
      }

      content.appendChild(enlarged);

      viewer.classList.add("active");
      document.body.style.overflow = "hidden";

      enlarged.play().catch(function () {});
    }

    galleryItems.forEach(function (item) {
      const image =
        item.querySelector(".gallery-image img");

      const video =
        item.querySelector(".gallery-image video");

      if (image) {
        image.addEventListener("click", function () {
          openImage(image);
        });
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

    close.addEventListener("click", closeViewer);

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
      document.querySelector(".shop-photo img") ||
      document.querySelector(".location-image img");

    if (!image) return;

    const viewer = document.createElement("div");

    viewer.id = "locationImageViewer";

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

    image.addEventListener("click", function () {
      largeImage.src =
        image.currentSrc || image.src;

      largeImage.alt =
        image.alt || "Aprils Signature shop";

      viewer.classList.add("active");
      document.body.style.overflow = "hidden";
    });

    function closeViewer() {
      viewer.classList.remove("active");
      largeImage.src = "";
      document.body.style.overflow = "";
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
