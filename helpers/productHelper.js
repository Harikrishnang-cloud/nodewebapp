const productOfferCalculate = (products) => {
    return new Promise((resolve, reject) => {
        try {
            for (let product of products) {
                const productDiscount = ((product.regularPrice - product.salePrice) / product.regularPrice) * 100;
                product["finalPrice"] = product.salePrice;
                product["totalDiscount"] = productDiscount;
                console.log(product.cat.offer);
                if (product.cat.offer) {

                    const categoryDiscountAmount = product.salePrice * (product.cat.offer / 100);
                    product["finalPrice"] = product.salePrice - categoryDiscountAmount;
                    product["totalDiscount"] = productDiscount + product.cat.offer;
                }
                else if (!product.cat.offer) {
                    product["finalPrice"] = product.salePrice;
                    product["totalDiscount"] = productDiscount;
                }
                
                product["finalPrice"] = Math.max(0, Math.round(product.finalPrice * 100) / 100);
                product["totalDiscount"] = Math.round(product.totalDiscount * 100) / 100;
            }
            resolve(products);
        } catch (error) {
            console.error('Error in productOfferCalculate:', error);
            reject(error);
        }
    });
};

module.exports = {
    productOfferCalculate
};
