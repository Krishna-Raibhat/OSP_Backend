# COD (Cash on Delivery) Payment Implementation

## ✅ COMPLETED

### Database Migration
```sql
-- Update payment status enum to include 'pending'
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'pending';

-- Update payment_type enum to include 'cod'
ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'cod';
```

---

## 📋 COD WORKFLOW

### CUSTOMER SIDE

#### 1. Create Order with COD
```
POST /api/orders/from-cart (logged-in user)
OR
POST /api/orders/create (guest user)

Body:
{
  "billing_info": {
    "full_name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "address": "123 Main St, City, Country"
  },
  "payment_method": "cod"
}

Response:
{
  "message": "Order created successfully.",
  "order": {
    "id": "order-uuid",
    "status": "pending",
    "total": 120.00,
    ...
  }
}
```

#### 2. Create COD Payment Record
```
POST /api/payments/cod

Body:
{
  "order_id": "order-uuid"
}

Response:
{
  "message": "COD payment created. Order will be processed after payment confirmation.",
  "payment": {
    "id": "payment-uuid",
    "software_order_id": "order-uuid",
    "payment_type": "cod",
    "amount": 120.00,
    "status": "pending",
    "manual_reference": "Cash on Delivery"
  }
}
```

#### 3. Check Payment Status
```
GET /api/payments/order/:order_id

Response:
{
  "id": "payment-uuid",
  "payment_type": "cod",
  "status": "pending",  // or "success" after admin confirms
  "amount": 120.00,
  ...
}
```

---

### ADMIN SIDE

#### 1. View Pending COD Payments
```
GET /api/payments/cod/pending
Authorization: Bearer <admin_token>

Response:
[
  {
    "id": "payment-uuid",
    "software_order_id": "order-uuid",
    "payment_type": "cod",
    "amount": 120.00,
    "status": "pending",
    "billing_full_name": "John Doe",
    "billing_email": "john@example.com",
    "billing_phone": "+1234567890",
    "billing_address": "123 Main St",
    "order_total": 120.00,
    "order_created_at": "2024-01-15T10:30:00Z",
    "created_at": "2024-01-15T10:31:00Z"
  },
  ...
]
```

#### 2. Confirm COD Payment Received
```
POST /api/payments/cod/:payment_id/confirm
Authorization: Bearer <admin_token>

Body:
{
  "manual_reference": "Cash received on 2024-01-16, Receipt #12345"
}

Response:
{
  "message": "COD payment confirmed and licenses generated."
}

What happens:
1. Payment status → "success"
2. Payment paid_at → NOW()
3. Order status → "paid"
4. Serial numbers & barcodes generated for all order items
5. Customer can now access licenses
```

---

## 🔄 COMPLETE COD FLOW

### Customer Journey:
```
1. Browse products → Add to cart
   ↓
2. Checkout → Fill billing info
   ↓
3. Select payment method: "COD"
   ↓
4. Submit order
   POST /api/orders/from-cart
   { billing_info, payment_method: "cod" }
   ↓
5. Order created with status: "pending"
   ↓
6. Create COD payment record
   POST /api/payments/cod
   { order_id }
   ↓
7. Payment created with status: "pending"
   ↓
8. Customer receives order confirmation
   "Your order is confirmed. Pay cash on delivery."
   ↓
9. Delivery person delivers product
   ↓
10. Customer pays cash
   ↓
11. Admin confirms payment in system
   ↓
12. Licenses generated automatically
   ↓
13. Customer receives email with licenses
```

### Admin Journey:
```
1. View pending COD orders
   GET /api/payments/cod/pending
   ↓
2. See list of orders awaiting payment
   ↓
3. Delivery person collects cash
   ↓
4. Admin confirms payment
   POST /api/payments/cod/:payment_id/confirm
   { manual_reference: "Receipt #12345" }
   ↓
5. System automatically:
   - Updates payment status to "success"
   - Updates order status to "paid"
   - Generates serial numbers & barcodes
   ↓
6. Customer notified via email
```

---

## 💳 PAYMENT METHODS COMPARISON

### COD (Cash on Delivery)
- ✅ Order created immediately
- ✅ Payment status: "pending"
- ⏳ Licenses generated AFTER admin confirms payment
- 👤 Admin manually confirms payment
- 💰 Cash collected on delivery

### Gateway (Khalti/eSewa/IPS)
- ✅ Order created immediately
- ✅ Payment status: "initiated"
- ⚡ Licenses generated AFTER gateway confirms payment
- 🤖 Automatic payment confirmation via webhook
- 💳 Online payment

### Manual (Admin Direct Entry)
- ✅ Order created by admin
- ✅ Payment status: "success" immediately
- ⚡ Licenses generated immediately
- 👤 Admin enters payment details
- 💰 Cash/Bank transfer/Other

---

## 🎯 API ENDPOINTS SUMMARY

### Customer Endpoints:
```
POST /api/orders/from-cart          - Create order from cart
POST /api/orders/create              - Create order directly
POST /api/payments/cod               - Create COD payment
GET  /api/payments/order/:order_id   - Check payment status
POST /api/orders/track               - Track guest order
```

### Admin Endpoints:
```
GET  /api/payments/cod/pending              - View pending COD payments
POST /api/payments/cod/:payment_id/confirm  - Confirm COD payment
POST /api/payments/manual                   - Create manual payment
```

---

## 📊 DATABASE STRUCTURE

### software_orders:
```
- id
- buyer_user_id (nullable for guest)
- billing_full_name
- billing_email
- billing_phone
- billing_address
- status: "pending" | "paid" | "failed" | "cancelled"
- total
```

### software_payments:
```
- id
- software_order_id
- payment_type: "gateway" | "manual" | "cod"
- gateway (nullable)
- gateway_txn_id (nullable)
- manual_reference (nullable)
- amount
- status: "initiated" | "success" | "failed" | "pending"
- paid_at (nullable)
```

### software_order_items:
```
- id
- order_id
- software_plan_id
- unit_price
- serial_number (generated after payment)
- barcode_value (generated after payment)
- issued_at
- expires_at
```

---

## 🔐 SECURITY

- ✅ COD payment creation: Public (anyone can create)
- ✅ Payment confirmation: Admin only
- ✅ Pending payments list: Admin only
- ✅ Manual payment: Admin only
- ✅ Order tracking: Email verification for guests

---

## 📧 EMAIL NOTIFICATIONS (To Implement)

### Order Confirmation (COD):
```
Subject: Order Confirmed - Pay on Delivery
Body:
- Order ID
- Items ordered
- Total amount
- Billing address
- "Pay cash when you receive your order"
```

### Payment Confirmed:
```
Subject: Payment Received - Licenses Ready
Body:
- Order ID
- Payment confirmed
- Serial numbers & barcodes
- Download links
```

---

## 🚀 NEXT STEPS

1. ✅ COD payment implementation - DONE
2. ⏳ Email notifications
3. ⏳ SMS notifications
4. ⏳ Admin dashboard for COD management
5. ⏳ Delivery tracking
6. ⏳ Gateway payment integration (Khalti/eSewa/IPS)

---

## 🧪 TESTING

### Test COD Flow:

1. **Create Order:**
```bash
curl -X POST http://localhost:3001/api/orders/create \
  -H "Content-Type: application/json" \
  -d '{
    "billing_info": {
      "full_name": "Test User",
      "email": "test@example.com",
      "phone": "+1234567890",
      "address": "Test Address"
    },
    "items": [
      {
        "software_plan_id": "plan-id",
        "quantity": 1,
        "unit_price": 10.00
      }
    ],
    "payment_method": "cod"
  }'
```

2. **Create COD Payment:**
```bash
curl -X POST http://localhost:3001/api/payments/cod \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "order-uuid-from-step-1"
  }'
```

3. **Admin: View Pending:**
```bash
curl -X GET http://localhost:3001/api/payments/cod/pending \
  -H "Authorization: Bearer <admin-token>"
```

4. **Admin: Confirm Payment:**
```bash
curl -X POST http://localhost:3001/api/payments/cod/payment-uuid/confirm \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "manual_reference": "Cash received, Receipt #12345"
  }'
```

5. **Check Order Status:**
```bash
curl -X GET http://localhost:3001/api/payments/order/order-uuid
```
