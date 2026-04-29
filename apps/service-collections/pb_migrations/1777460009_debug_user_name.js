/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const user = app.findRecordById("app_users", "9dcbe7e417788aa");
  if (user) {
    console.log(`User Name: "${user.get("name")}"`);
  } else {
    console.log("User not found.");
  }
}, (app) => {})
