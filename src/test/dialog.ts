/** jsdom lacks the native dialog lifecycle. The browser itself supplies top-layer/inert behavior. */
export function installDialogMock() {
  const prototype = HTMLDialogElement.prototype;
  const oldShow = Object.getOwnPropertyDescriptor(prototype, "showModal");
  const oldClose = Object.getOwnPropertyDescriptor(prototype, "close");
  Object.defineProperty(prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
  return () => {
    if (oldShow) Object.defineProperty(prototype, "showModal", oldShow);
    else Reflect.deleteProperty(prototype, "showModal");
    if (oldClose) Object.defineProperty(prototype, "close", oldClose);
    else Reflect.deleteProperty(prototype, "close");
  };
}
