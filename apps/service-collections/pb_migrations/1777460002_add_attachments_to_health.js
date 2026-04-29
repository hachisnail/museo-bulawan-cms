/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const conditionReports = app.findCollectionByNameOrId("condition_reports");

  if (conditionReports) {
    conditionReports.fields.add(new Field({
      "name": "attachments",
      "type": "file",
      "maxSelect": 5,
      "maxSize": 15728640, // 15MB
      "mimeTypes": ["image/jpeg", "image/png", "image/webp", "application/pdf"],
      "protected": false,
      "thumbs": ["100x100"]
    }));
    app.save(conditionReports);
  }
}, (app) => {
  const conditionReports = app.findCollectionByNameOrId("condition_reports");
  if (conditionReports) {
    conditionReports.fields.removeByName("attachments");
    app.save(conditionReports);
  }
})
