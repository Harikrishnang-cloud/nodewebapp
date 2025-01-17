const productOfferCalculate = (products) => {
    return new Promise((resolve, reject) => {
        try {
            for (let product of products) {
                // Calculate base product discount 
                const productDiscount = ((product.regularPrice - product.salePrice) / product.regularPrice) * 100;
                
                // Set initial values
                product.finalPrice = product.salePrice;
                product.productOffer = Math.round(productDiscount); // discount percentage
                product.totalDiscount = productDiscount;

                if (product.cat && product.cat.offer) {
                    const categoryDiscountAmount = product.salePrice * (product.cat.offer / 100);
                    product.finalPrice = product.salePrice - categoryDiscountAmount;
                    product.totalDiscount = productDiscount + product.cat.offer;
                }

                // Round values for display
                product.finalPrice = Math.max(0, Math.round(product.finalPrice * 100) / 100);
                product.totalDiscount = Math.round(product.totalDiscount);
                product.productOffer = Math.round(product.productOffer);
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
