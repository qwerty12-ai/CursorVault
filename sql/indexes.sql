CREATE INDEX idx_products_cursor ON products(updated_at DESC, id DESC);

CREATE INDEX idx_products_category_cursor ON products(category, updated_at DESC, id DESC);