import { memo } from "react";
import type { DashboardGroup, DashboardSubTab } from "../constants";
import { filterSubTab } from "../constants";
import type { DashboardTab } from "../types";

interface Props {
  group: DashboardGroup;
  activeTab: DashboardTab;
  onSelect: (tab: DashboardTab) => void;
  isPizza: boolean;
  allowFullReports: boolean;
  badges?: Partial<Record<DashboardTab, number>>;
  pulseTabs?: Partial<Record<DashboardTab, boolean>>;
}

const GroupTabsBar = memo(({ group, activeTab, onSelect, isPizza, allowFullReports, badges, pulseTabs }: Props) => {
  const subs: DashboardSubTab[] = group.subTabs.filter((s) =>
    filterSubTab(s, { isPizza, allowFullReports }),
  );
  if (subs.length <= 1) return null;

  return (
    <div className="px-4 pt-3 lg:px-6">
      <div className="flex gap-2 border-b border-border overflow-x-auto -mx-1 px-1">
        {subs.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key;
          const badge = badges?.[key];
          const shouldPulse = !!pulseTabs?.[key] && !isActive;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-colors relative ${
                isActive
                  ? "border-primary text-primary"
                  : shouldPulse
                    ? "border-transparent text-blue-500 animate-pulse"
                    : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {shouldPulse && (
                <span className="ml-1 relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                </span>
              )}
              {badge && badge > 0 ? (
                <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-black flex items-center justify-center">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
});

GroupTabsBar.displayName = "GroupTabsBar";

export default GroupTabsBar;