const BLANK_LINE_SENTINEL = "\u200B";

const BULLET_LINE = /^\s*(?:[-*•‣◦▪▫–—]|\d+[.)])\s+(.+)$/;

export type ProposalScopeBlock =
  | { kind: "prose"; lines: string[] }
  | { kind: "list"; items: string[] };

function isStoredBlankLine(label: string): boolean {
  return label === BLANK_LINE_SENTINEL;
}

/** Hydrates ordered feature rows into the bulk-editing textarea. */
export function featureLabelsToScopeText(labels: string[]): string {
  return labels
    .map((label) => (isStoredBlankLine(label) ? "" : label))
    .join("\n");
}

/** Serializes textarea lines into the existing one-row-per-feature model. */
export function scopeTextToFeatureLabels(value: string): string[] {
  if (value === "") return [];
  const lines = value.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");

  return lines.map((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 ? trimmed : BLANK_LINE_SENTINEL;
  });
}

/** Converts stored rows into simple prose/list blocks without exposing bullet syntax. */
export function proposalScopeBlocks(labels: string[]): ProposalScopeBlock[] {
  const blocks: ProposalScopeBlock[] = [];
  let canAppend = false;

  for (const label of labels) {
    if (isStoredBlankLine(label) || label.trim() === "") {
      canAppend = false;
      continue;
    }

    const bullet = label.match(BULLET_LINE);
    if (bullet) {
      const previous = blocks.at(-1);
      if (canAppend && previous?.kind === "list") previous.items.push(bullet[1].trim());
      else blocks.push({ kind: "list", items: [bullet[1].trim()] });
      canAppend = true;
      continue;
    }

    const previous = blocks.at(-1);
    if (canAppend && previous?.kind === "prose") previous.lines.push(label);
    else blocks.push({ kind: "prose", lines: [label] });
    canAppend = true;
  }

  return blocks;
}
