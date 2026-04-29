/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const records = app.findRecordsByFilter("condition_reports", "created > '2026-04-29'", "-created", 1);
  if (records.length > 0) {
    const r = records[0];
    console.log(`Latest Condition Report: ${r.id}`);
    console.log(` - reporter_name: ${r.get("reporter_name")}`);
    console.log(` - reported_by: ${r.get("reported_by")}`);
  } else {
    console.log("No condition reports found for today.");
  }
}, (app) => {})
