"use strict";

/*
=========================================================
APRILS SIGNATURE
FINAL ADMIN FIX
=========================================================

FIXES:

1. Services management
2. Gallery collections
3. Google Review button
4. Prevents old broken Services placeholder
5. Keeps existing Training section untouched

=========================================================
*/

(function () {

    let supabaseClient = null;


    /* =====================================================
       SUPABASE
       ===================================================== */

    async function getSupabase() {

        if (window.aprilsSupabase) {
            return window.aprilsSupabase;
        }

        if (window.AprilsSupabase) {
            return window.AprilsSupabase;
        }

        for (let i = 0; i < 100; i++) {

            await new Promise(function (resolve) {
                setTimeout(resolve, 100);
            });

            if (window.aprilsSupabase) {
                return window.aprilsSupabase;
            }

            if (window.AprilsSupabase) {
                return window.AprilsSupabase;
            }
        }

        return null;
    }


    /* =====================================================
       HTML ESCAPE
       ===================================================== */

    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* =====================================================
       STATUS MESSAGE
       ===================================================== */

    function showStatus(text, type) {

        const box =
            document.getElementById("globalStatus");

        if (!box) {
            console.log(text);
            return;
        }

        box.textContent = text;

        box.className =
            "status " + (type || "success");

        setTimeout(function () {

            box.className = "status";

        }, 5000);
    }


    /* =====================================================
       SERVICES
       ===================================================== */

    async function loadServices() {

        supabaseClient =
            await getSupabase();

        if (!supabaseClient) {

            showStatus(
                "Supabase connection is unavailable.",
                "error"
            );

            return;
        }


        const section =
            document.getElementById("services");

        if (!section) return;


        const result =
            await supabaseClient
                .from("admin_services")
                .select("*")
                .order("created_at", {
                    ascending: false
                });


        if (result.error) {

            console.error(
                "SERVICES ERROR:",
                result.error
            );

            showStatus(
                "Services could not be loaded: " +
                result.error.message,
                "error"
            );

            return;
        }


        const rows =
            result.data || [];


        section.innerHTML = `

            <h2>Services</h2>

            <p class="intro">
                Add, edit and remove the services
                available through Aprils Signature.
            </p>


            <div class="form-card">

                <form id="adminServiceForm">

                    <input
                        type="hidden"
                        id="adminServiceId"
                    >


                    <div class="form-grid">


                        <div class="form-group">

                            <label>
                                Service Name
                            </label>

                            <input
                                type="text"
                                id="adminServiceTitle"
                                required
                                placeholder="Service name"
                            >

                        </div>


                        <div class="form-group">

                            <label>
                                Category
                            </label>

                            <input
                                type="text"
                                id="adminServiceCategory"
                                placeholder="Category"
                            >

                        </div>


                    </div>


                    <div class="form-group">

                        <label>
                            Description
                        </label>

                        <textarea
                            id="adminServiceDescription"
                            rows="5"
                            placeholder="Describe this service"
                        ></textarea>

                    </div>


                    <label class="checkbox">

                        <input
                            type="checkbox"
                            id="adminServiceActive"
                            checked
                        >

                        Active

                    </label>


                    <br>


                    <button
                        class="primary"
                        type="submit"
                    >
                        Save Service
                    </button>


                    <button
                        class="secondary"
                        type="button"
                        id="adminServiceCancel"
                    >
                        Cancel
                    </button>


                </form>

            </div>


            <div
                id="adminServicesList"
                class="table-wrap"
            ></div>

        `;


        renderServices(rows);

        setupServiceForm();

    }


    /* =====================================================
       RENDER SERVICES
       ===================================================== */

    function renderServices(rows) {

        const list =
            document.getElementById(
                "adminServicesList"
            );

        if (!list) return;


        if (!rows.length) {

            list.innerHTML = `
                <div class="empty">
                    No services have been added yet.
                </div>
            `;

            return;
        }


        list.innerHTML = `

            <table>

                <thead>

                    <tr>

                        <th>
                            Service
                        </th>

                        <th>
                            Category
                        </th>

                        <th>
                            Description
                        </th>

                        <th>
                            Active
                        </th>

                        <th>
                            Actions
                        </th>

                    </tr>

                </thead>


                <tbody>

                    ${rows.map(function (row) {

                        return `

                            <tr>

                                <td>
                                    ${escapeHTML(row.title)}
                                </td>

                                <td>
                                    ${escapeHTML(row.category)}
                                </td>

                                <td>
                                    ${escapeHTML(row.description)}
                                </td>

                                <td>
                                    ${
                                        row.active
                                            ? "Yes"
                                            : "No"
                                    }
                                </td>

                                <td>

                                    <button
                                        type="button"
                                        class="secondary"
                                        data-edit-service="${row.id}"
                                    >
                                        Edit
                                    </button>


                                    <button
                                        type="button"
                                        class="danger"
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

        `;


        list
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

                                return String(item.id) ===
                                    String(id);

                            });

                        if (!row) return;


                        document.getElementById(
                            "adminServiceId"
                        ).value =
                            row.id;


                        document.getElementById(
                            "adminServiceTitle"
                        ).value =
                            row.title || "";


                        document.getElementById(
                            "adminServiceCategory"
                        ).value =
                            row.category || "";


                        document.getElementById(
                            "adminServiceDescription"
                        ).value =
                            row.description || "";


                        document.getElementById(
                            "adminServiceActive"
                        ).checked =
                            !!row.active;


                        window.scrollTo({
                            top: 0,
                            behavior: "smooth"
                        });

                    }
                );

            });


        list
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

                                return String(item.id) ===
                                    String(id);

                            });


                        if (!row) return;


                        if (
                            !window.confirm(
                                "Delete \"" +
                                row.title +
                                "\"?"
                            )
                        ) {
                            return;
                        }


                        const result =
                            await supabaseClient
                                .from(
                                    "admin_services"
                                )
                                .delete()
                                .eq(
                                    "id",
                                    id
                                );


                        if (result.error) {

                            showStatus(
                                "Service could not be deleted: " +
                                result.error.message,
                                "error"
                            );

                            return;
                        }


                        showStatus(
                            "Service deleted.",
                            "success"
                        );


                        await loadServices();

                    }
                );

            });

    }


    /* =====================================================
       SERVICE FORM
       ===================================================== */

    function setupServiceForm() {

        const form =
            document.getElementById(
                "adminServiceForm"
            );

        if (!form) return;


        form.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();


                const id =
                    document.getElementById(
                        "adminServiceId"
                    ).value.trim();


                const payload = {

                    title:
                        document.getElementById(
                            "adminServiceTitle"
                        ).value.trim(),

                    category:
                        document.getElementById(
                            "adminServiceCategory"
                        ).value.trim(),

                    description:
                        document.getElementById(
                            "adminServiceDescription"
                        ).value.trim(),

                    active:
                        document.getElementById(
                            "adminServiceActive"
                        ).checked,

                    updated_at:
                        new Date().toISOString()

                };


                if (!payload.title) {

                    showStatus(
                        "Please enter a service name.",
                        "error"
                    );

                    return;
                }


                let result;


                if (id) {

                    result =
                        await supabaseClient
                            .from(
                                "admin_services"
                            )
                            .update(payload)
                            .eq(
                                "id",
                                id
                            );

                } else {

                    result =
                        await supabaseClient
                            .from(
                                "admin_services"
                            )
                            .insert(payload);

                }


                if (result.error) {

                    console.error(
                        "SAVE SERVICE ERROR:",
                        result.error
                    );

                    showStatus(
                        "Service could not be saved: " +
                        result.error.message,
                        "error"
                    );

                    return;
                }


                showStatus(
                    "Service saved successfully.",
                    "success"
                );


                await loadServices();

            }
        );


        const cancel =
            document.getElementById(
                "adminServiceCancel"
            );


        if (cancel) {

            cancel.addEventListener(
                "click",
                function () {

                    form.reset();

                    document.getElementById(
                        "adminServiceId"
                    ).value = "";

                    document.getElementById(
                        "adminServiceActive"
                    ).checked = true;

                }
            );

        }

    }


    /* =====================================================
       GALLERY COLLECTIONS
       ===================================================== */

    async function loadGalleryCollections() {

        supabaseClient =
            await getSupabase();

        if (!supabaseClient) return [];


        const result =
            await supabaseClient
                .from(
                    "gallery_collections"
                )
                .select("*")
                .eq(
                    "active",
                    true
                )
                .order(
                    "name",
                    {
                        ascending: true
                    }
                );


        if (result.error) {

            console.error(
                "COLLECTION ERROR:",
                result.error
            );

            return [];

        }


        return result.data || [];

    }


    async function setupGalleryCollections() {

        const input =
            document.getElementById(
                "galleryCategory"
            );

        if (!input) return;


        const collections =
            await loadGalleryCollections();


        const currentValue =
            input.value || "";


        const select =
            document.createElement(
                "select"
            );


        select.id =
            "galleryCategory";

        select.name =
            "galleryCategory";


        select.innerHTML = `

            <option value="">
                Select Collection
            </option>

            ${collections.map(function (item) {

                return `

                    <option
                        value="${escapeHTML(item.name)}"
                        ${
                            item.name === currentValue
                                ? "selected"
                                : ""
                        }
                    >
                        ${escapeHTML(item.name)}
                    </option>

                `;

            }).join("")}

        `;


        input.replaceWith(select);


        const wrapper =
            select.parentElement;


        if (
            !wrapper.querySelector(
                "#addGalleryCollection"
            )
        ) {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.id =
                "addGalleryCollection";


            button.className =
                "secondary";


            button.style.marginTop =
                "10px";


            button.textContent =
                "+ Add New Collection";


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
                        await supabaseClient
                            .from(
                                "gallery_collections"
                            )
                            .insert({
                                name:
                                    cleanName
                            });


                    if (result.error) {

                        showStatus(
                            "Collection could not be added: " +
                            result.error.message,
                            "error"
                        );

                        return;
                    }


                    showStatus(
                        "Collection added.",
                        "success"
                    );


                    await setupGalleryCollections();


                    const newSelect =
                        document.getElementById(
                            "galleryCategory"
                        );


                    if (newSelect) {

                        newSelect.value =
                            cleanName;

                    }

                }
            );


            wrapper.appendChild(button);

        }

    }


    /* =====================================================
       GOOGLE REVIEW
       ===================================================== */

    function setupGoogleReview() {

        const reviewURL =
            "https://g.page/r/CcD7hxB7NK7pEAE/review";


        document
            .querySelectorAll(
                "a"
            )
            .forEach(function (link) {

                const text =
                    (
                        link.textContent ||
                        ""
                    ).toLowerCase();


                if (
                    text.includes(
                        "google review"
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
       NAVIGATION
       ===================================================== */

    function setupNavigation() {

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


                        if (id === "services") {

                            setTimeout(
                                loadServices,
                                100
                            );

                        }


                        if (id === "gallery") {

                            setTimeout(
                                setupGalleryCollections,
                                200
                            );

                        }

                    }
                );

            });

    }


    /* =====================================================
       START
       ===================================================== */

    async function start() {

        supabaseClient =
            await getSupabase();


        setupGoogleReview();

        setupNavigation();


        setTimeout(
            setupGalleryCollections,
            800
        );


        const activeSection =
            document.querySelector(
                ".section.active"
            );


        if (
            activeSection &&
            activeSection.id === "services"
        ) {

            await loadServices();

        }

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


    /*
       Make Services available to the
       existing admin navigation.
    */

    window.loadServices =
        loadServices;


})();
