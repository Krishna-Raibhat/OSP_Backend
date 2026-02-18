import crypto from "crypto";

const PRODUCT_CODE = "EPAYTEST"; // Sandbox
const ESEWA_SECRET = "8gBm/:&EnhH.1/q"; // Sandbox Secret
const ESEWA_URL =
  "https://rc-epay.esewa.com.np/api/epay/main/v2/form";

function generateSignature(
  totalAmount: number,
  transactionUuid: string
): string {
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${PRODUCT_CODE}`;

  console.log("Message for Signature:", message);

  const signature = crypto
    .createHmac("sha256", ESEWA_SECRET)
    .update(message)
    .digest("base64");

  console.log("Generated Signature:", signature);

  return signature;
}



export function createEsewaPayment(amount: number) {
  const transactionUuid = crypto.randomUUID();

//   const message = `total_amount=${amount},transaction_uuid=${transactionUuid},product_code=${PRODUCT_CODE}`;

const signature = generateSignature(amount, transactionUuid);


  return {
    payment_url: ESEWA_URL,
    form_data: {
      amount,
      tax_amount: 0,
      total_amount: amount,
      transaction_uuid: transactionUuid,
      product_code: PRODUCT_CODE,
      product_service_charge: 0,
      product_delivery_charge: 0,
      success_url: "http://localhost:3001/esewa/success",
      failure_url: "http://localhost:3001/esewa/failure",
      signed_field_names:
        "total_amount,transaction_uuid,product_code",
      signature,
    },
  };
}

export function decodeEsewaResponse(data: string) {
  return JSON.parse(
    Buffer.from(data, "base64").toString("utf8")
  );
}
