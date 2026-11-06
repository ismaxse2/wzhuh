// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { Checkbox } from "./Checkbox";
afterEach(cleanup);
it("keeps mixed state controlled, exposes the native input and handles keyboard changes", async () => {
  const ref = createRef<HTMLInputElement>();
  const onChange = vi.fn();
  const view = render(
    <Checkbox
      ref={ref}
      aria-label="Выбрать видимые"
      checked={false}
      indeterminate
      onChange={onChange}
    />,
  );
  const checkbox = screen.getByRole("checkbox", {
    name: "Выбрать видимые",
  }) as HTMLInputElement;
  expect(ref.current).toBe(checkbox);
  expect(checkbox.indeterminate).toBe(true);
  const user = userEvent.setup();
  await user.tab();
  expect(document.activeElement).toBe(checkbox);
  await user.keyboard(" ");
  expect(onChange).toHaveBeenCalledTimes(1);
  view.rerender(
    <Checkbox
      ref={ref}
      aria-label="Выбрать видимые"
      checked
      indeterminate={false}
      onChange={onChange}
    />,
  );
  expect(checkbox.indeterminate).toBe(false);
  expect(checkbox.checked).toBe(true);
  view.rerender(
    <Checkbox
      ref={ref}
      aria-label="Выбрать видимые"
      checked={false}
      indeterminate
      onChange={onChange}
    />,
  );
  expect(checkbox.indeterminate).toBe(true);
  view.unmount();
  expect(ref.current).toBeNull();
});
it("supports callback refs, labels, uncontrolled values and disabled state", async () => {
  const ref = vi.fn();
  render(
    <label>
      <Checkbox ref={ref} defaultChecked disabled />
      Выбрать слово
    </label>,
  );
  const checkbox = screen.getByRole("checkbox", {
    name: "Выбрать слово",
  }) as HTMLInputElement;
  expect(ref).toHaveBeenCalledWith(checkbox);
  expect(checkbox.checked).toBe(true);
  await userEvent.setup().click(checkbox);
  expect(checkbox.checked).toBe(true);
});
