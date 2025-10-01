const express = require("express");
require("./config/database");
const app = express();
const cors = require("cors");
const userRouter = require("./routes/userRouter");
const transactionRouter = require("./routes/transactionRouter");
app.use(express.json());
app.use(cors("*"));
app.use(userRouter);
app.use(transactionRouter);
const port = process.env.PORT;
app.listen(port, () => {
  console.log(`Server is listening on port: ${port}`);
});
