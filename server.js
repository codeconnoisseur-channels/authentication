const express = require("express");
require("./config/database");
const app = express();
const userRouter = require("./routes/userRouter");
app.use(express.json());
app.use(userRouter);
const port = process.env.PORT;
app.listen(port, () => {
  console.log(`Server is listening on port: ${port}`);
});
