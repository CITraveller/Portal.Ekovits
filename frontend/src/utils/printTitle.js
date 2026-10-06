export function printWithTitle(title) {
  const oldTitle = document.title;
  document.title = title;
  const restore = () => {
    document.title = oldTitle;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}
