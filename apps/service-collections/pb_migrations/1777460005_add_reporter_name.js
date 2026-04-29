/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const conditionReports = app.findCollectionByNameOrId("condition_reports");
  if (conditionReports) {
    conditionReports.fields.add(new Field({
      "name": "reporter_name",
      "type": "text",
      "required": false,
      "presentable": true
    }));
    app.save(conditionReports);
  }
}, (app) => {
  const conditionReports = app.findCollectionByNameOrId("condition_reports");
  if (conditionReports) {
    conditionReports.fields.removeByName("reporter_name");
    app.save(conditionReports);
  }
})
