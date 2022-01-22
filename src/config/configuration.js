module.exports = {
    configuration: { 
        isDevelopment : process.env.NODE_ENV === "development",
        isProduction  : process.env.NODE_ENV === "production"
    }
}