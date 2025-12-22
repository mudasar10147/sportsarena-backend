# **Step 1: Define the API Architecture & Patterns**

* Use **REST API** for the MVP (simpler and faster).
* Base URL: `/api/v1/`
* Use **resource-based endpoints** for each model.
* Implement **CRUD operations** only where necessary for MVP.
* Ensure **authentication** using JWT (login/signup) for secure access.

---

# **Step 2: Identify API Routes for Each Model**

Here’s a complete breakdown of the **routes** you need for your MVP:

---

### **1. User Routes**

| Method | Endpoint          | Description                       |
| ------ | ----------------- | --------------------------------- |
| POST   | `/users/signup`   | Register a new user               |
| POST   | `/users/login`    | Login and get JWT token           |
| GET    | `/users/profile`  | Get logged-in user profile        |
| PUT    | `/users/profile`  | Update profile (optional for MVP) |
| GET    | `/users/bookings` | Fetch user’s bookings             |

---

### **2. Facility Routes**

| Method | Endpoint          | Description                                               |
| ------ | ----------------- | --------------------------------------------------------- |
| GET    | `/facilities`     | List all facilities (with optional filters: city, sport)  |
| GET    | `/facilities/:id` | Get details of a facility (photos, courts, opening hours) |
| POST   | `/facilities`     | Add a facility (only for admin/facility owner)            |
| PUT    | `/facilities/:id` | Update facility details (admin)                           |

---

### **3. Sport Routes**

| Method | Endpoint      | Description                       |
| ------ | ------------- | --------------------------------- |
| GET    | `/sports`     | List all sports                   |
| GET    | `/sports/:id` | Get details of a sport (optional) |
| POST   | `/sports`     | Create a Sport                    |

> For MVP, sports are mostly static; no create/update routes needed initially.

---

### **4. FacilitySport Routes**

| Method | Endpoint                 | Description                                       |
| ------ | ------------------------ | ------------------------------------------------- |
| GET    | `/facilities/:id/sports` | Get sports offered by a facility                  |
| POST   | `/facilities/:id/sports` | Assign sport to a facility (admin/facility owner) |

---

### **5. Court Routes**

| Method | Endpoint                 | Description                    |
| ------ | ------------------------ | ------------------------------ |
| GET    | `/facilities/:id/courts` | List all courts for a facility |
| POST   | `/facilities/:id/courts` | Add new court to facility      |
| PUT    | `/courts/:id`            | Update court details (admin)   |

---

### **6. TimeSlot Routes**

| Method | Endpoint                | Description                                       |
| ------ | ----------------------- | ------------------------------------------------- |
| GET    | `/courts/:id/timeslots` | Get all available slots for a court (next 7 days) |
| POST   | `/courts/:id/timeslots` | Add a new slot (facility admin)                   |
| PUT    | `/timeslots/:id`        | Update/Block slot (e.g., maintenance)             |

---

### **7. Booking Routes**

| Method | Endpoint               | Description                             |
| ------ | ---------------------- | --------------------------------------- |
| POST   | `/bookings`            | Create a new booking (user)             |
| GET    | `/bookings/:id`        | Get booking details                     |
| GET    | `/users/bookings`      | List bookings for logged-in user        |
| PUT    | `/bookings/:id/cancel` | Cancel a booking (if allowed by policy) |

> Backend should handle slot locking to **prevent double booking**.

---

### **8. PaymentTransaction Routes**

| Method | Endpoint                | Description                         |
| ------ | ----------------------- | ----------------------------------- |
| POST   | `/payments/initiate`    | Start payment for a booking         |
| POST   | `/payments/verify`      | Verify payment success from gateway |
| GET    | `/bookings/:id/payment` | Fetch payment status for booking    |

---

# **Step 3: Set Up Middleware**

* **Authentication middleware:** Verify JWT for user/admin routes.
* **Authorization middleware:** Ensure only facility owner/admin can create/update courts, slots, or facilities.
* **Error handling middleware:** Catch API errors and return consistent JSON response.

---

# **Step 4: Implement Controllers**

* Each model gets a **controller** handling business logic.

* Example:

  * UserController → signup, login, profile
  * FacilityController → list, details, update
  * BookingController → create booking, fetch bookings

* Keep controllers **thin**; main logic in **services** or **repositories** for cleaner structure.

---

# **Step 5: Implement Slot Locking & Booking Safety**

* To **prevent double bookings**, implement:

1. When user selects a slot:

   * Backend **locks the slot** (e.g., mark as `pending`)
2. User completes payment

   * Backend marks slot as `booked`
3. If payment fails or timeout occurs

   * Backend releases the slot

* This requires **transaction support** from PostgreSQL.

---

# **Step 6: Testing the APIs**

* Use **Postman / Insomnia** to manually test endpoints.
* Ensure correct responses for:

  * Success
  * Failure
  * Validation errors
  * Unauthorized access

---

# **Step 7: Prepare for Mobile App Integration**

* Return **JSON responses** with clear structure:

  ```json
  {
    "success": true,
    "data": {...},
    "message": "Booking created successfully"
  }
  ```
* Include pagination for listing endpoints (`/facilities`) if data grows.
* Keep all API responses **consistent** for easier mobile app consumption.

---

# ✅ **Summary of Next Steps After DB Models**

1. Define API architecture & REST endpoints for all models ✅
2. Implement routes with controllers & services ✅
3. Set up middleware: authentication, authorization, error handling ✅
4. Implement slot locking logic for safe booking ✅
5. Integrate payment gateway APIs ✅
6. Test endpoints with Postman/Insomnia ✅
7. Return consistent JSON for mobile app integration ✅