import { Router } from "express";
import {
  createEsewaPayment,
  decodeEsewaResponse,
} from "./esewa.service";

const router = Router();

/*
|--------------------------------------------------------------------------
| Create Payment
|--------------------------------------------------------------------------
*/

router.post("/create", (req, res) => {
  const amount = Number(req.body.amount) || 100;

  const payment = createEsewaPayment(amount);

  res.json(payment);
});

/*
|--------------------------------------------------------------------------
| Success Callback
|--------------------------------------------------------------------------
*/

router.get("/success", (req, res) => {
  const data = req.query.data as string;

  if (!data) {
    return res.status(400).send("No data received");
  }

  const decoded = decodeEsewaResponse(data);

  console.log("Decoded Response:", decoded);

  if (decoded.status === "COMPLETE") {
    return res.send("Payment Successful ✅");
  }

  res.send("Payment Verification Failed");
});

/*
|--------------------------------------------------------------------------
| Failure Callback
|--------------------------------------------------------------------------
*/

router.get("/failure", (_req, res) => {
  res.send("Payment Failed ❌");
});

export default router;
