"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { FiCheck, FiChevronDown, FiInfo } from "react-icons/fi";

export type SelectMenuOption = {
  value: string;
  label: string;
  /** Second line under the label — slot capacity, a business address, etc. */
  hint?: string;
  /** Leading glyph, e.g. the business category icon. */
  icon?: ReactNode;
  /** Category key, so the glyph can carry that category's colour. */
  iconTone?: string;
  disabled?: boolean;
};

/** How long a run of keystrokes counts as one type-ahead search. */
const TYPE_AHEAD_RESET_MS = 700;

/**
 * The console's dropdown: a button that opens a listbox panel.
 *
 * A native `<select>` cannot be styled past its border — the option list is
 * drawn by the OS, so the selected-item check, the hover row and the panel's
 * own chrome are impossible there. This keeps the keyboard contract the native
 * control has: arrows move, Enter/Space commits, Escape cancels, Home/End jump,
 * and typing jumps to the first option starting with what you typed.
 *
 * Focus stays on the trigger the whole time and the active option is pointed at
 * with `aria-activedescendant`, which is the ARIA listbox pattern for a
 * collapsed combobox — moving DOM focus into the panel instead would fire a
 * blur on the trigger every time you pressed an arrow key.
 */
export function SelectMenu({
  ariaLabel,
  className,
  disabled = false,
  hint,
  label,
  onChange,
  options,
  placeholder = "Select…",
  renderValue,
  required = false,
  triggerClassName,
  value,
}: {
  /** Used when there is no visible `label`, e.g. a toolbar control. */
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  /** Tooltip text shown next to the label, matching the other console fields. */
  hint?: string;
  label?: ReactNode;
  onChange: (value: string) => void;
  options: SelectMenuOption[];
  placeholder?: string;
  /**
   * Replaces the trigger's value text. The scope tiles show an icon and a
   * two-line caption rather than a single line, but they are the same control
   * underneath and should not fork the keyboard handling to prove it.
   */
  renderValue?: (selected: SelectMenuOption | undefined) => ReactNode;
  required?: boolean;
  triggerClassName?: string;
  value: string;
}) {
  const baseId = useId();
  const triggerId = `${baseId}-trigger`;
  const listboxId = `${baseId}-listbox`;
  const labelId = `${baseId}-label`;

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const typeAhead = useRef({ query: "", at: 0 });

  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const activeOption = activeIndex >= 0 ? options[activeIndex] : undefined;

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  // Opening lands on the current value so arrowing starts from where you are,
  // not from the top of a list you have already made a choice in.
  const openMenu = useCallback(
    (startAt?: number) => {
      if (disabled) return;
      setActiveIndex(startAt ?? (selectedIndex >= 0 ? selectedIndex : firstEnabled(options)));
      setOpen(true);
    },
    [disabled, options, selectedIndex],
  );

  function commit(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    close(true);
  }

  useEffect(() => {
    if (!open) return;

    function closeWhenOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    // Deliberately no scroll-to-close: the panel is positioned against the
    // trigger, so it travels with it and never needs dismissing on scroll. An
    // earlier version closed on any scroll and the menu's own
    // `scrollIntoView` below tripped it — the panel flickered and vanished.
    document.addEventListener("pointerdown", closeWhenOutside);
    return () => document.removeEventListener("pointerdown", closeWhenOutside);
  }, [open]);

  // Keep the active row inside the scrollable panel as the arrows move it.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const panel = listboxRef.current;
    const row = panel?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function moveTo(index: number) {
    if (options.length === 0) return;
    const step = index > activeIndex ? 1 : -1;
    let next = clamp(index, 0, options.length - 1);
    // Skip disabled rows in the direction of travel, then fall back the other
    // way so an arrow press at a disabled edge still lands somewhere usable.
    while (options[next]?.disabled) {
      const candidate = next + step;
      if (candidate < 0 || candidate > options.length - 1) break;
      next = candidate;
    }
    if (options[next]?.disabled) return;
    setActiveIndex(next);
  }

  function search(character: string) {
    const now = Date.now();
    const state = typeAhead.current;
    const query =
      now - state.at > TYPE_AHEAD_RESET_MS ? character : `${state.query}${character}`;
    typeAhead.current = { query, at: now };

    // Repeating one character cycles through the options that start with it,
    // the way a native select does.
    const repeated = query.length > 1 && query.split("").every((char) => char === query[0]);
    const needle = repeated ? query[0] : query;
    const from = activeIndex < 0 ? 0 : activeIndex + (repeated || query.length === 1 ? 1 : 0);

    for (let offset = 0; offset < options.length; offset += 1) {
      const index = (from + offset) % options.length;
      const option = options[index];
      if (!option.disabled && option.label.toLowerCase().startsWith(needle)) {
        setActiveIndex(index);
        if (!open) onChange(option.value);
        return;
      }
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) openMenu();
        else moveTo(activeIndex < 0 ? 0 : activeIndex + 1);
        return;
      case "ArrowUp":
        event.preventDefault();
        if (!open) openMenu();
        else moveTo(activeIndex < 0 ? options.length - 1 : activeIndex - 1);
        return;
      case "Home":
        if (!open) return;
        event.preventDefault();
        moveTo(0);
        return;
      case "End":
        if (!open) return;
        event.preventDefault();
        moveTo(options.length - 1);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        if (!open) openMenu();
        else commit(activeIndex);
        return;
      case "Escape":
        if (!open) return;
        // Stops here so a menu inside a dialog does not also close the dialog.
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      case "Tab":
        if (open) setOpen(false);
        return;
      default:
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          search(event.key.toLowerCase());
        }
    }
  }

  return (
    <div
      // `select-menu-field` carries the console field chrome. A caller that
      // supplies its own trigger class (the scope tiles) owns that chrome
      // instead, so it is left off rather than fought with a later override.
      //
      // Deliberately not `.field`: that class styles `span` by descendant, so
      // borrowing it for the layout also restyled every option label inside the
      // menu panel. This owns its label typography a few rules down instead.
      className={[
        "select-menu",
        triggerClassName ? "" : "select-menu-field",
        open ? "is-open" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      ref={rootRef}
    >
      {label ? (
        <span className="select-menu-label" id={labelId}>
          {label}
          {required ? <b aria-hidden="true">*</b> : null}
          {hint ? (
            <span
              aria-label={typeof label === "string" ? `${label}: ${hint}` : hint}
              className="field-tooltip"
              data-tooltip={hint}
              tabIndex={0}
            >
              <FiInfo aria-hidden="true" />
            </span>
          ) : null}
        </span>
      ) : null}

      <button
        aria-activedescendant={open && activeOption ? optionId(baseId, activeIndex) : undefined}
        aria-controls={open ? listboxId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-labelledby={label && !ariaLabel ? `${labelId} ${triggerId}` : undefined}
        aria-required={required || undefined}
        className={`select-menu-trigger${triggerClassName ? ` ${triggerClassName}` : ""}`}
        disabled={disabled}
        id={triggerId}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onKeyDown}
        role="combobox"
        type="button"
      >
        {renderValue ? (
          renderValue(selected)
        ) : (
          <>
            {selected?.icon ? (
              <span
                className={`select-menu-option-icon mode-${selected.iconTone ?? "other"}`}
              >
                {selected.icon}
              </span>
            ) : null}
            <span className={selected ? "select-menu-value" : "select-menu-value is-placeholder"}>
              {selected?.label ?? placeholder}
            </span>
          </>
        )}
        <FiChevronDown aria-hidden="true" className="select-menu-chevron" />
      </button>

      {open ? (
        <div
          aria-labelledby={label ? labelId : undefined}
          aria-label={label ? undefined : ariaLabel}
          className="select-menu-panel"
          id={listboxId}
          ref={listboxRef}
          role="listbox"
          tabIndex={-1}
        >
          {options.length === 0 ? (
            <p className="select-menu-empty">No options available.</p>
          ) : (
            options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <div
                  aria-disabled={option.disabled || undefined}
                  aria-selected={isSelected}
                  className={`select-menu-option${isSelected ? " is-selected" : ""}${
                    index === activeIndex ? " is-active" : ""
                  }`}
                  data-index={index}
                  id={optionId(baseId, index)}
                  key={option.value}
                  // pointerdown would fire before the outside-click listener and
                  // race it; mouse enter only tracks the highlight.
                  onClick={() => commit(index)}
                  onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                  role="option"
                >
                  {option.icon ? (
                    <span
                      className={`select-menu-option-icon mode-${option.iconTone ?? "other"}`}
                    >
                      {option.icon}
                    </span>
                  ) : null}
                  <span className="select-menu-option-copy">
                    <span>{option.label}</span>
                    {option.hint ? <small>{option.hint}</small> : null}
                  </span>
                  {isSelected ? <FiCheck aria-hidden="true" /> : null}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

function optionId(baseId: string, index: number) {
  return `${baseId}-option-${index}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function firstEnabled(options: SelectMenuOption[]) {
  const index = options.findIndex((option) => !option.disabled);
  return index;
}
