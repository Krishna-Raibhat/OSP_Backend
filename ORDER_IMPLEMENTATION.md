# Order & Checkout Implementation

## ✅ COMPLETED

### 1. Database Changes
Run this SQL migration:
```sql
-- See: database_migrations/03_update_orders_for_guest_checkout.sql
```

### 2. API Endpoints

#### Create Order from Cart (Logged-in User)
```
POST /api/orders/from-cart
Authorization: Bearer <token>

Body:
{
  "billing_info": {
    "full_name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "address": "123 Main St, City, Country"
  },
  "payment_method": "gateway"  // or "manual"
}
```

#### Create Order Directly (Guest or Logged-in)
```
POST /api/orders/create
Authorization: Bearer <token> (optional for guest)

Body:
{
  "billing_info": {
    "full_name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+1234567890",
    "address": "456 Oak Ave, City, Country"
  },
  "items": [
    {
      "software_plan_id": "plan-id-1",
      "quantity": 2,
      "unit_price": 10.00
    },
    {
      "software_plan_id": "plan-id-2",
      "quantity": 1,
      "unit_price": 100.00
    }
  ],
  "payment_method": "gateway"
}
```

#### Get User's Orders
```
GET /api/orders
Authorization: Bearer <token>
```

#### Get Specific Order
```
GET /api/orders/:order_id
Authorization: Bearer <token>
```

#### Track Guest Order
```
POST /api/orders/track

Body:
{
  "order_id": "order-uuid",
  "email": "guest@example.com"
}
```

---

## 📋 CHECKOUT WORKFLOWS

### LOGGED-IN USER CHECKOUT

```
1. User adds items to cart
   ↓
2. User clicks "Checkout"
   ↓
3. Frontend shows billing form
   ↓
4. User fills:
   - Full Name
   - Email (pre-filled from profile)
   - Phone
   - Address
   - Payment Method
   ↓
5. Frontend calls:
   POST /api/orders/from-cart
   {
     billing_info: {...},
     payment_method: "gateway"
   }
   ↓
6. Backend:
   - Gets items from user's cart
   - Creates order with billing info
   - Creates order_items (1 row per license)
   - Clears cart
   - Returns order with status: "pending"
   ↓
7. Frontend redirects to payment gateway
   ↓
8. After payment success:
   - Payment gateway webhook updates order status to "paid"
   - Backend generates serial numbers & barcodes
   ↓
9. User receives order confirmation email
```

### GUEST USER CHECKOUT

```
1. Guest adds items to localStorage cart
   ↓
2. Guest clicks "Checkout"
   ↓
3. Frontend shows billing form
   ↓
4. Guest fills:
   - Full Name
   - Email
   - Phone
   - Address
   - Payment Method
   ↓
5. Frontend calls:
   POST /api/orders/create
   {
     billing_info: {...},
     items: [
       { software_plan_id, quantity, unit_price }
     ],
     payment_method: "gateway"
   }
   ↓
6. Backend:
   - Creates order with billing info (buyer_user_id = NULL)
   - Creates order_items (1 row per license)
   - Returns order with status: "pending"
   ↓
7. Frontend:
   - Clears localStorage cart
   - Redirects to payment gateway
   ↓
8. After payment success:
   - Payment gateway webhook updates order status to "paid"
   - Backend generates serial numbers & barcodes
   ↓
9. Guest receives order confirmation email
   ↓
10. Guest can track order using:
    POST /api/orders/track
    { order_id, email }
```

---

## 🔐 ORDER TRACKING

### Logged-in User:
- View all orders: `GET /api/orders`
- View specific order: `GET /api/orders/:order_id`
- Orders linked to user account

### Guest User:
- Track order: `POST /api/orders/track` with order_id + email
- No account needed
- Can only see their own orders (email verification)

---

## 💳 PAYMENT INTEGRATION (Next Step)

After order is created with status "pending":

1. **Gateway Payment (Khalti/eSewa/IPS)**:
   - Redirect user to payment gateway
   - Gateway processes payment
   - Webhook updates order status to "paid"
   - Generate licenses

2. **Manual Payment (Admin)**:
   - Admin marks order as "paid" manually
   - Admin enters payment reference
   - Generate licenses

---

## 📦 ORDER STRUCTURE

### Order Table:
```
software_orders:
- id
- buyer_user_id (nullable for guest)
- billing_full_name
- billing_email
- billing_phone
- billing_address
- status (pending/paid/failed/cancelled)
- total
- created_at
- updated_at
```

### Order Items Table:
```
software_order_items:
- id
- order_id
- software_plan_id
- unit_price
- serial_number (generated after payment)
- barcode_value (generated after payment)
- issued_at
- expires_at
- created_at
- updated_at
```

**Important**: 1 row = 1 license
- If quantity = 5, create 5 separate rows
- Each row gets unique serial/barcode after payment

---

## 🎯 KEY FEATURES

✅ Support both logged-in and guest checkout
✅ Billing information captured for all orders
✅ Cart automatically cleared after order creation (logged-in users)
✅ Order tracking for guests via email
✅ Role-based pricing preserved in order
✅ Serial/barcode generation after payment
✅ Order history for logged-in users
✅ Flexible payment methods (gateway/manual)

---

## 🚀 NEXT STEPS

1. **Payment Gateway Integration**
   - Khalti API
   - eSewa API
   - IPS API
   - Webhook handlers

2. **Email Notifications**
   - Order confirmation
   - Payment success
   - License delivery

3. **Admin Order Management**
   - View all orders
   - Manual order creation
   - Manual payment marking
   - Refunds/cancellations

4. **License Management**
   - Better serial/barcode generation
   - License activation
   - License renewal
   - License revocation
