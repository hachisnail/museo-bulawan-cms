/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("condition_reports");
  if (collection) {
    console.log(`Fields for ${collection.name}:`);
    collection.fields.forEach(f => {
      console.log(` - ${f.name} (${f.type}) ${f.required ? '[REQUIRED]' : ''}`);
    });
  }
}, (app) => {})
