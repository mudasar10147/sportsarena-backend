# **Step 1: Define the API Architecture & Patterns (Detailed)**

The goal of this step is to **structure your backend API** in a way that is **scalable, maintainable, and easy for the mobile app to consume**.

Here’s what it involves:

---

## **1.1 Choose API Type: REST**

For MVP, **REST API** is the best choice because:

* It is **simple and fast to implement**
* Mobile apps (Flutter) integrate easily
* Most developers understand REST, so onboarding is easier
* JSON responses are easy to parse

> Alternative like GraphQL is powerful but adds complexity, which you **don’t need for MVP**.

---

## **1.2 Define Base URL Versioning**

* Use a **base URL prefix** for all API endpoints:

```
/api/v1/
```

**Why version your API?**

* Allows you to release future versions (v2) without breaking existing mobile apps
* Keeps endpoints consistent across app updates

**Example:**

```
GET /api/v1/facilities
POST /api/v1/bookings
```

---

## **1.3 Resource-Based Endpoints**

REST APIs should be **resource-oriented**, not action-oriented.

### **Rules:**

* Resources = your database models: **User, Facility, Court, TimeSlot, Booking, PaymentTransaction**
* Use **plural nouns** for endpoints (e.g., `/users`, `/facilities`)
* Map HTTP methods to actions:

| HTTP Method | Action            |
| ----------- | ----------------- |
| GET         | Fetch resource(s) |
| POST        | Create a resource |
| PUT / PATCH | Update a resource |
| DELETE      | Delete a resource |

**Examples:**

```
GET /api/v1/facilities → list all facilities
GET /api/v1/facilities/123 → get details of facility #123
POST /api/v1/bookings → create a new booking
PUT /api/v1/courts/45 → update court #45
```

---

## **1.4 Implement CRUD Operations Only Where Necessary**

For MVP, **not every model needs full CRUD**. Only expose operations required to **support booking flow**.

**Example:**

* **User:** Create (signup), Read (profile), Login → no delete required
* **Facility:** Read (list & details) → create/update only for admin/facility owner
* **Booking:** Create & Read (view bookings) → optional cancel
* **PaymentTransaction:** Create & Read
* **TimeSlot:** Read (user), Create/Update (admin)

> Keeping it minimal reduces development time and complexity.

---

## **1.5 Authentication & Authorization**

### **Authentication**

* Use **JWT tokens**:

  * User logs in → backend returns JWT
  * App stores JWT → sends it in `Authorization: Bearer <token>` header for every protected request
* Protect all routes that require user login (booking creation, profile, payment verification)

### **Authorization**

* Ensure **role-based access**:

  * Player → can view facilities, book courts, see own bookings
  * Facility Admin → can add courts, add slots, manage bookings
* Implement middleware to check roles before accessing admin endpoints

---

## **1.6 Response Structure**

All API responses should follow a **consistent JSON format**:

```json
{
  "success": true,
  "data": {...},
  "message": "Booking created successfully"
}
```

**Why consistent responses?**

* Mobile app parsing becomes predictable
* Easier to handle errors & display messages
* Maintains clarity between success and failure

---

## **1.7 Error Handling**

* Send clear **HTTP status codes**:

  * `200 OK` → success
  * `201 Created` → resource created
  * `400 Bad Request` → invalid input
  * `401 Unauthorized` → missing/invalid token
  * `403 Forbidden` → insufficient permissions
  * `404 Not Found` → resource not found
  * `500 Internal Server Error` → unexpected errors

* Include an **error message in JSON** to make debugging easier.

```json
{
  "success": false,
  "message": "Time slot already booked",
  "error_code": "SLOT_OCCUPIED"
}
```

---

## **1.8 Optional Enhancements for MVP**

* **Pagination:** For endpoints returning large lists (e.g., `/facilities`)
* **Filtering & Sorting:** Basic filters like sport type or location
* **Rate Limiting / Throttling:** Optional but helps prevent abuse

---

# ✅ **Summary of Step 1**

1. **REST API** → simple, fast, mobile-friendly
2. **Versioned base URL** → `/api/v1/`
3. **Resource-based endpoints** → Users, Facilities, Courts, Slots, Bookings, Payments
4. **Minimal CRUD** → only necessary operations for MVP
5. **Authentication & Authorization** → JWT + role checks
6. **Consistent JSON response** → success/failure + message + data
7. **Error handling** → proper HTTP status codes + clear messages
8. **Optional enhancements** → pagination, filtering, rate limiting
