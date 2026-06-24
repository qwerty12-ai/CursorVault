const express = require("express")
const app = express()
const pool = require("./config/db")
const Productroutes = require("./routes/productRoutes")

app.use(express.json())

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "CursorVault API is running."
    })
})

app.use("/api/products", Productroutes)

app.get("/test-db", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT NOW() as currentTime");
        res.json(rows)
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

module.exports = app