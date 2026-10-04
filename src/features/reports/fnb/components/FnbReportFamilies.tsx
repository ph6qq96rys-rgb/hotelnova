import { Button } from "../../../../components/ui/button";
import { useI18n } from "../../../../i18n";
import { REPORT_FAMILIES, type ReportFamily } from "../utils/fnbReportMeta";

type Props = {
  liveReportKeys: string[];
  onOpen: (family: ReportFamily) => void;
};

/** Map of F&B reporting areas: live reports, linked workspaces, and roadmap items. */
export function FnbReportFamilies({ liveReportKeys, onOpen }: Props) {
  const { tx } = useI18n();
  const live = new Set(liveReportKeys);
  const families = REPORT_FAMILIES.filter((family) => !family.preview || !import.meta.env.PROD);

  return (
    <section className="fnb-family-grid" aria-label={tx("F&B report families")}>
      {families.map((family) => {
        const liveCount = family.liveReportKeys.filter((key) => live.has(key)).length;
        const isRouted = Boolean(family.route);
        const status = isRouted ? "linked" : liveCount > 0 ? "live" : "roadmap";
        return (
          <Button
            key={family.key}
            type="button"
            variant="outline"
            className={`fnb-family-card fnb-family-card--${status}`}
            disabled={status === "roadmap"}
            onClick={() => onOpen(family)}
          >
            <span className="fnb-family-owner">{tx(family.owner)}</span>
            <strong>{tx(family.title)}</strong>
            <small>{tx(family.description)}</small>
            <span className={`fnb-family-status fnb-family-status--${status}`}>
              {status === "linked" ? tx("Workspace") : status === "live" ? tx("{count} live", { count: liveCount }) : tx("Roadmap")}
            </span>
          </Button>
        );
      })}
    </section>
  );
}
