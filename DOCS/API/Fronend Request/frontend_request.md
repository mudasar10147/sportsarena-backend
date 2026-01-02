# Explore Page Implementation Guide

## Overview
This document outlines what's needed to make the Explore page fully functional with the backend API.

## Current State
- ✅ Explore page UI exists with mock data
- ✅ Filter UI components exist (but non-functional)
- ✅ FacilitiesRepository exists with `getFacilities()` method
- ✅ Facility model exists
- ✅ API client exists
- ✅ Navigation/router exists
- ❌ Explore page route missing from app_router.dart
- ❌ No API integration in explore page
- ❌ Filters not connected to API
- ❌ Navigation to facility detail not implemented

---

## What Already Exists (Can Reuse)

### 1. Data Layer ✅
- **FacilitiesRepository** (`lib/features/facilities/data/repositories/facilities_repository.dart`)
  - Method: `getFacilities()` supports all needed filters:
    - `page`, `limit` (pagination)
    - `city` (string)
    - `sportId` (int)
    - `latitude`, `longitude`, `radiusKm` (location-based search)
  - Returns: `FacilitiesResponse` with `List<Facility>` and `PaginationInfo`

- **Facility Model** (`lib/features/facilities/domain/models/facility.dart`)
  - Contains all fields from API response
  - Includes: id, name, description, address, city, photos, sports, minPricePerHour, distanceKm, etc.

- **SportsRepository** (`lib/features/sports/data/repositories/sports_repository.dart`)
  - Method: `getAllSports(isActive: true)`
  - Can be used for sport filter dropdown

### 2. Infrastructure ✅
- **ApiClient** (`lib/core/network/api_client.dart`) - GET requests with query params
- **LocationService** (`lib/core/services/location_service.dart`) - For location-based search
- **AppRouter** - Facility detail route exists
- **Shared widgets** - LoadingIndicator, ErrorState, EmptyState

---

## What Needs to Be Implemented

### 1. Explore Page Route
**Location**: `lib/app/app_router.dart`

**Action**: Add explore route
```dart
static const String explore = '/explore';
```

And add case in `generateRoute()`:
```dart
case explore:
  return MaterialPageRoute(
    builder: (_) => const ExplorePage(),
    settings: settings,
  );
```

---

### 2. Update Explore Page Implementation

#### A. Replace Mock Data with API Calls

**Current**: Uses `MockExploreData.allFacilities`
**Change to**: Use `FacilitiesRepository.getFacilities()`

**Key Changes**:
1. Replace `ExploreFacility` model with `Facility` model (or adapt UI)
2. Use `FacilitiesRepository.instance` instead of mock data
3. Add state variables:
   - `List<Facility> _facilities`
   - `bool _isLoading`
   - `String? _errorMessage`
   - `PaginationInfo? _pagination`
   - `bool _hasMore`
   - `int _currentPage`

#### B. Implement Pagination (Infinite Scroll)

Follow the pattern from `FacilitiesListPage`:
- Use `ScrollController` to detect scroll position
- Load more when user scrolls near bottom
- Call `getFacilities()` with incremented page number

#### C. Implement Filters

**Filter State Variables**:
```dart
String? _selectedCity;          // For city filter
int? _selectedSportId;          // For sport filter  
String? _selectedPriceRange;    // For price filter (client-side or API)
String? _selectedAvailability;  // For availability filter (client-side or API)
double? _userLatitude;          // For location search
double? _userLongitude;         // For location search
double? _radiusKm;              // For location search (default: 50km)
```

**Filter Implementation**:
1. **Sport Filter**:
   - Load sports using `SportsRepository.getAllSports()`
   - Show dropdown/bottom sheet when filter chip tapped
   - Update `_selectedSportId` and reload facilities

2. **City Filter**:
   - Extract unique cities from facilities (or API endpoint if exists)
   - Show dropdown when filter chip tapped
   - Update `_selectedCity` and reload facilities

3. **Price Filter** (Client-side or API):
   - If API supports price filtering: add query parameter
   - Otherwise: Filter facilities client-side by `minPricePerHour`
   - Options: "Any Price", "\$0 - \$20", "\$20 - \$30", "\$30 - \$40", "\$40+"

4. **Availability Filter** (Client-side):
   - This is likely client-side only (no API support)
   - Filter by checking if facility has availability today
   - Requires additional API call per facility (not recommended for list view)
   - **Recommendation**: Remove or make it a client-side filter on facilities that have `isActive: true`
   - Availability Filter will also have date input that if specific slot available on that date.

5. **Location Search** (Optional):
   - Use `LocationService` to get user location
   - Pass `latitude`, `longitude`, `radiusKm` to `getFacilities()`
   - Shows `distanceKm` in facility cards

**Filter Application**:
- When any filter changes, reset page to 1 and reload facilities
- Build query parameters map from filter state
- Call `getFacilities()` with filters

#### D. Loading/Error States

1. **Loading State**:
   - Show `LoadingIndicator` while `_isLoading == true`
   - Show skeleton loaders or spinner

2. **Error State**:
   - Show `ErrorState` widget when API call fails
   - Provide retry button

3. **Empty State**:
   - Show empty state when `_facilities.isEmpty` and not loading
   - Already exists in explore_page.dart as `_buildEmptyState()`

#### E. Navigation to Facility Detail

**Current**: Empty `onTap` handler in `_buildFacilityCard()`
**Change to**:
```dart
onTap: () {
  Navigator.pushNamed(
    context,
    AppRouter.facilityDetail,
    arguments: {
      'facilityId': facility.id,
      'facilityName': facility.name,
    },
  );
}
```

#### F. Convert Facility Model to UI Format

The `Facility` model has different structure than `ExploreFacility`:
- `Facility.sports` is `List<FacilitySport>` (has id, name)
- `ExploreFacility.supportedSports` is `List<String>`

**Options**:
1. **Option 1 (Recommended)**: Update explore page UI to use `Facility` model directly
   - Use `facility.sports.map((s) => s.name).toList()` for sports list
   - Use `facility.minPricePerHour ?? 0.0` for price
   - Use `facility.city` for location
   - Use `facility.photos.isNotEmpty ? facility.photos[0] : null` for image

2. **Option 2**: Create adapter/converter function
   - Convert `Facility` to `ExploreFacility` format
   - More work, but keeps UI model separate

---

### 3. API Endpoint Mapping

| UI Filter | API Parameter | Repository Method |
|-----------|---------------|-------------------|
| Sport | `sportId` | ✅ Supported in `getFacilities()` |
| City | `city` | ✅ Supported in `getFacilities()` |
| Location | `latitude`, `longitude`, `radiusKm` | ✅ Supported in `getFacilities()` |
| Price | ❌ Not in API | Client-side filtering on `minPricePerHour` |
| Availability | ❌ Not in API | Client-side (or remove filter) |

**Missing API Support**:
- Price range filtering (can be done client-side)
- Availability filtering (requires per-facility API call - not recommended)

---

### 4. Additional Considerations

#### Image Loading
- Current: Placeholder gradient images
- Update: Use `facility.photos[0]` if available
- Add image loading widget (e.g., `Image.network()` with error handling)

#### Distance Display
- If using location search, show `facility.distanceKm` in cards
- Format as "2.5 km away" or similar

#### Rating Display
- API response doesn't include rating field
- Current UI shows rating stars
- **Decision needed**: Remove rating display or add rating to API

#### Map View
- Currently placeholder
- Can be implemented later using Google Maps or similar
- Not required for initial implementation

---

## Implementation Steps

1. **Add explore route** to `app_router.dart`
2. **Update explore page imports** - Add FacilitiesRepository, Facility model, etc.
3. **Replace mock data loading** - Use `FacilitiesRepository.getFacilities()`
4. **Add state management** - Loading, error, pagination state
5. **Implement pagination** - Infinite scroll
6. **Implement filters** - Sport, City, Price, Availability
7. **Update facility cards** - Use Facility model fields
8. **Add navigation** - Connect to facility detail page
9. **Add loading/error states** - Use shared widgets
10. **Test** - Verify all filters work, pagination works, navigation works

---

## File Changes Summary

### Files to Modify:
1. `lib/app/app_router.dart` - Add explore route
2. `lib/features/explore/presentation/pages/explore_page.dart` - Full rewrite with API integration
3. `lib/features/explore/presentation/models/mock_data.dart` - Can be deleted (or kept for reference)

### Files to Reference (No Changes):
- `lib/features/facilities/data/repositories/facilities_repository.dart` - Use as-is
- `lib/features/facilities/domain/models/facility.dart` - Use Facility model
- `lib/features/sports/data/repositories/sports_repository.dart` - Use for sport filter
- `lib/core/services/location_service.dart` - Use for location search
- `lib/shared/widgets/loading_indicator.dart` - Use for loading state
- `lib/shared/widgets/error_state.dart` - Use for error state

---

## Questions/Decisions Needed

1. **Rating Field**: API doesn't include rating. Remove from UI or request backend to add?
2. **Price Filter**: Implement client-side or request backend API support?
3. **Availability Filter**: Remove or implement client-side (requires per-facility API calls)?
4. **Map View**: Implement now or leave as placeholder for later?
5. **Cities List**: Extract from facilities or create separate API endpoint for cities?

---

## Testing Checklist

- [ ] Facilities load on page init
- [ ] Pagination works (infinite scroll)
- [ ] Sport filter works
- [ ] City filter works
- [ ] Price filter works (if implemented)
- [ ] Location search works (if implemented)
- [ ] Clear filters button works
- [ ] Loading state shows correctly
- [ ] Error state shows correctly with retry
- [ ] Empty state shows when no results
- [ ] Navigation to facility detail works
- [ ] Images load correctly (if using real images)
- [ ] Distance displays correctly (if using location search)

---

**Last Updated**: 2025-01-15

