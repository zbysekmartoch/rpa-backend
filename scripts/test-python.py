#!/usr/bin/env python3
# Test skript pro ověření R podpory a loggingu

import sys
import os

print("Python test script executed successfully!")
print(f"Working directory: {os.getcwd()}")
print(f"Arguments: {sys.argv}")

# Simulujeme nějakou práci
for i in range(3):
    print(f"Processing step {i+1}...")

print("Python script completed successfully!")