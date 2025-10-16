#!/bin/bash
# Complete setup script for RPA Backend

echo "========================================="
echo "  RPA Backend - Complete Setup"
echo "========================================="
echo ""

# Zkontroluj že jsme v root adresáři projektu
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from project root directory"
    exit 1
fi

# 1. Node.js dependencies
echo "📦 [1/4] Installing Node.js dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install Node.js dependencies"
    exit 1
fi
echo "✓ Node.js dependencies installed"
echo ""

# 2. Python environment
echo "🐍 [2/4] Setting up Python environment..."
cd scripts/analyzy
if [ -f "setup-python-env.sh" ]; then
    ./setup-python-env.sh
    if [ $? -ne 0 ]; then
        echo "❌ Failed to setup Python environment"
        exit 1
    fi
else
    echo "⚠️  Warning: setup-python-env.sh not found, skipping Python setup"
fi
cd ../..
echo ""

# 3. Reporter dependencies
echo "📄 [3/4] Installing Reporter dependencies..."
cd scripts/reports
if [ -f "package.json" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install Reporter dependencies"
        exit 1
    fi
    echo "✓ Reporter dependencies installed"
else
    echo "⚠️  Warning: package.json not found in scripts/reports/"
fi
cd ../..
echo ""

# 4. Environment configuration
echo "⚙️  [4/4] Checking environment configuration..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "⚠️  .env file not found"
        echo "   Please copy .env.example to .env and configure:"
        echo "   cp .env.example .env"
    else
        echo "⚠️  No .env or .env.example found"
        echo "   Please create .env with your configuration"
    fi
else
    echo "✓ .env file exists"
fi
echo ""

echo "========================================="
echo "  Setup Complete!"
echo "========================================="
echo ""
echo "✅ Node.js dependencies installed"
echo "✅ Python environment configured"
echo "✅ Reporter dependencies installed"
echo ""
echo "Next steps:"
echo "1. Configure .env file if needed"
echo "2. Setup database tables (see README.md)"
echo "3. Start server: npm start"
echo ""
