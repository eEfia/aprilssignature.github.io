"use strict";
/* Aprils Signature — quote service panel ordering and interaction. */
(function () {
  function setup() {
    const form = document.getElementById("quoteForm");
    const serviceOptions = form?.querySelector(".service-options");
    const detailsHost = document.getElementById("selectedServiceDetails");
    if (!form || !serviceOptions || !detailsHost || form.dataset.quotePanelsBound === "1") return;
    form.dataset.quotePanelsBound = "1";

    const inputs = [...serviceOptions.querySelectorAll('input[name="services[]"]')];
    const panelMap = new Map();
    [...form.querySelectorAll(".quote-service-panel[data-service-panel]")].forEach(panel => {
      panelMap.set(panel.dataset.servicePanel, panel);
    });

    function render() {
      const selected = inputs.filter(input => input.checked).map(input => input.value);
      // Keep the newest selected service at the top of the detail area.
      // This is deliberately an ordering change only; the existing panel
      // markup/styling is preserved.
      [...selected].reverse().forEach(name => {
        const panel = panelMap.get(name);
        if (panel) detailsHost.prepend(panel);
      });
      panelMap.forEach((panel, name) => {
        const isSelected = selected.includes(name);
        panel.hidden = !isSelected;
        panel.setAttribute("aria-hidden", String(!isSelected));
        if (!isSelected) {
          panel.querySelectorAll("input, textarea, select").forEach(field => {
            if (field.type === "checkbox" || field.type === "radio") field.checked = false;
            else if (field.type !== "number") field.value = "";
          });
        }
      });
    }

    inputs.forEach(input => input.addEventListener("change", render));
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
})();
