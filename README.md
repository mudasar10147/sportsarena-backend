# SportsArena Backend

Backend API for SportsArena - Smart Sports Facility Booking Marketplace

## Tech Stack

- **Node.js** - Runtime environment
- **Express** - Web framework
- **PostgreSQL** - Database
- **pg** - PostgreSQL client for Node.js

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Update `.env` with your PostgreSQL credentials:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sportsarena
DB_USER=postgres
DB_PASSWORD=your_password_here
```

4. Create the PostgreSQL database:
```bash
createdb sportsarena
```

5. Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## API Endpoints

### Health Check
- **GET** `/health` - Check server and database health status

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js    # PostgreSQL connection configuration
│   └── server.js          # Express app entry point
├── .env.example           # Environment variables template
├── .gitignore
├── package.json
└── README.md
```

## Development

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon (auto-reload)

