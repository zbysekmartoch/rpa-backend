# Python Environment Setup

Dokumentace pro setup Python virtual environment pro analysis skripty.

## Požadavky

- **Python 3.8+** (doporučeno 3.12)
- **pip** (Python package manager)
- **venv** (standardně součástí Python 3)

## Rychlý Start

### Automatický Setup (Doporučeno)

```bash
cd scripts/analyzy
./setup-python-env.sh
```

Script automaticky:
1. ✅ Zkontroluje Python 3 instalaci
2. ✅ Vytvoří virtual environment v `.venv/`
3. ✅ Nainstaluje všechny dependencies z `requirements.txt`
4. ✅ Zobrazí seznam nainstalovaných balíčků

### Manuální Setup

```bash
cd scripts/analyzy

# Vytvoř virtual environment
python3 -m venv .venv

# Aktivuj environment
source .venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Nainstaluj dependencies
pip install -r requirements.txt

# Ověř instalaci
pip list
```

## Installed Packages

Aktuální `requirements.txt` obsahuje:

- **contourpy** (1.3.1) - Konturové grafy
- **cycler** (0.12.1) - Styling pro matplotlib
- **fonttools** (4.55.0) - Font utilities
- **kiwisolver** (1.4.7) - Fast constraint solver
- **matplotlib** (3.9.2) - Plotting library
- **mysql-connector-python** (9.1.0) - MySQL database connector
- **numpy** (2.1.3) - Numerical computing
- **packaging** (24.2) - Core utilities for packages
- **pillow** (11.0.0) - Image processing
- **pyparsing** (3.2.0) - Parsing library
- **python-dateutil** (2.9.0.post0) - Date/time utilities
- **scikit-learn** (1.5.2) - Machine learning
- **scipy** (1.14.1) - Scientific computing
- **six** (1.16.0) - Python 2/3 compatibility
- **threadpoolctl** (3.6.0) - Thread pool control
- **joblib** (1.4.2) - Lightweight pipelining

## Použití

### Aktivace Environment

**Před spuštěním Python skriptů vždy aktivuj environment:**

```bash
cd scripts/analyzy
source .venv/bin/activate
```

Poznáš to podle `(.venv)` prefixu v terminálu:
```bash
(.venv) user@host:~/scripts/analyzy$
```

### Deaktivace Environment

```bash
deactivate
```

### Spuštění Analysis Scriptu

```bash
# Aktivuj environment
source .venv/bin/activate

# Spusť script
python plot_cenovy_odstup_b.py

# Nebo bez aktivace (použije .venv/bin/python přímo)
.venv/bin/python plot_cenovy_odstup_b.py
```

## Backend Integration

Backend automaticky používá Python z virtual environment při spouštění analysis skriptů.

V `config.json`:
```json
{
  "scriptCommands": {
    ".py": {
      "command": "scripts/analyzy/.venv/bin/python",
      "description": "Python scripts with venv"
    }
  }
}
```

## Přidání Nového Balíčku

### 1. Aktivuj environment
```bash
source .venv/bin/activate
```

### 2. Nainstaluj balíček
```bash
pip install package-name
```

### 3. Aktualizuj requirements.txt
```bash
pip freeze > requirements.txt
```

### 4. Commitni do gitu
```bash
git add requirements.txt
git commit -m "Add package-name to Python dependencies"
git push
```

## Troubleshooting

### Python 3 není nalezen

**Problém:**
```bash
python3: command not found
```

**Řešení:**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install python3 python3-pip python3-venv

# CentOS/RHEL
sudo yum install python3 python3-pip

# macOS
brew install python@3.12
```

### Permission Denied na setup scriptu

**Problém:**
```bash
-bash: ./setup-python-env.sh: Permission denied
```

**Řešení:**
```bash
chmod +x setup-python-env.sh
./setup-python-env.sh
```

### Import Error po instalaci

**Problém:**
```python
ModuleNotFoundError: No module named 'matplotlib'
```

**Řešení:**
```bash
# Ujisti se že environment je aktivovaný
source .venv/bin/activate

# Znovu nainstaluj dependencies
pip install -r requirements.txt
```

### Stará verze balíčku

**Problém:**
Potřebuješ novější verzi balíčku

**Řešení:**
```bash
source .venv/bin/activate
pip install --upgrade package-name
pip freeze > requirements.txt
```

### Virtual Environment Corruption

**Problém:**
Environment je poškozen nebo nefunkční

**Řešení:**
```bash
# Smaž starý environment
rm -rf .venv

# Vytvoř nový
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Deployment

### Na Produkčním Serveru

```bash
# 1. Naklonuj repository
git clone https://github.com/zbysekmartoch/rpa-backend.git
cd rpa-backend/scripts/analyzy

# 2. Spusť setup
./setup-python-env.sh

# 3. Ověř instalaci
source .venv/bin/activate
python --version
pip list
```

### Docker Deployment

V `Dockerfile`:

```dockerfile
FROM node:20-slim

# Install Python
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Setup Python environment
COPY scripts/analyzy/requirements.txt /app/scripts/analyzy/
RUN cd /app/scripts/analyzy && \
    python3 -m venv .venv && \
    .venv/bin/pip install --upgrade pip && \
    .venv/bin/pip install -r requirements.txt

# Copy rest of application
COPY . /app
RUN npm install

EXPOSE 3000
CMD ["npm", "start"]
```

### CI/CD Integration

**GitHub Actions:**

```yaml
name: Setup Python Environment

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.12'
      
      - name: Setup Python environment
        run: |
          cd scripts/analyzy
          ./setup-python-env.sh
      
      - name: Test Python scripts
        run: |
          cd scripts/analyzy
          source .venv/bin/activate
          python -c "import matplotlib; import numpy; print('OK')"
```

## Best Practices

### 1. ✅ Vždy použij Virtual Environment
```bash
# ŠPATNĚ - globální instalace
pip install matplotlib

# SPRÁVNĚ - do venv
source .venv/bin/activate
pip install matplotlib
```

### 2. ✅ Udržuj requirements.txt aktuální
```bash
# Po každé změně dependencies
pip freeze > requirements.txt
git add requirements.txt
git commit -m "Update Python dependencies"
```

### 3. ✅ Verzuj requirements.txt, ne .venv
```gitignore
# .gitignore
scripts/analyzy/.venv/
scripts/analyzy/__pycache__/
*.pyc
```

### 4. ✅ Dokumentuj speciální dependencies
Pokud balíček vyžaduje systémové knihovny, přidej do README:

```markdown
## System Dependencies

Pro `pillow` je potřeba:
```bash
sudo apt-get install libjpeg-dev zlib1g-dev
```
```

### 5. ✅ Pin verze v production
Pro stabilní production použij přesné verze:

```txt
matplotlib==3.9.2
numpy==2.1.3
```

Místo:
```txt
matplotlib>=3.9.0
numpy
```

## Výhody Virtual Environment

1. **Izolace** - Každý projekt má své dependencies
2. **Reprodukovatelnost** - Stejné verze všude
3. **Bezpečnost** - Neovlivňuje systémový Python
4. **Flexibilita** - Různé verze pro různé projekty
5. **Deployment** - Snadné nasazení na server

## Struktura Složky

```
scripts/analyzy/
├── .venv/                    # Virtual environment (gitignore)
│   ├── bin/
│   │   ├── python           # Python interpreter
│   │   ├── pip              # Package manager
│   │   └── activate         # Activation script
│   ├── lib/
│   │   └── python3.12/
│   │       └── site-packages/  # Installed packages
│   └── pyvenv.cfg
├── __pycache__/             # Compiled Python (gitignore)
├── requirements.txt         # Dependencies list (versioned)
├── setup-python-env.sh      # Setup script (versioned)
├── dbsettings.py            # DB configuration
├── plot_*.py                # Analysis scripts
└── *.py                     # Other Python scripts
```

## Reference

- [Python venv documentation](https://docs.python.org/3/library/venv.html)
- [pip requirements.txt](https://pip.pypa.io/en/stable/reference/requirements-file-format/)
- [Virtual Environments Guide](https://packaging.python.org/guides/installing-using-pip-and-virtual-environments/)

## FAQ

**Q: Můžu použít virtualenv místo venv?**  
A: Ano, ale `venv` je součástí Python 3 a je doporučený způsob.

**Q: Jak aktualizovat všechny balíčky?**  
A: `pip list --outdated` + `pip install --upgrade package-name`

**Q: Kolik místa zabírá .venv?**  
A: Cca 200-500 MB podle počtu balíčků.

**Q: Můžu sdílet .venv mezi projekty?**  
A: Ne, každý projekt by měl mít vlastní venv.

**Q: Jak smazat cache?**  
A: `pip cache purge` nebo `rm -rf ~/.cache/pip`
