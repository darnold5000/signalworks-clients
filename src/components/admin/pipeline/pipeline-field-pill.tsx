"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function PipelineFieldPill<T extends string>({
  value,
  options,
  getLabel,
  getOptionTitle,
  getTriggerClassName,
  disabled,
  ariaLabel,
  title,
  onChange,
  className,
}: {
  value: T;
  options: readonly T[];
  getLabel: (option: T) => string;
  getOptionTitle?: (option: T) => string;
  getTriggerClassName?: (option: T) => string;
  disabled?: boolean;
  ariaLabel: string;
  title?: string;
  onChange: (value: T) => void;
  className?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const activeIndex = useMemo(
    () => Math.max(0, options.indexOf(value)),
    [options, value],
  );
  const [highlightIndex, setHighlightIndex] = useState(activeIndex);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[highlightIndex]?.focus();
  }, [highlightIndex, open]);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeight = menuRef.current?.offsetHeight ?? 220;
      const openUp = window.innerHeight - rect.bottom < menuHeight + 8;
      setMenuPos({
        top: openUp ? rect.top - menuHeight - 4 : rect.bottom + 4,
        left: Math.min(rect.left, window.innerWidth - 196),
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function closeMenu(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) {
      buttonRef.current?.focus();
    }
  }

  function selectOption(option: T) {
    onChange(option);
    closeMenu();
  }

  function moveHighlight(nextIndex: number) {
    const bounded = Math.min(options.length - 1, Math.max(0, nextIndex));
    setHighlightIndex(bounded);
    optionRefs.current[bounded]?.focus();
  }

  function openMenu() {
    setHighlightIndex(activeIndex);
    setOpen(true);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu();
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveHighlight(highlightIndex + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(highlightIndex - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      moveHighlight(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      moveHighlight(options.length - 1);
      return;
    }
    if (event.key === "Tab") {
      closeMenu(false);
    }
  }

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            aria-activedescendant={`${listId}-${options[highlightIndex]}`}
            tabIndex={-1}
            onKeyDown={onMenuKeyDown}
            onClick={(event) => event.stopPropagation()}
            style={{ top: menuPos.top, left: menuPos.left }}
            className="fixed z-[80] min-w-[11rem] rounded-lg border border-border bg-surface py-1 shadow-sm"
          >
            {options.map((option, index) => {
              const selected = option === value;
              return (
                <button
                  key={option}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  type="button"
                  role="option"
                  id={`${listId}-${option}`}
                  aria-selected={selected}
                  title={getOptionTitle?.(option)}
                  onMouseEnter={() => setHighlightIndex(index)}
                  onClick={() => selectOption(option)}
                  className={cn(
                    "flex w-full items-center px-3 py-1.5 text-left text-xs transition-colors",
                    highlightIndex === index
                      ? "bg-background text-foreground"
                      : "text-muted hover:bg-background hover:text-foreground",
                    selected && "font-medium text-foreground",
                  )}
                >
                  {getLabel(option)}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        title={title}
        onClick={(event) => {
          event.stopPropagation();
          if (disabled) return;
          if (open) {
            setOpen(false);
            return;
          }
          openMenu();
        }}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "inline-flex w-fit max-w-full items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
          "hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:outline-none",
          "disabled:cursor-wait disabled:opacity-60",
          getTriggerClassName?.(value),
        )}
      >
        <span className="truncate">{getLabel(value)}</span>
        <ChevronDown
          className={cn("size-3 shrink-0 opacity-70", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {menu}
    </div>
  );
}
