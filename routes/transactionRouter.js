const {
  initializePayment,
  verifyPayment,
} = require("../controllers/transactionController");

const router = require("express").Router();

router.post("/transaction/initialize", initializePayment);
router.get("/transaction/verify", verifyPayment);

module.exports = router;
