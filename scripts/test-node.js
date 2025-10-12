// Test Node.js skript pro ověření podpory
console.log("Node.js test script executed successfully!");
console.log(`Working directory: ${process.cwd()}`);
console.log(`Arguments: ${process.argv}`);

// Simulujeme nějakou práci
for(let i = 0; i < 3; i++) {
    console.log(`Processing step ${i+1}...`);
}

console.log("Node.js script completed successfully!");