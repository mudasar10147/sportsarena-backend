# SportsArena Documentation

Welcome to the SportsArena backend documentation. This documentation is organized into clear categories to help you find what you need quickly.

## 📚 Documentation Structure

### 🏗️ [Architecture](./Architecture/)
System architecture and design decisions:
- **TIME_NORMALIZATION_ARCHITECTURE.md** - Time normalization using minutes since midnight
- **RULE_BASED_AVAILABILITY_ARCHITECTURE.md** - Rule-based availability system design
- **RULE_BASED_SCHEMA_QUICK_REFERENCE.md** - Quick reference for rule-based schema
- **PENDING_BOOKING_ARCHITECTURE.md** - PENDING booking reservation mechanism
- **PENDING_BOOKING_IMPLEMENTATION_SUMMARY.md** - Implementation summary for PENDING bookings

### 🔌 [API Documentation](./API/)
Complete API endpoint documentation:
- **API_ARCHITECTURE.md** - Overall API architecture
- **API_ROUTES.md** - All API routes overview
- **USER_API_GUIDE.md** - User management endpoints
- **FACILITY_API_GUIDE.md** - Facility management endpoints
- **COURT_API_GUIDE.md** - Court management endpoints
- **SPORT_API_GUIDE.md** - Sport management endpoints
- **FACILITY_SPORT_API_GUIDE.md** - Facility-Sport relationship endpoints
- **AVAILABILITY_API_GUIDE.md** - Availability and slot generation endpoints
- **BOOKING_API_GUIDE.md** - Booking endpoints
- **GOOGLE_AUTH_API_GUIDE.md** - Google authentication endpoints

#### [API/Image](./API/Image/)
Image-related API endpoints:
- **IMAGE_UPLOAD_API_GUIDE.md** - Image upload endpoints
- **IMAGE_MODERATION_API.md** - Image moderation endpoints
- **PROFILE_IMAGE_REPLACEMENT_GUIDE.md** - Profile image replacement guide

#### [API/Setup](./API/Setup/)
API setup and middleware:
- **MIDDLEWARE_SETUP.md** - Middleware configuration
- **STEP3_MIDDLEWARE_VERIFICATION.md** - Middleware verification steps

### 🗄️ [Database](./Database/)
Database schema and relationships:
- **DATABASE_ERD.md** - Entity Relationship Diagram
- **DATABASE_RELATIONSHIPS.md** - Database relationships documentation

### 🚀 [Deployment](./Deployment/)
Deployment guides and troubleshooting:
- **RAILWAY_DEPLOYMENT.md** - Railway deployment guide
- **RAILWAY_TROUBLESHOOTING.md** - Railway troubleshooting guide
- **CLOUDFRONT_SETUP.md** - CloudFront CDN setup
- **CDN_VERIFICATION_REPORT.md** - CDN verification report

### 🖼️ [Images](./Images/)
Image system documentation:
- **IMAGE_SYSTEM.md** - Complete image system overview
- **IMAGE_VARIANTS.md** - Image variants and processing
- **IMAGE_PROCESSING_HOOKS.md** - Image processing hooks
- **S3_UPLOAD_GUIDE.md** - S3 upload guide

### 📖 [Guides](./Guides/)
User and admin guides:
- **PLATFORM_ADMIN_GUIDE.md** - Platform admin guide
- **POSTMAN_IMAGE_UPLOAD_GUIDE.md** - Postman image upload guide
- **POSTMAN_S3_UPLOAD_TROUBLESHOOTING.md** - Postman S3 upload troubleshooting

### 📊 [Models](./MODELS/)
Data model documentation:
- **MODELS.md** - Models overview
- **User.md** - User model
- **Facility.md** - Facility model
- **Court.md** - Court model
- **Sport.md** - Sport model
- **FacilitySport.md** - FacilitySport model
- **Booking.md** - Booking model
- **PaymentTransaction.md** - PaymentTransaction model

### 💡 [Concept](./Concept/)
Project concept and MVP documentation:
- **Idea.md** - Project idea and vision
- **MVP.md** - MVP requirements
- **MVP_DB.md** - MVP database design

## 🗺️ Quick Navigation by Topic

### Getting Started
1. Start with [Concept/MVP.md](./Concept/MVP.md) to understand the project
2. Review [API/API_ARCHITECTURE.md](./API/API_ARCHITECTURE.md) for API overview
3. Check [Database/DATABASE_ERD.md](./Database/DATABASE_ERD.md) for database structure

### For Developers
- **Architecture**: Start with [Architecture/TIME_NORMALIZATION_ARCHITECTURE.md](./Architecture/TIME_NORMALIZATION_ARCHITECTURE.md)
- **API Development**: See [API/](./API/) folder
- **Database**: See [Database/](./Database/) folder
- **Models**: See [MODELS/](./MODELS/) folder

### For Deployment
- **Railway**: [Deployment/RAILWAY_DEPLOYMENT.md](./Deployment/RAILWAY_DEPLOYMENT.md)
- **CloudFront**: [Deployment/CLOUDFRONT_SETUP.md](./Deployment/CLOUDFRONT_SETUP.md)
- **Troubleshooting**: [Deployment/RAILWAY_TROUBLESHOOTING.md](./Deployment/RAILWAY_TROUBLESHOOTING.md)

### For Image Management
- **Image System**: [Images/IMAGE_SYSTEM.md](./Images/IMAGE_SYSTEM.md)
- **S3 Upload**: [Images/S3_UPLOAD_GUIDE.md](./Images/S3_UPLOAD_GUIDE.md)
- **API Endpoints**: [API/Image/](./API/Image/)

### For Admins
- **Platform Admin**: [Guides/PLATFORM_ADMIN_GUIDE.md](./Guides/PLATFORM_ADMIN_GUIDE.md)
- **Postman Guides**: [Guides/](./Guides/)

## 📝 Documentation Standards

All documentation follows these conventions:
- **Architecture docs**: Explain design decisions and patterns
- **API guides**: Complete endpoint documentation with examples
- **Setup guides**: Step-by-step instructions
- **Troubleshooting**: Common issues and solutions

## 🔄 Recent Updates

- **Rule-Based Availability**: New rule-based system (no slot tables)
- **Time Normalization**: Minutes since midnight format
- **PENDING Bookings**: Reservation mechanism with expiration
- **Transaction Safety**: Race condition prevention

## 📞 Need Help?

- Check the relevant category folder
- Review troubleshooting guides in [Deployment/](./Deployment/)
- See API examples in [API/](./API/)

