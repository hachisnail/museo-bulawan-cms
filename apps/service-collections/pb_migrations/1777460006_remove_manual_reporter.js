/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const form = app.findFirstRecordByFilter("form_definitions", 'slug="artifact-health"');
  if (form) {
    const schema = JSON.parse(form.get("schema") || '{}');
    if (schema.properties && schema.properties.reporter) {
      delete schema.properties.reporter;
      if (schema.required) {
        schema.required = schema.required.filter(f => f !== 'reporter');
      }
      form.set("schema", JSON.stringify(schema));
      app.save(form);
    }
  }
}, (app) => {})
