/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2053802838")

  // update field
  collection.fields.addAt(3, new Field({
    "help": "",
    "hidden": false,
    "id": "select2363381545",
    "maxSelect": 0,
    "name": "type",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "donation",
      "appointment",
      "feedback",
      "custom",
      "artifact_health",
      "artifact_movement"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2053802838")

  // update field
  collection.fields.addAt(3, new Field({
    "help": "",
    "hidden": false,
    "id": "select2363381545",
    "maxSelect": 0,
    "name": "type",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "donation",
      "appointment",
      "feedback",
      "custom",
      "artifact_health"
    ]
  }))

  return app.save(collection)
})
