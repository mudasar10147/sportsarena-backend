# Architecture Documentation

This folder contains system architecture and design decision documentation.

## Files

### Core Architecture

- **TIME_NORMALIZATION_ARCHITECTURE.md**
  - Time normalization using "minutes since midnight" format
  - PostgreSQL storage strategy
  - Service layer validation and conversion
  - Advantages over timestamps

- **RULE_BASED_AVAILABILITY_ARCHITECTURE.md**
  - Rule-based availability system design
  - Why rule-based scales better than slot-based
  - How slot generation works from rules
  - Multi-sport and multi-court support

- **RULE_BASED_SCHEMA_QUICK_REFERENCE.md**
  - Quick reference for rule-based schema
  - Table relationships
  - Common queries
  - Slot generation logic

### Booking System

- **PENDING_BOOKING_ARCHITECTURE.md**
  - PENDING booking reservation mechanism
  - Why PENDING bookings must block availability
  - Expiration enforcement strategies
  - How it scales and supports future online payments

- **PENDING_BOOKING_IMPLEMENTATION_SUMMARY.md**
  - Implementation summary
  - What was implemented
  - Key features
  - Testing checklist

## Reading Order

1. Start with **TIME_NORMALIZATION_ARCHITECTURE.md** - Foundation for time handling
2. Read **RULE_BASED_AVAILABILITY_ARCHITECTURE.md** - Core availability system
3. Review **RULE_BASED_SCHEMA_QUICK_REFERENCE.md** - Quick lookup
4. Study **PENDING_BOOKING_ARCHITECTURE.md** - Booking reservation mechanism

