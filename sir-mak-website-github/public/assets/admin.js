// Admin conveniences: confirm destructive actions and warn before leaving unsaved edits.
document.querySelectorAll("form[data-confirm]").forEach((form) => {
  form.addEventListener("submit", (e) => {
    if (!window.confirm(form.dataset.confirm)) e.preventDefault();
  });
});

document.querySelectorAll("[data-admin-form]").forEach((form) => {
  let dirty = false;
  form.addEventListener("input", () => { dirty = true; });
  form.addEventListener("submit", () => { dirty = false; });
  window.addEventListener("beforeunload", (e) => {
    if (dirty) e.preventDefault();
  });
});
