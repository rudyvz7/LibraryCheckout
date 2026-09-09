# Case Study: Library Rental System Architecture & Challenges

This document outlines the core technical decisions, encountered bugs, and structural resolutions involved in building the Library Rental System. 

## 1. Schema Design

**The Problem:** The system needed to manage bookings for both physical items (laptops, cameras) and physical facility spaces (study rooms). These entities possess distinct, non-overlapping attributes—for example, items have a `replacement_value` and a `current_condition`, whereas rooms have a `capacity` and `room_number`. However, both need to be booked using the exact same calendar event logic.
**The Decision:** A polymorphic asset model was implemented. `rentable_assets` acts as a shared supertype table, generating a universal `asset_id`. The `items` and `rooms` tables serve as subtypes, using that same `asset_id` as their primary key (foreign-key-as-primary-key pattern). 
**The Reasoning:** This approach elegantly circumvents the problem of nullable dual foreign keys (e.g., an `item_id` and a `room_id` column, where one is always null) in the `rental_events` booking table. It maintains strict referential integrity while keeping entity-specific schemas cleanly segregated.

## 2. Concurrency

**The Problem:** In a high-traffic environment, two users might simultaneously attempt to book the same popular asset for overlapping times. Application-level validation (querying for availability, then inserting) is prone to race conditions if two requests execute between the read and the write.
**The Decision:** Database-level concurrency protection was leveraged by implementing a PostgreSQL `EXCLUDE` constraint utilizing `tsrange` and the `&&` overlap operator.
**The Reasoning:** By placing the guardrail at the lowest possible level, double-booking becomes structurally impossible regardless of how the application scales or if a race condition occurs. The constraint evaluates transactionally at the exact moment of insertion, ensuring absolute data integrity.

## 3. History Tracking

**The Problem:** State changes for rental assets (checked out, available, damaged) can be modeled by simply updating a status column. However, simply overwriting current status obliterates the historical record of when assets were checked out, extended, returned, or damaged.
**The Decision:** An append-only event log (`rental_events`) was chosen to drive history tracking. 
**The Reasoning:** Instead of mutating historical rows, every action (checkout, extension, early return, late return) results in a new immutable row tied together by a `rental_group_id`. This guarantees the full history of extensions, returns, fees, and condition changes is always preserved, auditable, and capable of being reconstructed.

## 4. Bug: The Stale Exclusion Constraint

**The Problem:** The PostgreSQL exclusion constraint (designed to prevent double-booking) aggressively rejected legitimate new bookings. It was flagging them as "overlapping" because it was comparing new dates against *all* checkout rows ever created for that asset—including bookings from months prior that had already been successfully returned.
**The Resolution:** The constraint lacked a mechanism to distinguish active rentals from completed ones. This was resolved by adding an `is_active` boolean column to the `rental_events` table. The return endpoint was updated to flip this flag to `false` when an item is returned. Crucially, the exclusion constraint was rebuilt with a partial index (`WHERE is_active = true`), properly scoping it to only evaluate against currently active reservations.

## 5. Bug: Transaction Safety for Checkout/Return

**The Problem:** The checkout and return flows both involve multiple distinct database writes. A checkout requires inserting an event log and updating the item's cached `current_status`. If the Node server crashed or the network failed between those two queries, data drift would occur: an event log would exist indicating an item was checked out, but the item's status would forever read as "available."
**The Resolution:** Explicit PostgreSQL transactions (`BEGIN`, `COMMIT`, `ROLLBACK`) were implemented. By requesting a dedicated client from the connection pool, all related statements are grouped into an atomic unit of work. If any part of the checkout or return process fails, the entire transaction rolls back, guaranteeing the event log and the cached status remain perfectly synchronized.

## 6. Bug: Timezone Mismatch in Timestamp Parsing

**The Problem:** A live activity feed displayed relative timestamps (e.g., "in 5 hours") for events that had just occurred.
**The Diagnosis:** PostgreSQL `TIMESTAMP` columns (without timezone) store raw chronological values devoid of timezone metadata. By default, the `pg` Node driver assumes these raw values are localized to the backend machine's system timezone when converting them into JavaScript `Date` objects. If the system was UTC but interpreted locally, it shifted the time, causing past events to appear hours in the future.
**The Resolution:** Rather than patching the symptom downstream in the frontend display logic, a custom type parser (`pg.types.setTypeParser(1114, ...)`) was registered globally in the connection pool. This forces the driver to explicitly treat all raw timestamp columns as UTC (by appending a 'Z') the moment they are read from the database, permanently eliminating offset drift.

## 7. Real-Time Updates

**The Goal:** Ensure that all concurrent users view the exact same availability state and activity feed without requiring manual page refreshes or costly continuous polling.
**The Implementation:** Socket.io was integrated directly into the existing Express HTTP server, sharing the underlying `http.Server` instance. Whenever a critical state change occurs (a successful checkout or return transaction), the backend broadcasts an `inventory-updated` event. Connected clients listen for this event and automatically refetch their local state, keeping every open browser tab perfectly synchronized in real-time.

## 8. Deployment

**The Goal:** Deploy the system to modern cloud platforms (Railway for the backend, Vercel for the frontend).
**Encountered Hurdles & Resolutions:**
* **Corrupted Git Repository Structure:** An accidental nested git repository (acting as an uninitialized submodule) caused the backend build detection on Railway to fail. This was rectified by cleanly flattening the git structure into a true monorepo.
* **Port Mismatch:** The Express server hardcoded a port, conflicting with the dynamic port assigned by Railway's deployment environment.
* **Silent Localhost Fallback:** A missing/misnamed environment variable in the production deployment caused the database connection to silently fall back to `localhost`, breaking production API calls until correctly configured.
* **TypeScript Strict-Mode Build Error:** A null-safe handler issue surfaced only in Vercel's production builds. Development environments often mask these issues until a full type-checking pass (`tsc -b` or `tsc --noEmit`) is executed. The `App.tsx` state was properly fortified with fallback fall-throughs to satisfy the strict compiler constraints.
