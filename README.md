# Library Rental System

The Library Rental System is a full-stack application designed to manage the booking and circulation of both physical equipment (such as cameras, keyboards, mice, and laptops) and facility spaces (such as study and media rooms). Built for library staff and patrons, it features an intuitive patron-facing browsing experience alongside a comprehensive staff dashboard to manage checkouts, process returns, compute dynamic fees based on condition and lateness, and oversee live inventory status.

## Tech Stack
* **Backend:** Node.js, Express, PostgreSQL (hosted on Supabase), Socket.io
* **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui
* **Deployment:** Railway (backend), Vercel (frontend), Supabase (database)

## Live Demo
* **Live Demo (frontend):** https://library-rental-backend-smoky.vercel.app/ —> click this to use the app
* **Backend Health Check:** librarycheckout-production.up.railway.app/health —> a live JSON response confirming the backend and database are running (the bare backend root URL will show "Cannot GET /", which is expected — it's an API server, not a webpage)

## Key Features
* **Real-time availability tracking** with WebSocket-based live updates (no page refresh needed)
* **Database-level concurrency protection** using a PostgreSQL exclusion constraint to prevent double-booking, even under race conditions
* **Transactional checkout/return flow** with automatic fee calculation based on lateness and item condition
* **Polymorphic asset modeling** (items and rooms share a common booking system via a supertype/subtype schema design)
* **Business-rule-driven booking logic** (e.g., off-premise items cannot be pre-booked while checked out; on-premise items/rooms have a maximum booking duration and can be reserved in advance)
* **Live system activity feed** showing real-time database events

## Local Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Backend Setup:**
   ```bash
   cd library-rental-backend
   npm install
   ```
   Create a `.env` file in the `library-rental-backend` directory and add your database URL:
   ```env
   DATABASE_URL=your_postgresql_database_url
   PORT=3000
   ```
   Start the backend development server:
   ```bash
   npm run dev
   ```

3. **Frontend Setup:**
   Open a new terminal window/tab:
   ```bash
   cd library-rental-frontend
   npm install
   ```
   Create a `.env` file in the `library-rental-frontend` directory and specify the API URL:
   ```env
   VITE_API_URL=http://localhost:3000
   ```
   Start the frontend development server:
   ```bash
   npm run dev
   ```

## Known Limitations & Future Work
* **No Real Payment Processing:** The application simulates a business requirement for payment verification (the `requires_payment` validation logic exists and is rigorously enforced by the API), but Stripe integration was scoped out of the initial build and has not been implemented.
* **No Real Authentication:** User identity is currently self-reported (via entering a User ID) and is not secured by passwords or OAuth. 
* **UX Enhancements:** A visual calendar-grid booking UI (inspired by standard university room booking systems) is planned as a future UX improvement to replace the current list-based browsing approach.

## Built With AI Assistance
Architectural and schema design decisions were created and reasoned through deliberately by me. Boilerplate scaffolding and UI styling were AI-assisted under my close direction and review.
