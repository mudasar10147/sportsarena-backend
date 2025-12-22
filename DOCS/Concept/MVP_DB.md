# ✅ **MVP FEATURES → REQUIRED DATABASE MODELS**

Below is everything your MVP needs **from a data perspective**.
I’ve grouped models based on your MVP functionality.

---

# 🟦 **1. USER & AUTHENTICATION MODELS**

### **1. User**

Stores all user accounts (players & facility owners).

**Needed because:**
Users must log in, book, pay, and view their bookings.
Facility owners must manage their courts.

**Key purposes:**

* Authentication
* Profile info
* Role (player / facility admin)

---

# 🟩 **2. FACILITY MANAGEMENT MODELS**

### **2. Facility**

Represents each sports venue.

**Needed because:**
You need to display facility profiles, search by location, and show sports available.

**Stores:**

* Name
* Address
* Location (lat/long)
* Contact info
* Basic photos (3–5)
* Opening hours

---

### **3. Sport**

A predefined list of sports.

**Needed because:**
Users search by sport type (Padel, Tennis, Badminton).

**Examples:**
Padel, Football, Cricket, Basketball, Tennis, Badminton.

---

### **4. FacilitySport**

A linking table between Facility and Sport.

**Needed because:**
One facility can offer multiple sports.
One sport can exist across many facilities.

---

### **5. Court**

Represents individual courts/grounds at a facility.

**Needed because:**
Users must choose a court (or the system must know which court is being booked).

**Stores:**

* Court name/number
* Sport type
* Price per hour
* Indoor/Outdoor

---

# 🟧 **3. BOOKINGS & TIME MODELS**

### **6. TimeSlot**

Represents available booking slots created by the facility.

**Needed because:**

* User needs to pick available time
* Facility admin can add/block slots
* App must show availability for next 7 days

**Includes:**

* Court
* Start time
* End time
* Status (available / blocked / booked)

---

### **7. Booking**

A confirmed booking record.

**Needed because:**
Once user pays → booking generated.

**Stores:**

* User
* TimeSlot
* Final price
* Booking status
* Payment reference

---

# 🟥 **4. PAYMENT MODELS**

### **8. PaymentTransaction**

Record of every payment attempt/confirmation.

**Needed because:**

* Must verify payment success
* Must store gateway transaction IDs
* Must confirm if booking is valid

**Stores:**

* Amount
* Payment method
* Status (success/failed/pending)
* Payment gateway ID

---

# 🟫 **5. ADMIN MODELS**

### **9. FacilityAdmin (Optional for MVP if role is stored inside User)**

Links a user to a facility they manage.

**Needed because:**
Facility owners must manage:

* Courts
* Slots
* Bookings

Some apps store role inside User; some use a separate model.
Your choice.

---

### **10. AdminActivityLog (Optional MVP)**

Stores actions like:

* Added a slot
* Blocked a time
* Updated price

**Useful but optional** for the first MVP.

---

# 🟪 **6. SUPPORTING MODELS (Optional MVP)**

### **11. FileUpload / Photo**

Stores facility photos and court photos.

**Needed because:**
Facility profile requires 3–5 images.

---

### **12. City / Area (Optional)**

If you want city-based search.

---

---

# ✅ **Complete Final List — DB Models You Need for MVP**

### **ESSENTIAL MODELS (100% required)**

1. **User**
2. **Facility**
3. **Sport**
4. **FacilitySport**
5. **Court**
6. **TimeSlot**
7. **Booking**
8. **PaymentTransaction**

### **OPTIONAL (Good but not mandatory for MVP)**

9. **FacilityAdmin** (if not using User role)
10. **FileUpload / Photo** (or you can store images as simple URLs)
11. **AdminActivityLog**
12. **City/Area**

---

# 🎯 **This Model Set Supports All MVP Features**

### Supports:

✔ Search by sport/location
✔ Show facility profiles
✔ Show availability for next 7 days
✔ Select slot → confirm → pay → done
✔ Facility admin can add/block slots
✔ Admin can see upcoming bookings
✔ Users can see their bookings
✔ Payment verification

Everything is covered with the 8 essential models.
