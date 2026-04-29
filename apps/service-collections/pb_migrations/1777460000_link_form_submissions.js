/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const locationHistory = app.findCollectionByNameOrId("location_history");
  const conditionReports = app.findCollectionByNameOrId("condition_reports");

  if (locationHistory) {
    locationHistory.fields.add(new Field({
      "name": "submission_id",
      "type": "relation",
      "collectionId": "pbc_3596961635", // form_submissions
      "maxSelect": 1
    }));
    app.save(locationHistory);
  }

  if (conditionReports) {
    // Add submission_id
    conditionReports.fields.add(new Field({
      "name": "submission_id",
      "type": "relation",
      "collectionId": "pbc_3596961635", // form_submissions
      "maxSelect": 1
    }));

    // Add attachments
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
  const locationHistory = app.findCollectionByNameOrId("location_history");
  const conditionReports = app.findCollectionByNameOrId("condition_reports");

  if (locationHistory) {
    locationHistory.fields.removeByName("submission_id");
    app.save(locationHistory);
  }

  if (conditionReports) {
    conditionReports.fields.removeByName("submission_id");
    conditionReports.fields.removeByName("attachments");
    app.save(conditionReports);
  }
})
