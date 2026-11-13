// coverage-report.mjs — requirement accounting, not a union of alternative readings.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { review_report, review_selection } from "../sources/compile-review.mjs";

const builder = fileURLToPath(new URL("./site-catalog.mjs", import.meta.url));
const catalog = JSON.parse(execFileSync(process.execPath, [builder], { encoding: "utf8" }));
console.log("source                                             identified executable approved removable-lines");
for (const entry of catalog.entries) {
    const candidate = review_selection(entry);
    const report = review_report(candidate, entry.source, entry.markdown, catalog.fact_contract);
    console.log(`${entry.source.padEnd(50)} ${String(report.identified).padStart(10)} ${String(report.executable).padStart(10)} ${String(report.approved).padStart(8)} ${String(report.removed.length).padStart(15)}`);
    if (report.reasons.length) {
        console.log(`  ${report.reasons.join("; ")}`);
    }
}
console.log("Counts describe the selected reading, not proven extraction recall. Legacy candidates remain unreviewed. A recorded check does not guarantee future enforcement.");
