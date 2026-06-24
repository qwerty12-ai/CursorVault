const express = require("express")
const {getProductsController} = require("../controllers/productController")

const Productroutes = express.Router()

Productroutes.get("/", getProductsController);

module.exports = Productroutes;