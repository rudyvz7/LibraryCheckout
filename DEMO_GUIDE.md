# Demo Guide

Welcome to the live demo! As noted in the project's known limitations, there is no real authentication implemented in this build—this is by design. You can simply type any of the User IDs below into the User ID field to instantly act as that user.

## Demo Users

| User ID | Name | What to try |
|---|---|---|
| **1** | Test User | Has **no payment method** on file. Try booking an off-premise item (e.g. a camera or keyboard)—it will be correctly rejected with a 402 error, demonstrating the payment-requirement validation. Can still book rooms/on-premise items normally. |
| **10** | Maria Gonzalez | Has a **payment method** on file. Can book both on-premise and off-premise items without restriction. |
| **13** | Tom Nguyen | Has a **payment method** on file. Good second account to demonstrate the double-booking prevention: try booking the same item as Maria for overlapping dates and see the PostgreSQL exclusion constraint reject it. |

## Things to Try

1. **Test the off-premise advance booking rule:** Book an off-premise item (camera, keyboard, etc.) for a future date, then try booking it again as a different user before it's returned. Observe the *"must be returned first"* rejection.
2. **Test the on-premise duration limit:** Book an on-premise item or room for more than 3 hours. Observe the maximum-duration rejection.
3. **Experience the WebSockets:** Open the app in two browser tabs side by side. Book something in one tab and watch the **Live System Activity** feed and availability list update instantly in the other tab, with no page refresh needed.
4. **Test the dynamic fee calculator:** As staff on the Staff Dashboard, process a return with a condition other than "Good" (e.g., "Lightly Damaged (usable)") on an item that is also overdue. Observe the combined condition + late fee calculation on the success message and in the activity feed.
