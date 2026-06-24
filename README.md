# CursorVault

CursorVault is a Node.js + MySQL backend for browsing large product datasets efficiently using **cursor-based pagination**.

It provides APIs to:
- List products ordered by **newest first**
- Filter products by **category**
- Paginate through large datasets efficiently
- Keep pagination stable using a cursor built from **`updated_at` + `id`**

The project is designed around a dataset of **~200,000 products** and focuses on correctness, query efficiency, and predictable pagination behavior on a large changing dataset.

---

## Live Demo

**Production API Base URL**  
[https://cursorvault.onrender.com](https://cursorvault.onrender.com)

**Deployed Stack**
- **Backend hosting:** Render
- **Production database:** Aiven MySQL

**Public endpoints**
- **Health check:** `GET /` → [https://cursorvault.onrender.com/](https://cursorvault.onrender.com/)
- **Products API:** `GET /api/products` → [https://cursorvault.onrender.com/api/products](https://cursorvault.onrender.com/api/products)

**Example production requests**
```http
GET https://cursorvault.onrender.com/api/products
GET https://cursorvault.onrender.com/api/products?limit=5
GET https://cursorvault.onrender.com/api/products?category=Books
GET https://cursorvault.onrender.com/api/products?category=Books&limit=5
GET https://cursorvault.onrender.com/api/products?category=Books&limit=5&cursor=<base64-cursor>
```

> **Note:** The app is deployed on Render's free tier, so the first request after inactivity may take a few extra seconds while the service wakes up.

---

## Overview

This project was built as a backend exercise around a simple but realistic problem:

- Browse a large products table (~200,000 rows)
- Sort by newest first
- Filter by category
- Paginate efficiently
- Avoid the usual issues of slow offset pagination on large datasets

The main design choice here is using **cursor-based pagination** instead of offset pagination.

---

## Tech Stack

- **Node.js**
- **Express.js**
- **MySQL**
- **mysql2**
- **Faker.js**
- **dotenv**

---

## Why I Chose This Approach

**Backend: Node.js + Express**

I chose Node.js + Express because it keeps the API small and quick to build, while still being very readable for a take-home backend task.

**Database: MySQL**

I used MySQL because:
- The problem is fundamentally relational
- Pagination performance depends heavily on indexing and query shape
- MySQL is a practical fit for testing ordered queries, filtering, and cursor pagination over a large dataset

**Pagination strategy: cursor-based instead of offset-based**

For a large dataset, offset pagination gets slower as the page number grows because the database still has to scan and skip rows.

Cursor pagination avoids that by using the last row of the current page as the boundary for the next page.

---

## Problem Statement / Goal

The API should allow someone to browse a dataset of roughly 200,000 products:
- Sorted by newest first
- Optionally filtered by category
- Paginated efficiently
- With stable ordering across pages

The project includes:
- Schema for the `products` table
- Indexes for efficient retrieval
- A seed script for generating 200,000 products
- A paginated products API with category filtering

---

## Features

- Browse products sorted by `updated_at DESC, id DESC`
- Filter products by category
- Cursor-based pagination instead of offset pagination
- Stable ordering using `updated_at + id`
- Base64-encoded cursor for client-facing pagination
- Bulk seeding of 200,000 products
- Clean pagination metadata in the API response

---

## Project Structure

```
CursorVault/
│
├── postman_collections/
│   ├── CursorVault Local.postman_collection.json
│   └── CursorVault Production.postman_collection.json
│
├── scripts/
│   └── seedProducts.js
│
├── sql/
│   ├── schema.sql
│   └── indexes.sql
│
├── src/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   └── productController.js
│   ├── routes/
│   │   └── productRoutes.js
│   ├── services/
│   │   └── productService.js
│   ├── utils/
│   │   └── cursor.js
│   └── app.js
│
├── .env.example
├── package.json
├── server.js
└── README.md
```

---

## Database Schema

```sql
CREATE TABLE products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
```

---

## Indexes

```sql
CREATE INDEX idx_products_cursor
ON products(updated_at DESC, id DESC);

CREATE INDEX idx_products_category_cursor
ON products(category, updated_at DESC, id DESC);
```

**Why these indexes?**

**`idx_products_cursor (updated_at DESC, id DESC)`**

Used for:
- Listing all products newest first
- Cursor pagination without category filtering

**`idx_products_category_cursor (category, updated_at DESC, id DESC)`**

Used for:
- Category filtering + cursor pagination
- Category filtering + newest-first retrieval within a category

These indexes match the two main query patterns in the API:
1. All products
2. Products filtered by category

---

## Why Sort by `updated_at DESC, id DESC`?

Using only `updated_at` is not enough because many rows can share the same timestamp.

To make ordering deterministic, I use:

```sql
ORDER BY updated_at DESC, id DESC
```

That means:
- Newest products come first
- If two products have the same `updated_at`, the larger `id` comes first
- The order stays stable across pages

This also allows the cursor to be built using the same pair of values: `updated_at + id`

---

## Pagination Strategy

### Cursor Structure

The cursor is built from the last product returned in the current page using:

```
updated_at|id
```

Example raw cursor:
```
2026-06-24 15:38:23|199975
```

That raw value is then Base64 encoded before being returned to the client.

Example encoded cursor:
```
MjAyNi0wNi0yNCAxNTozODoyM3wxOTk5NzU=
```

### How Pagination Works Internally

Products are always sorted using:

```sql
ORDER BY updated_at DESC, id DESC
```

When the client sends a cursor, the API fetches the next page using this condition:

```sql
(updated_at < ? OR (updated_at = ? AND id < ?))
```

Full pattern:

```sql
SELECT id, name, category, price, created_at, updated_at
FROM products
WHERE (updated_at < ? OR (updated_at = ? AND id < ?))
ORDER BY updated_at DESC, id DESC
LIMIT ?
```

If category filtering is also applied, the category condition is added along with the cursor condition.

### Why This Works Better Than Offset Pagination

With offset pagination, page 5000 means the database still has to skip a huge number of rows before returning the next page.

With cursor pagination, the database can continue from the last seen boundary instead of scanning and skipping earlier rows.

That makes it a much better fit for:
- Large datasets
- Ordered feeds
- "Load more" style product browsing

### Handling Pagination Metadata

The service fetches `limit + 1` rows internally.

**Why?** This is used to determine whether another page exists without running a separate `COUNT(*)`.

**Logic:**
- If rows fetched > requested limit → `hasMore: true`, trim the extra row, build `nextCursor` from the last returned product
- If rows fetched ≤ requested limit → `hasMore: false` and `nextCursor: null`

This keeps the response simple and avoids an extra query.

---

## Consistency While Data Changes

This implementation uses cursor pagination with a stable sort key:
- `updated_at DESC`
- `id DESC`

and the cursor stores the exact last seen `(updated_at, id)` boundary.

That means each next-page request continues from the last returned item in the same ordering rather than from a shifting numeric offset.

This is safer than offset pagination when new rows are inserted or existing rows are updated during browsing, because the query always resumes from a concrete boundary instead of "page number + offset".

> **Note:** If a product's `updated_at` changes while a user is already paging through results, that product can move to a different place in the sorted dataset because the sort key itself changed. That is expected behavior for any feed ordered by a mutable column. The cursor approach here avoids offset-shift problems and keeps page traversal stable relative to the last seen boundary.
>
> If I were building a production version where a fully frozen browse session was required, I would consider snapshot-based pagination or adding an upper-bound anchor for the session. For this implementation, the focus is on efficient cursor pagination with stable boundary traversal over a large dataset.

---

## API Endpoints

### `GET /`

Health check endpoint.

```json
{
  "success": true,
  "message": "CursorVault API is running."
}
```

---

### `GET /test-db`

Database connectivity test endpoint.

```json
[
  {
    "currentTime": "2026-06-24T10:30:00.000Z"
  }
]
```

---

### `GET /api/products`

Returns products ordered by newest first with optional category filtering and cursor pagination.

**Query Parameters**

| Parameter | Type | Description |
|---|---|---|
| `limit` | number | Number of products to return (default: 20, max: 100) |
| `category` | string | Filter by category |
| `cursor` | string | Base64 cursor from the previous page |

**Example Requests**

```
# First page
GET /api/products

# Custom limit
GET /api/products?limit=5

# Filter by category
GET /api/products?category=Books

# Category + custom limit
GET /api/products?category=Books&limit=5

# Next page using cursor
GET /api/products?cursor=MjAyNi0wNi0yNCAxNTozODoyM3wxOTk5NzU=

# Category + cursor
GET /api/products?category=Books&cursor=MjAyNi0wNi0yNCAxNTozODoyM3wxOTk5NzU=

# Category + limit + cursor
GET /api/products?category=Books&limit=5&cursor=MjAyNi0wNi0yNCAxNTozODoyM3wxOTk5NzU=
```

**Sample Response**

```json
{
  "success": true,
  "data": [
    {
      "id": 200000,
      "name": "Frozen Ceramic Cheese",
      "category": "Books",
      "price": "633.65",
      "created_at": "2026-06-24T10:08:23.000Z",
      "updated_at": "2026-06-24T10:08:23.000Z"
    },
    {
      "id": 199996,
      "name": "Fantastic Cotton Tuna",
      "category": "Books",
      "price": "221.40",
      "created_at": "2026-06-24T10:08:23.000Z",
      "updated_at": "2026-06-24T10:08:23.000Z"
    }
  ],
  "pagination": {
    "nextCursor": "MjAyNi0wNi0yNCAxMDowODoyM3wxOTk5OTY=",
    "hasMore": true,
    "limit": 5
  }
}
```

When `hasMore` is `false`, `nextCursor` is `null`.

---

## Seed Script

```bash
node scripts/seedProducts.js
```

**What it does:**
- Generates 200,000 fake products
- Uses Faker for product names and prices
- Assigns products to a small fixed set of categories
- Inserts rows in batches

**Categories used:** Electronics, Books, Clothing, Sports, Home

**Why batch inserts?** Inserting 200,000 rows one by one would be unnecessarily slow. Batch inserts reduce query overhead significantly and are much better suited for generating a large dataset quickly.

---

## Setup Instructions

**1. Clone the repository**
```bash
git clone https://github.com/qwerty12-ai/CursorVault.git
cd CursorVault
```

**2. Install dependencies**
```bash
npm install
```

**3. Create a `.env` file**

Use `.env.example` as reference:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=cursorvault

PORT=5000
```

**4. Create the database**
```sql
CREATE DATABASE cursorvault;
```

**5. Create the table**

Run the SQL in `sql/schema.sql`

**6. Create the indexes**

Run the SQL in `sql/indexes.sql`

**7. Seed the data**
```bash
node scripts/seedProducts.js
```

**8. Start the server**
```bash
npm run dev
```

Server runs on `http://localhost:5000`

---

## Environment Variables

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=cursorvault

PORT=5000
```

---

## Postman Collections

This repository includes Postman collections for both local and deployed testing inside the `postman_collections/` folder.

**Included collections**
- `CursorVault Local.postman_collection.json`
- `CursorVault Production.postman_collection.json`

**Covered requests**

The collections include requests for:
- Health check
- Database connectivity test
- Products listing
- Products listing with custom limit
- Products listing filtered by category
- Next page retrieval using cursor
- Combined query scenarios such as:
  - category + limit
  - category + cursor
  - category + limit + cursor

This makes it easy to test both local and deployed behavior without manually recreating requests.

---

## AI Usage

AI tools were used during development as a productivity and learning aid, mainly for:
- Understanding the cursor-based pagination approach for this problem
- Thinking through the SQL query structure for pagination and category filtering
- Understanding the indexing strategy for the main query patterns
- Reviewing edge cases around ordering, cursors, and pagination metadata
- Debugging implementation and environment/configuration issues
- Improving the README structure and technical explanations

I still built, configured, and tested the project myself, including:
- Setting up the backend project structure and API routes
- Creating the database schema and indexes in MySQL
- Generating and seeding the dataset
- Deploying the API to Render and the production database to Aiven
- Connecting the application to the hosted database
- Testing local and production endpoints with Postman


A few bugs and mistakes were caught and fixed during implementation, including:
- Mismatched SQL placeholders vs values
- Incorrect SQL string spacing in the `WHERE` clause
- Cursor timestamp formatting mismatches
- A temporary database connection config issue while testing locally and while switching to the hosted production database

In short, AI was used as a development assistant for learning, design discussion, debugging, and documentation support, while the final project setup, deployment, and testing were completed by me.

---

## Author

**Mohd Abdul Sabeeh**