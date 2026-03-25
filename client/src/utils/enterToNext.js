export function handleEnterToNext(event) {
  if (event.key !== "Enter") return;
  if (event.shiftKey) return;
  const tag = event.target.tagName;
  if (tag === "TEXTAREA") return;

  const form = event.target.closest("form");
  if (!form) return;

  const focusables = Array.from(
    form.querySelectorAll("input, select, textarea")
  ).filter((el) => !el.disabled);

  const index = focusables.indexOf(event.target);
  if (index >= 0 && index < focusables.length - 1) {
    event.preventDefault();
    focusables[index + 1].focus();
    return;
  }

  if (index === focusables.length - 1) {
    event.preventDefault();
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
    } else {
      form.submit();
    }
  }
}
