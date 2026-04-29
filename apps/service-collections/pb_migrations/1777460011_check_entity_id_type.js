/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("media_attachments");
  if (collection) {
    const field = collection.fields.getByName("entity_id");
    console.log(`Field entity_id type: ${field.type}`);
  }
}, (app) => {})
