import * as React from "react";
import type { RequiredAddonHighlight } from "../types";

export const RequiredAddonHighlights = ({ highlights }: { highlights: RequiredAddonHighlight[] }) => {
  if (highlights.length === 0) return null;

  return (
    <div className="mx-3 mb-2 space-y-1.5">
      {highlights.map((highlight, index) => (
        <div
          key={`${highlight.itemId}-${highlight.groupName}-${highlight.addonName}-${index}`}
          className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {highlight.itemName}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-primary">{highlight.groupName}</span>
            <span className="text-xs text-muted-foreground">→</span>
            <span className="text-sm font-black uppercase text-foreground">{highlight.addonName}</span>
          </div>
        </div>
      ))}
    </div>
  );
};