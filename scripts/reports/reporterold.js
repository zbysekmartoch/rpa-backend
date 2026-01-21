import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
//import mysql from 'mysql2/promise';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

var IMAGES_DIR;
var PRODUCT_IMG_DIR;
// --- Načtení pracovního adresáře a data.json ---
const workingDir = process.argv[2];
if (!workingDir) {
    console.error('Chyba: Nebyl předán pracovní adresář jako parametr');
    process.exit(1);
}

// Globální objekt pro data
let data = {};

function loadData() {
    try {
        const dataPath = path.join(workingDir, 'data.json');
        const dataContent = fs.readFileSync(dataPath, 'utf-8');
        data = JSON.parse(dataContent);
        console.log('Data.json byl úspěšně načten');
    } catch (error) {
        console.error('Chyba při načítání data.json:', error.message);
        process.exit(1);
    }
}



function getSubfolders(dirPath) {
    return fs.readdirSync(dirPath, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
}

function makeObjectFromKeys(keys, value) {
    return Object.fromEntries(keys.map(k => [k, value]));
}


function enhanceProducts(products) {
    products.forEach(p => {
         let charCaptions = {
            N: 'N - Počet pozorování za vybrané období',
            Nmin: 'Nmin - minimální počet nenulového denního pozorování',
            Nmax: 'Nmax - maximální počet nenulového denního pozorování',
            Pmin: 'Pmin - minimální cena za vybrané období',
            Pmax: 'Pmax - maximální cena za vybrané období',
            PmodeAll: 'Pmode - Nejnižší nejčastější cena za vybrané období',
            Pp: 'Pp - Průměrná cena za  vybrané období',
            Pmed: 'Pmed - Mediánová cena za vybrané období',
            Nmode: 'Počet výskytů Pmode za vybrané období',
            T0: 'Počet dní s žádnou pozorovanou cenou',
            determ: 'Hodnota determinace cen'
        }
        let characteristics = Object.keys(p)
            .filter(k => ['N', 'Nmin', 'Nmax', 'Pmin', 'Pmax', 'PmodeAll', 'Nmode', 'T0', 'Pp', 'Pmed', 'determ'].includes(k))
            .map(k => ({ key: charCaptions[k], value: p[k] ?? '' }));

        p.characteristics = characteristics;
    });
}


// --- Image module config pro Docxtemplater ---
function buildImageModule(allProducts) {
    // Mapuj index → buffer obrázku (vyřešíme dopředu, ať v getImage jen sáhne do cache)

    return new ImageModule({
        centered: false,
        getImage: function (tagValue, tagName) {
            // tagValue očekáváme jako index produktu (číslo) nebo přímo buffer/filepath
            // V šabloně použijeme {{{img/slozka}}} a do data vložíme id → tady z cache vrátíme buffer.
            let subFolderName = tagName.slice(4);
            let imgPath = path.join(`${IMAGES_DIR}/${subFolderName}/${tagValue}`);
            if (tagName == 'img_product') {
                imgPath = path.join(`${PRODUCT_IMG_DIR}/product_${tagValue}`);
            }
            // Pokud je tagValue přímo buffer nebo cesta k souboru, použij to
            if (tagValue=='ABSOLUTE') {
                imgPath = path.join(`${IMAGES_DIR}/${subFolderName}`);
            }

            if (fs.existsSync(imgPath + '.png')) {
                return fs.readFileSync(imgPath + '.png');
            }


            if (fs.existsSync(imgPath + '.jpg')) {
                return fs.readFileSync(imgPath + '.jpg');
            }

            // Bez obrázku vrať 1×1 transparentní PNG (aby se generování nezastavilo)
            const emptyPng = Buffer.from(
                '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C63600000020001' +
                '0001055DF2A00000000049454E44AE426082', 'hex'
            );
            return emptyPng;
        },
        getSize: function (img, tagValue, tagName) {
            // Šířka × výška v px; Word si to přepočítá. Uprav dle potřeby (např. 1100×650).
            if (tagName == 'img_product') return [189, 189]
             if (tagValue == 'ABSOLUTE') return [500, 375]
            return [500, 625];
            return [500, 400];
            return [600, 480];
            return [640, 512];
            return [900, 720];
        },
    });
}

function ISO2CZ(date) {
    const [year, month, day] = date.split('-');
    const formatted = `${parseInt(day)}.${parseInt(month)}.${year}`;
    return formatted;
}

/**
 * Přidá img_xxx atributy do reportData pro všechny obrázky v IMAGES_DIR
 * @param {Object} reportData - Objekt s daty reportu
 * @returns {Object} reportData obohacený o img_xxx atributy
 */
function addImgTags(reportData) {
    if (!fs.existsSync(IMAGES_DIR)) {
        console.log(`Adresář ${IMAGES_DIR} neexistuje, přeskakuji přidávání img tagů`);
        return reportData;
    }

    try {
        // Načti všechny soubory přímo v IMAGES_DIR (ne rekurzivně)
        const files = fs.readdirSync(IMAGES_DIR, { withFileTypes: true });
        
        // Filtruj pouze PNG a JPG soubory (ne složky)
        const imageFiles = files.filter(file => 
            file.isFile() && 
            (file.name.toLowerCase().endsWith('.png') || file.name.toLowerCase().endsWith('.jpg'))
        );

        console.log(`Nalezeno ${imageFiles.length} obrázků v ${IMAGES_DIR}`);

        // Přidej img_xxx atributy
        imageFiles.forEach(file => {
            // Získej název souboru bez přípony
            const nameWithoutExt = path.parse(file.name).name;
            const attrName = `img_${nameWithoutExt}`;
            
            // Přidej atribut s hodnotou "ABSOLUTE"
            reportData[attrName] = 'ABSOLUTE';
            
            console.log(`  + ${attrName} = "ABSOLUTE"`);
        });

        return reportData;
    } catch (error) {
        console.error(`Chyba při přidávání img tagů: ${error.message}`);
        return reportData;
    }
}

async function main() {


    loadData();

    // 2) Připrav data
    let reportData = data;

    enhanceProducts(reportData.products);

    IMAGES_DIR = path.join(workingDir, 'img');
    // Předpokládáme, že v pracovním adresáři je podsložka img s podsložkami pro různé typy obrázků
    PRODUCT_IMG_DIR = path.join(workingDir, '../../common/img/products');

    let imgKeys = getSubfolders(IMAGES_DIR).map(e => 'img_' + e); // podsložky v workdir/img
    imgKeys.push('img_product'); // přidej i složku img_product pro hlavní obrázek produktu


    // Přidej do každého produktu pole `image`, které image modul pochopí (tady použijeme index produktu)

    reportData.products = reportData.products.map(p => ({ ...p, ...makeObjectFromKeys(imgKeys, p.id) }));
    //reportData.generatedAt = new Date().toLocaleString('cs-CZ', { dateStyle: 'long', timeStyle: 'short' });

 //   reportData = { ...reportData, ...data }
    reportData.dateFromDMY=ISO2CZ(reportData.dateFrom);
    reportData.dateToDMY=ISO2CZ(reportData.dateTo);
    reportData.processedAtDMY=ISO2CZ(reportData.processedAt);
   
    addImgTags(reportData);

    // 3) Zpracuj konfigurace dokumentů
    let docConfigs = [];
    
    // Kontrola zda existuje report.doc v datech
    if (reportData.report && reportData.report.doc && Array.isArray(reportData.report.doc)) {
        docConfigs = reportData.report.doc;
        console.log(`Nalezeno ${docConfigs.length} konfigurací dokumentů v data.json`);
    } else {
        // Fallback na výchozí konfiguraci pro zpětnou kompatibilitu
        console.log('Konfigurace report.doc nenalezena, použiji výchozí template.docx');
        docConfigs = [{
            template: 'template.docx',
            renderTo: 'report.docx'
        }];
    }

    // 4) Zpracuj každý dokument
    for (const docConfig of docConfigs) {
        const templateName = docConfig.template;
        const outputName = docConfig.renderTo;
        
        console.log(`\nZpracovávám dokument: ${templateName} -> ${outputName}`);
        
        try {
            // Načti šablonu
            const templatePath = path.join(__dirname, templateName);
            
            if (!fs.existsSync(templatePath)) {
                console.error(`Chyba: Šablona ${templateName} nebyla nalezena v ${__dirname}`);
                continue; // Pokračuj dalším dokumentem
            }
            
            const content = fs.readFileSync(templatePath, 'binary');
            const zip = new PizZip(content);
            const imageModule = buildImageModule(data.products);
            
            const doc = new Docxtemplater(zip, {
                modules: [imageModule],
                paragraphLoop: true,
                linebreaks: true,
                delimiters: { start: '[[', end: ']]' },
            });

            // Renderuj s daty
            doc.render(reportData);

            // Ulož dokument
            const buf = doc.getZip().generate({ type: 'nodebuffer' });
            const outPath = path.join(workingDir, outputName);
            fs.writeFileSync(outPath, buf);
            
            console.log(`✓ Dokument vytvořen: ${outPath}`);
            
        } catch (error) {
            console.error(`✗ Chyba při zpracování dokumentu ${templateName}:`, error.message);
            // Pokračuj dalším dokumentem místo ukončení celého scriptu
        }
    }
    
    console.log(`\n=== Generování dokumentů dokončeno ===`);
}



main().catch(err => {
    console.error(err);
    process.exit(1);
});


