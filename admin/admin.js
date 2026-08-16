"use strict";

/*
=========================================================
APRILS SIGNATURE ADMIN DASHBOARD
=========================================================
Uses the existing Supabase client.
Does not create a second database.
=========================================================
*/

let db = null;


/* =====================================================
SUPABASE
===================================================== */

async function waitForSupabase() {

    for (let i = 0; i < 100; i++) {

        if (window.aprilsSupabase) {
            return window.aprilsSupabase;
        }

        if (window.AprilsSupabase) {
            return window.AprilsSupabase;
        }

        await new Promise(resolve =>
            setTimeout(resolve, 100)
        );
    }

    return null;
}


/* =====================================================
HELPERS
===================================================== */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function message(text, type = "success") {

    const box =
        document.getElementById("globalStatus");

    if (!box) return;

    box.textContent = text;

    box.className =
        "status " + type;

    setTimeout(function () {

        box.className = "status";

    }, 5000);
}


async function getRows(table) {

    if (!db) return [];

    const result =
        await db
            .from(table)
            .select("*")
            .order(
                "created_at",
                { ascending: false }
            );

    if (result.error) {
        console.error(table, result.error);
        throw result.error;
    }

    return result.data || [];
}


async function countRows(table) {

    if (!db) return 0;

    const result =
        await db
            .from(table)
            .select("*", {
                count: "exact",
                head: true
            });

    if (result.error) {
        console.error(table, result.error);
        return 0;
    }

    return result.count || 0;
}


/* =====================================================
LOGIN
===================================================== */

async function checkSession() {

    if (!db) return;

    const result =
        await db.auth.getSession();

    const login =
        document.getElementById("loginScreen");

    if (!login) return;


    if (result.data.session) {

        login.style.display = "none";

        await loadDashboard();

    } else {

        login.style.display = "flex";

    }
}


const loginForm =
    document.getElementById("loginForm");


if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            const email =
                document.getElementById(
                    "loginEmail"
                ).value.trim();

            const password =
                document.getElementById(
                    "loginPassword"
                ).value;

            const box =
                document.getElementById(
                    "loginMessage"
                );


            try {

                const result =
                    await db.auth.signInWithPassword({
                        email,
                        password
                    });


                if (result.error) {
                    throw result.error;
                }


                box.textContent =
                    "Login successful.";

                box.className =
                    "status success";


                document.getElementById(
                    "loginScreen"
                ).style.display = "none";


                await loadDashboard();


            } catch (error) {

                console.error(error);

                box.textContent =
                    "Login failed. Check your email and password.";

                box.className =
                    "status error";

            }

        }
    );

}


/* =====================================================
LOGOUT
===================================================== */

const logoutButton =
    document.getElementById(
        "logoutButton"
    );


if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async function () {

            await db.auth.signOut();

            location.reload();

        }
    );

}


/* =====================================================
NAVIGATION
===================================================== */

document
    .querySelectorAll(".sidebar button")
    .forEach(function (button) {

        button.addEventListener(
            "click",
            async function () {

                document
                    .querySelectorAll(
                        ".sidebar button"
                    )
                    .forEach(function (b) {

                        b.classList.remove(
                            "active"
                        );

                    });


                button.classList.add(
                    "active"
                );


                document
                    .querySelectorAll(
                        ".section"
                    )
                    .forEach(function (section) {

                        section.classList.remove(
                            "active"
                        );

                    });


                const id =
                    button.dataset.section ||
                    button.getAttribute(
                        "onclick"
                    )?.match(
                        /showSection\(['"]([^'"]+)/
                    )?.[1];


                if (!id) return;


                const section =
                    document.getElementById(id);


                if (section) {

                    section.classList.add(
                        "active"
                    );

                }


                await loadSection(id);

            }
        );

    });


/* =====================================================
DASHBOARD COUNTS
===================================================== */

async function loadDashboard() {

    const counters = {

        galleryCount:
            "gallery_items",

        trainingCount:
            "training_programs",

        testimonialCount:
            "testimonials",

        faqCount:
            "faqs",

        registrationCount:
            "training_registrations",

        quoteCount:
            "quote_requests",

        enquiryCount:
            "enquiries"

    };


    for (const id in counters) {

        const element =
            document.getElementById(id);

        if (!element) continue;

        element.textContent =
            await countRows(
                counters[id]
            );

    }

}


/* =====================================================
LOAD SECTION
===================================================== */

async function loadSection(id) {

    try {

        if (id === "dashboard")
            await loadDashboard();

        if (id === "gallery")
            await loadGallery();

        if (id === "training")
            await loadTraining();

        if (id === "registrations")
            await loadRegistrations();

        if (id === "orders")
            await loadQuotes();

        if (id === "enquiries")
            await loadEnquiries();

        if (id === "testimonials")
            await loadTestimonials();

        if (id === "faq")
            await loadFAQs();

        if (id === "policies")
            await loadPolicies();

        if (id === "content")
            await loadContent();

        if (id === "services")
            await loadServices();

        if (id === "contact")
            await loadContact();

        if (id === "settings")
            await loadSettings();


    } catch (error) {

        console.error(error);

        message(
            "Could not load this section. Check your Supabase tables and policies.",
            "error"
        );

    }

}


/* =====================================================
GALLERY
===================================================== */

async function loadGallery() {

    const rows =
        await getRows(
            "gallery_items"
        );


    const list =
        document.getElementById(
            "galleryList"
        );

    if (!list) return;


    if (!rows.length) {

        list.innerHTML =
            "<div class='empty'>" +
            "No gallery items yet." +
            "</div>";

        return;

    }


    let html = `

        <div class="admin-actions">
            <button
                type="button"
                onclick="newGalleryItem()"
            >
                + Add Gallery Item
            </button>

            <button
                type="button"
                onclick="newGalleryCollection()"
            >
                + Add New Collection
            </button>
        </div>

        <table>
        <thead>
        <tr>
            <th>Image</th>
            <th>Title</th>
            <th>Collection</th>
            <th>Featured</th>
            <th>Active</th>
            <th>Actions</th>
        </tr>
        </thead>
        <tbody>
    `;


    rows.forEach(function (row) {

        html += `

        <tr>

            <td>
                ${
                    row.image_url
                    ?
                    `<img
                        src="${escapeHTML(row.image_url)}"
                        alt=""
                        style="width:70px;height:70px;object-fit:cover"
                    >`
                    :
                    "No image"
                }
            </td>

            <td>
                ${escapeHTML(row.title)}
            </td>

            <td>
                ${escapeHTML(row.category)}
            </td>

            <td>
                ${row.featured ? "Yes" : "No"}
            </td>

            <td>
                ${row.active ? "Yes" : "No"}
            </td>

            <td>

                <button
                    type="button"
                    onclick='editGallery(${JSON.stringify(row)})'
                >
                    Edit
                </button>

                <button
                    type="button"
                    onclick="deleteGallery(${row.id})"
                >
                    Delete
                </button>

            </td>

        </tr>
        `;

    });


    html += `
        </tbody>
        </table>
    `;


    list.innerHTML = html;

}


window.newGalleryItem =
function () {

    const form =
        document.getElementById(
            "galleryForm"
        );

    if (!form) return;

    form.reset();

    document.getElementById(
        "galleryId"
    ).value = "";

};


window.newGalleryCollection =
function () {

    const category =
        prompt(
            "Enter the name of the new gallery collection:"
        );


    if (!category) return;


    const field =
        document.getElementById(
            "galleryCategory"
        );


    if (field) {

        field.value =
            category.trim();

        field.focus();

    }

};


window.editGallery =
function (row) {

    document.getElementById(
        "galleryId"
    ).value = row.id;

    document.getElementById(
        "galleryTitle"
    ).value =
        row.title || "";

    document.getElementById(
        "galleryCategory"
    ).value =
        row.category || "";

    document.getElementById(
        "galleryImage"
    ).value =
        row.image_url || "";

    document.getElementById(
        "galleryDescription"
    ).value =
        row.description || "";

    document.getElementById(
        "galleryFeatured"
    ).checked =
        !!row.featured;

    document.getElementById(
        "galleryActive"
    ).checked =
        !!row.active;

};


window.deleteGallery =
async function (id) {

    if (
        !confirm(
            "Delete this gallery item?"
        )
    ) return;


    const result =
        await db
            .from("gallery_items")
            .delete()
            .eq("id", id);


    if (result.error) {

        console.error(result.error);

        message(
            "Gallery item could not be deleted.",
            "error"
        );

        return;

    }


    message(
        "Gallery item deleted.",
        "success"
    );


    await loadGallery();
    await loadDashboard();

};


/* =====================================================
TRAINING
===================================================== */

async function loadTraining() {

    const rows =
        await getRows(
            "training_programs"
        );


    const list =
        document.getElementById(
            "trainingList"
        );

    if (!list) return;


    let html = `

        <div class="admin-actions">

            <button
                type="button"
                onclick="newTraining()"
            >
                + Add Training Programme / Class
            </button>

        </div>

    `;


    if (!rows.length) {

        html +=
            "<div class='empty'>" +
            "No training programmes yet." +
            "</div>";

        list.innerHTML = html;

        return;

    }


    html += `

        <table>

        <thead>

        <tr>
            <th>Programme/Class</th>
            <th>Duration</th>
            <th>Price</th>
            <th>Section</th>
            <th>Active</th>
            <th>Actions</th>
        </tr>

        </thead>

        <tbody>
    `;


    rows.forEach(function (row) {

        html += `

        <tr>

            <td>
                ${escapeHTML(row.title)}
            </td>

            <td>
                ${escapeHTML(row.duration)}
            </td>

            <td>
                GHC ${Number(row.price || 0).toFixed(2)}
            </td>

            <td>
                ${escapeHTML(row.category)}
            </td>

            <td>
                ${row.active ? "Yes" : "No"}
            </td>

            <td>

                <button
                    type="button"
                    onclick='editTraining(${JSON.stringify(row)})'
                >
                    Edit
                </button>

                <button
                    type="button"
                    onclick="deleteTraining(${row.id})"
                >
                    Delete
                </button>

            </td>

        </tr>
        `;

    });


    html += `
        </tbody>
        </table>
    `;


    list.innerHTML = html;

}


window.newTraining =
function () {

    const form =
        document.getElementById(
            "trainingForm"
        );

    if (!form) return;

    form.reset();

    document.getElementById(
        "trainingId"
    ).value = "";

};


window.editTraining =
function (row) {

    document.getElementById(
        "trainingId"
    ).value = row.id;

    document.getElementById(
        "trainingTitle"
    ).value =
        row.title || "";

    document.getElementById(
        "trainingDuration"
    ).value =
        row.duration || "";

    document.getElementById(
        "trainingPrice"
    ).value =
        row.price || "";

    document.getElementById(
        "trainingCategory"
    ).value =
        row.category || "";

    document.getElementById(
        "trainingDescription"
    ).value =
        row.description || "";

    document.getElementById(
        "trainingActive"
    ).checked =
        !!row.active;

};


window.deleteTraining =
async function (id) {

    if (
        !confirm(
            "Delete this training programme/class?"
        )
    ) return;


    const result =
        await db
            .from("training_programs")
            .delete()
            .eq("id", id);


    if (result.error) {

        console.error(result.error);

        message(
            "Training programme could not be deleted.",
            "error"
        );

        return;

    }


    message(
        "Training programme deleted.",
        "success"
    );


    await loadTraining();
    await loadDashboard();

};


/* =====================================================
TRAINING REGISTRATIONS
===================================================== */

async function loadRegistrations() {

    const rows =
        await getRows(
            "training_registrations"
        );


    const list =
        document.getElementById(
            "registrationList"
        );

    if (!list) return;


    if (!rows.length) {

        list.innerHTML =
            "<div class='empty'>" +
            "No training registrations received." +
            "</div>";

        return;

    }


    let html = `

        <table>

        <thead>

        <tr>
            <th>Date</th>
            <th>Name</th>
            <th>Phone</th>
            <th>WhatsApp</th>
            <th>Location</th>
            <th>Course</th>
            <th>Email</th>
            <th>Message</th>
        </tr>

        </thead>

        <tbody>
    `;


    rows.forEach(function (row) {

        html += `

        <tr>

            <td>
                ${escapeHTML(
                    row.created_at
                    ? new Date(
                        row.created_at
                    ).toLocaleString()
                    : ""
                )}
            </td>

            <td>
                ${escapeHTML(row.full_name)}
            </td>

            <td>
                ${escapeHTML(row.phone)}
            </td>

            <td>
                ${escapeHTML(row.whatsapp)}
            </td>

            <td>
                ${escapeHTML(row.location)}
            </td>

            <td>
                ${escapeHTML(row.course)}
            </td>

            <td>
                ${escapeHTML(row.email)}
            </td>

            <td>
                ${escapeHTML(row.message)}
            </td>

        </tr>

        `;

    });


    html += `
        </tbody>
        </table>
    `;


    list.innerHTML = html;

}


/* =====================================================
QUOTES
===================================================== */

async function loadQuotes() {

    const rows =
        await getRows(
            "quote_requests"
        );


    const list =
        document.getElementById(
            "quoteList"
        );

    if (!list) return;


    if (!rows.length) {

        list.innerHTML =
            "<div class='empty'>" +
            "No quote requests received." +
            "</div>";

        return;

    }


    let html = `

        <table>

        <thead>

        <tr>
            <th>Date</th>
            <th>Name</th>
            <th>Phone</th>
            <th>WhatsApp</th>
            <th>Location</th>
            <th>Services</th>
            <th>Request Details</th>
        </tr>

        </thead>

        <tbody>
    `;


    rows.forEach(function (row) {

        let details =
            row.journey ||
            row.request_details ||
            row.details ||
            row.message ||
            "";


        if (
            typeof details === "object"
        ) {

            details =
                JSON.stringify(
                    details,
                    null,
                    2
                );

        }


        html += `

        <tr>

            <td>
                ${escapeHTML(
                    row.created_at
                    ? new Date(
                        row.created_at
                    ).toLocaleString()
                    : ""
                )}
            </td>

            <td>
                ${escapeHTML(row.full_name)}
            </td>

            <td>
                ${escapeHTML(row.phone)}
            </td>

            <td>
                ${escapeHTML(row.whatsapp)}
            </td>

            <td>
                ${escapeHTML(row.location)}
            </td>

            <td>
                ${escapeHTML(row.service)}
            </td>

            <td>
                <pre style="
                    white-space:pre-wrap;
                    max-width:400px;
                    font-family:inherit;
                ">${escapeHTML(details)}</pre>
            </td>

        </tr>

        `;

    });


    html += `
        </tbody>
        </table>
    `;


    list.innerHTML = html;

}


/* =====================================================
ENQUIRIES
===================================================== */

async function loadEnquiries() {

    const rows =
        await getRows(
            "enquiries"
        );


    const list =
        document.getElementById(
            "enquiryList"
        );

    if (!list) return;


    if (!rows.length) {

        list.innerHTML =
            "<div class='empty'>" +
            "No customer enquiries received." +
            "</div>";

        return;

    }


    let html = `

        <table>

        <thead>

        <tr>
            <th>Date</th>
            <th>Name</th>
            <th>Phone</th>
            <th>WhatsApp</th>
            <th>Email</th>
            <th>Subject</th>
            <th>Message</th>
        </tr>

        </thead>

        <tbody>
    `;


    rows.forEach(function (row) {

        html += `

        <tr>

            <td>
                ${escapeHTML(
                    row.created_at
                    ? new Date(
                        row.created_at
                    ).toLocaleString()
                    : ""
                )}
            </td>

            <td>
                ${escapeHTML(row.full_name)}
            </td>

            <td>
                ${escapeHTML(row.phone)}
            </td>

            <td>
                ${escapeHTML(row.whatsapp)}
            </td>

            <td>
                ${escapeHTML(row.email)}
            </td>

            <td>
                ${escapeHTML(row.subject)}
            </td>

            <td>
                ${escapeHTML(row.message)}
            </td>

        </tr>

        `;

    });


    html += `
        </tbody>
        </table>
    `;


    list.innerHTML = html;

}


/* =====================================================
GENERIC SAVE HANDLER
===================================================== */

async function saveExistingForm(
    formId,
    table,
    fields
) {

    const form =
        document.getElementById(formId);

    if (!form) return;


    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const idElement =
                form.querySelector(
                    'input[name="id"], #galleryId, #trainingId, #testimonialId, #faqId'
                );


            const id =
                idElement
                ? idElement.value
                : "";


            const data = {};


            fields.forEach(function (field) {

                const element =
                    document.getElementById(
                        field.id
                    );

                if (!element) return;


                if (
                    element.type ===
                    "checkbox"
                ) {

                    data[field.column] =
                        element.checked;

                } else {

                    data[field.column] =
                        element.value.trim();

                }

            });


            data.updated_at =
                new Date().toISOString();


            try {

                let result;


                if (id) {

                    result =
                        await db
                            .from(table)
                            .update(data)
                            .eq("id", id);

                } else {

                    result =
                        await db
                            .from(table)
                            .insert(data);

                }


                if (result.error) {
                    throw result.error;
                }


                message(
                    "Saved successfully.",
                    "success"
                );


                form.reset();


                if (idElement) {
                    idElement.value = "";
                }


                await loadSection(
                    form.closest(
                        ".section"
                    )?.id || ""
                );


                await loadDashboard();


            } catch (error) {

                console.error(
                    table,
                    error
                );

                message(
                    "Could not save. Check the database fields.",
                    "error"
                );

            }

        }
    );

}


/* =====================================================
START
===================================================== */

async function startAdmin() {

    db =
        await waitForSupabase();


    if (!db) {

        message(
            "Supabase could not be loaded.",
            "error"
        );

        return;

    }


    await checkSession();


    await loadDashboard();

}


if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        startAdmin
    );

} else {

    startAdmin();

}
