const pool = require("../config/db")
const {encodeCursor, decodeCursor} = require("../utils/cursor")

async function getProducts({limit = 20, category, cursor}) {
    const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const fetchLimit = parsedLimit + 1; // gonna fetch one more row if more pages exist.

    let sql = `SELECT id, name, category, price, created_at, updated_at FROM products `;

    const conditions = []
    const values = []

    const normalizedCategory = category?.trim();

    // category filter
    if (normalizedCategory) {
        conditions.push(`category=?`);
        values.push(normalizedCategory)
    }

    // cursor pagination
    if (cursor) {
        const decoded = decodeCursor(cursor);
        if(!decoded) {
            const error = new Error("Invalid cursor format");
            error.statusCode = 400;
            throw error;
        }
        conditions.push(`(updated_at < ? OR (updated_at = ? AND id < ?))`)
        values.push(decoded.updatedAt, decoded.updatedAt, decoded.id)
    }

    // adding where if we have condition
    if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(" AND ")}`
    }

    // newest first to maintain proper order
    sql += ` ORDER BY updated_at DESC, id DESC LIMIT ?`;
    values.push(fetchLimit)
    const [rows] = await pool.query(sql, values)

    let hasMore = false;
    let products = rows;

    if (rows.length > parsedLimit) {
        hasMore = true
        products = rows.slice(0, parsedLimit);
    }

    const lastProduct = products.length > 0 ? products[products.length - 1] : null;
    const nextCursor = hasMore ? encodeCursor(lastProduct) : null;

    return {
        products,
        nextCursor,
        hasMore,
        limit: parsedLimit
    }
}

module.exports = {
    getProducts
}