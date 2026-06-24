function formatDateCursor(dateValue) {
    const date = new Date(dateValue);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")
    const seconds = String(date.getSeconds()).padStart(2, "0")

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function encodeCursor(product) {
    if (!product) return null;

    const updatedAt = formatDateCursor(product.updated_at);
    const rawCursor = `${updatedAt}|${product.id}`
    return Buffer.from(rawCursor).toString("base64");
}

function decodeCursor(cursor) {
    if (!cursor) return null;

    try {
        const decodedCursor = Buffer.from(cursor, "base64").toString("utf-8");
        const [updatedAt, id] = decodedCursor.split("|");

        if (!updatedAt || !id) return null;

        return {
            updatedAt,
            id: Number(id)
        }
    } catch (error) {
        return null;
    }
}

module.exports = {
    encodeCursor,
    decodeCursor
}