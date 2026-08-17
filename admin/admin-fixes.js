"use strict";

/*
=========================================================
APRILS SIGNATURE
ADMIN FINAL FIXES
=========================================================
Services
Gallery Collections
Admin display cleanup
=========================================================
*/

(function () {

  let adminDB = null;

  async function getDB() {
    if (window.aprilsSupabase) return window.aprilsSupabase;
    if (window.AprilsSupabase) return window.AprilsSupabase;

    for (let i = 0; i < 100; i++) {
      await new Promise(function (resolve) {
        setTimeout(resolve, 100);
      });

      if (window.aprilsSupabase) return window.aprilsSupabase;
      if (window.AprilsSupabase) return window.AprilsSupabase;
    }

    return null;
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function adminMessage(text, type) {
    const box = document.getElementById("globalStatus");

    if (!box) {
      alert(text);
      return;
    }

    box.textContent = text;
    box.className = "status " + (type || "success");

    setTimeout(function () {
      box.className = "status";
    }, 5000);
  }

  /* =====================================================
     SERVICES
     ===================================================== */

  async function loadServicesFixed() {

    adminDB = await getDB();

    if (!adminDB) {
      adminMessage(
        "Supabase connection is unavailable.",
        "error"
      );
      return;
    }

    const section = document.getElementById("services");

    if (!section) return;

    const result = await adminDB
      .from("services")
      .select("*")
      .order("created_at", {
        ascending: false
      });

    if (result.error) {
      console.error(result.error);

      adminMessage(
        "Services could not be loaded. " +
        result.error.message,
        "error"
      );

      return;
    }

    const rows = result.data || [];

    section.innerHTML = `
      <h2>Services</h2>

      <p class="intro">
        Add, edit and remove the services displayed by
        Aprils Signature.
      </p>

      <div class="form-card">

        <form id="serviceForm">

          <input
            type="hidden"
            id="serviceId"
          >

          <div class="form-group">

            <label for="serviceName">
              Service Name
            </label>

            <input
              type="text"
              id="serviceName"
              required
              placeholder="e.g. Custom Jerseys"
            >

          </div>

          <div class="form-group">

            <label for="serviceCategory">
              Category
            </label>

            <input
              type="text"
              id="serviceCategory"
              placeholder="e.g. Streetwear"
            >

          </div>

          <div class="form-group">

            <label for="serviceDescription">
              Description
            </label>

            <textarea
              id="serviceDescription"
              rows="5"
              placeholder="Describe this service..."
            ></textarea>

          </div>

          <div class="form-group">

            <label>

              <input
                type="checkbox"
                id="serviceActive"
                checked
              >

              Active

            </label>

          </div>

          <div class="admin-actions">

            <button
              type="submit"
              class="btn btn-primary"
            >
              Save Service
            </button>

            <button
              type="button"
              id="serviceCancel"
              class="btn btn-secondary"
            >
              Cancel
            </button>

          </div>

        </form>

      </div>

      <div class="table-wrap">

        ${
          rows.length
          ? `
          <table>

            <thead>

              <tr>

                <th>Service</th>
                <th>Category</th>
                <th>Description</th>
                <th>Active</th>
                <th>Actions</th>

              </tr>

            </thead>

            <tbody>

              ${rows.map(function (row) {

                return `
                  <tr>

                    <td>
                      ${esc(row.name)}
                    </td>

                    <td>
                      ${esc(row.category)}
                    </td>

                    <td>
                      ${esc(row.description)}
                    </td>

                    <td>
                      ${row.active ? "Yes" : "No"}
                    </td>

                    <td>

                      <button
                        type="button"
                        class="btn btn-secondary"
                        data-edit-service="${row.id}"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        class="btn danger"
                        data-delete-service="${row.id}"
                      >
                        Delete
                      </button>

                    </td>

                  </tr>
                `;

              }).join("")}

            </tbody>

          </table>
          `
          :
          `
          <div class="empty">
            No services have been added yet.
          </div>
          `
        }

      </div>
    `;

    setupServiceEvents(rows);
  }

  function setupServiceEvents(rows) {

    const form =
      document.getElementById("serviceForm");

    const cancel =
      document.getElementById("serviceCancel");

    if (form) {

      form.addEventListener(
        "submit",
        async function (event) {

          event.preventDefault();

          const id =
            document.getElementById(
              "serviceId"
            ).value.trim();

          const data = {

            name:
              document.getElementById(
                "serviceName"
              ).value.trim(),

            category:
              document.getElementById(
                "serviceCategory"
              ).value.trim(),

            description:
              document.getElementById(
                "serviceDescription"
              ).value.trim(),

            active:
              document.getElementById(
                "serviceActive"
              ).checked,

            updated_at:
              new Date().toISOString()

          };

          if (!data.name) {

            adminMessage(
              "Please enter a service name.",
              "error"
            );

            return;
          }

          try {

            let result;

            if (id) {

              result =
                await adminDB
                  .from("services")
                  .update(data)
                  .eq("id", id);

            } else {

              result =
                await adminDB
                  .from("services")
                  .insert(data);

            }

            if (result.error)
              throw result.error;

            adminMessage(
              "Service saved successfully.",
              "success"
            );

            await loadServicesFixed();

          } catch (error) {

            console.error(error);

            adminMessage(
              "Service could not be saved: " +
              error.message,
              "error"
            );
          }

        }
      );
    }

    if (cancel) {

      cancel.addEventListener(
        "click",
        function () {

          document.getElementById(
            "serviceForm"
          ).reset();

          document.getElementById(
            "serviceId"
          ).value = "";

          document.getElementById(
            "serviceActive"
          ).checked = true;

        }
      );

    }

    document
      .querySelectorAll(
        "[data-edit-service]"
      )
      .forEach(function (button) {

        button.addEventListener(
          "click",
          function () {

            const id =
              button.getAttribute(
                "data-edit-service"
              );

            const row =
              rows.find(function (item) {
                return String(item.id) === String(id);
              });

            if (!row) return;

            document.getElementById(
              "serviceId"
            ).value = row.id;

            document.getElementById(
              "serviceName"
            ).value = row.name || "";

            document.getElementById(
              "serviceCategory"
            ).value = row.category || "";

            document.getElementById(
              "serviceDescription"
            ).value = row.description || "";

            document.getElementById(
              "serviceActive"
            ).checked = !!row.active;

            window.scrollTo({
              top: 0,
              behavior: "smooth"
            });

          }
        );

      });

    document
      .querySelectorAll(
        "[data-delete-service]"
      )
      .forEach(function (button) {

        button.addEventListener(
          "click",
          async function () {

            const id =
              button.getAttribute(
                "data-delete-service"
              );

            const row =
              rows.find(function (item) {
                return String(item.id) === String(id);
              });

            if (!row) return;

            const confirmed =
              window.confirm(
                "Delete the service \"" +
                row.name +
                "\"?"
              );

            if (!confirmed) return;

            const result =
              await adminDB
                .from("services")
                .delete()
                .eq("id", id);

            if (result.error) {

              adminMessage(
                "Service could not be deleted: " +
                result.error.message,
                "error"
              );

              return;
            }

            adminMessage(
              "Service deleted.",
              "success"
            );

            await loadServicesFixed();

          }
        );

      });

  }

  /* =====================================================
     GALLERY COLLECTIONS
     ===================================================== */

  async function loadCollections() {

    adminDB = await getDB();

    if (!adminDB) return [];

    const result =
      await adminDB
        .from("gallery_collections")
        .select("*")
        .order("name", {
          ascending: true
        });

    if (result.error) {

      console.error(
        "Collections:",
        result.error
      );

      return [];
    }

    return result.data || [];
  }

  async function replaceGalleryCategoryWithCollections() {

    const collections =
      await loadCollections();

    const categoryInput =
      document.getElementById(
        "galleryCategory"
      );

    if (!categoryInput) return;

    const current =
      categoryInput.value || "";

    const select =
      document.createElement("select");

    select.id =
      "galleryCategory";

    select.name =
      categoryInput.name || "category";

    select.required =
      categoryInput.required;

    select.innerHTML = `
      <option value="">
        Select Collection
      </option>

      ${collections.map(function (item) {

        return `
          <option
            value="${esc(item.name)}"
            ${item.name === current ? "selected" : ""}
          >
            ${esc(item.name)}
          </option>
        `;

      }).join("")}
    `;

    categoryInput.replaceWith(select);

    addCollectionButton(select.parentElement);
  }

  function addCollectionButton(container) {

    if (!container) return;

    if (
      container.querySelector(
        "#addGalleryCollectionButton"
      )
    ) return;

    const button =
      document.createElement("button");

    button.type = "button";

    button.id =
      "addGalleryCollectionButton";

    button.className =
      "btn btn-secondary";

    button.textContent =
      "+ Add New Collection";

    button.style.marginTop =
      "10px";

    button.addEventListener(
      "click",
      async function () {

        const name =
          window.prompt(
            "Enter the new collection name:"
          );

        if (!name) return;

        const cleanName =
          name.trim();

        if (!cleanName) return;

        const result =
          await adminDB
            .from("gallery_collections")
            .insert({
              name: cleanName
            });

        if (result.error) {

          adminMessage(
            "Collection could not be added: " +
            result.error.message,
            "error"
          );

          return;
        }

        adminMessage(
          "Collection added.",
          "success"
        );

        await replaceGalleryCategoryWithCollections();

        const newSelect =
          document.getElementById(
            "galleryCategory"
          );

        if (newSelect) {
          newSelect.value = cleanName;
        }

      }
    );

    container.appendChild(button);
  }

  /* =====================================================
     GOOGLE REVIEW
     ===================================================== */

  function setupGoogleReview() {

    const reviewURL =
      "https://g.page/r/CcD7hxB7NK7pEAE/review";

    document
      .querySelectorAll(
        "a[href='#'], a[data-google-review]"
      )
      .forEach(function (link) {

        const text =
          (link.textContent || "")
            .toLowerCase();

        if (
          text.includes("google review") ||
          link.hasAttribute(
            "data-google-review"
          )
        ) {

          link.href =
            reviewURL;

          link.target =
            "_blank";

          link.rel =
            "noopener noreferrer";

        }

      });
  }

  /* =====================================================
     CLEAN UP OBVIOUS RAW DEVELOPER LABELS
     ===================================================== */

  function cleanAdminTechnicalText() {

    const services =
      document.getElementById("services");

    if (services) {

      services
        .querySelectorAll(
          ".small"
        )
        .forEach(function (element) {

          if (
            element.textContent
              .toLowerCase()
              .includes("database-managed")
          ) {

            element.remove();

          }

        });

    }

  }

  /* =====================================================
     WATCH ADMIN SECTION CHANGES
     ===================================================== */

  function setupAdminObserver() {

    document
      .querySelectorAll(
        ".sidebar button"
      )
      .forEach(function (button) {

        button.addEventListener(
          "click",
          function () {

            const id =
              button.dataset.section;

            setTimeout(
              async function () {

                if (id === "services") {

                  await loadServicesFixed();

                }

                if (id === "gallery") {

                  await replaceGalleryCategoryWithCollections();

                }

                cleanAdminTechnicalText();

              },
              150
            );

          }
        );

      });

  }

  /* =====================================================
     START
     ===================================================== */

  async function start() {

    setupGoogleReview();

    setupAdminObserver();

    cleanAdminTechnicalText();

    const activeSection =
      document.querySelector(
        ".section.active"
      );

    if (
      activeSection &&
      activeSection.id === "services"
    ) {

      await loadServicesFixed();

    }

    setTimeout(
      replaceGalleryCategoryWithCollections,
      500
    );

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
