require("dotenv").config();

const pool = require("../src/config/db")
const { faker } = require("@faker-js/faker")

const categories = [
    "Electronics",
    "Books",
    "Clothing",
    "Sports",
    "Home"
]


async function seedProducts(totalCount, batchSize) {
    try {
        for (let inserted = 0; inserted < totalCount; inserted += batchSize) {
            const products = []
            const currentBatchSize = Math.min(batchSize, totalCount - inserted);
            for(let i = 0; i < currentBatchSize; i++) {
                const product = {
                    name: faker.commerce.productName(),
                    category: categories[Math.floor(Math.random() * categories.length)],
                    price: faker.commerce.price(),
                    created_at: new Date(),
                    updated_at: new Date()
                }
                products.push([
                    product.name,
                    product.category,
                    product.price,
                    product.created_at,
                    product.updated_at
                ])
            }
            await pool.query(
                `INSERT INTO products (name, category, price, created_at, updated_at) VALUES ?`, [products]
            )

            console.log(`Inserted ${inserted + currentBatchSize} / ${totalCount} products`)
        }
        console.log(`Seeding completed: ${totalCount} products inserted successfully`)
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error("Seeding failed: ", error.message);
        process.exit(1);
    }
}

seedProducts(200000, 5000);