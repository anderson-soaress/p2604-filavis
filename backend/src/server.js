const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const app = require("./app");
const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`FilaVis API disponível em http://localhost:${port}`));
