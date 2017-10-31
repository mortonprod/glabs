const express = require("express");
const path = require("path");

const app = express();
app.set("port", process.env.PORT || 3001);
app.use(express.static(path.join(__dirname, "docs")));
app.listen(app.get("port"), () => {
    console.log("Serving Documentation");
});
