# Shopping Cart Implementation Guide

## Backend API Endpoints

### 1. Get Cart
```
GET /api/cart
Authorization: Bearer <token>
```
Response:
```json
{
  "cart": { "id": "...", "user_id": "...", "status": "active" },
  "items": [
    {
      "id": "cart_item_id",
      "software_plan_id": "plan_id",
      "plan_name": "Monthly Plan",
      "duration_type": "monthly",
      "product_name": "Netflix",
      "brand_name": "Netflix",
      "unit_price": 10.00,
      "quantity": 2,
      "subtotal": 20.00,
      "current_price": 10.00,
      "price_changed": false
    }
  ],
  "total": 20.00,
  "item_count": 2
}
```

### 2. Add to Cart
```
POST /api/cart
Authorization: Bearer <token>
Body: {
  "software_plan_id": "plan_id",
  "quantity": 1
}
```

### 3. Update Cart Item
```
PUT /api/cart/:cart_item_id
Authorization: Bearer <token>
Body: {
  "quantity": 3
}
```

### 4. Remove from Cart
```
DELETE /api/cart/:cart_item_id
Authorization: Bearer <token>
```

### 5. Clear Cart
```
DELETE /api/cart
Authorization: Bearer <token>
```

### 6. Sync Cart (After Login)
```
POST /api/cart/sync
Authorization: Bearer <token>
Body: {
  "items": [
    { "software_plan_id": "plan_id_1", "quantity": 2 },
    { "software_plan_id": "plan_id_2", "quantity": 1 }
  ]
}
```

---

## Frontend Implementation (React Example)

### 1. Guest User Cart (localStorage)

```javascript
// utils/cart.js
const CART_KEY = 'guest_cart';

export const getGuestCart = () => {
  const cart = localStorage.getItem(CART_KEY);
  return cart ? JSON.parse(cart) : [];
};

export const addToGuestCart = (planId, quantity = 1) => {
  const cart = getGuestCart();
  const existingItem = cart.find(item => item.software_plan_id === planId);
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.push({ software_plan_id: planId, quantity });
  }
  
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  return cart;
};

export const updateGuestCartItem = (planId, quantity) => {
  const cart = getGuestCart();
  const item = cart.find(item => item.software_plan_id === planId);
  
  if (item) {
    item.quantity = quantity;
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }
  
  return cart;
};

export const removeFromGuestCart = (planId) => {
  let cart = getGuestCart();
  cart = cart.filter(item => item.software_plan_id !== planId);
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  return cart;
};

export const clearGuestCart = () => {
  localStorage.removeItem(CART_KEY);
};
```

### 2. Add to Cart Component

```javascript
// components/AddToCart.jsx
import { useState } from 'react';
import { addToGuestCart } from '../utils/cart';
import { addToCart as addToBackendCart } from '../api/cart';

function AddToCart({ plan, isLoggedIn }) {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleAddToCart = async () => {
    setLoading(true);
    
    try {
      if (isLoggedIn) {
        // Add to backend cart
        await addToBackendCart(plan.id, quantity);
        alert('Added to cart!');
      } else {
        // Add to localStorage
        addToGuestCart(plan.id, quantity);
        alert('Added to cart! Login to checkout.');
      }
    } catch (error) {
      alert('Failed to add to cart');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input 
        type="number" 
        min="1" 
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
      />
      <button onClick={handleAddToCart} disabled={loading}>
        {loading ? 'Adding...' : 'Add to Cart'}
      </button>
    </div>
  );
}
```

### 3. Sync Cart on Login

```javascript
// pages/Login.jsx
import { syncCart } from '../api/cart';
import { getGuestCart, clearGuestCart } from '../utils/cart';

async function handleLogin(email, password) {
  // Login user
  const response = await loginAPI(email, password);
  const { token } = response.data;
  
  // Save token
  localStorage.setItem('token', token);
  
  // Sync guest cart with backend
  const guestCart = getGuestCart();
  
  if (guestCart.length > 0) {
    await syncCart(guestCart, token);
    clearGuestCart(); // Clear localStorage cart
  }
  
  // Redirect to cart or home
  navigate('/cart');
}
```

### 4. Cart API Functions

```javascript
// api/cart.js
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

const getAuthHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export const getCart = async () => {
  const response = await axios.get(`${API_URL}/cart`, getAuthHeader());
  return response.data;
};

export const addToCart = async (planId, quantity) => {
  const response = await axios.post(
    `${API_URL}/cart`,
    { software_plan_id: planId, quantity },
    getAuthHeader()
  );
  return response.data;
};

export const updateCartItem = async (cartItemId, quantity) => {
  const response = await axios.put(
    `${API_URL}/cart/${cartItemId}`,
    { quantity },
    getAuthHeader()
  );
  return response.data;
};

export const removeCartItem = async (cartItemId) => {
  const response = await axios.delete(
    `${API_URL}/cart/${cartItemId}`,
    getAuthHeader()
  );
  return response.data;
};

export const syncCart = async (items, token) => {
  const response = await axios.post(
    `${API_URL}/cart/sync`,
    { items },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};
```

---

## Role-Based Pricing

### Backend automatically handles pricing:

- **Normal User**: Gets `price` from plan
- **Distributor**: Gets `special_price` if available, otherwise `price`

### Frontend just needs to:
1. Show the price from API response
2. Add to cart (backend calculates correct price)
3. Display cart with prices

---

## Flow Summary

### Guest User:
1. Browse products → Add to cart → Stored in localStorage
2. Try to checkout → Redirect to login
3. After login → Cart syncs to backend → Proceed to checkout

### Logged-in User:
1. Browse products → Add to cart → Saved to database
2. Cart persists across devices
3. Distributor sees special prices automatically

---

## Database Tables Used

- `software_carts` - User's cart
- `software_cart_items` - Items in cart with quantity
- `software_plans` - Plan details with pricing
- `software_products` - Product info
- `software_brands` - Brand info with images
