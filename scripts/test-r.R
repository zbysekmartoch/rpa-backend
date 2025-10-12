# Test R skript pro ověření podpory
cat("R test script executed successfully!\n")
cat("R version:", R.version.string, "\n")

# Simulujeme nějakou práci
for(i in 1:3) {
  cat("Processing step", i, "...\n")
}

cat("R script completed successfully!\n")