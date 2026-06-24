const {getProducts} = require("../services/productService")

async function getProductsController(req, res) {
    try {
        const {limit, category, cursor} = req.query;
        
        const result = await getProducts({
            limit, 
            category, 
            cursor
        })

        return res.status(200).json({
            success: true,
            data: result.products,
            pagination: {
                nextCursor: result.nextCursor,
                hasMore: result.hasMore,
                limit: result.limit
            }
        })
    } catch (error) {
        console.error("Error fetching products: ", error.message)
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to fetch products"
        })
    }
}

module.exports = {
    getProductsController
}